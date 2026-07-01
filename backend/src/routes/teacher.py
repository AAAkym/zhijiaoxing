from flask import Blueprint, request, jsonify, session
from src.models.user import db, User
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, TeachingContent
from src.models.token_usage import TokenUsage
from sqlalchemy import func, case
from datetime import datetime, timedelta
import logging

from flask import current_app

logger = logging.getLogger(__name__)

teacher_bp = Blueprint('teacher', __name__)


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


def _get_cache():
    try:
        return current_app.extensions.get('cache')
    except Exception:
        return None


def _get_visible_course_ids(user_id):
    if session.get('user_role') == 'admin':
        return [c.id for c in Course.query.all()]
    return [c.id for c in Course.query.filter_by(teacher_id=user_id).all()]


def _empty_progress_distribution():
    distribution = [
        {'name': '优秀', 'value': 0, 'color': '#10B981'},
        {'name': '良好', 'value': 0, 'color': '#3B82F6'},
        {'name': '一般', 'value': 0, 'color': '#F59E0B'},
        {'name': '待提高', 'value': 0, 'color': '#EF4444'},
    ]
    return {'distribution': distribution, 'data': distribution}


@teacher_bp.route('/teacher/dashboard/stats', methods=['GET'])
@require_auth
@require_teacher
def get_dashboard_stats():
    try:
        user_id = session['user_id']
        # 教师概览要求强实时，避免缓存导致前后端显示不同步

        my_courses = Course.query.filter_by(teacher_id=user_id).count()
        total_students = db.session.query(func.count(func.distinct(LearningProgress.user_id))).join(
            Course, LearningProgress.course_id == Course.id
        ).filter(Course.teacher_id == user_id).scalar() or 0
        completed_exams = PracticeEvaluation.query.join(
            Assessment, PracticeEvaluation.assessment_id == Assessment.id
        ).join(Course, Assessment.course_id == Course.id).filter(
            Course.teacher_id == user_id
        ).count()
        ai_generated_teaching_content = TeachingContent.query.filter_by(generated_by_llm=True).join(
            Course, TeachingContent.course_id == Course.id
        ).filter(Course.teacher_id == user_id).count()
        ai_generated_assessments = Assessment.query.filter_by(generated_by_llm=True).join(
            Course, Assessment.course_id == Course.id
        ).filter(Course.teacher_id == user_id).count()
        ai_generated_content = ai_generated_teaching_content + ai_generated_assessments
        result = {
            'stats': {
                'my_courses': my_courses,
                'course_count': my_courses,
                'total_students': total_students,
                'completed_exams': completed_exams,
                'assessment_count': completed_exams,
                'ai_generated_content': ai_generated_content,
                'content_count': ai_generated_content
            }
        }
        return jsonify(result), 200
    except Exception as e:
        logger.error(f'获取教师统计失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@teacher_bp.route('/teacher/analytics/student-progress', methods=['GET'])
@require_auth
@require_teacher
def get_student_progress_distribution():
    try:
        user_id = session['user_id']
        cache = _get_cache()
        cache_key = f'teacher_progress:{user_id}:{session.get("user_role")}'
        if cache:
            cached = cache.get(cache_key)
            if cached:
                return jsonify(cached), 200

        course_ids = _get_visible_course_ids(user_id)
        if not course_ids:
            result = _empty_progress_distribution()
            if cache:
                cache.set(cache_key, result, timeout=120)
            return jsonify(result), 200

        progress_rows = LearningProgress.query.with_entities(
            LearningProgress.progress_percentage
        ).filter(LearningProgress.course_id.in_(course_ids)).all()

        excellent = good = average = need_improve = 0
        for row in progress_rows:
            value = row[0] or 0
            if value >= 80:
                excellent += 1
            elif value >= 60:
                good += 1
            elif value >= 40:
                average += 1
            else:
                need_improve += 1

        distribution = []
        if excellent > 0:
            distribution.append({'name': '??', 'value': excellent, 'color': '#10B981'})
        if good > 0:
            distribution.append({'name': '??', 'value': good, 'color': '#3B82F6'})
        if average > 0:
            distribution.append({'name': '??', 'value': average, 'color': '#F59E0B'})
        if need_improve > 0:
            distribution.append({'name': '???', 'value': need_improve, 'color': '#EF4444'})

        result = {'distribution': distribution, 'data': distribution} if distribution else _empty_progress_distribution()
        if cache:
            cache.set(cache_key, result, timeout=120)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f'??????????: {str(e)}', exc_info=True)
        result = _empty_progress_distribution()
        result['warning'] = '??????????????????'
        return jsonify(result), 200


