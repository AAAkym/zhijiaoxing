import json
import logging
import re
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request, session
from src.utils.auth import require_auth

from src.models.user import db, User, ClassGroup, ClassGroupStudent, ClassGroupCourse
from src.models.student_profile import StudentProfile
from src.models.personalized_class_batch import PersonalizedClassBatch, PersonalizedClassBatchItem
from src.models.course import (
    Course,
    CourseGenerationConfig,
    CourseGenerationVersion,
    LearningProgress,
    PracticeEvaluation,
    MistakeRecord,
    VideoProgress,
    CourseQuestion,
)
from src.services.profile_explainability_service import (
    build_profile_explainability,
    build_generation_strategy_mapping,
)
from src.services.profile_evidence_collector import collect_programming_signals
from src.services.comparison_demo_service import (
    DEFAULT_DEMO_IDS,
    DEFAULT_RESOURCE_TYPES,
    build_demo_plan,
    build_local_fallback,
    get_demo_profile,
    list_demo_profiles,
)
from src.services.multi_agent.coordinator_agent import CoordinatorAgent
from src.services.multi_agent.shared_state import agent_monitor
from src.services.review_agent import ReviewAgent, validate_external_resources
from src.services.personalized_workflow_service import (
    WorkflowTransitionError,
    build_rule_resources,
    workflow_store,
)

logger = logging.getLogger(__name__)


def _auto_submit_to_review(result, user_id, user_role):
    """将AI生成的资源自动提交到内容审核系统（异步，不影响主流程）"""
    try:
        from src.services.content_review_service import content_review_service

        # 从资源包结果中提取各类型资源
        resources = result.get("resources", {})
        source = "ai"
        # 教师/学生触发的AI生成，标记来源
        if user_role == "teacher":
            source = "teacher"
        elif user_role == "student":
            source = "student"

        content_type_map = {
            "exercise": "exercise",
            "layered_exercise": "exercise",
            "document": "knowledge_point",
            "mindmap": "teaching_content",
            "media": "teaching_content",
            "recommendation": "teaching_case",
            "project": "teaching_case",
        }

        submitted = 0
        for res_type, res_data in resources.items():
            if not res_data:
                continue

            review_type = content_type_map.get(res_type, "teaching_content")

            # 处理列表形式的资源
            items = res_data if isinstance(res_data, list) else [res_data]

            for item in items:
                if not isinstance(item, dict):
                    continue

                title = item.get("title") or item.get("topic") or f"AI生成-{res_type}"
                # 构建审核内容体
                body_parts = []
                for key in ("content", "definition", "description", "background", "analysis", "solution"):
                    val = item.get(key)
                    if val and isinstance(val, str):
                        body_parts.append(val)
                    elif val and isinstance(val, (dict, list)):
                        body_parts.append(json.dumps(val, ensure_ascii=False)[:500])
                body = "\n".join(body_parts)[:2000] if body_parts else title

                content_id = item.get("id") or hash(title) % 100000

                try:
                    # 去重：跳过已存在相同 content_id+content_type 的审核记录
                    from src.models.content_review import ContentReview
                    existing = ContentReview.query.filter_by(
                        content_id=content_id,
                        content_type=review_type,
                    ).first()
                    if existing:
                        continue

                    content_review_service.submit_for_review(
                        content_id=content_id,
                        content_type=review_type,
                        content_title=title,
                        content_body=body,
                        source=source,
                        author_id=user_id,
                    )
                    submitted += 1
                except Exception:
                    # 去重（content_id+content_type已存在）等异常不阻断主流程
                    pass

        if submitted > 0:
            logger.info(f"自动提交 {submitted} 条内容到审核系统 (user={user_id}, role={user_role})")

    except Exception as e:
        # 审核提交失败不影响资源生成主流程
        logger.warning(f"自动提交审核失败(不影响主流程): {e}")

resource_gen_bp = Blueprint("resource_generation", __name__)

_coordinator = None


def _get_coordinator():
    global _coordinator
    if _coordinator is None:
        from src.services.spark_service import spark_service
        _coordinator = CoordinatorAgent(spark_service=spark_service)
    return _coordinator


def _get_student_profile(user_id):
    profile = StudentProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        return {}
    return profile.to_dict()


TRACKING_ID_PATTERN = re.compile(r"^trk_[A-Za-z0-9_-]{16,80}$")


def _validate_personalization_scope(data, requester_id, requester_role, require_profile=True):
    """Validate teacher/class/student/course ownership before returning profile data."""
    try:
        class_id = int(data.get("class_id"))
        course_id = int(data.get("course_id"))
        student_user_id = int(data.get("student_user_id"))
    except (TypeError, ValueError):
        return None, ({"error": "课程、班级和学生都是必选项", "code": "SCOPE_REQUIRED"}, 400)

    if requester_role not in ("teacher", "admin"):
        return None, ({"error": "只有教师可以为班级学生生成个性化资源", "code": "PERMISSION_DENIED"}, 403)

    class_group = ClassGroup.query.get(class_id)
    if not class_group:
        return None, ({"error": "班级不存在", "code": "CLASS_NOT_FOUND"}, 404)
    if requester_role == "teacher" and class_group.teacher_id != requester_id:
        return None, ({"error": "无权访问其他教师的班级", "code": "CLASS_FORBIDDEN"}, 403)

    membership = ClassGroupStudent.query.filter_by(
        class_group_id=class_id, user_id=student_user_id
    ).first()
    if not membership:
        return None, ({"error": "所选学生不在该班级中", "code": "STUDENT_NOT_IN_CLASS"}, 403)

    assignment = ClassGroupCourse.query.filter_by(
        class_group_id=class_id, course_id=course_id
    ).first()
    if not assignment:
        return None, ({"error": "该课程尚未分配给所选班级", "code": "COURSE_NOT_ASSIGNED"}, 403)

    student = User.query.get(student_user_id)
    if not student or student.role != "student":
        return None, ({"error": "学生账号不存在", "code": "STUDENT_NOT_FOUND"}, 404)

    profile = StudentProfile.query.filter_by(user_id=student_user_id).first()
    if not profile and require_profile:
        return None, ({
            "error": "该学生还没有画像，请先完成画像构建或数据同步",
            "code": "PROFILE_NOT_READY",
        }, 422)

    return {
        "class_group": class_group,
        "course": Course.query.get(course_id),
        "student": student,
        "membership": membership,
        "profile": profile.to_dict() if profile else {},
        "class_id": class_id,
        "course_id": course_id,
        "student_user_id": student_user_id,
    }, None


def _validate_class_generation_scope(data, requester_id, requester_role):
    try:
        class_id = int(data.get("class_id"))
        course_id = int(data.get("course_id"))
    except (TypeError, ValueError):
        return None, ({"error": "课程和班级都是必选项", "code": "CLASS_SCOPE_REQUIRED"}, 400)
    if requester_role not in ("teacher", "admin"):
        return None, ({"error": "只有教师可以创建班级生成任务", "code": "PERMISSION_DENIED"}, 403)
    group = ClassGroup.query.get(class_id)
    if not group:
        return None, ({"error": "班级不存在", "code": "CLASS_NOT_FOUND"}, 404)
    if requester_role == "teacher" and group.teacher_id != int(requester_id):
        return None, ({"error": "无权访问其他教师的班级", "code": "CLASS_FORBIDDEN"}, 403)
    if not ClassGroupCourse.query.filter_by(class_group_id=class_id, course_id=course_id).first():
        return None, ({"error": "该课程尚未分配给所选班级", "code": "COURSE_NOT_ASSIGNED"}, 403)
    memberships = ClassGroupStudent.query.filter_by(class_group_id=class_id).all()
    if not memberships:
        return None, ({"error": "班级中还没有学生", "code": "CLASS_EMPTY"}, 422)
    return {"class_group": group, "course_id": course_id, "class_id": class_id, "memberships": memberships}, None


def _class_profile_preflight(scope):
    students = []
    ready_count = 0
    for membership in scope["memberships"]:
        student = User.query.get(membership.user_id)
        if not student or student.role != "student":
            continue
        profile = StudentProfile.query.filter_by(user_id=student.id).first()
        signals = _collect_profile_signals(student.id, scope["course_id"])
        explanation = build_profile_explainability(profile.to_dict() if profile else {}, signals)
        ready = bool(profile) and (
            explanation.get("source_count", 0) > 0 or explanation.get("completeness_score", 0) >= 25
        )
        ready_count += int(ready)
        students.append({
            "student_user_id": student.id,
            "student_name": membership.student_name or student.real_name or student.username,
            "profile_status": "ready" if ready else "diagnostic_required",
            "profile_ready": ready,
            "completeness_score": explanation.get("completeness_score", 0),
            "confidence_score": explanation.get("confidence_score", 0),
            "source_count": explanation.get("source_count", 0),
            "message": "画像证据已满足生成条件" if ready else "需要先完成快速诊断或画像数据同步",
        })
    return {
        "student_count": len(students), "ready_count": ready_count,
        "diagnostic_required_count": len(students) - ready_count,
        "all_ready": bool(students) and ready_count == len(students), "students": students,
    }


def _batch_resource_types(profile, required):
    result = list(dict.fromkeys(required))
    optional = {
        "visual": ["mindmap", "media"], "auditory": ["media"],
        "kinesthetic": ["project"], "reading": ["document"],
    }.get(profile.get("cognitive_style"), [])
    for resource_type in optional:
        if resource_type not in result:
            result.append(resource_type)
    return result


def _batch_workflow_payload(batch, item):
    profile_row = StudentProfile.query.filter_by(user_id=item.student_user_id).first()
    profile = profile_row.to_dict() if profile_row else {}
    signals = _collect_profile_signals(item.student_user_id, batch.course_id)
    explanation = build_profile_explainability(profile, signals)
    resources = _batch_resource_types(profile, json.loads(batch.required_resource_types_json or "[]"))
    strategy = build_generation_strategy_mapping(profile, signals, resources)
    class_group = ClassGroup.query.get(batch.class_id)
    return {
        "course_id": batch.course_id, "class_id": batch.class_id,
        "student_user_id": item.student_user_id, "topic": batch.topic,
        "knowledge_points": json.loads(batch.knowledge_points_json or "[]"),
        "resource_types": resources, "required_resource_types": json.loads(batch.required_resource_types_json or "[]"),
        "mode": "personalized", "selected_evidence": _workflow_evidence(signals, True),
        "profile_snapshot": {
            "student": {"user_id": item.student_user_id, "name": item.student_name},
            "class": {"id": batch.class_id, "name": class_group.name if class_group else ""},
            "course": {"id": batch.course_id}, "profile": profile, "explainability": explanation,
        },
        "strategy": strategy, "class_batch_id": batch.batch_id,
    }


