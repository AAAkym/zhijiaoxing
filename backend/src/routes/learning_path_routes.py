import logging
from flask import Blueprint, jsonify, request, session
from src.utils.auth import require_auth
from src.models.user import db
from src.services.learning_path_service import learning_path_service, recommendation_engine
from src.services.recommendation_engine_service import recommendation_engine_service

logger = logging.getLogger(__name__)

learning_path_bp = Blueprint('learning_path', __name__)


@learning_path_bp.route('/learning-path', methods=['GET'])
@require_auth
def get_learning_paths():
    try:
        user_id = session['user_id']
        paths = learning_path_service.get_user_paths(user_id)
        return jsonify({'paths': paths}), 200
    except Exception as e:
        logger.error(f'Get learning paths error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/learning-path/generate', methods=['POST'])
@require_auth
def generate_learning_path():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        course_id = data.get('course_id')
        result = learning_path_service.generate_path(user_id, course_id)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify({'path': result}), 200
    except Exception as e:
        logger.error(f'Generate learning path error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/learning-path/<int:path_id>', methods=['GET'])
@require_auth
def get_learning_path_detail(path_id):
    try:
        user_id = session['user_id']
        path = learning_path_service.get_path_detail(user_id, path_id)
        if not path:
            return jsonify({'error': '路径不存在'}), 404
        return jsonify({'path': path}), 200
    except Exception as e:
        logger.error(f'Get learning path detail error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/learning-path/<int:path_id>/node/<node_id>', methods=['PUT'])
@require_auth
def update_node_status(path_id, node_id):
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        status = data.get('status')
        if status not in ('locked', 'available', 'in_progress', 'completed'):
            return jsonify({'error': 'Invalid status'}), 400
        result = learning_path_service.update_node_status(user_id, path_id, node_id, status)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify({'path': result}), 200
    except Exception as e:
        logger.error(f'Update node status error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/learning-plan/generate', methods=['POST'])
@require_auth
def generate_learning_plan():
    try:
        user_id = session['user_id']
        result = learning_path_service.generate_ai_plan(user_id, user_role=session.get('user_role'))
        if 'error' in result:
            return jsonify(result), 400
        return jsonify({'plan': result}), 200
    except Exception as e:
        logger.error(f'Generate learning plan error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/learning-plans', methods=['GET'])
@require_auth
def get_learning_plans():
    try:
        user_id = session['user_id']
        plans = learning_path_service.get_user_plans(user_id)
        return jsonify({'plans': plans}), 200
    except Exception as e:
        logger.error(f'Get learning plans error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations', methods=['GET'])
@require_auth
def get_recommendations():
    try:
        user_id = session['user_id']
        resource_type = request.args.get('type')
        priority = request.args.get('priority', type=int)
        recs = recommendation_engine.get_recommendations(user_id, resource_type, priority)
        return jsonify({'recommendations': recs}), 200
    except Exception as e:
        logger.error(f'Get recommendations error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/generate', methods=['POST'])
@require_auth
def generate_recommendations():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        limit = data.get('limit', 20)
        result = recommendation_engine.generate_recommendations(user_id, limit)
        if isinstance(result, dict) and 'error' in result:
            return jsonify(result), 400
        return jsonify({'recommendations': result}), 200
    except Exception as e:
        logger.error(f'Generate recommendations error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/<int:rec_id>/complete', methods=['POST'])
@require_auth
def complete_recommendation(rec_id):
    try:
        user_id = session['user_id']
        result = recommendation_engine.complete_recommendation(user_id, rec_id)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify({'recommendation': result}), 200
    except Exception as e:
        logger.error(f'Complete recommendation error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/<int:rec_id>/dismiss', methods=['POST'])
@require_auth
def dismiss_recommendation(rec_id):
    try:
        user_id = session['user_id']
        result = recommendation_engine.dismiss_recommendation(user_id, rec_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f'Dismiss recommendation error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/<int:rec_id>/feedback', methods=['POST'])
@require_auth
def feedback_recommendation(rec_id):
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        score = data.get('score', 3)
        result = recommendation_engine.feedback_recommendation(user_id, rec_id, score)
        if 'error' in result:
            return jsonify(result), 400
        return jsonify({'recommendation': result}), 200
    except Exception as e:
        logger.error(f'Feedback recommendation error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/smart', methods=['POST'])
@require_auth
def generate_smart_recommendations():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        filters = {}
        if data.get('resource_type'):
            filters['resource_type'] = data['resource_type']
        if data.get('difficulty_level'):
            filters['difficulty_level'] = data['difficulty_level']
        if data.get('learning_objective'):
            filters['learning_objective'] = data['learning_objective']
        limit = data.get('limit', 20)
        include_video_search = data.get('include_video_search', True)

        result = recommendation_engine_service.generate_smart_recommendations(
            user_id, filters=filters or None, limit=limit
        )

        if isinstance(result, dict) and 'error' in result:
            return jsonify(result), 400

        if include_video_search:
            try:
                video_result = recommendation_engine_service.generate_video_search_links(user_id)
                if isinstance(video_result, list) and video_result:
                    result.extend(video_result)
            except Exception as ve:
                logger.warning(f'Video search generation failed: {ve}')

        return jsonify({'recommendations': result}), 200
    except Exception as e:
        logger.error(f'Smart recommendations error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/video-search', methods=['POST'])
@require_auth
def generate_video_search():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        topic = data.get('topic', '')
        knowledge_points = data.get('knowledge_points', [])

        result = recommendation_engine_service.generate_video_search_links(
            user_id, topic=topic, knowledge_points=knowledge_points
        )
        if isinstance(result, dict) and 'error' in result:
            return jsonify(result), 400
        return jsonify({'video_recommendations': result}), 200
    except Exception as e:
        logger.error(f'Video search error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/effectiveness', methods=['GET'])
@require_auth
def get_recommendation_effectiveness():
    try:
        user_id = session['user_id']
        stats = recommendation_engine_service.get_effectiveness_stats(user_id)
        return jsonify({'effectiveness': stats}), 200
    except Exception as e:
        logger.error(f'Get effectiveness error: {e}')
        return jsonify({'error': str(e)}), 500


@learning_path_bp.route('/recommendations/adjust-weights', methods=['POST'])
@require_auth
def adjust_recommendation_weights():
    try:
        user_id = session['user_id']
        result = recommendation_engine_service.adjust_weights_from_feedback(user_id)
        return jsonify({'result': result}), 200
    except Exception as e:
        logger.error(f'Adjust weights error: {e}')
        return jsonify({'error': str(e)}), 500
