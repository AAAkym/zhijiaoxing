import logging

from flask import Blueprint, jsonify, request

from src.services.rag_citation_service import rag_citation_service
from src.services.syllabus_graph_service import syllabus_graph_service
from src.utils.auth import require_auth, require_role

logger = logging.getLogger(__name__)

knowledge_graph_bp = Blueprint("knowledge_graph", __name__)


def _detect_upload_type(filename=None, content=None, fallback=None):
    lower = (filename or "").lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith(".docx"):
        return "docx"

    sample = content or b""
    if isinstance(sample, str):
        sample = sample.encode("utf-8", errors="ignore")
    if sample.startswith(b"%PDF"):
        return "pdf"
    if sample.startswith(b"PK\x03\x04") or sample.startswith(b"PK\x05\x06") or sample.startswith(b"PK\x07\x08"):
        return "docx"
    return fallback or "text"


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>", methods=["DELETE"])
@require_auth
@require_role(["admin", "teacher"])
def delete_knowledge_graph(course_id):
    """删除指定课程的全部知识图谱数据（节点、边、来源片段）"""
    try:
        result = syllabus_graph_service.clear_graph(course_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Delete knowledge graph error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>/import-syllabus", methods=["POST"])
@require_auth
@require_role(["admin", "teacher"])
def import_syllabus(course_id):
    try:
        if request.content_type and request.content_type.startswith("multipart/form-data"):
            input_type = request.form.get("input_type")
            upload = request.files.get("file")
            content = upload.read() if upload else request.form.get("content", "")
            filename = upload.filename if upload else request.form.get("filename")
            input_type = _detect_upload_type(filename=filename, content=content, fallback=input_type or "docx")
            if upload and input_type in ("docx", "pdf"):
                import base64
                content = base64.b64encode(content).decode("ascii")
        else:
            data = request.get_json() or {}
            input_type = data.get("input_type", "text")
            content = data.get("content")
            filename = data.get("filename")
            input_type = _detect_upload_type(filename=filename, content=content, fallback=input_type)

        result = syllabus_graph_service.import_syllabus(course_id, input_type, content=content)
        if "error" in result:
            return jsonify(result), 404 if result["error"] == "Course not found" else 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Import syllabus to graph error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>", methods=["GET"])
@require_auth
def get_knowledge_graph(course_id):
    try:
        graph = syllabus_graph_service.get_graph(
            course_id=course_id,
            node_type=request.args.get("node_type"),
            edge_type=request.args.get("edge_type"),
            include_sources=request.args.get("include_sources", "true").lower() != "false",
        )
        return jsonify(graph), 200
    except Exception as e:
        logger.error(f"Get knowledge graph error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>/profile", methods=["GET"])
@require_auth
def get_course_profile(course_id):
    try:
        return jsonify({"course_profile": syllabus_graph_service.build_course_profile(course_id)}), 200
    except Exception as e:
        logger.error(f"Get course profile error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/rag/retrieve", methods=["POST"])
@require_auth
def rag_retrieve():
    try:
        data = request.get_json() or {}
        course_id = data.get("course_id")
        if not course_id:
            return jsonify({"error": "course_id is required"}), 400
        evidence = rag_citation_service.retrieve(
            course_id=course_id,
            query=data.get("query", ""),
            chapter_ids=data.get("chapter_ids"),
            knowledge_point_ids=data.get("knowledge_point_ids"),
            top_k=data.get("top_k", 6),
        )
        return jsonify({"evidence": evidence}), 200
    except Exception as e:
        logger.error(f"RAG retrieve error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/rag/verify", methods=["POST"])
@require_auth
def rag_verify():
    try:
        data = request.get_json() or {}
        return jsonify(rag_citation_service.verify(data.get("content", ""), data.get("citations", []))), 200
    except Exception as e:
        logger.error(f"RAG verify error: {e}")
        return jsonify({"error": str(e)}), 500
