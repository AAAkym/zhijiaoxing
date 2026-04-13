"""
数据模型模块

包含所有数据库模型定义
"""

from .user import db, User

__all__ = [
    'db',
    'User',
]
