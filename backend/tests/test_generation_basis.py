"""生成依据链服务的单元测试。

重点验证第 3.2 节的诚实性硬规则：缺证据时必须显式标注，禁止编造。
"""

import uuid

import pytest

#: 用例名运行时随机，避免与同会话其它测试模块重复建号相互干扰。
_SUFFIX = uuid.uuid4().hex[:8]


def _username(prefix):
    return f"{prefix}_{_SUFFIX}"


def _profile(**overrides):
    profile = {
        "user_id": 7,
        "knowledge_base": {"循环边界": 43, "递归": 38},
        "cognitive_style": "visual",
        "error_patterns": [],
        "learning_pace": "slow",
        "interest_areas": [],
        "goal_orientation": "exam",
        "time_availability": {},
        "interaction_preference": "guided",
    }
    profile.update(overrides)
    return profile


def _signals(with_mistake_detail=True):
    signals = {
        "practice": {"total_practices": 10, "avg_score": 72, "recent_scores": [70, 74]},
        "mistakes": {
            "total": 4,
            "top_knowledge_points": [["循环边界", 3]],
        },
    }
    if with_mistake_detail:
        signals["mistakes"]["evidence"] = [{
            "mistake_id": 481,
            "knowledge_point": "循环边界",
            "error_type": "off_by_one",
            "mistake_count": 3,
            "last_mistake_at": "2026-07-20T14:12:00Z",
            "mastery_status": "unmastered",
            "question_content": "for i in range(1, n): print(i)",
            "user_answer": "range(1, n+1)",
            "correct_answer": "range(1, n)",
        }]
    return signals


def _package(resource_type="document", consistency=None, quality=None):
    resource = {
        "title": "Python 循环边界控制讲解文档",
        "knowledge_points": ["循环边界条件"],
        "knowledge_point_references": [{
            "source_id": "KP77",
            "title": "循环边界条件",
            "node_id": 77,
            "chapter_title": "第3章 循环结构",
        }],
        "citations": [{"source_id": "KP77", "title": "循环边界条件"}],
    }
    if quality is not None:
        resource["content_quality_report"] = quality
    return {
        "package_id": "pkg_1",
        "topic": "循环边界",
        "resources": {resource_type: resource},
        "knowledge_points": [{"node_id": 77, "label": "循环边界条件", "chapter_title": "第3章 循环结构"}],
        "consistency_report": consistency if consistency is not None else {
            "knowledge_coverage": 92,
            "difficulty_alignment": 75,
            "cross_reference_check": 78,
            "overall_score": 86,
        },
        "metadata": {"created_at": "2026-07-22T10:30:00Z"},
        "generation_explanation": {
            "profile_snapshot": {
                "student_user_id": 7,
                "class_id": 12,
                "profile": _profile(),
                "explainability": None,
            },
        },
    }


def _quality_report(resource_type="document"):
    return {
        "overall_score": 86,
        "dimensions": {
            "coverage": {"score": 92, "basis": "覆盖主题要点", "suggestion": "补充边界案例"},
            "difficulty": {"score": 80, "basis": "难度与画像匹配", "suggestion": "增加分步提示"},
            "factuality": {"score": 85, "basis": "事实核对通过", "suggestion": ""},
            "citation_integrity": {"score": 88, "basis": "引用完整", "suggestion": ""},
        },
        "citation_coverage_score": 88,
        "verification_status": "passed",
        "degradation": None,
    }


# --------------------------------------------------------------------------
# 证据充足
# --------------------------------------------------------------------------

