from flask import Blueprint, request, jsonify, session, current_app
from src.utils.auth import require_auth
from src.models.user import User, db
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, TeachingContent
from src.models.token_usage import TokenUsage
from src.models.agent_execution_log import AgentExecutionLog
from sqlalchemy import func, case
from datetime import datetime, timedelta
from src.models.system_settings import SystemSetting
import json
import logging
import requests as http_requests

admin_bp = Blueprint('admin', __name__)
logger = logging.getLogger(__name__)


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
            query = query.filter(
                TokenUsage.user_id.in_(
                    db.session.query(User.id).filter(User.role == role)
                )
            )

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

        # 通过User表获取教师和学生ID集合
        teacher_ids = [u.id for u in User.query.filter_by(role='teacher').all()]
        student_ids = [u.id for u in User.query.filter_by(role='student').all()]

        base_query = TokenUsage.query
        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d')
                base_query = base_query.filter(TokenUsage.created_at >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                base_query = base_query.filter(TokenUsage.created_at < ed)
            except ValueError:
                pass

        t_tokens = db.session.query(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).filter(
            TokenUsage.user_id.in_(teacher_ids)
        ) if teacher_ids else 0
        s_tokens = db.session.query(func.coalesce(func.sum(TokenUsage.total_tokens), 0)).filter(
            TokenUsage.user_id.in_(student_ids)
        ) if student_ids else 0

        if start_date:
            try:
                sd = datetime.strptime(start_date, '%Y-%m-%d')
                t_tokens = t_tokens.filter(TokenUsage.created_at >= sd) if not isinstance(t_tokens, int) else t_tokens
                s_tokens = s_tokens.filter(TokenUsage.created_at >= sd) if not isinstance(s_tokens, int) else s_tokens
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                t_tokens = t_tokens.filter(TokenUsage.created_at < ed) if not isinstance(t_tokens, int) else t_tokens
                s_tokens = s_tokens.filter(TokenUsage.created_at < ed) if not isinstance(s_tokens, int) else s_tokens
            except ValueError:
                pass

        if role == 'teacher':
            t_tokens_val = t_tokens.scalar() if not isinstance(t_tokens, int) else 0
            s_tokens_val = 0
        elif role == 'student':
            t_tokens_val = 0
            s_tokens_val = s_tokens.scalar() if not isinstance(s_tokens, int) else 0
        else:
            t_tokens_val = t_tokens.scalar() if not isinstance(t_tokens, int) else 0
            s_tokens_val = s_tokens.scalar() if not isinstance(s_tokens, int) else 0

        avg_per_call = round(total_tokens / call_count, 2) if call_count > 0 else 0

        return jsonify({
            'summary': {
                'total_tokens': total_tokens,
                'total_prompt_tokens': total_prompt,
                'total_completion_tokens': total_completion,
                'call_count': call_count,
                'avg_tokens_per_call': avg_per_call,
                'teacher_tokens': t_tokens_val,
                'student_tokens': s_tokens_val,
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
            query = query.filter(
                TokenUsage.user_id.in_(
                    db.session.query(User.id).filter(User.role == role)
                )
            )

        # 需要通过JOIN User表获取真实角色
        query_with_user = query.join(User, TokenUsage.user_id == User.id)

        rows = query_with_user.with_entities(
            func.date(TokenUsage.created_at).label('date'),
            User.role.label('user_role'),
            func.sum(TokenUsage.total_tokens).label('total'),
            func.sum(TokenUsage.prompt_tokens).label('prompt'),
            func.sum(TokenUsage.completion_tokens).label('completion'),
            func.count(TokenUsage.id).label('count'),
        ).group_by(
            func.date(TokenUsage.created_at),
            User.role,
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

        def aggregate_rows(rows, get_key, period_label=None):
            data = {}
            for row in rows:
                row_date = to_date(row.date)
                if row_date is None:
                    continue
                key = get_key(row_date)
                if key not in data:
                    data[key] = {
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
                    data[key][role_key] = (data[key].get(role_key) or 0) + (row.total or 0)
                if call_key:
                    data[key][call_key] = (data[key].get(call_key) or 0) + (row.count or 0)
                data[key]['total_tokens'] += row.total or 0
            return sorted(data.values(), key=lambda x: x['date'])

        if period == 'weekly':
            trend = aggregate_rows(rows, lambda d: date_to_str(d - timedelta(days=d.weekday())))
        elif period == 'monthly':
            trend = aggregate_rows(rows, lambda d: d.strftime('%Y-%m'))
        else:
            trend = aggregate_rows(rows, lambda d: date_to_str(d))

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
            # 通过User表筛选角色，确保角色一致性
            query = query.filter(
                TokenUsage.user_id.in_(
                    db.session.query(User.id).filter(User.role == role)
                )
            )
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
                if user:
                    d['username'] = user.username
                    d['real_name'] = user.real_name
                    # 始终使用User表的真实角色，覆盖token_usage中可能不一致的记录
                    d['user_role'] = user.role
                else:
                    d['username'] = None
                    d['real_name'] = None
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

        # 只按user_id分组，从User表获取真实角色
        query = db.session.query(
            TokenUsage.user_id,
            func.sum(TokenUsage.total_tokens).label('total_tokens'),
            func.sum(TokenUsage.prompt_tokens).label('prompt_tokens'),
            func.sum(TokenUsage.completion_tokens).label('completion_tokens'),
            func.count(TokenUsage.id).label('call_count'),
        ).filter(TokenUsage.user_id.isnot(None)).group_by(
            TokenUsage.user_id
        )

        # 如果需要按角色筛选，通过子查询关联User表
        if role and role in ('teacher', 'student'):
            query = query.filter(
                TokenUsage.user_id.in_(
                    db.session.query(User.id).filter(User.role == role)
                )
            )

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
            if user:
                # 始终从User表获取真实角色，避免身份不一致
                user_role = user.role
                ranking.append({
                    'user_id': row.user_id,
                    'username': user.username,
                    'real_name': user.real_name,
                    'user_role': user_role,
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


# ============================================
# 系统设置接口
# ============================================

# 默认设置定义
DEFAULT_SETTINGS = {
    # 基本设置
    'site_name': ('智教星', 'general', '网站名称'),
    'site_description': ('智教星 - 智能教学系统', 'general', '网站描述'),
    'admin_email': ('admin@zhijiaoxing.com', 'general', '管理员邮箱'),
    'timezone': ('Asia/Shanghai', 'general', '时区'),
    'language': ('zh-CN', 'general', '默认语言'),
    # 功能设置
    'allow_registration': ('true', 'features', '允许用户注册'),
    'require_email_verification': ('false', 'features', '邮箱验证'),
    'enable_ai_assistant': ('true', 'features', 'AI助手功能'),
    'enable_notifications': ('true', 'features', '系统通知'),
    'max_file_size': ('10', 'features', '最大文件大小(MB)'),
    'session_timeout': ('30', 'features', '会话超时(分钟)'),
    # AI设置
    'spark_api_key': ('', 'ai', 'Spark API Key'),
    'spark_api_url': ('https://spark-api-open.xf-yun.com/v1/chat/completions', 'ai', 'Spark API URL'),
    'spark_model': ('lite', 'ai', '当前使用的AI模型'),
    'ai_response_timeout': ('30', 'ai', 'AI响应超时(秒)'),
    'max_ai_requests': ('100', 'ai', '每日最大请求数'),
    # 邮件设置
    'smtp_host': ('', 'email', 'SMTP服务器'),
    'smtp_port': ('587', 'email', 'SMTP端口'),
    'smtp_user': ('', 'email', 'SMTP用户名'),
    'smtp_password': ('', 'email', 'SMTP密码'),
    'smtp_encryption': ('tls', 'email', '加密方式'),
    # 安全设置
    'password_min_length': ('6', 'security', '密码最小长度'),
    'enable_two_factor': ('false', 'security', '双因素认证'),
    'login_attempts': ('5', 'security', '最大登录尝试次数'),
    'lockout_duration': ('15', 'security', '锁定时长(分钟)'),
    # 备份设置
    'auto_backup': ('true', 'backup', '自动备份'),
    'backup_frequency': ('daily', 'backup', '备份频率'),
    'backup_retention': ('30', 'backup', '备份保留天数'),
}


def _ensure_default_settings():
    """确保所有默认设置存在于数据库中"""
    for key, (default_value, category, description) in DEFAULT_SETTINGS.items():
        existing = SystemSetting.query.filter_by(key=key).first()
        if not existing:
            setting = SystemSetting(key=key, value=default_value, category=category, description=description)
            db.session.add(setting)
    db.session.commit()


def _settings_to_dict():
    """将数据库中的设置转换为前端使用的字典格式"""
    _ensure_default_settings()
    settings = SystemSetting.query.all()
    result = {}
    # 映射数据库key到前端camelCase key
    key_mapping = {
        'site_name': 'siteName',
        'site_description': 'siteDescription',
        'admin_email': 'adminEmail',
        'timezone': 'timezone',
        'language': 'language',
        'allow_registration': 'allowRegistration',
        'require_email_verification': 'requireEmailVerification',
        'enable_ai_assistant': 'enableAIAssistant',
        'enable_notifications': 'enableNotifications',
        'max_file_size': 'maxFileSize',
        'session_timeout': 'sessionTimeout',
        'spark_api_key': 'sparkApiKey',
        'spark_api_url': 'sparkApiUrl',
        'spark_model': 'sparkModel',
        'ai_response_timeout': 'aiResponseTimeout',
        'max_ai_requests': 'maxAIRequests',
        'smtp_host': 'smtpHost',
        'smtp_port': 'smtpPort',
        'smtp_user': 'smtpUser',
        'smtp_password': 'smtpPassword',
        'smtp_encryption': 'smtpEncryption',
        'password_min_length': 'passwordMinLength',
        'enable_two_factor': 'enableTwoFactor',
        'login_attempts': 'loginAttempts',
        'lockout_duration': 'lockoutDuration',
        'auto_backup': 'autoBackup',
        'backup_frequency': 'backupFrequency',
        'backup_retention': 'backupRetention',
    }
    for setting in settings:
        frontend_key = key_mapping.get(setting.key, setting.key)
        value = setting.value
        # 布尔值转换
        if value in ('true', 'false'):
            result[frontend_key] = value == 'true'
        else:
            result[frontend_key] = value
    return result


def _dict_to_settings(data):
    """将前端字典格式转换为数据库设置并保存"""
    # 反向映射
    reverse_mapping = {
        'siteName': 'site_name',
        'siteDescription': 'site_description',
        'adminEmail': 'admin_email',
        'allowRegistration': 'allow_registration',
        'requireEmailVerification': 'require_email_verification',
        'enableAIAssistant': 'enable_ai_assistant',
        'enableNotifications': 'enable_notifications',
        'maxFileSize': 'max_file_size',
        'sessionTimeout': 'session_timeout',
        'sparkApiKey': 'spark_api_key',
        'sparkApiUrl': 'spark_api_url',
        'sparkModel': 'spark_model',
        'aiResponseTimeout': 'ai_response_timeout',
        'maxAIRequests': 'max_ai_requests',
        'smtpHost': 'smtp_host',
        'smtpPort': 'smtp_port',
        'smtpUser': 'smtp_user',
        'smtpPassword': 'smtp_password',
        'smtpEncryption': 'smtp_encryption',
        'passwordMinLength': 'password_min_length',
        'enableTwoFactor': 'enable_two_factor',
        'loginAttempts': 'login_attempts',
        'lockoutDuration': 'lockout_duration',
        'autoBackup': 'auto_backup',
        'backupFrequency': 'backup_frequency',
        'backupRetention': 'backup_retention',
    }
    for frontend_key, value in data.items():
        db_key = reverse_mapping.get(frontend_key)
        if not db_key:
            continue
        # 布尔值转换
        if isinstance(value, bool):
            str_value = 'true' if value else 'false'
        else:
            str_value = str(value)
        setting = SystemSetting.query.filter_by(key=db_key).first()
        if setting:
            setting.value = str_value
            setting.updated_at = datetime.utcnow()
        else:
            category = DEFAULT_SETTINGS.get(db_key, ('', 'general', ''))[1]
            description = DEFAULT_SETTINGS.get(db_key, ('', 'general', ''))[2]
            setting = SystemSetting(key=db_key, value=str_value, category=category, description=description)
            db.session.add(setting)
    db.session.commit()


@admin_bp.route('/settings', methods=['GET'])
@require_auth
@require_admin
def get_system_settings():
    """获取系统设置"""
    try:
        settings = _settings_to_dict()
        return jsonify({'settings': settings}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/settings', methods=['PUT'])
@require_auth
@require_admin
def update_system_settings():
    """更新系统设置"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # AI设置特殊处理：检查API Key是否为4.0版本
        spark_api_key = data.get('sparkApiKey', '')
        current_model = data.get('sparkModel', '')

        if spark_api_key:
            # 验证API Key - 尝试用4.0模型调用
            is_valid_40 = _validate_spark_api_key(spark_api_key, data.get('sparkApiUrl', ''))
            if is_valid_40:
                data['sparkModel'] = '4.0Ultra'
            else:
                # API Key无效或不是4.0版本，回退到lite模型
                data['sparkModel'] = 'lite'
        else:
            # 没有API Key，使用lite模型
            data['sparkModel'] = 'lite'

        _dict_to_settings(data)
        settings = _settings_to_dict()

        # 返回模型切换信息
        model_message = None
        if spark_api_key:
            if settings.get('sparkModel') == '4.0Ultra':
                model_message = 'API Key验证通过，已切换至4.0 Ultra模型'
            else:
                model_message = 'API Key无效或验证失败，已回退至lite模型'

        return jsonify({
            'settings': settings,
            'model_message': model_message,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def _validate_spark_api_key(api_key, api_url):
    """验证Spark API Key是否为4.0版本且有效"""
    try:
        url = api_url or 'https://spark-api-open.xf-yun.com/v1/chat/completions'
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
        payload = {
            'model': '4.0Ultra',
            'messages': [{'role': 'user', 'content': 'test'}],
            'max_tokens': 5,
        }
        resp = http_requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            return True
        return False
    except Exception:
        return False


@admin_bp.route('/settings/test-ai', methods=['POST'])
@require_auth
@require_admin
def test_ai_connection():
    """测试AI连接"""
    try:
        data = request.get_json()
        api_key = data.get('sparkApiKey', '')
        api_url = data.get('sparkApiUrl', 'https://spark-api-open.xf-yun.com/v1/chat/completions')

        if not api_key:
            # 使用环境变量中的默认key
            api_key = current_app.config.get('SPARK_API_KEY', '')
            api_secret = current_app.config.get('SPARK_API_SECRET', '')
            api_password = current_app.config.get('SPARK_API_PASSWORD', '')
            app_id = current_app.config.get('SPARK_APP_ID', '')
            if api_key and api_secret:
                # 使用旧版认证方式
                api_key = f'{api_key}:{api_secret}:{api_password}'

        if not api_key:
            return jsonify({'success': False, 'error': '未配置API Key'}), 400

        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        }
        # 先尝试4.0模型
        payload_40 = {
            'model': '4.0Ultra',
            'messages': [{'role': 'user', 'content': '你好，请回复"连接测试成功"'}],
            'max_tokens': 20,
        }
        try:
            resp = http_requests.post(api_url, json=payload_40, headers=headers, timeout=15)
            if resp.status_code == 200:
                result = resp.json()
                return jsonify({
                    'success': True,
                    'model': '4.0Ultra',
                    'message': '4.0 Ultra模型连接测试成功',
                    'response': result.get('choices', [{}])[0].get('message', {}).get('content', ''),
                }), 200
        except Exception:
            pass

        # 4.0失败，尝试lite模型
        payload_lite = {
            'model': 'lite',
            'messages': [{'role': 'user', 'content': '你好，请回复"连接测试成功"'}],
            'max_tokens': 20,
        }
        resp = http_requests.post(api_url, json=payload_lite, headers=headers, timeout=15)
        if resp.status_code == 200:
            result = resp.json()
            return jsonify({
                'success': True,
                'model': 'lite',
                'message': 'lite模型连接测试成功（4.0 Ultra不可用，将使用lite模型）',
                'response': result.get('choices', [{}])[0].get('message', {}).get('content', ''),
            }), 200

        error_data = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
        return jsonify({
            'success': False,
            'error': f'AI连接测试失败: HTTP {resp.status_code}',
            'detail': error_data.get('error', {}).get('message', '') if isinstance(error_data, dict) else '',
        }), 400

    except http_requests.Timeout:
        return jsonify({'success': False, 'error': 'AI连接超时，请检查网络和API地址'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': f'AI连接测试失败: {str(e)}'}), 500


@admin_bp.route('/settings/test-email', methods=['POST'])
@require_auth
@require_admin
def test_email_settings():
    """测试邮件设置"""
    try:
        data = request.get_json()
        smtp_host = data.get('smtpHost', '')
        smtp_port = int(data.get('smtpPort', 587))
        smtp_user = data.get('smtpUser', '')
        smtp_password = data.get('smtpPassword', '')
        smtp_encryption = data.get('smtpEncryption', 'tls')

        if not smtp_host:
            return jsonify({'success': False, 'error': 'SMTP服务器地址不能为空'}), 400

        import smtplib
        from email.mime.text import MIMEText

        try:
            if smtp_encryption == 'ssl':
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                if smtp_encryption == 'tls':
                    server.starttls()

            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)

            # 发送测试邮件
            msg = MIMEText('这是一封来自智教星系统的测试邮件，用于验证SMTP配置。', 'plain', 'utf-8')
            msg['Subject'] = '智教星 - 邮件配置测试'
            msg['From'] = smtp_user
            msg['To'] = data.get('adminEmail', smtp_user)

            server.sendmail(smtp_user, [msg['To']], msg.as_string())
            server.quit()

            return jsonify({'success': True, 'message': '邮件测试发送成功'}), 200
        except smtplib.SMTPAuthenticationError:
            return jsonify({'success': False, 'error': 'SMTP认证失败，请检查用户名和密码'}), 400
        except smtplib.SMTPConnectError:
            return jsonify({'success': False, 'error': 'SMTP连接失败，请检查服务器地址和端口'}), 400
        except Exception as e:
            return jsonify({'success': False, 'error': f'邮件发送失败: {str(e)}'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/settings/backup', methods=['POST'])
@require_auth
@require_admin
def create_backup():
    """创建数据库备份"""
    try:
        import shutil
        import os as backup_os

        db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if not db_uri.startswith('sqlite:///'):
            return jsonify({'success': False, 'error': '仅支持SQLite数据库备份'}), 400

        db_path = db_uri.replace('sqlite:///', '').replace('sqlite:////', '')
        if not db_path or not backup_os.path.exists(db_path):
            return jsonify({'success': False, 'error': '数据库文件不存在'}), 400

        backup_dir = backup_os.path.join(backup_os.path.dirname(db_path), 'backups')
        backup_os.makedirs(backup_dir, exist_ok=True)

        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        backup_filename = f'zhijiaoxing_backup_{timestamp}.db'
        backup_path = backup_os.path.join(backup_dir, backup_filename)

        shutil.copy2(db_path, backup_path)

        # 清理过期备份
        retention_days = 30
        retention_setting = SystemSetting.query.filter_by(key='backup_retention').first()
        if retention_setting:
            try:
                retention_days = int(retention_setting.value)
            except ValueError:
                pass

        cutoff_time = datetime.utcnow() - timedelta(days=retention_days)
        for filename in backup_os.listdir(backup_dir):
            filepath = backup_os.path.join(backup_dir, filename)
            if backup_os.path.isfile(filepath):
                file_mtime = datetime.fromtimestamp(backup_os.path.getmtime(filepath))
                if file_mtime < cutoff_time:
                    backup_os.remove(filepath)

        return jsonify({
            'success': True,
            'message': '备份创建成功',
            'backup_file': backup_filename,
            'backup_path': backup_path,
        }), 200

    except Exception as e:
        return jsonify({'success': False, 'error': f'备份创建失败: {str(e)}'}), 500


# ==================== 多智能体监控管理 ====================

def _get_agent_monitor_data():
    """从多智能体系统获取监控数据"""
    try:
        from src.services.multi_agent.shared_state import agent_monitor, shared_state, message_bus
        return agent_monitor, shared_state, message_bus
    except Exception:
        return None, None, None


def _get_db_agent_stats():
    """从数据库读取各 Agent 累计执行统计（持久化，重启不丢）。

    返回 {agent_name: {task_count, success_count, fail_count, avg_duration_ms, last_executed_at}}
    """
    try:
        rows = db.session.query(
            AgentExecutionLog.agent_name.label('name'),
            func.count(AgentExecutionLog.id).label('task_count'),
            func.sum(
                case((AgentExecutionLog.status == 'success', 1), else_=0)
            ).label('success_count'),
            func.sum(
                case((AgentExecutionLog.status == 'failed', 1), else_=0)
            ).label('fail_count'),
            func.avg(AgentExecutionLog.duration_ms).label('avg_duration_ms'),
            func.max(AgentExecutionLog.created_at).label('last_executed_at'),
        ).group_by(AgentExecutionLog.agent_name).all()
        return {
            row.name: {
                'task_count': int(row.task_count or 0),
                'success_count': int(row.success_count or 0),
                'fail_count': int(row.fail_count or 0),
                'avg_duration_ms': round(float(row.avg_duration_ms), 1) if row.avg_duration_ms else None,
                'last_executed_at': row.last_executed_at.isoformat() if row.last_executed_at else None,
            }
            for row in rows
        }
    except Exception:
        return {}


@admin_bp.route('/agents/status', methods=['GET'])
@require_auth
@require_admin
def get_admin_agents_status():
    """获取所有Agent运行状态"""
    try:
        agent_monitor, shared_state, message_bus = _get_agent_monitor_data()
        if not agent_monitor:
            return jsonify({'agents': [], 'summary': {'total_agents': 0, 'running': 0, 'idle': 0}}), 200

        agents_status = agent_monitor.get_status()
        summary = agent_monitor.get_summary()

        # 附加共享状态快照中的额外信息
        state_snapshot = shared_state.snapshot() if shared_state else {}

        # 持久化累计统计（DB 为总量来源，内存仅保留当前实时状态）
        db_stats = _get_db_agent_stats()

        # Agent元数据映射
        agent_meta = {
            'coordinator': {'display_name': '协调Agent', 'description': '总调度，任务分发，结果整合', 'icon': '🎛️'},
            'exercise_agent': {'display_name': '习题Agent', 'description': '选择题、填空题、编程题生成', 'icon': '✏️'},
            'document_agent': {'display_name': '文档Agent', 'description': '课程讲解文档、知识点思维导图', 'icon': '📄'},
            'media_agent': {'display_name': '媒体Agent', 'description': '视频脚本、动画描述、多模态内容', 'icon': '🎬'},
            'recommendation_agent': {'display_name': '推荐Agent', 'description': '拓展阅读材料、资源推荐', 'icon': '📚'},
            'project_agent': {'display_name': '项目Agent', 'description': '代码实操案例、实践项目', 'icon': '💻'},
        }

        agents_list = []
        # 合并内存中注册的 agent、DB 中历史出现过的 agent、以及元数据中预定义的 agent
        # 确保即使无执行记录，预定义的 6 个 Agent 也能正常展示
        all_names = set(agents_status.keys()) | set(db_stats.keys()) | set(agent_meta.keys())
        for name in all_names:
            info = agents_status.get(name, {})
            meta = agent_meta.get(name, {'display_name': name, 'description': '', 'icon': '🔧'})
            db_stat = db_stats.get(name, {})
            # 累计计数以 DB 为准（持久化），内存计数仅作本次会话补充
            task_count = db_stat.get('task_count', info.get('task_count', 0))
            success_count = db_stat.get('success_count', info.get('success_count', 0))
            fail_count = db_stat.get('fail_count', info.get('fail_count', 0))
            success_rate = round(success_count / task_count * 100, 1) if task_count > 0 else 0
            agents_list.append({
                'name': name,
                'display_name': meta['display_name'],
                'description': meta['description'],
                'icon': meta['icon'],
                'role': info.get('role', ''),
                'status': info.get('status', 'idle'),
                'task_count': task_count,
                'success_count': success_count,
                'fail_count': fail_count,
                'success_rate': success_rate,
                'avg_duration_ms': db_stat.get('avg_duration_ms'),
                'last_executed_at': db_stat.get('last_executed_at'),
                'current_task': info.get('current_task'),
                'last_heartbeat': info.get('last_heartbeat'),
                'started_at': info.get('started_at'),
                'capabilities': info.get('capabilities', []),
                'citation_coverage': info.get('citation_coverage'),
                'output_summary': info.get('output_summary'),
            })

        # 汇总：total_agents 取合并后列表长度（内存+DB+预定义），运行/空闲取内存实时值，
        # 累计任务/成功/失败取 DB 持久值
        total_tasks = sum(s.get('task_count', 0) for s in db_stats.values())
        total_success = sum(s.get('success_count', 0) for s in db_stats.values())
        total_fail = sum(s.get('fail_count', 0) for s in db_stats.values())
        summary.update({
            'total_agents': len(agents_list),
            'total_tasks': total_tasks,
            'total_success': total_success,
            'total_fail': total_fail,
            'success_rate': round(total_success / total_tasks * 100, 1) if total_tasks > 0 else 0,
        })

        return jsonify({
            'agents': agents_list,
            'summary': summary,
            'shared_state_keys': list(state_snapshot.keys())[:20] if state_snapshot else [],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/agents/performance', methods=['GET'])
@require_auth
@require_admin
def get_admin_agents_performance():
    """获取Agent性能指标统计"""
    try:
        agent_monitor, shared_state, message_bus = _get_agent_monitor_data()
        if not agent_monitor:
            return jsonify({'performance': [], 'radar_data': []}), 200

        agents_status = agent_monitor.get_status()
        # 持久化累计统计：DB 为总量来源，覆盖内存计数
        db_stats = _get_db_agent_stats()
        # 合并预定义 agent 元数据，确保无执行记录时也能展示所有 Agent 的性能维度
        predefined_agents = {'coordinator', 'exercise_agent', 'document_agent', 'media_agent', 'recommendation_agent', 'project_agent'}
        all_names = set(agents_status.keys()) | set(db_stats.keys()) | predefined_agents

        # 为每个Agent计算性能维度
        performance_data = []
        radar_data = []

        for name in all_names:
            info = agents_status.get(name, {})
            db_stat = db_stats.get(name, {})
            task_count = db_stat.get('task_count', info.get('task_count', 0))
            success_count = db_stat.get('success_count', info.get('success_count', 0))
            fail_count = db_stat.get('fail_count', info.get('fail_count', 0))
            success_rate = round(success_count / task_count * 100, 1) if task_count > 0 else 0
            citation_coverage = info.get('citation_coverage', 0) or 0

            # 平均响应时间：优先用 DB 真实耗时，无则启发式估算
            avg_response = db_stat.get('avg_duration_ms')
            if not avg_response:
                base_time = 3000  # 基准3秒
                if success_rate > 90:
                    avg_response = base_time * 0.8
                elif success_rate > 70:
                    avg_response = base_time * 1.0
                else:
                    avg_response = base_time * 1.3

            # Token效率（任务量越高，单任务Token效率越高）
            token_efficiency = min(95, 60 + task_count * 2) if task_count > 0 else 0

            # 质量评分（基于成功率和引用覆盖率）
            quality_score = round(success_rate * 0.6 + citation_coverage * 0.4, 1) if task_count > 0 else 0

            perf = {
                'agent_name': name,
                'task_count': task_count,
                'success_rate': success_rate,
                'avg_response_time_ms': round(avg_response),
                'quality_score': quality_score,
                'token_efficiency': token_efficiency,
                'citation_coverage': round(citation_coverage, 1),
                'fail_count': fail_count,
            }
            performance_data.append(perf)

            # 雷达图数据（归一化到0-100）
            radar_data.append({
                'agent': name,
                '响应速度': round(100 - (avg_response / 5000 * 100), 1) if avg_response > 0 else 100,
                '成功率': success_rate,
                '质量评分': quality_score,
                'Token效率': token_efficiency,
                '引用覆盖': round(citation_coverage, 1),
            })

        return jsonify({
            'performance': performance_data,
            'radar_data': radar_data,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/agents/tasks/recent', methods=['GET'])
@require_auth
@require_admin
def get_admin_agents_recent_tasks():
    """获取近期Agent任务日志（持久化记录优先，内存实时活动补充）"""
    try:
        limit = request.args.get('limit', 30, type=int)
        agent_filter = request.args.get('agent_name', type=str)

        tasks = []

        # 1) 持久化执行记录（DB，重启不丢）
        try:
            query = AgentExecutionLog.query
            if agent_filter:
                query = query.filter(AgentExecutionLog.agent_name == agent_filter)
            db_logs = query.order_by(AgentExecutionLog.created_at.desc()).limit(limit).all()
            for log in db_logs:
                tasks.append({
                    'type': 'execution',
                    'agent': log.agent_name,
                    'task_type': log.task_type or '',
                    'status': log.status,
                    'duration_ms': log.duration_ms,
                    'error_message': log.error_message or '',
                    'timestamp': log.created_at.isoformat() if log.created_at else '',
                    'id': log.id,
                })
        except Exception as db_err:
            logger.warning('读取持久化执行记录失败，回退内存数据: %s', db_err)

        # 2) DB 无记录时，回退到内存实时活动（首次部署/未触发过持久化时）
        if not tasks:
            agent_monitor, shared_state, message_bus = _get_agent_monitor_data()
            messages = []
            if message_bus:
                messages = message_bus.get_log(limit=50)
            history = []
            if shared_state:
                history = shared_state.get_history(limit=50)
            for msg in messages:
                tasks.append({
                    'type': 'message',
                    'sender': msg.get('sender', ''),
                    'receiver': msg.get('receiver', ''),
                    'msg_type': msg.get('msg_type', ''),
                    'payload_summary': str(msg.get('payload', ''))[:200],
                    'timestamp': msg.get('timestamp', ''),
                })
            for h in history:
                tasks.append({
                    'type': 'state_change',
                    'agent': h.get('agent_name', ''),
                    'key': h.get('key', ''),
                    'old_value': str(h.get('old_value', ''))[:100],
                    'new_value': str(h.get('new_value', ''))[:100],
                    'timestamp': h.get('timestamp', ''),
                })
            tasks.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
            tasks = tasks[:limit]

        return jsonify({
            'tasks': tasks[:limit],
            'total': len(tasks),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/agents/executions/history', methods=['GET'])
@require_auth
@require_admin
def get_admin_agents_executions_history():
    """分页获取持久化的 Agent 执行历史记录。"""
    try:
        page = max(request.args.get('page', 1, type=int), 1)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        agent_filter = request.args.get('agent_name', type=str)
        status_filter = request.args.get('status', type=str)

        query = AgentExecutionLog.query
        if agent_filter:
            query = query.filter(AgentExecutionLog.agent_name == agent_filter)
        if status_filter in ('success', 'failed'):
            query = query.filter(AgentExecutionLog.status == status_filter)

        total = query.count()
        rows = (query.order_by(AgentExecutionLog.created_at.desc())
                .offset((page - 1) * per_page).limit(per_page).all())

        return jsonify({
            'records': [r.to_dict() for r in rows],
            'page': page,
            'per_page': per_page,
            'total': total,
            'total_pages': (total + per_page - 1) // per_page if per_page > 0 else 0,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== AI内容审核反馈管理 ====================

@admin_bp.route('/content-review/feedback-stats', methods=['GET'])
@require_auth
@require_admin
def get_content_review_feedback_stats():
    """获取内容审核反馈统计（按教师/学生分组）"""
    try:
        from src.models.content_review import ContentReview, ReviewOperationLog

        # 按来源统计
        teacher_reviews = ContentReview.query.filter(ContentReview.source.in_(['teacher'])).count()
        student_reviews = ContentReview.query.filter(ContentReview.source.in_(['student'])).count()
        ai_reviews = ContentReview.query.filter(ContentReview.source == 'ai').count()

        # 按状态统计
        status_stats = {}
        for status in ['pending', 'auto_reviewing', 'manual_reviewing', 'spot_checking', 'passed', 'rejected']:
            status_stats[status] = ContentReview.query.filter_by(status=status).count()

        # 按内容类型统计
        type_stats = {}
        for ctype in ['knowledge_point', 'teaching_case', 'exercise', 'teaching_content']:
            type_stats[ctype] = ContentReview.query.filter_by(content_type=ctype).count()

        # 平均自动评分
        avg_score_result = db.session.query(func.avg(ContentReview.auto_score)).filter(
            ContentReview.auto_score.isnot(None)
        ).scalar()
        avg_auto_score = round(float(avg_score_result), 1) if avg_score_result else 0

        # 平均人工评分
        avg_manual_result = db.session.query(func.avg(ContentReview.review_score)).filter(
            ContentReview.review_score.isnot(None)
        ).scalar()
        avg_manual_score = round(float(avg_manual_result), 1) if avg_manual_result else 0

        # 审核操作统计
        operation_stats = {}
        for action in ['submit', 'auto_review', 'manual_review', 'approve', 'reject', 'spot_check']:
            operation_stats[action] = ReviewOperationLog.query.filter_by(action=action).count()

        # 近7天审核趋势
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        daily_trend = []
        for i in range(7):
            day_start = seven_days_ago + timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            count = ContentReview.query.filter(
                ContentReview.updated_at >= day_start,
                ContentReview.updated_at < day_end
            ).count()
            daily_trend.append({
                'date': day_start.strftime('%m-%d'),
                'count': count,
            })

        # 教师反馈 vs 学生反馈
        teacher_feedback = ReviewOperationLog.query.join(
            User, ReviewOperationLog.operator_id == User.id
        ).filter(User.role == 'teacher').count()

        student_feedback = ReviewOperationLog.query.join(
            User, ReviewOperationLog.operator_id == User.id
        ).filter(User.role == 'student').count()

        return jsonify({
            'source_stats': {
                'teacher': teacher_reviews,
                'student': student_reviews,
                'ai': ai_reviews,
            },
            'status_stats': status_stats,
            'type_stats': type_stats,
            'avg_auto_score': avg_auto_score,
            'avg_manual_score': avg_manual_score,
            'operation_stats': operation_stats,
            'daily_trend': daily_trend,
            'feedback_by_role': {
                'teacher': teacher_feedback,
                'student': student_feedback,
            },
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/content-review/comparison', methods=['GET'])
@require_auth
@require_admin
def get_content_review_comparison():
    """获取AI内容生成前后对比数据"""
    try:
        from src.models.content_review import ContentReview

        # 获取有版本对比的记录（previous_version_id不为空）
        versioned_reviews = ContentReview.query.filter(
            ContentReview.previous_version_id.isnot(None)
        ).order_by(ContentReview.created_at.desc()).limit(20).all()

        comparisons = []
        for review in versioned_reviews:
            prev = ContentReview.query.get(review.previous_version_id) if review.previous_version_id else None
            if not prev:
                continue

            # 计算改进指标
            old_score = prev.auto_score or 0
            new_score = review.auto_score or 0
            improvement = round(new_score - old_score, 1)

            old_len = len(prev.content_body or '')
            new_len = len(review.content_body or '')

            comparisons.append({
                'id': review.id,
                'content_title': review.content_title or '未命名',
                'content_type': review.content_type,
                'old_version': {
                    'version': prev.version,
                    'score': old_score,
                    'content_length': old_len,
                    'content_preview': (prev.content_body or '')[:500],
                    'status': prev.status,
                    'created_at': prev.created_at.isoformat() if prev.created_at else None,
                },
                'new_version': {
                    'version': review.version,
                    'score': new_score,
                    'content_length': new_len,
                    'content_preview': (review.content_body or '')[:500],
                    'status': review.status,
                    'created_at': review.created_at.isoformat() if review.created_at else None,
                },
                'improvement': {
                    'score_delta': improvement,
                    'length_delta': new_len - old_len,
                    'improvement_pct': round(improvement / old_score * 100, 1) if old_score > 0 else 0,
                },
            })

        # 汇总统计
        total_comparisons = len(comparisons)
        avg_improvement = round(
            sum(c['improvement']['score_delta'] for c in comparisons) / total_comparisons, 1
        ) if total_comparisons > 0 else 0

        positive_improvements = sum(1 for c in comparisons if c['improvement']['score_delta'] > 0)
        improvement_rate = round(positive_improvements / total_comparisons * 100, 1) if total_comparisons > 0 else 0

        # 按内容类型分组统计
        type_improvements = {}
        for c in comparisons:
            ctype = c['content_type']
            if ctype not in type_improvements:
                type_improvements[ctype] = {'count': 0, 'total_delta': 0}
            type_improvements[ctype]['count'] += 1
            type_improvements[ctype]['total_delta'] += c['improvement']['score_delta']

        type_stats = []
        for ctype, data in type_improvements.items():
            type_stats.append({
                'content_type': ctype,
                'count': data['count'],
                'avg_improvement': round(data['total_delta'] / data['count'], 1) if data['count'] > 0 else 0,
            })

        return jsonify({
            'comparisons': comparisons[:10],
            'summary': {
                'total_comparisons': total_comparisons,
                'avg_improvement': avg_improvement,
                'improvement_rate': improvement_rate,
                'positive_count': positive_improvements,
            },
            'type_stats': type_stats,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/content-review/feedback-trend', methods=['GET'])
@require_auth
@require_admin
def get_content_review_feedback_trend():
    """获取用户反馈趋势数据"""
    try:
        from src.models.content_review import ContentReview, ReviewOperationLog

        # 近30天反馈趋势
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        trend = []
        for i in range(30):
            day_start = thirty_days_ago + timedelta(days=i)
            day_end = day_start + timedelta(days=1)

            # 当日审核操作
            day_ops = ReviewOperationLog.query.filter(
                ReviewOperationLog.created_at >= day_start,
                ReviewOperationLog.created_at < day_end
            ).all()

            # 按操作类型统计
            approve_count = sum(1 for op in day_ops if op.action in ['approve', 'manual_review'])
            reject_count = sum(1 for op in day_ops if op.action == 'reject')

            # 按角色统计
            teacher_ops = 0
            student_ops = 0
            for op in day_ops:
                if op.operator and op.operator.role == 'teacher':
                    teacher_ops += 1
                elif op.operator and op.operator.role == 'student':
                    student_ops += 1

            trend.append({
                'date': day_start.strftime('%m-%d'),
                'approve': approve_count,
                'reject': reject_count,
                'teacher': teacher_ops,
                'student': student_ops,
                'total': len(day_ops),
            })

        return jsonify({
            'trend': trend,
            'total_days': 30,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

