import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, jsonify, send_from_directory, send_file, make_response, request
from flask_caching import Cache
from flask_cors import CORS
from werkzeug.exceptions import RequestEntityTooLarge
try:
    from flask_session import Session
except ImportError:
    Session = None

from src.config import get_config
from src.models.user import db
from src.models.token_usage import TokenUsage
from src.models.system_settings import SystemSetting
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
from src.routes.ai_tutor_routes import ai_tutor_bp
from src.routes.knowledge_base_routes import kb_bp
from src.routes.knowledge_graph_routes import knowledge_graph_bp
from src.routes.code_execution import code_execution_bp
from src.routes.content_review import content_review_bp
from src.services.websocket_service import init_socketio

config = get_config()

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config.from_object(config)
app.config['JSON_AS_ASCII'] = False
app.config['RESTFUL_JSON'] = {'ensure_ascii': False}

if Session is not None:
    Session(app)
else:
    app.logger.warning('Flask-Session is not installed; falling back to signed cookie sessions')


@app.after_request
def after_request(response):
    if response.content_type and 'charset' not in response.content_type:
        if 'application/json' in response.content_type:
            response.content_type = 'application/json; charset=utf-8'
        elif 'text/' in response.content_type:
            response.content_type = response.content_type + '; charset=utf-8'
    return response


@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(error):
    return jsonify({'error': 'File too large'}), 413


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
app.register_blueprint(ai_tutor_bp, url_prefix='/api/ai-tutor')
app.register_blueprint(kb_bp, url_prefix='/api')
app.register_blueprint(knowledge_graph_bp, url_prefix='/api')
app.register_blueprint(code_execution_bp, url_prefix='/api')
app.register_blueprint(content_review_bp, url_prefix='/api/content-review')

db.init_app(app)

# 启用 SQLite WAL 模式，解决多线程并发写入时的数据库锁定问题
with app.app_context():
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if db_uri.startswith('sqlite:///'):
        from sqlalchemy import event, text as sa_text
        @event.listens_for(db.engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'videos')
LEGACY_UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'videos')
AVATAR_UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'avatars')
LEGACY_AVATAR_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads', 'avatars')
NOTES_UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'notes')


from werkzeug.utils import secure_filename


@app.route('/uploads/videos/<filename>')
def serve_video(filename):
    safe_name = secure_filename(filename)
    if not safe_name:
        return jsonify({'error': 'Invalid filename'}), 400
    for folder in (UPLOAD_FOLDER, LEGACY_UPLOAD_FOLDER):
        file_path = os.path.join(folder, safe_name)
        if os.path.exists(file_path):
            return _serve_video_with_range(file_path, safe_name)
    return jsonify({'error': 'Video not found'}), 404


