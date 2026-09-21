import json
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request, session

from src.models.user import db
from src.models.personalized_learning import PersonalizedTaskDelivery, PersonalizedDeliveryEvent, PersonalizedLearningCycle
from src.models.personalized_workflow import PersonalizedWorkflow
from src.models.student_profile import StudentProfile
from src.services.personalized_delivery_service import DeliveryError, personalized_delivery_service
from src.services.personalized_notification_service import personalized_notification_service
from src.services.generation_basis_service import build_basis_signals, build_resource_basis
from src.utils.auth import require_auth, require_role


personalized_learning_bp = Blueprint("personalized_learning", __name__)


logger = logging.getLogger(__name__)


def _load_json(raw, default):
    try:
        value = json.loads(raw) if raw else default
    except (TypeError, ValueError):
        return default
    return value if value is not None else default


def _load_mistake_rows(user_id, course_id, limit=20):
    """读取该学生在本课程下的真实错题明细（只读，按 user_id 过滤）。

    与 CoordinatorAgent._build_mistake_evidence 保持同一形状，便于依据链复用。
    没有明细时返回空列表，由依据链在 gaps 中登记缺失，绝不用聚合计数伪造条目。
    """
    if user_id in (None, "") or course_id in (None, ""):
        return []
    try:
        from src.models.course import MistakeRecord
    except Exception:  # pragma: no cover - 模型导入失败时降级为无明细
        return []

    records = MistakeRecord.query.filter(
        MistakeRecord.user_id == user_id,
        MistakeRecord.course_id == course_id,
    ).order_by(MistakeRecord.last_mistake_at.desc()).limit(max(1, int(limit))).all()

    rows = []
    for record in records:
        try:
            tags = json.loads(record.knowledge_tags or "[]")
        except (TypeError, ValueError):
            tags = []
        tags = [str(tag) for tag in tags] if isinstance(tags, list) else []
        rows.append({
            "mistake_id": record.id,
            "knowledge_point": tags[0] if tags else "",
            "error_type": record.error_type_manual or record.error_type_auto or "",
            "mistake_count": record.mistake_count or 1,
            "last_mistake_at": record.last_mistake_at.isoformat() if record.last_mistake_at else None,
            "mastery_status": record.mastery_status or "unmastered",
            "question_excerpt": (record.question_content or "")[:120],
            "user_answer": record.user_answer or "",
            "correct_answer": record.correct_answer or "",
        })
    return rows


def _error(exc):
    return jsonify({"error": str(exc), "code": exc.code}), exc.status


@personalized_learning_bp.route("/resource-generation/workflow/<string:workflow_id>/publish", methods=["POST"])
@require_auth
@require_role(("teacher", "admin"))
def publish_workflow(workflow_id):
    try:
        delivery, repeated = personalized_delivery_service.publish(
            workflow_id, session["user_id"], request.get_json(silent=True) or {}, session.get("user_role")
        )
        return jsonify({"delivery": delivery, "already_published": repeated, "message": "任务已发布给学生"}), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/resource-generation/workflow/<string:workflow_id>/deliveries", methods=["GET"])
@require_auth
@require_role(("teacher", "admin"))
def list_workflow_deliveries(workflow_id):
    deliveries = personalized_delivery_service.list_for_workflow(workflow_id, session["user_id"])
    return jsonify({"deliveries": deliveries, "count": len(deliveries)}), 200


@personalized_learning_bp.route("/personalized-deliveries/<string:delivery_id>", methods=["GET"])
@require_auth
@require_role(("teacher", "admin"))
def get_teacher_delivery(delivery_id):
    delivery = personalized_delivery_service.get_for_teacher(delivery_id, session["user_id"])
    if not delivery:
        return jsonify({"error": "任务不存在或无权访问", "code": "DELIVERY_NOT_FOUND"}), 404
    return jsonify({"delivery": delivery}), 200


@personalized_learning_bp.route("/personalized-deliveries", methods=["GET"])
@require_auth
@require_role(("teacher", "admin"))
def list_teacher_deliveries():
    try:
        return jsonify(personalized_delivery_service.list_for_teacher(
            session["user_id"], request.args.to_dict()
        )), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/personalized-deliveries/bulk-state", methods=["POST"])
