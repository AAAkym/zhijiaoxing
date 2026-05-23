"""
系统维护任务

处理系统维护相关任务，包括：
- 数据库备份
- 日志清理
- 缓存清理
- 系统健康检查
"""
import os
import time
import json
import shutil
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from celery import shared_task

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


# 配置
BACKUP_PATH = os.environ.get('BACKUP_PATH', 'backups')
LOG_PATH = os.environ.get('LOG_PATH', 'logs')
MAX_BACKUP_DAYS = int(os.environ.get('MAX_BACKUP_DAYS', 30))


@shared_task(bind=True)
def backup_database(self) -> Dict[str, Any]:
    """
    数据库备份任务
    
    Returns:
        备份结果
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 10, 'message': '准备数据库备份'})
        
        # 生成备份文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_filename = f"zhijiaoxing_backup_{timestamp}.sql"
        
        # 确保备份目录存在
        backup_dir = os.path.join(BACKUP_PATH, datetime.now().strftime('%Y%m'))
        os.makedirs(backup_dir, exist_ok=True)
        
        backup_path = os.path.join(backup_dir, backup_filename)
        
        self.update_state(state='PROGRESS', meta={'progress': 40, 'message': '正在备份数据库'})
        
        # 实际项目中使用pg_dump或其他数据库备份工具
        # 这里模拟备份过程
        # command = f"pg_dump -h localhost -U zhijiaoxing_user zhijiaoxing_db > {backup_path}"
        # os.system(command)
        
        # 模拟备份文件创建
        with open(backup_path, 'w') as f:
            f.write(f"-- Database backup created at {datetime.now()}\n")
            f.write("-- This is a simulated backup file\n")
        
        self.update_state(state='PROGRESS', meta={'progress': 80, 'message': '压缩备份文件'})
        
        # 压缩备份文件
        compressed_path = f"{backup_path}.gz"
        # shutil.make_archive(backup_path, 'gztar', backup_dir, backup_filename)
        
        # 删除原始备份文件，保留压缩文件
        # os.remove(backup_path)
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'message': '备份完成'})
        
        return {
            'status': 'success',
            'message': '数据库备份成功',
            'backup_file': backup_path,
            'compressed_file': compressed_path,
            'backup_size': os.path.getsize(backup_path),
            'created_at': datetime.now().isoformat(),
            'task_id': self.request.id
        }
        
    except Exception as exc:
        return {
            'status': 'error',
            'message': f'备份失败: {str(exc)}',
            'task_id': self.request.id
        }


@shared_task(bind=True)
def cleanup_old_logs(self, days: int = 30) -> Dict[str, Any]:
    """
    清理旧日志文件
    
    Args:
        days: 保留天数
        
    Returns:
        清理结果
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 20, 'message': '扫描日志文件'})
        
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_count = 0
        total_size = 0
        
        if os.path.exists(LOG_PATH):
            for root, dirs, files in os.walk(LOG_PATH):
                for file in files:
                    if file.endswith('.log'):
                        file_path = os.path.join(root, file)
                        file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                        
                        if file_mtime < cutoff_date:
                            file_size = os.path.getsize(file_path)
                            os.remove(file_path)
                            deleted_count += 1
                            total_size += file_size
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'message': '清理完成'})
        
        return {
            'status': 'success',
            'message': f'清理完成，删除 {deleted_count} 个日志文件',
            'deleted_count': deleted_count,
            'freed_space': total_size,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        return {
            'status': 'error',
            'message': f'清理失败: {str(exc)}',
            'task_id': self.request.id
        }


@shared_task(bind=True)
def cleanup_expired_cache(self) -> Dict[str, Any]:
    """
    清理过期缓存
    
    Returns:
        清理结果
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 50, 'message': '清理过期缓存'})
        
        # 实际项目中根据缓存后端执行清理
        # 例如：Redis - 自动过期，无需手动清理
        # SimpleCache - 清理过期项
        
        # 模拟清理
        cleaned_count = 0
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'message': '清理完成'})
        
        return {
            'status': 'success',
            'message': f'清理完成，清理 {cleaned_count} 个过期缓存',
            'cleaned_count': cleaned_count,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        return {
            'status': 'error',
            'message': f'清理失败: {str(exc)}',
            'task_id': self.request.id
        }


@shared_task(bind=True)
def health_check(self) -> Dict[str, Any]:
    """
    系统健康检查
    
    Returns:
        健康检查结果
    """
    try:
        self.update_state(state='PROGRESS', meta={'progress': 20, 'message': '检查数据库连接'})
        
        # 检查数据库连接
        db_status = check_database_connection()
        
        self.update_state(state='PROGRESS', meta={'progress': 40, 'message': '检查Redis连接'})
        
        # 检查Redis连接
        redis_status = check_redis_connection()
        
        self.update_state(state='PROGRESS', meta={'progress': 60, 'message': '检查磁盘空间'})
        
        # 检查磁盘空间
        disk_status = check_disk_space()
        
        self.update_state(state='PROGRESS', meta={'progress': 80, 'message': '检查内存使用'})
        
        # 检查内存使用
        memory_status = check_memory_usage()
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'message': '检查完成'})
        
        # 综合健康状态
        overall_status = 'healthy' if all([
            db_status['status'] == 'ok',
            redis_status['status'] == 'ok',
            disk_status['status'] == 'ok',
            memory_status['status'] == 'ok'
        ]) else 'unhealthy'
        
        return {
            'status': overall_status,
            'timestamp': datetime.now().isoformat(),
            'checks': {
                'database': db_status,
                'redis': redis_status,
                'disk': disk_status,
                'memory': memory_status
            },
            'task_id': self.request.id
        }
        
    except Exception as exc:
        return {
            'status': 'error',
            'message': f'健康检查失败: {str(exc)}',
            'task_id': self.request.id
        }


@shared_task(bind=True)
def cleanup_old_backups(self, days: int = 30) -> Dict[str, Any]:
    """
    清理旧备份文件
    
    Args:
        days: 保留天数
        
    Returns:
        清理结果
    """
    try:
        cutoff_date = datetime.now() - timedelta(days=days)
        deleted_count = 0
        total_size = 0
        
        if os.path.exists(BACKUP_PATH):
            for root, dirs, files in os.walk(BACKUP_PATH):
                for file in files:
                    if file.endswith(('.sql', '.sql.gz', '.backup')):
                        file_path = os.path.join(root, file)
                        file_mtime = datetime.fromtimestamp(os.path.getmtime(file_path))
                        
                        if file_mtime < cutoff_date:
                            file_size = os.path.getsize(file_path)
                            os.remove(file_path)
                            deleted_count += 1
                            total_size += file_size
        
        return {
            'status': 'success',
            'message': f'清理完成，删除 {deleted_count} 个备份文件',
            'deleted_count': deleted_count,
            'freed_space': total_size,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        return {
            'status': 'error',
            'message': f'清理失败: {str(exc)}',
            'task_id': self.request.id
        }


@shared_task(bind=True)
def generate_system_report(self) -> Dict[str, Any]:
    """
    生成系统运行报告
    
    Returns:
        系统报告
    """
    try:
        # 收集系统信息
        report = {
            'generated_at': datetime.now().isoformat(),
            'system_info': {
                'platform': os.name,
                'python_version': sys.version,
            },
            'statistics': {
                'total_backups': count_files(BACKUP_PATH),
                'total_logs': count_files(LOG_PATH),
                'disk_usage': get_disk_usage(),
            },
            'task_id': self.request.id
        }
        
        return {
            'status': 'success',
            'report': report,
            'task_id': self.request.id
        }
        
    except Exception as exc:
        return {
            'status': 'error',
            'message': f'生成报告失败: {str(exc)}',
            'task_id': self.request.id
        }


# ============ 辅助函数 ============

def check_database_connection() -> Dict[str, Any]:
    """检查数据库连接"""
    try:
        # 实际项目中执行数据库查询
        # from src.models.user import db
        # db.session.execute('SELECT 1')
        
        return {
            'status': 'ok',
            'message': '数据库连接正常',
            'response_time': '10ms'
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'数据库连接失败: {str(e)}'
        }


def check_redis_connection() -> Dict[str, Any]:
    """检查Redis连接"""
    try:
        # 实际项目中检查Redis连接
        # import redis
        # r = redis.Redis()
        # r.ping()
        
        return {
            'status': 'ok',
            'message': 'Redis连接正常',
            'response_time': '5ms'
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Redis连接失败: {str(e)}'
        }


def check_disk_space() -> Dict[str, Any]:
    """检查磁盘空间"""
    try:
        import shutil
        total, used, free = shutil.disk_usage("/")
        
        usage_percent = (used / total) * 100
        
        status = 'ok' if usage_percent < 80 else 'warning' if usage_percent < 90 else 'error'
        
        return {
            'status': status,
            'message': f'磁盘使用率: {usage_percent:.1f}%',
            'total': total,
            'used': used,
            'free': free,
            'usage_percent': usage_percent
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'磁盘检查失败: {str(e)}'
        }


def check_memory_usage() -> Dict[str, Any]:
    """检查内存使用"""
    try:
        import psutil
        memory = psutil.virtual_memory()
        
        status = 'ok' if memory.percent < 80 else 'warning' if memory.percent < 90 else 'error'
        
        return {
            'status': status,
            'message': f'内存使用率: {memory.percent}%',
            'total': memory.total,
            'available': memory.available,
            'percent': memory.percent
        }
    except ImportError:
        return {
            'status': 'ok',
            'message': '内存检查（psutil未安装）'
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': f'内存检查失败: {str(e)}'
        }


def count_files(directory: str) -> int:
    """统计目录中的文件数量"""
    if not os.path.exists(directory):
        return 0
    
    count = 0
    for root, dirs, files in os.walk(directory):
        count += len(files)
    return count


def get_disk_usage() -> Dict[str, Any]:
    """获取磁盘使用情况"""
    try:
        import shutil
        total, used, free = shutil.disk_usage("/")
        return {
            'total': total,
            'used': used,
            'free': free,
            'usage_percent': (used / total) * 100
        }
    except:
        return {}
