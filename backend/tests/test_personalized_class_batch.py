import json


def _class_scope(db, teacher_id, with_second_profile=True):
    from src.models.user import User, ClassGroup, ClassGroupStudent, ClassGroupCourse
    from src.models.course import Course
    from src.models.student_profile import StudentProfile

    course = Course(title="Python班级课", description="batch", teacher_id=teacher_id)
    group = ClassGroup(name="软件一班", teacher_id=teacher_id)
    first = User(username="batch_visual", password="test123", role="student", real_name="张三")
    second = User(username="batch_practice", password="test123", role="student", real_name="李四")
    db.session.add_all([course, group, first, second])
    db.session.flush()
    db.session.add_all([
        ClassGroupCourse(class_group_id=group.id, course_id=course.id),
        ClassGroupStudent(class_group_id=group.id, user_id=first.id, student_name="张三"),
        ClassGroupStudent(class_group_id=group.id, user_id=second.id, student_name="李四"),
        StudentProfile(
            user_id=first.id, cognitive_style="visual", learning_pace="slow",
            knowledge_base=json.dumps({"Python循环": 55}), confidence_score=70,
        ),
    ])
    if with_second_profile:
        db.session.add(StudentProfile(
            user_id=second.id, cognitive_style="kinesthetic", learning_pace="fast",
            knowledge_base=json.dumps({"Python循环": 80}), confidence_score=75,
        ))
    db.session.commit()
    return group, course, first, second


def _payload(group, course):
    return {
        "class_id": group.id, "course_id": course.id, "topic": "Python循环",
        "knowledge_points": ["for循环", "range边界"],
        "required_resource_types": ["document", "layered_exercise"],
    }


def test_class_batch_preflight_blocks_missing_profile(client, db_session, auth_session):
    group, course, _first, second = _class_scope(db_session, auth_session.id, with_second_profile=False)
    response = client.post("/api/resource-generation/class-batches/preflight", json=_payload(group, course))
    assert response.status_code == 200
    preflight = response.get_json()["preflight"]
    assert preflight["student_count"] == 2
    assert preflight["diagnostic_required_count"] == 1
    assert next(item for item in preflight["students"] if item["student_user_id"] == second.id)["profile_ready"] is False

    created = client.post("/api/resource-generation/class-batches", json=_payload(group, course))
    assert created.status_code == 201
    batch = created.get_json()["batch"]
    assert batch["state"] == "WAITING_PROFILE"
    blocked = client.post(f"/api/resource-generation/class-batches/{batch['batch_id']}/generate")
    assert blocked.status_code == 409
    assert blocked.get_json()["code"] == "PROFILES_NOT_READY"


def test_class_batch_generates_distinct_workflows_and_publishes_together(
    client, db_session, auth_session, monkeypatch
):
    from src.services.spark_service import spark_service
    from src.models.personalized_workflow import PersonalizedWorkflow
    from src.models.personalized_learning import PersonalizedTaskDelivery

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, first, second = _class_scope(db_session, auth_session.id)
    created = client.post("/api/resource-generation/class-batches", json=_payload(group, course))
    assert created.status_code == 201
    batch_id = created.get_json()["batch"]["batch_id"]

    generated = client.post(f"/api/resource-generation/class-batches/{batch_id}/generate")
    assert generated.status_code == 200
    batch = generated.get_json()["batch"]
    assert batch["state"] == "READY_TO_PUBLISH"
    assert batch["generated_count"] == 2
    assert PersonalizedWorkflow.query.count() == 2
    items = {item["student_user_id"]: item for item in batch["items"]}
    assert items[first.id]["workflow_id"] != items[second.id]["workflow_id"]
    assert "mindmap" in items[first.id]["resource_types"]
    assert "media" in items[first.id]["resource_types"]
    assert "project" in items[second.id]["resource_types"]
    assert all(item["review_passed"] for item in items.values())

    published = client.post(f"/api/resource-generation/class-batches/{batch_id}/publish", json={
        "title": "循环个性化学习任务"
    })
    assert published.status_code == 200
    result = published.get_json()["batch"]
    assert result["state"] == "PUBLISHED"
    assert result["published_count"] == 2
    assert PersonalizedTaskDelivery.query.count() == 2


def test_class_batch_is_owner_isolated(client, db_session, auth_session):
    from src.models.user import User

    group, course, _first, _second = _class_scope(db_session, auth_session.id)
    batch_id = client.post("/api/resource-generation/class-batches", json=_payload(group, course)).get_json()["batch"]["batch_id"]
    outsider = User(username="batch_outsider", password="test123", role="teacher")
    db_session.session.add(outsider)
    db_session.session.commit()
    with client.session_transaction() as sess:
        sess["user_id"] = outsider.id
        sess["user_role"] = "teacher"
    assert client.get(f"/api/resource-generation/class-batches/{batch_id}").status_code == 404
    assert client.post("/api/resource-generation/class-batches/preflight", json=_payload(group, course)).status_code == 403
