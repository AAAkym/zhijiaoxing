"""
对话上下文管理模块

提供对话会话和消息的持久化存储、CRUD操作、上下文管理
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
import json

from sqlalchemy import Index, text
from sqlalchemy.orm import relationship

from src.models.user import db


class Conversation(db.Model):
    """
    对话会话模型
    
    存储用户与AI的对话会话信息
    """
    __tablename__ = 'conversations'
    
    # 主键
    id = db.Column(db.Integer, primary_key=True)
    
    # 会话标识
    conversation_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    
    # 关联用户
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    user = relationship('User', backref='conversations')
    
    # 会话信息
    title = db.Column(db.String(200), nullable=True)
    status = db.Column(db.String(20), default='active')  # active, archived, deleted
    
    # 上下文配置
    max_context_length = db.Column(db.Integer, default=20)  # 最大上下文消息数
    context_strategy = db.Column(db.String(20), default='sliding_window')  # sliding_window, full, summary
    
    # 元数据（JSON格式存储额外信息）
    metadata_json = db.Column(db.Text, default='{}')
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, index=True)
    last_message_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # 软删除标记
    is_deleted = db.Column(db.Boolean, default=False, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True)
    
    # 数据库约束和索引
    __table_args__ = (
        Index('idx_conversation_user_status', 'user_id', 'status'),
        Index('idx_conversation_user_deleted', 'user_id', 'is_deleted'),
        Index('idx_conversation_last_message', 'last_message_at'),
        {'extend_existing': True},
    )
    
    def __repr__(self):
        return f'<Conversation {self.conversation_id}>'
    
    @property
    def extra_metadata(self) -> Dict[str, Any]:
        """获取元数据（自动解析JSON）"""
        try:
            return json.loads(self.metadata_json) if self.metadata_json else {}
        except json.JSONDecodeError:
            return {}
    
    @extra_metadata.setter
    def extra_metadata(self, value: Dict[str, Any]):
        """设置元数据（自动转为JSON）"""
        self.metadata_json = json.dumps(value, ensure_ascii=False)
    
    def to_dict(self, include_messages: bool = False, message_limit: int = 10) -> Dict[str, Any]:
        """
        转换为字典
        
        Args:
            include_messages: 是否包含消息列表
            message_limit: 消息数量限制
        """
        result = {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'user_id': self.user_id,
            'title': self.title,
            'status': self.status,
            'max_context_length': self.max_context_length,
            'context_strategy': self.context_strategy,
            'metadata': self.extra_metadata,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_message_at': self.last_message_at.isoformat() if self.last_message_at else None,
            'message_count': len(self.messages) if hasattr(self, 'messages') else 0,
        }
        
        if include_messages:
            messages = ConversationMessage.query.filter_by(
                conversation_id=self.id,
                is_deleted=False
            ).order_by(ConversationMessage.sequence.asc()).limit(message_limit).all()
            result['messages'] = [msg.to_dict() for msg in messages]
        
        return result
    
    def update_last_message_time(self):
        """更新最后消息时间"""
        self.last_message_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def soft_delete(self):
        """软删除会话"""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()
        self.status = 'deleted'
    
    def archive(self):
        """归档会话"""
        self.status = 'archived'
        self.updated_at = datetime.utcnow()
    
    def restore(self):
        """恢复会话"""
        self.is_deleted = False
        self.deleted_at = None
        self.status = 'active'


class ConversationMessage(db.Model):
    """
    对话消息模型
    
    存储对话中的单条消息
    """
    __tablename__ = 'conversation_messages'
    
    # 主键
    id = db.Column(db.Integer, primary_key=True)
    
    # 消息标识
    message_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    
    # 关联会话
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False, index=True)
    conversation = relationship('Conversation', backref='messages')
    
    # 消息序列号（用于排序）
    sequence = db.Column(db.Integer, nullable=False, index=True)
    
    # 消息角色
    role = db.Column(db.String(20), nullable=False)  # user, assistant, system
    
    # 消息内容
    content = db.Column(db.Text, nullable=False)
    content_type = db.Column(db.String(20), default='text')  # text, image, code, markdown
    
    # 消息元数据（如token数、模型信息等）
    metadata_json = db.Column(db.Text, default='{}')
    
    # 父消息ID（用于支持分支对话）
    parent_id = db.Column(db.Integer, db.ForeignKey('conversation_messages.id'), nullable=True)
    parent = relationship('ConversationMessage', remote_side=[id], backref='children')
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # 软删除标记
    is_deleted = db.Column(db.Boolean, default=False, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True)
    
    # 数据库约束和索引
    __table_args__ = (
        Index('idx_message_conversation_sequence', 'conversation_id', 'sequence'),
        Index('idx_message_conversation_role', 'conversation_id', 'role'),
        Index('idx_message_created', 'created_at'),
        {'extend_existing': True},
    )
    
    def __repr__(self):
        return f'<ConversationMessage {self.message_id}>'
    
    @property
    def msg_metadata(self) -> Dict[str, Any]:
        """获取元数据"""
        try:
            return json.loads(self.metadata_json) if self.metadata_json else {}
        except json.JSONDecodeError:
            return {}
    
    @msg_metadata.setter
    def msg_metadata(self, value: Dict[str, Any]):
        """设置元数据"""
        self.metadata_json = json.dumps(value, ensure_ascii=False)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'message_id': self.message_id,
            'conversation_id': self.conversation_id,
            'sequence': self.sequence,
            'role': self.role,
            'content': self.content,
            'content_type': self.content_type,
            'metadata': self.msg_metadata,
            'parent_id': self.parent_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
    
    def soft_delete(self):
        """软删除消息"""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()


class ConversationContext(db.Model):
    """
    对话上下文缓存模型
    
    用于缓存处理后的上下文，提高查询性能
    """
    __tablename__ = 'conversation_contexts'
    __table_args__ = {'extend_existing': True}
    
    # 主键
    id = db.Column(db.Integer, primary_key=True)
    
    # 关联会话
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversations.id'), nullable=False, unique=True, index=True)
    conversation = relationship('Conversation', backref='context_cache')
    
    # 上下文内容（JSON格式存储处理后的消息列表）
    context_json = db.Column(db.Text, nullable=False, default='[]')
    
    # 上下文统计
    message_count = db.Column(db.Integer, default=0)
    total_tokens = db.Column(db.Integer, default=0)
    
    # 缓存时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 缓存版本（用于失效检测）
    version = db.Column(db.Integer, default=1)
    
    def __repr__(self):
        return f'<ConversationContext {self.conversation_id}>'
    
    @property
    def context(self) -> List[Dict[str, Any]]:
        """获取上下文内容"""
        try:
            return json.loads(self.context_json) if self.context_json else []
        except json.JSONDecodeError:
            return []
    
    @context.setter
    def context(self, value: List[Dict[str, Any]]):
        """设置上下文内容"""
        self.context_json = json.dumps(value, ensure_ascii=False)
        self.message_count = len(value)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'conversation_id': self.conversation_id,
            'context': self.context,
            'message_count': self.message_count,
            'total_tokens': self.total_tokens,
            'version': self.version,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def increment_version(self):
        """增加版本号（使缓存失效）"""
        self.version += 1


class ConversationArchive(db.Model):
    """
    对话归档模型
    
    存储已归档的对话历史
    """
    __tablename__ = 'conversation_archives'
    __table_args__ = {'extend_existing': True}
    
    # 主键
    id = db.Column(db.Integer, primary_key=True)
    
    # 原始会话ID
    original_conversation_id = db.Column(db.String(64), nullable=False, index=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    
    # 归档数据（JSON格式存储完整会话和消息）
    archive_data_json = db.Column(db.Text, nullable=False)
    
    # 归档信息
    message_count = db.Column(db.Integer, default=0)
    archive_reason = db.Column(db.String(50), default='manual')  # manual, auto, length_limit
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    archived_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ConversationArchive {self.original_conversation_id}>'
    
    @property
    def archive_data(self) -> Dict[str, Any]:
        """获取归档数据"""
        try:
            return json.loads(self.archive_data_json) if self.archive_data_json else {}
        except json.JSONDecodeError:
            return {}
    
    @archive_data.setter
    def archive_data(self, value: Dict[str, Any]):
        """设置归档数据"""
        self.archive_data_json = json.dumps(value, ensure_ascii=False)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'original_conversation_id': self.original_conversation_id,
            'user_id': self.user_id,
            'message_count': self.message_count,
            'archive_reason': self.archive_reason,
            'archived_at': self.archived_at.isoformat() if self.archived_at else None,
        }
