from flask import Blueprint, request, jsonify, session
from src.models.user import db, User
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, TeachingContent
from sqlalchemy import func
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

analytics_bp = Blueprint('analytics', __name__)


def require_auth(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


def require_admin(f):
    def decorated_function(*args, **kwargs):
        if session.get('user_role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


def _get_time_range_days(time_range):
    mapping = {
        '7days': 7,
        '30days': 30,
        '90days': 90,
        '1year': 365
    }
    return mapping.get(time_range, 7)


@analytics_bp.route('/analytics/user-growth', methods=['GET'])
@require_auth
@require_admin
def get_user_growth():
    try:
        time_range = request.args.get('time_range', '7days')
        days = _get_time_range_days(time_range)
        growth_data = []
        today = datetime.utcnow().date()
        for i in range(days - 1, -1, -1):
            date = today - timedelta(days=i)
            date_str = date.strftime('%Y-%m-%d')
            total_users = User.query.filter(
                func.date(User.created_at) <= date
            ).count()
            total_teachers = User.query.filter(
                User.role == 'teacher',
                func.date(User.created_at) <= date
            ).count()
            total_students = User.query.filter(
                User.role == 'student',
                func.date(User.created_at) <= date
            ).count()
            growth_data.append({
                'date': date_str,
                'users': total_users,
                'teachers': total_teachers,
                'students': total_students
            })
        return jsonify({'growth': growth_data, 'data': growth_data}), 200
    except Exception as e:
        logger.error(f'获取用户增长数据失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/analytics/course-activity', methods=['GET'])
@require_auth
@require_admin
def get_course_activity():
    try:
        course_stats = db.session.query(
            Course.title,
            func.count(func.distinct(LearningProgress.user_id)).label('student_count'),
            func.avg(LearningProgress.progress_percentage).label('avg_progress')
        ).outerjoin(LearningProgress).group_by(Course.id).all()
        data = []
        for stat in course_stats:
            completion = round(stat.avg_progress or 0, 1)
            data.append({
                'course': stat.title,
                'students': stat.student_count,
                'completion': completion
            })
        return jsonify({'courses': data, 'data': data}), 200
    except Exception as e:
        logger.error(f'获取课程活跃度数据失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/analytics/learning-progress', methods=['GET'])
@require_auth
@require_admin
def get_learning_progress():
    try:
        total = LearningProgress.query.count()
        if total == 0:
            return jsonify({
                'distribution': [
                    {'name': '已完成', 'value': 0, 'color': '#10B981'},
                    {'name': '进行中', 'value': 0, 'color': '#3B82F6'},
                    {'name': '未开始', 'value': 0, 'color': '#6B7280'}
                ],
                'data': [
                    {'name': '已完成', 'value': 0, 'color': '#10B981'},
                    {'name': '进行中', 'value': 0, 'color': '#3B82F6'},
                    {'name': '未开始', 'value': 0, 'color': '#6B7280'}
                ]
            }), 200
        completed = LearningProgress.query.filter(
            LearningProgress.progress_percentage >= 100
        ).count()
        in_progress = LearningProgress.query.filter(
            LearningProgress.progress_percentage > 0,
            LearningProgress.progress_percentage < 100
        ).count()
        not_started = LearningProgress.query.filter(
            LearningProgress.progress_percentage == 0
        ).count()
        distribution = [
            {'name': '已完成', 'value': completed, 'color': '#10B981'},
            {'name': '进行中', 'value': in_progress, 'color': '#3B82F6'},
            {'name': '未开始', 'value': not_started, 'color': '#6B7280'}
        ]
        return jsonify({'distribution': distribution, 'data': distribution}), 200
    except Exception as e:
        logger.error(f'获取学习进度分布失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/analytics/daily-activity', methods=['GET'])
@require_auth
@require_admin
def get_daily_activity():
    try:
        time_slots = [
            ('00:00', 0, 6),
            ('06:00', 6, 9),
            ('09:00', 9, 12),
            ('12:00', 12, 15),
            ('15:00', 15, 18),
            ('18:00', 18, 21),
            ('21:00', 21, 23),
            ('23:00', 23, 24)
        ]
        data = []
        for label, start_hour, end_hour in time_slots:
            count = LearningProgress.query.filter(
                func.strftime('%H', LearningProgress.last_accessed) >= f'{start_hour:02d}',
                func.strftime('%H', LearningProgress.last_accessed) < f'{end_hour:02d}'
            ).count()
            data.append({'time': label, 'activity': count})
        return jsonify({'activity': data, 'data': data}), 200
    except Exception as e:
        logger.error(f'获取每日活跃度数据失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/analytics/performance-metrics', methods=['GET'])
@require_auth
@require_admin
def get_performance_metrics():
    try:
        total_users = User.query.count()
        active_courses = Course.query.filter_by(status='active').count()
        avg_progress = db.session.query(
            func.avg(LearningProgress.progress_percentage)
        ).scalar() or 0
        total_practices = PracticeEvaluation.query.count()
        total_learning_records = LearningProgress.query.count()
        avg_hours = round(total_practices * 0.5, 1) if total_practices > 0 else 0
        prev_users = 0
        prev_courses = 0
        prev_progress = 0
        prev_hours = 0
        week_ago = datetime.utcnow() - timedelta(days=7)
        two_weeks_ago = datetime.utcnow() - timedelta(days=14)
        this_week_users = User.query.filter(User.created_at >= week_ago).count()
        prev_week_users = User.query.filter(
            User.created_at >= two_weeks_ago,
            User.created_at < week_ago
        ).count()
        user_change_pct = f'+{round((this_week_users / prev_week_users - 1) * 100, 1)}%' if prev_week_users > 0 else f'+{this_week_users} 新增'
        metrics = [
            {
                'title': '总用户数',
                'value': str(total_users),
                'change': user_change_pct,
                'trend': 'up' if this_week_users >= prev_week_users else 'down',
                'icon': 'Users',
                'color': 'text-blue-600'
            },
            {
                'title': '活跃课程',
                'value': str(active_courses),
                'change': f'+{Course.query.filter(Course.created_at >= week_ago).count()} 本周新增',
                'trend': 'up',
                'icon': 'BookOpen',
                'color': 'text-green-600'
            },
            {
                'title': '完成率',
                'value': f'{round(avg_progress, 1)}%',
                'change': f'共{total_learning_records}条学习记录',
                'trend': 'up' if avg_progress > 50 else 'down',
                'icon': 'Target',
                'color': 'text-purple-600'
            },
            {
                'title': '平均学习时长',
                'value': f'{avg_hours}h',
                'change': f'共{total_practices}次练习',
                'trend': 'up' if total_practices > 0 else 'down',
                'icon': 'Clock',
                'color': 'text-orange-600'
            }
        ]
        return jsonify({'metrics': metrics, 'data': metrics}), 200
    except Exception as e:
        logger.error(f'获取性能指标失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@analytics_bp.route('/analytics/system-usage', methods=['GET'])
@require_auth
@require_admin
def get_system_usage():
    try:
        today = datetime.utcnow().date()
        today_new_users = User.query.filter(
            func.date(User.created_at) == today
        ).count()
        today_course_completions = LearningProgress.query.filter(
            LearningProgress.progress_percentage >= 100,
            func.date(LearningProgress.last_accessed) == today
        ).count()
        today_ai_queries = PracticeEvaluation.query.filter(
            func.date(PracticeEvaluation.created_at) == today
        ).count()
        today_practice_submissions = PracticeEvaluation.query.filter(
            func.date(PracticeEvaluation.created_at) == today
        ).count()
        usage = {
            'today_new_users': today_new_users,
            'today_course_completions': today_course_completions,
            'today_ai_queries': today_ai_queries,
            'today_practice_submissions': today_practice_submissions
        }
        return jsonify({'usage': usage, 'data': usage}), 200
    except Exception as e:
        logger.error(f'获取系统使用统计失败: {str(e)}')
        return jsonify({'error': str(e)}), 500