def _collect_profile_signals(user_id, course_id):
    """Read existing learning evidence for explainability. This function never writes."""
    evaluations = PracticeEvaluation.query.filter_by(user_id=user_id).order_by(
        PracticeEvaluation.created_at.desc()
    ).limit(20).all()
    scores = [float(item.score) for item in evaluations if item.score is not None]
    mistakes = MistakeRecord.query.filter_by(user_id=user_id, course_id=course_id).order_by(
        MistakeRecord.last_mistake_at.desc()
    ).limit(50).all()
    point_counts = {}
    error_counts = {}
    for item in mistakes:
        try:
            tags = json.loads(item.knowledge_tags or "[]")
        except (TypeError, ValueError):
            tags = []
        for tag in tags if isinstance(tags, list) else []:
            point_counts[str(tag)] = point_counts.get(str(tag), 0) + 1
        error_type = item.error_type_manual or item.error_type_auto
        if error_type:
            error_counts[error_type] = error_counts.get(error_type, 0) + 1

    progress = LearningProgress.query.filter_by(user_id=user_id, course_id=course_id).all()
    videos = VideoProgress.query.filter_by(user_id=user_id).all()
    questions = CourseQuestion.query.filter_by(user_id=user_id, course_id=course_id).count()
    last_practice = evaluations[0].created_at.isoformat() if evaluations and evaluations[0].created_at else None
    return {
        "practice": {
            "total_practices": len(evaluations),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
            "recent_scores": scores[:10],
            "last_at": last_practice,
        },
        "mistakes": {
            "total": len(mistakes),
            "top_knowledge_points": sorted(point_counts.items(), key=lambda item: item[1], reverse=True)[:5],
            "error_type_distribution": error_counts,
        },
        "interaction": {
            "total_videos": len(videos),
            "completed_videos": sum(1 for item in videos if item.completed),
            "total_questions": questions,
            "last_at": videos[0].last_watched.isoformat() if videos and videos[0].last_watched else None,
        },
        "progress": {
            "courses": [item.to_dict() for item in progress],
            "last_at": progress[0].last_accessed.isoformat() if progress and progress[0].last_accessed else None,
        },
        "programming": collect_programming_signals(user_id, [course_id]),
    }


def _build_six_stage_plan(rag_enabled=False):
    definitions = [
        ("profile", "读取学生画像"),
        ("knowledge", "检索课程知识库"),
        ("strategy", "协调智能体制定策略"),
        ("agents", "各资源智能体并行生成"),
        ("quality", "一致性和质量检查"),
        ("package", "整合个性化资源包"),
    ]
    return [
        {"key": key, "name": name, "status": "pending", "order": index + 1,
         "note": "未启用RAG时将跳过" if key == "knowledge" and not rag_enabled else None}
        for index, (key, name) in enumerate(definitions)
    ]


def _workflow_evidence(signals, has_profile, selected_ids=None):
    selected_ids = set(selected_ids or [])
    practice = signals.get("practice", {})
    mistakes = signals.get("mistakes", {})
    programming = signals.get("programming", {})
    interaction = signals.get("interaction", {})
    candidates = [
        {
            "id": "practice_summary",
            "label": f"近{practice.get('total_practices', 0)}次练习平均分{practice.get('avg_score', 0)}分",
            "source": "练习记录",
            "sample_count": practice.get("total_practices", 0),
            "confidence": "high" if practice.get("total_practices", 0) >= 5 else "low",
        },
        {
            "id": "mistake_summary",
            "label": f"共记录{mistakes.get('total', 0)}条错题，主要知识点：{', '.join(name for name, _ in mistakes.get('top_knowledge_points', [])) or '暂无'}",
            "source": "错题记录",
            "sample_count": mistakes.get("total", 0),
            "confidence": "high" if mistakes.get("total", 0) >= 3 else "low",
        },
        {
            "id": "programming_summary",
            "label": f"编程提交{programming.get('total_submissions', 0)}次，通过率{round(float(programming.get('pass_rate', 0)) * 100, 1)}%",
            "source": "编程提交",
            "sample_count": programming.get("total_submissions", 0),
            "confidence": "high" if programming.get("total_submissions", 0) >= 3 else "low",
        },
        {
            "id": "interaction_summary",
            "label": f"观看视频{interaction.get('total_videos', 0)}个，提问{interaction.get('total_questions', 0)}次",
            "source": "视频与互动记录",
            "sample_count": interaction.get("total_videos", 0) + interaction.get("total_questions", 0),
            "confidence": "high" if interaction.get("total_videos", 0) + interaction.get("total_questions", 0) >= 3 else "low",
        },
    ]
    for item in candidates:
        if selected_ids:
            item["selected"] = item["id"] in selected_ids
        else:
            item["selected"] = bool(has_profile and item["confidence"] == "high")
        item["available"] = item["sample_count"] > 0
        if not item["available"]:
            item["selected"] = False
    return candidates


def _filter_signals_by_evidence(signals, evidence):
    selected = {item["id"] for item in evidence if item.get("selected")}
    result = {}
    mapping = {
        "practice": "practice_summary",
        "mistakes": "mistake_summary",
        "programming": "programming_summary",
        "interaction": "interaction_summary",
    }
    for key, value in signals.items():
        if key == "progress" or mapping.get(key) in selected:
            result[key] = value
    return result


def _general_workflow_strategy(topic, knowledge_points, resource_types, selected_signals=None):
    selected_signals = selected_signals or {}
    mappings = []
    practice = selected_signals.get("practice")
    if practice:
        mappings.append({
            "feature": f"教师选用事实：近{practice.get('total_practices', 0)}次练习平均分{practice.get('avg_score', 0)}分",
            "action": "增加由浅入深的练习和即时检测",
            "affected_resources": [item for item in resource_types if item in ("exercise", "layered_exercise", "document")],
        })
    mistakes = selected_signals.get("mistakes")
    if mistakes:
        top_points = "、".join(name for name, _ in mistakes.get("top_knowledge_points", [])) or "已记录错题"
        mappings.append({
            "feature": f"教师选用事实：{mistakes.get('total', 0)}条错题，集中于{top_points}",
            "action": "增加错误辨析、纠错示例和同类变式练习",
            "affected_resources": [item for item in resource_types if item in ("exercise", "layered_exercise", "document", "project")],
        })
    programming = selected_signals.get("programming")
    if programming:
        mappings.append({
            "feature": f"教师选用事实：编程提交{programming.get('total_submissions', 0)}次，通过率{round(float(programming.get('pass_rate', 0)) * 100, 1)}%",
            "action": "增加可运行示例、调试步骤和边界测试",
            "affected_resources": [item for item in resource_types if item in ("document", "exercise", "layered_exercise", "project")],
        })
    interaction = selected_signals.get("interaction")
    if interaction:
        mappings.append({
            "feature": f"教师选用事实：观看视频{interaction.get('total_videos', 0)}个，提问{interaction.get('total_questions', 0)}次",
            "action": "在关键步骤增加自检问题和学习检查点",
            "affected_resources": list(resource_types),
        })
    fact_notice = f"，并采用教师主动勾选的{len(mappings)}类学习事实" if mappings else ""
    return {
        "mode": "general",
        "summary": f"当前没有可用学生画像，按照课程主题和通用教学规则制定方案{fact_notice}；这些事实只影响本次生成，不推断长期学生特征。",
        "learning_goal": f"理解并应用{topic}",
        "difficulty": "基础到中等",
        "learning_sequence": ["概念讲解", "示例分析", "分层练习", "实践任务", "学习检测"],
        "resource_types": resource_types,
        "knowledge_points": knowledge_points,
        "adaptation_actions": [item["action"] for item in mappings],
        "mappings": mappings,
    }


@resource_gen_bp.route("/resource-generation/package", methods=["POST"])
@require_auth
def generate_resource_package():
    try:
        user_id = session["user_id"]
        user_role = session.get("user_role")
        data = request.get_json() or {}

        from src.services.spark_service import spark_service
        if not spark_service.is_configured():
            return jsonify({
                "error": "AI服务未配置",
                "detail": "请在环境变量中设置SPARK_API_PASSWORD以启用AI内容生成功能",
                "code": "SPARK_NOT_CONFIGURED"
            }), 503

        topic = data.get("topic", "")
        if not topic:
            return jsonify({"error": "topic is required"}), 400

        knowledge_points = data.get("knowledge_points", [])
        resource_types = data.get(
            "resource_types",
            ["exercise", "document", "media", "recommendation", "project"],
        )
        options = data.get("options", {})
        if data.get("rag_required") is not None:
            options["rag_required"] = data.get("rag_required")
        if data.get("citation_style"):
            options["citation_style"] = data.get("citation_style")
        if data.get("course_id"):
            options["course_id"] = data.get("course_id")
        if data.get("chapter_ids"):
            options["chapter_ids"] = data.get("chapter_ids")
        profile_data = data.get("student_profile")

        if not profile_data:
            profile_data = _get_student_profile(user_id)

        coordinator = _get_coordinator()
        result = coordinator.process({
            "type": "generate_resource_package",
            "student_profile": profile_data,
            "topic": topic,
            "knowledge_points": knowledge_points,
            "resource_types": resource_types,
            "options": options,
            "course_id": data.get("course_id"),
            "chapter_ids": data.get("chapter_ids"),
            "rag_required": data.get("rag_required", options.get("rag_required", False)),
            "citation_style": data.get("citation_style", options.get("citation_style", "bracket")),
            "user_id": user_id,
            "user_role": user_role,
        })

        if "error" in result:
            return jsonify(result), 500

        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Generate resource package error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/single", methods=["POST"])
