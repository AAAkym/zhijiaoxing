"""
Celery任务模块

包含所有异步任务：
- ai_tasks: AI内容生成任务
- email_tasks: 邮件通知任务
- export_tasks: 数据导出任务
- maintenance_tasks: 系统维护任务
"""

from .ai_tasks import generate_ai_content, batch_generate_content
from .email_tasks import send_email_task, send_bulk_email_task
from .export_tasks import export_data_task, generate_report_task
from .maintenance_tasks import (
    backup_database,
    cleanup_old_logs,
    cleanup_expired_cache,
    health_check
)

__all__ = [
    # AI任务
    'generate_ai_content',
    'batch_generate_content',
    
    # 邮件任务
    'send_email_task',
    'send_bulk_email_task',
    
    # 导出任务
    'export_data_task',
    'generate_report_task',
    
    # 维护任务
    'backup_database',
    'cleanup_old_logs',
    'cleanup_expired_cache',
    'health_check',
]
