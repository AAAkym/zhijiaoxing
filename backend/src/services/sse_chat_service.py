"""
SSE流式问答服务

提供基于SSE协议的AI流式问答功能，整合对话上下文管理
"""
import json
import time
from typing import Generator, Dict, Any, Optional, List
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from services.spark_service import spark_service, chat_stream
from services.conversation_service import conversation_service
from services.knowledge_base import knowledge_base_service
from utils.sse_utils import SSEStream, SSEEventTypes


class SSEChatService:
    """
    SSE流式问答服务
    
    提供完整的流式问答功能，包括：
    - SSE协议流式输出
    - 对话上下文管理
    - 知识库检索增强
    - 错误处理和重连支持
    """
    
    def __init__(self):
        self.system_prompt = """你是一位专业的AI学习助手。请根据学生的问题，结合教学内容进行解答。

解答要求：
1. 准确、专业，内容要有深度
2. 易于理解，使用清晰的段落结构
3. 提供相关的学习建议和扩展知识
4. 鼓励学生继续学习

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。

请用中文回答，回答要详细完整。"""
    
    def stream_chat(
        self,
        question: str,
        user_id: int,
        conversation_id: Optional[str] = None,
        context: str = "",
        topic: str = "",
        temperature: float = 0.7,
        max_context_length: int = 10,
        user_role: str = None,
    ) -> Generator[str, None, None]:
        """
        流式问答
        
        Args:
            question: 用户问题
            user_id: 用户ID
            conversation_id: 会话ID（可选，为空则创建新会话）
            context: 额外上下文
            topic: 话题（用于知识库检索）
            temperature: 生成温度
            max_context_length: 最大上下文长度
            
        Yields:
            SSE格式的消息
        """
        sse = SSEStream(retry=3000)
        
        try:
            yield sse.send_config()
            
            yield sse.format_message({
                'type': 'start',
                'timestamp': time.time()
            }, event='start')
            
            yield sse.format_message({
                'type': 'thinking',
                'message': '正在分析问题...'
            }, event='message')
            
            conversation, conversation_id = self._get_or_create_conversation(
                user_id, conversation_id, question
            )
            
            yield sse.format_message({
                'type': 'conversation',
                'conversation_id': conversation_id,
                'title': conversation.title
            }, event='message')
            
            knowledge_content = ""
            if topic:
                yield sse.format_message({
                    'type': 'thinking',
                    'message': '正在检索知识库...'
                }, event='message')
                knowledge_content = knowledge_base_service.get_knowledge_by_topic(topic) or ""
            
            user_msg = conversation_service.add_message(
                conversation_id=conversation_id,
                role='user',
                content=question,
                metadata={'topic': topic, 'context': context}
            )
            
            messages = self._build_messages(
                conversation_id=conversation_id,
                question=question,
                context=context,
                knowledge_content=knowledge_content,
                max_context_length=max_context_length
            )
            
            yield sse.format_message({
                'type': 'thinking',
                'message': '正在生成回答...'
            }, event='message')
            
            full_response = ""
            chunk_count = 0
            
            for chunk in spark_service.chat_stream(messages, user_id=user_id, user_role=user_role):
                chunk_count += 1
                full_response += chunk
                
                yield sse.format_message({
                    'type': 'content',
                    'content': chunk,
                    'chunk_index': chunk_count
                }, event='message')
            
            ai_msg = conversation_service.add_message(
                conversation_id=conversation_id,
                role='assistant',
                content=full_response,
                metadata={
                    'model': 'spark',
                    'chunk_count': chunk_count,
                    'topic': topic
                }
            )
            
            yield sse.format_message({
                'type': 'complete',
                'message_id': ai_msg.message_id,
                'conversation_id': conversation_id,
                'total_chunks': chunk_count,
                'timestamp': time.time()
            }, event='complete')
            
            yield sse.send_done()
            
        except Exception as e:
            yield sse.format_message({
                'type': 'error',
                'error': str(e),
                'timestamp': time.time()
            }, event='error')
            yield sse.send_done()
    
    def stream_chat_simple(
        self,
        question: str,
        context: str = "",
        topic: str = "",
        user_id: int = None,
        user_role: str = None,
    ) -> Generator[str, None, None]:
        """
        简单流式问答（无会话管理）
        
        Args:
            question: 用户问题
            context: 额外上下文
            topic: 话题
            
        Yields:
            SSE格式的消息
        """
        sse = SSEStream(retry=3000)
        
        try:
            yield sse.send_config()
            
            yield sse.format_message({
                'type': 'start',
                'timestamp': time.time()
            }, event='start')
            
            knowledge_content = ""
            if topic:
                knowledge_content = knowledge_base_service.get_knowledge_by_topic(topic) or ""
            
            messages = self._build_simple_messages(
                question=question,
                context=context,
                knowledge_content=knowledge_content
            )
            
            full_response = ""
            chunk_count = 0
            
            for chunk in spark_service.chat_stream(messages, user_id=user_id, user_role=user_role):
                chunk_count += 1
                full_response += chunk
                
                yield sse.format_message({
                    'type': 'content',
                    'content': chunk,
                    'chunk_index': chunk_count
                }, event='message')
            
            yield sse.format_message({
                'type': 'complete',
                'total_chunks': chunk_count,
                'timestamp': time.time()
            }, event='complete')
            
            yield sse.send_done()
            
        except Exception as e:
            yield sse.format_message({
                'type': 'error',
                'error': str(e),
                'timestamp': time.time()
            }, event='error')
            yield sse.send_done()
    
    def _get_or_create_conversation(
        self,
        user_id: int,
        conversation_id: Optional[str],
        question: str
    ):
        """获取或创建会话"""
        if conversation_id:
            conversation = conversation_service.get_conversation(conversation_id)
            if conversation:
                return conversation, conversation_id
        
        title = question[:30] + '...' if len(question) > 30 else question
        conversation = conversation_service.create_conversation(
            user_id=user_id,
            title=title,
            context_strategy='sliding_window'
        )
        return conversation, conversation.conversation_id
    
    def _build_messages(
        self,
        conversation_id: str,
        question: str,
        context: str,
        knowledge_content: str,
        max_context_length: int
    ) -> List[Dict[str, str]]:
        """构建消息列表"""
        messages = [{"role": "system", "content": self.system_prompt}]
        
        history, _ = conversation_service.get_messages(
            conversation_id=conversation_id,
            limit=max_context_length
        )
        
        for msg in history:
            if msg.role in ['user', 'assistant']:
                messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        user_content = f"学生问题：{question}"
        if context:
            user_content += f"\n\n上下文：{context}"
        if knowledge_content:
            user_content += f"\n\n参考资料：\n{knowledge_content[:2000]}"
        user_content += "\n\n请回答学生的问题。"
        
        messages.append({"role": "user", "content": user_content})
        
        return messages
    
    def _build_simple_messages(
        self,
        question: str,
        context: str,
        knowledge_content: str
    ) -> List[Dict[str, str]]:
        """构建简单消息列表（无历史记录）"""
        messages = [{"role": "system", "content": self.system_prompt}]
        
        user_content = f"学生问题：{question}"
        if context:
            user_content += f"\n\n上下文：{context}"
        if knowledge_content:
            user_content += f"\n\n参考资料：\n{knowledge_content[:2000]}"
        user_content += "\n\n请回答学生的问题。"
        
        messages.append({"role": "user", "content": user_content})
        
        return messages


sse_chat_service = SSEChatService()