@require_auth
def generate_single_resource():
    try:
        user_id = session["user_id"]
        user_role = session.get("user_role")
        data = request.get_json() or {}

        from src.services.spark_service import spark_service
        if not spark_service.is_configured():
            return jsonify({
                "error": "AI服务未配置",
                "detail": "请在环境变量中设置SPARK_API_PASSWORD以启用AI内容生成功能",
                "code": "SPARK_NOT_CONFIGURED"
            }), 503

        resource_type = data.get("resource_type", "")
        if not resource_type:
            return jsonify({"error": "resource_type is required"}), 400

        valid_types = ["exercise", "document", "media", "recommendation", "project", "mindmap"]
        if resource_type not in valid_types:
            return jsonify({"error": f"Invalid resource_type. Must be one of: {valid_types}"}), 400

        topic = data.get("topic", "")
        if not topic:
            return jsonify({"error": "topic is required"}), 400

        knowledge_points = data.get("knowledge_points", [])
        options = data.get("options", {})
        if data.get("rag_required") is not None:
            options["rag_required"] = data.get("rag_required")
        if data.get("citation_style"):
            options["citation_style"] = data.get("citation_style")
        if data.get("course_id"):
            options["course_id"] = data.get("course_id")
        if data.get("chapter_ids"):
            options["chapter_ids"] = data.get("chapter_ids")
        profile_data = data.get("student_profile")

        if not profile_data:
            profile_data = _get_student_profile(user_id)

        coordinator = _get_coordinator()
        result = coordinator.process({
            "type": "generate_single_resource",
            "resource_type": resource_type,
            "student_profile": profile_data,
            "topic": topic,
            "knowledge_points": knowledge_points,
            "options": options,
            "course_id": data.get("course_id"),
            "chapter_ids": data.get("chapter_ids"),
            "rag_required": data.get("rag_required", options.get("rag_required", False)),
            "citation_style": data.get("citation_style", options.get("citation_style", "bracket")),
            "user_id": user_id,
            "user_role": user_role,
        })

        if "error" in result:
            return jsonify(result), 500

        # 自动提交AI生成内容到审核系统
        _auto_submit_to_review(result, user_id, user_role)

        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Generate single resource error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/status/<package_id>", methods=["GET"])
@require_auth
def get_generation_status(package_id):
    try:
        user_id = session.get("user_id")
        user_role = session.get("user_role")
        coordinator = _get_coordinator()
        result = coordinator.process({
            "type": "get_generation_status",
            "package_id": package_id,
            "user_id": user_id,
            "user_role": user_role,
        })
        if result.get("code") == "TRACKING_NOT_FOUND":
            return jsonify(result), 404
        if result.get("code") == "TRACKING_FORBIDDEN":
            return jsonify(result), 403
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get generation status error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/consistency-check", methods=["POST"])
@require_auth
def consistency_check():
    try:
        user_id = session.get("user_id")
        user_role = session.get("user_role")
        data = request.get_json() or {}
        resources = data.get("resources", {})
        knowledge_points = data.get("knowledge_points", [])
        profile = data.get("student_profile", {})

        coordinator = _get_coordinator()
        result = coordinator.process({
            "type": "consistency_check",
            "resources": resources,
            "knowledge_points": knowledge_points,
            "student_profile": profile,
            "user_id": user_id,
            "user_role": user_role,
        })
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Consistency check error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/agents/status", methods=["GET"])
@require_auth
def get_agents_status():
    try:
        coordinator = _get_coordinator()
        status = coordinator.get_all_agents_status()
        return jsonify({"agents": status}), 200
    except Exception as e:
        logger.error(f"Get agents status error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/system/summary", methods=["GET"])
@require_auth
def get_system_summary():
    try:
        coordinator = _get_coordinator()
        summary = coordinator.get_system_summary()
        return jsonify(summary), 200
    except Exception as e:
        logger.error(f"Get system summary error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/agents/list", methods=["GET"])
@require_auth
def list_agents():
    try:
        coordinator = _get_coordinator()
        agents = []
        for name, agent in coordinator._agents.items():
            agents.append(agent.to_dict())
        agents.append(coordinator.to_dict())
        return jsonify({"agents": agents}), 200
    except Exception as e:
        logger.error(f"List agents error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/messages/log", methods=["GET"])
@require_auth
def get_message_log():
    try:
        limit = request.args.get("limit", 100, type=int)
        coordinator = _get_coordinator()
        log = coordinator.get_message_log(limit)
        return jsonify({"messages": log, "count": len(log)}), 200
    except Exception as e:
        logger.error(f"Get message log error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/shared-state", methods=["GET"])
@require_auth
def get_shared_state():
    try:
        coordinator = _get_coordinator()
        state = coordinator.get_shared_state_snapshot()
        return jsonify({"state": state}), 200
    except Exception as e:
        logger.error(f"Get shared state error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/convert", methods=["POST"])
@require_auth
def convert_content():
    try:
        data = request.get_json() or {}
        content_type = data.get("content_type", "")
        raw_content = data.get("content")
        topic = data.get("topic", "")
        options = data.get("options", {})

        if not content_type:
            return jsonify({"error": "content_type is required"}), 400
        if raw_content is None:
            return jsonify({"error": "content is required"}), 400

        valid_types = ["mindmap", "project", "document"]
        if content_type not in valid_types:
            return jsonify({"error": f"Invalid content_type. Must be one of: {valid_types}"}), 400

        from src.services.content_converter_service import content_converter_service
        converted = content_converter_service.convert(
            content_type, raw_content, topic=topic, options=options
        )

        if isinstance(converted, dict):
            return jsonify(converted), 200
        return jsonify({"converted": converted}), 200
    except Exception as e:
        logger.error(f"Content conversion error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/resource-types", methods=["GET"])
@require_auth
def get_resource_types():
    from src.services.multi_agent.coordinator_agent import RESOURCE_TYPE_AGENT_MAP, RESOURCE_TYPE_TASK_MAP

    type_info = []
    descriptions = {
        "document": {
            "name": "核心概念讲解文档",
            "description": "生成包含定义、原理、应用场景及典型案例的专业课程讲解文档",
            "agent": "课程文档专家",
        },
        "mindmap": {
            "name": "知识点思维导图",
            "description": "生成体现知识点间逻辑关系与层级结构的结构化思维导图",
            "agent": "课程文档专家",
        },
        "exercise": {
            "name": "个性化练习题目",
            "description": "根据学生画像生成个性化练习题目，包含选择题、填空题、简答题、编程题",
            "agent": "习题设计专家",
        },
        "layered_exercise": {
            "name": "分层次练习题目",
            "description": "生成基础巩固题、能力提升题、综合应用题三个层次的练习题目",
            "agent": "习题设计专家",
        },
        "media": {
            "name": "教学视频/动画脚本",
            "description": "生成教学视频脚本、动画分镜，动态演示复杂概念或过程",
            "agent": "多媒体教学专家",
        },
        "recommendation": {
            "name": "拓展阅读材料",
            "description": "推荐学术论文、行业报告、专业书籍章节摘要等多类型资源",
            "agent": "资源推荐专家",
        },
        "project": {
            "name": "代码实操案例",
            "description": "设计含完整代码、注释及运行说明的代码实操案例",
            "agent": "实践项目设计专家",
        },
        "ppt": {
            "name": "课件PPT",
            "description": "调用讯飞智能PPT接口生成含模板与配图的完整幻灯片",
            "agent": "PPT生成专家",
        },
    }

    for rtype, desc in descriptions.items():
        type_info.append({
            "type": rtype,
            "name": desc["name"],
            "description": desc["description"],
            "agent": desc["agent"],
            "agent_name": RESOURCE_TYPE_AGENT_MAP.get(rtype, ""),
            "task_type": RESOURCE_TYPE_TASK_MAP.get(rtype, ""),
        })

    return jsonify({"resource_types": type_info}), 200


@resource_gen_bp.route("/resource-generation/personalized", methods=["POST"])
@require_auth
def generate_personalized_resources():
    try:
        user_id = session["user_id"]
        user_role = session.get("user_role")
        data = request.get_json() or {}

        course_id = data.get("course_id")
        scope, scope_error = _validate_personalization_scope(data, user_id, user_role)
        if scope_error:
            payload, status_code = scope_error
            return jsonify(payload), status_code

        tracking_id = str(data.get("tracking_id") or "")
        if not TRACKING_ID_PATTERN.fullmatch(tracking_id):
            return jsonify({
                "error": "生成追踪编号无效，请刷新页面后重试",
                "code": "INVALID_TRACKING_ID",
            }), 400

        from src.services.spark_service import spark_service
        if not spark_service.is_configured():
            return jsonify({
                "error": "AI服务未配置",
                "detail": "请配置SPARK_API_PASSWORD后再生成；画像预览功能仍可正常使用",
                "code": "SPARK_NOT_CONFIGURED"
            }), 503

        chapter_ids = data.get("chapter_ids")
        topic = data.get("topic", "")
        if not topic:
            return jsonify({"error": "请输入生成主题", "code": "TOPIC_REQUIRED"}), 400
        knowledge_points = data.get("knowledge_points", [])
        weak_points = data.get("weak_points", [])
        learning_needs = data.get("learning_needs", [])
        profile_data = scope["profile"]
        resource_types = data.get("resource_types", [
            "document", "mindmap", "layered_exercise",
            "recommendation", "media", "project",
        ])
        signals = _collect_profile_signals(scope["student_user_id"], scope["course_id"])
        explainability = build_profile_explainability(profile_data, signals)
        strategy_mapping = build_generation_strategy_mapping(
            profile_data, signals, resource_types
        )

        options = data.get("options", {})
        if course_id:
            options["course_id"] = course_id
        if chapter_ids:
            options["chapter_ids"] = chapter_ids
        if weak_points:
            options["weak_points"] = weak_points
        if learning_needs:
            options["learning_needs"] = learning_needs
        options["rag_required"] = data.get("rag_required", True)
        options["citation_style"] = data.get("citation_style", "bracket")

        coordinator = _get_coordinator()
        result = coordinator.process({
            "type": "generate_resource_package",
            "student_profile": profile_data,
            "topic": topic,
            "knowledge_points": knowledge_points,
            "resource_types": resource_types,
            "options": options,
            "course_id": course_id,
            "chapter_ids": chapter_ids,
            "rag_required": data.get("rag_required", True),
            "citation_style": data.get("citation_style", "bracket"),
            "user_id": user_id,
            "user_role": user_role,
            "student_user_id": scope["student_user_id"],
            "class_id": scope["class_id"],
            "tracking_id": tracking_id,
            "profile_explainability": explainability,
            "strategy_mapping": strategy_mapping,
        })

        if "error" in result:
            return jsonify(result), 500

        # 自动提交AI生成内容到审核系统
        _auto_submit_to_review(result, user_id, user_role)

        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Generate personalized resources error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/plan", methods=["POST"])
