"""
对话上下文管理路由

提供对话会话和消息的RESTful API接口
"""
from flask import Blueprint, request, jsonify, g, session
from functools import wraps

from src.services.conversation_service import conversation_service
from src.models.user import User

conversation_bp = Blueprint('conversation', __name__)


def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Authentication required'
            }), 401
        g.user_id = int(user_id) if user_id else None
        return f(*args, **kwargs)
    return decorated_function


# ==================== 会话管理接口 ====================

@conversation_bp.route('/conversations', methods=['POST'])
@login_required
def create_conversation():
    """
    创建新会话
    
    Request Body:
        {
            "title": "会话标题",
            "max_context_length": 20,
            "context_strategy": "sliding_window",
            "metadata": {}
        }
    
    Returns:
        创建的会话信息
    """
    try:
        data = request.get_json() or {}
        
        conversation = conversation_service.create_conversation(
            user_id=g.user_id,
            title=data.get('title'),
            max_context_length=data.get('max_context_length'),
            context_strategy=data.get('context_strategy', 'sliding_window'),
            metadata=data.get('metadata', {})
        )
        
        return jsonify({
            'success': True,
            'data': conversation.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@conversation_bp.route('/conversations', methods=['GET'])
@login_required
def get_conversations():
    """
    获取用户会话列表
    
    Query Parameters:
        status: 会话状态 (active, archived)
        limit: 数量限制 (默认20)
        offset: 偏移量 (默认0)
    
    Returns:
        会话列表
    """
    try:
        status = request.args.get('status', 'active')
        limit = request.args.get('limit', 20, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        conversations, total = conversation_service.get_user_conversations(
            user_id=g.user_id,
            status=status,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'success': True,
            'data': {
                'conversations': [conv.to_dict() for conv in conversations],
                'total': total,
                'limit': limit,
                'offset': offset
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@conversation_bp.route('/conversations/<conversation_id>', methods=['GET'])
@login_required
def get_conversation(conversation_id):
    """
    获取单个会话详情
    
    Query Parameters:
        include_messages: 是否包含消息 (默认false)
        message_limit: 消息数量限制 (默认10)
    
    Returns:
        会话详情
    """
    try:
        include_messages = request.args.get('include_messages', 'false').lower() == 'true'
        message_limit = request.args.get('message_limit', 10, type=int)
        
        conversation = conversation_service.get_conversation(
            conversation_id=conversation_id
        )
        
        if not conversation:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        # 检查权限
        if conversation.user_id != g.user_id:
            return jsonify({
                'success': False,
                'error': '无权访问此会话'
            }), 403
        
        return jsonify({
            'success': True,
            'data': conversation.to_dict(
                include_messages=include_messages,
                message_limit=message_limit
            )
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@conversation_bp.route('/conversations/<conversation_id>', methods=['PUT'])
@login_required
def update_conversation(conversation_id):
    """
    更新会话
    
    Request Body:
        {
            "title": "新标题",
            "max_context_length": 30,
            "context_strategy": "full",
            "metadata": {}
        }
    
    Returns:
        更新后的会话信息
    """
    try:
        data = request.get_json() or {}
        
        # 检查权限
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        if conversation.user_id != g.user_id:
            return jsonify({
                'success': False,
                'error': '无权修改此会话'
            }), 403
        
        updated_conversation = conversation_service.update_conversation(
            conversation_id=conversation_id,
            title=data.get('title'),
            max_context_length=data.get('max_context_length'),
            context_strategy=data.get('context_strategy'),
            metadata=data.get('metadata')
        )
        
        return jsonify({
            'success': True,
            'data': updated_conversation.to_dict()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@conversation_bp.route('/conversations/<conversation_id>', methods=['DELETE'])
@login_required
def delete_conversation(conversation_id):
    """
    删除会话
    
    Query Parameters:
        hard: 是否硬删除 (默认false)
    
    Returns:
        删除结果
    """
    try:
        # 检查权限
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        if conversation.user_id != g.user_id:
            return jsonify({
                'success': False,
                'error': '无权删除此会话'
            }), 403
        
        hard_delete = request.args.get('hard', 'false').lower() == 'true'
        
        success = conversation_service.delete_conversation(
            conversation_id=conversation_id,
            soft_delete=not hard_delete
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': '会话已删除'
            })
        else:
            return jsonify({
                'success': False,
                'error': '删除失败'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@conversation_bp.route('/conversations/<conversation_id>/archive', methods=['POST'])
@login_required
def archive_conversation(conversation_id):
    """
    归档会话
    
    Returns:
        归档结果
    """
    try:
        # 检查权限
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        if conversation.user_id != g.user_id:
            return jsonify({
                'success': False,
                'error': '无权归档此会话'
            }), 403
        
        success = conversation_service.archive_conversation(conversation_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': '会话已归档'
            })
        else:
            return jsonify({
                'success': False,
                'error': '归档失败'
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== 消息管理接口 ====================

@conversation_bp.route('/conversations/<conversation_id>/messages', methods=['POST'])
@login_required
def add_message(conversation_id):
    """
    添加消息
    
    Request Body:
        {
            "role": "user",
            "content": "消息内容",
            "content_type": "text",
            "metadata": {},
            "parent_id": null
        }
    
    Returns:
        创建的消息信息
    """
    try:
        data = request.get_json() or {}
        
        # 检查权限
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        if conversation.user_id != g.user_id:
            return jsonify({
                'success': False,
                'error': '无权向此会话添加消息'
            }), 403
        
        # 验证必需字段
        if not data.get('role') or not data.get('content'):
            return jsonify({
                'success': False,
                'error': 'role和content为必需字段'
            }), 400
        
        message = conversation_service.add_message(
            conversation_id=conversation_id,
            role=data['role'],
            content=data['content'],
            content_type=data.get('content_type', 'text'),
            metadata=data.get('metadata', {}),
            parent_id=data.get('parent_id')
        )
        
        return jsonify({
            'success': True,
            'data': message.to_dict()
        }), 201
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@conversation_bp.route('/conversations/<conversation_id>/messages', methods=['GET'])
@login_required
def get_messages(conversation_id):
    """
    获取会话消息列表
    
    Query Parameters:
        limit: 数量限制 (默认100)
        offset: 偏移量 (默认0)
        include_deleted: 是否包含已删除消息 (默认false)
    
    Returns:
        消息列表
    """
    try:
        # 检查权限
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        if conversation.user_id != g.user_id:
            return jsonify({
                'success': False,
                'error': '无权访问此会话'
            }), 403
        
        limit = request.args.get('limit', 100, type=int)
        offset = request.args.get('offset', 0, type=int)
        include_deleted = request.args.get('include_deleted', 'false').lower() == 'true'
        
        messages, total = conversation_service.get_messages(
            conversation_id=conversation_id,
            limit=limit,
            offset=offset,
            include_deleted=include_deleted
        )
        
        return jsonify({
            'success': True,
            'data': {
                'messages': [msg.to_dict() for msg in messages],
                'total': total,
                'limit': limit,
                'offset': offset
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@conversation_bp.route('/conversations/<conversation_id>/context', methods=['GET'])
@login_required
def get_context(conversation_id):
    """
    获取对话上下文
    
    Query Parameters:
        max_length: 最大长度
        use_cache: 是否使用缓存 (默认true)
    
    Returns:
        上下文消息列表
    """
    try:
        # 检查权限
        conversation = conversation_service.get_conversation(conversation_id)
        if not conversation:
            return jsonify({
                'success': False,
                'error': '会话不存在'
            }), 404
        
        if conversation.user_id != g.user_id:
            return jsonify({
                'success': False,
                'error': '无权访问此会话'
            }), 403
        
        max_length = request.args.get('max_length', type=int)
        use_cache = request.args.get('use_cache', 'true').lower() == 'true'
        
        context = conversation_service.get_context(
            conversation_id=conversation_id,
            max_length=max_length,
            use_cache=use_cache
        )
        
        return jsonify({
            'success': True,
            'data': {
                'context': context,
                'length': len(context),
                'strategy': conversation.context_strategy
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== 统计接口 ====================

@conversation_bp.route('/conversations/stats', methods=['GET'])
@login_required
def get_conversation_stats():
    """
    获取用户对话统计
    
    Returns:
        统计信息
    """
    try:
        stats = conversation_service.get_conversation_stats(g.user_id)
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ==================== 批量操作接口 ====================

@conversation_bp.route('/conversations/batch-delete', methods=['POST'])
@login_required
def batch_delete_conversations():
    """
    批量删除会话
    
    Request Body:
        {
            "conversation_ids": ["id1", "id2"],
            "hard": false
        }
    
    Returns:
        删除结果
    """
    try:
        data = request.get_json() or {}
        conversation_ids = data.get('conversation_ids', [])
        hard_delete = data.get('hard', False)
        
        if not conversation_ids:
            return jsonify({
                'success': False,
                'error': 'conversation_ids不能为空'
            }), 400
        
        success_count = 0
        failed_ids = []
        
        for conv_id in conversation_ids:
            try:
                # 检查权限
                conversation = conversation_service.get_conversation(conv_id)
                if conversation and conversation.user_id == g.user_id:
                    if conversation_service.delete_conversation(conv_id, soft_delete=not hard_delete):
                        success_count += 1
                    else:
                        failed_ids.append(conv_id)
                else:
                    failed_ids.append(conv_id)
            except Exception:
                failed_ids.append(conv_id)
        
        return jsonify({
            'success': True,
            'data': {
                'success_count': success_count,
                'failed_count': len(failed_ids),
                'failed_ids': failed_ids
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
