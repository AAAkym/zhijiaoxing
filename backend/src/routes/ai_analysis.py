from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
from src.models.user import db, User
from src.services import ai_analysis_service as svc
import logging

logger = logging.getLogger(__name__)

ai_analysis_bp = Blueprint('ai_analysis', __name__)


def require_admin(f):
    def decorated_function(*args, **kwargs):
        if session.get('user_role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@ai_analysis_bp.route('/ai-analysis/dashboard', methods=['GET'])
@require_auth
@require_admin
def get_dashboard():
    try:
        user_id = session['user_id']
        result = svc.get_dashboard_summary(user_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"AI analysis dashboard error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/reports', methods=['GET'])
@require_auth
@require_admin
def get_reports():
    try:
        report_type = request.args.get('type')
        limit = request.args.get('limit', 20, type=int)
        result = svc.get_reports(report_type=report_type, limit=limit)
        return jsonify({'reports': result}), 200
    except Exception as e:
        logger.error(f"Get reports error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/reports/generate', methods=['POST'])
@require_auth
@require_admin
def generate_report():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        report_type = data.get('report_type', 'weekly')
        result = svc.generate_report(report_type=report_type, admin_id=user_id, user_id=session.get('user_id'), user_role=session.get('user_role'))
        if 'error' in result:
            return jsonify(result), 400
        svc.create_notification(
            user_id=user_id,
            notification_type='report_generated',
            title=f'新{report_type}报告已生成',
            content=f'{report_type}分析报告已自动生成，请查看。',
            related_id=result.get('id'),
            related_type='report',
        )
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Generate report error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/reports/<int:report_id>', methods=['GET'])
@require_auth
@require_admin
def get_report_detail(report_id):
    try:
        user_id = session['user_id']
        result = svc.get_report_detail(report_id)
        if not result:
            return jsonify({'error': 'Report not found'}), 404
        svc.log_access(
            user_id=user_id,
            resource_type='report',
            resource_id=report_id,
            access_level='full',
            ip_address=request.remote_addr,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get report detail error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/insights', methods=['GET'])
@require_auth
@require_admin
def get_insights():
    try:
        insight_type = request.args.get('type')
        status = request.args.get('status')
        limit = request.args.get('limit', 20, type=int)
        result = svc.get_insights(insight_type=insight_type, status=status, limit=limit)
        return jsonify({'insights': result}), 200
    except Exception as e:
        logger.error(f"Get insights error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/insights/generate', methods=['POST'])
@require_auth
@require_admin
def generate_insight():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        insight_type = data.get('insight_type', 'churn_prediction')
        result = svc.generate_insight(insight_type=insight_type, admin_id=user_id, user_id=session.get('user_id'), user_role=session.get('user_role'))
        if 'error' in result:
            return jsonify(result), 400
        if result.get('risk_level') in ('high', 'medium'):
            svc.create_notification(
                user_id=user_id,
                notification_type='insight_alert',
                title=f'智能洞察预警：{result.get("title", "")}',
                content=result.get('description', ''),
                related_id=result.get('id'),
                related_type='insight',
            )
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Generate insight error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/insights/<int:insight_id>', methods=['GET'])
@require_auth
@require_admin
def get_insight_detail(insight_id):
    try:
        result = svc.get_insight_detail(insight_id)
        if not result:
            return jsonify({'error': 'Insight not found'}), 404
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get insight detail error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/insights/<int:insight_id>/dismiss', methods=['POST'])
@require_auth
@require_admin
def dismiss_insight(insight_id):
    try:
        result = svc.dismiss_insight(insight_id)
        if not result:
            return jsonify({'error': 'Insight not found'}), 404
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Dismiss insight error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/notifications', methods=['GET'])
@require_auth
@require_admin
def get_notifications():
    try:
        user_id = session['user_id']
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        limit = request.args.get('limit', 50, type=int)
        result = svc.get_notifications(user_id=user_id, unread_only=unread_only, limit=limit)
        return jsonify({'notifications': result}), 200
    except Exception as e:
        logger.error(f"Get notifications error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/notifications/<int:notification_id>/read', methods=['POST'])
@require_auth
@require_admin
def mark_notification_read(notification_id):
    try:
        user_id = session['user_id']
        result = svc.mark_notification_read(notification_id, user_id)
        if not result:
            return jsonify({'error': 'Notification not found'}), 404
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Mark notification read error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/notifications/read-all', methods=['POST'])
@require_auth
@require_admin
def mark_all_notifications_read():
    try:
        user_id = session['user_id']
        count = svc.mark_all_notifications_read(user_id)
        return jsonify({'marked_count': count}), 200
    except Exception as e:
        logger.error(f"Mark all notifications read error: {e}")
        return jsonify({'error': str(e)}), 500


@ai_analysis_bp.route('/ai-analysis/custom', methods=['POST'])
@require_auth
@require_admin
def custom_analysis():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        dimensions = data.get('dimensions', ['users', 'courses'])
        metrics = data.get('metrics', [])
        time_range = data.get('time_range', '7days')
        result = svc.custom_analysis(
            dimensions=dimensions,
            metrics=metrics,
            time_range=time_range,
            admin_id=user_id,
        )
        svc.log_access(
            user_id=user_id,
            resource_type='custom_analysis',
            resource_id=0,
            access_level='full',
            ip_address=request.remote_addr,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Custom analysis error: {e}")
        return jsonify({'error': str(e)}), 500
