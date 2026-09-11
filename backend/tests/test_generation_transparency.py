from datetime import datetime, timedelta
import time


def test_empty_profile_has_no_false_confidence_or_strategy():
    from src.services.profile_explainability_service import (
        build_empty_profile,
        build_profile_explainability,
        build_generation_strategy_mapping,
    )

    profile = build_empty_profile(7)
    explanation = build_profile_explainability(profile)
    strategy = build_generation_strategy_mapping(profile)

    assert explanation["completeness_score"] == 0
    assert explanation["confidence_score"] == 0
    assert explanation["source_count"] == 0
    assert all(item["evidence"][0].startswith("当前证据不足") for item in explanation["dimensions"])
    assert strategy["mappings"] == []


def test_evidence_confidence_is_separate_from_completeness():
    from src.services.profile_explainability_service import (
        build_empty_profile,
        build_profile_explainability,
        build_generation_strategy_mapping,
    )

    profile = build_empty_profile(8)
    explanation = build_profile_explainability(profile, {
        "practice": {"total_practices": 10, "avg_score": 72, "recent_scores": [70, 74]},
        "mistakes": {"total": 4, "top_knowledge_points": [["循环", 3]]},
    })

    assert explanation["completeness_score"] == 0
    assert explanation["confidence_score"] > 0
    knowledge = next(item for item in explanation["dimensions"] if item["key"] == "knowledge_base")
    assert knowledge["confidence"] > 0
    assert "练习评测" in knowledge["data_sources"]
    strategy = build_generation_strategy_mapping(profile, {
        "mistakes": {"total": 4, "top_knowledge_points": [["循环", 3]]},
    }, ["document", "exercise"])
    assert strategy["mappings"][0]["evidence"]
    assert strategy["mappings"][0]["judgement"].startswith("薄弱知识点")


def test_dashboard_get_does_not_create_profile(client, db_session):
    from src.models.user import User
    from src.models.student_profile import StudentProfile

    student = User(username="readonly_student", password="test123", role="student")
    db_session.session.add(student)
    db_session.session.commit()
    with client.session_transaction() as sess:
        sess["user_id"] = student.id
        sess["user_role"] = "student"
        sess["username"] = student.username

    before = StudentProfile.query.count()
    response = client.get("/api/profile/dashboard")
    after = StudentProfile.query.count()

    assert response.status_code == 200
    assert before == after == 0
    assert response.get_json()["profile_explainability"]["completeness_score"] == 0


def _create_personalization_scope(db_session, teacher_id, suffix="a", with_profile=True):
    from src.models.user import User, ClassGroup, ClassGroupStudent, ClassGroupCourse
    from src.models.course import Course
    from src.models.student_profile import StudentProfile

    student = User(username=f"student_{suffix}", password="test123", role="student")
    course = Course(title=f"课程{suffix}", description="测试", teacher_id=teacher_id)
    class_group = ClassGroup(name=f"班级{suffix}", teacher_id=teacher_id)
    db_session.session.add_all([student, course, class_group])
    db_session.session.flush()
    records = [
        ClassGroupStudent(class_group_id=class_group.id, user_id=student.id, student_name=f"学生{suffix}"),
        ClassGroupCourse(class_group_id=class_group.id, course_id=course.id),
    ]
    if with_profile:
        records.append(StudentProfile(user_id=student.id, cognitive_style="visual", learning_pace="slow"))
    db_session.session.add_all(records)
    db_session.session.commit()
    return class_group, course, student


