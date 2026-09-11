from datetime import datetime

from flask import Blueprint, jsonify, request, session

from src.models.user import db
from src.models.personalized_learning import PersonalizedTaskDelivery, PersonalizedDeliveryEvent, PersonalizedLearningCycle
from src.models.personalized_workflow import PersonalizedWorkflow
from src.services.personalized_delivery_service import DeliveryError, personalized_delivery_service
from src.services.personalized_notification_service import personalized_notification_service
from src.utils.auth import require_auth, require_role


personalized_learning_bp = Blueprint("personalized_learning", __name__)


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