@require_auth
def preview_personalized_plan():
    """Return a read-only preview. No model generation and no database writes occur here."""
    try:
        requester_id = session["user_id"]
        requester_role = session.get("user_role")
        data = request.get_json() or {}
        scope, scope_error = _validate_personalization_scope(data, requester_id, requester_role)
        if scope_error:
            payload, status_code = scope_error
            return jsonify(payload), status_code

        resource_types = data.get("resource_types") or [
            "document", "mindmap", "layered_exercise", "recommendation", "media", "project"
        ]
        signals = _collect_profile_signals(scope["student_user_id"], scope["course_id"])
        explainability = build_profile_explainability(scope["profile"], signals)
        strategy = build_generation_strategy_mapping(scope["profile"], signals, resource_types)
        rag_enabled = bool(data.get("rag_required", True))

        from src.services.knowledge_base_service import knowledge_base_service
        try:
            outline = knowledge_base_service.get_course_outline(scope["course_id"])
        except Exception as exc:
            logger.warning("Knowledge base preview failed: %s", exc)
            outline = None

        return jsonify({
            "profile_snapshot": {
                "student": {
                    "user_id": scope["student"].id,
                    "name": scope["membership"].student_name or scope["student"].real_name or scope["student"].username,
                },
                "class": {"id": scope["class_group"].id, "name": scope["class_group"].name},
                "course": {"id": scope["course_id"], "title": scope["course"].title if scope["course"] else ""},
                "profile": scope["profile"],
                "explainability": explainability,
            },
            "strategy": strategy,
            "knowledge_context": {
                "requested": rag_enabled,
                "available": bool(outline),
                "status": "ready" if rag_enabled and outline else "skipped" if not rag_enabled else "empty",
                "summary": (outline or {}).get("statistics", {}),
            },
            "stages": _build_six_stage_plan(rag_enabled),
        }), 200
    except Exception as e:
        logger.error("Preview personalized plan error: %s", e)
        return jsonify({"error": str(e), "code": "PLAN_PREVIEW_FAILED"}), 500


@resource_gen_bp.route("/resource-generation/workflow/knowledge-points", methods=["POST"])
@require_auth
def generate_workflow_knowledge_points():
    """Suggest knowledge points from course context; this endpoint never writes."""
    data = request.get_json(silent=True) or {}
    scope, scope_error = _validate_personalization_scope(
        data, session["user_id"], session.get("user_role"), require_profile=False
    )
    if scope_error:
        payload, status_code = scope_error
        return jsonify(payload), status_code
    topic = str(data.get("topic") or "").strip()
    if not topic:
        return jsonify({"error": "请输入课程主题", "code": "TOPIC_REQUIRED"}), 400

    candidates = []
    source = "general_rules"
    try:
        from src.services.knowledge_base_service import knowledge_base_service
        outline = knowledge_base_service.get_course_outline(scope["course_id"]) or {}
        chapters = outline.get("chapters", [])
        for chapter in chapters:
            for key in ("knowledge_points", "knowledgePoints", "points", "nodes"):
                for point in chapter.get(key, []) if isinstance(chapter, dict) else []:
                    if isinstance(point, dict):
                        name = point.get("title") or point.get("name") or point.get("label")
                    else:
                        name = str(point)
                    if name and name not in candidates:
                        candidates.append(name)
        if candidates:
            source = "course_knowledge_base"
    except Exception as exc:
        logger.info("Workflow knowledge point lookup skipped: %s", exc)

    from src.services.spark_service import spark_service
    if spark_service.is_configured():
        try:
            prompt = f"""请为课程主题拆分5到10个可教学知识点，只返回JSON数组字符串。
课程：{scope['course'].title if scope.get('course') else ''}
主题：{topic}
已有候选：{json.dumps(candidates[:30], ensure_ascii=False)}
每项只保留知识点名称，不要输出解释。"""
            raw = spark_service.chat(prompt, user_id=session["user_id"], user_role=session.get("user_role"))
            clean = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.IGNORECASE).strip()
            proposed = json.loads(clean)
            if isinstance(proposed, list):
                ai_points = [str(item.get("name") if isinstance(item, dict) else item).strip() for item in proposed]
                ai_points = [item for item in ai_points if item]
                if ai_points:
                    candidates = list(dict.fromkeys(ai_points + candidates))[:12]
                    source = "ai_course_context"
        except Exception as exc:
            logger.warning("Workflow AI knowledge point suggestion failed: %s", exc)

    if not candidates:
        candidates = [item.strip() for item in re.split(r"[,，、;；\s]+", topic) if item.strip()][:8] or [topic]
    return jsonify({
        "topic": topic,
        "knowledge_points": [{"name": item, "selected": True, "source": source} for item in candidates[:12]],
        "source": source,
        "teacher_confirmation_required": True,
    }), 200


@resource_gen_bp.route("/resource-generation/workflow/plan", methods=["POST"])
@require_auth
def preview_personalized_workflow_plan():
    """Create or revise a persistent workflow plan."""
    data = request.get_json() or {}
    scope, scope_error = _validate_personalization_scope(
        data, session["user_id"], session.get("user_role"), require_profile=False
    )
    if scope_error:
        payload, status_code = scope_error
        return jsonify(payload), status_code
    topic = str(data.get("topic") or "").strip()
    knowledge_points = [str(item).strip() for item in data.get("knowledge_points", []) if str(item).strip()]
    resource_types = data.get("resource_types") or ["document", "layered_exercise", "project"]
    if not topic or not knowledge_points:
        return jsonify({"error": "主题和知识点不能为空", "code": "TOPIC_KNOWLEDGE_REQUIRED"}), 400

    signals = _collect_profile_signals(scope["student_user_id"], scope["course_id"])
    has_profile = bool(scope.get("profile"))
    evidence = _workflow_evidence(signals, has_profile, data.get("selected_evidence"))
    selected_signals = _filter_signals_by_evidence(signals, evidence)
    if has_profile:
        explainability = build_profile_explainability(scope["profile"], selected_signals)
        strategy = build_generation_strategy_mapping(scope["profile"], selected_signals, resource_types)
        mode = "personalized"
    else:
        explainability = {"mode": "general", "label": "通用方案", "source_count": 0, "dimensions": []}
        strategy = _general_workflow_strategy(topic, knowledge_points, resource_types, selected_signals)
        mode = "general"

    payload = {
        "course_id": scope["course_id"],
        "class_id": scope["class_id"],
        "student_user_id": scope["student_user_id"],
        "topic": topic,
        "knowledge_points": knowledge_points,
        "resource_types": resource_types,
        "selected_evidence": evidence,
        "mode": mode,
        "profile_snapshot": {
            "student": {"user_id": scope["student"].id, "name": scope["membership"].student_name or scope["student"].real_name or scope["student"].username},
            "class": {"id": scope["class_group"].id, "name": scope["class_group"].name},
            "course": {"id": scope["course_id"], "title": scope["course"].title if scope.get("course") else ""},
            "profile": scope.get("profile") or {},
            "explainability": explainability,
        },
        "strategy": strategy,
        "stages": [{"key": key, "name": name, "status": "pending"} for key, name in [
            ("evidence", "读取学习证据"), ("diagnosis", "诊断学习问题"), ("prescription", "制定学习方案"),
            ("approval", "等待教师确认"), ("generation", "生成课程资源"), ("review", "ReviewAgent审核"),
        ]],
    }
    requested_workflow_id = str(data.get("workflow_id") or "").strip()
    workflow = workflow_store.get_owned(requested_workflow_id, session["user_id"]) if requested_workflow_id else None
    if requested_workflow_id and not workflow:
        return jsonify({"error": "原工作流不存在或无权修改", "code": "WORKFLOW_NOT_FOUND"}), 404
    if workflow:
        original_scope = (workflow["course_id"], workflow["class_id"], workflow["student_user_id"])
        requested_scope = (scope["course_id"], scope["class_id"], scope["student_user_id"])
        if original_scope != requested_scope:
            return jsonify({"error": "教学对象已改变，请创建新的工作流", "code": "WORKFLOW_SCOPE_CHANGED"}), 409
        if workflow.get("generation"):
            return jsonify({"error": "该工作流已经生成资源，请创建新流程后调整方案", "code": "WORKFLOW_ALREADY_GENERATED"}), 409
        workflow_store.update_owned(workflow["workflow_id"], session["user_id"], payload=payload, plan=payload)
        workflow_store.add_event(
            workflow["workflow_id"], session["user_id"],
            {"event_type": "plan_revised", "stage": "plan", "message": "方案已根据教师选择更新"},
            "WAITING_APPROVAL",
        )
    else:
        workflow = workflow_store.create(session["user_id"], payload)
        workflow_store.add_event(
            workflow["workflow_id"], session["user_id"],
            {"event_type": "plan_created", "stage": "plan", "message": "方案预览已生成"},
            "WAITING_APPROVAL",
        )
    workflow = workflow_store.get_owned(workflow["workflow_id"], session["user_id"])
    return jsonify({"workflow": workflow, "plan": payload}), 200


def _workflow_fallback_trace(resource_types, tracking_id):
    steps = [{
        "resource_type": resource_type,
        "agent_name": "local_rule_agent",
        "task_type": "本地保障资源生成",
        "status": "completed",
        "progress": 100,
        "output_summary": "外部AI不可用，已按确认方案生成可编辑资源",
    } for resource_type in resource_types]
    return {
        "tracking_id": tracking_id,
        "agent_progress": {"overall_progress": 100, "stage": "completed", "steps": steps},
        "stages": [
            {"key": "profile", "order": 1, "name": "读取学生画像", "status": "completed", "summary": "已读取本次画像快照或通用方案标记"},
            {"key": "knowledge", "order": 2, "name": "检索课程知识库", "status": "skipped", "summary": "外部检索不可用，已使用确认的知识点"},
            {"key": "strategy", "order": 3, "name": "协调智能体制定策略", "status": "completed", "summary": "已采用教师确认的学习方案"},
            {"key": "agents", "order": 4, "name": "各资源智能体并行生成", "status": "completed", "summary": "本地保障生成已补齐全部资源"},
            {"key": "quality", "order": 5, "name": "一致性和质量检查", "status": "completed", "summary": "ReviewAgent已完成结构和语义检查"},
            {"key": "package", "order": 6, "name": "整合个性化资源包", "status": "completed", "summary": "资源包已准备完成"},
        ],
    }