@require_auth
@require_role(("teacher", "admin"))
def bulk_change_delivery_state():
    try:
        result = personalized_delivery_service.bulk_change_state(
            session["user_id"], request.get_json(silent=True) or {}
        )
        return jsonify(result), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/personalized-deliveries/<string:delivery_id>/pause", methods=["POST"])
@require_auth
@require_role(("teacher", "admin"))
def pause_delivery(delivery_id):
    item = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id, owner_id=session["user_id"]).first()
    if not item:
        return jsonify({"error": "任务不存在或无权访问", "code": "DELIVERY_NOT_FOUND"}), 404
    if item.status in ("ASSESSING", "CYCLE_COMPLETED"):
        return jsonify({"error": "当前任务状态不能暂停", "code": "DELIVERY_STATE_INVALID"}), 409
    if item.status != "PAUSED":
        previous = item.status
        item.status = "PAUSED"
        item.version += 1
        item.updated_at = datetime.utcnow()
        db.session.add(PersonalizedDeliveryEvent(
            delivery_id=delivery_id, student_user_id=item.student_user_id,
            event_type="task_paused", event_data_json=f'{{"resume_state":"{previous}"}}',
            idempotency_key=f"{delivery_id}:paused:{item.version}",
        ))
        personalized_notification_service.create(
            item, "paused", f"{delivery_id}:notification:task_paused:{item.version}"
        )
        db.session.commit()
    return jsonify({"delivery": item.to_dict(include_events=True), "message": "学生任务已暂停"}), 200


@personalized_learning_bp.route("/personalized-deliveries/<string:delivery_id>/resume", methods=["POST"])
@require_auth
@require_role(("teacher", "admin"))
def resume_delivery(delivery_id):
    item = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id, owner_id=session["user_id"]).first()
    if not item:
        return jsonify({"error": "任务不存在或无权访问", "code": "DELIVERY_NOT_FOUND"}), 404
    if item.status != "PAUSED":
        return jsonify({"error": "任务当前没有暂停", "code": "DELIVERY_STATE_INVALID"}), 409
    pause_event = PersonalizedDeliveryEvent.query.filter_by(delivery_id=delivery_id, event_type="task_paused").order_by(PersonalizedDeliveryEvent.id.desc()).first()
    resume_state = (pause_event.to_dict().get("data") or {}).get("resume_state") if pause_event else "IN_PROGRESS"
    if resume_state not in ("PUBLISHED", "IN_PROGRESS", "WAITING_ASSESSMENT"):
        resume_state = "IN_PROGRESS"
    item.status = resume_state
    item.version += 1
    item.updated_at = datetime.utcnow()
    db.session.add(PersonalizedDeliveryEvent(
        delivery_id=delivery_id, student_user_id=item.student_user_id,
        event_type="task_resumed", event_data_json="{}",
        idempotency_key=f"{delivery_id}:resumed:{item.version}",
    ))
    personalized_notification_service.create(
        item, "resumed", f"{delivery_id}:notification:task_resumed:{item.version}"
    )
    db.session.commit()
    return jsonify({"delivery": item.to_dict(include_events=True), "message": "学生任务已恢复"}), 200


@personalized_learning_bp.route("/student/personalized-deliveries", methods=["GET"])
@require_auth
def list_student_deliveries():
    if session.get("user_role") != "student":
        return jsonify({"error": "只有学生可以访问学习任务", "code": "STUDENT_REQUIRED"}), 403
    try:
        return jsonify(personalized_delivery_service.list_for_student(
            session["user_id"], request.args.to_dict()
        )), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/student/personalized-deliveries/<string:delivery_id>", methods=["GET"])
@require_auth
def get_student_delivery(delivery_id):
    if session.get("user_role") != "student":
        return jsonify({"error": "只有学生可以访问学习任务", "code": "STUDENT_REQUIRED"}), 403
    delivery = personalized_delivery_service.get_for_student(delivery_id, session["user_id"])
    if not delivery:
        return jsonify({"error": "任务不存在或无权访问", "code": "DELIVERY_NOT_FOUND"}), 404
    return jsonify({"delivery": delivery}), 200