def test_plan_requires_owned_class_and_returns_real_profile(client, db_session, auth_session):
    class_group, course, student = _create_personalization_scope(db_session, auth_session.id)
    from src.models.course import Assessment, ProgrammingSubmission

    assessment = Assessment(course_id=course.id, title="编程练习", questions="[]")
    db_session.session.add(assessment)
    db_session.session.flush()
    db_session.session.add_all([
        ProgrammingSubmission(
            user_id=student.id, assessment_id=assessment.id, course_id=course.id,
            status="failed", score=35, max_score=100,
            syntax_result='{"score": 40}', logic_result='{"score": 45}',
        ),
        ProgrammingSubmission(
            user_id=student.id, assessment_id=assessment.id, course_id=course.id,
            status="passed", score=88, max_score=100,
            syntax_result='{"score": 90}', logic_result='{"score": 85}',
        ),
    ])
    db_session.session.commit()

    response = client.post("/api/resource-generation/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "循环结构",
        "resource_types": ["document", "media"],
        "rag_required": False,
    })

    assert response.status_code == 200
    body = response.get_json()
    assert body["profile_snapshot"]["profile"]["cognitive_style"] == "visual"
    assert body["knowledge_context"]["status"] == "skipped"
    assert len(body["stages"]) == 6
    assert body["strategy"]["mappings"]
    programming_mapping = next(
        item for item in body["strategy"]["mappings"]
        if item["feature"].startswith("编程薄弱模式")
    )
    assert programming_mapping["evidence"]
    knowledge_dimension = next(
        item for item in body["profile_snapshot"]["explainability"]["dimensions"]
        if item["key"] == "knowledge_base"
    )
    assert any("编程提交通过率50%" in item for item in knowledge_dimension["evidence"])


def test_plan_rejects_other_teachers_class(client, db_session, auth_session):
    from src.models.user import User

    other_teacher = User(username="other_teacher", password="test123", role="teacher")
    db_session.session.add(other_teacher)
    db_session.session.commit()
    class_group, course, student = _create_personalization_scope(db_session, other_teacher.id, "other")

    response = client.post("/api/resource-generation/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
    })

    assert response.status_code == 403
    assert response.get_json()["code"] == "CLASS_FORBIDDEN"


def test_tracking_owner_isolation_and_expiry():
    from src.services.multi_agent.coordinator_agent import CoordinatorAgent
    from src.services.multi_agent.shared_state import shared_state

    coordinator = CoordinatorAgent.__new__(CoordinatorAgent)
    coordinator.agent_name = "coordinator"
    tracking_id = "trk_testtracking123456"
    shared_state.update({
        f"{tracking_id}_owner": 11,
        f"{tracking_id}_status": "generating",
        f"{tracking_id}_expires_at": (datetime.utcnow() + timedelta(minutes=5)).isoformat(),
    })

    forbidden = coordinator._get_generation_status({"package_id": tracking_id, "user_id": 12})
    assert forbidden["code"] == "TRACKING_FORBIDDEN"

    shared_state.set(
        f"{tracking_id}_expires_at",
        (datetime.utcnow() - timedelta(seconds=1)).isoformat(),
    )
    expired = coordinator._get_generation_status({"package_id": tracking_id, "user_id": 11})
    assert expired["code"] == "TRACKING_NOT_FOUND"
    assert not any(key.startswith(tracking_id) for key in shared_state.keys())


