"""
数据模型模块

包含所有数据库模型定义
"""

from .user import db, User
from .student_profile import StudentProfile, ProfileDialogSession
from .learning_path import LearningPath, LearningPathNode, ResourceRecommendation, LearningPlan
from .content_sync_record import ContentSyncRecord
from .token_usage import TokenUsage
from .agent_execution_log import AgentExecutionLog
from .content_review import ContentReview, ReviewRule, ReviewOperationLog
from .system_settings import SystemSetting
from .knowledge_base import (
    CourseSyllabus,
    CourseChapter,
    KnowledgePoint,
    TeachingCase,
    CourseExercise,
    KnowledgeGraphNode,
    KnowledgeGraphEdge,
    KnowledgeSourceChunk,
    GenerationCitation,
)

__all__ = [
    'db',
    'User',
    'StudentProfile',
    'ProfileDialogSession',
    'LearningPath',
    'LearningPathNode',
    'ResourceRecommendation',
    'LearningPlan',
    'ContentSyncRecord',
    'TokenUsage',
    'AgentExecutionLog',
    'ContentReview',
    'ReviewRule',
    'ReviewOperationLog',
    'SystemSetting',
    'CourseSyllabus',
    'CourseChapter',
    'KnowledgePoint',
    'TeachingCase',
    'CourseExercise',
    'KnowledgeGraphNode',
    'KnowledgeGraphEdge',
    'KnowledgeSourceChunk',
    'GenerationCitation',
]