def test_resource_basis_has_sourced_profile_and_mistake_evidence():
    from src.services.generation_basis_service import build_resource_basis

    package = _package(quality=_quality_report())
    basis = build_resource_basis(
        "document", package["resources"]["document"], package, _signals()
    )

    assert basis["basis_id"] == "bas_pkg_1_document"
    assert basis["resource_type"] == "document"
    assert basis["resource_title"] == "Python 循环边界控制讲解文档"
    assert basis["generated_at"].startswith("2026-07-22T10:30:00")

    knowledge = next(
        item for item in basis["profile_evidence"] if item["dimension_key"] == "knowledge_base"
    )
    assert knowledge["confidence"] > 0
    assert "练习评测" in knowledge["data_sources"]
    # 知识基础维度的样本量 = 练习次数(10) + 错题条数(4)，与既有算法保持一致。
    assert knowledge["sample_count"] == 14
    assert all(item["data_sources"] for item in basis["profile_evidence"] if item["confidence"] > 0)

    mistake = basis["mistake_evidence"][0]
    assert mistake["mistake_id"] == 481
    assert mistake["knowledge_point"] == "循环边界"
    assert mistake["error_type"] == "off_by_one"
    assert mistake["mistake_count"] == 3
    assert mistake["user_answer"] == "range(1, n+1)"
    assert mistake["correct_answer"] == "range(1, n)"

    node = basis["knowledge_evidence"][0]
    assert node["label"] == "循环边界条件"
    assert node["chapter_title"] == "第3章 循环结构"
    assert node["mastery"] is None
    assert node["citation_ids"] == ["KP77"]

    assert basis["quality"]["overall_score"] == 86
    assert set(basis["quality"]["dimensions"]) == {
        "coverage", "difficulty", "factuality", "citation_integrity",
    }
    assert basis["quality"]["citation_coverage_score"] == 88
    assert basis["quality"]["verification_status"] == "passed"


def test_next_step_reuses_learning_cycle_strategy_without_inventing_one():
    from src.services.generation_basis_service import build_resource_basis

    package = _package(quality=_quality_report())
    cycle = {
        "cycle_id": "cyc_xxx",
        "next_strategy": {
            "source": "learning_cycle",
            "action": "降低单次难度，补充前置知识并使用分步提示",
            "learning_sequence": ["前置知识", "分步示例", "基础练习", "短检测"],
            "remaining_problems": ["练习正确率尚未达到80%"],
        },
        "prerequisite_chain": ["变量与作用域", "range 语义"],
    }
    basis = build_resource_basis(
        "document", package["resources"]["document"], package, _signals(), cycle=cycle
    )

    assert basis["next_step"]["source"] == "learning_cycle"
    assert basis["next_step"]["action"] == "降低单次难度，补充前置知识并使用分步提示"
    assert basis["next_step"]["learning_sequence"][0] == "前置知识"
    assert basis["next_step"]["source_cycle_id"] == "cyc_xxx"
    assert basis["next_step"]["prerequisite_chain"] == ["变量与作用域", "range 语义"]


def test_package_basis_covers_every_generated_resource_type():
    from src.services.generation_basis_service import build_package_basis

    package = _package(quality=_quality_report())
    package["resources"]["mindmap"] = {"title": "循环知识导图", "content": "..."}
    basis = build_package_basis(package, _signals())

    assert set(basis) == {"document", "mindmap"}
    assert basis["mindmap"]["basis_id"] == "bas_pkg_1_mindmap"


# --------------------------------------------------------------------------
# 诚实性硬规则：缺证据不得编造
# --------------------------------------------------------------------------

def test_aggregate_only_mistakes_are_never_fabricated_into_rows():
    from src.services.generation_basis_service import build_resource_basis

    package = _package(quality=_quality_report())
    basis = build_resource_basis(
        "document", package["resources"]["document"], package, _signals(with_mistake_detail=False)
    )

    assert basis["mistake_evidence"] == []
    kinds = [gap["kind"] for gap in basis["gaps"]]
    assert "missing_mistake_detail" in kinds


def test_placeholder_difficulty_alignment_is_declared_as_a_gap():
    from src.services.generation_basis_service import build_resource_basis

    package = _package(quality=_quality_report())
    basis = build_resource_basis(
        "document", package["resources"]["document"], package, _signals()
    )

    kinds = [gap["kind"] for gap in basis["gaps"]]
    assert "difficulty_alignment_is_placeholder" in kinds
    assert basis["quality"]["consistency"]["difficulty_alignment"] == 75


def test_media_and_ppt_do_not_report_citation_coverage():
    from src.services.generation_basis_service import build_resource_basis

    for resource_type in ("media", "ppt"):
        package = _package(resource_type=resource_type)
        basis = build_resource_basis(
            resource_type, package["resources"][resource_type], package, _signals()
        )
        kinds = [gap["kind"] for gap in basis["gaps"]]
        assert "citation_not_applicable" in kinds
        assert basis["quality"]["citation_coverage_score"] is None
        assert basis["quality"]["verification_status"] is None


