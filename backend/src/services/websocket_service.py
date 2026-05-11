"""
WebSocket 实时通信服务

基于 Flask-SocketIO 实现师生实时互动
支持举手、问答、讨论的实时推送

注意：此服务需要安装 flask-socketio 依赖才能启用
如果没有安装，会自动降级为非实时模式
"""

import os

from flask import request, session
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# 标志：WebSocket 是否可用
WEBSOCKET_AVAILABLE = False
socketio = None

# 尝试导入 SocketIO
try:
    from flask_socketio import SocketIO, emit, join_room, leave_room
    WEBSOCKET_AVAILABLE = True
    logger.info("WebSocket 模块导入成功")
except ImportError:
    logger.warning("WebSocket 模块不可用，将使用非实时模式")
    WEBSOCKET_AVAILABLE = False

# 存储在线用户和课程房间
online_users = {}  # user_id -> sid
course_rooms = {}  # course_id -> set of user_ids

# 如果 SocketIO 可用，初始化它
if WEBSOCKET_AVAILABLE:
    cors_origins = os.environ.get(
        "SOCKETIO_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    socketio = SocketIO(
        cors_allowed_origins=[origin.strip() for origin in cors_origins if origin.strip()],
        async_mode=os.environ.get("SOCKETIO_ASYNC_MODE", "threading"),
        logger=os.environ.get("SOCKETIO_LOGGER", "false").lower() in ("true", "1", "yes"),
        engineio_logger=os.environ.get("SOCKETIO_ENGINEIO_LOGGER", "false").lower() in ("true", "1", "yes"),
        ping_interval=int(os.environ.get("SOCKETIO_PING_INTERVAL", "25")),
        ping_timeout=int(os.environ.get("SOCKETIO_PING_TIMEOUT", "60")),
    )
else:
    # 创建一个模拟的 socketio 对象，提供空实现
    class DummySocketIO:
        def init_app(self, app):
            logger.info("DummySocketIO: init_app called (WebSocket 不可用)")
            
        def emit(self, *args, **kwargs):
            logger.debug(f"DummySocketIO: emit called {args}")
            
    socketio = DummySocketIO()


def init_socketio(app):
    """初始化 WebSocket 服务"""
    if WEBSOCKET_AVAILABLE:
        socketio.init_app(app)
        register_events()
        logger.info("WebSocket service initialized")
    else:
        socketio.init_app(app)
        logger.warning("WebSocket service not available - running in offline mode")


