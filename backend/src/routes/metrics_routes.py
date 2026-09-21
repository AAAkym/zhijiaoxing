"""
监控指标路由
提供 Prometheus 指标端点
"""
from flask import Blueprint, Response, jsonify, request, session
from src.services.metrics_service import metrics_service
from src.utils.auth import require_auth, require_role

metrics_bp = Blueprint('metrics', __name__, url_prefix='/api/metrics')


@metrics_bp.route('/prometheus', methods=['GET'])
@require_auth
@require_role(('admin',))
def prometheus_metrics():
    """
    Prometheus 指标端点
    
    Returns:
        Prometheus 格式的指标数据
    """
    data, content_type = metrics_service.get_metrics()
    return Response(data, mimetype=content_type)


@metrics_bp.route('/health', methods=['GET'])
@require_auth
@require_role(('admin',))
def health_check():
    """
    健康检查端点
    
    仅限管理员：响应体包含数据库可用性与调度器内部状态，属运维信息，
    匿名暴露会向攻击者确认后端组件存活情况。
    
    Returns:
        应用健康状态
    """
    from sqlalchemy import text
    from src.models.user import db
    from src.services.personalized_notification_service import personalized_notification_service
    database = {'available': False, 'message': '数据库连接失败'}
    try:
        db.session.execute(text('SELECT 1'))
        database = {'available': True, 'message': '数据库连接正常'}
    except Exception as exc:
        database['message'] = f'数据库连接失败：{type(exc).__name__}'
    scheduler = personalized_notification_service.scheduler_status()
    return jsonify({
        'status': 'healthy' if database['available'] else 'degraded',
        'database': database,
        'scheduler': scheduler,
        'timestamp': __import__('time').time(),
    }), 200 if database['available'] else 503


@metrics_bp.route('/dashboard', methods=['GET'])
@require_auth
@require_role(('admin', 'teacher'))
def get_dashboard_data():
    """
    获取监控仪表板数据
    
    Returns:
        关键指标摘要
    """
    try:
        days = int(request.args.get('days', 30))
    except (TypeError, ValueError):
        return jsonify({'error': 'days格式不正确', 'code': 'METRICS_FILTER_INVALID'}), 400
    owner_id = session['user_id'] if session.get('user_role') == 'teacher' else None
    return jsonify(metrics_service.workflow_dashboard(owner_id=owner_id, days=days))


@metrics_bp.route('/active-users', methods=['GET'])
@require_auth
@require_role(('admin',))
def get_active_users():
    """
    获取活跃用户统计
    
    Returns:
        活跃用户数据
    """
    return jsonify({
        'active_users': len(metrics_service._active_user_ids),
        'timestamp': __import__('time').time()
    })
