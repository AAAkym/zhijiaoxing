from flask import Blueprint, request, jsonify, session
import logging

from src.services.lesson_plan_service import (
    generate_lesson_plan,
    generate_lesson_plan_section,
    LESSON_PLAN_SECTIONS,
)

logger = logging.getLogger(__name__)
lesson_plan_bp = Blueprint('lesson_plan', __name__)


def require_auth(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


def require_teacher(f):
    def decorated_function(*args, **kwargs):
        if session.get('user_role') not in ('teacher', 'admin'):
            return jsonify({'error': 'Teacher access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@lesson_plan_bp.route('/lesson-plan/generate', methods=['POST'])
@require_auth
@require_teacher
def api_generate_lesson_plan():
    try:
        data = request.get_json() or {}
        course_id = data.get('course_id')
        topic = (data.get('topic') or '').strip()
        if not course_id or not topic:
            return jsonify({'error': 'course_id and topic are required'}), 400

        result = generate_lesson_plan(
            course_id=course_id,
            topic=topic,
            duration=int(data.get('duration') or 45),
            difficulty=data.get('difficulty') or 'medium',
            teaching_style=data.get('teaching_style') or 'hybrid',
            student_level=data.get('student_level') or 'intermediate',
            custom_requirements=data.get('custom_requirements') or '',
        )
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        return jsonify({'message': '教案生成成功', 'plan': result}), 201
    except Exception as e:
        logger.error('Lesson plan generation error: %s', e)
        return jsonify({'error': str(e)}), 500


@lesson_plan_bp.route('/lesson-plan/generate-section', methods=['POST'])
@require_auth
@require_teacher
def api_generate_lesson_plan_section():
    try:
        data = request.get_json() or {}
        course_id = data.get('course_id')
        topic = (data.get('topic') or '').strip()
        section_name = data.get('section_name')
        if not course_id or not topic or not section_name:
            return jsonify({'error': 'course_id, topic and section_name are required'}), 400

        result = generate_lesson_plan_section(
            course_id=course_id,
            topic=topic,
            section_name=section_name,
            existing_plan=data.get('existing_plan'),
            duration=int(data.get('duration') or 45),
            difficulty=data.get('difficulty') or 'medium',
        )
        if 'error' in result:
            return jsonify({'error': result['error']}), 400
        return jsonify({'message': '板块生成成功', 'section': result}), 201
    except Exception as e:
        logger.error('Section generation error: %s', e)
        return jsonify({'error': str(e)}), 500


@lesson_plan_bp.route('/lesson-plan/sections', methods=['GET'])
@require_auth
@require_teacher
def api_get_lesson_plan_sections():
    return jsonify({'sections': LESSON_PLAN_SECTIONS}), 200
