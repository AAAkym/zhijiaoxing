import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, jsonify, send_from_directory, send_file, make_response, request
from flask_caching import Cache
from flask_cors import CORS

from src.config import get_config
from src.models.user import db
from src.routes.admin import admin_bp
from src.routes.ai_assistant import ai_bp
from src.routes.analytics import analytics_bp
from src.routes.auth import auth_bp
from src.routes.conversation_routes import conversation_bp
from src.routes.course import course_bp
from src.routes.interaction import interaction_bp
from src.routes.mistake_book import mistake_book_bp
from src.routes.notes import notes_bp
from src.routes.search_routes import search_bp
from src.routes.sse_routes import sse_bp
from src.routes.student import student_bp
from src.routes.student_settings import student_settings_bp
from src.routes.teacher import teacher_bp
from src.routes.achievement import achievement_bp
from src.routes.course_generation import course_gen_bp
from src.routes.class_management import class_mgmt_bp
from src.routes.profile_routes import profile_bp
from src.routes.resource_generation import resource_gen_bp
from src.routes.learning_path_routes import learning_path_bp
from src.routes.programming import programming_bp
from src.routes.ai_analysis import ai_analysis_bp
from src.routes.lesson_plan import lesson_plan_bp
from src.routes.learning_analytics import learning_analytics_bp
from src.routes.ai_optimization import ai_optimization_bp
from src.services.websocket_service import init_socketio

config = get_config()

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config.from_object(config)
app.config['JSON_AS_ASCII'] = False
app.config['RESTFUL_JSON'] = {'ensure_ascii': False}


@app.after_request
def after_request(response):
    if response.content_type and 'charset' not in response.content_type:
        if 'application/json' in response.content_type:
            response.content_type = 'application/json; charset=utf-8'
        elif 'text/' in response.content_type:
            response.content_type = response.content_type + '; charset=utf-8'
    return response


CORS(
    app,
    origins=config.CORS_ORIGINS,
    supports_credentials=config.CORS_SUPPORTS_CREDENTIALS,
    allow_headers=['Content-Type', 'Authorization', 'X-Requested-With'],
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
)

cache = Cache()
cache.init_app(app)

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
app.register_blueprint(teacher_bp, url_prefix='/api')
app.register_blueprint(analytics_bp, url_prefix='/api')
app.register_blueprint(achievement_bp, url_prefix='/api')
app.register_blueprint(course_gen_bp, url_prefix='/api')
app.register_blueprint(class_mgmt_bp, url_prefix='/api')
app.register_blueprint(profile_bp, url_prefix='/api')
app.register_blueprint(resource_gen_bp, url_prefix='/api')
app.register_blueprint(learning_path_bp, url_prefix='/api')
app.register_blueprint(programming_bp, url_prefix='/api')
app.register_blueprint(ai_analysis_bp, url_prefix='/api')
app.register_blueprint(lesson_plan_bp, url_prefix='/api')
app.register_blueprint(learning_analytics_bp, url_prefix='/api')
app.register_blueprint(ai_optimization_bp, url_prefix='/api')

db.init_app(app)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'videos')
LEGACY_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'videos')
AVATAR_UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'avatars')
LEGACY_AVATAR_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'avatars')
NOTES_UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'notes')


@app.route('/uploads/videos/<filename>')
def serve_video(filename):
    for folder in (UPLOAD_FOLDER, LEGACY_UPLOAD_FOLDER):
        file_path = os.path.join(folder, filename)
        if os.path.exists(file_path):
            return _serve_video_with_range(file_path, filename)
    return jsonify({'error': 'Video not found'}), 404


def _serve_video_with_range(file_path, filename):
    size = os.path.getsize(file_path)
    range_header = request.headers.get('Range', None)

    if range_header:
        byte1, byte2 = 0, None
        match = re.search(r'bytes=(\d+)-(\d*)', range_header)
        if match:
            groups = match.groups()
            if groups[0]:
                byte1 = int(groups[0])
            if groups[1]:
                byte2 = int(groups[1])
        if byte2 is None:
            byte2 = size - 1
        length = byte2 - byte1 + 1

        resp = make_response()
        resp.status_code = 206
        resp.headers['Content-Range'] = f'bytes {byte1}-{byte2}/{size}'
        resp.headers['Accept-Ranges'] = 'bytes'
        resp.headers['Content-Length'] = str(length)

        with open(file_path, 'rb') as f:
            f.seek(byte1)
            data = f.read(length)
        resp.data = data
        return resp

    with open(file_path, 'rb') as f:
        data = f.read()

    resp = make_response(data)
    resp.headers['Content-Type'] = 'video/mp4'
    resp.headers['Accept-Ranges'] = 'bytes'
    resp.headers['Content-Length'] = str(size)
    return resp