def test_insufficient_dimensions_use_the_existing_fallback_text():
    from src.services.generation_basis_service import (
        INSUFFICIENT_EVIDENCE_TEXT,
        build_resource_basis,
    )
    from src.services.profile_explainability_service import build_profile_explainability

    package = _package(quality=_quality_report())
    package["generation_explanation"]["profile_snapshot"]["profile"] = {}
    package["generation_explanation"]["profile_snapshot"]["explainability"] = None
    basis = build_resource_basis("document", package["resources"]["document"], package, {})

    # 画像为空时，build_profile_explainability 的兜底文案必须原样出现在证据里。
    empty_explanation = build_profile_explainability({}, {})
    assert all(
        item["evidence"] == [INSUFFICIENT_EVIDENCE_TEXT]
        for item in empty_explanation["dimensions"]
    )

    assert basis["mistake_evidence"] == []
    for item in basis["profile_evidence"]:
        assert item["confidence"] == 0
        assert item["low_confidence"] is True
        assert item["evidence"] == [INSUFFICIENT_EVIDENCE_TEXT]
    kinds = [gap["kind"] for gap in basis["gaps"]]
    assert "missing_learning_cycle" in kinds


def test_low_confidence_dimensions_are_flagged_not_presented_as_certain():
    from src.services.generation_basis_service import build_resource_basis

    signals = {"practice": {"total_practices": 1, "avg_score": 60, "recent_scores": [60]}}
    package = _package(quality=_quality_report())
    basis = build_resource_basis(
        "document", package["resources"]["document"], package, signals
    )

    low = [item for item in basis["profile_evidence"] if item["low_confidence"]]
    assert low
    assert all(item["confidence"] < 60 for item in low)


def test_resource_without_knowledge_context_declares_the_gap():
    from src.services.generation_basis_service import build_resource_basis

    package = _package(quality=_quality_report())
    package["knowledge_points"] = []
    resource = dict(package["resources"]["document"])
    resource.pop("knowledge_point_references")
    resource.pop("knowledge_points")
    resource.pop("citations")
    package["resources"]["document"] = resource
    basis = build_resource_basis("document", resource, package, _signals())

    assert basis["knowledge_evidence"] == []
    assert "missing_knowledge_reference" in [gap["kind"] for gap in basis["gaps"]]


# --------------------------------------------------------------------------
# 生成前预览
# --------------------------------------------------------------------------

def test_basis_preview_works_before_any_resource_exists():
    from src.services.generation_basis_service import build_basis_preview

    preview = build_basis_preview("循环边界", _signals(), profile=_profile())

    assert preview["basis_id"] == "bas_preview_循环边界"
    assert preview["profile_evidence"]
    assert preview["mistake_evidence"][0]["mistake_id"] == 481
    assert preview["quality"]["overall_score"] is None
    assert preview["quality"]["verification_status"] == "not_run"


def test_basis_preview_without_profile_reports_missing_evidence():
    from src.services.generation_basis_service import build_basis_preview

    preview = build_basis_preview("循环边界", {}, profile={})

    kinds = [gap["kind"] for gap in preview["gaps"]]
    assert "missing_mistake_detail" in kinds
    assert preview["mistake_evidence"] == []


# --------------------------------------------------------------------------
# 班级分组
# --------------------------------------------------------------------------

def _member(user_id, name, style, goal, pace, knowledge_base=None, completeness=100, confidence=80):
    profile = {
        "user_id": user_id,
        "cognitive_style": style,
        "goal_orientation": goal,
        "learning_pace": pace,
        "knowledge_base": knowledge_base if knowledge_base is not None else {"递归": 38},
    }
    return {
        "student_user_id": user_id,
        "student_name": name,
        "profile": profile,
        "completeness_score": completeness,
        "confidence_score": confidence,
    }


