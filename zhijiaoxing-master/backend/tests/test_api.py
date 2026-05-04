import json
import pytest
from tests.conftest import app, client, db_session, auth_session, admin_session, sample_course


class TestLessonPlanAPI:
    def test_get_sections(self, client, auth_session):
        resp = client.get('/api/lesson-plan/sections')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'sections' in data
        assert len(data['sections']) == 6

    def test_generate_requires_auth(self, client, db_session):
        resp = client.post('/api/lesson-plan/generate', json={'course_id': 1, 'topic': 'test'})
        assert resp.status_code == 401

    def test_generate_requires_params(self, client, auth_session):
        resp = client.post('/api/lesson-plan/generate', json={})
        assert resp.status_code == 400

    def test_generate_requires_teacher(self, client, db_session):
        from src.models.user import User
        from src.main import app as flask_app
        with flask_app.app_context():
            user = User(username='teststudent_lp', password='test123', role='student')
            db_session.session.add(user)
            db_session.session.commit()
            with client.session_transaction() as sess:
                sess['user_id'] = user.id
                sess['user_role'] = 'student'
        resp = client.post('/api/lesson-plan/generate', json={'course_id': 1, 'topic': 'test'})
        assert resp.status_code == 403


class TestLearningAnalyticsAPI:
    def test_class_overview_requires_auth(self, client, db_session):
        resp = client.get('/api/learning-analytics/class-overview')
        assert resp.status_code == 401

    def test_class_overview_requires_teacher(self, client, db_session):
        from src.models.user import User
        from src.main import app as flask_app
        with flask_app.app_context():
            user = User(username='teststudent_la', password='test123', role='student')
            db_session.session.add(user)
            db_session.session.commit()
            with client.session_transaction() as sess:
                sess['user_id'] = user.id
                sess['user_role'] = 'student'
        resp = client.get('/api/learning-analytics/class-overview')
        assert resp.status_code == 403

    def test_at_risk_students(self, client, auth_session):
        resp = client.get('/api/learning-analytics/at-risk-students')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'at_risk_students' in data
        assert 'total' in data


class TestAIOptimizationAPI:
    def test_usage_stats_requires_admin(self, client, auth_session):
        resp = client.get('/api/ai-optimization/usage-stats')
        assert resp.status_code == 403

    def test_usage_stats_admin(self, client, admin_session):
        resp = client.get('/api/ai-optimization/usage-stats')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'generated_content_count' in data

    def test_quality_evaluation_requires_admin(self, client, auth_session):
        resp = client.get('/api/ai-optimization/quality-evaluation')
        assert resp.status_code == 403


class TestTeacherDashboard:
    def test_stats_requires_auth(self, client, db_session):
        resp = client.get('/api/teacher/dashboard/stats')
        assert resp.status_code == 401

    def test_stats_returns_data(self, client, auth_session):
        resp = client.get('/api/teacher/dashboard/stats')
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'stats' in data

    def test_student_progress(self, client, auth_session):
        resp = client.get('/api/teacher/analytics/student-progress')
        assert resp.status_code == 200

    def test_weekly_activity(self, client, auth_session):
        resp = client.get('/api/teacher/analytics/weekly-activity')
        assert resp.status_code == 200

    def test_learning_trend(self, client, auth_session):
        resp = client.get('/api/teacher/analytics/learning-trend')
        assert resp.status_code == 200

    def test_recent_activities(self, client, auth_session):
        resp = client.get('/api/teacher/recent-activities')
        assert resp.status_code == 200