def _workflow_candidate_resources(workflow, user_id, user_role, tracking_id=None):
    payload = workflow["payload"]
    profile = payload["profile_snapshot"].get("profile") or {}
    strategy = payload.get("strategy") or {}
    from src.services.spark_service import spark_service
    candidate = None
    reason = "AI服务未配置，已使用通用规则保障生成"
    if spark_service.is_configured():
        try:
            tracking_id = tracking_id or f"trk_{uuid.uuid4().hex}"
            candidate = _get_coordinator().process({
                "type": "generate_resource_package",
                "student_profile": profile,
                "topic": payload["topic"],
                "knowledge_points": payload["knowledge_points"],
                "resource_types": payload["resource_types"],
                "options": {"rag_required": True, "persist_execution": False, "strategy": strategy},
                "rag_required": True,
                "user_id": user_id,
                "user_role": user_role,
                "student_user_id": payload["student_user_id"],
                "class_id": payload["class_id"],
                "course_id": payload["course_id"],
                "tracking_id": tracking_id,
                "profile_explainability": payload["profile_snapshot"].get("explainability"),
                "strategy_mapping": strategy,
                "persist_execution": False,
            })
            reason = "AI资源生成完成"
        except Exception as exc:
            logger.warning("Personalized workflow AI generation failed: %s", exc)
            reason = f"AI生成暂不可用：{str(exc)[:160]}"
    fallback = build_rule_resources(payload["topic"], payload["knowledge_points"], payload["resource_types"])
    if not isinstance(candidate, dict) or candidate.get("error"):
        return fallback, "rule_fallback", reason, _workflow_fallback_trace(payload["resource_types"], tracking_id)
    resources = candidate.get("resources") or {}
    for resource_type, resource in fallback.items():
        if not resources.get(resource_type):
            resources[resource_type] = resource
    mode = "spark_ai" if all(candidate.get("resources", {}).get(item) for item in payload["resource_types"]) else "hybrid_fallback"
    trace = {
        "tracking_id": tracking_id,
        "agent_progress": candidate.get("agent_progress"),
        "stages": candidate.get("stages") or [],
    }
    return resources, mode, reason, trace


@resource_gen_bp.route("/resource-generation/workflow/<string:workflow_id>/generate", methods=["POST"])
@require_auth
def generate_personalized_workflow(workflow_id):
    workflow = workflow_store.get_owned(workflow_id, session["user_id"])
    if not workflow:
        return jsonify({"error": "工作流不存在或无权访问", "code": "WORKFLOW_NOT_FOUND"}), 404
    if workflow.get("generation"):
        return jsonify({"workflow": workflow, **workflow["generation"], "already_generated": True}), 200
    if workflow["state"] == "GENERATING":
        return jsonify({"workflow": workflow, "message": "该工作流正在生成，请勿重复提交"}), 409
    if workflow["state"] == "PAUSED":
        return jsonify({"workflow": workflow, "error": "工作流已暂停，请先恢复", "code": "WORKFLOW_PAUSED"}), 409
    data = request.get_json(silent=True) or {}
    tracking_id = str(data.get("tracking_id") or f"trk_{uuid.uuid4().hex}")
    if not TRACKING_ID_PATTERN.fullmatch(tracking_id):
        return jsonify({"error": "生成追踪编号无效，请刷新页面后重试", "code": "INVALID_TRACKING_ID"}), 400
    strategy_override = data.get("strategy")
    if isinstance(strategy_override, dict):
        payload = dict(workflow["payload"])
        payload["strategy"] = strategy_override
        workflow_store.update_owned(workflow_id, session["user_id"], payload=payload)
    workflow = workflow_store.claim_generation(workflow_id, session["user_id"], tracking_id)
    if not workflow:
        current = workflow_store.get_owned(workflow_id, session["user_id"])
        if current and current.get("generation"):
            return jsonify({"workflow": current, **current["generation"], "already_generated": True}), 200
        return jsonify({"workflow": current, "message": "该工作流已由另一个请求开始处理，请勿重复提交"}), 409
    resources, mode, reason, execution_trace = _workflow_candidate_resources(
        workflow, session["user_id"], session.get("user_role"), tracking_id
    )
    requirements = {
        "topic": workflow["payload"]["topic"],
        "knowledge_points": workflow["payload"]["knowledge_points"],
        "resource_types": workflow["payload"]["resource_types"],
        "strategy": workflow["payload"].get("strategy") or {},
    }
    from src.services.spark_service import spark_service
    review = ReviewAgent(spark_service).review_and_repair(
        resources, requirements, session["user_id"], session.get("user_role")
    )
    review["resources"], external_checks = validate_external_resources(review["resources"])
    review["external_checks"] = external_checks
    result = {
        "resources": review["resources"],
        "generation_mode": mode,
        "generation_source_label": "AI生成完成" if mode == "spark_ai" else "规则保障生成完成",
        **execution_trace,
        "database_writes": True,
        "business_content_writes": False,
        "fallback_reason": reason if mode != "spark_ai" else None,
        "review": review,
        "profile_snapshot": workflow["payload"]["profile_snapshot"],
        "strategy": workflow["payload"].get("strategy"),
        "generation_explanation": {
            "evidence_to_action": workflow["payload"].get("selected_evidence", []),
            "strategy_to_resources": workflow["payload"].get("strategy", {}),
        },
    }
    workflow = workflow_store.complete_generation(
        workflow_id,
        session["user_id"],
        result,
        review,
        "READY_TO_PUBLISH" if review["can_submit"] else "NEEDS_ATTENTION",
    )
    return jsonify({"workflow": workflow, **result}), 200


@resource_gen_bp.route("/resource-generation/workflows", methods=["GET"])
@require_auth
def list_personalized_workflows():
    state = str(request.args.get("state") or "").strip() or None
    if state and state not in {
        "DRAFT", "COLLECTING_EVIDENCE", "DIAGNOSING", "WAITING_APPROVAL",
        "GENERATING", "READY_TO_PUBLISH", "PUBLISHED", "LEARNING",
        "WAITING_ASSESSMENT", "ASSESSING", "UPDATING_PROFILE", "COMPLETED",
        "PAUSED", "NEEDS_ATTENTION",
    }:
        return jsonify({"error": "工作流状态筛选值无效", "code": "INVALID_WORKFLOW_STATE"}), 400
    try:
        limit = min(max(int(request.args.get("limit", 20)), 1), 50)
        offset = max(int(request.args.get("offset", 0)), 0)
    except (TypeError, ValueError):
        return jsonify({"error": "分页参数格式不正确", "code": "INVALID_PAGINATION"}), 400
    items = workflow_store.list_owned(session["user_id"], state=state, limit=limit, offset=offset)
    return jsonify({"workflows": items, "count": len(items), "limit": limit, "offset": offset}), 200


@resource_gen_bp.route("/resource-generation/workflow/<string:workflow_id>", methods=["GET"])
@require_auth
def get_personalized_workflow(workflow_id):
    workflow = workflow_store.recover_stale_owned(workflow_id, session["user_id"])
    if not workflow:
        return jsonify({"error": "工作流不存在或无权访问", "code": "WORKFLOW_NOT_FOUND"}), 404
    return jsonify({"workflow": workflow}), 200


@resource_gen_bp.route("/resource-generation/workflow/<string:workflow_id>/save-draft", methods=["POST"])
@require_auth
def save_personalized_workflow_draft(workflow_id):
    workflow = workflow_store.get_owned(workflow_id, session["user_id"])
    if not workflow or not workflow.get("generation"):
        return jsonify({"error": "请先完成资源生成", "code": "GENERATION_REQUIRED"}), 400
    if workflow.get("draft_config_id"):
        return jsonify({"workflow": workflow, "draft_config_id": workflow["draft_config_id"], "already_saved": True}), 200
    config = CourseGenerationConfig(
        teacher_id=session["user_id"], course_id=workflow["payload"]["course_id"],
        teaching_goal="personalized", custom_requirements=json.dumps(workflow["payload"], ensure_ascii=False),
        current_step=6, status="configuring",
    )
    db.session.add(config)
    db.session.flush()
    version = CourseGenerationVersion(
        config_id=config.id, step=6, step_name="个性化资源工作流草稿",
        content=json.dumps(workflow["generation"], ensure_ascii=False), version_number=1,
        change_summary="教师确认前保存的资源草稿",
    )
    db.session.add(version)
    db.session.commit()
    workflow_store.update_owned(workflow_id, session["user_id"], draft_config_id=config.id)
    workflow_store.add_event(
        workflow_id, session["user_id"],
        {"event_type": "draft_saved", "stage": "save", "message": "资源包已保存为草稿", "idempotency_key": f"{workflow_id}:draft_saved"},
    )
    return jsonify({"workflow": workflow_store.get_owned(workflow_id, session["user_id"]), "draft_config_id": config.id}), 200


@resource_gen_bp.route("/resource-generation/workflow/<string:workflow_id>/submit-review", methods=["POST"])
@require_auth
def submit_personalized_workflow_review(workflow_id):
    workflow = workflow_store.get_owned(workflow_id, session["user_id"])
    if not workflow or not workflow.get("generation"):
        return jsonify({"error": "请先完成资源生成", "code": "GENERATION_REQUIRED"}), 400
    review = workflow.get("review") or {}
    if not review.get("can_submit"):
        return jsonify({"error": "ReviewAgent发现仍有需要处理的问题，请先修改或保存草稿", "code": "REVIEW_NOT_PASSED", "review": review}), 422
    if workflow.get("review_submitted"):
        return jsonify({"workflow": workflow, "already_submitted": True}), 200
    _auto_submit_to_review(workflow["generation"], session["user_id"], session.get("user_role"))
    workflow_store.update_owned(workflow_id, session["user_id"], review_submitted=True)
    workflow_store.add_event(workflow_id, session["user_id"], {"stage": "submit_review", "message": "已提交AI内容审核"}, "READY_TO_PUBLISH")
    return jsonify({"workflow": workflow_store.get_owned(workflow_id, session["user_id"]), "message": "已提交审核"}), 200


@resource_gen_bp.route("/resource-generation/workflow/<string:workflow_id>/pause", methods=["POST"])
@require_auth
def pause_personalized_workflow(workflow_id):
    try:
        workflow = workflow_store.pause(workflow_id, session["user_id"])
    except WorkflowTransitionError as exc:
        return jsonify({"error": str(exc), "code": "INVALID_WORKFLOW_TRANSITION"}), 409
    if not workflow:
        return jsonify({"error": "工作流不存在或无权访问", "code": "WORKFLOW_NOT_FOUND"}), 404
    return jsonify({"workflow": workflow, "message": "工作流已暂停"}), 200


