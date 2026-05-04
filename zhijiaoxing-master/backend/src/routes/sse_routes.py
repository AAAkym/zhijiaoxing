"""
SSE (Server-Sent Events) 路由

提供符合SSE协议标准的流式输出API接口
"""
from flask import Blueprint, Response, request, stream_with_context, current_app, session
import time
import json

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from utils.sse_utils import SSEStream, SSEHeaders, SSEEventTypes
from services.ai_stream_service import (
    generate_ai_stream,
    generate_course_outline_stream,
    generate_explanation_stream
)
from services.sse_chat_service import sse_chat_service

sse_bp = Blueprint('sse', __name__)


def require_auth_sse(f):
    """SSE认证装饰器"""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            def error_stream():
                sse = SSEStream()
                yield sse.send_config()
                yield sse.format_message({
                    'type': 'error',
                    'error': 'Authentication required',
                    'code': 401
                }, event='error')
                yield sse.send_done()
            return Response(
                stream_with_context(error_stream()),
                mimetype=SSEHeaders.CONTENT_TYPE,
                headers=SSEHeaders.get_headers()
            )
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@sse_bp.route('/ai/stream')
def ai_stream():
    """
    AI内容流式输出接口
    
    使用SSE协议提供AI生成内容的实时流式输出
    
    Query Parameters:
        prompt: 用户输入的提示词
        conversation_id: 会话ID（可选）
        temperature: 生成温度（可选，默认0.7）
        
    Headers:
        Last-Event-ID: 上次接收的事件ID（用于断线重连）
        
    Returns:
        SSE流式响应
        
    Example:
        GET /api/sse/ai/stream?prompt=你好&conversation_id=123
        
        Response:
            id: 1
            event: config
            retry: 3000
            data: 
            
            id: 2
            event: message
            data: {"type": "thinking", "message": "正在分析问题..."}
            
            id: 3
            event: message
            data: {"type": "content", "content": "你好！很高兴为您服务。"}
            
            id: 4
            event: done
            data: [DONE]
    """
    # 获取请求参数
    prompt = request.args.get('prompt', '')
    conversation_id = request.args.get('conversation_id', '')
    temperature = request.args.get('temperature', 0.7, type=float)
    
    # 获取Last-Event-ID（用于断线重连）
    last_event_id = request.headers.get('Last-Event-ID')
    start_id = int(last_event_id) if last_event_id else 0
    
    # 验证参数
    if not prompt:
        return Response(
            'data: {"error": "prompt参数不能为空"}\n\n',
            mimetype='text/event-stream',
            status=400
        )
    
    def generate():
        """生成SSE流"""
        sse = SSEStream(retry=3000, start_id=start_id)
        
        try:
            # 发送初始配置
            yield sse.send_config()
            
            # 发送开始事件
            yield sse.format_message({
                'type': 'start',
                'conversation_id': conversation_id,
                'timestamp': time.time()
            }, event='start')
            
            # 生成AI内容流
            params = {'temperature': temperature}
            
            for chunk in generate_ai_stream(prompt, params):
                if chunk == '[DONE]':
                    yield sse.send_done()
                else:
                    yield sse.send_message(chunk, event='message')
            
        except Exception as e:
            current_app.logger.error(f'SSE流生成错误: {str(e)}')
            yield sse.send_error(str(e))
            yield sse.send_done()
    
    # 返回SSE响应
    return Response(
        stream_with_context(generate()),
        mimetype=SSEHeaders.CONTENT_TYPE,
        headers=SSEHeaders.get_headers()
    )


