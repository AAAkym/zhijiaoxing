"""
多轮对话服务

提供连续上下文理解、对话状态追踪、意图识别等功能
"""
import uuid
import json
import re
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, asdict

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.conversation_service import conversation_service
from models.conversation import Conversation, ConversationMessage


@dataclass
class DialogueState:
    """对话状态"""
    current_topic: str = ""
    dialogue_stage: str = "initial"  # initial, exploring, clarifying, concluding
    user_intent: str = ""
    intent_confidence: float = 0.0
    extracted_entities: Dict[str, Any] = None
    context_summary: str = ""
    turn_count: int = 0
    
    def __post_init__(self):
        if self.extracted_entities is None:
            self.extracted_entities = {}
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class IntentRecord:
    """意图记录"""
    message_id: str
    intent_type: str
    intent_confidence: float
    entities: Dict[str, Any]
    related_to_previous: bool
    timestamp: datetime
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'message_id': self.message_id,
            'intent_type': self.intent_type,
            'intent_confidence': self.intent_confidence,
            'entities': self.entities,
            'related_to_previous': self.related_to_previous,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }


class ContextWindowManager:
    """
    上下文窗口管理器
    
    管理对话上下文的组装和截断
    """
    
    def __init__(self, max_tokens: int = 4000, max_messages: int = 20):
        self.max_tokens = max_tokens
        self.max_messages = max_messages
        # 简单token估算：中文1字≈1token，英文1词≈1.3token
        self.chinese_token_rate = 1.0
        self.english_token_rate = 1.3
    
    def estimate_tokens(self, text: str) -> int:
        """估算文本的token数量"""
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
        english_words = len(re.findall(r'[a-zA-Z]+', text))
        other_chars = len(text) - chinese_chars - english_words
        
        return int(
            chinese_chars * self.chinese_token_rate +
            english_words * self.english_token_rate +
            other_chars * 0.5
        )
    
    def assemble_context(self, messages: List[ConversationMessage],
                        strategy: str = 'sliding_window',
                        system_prompt: Optional[str] = None) -> List[Dict[str, str]]:
        """
        组装上下文
        
        Args:
            messages: 消息列表
            strategy: 策略 (sliding_window, summary, key_points)
            system_prompt: 系统提示词
            
        Returns:
            组装后的上下文
        """
        context = []
        
        # 添加系统提示
        if system_prompt:
            context.append({
                'role': 'system',
                'content': system_prompt
            })
        
        # 根据策略处理消息
        if strategy == 'sliding_window':
            processed_messages = self._apply_sliding_window(messages)
        elif strategy == 'summary':
            processed_messages = self._apply_summary(messages)
        elif strategy == 'key_points':
            processed_messages = self._apply_key_points(messages)
        else:
            processed_messages = messages
        
        # 转换为标准格式
        for msg in processed_messages:
            context.append({
                'role': msg.role,
                'content': msg.content
            })
        
        # 检查token限制
        context = self._enforce_token_limit(context)
        
        return context
    
    def _apply_sliding_window(self, messages: List[ConversationMessage]) -> List[ConversationMessage]:
        """应用滑动窗口策略"""
        # 保留最近N条消息
        return sorted(messages, key=lambda m: m.sequence)[-self.max_messages:]
    
    def _apply_summary(self, messages: List[ConversationMessage]) -> List[ConversationMessage]:
        """应用摘要策略"""
        if len(messages) <= self.max_messages:
            return sorted(messages, key=lambda m: m.sequence)
        
        # 保留第一条、最后N-1条，中间用摘要代替
        sorted_msgs = sorted(messages, key=lambda m: m.sequence)
        first_msg = sorted_msgs[0]
        last_msgs = sorted_msgs[-(self.max_messages-1):]
        
        # 创建摘要消息
        summary_content = f"[前文摘要] 对话共{len(messages)}条消息，涉及主题：{self._extract_topics(sorted_msgs[1:-(self.max_messages-1)])}"
        
        summary_msg = ConversationMessage(
            message_id='summary',
            role='system',
            content=summary_content
        )
        
        return [first_msg, summary_msg] + last_msgs
    
    def _apply_key_points(self, messages: List[ConversationMessage]) -> List[ConversationMessage]:
        """应用关键信息提取策略"""
        sorted_msgs = sorted(messages, key=lambda m: m.sequence)
        
        # 提取关键信息
        key_points = self._extract_key_points(sorted_msgs[:-5])  # 除最近5条外
        
        if key_points:
            key_points_content = "[关键信息]\n" + "\n".join([f"- {point}" for point in key_points])
            
            key_points_msg = ConversationMessage(
                message_id='key_points',
                role='system',
                content=key_points_content
            )
            
            # 返回关键信息 + 最近5条
            return [key_points_msg] + sorted_msgs[-5:]
        
        return sorted_msgs[-self.max_messages:]
    
    def _extract_topics(self, messages: List[ConversationMessage]) -> str:
        """提取话题（简化实现）"""
        # 实际项目中可以使用NLP技术提取主题
        topics = set()
        for msg in messages:
            if '课程' in msg.content:
                topics.add('课程学习')
            elif '问题' in msg.content or '?' in msg.content:
                topics.add('问题解答')
            elif '解释' in msg.content:
                topics.add('概念解释')
        
        return '、'.join(topics) if topics else '一般对话'
    
    def _extract_key_points(self, messages: List[ConversationMessage]) -> List[str]:
        """提取关键信息点"""
        key_points = []
        
        for msg in messages:
            if msg.role == 'user':
                # 提取用户偏好
                if '喜欢' in msg.content or '偏好' in msg.content:
                    key_points.append(f"用户偏好: {msg.content}")
                # 提取重要事实
                elif '需要' in msg.content or '要求' in msg.content:
                    key_points.append(f"用户需求: {msg.content}")
        
        return key_points[:5]  # 最多5个关键点
    
    def _enforce_token_limit(self, context: List[Dict[str, str]]) -> List[Dict[str, str]]:
        """强制执行token限制"""
        total_tokens = 0
        result = []
        
        # 从后向前遍历，保留最新消息
        for msg in reversed(context):
            msg_tokens = self.estimate_tokens(msg['content'])
            
            if total_tokens + msg_tokens > self.max_tokens:
                break
            
            total_tokens += msg_tokens
            result.insert(0, msg)
        
        return result