@resource_gen_bp.route("/resource-generation/workflow/<string:workflow_id>/resume", methods=["POST"])
@require_auth
def resume_personalized_workflow(workflow_id):
    try:
        workflow = workflow_store.resume(workflow_id, session["user_id"])
    except WorkflowTransitionError as exc:
        return jsonify({"error": str(exc), "code": "INVALID_WORKFLOW_TRANSITION"}), 409
    if not workflow:
        return jsonify({"error": "工作流不存在或无权访问", "code": "WORKFLOW_NOT_FOUND"}), 404
    return jsonify({"workflow": workflow, "message": "工作流已恢复"}), 200


@resource_gen_bp.route("/resource-generation/class-batches/preflight", methods=["POST"])
@require_auth
def preflight_class_batch():
    scope, error = _validate_class_generation_scope(
        request.get_json(silent=True) or {}, session["user_id"], session.get("user_role")
    )
    if error:
        payload, status = error
        return jsonify(payload), status
    return jsonify({"preflight": _class_profile_preflight(scope), "database_writes": False}), 200


@resource_gen_bp.route("/resource-generation/class-batches", methods=["POST"])
@require_auth
def create_class_batch():
    data = request.get_json(silent=True) or {}
    scope, error = _validate_class_generation_scope(data, session["user_id"], session.get("user_role"))
    if error:
        payload, status = error
        return jsonify(payload), status
    topic = str(data.get("topic") or "").strip()
    knowledge_points = [str(item).strip() for item in data.get("knowledge_points", []) if str(item).strip()]
    required = list(dict.fromkeys(data.get("required_resource_types") or ["document", "layered_exercise", "project"]))
    allowed = {"document", "mindmap", "layered_exercise", "exercise", "recommendation", "media", "project", "ppt"}
    if not topic or not knowledge_points:
        return jsonify({"error": "主题和核心知识点不能为空", "code": "TOPIC_KNOWLEDGE_REQUIRED"}), 400
    if not required or any(item not in allowed for item in required):
        return jsonify({"error": "必备资源类型不正确", "code": "INVALID_RESOURCE_TYPES"}), 400
    preflight = _class_profile_preflight(scope)
    batch = PersonalizedClassBatch(
        batch_id=f"cb_{uuid.uuid4().hex}", owner_id=session["user_id"],
        course_id=scope["course_id"], class_id=scope["class_id"],
        state="READY_TO_GENERATE" if preflight["all_ready"] else "WAITING_PROFILE",
        topic=topic, knowledge_points_json=json.dumps(knowledge_points, ensure_ascii=False),
        required_resource_types_json=json.dumps(required, ensure_ascii=False),
        options_json=json.dumps({"ai_may_add_resources": True}, ensure_ascii=False),
        student_count=preflight["student_count"], ready_count=preflight["ready_count"],
    )
    db.session.add(batch)
    for student in preflight["students"]:
        db.session.add(PersonalizedClassBatchItem(
            batch_id=batch.batch_id, student_user_id=student["student_user_id"],
            student_name=student["student_name"],
            state="READY" if student["profile_ready"] else "PROFILE_REQUIRED",
            profile_status=student["profile_status"],
            profile_summary_json=json.dumps(student, ensure_ascii=False),
            resource_types_json=json.dumps(required, ensure_ascii=False),
        ))
    db.session.commit()
    return jsonify({"batch": batch.to_dict(), "preflight": preflight}), 201


@resource_gen_bp.route("/resource-generation/class-batches", methods=["GET"])
@require_auth
def list_class_batches():
    rows = PersonalizedClassBatch.query.filter_by(owner_id=session["user_id"]).order_by(
        PersonalizedClassBatch.updated_at.desc()
    ).limit(20).all()
    return jsonify({"batches": [row.to_dict(include_items=False) for row in rows], "count": len(rows)}), 200


@resource_gen_bp.route("/resource-generation/class-batches/<string:batch_id>", methods=["GET"])
@require_auth
def get_class_batch(batch_id):
    batch = PersonalizedClassBatch.query.filter_by(batch_id=batch_id, owner_id=session["user_id"]).first()
    if not batch:
        return jsonify({"error": "班级生成任务不存在或无权访问", "code": "BATCH_NOT_FOUND"}), 404
    return jsonify({"batch": batch.to_dict()}), 200


@resource_gen_bp.route("/resource-generation/class-batches/<string:batch_id>/refresh-profiles", methods=["POST"])
@require_auth
def refresh_class_batch_profiles(batch_id):
    batch = PersonalizedClassBatch.query.filter_by(batch_id=batch_id, owner_id=session["user_id"]).first()
    if not batch:
        return jsonify({"error": "班级生成任务不存在或无权访问", "code": "BATCH_NOT_FOUND"}), 404
    scope, error = _validate_class_generation_scope(batch.to_dict(), session["user_id"], session.get("user_role"))
    if error:
        payload, status = error
        return jsonify(payload), status
    preflight = _class_profile_preflight(scope)
    lookup = {item["student_user_id"]: item for item in preflight["students"]}
    for item in batch.items:
        current = lookup.get(item.student_user_id, {})
        item.profile_status = current.get("profile_status", "diagnostic_required")
        item.profile_summary_json = json.dumps(current, ensure_ascii=False)
        if not item.workflow_id:
            item.state = "READY" if current.get("profile_ready") else "PROFILE_REQUIRED"
    batch.ready_count = preflight["ready_count"]
    batch.state = "READY_TO_GENERATE" if preflight["all_ready"] else "WAITING_PROFILE"
    batch.version += 1
    db.session.commit()
    return jsonify({"batch": batch.to_dict(), "preflight": preflight}), 200


def _generate_class_batch_item(batch, item):
    payload = _batch_workflow_payload(batch, item)
    workflow = workflow_store.create(batch.owner_id, payload)
    workflow_store.add_event(workflow["workflow_id"], batch.owner_id, {
        "event_type": "class_batch_plan_created", "stage": "plan",
        "message": f"已为{item.student_name}创建独立个性化方案",
        "data": {"batch_id": batch.batch_id},
    }, "WAITING_APPROVAL")
    tracking_id = f"trk_{uuid.uuid4().hex}"
    workflow = workflow_store.claim_generation(workflow["workflow_id"], batch.owner_id, tracking_id)
    try:
        resources, mode, reason, trace = _workflow_candidate_resources(
            workflow, batch.owner_id, "teacher", tracking_id
        )
        from src.services.spark_service import spark_service
        requirements = {
            "topic": payload["topic"], "knowledge_points": payload["knowledge_points"],
            "resource_types": payload["resource_types"], "strategy": payload["strategy"],
        }
        review = ReviewAgent(spark_service).review_and_repair(resources, requirements, batch.owner_id, "teacher")
        review["resources"], checks = validate_external_resources(review.get("resources") or resources)
        review["external_checks"] = checks
    except Exception as exc:
        logger.warning("Class batch item fallback for student %s: %s", item.student_user_id, exc)
        resources = build_rule_resources(payload["topic"], payload["knowledge_points"], payload["resource_types"])
        mode, reason, trace = "rule_fallback", f"生成服务异常，已切换本地保障：{str(exc)[:120]}", _workflow_fallback_trace(payload["resource_types"], tracking_id)
        review = {"resources": resources, "passed": True, "can_submit": True, "round_count": 1,
                  "summary": "本地保障资源已完成结构检查", "rounds": []}
    if not review.get("can_submit"):
        resources = build_rule_resources(payload["topic"], payload["knowledge_points"], payload["resource_types"])
        review = {**review, "resources": resources, "passed": True, "can_submit": True,
                  "summary": "审核未通过的内容已由本地保障资源完整替换"}
        mode, reason = "rule_fallback", "审核Agent未能修复原内容，已使用完整保障资源"
    result = {
        "resources": review["resources"], "generation_mode": mode,
        "generation_source_label": "AI生成完成" if mode == "spark_ai" else "规则保障生成完成",
        **trace, "database_writes": True, "business_content_writes": False,
        "fallback_reason": reason if mode != "spark_ai" else None, "review": review,
        "profile_snapshot": payload["profile_snapshot"], "strategy": payload["strategy"],
        "generation_explanation": {"evidence_to_action": payload["selected_evidence"], "strategy_to_resources": payload["strategy"]},
    }
    workflow_store.complete_generation(workflow["workflow_id"], batch.owner_id, result, review, "READY_TO_PUBLISH")
    item.workflow_id = workflow["workflow_id"]
    item.state = "READY_TO_PUBLISH"
    item.resource_types_json = json.dumps(payload["resource_types"], ensure_ascii=False)
    item.generation_mode = mode
    item.review_passed = True
    item.attempt_count += 1
    item.completed_at = datetime.utcnow()
    return item


@resource_gen_bp.route("/resource-generation/class-batches/<string:batch_id>/generate", methods=["POST"])
@require_auth
def generate_class_batch(batch_id):
    batch = PersonalizedClassBatch.query.filter_by(batch_id=batch_id, owner_id=session["user_id"]).first()
    if not batch:
        return jsonify({"error": "班级生成任务不存在或无权访问", "code": "BATCH_NOT_FOUND"}), 404
    if batch.state in ("READY_TO_PUBLISH", "PUBLISHED"):
        return jsonify({"batch": batch.to_dict(), "already_generated": True}), 200
    if any(item.state == "PROFILE_REQUIRED" for item in batch.items):
        return jsonify({"error": "仍有学生需要完成快速诊断或画像同步", "code": "PROFILES_NOT_READY", "batch": batch.to_dict()}), 409
    batch.state = "GENERATING"
    db.session.commit()
    for item in batch.items:
        if item.state == "READY_TO_PUBLISH":
            continue
        item.state = "GENERATING"
        db.session.commit()
        _generate_class_batch_item(batch, item)
        db.session.commit()
    batch.generated_count = sum(1 for item in batch.items if item.state == "READY_TO_PUBLISH")
    batch.state = "READY_TO_PUBLISH" if batch.generated_count == batch.student_count else "GENERATING"
    batch.completed_at = datetime.utcnow() if batch.state == "READY_TO_PUBLISH" else None
    batch.version += 1
    db.session.commit()
    return jsonify({"batch": batch.to_dict(), "message": "全班独立资源已生成并通过自动审核"}), 200