def _serve_video_with_range(file_path, filename):
    size = os.path.getsize(file_path)
    range_header = request.headers.get('Range', None)

    if filename.endswith('.webm'):
        content_type = 'video/webm'
    elif filename.endswith('.ogg'):
        content_type = 'video/ogg'
    else:
        content_type = 'video/mp4'

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
        if byte1 >= size:
            resp = make_response()
            resp.status_code = 416
            resp.headers['Content-Range'] = f'bytes */{size}'
            return resp
        byte2 = min(byte2, size - 1)
        length = byte2 - byte1 + 1

        resp = make_response()
        resp.status_code = 206
        resp.headers['Content-Range'] = f'bytes {byte1}-{byte2}/{size}'
        resp.headers['Accept-Ranges'] = 'bytes'
        resp.headers['Content-Length'] = str(length)
        resp.headers['Content-Type'] = content_type
        resp.headers['Cache-Control'] = 'public, max-age=3600'

        with open(file_path, 'rb') as f:
            f.seek(byte1)
            data = f.read(length)
        resp.data = data
        return resp

    CHUNK_SIZE = 8192
    def generate():
        with open(file_path, 'rb') as f:
            while True:
                chunk = f.read(CHUNK_SIZE)
                if not chunk:
                    break
                yield chunk

    resp = make_response(generate())
    resp.headers['Content-Type'] = content_type
    resp.headers['Accept-Ranges'] = 'bytes'
    resp.headers['Content-Length'] = str(size)
    resp.headers['Cache-Control'] = 'public, max-age=3600'
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

            cursor.execute('PRAGMA table_info(teaching_contents)')
            existing_tc_columns = {row[1] for row in cursor.fetchall()}
            tc_columns = {
                'content_type': 'VARCHAR(50) DEFAULT "lecture"',
            }
            for col_name, col_type in tc_columns.items():
                if col_name not in existing_tc_columns:
                    try:
                        cursor.execute(f'ALTER TABLE teaching_contents ADD COLUMN {col_name} {col_type}')
                        print(f'[DB Migration] [OK] Added column: teaching_contents.{col_name} ({col_type})')
                    except Exception as e:
                        print(f'[DB Migration] [WARN] Failed to add teaching_contents.{col_name}: {e}')

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

            sqlite_indexes = {
                'idx_courses_teacher_status': ('courses', 'teacher_id, status'),
                'idx_courses_category_difficulty': ('courses', 'category, difficulty'),
                'idx_courses_status_created': ('courses', 'status, created_at'),
                'idx_teaching_contents_course_created': ('teaching_contents', 'course_id, created_at'),
                'idx_teaching_contents_video': ('teaching_contents', 'video_id'),
                'idx_assessments_course_created': ('assessments', 'course_id, created_at, id'),
                'idx_assessments_recommended': ('assessments', 'is_recommended'),
                'idx_learning_progress_user_course': ('learning_progress', 'user_id, course_id'),
                'idx_learning_progress_course_accessed': ('learning_progress', 'course_id, last_accessed'),
                'idx_practice_evaluations_user_assessment': ('practice_evaluations', 'user_id, assessment_id'),
                'idx_practice_evaluations_assessment_created': ('practice_evaluations', 'assessment_id, created_at'),
                'idx_video_lessons_course_order': ('video_lessons', 'course_id, order_index, created_at'),
                'idx_video_lessons_status': ('video_lessons', 'status'),
                'idx_video_progress_user_video': ('video_progress', 'user_id, video_id'),
                'idx_course_questions_course_status': ('course_questions', 'course_id, status, created_at'),
                'idx_course_questions_user_created': ('course_questions', 'user_id, created_at'),
                'idx_course_questions_video': ('course_questions', 'video_id'),
                'idx_question_answers_question_created': ('question_answers', 'question_id, created_at'),
                'idx_question_answers_user_created': ('question_answers', 'user_id, created_at'),
                'idx_course_discussions_course_created': ('course_discussions', 'course_id, created_at'),
                'idx_course_discussions_parent': ('course_discussions', 'parent_id'),
                'idx_course_discussions_user_created': ('course_discussions', 'user_id, created_at'),
                'idx_hand_raises_course_status': ('hand_raises', 'course_id, status, created_at'),
                'idx_hand_raises_user_status': ('hand_raises', 'user_id, status'),
                'idx_study_notes_user_course': ('study_notes', 'user_id, course_id, updated_at'),
                'idx_study_notes_course_public': ('study_notes', 'course_id, is_public, created_at'),
                'idx_study_notes_video': ('study_notes', 'video_id'),
                'idx_content_bookmarks_user_course': ('content_bookmarks', 'user_id, course_id, created_at'),
                'idx_content_bookmarks_content': ('content_bookmarks', 'content_id'),
                'idx_mistake_records_user_course_status': ('mistake_records', 'user_id, course_id, mastery_status'),
                'idx_mistake_records_assessment_question': ('mistake_records', 'assessment_id, question_index'),
                'idx_mistake_records_last_mistake': ('mistake_records', 'last_mistake_at'),
                'idx_programming_submissions_user_assessment': ('programming_submissions', 'user_id, assessment_id'),
                'idx_programming_submissions_course_created': ('programming_submissions', 'course_id, created_at'),
            }
            for index_name, (table_name, columns) in sqlite_indexes.items():
                try:
                    cursor.execute(
                        f'CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns})'
                    )
                except Exception as e:
                    print(f'[DB Migration] [WARN] Failed to create index {index_name}: {e}')

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

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='targeted_question_groups'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS targeted_question_groups (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        course_id INTEGER,
                        title VARCHAR(200) DEFAULT '',
                        questions TEXT DEFAULT '[]',
                        weak_tags TEXT DEFAULT '[]',
                        difficulty VARCHAR(20) DEFAULT 'adaptive',
                        choice_count INTEGER DEFAULT 0,
                        programming_count INTEGER DEFAULT 0,
                        status VARCHAR(20) DEFAULT 'active',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id),
                        FOREIGN KEY (course_id) REFERENCES courses(id)
                    )
                ''')
                print('[DB Migration] [OK] Created table: targeted_question_groups')

            conn.commit()

            knowledge_base_tables = {
                'course_syllabuses': '''
                    CREATE TABLE IF NOT EXISTS course_syllabuses (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        course_id INTEGER NOT NULL UNIQUE REFERENCES courses(id),
                        course_code VARCHAR(30),
                        credit FLOAT DEFAULT 3.0,
                        total_hours INTEGER DEFAULT 48,
                        theory_hours INTEGER DEFAULT 32,
                        practice_hours INTEGER DEFAULT 16,
                        semester VARCHAR(20),
                        prerequisite_courses TEXT DEFAULT '[]',
                        course_objectives TEXT DEFAULT '[]',
                        assessment_methods TEXT DEFAULT '{}',
                        textbook TEXT DEFAULT '{}',
                        references TEXT DEFAULT '[]',
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'course_chapters': '''
                    CREATE TABLE IF NOT EXISTS course_chapters (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        parent_id INTEGER REFERENCES course_chapters(id),
                        title VARCHAR(200) NOT NULL,
                        description TEXT,
                        order_index INTEGER DEFAULT 0,
                        teaching_hours INTEGER DEFAULT 0,
                        chapter_type VARCHAR(20) DEFAULT 'theory',
                        objectives TEXT DEFAULT '[]',
                        key_points TEXT DEFAULT '[]',
                        difficulties TEXT DEFAULT '[]',
                        teaching_methods TEXT DEFAULT '[]',
                        status VARCHAR(20) DEFAULT 'published',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'knowledge_points': '''
                    CREATE TABLE IF NOT EXISTS knowledge_points (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        chapter_id INTEGER NOT NULL REFERENCES course_chapters(id),
                        parent_id INTEGER REFERENCES knowledge_points(id),
                        title VARCHAR(200) NOT NULL,
                        definition TEXT,
                        content TEXT,
                        order_index INTEGER DEFAULT 0,
                        difficulty_level VARCHAR(20) DEFAULT 'intermediate',
                        importance VARCHAR(20) DEFAULT 'core',
                        prerequisites TEXT DEFAULT '[]',
                        related_concepts TEXT DEFAULT '[]',
                        formulas TEXT DEFAULT '[]',
                        examples TEXT DEFAULT '[]',
                        tags TEXT DEFAULT '[]',
                        source VARCHAR(100),
                        source_url VARCHAR(500),
                        status VARCHAR(20) DEFAULT 'published',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'teaching_cases': '''
                    CREATE TABLE IF NOT EXISTS teaching_cases (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        chapter_id INTEGER NOT NULL REFERENCES course_chapters(id),
                        knowledge_point_id INTEGER REFERENCES knowledge_points(id),
                        title VARCHAR(200) NOT NULL,
                        case_type VARCHAR(30) DEFAULT 'application',
                        background TEXT,
                        problem_description TEXT,
                        analysis TEXT,
                        solution TEXT,
                        conclusion TEXT,
                        dataset_description TEXT,
                        code_example TEXT,
                        visualization TEXT DEFAULT '{}',
                        difficulty_level VARCHAR(20) DEFAULT 'intermediate',
                        tags TEXT DEFAULT '[]',
                        source VARCHAR(100),
                        source_url VARCHAR(500),
                        status VARCHAR(20) DEFAULT 'published',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'course_exercises': '''
                    CREATE TABLE IF NOT EXISTS course_exercises (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        chapter_id INTEGER NOT NULL REFERENCES course_chapters(id),
                        knowledge_point_id INTEGER REFERENCES knowledge_points(id),
                        title VARCHAR(200) NOT NULL,
                        exercise_type VARCHAR(30) DEFAULT 'choice',
                        difficulty_level VARCHAR(20) DEFAULT 'intermediate',
                        content TEXT NOT NULL,
                        options TEXT DEFAULT '[]',
                        correct_answer TEXT NOT NULL,
                        answer_analysis TEXT,
                        hints TEXT DEFAULT '[]',
                        knowledge_tags TEXT DEFAULT '[]',
                        score FLOAT DEFAULT 5.0,
                        estimated_minutes INTEGER DEFAULT 5,
                        source VARCHAR(100),
                        source_url VARCHAR(500),
                        status VARCHAR(20) DEFAULT 'published',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'knowledge_source_chunks': '''
                    CREATE TABLE IF NOT EXISTS knowledge_source_chunks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        source_type VARCHAR(40) NOT NULL DEFAULT 'syllabus',
                        source_id VARCHAR(80),
                        reference_code VARCHAR(30) NOT NULL,
                        title VARCHAR(200) NOT NULL,
                        content TEXT NOT NULL,
                        location VARCHAR(200),
                        source_url VARCHAR(500),
                        metadata_json TEXT DEFAULT '{}',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
                'knowledge_graph_nodes': '''
                    CREATE TABLE IF NOT EXISTS knowledge_graph_nodes (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        graph_id VARCHAR(80) NOT NULL,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        node_type VARCHAR(30) NOT NULL,
                        label VARCHAR(200) NOT NULL,
                        description TEXT,
                        category VARCHAR(80),
                        weight FLOAT DEFAULT 1.0,
                        source_chunk_ids TEXT DEFAULT '[]',
                        properties TEXT DEFAULT '{}',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(course_id, node_type, label)
                    )
                ''',
                'knowledge_graph_edges': '''
                    CREATE TABLE IF NOT EXISTS knowledge_graph_edges (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        graph_id VARCHAR(80) NOT NULL,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        source_node_id INTEGER NOT NULL REFERENCES knowledge_graph_nodes(id),
                        target_node_id INTEGER NOT NULL REFERENCES knowledge_graph_nodes(id),
                        edge_type VARCHAR(40) NOT NULL,
                        weight FLOAT DEFAULT 0.6,
                        confidence FLOAT DEFAULT 0.8,
                        evidence_chunk_ids TEXT DEFAULT '[]',
                        properties TEXT DEFAULT '{}',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(course_id, source_node_id, target_node_id, edge_type)
                    )
                ''',
                'generation_citations': '''
                    CREATE TABLE IF NOT EXISTS generation_citations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        package_id VARCHAR(80),
                        course_id INTEGER REFERENCES courses(id),
                        resource_type VARCHAR(40) NOT NULL,
                        source_chunk_id INTEGER REFERENCES knowledge_source_chunks(id),
                        source_type VARCHAR(40),
                        title VARCHAR(200),
                        excerpt TEXT,
                        location VARCHAR(200),
                        url VARCHAR(500),
                        confidence FLOAT DEFAULT 0.75,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''',
            }
            for table_name, create_sql in knowledge_base_tables.items():
                cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
                if not cursor.fetchone():
                    cursor.execute(create_sql)
                    print(f'[DB Migration] [OK] Created table: {table_name}')

            kb_indexes = {
                'idx_syllabuses_course': ('course_syllabuses', 'course_id'),
                'idx_chapters_course_order': ('course_chapters', 'course_id, order_index'),
                'idx_chapters_parent': ('course_chapters', 'parent_id'),
                'idx_kp_chapter': ('knowledge_points', 'chapter_id'),
                'idx_kp_course': ('knowledge_points', 'course_id'),
                'idx_kp_parent': ('knowledge_points', 'parent_id'),
                'idx_kp_difficulty': ('knowledge_points', 'difficulty_level'),
                'idx_cases_chapter': ('teaching_cases', 'chapter_id'),
                'idx_cases_course': ('teaching_cases', 'course_id'),
                'idx_cases_kp': ('teaching_cases', 'knowledge_point_id'),
                'idx_cases_type': ('teaching_cases', 'case_type'),
                'idx_exercises_chapter': ('course_exercises', 'chapter_id'),
                'idx_exercises_course': ('course_exercises', 'course_id'),
                'idx_exercises_kp': ('course_exercises', 'knowledge_point_id'),
                'idx_exercises_type_difficulty': ('course_exercises', 'exercise_type, difficulty_level'),
                'idx_ksc_course': ('knowledge_source_chunks', 'course_id'),
                'idx_ksc_type': ('knowledge_source_chunks', 'source_type'),
                'idx_ksc_ref': ('knowledge_source_chunks', 'reference_code'),
                'idx_kgn_course_type': ('knowledge_graph_nodes', 'course_id, node_type'),
                'idx_kgn_course_label': ('knowledge_graph_nodes', 'course_id, label'),
                'idx_kge_course_type': ('knowledge_graph_edges', 'course_id, edge_type'),
                'idx_kge_source': ('knowledge_graph_edges', 'source_node_id'),
                'idx_kge_target': ('knowledge_graph_edges', 'target_node_id'),
                'idx_gc_package': ('generation_citations', 'package_id'),
                'idx_gc_course': ('generation_citations', 'course_id'),
                'idx_gc_resource_type': ('generation_citations', 'resource_type'),
            }
            for index_name, (table_name, columns) in kb_indexes.items():
                try:
                    cursor.execute(
                        f'CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns})'
                    )
                except Exception as e:
                    print(f'[DB Migration] [WARN] Failed to create index {index_name}: {e}')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='content_sync_records'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE content_sync_records (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        package_id VARCHAR(64) NOT NULL,
                        course_id INTEGER NOT NULL REFERENCES courses(id),
                        teacher_id INTEGER NOT NULL REFERENCES users(id),
                        topic VARCHAR(200) DEFAULT '',
                        content_type VARCHAR(50) NOT NULL,
                        save_format VARCHAR(20) DEFAULT 'json',
                        content_snapshot TEXT,
                        teaching_content_id INTEGER REFERENCES teaching_contents(id),
                        markdown_content TEXT,
                        json_content TEXT,
                        sync_status VARCHAR(20) DEFAULT 'pending',
                        sync_progress INTEGER DEFAULT 0,
                        sync_error TEXT,
                        retry_count INTEGER DEFAULT 0,
                        max_retries INTEGER DEFAULT 3,
                        synced_at DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: content_sync_records')

            sync_indexes = {
                'idx_sync_records_package': ('content_sync_records', 'package_id'),
                'idx_sync_records_course': ('content_sync_records', 'course_id'),
                'idx_sync_records_status': ('content_sync_records', 'sync_status'),
            }
            for index_name, (table_name, columns) in sync_indexes.items():
                try:
                    cursor.execute(
                        f'CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({columns})'
                    )
                except Exception as e:
                    print(f'[DB Migration] [WARN] Failed to create index {index_name}: {e}')

            conn.commit()

            # system_settings 表
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE system_settings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        key VARCHAR(100) NOT NULL UNIQUE,
                        value TEXT DEFAULT '',
                        category VARCHAR(50) DEFAULT 'general',
                        description VARCHAR(200) DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings (key)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings (category)')
                print('[DB Migration] [OK] Created table: system_settings')

            # content_reviews 表（如果不存在）
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='content_reviews'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE content_reviews (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        content_id INTEGER NOT NULL,
                        content_type VARCHAR(30) NOT NULL,
                        content_title VARCHAR(200) DEFAULT '',
                        content_body TEXT DEFAULT '',
                        source VARCHAR(20) DEFAULT 'ai',
                        author_id INTEGER REFERENCES users(id),
                        status VARCHAR(20) DEFAULT 'pending',
                        review_mechanism VARCHAR(20) DEFAULT 'auto',
                        auto_score FLOAT,
                        auto_review_result TEXT DEFAULT '',
                        auto_reviewed_at DATETIME,
                        reviewer_id INTEGER REFERENCES users(id),
                        review_comment TEXT DEFAULT '',
                        review_score INTEGER,
                        reviewed_at DATETIME,
                        version INTEGER DEFAULT 1,
                        previous_version_id INTEGER REFERENCES content_reviews(id),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: content_reviews')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='review_rules'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE review_rules (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(100) NOT NULL,
                        rule_type VARCHAR(20) DEFAULT 'auto',
                        enabled BOOLEAN DEFAULT 1,
                        threshold FLOAT DEFAULT 60.0,
                        description TEXT DEFAULT '',
                        config TEXT DEFAULT '{}',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: review_rules')

            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='review_operation_logs'")
            if not cursor.fetchone():
                cursor.execute('''
                    CREATE TABLE review_operation_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        review_id INTEGER REFERENCES content_reviews(id),
                        operator_id INTEGER REFERENCES users(id),
                        action VARCHAR(50) NOT NULL,
                        detail TEXT DEFAULT '',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                print('[DB Migration] [OK] Created table: review_operation_logs')

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
            admin_user = User(username='admin', email='admin@zhijiaoxing.com', role='admin', real_name='系统管理员')
            admin_user.set_password('admin123')
            db.session.add(admin_user)

            teacher_user = User(username='teacher', email='teacher@zhijiaoxing.com', role='teacher', real_name='示例教师')
            teacher_user.set_password('teacher123')
            db.session.add(teacher_user)

            student_user = User(username='student', email='student@zhijiaoxing.com', role='student', real_name='示例学生')
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
    # 关闭 reloader：避免编辑代码时进程自动重启导致内存中的异步任务状态（_import_tasks）丢失
    app.run(host='0.0.0.0', port=5000, debug=app.config.get('DEBUG', True), threaded=True, use_reloader=False)