class DialogueStateTracker:
    """
    对话状态追踪器
    
    追踪对话状态、检测话题转移、识别用户意图
    """
    
    def __init__(self):
        self.intent_patterns = {
            'question': r'.*[？\?].*',
            'request_explanation': r'.*(解释|说明|什么是|什么是).*',
            'request_example': r'.*(举例|例子|示例).*',
            'confirmation': r'.*(是的|对|没错|正确).*',
            'negation': r'.*(不是|不对|错误|没有).*',
            'gratitude': r'.*(谢谢|感谢|多谢).*',
            'greeting': r'.*(你好|您好|嗨|hello|hi).*',
            'farewell': r'.*(再见|拜拜|bye).*',
        }
    
    def analyze_message(self, message: ConversationMessage,
                       previous_messages: List[ConversationMessage]) -> IntentRecord:
        """
        分析消息意图
        
        Args:
            message: 当前消息
            previous_messages: 历史消息
            
        Returns:
            意图记录
        """
        content = message.content
        
        # 识别意图类型
        intent_type = self._detect_intent(content)
        
        # 计算置信度
        confidence = self._calculate_confidence(content, intent_type)
        
        # 提取实体
        entities = self._extract_entities(content)
        
        # 判断是否关联上一条
        related = self._is_related_to_previous(content, previous_messages)
        
        return IntentRecord(
            message_id=message.message_id,
            intent_type=intent_type,
            intent_confidence=confidence,
            entities=entities,
            related_to_previous=related,
            timestamp=datetime.utcnow()
        )
    
    def _detect_intent(self, content: str) -> str:
        """检测意图类型"""
        for intent_type, pattern in self.intent_patterns.items():
            if re.match(pattern, content, re.IGNORECASE):
                return intent_type
        
        return 'general_chat'
    
    def _calculate_confidence(self, content: str, intent_type: str) -> float:
        """计算意图置信度"""
        # 简化实现，实际可以使用机器学习模型
        if intent_type == 'general_chat':
            return 0.5
        
        # 根据匹配程度计算
        pattern = self.intent_patterns.get(intent_type, '')
        if re.match(pattern, content, re.IGNORECASE):
            return 0.8
        
        return 0.6
    
    def _extract_entities(self, content: str) -> Dict[str, Any]:
        """提取实体"""
        entities = {}
        
        # 提取课程相关实体
        course_match = re.search(r'(《?[^》]+》?)(?:课程|课)', content)
        if course_match:
            entities['course'] = course_match.group(1)
        
        # 提取概念相关实体
        concept_match = re.search(r'什么是([\w\s]+)', content)
        if concept_match:
            entities['concept'] = concept_match.group(1).strip()
        
        # 提取数字实体
        numbers = re.findall(r'\d+', content)
        if numbers:
            entities['numbers'] = numbers
        
        return entities
    
    def _is_related_to_previous(self, content: str,
                                previous_messages: List[ConversationMessage]) -> bool:
        """判断是否关联上一条消息"""
        if not previous_messages:
            return False
        
        last_message = previous_messages[-1]
        
        # 检查是否包含指代词
        reference_words = ['它', '这个', '那个', '这些', '那些', '上述', '前面提到的']
        for word in reference_words:
            if word in content:
                return True
        
        # 检查是否是连续问答
        if '?' in last_message.content and len(previous_messages) >= 2:
            return True
        
        return False
    
    def update_dialogue_state(self, current_state: DialogueState,
                             intent_record: IntentRecord,
                             message: ConversationMessage) -> DialogueState:
        """更新对话状态"""
        state = DialogueState(**current_state.to_dict())
        
        # 更新意图
        state.user_intent = intent_record.intent_type
        state.intent_confidence = intent_record.intent_confidence
        state.extracted_entities = intent_record.entities
        
        # 更新轮数
        state.turn_count += 1
        
        # 更新对话阶段
        state.dialogue_stage = self._determine_stage(state)
        
        # 更新话题
        if not state.current_topic or not intent_record.related_to_previous:
            state.current_topic = self._detect_topic(message.content)
        
        return state
    
    def _determine_stage(self, state: DialogueState) -> str:
        """确定对话阶段"""
        if state.turn_count <= 2:
            return 'initial'
        elif state.turn_count <= 5:
            return 'exploring'
        elif state.user_intent in ['confirmation', 'negation']:
            return 'clarifying'
        elif state.turn_count > 10:
            return 'deep_discussion'
        else:
            return 'ongoing'
    
    def _detect_topic(self, content: str) -> str:
        """检测话题"""
        if '课程' in content:
            return 'course_learning'
        elif '问题' in content or '?' in content:
            return 'qa'
        elif '概念' in content or '定义' in content:
            return 'concept_explanation'
        elif '练习' in content or '题目' in content:
            return 'practice'
        else:
            return 'general'


