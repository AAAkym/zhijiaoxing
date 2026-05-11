import logging

from flask import Blueprint, jsonify, request, session
from src.utils.auth import require_auth

from src.models.course import Achievement, UserAchievement
from src.services.achievement_service import (
    check_and_unlock,
    ensure_achievements_seeded,
    get_all_achievements_with_status,
    get_newly_unlocked,
    get_unlocked_achievements,
)

logger = logging.getLogger(__name__)
achievement_bp = Blueprint("achievement", __name__)


@achievement_bp.route("/achievements", methods=["GET"])
@require_auth
def get_achievements():
    try:
        user_id = session["user_id"]
        ensure_achievements_seeded()
        result = get_all_achievements_with_status(user_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get achievements error: {e}")
        return jsonify({"error": str(e)}), 500


@achievement_bp.route("/achievements/check", methods=["POST"])
@require_auth
def check_achievements():
    try:
        user_id = session["user_id"]
        ensure_achievements_seeded()
        newly_unlocked = check_and_unlock(user_id)
        return jsonify({"newly_unlocked": newly_unlocked, "count": len(newly_unlocked)}), 200
    except Exception as e:
        logger.error(f"Check achievements error: {e}")
        return jsonify({"error": str(e)}), 500


@achievement_bp.route("/achievements/unlocked", methods=["GET"])
@require_auth
def get_unlocked():
    try:
        user_id = session["user_id"]
        result = get_unlocked_achievements(user_id)
        return jsonify({"achievements": result}), 200
    except Exception as e:
        logger.error(f"Get unlocked achievements error: {e}")
        return jsonify({"error": str(e)}), 500


@achievement_bp.route("/achievements/notifications", methods=["GET"])
@require_auth
def get_notifications():
    try:
        user_id = session["user_id"]
        result = get_newly_unlocked(user_id)
        return jsonify({"notifications": result}), 200
    except Exception as e:
        logger.error(f"Get achievement notifications error: {e}")
        return jsonify({"error": str(e)}), 500


@achievement_bp.route("/achievements/stats", methods=["GET"])
@require_auth
def get_achievement_stats():
    try:
        user_id = session["user_id"]
        ensure_achievements_seeded()
        result = get_all_achievements_with_status(user_id)
        return jsonify({
            "total_count": result["total_count"],
            "unlocked_count": result["unlocked_count"],
            "total_points": result["total_points"],
            "stats": result["stats"],
        }), 200
    except Exception as e:
        logger.error(f"Get achievement stats error: {e}")
        return jsonify({"error": str(e)}), 500
