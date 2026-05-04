import json
import logging

from flask import Blueprint, jsonify, request, session

from src.models.user import db, User
from src.models.student_profile import StudentProfile
from src.services.multi_agent.coordinator_agent import CoordinatorAgent
from src.services.multi_agent.shared_state import agent_monitor

logger = logging.getLogger(__name__)

resource_gen_bp = Blueprint("resource_generation", __name__)

_coordinator = None


def _get_coordinator():
    global _coordinator
    if _coordinator is None:
        from src.services.spark_service import spark_service
        _coordinator = CoordinatorAgent(spark_service=spark_service)
    return _coordinator


def require_auth(f):
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated


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
        data = request.get_json() or {}

        topic = data.get("topic", "")
        if not topic:
            return jsonify({"error": "topic is required"}), 400

        knowledge_points = data.get("knowledge_points", [])
        resource_types = data.get(
            "resource_types",
            ["exercise", "document", "media", "recommendation", "project"],
        )
        options = data.get("options", {})
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
        data = request.get_json() or {}

        resource_type = data.get("resource_type", "")
        if not resource_type:
            return jsonify({"error": "resource_type is required"}), 400

        valid_types = ["exercise", "document", "media", "recommendation", "project"]
        if resource_type not in valid_types:
            return jsonify({"error": f"Invalid resource_type. Must be one of: {valid_types}"}), 400

        topic = data.get("topic", "")
        if not topic:
            return jsonify({"error": "topic is required"}), 400

        knowledge_points = data.get("knowledge_points", [])
        options = data.get("options", {})
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
        })

        if "error" in result:
            return jsonify(result), 500

        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Generate single resource error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/status/<package_id>", methods=["GET"])
@require_auth
def get_generation_status(package_id):
    try:
        coordinator = _get_coordinator()
        result = coordinator.process({
            "type": "get_generation_status",
            "package_id": package_id,
        })
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get generation status error: {e}")
        return jsonify({"error": str(e)}), 500


@resource_gen_bp.route("/resource-generation/consistency-check", methods=["POST"])
@require_auth
def consistency_check():
    try:
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


@resource_gen_bp.route("/resource-generation/resource-types", methods=["GET"])
@require_auth
def get_resource_types():
    from src.services.multi_agent.coordinator_agent import RESOURCE_TYPE_AGENT_MAP, RESOURCE_TYPE_TASK_MAP

    type_info = []
    descriptions = {
        "exercise": {
            "name": "练习题目",
            "description": "根据学生画像生成个性化练习题目，包含选择题、填空题、简答题、编程题",
            "agent": "习题设计专家",
        },
        "document": {
            "name": "课程文档",
            "description": "生成专业课程讲解文档、知识笔记、复习总结、思维导图内容",
            "agent": "课程文档专家",
        },
        "media": {
            "name": "多媒体内容",
            "description": "生成教学视频脚本、动画分镜、信息图设计、交互式演示规格",
            "agent": "多媒体教学专家",
        },
        "recommendation": {
            "name": "拓展资源推荐",
            "description": "推荐学术论文、技术博客、开源项目、在线教程、数据集等多类型资源",
            "agent": "资源推荐专家",
        },
        "project": {
            "name": "实践项目",
            "description": "设计代码实操案例、实验项目、案例分析、综合实践项目",
            "agent": "实践项目设计专家",
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
