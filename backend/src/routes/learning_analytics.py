from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
import logging

from src.services.learning_analytics_service import (
    get_class_learning_analytics,
    get_student_detail_analytics,
    generate_ai_learning_report,
    get_knowledge_mastery_heatmap,
    get_at_risk_students,
)

logger = logging.getLogger(__name__)
learning_analytics_bp = Blueprint('learning_analytics', __name__)


def require_teacher(f):
    def decorated_function(*args, **kwargs):
        if session.get('user_role') not in ('teacher', 'admin'):
            return jsonify({'error': 'Teacher access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@learning_analytics_bp.route('/learning-analytics/class-overview', methods=['GET'])
@require_auth
@require_teacher
def api_class_overview():
    try:
        teacher_id = session['user_id']
        course_id = request.args.get('course_id', type=int)
        result = get_class_learning_analytics(teacher_id, course_id)
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error('Class overview error: %s', e)
        return jsonify({'error': str(e)}), 500


@learning_analytics_bp.route('/learning-analytics/student-detail/<int:student_id>', methods=['GET'])
@require_auth
@require_teacher
def api_student_detail(student_id):
    try:
        teacher_id = session['user_id']
        result = get_student_detail_analytics(teacher_id, student_id)
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error('Student detail error: %s', e)
        return jsonify({'error': str(e)}), 500


@learning_analytics_bp.route('/learning-analytics/ai-report', methods=['POST'])
@require_auth
@require_teacher
def api_ai_report():
    try:
        teacher_id = session['user_id']
        data = request.get_json() or {}
        course_id = data.get('course_id')
        report_type = data.get('report_type') or 'comprehensive'
        result = generate_ai_learning_report(teacher_id, course_id, report_type, user_id=session.get('user_id'), user_role=session.get('user_role'))
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error('AI report error: %s', e)
        return jsonify({'error': str(e)}), 500


@learning_analytics_bp.route('/learning-analytics/knowledge-heatmap/<int:course_id>', methods=['GET'])
@require_auth
@require_teacher
def api_knowledge_heatmap(course_id):
    try:
        teacher_id = session['user_id']
        result = get_knowledge_mastery_heatmap(teacher_id, course_id)
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error('Knowledge heatmap error: %s', e)
        return jsonify({'error': str(e)}), 500


@learning_analytics_bp.route('/learning-analytics/at-risk-students', methods=['GET'])
@require_auth
@require_teacher
def api_at_risk_students():
    try:
        teacher_id = session['user_id']
        threshold = request.args.get('threshold', 40.0, type=float)
        result = get_at_risk_students(teacher_id, threshold)
        return jsonify({'at_risk_students': result, 'total': len(result)}), 200
    except Exception as e:
        logger.error('At-risk students error: %s', e)
        return jsonify({'error': str(e)}), 500
