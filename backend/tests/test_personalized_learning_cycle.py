import json


def _scope(db_session, teacher_id, suffix="cycle"):
    from src.models.user import User, ClassGroup, ClassGroupStudent, ClassGroupCourse
    from src.models.course import Course

    student = User(username=f"student_{suffix}", password="test123", role="student")
    course = Course(title=f"课程{suffix}", description="测试", teacher_id=teacher_id)
    group = ClassGroup(name=f"班级{suffix}", teacher_id=teacher_id)
    db_session.session.add_all([student, course, group])
    db_session.session.flush()
    db_session.session.add_all([
        ClassGroupStudent(class_group_id=group.id, user_id=student.id, student_name="测试学生"),
        ClassGroupCourse(class_group_id=group.id, course_id=course.id),
    ])
    db_session.session.commit()
    return group, course, student


def _ready_workflow(db_session, teacher_id, group, course, student, suffix="cycle"):
    from src.models.personalized_workflow import PersonalizedWorkflow
    from src.services.personalized_workflow_service import workflow_store

    payload = {
        "course_id": course.id,
        "class_id": group.id,
        "student_user_id": student.id,
        "topic": "Python循环",
        "knowledge_points": ["for循环"],
        "resource_types": ["document", "layered_exercise"],
        "mode": "general",
        "profile_snapshot": {"profile": {}, "student": {"name": "测试学生"}},
        "selected_evidence": [],
        "strategy": {"summary": "先讲解再练习", "learning_sequence": ["讲解", "练习"]},
    }
    workflow = workflow_store.create(teacher_id, payload)
    item = PersonalizedWorkflow.query.filter_by(workflow_id=workflow["workflow_id"]).one()
    resources = {
        "document": {"title": "循环讲义", "content": "讲解Python for循环的规则和示例。"},
        "layered_exercise": {
            "title": "循环练习",
            "questions": [{"question": "说明for循环规则", "answer": "按序迭代", "explanation": "检查for循环理解"}],
        },
    }
    item.state = "READY_TO_PUBLISH"
    item.generation_json = json.dumps({"resources": resources}, ensure_ascii=False)
    item.review_json = json.dumps({"can_submit": True}, ensure_ascii=False)
    db_session.session.commit()
    return item


def _login(client, user):
    with client.session_transaction() as sess:
        sess["user_id"] = user.id
        sess["user_role"] = user.role
        sess["username"] = user.username


def _publish(client, workflow_id):
    return client.post(f"/api/resource-generation/workflow/{workflow_id}/publish", json={
        "title": "循环个性化任务",
        "required_resource_keys": ["document", "layered_exercise"],
    })


def _bound_assessment_id(response):
    return response.get_json()["delivery"]["completion_rules"]["assessment_id"]


def test_publish_student_progress_and_insufficient_cycle_are_persistent(
    client, db_session, auth_session, monkeypatch
):
    from src.models.personalized_learning import PersonalizedTaskDelivery, PersonalizedDeliveryEvent, PersonalizedLearningCycle
    from src.models.personalized_workflow import PersonalizedWorkflow
    from src.models.student_profile import StudentProfile
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "basic")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "basic")

    first = _publish(client, workflow.workflow_id)
    repeated = _publish(client, workflow.workflow_id)
    assert first.status_code == repeated.status_code == 200
    assert repeated.get_json()["already_published"] is True
    assert PersonalizedTaskDelivery.query.count() == 1
    from src.models.course import Assessment
    assert Assessment.query.count() == 1
    assessment = Assessment.query.get(_bound_assessment_id(first))
    questions = json.loads(assessment.questions)
    assert assessment.generated_by_llm is True
    assert assessment.is_recommended is True
    assert questions and all(question.get("correctAnswer") is not None for question in questions)
    delivery_id = first.get_json()["delivery"]["delivery_id"]

    _login(client, student)
    assert client.get("/api/student/personalized-deliveries").get_json()["count"] == 1
    assert client.post(f"/api/student/personalized-deliveries/{delivery_id}/start").status_code == 200
    for resource_key in ("document", "layered_exercise"):
        payload = {"resource_key": resource_key, "idempotency_key": f"complete-{resource_key}"}
        complete = client.post(f"/api/student/personalized-deliveries/{delivery_id}/complete-resource", json=payload)
        duplicate = client.post(f"/api/student/personalized-deliveries/{delivery_id}/complete-resource", json=payload)
        assert complete.status_code == duplicate.status_code == 200
        assert duplicate.get_json()["already_recorded"] is True

    delivery = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id).one()
    assert delivery.status == "WAITING_ASSESSMENT"
    assert delivery.progress_percentage == 100
    before_profiles = StudentProfile.query.count()
    analyzed = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment")
    assert analyzed.status_code == 200
    cycle = analyzed.get_json()["cycle"]
    assert cycle["feedback"]["learning_effect"] == "evidence_insufficient"
    assert cycle["profile_after"]["permanent_profile_updated"] is False
    assert StudentProfile.query.count() == before_profiles
    assert PersonalizedLearningCycle.query.count() == 1
    assert PersonalizedDeliveryEvent.query.filter_by(event_type="resource_completed").count() == 2
    assert PersonalizedWorkflow.query.filter_by(workflow_id=cycle["next_workflow_id"]).one().state == "DRAFT"
    assert PersonalizedWorkflow.query.filter_by(workflow_id=workflow.workflow_id).one().state == "COMPLETED"
    repeated = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment")
    assert repeated.status_code == 200
    assert repeated.get_json()["already_analyzed"] is True
    assert PersonalizedLearningCycle.query.count() == 1


