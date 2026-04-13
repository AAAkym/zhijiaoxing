"""
搜索API路由

提供RESTful风格的搜索接口
支持GET/POST请求、模糊搜索、自动补全、智能推荐
"""
import time
from flask import Blueprint, request, jsonify, g
from functools import wraps

from src.services.search_service import search_service
from src.services.search_recommendation import search_recommendation_service
from src.utils.cache_utils import cached

search_bp = Blueprint('search', __name__, url_prefix='/api/search')


def get_current_user_id():
    """获取当前用户ID"""
    return getattr(g, 'user_id', None)


def get_client_ip():
    """获取客户端IP"""
    if request.headers.get('X-Forwarded-For'):
        return request.headers.get('X-Forwarded-For').split(',')[0].strip()
    return request.remote_addr


@search_bp.route('', methods=['GET', 'POST'])
def search():
    """
    全局搜索接口
    
    GET /api/search?q=关键词&type=all&page=1&per_page=20
    POST /api/search
    Body: {
        "query": "关键词",
        "indices": ["courses", "knowledge"],
        "filters": {"category": "编程"},
        "page": 1,
        "per_page": 20,
        "highlight": true,
        "fuzzy": true
    }
    
    Returns:
        {
            "results": [...],
            "total": 100,
            "page": 1,
            "per_page": 20,
            "total_pages": 5,
            "response_time_ms": 50,
            "query": "关键词"
        }
    """
    start_time = time.time()
    
    if request.method == 'GET':
        query = request.args.get('q', '').strip()
        indices_str = request.args.get('type', 'all')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        highlight = request.args.get('highlight', 'true').lower() == 'true'
        fuzzy = request.args.get('fuzzy', 'true').lower() == 'true'
        
        filters = {}
        for key in ['category', 'difficulty', 'status', 'language']:
            value = request.args.get(key)
            if value:
                filters[key] = value
        
        min_rating = request.args.get('min_rating')
        if min_rating:
            try:
                filters['rating'] = {'gte': float(min_rating)}
            except ValueError:
                pass
        
        if indices_str == 'all':
            indices = None
        else:
            indices = [idx.strip() for idx in indices_str.split(',') if idx.strip()]
    
    else:
        data = request.get_json() or {}
        query = data.get('query', '').strip()
        indices = data.get('indices')
        filters = data.get('filters', {})
        page = data.get('page', 1)
        per_page = data.get('per_page', 20)
        highlight = data.get('highlight', True)
        fuzzy = data.get('fuzzy', True)
    
    if not query:
        return jsonify({
            'error': '搜索关键词不能为空',
            'results': [],
            'total': 0
        }), 400
    
    result = search_service.search(
        query=query,
        indices=indices,
        filters=filters,
        page=page,
        per_page=per_page,
        highlight=highlight,
        fuzzy=fuzzy
    )
    
    response_time_ms = int((time.time() - start_time) * 1000)
    
    search_recommendation_service.record_search(
        query=query,
        user_id=get_current_user_id(),
        index_type=','.join(indices) if indices else 'all',
        results_count=result.get('total', 0),
        response_time_ms=response_time_ms,
        filters=filters,
        ip_address=get_client_ip(),
        user_agent=request.headers.get('User-Agent', '')
    )
    
    return jsonify(result)


@search_bp.route('/courses', methods=['GET'])
def search_courses():
    """
    课程搜索接口
    
    GET /api/search/courses?q=关键词&category=编程&difficulty=初级&min_rating=4.0&page=1&per_page=20
    
    Returns:
        课程搜索结果
    """
    query = request.args.get('q', '').strip()
    category = request.args.get('category')
    difficulty = request.args.get('difficulty')
    min_rating = request.args.get('min_rating')
    is_free = request.args.get('is_free')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    if not query:
        return jsonify({
            'error': '搜索关键词不能为空',
            'results': [],
            'total': 0
        }), 400
    
    min_rating_float = None
    if min_rating:
        try:
            min_rating_float = float(min_rating)
        except ValueError:
            pass
    
    is_free_bool = None
    if is_free:
        is_free_bool = is_free.lower() == 'true'
    
    result = search_service.search_courses(
        query=query,
        category=category,
        difficulty=difficulty,
        min_rating=min_rating_float,
        is_free=is_free_bool,
        page=page,
        per_page=per_page
    )
    
    return jsonify(result)