def test_groups_follow_dominant_dimension_rules():
    from src.services.generation_basis_service import build_class_learning_groups_from_members

    members = [
        _member(101, "张三", "visual", "exam", "slow", {"递归": 38}),
        _member(102, "李四", "visual", "exam", "slow", {"递归": 42}),
        _member(103, "王五", "visual", "exam", "slow", {"递归": 35}),
        _member(104, "赵六", "kinesthetic", "career", "fast", {"并发": 30}),
        _member(105, "钱七", "kinesthetic", "career", "fast", {"并发": 28}),
    ]
    result = build_class_learning_groups_from_members(members, class_id=12, course_id=3)

    assert result["class_id"] == 12
    assert result["course_id"] == 3
    assert result["grouping_method"] == "rule_based_dominant_dimension"
    assert result["student_count"] == 5
    assert result["grouped_count"] == 5
    assert result["ungrouped_count"] == 0

    visual = next(group for group in result["groups"] if group["group_id"] == "grp_visual_递归_exam")
    assert visual["learning_type"] == "视觉型 · 递归薄弱 · 应试导向"
    assert visual["student_count"] == 3
    assert visual["student_ids"] == [101, 102, 103]
    assert visual["student_names"] == ["张三", "李四", "王五"]

    primary = next(
        item for item in visual["defining_features"] if item["dimension_key"] == "cognitive_style"
    )
    assert primary["display_value"] == "视觉型"
    assert primary["share"] == 1.0

    weak = visual["common_weak_points"][0]
    assert weak["knowledge_point"] == "递归"
    assert weak["student_count"] == 3
    assert weak["share"] == 1.0
    assert weak["avg_mastery"] == pytest.approx(0.38, abs=0.02)

    remediation = visual["recommended_remediation"]
    assert "递归" in remediation["action"]
    assert remediation["resource_types"] == ["document", "mindmap", "layered_exercise"]
    assert remediation["learning_sequence"][0] == "前置知识"
    assert "递归" in remediation["suggested_batch_topic"]
    assert visual["evidence_confidence"] == 80


def test_evidence_insufficient_students_are_never_forced_into_a_group():
    from src.services.generation_basis_service import build_class_learning_groups_from_members

    members = [
        _member(101, "张三", "visual", "exam", "slow"),
        _member(102, "李四", "visual", "exam", "slow"),
        _member(145, "王五", "visual", "exam", "slow", completeness=25, confidence=31),
        _member(146, "孙八", "visual", "exam", "slow", completeness=90, confidence=49),
    ]
    result = build_class_learning_groups_from_members(members, class_id=12, course_id=3)

    assert result["student_count"] == 4
    assert result["grouped_count"] == 2
    assert result["ungrouped_count"] == 2
    ungrouped_ids = {item["student_user_id"] for item in result["ungrouped_students"]}
    assert ungrouped_ids == {145, 146}
    for item in result["ungrouped_students"]:
        assert item["reason"] == "evidence_insufficient"
        assert item["completeness_score"] < 40 or item["confidence_score"] < 50
    grouped_ids = {sid for group in result["groups"] for sid in group["student_ids"]}
    assert grouped_ids.isdisjoint(ungrouped_ids)


def test_singleton_groups_are_merged_into_mixed_with_a_reason():
    from src.services.generation_basis_service import build_class_learning_groups_from_members

    members = [
        _member(101, "张三", "visual", "exam", "slow"),
        _member(102, "李四", "visual", "exam", "slow"),
        _member(103, "王五", "auditory", "career", "fast", {"并发": 30}),
        _member(104, "赵六", "reading", "research", "fast", {"网络": 25}),
    ]
    result = build_class_learning_groups_from_members(members, class_id=12, course_id=3)

    assert result["grouped_count"] == 4
    mixed = next(group for group in result["groups"] if group["learning_type"] == "混合型")
    assert set(mixed["student_ids"]) == {103, 104}
    merge_feature = next(
        item for item in mixed["defining_features"] if item["dimension_key"] == "group_size"
    )
    assert merge_feature["merge_reason"] == "less_than_two_students"
    assert merge_feature["display_value"] == "少于2人的组已并入本组"


def test_empty_class_returns_an_empty_but_valid_contract():
    from src.services.generation_basis_service import build_class_learning_groups_from_members

    result = build_class_learning_groups_from_members([], class_id=9, course_id=3)

    assert result["student_count"] == 0
    assert result["grouped_count"] == 0
    assert result["groups"] == []
    assert result["ungrouped_students"] == []
    assert result["grouping_method"] == "rule_based_dominant_dimension"


