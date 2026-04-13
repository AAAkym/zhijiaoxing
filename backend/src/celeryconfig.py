"""
Celery配置文件

配置Celery的消息代理、结果后端、任务队列等
"""
import os

# ============================================
# 消息代理配置（Redis）
# ============================================
# Redis连接URL
broker_url = os.environ.get('CELERY_BROKER_URL') or \
    os.environ.get('REDIS_URL') or \
    'redis://localhost:6379/0'

# 结果后端配置（使用Redis存储任务结果）
result_backend = os.environ.get('CELERY_RESULT_BACKEND') or \
    os.environ.get('REDIS_URL') or \
    'redis://localhost:6379/0'

# ============================================
# 序列化配置
# ============================================
# 任务序列化格式
task_serializer = 'json'

# 结果序列化格式
result_serializer = 'json'

# 接受的内容类型
accept_content = ['json']

# ============================================
# 任务执行配置
# ============================================
# 任务执行超时时间（秒）
task_time_limit = int(os.environ.get('CELERY_TASK_TIME_LIMIT', 3600))

# 任务软超时时间（秒）- 超时前发送警告
task_soft_time_limit = int(os.environ.get('CELERY_TASK_SOFT_TIME_LIMIT', 3300))

# 任务结果过期时间（秒）
result_expires = int(os.environ.get('CELERY_RESULT_EXPIRES', 3600 * 24))

# 是否跟踪任务开始状态
task_track_started = True

# ============================================
# Worker配置
# ============================================
# Worker并发数（进程数）
worker_concurrency = int(os.environ.get('CELERY_WORKER_CONCURRENCY', 4))

# Worker预取任务数
worker_prefetch_multiplier = int(os.environ.get('CELERY_WORKER_PREFETCH_MULTIPLIER', 1))

# Worker最大任务数（达到后重启）
worker_max_tasks_per_child = int(os.environ.get('CELERY_WORKER_MAX_TASKS_PER_CHILD', 1000))

# Worker最大内存（MB）
worker_max_memory_per_child = int(os.environ.get('CELERY_WORKER_MAX_MEMORY_PER_CHILD', 512))

# ============================================
# 任务队列配置
# ============================================
from kombu import Queue, Exchange

# 定义队列
task_queues = (
    # 默认队列
    Queue('default', Exchange('default'), routing_key='default'),
    
    # AI任务队列 - 处理AI内容生成
    Queue('ai', Exchange('ai'), routing_key='ai'),
    
    # 邮件任务队列 - 处理邮件发送
    Queue('email', Exchange('email'), routing_key='email'),
    
    # 导出任务队列 - 处理数据导出
    Queue('export', Exchange('export'), routing_key='export'),
    
    # 维护任务队列 - 处理定时维护任务
    Queue('maintenance', Exchange('maintenance'), routing_key='maintenance'),
    
    # 高优先级队列 - 处理紧急任务
    Queue('high_priority', Exchange('high_priority'), routing_key='high_priority'),
)

# 任务路由规则
task_routes = {
    # AI相关任务路由到ai队列
    'src.tasks.ai_tasks.*': {'queue': 'ai', 'routing_key': 'ai'},
    
    # 邮件任务路由到email队列
    'src.tasks.email_tasks.*': {'queue': 'email', 'routing_key': 'email'},
    
    # 导出任务路由到export队列
    'src.tasks.export_tasks.*': {'queue': 'export', 'routing_key': 'export'},
    
    # 维护任务路由到maintenance队列
    'src.tasks.maintenance_tasks.*': {'queue': 'maintenance', 'routing_key': 'maintenance'},
}

# 默认队列
task_default_queue = 'default'
task_default_exchange = 'default'
task_default_routing_key = 'default'

# ============================================
# 重试配置
# ============================================
# 任务失败时是否重试
task_acks_late = True

# 任务重试最大次数
task_max_retries = int(os.environ.get('CELERY_TASK_MAX_RETRIES', 3))

# 任务重试间隔（秒）
task_default_retry_delay = int(os.environ.get('CELERY_TASK_RETRY_DELAY', 60))

# ============================================
# 日志配置
# ============================================
# Worker日志级别
worker_log_level = os.environ.get('CELERY_WORKER_LOG_LEVEL', 'info')

# 是否发送任务事件（用于Flower监控）
worker_send_task_events = True

# 是否发送任务结果
task_send_sent_event = True

# ============================================
# 时区配置
# ============================================
# 时区设置
timezone = 'Asia/Shanghai'

# 启用时区支持
enable_utc = True

# ============================================
# Beat调度器配置
# ============================================
# 调度器类
beat_scheduler = 'celery.beat.PersistentScheduler'

# 调度文件路径
beat_schedule_filename = 'celerybeat-schedule'

# 最大并发数
beat_max_loop_interval = 300

# ============================================
# 安全配置（生产环境建议启用）
# ============================================
# Redis密码（如果设置了密码）
# broker_password = os.environ.get('REDIS_PASSWORD')
# result_backend_password = os.environ.get('REDIS_PASSWORD')

# SSL配置（生产环境建议启用）
# broker_use_ssl = True
# redis_backend_use_ssl = True
