from flask import Blueprint, jsonify, request, session

from src.services.personalized_notification_service import NotificationError, personalized_notification_service
from src.utils.auth import require_auth, require_role


personalized_notifications_bp = Blueprint("personalized_notifications", __name__)


def _error(exc):
    return jsonify({"error": str(exc), "code": exc.code}), exc.status


@personalized_notifications_bp.route("/student/personalized-notifications", methods=["GET"])
@require_auth
@require_role(("student",))
def list_student_notifications():
    try:
        result = personalized_notification_service.list_for_user(
            session["user_id"],
            request.args.get("page", 1),
            request.args.get("page_size", 20),
            request.args.get("unread_only", "false").lower() in ("1", "true", "yes"),
        )
        return jsonify(result), 200
    except (NotificationError, TypeError, ValueError) as exc:
        if isinstance(exc, NotificationError):
            return _error(exc)
        return jsonify({"error": "通知分页参数格式不正确", "code": "NOTIFICATION_FILTER_INVALID"}), 400


@personalized_notifications_bp.route("/student/personalized-notifications/<int:notification_id>/read", methods=["POST"])
@require_auth
@require_role(("student",))
def mark_student_notification_read(notification_id):
    try:
        return jsonify({"notification": personalized_notification_service.mark_read(session["user_id"], notification_id)}), 200
    except NotificationError as exc:
        return _error(exc)


@personalized_notifications_bp.route("/student/personalized-notifications/read-all", methods=["POST"])
@require_auth
@require_role(("student",))
def mark_all_student_notifications_read():
    count = personalized_notification_service.mark_all_read(session["user_id"])
    return jsonify({"updated_count": count}), 200


@personalized_notifications_bp.route("/personalized-deliveries/bulk-remind", methods=["POST"])
@require_auth
@require_role(("teacher", "admin"))
def bulk_remind_deliveries():
    try:
        result = personalized_notification_service.create_manual_reminders(
            session["user_id"], (request.get_json(silent=True) or {}).get("delivery_ids")
        )
        return jsonify(result), 200
    except NotificationError as exc:
        return _error(exc)


@personalized_notifications_bp.route("/personalized-reminders/status", methods=["GET"])
@require_auth
@require_role(("teacher", "admin"))
def personalized_reminder_status():
    return jsonify(personalized_notification_service.scheduler_status()), 200
