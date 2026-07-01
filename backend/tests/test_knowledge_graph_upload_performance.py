import base64
import hashlib
import io
import json
import math
import time

from flask import Flask, session

from src.models.course import Course
from src.models.user import User, db
from src.routes.knowledge_graph_routes import knowledge_graph_bp


def _create_app(tmp_path):
    app = Flask(__name__)
    app.secret_key = "test"
    app.config.update(
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{tmp_path / 'upload_perf.db'}",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        TESTING=True,
    )
    db.init_app(app)
    app.register_blueprint(knowledge_graph_bp, url_prefix="/api")
    return app


def _seed_course(app):
    with app.app_context():
        db.create_all()
        teacher = User(
            username="teacher",
            email="teacher@example.com",
            password_hash="test",
            role="teacher",
        )
        db.session.add(teacher)
        db.session.commit()
        course = Course(title="Upload Perf", description="Perf baseline", teacher_id=teacher.id)
        db.session.add(course)
        db.session.commit()
        return teacher.id, course.id


def _auth(client, teacher_id):
    with client.session_transaction() as sess:
        sess["user_id"] = teacher_id
        sess["user_role"] = "teacher"


def _fake_docx_bytes(repeat=1600):
    text = ("Python 基础\n变量用于保存程序运行中的数据。循环语句用于重复执行代码。\n" * repeat).encode("utf-8")
    return b"PK\x03\x04" + text


def _patch_parser(monkeypatch):
    from src.services.syllabus_graph_service import syllabus_graph_service

    def fake_import(course_id, input_type, content=None, file_id=None, rag_required=False, citation_style="bracket", user_id=None, user_role=None):
        raw = base64.b64decode(content) if input_type in ("docx", "pdf") and isinstance(content, str) else bytes(content or b"")
        return {
            "graph_id": "kg_perf",
            "nodes_created": 2,
            "edges_created": 1,
            "source_chunks": [],
            "quality_report": {"source_coverage_rate": 100},
            "content_sha256": hashlib.sha256(raw).hexdigest(),
        }

    monkeypatch.setattr(syllabus_graph_service, "import_syllabus", fake_import)


def test_chunked_upload_baseline_and_integrity(tmp_path, monkeypatch):
    _patch_parser(monkeypatch)
    app = _create_app(tmp_path)
    teacher_id, course_id = _seed_course(app)
    client = app.test_client()
    _auth(client, teacher_id)

    payload = _fake_docx_bytes()
    expected_hash = hashlib.sha256(payload).hexdigest()

    single_start = time.perf_counter()
    single = client.post(
        f"/api/knowledge-graph/courses/{course_id}/import-syllabus",
        data={
            "file": (io.BytesIO(payload), "perf.docx"),
            "filename": "perf.docx",
            "input_type": "docx",
        },
        content_type="multipart/form-data",
    )
    single_ms = (time.perf_counter() - single_start) * 1000
    assert single.status_code == 200
    assert single.get_json()["content_sha256"] == expected_hash

    chunk_size = 64 * 1024
    total_chunks = math.ceil(len(payload) / chunk_size)
    chunk_start = time.perf_counter()
    started = client.post(
        f"/api/knowledge-graph/courses/{course_id}/import-syllabus/chunk/start",
        json={
            "filename": "perf.docx",
            "file_size": len(payload),
            "chunk_size": chunk_size,
            "total_chunks": total_chunks,
            "content_hash": expected_hash,
        },
    )
    assert started.status_code == 200
    upload_id = started.get_json()["upload_id"]

    for index in range(total_chunks):
        piece = payload[index * chunk_size:(index + 1) * chunk_size]
        res = client.post(
            f"/api/knowledge-graph/courses/{course_id}/import-syllabus/chunk/{upload_id}",
            data={"chunk_index": str(index), "chunk": (io.BytesIO(piece), f"{index}.part")},
            content_type="multipart/form-data",
        )
        assert res.status_code == 200

    status = client.get(f"/api/knowledge-graph/courses/{course_id}/import-syllabus/chunk/{upload_id}/status")
    assert status.status_code == 200
    assert len(status.get_json()["received_chunks"]) == total_chunks

    complete = client.post(f"/api/knowledge-graph/courses/{course_id}/import-syllabus/chunk/{upload_id}/complete")
    chunk_ms = (time.perf_counter() - chunk_start) * 1000
    body = complete.get_json()
    assert complete.status_code == 200
    assert body["content_sha256"] == expected_hash
    assert body["performance"]["upload_mode"] == "chunked"
    assert body["performance"]["sha256"] == expected_hash
    assert body["performance"]["total_chunks"] == total_chunks

    metrics = client.get("/api/knowledge-graph/upload-metrics?limit=5")
    assert metrics.status_code == 200
    metrics_body = metrics.get_json()
    assert metrics_body["summary"]["count"] >= 2
    assert metrics_body["summary"]["chunked_count"] >= 1
    assert metrics_body["summary"]["single_request_count"] >= 1

    print(json.dumps({
        "single_request_ms": round(single_ms, 2),
        "chunked_roundtrip_ms": round(chunk_ms, 2),
        "chunk_count": total_chunks,
        "payload_bytes": len(payload),
    }, ensure_ascii=False))