def test_learning_groups_route_reads_the_database_and_enforces_ownership(client, db_session):
    from src.models.user import User, ClassGroup, ClassGroupStudent
    from src.models.student_profile import StudentProfile

    owner = User(username=_username("group_owner"), password="test123", role="teacher")
    other = User(username=_username("group_other"), password="test123", role="teacher")
    students = [
        User(username=_username("group_s1"), password="test123", role="student", real_name="张三"),
        User(username=_username("group_s2"), password="test123", role="student", real_name="李四"),
    ]
    db_session.session.add_all([owner, other, *students])
    db_session.session.flush()
    klass = ClassGroup(name="分组班", teacher_id=owner.id)
    db_session.session.add(klass)
    db_session.session.flush()
    db_session.session.add_all([
        ClassGroupStudent(class_group_id=klass.id, user_id=students[0].id, student_name="张三"),
        ClassGroupStudent(class_group_id=klass.id, user_id=students[1].id, student_name="李四"),
        StudentProfile(user_id=students[0].id, cognitive_style="visual", goal_orientation="exam",
                       learning_pace="slow", knowledge_base='{"递归": 38}',
                       interest_areas='["算法"]', time_availability='{"weekend": 2}',
                       interaction_preference="exploratory"),
        StudentProfile(user_id=students[1].id, cognitive_style="visual", goal_orientation="exam",
                       learning_pace="slow", knowledge_base='{"递归": 42}',
                       interest_areas='["算法"]', time_availability='{"weekend": 2}',
                       interaction_preference="exploratory"),
    ])
    db_session.session.commit()

    with client.session_transaction() as sess:
        sess["user_id"] = owner.id
        sess["user_role"] = "teacher"
        sess["username"] = owner.username

    response = client.get(f"/api/classes/{klass.id}/learning-groups?course_id=3")

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["class_id"] == klass.id
    assert payload["course_id"] == 3
    assert payload["student_count"] == 2
    assert payload["grouping_method"] == "rule_based_dominant_dimension"
    assert payload["groups"][0]["student_count"] == 2
    assert payload["groups"][0]["common_weak_points"][0]["knowledge_point"] == "递归"
    assert payload["ungrouped_students"] == []

    with client.session_transaction() as sess:
        sess["user_id"] = other.id
        sess["user_role"] = "teacher"
        sess["username"] = other.username
    forbidden = client.get(f"/api/classes/{klass.id}/learning-groups?course_id=3")
    assert forbidden.status_code == 403

    missing = client.get("/api/classes/999999/learning-groups?course_id=3")
    assert missing.status_code == 404


def test_execution_details_carry_real_ids_and_score_for_normalized_resources():
    """回归：_normalize_resources_for_output 会移除顶层 knowledge_points。

    归一化后的资源若只从 knowledge_points 取标签，错题 id 会永远匹配不到而静默为空，
    依据链就退化成"看起来有字段、实际没有证据"。此用例锁定该行为。
    """
    from src.services.multi_agent.coordinator_agent import CoordinatorAgent

    agent = CoordinatorAgent()
    # 归一化形态：只有 knowledge_point_references，没有顶层 knowledge_points。
    normalized_resource = {
        "resource_type": "document",
        "title": "递归边界条件讲解文档",
        "content": {"title": "递归边界条件讲解文档", "content": "递归边界条件。"},
        "knowledge_point_references": [
            {"source_id": "KP77", "title": "递归边界", "node_id": 77}
        ],
        "citations": [{"source_id": "KP77", "title": "递归边界"}],
    }
    mistake_records = [{
        "mistake_id": 91,
        "knowledge_point": "递归边界",
        "error_type": "边界条件遗漏",
        "mistake_count": 3,
    }]

    assert agent._collect_mistake_ids(normalized_resource, mistake_records) == [91]
    assert agent._collect_knowledge_point_ids(normalized_resource) == [77]

    execution_details = {
        "document": agent._build_execution_detail(
            "document",
            {"mappings": [{"feature": "认知风格：视觉型", "affected_resources": ["document"]}]},
            ["递归边界"],
        )
    }
    agent._backfill_execution_evidence(
        execution_details,
        {"document": normalized_resource},
        {"dimensions": {"citation_integrity": {"score": 88.5}}},
        {"document": [{"source_id": "KP77"}]},
        mistake_records,
    )

    detail = execution_details["document"]
    assert detail["mistake_ids"] == [91]
    assert detail["knowledge_point_ids"] == [77]
    assert detail["quality_score"] == 88.5
    assert "认知风格：视觉型" in detail["basis_refs"]
    assert "KP77" in detail["basis_refs"]


