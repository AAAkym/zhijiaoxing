"""
对话上下文管理服务

提供对话会话和消息的CRUD操作、上下文管理、自动清理等功能
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from contextlib import contextmanager

from sqlalchemy import and_, or_, desc, asc, func
from sqlalchemy.exc import SQLAlchemyError

from src.models.conversation import (
    Conversation, 
    ConversationMessage, 
    ConversationContext,
    ConversationArchive,
    db
)


class ConversationService:
    """
    对话上下文管理服务
    
    提供完整的对话管理功能，包括：
    - 会话的CRUD操作
    - 消息的CRUD操作
    - 上下文管理和检索
    - 自动清理和归档
    """
    
    def __init__(self):
        self.db = db
        self.default_max_context_length = 20
        self.archive_threshold_days = 30  # 30天前的会话自动归档
        self.cleanup_threshold_days = 90  # 90天前的会话彻底删除
    
    # ==================== 会话管理 ====================
    
    def create_conversation(self, user_id: int, title: Optional[str] = None,
                           max_context_length: int = None,
                           context_strategy: str = 'sliding_window',
                           metadata: Dict[str, Any] = None) -> Conversation:
        """
        创建新会话
        
        Args:
            user_id: 用户ID
            title: 会话标题
            max_context_length: 最大上下文长度
            context_strategy: 上下文策略
            metadata: 元数据
            
        Returns:
            创建的会话对象
        """
        try:
            conversation = Conversation(
                conversation_id=str(uuid.uuid4()),
                user_id=user_id,
                title=title or '新对话',
                max_context_length=max_context_length or self.default_max_context_length,
                context_strategy=context_strategy,
                metadata=metadata or {}
            )
            
            self.db.session.add(conversation)
            self.db.session.commit()
            
            return conversation
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"创建会话失败: {str(e)}")
    
    def get_conversation(self, conversation_id: str, 
                        include_messages: bool = False,
                        message_limit: int = 10) -> Optional[Conversation]:
        """
        获取会话
        
        Args:
            conversation_id: 会话ID
            include_messages: 是否包含消息
            message_limit: 消息数量限制
            
        Returns:
            会话对象或None
        """
        conversation = Conversation.query.filter_by(
            conversation_id=conversation_id,
            is_deleted=False
        ).first()
        
        return conversation
    
    def get_user_conversations(self, user_id: int, 
                              status: str = 'active',
                              limit: int = 20,
                              offset: int = 0) -> Tuple[List[Conversation], int]:
        """
        获取用户的会话列表
        
        Args:
            user_id: 用户ID
            status: 会话状态
            limit: 数量限制
            offset: 偏移量
            
        Returns:
            (会话列表, 总数)
        """
        query = Conversation.query.filter_by(
            user_id=user_id,
            status=status,
            is_deleted=False
        )
        
        total = query.count()
        
        conversations = query.order_by(
            desc(Conversation.last_message_at)
        ).offset(offset).limit(limit).all()
        
        return conversations, total
    
    def update_conversation(self, conversation_id: str, 
                           title: Optional[str] = None,
                           max_context_length: Optional[int] = None,
                           context_strategy: Optional[str] = None,
                           metadata: Optional[Dict[str, Any]] = None) -> Conversation:
        """
        更新会话
        
        Args:
            conversation_id: 会话ID
            title: 标题
            max_context_length: 最大上下文长度
            context_strategy: 上下文策略
            metadata: 元数据
            
        Returns:
            更新后的会话对象
        """
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                raise Exception("会话不存在")
            
            if title is not None:
                conversation.title = title
            if max_context_length is not None:
                conversation.max_context_length = max_context_length
            if context_strategy is not None:
                conversation.context_strategy = context_strategy
            if metadata is not None:
                conversation.metadata = metadata
            
            conversation.updated_at = datetime.utcnow()
            self.db.session.commit()
            
            return conversation
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"更新会话失败: {str(e)}")
    
    def delete_conversation(self, conversation_id: str, 
                           soft_delete: bool = True) -> bool:
        """
        删除会话
        
        Args:
            conversation_id: 会话ID
            soft_delete: 是否软删除
            
        Returns:
            是否成功
        """
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                return False
            
            if soft_delete:
                conversation.soft_delete()
            else:
                # 硬删除
                self.db.session.delete(conversation)
            
            self.db.session.commit()
            return True
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"删除会话失败: {str(e)}")
    
    def archive_conversation(self, conversation_id: str) -> bool:
        """
        归档会话
        
        Args:
            conversation_id: 会话ID
            
        Returns:
            是否成功
        """
        try:
            conversation = self.get_conversation(conversation_id, include_messages=True)
            if not conversation:
                return False
            
            # 创建归档记录
            archive = ConversationArchive(
                original_conversation_id=conversation.conversation_id,
                user_id=conversation.user_id,
                archive_data=conversation.to_dict(include_messages=True, message_limit=1000),
                message_count=len(conversation.messages) if hasattr(conversation, 'messages') else 0,
                archive_reason='manual'
            )
            
            self.db.session.add(archive)
            
            # 归档会话
            conversation.archive()
            
            self.db.session.commit()
            return True
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"归档会话失败: {str(e)}")
    
    # ==================== 消息管理 ====================
    
    def add_message(self, conversation_id: str, role: str, content: str,
                   content_type: str = 'text',
                   metadata: Dict[str, Any] = None,
                   parent_id: Optional[int] = None) -> ConversationMessage:
        """
        添加消息
        
        Args:
            conversation_id: 会话ID
            role: 角色（user, assistant, system）
            content: 内容
            content_type: 内容类型
            metadata: 元数据
            parent_id: 父消息ID
            
        Returns:
            创建的消息对象
        """
        try:
            conversation = self.get_conversation(conversation_id)
            if not conversation:
                raise Exception("会话不存在")
            
            # 获取下一个序列号
            last_message = ConversationMessage.query.filter_by(
                conversation_id=conversation.id
            ).order_by(desc(ConversationMessage.sequence)).first()
            
            next_sequence = (last_message.sequence + 1) if last_message else 1
            
            message = ConversationMessage(
                message_id=str(uuid.uuid4()),
                conversation_id=conversation.id,
                sequence=next_sequence,
                role=role,
                content=content,
                content_type=content_type,
                metadata=metadata or {},
                parent_id=parent_id
            )
            
            self.db.session.add(message)
            
            # 更新会话最后消息时间
            conversation.update_last_message_time()
            
            self.db.session.commit()
            
            # 使上下文缓存失效
            self._invalidate_context_cache(conversation.id)
            
            return message
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"添加消息失败: {str(e)}")
    
    def get_messages(self, conversation_id: str,
                    limit: int = 100,
                    offset: int = 0,
                    include_deleted: bool = False) -> Tuple[List[ConversationMessage], int]:
        """
        获取消息列表
        
        Args:
            conversation_id: 会话ID
            limit: 数量限制
            offset: 偏移量
            include_deleted: 是否包含已删除消息
            
        Returns:
            (消息列表, 总数)
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return [], 0
        
        query = ConversationMessage.query.filter_by(
            conversation_id=conversation.id
        )
        
        if not include_deleted:
            query = query.filter_by(is_deleted=False)
        
        total = query.count()
        
        messages = query.order_by(
            asc(ConversationMessage.sequence)
        ).offset(offset).limit(limit).all()
        
        return messages, total
    
    def get_message(self, message_id: str) -> Optional[ConversationMessage]:
        """
        获取单条消息
        
        Args:
            message_id: 消息ID
            
        Returns:
            消息对象或None
        """
        return ConversationMessage.query.filter_by(
            message_id=message_id,
            is_deleted=False
        ).first()
    
    def update_message(self, message_id: str, 
                      content: Optional[str] = None,
                      metadata: Optional[Dict[str, Any]] = None) -> ConversationMessage:
        """
        更新消息
        
        Args:
            message_id: 消息ID
            content: 内容
            metadata: 元数据
            
        Returns:
            更新后的消息对象
        """
        try:
            message = self.get_message(message_id)
            if not message:
                raise Exception("消息不存在")
            
            if content is not None:
                message.content = content
            if metadata is not None:
                message.metadata = metadata
            
            self.db.session.commit()
            
            # 使上下文缓存失效
            self._invalidate_context_cache(message.conversation_id)
            
            return message
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"更新消息失败: {str(e)}")
    
    def delete_message(self, message_id: str, soft_delete: bool = True) -> bool:
        """
        删除消息
        
        Args:
            message_id: 消息ID
            soft_delete: 是否软删除
            
        Returns:
            是否成功
        """
        try:
            message = self.get_message(message_id)
            if not message:
                return False
            
            if soft_delete:
                message.soft_delete()
            else:
                self.db.session.delete(message)
            
            self.db.session.commit()
            
            # 使上下文缓存失效
            self._invalidate_context_cache(message.conversation_id)
            
            return True
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"删除消息失败: {str(e)}")
    
    # ==================== 上下文管理 ====================
    
    def get_context(self, conversation_id: str,
                   max_length: Optional[int] = None,
                   use_cache: bool = True) -> List[Dict[str, Any]]:
        """
        获取对话上下文
        
        Args:
            conversation_id: 会话ID
            max_length: 最大长度
            use_cache: 是否使用缓存
            
        Returns:
            上下文消息列表
        """
        conversation = self.get_conversation(conversation_id)
        if not conversation:
            return []
        
        max_length = max_length or conversation.max_context_length
        
        # 尝试从缓存获取
        if use_cache:
            cached_context = self._get_cached_context(conversation.id)
            if cached_context:
                return cached_context[-max_length:]
        
        # 从数据库查询
        messages = ConversationMessage.query.filter_by(
            conversation_id=conversation.id,
            is_deleted=False
        ).order_by(
            desc(ConversationMessage.sequence)
        ).limit(max_length * 2).all()  # 多查询一些用于处理
        
        # 根据策略处理上下文
        if conversation.context_strategy == 'sliding_window':
            context = self._apply_sliding_window(messages, max_length)
        elif conversation.context_strategy == 'summary':
            context = self._apply_summary_strategy(messages, max_length)
        else:  # full
            context = self._apply_full_context(messages, max_length)
        
        # 更新缓存
        if use_cache:
            self._update_context_cache(conversation.id, context)
        
        return context
    
    def _apply_sliding_window(self, messages: List[ConversationMessage],
                             max_length: int) -> List[Dict[str, Any]]:
        """应用滑动窗口策略"""
        # 保留最新的N条消息
        recent_messages = sorted(messages, key=lambda m: m.sequence)[-max_length:]
        
        return [{
            'role': msg.role,
            'content': msg.content,
            'sequence': msg.sequence
        } for msg in recent_messages]
    
    def _apply_summary_strategy(self, messages: List[ConversationMessage],
                               max_length: int) -> List[Dict[str, Any]]:
        """应用摘要策略（简化实现）"""
        # 这里可以实现更复杂的摘要逻辑
        # 简化版本：保留第一条和最后N-1条
        if len(messages) <= max_length:
            sorted_messages = sorted(messages, key=lambda m: m.sequence)
        else:
            sorted_messages = sorted(messages, key=lambda m: m.sequence)
            first_message = sorted_messages[0]
            last_messages = sorted_messages[-(max_length-1):]
            sorted_messages = [first_message] + last_messages
        
        return [{
            'role': msg.role,
            'content': msg.content,
            'sequence': msg.sequence
        } for msg in sorted_messages]
    
    def _apply_full_context(self, messages: List[ConversationMessage],
                           max_length: int) -> List[Dict[str, Any]]:
        """应用完整上下文策略"""
        sorted_messages = sorted(messages, key=lambda m: m.sequence)
        
        return [{
            'role': msg.role,
            'content': msg.content,
            'sequence': msg.sequence
        } for msg in sorted_messages[:max_length]]
    
    def _get_cached_context(self, conversation_id: int) -> Optional[List[Dict[str, Any]]]:
        """从缓存获取上下文"""
        cache = ConversationContext.query.filter_by(
            conversation_id=conversation_id
        ).first()
        
        if cache:
            return cache.context
        return None
    
    def _update_context_cache(self, conversation_id: int, 
                             context: List[Dict[str, Any]]):
        """更新上下文缓存"""
        try:
            cache = ConversationContext.query.filter_by(
                conversation_id=conversation_id
            ).first()
            
            if cache:
                cache.context = context
                cache.updated_at = datetime.utcnow()
            else:
                cache = ConversationContext(
                    conversation_id=conversation_id,
                    context=context
                )
                self.db.session.add(cache)
            
            self.db.session.commit()
            
        except SQLAlchemyError:
            self.db.session.rollback()
            # 缓存更新失败不影响主流程
    
    def _invalidate_context_cache(self, conversation_id: int):
        """使上下文缓存失效"""
        try:
            cache = ConversationContext.query.filter_by(
                conversation_id=conversation_id
            ).first()
            
            if cache:
                cache.increment_version()
                self.db.session.commit()
                
        except SQLAlchemyError:
            self.db.session.rollback()
    
    # ==================== 自动清理和归档 ====================
    
    def auto_archive_old_conversations(self) -> int:
        """
        自动归档旧会话
        
        Returns:
            归档的会话数量
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.archive_threshold_days)
            
            old_conversations = Conversation.query.filter(
                and_(
                    Conversation.last_message_at < cutoff_date,
                    Conversation.status == 'active',
                    Conversation.is_deleted == False
                )
            ).all()
            
            archived_count = 0
            for conversation in old_conversations:
                try:
                    self.archive_conversation(conversation.conversation_id)
                    archived_count += 1
                except Exception:
                    continue
            
            return archived_count
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"自动归档失败: {str(e)}")
    
    def cleanup_deleted_conversations(self) -> int:
        """
        清理已删除的会话（硬删除）
        
        Returns:
            清理的会话数量
        """
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=self.cleanup_threshold_days)
            
            # 查找软删除且超过保留期的会话
            deleted_conversations = Conversation.query.filter(
                and_(
                    Conversation.is_deleted == True,
                    Conversation.deleted_at < cutoff_date
                )
            ).all()
            
            cleanup_count = 0
            for conversation in deleted_conversations:
                self.db.session.delete(conversation)
                cleanup_count += 1
            
            self.db.session.commit()
            return cleanup_count
            
        except SQLAlchemyError as e:
            self.db.session.rollback()
            raise Exception(f"清理会话失败: {str(e)}")
    
    def get_conversation_stats(self, user_id: int) -> Dict[str, Any]:
        """
        获取用户对话统计
        
        Args:
            user_id: 用户ID
            
        Returns:
            统计信息
        """
        try:
            # 总会话数
            total_conversations = Conversation.query.filter_by(
                user_id=user_id,
                is_deleted=False
            ).count()
            
            # 活跃会话数
            active_conversations = Conversation.query.filter_by(
                user_id=user_id,
                status='active',
                is_deleted=False
            ).count()
            
            # 归档会话数
            archived_conversations = Conversation.query.filter_by(
                user_id=user_id,
                status='archived',
                is_deleted=False
            ).count()
            
            # 总消息数
            total_messages = self.db.session.query(
                func.count(ConversationMessage.id)
            ).join(
                Conversation
            ).filter(
                Conversation.user_id == user_id,
                Conversation.is_deleted == False,
                ConversationMessage.is_deleted == False
            ).scalar() or 0
            
            return {
                'total_conversations': total_conversations,
                'active_conversations': active_conversations,
                'archived_conversations': archived_conversations,
                'total_messages': total_messages
            }
            
        except SQLAlchemyError as e:
            raise Exception(f"获取统计信息失败: {str(e)}")


# 全局服务实例
conversation_service = ConversationService()