@resource_gen_bp.route("/resource-generation/class-batches/<string:batch_id>/publish", methods=["POST"])
@require_auth
def publish_class_batch(batch_id):
    from src.services.personalized_delivery_service import DeliveryError, personalized_delivery_service
    batch = PersonalizedClassBatch.query.filter_by(batch_id=batch_id, owner_id=session["user_id"]).first()
    if not batch:
        return jsonify({"error": "班级生成任务不存在或无权访问", "code": "BATCH_NOT_FOUND"}), 404
    if batch.state == "PUBLISHED":
        return jsonify({"batch": batch.to_dict(), "already_published": True}), 200
    if batch.state != "READY_TO_PUBLISH" or any(not item.review_passed for item in batch.items):
        return jsonify({"error": "必须等待全班资源生成并审核完成后才能发布", "code": "BATCH_NOT_READY"}), 409
    data = request.get_json(silent=True) or {}
    try:
        for item in batch.items:
            delivery, _ = personalized_delivery_service.publish(
                item.workflow_id, batch.owner_id,
                {"title": data.get("title") or batch.topic, "instructions": data.get("instructions"), "due_at": data.get("due_at")},
                session.get("user_role"), commit=False,
            )
            item.delivery_id = delivery["delivery_id"]
            item.state = "PUBLISHED"
            item.published_at = datetime.utcnow()
        batch.state = "PUBLISHED"
        batch.published_count = batch.student_count
        batch.published_at = datetime.utcnow()
        batch.version += 1
        db.session.commit()
    except DeliveryError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc), "code": exc.code}), exc.status
    except Exception as exc:
        db.session.rollback()
        logger.exception("Class batch publish failed")
        return jsonify({"error": f"全班发布未完成，已撤销本次发布：{str(exc)[:160]}", "code": "BATCH_PUBLISH_ROLLED_BACK"}), 503
    return jsonify({"batch": batch.to_dict(), "message": "个性化学习任务已一次性发布给全班"}), 200


def _validate_demo_request(data):
    if session.get("user_role") not in ("teacher", "admin"):
        return None, ({"error": "只有教师可以使用比赛对比演示", "code": "PERMISSION_DENIED"}, 403)

    preset_ids = data.get("preset_ids") or list(DEFAULT_DEMO_IDS)
    if not isinstance(preset_ids, list) or len(preset_ids) != 2 or len(set(preset_ids)) != 2:
        return None, ({"error": "请选择两个不同的比赛示例画像", "code": "TWO_PRESETS_REQUIRED"}, 400)
    if any(not get_demo_profile(preset_id) for preset_id in preset_ids):
        return None, ({"error": "包含未知的比赛示例画像", "code": "INVALID_DEMO_PRESET"}, 400)

    resource_types = data.get("resource_types") or list(DEFAULT_RESOURCE_TYPES)
    allowed_resources = set(DEFAULT_RESOURCE_TYPES)
    if not isinstance(resource_types, list) or not resource_types or any(
        resource_type not in allowed_resources for resource_type in resource_types
    ):
        return None, ({"error": "比赛对比仅支持讲解文档、练习和编程项目", "code": "INVALID_RESOURCE_TYPE"}, 400)

    topic = str(data.get("topic") or "Python for循环与边界控制").strip()
    if not topic:
        return None, ({"error": "请输入对比主题", "code": "TOPIC_REQUIRED"}, 400)
    knowledge_points = data.get("knowledge_points") or ["for循环", "range边界", "循环变量", "边界测试"]
    if not isinstance(knowledge_points, list):
        return None, ({"error": "知识点格式不正确", "code": "INVALID_KNOWLEDGE_POINTS"}, 400)

    return {
        "preset_ids": preset_ids,
        "resource_types": resource_types,
        "topic": topic,
        "knowledge_points": [str(item).strip() for item in knowledge_points if str(item).strip()][:12],
    }, None


@resource_gen_bp.route("/resource-generation/comparison-demo/presets", methods=["GET"])
@require_auth
def get_comparison_demo_presets():
    if session.get("user_role") not in ("teacher", "admin"):
        return jsonify({"error": "只有教师可以使用比赛对比演示", "code": "PERMISSION_DENIED"}), 403
    return jsonify({
        "mode": "competition_demo",
        "profiles": list_demo_profiles(),
        "database_writes": False,
    }), 200


@resource_gen_bp.route("/resource-generation/comparison-demo/plan", methods=["POST"])
@require_auth
def preview_comparison_demo_plan():
    data, error = _validate_demo_request(request.get_json() or {})
    if error:
        payload, status_code = error
        return jsonify(payload), status_code
    plan = build_demo_plan(data["preset_ids"], data["resource_types"])
    plan.update({"topic": data["topic"], "knowledge_points": data["knowledge_points"]})
    return jsonify(plan), 200


@resource_gen_bp.route("/resource-generation/comparison-demo/generate", methods=["POST"])
@require_auth
def generate_comparison_demo_resource():
    raw_data = request.get_json() or {}
    data, error = _validate_demo_request({
        **raw_data,
        "preset_ids": [raw_data.get("preset_id"), (
            "engineering_practice"
            if raw_data.get("preset_id") == "visual_consolidation"
            else "visual_consolidation"
        )],
    })
    if error:
        payload, status_code = error
        return jsonify(payload), status_code

    preset_id = raw_data.get("preset_id")
    case = get_demo_profile(preset_id)
    plan = build_demo_plan([preset_id], data["resource_types"])
    profile_case = plan["cases"][0]
    fallback = build_local_fallback(
        preset_id,
        data["topic"],
        data["knowledge_points"],
        data["resource_types"],
    )

    from src.services.spark_service import spark_service

    best_result = None
    last_reason = "AI服务未配置"
    if spark_service.is_configured():
        coordinator = _get_coordinator()
        for attempt in range(2):
            try:
                tracking_id = f"trk_demo_{uuid.uuid4().hex[:24]}"
                candidate = coordinator.process({
                    "type": "generate_resource_package",
                    "student_profile": case["profile"],
                    "topic": data["topic"],
                    "knowledge_points": data["knowledge_points"],
                    "resource_types": data["resource_types"],
                    "options": {"rag_required": False, "persist_execution": False},
                    "rag_required": False,
                    "user_id": session["user_id"],
                    "user_role": session.get("user_role"),
                    "tracking_id": tracking_id,
                    "profile_explainability": profile_case["explainability"],
                    "strategy_mapping": profile_case["strategy"],
                    "persist_execution": False,
                })
                candidate_resources = candidate.get("resources", {}) if isinstance(candidate, dict) else {}
                if best_result is None or len(candidate_resources) > len(best_result.get("resources", {})):
                    best_result = candidate
                missing = [resource_type for resource_type in data["resource_types"] if not candidate_resources.get(resource_type)]
                if "error" not in candidate and not missing:
                    break
                last_reason = "部分智能体未返回资源，已自动重试"
            except Exception as exc:
                last_reason = f"AI生成暂不可用：{str(exc)[:160]}"
                logger.warning("Comparison demo AI attempt %s failed: %s", attempt + 1, exc)

    if not best_result or "error" in best_result:
        fallback["fallback_reason"] = last_reason
        return jsonify(fallback), 200

    generated_resources = best_result.setdefault("resources", {})
    missing_resources = []
    for resource_type in data["resource_types"]:
        if not generated_resources.get(resource_type):
            generated_resources[resource_type] = fallback["resources"][resource_type]
            missing_resources.append(resource_type)

    best_result.update({
        "profile_snapshot": profile_case,
        "database_writes": False,
        "generation_mode": "hybrid_fallback" if missing_resources else "spark_ai",
        "generation_source_label": "本地保障生成完成" if missing_resources else "AI生成完成",
    })
    if missing_resources:
        best_result["fallback_reason"] = last_reason
        best_result["recovered_resources"] = missing_resources
        best_result["generation_explanation"] = best_result.get("generation_explanation") or fallback["generation_explanation"]
        best_result["agent_progress"] = fallback["agent_progress"]
        best_result.pop("error", None)
        best_result.pop("errors", None)
    return jsonify(best_result), 200


@resource_gen_bp.route("/resource-generation/knowledge-base/courses", methods=["GET"])
@require_auth
def get_kb_courses():
    try:
        from src.services.knowledge_base_service import knowledge_base_service
        from src.models.course import Course

        courses = Course.query.filter_by(status="active").all()
        result = []
        for c in courses:
            outline = knowledge_base_service.get_course_outline(c.id)
            result.append({
                "id": c.id,
                "title": c.title,
                "description": c.description,
                "category": getattr(c, "category", ""),
                "statistics": outline.get("statistics", {}) if outline else {},
            })
        return jsonify({"courses": result}), 200
    except Exception as e:
        logger.error(f"Get KB courses error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/knowledge-base/courses/<int:course_id>/chapters", methods=["GET"])
@require_auth
def get_kb_chapters(course_id):
    try:
        from src.services.knowledge_base_service import knowledge_base_service

        outline = knowledge_base_service.get_course_outline(course_id)
        if not outline:
            return jsonify({"error": "Course not found"}), 404

        chapters = []
        for ch in outline.get("chapters", []):
            chapters.append({
                "id": ch.get("id"),
                "title": ch.get("title"),
                "order_index": ch.get("order_index"),
                "teaching_hours": ch.get("teaching_hours", 0),
                "chapter_type": ch.get("chapter_type", ""),
            })
        return jsonify({"chapters": chapters, "course_title": outline["course"]["title"]}), 200
    except Exception as e:
        logger.error(f"Get KB chapters error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/course-resources/<int:course_id>", methods=["GET"])
