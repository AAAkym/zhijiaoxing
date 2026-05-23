"""
缓存工具模块

提供缓存装饰器、缓存失效机制和防护措施
"""
import time
import random
import hashlib
from functools import wraps
from typing import Optional, Any, List

from flask import current_app


class CacheManager:
    """缓存管理器"""
    
    def __init__(self, cache):
        self.cache = cache
        self.empty_mark = '___CACHE_EMPTY___'
    
    def generate_key(self, prefix: str, *args, **kwargs) -> str:
        """
        生成缓存键
        
        Args:
            prefix: 键前缀
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            缓存键字符串
        """
        key_parts = [prefix]
        
        # 添加位置参数
        if args:
            args_str = ':'.join(str(arg) for arg in args)
            key_parts.append(args_str)
        
        # 添加关键字参数
        if kwargs:
            kwargs_str = ':'.join(f"{k}={v}" for k, v in sorted(kwargs.items()))
            key_parts.append(kwargs_str)
        
        # 如果键太长，使用MD5哈希
        key = ':'.join(key_parts)
        if len(key) > 200:
            key_hash = hashlib.md5(key.encode()).hexdigest()
            key = f"{prefix}:hash:{key_hash}"
        
        return key
    
    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值
        
        Args:
            key: 缓存键
            
        Returns:
            缓存值，如果不存在返回None
        """
        value = self.cache.get(key)
        if value == self.empty_mark:
            return None
        return value
    
    def set(self, key: str, value: Any, timeout: Optional[int] = None) -> bool:
        """
        设置缓存值
        
        Args:
            key: 缓存键
            value: 缓存值
            timeout: 过期时间（秒）
            
        Returns:
            是否设置成功
        """
        if value is None:
            # 缓存空值标记
            return self.cache.set(key, self.empty_mark, timeout=timeout or 60)
        return self.cache.set(key, value, timeout=timeout)
    
    def delete(self, key: str) -> bool:
        """
        删除缓存
        
        Args:
            key: 缓存键
            
        Returns:
            是否删除成功
        """
        return self.cache.delete(key)
    
    def delete_many(self, keys: List[str]) -> bool:
        """
        批量删除缓存
        
        Args:
            keys: 缓存键列表
            
        Returns:
            是否删除成功
        """
        return self.cache.delete_many(*keys)
    
    def clear(self) -> bool:
        """
        清空所有缓存
        
        Returns:
            是否清空成功
        """
        return self.cache.clear()
    
    def get_or_set(self, key: str, func, timeout: Optional[int] = None):
        """
        获取缓存，如果不存在则设置
        
        Args:
            key: 缓存键
            func: 生成缓存值的函数
            timeout: 过期时间（秒）
            
        Returns:
            缓存值
        """
        value = self.get(key)
        if value is not None:
            return value
        
        value = func()
        self.set(key, value, timeout)
        return value


def cached(
    timeout: int = 300,
    key_prefix: str = None,
    prevent_breakdown: bool = True,
    prevent_penetration: bool = True,
    prevent_avalanche: bool = True,
    jitter: int = 30
):
    """
    综合缓存装饰器 - 集成所有防护措施
    
    Args:
        timeout: 缓存过期时间（秒）
        key_prefix: 缓存键前缀
        prevent_breakdown: 是否防止缓存击穿
        prevent_penetration: 是否防止缓存穿透
        prevent_avalanche: 是否防止缓存雪崩
        jitter: 随机抖动范围（秒）
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache = current_app.extensions['cache']
            cache_manager = CacheManager(cache)
            
            # 生成缓存键
            prefix = key_prefix or f.__name__
            cache_key = cache_manager.generate_key(prefix, *args, **kwargs)
            lock_key = f"lock:{cache_key}"
            
            # 尝试获取缓存
            result = cache_manager.get(cache_key)
            if result is not None:
                return result
            
            # 防止缓存击穿 - 使用简单的时间戳锁
            if prevent_breakdown:
                lock_value = str(time.time())
                # 尝试设置锁（如果键不存在则设置成功）
                existing_lock = cache.get(lock_key)
                if existing_lock is not None:
                    # 检查锁是否过期（10秒）
                    try:
                        if time.time() - float(existing_lock) < 10:
                            # 锁未过期，等待后重试
                            time.sleep(0.1)
                            return decorated_function(*args, **kwargs)
                    except (ValueError, TypeError):
                        pass
                # 设置锁
                cache.set(lock_key, lock_value, timeout=10)
            
            try:
                # 双重检查
                result = cache_manager.get(cache_key)
                if result is not None:
                    return result
                
                # 执行函数获取数据
                result = f(*args, **kwargs)
                
                # 计算实际过期时间（防止雪崩）
                actual_timeout = timeout
                if prevent_avalanche:
                    actual_timeout = timeout + random.randint(0, jitter)
                
                # 设置缓存（防止穿透 - 空值也缓存）
                if prevent_penetration and (result is None or (isinstance(result, (list, dict)) and len(result) == 0)):
                    cache_manager.set(cache_key, None, timeout=60)  # 空值短时间缓存
                else:
                    cache_manager.set(cache_key, result, timeout=actual_timeout)
                
                return result
            finally:
                if prevent_breakdown:
                    cache.delete(lock_key)
        
        return decorated_function
    return decorator


