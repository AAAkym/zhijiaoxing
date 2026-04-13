import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory, jsonify, Response, current_app
from flask_cors import CORS
from flask_caching import Cache
from src.models.user import db
from src.routes.auth import auth_bp
from src.routes.course import course_bp
from src.routes.ai_assistant import ai_bp
from src.routes.admin import admin_bp
from src.routes.student import student_bp
from src.routes.student_settings import student_settings_bp
from src.routes.sse_routes import sse_bp
from src.routes.conversation_routes import conversation_bp
from src.routes.search_routes import search_bp
from src.routes.interaction import interaction_bp
from src.routes.mistake_book import mistake_book_bp
from src.routes.notes import notes_bp
from src.services.websocket_service import init_socketio

from src.config import get_config

config = get_config()

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))

app.config.from_object(config)

# 确保所有响应使用UTF-8编码
app.config['JSON_AS_ASCII'] = False
app.config['RESTFUL_JSON'] = {'ensure_ascii': False}

# 添加响应后处理器，确保UTF-8编码
@app.after_request
def after_request(response):
    """确保所有响应都使用UTF-8编码"""
    # 设置字符编码为UTF-8
    if response.content_type and 'charset' not in response.content_type:
        if 'application/json' in response.content_type:
            response.content_type = 'application/json; charset=utf-8'
        elif 'text/' in response.content_type:
            response.content_type = response.content_type + '; charset=utf-8'
    return response

CORS(app, 
     origins=config.CORS_ORIGINS,
     supports_credentials=config.CORS_SUPPORTS_CREDENTIALS,
     allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'])

cache = Cache()
cache.init_app(app)

# 初始化 WebSocket
init_socketio(app)

app.register_blueprint(auth_bp, url_prefix='/api')
app.register_blueprint(course_bp, url_prefix='/api')
app.register_blueprint(ai_bp, url_prefix='/api')
app.register_blueprint(admin_bp, url_prefix='/api')
app.register_blueprint(student_bp, url_prefix='/api')
app.register_blueprint(student_settings_bp, url_prefix='/api')
app.register_blueprint(sse_bp, url_prefix='/api/sse')
app.register_blueprint(conversation_bp, url_prefix='/api')
app.register_blueprint(search_bp)
app.register_blueprint(interaction_bp, url_prefix='/api')
app.register_blueprint(mistake_book_bp, url_prefix='/api')
app.register_blueprint(notes_bp, url_prefix='/api')

db.init_app(app)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'videos')
LEGACY_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'videos')
AVATAR_UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'avatars')
LEGACY_AVATAR_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'avatars')

@app.route('/uploads/videos/<filename>')
def serve_video(filename):
    """服务上传的视频文件"""
    for folder in (UPLOAD_FOLDER, LEGACY_UPLOAD_FOLDER):
        file_path = os.path.join(folder, filename)
        if os.path.exists(file_path):
            return send_from_directory(folder, filename)
    return jsonify({'error': 'Video not found'}), 404

@app.route('/uploads/avatars/<filename>')
def serve_avatar(filename):
    """服务上传的头像文件"""
    for folder in (AVATAR_UPLOAD_FOLDER, LEGACY_AVATAR_FOLDER):
        file_path = os.path.join(folder, filename)
        if os.path.exists(file_path):
            return send_from_directory(folder, filename)
    return jsonify({'error': 'Avatar not found'}), 404

NOTES_UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'notes')

