import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def app():
    # 强制覆盖环境变量，防止已有 FLASK_ENV=development 导致连接生产数据库
    os.environ['FLASK_ENV'] = 'testing'
    os.environ['TEST_DATABASE_URL'] = 'sqlite:///:memory:'
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

    # 如果src.main已被缓存，先删除缓存以确保重新加载配置
    for mod_name in list(sys.modules.keys()):
        if mod_name.startswith('src.main') or mod_name == 'src.config':
            del sys.modules[mod_name]

    from src.main import app
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['CACHE_TYPE'] = 'NullCache'
    app.config['WTF_CSRF_ENABLED'] = False
    app.config['SECRET_KEY'] = 'test-secret-key'

    # 强制覆盖数据库URI为内存数据库（防止类级别属性已被求值）
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    # 重新初始化SQLAlchemy引擎以应用新的URI
    from src.models.user import db as _db
    if hasattr(_db, 'engine'):
        _db.engine.dispose()
    _db.init_app(app)

    # 安全检查：确保测试不会连接生产数据库
    db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if 'sqlite' in db_uri.lower() and ':memory:' not in db_uri:
        raise RuntimeError(
            f"安全检查失败：测试数据库URI指向文件数据库而非内存数据库: {db_uri}\n"
            "这可能导致生产数据被drop_all()清空！请检查config.py配置。"
        )
    if 'dev.db' in db_uri:
        raise RuntimeError(
            f"安全检查失败：测试数据库URI包含dev.db: {db_uri}\n"
            "禁止在测试中连接生产数据库！"
        )
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db_session(app):
    from src.models.user import db as _db
    with app.app_context():
        # 二次安全检查：确认数据库是内存数据库
        db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if ':memory:' not in db_uri:
            raise RuntimeError(
                f"安全检查失败：db_session fixture检测到非内存数据库: {db_uri}\n"
                "drop_all()被阻止以保护生产数据！"
            )
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def auth_session(client, db_session):
    from src.models.user import User
    from src.main import app
    with app.app_context():
        user = User(username='testteacher', password='test123', role='teacher', real_name='Test Teacher')
        db_session.session.add(user)
        db_session.session.commit()
        with client.session_transaction() as sess:
            sess['user_id'] = user.id
            sess['user_role'] = 'teacher'
            sess['username'] = 'testteacher'
        yield user


@pytest.fixture
def admin_session(client, db_session):
    from src.models.user import User
    from src.main import app
    with app.app_context():
        user = User(username='testadmin', password='test123', role='admin', real_name='Test Admin')
        db_session.session.add(user)
        db_session.session.commit()
        with client.session_transaction() as sess:
            sess['user_id'] = user.id
            sess['user_role'] = 'admin'
            sess['username'] = 'testadmin'
        yield user


@pytest.fixture
def sample_course(auth_session, db_session):
    from src.models.course import Course
    from src.main import app
    with app.app_context():
        course = Course(title='测试课程', description='测试课程描述', teacher_id=auth_session.id)
        db_session.session.add(course)
        db_session.session.commit()
        return course