@app.route('/uploads/avatars/<filename>')
def serve_avatar(filename):
    for folder in (AVATAR_UPLOAD_FOLDER, LEGACY_AVATAR_FOLDER):
        file_path = os.path.join(folder, filename)
        if os.path.exists(file_path):
            return send_from_directory(folder, filename)
    return jsonify({'error': 'Avatar not found'}), 404


@app.route('/uploads/notes/<filename>')
def serve_note_image(filename):
    file_path = os.path.join(NOTES_UPLOAD_FOLDER, filename)
    if os.path.exists(file_path):
        return send_from_directory(NOTES_UPLOAD_FOLDER, filename)
    return jsonify({'error': 'Image not found'}), 404


with app.app_context():
    db.create_all()

    def ensure_table_columns():
        import sqlite3

        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if not db_uri.startswith('sqlite:///'):
            return

        db_path = db_uri.replace('sqlite:///', '').replace('sqlite:////', '')
        if not db_path or not os.path.exists(db_path):
            print(f"[DB Migration] 数据库文件不存在或路径为空: {db_path}")
            return

        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            cursor.execute('PRAGMA table_info(study_notes)')
            existing_note_columns = {row[1] for row in cursor.fetchall()}
            note_columns = {
                'content': 'TEXT NOT NULL DEFAULT ""',
                'video_timestamp': 'REAL',
                'tags': 'TEXT',
                'is_auto_generated': 'BOOLEAN DEFAULT 0',
                'is_public': 'BOOLEAN DEFAULT 0',
                'content_id': 'INTEGER',
            }
            for col_name, col_type in note_columns.items():
                if col_name not in existing_note_columns:
                    try:
                        cursor.execute(f'ALTER TABLE study_notes ADD COLUMN {col_name} {col_type}')
                        print(f'[DB Migration] [OK] Added column: study_notes.{col_name} ({col_type})')
                    except Exception as e:
                        print(f'[DB Migration] [WARN] Failed to add study_notes.{col_name}: {e}')

            cursor.execute('PRAGMA table_info(mistake_records)')
            existing_mistake_columns = {row[1] for row in cursor.fetchall()}
            mistake_columns = {
                'error_type_auto': 'VARCHAR(50)',
                'error_type_manual': 'VARCHAR(50)',
                'error_type_confidence': 'FLOAT',
                'error_reason_detail': 'TEXT',
                'error_type_confirmed': 'BOOLEAN DEFAULT 0',
            }
            for col_name, col_type in mistake_columns.items():
                if col_name not in existing_mistake_columns:
                    try:
                        cursor.execute(f'ALTER TABLE mistake_records ADD COLUMN {col_name} {col_type}')
                        print(f'[DB Migration] [OK] Added column: mistake_records.{col_name} ({col_type})')
                    except Exception as e:
                        print(f'[DB Migration] [WARN] Failed to add mistake_records.{col_name}: {e}')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='programming_submissions'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE programming_submissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        assessment_id INTEGER NOT NULL REFERENCES assessments(id),
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        question_index INTEGER DEFAULT 0 NOT NULL,
                        language VARCHAR(30) DEFAULT 'python',
                        code TEXT NOT NULL,
                        standard_answer TEXT,
                        score FLOAT DEFAULT 0.0,
                        max_score FLOAT DEFAULT 100.0,
                        status VARCHAR(30) DEFAULT 'reviewed',
                        compile_result TEXT,
                        runtime_result TEXT,
                        io_match_result TEXT,
                        syntax_result TEXT,
                        logic_result TEXT,
                        efficiency_result TEXT,
                        line_comparison TEXT,
                        ai_feedback TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: programming_submissions')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='student_profiles'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE student_profiles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
                        knowledge_base TEXT DEFAULT '{}',
                        cognitive_style VARCHAR(50) DEFAULT 'mixed',
                        error_patterns TEXT DEFAULT '[]',
                        learning_pace VARCHAR(20) DEFAULT 'moderate',
                        interest_areas TEXT DEFAULT '[]',
                        goal_orientation VARCHAR(30) DEFAULT 'exam',
                        time_availability TEXT DEFAULT '{}',
                        interaction_preference VARCHAR(30) DEFAULT 'guided',
                        confidence_score FLOAT DEFAULT 0.0,
                        last_updated DATETIME,
                        update_source VARCHAR(20) DEFAULT 'dialog',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: student_profiles')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='profile_dialog_sessions'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE profile_dialog_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        status VARCHAR(20) DEFAULT 'active',
                        current_round INTEGER DEFAULT 0,
                        max_rounds INTEGER DEFAULT 6,
                        extracted_features TEXT DEFAULT '{}',
                        messages TEXT DEFAULT '[]',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: profile_dialog_sessions')

            conn.commit()

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='learning_paths'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE learning_paths (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        course_id INTEGER REFERENCES courses(id),
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        path_data TEXT DEFAULT '[]',
                        current_node_id VARCHAR(100),
                        progress_percentage FLOAT DEFAULT 0.0,
                        estimated_days INTEGER DEFAULT 30,
                        status VARCHAR(20) DEFAULT 'active',
                        generated_by VARCHAR(50) DEFAULT 'ai',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: learning_paths')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='learning_path_nodes'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE learning_path_nodes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        path_id INTEGER NOT NULL REFERENCES learning_paths(id),
                        node_id VARCHAR(100) NOT NULL,
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        node_type VARCHAR(30) DEFAULT 'knowledge',
                        order_index INTEGER DEFAULT 0,
                        parent_node_id VARCHAR(100),
                        prerequisites TEXT DEFAULT '[]',
                        status VARCHAR(20) DEFAULT 'locked',
                        progress_percentage FLOAT DEFAULT 0.0,
                        estimated_minutes INTEGER DEFAULT 30,
                        resource_ids TEXT DEFAULT '[]',
                        mastery_level FLOAT DEFAULT 0.0,
                        started_at DATETIME,
                        completed_at DATETIME
                    )
                ''')
                print('[DB Migration] [OK] Created table: learning_path_nodes')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='resource_recommendations'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE resource_recommendations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        resource_type VARCHAR(30) NOT NULL,
                        resource_id INTEGER,
                        title VARCHAR(300) NOT NULL,
                        description TEXT,
                        url VARCHAR(500),
                        priority INTEGER DEFAULT 1,
                        relevance_score FLOAT DEFAULT 0.0,
                        reason_knowledge TEXT,
                        reason_progress TEXT,
                        reason_ability TEXT,
                        reason_interest TEXT,
                        generated_by_agent VARCHAR(50),
                        difficulty VARCHAR(20) DEFAULT 'intermediate',
                        estimated_minutes INTEGER DEFAULT 30,
                        tags TEXT DEFAULT '[]',
                        is_completed BOOLEAN DEFAULT 0,
                        is_dismissed BOOLEAN DEFAULT 0,
                        feedback_score INTEGER,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        completed_at DATETIME
                    )
                ''')
                print('[DB Migration] [OK] Created table: resource_recommendations')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='learning_plans'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE learning_plans (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        title VARCHAR(200) NOT NULL,
                        plan_type VARCHAR(20) DEFAULT 'mid_term',
                        ai_analysis TEXT,
                        goals TEXT DEFAULT '[]',
                        milestones TEXT DEFAULT '[]',
                        recommended_sequence TEXT DEFAULT '[]',
                        estimated_completion DATETIME,
                        ability_expectations TEXT DEFAULT '{}',
                        generated_by VARCHAR(50) DEFAULT 'ai',
                        status VARCHAR(20) DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: learning_plans')
            else:
                cursor.execute('PRAGMA table_info(learning_plans)')
                existing_plan_columns = {row[1] for row in cursor.fetchall()}
                plan_new_columns = {
                    'generated_by': 'VARCHAR(50) DEFAULT \'ai\'',
                }
                for col_name, col_type in plan_new_columns.items():
                    if col_name not in existing_plan_columns:
                        try:
                            cursor.execute(f'ALTER TABLE learning_plans ADD COLUMN {col_name} {col_type}')
                            print(f'[DB Migration] [OK] Added column: learning_plans.{col_name} ({col_type})')
                        except Exception as e:
                            print(f'[DB Migration] [WARN] Failed to add learning_plans.{col_name}: {e}')

            # AI Analysis tables
            ai_analysis_tables = {
                'ai_analysis_reports': '''
                    CREATE TABLE IF NOT EXISTS ai_analysis_reports (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        report_type VARCHAR(20) NOT NULL,
                        title VARCHAR(200) NOT NULL,
                        period_start DATETIME NOT NULL,
                        period_end DATETIME NOT NULL,
                        summary TEXT DEFAULT '',
                        key_metrics TEXT DEFAULT '{}',
                        anomalies TEXT DEFAULT '[]',
                        recommendations TEXT DEFAULT '[]',
                        detailed_analysis TEXT DEFAULT '',
                        roi_analysis TEXT DEFAULT '',
                        resource_optimization TEXT DEFAULT '',
                        status VARCHAR(20) DEFAULT 'generated',
                        generated_by VARCHAR(20) DEFAULT 'ai',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'ai_insights': '''
                    CREATE TABLE IF NOT EXISTS ai_insights (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        insight_type VARCHAR(50) NOT NULL,
                        title VARCHAR(200) NOT NULL,
                        description TEXT DEFAULT '',
                        risk_level VARCHAR(20) DEFAULT 'low',
                        confidence FLOAT DEFAULT 0.0,
                        affected_count INTEGER DEFAULT 0,
                        metrics_data TEXT DEFAULT '{}',
                        recommendations TEXT DEFAULT '[]',
                        status VARCHAR(20) DEFAULT 'active',
                        valid_until DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'analysis_notifications': '''
                    CREATE TABLE IF NOT EXISTS analysis_notifications (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        notification_type VARCHAR(50) NOT NULL,
                        title VARCHAR(200) NOT NULL,
                        content TEXT DEFAULT '',
                        related_id INTEGER,
                        related_type VARCHAR(50),
                        channel VARCHAR(20) DEFAULT 'system',
                        is_read BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                ''',
                'analysis_access_logs': '''
                    CREATE TABLE IF NOT EXISTS analysis_access_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        resource_type VARCHAR(50) NOT NULL,
                        resource_id INTEGER,
                        access_level VARCHAR(20) DEFAULT 'basic',
                        ip_address VARCHAR(45),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                ''',
            }
            for table_name, create_sql in ai_analysis_tables.items():
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
                if not cursor.fetchone():
                    cursor.execute(create_sql)
                    print(f'[DB Migration] [OK] Created table: {table_name}')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='programming_submissions'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS programming_submissions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        assessment_id INTEGER NOT NULL,
                        course_id INTEGER NOT NULL,
                        question_index INTEGER DEFAULT 0,
                        language VARCHAR(50) DEFAULT 'python',
                        code TEXT DEFAULT '',
                        standard_answer TEXT DEFAULT '',
                        score FLOAT DEFAULT 0,
                        max_score FLOAT DEFAULT 100,
                        status VARCHAR(30) DEFAULT 'pending',
                        compile_result TEXT DEFAULT '',
                        runtime_result TEXT DEFAULT '',
                        io_match_result TEXT DEFAULT '',
                        syntax_result TEXT DEFAULT '',
                        logic_result TEXT DEFAULT '',
                        efficiency_result TEXT DEFAULT '',
                        line_comparison TEXT DEFAULT '',
                        ai_feedback TEXT DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (assessment_id) REFERENCES assessments(id),
                        FOREIGN KEY (course_id) REFERENCES courses(id)
                    )
                ''')
                print('[DB Migration] [OK] Created table: programming_submissions')

            conn.commit()
            conn.close()

            print('[DB Migration] 数据库 Schema 迁移检查完成')

        except Exception as e:
            print(f'[DB Migration] [ERROR] Migration failed: {e}')

    ensure_table_columns()

    is_dev = os.environ.get('FLASK_ENV', 'development') == 'development' or app.config.get('DEBUG', False)
    if is_dev:
        from src.models.user import User

        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@eduai.com', role='admin', real_name='系统管理员')
            admin_user.set_password('admin123')
            db.session.add(admin_user)

            teacher_user = User(username='teacher', email='teacher@eduai.com', role='teacher', real_name='示例教师')
            teacher_user.set_password('teacher123')
            db.session.add(teacher_user)

            student_user = User(username='student', email='student@eduai.com', role='student', real_name='示例学生')
            student_user.set_password('student123')
            db.session.add(student_user)

            db.session.commit()
            print('Default users created in development mode:')
            print('Admin: admin/admin123')
            print('Teacher: teacher/teacher123')
            print('Student: student/student123')


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
        return 'Static folder not configured', 404

    if path != '' and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)

    index_path = os.path.join(static_folder_path, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(static_folder_path, 'index.html')
    return 'index.html not found', 404


if __name__ == '__main__':
    print(f"Environment: {os.environ.get('FLASK_ENV', 'development')}")
    print(f"Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    print(f"Pool Size: {app.config['SQLALCHEMY_ENGINE_OPTIONS'].get('pool_size')}")
    print(f"Cache Type: {app.config.get('CACHE_TYPE')}")
    print(f"Debug Mode: {app.config.get('DEBUG')}")

    # 修复：启用多线程支持SSE流式响应，避免连接中断
    app.run(host='0.0.0.0', port=5000, debug=app.config.get('DEBUG', True), threaded=True)
