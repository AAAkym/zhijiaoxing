"""
SSE (Server-Sent Events) 工具模块

提供符合SSE协议标准的流式输出功能
"""
import json
import time
from typing import Optional, Generator, Any, Dict


class SSEMessage:
    """
    SSE消息类
    
    封装单个SSE消息，支持所有SSE标准字段
    """
    
    def __init__(self, data: Any, event: Optional[str] = None, 
                 id: Optional[int] = None, retry: Optional[int] = None):
        """
        初始化SSE消息
        
        Args:
            data: 消息数据（会被转换为字符串）
            event: 事件类型（可选）
            id: 事件ID（可选，用于断线重连）
            retry: 重连间隔（毫秒，可选）
        """
        self.data = data
        self.event = event
        self.id = id
        self.retry = retry
    
    def to_string(self) -> str:
        """
        将消息转换为SSE格式字符串
        
        Returns:
            SSE格式字符串
        """
        lines = []
        
        # 添加事件ID
        if self.id is not None:
            lines.append(f"id: {self.id}")
        
        # 添加事件类型
        if self.event is not None:
            lines.append(f"event: {self.event}")
        
        # 添加重连时间
        if self.retry is not None:
            lines.append(f"retry: {self.retry}")
        
        # 处理数据内容
        data_str = self._format_data(self.data)
        
        # SSE标准要求每行数据以"data: "开头
        for line in data_str.split('\n'):
            lines.append(f"data: {line}")
        
        # 以两个换行符结束（SSE标准要求）
        lines.append('')
        lines.append('')
        
        return '\n'.join(lines)
    
    def _format_data(self, data: Any) -> str:
        """格式化数据为字符串"""
        if isinstance(data, dict) or isinstance(data, list):
            return json.dumps(data, ensure_ascii=False)
        elif isinstance(data, bytes):
            return data.decode('utf-8')
        else:
            return str(data)
    
    def __str__(self) -> str:
        return self.to_string()
    
    def __repr__(self) -> str:
        return f"SSEMessage(event={self.event}, id={self.id}, data={self.data[:50] if isinstance(self.data, str) else self.data}...)"


class SSEStream:
    """
    SSE流生成器
    
    管理SSE流的生成，支持断线重连和事件ID追踪
    """
    
    def __init__(self, retry: int = 3000, start_id: int = 0):
        """
        初始化SSE流
        
        Args:
            retry: 客户端重连间隔（毫秒，默认3000ms）
            start_id: 起始事件ID
        """
        self.retry = retry
        self.event_id = start_id
        self.start_time = time.time()
    
    def format_message(self, data: Any, event: Optional[str] = None, 
                      id: Optional[int] = None) -> str:
        """
        格式化单条SSE消息
        
        Args:
            data: 消息数据
            event: 事件类型
            id: 事件ID（为None则自动递增）
            
        Returns:
            SSE格式字符串
        """
        if id is None:
            self.event_id += 1
            id = self.event_id
        
        message = SSEMessage(
            data=data,
            event=event,
            id=id,
            retry=self.retry
        )
        
        return message.to_string()
    
    def send_config(self) -> str:
        """发送初始配置（重连时间）"""
        return self.format_message('', event='config')
    
    def send_message(self, data: Any, event: str = 'message') -> str:
        """发送普通消息"""
        return self.format_message(data, event=event)
    
    def send_done(self, data: str = '[DONE]') -> str:
        """发送结束标记"""
        return self.format_message(data, event='done')
    
    def send_error(self, error_message: str) -> str:
        """发送错误消息"""
        return self.format_message({'error': error_message}, event='error')
    
    def send_ping(self) -> str:
        """发送心跳包（保持连接）"""
        return self.format_message({'timestamp': time.time()}, event='ping')
    
    def generate_stream(self, data_generator: Generator[Any, None, None],
                       event_type: str = 'message') -> Generator[str, None, None]:
        """
        从数据生成器生成SSE流
        
        Args:
            data_generator: 数据生成器
            event_type: 默认事件类型
            
        Yields:
            SSE格式字符串
        """
        # 发送初始配置
        yield self.send_config()
        
        try:
            for data in data_generator:
                yield self.send_message(data, event=event_type)
                
                # 每10秒发送一次心跳包
                if time.time() - self.start_time > 10:
                    yield self.send_ping()
                    self.start_time = time.time()
        
        except Exception as e:
            yield self.send_error(str(e))
        
        finally:
            # 发送结束标记
            yield self.send_done()
    
    def get_current_id(self) -> int:
        """获取当前事件ID"""
        return self.event_id
    
    def set_id(self, id: int):
        """设置当前事件ID（用于断线重连恢复）"""
        self.event_id = id


class SSEEventTypes:
    """
    SSE标准事件类型
    """
    CONFIG = 'config'      # 配置事件
    MESSAGE = 'message'    # 普通消息
    DONE = 'done'          # 完成事件
    ERROR = 'error'        # 错误事件
    PING = 'ping'          # 心跳包
    PROGRESS = 'progress'  # 进度事件
    START = 'start'        # 开始事件


class SSEHeaders:
    """
    SSE标准HTTP头
    """
    CONTENT_TYPE = 'text/event-stream; charset=utf-8'
    CACHE_CONTROL = 'no-cache'
    CONNECTION = 'keep-alive'
    X_ACCEL_BUFFERING = 'no'  # 禁用Nginx缓冲
    
    @classmethod
    def get_headers(cls) -> Dict[str, str]:
        """获取标准SSE响应头"""
        return {
            'Content-Type': cls.CONTENT_TYPE,
            'Cache-Control': cls.CACHE_CONTROL,
            'Connection': cls.CONNECTION,
            'X-Accel-Buffering': cls.X_ACCEL_BUFFERING,
        }


def create_sse_response(data_generator: Generator[Any, None, None],
                       retry: int = 3000,
                       start_id: int = 0,
                       event_type: str = 'message') -> Generator[str, None, None]:
    """
    创建SSE响应流（便捷函数）
    
    Args:
        data_generator: 数据生成器
        retry: 重连间隔（毫秒）
        start_id: 起始事件ID
        event_type: 默认事件类型
        
    Yields:
        SSE格式字符串
    """
    sse = SSEStream(retry=retry, start_id=start_id)
    yield from sse.generate_stream(data_generator, event_type)


def format_sse_message(data: Any, event: Optional[str] = None,
                      id: Optional[int] = None, retry: Optional[int] = None) -> str:
    """
    格式化SSE消息（便捷函数）
    
    Args:
        data: 消息数据
        event: 事件类型
        id: 事件ID
        retry: 重连间隔
        
    Returns:
        SSE格式字符串
    """
    message = SSEMessage(data=data, event=event, id=id, retry=retry)
    return message.to_string()
