import json
from datetime import datetime, timedelta


def _login(client, user):
    with client.session_transaction() as sess:
        sess["user_id"] = user.id
        sess["user_role"] = user.role
        sess["username"] = user.username


def _scope(db_session, teacher, suffix):
    from src.models.course import Course
    from src.models.user import ClassGroup, User

    student = User(username=f"p4_student_{suffix}", password="test123", role="student")
    course = Course(title=f"P4课程{suffix}", description="测试", teacher_id=teacher.id)
    group = ClassGroup(name=f"P4班级{suffix}", teacher_id=teacher.id)
    db_session.session.add_all([student, course, group])
    db_session.session.flush()
    return student, course, group


def _delivery(db_session, teacher, student, course, group, suffix, due_at=None, status="PUBLISHED"):
    from src.models.personalized_learning import PersonalizedTaskDelivery
    from src.models.personalized_workflow import PersonalizedWorkflow

    workflow = PersonalizedWorkflow(
        workflow_id=f"wf_p4_{suffix}", owner_id=teacher.id, course_id=course.id,
        class_id=group.id, student_user_id=student.id, state="PUBLISHED",
        mode="personalized", topic=f"主题{suffix}", payload_json="{}",
        generation_json=json.dumps({"generation_source_label": "Spark AI"}),
        completed_at=datetime.utcnow(),
    )
    delivery = PersonalizedTaskDelivery(
        delivery_id=f"dlv_p4_{suffix}", workflow_id=workflow.workflow_id,
        owner_id=teacher.id, course_id=course.id, class_id=group.id,
        student_user_id=student.id, status=status, title=f"任务{suffix}",
        resource_snapshot_json="{}", strategy_snapshot_json="{}", baseline_snapshot_json="{}",
        completion_rules_json="{}", idempotency_key=f"p4:{suffix}", due_at=due_at,
    )
    db_session.session.add_all([workflow, delivery])
    db_session.session.flush()
    return delivery


def test_due_notifications_are_idempotent_and_student_scoped(client, db_session, auth_session):
    from src.services.personalized_notification_service import personalized_notification_service

    student, course, group = _scope(db_session, auth_session, "due")
    now = datetime.utcnow()
    delivery = _delivery(
        db_session, auth_session, student, course, group, "due",
        due_at=now + timedelta(hours=2),
    )
    other_student, _, _ = _scope(db_session, auth_session, "other")
    _delivery(db_session, auth_session, other_student, course, group, "other", due_at=now - timedelta(hours=1))
    db_session.session.commit()

    first = personalized_notification_service.run_due_reminders(now)
    second = personalized_notification_service.run_due_reminders(now)
    assert first["created_count"] == 2
    assert second["created_count"] == 0
    assert second["repeated_count"] == 2

    _login(client, student)
    response = client.get("/api/student/personalized-notifications")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["unread_count"] == 1
    assert payload["notifications"][0]["delivery_id"] == delivery.delivery_id

    notification_id = payload["notifications"][0]["id"]
    read = client.post(f"/api/student/personalized-notifications/{notification_id}/read")
    assert read.status_code == 200
    assert read.get_json()["notification"]["is_read"] is True

    _login(client, other_student)
    forbidden = client.post(f"/api/student/personalized-notifications/{notification_id}/read")
    assert forbidden.status_code == 404


def test_manual_reminders_are_owned_and_daily_idempotent(client, db_session, auth_session):
    from src.models.user import User

    student, course, group = _scope(db_session, auth_session, "manual")
    owned = _delivery(db_session, auth_session, student, course, group, "manual")
    other_teacher = User(username="p4_other_teacher", password="test123", role="teacher")
    db_session.session.add(other_teacher)
    db_session.session.flush()
    outsider, other_course, other_group = _scope(db_session, other_teacher, "foreign")
    foreign = _delivery(db_session, other_teacher, outsider, other_course, other_group, "foreign")
    db_session.session.commit()

    data = {"delivery_ids": [owned.delivery_id, foreign.delivery_id]}
    first = client.post("/api/personalized-deliveries/bulk-remind", json=data)
    assert first.status_code == 200
    assert first.get_json()["created_count"] == 1
    assert first.get_json()["skipped_count"] == 1

    repeated = client.post("/api/personalized-deliveries/bulk-remind", json=data)
    assert repeated.get_json()["created_count"] == 0


def test_metrics_dashboard_is_real_and_role_scoped(client, db_session, auth_session, admin_session):
    student, course, group = _scope(db_session, auth_session, "metrics")
    _delivery(db_session, auth_session, student, course, group, "metrics")
    db_session.session.commit()

    _login(client, auth_session)
    teacher_response = client.get("/api/metrics/dashboard?days=30")
    assert teacher_response.status_code == 200
    teacher_payload = teacher_response.get_json()
    assert teacher_payload["scope"] == "teacher"
    assert teacher_payload["workflow"]["generation_total"] == 1
    assert isinstance(teacher_payload["runtime"]["p95_response_ms"], (int, float))
    assert "scheduler" in teacher_payload
    assert client.get("/api/metrics/prometheus").status_code == 403

    _login(client, admin_session)
    admin_response = client.get("/api/metrics/dashboard")
    assert admin_response.status_code == 200
    assert admin_response.get_json()["scope"] == "system"
    assert client.get("/api/metrics/prometheus").status_code == 200


def test_health_reports_scheduler_degradation_without_failing_core(client, db_session, admin_session):
    # /api/metrics/health 暴露数据库可用性与调度器状态，属运维信息，
    # 上一轮巡检已把该端点收敛为 admin-only（原匿名 200 是 SEC 问题）。
    # 本测试的目的是"调度器降级不影响核心可用性"，因此必须带管理员身份访问。
    _login(client, admin_session)
    response = client.get("/api/metrics/health")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["database"]["available"] is True
    assert payload["status"] in ("healthy", "degraded")
    assert isinstance(payload["scheduler"]["enabled"], bool)