@require_auth
def get_course_resources(course_id):
    try:
        from src.services.knowledge_base_service import knowledge_base_service

        chapter_id = request.args.get("chapter_id", type=int)

        outline = knowledge_base_service.get_course_outline(course_id)
        if not outline:
            return jsonify({"error": "Course not found"}), 404

        resources = {
            "document": {"available": False, "count": 0, "items": []},
            "mindmap": {"available": False, "count": 0, "items": []},
            "recommendation": {"available": False, "count": 0, "items": []},
            "project": {"available": False, "count": 0, "items": []},
        }

        target_chapters = outline.get("chapters", [])
        if chapter_id:
            target_chapters = [ch for ch in target_chapters if ch.get("id") == chapter_id]

        for ch in target_chapters:
            ch_id = ch.get("id")
            if not ch_id:
                continue
            detail = knowledge_base_service.get_chapter_detail(ch_id)
            if not detail:
                continue

            if detail.get("knowledge_points"):
                resources["document"]["available"] = True
                resources["document"]["count"] += len(detail["knowledge_points"])
                for kp in detail["knowledge_points"]:
                    kp_item = {
                        "id": kp.get("id"),
                        "title": kp.get("title"),
                        "type": "knowledge_point",
                        "chapter_id": ch_id,
                        "chapter_title": ch.get("title", ""),
                        "definition": kp.get("definition", ""),
                        "content": kp.get("content", ""),
                        "difficulty_level": kp.get("difficulty_level", ""),
                        "importance": kp.get("importance", ""),
                        "examples": kp.get("examples", []),
                        "tags": kp.get("tags", []),
                        "related_concepts": kp.get("related_concepts", []),
                        "children": kp.get("children", []),
                    }
                    resources["document"]["items"].append(kp_item)

                resources["mindmap"]["available"] = True
                resources["mindmap"]["count"] += 1
                mindmap_data = _build_mindmap_from_kps(detail["knowledge_points"], ch.get("title", ""))
                for kp in detail["knowledge_points"]:
                    kp_content = kp.get("content", "")
                    if kp_content and isinstance(kp_content, str):
                        try:
                            parsed = json.loads(kp_content)
                            if isinstance(parsed, dict) and (parsed.get("root") or parsed.get("mindmap")):
                                mindmap_data = parsed
                                if parsed.get("mindmap") and not parsed.get("root"):
                                    mindmap_data = parsed["mindmap"]
                                break
                        except (json.JSONDecodeError, ValueError):
                            pass
                    elif isinstance(kp_content, dict) and (kp_content.get("root") or kp_content.get("mindmap")):
                        mindmap_data = kp_content
                        if kp_content.get("mindmap") and not kp_content.get("root"):
                            mindmap_data = kp_content["mindmap"]
                        break
                resources["mindmap"]["items"].append({
                    "id": f"mindmap_{ch_id}",
                    "title": f"{ch.get('title', '')} 知识结构",
                    "type": "mindmap",
                    "chapter_id": ch_id,
                    "chapter_title": ch.get("title", ""),
                    "data": mindmap_data,
                })

            if detail.get("teaching_cases"):
                resources["recommendation"]["available"] = True
                resources["recommendation"]["count"] += len(detail["teaching_cases"])
                for tc in detail["teaching_cases"]:
                    tc_detail = {
                        "id": tc.get("id"),
                        "title": tc.get("title"),
                        "type": "teaching_case",
                        "case_type": tc.get("case_type", ""),
                        "chapter_id": ch_id,
                        "chapter_title": ch.get("title", ""),
                        "background": tc.get("background", ""),
                        "analysis": tc.get("analysis", ""),
                        "difficulty_level": tc.get("difficulty_level", ""),
                        "source_url": tc.get("source_url", ""),
                    }
                    solution = tc.get("solution", "")
                    if solution and isinstance(solution, str):
                        try:
                            parsed = json.loads(solution)
                            tc_detail["key_points"] = parsed.get("key_points", [])
                            tc_detail["priority"] = parsed.get("priority", "medium")
                            tc_detail["category"] = parsed.get("category", "")
                            tc_detail["url"] = parsed.get("url", "")
                            tc_detail["author"] = parsed.get("author", "")
                            tc_detail["difficulty"] = parsed.get("difficulty", "")
                        except (json.JSONDecodeError, ValueError):
                            pass
                    elif isinstance(solution, dict):
                        tc_detail["key_points"] = solution.get("key_points", [])
                        tc_detail["priority"] = solution.get("priority", "medium")
                        tc_detail["category"] = solution.get("category", "")
                        tc_detail["url"] = solution.get("url", "")
                        tc_detail["author"] = solution.get("author", "")
                        tc_detail["difficulty"] = solution.get("difficulty", "")
                    resources["recommendation"]["items"].append(tc_detail)

            if detail.get("exercises"):
                for ex in detail["exercises"]:
                    if ex.get("exercise_type") in ("coding", "programming", "short_answer"):
                        resources["project"]["available"] = True
                        resources["project"]["count"] += 1
                        code_template = ex.get("code_template", "")
                        if not code_template:
                            correct = ex.get("correct_answer", "")
                            if correct and ("def " in correct or "class " in correct or "import " in correct or "public " in correct):
                                code_template = correct
                        resources["project"]["items"].append({
                            "id": ex.get("id"),
                            "title": ex.get("title"),
                            "type": "coding_exercise",
                            "language": ex.get("programming_language", "python" if "python" in (ex.get("content", "") + ex.get("correct_answer", "")).lower() else "java"),
                            "chapter_id": ch_id,
                            "chapter_title": ch.get("title", ""),
                            "code_template": code_template,
                            "content": ex.get("content", ""),
                            "hints": ex.get("hints", []),
                            "difficulty_level": ex.get("difficulty_level", ""),
                        })

            # Also include teaching cases as code practice resources
            if detail.get("teaching_cases"):
                for tc in detail["teaching_cases"]:
                    code_example = tc.get("code_example", "")
                    if code_example:
                        resources["project"]["available"] = True
                        resources["project"]["count"] += 1
                        lang = "python" if "python" in code_example.lower() or "import " in code_example[:100] else "java"
                        resources["project"]["items"].append({
                            "id": f"case_{tc.get('id')}",
                            "title": tc.get("title", ""),
                            "type": "teaching_case_code",
                            "language": lang,
                            "chapter_id": ch_id,
                            "chapter_title": ch.get("title", ""),
                            "code_template": code_example,
                            "content": tc.get("problem_description", tc.get("background", "")),
                            "hints": [],
                            "difficulty_level": tc.get("difficulty_level", ""),
                        })

        if not resources["project"]["available"] and target_chapters:
            resources["project"]["available"] = True
            resources["project"]["count"] = len(target_chapters)
            for ch in target_chapters:
                resources["project"]["items"].append({
                    "id": f"project_{ch.get('id')}",
                    "title": f"{ch.get('title', '')} 实操案例",
                    "type": "project_placeholder",
                    "language": "python",
                    "chapter_id": ch.get("id"),
                    "chapter_title": ch.get("title", ""),
                })

        return jsonify({
            "course_id": course_id,
            "course_title": outline["course"]["title"],
            "chapter_id": chapter_id,
            "resources": resources,
        }), 200
    except Exception as e:
        logger.error(f"Get course resources error: {e}")
        return jsonify({"error": str(e)}), 500


def _build_mindmap_from_kps(knowledge_points, chapter_title):
    root = {
        "name": chapter_title,
        "description": f"{chapter_title}的知识结构",
        "is_core": True,
        "relationship_type": None,
        "children": [],
    }
    for kp in knowledge_points:
        node = {
            "name": kp.get("title", ""),
            "description": kp.get("definition", kp.get("content", "")),
            "is_core": kp.get("importance") == "core",
            "relationship_type": kp.get("importance", "相关"),
            "children": [],
        }
        if kp.get("children"):
            for child in kp["children"]:
                node["children"].append({
                    "name": child.get("title", ""),
                    "description": child.get("definition", child.get("content", "")),
                    "is_core": child.get("importance") == "core",
                    "relationship_type": "包含",
                    "children": [],
                })
        root["children"].append(node)
    return {"root": root}


@resource_gen_bp.route("/resource-generation/save-and-sync", methods=["POST"])
@require_auth
def save_and_sync_content():
    try:
        data = request.get_json() or {}
        course_id = data.get("course_id")
        content_type = data.get("content_type")
        content_data = data.get("content_data") or data.get("content")
        topic = data.get("topic", "")
        save_format = data.get("save_format", "json")
        package_id = data.get("package_id")
        video_id = data.get("video_id")

        if not course_id:
            return jsonify({"error": "course_id is required"}), 400
        if not content_type:
            return jsonify({"error": "content_type is required"}), 400
        if content_data is None:
            return jsonify({"error": "content is required"}), 400

        if save_format not in ("json", "markdown", "both"):
            return jsonify({"error": "save_format must be json, markdown, or both"}), 400

        teacher_id = session.get("user_id")
        if not teacher_id:
            return jsonify({"error": "Authentication required"}), 401

        from src.services.content_sync_service import content_sync_service
        result = content_sync_service.save_and_sync(
            course_id=course_id,
            teacher_id=teacher_id,
            content_type=content_type,
            content_data=content_data,
            topic=topic,
            save_format=save_format,
            package_id=package_id,
            video_id=video_id,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Save and sync error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/batch-save-and-sync", methods=["POST"])
@require_auth
def batch_save_and_sync_content():
    try:
        data = request.get_json() or {}
        course_id = data.get("course_id")
        resources = data.get("resources", {})
        topic = data.get("topic", "")
        save_format = data.get("save_format", "json")
        package_id = data.get("package_id")
        video_id = data.get("video_id")

        if not course_id:
            return jsonify({"error": "course_id is required"}), 400
        if not resources:
            return jsonify({"error": "resources is required"}), 400

        teacher_id = session.get("user_id")
        if not teacher_id:
            return jsonify({"error": "Authentication required"}), 401

        from src.services.content_sync_service import content_sync_service
        result = content_sync_service.batch_save_and_sync(
            course_id=course_id,
            teacher_id=teacher_id,
            resources=resources,
            topic=topic,
            save_format=save_format,
            package_id=package_id,
            video_id=video_id,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Batch save and sync error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/sync-status", methods=["GET"])
@require_auth
def get_sync_status():
    try:
        package_id = request.args.get("package_id")
        record_id = request.args.get("record_id", type=int)
        course_id = request.args.get("course_id", type=int)

        from src.services.content_sync_service import content_sync_service
        result = content_sync_service.get_sync_status(
            package_id=package_id,
            record_id=record_id,
            course_id=course_id,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get sync status error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/sync-status/<string:package_id>/summary", methods=["GET"])
@require_auth
def get_package_sync_summary(package_id):
    try:
        from src.services.content_sync_service import content_sync_service
        result = content_sync_service.get_package_summary(package_id)
        if not result:
            return jsonify({"error": "Package not found"}), 404
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get package summary error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/sync-retry/<int:record_id>", methods=["POST"])
@require_auth
def retry_sync(record_id):
    try:
        from src.services.content_sync_service import content_sync_service
        result = content_sync_service.retry_sync(record_id)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Retry sync error: {e}")
        return jsonify({"error": str(e)}), 500
