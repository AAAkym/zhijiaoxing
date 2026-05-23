"""
结构化日志记录器
支持 ELK 日志系统集成
"""
import json
import logging
import sys
import traceback
from datetime import datetime
from typing import Optional, Dict, Any
from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """自定义 JSON 日志格式化器"""
    
    def add_fields(self, log_record: Dict[str, Any], record: logging.LogRecord, message_dict: Dict[str, Any]):
        super(CustomJsonFormatter, self).add_fields(log_record, record, message_dict)
        
        # 添加时间戳
        if not log_record.get('timestamp'):
            log_record['timestamp'] = datetime.utcnow().isoformat()
        
        # 添加日志级别
        if log_record.get('level'):
            log_record['level'] = log_record['level'].upper()
        else:
            log_record['level'] = record.levelname
        
        # 添加日志来源
        log_record['logger'] = record.name
        log_record['module'] = record.module
        log_record['function'] = record.funcName
        log_record['line'] = record.lineno
        
        # 添加进程和线程信息
        log_record['process'] = record.process
        log_record['thread'] = record.thread
        
        # 添加上下文信息（如果有）
        if hasattr(record, 'user_id'):
            log_record['user_id'] = record.user_id
        if hasattr(record, 'request_id'):
            log_record['request_id'] = record.request_id
        if hasattr(record, 'endpoint'):
            log_record['endpoint'] = record.endpoint
        if hasattr(record, 'duration'):
            log_record['duration'] = record.duration
        if hasattr(record, 'status_code'):
            log_record['status_code'] = record.status_code
        
        # 处理异常信息
        if record.exc_info:
            log_record['error_type'] = record.exc_info[0].__name__ if record.exc_info[0] else None
            log_record['error_message'] = str(record.exc_info[1]) if record.exc_info[1] else None
            log_record['stack_trace'] = traceback.format_exception(*record.exc_info)


def setup_logger(
    name: str = 'zhijiaoxing',
    level: int = logging.INFO,
    log_file: Optional[str] = None,
    json_format: bool = True
) -> logging.Logger:
    """
    设置日志记录器
    
    Args:
        name: 日志记录器名称
        level: 日志级别
        log_file: 日志文件路径
        json_format: 是否使用 JSON 格式
    
    Returns:
        配置好的日志记录器
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # 清除现有的处理器
    logger.handlers = []
    
    # 创建格式化器
    if json_format:
        formatter = CustomJsonFormatter(
            '%(timestamp)s %(level)s %(name)s %(message)s'
        )
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
    
    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 文件处理器
    if log_file:
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        # 错误日志单独文件
        error_file = log_file.replace('.log', '_error.log')
        error_handler = logging.FileHandler(error_file)
        error_handler.setLevel(logging.ERROR)
        error_handler.setFormatter(formatter)
        logger.addHandler(error_handler)
    
    return logger


class ContextualLogger:
    """上下文日志记录器，支持添加请求上下文信息"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.context = {}
    
    def add_context(self, **kwargs):
        """添加上下文信息"""
        self.context.update(kwargs)
    
    def clear_context(self):
        """清除上下文信息"""
        self.context = {}
    
    def _log(self, level: int, msg: str, *args, **kwargs):
        """内部日志方法"""
        extra = kwargs.get('extra', {})
        extra.update(self.context)
        kwargs['extra'] = extra
        self.logger.log(level, msg, *args, **kwargs)
    
    def debug(self, msg: str, *args, **kwargs):
        self._log(logging.DEBUG, msg, *args, **kwargs)
    
    def info(self, msg: str, *args, **kwargs):
        self._log(logging.INFO, msg, *args, **kwargs)
    
    def warning(self, msg: str, *args, **kwargs):
        self._log(logging.WARNING, msg, *args, **kwargs)
    
    def error(self, msg: str, *args, **kwargs):
        self._log(logging.ERROR, msg, *args, **kwargs)
    
    def critical(self, msg: str, *args, **kwargs):
        self._log(logging.CRITICAL, msg, *args, **kwargs)
    
    def exception(self, msg: str, *args, **kwargs):
        """记录异常信息"""
        kwargs['exc_info'] = True
        self._log(logging.ERROR, msg, *args, **kwargs)


# 全局日志记录器实例
logger = setup_logger()
contextual_logger = ContextualLogger(logger)


def get_logger(name: str = 'zhijiaoxing') -> logging.Logger:
    """获取日志记录器"""
    return logging.getLogger(name)


def log_request(
    endpoint: str,
    method: str,
    duration: float,
    status_code: int,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None
):
    """
    记录 API 请求日志
    
    Args:
        endpoint: 端点路径
        method: HTTP 方法
        duration: 请求耗时（秒）
        status_code: HTTP 状态码
        user_id: 用户ID
        request_id: 请求ID
    """
    extra = {
        'endpoint': endpoint,
        'method': method,
        'duration': duration,
        'status_code': status_code
    }
    
    if user_id:
        extra['user_id'] = user_id
    if request_id:
        extra['request_id'] = request_id
    
    logger.info(
        f'{method} {endpoint} {status_code} - {duration:.3f}s',
        extra=extra
    )


def log_error(
    error: Exception,
    endpoint: Optional[str] = None,
    user_id: Optional[str] = None,
    request_id: Optional[str] = None
):
    """
    记录错误日志
    
    Args:
        error: 异常对象
        endpoint: 端点路径
        user_id: 用户ID
        request_id: 请求ID
    """
    extra = {}
    
    if endpoint:
        extra['endpoint'] = endpoint
    if user_id:
        extra['user_id'] = user_id
    if request_id:
        extra['request_id'] = request_id
    
    logger.exception(
        f'Error in {endpoint}: {str(error)}',
        extra=extra
    )


def log_ai_generation(
    model_type: str,
    duration: float,
    tokens: int,
    user_id: Optional[str] = None,
    conversation_id: Optional[str] = None
):
    """
    记录 AI 生成日志
    
    Args:
        model_type: 模型类型
        duration: 生成耗时（秒）
        tokens: 生成的 token 数量
        user_id: 用户ID
        conversation_id: 对话ID
    """
    extra = {
        'model_type': model_type,
        'duration': duration,
        'tokens': tokens
    }
    
    if user_id:
        extra['user_id'] = user_id
    if conversation_id:
        extra['conversation_id'] = conversation_id
    
    logger.info(
        f'AI generation completed: {model_type} - {tokens} tokens in {duration:.3f}s',
        extra=extra
    )