@search_bp.route('/knowledge', methods=['GET'])
def search_knowledge():
    """
    知识库搜索接口
    
    GET /api/search/knowledge?q=关键词&category=前端&page=1&per_page=20
    
    Returns:
        知识库搜索结果
    """
    query = request.args.get('q', '').strip()
    category = request.args.get('category')
    knowledge_type = request.args.get('knowledge_type')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    if not query:
        return jsonify({
            'error': '搜索关键词不能为空',
            'results': [],
            'total': 0
        }), 400
    
    result = search_service.search_knowledge(
        query=query,
        category=category,
        knowledge_type=knowledge_type,
        page=page,
        per_page=per_page
    )
    
    return jsonify(result)


@search_bp.route('/contents', methods=['GET'])
def search_contents():
    """
    课程内容搜索接口
    
    GET /api/search/contents?q=关键词&course_id=xxx&page=1&per_page=20
    
    Returns:
        内容搜索结果
    """
    query = request.args.get('q', '').strip()
    course_id = request.args.get('course_id')
    content_type = request.args.get('content_type')
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    if not query:
        return jsonify({
            'error': '搜索关键词不能为空',
            'results': [],
            'total': 0
        }), 400
    
    result = search_service.search_contents(
        query=query,
        course_id=course_id,
        content_type=content_type,
        page=page,
        per_page=per_page
    )
    
    return jsonify(result)


@search_bp.route('/advanced', methods=['POST'])
def advanced_search():
    """
    高级搜索接口
    
    POST /api/search/advanced
    Body: {
        "query": "关键词",
        "must_have": ["必须包含的词"],
        "must_not_have": ["必须不包含的词"],
        "exact_phrase": "精确短语",
        "date_range": {"from": "2024-01-01", "to": "2024-12-31"},
        "indices": ["courses"],
        "page": 1,
        "per_page": 20
    }
    
    Returns:
        高级搜索结果
    """
    data = request.get_json() or {}
    
    query = data.get('query', '').strip()
    must_have = data.get('must_have', [])
    must_not_have = data.get('must_not_have', [])
    exact_phrase = data.get('exact_phrase')
    date_range = data.get('date_range')
    indices = data.get('indices')
    page = data.get('page', 1)
    per_page = data.get('per_page', 20)
    
    result = search_service.advanced_search(
        query=query,
        must_have=must_have,
        must_not_have=must_not_have,
        exact_phrase=exact_phrase,
        date_range=date_range,
        indices=indices,
        page=page,
        per_page=per_page
    )
    
    return jsonify(result)


@search_bp.route('/autocomplete', methods=['GET'])
def autocomplete():
    """
    自动补全接口
    
    GET /api/search/autocomplete?prefix=关键词&size=10
    
    Returns:
        {
            "suggestions": [
                {"text": "Python入门教程", "type": "courses", "score": 10.5},
                ...
            ]
        }
    """
    prefix = request.args.get('prefix', '').strip()
    index = request.args.get('index')
    size = int(request.args.get('size', 10))
    
    if not prefix or len(prefix) < 1:
        return jsonify({'suggestions': []})
    
    suggestions = search_service.autocomplete(
        prefix=prefix,
        index=index,
        size=size
    )
    
    return jsonify({'suggestions': suggestions})