def test_real_assessment_evidence_produces_high_confidence_cycle(
    client, db_session, auth_session, monkeypatch
):
    from src.models.course import Assessment, PracticeEvaluation, ProgrammingSubmission
    from src.models.student_profile import StudentProfile
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "evidence")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "evidence")
    published = _publish(client, workflow.workflow_id)
    delivery_id = published.get_json()["delivery"]["delivery_id"]
    assessment = Assessment.query.get(_bound_assessment_id(published))
    _login(client, student)
    client.post(f"/api/student/personalized-deliveries/{delivery_id}/start")
    for resource_key in ("document", "layered_exercise"):
        client.post(f"/api/student/personalized-deliveries/{delivery_id}/complete-resource", json={
            "resource_key": resource_key, "idempotency_key": f"evidence-{resource_key}",
        })

    profile = StudentProfile(
        user_id=student.id,
        cognitive_style="visual",
        learning_pace="slow",
        goal_orientation="career",
        interaction_preference="exploratory",
    )
    db_session.session.add(profile)
    practices = [
        PracticeEvaluation(user_id=student.id, assessment_id=assessment.id, user_answer="{}", score=score)
        for score in (82, 88, 90)
    ]
    submissions = [
        ProgrammingSubmission(
            user_id=student.id, assessment_id=assessment.id, course_id=course.id,
            score=score, max_score=100, status="passed", code="for i in range(3): pass",
        ) for score in (85, 92)
    ]
    db_session.session.add_all(practices + submissions)
    db_session.session.commit()

    response = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment", json={
        "evidence_ids": {
            "practice_evaluation_ids": [row.id for row in practices],
            "programming_submission_ids": [row.id for row in submissions],
        }
    })
    assert response.status_code == 200
    cycle = response.get_json()["cycle"]
    assert cycle["feedback"]["learning_effect"] == "clearly_improved"
    assert cycle["review"]["high_confidence"] is True
    assert cycle["confidence_score"] >= 80
    assert cycle["evidence"]["assessment_scope"] == {
        "mode": "exact", "assessment_ids": [assessment.id]
    }
    assert set(cycle["evidence"]["sources"]["practice_evaluation_ids"])
    assert set(cycle["evidence"]["sources"]["programming_submission_ids"])
    assert "迁移练习" in cycle["next_strategy"]["learning_sequence"]
    db_session.session.refresh(profile)
    assert cycle["profile_after"]["permanent_profile_updated"] is True
    assert profile.update_source == "verified_learning_cycle"
    assert profile.get_knowledge_base()["_verified_learning_cycles"]
    assert profile.cognitive_style == "visual"
    assert profile.learning_pace == "slow"
    assert profile.goal_orientation == "career"
    assert profile.interaction_preference == "exploratory"
    from src.models.personalized_workflow import PersonalizedWorkflow
    next_workflow = PersonalizedWorkflow.query.get(cycle["next_workflow_id"]).to_dict()
    next_profile = next_workflow["payload"]["profile_snapshot"]
    assert next_profile["source"] == "verified_learning_cycle"
    assert next_profile["source_cycle_id"] == cycle["cycle_id"]
    assert next_profile["profile"]["knowledge_base"]["_verified_learning_cycles"]


