import base64
import hashlib
import logging
import os
import shutil
import tempfile
import threading
import time
import traceback
import uuid
from collections import deque

from flask import Blueprint, jsonify, request, session

from src.services.rag_citation_service import rag_citation_service
from src.services.syllabus_graph_service import syllabus_graph_service
from src.utils.auth import require_auth, require_role

logger = logging.getLogger(__name__)

knowledge_graph_bp = Blueprint("knowledge_graph", __name__)

# 异步导入任务存储（task_id -> task_info）
_import_tasks = {}
_import_tasks_lock = threading.Lock()

CHUNK_UPLOAD_ROOT = os.path.join(tempfile.gettempdir(), "kg_chunk_uploads")
DEFAULT_CHUNK_SIZE = 1024 * 1024
MAX_CHUNK_SIZE = 5 * 1024 * 1024
UPLOAD_METRICS = deque(maxlen=200)


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


def _chunk_session_dir(upload_id):
    safe_id = "".join(ch for ch in str(upload_id or "") if ch.isalnum() or ch in ("-", "_"))
    if not safe_id:
        raise ValueError("upload_id is required")
    return os.path.join(CHUNK_UPLOAD_ROOT, safe_id)


def _read_chunk_meta(upload_dir):
    import json

    meta_path = os.path.join(upload_dir, "meta.json")
    if not os.path.exists(meta_path):
        raise ValueError("upload session not found")
    with open(meta_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _write_chunk_meta(upload_dir, meta):
    import json

    os.makedirs(upload_dir, exist_ok=True)
    with open(os.path.join(upload_dir, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False)


def _scan_received_chunks(upload_dir, total_chunks):
    received = []
    bytes_received = 0
    for idx in range(int(total_chunks or 0)):
        part_path = os.path.join(upload_dir, f"{idx:08d}.part")
        if os.path.exists(part_path):
            received.append(idx)
            bytes_received += os.path.getsize(part_path)
    return received, bytes_received


def _refresh_chunk_meta(upload_dir, meta):
    disk_received, bytes_received = _scan_received_chunks(upload_dir, meta.get("total_chunks", 0))
    meta["received_chunks"] = disk_received
    meta["bytes_received"] = bytes_received
    _write_chunk_meta(upload_dir, meta)
    return meta


def _record_upload_metric(course_id, filename, performance):
    total_ms = float((performance or {}).get("request_total_ms") or 0)
    bytes_received = int((performance or {}).get("bytes_received") or 0)
    metric = {
        "course_id": course_id,
        "filename": filename,
        "upload_mode": (performance or {}).get("upload_mode", "unknown"),
        "bytes_received": bytes_received,
        "request_total_ms": total_ms,
        "parse_ms": (performance or {}).get("parse_ms"),
        "assemble_ms": (performance or {}).get("assemble_ms"),
        "throughput_kbps": round((bytes_received / 1024) / (total_ms / 1000), 2) if total_ms > 0 and bytes_received else 0,
        "created_at": time.time(),
    }
    UPLOAD_METRICS.appendleft(metric)
    return metric


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
        request_started = time.perf_counter()
        rag_required = False
        citation_style = "bracket"
        if request.content_type and request.content_type.startswith("multipart/form-data"):
            input_type = request.form.get("input_type")
            upload = request.files.get("file")
            content = upload.read() if upload else request.form.get("content", "")
            raw_bytes_received = len(content) if isinstance(content, (bytes, bytearray)) else len(str(content or "").encode("utf-8"))
            filename = upload.filename if upload else request.form.get("filename")
            rag_required = request.form.get("rag_required", "false").lower() == "true"
            citation_style = request.form.get("citation_style", "bracket")
            input_type = _detect_upload_type(filename=filename, content=content, fallback=input_type or "docx")
            if upload and input_type in ("docx", "pdf"):
                import base64
                content = base64.b64encode(content).decode("ascii")
        else:
            data = request.get_json() or {}
            input_type = data.get("input_type", "text")
            content = data.get("content")
            raw_bytes_received = len(str(content or "").encode("utf-8"))
            filename = data.get("filename")
            rag_required = bool(data.get("rag_required", False))
            citation_style = data.get("citation_style", "bracket")
            input_type = _detect_upload_type(filename=filename, content=content, fallback=input_type)

        result = syllabus_graph_service.import_syllabus(
            course_id,
            input_type,
            content=content,
            rag_required=rag_required,
            citation_style=citation_style,
            user_id=session.get("user_id"),
            user_role=session.get("user_role"),
        )
        result.setdefault("performance", {})
        result["performance"].update({
            "request_total_ms": round((time.perf_counter() - request_started) * 1000, 2),
            "upload_mode": "single_request",
            "bytes_received": raw_bytes_received,
        })
        _record_upload_metric(course_id, filename, result["performance"])
        if "error" in result:
            return jsonify(result), 404 if result["error"] == "Course not found" else 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Import syllabus to graph error: {e}\n{traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>/import-syllabus/chunk/start", methods=["POST"])
@require_auth
@require_role(["admin", "teacher"])
def start_chunked_syllabus_import(course_id):
    try:
        data = request.get_json() or {}
        filename = data.get("filename") or "upload.bin"
        file_size = int(data.get("file_size") or 0)
        chunk_size = min(max(int(data.get("chunk_size") or DEFAULT_CHUNK_SIZE), 128 * 1024), MAX_CHUNK_SIZE)
        total_chunks = int(data.get("total_chunks") or 0)
        if file_size <= 0 or total_chunks <= 0:
            return jsonify({"error": "file_size and total_chunks are required"}), 400

        upload_id = f"kg_{course_id}_{uuid.uuid4().hex}"
        upload_dir = _chunk_session_dir(upload_id)
        meta = {
            "upload_id": upload_id,
            "course_id": course_id,
            "filename": filename,
            "file_size": file_size,
            "chunk_size": chunk_size,
            "total_chunks": total_chunks,
            "received_chunks": [],
            "created_at": time.time(),
            "bytes_received": 0,
            "content_hash": data.get("content_hash"),
            "rag_required": bool(data.get("rag_required", False)),
            "citation_style": data.get("citation_style", "bracket"),
        }
        _write_chunk_meta(upload_dir, meta)
        return jsonify({
            "upload_id": upload_id,
            "chunk_size": chunk_size,
            "total_chunks": total_chunks,
            "received_chunks": [],
        }), 200
    except Exception as e:
        logger.error(f"Start chunked syllabus import error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>/import-syllabus/chunk/<upload_id>", methods=["POST"])
@require_auth
@require_role(["admin", "teacher"])
def upload_syllabus_chunk(course_id, upload_id):
    try:
        started = time.perf_counter()
        upload_dir = _chunk_session_dir(upload_id)
        meta = _read_chunk_meta(upload_dir)
        if int(meta.get("course_id")) != int(course_id):
            return jsonify({"error": "upload session course mismatch"}), 400

        chunk_index = request.form.get("chunk_index", type=int)
        chunk = request.files.get("chunk")
        if chunk_index is None or chunk is None:
            return jsonify({"error": "chunk_index and chunk are required"}), 400
        if chunk_index < 0 or chunk_index >= int(meta["total_chunks"]):
            return jsonify({"error": "chunk_index out of range"}), 400

        chunk_path = os.path.join(upload_dir, f"{chunk_index:08d}.part")
        chunk.save(chunk_path)
        # Parallel chunk uploads can race while updating meta.json. Re-scan the
        # uploaded part files after saving so metadata cannot lose a completed
        # chunk when another request writes at the same time.
        meta = _refresh_chunk_meta(upload_dir, meta)
        _write_chunk_meta(upload_dir, meta)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return jsonify({
            "upload_id": upload_id,
            "chunk_index": chunk_index,
            "received_chunks": meta["received_chunks"],
            "bytes_received": meta["bytes_received"],
            "total_bytes": meta["file_size"],
            "chunk_receive_ms": elapsed_ms,
        }), 200
    except Exception as e:
        logger.error(f"Upload syllabus chunk error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>/import-syllabus/chunk/<upload_id>/status", methods=["GET"])
@require_auth
@require_role(["admin", "teacher"])
def get_chunked_syllabus_import_status(course_id, upload_id):
    try:
        upload_dir = _chunk_session_dir(upload_id)
        meta = _read_chunk_meta(upload_dir)
        if int(meta.get("course_id")) != int(course_id):
            return jsonify({"error": "upload session course mismatch"}), 400
        return jsonify({
            "upload_id": upload_id,
            "filename": meta.get("filename"),
            "file_size": meta.get("file_size"),
            "chunk_size": meta.get("chunk_size"),
            "total_chunks": meta.get("total_chunks"),
            "received_chunks": meta.get("received_chunks", []),
            "bytes_received": meta.get("bytes_received", 0),
            "content_hash": meta.get("content_hash"),
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error(f"Get chunked syllabus import status error: {e}")
        return jsonify({"error": str(e)}), 500


@knowledge_graph_bp.route("/knowledge-graph/courses/<int:course_id>/import-syllabus/chunk/<upload_id>/complete", methods=["POST"])
@require_auth
@require_role(["admin", "teacher"])
def complete_chunked_syllabus_import(course_id, upload_id):
    """合并分片并启动异步解析任务，立即返回任务 ID 供前端轮询。"""
    upload_dir = None
    try:
        request_started = time.perf_counter()
        upload_dir = _chunk_session_dir(upload_id)
        meta = _read_chunk_meta(upload_dir)
        if int(meta.get("course_id")) != int(course_id):
            return jsonify({"error": "upload session course mismatch"}), 400
        meta = _refresh_chunk_meta(upload_dir, meta)
        expected = set(range(int(meta["total_chunks"])))
        received = set(meta.get("received_chunks") or [])
        missing = sorted(expected - received)
        if missing:
            return jsonify({"error": "missing chunks", "missing_chunks": missing}), 400

        # 同步合并分片（快速操作）
        assemble_started = time.perf_counter()
        content_hash = hashlib.sha256()
        assembled = bytearray()
        for idx in range(int(meta["total_chunks"])):
            part_path = os.path.join(upload_dir, f"{idx:08d}.part")
            with open(part_path, "rb") as part:
                while True:
                    block = part.read(4 * 1024 * 1024)
                    if not block:
                        break
                    content_hash.update(block)
                    assembled.extend(block)
        assembled = bytes(assembled)
        assembled_size = len(assembled)
        digest = content_hash.hexdigest()
        if assembled_size != int(meta["file_size"]):
            return jsonify({"error": "assembled file size mismatch"}), 400
        if meta.get("content_hash") and meta["content_hash"] != digest:
            return jsonify({"error": "assembled file hash mismatch"}), 400

        input_type = _detect_upload_type(filename=meta.get("filename"), content=assembled, fallback="docx")
        assemble_ms = round((time.perf_counter() - assemble_started) * 1000, 2)

        # 生成任务 ID 并启动后台解析线程
        task_id = f"task_{uuid.uuid4().hex[:16]}"
        filename = meta.get("filename", "unknown")

        # 将合并后的文件内容复制到临时文件，避免 finally 删除分片目录后丢失
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=f".{input_type}", prefix="kg_import_")
        temp_file.write(assembled)
        temp_file.close()

        task_info = {
            "task_id": task_id,
            "status": "processing",
            "progress": 10,
            "message": "正在解析文件...",
            "course_id": course_id,
            "filename": filename,
            "started_at": time.time(),
            "result": None,
            "error": None,
            "performance": {
                "upload_mode": "chunked",
                "bytes_received": assembled_size,
                "total_chunks": meta["total_chunks"],
                "assemble_ms": assemble_ms,
                "sha256": digest,
            },
        }

        with _import_tasks_lock:
            _import_tasks[task_id] = task_info

        # 获取当前会话信息用于后台线程
        session_user_id = session.get("user_id")
        session_user_role = session.get("user_role")
        rag_required = bool(meta.get("rag_required", False))
        citation_style = meta.get("citation_style", "bracket")

        def _background_parse():
            """后台线程执行实际解析工作。"""
            # 后台线程无 Flask 请求/应用上下文，需主动获取 app context，
            # 否则 syllabus_graph_service 内的 DB 操作会抛 "Working outside of application context"
            try:
                from src.main import app as _flask_app
            except Exception as imp_err:
                logger.error(f"无法获取 Flask app 用于后台解析: {imp_err}")
                with _import_tasks_lock:
                    task = _import_tasks.get(task_id)
                    if task:
                        task["status"] = "failed"
                        task["error"] = "服务上下文不可用"
                        task["progress"] = 100
                        task["message"] = "解析异常: 服务上下文不可用"
                        task["completed_at"] = time.time()
                return

            with _flask_app.app_context():
                try:
                    with _import_tasks_lock:
                        _import_tasks[task_id]["progress"] = 30
                        _import_tasks[task_id]["message"] = "AI 正在提取知识点..."

                    parse_started = time.perf_counter()
                    result = syllabus_graph_service.import_syllabus(
                        course_id,
                        input_type,
                        content=assembled,
                        rag_required=rag_required,
                        citation_style=citation_style,
                        user_id=session_user_id,
                        user_role=session_user_role,
                    )
                    import_ms = round((time.perf_counter() - parse_started) * 1000, 2)

                    with _import_tasks_lock:
                        task = _import_tasks.get(task_id)
                        if task:
                            task["progress"] = 90
                            task["message"] = "正在生成质量报告..."
                            task["performance"]["import_ms"] = import_ms
                            task["performance"]["request_total_ms"] = round(
                                (time.perf_counter() - request_started) * 1000, 2
                            )
                            _record_upload_metric(course_id, filename, task["performance"])

                            if "error" in result:
                                task["status"] = "failed"
                                task["error"] = result["error"]
                                task["progress"] = 100
                                task["message"] = f"解析失败: {result['error']}"
                                task["completed_at"] = time.time()
                            else:
                                task["status"] = "completed"
                                task["result"] = result
                                task["progress"] = 100
                                task["message"] = "解析完成"
                                task["completed_at"] = time.time()

                except Exception as exc:
                    logger.error(f"后台解析任务 {task_id} 失败: {exc}", exc_info=True)
                    with _import_tasks_lock:
                        task = _import_tasks.get(task_id)
                        if task:
                            task["status"] = "failed"
                            task["error"] = str(exc)
                            task["progress"] = 100
                            task["message"] = f"解析异常: {exc}"
                            task["completed_at"] = time.time()
                finally:
                    # 清理临时文件
                    try:
                        os.unlink(temp_file.name)
                    except OSError:
                        pass

        # 启动后台线程
        thread = threading.Thread(target=_background_parse, daemon=True)
        thread.start()

        # 立即返回任务 ID，前端轮询状态
        return jsonify({
            "task_id": task_id,
            "status": "processing",
            "progress": 10,
            "message": "文件合并完成，开始解析...",
            "filename": filename,
        }), 202

    except Exception as e:
        logger.error(f"Complete chunked syllabus import error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if upload_dir and os.path.exists(upload_dir):
            shutil.rmtree(upload_dir, ignore_errors=True)


@knowledge_graph_bp.route("/knowledge-graph/import-task/<task_id>/status", methods=["GET"])
@require_auth
@require_role(["admin", "teacher"])
def get_import_task_status(task_id):
    """查询异步导入任务状态。"""
    with _import_tasks_lock:
        task = _import_tasks.get(task_id)
    if not task:
        return jsonify({"error": "任务不存在或已过期"}), 404

    response = {
        "task_id": task["task_id"],
        "status": task["status"],
        "progress": task["progress"],
        "message": task["message"],
        "filename": task.get("filename"),
    }

    if task["status"] == "completed":
        response["result"] = task.get("result")
        response["performance"] = task.get("performance")
        # 任务完成 5 分钟后自动清理
        completed_at = task.get("completed_at") or task.get("started_at") or time.time()
        if time.time() - completed_at > 300:
            with _import_tasks_lock:
                _import_tasks.pop(task_id, None)
    elif task["status"] == "failed":
        response["error"] = task.get("error")
        # 失败任务 10 分钟后自动清理
        completed_at = task.get("completed_at") or task.get("started_at") or time.time()
        if time.time() - completed_at > 600:
            with _import_tasks_lock:
                _import_tasks.pop(task_id, None)

    return jsonify(response), 200


@knowledge_graph_bp.route("/knowledge-graph/upload-metrics", methods=["GET"])
@require_auth
@require_role(["admin", "teacher"])
def get_upload_metrics():
    try:
        limit = max(1, min(request.args.get("limit", 50, type=int), 200))
        items = list(UPLOAD_METRICS)[:limit]
        if not items:
            return jsonify({"metrics": [], "summary": {}}), 200
        avg_ms = round(sum(item["request_total_ms"] for item in items) / len(items), 2)
        avg_throughput = round(sum(item["throughput_kbps"] for item in items) / len(items), 2)
        chunked = [item for item in items if item["upload_mode"] == "chunked"]
        single = [item for item in items if item["upload_mode"] == "single_request"]
        return jsonify({
            "metrics": items,
            "summary": {
                "count": len(items),
                "avg_request_total_ms": avg_ms,
                "avg_throughput_kbps": avg_throughput,
                "chunked_count": len(chunked),
                "single_request_count": len(single),
                "latest": items[0],
            },
        }), 200
    except Exception as e:
        logger.error(f"Get upload metrics error: {e}")
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
        return jsonify(rag_citation_service.verify(
            data.get("content", ""),
            data.get("citations", []),
            rag_required=bool(data.get("rag_required", False)),
            citation_style=data.get("citation_style", "bracket"),
        )), 200
    except Exception as e:
        logger.error(f"RAG verify error: {e}")
        return jsonify({"error": str(e)}), 500
