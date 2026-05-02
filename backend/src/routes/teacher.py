from flask import Blueprint, request, jsonify, session
from src.models.user import db, User
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, TeachingContent
from sqlalchemy import func, case
from datetime import datetime, timedelta
import logging

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


@teacher_bp.route('/teacher/dashboard/stats', methods=['GET'])
@require_auth
@require_teacher
def get_dashboard_stats():
    try:
        user_id = session['user_id']
        my_courses = Course.query.filter_by(teacher_id=user_id).count()
        total_students = db.session.query(func.count(func.distinct(LearningProgress.user_id))).join(
            Course, LearningProgress.course_id == Course.id
        ).filter(Course.teacher_id == user_id).scalar() or 0
        completed_exams = PracticeEvaluation.query.join(
            Assessment, PracticeEvaluation.assessment_id == Assessment.id
        ).join(Course, Assessment.course_id == Course.id).filter(
            Course.teacher_id == user_id
        ).count()
        ai_generated_content = TeachingContent.query.filter_by(generated_by_llm=True).join(
            Course, TeachingContent.course_id == Course.id
        ).filter(Course.teacher_id == user_id).count()
        return jsonify({
            'stats': {
                'my_courses': my_courses,
                'course_count': my_courses,
                'total_students': total_students,
                'completed_exams': completed_exams,
                'assessment_count': completed_exams,
                'ai_generated_content': ai_generated_content,
                'content_count': ai_generated_content
            }
        }), 200
    except Exception as e:
        logger.error(f'获取教师统计失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@teacher_bp.route('/teacher/analytics/student-progress', methods=['GET'])
@require_auth
@require_teacher
def get_student_progress_distribution():
    try:
        user_id = session['user_id']
        course_ids = [c.id for c in Course.query.filter_by(teacher_id=user_id).all()]
        if not course_ids:
            return jsonify({'distribution': []}), 200
        progress_records = LearningProgress.query.filter(
            LearningProgress.course_id.in_(course_ids)
        ).all()
        excellent = sum(1 for p in progress_records if p.progress_percentage >= 80)
        good = sum(1 for p in progress_records if 60 <= p.progress_percentage < 80)
        average = sum(1 for p in progress_records if 40 <= p.progress_percentage < 60)
        need_improve = sum(1 for p in progress_records if p.progress_percentage < 40)
        distribution = []
        if excellent > 0:
            distribution.append({'name': '优秀', 'value': excellent, 'color': '#10B981'})
        if good > 0:
            distribution.append({'name': '良好', 'value': good, 'color': '#3B82F6'})
        if average > 0:
            distribution.append({'name': '一般', 'value': average, 'color': '#F59E0B'})
        if need_improve > 0:
            distribution.append({'name': '待提高', 'value': need_improve, 'color': '#EF4444'})
        if not distribution:
            distribution = [
                {'name': '优秀', 'value': 0, 'color': '#10B981'},
                {'name': '良好', 'value': 0, 'color': '#3B82F6'},
                {'name': '一般', 'value': 0, 'color': '#F59E0B'},
                {'name': '待提高', 'value': 0, 'color': '#EF4444'}
            ]
        return jsonify({'distribution': distribution, 'data': distribution}), 200
    except Exception as e:
        logger.error(f'获取学生进度分布失败: {str(e)}')
        return jsonify({'error': str(e)}), 500


@teacher_bp.route('/teacher/analytics/weekly-activity', methods=['GET'])
@require_auth
@require_teacher
def get_weekly_activity():
    try:
        user_id = session['user_id']
        course_ids = [c.id for c in Course.query.filter_by(teacher_id=user_id).all()]
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
        course_ids = [c.id for c in Course.query.filter_by(teacher_id=user_id).all()]
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