def test_real_parallel_completion_order_and_partial_result(monkeypatch):
    from src.services.multi_agent.coordinator_agent import CoordinatorAgent
    from src.services.multi_agent.shared_state import shared_state
    from src.services.multi_agent import coordinator_agent as coordinator_module

    class FakeAgent:
        def __init__(self, name, delay, fails=False):
            self.agent_name = name
            self.delay = delay
            self.fails = fails

        def process(self, task):
            time.sleep(self.delay)
            if self.fails:
                return {"error": f"{self.agent_name} simulated failure"}
            return {"title": f"{task['type']} output", "content": "generated"}

    coordinator = CoordinatorAgent.__new__(CoordinatorAgent)
    coordinator.agent_name = "coordinator"
    coordinator._agents = {
        "document_agent": FakeAgent("document_agent", 1.2),
        "media_agent": FakeAgent("media_agent", 0.1),
        "project_agent": FakeAgent("project_agent", 0.04, fails=True),
    }
    monkeypatch.setattr(coordinator, "_plan_generation_strategy", lambda *args: "测试策略")
    monkeypatch.setattr(coordinator, "_check_consistency", lambda *args: {"overall_score": 90})
    monkeypatch.setattr(coordinator, "_assess_content_quality", lambda *args: {"overall_score": 88})
    monkeypatch.setattr(coordinator_module.content_converter_service, "convert", lambda _type, value, **_kwargs: value)

    tracking_id = "trk_parallelpartial12345"
    shared_state.delete_prefix(f"{tracking_id}_")
    completion_snapshots = []
    original_set = shared_state.set

    def recording_set(key, value, agent_name=None):
        original_set(key, value, agent_name)
        if key == f"{tracking_id}_progress" and isinstance(value, dict):
            completion_snapshots.append([
                item["resource_type"] for item in value.get("steps", [])
                if item.get("status") in ("completed", "failed")
            ])

    monkeypatch.setattr(shared_state, "set", recording_set)
    result = coordinator._generate_resource_package({
        "tracking_id": tracking_id,
        "user_id": 10,
        "student_user_id": 20,
        "class_id": 30,
        "student_profile": {"cognitive_style": "visual", "learning_pace": "slow"},
        "profile_explainability": {"confidence_score": 70},
        "strategy_mapping": {
            "summary": "视觉型适配",
            "mappings": [{
                "feature": "认知风格：视觉型",
                "judgement": "认知风格：视觉型",
                "evidence": ["画像对话确认偏好图示"],
                "action": "增加可视化讲解",
                "affected_resources": ["document", "media"],
            }],
        },
        "topic": "循环结构",
        "knowledge_points": ["for循环"],
        "resource_types": ["document", "media", "project"],
        "rag_required": False,
        "options": {},
    })

    assert result["package_id"] == tracking_id
    assert set(result["resources"]) == {"document", "media"}
    assert "project" in result["errors"]
    assert shared_state.get(f"{tracking_id}_status") == "partial"
    first_finished = next(snapshot for snapshot in completion_snapshots if snapshot)
    assert first_finished == ["media"]
    assert result["resources"]["document"]["profile_adaptation_explanation"]
    assert result["generation_explanation"]["causal_chain"][0] == {
        "evidence": ["画像对话确认偏好图示"],
        "judgement": "认知风格：视觉型",
        "generation_action": "增加可视化讲解",
        "affected_resources": ["document", "media"],
    }
    shared_state.delete_prefix(f"{tracking_id}_")


def test_comparison_demo_plan_is_read_only(client, db_session, auth_session):
    from src.models.student_profile import StudentProfile
    from src.models.agent_execution_log import AgentExecutionLog

    before_profiles = StudentProfile.query.count()
    before_logs = AgentExecutionLog.query.count()
    response = client.post("/api/resource-generation/comparison-demo/plan", json={
        "preset_ids": ["visual_consolidation", "engineering_practice"],
        "topic": "Python for循环与边界控制",
        "knowledge_points": ["for循环", "range边界"],
        "resource_types": ["document", "exercise", "project"],
    })

    assert response.status_code == 200
    body = response.get_json()
    assert body["database_writes"] is False
    assert len(body["cases"]) == 2
    assert body["cases"][0]["strategy"]["mappings"]
    assert body["cases"][0]["name"].startswith("学生A")
    assert body["cases"][1]["name"].startswith("学生B")
    assert StudentProfile.query.count() == before_profiles
    assert AgentExecutionLog.query.count() == before_logs


def test_comparison_demo_uses_complete_local_fallback_without_writes(
    client, db_session, auth_session, monkeypatch
):
    from src.models.agent_execution_log import AgentExecutionLog
    from src.models.content_review import ContentReview
    from src.services.spark_service import spark_service

    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    response = client.post("/api/resource-generation/comparison-demo/generate", json={
        "preset_id": "visual_consolidation",
        "topic": "Python for循环与边界控制",
        "knowledge_points": ["for循环", "range边界"],
        "resource_types": ["document", "exercise", "project"],
    })

    assert response.status_code == 200
    body = response.get_json()
    assert body["generation_mode"] == "local_rule_fallback"
    assert body["generation_source_label"] == "本地保障生成完成"
    assert set(body["resources"]) == {"document", "exercise", "project"}
    assert body["generation_explanation"]["causal_chain"]
    assert body["database_writes"] is False
    assert AgentExecutionLog.query.count() == 0
    assert ContentReview.query.count() == 0


def test_comparison_demo_retries_then_falls_back(client, auth_session, monkeypatch):
    from src.routes import resource_generation as route_module
    from src.services.spark_service import spark_service

    class FailingCoordinator:
        def __init__(self):
            self.calls = 0

        def process(self, _task):
            self.calls += 1
            return {"error": "temporary unavailable", "resources": {}}

    coordinator = FailingCoordinator()
    monkeypatch.setattr(spark_service, "is_configured", lambda: True)
    monkeypatch.setattr(route_module, "_get_coordinator", lambda: coordinator)

    response = client.post("/api/resource-generation/comparison-demo/generate", json={
        "preset_id": "engineering_practice",
        "topic": "Python for循环与边界控制",
        "resource_types": ["document", "exercise", "project"],
    })

    assert response.status_code == 200
    body = response.get_json()
    assert coordinator.calls == 2
    assert body["generation_mode"] == "local_rule_fallback"
    assert set(body["resources"]) == {"document", "exercise", "project"}


