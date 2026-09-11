import json
from datetime import datetime, timedelta


def _login(client, user):
    with client.session_transaction() as sess:
        sess["user_id"] = user.id
        sess["user_role"] = user.role
        sess["username"] = user.username


def _build_scope(db_session, teacher, suffix="ops"):
    from src.models.course import Course
    from src.models.user import User, ClassGroup

    student = User(
        username=f"student_{suffix}", password="test123", role="student",
        real_name=f"学生{suffix}",
    )
    course = Course(title=f"Python课程{suffix}", description="测试", teacher_id=teacher.id)
    group = ClassGroup(name=f"软件班{suffix}", teacher_id=teacher.id)
    db_session.session.add_all([student, course, group])
    db_session.session.flush()
    return student, course, group


def _delivery(db_session, teacher, student, course, group, suffix, status="PUBLISHED", due_at=None):
    from src.models.personalized_workflow import PersonalizedWorkflow
    from src.models.personalized_learning import PersonalizedTaskDelivery

    workflow = PersonalizedWorkflow(
        workflow_id=f"wf_ops_{suffix}", owner_id=teacher.id, course_id=course.id,
        class_id=group.id, student_user_id=student.id, state="PUBLISHED",
        mode="personalized", topic=f"循环任务{suffix}", payload_json="{}",
    )
    item = PersonalizedTaskDelivery(
        delivery_id=f"dlv_ops_{suffix}", workflow_id=workflow.workflow_id,
        owner_id=teacher.id, course_id=course.id, class_id=group.id,
        student_user_id=student.id, status=status, title=f"循环任务{suffix}",
        instructions=f"完成第{suffix}组练习", resource_snapshot_json="{}",
        strategy_snapshot_json="{}", baseline_snapshot_json="{}",
        completion_rules_json=json.dumps({"required_resource_keys": []}),
        idempotency_key=f"ops:{suffix}:{student.id}", due_at=due_at,
        published_at=datetime.utcnow() - timedelta(hours=1),
    )
    db_session.session.add_all([workflow, item])
    db_session.session.flush()
    return item


def test_teacher_delivery_list_supports_search_filters_and_pagination(
    client, db_session, auth_session
):
    from src.models.user import User

    student, course, group = _build_scope(db_session, auth_session, "list")
    first = _delivery(
        db_session, auth_session, student, course, group, "alpha",
        due_at=datetime.utcnow() + timedelta(hours=2),
    )
    _delivery(
        db_session, auth_session, student, course, group, "beta",
        status="IN_PROGRESS", due_at=datetime.utcnow() - timedelta(hours=2),
    )
    other_teacher = User(username="ops_other_teacher", password="test123", role="teacher")
    db_session.session.add(other_teacher)
    db_session.session.flush()
    outsider, other_course, other_group = _build_scope(db_session, other_teacher, "outsider")
    _delivery(db_session, other_teacher, outsider, other_course, other_group, "outsider")
    db_session.session.commit()

    response = client.get("/api/personalized-deliveries?page=1&page_size=1")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["count"] == 1
    assert payload["pagination"]["total"] == 2
    assert payload["pagination"]["pages"] == 2
    assert payload["deliveries"][0]["student_name"] == "学生list"
    assert payload["deliveries"][0]["course_title"] == course.title

    searched = client.get(f"/api/personalized-deliveries?q=alpha&course_id={course.id}")
    assert searched.status_code == 200
    assert [item["delivery_id"] for item in searched.get_json()["deliveries"]] == [first.delivery_id]

    overdue = client.get("/api/personalized-deliveries?due_status=overdue")
    assert overdue.get_json()["pagination"]["total"] == 1
    assert overdue.get_json()["deliveries"][0]["due_status"] == "overdue"


def test_student_list_is_isolated_and_can_filter_due_status(client, db_session, auth_session):
    student, course, group = _build_scope(db_session, auth_session, "student_list")
    overdue = _delivery(
        db_session, auth_session, student, course, group, "student_overdue",
        status="WAITING_ASSESSMENT", due_at=datetime.utcnow() - timedelta(minutes=5),
    )
    other_student, _, _ = _build_scope(db_session, auth_session, "other_student")
    _delivery(db_session, auth_session, other_student, course, group, "other_student")
    db_session.session.commit()

    _login(client, student)
    response = client.get("/api/student/personalized-deliveries?due_status=overdue&page_size=10")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["pagination"]["total"] == 1
    assert payload["deliveries"][0]["delivery_id"] == overdue.delivery_id
    assert all(item["student_user_id"] == student.id for item in payload["deliveries"])


def test_bulk_pause_resume_is_permission_scoped_and_idempotent(
    client, db_session, auth_session
):
    from src.models.user import User
    from src.models.personalized_learning import PersonalizedTaskDelivery, PersonalizedDeliveryEvent

    student, course, group = _build_scope(db_session, auth_session, "bulk")
    active = _delivery(db_session, auth_session, student, course, group, "bulk_active", status="IN_PROGRESS")
    completed = _delivery(db_session, auth_session, student, course, group, "bulk_done", status="CYCLE_COMPLETED")
    other_teacher = User(username="bulk_other_teacher", password="test123", role="teacher")
    db_session.session.add(other_teacher)
    db_session.session.flush()
    outsider, other_course, other_group = _build_scope(db_session, other_teacher, "bulk_outsider")
    foreign = _delivery(db_session, other_teacher, outsider, other_course, other_group, "bulk_foreign")
    db_session.session.commit()

    request_data = {
        "action": "pause",
        "delivery_ids": [active.delivery_id, completed.delivery_id, foreign.delivery_id],
    }
    paused = client.post("/api/personalized-deliveries/bulk-state", json=request_data)
    assert paused.status_code == 200
    result = paused.get_json()
    assert result["changed_count"] == 1
    assert result["skipped_count"] == 2
    assert PersonalizedTaskDelivery.query.get(active.delivery_id).status == "PAUSED"
    assert PersonalizedTaskDelivery.query.get(foreign.delivery_id).status == "PUBLISHED"
    assert PersonalizedDeliveryEvent.query.filter_by(
        delivery_id=active.delivery_id, event_type="task_paused"
    ).count() == 1

    repeated = client.post("/api/personalized-deliveries/bulk-state", json=request_data)
    assert repeated.get_json()["changed_count"] == 0
    assert PersonalizedDeliveryEvent.query.filter_by(
        delivery_id=active.delivery_id, event_type="task_paused"
    ).count() == 1

    resumed = client.post("/api/personalized-deliveries/bulk-state", json={
        "action": "resume", "delivery_ids": [active.delivery_id],
    })
    assert resumed.get_json()["changed_count"] == 1
    assert PersonalizedTaskDelivery.query.get(active.delivery_id).status == "IN_PROGRESS"


def test_invalid_delivery_filters_return_clear_error(client, auth_session):
    response = client.get("/api/personalized-deliveries?status=unknown")
    assert response.status_code == 400
    assert response.get_json()["code"] == "DELIVERY_FILTER_INVALID"

    bulk = client.post("/api/personalized-deliveries/bulk-state", json={
        "action": "delete", "delivery_ids": ["dlv_unknown"],
    })
    assert bulk.status_code == 400
    assert bulk.get_json()["code"] == "BULK_ACTION_INVALID"

    empty_ids = client.post("/api/personalized-deliveries/bulk-state", json={
        "action": "pause", "delivery_ids": ["", "   "],
    })
    assert empty_ids.status_code == 400
    assert empty_ids.get_json()["code"] == "BULK_DELIVERY_IDS_INVALID"