@teacher_bp.route('/teacher/analytics/weekly-activity', methods=['GET'])
@require_auth
@require_teacher
def get_weekly_activity():
    try:
        user_id = session['user_id']
        course_ids = _get_visible_course_ids(user_id)
        if not course_ids:
            return jsonify({'activity': [], 'data': []}), 200
        day_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        activity_data = []
        today = datetime.utcnow().date()
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            weekday = date.weekday()
            count = LearningProgress.query.filter(
                LearningProgress.course_id.in_(course_ids),
                func.date(LearningProgress.last_accessed) == date
            ).count()
            activity_data.append({'day': day_names[weekday], 'activity': count})
        return jsonify({'activity': activity_data, 'data': activity_data}), 200
    except Exception as e:
        logger.error(f'获取周活动数据失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@teacher_bp.route('/teacher/analytics/learning-trend', methods=['GET'])
@require_auth
@require_teacher
def get_learning_trend():
    try:
        user_id = session['user_id']
        course_ids = _get_visible_course_ids(user_id)
        if not course_ids:
            return jsonify({'trend': [], 'data': []}), 200
        trend_data = []
        today = datetime.utcnow().date()
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            date_str = date.strftime('%m/%d')
            pv = LearningProgress.query.filter(
                LearningProgress.course_id.in_(course_ids),
                func.date(LearningProgress.last_accessed) == date
            ).count()
            uv = db.session.query(func.count(func.distinct(LearningProgress.user_id))).filter(
                LearningProgress.course_id.in_(course_ids),
                func.date(LearningProgress.last_accessed) == date
            ).scalar() or 0
            trend_data.append({'name': date_str, 'pv': pv, 'uv': uv})
        return jsonify({'trend': trend_data, 'data': trend_data}), 200
    except Exception as e:
        logger.error(f'获取学习趋势失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@teacher_bp.route('/teacher/recent-activities', methods=['GET'])
@require_auth
@require_teacher
def get_recent_activities():
    try:
        user_id = session['user_id']
        limit = request.args.get('limit', 10, type=int)
        course_ids = [c.id for c in Course.query.filter_by(teacher_id=user_id).all()]
        activities = []
        recent_progress = LearningProgress.query.filter(
            LearningProgress.course_id.in_(course_ids)
        ).order_by(LearningProgress.last_accessed.desc()).limit(limit).all()
        for p in recent_progress:
            user_name = p.user.real_name or p.user.username if p.user else f'用户{p.user_id}'
            course_title = p.course.title if p.course else '未知课程'
            activities.append({
                'description': f'{user_name} 学习了 {course_title}',
                'title': f'{user_name} 学习了 {course_title}',
                'time': p.last_accessed.isoformat() if p.last_accessed else None,
                'created_at': p.last_accessed.isoformat() if p.last_accessed else None,
                'icon': 'activity',
                'type': 'learning'
            })
        recent_evaluations = PracticeEvaluation.query.join(
            Assessment, PracticeEvaluation.assessment_id == Assessment.id
        ).filter(Assessment.course_id.in_(course_ids)).order_by(
            PracticeEvaluation.created_at.desc()
        ).limit(limit).all()
        for e in recent_evaluations:
            user_name = e.user.real_name or e.user.username if e.user else f'用户{e.user_id}'
            activities.append({
                'description': f'{user_name} 完成了练习评测 (得分: {e.score})',
                'title': f'{user_name} 完成了练习评测',
                'time': e.created_at.isoformat() if e.created_at else None,
                'created_at': e.created_at.isoformat() if e.created_at else None,
                'icon': 'check',
                'type': 'practice'
            })
        recent_content = TeachingContent.query.filter(
            TeachingContent.course_id.in_(course_ids)
        ).order_by(TeachingContent.created_at.desc()).limit(limit).all()
        for c in recent_content:
            activities.append({
                'description': f'生成了教学内容: {c.title}',
                'title': f'生成了教学内容: {c.title}',
                'time': c.created_at.isoformat() if c.created_at else None,
                'created_at': c.created_at.isoformat() if c.created_at else None,
                'icon': 'book',
                'type': 'content'
            })
        activities.sort(key=lambda x: x.get('time') or '', reverse=True)
        activities = activities[:limit]
        return jsonify({'activities': activities, 'data': activities}), 200
    except Exception as e:
        logger.error(f'获取最近活动失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


def _to_date(val):
    if val is None:
        return None
    if isinstance(val, str):
        try:
            return datetime.strptime(val, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            try:
                return datetime.fromisoformat(val).date()
            except (ValueError, TypeError):
                return None
    if hasattr(val, 'strftime'):
        return val
    return None


def _date_to_str(d):
    if d is None:
        return None
    if isinstance(d, str):
        return d
    try:
        return d.isoformat()
    except (AttributeError, TypeError):
        return str(d)


@teacher_bp.route('/teacher/token-usage/summary', methods=['GET'])
@require_auth
@require_teacher
def get_teacher_token_summary():
    try:
        user_id = session['user_id']
        days = request.args.get('days', 30, type=int)
        start_date = datetime.utcnow() - timedelta(days=days)

        records = TokenUsage.query.filter(
            TokenUsage.user_id == user_id,
            TokenUsage.created_at >= start_date
        ).all()

        total_tokens = sum(r.total_tokens or 0 for r in records)
        prompt_tokens = sum(r.prompt_tokens or 0 for r in records)
        completion_tokens = sum(r.completion_tokens or 0 for r in records)
        call_count = len(records)

        by_type = {}
        for r in records:
            ct = r.call_type or 'other'
            if ct not in by_type:
                by_type[ct] = {'tokens': 0, 'calls': 0}
            by_type[ct]['tokens'] += r.total_tokens or 0
            by_type[ct]['calls'] += 1

        return jsonify({
            'summary': {
                'total_tokens': total_tokens,
                'prompt_tokens': prompt_tokens,
                'completion_tokens': completion_tokens,
                'call_count': call_count,
                'avg_per_call': round(total_tokens / call_count, 1) if call_count > 0 else 0,
                'by_type': by_type,
            }
        }), 200
    except Exception as e:
        logger.error(f'获取教师Token统计失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@teacher_bp.route('/teacher/token-usage/trend', methods=['GET'])
@require_auth
@require_teacher
def get_teacher_token_trend():
    try:
        user_id = session['user_id']
        days = request.args.get('days', 30, type=int)
        period = request.args.get('period', 'daily')
        start_date = datetime.utcnow() - timedelta(days=days)

        rows = TokenUsage.query.filter(
            TokenUsage.user_id == user_id,
            TokenUsage.created_at >= start_date
        ).with_entities(
            func.date(TokenUsage.created_at).label('date'),
            func.sum(TokenUsage.total_tokens).label('total'),
            func.sum(TokenUsage.prompt_tokens).label('prompt'),
            func.sum(TokenUsage.completion_tokens).label('completion'),
            func.count(TokenUsage.id).label('count'),
        ).group_by(
            func.date(TokenUsage.created_at),
        ).order_by('date').all()

        if period == 'weekly':
            weekly_data = {}
            for row in rows:
                row_date = _to_date(row.date)
                if row_date is None:
                    continue
                week_start = row_date - timedelta(days=row_date.weekday())
                key = _date_to_str(week_start)
                if key not in weekly_data:
                    weekly_data[key] = {'date': key, 'tokens': 0, 'calls': 0}
                weekly_data[key]['tokens'] += row.total or 0
                weekly_data[key]['calls'] += row.count or 0
            trend = sorted(weekly_data.values(), key=lambda x: x['date'])
        elif period == 'monthly':
            monthly_data = {}
            for row in rows:
                row_date = _to_date(row.date)
                if row_date is None:
                    continue
                key = row_date.strftime('%Y-%m')
                if key not in monthly_data:
                    monthly_data[key] = {'date': key, 'tokens': 0, 'calls': 0}
                monthly_data[key]['tokens'] += row.total or 0
                monthly_data[key]['calls'] += row.count or 0
            trend = sorted(monthly_data.values(), key=lambda x: x['date'])
        else:
            daily_map = {}
            for row in rows:
                row_date = _to_date(row.date)
                if row_date is None:
                    continue
                key = _date_to_str(row_date)
                if key not in daily_map:
                    daily_map[key] = {'date': key, 'tokens': 0, 'calls': 0}
                daily_map[key]['tokens'] += row.total or 0
                daily_map[key]['calls'] += row.count or 0
            trend = sorted(daily_map.values(), key=lambda x: x['date'])

        return jsonify({'trend': trend}), 200
    except Exception as e:
        logger.error(f'获取教师Token趋势失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@teacher_bp.route('/teacher/token-usage/recent', methods=['GET'])
@require_auth
@require_teacher
def get_teacher_token_recent():
    try:
        user_id = session['user_id']
        limit = request.args.get('limit', 20, type=int)
        records = TokenUsage.query.filter(
            TokenUsage.user_id == user_id
        ).order_by(TokenUsage.created_at.desc()).limit(limit).all()

        items = []
        for r in records:
            items.append({
                'id': r.id,
                'call_type': r.call_type,
                'total_tokens': r.total_tokens,
                'prompt_tokens': r.prompt_tokens,
                'completion_tokens': r.completion_tokens,
                'model': r.model,
                'created_at': r.created_at.isoformat() if r.created_at else None,
            })

        return jsonify({'records': items}), 200
    except Exception as e:
        logger.error(f'获取教师Token记录失败: {str(e)}')
        return jsonify({'error': str(e)}), 500