def test_agent_monitor_can_disable_execution_persistence(monkeypatch):
    from src.services.multi_agent.shared_state import AgentMonitor, AgentStatus

    monitor = AgentMonitor()
    monitor.register_agent("demo_agent", "demo", [])
    persisted = []
    monkeypatch.setattr(monitor, "_persist_execution", lambda payload: persisted.append(payload))

    monitor.update_status("demo_agent", AgentStatus.RUNNING, {
        "task_type": "demo_generation",
        "user_id": 1,
        "persist_execution": False,
    })
    monitor.update_status("demo_agent", AgentStatus.SUCCESS)

    assert persisted == []


def test_workflow_without_profile_uses_general_plan_without_writes(client, db_session, auth_session):
    from src.models.student_profile import StudentProfile
    from src.models.content_review import ContentReview
    from src.models.course import CourseGenerationConfig

    class_group, course, student = _create_personalization_scope(
        db_session, auth_session.id, "general", with_profile=False
    )
    response = client.post("/api/resource-generation/workflow/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "Python循环",
        "knowledge_points": ["for循环", "range边界"],
        "resource_types": ["document", "layered_exercise", "project"],
    })

    assert response.status_code == 200
    body = response.get_json()
    assert body["plan"]["mode"] == "general"
    assert body["plan"]["strategy"]["mode"] == "general"
    assert "不推断长期学生特征" in body["plan"]["strategy"]["summary"]
    assert body["plan"]["profile_snapshot"]["profile"] == {}
    assert all(not item["selected"] for item in body["plan"]["selected_evidence"])
    assert StudentProfile.query.filter_by(user_id=student.id).count() == 0
    assert ContentReview.query.count() == 0
    assert CourseGenerationConfig.query.count() == 0


def test_general_workflow_uses_only_teacher_selected_facts(
    client, db_session, auth_session, monkeypatch
):
    from src.routes import resource_generation as route_module

    class_group, course, student = _create_personalization_scope(
        db_session, auth_session.id, "selected-facts", with_profile=False
    )
    monkeypatch.setattr(route_module, "_collect_profile_signals", lambda *_args, **_kwargs: {
        "practice": {"total_practices": 8, "avg_score": 67},
        "mistakes": {"total": 4, "top_knowledge_points": [["range边界", 4]]},
        "programming": {"total_submissions": 0, "pass_rate": 0},
        "interaction": {"total_videos": 0, "total_questions": 0},
        "progress": {},
    })
    response = client.post("/api/resource-generation/workflow/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "Python循环",
        "knowledge_points": ["range边界"],
        "resource_types": ["document", "layered_exercise"],
        "selected_evidence": ["mistake_summary"],
    })

    assert response.status_code == 200
    strategy = response.get_json()["plan"]["strategy"]
    assert strategy["mode"] == "general"
    assert len(strategy["mappings"]) == 1
    assert "4条错题" in strategy["mappings"][0]["feature"]
    assert "练习平均分" not in str(strategy)


