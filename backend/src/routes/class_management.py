import json
import logging
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request, session
from src.utils.auth import require_auth
from sqlalchemy import func

from src.models.user import db, User, ClassGroup, ClassGroupStudent, ClassGroupCourse
from src.models.course import Course, LearningProgress, PracticeEvaluation, MistakeRecord, CourseQuestion, VideoProgress
from src.models.student_profile import StudentProfile
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)
class_mgmt_bp = Blueprint("class_management", __name__)


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


@class_mgmt_bp.route("/classes/<int:class_id>/students/<int:user_id>/dashboard", methods=["GET"])
@require_auth
def get_student_dashboard_in_class(class_id, user_id):
    """获取班级内学生的完整学习画像看板数据（供教师查看）"""
    try:
        role = session.get("user_role", "student")
        if role not in ("teacher", "admin"):
            return jsonify({"error": "Permission denied"}), 403

        membership = ClassGroupStudent.query.filter_by(
            class_group_id=class_id, user_id=user_id
        ).first()
        if not membership:
            return jsonify({"error": "Student not in this class"}), 404

        from src.services.profile_sync_service import profile_sync_service
        from src.models.course import Assessment, VideoLesson, StudyNote, CourseDiscussion
        from src.models.course import UserAchievement, Achievement

        time_range = request.args.get("time_range", "30")
        try:
            days = int(time_range)
        except (ValueError, TypeError):
            days = 30
        since_date = datetime.utcnow() - timedelta(days=days)

        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)
            db.session.commit()

        profile_data = profile.to_dict()

        # 限定班级课程范围
        course_ids = [
            ca.course_id
            for ca in ClassGroupCourse.query.filter_by(class_group_id=class_id).all()
        ]

        # 1. 学习内容偏好
        enrolled_courses = LearningProgress.query.filter_by(user_id=user_id).all()
        category_counts = {}
        course_details = []
        for lp in enrolled_courses:
            course = lp.course
            if not course:
                continue
            cat = course.category or "未分类"
            category_counts[cat] = category_counts.get(cat, 0) + 1
            course_details.append({
                "id": course.id,
                "title": course.title,
                "category": cat,
                "difficulty": course.difficulty or "beginner",
                "progress": round(lp.progress_percentage or 0, 1),
                "last_accessed": lp.last_accessed.isoformat() if lp.last_accessed else None,
            })

        interest_areas = profile_data.get("interest_areas", [])
        content_preferences = {
            "category_distribution": [
                {"name": k, "value": v} for k, v in sorted(
                    category_counts.items(), key=lambda x: x[1], reverse=True
                )
            ],
            "interest_areas": interest_areas,
            "courses": course_details,
        }

        # 2. 学习时长分布
        day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        today = datetime.utcnow().date()
        weekly_trend = []
        for i in range(min(days, 30) - 1, -1, -1):
            date = today - timedelta(days=i)
            day_records = LearningProgress.query.filter_by(user_id=user_id).filter(
                func.date(LearningProgress.last_accessed) == date
            ).all()
            practice_count = PracticeEvaluation.query.filter_by(user_id=user_id).filter(
                func.date(PracticeEvaluation.created_at) == date
            ).count()
            video_records = VideoProgress.query.filter_by(user_id=user_id).filter(
                func.date(VideoProgress.last_watched) == date
            ).all()
            video_minutes = sum(vp.current_time or 0 for vp in video_records) / 60
            estimated_hours = round(len(day_records) * 0.3 + practice_count * 0.25 + video_minutes / 60, 1)
            weekly_trend.append({
                "date": date.isoformat(),
                "day": day_names[date.weekday()],
                "hours": estimated_hours,
                "practice_count": practice_count,
                "video_minutes": round(video_minutes, 1),
            })

        hourly_distribution = [{"hour": h, "count": 0} for h in range(24)]
        recent_progress = LearningProgress.query.filter_by(user_id=user_id).filter(
            LearningProgress.last_accessed >= since_date
        ).all()
        for rp in recent_progress:
            if rp.last_accessed:
                hourly_distribution[rp.last_accessed.hour]["count"] += 1

        time_distribution = {
            "daily_trend": weekly_trend,
            "hourly_distribution": hourly_distribution,
            "total_estimated_hours": sum(d["hours"] for d in weekly_trend),
        }

        # 3. 知识点掌握程度
        evaluations = PracticeEvaluation.query.filter_by(user_id=user_id).filter(
            PracticeEvaluation.created_at >= since_date
        ).order_by(PracticeEvaluation.created_at.desc()).all()

        course_scores = {}
        score_trend = []
        for ev in evaluations:
            assessment = ev.assessment
            course_title = assessment.course.title if assessment and assessment.course else "未知课程"
            if course_title not in course_scores:
                course_scores[course_title] = []
            if ev.score is not None:
                course_scores[course_title].append(ev.score)
                score_trend.append({
                    "date": ev.created_at.isoformat() if ev.created_at else None,
                    "score": ev.score,
                    "course": course_title,
                })

        knowledge_mastery = {
            "by_course": [
                {
                    "course": name,
                    "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
                    "count": len(scores),
                    "max_score": max(scores) if scores else 0,
                    "min_score": min(scores) if scores else 0,
                }
                for name, scores in course_scores.items()
            ],
            "score_trend": score_trend[:30],
            "overall_avg": round(
                sum(ev.score for ev in evaluations if ev.score is not None) /
                max(len([ev for ev in evaluations if ev.score is not None]), 1), 1
            ),
        }

        mistakes = MistakeRecord.query.filter_by(user_id=user_id).all()
        knowledge_point_errors = {}
        error_type_counts = {}
        for m in mistakes:
            etype = m.error_type_manual or m.error_type_auto or "其他"
            error_type_counts[etype] = error_type_counts.get(etype, 0) + 1
            try:
                tags = json.loads(m.knowledge_tags) if m.knowledge_tags else []
                if isinstance(tags, str):
                    tags = [tags]
                for tag in tags:
                    tag_text = str(tag).strip()
                    if tag_text:
                        knowledge_point_errors[tag_text] = knowledge_point_errors.get(tag_text, 0) + 1
            except (json.JSONDecodeError, TypeError):
                pass

        knowledge_mastery["weak_points"] = sorted(
            knowledge_point_errors.items(), key=lambda x: x[1], reverse=True
        )[:10]
        knowledge_mastery["error_type_distribution"] = [
            {"type": k, "count": v} for k, v in sorted(
                error_type_counts.items(), key=lambda x: x[1], reverse=True
            )
        ]

        # 4. 学习路径轨迹
        from src.models.learning_path import LearningPath, LearningPathNode
        learning_paths = LearningPath.query.filter_by(user_id=user_id).order_by(
            LearningPath.created_at.desc()
        ).all()
        path_data = []
        for lp in learning_paths:
            nodes = LearningPathNode.query.filter_by(path_id=lp.id).order_by(
                LearningPathNode.order_index
            ).all()
            completed_nodes = sum(1 for n in nodes if n.status == "completed")
            total_nodes = len(nodes) or 1
            path_data.append({
                "id": lp.id,
                "title": lp.title,
                "course": lp.course.title if lp.course else None,
                "progress": round(completed_nodes / total_nodes * 100, 1),
                "total_nodes": len(nodes),
                "completed_nodes": completed_nodes,
                "status": lp.status,
                "created_at": lp.created_at.isoformat() if lp.created_at else None,
                "nodes": [
                    {
                        "node_id": n.node_id,
                        "title": n.title,
                        "type": n.node_type,
                        "status": n.status,
                        "mastery_level": n.mastery_level,
                        "order": n.order_index,
                    }
                    for n in nodes
                ],
            })

        progress_timeline = []
        for lp in enrolled_courses:
            if lp.course and lp.last_accessed:
                progress_timeline.append({
                    "course": lp.course.title,
                    "progress": round(lp.progress_percentage or 0, 1),
                    "last_accessed": lp.last_accessed.isoformat(),
                })
        progress_timeline.sort(key=lambda x: x.get("last_accessed", ""), reverse=True)

        learning_trajectory = {
            "paths": path_data,
            "progress_timeline": progress_timeline[:10],
            "total_paths": len(path_data),
            "active_paths": sum(1 for p in path_data if p["status"] == "active"),
        }

        # 5. 互动参与频率
        questions_count = CourseQuestion.query.filter_by(user_id=user_id).filter(
            CourseQuestion.created_at >= since_date
        ).count() if hasattr(CourseQuestion, 'created_at') else CourseQuestion.query.filter_by(user_id=user_id).count()

        discussions_count = CourseDiscussion.query.filter_by(user_id=user_id).count()
        video_progresses = VideoProgress.query.filter_by(user_id=user_id).all()
        total_videos = len(video_progresses)
        completed_videos = sum(1 for vp in video_progresses if vp.completed)
        total_watch_minutes = round(sum(vp.current_time or 0 for vp in video_progresses) / 60, 1)
        study_notes_count = StudyNote.query.filter_by(user_id=user_id).count()

        weekly_interaction = []
        for i in range(min(days, 28) - 1, -1, -1):
            date = today - timedelta(days=i)
            q_count = CourseQuestion.query.filter_by(user_id=user_id).filter(
                func.date(CourseQuestion.created_at) == date
            ).count() if hasattr(CourseQuestion, 'created_at') else 0
            d_count = CourseDiscussion.query.filter_by(user_id=user_id).filter(
                func.date(CourseDiscussion.created_at) == date
            ).count() if hasattr(CourseDiscussion, 'created_at') else 0
            p_count = PracticeEvaluation.query.filter_by(user_id=user_id).filter(
                func.date(PracticeEvaluation.created_at) == date
            ).count()
            weekly_interaction.append({
                "date": date.isoformat(),
                "questions": q_count,
                "discussions": d_count,
                "practices": p_count,
                "total": q_count + d_count + p_count,
            })

        interaction_frequency = {
            "total_questions": questions_count,
            "total_discussions": discussions_count,
            "video_completion_rate": round(completed_videos / max(total_videos, 1) * 100, 1),
            "total_videos": total_videos,
            "completed_videos": completed_videos,
            "total_watch_minutes": total_watch_minutes,
            "study_notes_count": study_notes_count,
            "weekly_interaction": weekly_interaction,
        }

        # 6. 学习成果评估
        total_practices = PracticeEvaluation.query.filter_by(user_id=user_id).count()
        all_scores = [ev.score for ev in PracticeEvaluation.query.filter_by(user_id=user_id).all()
                      if ev.score is not None]

        user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
        achievement_categories = {}
        for ua in user_achievements:
            ach = Achievement.query.get(ua.achievement_id)
            if ach:
                cat = ach.category or "其他"
                achievement_categories[cat] = achievement_categories.get(cat, 0) + 1

        score_ranges = {"0-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
        for s in all_scores:
            if s < 40:
                score_ranges["0-40"] += 1
            elif s < 60:
                score_ranges["40-60"] += 1
            elif s < 80:
                score_ranges["60-80"] += 1
            else:
                score_ranges["80-100"] += 1

        mastery_levels = {"精通": 0, "熟练": 0, "了解": 0, "薄弱": 0}
        for name, scores in course_scores.items():
            if not scores:
                continue
            avg = sum(scores) / len(scores)
            if avg >= 90:
                mastery_levels["精通"] += 1
            elif avg >= 75:
                mastery_levels["熟练"] += 1
            elif avg >= 60:
                mastery_levels["了解"] += 1
            else:
                mastery_levels["薄弱"] += 1

        learning_outcomes = {
            "total_practices": total_practices,
            "avg_score": round(sum(all_scores) / max(len(all_scores), 1), 1),
            "max_score": max(all_scores) if all_scores else 0,
            "total_achievements": len(user_achievements),
            "achievement_categories": achievement_categories,
            "score_distribution": [
                {"range": k, "count": v} for k, v in score_ranges.items()
            ],
            "mastery_levels": mastery_levels,
            "completed_courses": sum(
                1 for lp in enrolled_courses if (lp.progress_percentage or 0) >= 100
            ),
            "total_courses": len(enrolled_courses),
        }

        # 维度评分
        from src.routes.profile_routes import _calc_dimension_score
        dimension_scores = {
            "knowledge_base": _calc_dimension_score(profile_data, "knowledge_base"),
            "cognitive_style": _calc_dimension_score(profile_data, "cognitive_style"),
            "error_patterns": _calc_dimension_score(profile_data, "error_patterns"),
            "learning_pace": _calc_dimension_score(profile_data, "learning_pace"),
            "interest_areas": _calc_dimension_score(profile_data, "interest_areas"),
            "goal_orientation": _calc_dimension_score(profile_data, "goal_orientation"),
            "time_availability": _calc_dimension_score(profile_data, "time_availability"),
            "interaction_preference": _calc_dimension_score(profile_data, "interaction_preference"),
        }

        # AI 洞察
        insight = ""
        try:
            insight_result = profile_sync_service.generate_ai_insight(user_id, user_role=role)
            insight = insight_result.get("insight", "")
        except Exception:
            pass

        return jsonify({
            "user": {
                "id": user_id,
                "student_name": membership.student_name or "",
                "student_number": membership.student_number or "",
            },
            "profile": profile_data,
            "dimension_scores": dimension_scores,
            "content_preferences": content_preferences,
            "time_distribution": time_distribution,
            "knowledge_mastery": knowledge_mastery,
            "learning_trajectory": learning_trajectory,
            "interaction_frequency": interaction_frequency,
            "learning_outcomes": learning_outcomes,
            "insight": insight,
        }), 200

    except Exception as e:
        logger.error(f"Get student dashboard in class error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@class_mgmt_bp.route("/classes/<int:class_id>/profiles-sync", methods=["POST"])
@require_auth
def sync_class_profiles(class_id):
    """批量同步班级所有学生的画像数据"""
    try:
        role = session.get("user_role", "student")
        if role not in ("teacher", "admin"):
            return jsonify({"error": "Permission denied"}), 403

        from src.services.profile_sync_service import profile_sync_service

        memberships = ClassGroupStudent.query.filter_by(class_group_id=class_id).all()
        if not memberships:
            return jsonify({"synced": 0, "results": []}), 200

        results = []
        for m in memberships:
            try:
                profile = StudentProfile.query.filter_by(user_id=m.user_id).first()
                if not profile:
                    profile = StudentProfile(user_id=m.user_id)
                    db.session.add(profile)

                sync_result = profile_sync_service.full_sync(m.user_id)
                results.append({
                    "user_id": m.user_id,
                    "student_name": m.student_name or "",
                    "synced": True,
                    "sync_result": sync_result,
                })
            except Exception as e:
                results.append({
                    "user_id": m.user_id,
                    "student_name": m.student_name or "",
                    "synced": False,
                    "error": str(e),
                })

        synced_count = sum(1 for r in results if r["synced"])
        return jsonify({
            "synced": synced_count,
            "total": len(results),
            "results": results,
        }), 200

    except Exception as e:
        logger.error(f"Sync class profiles error: {e}")
        return jsonify({"error": str(e)}), 500
