import logging

from flask import Blueprint, jsonify, request, session

from src.models.course import CourseGenerationConfig, CourseGenerationVersion, CourseReview
from src.services import course_generation_service as svc

logger = logging.getLogger(__name__)
course_gen_bp = Blueprint("course_generation", __name__)


def require_auth(f):
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


def require_teacher(f):
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        if session.get("user_role") != "teacher" and session.get("user_role") != "admin":
            return jsonify({"error": "Teacher access required"}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@course_gen_bp.route("/course-generation/configs", methods=["GET"])
@require_auth
def list_configs():
    try:
        user_id = session["user_id"]
        configs = svc.get_teacher_configs(user_id)
        return jsonify({"configs": [c.to_dict() for c in configs]}), 200
    except Exception as e:
        logger.error(f"List configs error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs", methods=["POST"])
@require_auth
def create_config():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        config = svc.create_config(user_id, data)
        return jsonify(config.to_dict()), 201
    except Exception as e:
        logger.error(f"Create config error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>", methods=["GET"])
@require_auth
def get_config(config_id):
    try:
        user_id = session["user_id"]
        config = svc.get_config(config_id, user_id)
        if not config:
            return jsonify({"error": "Configuration not found"}), 404
        versions = CourseGenerationVersion.query.filter_by(config_id=config_id).order_by(
            CourseGenerationVersion.step, CourseGenerationVersion.version_number.desc()
        ).all()
        reviews = CourseReview.query.filter_by(config_id=config_id).all()
        return jsonify({
            "config": config.to_dict(),
            "versions": [v.to_dict() for v in versions],
            "reviews": [r.to_dict() for r in reviews],
        }), 200
    except Exception as e:
        logger.error(f"Get config error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>", methods=["PUT"])
@require_auth
def update_config(config_id):
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        config = svc.update_config(config_id, user_id, data)
        if not config:
            return jsonify({"error": "Configuration not found"}), 404
        return jsonify(config.to_dict()), 200
    except Exception as e:
        logger.error(f"Update config error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/generate/<int:step>", methods=["POST"])
@require_auth
def generate_step(config_id, step):
    try:
        user_id = session["user_id"]
        result = svc.generate_step_content(config_id, user_id, step)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Generate step error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/confirm/<int:step>", methods=["POST"])
@require_auth
def confirm_step(config_id, step):
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        modified_content = data.get("modified_content")
        change_summary = data.get("change_summary", "")
        result = svc.confirm_step(config_id, user_id, step, modified_content, change_summary)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Confirm step error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/versions/<int:step>", methods=["GET"])
@require_auth
def get_step_versions(config_id, step):
    try:
        versions = svc.get_step_versions(config_id, step)
        return jsonify({"versions": versions}), 200
    except Exception as e:
        logger.error(f"Get versions error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/versions/<int:step>/diff", methods=["GET"])
@require_auth
def get_version_diff(config_id, step):
    try:
        va = request.args.get("version_a", type=int)
        vb = request.args.get("version_b", type=int)
        if not va or not vb:
            return jsonify({"error": "version_a and version_b required"}), 400
        result = svc.get_version_diff(config_id, step, va, vb)
        if "error" in result:
            return jsonify(result), 404
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Version diff error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/rollback/<int:step>/<int:version_number>", methods=["POST"])
@require_auth
def rollback_version(config_id, step, version_number):
    try:
        user_id = session["user_id"]
        result = svc.rollback_to_version(config_id, step, version_number, user_id)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Rollback error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/submit-review", methods=["POST"])
@require_auth
def submit_for_review(config_id):
    try:
        user_id = session["user_id"]
        result = svc.submit_for_review(config_id, user_id)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Submit review error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/approve", methods=["POST"])
@require_auth
def approve_review(config_id):
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        review_id = data.get("review_id")
        status = data.get("status", "approved")
        comment = data.get("comment", "")
        score = data.get("score")
        if not review_id:
            return jsonify({"error": "review_id required"}), 400
        result = svc.approve_review(config_id, user_id, review_id, status, comment, score)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Approve review error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/share-peer-review", methods=["POST"])
@require_auth
def share_for_peer_review(config_id):
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        target_ids = data.get("teacher_ids", [])
        result = svc.share_for_peer_review(config_id, user_id, target_ids)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Share peer review error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/peer-reviews", methods=["GET"])
@require_auth
def get_peer_reviews(config_id):
    try:
        reviews = svc.get_peer_reviews(config_id)
        return jsonify({"reviews": reviews}), 200
    except Exception as e:
        logger.error(f"Get peer reviews error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/pending-reviews", methods=["GET"])
@require_auth
def get_pending_reviews():
    try:
        user_id = session["user_id"]
        result = svc.get_pending_reviews_for_teacher(user_id)
        return jsonify({"pending_reviews": result}), 200
    except Exception as e:
        logger.error(f"Get pending reviews error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/configs/<int:config_id>/finalize", methods=["POST"])
@require_auth
def finalize_course(config_id):
    try:
        user_id = session["user_id"]
        result = svc.finalize_course(config_id, user_id)
        if "error" in result:
            return jsonify(result), 400
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Finalize course error: {e}")
        return jsonify({"error": str(e)}), 500


@course_gen_bp.route("/course-generation/steps", methods=["GET"])
@require_auth
def get_steps():
    return jsonify({"steps": svc.GENERATION_STEPS}), 200