def test_assessment_binding_rejects_another_students_record(
    client, db_session, auth_session, monkeypatch
):
    from src.models.course import Assessment, PracticeEvaluation
    from src.models.user import User
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "bound")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "bound")
    delivery_id = _publish(client, workflow.workflow_id).get_json()["delivery"]["delivery_id"]
    _login(client, student)
    client.post(f"/api/student/personalized-deliveries/{delivery_id}/start")
    for resource_key in ("document", "layered_exercise"):
        client.post(f"/api/student/personalized-deliveries/{delivery_id}/complete-resource", json={
            "resource_key": resource_key, "idempotency_key": f"bound-{resource_key}",
        })

    outsider = User(username="assessment_outsider", password="test123", role="student")
    assessment = Assessment(course_id=course.id, title="其他学生检测", questions="[]")
    db_session.session.add_all([outsider, assessment])
    db_session.session.flush()
    foreign_result = PracticeEvaluation(
        user_id=outsider.id, assessment_id=assessment.id, user_answer="{}", score=100
    )
    db_session.session.add(foreign_result)
    db_session.session.commit()

    response = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment", json={
        "evidence_ids": {"practice_evaluation_ids": [foreign_result.id]}
    })
    assert response.status_code == 403
    assert response.get_json()["code"] == "ASSESSMENT_EVIDENCE_FORBIDDEN"


def test_assessment_binding_rejects_same_student_record_from_another_assessment(
    client, db_session, auth_session, monkeypatch
):
    from src.models.course import Assessment, PracticeEvaluation
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "wrong_assessment")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "wrong_assessment")
    published = _publish(client, workflow.workflow_id)
    delivery_id = published.get_json()["delivery"]["delivery_id"]
    expected_id = _bound_assessment_id(published)
    _login(client, student)
    client.post(f"/api/student/personalized-deliveries/{delivery_id}/start")
    for resource_key in ("document", "layered_exercise"):
        client.post(f"/api/student/personalized-deliveries/{delivery_id}/complete-resource", json={
            "resource_key": resource_key, "idempotency_key": f"wrong-{resource_key}",
        })

    unrelated = Assessment(course_id=course.id, title="同课程其他测评", questions="[]")
    db_session.session.add(unrelated)
    db_session.session.flush()
    result = PracticeEvaluation(
        user_id=student.id, assessment_id=unrelated.id, user_answer="{}", score=100
    )
    db_session.session.add(result)
    db_session.session.commit()

    response = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment", json={
        "evidence_ids": {"practice_evaluation_ids": [result.id]}
    })
    assert unrelated.id != expected_id
    assert response.status_code == 403
    assert response.get_json()["code"] == "ASSESSMENT_EVIDENCE_FORBIDDEN"


def test_delivery_permissions_isolate_teacher_and_student(client, db_session, auth_session, monkeypatch):
    from src.models.user import User
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "permission")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "permission")
    published = _publish(client, workflow.workflow_id)
    delivery_id = published.get_json()["delivery"]["delivery_id"]
    outsider = User(username="delivery_outsider", password="test123", role="student")
    other_teacher = User(username="delivery_other_teacher", password="test123", role="teacher")
    db_session.session.add_all([outsider, other_teacher])
    db_session.session.commit()

    _login(client, outsider)
    assert client.get(f"/api/student/personalized-deliveries/{delivery_id}").status_code == 404
    assert client.post(f"/api/student/personalized-deliveries/{delivery_id}/start").status_code == 404
    _login(client, other_teacher)
    assert client.get(f"/api/personalized-deliveries/{delivery_id}").status_code == 404
    assert client.post(f"/api/personalized-deliveries/{delivery_id}/analyze").status_code == 404


def test_publish_rechecks_current_class_membership(client, db_session, auth_session, monkeypatch):
    from src.models.user import ClassGroupStudent
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "removed")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "removed")
    ClassGroupStudent.query.filter_by(class_group_id=group.id, user_id=student.id).delete()
    db_session.session.commit()

    response = _publish(client, workflow.workflow_id)
    assert response.status_code == 403
    assert response.get_json()["code"] == "STUDENT_NOT_IN_CLASS"


