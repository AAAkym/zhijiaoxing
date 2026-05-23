"""
Celery应用配置

配置Celery任务队列和定时任务调度
"""
import os
from celery import Celery
from celery.schedules import crontab
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 创建Celery应用
celery_app = Celery('zhijiaoxing')

# 从配置文件加载配置
celery_app.config_from_object('src.celeryconfig')

# 自动发现任务模块
celery_app.autodiscover_tasks([
    'src.tasks.ai_tasks',
    'src.tasks.email_tasks',
    'src.tasks.export_tasks',
    'src.tasks.maintenance_tasks',
])

# 定时任务配置（Celery Beat）
celery_app.conf.beat_schedule = {
    # 每日数据备份 - 每天凌晨2点
    'daily-database-backup': {
        'task': 'src.tasks.maintenance_tasks.backup_database',
        'schedule': crontab(hour=2, minute=0),
        'args': (),
        'options': {'queue': 'maintenance'},
    },
    
    # 每周报表生成 - 每周一上午9点
    'weekly-report-generation': {
        'task': 'src.tasks.export_tasks.generate_weekly_report',
        'schedule': crontab(day_of_week=1, hour=9, minute=0),
        'args': (),
        'options': {'queue': 'export'},
    },
    
    # 清理旧日志 - 每天凌晨3点
    'cleanup-old-logs': {
        'task': 'src.tasks.maintenance_tasks.cleanup_old_logs',
        'schedule': crontab(hour=3, minute=0),
        'args': (30,),  # 保留30天的日志
        'options': {'queue': 'maintenance'},
    },
    
    # 清理过期缓存 - 每小时执行
    'cleanup-expired-cache': {
        'task': 'src.tasks.maintenance_tasks.cleanup_expired_cache',
        'schedule': crontab(minute=0),  # 每小时的第0分钟
        'args': (),
        'options': {'queue': 'maintenance'},
    },
    
    # 系统健康检查 - 每5分钟
    'system-health-check': {
        'task': 'src.tasks.maintenance_tasks.health_check',
        'schedule': 300.0,  # 300秒 = 5分钟
        'args': (),
        'options': {'queue': 'maintenance'},
    },
}

# 设置默认队列
celery_app.conf.task_default_queue = 'default'


# 任务基类 - 添加通用功能
class BaseTask(celery_app.Task):
    """任务基类"""
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """任务失败时的回调"""
        print(f'Task {task_id} failed: {exc}')
        # 可以在这里添加错误日志记录、告警通知等
        super().on_failure(exc, task_id, args, kwargs, einfo)
    
    def on_success(self, retval, task_id, args, kwargs):
        """任务成功时的回调"""
        print(f'Task {task_id} succeeded')
        super().on_success(retval, task_id, args, kwargs)
    
    def on_retry(self, exc, task_id, args, kwargs, einfo):
        """任务重试时的回调"""
        print(f'Task {task_id} retrying: {exc}')
        super().on_retry(exc, task_id, args, kwargs, einfo)


# 设置默认任务基类
celery_app.Task = BaseTask


if __name__ == '__main__':
    celery_app.start()
