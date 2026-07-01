from flask import Blueprint, request, jsonify, g, session
from functools import wraps

from src.services.content_review_service import content_review_service
from src.models.content_review import ContentReview
from src.models.user import User

content_review_bp = Blueprint('content_review', __name__)


def login_required(f):
    """登录验证装饰器"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = session.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        g.user_id = int(user_id) if user_id else None
        return f(*args, **kwargs)
    return decorated_function


@content_review_bp.route('/list', methods=['GET'])
@login_required
def get_review_list():
    filters = {
        'status': request.args.get('status'),
        'content_type': request.args.get('content_type'),
        'source': request.args.get('source'),
        'search': request.args.get('search'),
        'page': request.args.get('page', 1),
        'per_page': request.args.get('per_page', 10),
    }
    result = content_review_service.get_review_list(filters)
    return jsonify({'success': True, 'data': result})


@content_review_bp.route('/stats', methods=['GET'])
@login_required
def get_review_stats():
    stats = content_review_service.get_review_stats()
    return jsonify({'success': True, 'data': stats})


@content_review_bp.route('/<int:review_id>', methods=['GET'])
@login_required
def get_review_detail(review_id):
    review = ContentReview.query.get(review_id)
    if not review:
        return jsonify({'success': False, 'error': '审核记录不存在'}), 404
    return jsonify({'success': True, 'data': review.to_dict(include_content=True)})


@content_review_bp.route('/submit', methods=['POST'])
@login_required
def submit_for_review():
    data = request.get_json() or {}
    content_id = data.get('content_id')
    content_type = data.get('content_type')
    content_title = data.get('content_title', '')
    content_body = data.get('content_body', '')
    source = data.get('source', 'ai')

    if not content_id or not content_type:
        return jsonify({'success': False, 'error': 'content_id 和 content_type 为必填项'}), 400

    review = content_review_service.submit_for_review(
        content_id=content_id,
        content_type=content_type,
        content_title=content_title,
        content_body=content_body,
        source=source,
        author_id=g.user_id,
    )
    return jsonify({'success': True, 'data': review.to_dict()})


@content_review_bp.route('/<int:review_id>/auto-review', methods=['POST'])
@login_required
def trigger_auto_review(review_id):
    review = content_review_service.auto_review(review_id)
    if not review:
        return jsonify({'success': False, 'error': '审核记录不存在'}), 404
    return jsonify({'success': True, 'data': review.to_dict(include_content=True)})


@content_review_bp.route('/<int:review_id>/manual-review', methods=['POST'])
@login_required
def submit_manual_review(review_id):
    data = request.get_json() or {}
    status = data.get('status')
    comment = data.get('comment', '')
    score = data.get('score')

    if status not in ('passed', 'rejected'):
        return jsonify({'success': False, 'error': 'status 必须为 passed 或 rejected'}), 400

    review = content_review_service.manual_review(
        review_id=review_id,
        reviewer_id=g.user_id,
        status=status,
        comment=comment,
        score=score,
    )
    if not review:
        return jsonify({'success': False, 'error': '审核记录不存在'}), 404
    return jsonify({'success': True, 'data': review.to_dict()})


@content_review_bp.route('/batch', methods=['POST'])
@login_required
def batch_review():
    data = request.get_json() or {}
    review_ids = data.get('review_ids', [])
    action = data.get('action')
    comment = data.get('comment', '')

    if not review_ids or action not in ('approve', 'reject'):
        return jsonify({'success': False, 'error': '参数无效'}), 400

    count = content_review_service.batch_review(review_ids, action, g.user_id, comment)
    return jsonify({'success': True, 'data': {'count': count}})


@content_review_bp.route('/<int:review_id>/assign', methods=['POST'])
@login_required
def assign_reviewer(review_id):
    data = request.get_json() or {}
    reviewer_id = data.get('reviewer_id')

    if not reviewer_id:
        return jsonify({'success': False, 'error': 'reviewer_id 为必填项'}), 400

    review = content_review_service.assign_reviewer(review_id, reviewer_id)
    if not review:
        return jsonify({'success': False, 'error': '审核记录不存在'}), 404
    return jsonify({'success': True, 'data': review.to_dict()})


@content_review_bp.route('/rules', methods=['GET'])
@login_required
def get_review_rules():
    rules = content_review_service.get_review_rules()
    return jsonify({'success': True, 'data': rules})


@content_review_bp.route('/rules/<int:rule_id>', methods=['PUT'])
@login_required
def update_review_rule(rule_id):
    data = request.get_json() or {}
    rule = content_review_service.update_review_rule(rule_id, data)
    if not rule:
        return jsonify({'success': False, 'error': '规则不存在'}), 404
    return jsonify({'success': True, 'data': rule.to_dict()})


@content_review_bp.route('/logs', methods=['GET'])
@login_required
def get_operation_logs():
    filters = {
        'action': request.args.get('action'),
        'review_id': request.args.get('review_id'),
        'page': request.args.get('page', 1),
        'per_page': request.args.get('per_page', 10),
    }
    result = content_review_service.get_operation_logs(filters)
    return jsonify({'success': True, 'data': result})


@content_review_bp.route('/analytics', methods=['GET'])
@login_required
def get_analytics():
    analytics = content_review_service.get_review_analytics()
    return jsonify({'success': True, 'data': analytics})


@content_review_bp.route('/versions/<int:content_id>/<content_type>', methods=['GET'])
@login_required
def get_content_versions(content_id, content_type):
    versions = content_review_service.get_content_versions(content_id, content_type)
    return jsonify({'success': True, 'data': versions})


@content_review_bp.route('/history', methods=['GET'])
@login_required
def get_review_history():
    """获取审核历史记录，支持按审核人、审核状态、时间范围筛选"""
    filters = {
        'reviewer_id': request.args.get('reviewer_id'),
        'status': request.args.get('status'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'content_type': request.args.get('content_type'),
        'page': request.args.get('page', 1),
        'per_page': request.args.get('per_page', 10),
    }
    result = content_review_service.get_review_history(filters)
    return jsonify({'success': True, 'data': result})


@content_review_bp.route('/auto-submit/<int:course_id>', methods=['POST'])
@login_required
def auto_submit_course(course_id):
    count = content_review_service.auto_submit_ai_content(course_id)
    return jsonify({'success': True, 'data': {'submitted_count': count}})