def register_events():
    """注册 WebSocket 事件处理器"""
    if not WEBSOCKET_AVAILABLE:
        return
    
    @socketio.on('connect')
    def handle_connect():
        """处理客户端连接"""
        logger.info(f'Client connected: {session.get("user_id", "anonymous")}')
        
    @socketio.on('disconnect')
    def handle_disconnect():
        """处理客户端断开"""
        user_id = session.get('user_id')
        if user_id and user_id in online_users:
            del online_users[user_id]
        logger.info(f'Client disconnected: {user_id}')
    
    @socketio.on('join_course')
    def handle_join_course(data):
        """加入课程房间"""
        course_id = data.get('course_id')
        user_id = session.get('user_id')
        user_role = session.get('user_role')
        
        if not course_id or not user_id:
            emit('error', {'message': 'Invalid course or user'})
            return
        
        # 加入 Socket.IO 房间
        join_room(f'course_{course_id}')
        
        # 记录在线用户
        online_users[user_id] = {
            'sid': request.sid,
            'role': user_role,
            'course_id': course_id,
            'joined_at': datetime.utcnow()
        }
        
        # 记录课程房间成员
        if course_id not in course_rooms:
            course_rooms[course_id] = set()
        course_rooms[course_id].add(user_id)
        
        logger.info(f'User {user_id} joined course room {course_id}')
        
        # 确认加入成功
        emit('joined_course', {
            'course_id': course_id,
            'user_id': user_id,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    @socketio.on('leave_course')
    def handle_leave_course(data):
        """离开课程房间"""
        course_id = data.get('course_id')
        user_id = session.get('user_id')
        
        if course_id and user_id:
            leave_room(f'course_{course_id}')
            
            if user_id in online_users:
                del online_users[user_id]
            
            if course_id in course_rooms and user_id in course_rooms[course_id]:
                course_rooms[course_id].remove(user_id)
            
            logger.info(f'User {user_id} left course room {course_id}')
    
    @socketio.on('hand_raise_event')
    def handle_hand_raise_event(data):
        """处理举手事件（实时推送）"""
        course_id = data.get('course_id')
        user_id = session.get('user_id')
        user_role = session.get('user_role')
        
        if not course_id or not user_id:
            emit('error', {'message': 'Invalid data'})
            return
        
        # 向课程房间广播举手事件
        socketio.emit('hand_raise_updated', {
            'event_type': 'created',
            'course_id': course_id,
            'user_id': user_id,
            'user_role': user_role,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'course_{course_id}')
        
        logger.info(f'Hand raise event broadcasted to course {course_id}')
    
    @socketio.on('question_event')
    def handle_question_event(data):
        """处理问答事件（实时推送）"""
        course_id = data.get('course_id')
        question_id = data.get('question_id')
        event_type = data.get('event_type')  # created, answered, resolved
        
        if not course_id:
            emit('error', {'message': 'Invalid course'})
            return
        
        # 向课程房间广播问答事件
        socketio.emit('question_updated', {
            'event_type': event_type,
            'course_id': course_id,
            'question_id': question_id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'course_{course_id}')
        
        logger.info(f'Question {event_type} event broadcasted to course {course_id}')
    
    @socketio.on('discussion_event')
    def handle_discussion_event(data):
        """处理讨论事件（实时推送）"""
        course_id = data.get('course_id')
        discussion_id = data.get('discussion_id')
        event_type = data.get('event_type')  # created, replied, pinned
        
        if not course_id:
            emit('error', {'message': 'Invalid course'})
            return
        
        # 向课程房间广播讨论事件
        socketio.emit('discussion_updated', {
            'event_type': event_type,
            'course_id': course_id,
            'discussion_id': discussion_id,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'course_{course_id}')
        
        logger.info(f'Discussion {event_type} event broadcasted to course {course_id}')


# 便捷函数：向课程房间发送通知
def notify_hand_raise(course_id, hand_raise_data, event_type='created'):
    """通知举手更新"""
    if WEBSOCKET_AVAILABLE and socketio:
        socketio.emit('hand_raise_updated', {
            'event_type': event_type,
            'course_id': course_id,
            'data': hand_raise_data,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'course_{course_id}')
    else:
        logger.debug(f"notify_hand_raise (WebSocket 不可用): course_id={course_id}")


def notify_question(course_id, question_data, event_type='created'):
    """通知问答更新"""
    if WEBSOCKET_AVAILABLE and socketio:
        socketio.emit('question_updated', {
            'event_type': event_type,
            'course_id': course_id,
            'data': question_data,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'course_{course_id}')
    else:
        logger.debug(f"notify_question (WebSocket 不可用): course_id={course_id}")


def notify_discussion(course_id, discussion_data, event_type='created'):
    """通知讨论更新"""
    if WEBSOCKET_AVAILABLE and socketio:
        socketio.emit('discussion_updated', {
            'event_type': event_type,
            'course_id': course_id,
            'data': discussion_data,
            'timestamp': datetime.utcnow().isoformat()
        }, room=f'course_{course_id}')
    else:
        logger.debug(f"notify_discussion (WebSocket 不可用): course_id={course_id}")


def get_online_users(course_id=None):
    """获取在线用户"""
    if course_id:
        return course_rooms.get(course_id, set())
    return online_users


def broadcast_to_course(course_id, event, data):
    """向课程房间广播事件"""
    if WEBSOCKET_AVAILABLE and socketio:
        socketio.emit(event, data, room=f'course_{course_id}')
    else:
        logger.debug(f"broadcast_to_course (WebSocket 不可用): course_id={course_id}, event={event}")