@personalized_learning_bp.route("/student/personalized-deliveries/<string:delivery_id>/resources/<string:resource_key>/basis", methods=["GET"])
@require_auth
def get_student_resource_basis(delivery_id, resource_key):
    """返回该学生这份资源"为什么是给你的"依据链（只读）。

    越权防护：先按 student_user_id 取交付单，取不到即 404，绝不返回其他学生的画像或错题数据。
    """
    if session.get("user_role") != "student":
        return jsonify({"error": "只有学生可以查看学习资源依据", "code": "STUDENT_REQUIRED"}), 403
    item = PersonalizedTaskDelivery.query.filter_by(
        delivery_id=delivery_id, student_user_id=session["user_id"]
    ).first()
    if not item:
        return jsonify({"error": "任务不存在或无权访问", "code": "DELIVERY_NOT_FOUND"}), 404

    resources = _load_json(item.resource_snapshot_json, {})
    resource = resources.get(resource_key)
    if not isinstance(resource, dict):
        return jsonify({"error": "该资源不存在", "code": "RESOURCE_NOT_FOUND"}), 404

    signals = {}
    if item.student_user_id:
        try:
            from src.routes.resource_generation import _collect_profile_signals
            signals = _collect_profile_signals(item.student_user_id, item.course_id)
        except Exception as exc:  # 依据链不可得时降级，绝不阻塞资源正文
            logger.warning("Collect profile signals for basis failed: %s", exc)

    # _collect_profile_signals 只给出错题聚合计数（total / top_knowledge_points），
    # 不含明细。若不补明细，依据链只能报 missing_mistake_detail，学生明明有错题
    # 却看不到任何一条。这里补上按 user_id 过滤的真实错题明细。
    signals = build_basis_signals(
        _load_mistake_rows(item.student_user_id, item.course_id),
        extra_signals=signals,
    )

    profile = {}
    try:
        profile_row = StudentProfile.query.filter_by(user_id=item.student_user_id).first()
        if profile_row:
            profile = profile_row.to_dict()
    except Exception as exc:
        logger.warning("Load student profile for basis failed: %s", exc)

    strategy = _load_json(item.strategy_snapshot_json, {})
    cycle = None
    latest_cycle = item.cycles[-1] if item.cycles else None
    if latest_cycle:
        cycle = latest_cycle.to_dict()

    basis = build_resource_basis(
        resource_key,
        resource,
        package={"topic": item.title, "resources": resources, "strategy": strategy},
        signals=signals,
        cycle=cycle,
    )
    return jsonify({
        "basis": basis,
        "profile_evidence": basis.get("profile_evidence", []),
        "resource_type": resource_key,
        "course_id": item.course_id,
        "student_user_id": item.student_user_id,
    }), 200


@personalized_learning_bp.route("/student/personalized-deliveries/<string:delivery_id>/start", methods=["POST"])
@require_auth
def start_student_delivery(delivery_id):
    if session.get("user_role") != "student":
        return jsonify({"error": "只有学生可以开始学习任务", "code": "STUDENT_REQUIRED"}), 403
    try:
        delivery, repeated = personalized_delivery_service.start(delivery_id, session["user_id"])
        return jsonify({"delivery": delivery, "already_started": repeated}), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/student/personalized-deliveries/<string:delivery_id>/events", methods=["POST"])
@require_auth
def record_student_delivery_event(delivery_id):
    if session.get("user_role") != "student":
        return jsonify({"error": "只有学生可以记录学习进度", "code": "STUDENT_REQUIRED"}), 403
    try:
        delivery, repeated = personalized_delivery_service.record_event(
            delivery_id, session["user_id"], request.get_json(silent=True) or {}
        )
        return jsonify({"delivery": delivery, "already_recorded": repeated}), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/student/personalized-deliveries/<string:delivery_id>/complete-resource", methods=["POST"])
