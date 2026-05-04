import logging
from flask import Blueprint, jsonify, request, session
from src.models.user import db, User
from src.models.student_profile import StudentProfile, ProfileDialogSession
from src.services.multi_agent.profile_agent import ProfileAgent
from src.services.profile_sync_service import profile_sync_service

logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__)

profile_agent = ProfileAgent()


def require_auth(f):
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated


@profile_bp.route("/profile", methods=["GET"])
@require_auth
def get_profile():
    try:
        user_id = session["user_id"]
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)
            db.session.commit()
        summary = profile_agent.generate_profile_summary({'profile': profile.to_dict()})
        return jsonify({"profile": profile.to_dict(), "summary": summary}), 200
    except Exception as e:
        logger.error(f"Get profile error: {e}")
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)

        dimension = data.get("dimension")
        value = data.get("value")
        if dimension and value is not None:
            profile.update_dimension(dimension, value)
            profile.update_source = data.get("source", "manual")

        db.session.commit()
        return jsonify({"profile": profile.to_dict()}), 200
    except Exception as e:
        logger.error(f"Update profile error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile/dialog/start", methods=["POST"])
@require_auth
def start_dialog():
    try:
        user_id = session["user_id"]
        user = User.query.get(user_id)

        active_session = ProfileDialogSession.query.filter_by(
            user_id=user_id, status='active'
        ).first()
        if active_session:
            active_session.status = 'abandoned'
            db.session.commit()

        dialog_session = ProfileDialogSession(
            user_id=user_id,
            status='active',
            current_round=0,
            max_rounds=6,
        )
        db.session.add(dialog_session)
        db.session.commit()

        result = profile_agent.start_dialog({
            'user_name': user.real_name or user.username if user else '同学',
        })

        dialog_session.add_message('assistant', result['greeting'])
        dialog_session.add_message('assistant', result['question'])
        db.session.commit()

        return jsonify({
            "session": dialog_session.to_dict(),
            "dialog": result,
        }), 200
    except Exception as e:
        logger.error(f"Start dialog error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile/dialog/continue", methods=["POST"])
@require_auth
def continue_dialog():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        session_id = data.get("session_id")
        answer = data.get("answer", "")

        dialog_session = ProfileDialogSession.query.filter_by(
            id=session_id, user_id=user_id, status='active'
        ).first()
        if not dialog_session:
            return jsonify({"error": "Dialog session not found"}), 404

        dialog_session.add_message('user', answer)
        dialog_session.current_round += 1

        result = profile_agent.continue_dialog({
            'answer': answer,
            'current_round': dialog_session.current_round - 1,
            'extracted_features': dialog_session.get_extracted_features(),
        })

        if result['type'] == 'dialog_continue':
            dialog_session.add_message('assistant', result.get('feedback', ''))
            dialog_session.add_message('assistant', result['question'])
            dialog_session.set_extracted_features(result['extracted_features'])
        elif result['type'] == 'dialog_complete':
            dialog_session.add_message('assistant', result.get('message', ''))
            dialog_session.set_extracted_features(result['extracted_features'])
            dialog_session.status = 'completed'

            profile = StudentProfile.query.filter_by(user_id=user_id).first()
            if not profile:
                profile = StudentProfile(user_id=user_id)
                db.session.add(profile)

            features = result['extracted_features']
            for dim_key, dim_value in features.items():
                profile.update_dimension(dim_key, dim_value)
            profile.update_source = 'dialog'

        db.session.commit()

        return jsonify({
            "session": dialog_session.to_dict(),
            "dialog": result,
        }), 200
    except Exception as e:
        logger.error(f"Continue dialog error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile/dialog/history", methods=["GET"])
@require_auth
def get_dialog_history():
    try:
        user_id = session["user_id"]
        sessions = ProfileDialogSession.query.filter_by(user_id=user_id).order_by(
            ProfileDialogSession.created_at.desc()
        ).all()
        return jsonify({"sessions": [s.to_dict() for s in sessions]}), 200
    except Exception as e:
        logger.error(f"Get dialog history error: {e}")
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile/dimensions", methods=["GET"])
@require_auth
def get_dimensions():
    from src.services.multi_agent.profile_agent import PROFILE_DIMENSIONS
    return jsonify({"dimensions": PROFILE_DIMENSIONS}), 200


@profile_bp.route("/profile/sync", methods=["POST"])
@require_auth
def sync_profile():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        source = data.get("source", "all")

        if source == "all":
            result = profile_sync_service.full_sync(user_id)
        elif source == "practice":
            result = profile_sync_service.sync_from_practice(user_id)
        elif source == "mistakes":
            result = profile_sync_service.sync_from_mistakes(user_id)
        elif source == "interaction":
            result = profile_sync_service.sync_from_interaction(user_id)
        elif source == "progress":
            result = profile_sync_service.sync_from_learning_progress(user_id)
        else:
            return jsonify({"error": f"Unknown sync source: {source}"}), 400

        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        return jsonify({
            "sync_result": result,
            "profile": profile.to_dict() if profile else None,
        }), 200
    except Exception as e:
        logger.error(f"Sync profile error: {e}")
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile/insight", methods=["GET"])
@require_auth
def get_profile_insight():
    try:
        user_id = session["user_id"]
        result = profile_sync_service.generate_ai_insight(user_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get profile insight error: {e}")
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile/teacher/<int:user_id>", methods=["GET"])
@require_auth
def get_student_profile_by_teacher(user_id):
    try:
        role = session.get("user_role", "student")
        if role not in ("teacher", "admin"):
            return jsonify({"error": "Permission denied"}), 403

        user = User.query.get(user_id)
        if not user or user.role != "student":
            return jsonify({"error": "Student not found"}), 404

        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            return jsonify({"profile": None, "user": user.to_dict()}), 200

        summary = profile_agent.generate_profile_summary({"profile": profile.to_dict()})
        insight = profile_sync_service.generate_ai_insight(user_id)

        return jsonify({
            "user": user.to_dict(),
            "profile": profile.to_dict(),
            "summary": summary,
            "insight": insight.get("insight", ""),
        }), 200
    except Exception as e:
        logger.error(f"Get student profile by teacher error: {e}")
        return jsonify({"error": str(e)}), 500