@sse_bp.route('/ai/course-outline')
def course_outline_stream():
    """
    课程大纲流式生成接口
    
    使用SSE协议流式生成课程大纲
    
    Query Parameters:
        title: 课程标题
        description: 课程描述
        num_chapters: 章节数量（可选，默认5）
        
    Returns:
        SSE流式响应
        
    Example:
        GET /api/sse/ai/course-outline?title=Python基础&description=Python入门课程
    """
    title = request.args.get('title', '')
    description = request.args.get('description', '')
    num_chapters = request.args.get('num_chapters', 5, type=int)
    
    # 获取Last-Event-ID
    last_event_id = request.headers.get('Last-Event-ID')
    start_id = int(last_event_id) if last_event_id else 0
    
    if not title:
        return Response(
            'data: {"error": "title参数不能为空"}\n\n',
            mimetype='text/event-stream',
            status=400
        )
    
    def generate():
        """生成课程大纲SSE流"""
        sse = SSEStream(retry=3000, start_id=start_id)
        
        try:
            # 发送初始配置
            yield sse.send_config()
            
            # 流式生成课程大纲
            for chunk in generate_course_outline_stream(title, description, num_chapters):
                if chunk == '[DONE]':
                    yield sse.send_done()
                else:
                    yield sse.send_message(chunk, event='message')
                    
        except Exception as e:
            current_app.logger.error(f'课程大纲生成错误: {str(e)}')
            yield sse.send_error(str(e))
            yield sse.send_done()
    
    return Response(
        stream_with_context(generate()),
        mimetype=SSEHeaders.CONTENT_TYPE,
        headers=SSEHeaders.get_headers()
    )


@sse_bp.route('/ai/explanation')
def explanation_stream():
    """
    知识点解释流式生成接口
    
    使用SSE协议流式生成知识点解释
    
    Query Parameters:
        topic: 知识点主题
        detail_level: 详细程度（brief, medium, detailed，默认medium）
        
    Returns:
        SSE流式响应
    """
    topic = request.args.get('topic', '')
    detail_level = request.args.get('detail_level', 'medium')
    
    # 获取Last-Event-ID
    last_event_id = request.headers.get('Last-Event-ID')
    start_id = int(last_event_id) if last_event_id else 0
    
    if not topic:
        return Response(
            'data: {"error": "topic参数不能为空"}\n\n',
            mimetype='text/event-stream',
            status=400
        )
    
    def generate():
        """生成知识点解释SSE流"""
        sse = SSEStream(retry=3000, start_id=start_id)
        
        try:
            # 发送初始配置
            yield sse.send_config()
            
            # 流式生成解释
            for chunk in generate_explanation_stream(topic, detail_level):
                if chunk == '[DONE]':
                    yield sse.send_done()
                else:
                    yield sse.send_message(chunk, event='message')
                    
        except Exception as e:
            current_app.logger.error(f'知识点解释生成错误: {str(e)}')
            yield sse.send_error(str(e))
            yield sse.send_done()
    
    return Response(
        stream_with_context(generate()),
        mimetype=SSEHeaders.CONTENT_TYPE,
        headers=SSEHeaders.get_headers()
    )


@sse_bp.route('/ping')
def sse_ping():
    """
    SSE连接测试接口
    
    用于测试SSE连接是否正常
    
    Returns:
        SSE流式响应（发送几个测试消息后关闭）
    """
    def generate():
        sse = SSEStream(retry=3000)
        
        # 发送初始配置
        yield sse.send_config()
        
        # 发送测试消息
        for i in range(3):
            yield sse.format_message({
                'message': f'测试消息 {i+1}',
                'timestamp': time.time()
            }, event='ping')
            time.sleep(1)
        
        yield sse.send_done()
    
    return Response(
        stream_with_context(generate()),
        mimetype=SSEHeaders.CONTENT_TYPE,
        headers=SSEHeaders.get_headers()
    )


@sse_bp.route('/health')
def sse_health():
    """
    SSE服务健康检查
    
    返回SSE服务的健康状态
    
    Returns:
        JSON响应
    """
    return {
        'status': 'healthy',
        'service': 'sse',
        'timestamp': time.time(),
        'features': [
            'ai_stream',
            'course_outline_stream',
            'explanation_stream',
            'reconnect_support',
            'heartbeat',
            'stream_chat'
        ]
    }