@require_auth
def complete_student_resource(delivery_id):
    if session.get("user_role") != "student":
        return jsonify({"error": "只有学生可以完成学习资源", "code": "STUDENT_REQUIRED"}), 403
    data = request.get_json(silent=True) or {}
    data["event_type"] = "resource_completed"
    try:
        delivery, repeated = personalized_delivery_service.record_event(delivery_id, session["user_id"], data)
        return jsonify({"delivery": delivery, "already_recorded": repeated}), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/student/personalized-deliveries/<string:delivery_id>/submit-assessment", methods=["POST"])
@require_auth
def submit_student_assessment(delivery_id):
    if session.get("user_role") != "student":
        return jsonify({"error": "只有学生可以提交学习检测", "code": "STUDENT_REQUIRED"}), 403
    try:
        personalized_delivery_service.bind_assessment(
            delivery_id, session["user_id"], request.get_json(silent=True) or {}
        )
        cycle, repeated = personalized_delivery_service.analyze(delivery_id, student_user_id=session["user_id"])
        return jsonify({"cycle": cycle, "already_analyzed": repeated, "message": "学习效果分析已完成"}), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/personalized-deliveries/<string:delivery_id>/analyze", methods=["POST"])
@require_auth
@require_role(("teacher", "admin"))
def analyze_delivery(delivery_id):
    try:
        cycle, repeated = personalized_delivery_service.analyze(delivery_id, owner_id=session["user_id"])
        return jsonify({"cycle": cycle, "already_analyzed": repeated}), 200
    except DeliveryError as exc:
        return _error(exc)


@personalized_learning_bp.route("/personalized-learning-cycles/<string:cycle_id>", methods=["GET"])
@require_auth
def get_learning_cycle(cycle_id):
    query = PersonalizedLearningCycle.query.filter_by(cycle_id=cycle_id)
    if session.get("user_role") == "student":
        query = query.filter_by(student_user_id=session["user_id"])
    else:
        query = query.filter_by(owner_id=session["user_id"])
    cycle = query.first()
    if not cycle:
        return jsonify({"error": "学习周期不存在或无权访问", "code": "CYCLE_NOT_FOUND"}), 404
    return jsonify({"cycle": cycle.to_dict()}), 200


@personalized_learning_bp.route("/resource-generation/workflow/<string:workflow_id>/feedback", methods=["GET"])
@require_auth
@require_role(("teacher", "admin"))
def get_workflow_feedback(workflow_id):
    workflow = PersonalizedWorkflow.query.filter_by(
        workflow_id=workflow_id, owner_id=session["user_id"]
    ).first()
    if not workflow:
        return jsonify({"error": "工作流不存在或无权访问", "code": "WORKFLOW_NOT_FOUND"}), 404
    cycles = PersonalizedLearningCycle.query.filter_by(
        workflow_id=workflow_id, owner_id=session["user_id"]
    ).order_by(PersonalizedLearningCycle.cycle_number.desc()).all()
    return jsonify({"cycles": [cycle.to_dict() for cycle in cycles], "count": len(cycles)}), 200


@personalized_learning_bp.route("/personalized-learning-cycles/<string:cycle_id>/next-workflow", methods=["POST"])
@require_auth
@require_role(("teacher", "admin"))
def get_or_create_next_workflow(cycle_id):
    cycle = PersonalizedLearningCycle.query.filter_by(
        cycle_id=cycle_id, owner_id=session["user_id"]
    ).first()
    if not cycle:
        return jsonify({"error": "学习周期不存在或无权访问", "code": "CYCLE_NOT_FOUND"}), 404
    if not cycle.next_workflow_id:
        return jsonify({"error": "本轮分析尚未完成，请稍后重试", "code": "NEXT_WORKFLOW_NOT_READY"}), 409
    workflow = PersonalizedWorkflow.query.filter_by(
        workflow_id=cycle.next_workflow_id, owner_id=session["user_id"]
    ).first()
    if not workflow:
        return jsonify({"error": "下一轮工作流暂时不可用", "code": "NEXT_WORKFLOW_NOT_FOUND"}), 404
    return jsonify({"workflow": workflow.to_dict(), "already_created": True}), 200
