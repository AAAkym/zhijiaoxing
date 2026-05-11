from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
from src.models.user import User, db
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, TeachingContent
from sqlalchemy import func
from datetime import datetime, timedelta

admin_bp = Blueprint('admin', __name__)


def require_admin(f):
    """管理员权限装饰器"""
    def decorated_function(*args, **kwargs):
        if session.get('user_role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@admin_bp.route('/users', methods=['GET'])
@require_auth
@require_admin
def get_users():
    """获取用户列表"""
    try:
        # 获取查询参数
        role = request.args.get('role')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = User.query
        
        if role:
            query = query.filter_by(role=role)
        
        users = query.paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'users': [user.to_dict() for user in users.items],
            'total': users.total,
            'pages': users.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users', methods=['POST'])
@require_auth
@require_admin
def create_user():
    """创建用户"""
    try:
        data = request.get_json()
        
        # 验证必填字段
        required_fields = ['username', 'email', 'password', 'role']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        # 检查用户名是否已存在
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        # 检查邮箱是否已存在
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # 验证角色
        if data['role'] not in ['admin', 'teacher', 'student']:
            return jsonify({'error': 'Invalid role'}), 400
        
        # 创建新用户
        user = User(
            username=data['username'],
            email=data['email'],
            role=data['role'],
            real_name=data.get('real_name', '')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@require_auth
@require_admin
def update_user(user_id):
    """更新用户"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # 更新字段
        if 'username' in data:
            # 检查用户名是否已被其他用户使用
            existing_user = User.query.filter_by(username=data['username']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Username already exists'}), 400
            user.username = data['username']
        
        if 'email' in data:
            # 检查邮箱是否已被其他用户使用
            existing_user = User.query.filter_by(email=data['email']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email already exists'}), 400
            user.email = data['email']
        
        if 'role' in data:
            if data['role'] not in ['admin', 'teacher', 'student']:
                return jsonify({'error': 'Invalid role'}), 400
            user.role = data['role']
        
        if 'real_name' in data:
            user.real_name = data['real_name']
        
        if 'password' in data:
            user.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@require_auth
@require_admin
def delete_user(user_id):
    """删除用户"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # 不能删除自己
        if user_id == session['user_id']:
            return jsonify({'error': 'Cannot delete yourself'}), 400
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/dashboard/stats', methods=['GET'])
@require_auth
@require_admin
def get_dashboard_stats():
    """获取仪表板统计数据"""
    try:
        # 基础统计
        total_users = User.query.count()
        total_teachers = User.query.filter_by(role='teacher').count()
        total_students = User.query.filter_by(role='student').count()
        total_courses = Course.query.count()
        total_assessments = Assessment.query.count()
        
        # 今日活跃用户（简化版，基于学习进度更新时间）
        today = datetime.utcnow().date()
        today_active = LearningProgress.query.filter(
            func.date(LearningProgress.last_accessed) == today
        ).count()
        
        # 本周活跃用户
        week_ago = datetime.utcnow() - timedelta(days=7)
        week_active = LearningProgress.query.filter(
            LearningProgress.last_accessed >= week_ago
        ).count()
        
        # 平均学习进度
        avg_progress = db.session.query(
            func.avg(LearningProgress.progress_percentage)
        ).scalar() or 0
        
        # 练习完成统计
        total_practices = PracticeEvaluation.query.count()
        avg_score = db.session.query(
            func.avg(PracticeEvaluation.score)
        ).scalar() or 0

        pending_review_count = TeachingContent.query.filter_by(generated_by_llm=True).count()
        
        return jsonify({
            'stats': {
                'total_users': total_users,
                'total_teachers': total_teachers,
                'total_students': total_students,
                'total_courses': total_courses,
                'total_assessments': total_assessments,
                'today_active_users': today_active,
                'week_active_users': week_active,
                'avg_learning_progress': round(avg_progress, 2),
                'total_practices': total_practices,
                'avg_practice_score': round(avg_score, 2),
                'pending_review_count': pending_review_count
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/dashboard/user_activity', methods=['GET'])
@require_auth
@require_admin
def get_user_activity():
    """获取用户活动数据"""
    try:
        # 获取最近7天的用户活动
        days = []
        activity_data = []
        
        for i in range(7):
            date = datetime.utcnow().date() - timedelta(days=i)
            days.append(date.strftime('%Y-%m-%d'))
            
            # 统计当天活跃用户数
            active_count = LearningProgress.query.filter(
                func.date(LearningProgress.last_accessed) == date
            ).count()
            activity_data.append(active_count)
        
        # 反转数组，使最早的日期在前
        days.reverse()
        activity_data.reverse()
        
        return jsonify({
            'user_activity': {
                'dates': days,
                'active_users': activity_data
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/dashboard/course_stats', methods=['GET'])
@require_auth
@require_admin
def get_course_stats():
    """获取课程统计数据"""
    try:
        # 获取每个课程的学生数量
        course_stats = db.session.query(
            Course.title,
            func.count(LearningProgress.user_id).label('student_count'),
            func.avg(LearningProgress.progress_percentage).label('avg_progress')
        ).outerjoin(LearningProgress).group_by(Course.id).all()
        
        courses = []
        student_counts = []
        avg_progress = []
        
        for stat in course_stats:
            courses.append(stat.title)
            student_counts.append(stat.student_count)
            avg_progress.append(round(stat.avg_progress or 0, 2))
        
        return jsonify({
            'course_stats': {
                'courses': courses,
                'student_counts': student_counts,
                'avg_progress': avg_progress
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