@search_bp.route('/suggestions', methods=['GET'])
def get_suggestions():
    """
    获取热门搜索建议
    
    GET /api/search/suggestions?size=10
    
    Returns:
        {
            "suggestions": [
                {"keyword": "Python", "count": 1000, "is_trending": true},
                ...
            ]
        }
    """
    size = int(request.args.get('size', 10))
    
    suggestions = search_service.get_search_suggestions(size=size)
    
    return jsonify({'suggestions': suggestions})


@search_bp.route('/recommendations', methods=['GET'])
def get_recommendations():
    """
    获取个性化推荐
    
    GET /api/search/recommendations?size=10
    
    Returns:
        {
            "recommendations": [
                {"keyword": "React教程", "count": 500, "source": "similar_users"},
                ...
            ]
        }
    """
    size = int(request.args.get('size', 10))
    user_id = get_current_user_id()
    
    recommendations = search_recommendation_service.get_user_recommendations(
        user_id=user_id,
        limit=size
    )
    
    return jsonify({'recommendations': recommendations})


@search_bp.route('/related', methods=['GET'])
def get_related():
    """
    获取相关搜索
    
    GET /api/search/related?q=关键词&size=10
    
    Returns:
        {
            "related": ["相关搜索词1", "相关搜索词2", ...]
        }
    """
    query = request.args.get('q', '').strip()
    size = int(request.args.get('size', 10))
    
    if not query:
        return jsonify({'related': []})
    
    related = search_recommendation_service.get_related_searches(
        query=query,
        limit=size
    )
    
    return jsonify({'related': related})


@search_bp.route('/click', methods=['POST'])
def record_click():
    """
    记录搜索结果点击
    
    POST /api/search/click
    Body: {
        "query": "搜索词",
        "result_id": "点击结果ID",
        "result_type": "courses"
    }
    
    Returns:
        {"success": true}
    """
    data = request.get_json() or {}
    
    query = data.get('query', '').strip()
    result_id = data.get('result_id')
    result_type = data.get('result_type')
    
    if not all([query, result_id, result_type]):
        return jsonify({'error': '参数不完整'}), 400
    
    success = search_recommendation_service.record_click(
        query=query,
        result_id=result_id,
        result_type=result_type,
        user_id=get_current_user_id()
    )
    
    return jsonify({'success': success})


@search_bp.route('/analytics', methods=['GET'])
def get_analytics():
    """
    获取搜索分析数据
    
    GET /api/search/analytics?days=7
    
    Returns:
        {
            "period_days": 7,
            "total_searches": 10000,
            "unique_queries": 5000,
            "avg_response_time_ms": 45.5,
            "avg_results_count": 25.3,
            "zero_result_rate": 5.2,
            "top_queries": [...],
            "daily_stats": [...]
        }
    """
    days = int(request.args.get('days', 7))
    
    analytics = search_recommendation_service.get_search_analytics(days=days)
    
    return jsonify(analytics)


@search_bp.route('/history', methods=['GET'])
def get_history():
    """
    获取用户搜索历史
    
    GET /api/search/history?size=20
    
    Returns:
        {
            "history": [
                {"query": "Python", "search_count": 5, "last_searched_at": "..."},
                ...
            ]
        }
    """
    from src.models.search_log import UserSearchHistory
    
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': '未登录', 'history': []}), 401
    
    size = int(request.args.get('size', 20))
    
    try:
        history = UserSearchHistory.query.filter_by(
            user_id=user_id
        ).order_by(
            UserSearchHistory.last_searched_at.desc()
        ).limit(size).all()
        
        return jsonify({
            'history': [h.to_dict() for h in history]
        })
    except Exception as e:
        return jsonify({'error': str(e), 'history': []}), 500


@search_bp.route('/history/clear', methods=['POST'])
def clear_history():
    """
    清除用户搜索历史
    
    POST /api/search/history/clear
    
    Returns:
        {"success": true}
    """
    from src.models.search_log import UserSearchHistory
    
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({'error': '未登录'}), 401
    
    try:
        UserSearchHistory.query.filter_by(user_id=user_id).delete()
        from src.models.user import db
        db.session.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