def test_unrelated_mistakes_are_not_attached_to_a_resource():
    """知识点不匹配时不得把错题硬塞进资源依据。"""
    from src.services.multi_agent.coordinator_agent import CoordinatorAgent

    agent = CoordinatorAgent()
    resource = {
        "resource_type": "document",
        "knowledge_point_references": [{"source_id": "KP1", "title": "循环结构", "node_id": 1}],
    }
    records = [{"mistake_id": 5, "knowledge_point": "递归边界"}]

    assert agent._collect_mistake_ids(resource, records) == []


def test_student_basis_route_surfaces_real_mistake_detail(client, db_session):
    """回归：学生端依据链必须能看到真实错题明细。

    _collect_profile_signals 只返回错题聚合计数（total / top_knowledge_points），
    不含明细。曾经因此让依据链只能报 missing_mistake_detail —— 学生明明有错题，
    面板却一条都不显示。此用例锁定"有真实错题时必须给出明细"。
    """
    import json as _json

    from src.main import app
    from src.models.user import User, ClassGroup, ClassGroupStudent
    from src.models.course import Course, MistakeRecord
    from src.models.personalized_learning import PersonalizedTaskDelivery

    with app.app_context():
        teacher = User(username=_username("t_md"), password="x", role="teacher")
        student = User(username=_username("s_md"), password="x", role="student",
                       real_name="错题学生")
        db_session.session.add_all([teacher, student])
        db_session.session.flush()

        course = Course(title="错题课程", description="x", teacher_id=teacher.id)
        db_session.session.add(course)
        db_session.session.flush()

        klass = ClassGroup(name="错题班", teacher_id=teacher.id)
        db_session.session.add(klass)
        db_session.session.flush()
        db_session.session.add(
            ClassGroupStudent(class_group_id=klass.id, user_id=student.id, student_name="错题学生")
        )

        db_session.session.add(MistakeRecord(
            user_id=student.id,
            course_id=course.id,
            question_content="请写出冒泡排序的边界处理。",
            user_answer="for i in range(n):",
            correct_answer="for i in range(n - 1):",
            mistake_count=3,
            knowledge_tags=_json.dumps(["循环结构"], ensure_ascii=False),
            error_type_auto="边界条件遗漏",
            mastery_status="unmastered",
        ))

        delivery = PersonalizedTaskDelivery(
            delivery_id="md_delivery_1",
            workflow_id="md_workflow_1",
            owner_id=teacher.id,
            course_id=course.id,
            class_id=klass.id,
            student_user_id=student.id,
            status="IN_PROGRESS",
            title="错题依据任务",
            resource_snapshot_json=_json.dumps({
                "document": {
                    "resource_type": "document",
                    "title": "循环结构讲解",
                    "content": {"title": "循环结构讲解", "content": "循环边界。"},
                }
            }, ensure_ascii=False),
            strategy_snapshot_json="{}",
            baseline_snapshot_json="{}",
            completion_rules_json="{}",
            idempotency_key="md_delivery_1_key",
        )
        db_session.session.add(delivery)
        db_session.session.commit()
        student_id = student.id

    with client.session_transaction() as sess:
        sess["user_id"] = student_id
        sess["user_role"] = "student"
        sess["username"] = "s_md"

    response = client.get(
        "/api/student/personalized-deliveries/md_delivery_1/resources/document/basis"
    )
    assert response.status_code == 200
    basis = response.get_json()["basis"]

    mistakes = basis["mistake_evidence"]
    assert len(mistakes) == 1, "有真实错题时必须返回明细，而不是空数组"
    assert mistakes[0]["knowledge_point"] == "循环结构"
    assert mistakes[0]["error_type"] == "边界条件遗漏"
    assert mistakes[0]["mistake_count"] == 3
    assert "冒泡排序" in mistakes[0]["question_excerpt"]

    gap_kinds = [gap["kind"] for gap in basis["gaps"]]
    assert "missing_mistake_detail" not in gap_kinds, "已有明细时不得再报错题缺失"
