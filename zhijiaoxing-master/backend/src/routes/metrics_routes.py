"""
监控指标路由
提供 Prometheus 指标端点
"""
from flask import Blueprint, Response, jsonify
from services.metrics_service import metrics_service
from middleware.auth import require_auth

metrics_bp = Blueprint('metrics', __name__, url_prefix='/api/metrics')


@metrics_bp.route('/prometheus', methods=['GET'])
def prometheus_metrics():
    """
    Prometheus 指标端点
    
    Returns:
        Prometheus 格式的指标数据
    """
    data, content_type = metrics_service.get_metrics()
    return Response(data, mimetype=content_type)


@metrics_bp.route('/health', methods=['GET'])
def health_check():
    """
    健康检查端点
    
    Returns:
        应用健康状态
    """
    return jsonify({
        'status': 'healthy',
        'timestamp': __import__('time').time()
    })


@metrics_bp.route('/dashboard', methods=['GET'])
@require_auth
def get_dashboard_data():
    """
    获取监控仪表板数据
    
    Returns:
        关键指标摘要
    """
    return jsonify({
        'api_requests': {
            'total': '从 Prometheus 获取',
            'description': '使用 /api/metrics/prometheus 端点获取详细指标'
        },
        'active_users': {
            'description': '当前活跃用户数量'
        },
        'error_rate': {
            'description': '错误率统计'
        },
        'response_time': {
            'description': '平均响应时间'
        }
    })


@metrics_bp.route('/active-users', methods=['GET'])
@require_auth
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
