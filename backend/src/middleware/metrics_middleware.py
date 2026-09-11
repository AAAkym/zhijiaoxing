"""
指标收集中间件
自动收集 API 请求指标
"""
import time
import functools
from flask import request, g, Response, session
from src.services.metrics_service import metrics_service


class MetricsMiddleware:
    """指标收集中间件"""
    
    def __init__(self, app=None):
        self.app = app
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """初始化应用"""
        # 注册请求前钩子
        app.before_request(self.before_request)
        # 注册请求后钩子
        app.after_request(self.after_request)
    
    def before_request(self):
        """请求前处理"""
        g.start_time = time.time()
    
    def after_request(self, response: Response) -> Response:
        """请求后处理"""
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            
            # 记录请求指标
            metrics_service.record_request(
                method=request.method,
                endpoint=request.endpoint or request.path,
                status_code=response.status_code,
                duration=duration
            )
            
            # 记录活跃用户
            user_id = session.get('user_id')
            if user_id:
                metrics_service.add_active_user(str(user_id))
        
        return response
    
def track_active_user(user_id_getter: callable):
    """
    追踪活跃用户的装饰器
    
    Args:
        user_id_getter: 获取用户ID的函数
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                user_id = user_id_getter()
                if user_id:
                    metrics_service.add_active_user(str(user_id))
                    g.user_id = user_id
            except Exception:
                pass
            
            return func(*args, **kwargs)
        return wrapper
    return decorator


def exclude_from_metrics(func):
    """排除特定端点不被监控的装饰器"""
    func._exclude_from_metrics = True
    return func