def test_workflow_persists_audit_only_then_business_actions_are_idempotent(
    client, db_session, auth_session, monkeypatch
):
    from src.models.content_review import ContentReview
    from src.models.course import CourseGenerationConfig, CourseGenerationVersion
    from src.models.personalized_workflow import PersonalizedWorkflow, PersonalizedWorkflowEvent
    from src.services.spark_service import spark_service

    class_group, course, student = _create_personalization_scope(
        db_session, auth_session.id, "workflow", with_profile=False
    )
    monkeypatch.setattr(spark_service, "is_configured", lambda: False)
    plan = client.post("/api/resource-generation/workflow/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "Python循环",
        "knowledge_points": ["for循环", "range边界"],
        "resource_types": ["document", "layered_exercise", "project"],
    }).get_json()
    workflow_id = plan["workflow"]["workflow_id"]

    generated = client.post(f"/api/resource-generation/workflow/{workflow_id}/generate")
    assert generated.status_code == 200
    result = generated.get_json()
    assert result["database_writes"] is True
    assert result["business_content_writes"] is False
    assert result["tracking_id"].startswith("trk_")
    assert result["agent_progress"]["overall_progress"] == 100
    assert result["stages"][1]["status"] == "skipped"
    assert result["review"]["can_submit"] is True
    assert set(result["resources"]) == {"document", "layered_exercise", "project"}
    assert CourseGenerationConfig.query.count() == 0
    assert ContentReview.query.count() == 0
    assert PersonalizedWorkflow.query.count() == 1
    assert PersonalizedWorkflowEvent.query.count() >= 3

    repeated = client.post(f"/api/resource-generation/workflow/{workflow_id}/generate")
    assert repeated.status_code == 200
    assert repeated.get_json()["already_generated"] is True
    assert repeated.get_json()["resources"] == result["resources"]
    assert CourseGenerationConfig.query.count() == 0
    assert ContentReview.query.count() == 0

    first_draft = client.post(f"/api/resource-generation/workflow/{workflow_id}/save-draft")
    second_draft = client.post(f"/api/resource-generation/workflow/{workflow_id}/save-draft")
    assert first_draft.status_code == second_draft.status_code == 200
    assert second_draft.get_json()["already_saved"] is True
    assert CourseGenerationConfig.query.count() == 1
    assert CourseGenerationVersion.query.count() == 1

    first_submit = client.post(f"/api/resource-generation/workflow/{workflow_id}/submit-review")
    review_count = ContentReview.query.count()
    second_submit = client.post(f"/api/resource-generation/workflow/{workflow_id}/submit-review")
    assert first_submit.status_code == second_submit.status_code == 200
    assert second_submit.get_json()["already_submitted"] is True
    assert ContentReview.query.count() == review_count
    assert review_count == 3


def test_workflow_revision_reuses_record_and_persists_after_session_reload(
    client, db_session, auth_session
):
    from src.models.personalized_workflow import PersonalizedWorkflow, PersonalizedWorkflowEvent

    class_group, course, student = _create_personalization_scope(
        db_session, auth_session.id, "revision", with_profile=False
    )
    payload = {
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "Python循环",
        "knowledge_points": ["for循环"],
        "resource_types": ["document"],
    }
    first = client.post("/api/resource-generation/workflow/plan", json=payload)
    assert first.status_code == 200
    workflow_id = first.get_json()["workflow"]["workflow_id"]

    revised = client.post("/api/resource-generation/workflow/plan", json={
        **payload,
        "workflow_id": workflow_id,
        "knowledge_points": ["for循环", "range边界"],
    })
    assert revised.status_code == 200
    assert PersonalizedWorkflow.query.count() == 1
    assert PersonalizedWorkflowEvent.query.filter_by(event_type="plan_revised").count() == 1

    db_session.session.remove()
    restored = client.get(f"/api/resource-generation/workflow/{workflow_id}")
    assert restored.status_code == 200
    workflow = restored.get_json()["workflow"]
    assert workflow["payload"]["knowledge_points"] == ["for循环", "range边界"]
    assert any(event["event_type"] == "plan_revised" for event in workflow["events"])


def test_workflow_list_and_detail_are_owner_isolated(client, db_session, auth_session):
    from src.models.user import User
    from src.services.personalized_workflow_service import workflow_store

    class_group, course, student = _create_personalization_scope(
        db_session, auth_session.id, "owner", with_profile=False
    )
    response = client.post("/api/resource-generation/workflow/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "权限隔离",
        "knowledge_points": ["所有权"],
        "resource_types": ["document"],
    })
    workflow_id = response.get_json()["workflow"]["workflow_id"]
    other = User(username="workflow_other", password="test123", role="teacher")
    db_session.session.add(other)
    db_session.session.commit()

    assert workflow_store.get_owned(workflow_id, other.id) is None
    with client.session_transaction() as sess:
        sess["user_id"] = other.id
        sess["user_role"] = "teacher"
        sess["username"] = other.username
    assert client.get(f"/api/resource-generation/workflow/{workflow_id}").status_code == 404
    assert client.get("/api/resource-generation/workflows").get_json()["workflows"] == []


