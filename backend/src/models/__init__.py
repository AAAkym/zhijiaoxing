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
from .personalized_workflow import PersonalizedWorkflow, PersonalizedWorkflowEvent
from .personalized_learning import PersonalizedTaskDelivery, PersonalizedDeliveryEvent, PersonalizedLearningCycle
from .personalized_notification import PersonalizedTaskNotification
from .personalized_class_batch import PersonalizedClassBatch, PersonalizedClassBatchItem
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
    'PersonalizedWorkflow',
    'PersonalizedWorkflowEvent',
    'PersonalizedTaskDelivery',
    'PersonalizedDeliveryEvent',
    'PersonalizedLearningCycle',
    'PersonalizedTaskNotification',
    'PersonalizedClassBatch',
    'PersonalizedClassBatchItem',
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
