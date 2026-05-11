from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
import logging

from src.services.ai_optimization_service import (
    collect_training_data,
    evaluate_ai_output_quality,
    optimize_ai_prompt,
    get_ai_usage_stats,
)

logger = logging.getLogger(__name__)
ai_optimization_bp = Blueprint('ai_optimization', __name__)


def require_admin(f):
    def decorated_function(*args, **kwargs):
        if session.get('user_role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@ai_optimization_bp.route('/ai-optimization/training-data', methods=['GET'])
@require_auth
@require_admin
def api_collect_training_data():
    try:
        teacher_id = request.args.get('teacher_id', type=int)
        limit = request.args.get('limit', 500, type=int)
        result = collect_training_data(teacher_id, limit)
        return jsonify(result), 200
    except Exception as e:
        logger.error('Training data collection error: %s', e)
        return jsonify({'error': str(e)}), 500


@ai_optimization_bp.route('/ai-optimization/quality-evaluation', methods=['GET'])
@require_auth
@require_admin
def api_quality_evaluation():
    try:
        content_type = request.args.get('content_type', 'all')
        sample_size = request.args.get('sample_size', 50, type=int)
        result = evaluate_ai_output_quality(content_type, sample_size)
        return jsonify(result), 200
    except Exception as e:
        logger.error('Quality evaluation error: %s', e)
        return jsonify({'error': str(e)}), 500


@ai_optimization_bp.route('/ai-optimization/optimize-prompt', methods=['POST'])
@require_auth
@require_admin
def api_optimize_prompt():
    try:
        data = request.get_json() or {}
        prompt_type = data.get('prompt_type')
        if not prompt_type:
            return jsonify({'error': 'prompt_type is required'}), 400
        result = optimize_ai_prompt(prompt_type, data.get('current_issues'))
        return jsonify(result), 200
    except Exception as e:
        logger.error('Prompt optimization error: %s', e)
        return jsonify({'error': str(e)}), 500


@ai_optimization_bp.route('/ai-optimization/usage-stats', methods=['GET'])
@require_auth
@require_admin
def api_usage_stats():
    try:
        teacher_id = request.args.get('teacher_id', type=int)
        result = get_ai_usage_stats(teacher_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error('Usage stats error: %s', e)
        return jsonify({'error': str(e)}), 500