def test_workflow_pause_resume_and_stale_generation_recovery(
    client, db_session, auth_session
):
    from datetime import datetime, timedelta
    from src.models.personalized_workflow import PersonalizedWorkflow

    class_group, course, student = _create_personalization_scope(
        db_session, auth_session.id, "recovery", with_profile=False
    )
    plan = client.post("/api/resource-generation/workflow/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "恢复测试",
        "knowledge_points": ["状态机"],
        "resource_types": ["document"],
    }).get_json()
    workflow_id = plan["workflow"]["workflow_id"]

    paused = client.post(f"/api/resource-generation/workflow/{workflow_id}/pause")
    assert paused.status_code == 200
    assert paused.get_json()["workflow"]["state"] == "PAUSED"
    assert client.post(f"/api/resource-generation/workflow/{workflow_id}/generate").status_code == 409
    resumed = client.post(f"/api/resource-generation/workflow/{workflow_id}/resume")
    assert resumed.status_code == 200
    assert resumed.get_json()["workflow"]["state"] == "WAITING_APPROVAL"

    item = PersonalizedWorkflow.query.filter_by(workflow_id=workflow_id).one()
    item.state = "GENERATING"
    item.tracking_id = "trk_interrupted_generation"
    item.updated_at = datetime.utcnow() - timedelta(minutes=10)
    db_session.session.commit()
    recovered = client.get(f"/api/resource-generation/workflow/{workflow_id}")
    assert recovered.status_code == 200
    assert recovered.get_json()["workflow"]["state"] == "NEEDS_ATTENTION"
    assert any(
        event["event_type"] == "generation_recovered"
        for event in recovered.get_json()["workflow"]["events"]
    )


def test_generation_claim_is_atomic_and_rejects_duplicate_attempt(
    client, db_session, auth_session
):
    from src.services.personalized_workflow_service import workflow_store

    class_group, course, student = _create_personalization_scope(
        db_session, auth_session.id, "claim", with_profile=False
    )
    plan = client.post("/api/resource-generation/workflow/plan", json={
        "class_id": class_group.id,
        "course_id": course.id,
        "student_user_id": student.id,
        "topic": "并发保护",
        "knowledge_points": ["幂等"],
        "resource_types": ["document"],
    }).get_json()
    workflow_id = plan["workflow"]["workflow_id"]

    first = workflow_store.claim_generation(workflow_id, auth_session.id, "trk_first_claim_123456")
    second = workflow_store.claim_generation(workflow_id, auth_session.id, "trk_second_claim_12345")
    assert first["state"] == "GENERATING"
    assert second is None


def test_review_agent_repairs_structure_and_runs_semantic_recheck():
    from src.services.review_agent import ReviewAgent

    class FakeSpark:
        def __init__(self):
            self.review_calls = 0

        def is_configured(self):
            return True

        def chat(self, prompt, **_kwargs):
            if "修复智能体" in prompt:
                return '{"document":{"title":"循环讲义","content":"for循环和range边界的概念、示例和常见错误。"}}'
            self.review_calls += 1
            if self.review_calls == 1:
                return '{"score":70,"passed":false,"issues":["缺少边界说明"],"suggestions":["补充range边界"]}'
            return '{"score":90,"passed":true,"issues":[],"suggestions":[]}'

    result = ReviewAgent(FakeSpark()).review_and_repair(
        {"document": {"title": "循环讲义", "content": "for循环基础。"}},
        {"topic": "Python循环", "knowledge_points": ["for循环", "range边界"], "resource_types": ["document"]},
    )

    assert result["passed"] is True
    assert result["round_count"] == 2
    assert "range边界" in result["resources"]["document"]["content"]
    assert result["rounds"][0]["changes"] == ["ReviewAgent根据语义审核意见修复资源"]


def test_external_resource_unavailable_returns_message_without_network_call():
    from src.services.review_agent import validate_external_resources

    resources, checks = validate_external_resources({
        "recommendation": {"title": "内部测试", "content": "说明", "url": "http://127.0.0.1/private"}
    })

    assert checks[0]["available"] is False
    assert "暂不可用" in checks[0]["message"]
    assert resources["recommendation"]["external_available"] is False
    assert "内网地址" in resources["recommendation"]["external_status"]
