from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
from src.models.user import User, db
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, TeachingContent
from src.models.token_usage import TokenUsage
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


@admin_bp.route('/token-usage/summary', methods=['GET'])
@require_auth
@require_admin
def get_token_usage_summary():
    try:
        role = request.args.get('role')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        query = TokenUsage.query

        if role and role in ('teacher', 'student'):
            query = query.filter(TokenUsage.user_role == role)

        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d')
                query = query.filter(TokenUsage.created_at >= sd)
            except ValueError:
                pass

        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(TokenUsage.created_at < ed)
            except ValueError:
                pass

        total_tokens = query.with_entities(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).scalar()
        total_prompt = query.with_entities(func.coalesce(func.sum(TokenUsage.prompt_tokens), 0)).scalar()
        total_completion = query.with_entities(func.coalesce(func.sum(TokenUsage.completion_tokens), 0)).scalar()
        call_count = query.count()

        teacher_query = query.filter(TokenUsage.user_role == 'teacher') if not role or role == 'teacher' else query.filter(TokenUsage.user_role == 'teacher')
        student_query = query.filter(TokenUsage.user_role == 'student') if not role or role == 'student' else query.filter(TokenUsage.user_role == 'student')

        teacher_tokens = db.session.query(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).filter(
            TokenUsage.user_role == 'teacher'
        )
        student_tokens = db.session.query(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).filter(
            TokenUsage.user_role == 'student'
        )

        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d')
                teacher_tokens = teacher_tokens.filter(TokenUsage.created_at >= sd)
                student_tokens = student_tokens.filter(TokenUsage.created_at >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                teacher_tokens = teacher_tokens.filter(TokenUsage.created_at < ed)
                student_tokens = student_tokens.filter(TokenUsage.created_at < ed)
            except ValueError:
                pass

        if role and role not in ('teacher', 'student'):
            pass
        elif role == 'teacher':
            t_tokens = teacher_tokens.scalar()
            s_tokens = 0
        elif role == 'student':
            t_tokens = 0
            s_tokens = student_tokens.scalar()
        else:
            t_tokens = teacher_tokens.scalar()
            s_tokens = student_tokens.scalar()

        avg_per_call = round(total_tokens / call_count, 2) if call_count > 0 else 0

        return jsonify({
            'summary': {
                'total_tokens': total_tokens,
                'total_prompt_tokens': total_prompt,
                'total_completion_tokens': total_completion,
                'call_count': call_count,
                'avg_tokens_per_call': avg_per_call,
                'teacher_tokens': t_tokens,
                'student_tokens': s_tokens,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/token-usage/trend', methods=['GET'])
@require_auth
@require_admin
def get_token_usage_trend():
    try:
        role = request.args.get('role')
        period = request.args.get('period', 'daily')
        days = request.args.get('days', 30, type=int)

        start_date = datetime.utcnow() - timedelta(days=days)

        query = TokenUsage.query.filter(TokenUsage.created_at >= start_date)
        if role and role in ('teacher', 'student'):
            query = query.filter(TokenUsage.user_role == role)

        rows = query.with_entities(
            func.date(TokenUsage.created_at).label('date'),
            TokenUsage.user_role,
            func.sum(TokenUsage.total_tokens).label('total'),
            func.sum(TokenUsage.prompt_tokens).label('prompt'),
            func.sum(TokenUsage.completion_tokens).label('completion'),
            func.count(TokenUsage.id).label('count'),
        ).group_by(
            func.date(TokenUsage.created_at),
            TokenUsage.user_role,
        ).order_by('date').all()

        def to_date(val):
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

        def date_to_str(d):
            if d is None:
                return None
            if isinstance(d, str):
                return d
            try:
                return d.isoformat()
            except (AttributeError, TypeError):
                return str(d)

        if period == 'weekly':
            weekly_data = {}
            for row in rows:
                row_date = to_date(row.date)
                if row_date is None:
                    continue
                week_start = row_date - timedelta(days=row_date.weekday())
                key = date_to_str(week_start)
                if key not in weekly_data:
                    weekly_data[key] = {
                        'date': key,
                        'teacher_tokens': 0,
                        'student_tokens': 0,
                        'teacher_calls': 0,
                        'student_calls': 0,
                        'total_tokens': 0,
                    }
                role_key = f"{row.user_role}_tokens" if row.user_role in ('teacher', 'student') else None
                call_key = f"{row.user_role}_calls" if row.user_role in ('teacher', 'student') else None
                if role_key:
                    weekly_data[key][role_key] = (weekly_data[key].get(role_key) or 0) + (row.total or 0)
                if call_key:
                    weekly_data[key][call_key] = (weekly_data[key].get(call_key) or 0) + (row.count or 0)
                weekly_data[key]['total_tokens'] += row.total or 0

            trend = sorted(weekly_data.values(), key=lambda x: x['date'])
        elif period == 'monthly':
            monthly_data = {}
            for row in rows:
                row_date = to_date(row.date)
                if row_date is None:
                    continue
                key = row_date.strftime('%Y-%m')
                if key not in monthly_data:
                    monthly_data[key] = {
                        'date': key,
                        'teacher_tokens': 0,
                        'student_tokens': 0,
                        'teacher_calls': 0,
                        'student_calls': 0,
                        'total_tokens': 0,
                    }
                role_key = f"{row.user_role}_tokens" if row.user_role in ('teacher', 'student') else None
                call_key = f"{row.user_role}_calls" if row.user_role in ('teacher', 'student') else None
                if role_key:
                    monthly_data[key][role_key] = (monthly_data[key].get(role_key) or 0) + (row.total or 0)
                if call_key:
                    monthly_data[key][call_key] = (monthly_data[key].get(call_key) or 0) + (row.count or 0)
                monthly_data[key]['total_tokens'] += row.total or 0

            trend = sorted(monthly_data.values(), key=lambda x: x['date'])
        else:
            daily_map = {}
            for row in rows:
                row_date = to_date(row.date)
                if row_date is None:
                    continue
                key = date_to_str(row_date)
                if key not in daily_map:
                    daily_map[key] = {
                        'date': key,
                        'teacher_tokens': 0,
                        'student_tokens': 0,
                        'teacher_calls': 0,
                        'student_calls': 0,
                        'total_tokens': 0,
                    }
                role_key = f"{row.user_role}_tokens" if row.user_role in ('teacher', 'student') else None
                call_key = f"{row.user_role}_calls" if row.user_role in ('teacher', 'student') else None
                if role_key:
                    daily_map[key][role_key] = (daily_map[key].get(role_key) or 0) + (row.total or 0)
                if call_key:
                    daily_map[key][call_key] = (daily_map[key].get(call_key) or 0) + (row.count or 0)
                daily_map[key]['total_tokens'] += row.total or 0

            trend = sorted(daily_map.values(), key=lambda x: x['date'])

        return jsonify({'trend': trend}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/token-usage/records', methods=['GET'])
@require_auth
@require_admin
def get_token_usage_records():
    try:
        role = request.args.get('role')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        call_type = request.args.get('call_type')

        query = TokenUsage.query

        if role and role in ('teacher', 'student'):
            query = query.filter(TokenUsage.user_role == role)
        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d')
                query = query.filter(TokenUsage.created_at >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(TokenUsage.created_at < ed)
            except ValueError:
                pass
        if call_type:
            query = query.filter(TokenUsage.call_type == call_type)

        query = query.order_by(TokenUsage.created_at.desc())
        records = query.paginate(page=page, per_page=per_page, error_out=False)

        result_items = []
        for record in records.items:
            d = record.to_dict()
            if record.user_id:
                user = User.query.get(record.user_id)
                d['username'] = user.username if user else None
                d['real_name'] = user.real_name if user else None
            else:
                d['username'] = None
                d['real_name'] = None
            result_items.append(d)

        return jsonify({
            'records': result_items,
            'total': records.total,
            'pages': records.pages,
            'current_page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/token-usage/user-ranking', methods=['GET'])
@require_auth
@require_admin
def get_token_usage_user_ranking():
    try:
        role = request.args.get('role')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        limit = request.args.get('limit', 10, type=int)

        query = db.session.query(
            TokenUsage.user_id,
            TokenUsage.user_role,
            func.sum(TokenUsage.total_tokens).label('total_tokens'),
            func.sum(TokenUsage.prompt_tokens).label('prompt_tokens'),
            func.sum(TokenUsage.completion_tokens).label('completion_tokens'),
            func.count(TokenUsage.id).label('call_count'),
        ).filter(TokenUsage.user_id.isnot(None)).group_by(
            TokenUsage.user_id, TokenUsage.user_role
        )

        if role and role in ('teacher', 'student'):
            query = query.filter(TokenUsage.user_role == role)
        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d')
                query = query.filter(TokenUsage.created_at >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(TokenUsage.created_at < ed)
            except ValueError:
                pass

        query = query.order_by(func.sum(TokenUsage.total_tokens).desc()).limit(limit)
        rows = query.all()

        ranking = []
        for row in rows:
            user = User.query.get(row.user_id)
            ranking.append({
                'user_id': row.user_id,
                'username': user.username if user else None,
                'real_name': user.real_name if user else None,
                'user_role': row.user_role,
                'total_tokens': row.total_tokens,
                'prompt_tokens': row.prompt_tokens,
                'completion_tokens': row.completion_tokens,
                'call_count': row.call_count,
                'avg_tokens_per_call': round(row.total_tokens / row.call_count, 2) if row.call_count > 0 else 0,
            })

        return jsonify({'ranking': ranking}), 200
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

