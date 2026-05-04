import pytest
import json
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def app():
    os.environ.setdefault('FLASK_ENV', 'testing')
    from src.main import app
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['CACHE_TYPE'] = 'NullCache'
    app.config['WTF_CSRF_ENABLED'] = False
    app.config['SECRET_KEY'] = 'test-secret-key'
    return app


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db_session(app):
    from src.models.user import db as _db
    with app.app_context():
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