def test_conflicting_assessment_evidence_keeps_profile_in_review(
    client, db_session, auth_session, monkeypatch
):
    from src.models.course import Assessment, PracticeEvaluation, ProgrammingSubmission
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "conflict")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "conflict")
    published = _publish(client, workflow.workflow_id)
    delivery_id = published.get_json()["delivery"]["delivery_id"]
    assessment = Assessment.query.get(_bound_assessment_id(published))
    _login(client, student)
    client.post(f"/api/student/personalized-deliveries/{delivery_id}/start")
    for resource_key in ("document", "layered_exercise"):
        client.post(f"/api/student/personalized-deliveries/{delivery_id}/complete-resource", json={
            "resource_key": resource_key, "idempotency_key": f"conflict-{resource_key}",
        })
    practices = [PracticeEvaluation(user_id=student.id, assessment_id=assessment.id, user_answer="{}", score=score) for score in (88, 92, 90)]
    submissions = [ProgrammingSubmission(
        user_id=student.id, assessment_id=assessment.id, course_id=course.id,
        score=20, max_score=100, status="failed", code="pass",
    ) for _ in range(2)]
    db_session.session.add_all(practices + submissions)
    db_session.session.commit()
    response = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment", json={
        "evidence_ids": {
            "practice_evaluation_ids": [row.id for row in practices],
            "programming_submission_ids": [row.id for row in submissions],
        }
    })
    assert response.status_code == 200
    cycle = response.get_json()["cycle"]
    assert cycle["feedback"]["learning_effect"] == "evidence_conflict"
    assert cycle["review"]["decision"] == "conflict_review"
    assert cycle["review"]["high_confidence"] is False
    assert cycle["profile_after"]["cycle_observations"] == []
    assert "短检测" in cycle["next_strategy"]["learning_sequence"]

    _login(client, auth_session)
    feedback = client.get(f"/api/resource-generation/workflow/{workflow.workflow_id}/feedback")
    assert feedback.status_code == 200
    assert feedback.get_json()["count"] == 1
    next_response = client.post(f"/api/personalized-learning-cycles/{cycle['cycle_id']}/next-workflow")
    assert next_response.status_code == 200
    assert next_response.get_json()["already_created"] is True


def test_interrupted_next_workflow_creation_resumes_without_duplicate_cycle(
    client, db_session, auth_session, monkeypatch
):
    from src.models.personalized_learning import PersonalizedLearningCycle
    from src.models.personalized_workflow import PersonalizedWorkflow
    from src.services.personalized_delivery_service import workflow_store
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    group, course, student = _scope(db_session, auth_session.id, "resume_cycle")
    workflow = _ready_workflow(db_session, auth_session.id, group, course, student, "resume_cycle")
    delivery_id = _publish(client, workflow.workflow_id).get_json()["delivery"]["delivery_id"]
    _login(client, student)
    client.post(f"/api/student/personalized-deliveries/{delivery_id}/start")
    for resource_key in ("document", "layered_exercise"):
        client.post(f"/api/student/personalized-deliveries/{delivery_id}/complete-resource", json={
            "resource_key": resource_key, "idempotency_key": f"resume-{resource_key}",
        })

    original_create = workflow_store.create
    attempts = {"count": 0}

    def fail_once(owner_id, payload):
        attempts["count"] += 1
        if attempts["count"] == 1:
            raise RuntimeError("simulated interruption")
        return original_create(owner_id, payload)

    monkeypatch.setattr(workflow_store, "create", fail_once)
    interrupted = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment")
    assert interrupted.status_code == 503
    assert interrupted.get_json()["code"] == "CYCLE_RETRYABLE"
    assert PersonalizedLearningCycle.query.count() == 1
    assert PersonalizedLearningCycle.query.one().status == "NEEDS_ATTENTION"

    resumed = client.post(f"/api/student/personalized-deliveries/{delivery_id}/submit-assessment")
    assert resumed.status_code == 200
    cycle = resumed.get_json()["cycle"]
    assert cycle["status"] == "COMPLETED"
    assert PersonalizedLearningCycle.query.count() == 1
    assert PersonalizedWorkflow.query.filter_by(workflow_id=cycle["next_workflow_id"]).count() == 1
