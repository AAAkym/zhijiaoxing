import json
import logging
from datetime import datetime, timedelta
from flask import Blueprint, jsonify, request, session
from sqlalchemy import func
from src.utils.auth import require_auth
from src.models.user import db, User
from src.models.student_profile import StudentProfile, ProfileDialogSession
from src.models.course import (
    Course, LearningProgress, PracticeEvaluation, Assessment,
    MistakeRecord, VideoProgress, VideoLesson, CourseQuestion,
    CourseDiscussion, StudyNote
)
from src.services.multi_agent.profile_agent import ProfileAgent
from src.services.profile_sync_service import profile_sync_service

logger = logging.getLogger(__name__)

profile_bp = Blueprint("profile", __name__)

profile_agent = ProfileAgent()


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
        result = profile_sync_service.generate_ai_insight(user_id, user_role=session.get('user_role'))
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
        insight = profile_sync_service.generate_ai_insight(user_id, user_role=session.get('user_role'))

        return jsonify({
            "user": user.to_dict(),
            "profile": profile.to_dict(),
            "summary": summary,
            "insight": insight.get("insight", ""),
        }), 200
    except Exception as e:
        logger.error(f"Get student profile by teacher error: {e}")
        return jsonify({"error": str(e)}), 500


@profile_bp.route("/profile/dashboard", methods=["GET"])
@require_auth
def get_profile_dashboard():
    """获取学习画像看板的多维度数据"""
    try:
        user_id = session["user_id"]
        time_range = request.args.get("time_range", "30")  # 7, 30, 90 days
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

        # ====== 1. 学习内容偏好 ======
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

        # ====== 2. 学习时长分布 ======
        day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
        today = datetime.utcnow().date()

        # 周学习时长趋势
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

        # 每日活跃时段分布
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

        # ====== 3. 知识点掌握程度 ======
        evaluations = PracticeEvaluation.query.filter_by(user_id=user_id).filter(
            PracticeEvaluation.created_at >= since_date
        ).order_by(PracticeEvaluation.created_at.desc()).all()

        # 按课程分组统计
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

        # 错题知识点分析
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

        # ====== 4. 学习路径轨迹 ======
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

        # 课程进度时间线
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

        # ====== 5. 互动参与频率 ======
        questions_count = CourseQuestion.query.filter_by(user_id=user_id).filter(
            CourseQuestion.created_at >= since_date
        ).count() if hasattr(CourseQuestion, 'created_at') else CourseQuestion.query.filter_by(user_id=user_id).count()

        discussions_count = CourseDiscussion.query.filter_by(user_id=user_id).count()

        video_progresses = VideoProgress.query.filter_by(user_id=user_id).all()
        total_videos = len(video_progresses)
        completed_videos = sum(1 for vp in video_progresses if vp.completed)
        total_watch_minutes = round(sum(vp.current_time or 0 for vp in video_progresses) / 60, 1)

        study_notes_count = StudyNote.query.filter_by(user_id=user_id).count()

        # 按周统计互动频率
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

        # ====== 6. 学习成果评估 ======
        total_practices = PracticeEvaluation.query.filter_by(user_id=user_id).count()
        all_scores = [ev.score for ev in PracticeEvaluation.query.filter_by(user_id=user_id).all()
                      if ev.score is not None]

        # 成就统计
        from src.models.course import UserAchievement, Achievement
        user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
        achievement_categories = {}
        for ua in user_achievements:
            ach = Achievement.query.get(ua.achievement_id)
            if ach:
                cat = ach.category or "其他"
                achievement_categories[cat] = achievement_categories.get(cat, 0) + 1

        # 分数分布
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

        # 掌握程度评估（基于分数和错题）
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

        # ====== 画像维度评分（用于雷达图） ======
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

        return jsonify({
            "profile": profile_data,
            "dimension_scores": dimension_scores,
            "content_preferences": content_preferences,
            "time_distribution": time_distribution,
            "knowledge_mastery": knowledge_mastery,
            "learning_trajectory": learning_trajectory,
            "interaction_frequency": interaction_frequency,
            "learning_outcomes": learning_outcomes,
        }), 200

    except Exception as e:
        logger.error(f"Get profile dashboard error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def _calc_dimension_score(profile_data, dimension):
    """计算画像维度评分（0-100）"""
    value = profile_data.get(dimension)
    if dimension == "knowledge_base":
        kb = value or {}
        if not isinstance(kb, dict):
            return 20
        base_score = min(len(kb) * 15, 60)
        trend = kb.get("_practice_trend")
        if trend == "strong":
            base_score += 30
        elif trend == "moderate":
            base_score += 15
        return min(base_score, 100)
    elif dimension == "cognitive_style":
        return 80 if value and value != "mixed" else 25
    elif dimension == "error_patterns":
        ep = value or []
        return min(30 + len(ep) * 15, 100) if isinstance(ep, list) and len(ep) > 0 else 15
    elif dimension == "learning_pace":
        return 75 if value and value != "moderate" else 30
    elif dimension == "interest_areas":
        ia = value or []
        return min(25 + len(ia) * 20, 100) if isinstance(ia, list) and len(ia) > 0 else 20
    elif dimension == "goal_orientation":
        return 80 if value and value != "exam" else 30
    elif dimension == "time_availability":
        ta = value or {}
        return min(20 + len(ta) * 20, 100) if isinstance(ta, dict) and len(ta) > 0 else 15
    elif dimension == "interaction_preference":
        return 75 if value and value != "guided" else 25
    return 20
