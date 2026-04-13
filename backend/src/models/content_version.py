"""
AI生成内容版本控制模块

提供AI生成内容的版本管理、比较、回滚等功能
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
import uuid

from sqlalchemy import Index, text
from sqlalchemy.orm import relationship

from src.models.user import db


class AIContentVersion(db.Model):
    """
    AI生成内容版本模型
    
    存储AI生成内容的各个版本
    """
    __tablename__ = 'ai_content_versions'
    __table_args__ = {'extend_existing': True}
    
    # 主键
    id = db.Column(db.Integer, primary_key=True)
    
    # 内容标识
    content_id = db.Column(db.String(64), nullable=False, index=True)
    version_number = db.Column(db.Integer, nullable=False)
    version_tag = db.Column(db.String(50), nullable=True)  # 版本标签，如 v1.0, draft等
    
    # 内容数据
    content_type = db.Column(db.String(50), nullable=False)  # course, exercise, explanation等
    title = db.Column(db.String(200), nullable=True)
    content_data = db.Column(db.Text, nullable=False)  # 内容JSON
    
    # 生成参数
    generation_params = db.Column(db.Text, default='{}')  # 生成参数JSON
    prompt_used = db.Column(db.Text, nullable=True)  # 使用的提示词
    
    # 版本关系
    parent_version_id = db.Column(db.Integer, db.ForeignKey('ai_content_versions.id'), nullable=True)
    parent = relationship('AIContentVersion', remote_side=[id], backref='children')
    
    # 创建信息
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user = relationship('User', backref='content_versions')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # 变更信息
    change_summary = db.Column(db.Text, nullable=True)  # 变更摘要
    change_type = db.Column(db.String(20), default='create')  # create, update, regenerate, rollback
    
    # 元数据
    metadata_json = db.Column(db.Text, default='{}')
    
    # 软删除标记
    is_deleted = db.Column(db.Boolean, default=False, index=True)
    deleted_at = db.Column(db.DateTime, nullable=True)
    
    # 数据库约束
    __table_args__ = (
        db.UniqueConstraint('content_id', 'version_number', name='uix_content_version'),
        Index('idx_content_version_user', 'created_by', 'content_type'),
        Index('idx_content_version_created', 'created_at'),
    )
    
    def __repr__(self):
        return f'<AIContentVersion {self.content_id} v{self.version_number}>'
    
    @property
    def content(self) -> Dict[str, Any]:
        """获取内容数据"""
        try:
            return json.loads(self.content_data) if self.content_data else {}
        except json.JSONDecodeError:
            return {'text': self.content_data}
    
    @content.setter
    def content(self, value: Dict[str, Any]):
        """设置内容数据"""
        self.content_data = json.dumps(value, ensure_ascii=False)
    
    @property
    def generation_params_dict(self) -> Dict[str, Any]:
        """获取生成参数"""
        try:
            return json.loads(self.generation_params) if self.generation_params else {}
        except json.JSONDecodeError:
            return {}
    
    @generation_params_dict.setter
    def generation_params_dict(self, value: Dict[str, Any]):
        """设置生成参数"""
        self.generation_params = json.dumps(value, ensure_ascii=False)
    
    @property
    def metadata(self) -> Dict[str, Any]:
        """获取元数据"""
        try:
            return json.loads(self.metadata_json) if self.metadata_json else {}
        except json.JSONDecodeError:
            return {}
    
    @metadata.setter
    def metadata(self, value: Dict[str, Any]):
        """设置元数据"""
        self.metadata_json = json.dumps(value, ensure_ascii=False)
    
    def to_dict(self, include_content: bool = True) -> Dict[str, Any]:
        """转换为字典"""
        result = {
            'id': self.id,
            'content_id': self.content_id,
            'version_number': self.version_number,
            'version_tag': self.version_tag,
            'content_type': self.content_type,
            'title': self.title,
            'generation_params': self.generation_params_dict,
            'prompt_used': self.prompt_used,
            'parent_version_id': self.parent_version_id,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'change_summary': self.change_summary,
            'change_type': self.change_type,
            'metadata': self.metadata,
        }
        
        if include_content:
            result['content'] = self.content
        
        return result
    
    def soft_delete(self):
        """软删除版本"""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()


class ContentVersionHistory(db.Model):
    """
    版本历史记录模型
    
    记录版本操作历史
    """
    __tablename__ = 'content_version_history'
    __table_args__ = {'extend_existing': True}
    
    # 主键
    id = db.Column(db.Integer, primary_key=True)
    
    # 关联内容
    content_id = db.Column(db.String(64), nullable=False, index=True)
    version_id = db.Column(db.Integer, db.ForeignKey('ai_content_versions.id'), nullable=False)
    version = relationship('AIContentVersion', backref='history_records')
    
    # 操作信息
    action = db.Column(db.String(20), nullable=False)  # create, update, delete, rollback, compare
    action_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user = relationship('User', backref='version_actions')
    action_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    # 操作详情
    action_details = db.Column(db.Text, nullable=True)  # JSON格式
    ip_address = db.Column(db.String(50), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    
    def __repr__(self):
        return f'<ContentVersionHistory {self.action} {self.content_id}>'
    
    @property
    def details(self) -> Dict[str, Any]:
        """获取操作详情"""
        try:
            return json.loads(self.action_details) if self.action_details else {}
        except json.JSONDecodeError:
            return {}
    
    @details.setter
    def details(self, value: Dict[str, Any]):
        """设置操作详情"""
        self.action_details = json.dumps(value, ensure_ascii=False)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'content_id': self.content_id,
            'version_id': self.version_id,
            'action': self.action,
            'action_by': self.action_by,
            'action_at': self.action_at.isoformat() if self.action_at else None,
            'details': self.details,
            'ip_address': self.ip_address,
        }


class ContentVersionComparison(db.Model):
    """
    版本比较记录模型
    
    存储版本之间的比较结果
    """
    __tablename__ = 'content_version_comparisons'
    __table_args__ = {'extend_existing': True}
    
    # 主键
    id = db.Column(db.Integer, primary_key=True)
    
    # 比较的版本
    content_id = db.Column(db.String(64), nullable=False, index=True)
    base_version_id = db.Column(db.Integer, db.ForeignKey('ai_content_versions.id'), nullable=False)
    compare_version_id = db.Column(db.Integer, db.ForeignKey('ai_content_versions.id'), nullable=False)
    
    base_version = relationship('AIContentVersion', foreign_keys=[base_version_id], backref='comparisons_as_base')
    compare_version = relationship('AIContentVersion', foreign_keys=[compare_version_id], backref='comparisons_as_compare')
    
    # 比较结果
    comparison_result = db.Column(db.Text, nullable=False)  # JSON格式存储差异
    diff_summary = db.Column(db.Text, nullable=True)  # 差异摘要
    
    # 统计信息
    additions_count = db.Column(db.Integer, default=0)
    deletions_count = db.Column(db.Integer, default=0)
    modifications_count = db.Column(db.Integer, default=0)
    
    # 创建信息
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<ContentVersionComparison {self.base_version_id} vs {self.compare_version_id}>'
    
    @property
    def result(self) -> Dict[str, Any]:
        """获取比较结果"""
        try:
            return json.loads(self.comparison_result) if self.comparison_result else {}
        except json.JSONDecodeError:
            return {}
    
    @result.setter
    def result(self, value: Dict[str, Any]):
        """设置比较结果"""
        self.comparison_result = json.dumps(value, ensure_ascii=False)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'content_id': self.content_id,
            'base_version_id': self.base_version_id,
            'compare_version_id': self.compare_version_id,
            'result': self.result,
            'diff_summary': self.diff_summary,
            'additions_count': self.additions_count,
            'deletions_count': self.deletions_count,
            'modifications_count': self.modifications_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
