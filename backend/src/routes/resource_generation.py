import json
import logging

from flask import Blueprint, jsonify, request, session
from src.utils.auth import require_auth

from src.models.user import db, User
from src.models.student_profile import StudentProfile
from src.services.multi_agent.coordinator_agent import CoordinatorAgent
from src.services.multi_agent.shared_state import agent_monitor

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

        # 自动提交AI生成内容到审核系统
        _auto_submit_to_review(result, user_id, user_role)

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

        from src.services.spark_service import spark_service
        if not spark_service.is_configured():
            return jsonify({
                "error": "AI服务未配置",
                "detail": "请在环境变量中设置SPARK_API_PASSWORD以启用AI内容生成功能",
                "code": "SPARK_NOT_CONFIGURED"
            }), 503

        course_id = data.get("course_id")
        chapter_ids = data.get("chapter_ids")
        topic = data.get("topic", "")
        knowledge_points = data.get("knowledge_points", [])
        weak_points = data.get("weak_points", [])
        learning_needs = data.get("learning_needs", [])
        profile_data = data.get("student_profile")

        if not profile_data:
            profile_data = _get_student_profile(user_id)

        resource_types = data.get("resource_types", [
            "document", "mindmap", "layered_exercise",
            "recommendation", "media", "project",
        ])

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
        })

        if "error" in result:
            return jsonify(result), 500

        # 自动提交AI生成内容到审核系统
        _auto_submit_to_review(result, user_id, user_role)

        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Generate personalized resources error: {e}")
        return jsonify({"error": str(e)}), 500


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