@sse_bp.route('/chat', methods=['POST'])
@require_auth_sse
def stream_chat():
    """
    SSE流式问答接口
    
    使用SSE协议提供AI流式问答，支持上下文管理和知识库检索
    
    Request Body (JSON):
        question: 用户问题（必填）
        conversation_id: 会话ID（可选，为空则创建新会话）
        context: 额外上下文（可选）
        topic: 话题，用于知识库检索（可选）
        temperature: 生成温度（可选，默认0.7）
        max_context_length: 最大上下文长度（可选，默认10）
        
    Headers:
        Last-Event-ID: 上次接收的事件ID（用于断线重连）
        
    Returns:
        SSE流式响应
        
    Example:
        POST /api/sse/chat
        Body: {"question": "什么是机器学习？", "topic": "AI"}
        
        Response:
            id: 1
            event: config
            retry: 3000
            data: 
            
            id: 2
            event: start
            data: {"type": "start", "timestamp": 1234567890}
            
            id: 3
            event: message
            data: {"type": "thinking", "message": "正在分析问题..."}
            
            id: 4
            event: message
            data: {"type": "conversation", "conversation_id": "xxx", "title": "..."}
            
            id: 5
            event: message
            data: {"type": "thinking", "message": "正在生成回答..."}
            
            id: 6
            event: message
            data: {"type": "content", "content": "机器学习是...", "chunk_index": 1}
            
            id: 7
            event: message
            data: {"type": "content", "content": "...", "chunk_index": 2}
            
            id: 8
            event: complete
            data: {"type": "complete", "conversation_id": "xxx", "total_chunks": 10}
            
            id: 9
            event: done
            data: [DONE]
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('question'):
            return Response(
                'data: {"type": "error", "error": "question参数不能为空"}\n\n',
                mimetype=SSEHeaders.CONTENT_TYPE,
                headers=SSEHeaders.get_headers(),
                status=400
            )
        
        user_id = session['user_id']
        question = data['question']
        conversation_id = data.get('conversation_id')
        context = data.get('context', '')
        topic = data.get('topic', '')
        temperature = data.get('temperature', 0.7)
        max_context_length = data.get('max_context_length', 10)
        
        last_event_id = request.headers.get('Last-Event-ID')
        
        def generate():
            for chunk in sse_chat_service.stream_chat(
                question=question,
                user_id=user_id,
                conversation_id=conversation_id,
                context=context,
                topic=topic,
                temperature=temperature,
                max_context_length=max_context_length
            ):
                yield chunk
        
        return Response(
            stream_with_context(generate()),
            mimetype=SSEHeaders.CONTENT_TYPE,
            headers=SSEHeaders.get_headers()
        )
        
    except Exception as e:
        current_app.logger.error(f'流式问答错误: {str(e)}')
        
        def error_stream():
            sse = SSEStream()
            yield sse.send_config()
            yield sse.format_message({
                'type': 'error',
                'error': str(e)
            }, event='error')
            yield sse.send_done()
        
        return Response(
            stream_with_context(error_stream()),
            mimetype=SSEHeaders.CONTENT_TYPE,
            headers=SSEHeaders.get_headers()
        )


@sse_bp.route('/chat/simple', methods=['POST'])
def stream_chat_simple():
    """
    简单SSE流式问答接口（无需认证，无会话管理）
    
    适用于快速问答场景，不保存对话历史
    
    Request Body (JSON):
        question: 用户问题（必填）
        context: 额外上下文（可选）
        topic: 话题（可选）
        
    Returns:
        SSE流式响应
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('question'):
            return Response(
                'data: {"type": "error", "error": "question参数不能为空"}\n\n',
                mimetype=SSEHeaders.CONTENT_TYPE,
                headers=SSEHeaders.get_headers(),
                status=400
            )
        
        question = data['question']
        context = data.get('context', '')
        topic = data.get('topic', '')
        
        def generate():
            for chunk in sse_chat_service.stream_chat_simple(
                question=question,
                context=context,
                topic=topic
            ):
                yield chunk
        
        return Response(
            stream_with_context(generate()),
            mimetype=SSEHeaders.CONTENT_TYPE,
            headers=SSEHeaders.get_headers()
        )
        
    except Exception as e:
        current_app.logger.error(f'简单流式问答错误: {str(e)}')
        
        def error_stream():
            sse = SSEStream()
            yield sse.send_config()
            yield sse.format_message({
                'type': 'error',
                'error': str(e)
            }, event='error')
            yield sse.send_done()
        
        return Response(
            stream_with_context(error_stream()),
            mimetype=SSEHeaders.CONTENT_TYPE,
            headers=SSEHeaders.get_headers()
        )