class MultiTurnDialogueService:
    """
    多轮对话服务
    
    提供完整的对话管理功能
    """
    
    def __init__(self):
        self.context_manager = ContextWindowManager()
        self.state_tracker = DialogueStateTracker()
        self.conversation_service = conversation_service
    
    def chat(self, conversation_id: str, user_message: str,
            user_id: int,
            system_prompt: Optional[str] = None,
            context_strategy: str = 'sliding_window') -> Dict[str, Any]:
        """
        多轮对话
        
        Args:
            conversation_id: 会话ID（为空则创建新会话）
            user_message: 用户消息
            user_id: 用户ID
            system_prompt: 系统提示词
            context_strategy: 上下文策略
            
        Returns:
            对话结果
        """
        # 获取或创建会话
        if conversation_id:
            conversation = self.conversation_service.get_conversation(conversation_id)
            if not conversation:
                raise Exception("会话不存在")
        else:
            conversation = self.conversation_service.create_conversation(
                user_id=user_id,
                title=user_message[:30] + '...' if len(user_message) > 30 else user_message
            )
            conversation_id = conversation.conversation_id
        
        # 添加用户消息
        user_msg = self.conversation_service.add_message(
            conversation_id=conversation_id,
            role='user',
            content=user_message
        )
        
        # 获取历史消息
        messages, _ = self.conversation_service.get_messages(
            conversation_id=conversation_id,
            limit=100
        )
        
        # 分析用户意图
        intent_record = self.state_tracker.analyze_message(user_msg, messages[:-1])
        
        # 组装上下文
        context = self.context_manager.assemble_context(
            messages=messages,
            strategy=context_strategy,
            system_prompt=system_prompt
        )
        
        # 生成AI回复（这里调用AI服务）
        ai_response = self._generate_ai_response(context, user_message)
        
        # 添加AI消息
        ai_msg = self.conversation_service.add_message(
            conversation_id=conversation_id,
            role='assistant',
            content=ai_response['content'],
            metadata={
                'intent': intent_record.to_dict(),
                'model': ai_response.get('model'),
                'tokens': ai_response.get('tokens')
            }
        )
        
        return {
            'conversation_id': conversation_id,
            'user_message': user_msg.to_dict(),
            'ai_message': ai_msg.to_dict(),
            'intent': intent_record.to_dict(),
            'context_length': len(context)
        }
    
    def _generate_ai_response(self, context: List[Dict[str, str]],
                             user_message: str) -> Dict[str, Any]:
        """生成AI回复（简化实现）"""
        # 实际项目中调用真实的AI API
        # 这里返回模拟响应
        
        # 根据上下文生成回复
        if len(context) > 2:
            response_content = f"基于我们的对话历史，关于'{user_message}'，我认为..."
        else:
            response_content = f"关于'{user_message}'，我来为您解答..."
        
        return {
            'content': response_content,
            'model': 'gpt-4-simulated',
            'tokens': len(response_content)
        }
    
    def get_dialogue_context(self, conversation_id: str,
                            max_length: Optional[int] = None) -> Dict[str, Any]:
        """获取对话上下文"""
        conversation = self.conversation_service.get_conversation(conversation_id)
        if not conversation:
            raise Exception("会话不存在")
        
        messages, total = self.conversation_service.get_messages(
            conversation_id=conversation_id,
            limit=max_length or 100
        )
        
        # 组装上下文
        context = self.context_manager.assemble_context(
            messages=messages,
            strategy=conversation.context_strategy
        )
        
        return {
            'conversation_id': conversation_id,
            'context': context,
            'total_messages': total,
            'strategy': conversation.context_strategy
        }
    
    def clear_context(self, conversation_id: str, 
                     keep_system_prompt: bool = True) -> bool:
        """清空上下文"""
        try:
            conversation = self.conversation_service.get_conversation(conversation_id)
            if not conversation:
                return False
            
            # 软删除所有消息
            messages, _ = self.conversation_service.get_messages(
                conversation_id=conversation_id,
                include_deleted=False
            )
            
            for msg in messages:
                if not keep_system_prompt or msg.role != 'system':
                    self.conversation_service.delete_message(msg.message_id)
            
            return True
            
        except Exception:
            return False
    
    def get_dialogue_state(self, conversation_id: str) -> Optional[DialogueState]:
        """获取对话状态"""
        conversation = self.conversation_service.get_conversation(conversation_id)
        if not conversation:
            return None
        
        messages, _ = self.conversation_service.get_messages(
            conversation_id=conversation_id,
            limit=100
        )
        
        # 分析最后一条消息的状态
        if messages:
            last_msg = messages[-1]
            intent_record = self.state_tracker.analyze_message(last_msg, messages[:-1])
            
            return DialogueState(
                current_topic=self.state_tracker._detect_topic(last_msg.content),
                dialogue_stage=self.state_tracker._determine_stage(
                    DialogueState(turn_count=len(messages))
                ),
                user_intent=intent_record.intent_type,
                intent_confidence=intent_record.intent_confidence,
                extracted_entities=intent_record.entities,
                turn_count=len(messages)
            )
        
        return DialogueState()


# 全局服务实例
multi_turn_service = MultiTurnDialogueService()