def cached_with_lock(timeout: int = 300, lock_timeout: int = 10, key_prefix: str = None):
    """
    带互斥锁的缓存装饰器 - 防止缓存击穿
    
    当缓存失效时，只有一个线程去加载数据，其他线程等待
    
    Args:
        timeout: 缓存过期时间（秒）
        lock_timeout: 锁超时时间（秒）
        key_prefix: 缓存键前缀
    """
    return cached(
        timeout=timeout,
        key_prefix=key_prefix,
        prevent_breakdown=True,
        prevent_penetration=False,
        prevent_avalanche=False
    )


def cached_with_empty(timeout: int = 300, empty_timeout: int = 60, key_prefix: str = None):
    """
    支持空值缓存的装饰器 - 防止缓存穿透
    
    当数据不存在时，缓存空值标记，防止频繁查询数据库
    
    Args:
        timeout: 正常缓存过期时间（秒）
        empty_timeout: 空值缓存过期时间（秒）
        key_prefix: 缓存键前缀
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache = current_app.extensions['cache']
            cache_manager = CacheManager(cache)
            
            # 生成缓存键
            prefix = key_prefix or f.__name__
            cache_key = cache_manager.generate_key(prefix, *args, **kwargs)
            
            # 尝试获取缓存
            result = cache_manager.get(cache_key)
            if result is not None:
                return result
            
            # 执行函数获取数据
            result = f(*args, **kwargs)
            
            # 根据结果设置不同的过期时间
            if result is None or (isinstance(result, (list, dict)) and len(result) == 0):
                cache_manager.set(cache_key, None, timeout=empty_timeout)
            else:
                cache_manager.set(cache_key, result, timeout=timeout)
            
            return result
        
        return decorated_function
    return decorator


def cached_with_jitter(timeout: int = 300, jitter: int = 30, key_prefix: str = None):
    """
    带随机抖动的缓存装饰器 - 防止缓存雪崩
    
    为缓存过期时间添加随机抖动，避免大量缓存同时过期
    
    Args:
        timeout: 基础缓存过期时间（秒）
        jitter: 随机抖动范围（秒）
        key_prefix: 缓存键前缀
    """
    return cached(
        timeout=timeout,
        key_prefix=key_prefix,
        prevent_breakdown=False,
        prevent_penetration=False,
        prevent_avalanche=True,
        jitter=jitter
    )


def invalidate_cache(key_pattern: str):
    """
    缓存失效装饰器
    
    在数据更新后清除相关缓存
    
    Args:
        key_pattern: 缓存键模式，支持通配符
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            cache = current_app.extensions['cache']
            
            # 执行原函数
            result = f(*args, **kwargs)
            
            # 清除缓存
            # 注意：这里简化处理，实际项目中可能需要使用Redis的KEYS命令或Scan
            # 或者维护一个缓存键列表
            if '*' in key_pattern:
                # 通配符模式 - 清除所有匹配键（需要Redis支持）
                # 这里使用简单实现，实际项目中需要更完善的方案
                pass
            else:
                cache.delete(key_pattern)
            
            return result
        
        return decorated_function
    return decorator


# 缓存键生成器 - 用于生成规范的缓存键
class CacheKeyBuilder:
    """缓存键构建器"""
    
    PREFIX = 'zhijiaoxing'
    
    @classmethod
    def user_session(cls, user_id: int) -> str:
        """用户会话缓存键"""
        return f"{cls.PREFIX}:session:{user_id}"
    
    @classmethod
    def user_profile(cls, user_id: int) -> str:
        """用户资料缓存键"""
        return f"{cls.PREFIX}:user:{user_id}"
    
    @classmethod
    def courses_list(cls, page: int = 1, per_page: int = 10, **filters) -> str:
        """课程列表缓存键"""
        key = f"{cls.PREFIX}:courses:list:{page}:{per_page}"
        if filters:
            filters_str = ':'.join(f"{k}={v}" for k, v in sorted(filters.items()))
            key = f"{key}:{filters_str}"
        return key
    
    @classmethod
    def course_detail(cls, course_id: int) -> str:
        """课程详情缓存键"""
        return f"{cls.PREFIX}:course:{course_id}"
    
    @classmethod
    def course_content(cls, course_id: int, content_id: int = None) -> str:
        """课程内容缓存键"""
        if content_id:
            return f"{cls.PREFIX}:course:{course_id}:content:{content_id}"
        return f"{cls.PREFIX}:course:{course_id}:contents"
    
    @classmethod
    def dashboard_stats(cls, user_id: int = None) -> str:
        """仪表板统计缓存键"""
        if user_id:
            return f"{cls.PREFIX}:stats:dashboard:{user_id}"
        return f"{cls.PREFIX}:stats:dashboard"
    
    @classmethod
    def admin_stats(cls, stat_type: str = 'overview') -> str:
        """管理员统计缓存键"""
        return f"{cls.PREFIX}:stats:admin:{stat_type}"
    
    @classmethod
    def assessment(cls, assessment_id: int) -> str:
        """考核数据缓存键"""
        return f"{cls.PREFIX}:assessment:{assessment_id}"
    
    @classmethod
    def practice_evaluation(cls, user_id: int, course_id: int = None) -> str:
        """练习评测缓存键"""
        if course_id:
            return f"{cls.PREFIX}:practice:{user_id}:{course_id}"
        return f"{cls.PREFIX}:practice:{user_id}"
