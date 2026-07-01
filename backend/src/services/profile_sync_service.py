import json
import logging
from datetime import datetime, timedelta
from src.models.user import db
from src.models.student_profile import StudentProfile
from src.models.course import (
    PracticeEvaluation, MistakeRecord, CourseQuestion,
    LearningProgress, VideoProgress, ProgrammingSubmission, Assessment,
)
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)


class ProfileSyncService:
    def sync_from_practice(self, user_id):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)

        evaluations = PracticeEvaluation.query.filter_by(user_id=user_id).order_by(
            PracticeEvaluation.created_at.desc()
        ).limit(30).all()

        if not evaluations:
            db.session.commit()
            return {"updated": False, "reason": "no_practice_data"}

        scores = [e.score for e in evaluations if e.score is not None]
        recent_scores = scores[:5] if scores else []
        avg_score = sum(scores) / len(scores) if scores else 0

        knowledge_base = profile.get_knowledge_base()
        if avg_score >= 80:
            knowledge_base["_practice_trend"] = "strong"
        elif avg_score >= 60:
            knowledge_base["_practice_trend"] = "moderate"
        else:
            knowledge_base["_practice_trend"] = "weak"
        knowledge_base["_avg_score"] = round(avg_score, 1)
        knowledge_base["_recent_scores"] = recent_scores
        profile.set_knowledge_base(knowledge_base)

        error_patterns = profile.get_error_patterns()
        weak_topics = [s for s in recent_scores if s < 60]
        if weak_topics:
            error_patterns = [
                ep for ep in error_patterns
                if not ep.get("_auto_generated")
            ]
            error_patterns.append({
                "knowledge_point": "近期薄弱知识点",
                "error_type": "综合",
                "frequency": "高" if len(weak_topics) >= 3 else "中",
                "_auto_generated": True,
                "_source": "practice_sync",
            })
            profile.set_error_patterns(error_patterns)

        if avg_score >= 85 and profile.learning_pace == "slow":
            profile.learning_pace = "moderate"
        elif avg_score < 50 and profile.learning_pace == "fast":
            profile.learning_pace = "moderate"

        profile.update_source = "auto_sync_practice"
        profile.last_updated = datetime.utcnow()
        profile._recalculate_confidence()
        db.session.commit()

        return {"updated": True, "avg_score": avg_score, "trend": knowledge_base.get("_practice_trend")}

    def sync_from_programming(self, user_id):
        """从编程题提交记录同步学生画像。

        编程题完成应算作一次考核，本方法将 ProgrammingSubmission 的得分趋势、
        通过率、薄弱知识点同步到 StudentProfile，确保编程题数据进入画像体系。
        """
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)

        submissions = ProgrammingSubmission.query.filter_by(user_id=user_id).order_by(
            ProgrammingSubmission.created_at.desc()
        ).limit(30).all()

        if not submissions:
            db.session.commit()
            return {"updated": False, "reason": "no_programming_data"}

        scores = [s.score for s in submissions if s.score is not None]
        recent_scores = scores[:5] if scores else []
        passed_count = sum(1 for s in submissions if s.status == 'passed')
        pass_rate = passed_count / len(submissions) if submissions else 0
        avg_score = sum(scores) / len(scores) if scores else 0

        knowledge_base = profile.get_knowledge_base()
        # 编程题考核统计：作为一次考核记录计入画像
        programming_stats = knowledge_base.get("_programming_stats") or {}
        programming_stats.update({
            "total_submissions": len(submissions),
            "passed_count": passed_count,
            "pass_rate": round(pass_rate, 2),
            "avg_score": round(avg_score, 1),
            "recent_scores": recent_scores,
            "last_submission_at": submissions[0].created_at.isoformat() if submissions[0].created_at else None,
        })
        knowledge_base["_programming_stats"] = programming_stats

        # 合并编程题得分到练习趋势（与普通练习一起影响 trend 判断）
        practice_scores = knowledge_base.get("_recent_scores") or []
        merged_recent = (recent_scores + practice_scores)[:5]
        merged_avg = sum(merged_recent) / len(merged_recent) if merged_recent else 0
        if merged_avg >= 80:
            knowledge_base["_practice_trend"] = "strong"
        elif merged_avg >= 60:
            knowledge_base["_practice_trend"] = "moderate"
        else:
            knowledge_base["_practice_trend"] = "weak"
        knowledge_base["_avg_score"] = round(merged_avg, 1)
        knowledge_base["_recent_scores"] = merged_recent

        # 从编程题的 knowledge_tags 统计薄弱知识点
        kp_counts = {}
        for sub in submissions:
            if sub.status == 'passed':
                continue  # 通过的题目不计入薄弱点
            assessment = Assessment.query.get(sub.assessment_id)
            if not assessment:
                continue
            try:
                questions = json.loads(assessment.questions) if isinstance(assessment.questions, str) else assessment.questions
                if isinstance(questions, list) and sub.question_index < len(questions):
                    q = questions[sub.question_index] or {}
                    tags = q.get('knowledge_tags') or []
                    if isinstance(tags, str):
                        try:
                            tags = json.loads(tags)
                        except (json.JSONDecodeError, TypeError):
                            tags = [tags]
                    for tag in tags:
                        tag_text = str(tag).strip()
                        if tag_text:
                            kp_counts[tag_text] = kp_counts.get(tag_text, 0) + 1
            except (json.JSONDecodeError, TypeError, IndexError):
                continue

        if kp_counts:
            existing_weak = knowledge_base.get("_weak_knowledge_points") or []
            existing_map = {w.get("point"): w.get("mistake_count", 0) for w in existing_weak if isinstance(w, dict)}
            for kp, cnt in kp_counts.items():
                existing_map[kp] = existing_map.get(kp, 0) + cnt
            weak_points = sorted(existing_map.items(), key=lambda x: x[1], reverse=True)[:10]
            knowledge_base["_weak_knowledge_points"] = [
                {"point": p[0], "mistake_count": p[1]} for p in weak_points
            ]

        profile.set_knowledge_base(knowledge_base)

        # 根据编程题通过率调整学习节奏
        if pass_rate >= 0.8 and avg_score >= 85 and profile.learning_pace == "slow":
            profile.learning_pace = "moderate"
        elif pass_rate < 0.3 and profile.learning_pace == "fast":
            profile.learning_pace = "moderate"

        profile.update_source = "auto_sync_programming"
        profile.last_updated = datetime.utcnow()
        profile._recalculate_confidence()
        db.session.commit()

        return {
            "updated": True,
            "avg_score": round(avg_score, 1),
            "pass_rate": round(pass_rate, 2),
            "total_submissions": len(submissions),
        }

    def sync_from_mistakes(self, user_id):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)

        mistakes = MistakeRecord.query.filter_by(user_id=user_id).all()
        if not mistakes:
            db.session.commit()
            return {"updated": False, "reason": "no_mistake_data"}

        error_type_map = {
            "概念理解": "概念理解偏差",
            "计算粗心": "计算粗心",
            "思路不清": "思路不清晰",
            "知识遗忘": "知识遗忘",
        }
        error_type_counts = {}
        knowledge_point_counts = {}
        for m in mistakes:
            etype = m.error_type_manual or m.error_type_auto or "other"
            error_type_counts[etype] = error_type_counts.get(etype, 0) + 1
            try:
                tags = json.loads(m.knowledge_tags) if m.knowledge_tags else []
                if isinstance(tags, str):
                    tags = [tags]
                for tag in tags:
                    tag_text = str(tag).strip()
                    if tag_text:
                        knowledge_point_counts[tag_text] = knowledge_point_counts.get(tag_text, 0) + 1
            except (json.JSONDecodeError, TypeError):
                pass

        error_patterns = profile.get_error_patterns()
        manual_patterns = [ep for ep in error_patterns if not ep.get("_auto_generated")]
        for etype, count in sorted(error_type_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            mapped = error_type_map.get(etype, etype)
            freq = "高" if count >= 5 else "中" if count >= 2 else "低"
            manual_patterns.append({
                "knowledge_point": f"错题分析-{mapped}",
                "error_type": mapped,
                "frequency": freq,
                "_auto_generated": True,
                "_source": "mistake_sync",
                "_count": count,
            })
        profile.set_error_patterns(manual_patterns)

        knowledge_base = profile.get_knowledge_base()
        weak_points = sorted(knowledge_point_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        knowledge_base["_weak_knowledge_points"] = [
            {"point": p[0], "mistake_count": p[1]} for p in weak_points
        ]
        profile.set_knowledge_base(knowledge_base)

        profile.update_source = "auto_sync_mistakes"
        profile.last_updated = datetime.utcnow()
        profile._recalculate_confidence()
        db.session.commit()

        return {"updated": True, "error_types": error_type_counts, "weak_points_count": len(weak_points)}

    def sync_from_interaction(self, user_id):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)

        question_count = CourseQuestion.query.filter_by(user_id=user_id).count()
        video_progresses = VideoProgress.query.filter_by(user_id=user_id).all()
        total_watch_time = sum(vp.current_time or 0 for vp in video_progresses)
        completed_videos = sum(1 for vp in video_progresses if vp.completed)

        interest_areas = profile.get_interest_areas()
        knowledge_base = profile.get_knowledge_base()

        knowledge_base["_interaction_stats"] = {
            "questions_asked": question_count,
            "videos_watched": len(video_progresses),
            "videos_completed": completed_videos,
            "total_watch_minutes": round(total_watch_time / 60, 1),
        }

        if question_count > 10 and profile.interaction_preference == "guided":
            profile.interaction_preference = "exploratory"
        elif completed_videos > len(video_progresses) * 0.8 and profile.learning_pace == "moderate":
            profile.learning_pace = "fast"

        profile.set_knowledge_base(knowledge_base)
        profile.update_source = "auto_sync_interaction"
        profile.last_updated = datetime.utcnow()
        profile._recalculate_confidence()
        db.session.commit()

        return {"updated": True, "questions": question_count, "videos_completed": completed_videos}

    def sync_from_learning_progress(self, user_id):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            profile = StudentProfile(user_id=user_id)
            db.session.add(profile)

        progresses = LearningProgress.query.filter_by(user_id=user_id).all()
        if not progresses:
            db.session.commit()
            return {"updated": False, "reason": "no_progress_data"}

        knowledge_base = profile.get_knowledge_base()
        course_progress = {}
        for lp in progresses:
            course = lp.course
            if course:
                course_progress[course.title] = lp.progress_percentage

        knowledge_base["_course_progress"] = course_progress
        avg_progress = sum(lp.progress_percentage for lp in progresses) / len(progresses)

        if avg_progress > 80 and profile.learning_pace == "slow":
            profile.learning_pace = "moderate"
        elif avg_progress < 30 and profile.learning_pace == "fast":
            profile.learning_pace = "moderate"

        profile.set_knowledge_base(knowledge_base)
        profile.update_source = "auto_sync_progress"
        profile.last_updated = datetime.utcnow()
        profile._recalculate_confidence()
        db.session.commit()

        return {"updated": True, "avg_progress": round(avg_progress, 1)}

    def full_sync(self, user_id):
        results = {}
        try:
            results["practice"] = self.sync_from_practice(user_id)
        except Exception as e:
            logger.error(f"Practice sync error for user {user_id}: {e}")
            results["practice"] = {"updated": False, "error": str(e)}

        try:
            results["programming"] = self.sync_from_programming(user_id)
        except Exception as e:
            logger.error(f"Programming sync error for user {user_id}: {e}")
            results["programming"] = {"updated": False, "error": str(e)}

        try:
            results["mistakes"] = self.sync_from_mistakes(user_id)
        except Exception as e:
            logger.error(f"Mistake sync error for user {user_id}: {e}")
            results["mistakes"] = {"updated": False, "error": str(e)}

        try:
            results["interaction"] = self.sync_from_interaction(user_id)
        except Exception as e:
            logger.error(f"Interaction sync error for user {user_id}: {e}")
            results["interaction"] = {"updated": False, "error": str(e)}

        try:
            results["progress"] = self.sync_from_learning_progress(user_id)
        except Exception as e:
            logger.error(f"Progress sync error for user {user_id}: {e}")
            results["progress"] = {"updated": False, "error": str(e)}

        return results

    def generate_ai_insight(self, user_id, user_role=None):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            return {"insight": "暂无画像数据"}

        profile_data = profile.to_dict()
        prompt = f"""基于以下学生学习画像数据，生成一份简洁的学习洞察分析：

学生画像：
- 知识基础：{json.dumps(profile_data.get('knowledge_base', {}), ensure_ascii=False)}
- 认知风格：{profile_data.get('cognitive_style', '未知')}
- 易错点模式：{json.dumps(profile_data.get('error_patterns', []), ensure_ascii=False)}
- 学习节奏：{profile_data.get('learning_pace', '未知')}
- 兴趣领域：{json.dumps(profile_data.get('interest_areas', []), ensure_ascii=False)}
- 目标导向：{profile_data.get('goal_orientation', '未知')}

请从以下角度分析：
1. 学习优势：学生擅长的方面
2. 薄弱环节：需要加强的领域
3. 学习建议：针对性的改进建议
4. 推荐资源类型：适合该学生的资源形式

请用简洁的中文回答，每部分2-3句话。"""

        try:
            insight = spark_service.chat([
                {"role": "system", "content": "你是一位专业的学习分析师，擅长根据学生数据提供个性化洞察。"},
                {"role": "user", "content": prompt},
            ], user_id=user_id, user_role=user_role)
            return {"insight": insight}
        except Exception as e:
            logger.error(f"Generate AI insight error: {e}")
            return {"insight": "AI分析暂时不可用", "error": str(e)}


profile_sync_service = ProfileSyncService()
