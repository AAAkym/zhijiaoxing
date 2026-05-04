import json
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func

from src.models.user import db, User, ClassGroup, ClassGroupStudent, ClassGroupCourse
from src.models.course import Course, LearningProgress, PracticeEvaluation, MistakeRecord, CourseQuestion, VideoProgress
from src.models.student_profile import StudentProfile
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)
class_mgmt_bp = Blueprint("class_management", __name__)


def require_auth(f):
    def decorated_function(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@class_mgmt_bp.route("/classes", methods=["GET"])
@require_auth
def list_classes():
    try:
        user_id = session["user_id"]
        role = session.get("user_role", "student")
        if role in ("teacher", "admin"):
            classes = ClassGroup.query.filter_by(teacher_id=user_id).order_by(ClassGroup.created_at.desc()).all()
        else:
            memberships = ClassGroupStudent.query.filter_by(user_id=user_id).all()
            class_ids = [m.class_group_id for m in memberships]
            classes = ClassGroup.query.filter(ClassGroup.id.in_(class_ids)).all() if class_ids else []
        return jsonify({"classes": [c.to_dict() for c in classes]}), 200
    except Exception as e:
        logger.error(f"List classes error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes", methods=["POST"])
@require_auth
def create_class():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        if not name:
            return jsonify({"error": "Class name is required"}), 400
        cg = ClassGroup(
            name=name,
            teacher_id=user_id,
            description=data.get("description", ""),
        )
        db.session.add(cg)
        db.session.commit()
        return jsonify(cg.to_dict()), 201
    except Exception as e:
        logger.error(f"Create class error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>", methods=["GET"])
@require_auth
def get_class(class_id):
    try:
        cg = ClassGroup.query.get(class_id)
        if not cg:
            return jsonify({"error": "Class not found"}), 404
        students = [s.to_dict() for s in cg.students.all()]
        courses = [c.to_dict() for c in cg.courses.all()]
        return jsonify({**cg.to_dict(), "students": students, "courses": courses}), 200
    except Exception as e:
        logger.error(f"Get class error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>", methods=["PUT"])
@require_auth
def update_class(class_id):
    try:
        cg = ClassGroup.query.get(class_id)
        if not cg:
            return jsonify({"error": "Class not found"}), 404
        data = request.get_json() or {}
        if "name" in data:
            cg.name = data["name"]
        if "description" in data:
            cg.description = data["description"]
        db.session.commit()
        return jsonify(cg.to_dict()), 200
    except Exception as e:
        logger.error(f"Update class error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>", methods=["DELETE"])
@require_auth
def delete_class(class_id):
    try:
        cg = ClassGroup.query.get(class_id)
        if not cg:
            return jsonify({"error": "Class not found"}), 404
        ClassGroupStudent.query.filter_by(class_group_id=class_id).delete()
        ClassGroupCourse.query.filter_by(class_group_id=class_id).delete()
        db.session.delete(cg)
        db.session.commit()
        return jsonify({"message": "Class deleted"}), 200
    except Exception as e:
        logger.error(f"Delete class error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/students", methods=["POST"])
@require_auth
def add_student(class_id):
    try:
        data = request.get_json() or {}
        student_name = data.get("student_name", "").strip()
        student_number = data.get("student_number", "").strip()
        contact = data.get("contact", "").strip()

        username = data.get("username") or f"stu_{student_number or student_name}"
        email = data.get("email") or f"{username}@edu.local"
        password = data.get("password") or "123456"

        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            user = existing_user
        else:
            user = User(username=username, email=email, role="student", real_name=student_name)
            user.set_password(password)
            db.session.add(user)
            db.session.flush()

        existing_membership = ClassGroupStudent.query.filter_by(
            class_group_id=class_id, user_id=user.id
        ).first()
        if existing_membership:
            return jsonify({"error": "Student already in this class"}), 400

        membership = ClassGroupStudent(
            class_group_id=class_id,
            user_id=user.id,
            student_name=student_name,
            student_number=student_number,
            contact=contact,
        )
        db.session.add(membership)

        course_assignments = ClassGroupCourse.query.filter_by(class_group_id=class_id).all()
        for ca in course_assignments:
            existing_progress = LearningProgress.query.filter_by(
                user_id=user.id, course_id=ca.course_id
            ).first()
            if not existing_progress:
                lp = LearningProgress(user_id=user.id, course_id=ca.course_id, progress_percentage=0)
                db.session.add(lp)

        db.session.commit()
        return jsonify(membership.to_dict()), 201
    except Exception as e:
        logger.error(f"Add student error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/students/<int:student_id>", methods=["DELETE"])
@require_auth
def remove_student(class_id, student_id):
    try:
        membership = ClassGroupStudent.query.filter_by(
            class_group_id=class_id, id=student_id
        ).first()
        if not membership:
            return jsonify({"error": "Student not found in class"}), 404
        db.session.delete(membership)
        db.session.commit()
        return jsonify({"message": "Student removed"}), 200
    except Exception as e:
        logger.error(f"Remove student error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/courses", methods=["POST"])
@require_auth
def assign_course(class_id):
    try:
        data = request.get_json() or {}
        course_id = data.get("course_id")
        if not course_id:
            return jsonify({"error": "course_id is required"}), 400

        existing = ClassGroupCourse.query.filter_by(
            class_group_id=class_id, course_id=course_id
        ).first()
        if existing:
            return jsonify({"error": "Course already assigned"}), 400

        assignment = ClassGroupCourse(class_group_id=class_id, course_id=course_id)
        db.session.add(assignment)

        student_memberships = ClassGroupStudent.query.filter_by(class_group_id=class_id).all()
        for sm in student_memberships:
            existing_progress = LearningProgress.query.filter_by(
                user_id=sm.user_id, course_id=course_id
            ).first()
            if not existing_progress:
                lp = LearningProgress(user_id=sm.user_id, course_id=course_id, progress_percentage=0)
                db.session.add(lp)

        db.session.commit()
        return jsonify(assignment.to_dict()), 201
    except Exception as e:
        logger.error(f"Assign course error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/courses/<int:assignment_id>", methods=["DELETE"])
@require_auth
def remove_course(class_id, assignment_id):
    try:
        assignment = ClassGroupCourse.query.filter_by(
            class_group_id=class_id, id=assignment_id
        ).first()
        if not assignment:
            return jsonify({"error": "Course assignment not found"}), 404
        db.session.delete(assignment)
        db.session.commit()
        return jsonify({"message": "Course removed from class"}), 200
    except Exception as e:
        logger.error(f"Remove course error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/stats", methods=["GET"])
@require_auth
def get_class_stats(class_id):
    try:
        memberships = ClassGroupStudent.query.filter_by(class_group_id=class_id).all()
        user_ids = [m.user_id for m in memberships]

        if not user_ids:
            return jsonify({"student_count": 0, "avg_score": 0, "pass_rate": 0, "score_distribution": {}}), 200

        evaluations = PracticeEvaluation.query.filter(PracticeEvaluation.user_id.in_(user_ids)).all()
        scores = [e.score for e in evaluations if e.score is not None]

        avg_score = sum(scores) / len(scores) if scores else 0
        pass_rate = len([s for s in scores if s >= 60]) / len(scores) * 100 if scores else 0

        distribution = {"0-59": 0, "60-69": 0, "70-79": 0, "80-89": 0, "90-100": 0}
        for s in scores:
            if s < 60:
                distribution["0-59"] += 1
            elif s < 70:
                distribution["60-69"] += 1
            elif s < 80:
                distribution["70-79"] += 1
            elif s < 90:
                distribution["80-89"] += 1
            else:
                distribution["90-100"] += 1

        return jsonify({
            "student_count": len(user_ids),
            "total_evaluations": len(scores),
            "avg_score": round(avg_score, 1),
            "pass_rate": round(pass_rate, 1),
            "score_distribution": distribution,
        }), 200
    except Exception as e:
        logger.error(f"Get class stats error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/batch-students", methods=["POST"])
@require_auth
def batch_add_students():
    try:
        data = request.get_json() or {}
        class_id = data.get("class_id")
        students = data.get("students", [])
        if not class_id or not students:
            return jsonify({"error": "class_id and students array required"}), 400

        created = []
        for s in students:
            student_name = s.get("name", "").strip()
            student_number = s.get("number", "").strip()
            contact = s.get("contact", "").strip()
            if not student_name:
                continue

            username = f"stu_{student_number or student_name}"
            email = f"{username}@edu.local"

            existing_user = User.query.filter_by(username=username).first()
            if existing_user:
                user = existing_user
            else:
                user = User(username=username, email=email, role="student", real_name=student_name)
                user.set_password("123456")
                db.session.add(user)
                db.session.flush()

            existing_membership = ClassGroupStudent.query.filter_by(
                class_group_id=class_id, user_id=user.id
            ).first()
            if existing_membership:
                continue

            membership = ClassGroupStudent(
                class_group_id=class_id,
                user_id=user.id,
                student_name=student_name,
                student_number=student_number,
                contact=contact,
            )
            db.session.add(membership)
            created.append({"username": username, "name": student_name, "password": "123456"})

        course_assignments = ClassGroupCourse.query.filter_by(class_group_id=class_id).all()
        for m in ClassGroupStudent.query.filter_by(class_group_id=class_id).all():
            for ca in course_assignments:
                existing_progress = LearningProgress.query.filter_by(
                    user_id=m.user_id, course_id=ca.course_id
                ).first()
                if not existing_progress:
                    lp = LearningProgress(user_id=m.user_id, course_id=ca.course_id, progress_percentage=0)
                    db.session.add(lp)

        db.session.commit()
        return jsonify({"created": created, "count": len(created)}), 201
    except Exception as e:
        logger.error(f"Batch add students error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/students/available", methods=["GET"])
@require_auth
def get_available_students():
    try:
        students = User.query.filter_by(role="student").order_by(User.id).all()
        return jsonify({"students": [s.to_dict() for s in students]}), 200
    except Exception as e:
        logger.error(f"Get available students error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/students/existing", methods=["POST"])
@require_auth
def add_existing_student(class_id):
    try:
        data = request.get_json() or {}
        user_id = data.get("user_id")
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        user = User.query.get(user_id)
        if not user or user.role != "student":
            return jsonify({"error": "Student not found"}), 404

        existing_membership = ClassGroupStudent.query.filter_by(
            class_group_id=class_id, user_id=user_id
        ).first()
        if existing_membership:
            return jsonify({"error": "Student already in this class"}), 400

        membership = ClassGroupStudent(
            class_group_id=class_id,
            user_id=user_id,
            student_name=user.real_name or user.username,
            student_number="",
            contact=user.email or "",
        )
        db.session.add(membership)

        course_assignments = ClassGroupCourse.query.filter_by(class_group_id=class_id).all()
        for ca in course_assignments:
            existing_progress = LearningProgress.query.filter_by(
                user_id=user_id, course_id=ca.course_id
            ).first()
            if not existing_progress:
                lp = LearningProgress(user_id=user_id, course_id=ca.course_id, progress_percentage=0)
                db.session.add(lp)

        db.session.commit()
        return jsonify(membership.to_dict()), 201
    except Exception as e:
        logger.error(f"Add existing student error: {e}")
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/students/<int:user_id>/profile", methods=["GET"])
@require_auth
def get_student_profile_in_class(class_id, user_id):
    try:
        role = session.get("user_role", "student")
        if role not in ("teacher", "admin"):
            return jsonify({"error": "Permission denied"}), 403

        membership = ClassGroupStudent.query.filter_by(
            class_group_id=class_id, user_id=user_id
        ).first()
        if not membership:
            return jsonify({"error": "Student not in this class"}), 404

        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404

        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        profile_data = profile.to_dict() if profile else None

        course_ids = [
            ca.course_id
            for ca in ClassGroupCourse.query.filter_by(class_group_id=class_id).all()
        ]

        learning_progress = []
        if course_ids:
            progresses = LearningProgress.query.filter(
                LearningProgress.user_id == user_id,
                LearningProgress.course_id.in_(course_ids),
            ).all()
            for lp in progresses:
                course = Course.query.get(lp.course_id)
                learning_progress.append({
                    "course_id": lp.course_id,
                    "course_title": course.title if course else "未知课程",
                    "progress_percentage": lp.progress_percentage,
                    "last_accessed": lp.last_accessed.isoformat() if lp.last_accessed else None,
                })

        evaluations = PracticeEvaluation.query.filter(
            PracticeEvaluation.user_id == user_id
        ).order_by(PracticeEvaluation.created_at.desc()).limit(20).all()
        scores = [e.score for e in evaluations if e.score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        practice_data = {
            "total_practices": len(evaluations),
            "avg_score": avg_score,
            "recent_scores": scores[:10],
            "recent_evaluations": [
                {
                    "id": e.id,
                    "score": e.score,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in evaluations[:5]
            ],
        }

        mistake_stats = {"total": 0, "by_status": {}, "by_error_type": {}, "top_knowledge_points": []}
        mistakes = MistakeRecord.query.filter_by(user_id=user_id).all()
        if mistakes:
            status_counts = {}
            error_type_counts = {}
            knowledge_point_counts = {}
            for m in mistakes:
                status_counts[m.mastery_status or "unmastered"] = (
                    status_counts.get(m.mastery_status or "unmastered", 0) + 1
                )
                etype = m.error_type_manual or m.error_type_auto or "other"
                error_type_counts[etype] = error_type_counts.get(etype, 0) + 1
                try:
                    tags = json.loads(m.knowledge_tags) if m.knowledge_tags else []
                    if isinstance(tags, str):
                        tags = [tags]
                    for tag in tags:
                        tag_text = str(tag).strip()
                        if tag_text:
                            knowledge_point_counts[tag_text] = (
                                knowledge_point_counts.get(tag_text, 0) + 1
                            )
                except (json.JSONDecodeError, TypeError):
                    pass
            mistake_stats = {
                "total": len(mistakes),
                "by_status": status_counts,
                "by_error_type": error_type_counts,
                "top_knowledge_points": sorted(
                    knowledge_point_counts.items(), key=lambda x: x[1], reverse=True
                )[:10],
            }

        question_count = CourseQuestion.query.filter_by(user_id=user_id).count()
        video_progresses = VideoProgress.query.filter_by(user_id=user_id).all()
        total_watch_time = sum(vp.current_time or 0 for vp in video_progresses)
        completed_videos = sum(1 for vp in video_progresses if vp.completed)

        interaction_data = {
            "questions_asked": question_count,
            "videos_watched": len(video_progresses),
            "videos_completed": completed_videos,
            "total_watch_time_seconds": total_watch_time,
        }

        return jsonify({
            "user": {
                "id": user.id,
                "username": user.username,
                "real_name": user.real_name,
                "email": user.email,
            },
            "profile": profile_data,
            "learning_progress": learning_progress,
            "practice": practice_data,
            "mistakes": mistake_stats,
            "interaction": interaction_data,
        }), 200
    except Exception as e:
        logger.error(f"Get student profile in class error: {e}")
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/students/profiles", methods=["GET"])
@require_auth
def get_class_students_profiles(class_id):
    try:
        role = session.get("user_role", "student")
        if role not in ("teacher", "admin"):
            return jsonify({"error": "Permission denied"}), 403

        memberships = ClassGroupStudent.query.filter_by(class_group_id=class_id).all()
        user_ids = [m.user_id for m in memberships]

        if not user_ids:
            return jsonify({"students": []}), 200

        course_ids = [
            ca.course_id
            for ca in ClassGroupCourse.query.filter_by(class_group_id=class_id).all()
        ]

        profiles = {
            p.user_id: p
            for p in StudentProfile.query.filter(StudentProfile.user_id.in_(user_ids)).all()
        }

        avg_scores = {}
        if user_ids:
            score_rows = (
                db.session.query(
                    PracticeEvaluation.user_id,
                    func.avg(PracticeEvaluation.score),
                )
                .filter(PracticeEvaluation.user_id.in_(user_ids), PracticeEvaluation.score.isnot(None))
                .group_by(PracticeEvaluation.user_id)
                .all()
            )
            avg_scores = {row[0]: round(row[1], 1) for row in score_rows}

        mistake_counts = {}
        if user_ids:
            mc_rows = (
                db.session.query(
                    MistakeRecord.user_id,
                    func.count(MistakeRecord.id),
                )
                .filter(MistakeRecord.user_id.in_(user_ids))
                .group_by(MistakeRecord.user_id)
                .all()
            )
            mistake_counts = {row[0]: row[1] for row in mc_rows}

        progress_map = {}
        if user_ids and course_ids:
            lp_rows = (
                db.session.query(
                    LearningProgress.user_id,
                    func.avg(LearningProgress.progress_percentage),
                )
                .filter(
                    LearningProgress.user_id.in_(user_ids),
                    LearningProgress.course_id.in_(course_ids),
                )
                .group_by(LearningProgress.user_id)
                .all()
            )
            progress_map = {row[0]: round(row[1], 1) for row in lp_rows}

        students = []
        for m in memberships:
            user = User.query.get(m.user_id)
            profile = profiles.get(m.user_id)
            students.append({
                "user_id": m.user_id,
                "student_name": m.student_name or (user.real_name if user else ""),
                "student_number": m.student_number,
                "avg_score": avg_scores.get(m.user_id, 0),
                "mistake_count": mistake_counts.get(m.user_id, 0),
                "avg_progress": progress_map.get(m.user_id, 0),
                "profile_completeness": profile.confidence_score if profile else 0,
                "cognitive_style": profile.cognitive_style if profile else None,
                "learning_pace": profile.learning_pace if profile else None,
                "goal_orientation": profile.goal_orientation if profile else None,
            })

        return jsonify({"students": students}), 200
    except Exception as e:
        logger.error(f"Get class students profiles error: {e}")
        return jsonify({"error": str(e)}), 500