@app.route('/uploads/notes/<filename>')
def serve_note_image(filename):
    """服务笔记图片"""
    file_path = os.path.join(NOTES_UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_from_directory(NOTES_UPLOAD_FOLDER, filename)
    return jsonify({'error': 'Image not found'}), 404

# 创建数据库表和默认数据
with app.app_context():
    db.create_all()

    # 【重要】自动检测并补充缺失的数据库列（解决模型新增字段但旧表未同步的问题）
    def ensure_table_columns():
        """确保数据库表包含模型定义的所有列（自动迁移）

        原因：Flask-SQLAlchemy 的 db.create_all() 只创建不存在的表，
        不会给已有表添加新列。当 StudyNote 模型新增 tags、is_auto_generated、
        is_public、video_timestamp 等字段后，旧的 SQLite 数据库表缺少这些列，
        导致查询时出现 'no such column: study_notes.tags' 错误。
        """
        import sqlite3
        from src.models.course import StudyNote

        # 从配置获取 SQLite 数据库文件路径
        db_uri = current_app.config.get('SQLALCHEMY_DATABASE_URI', '')
        db_path = db_uri.replace('sqlite:///', '').replace('sqlite:////', '')
        if not db_path or not os.path.exists(db_path):
            print(f"[DB Migration] 数据库文件不存在或路径为空: {db_path}")
            return

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            # 获取 study_notes 表的现有列信息
            cursor.execute("PRAGMA table_info(study_notes)")
            existing_columns = {row[1] for row in cursor.fetchall()}

            # 模型中期望的所有列及其类型映射（与 StudyNote 模型定义对应）
            model_columns = {
                'content': 'TEXT NOT NULL DEFAULT ""',
                'video_timestamp': 'REAL',
                'tags': 'TEXT',
                'is_auto_generated': 'BOOLEAN DEFAULT 0',
                'is_public': 'BOOLEAN DEFAULT 0',
                'content_id': 'INTEGER',
            }

            # 检测并添加缺失的列
            for col_name, col_type in model_columns.items():
                if col_name not in existing_columns:
                    try:
                        cursor.execute(f"ALTER TABLE study_notes ADD COLUMN {col_name} {col_type}")
                        print(f"[DB Migration] [OK] Added column: study_notes.{col_name} ({col_type})")
                    except Exception as e:
                        print(f"[DB Migration] [WARN] Failed to add column {col_name} (may already exist): {e}")

            conn.commit()
            conn.close()

            if any(col not in existing_columns for col in model_columns.keys()):
                print("[DB Migration] 数据库 Schema 迁移完成")
            else:
                print("[DB Migration] 数据库 Schema 已是最新，无需迁移")

        except Exception as e:
            print(f"[DB Migration] [ERROR] Migration failed: {e}")

    # 执行自动迁移
    ensure_table_columns()

    # 仅在开发环境创建示例账号，避免生产环境默认弱口令
    is_dev = os.environ.get('FLASK_ENV', 'development') == 'development' or app.config.get('DEBUG', False)
    if is_dev:
        from src.models.user import User
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(
                username='admin',
                email='admin@eduai.com',
                role='admin',
                real_name='系统管理员'
            )
            admin_user.set_password('admin123')
            db.session.add(admin_user)

            teacher_user = User(
                username='teacher',
                email='teacher@eduai.com',
                role='teacher',
                real_name='示例教师'
            )
            teacher_user.set_password('teacher123')
            db.session.add(teacher_user)

            student_user = User(
                username='student',
                email='student@eduai.com',
                role='student',
                real_name='示例学生'
            )
            student_user.set_password('student123')
            db.session.add(student_user)

            db.session.commit()
            print("Default users created in development mode:")
            print("Admin: admin/admin123")
            print("Teacher: teacher/teacher123")
            print("Student: student/student123")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


if __name__ == '__main__':
    # 打印当前配置信息（调试用）
    print(f"Environment: {os.environ.get('FLASK_ENV', 'development')}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"Pool Size: {app.config['SQLALCHEMY_ENGINE_OPTIONS'].get('pool_size')}")
    print(f"Cache Type: {app.config.get('CACHE_TYPE')}")
    print(f"Debug Mode: {app.config.get('DEBUG')}")
    
    app.run(host='0.0.0.0', port=5000, debug=app.config.get('DEBUG', True))
