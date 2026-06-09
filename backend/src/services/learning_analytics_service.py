import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func, case, desc, and_

from src.models.user import db, User
from src.models.course import (
    Course, LearningProgress, PracticeEvaluation, Assessment,
    TeachingContent, MistakeRecord, ProgrammingSubmission,
)
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)


def get_class_learning_analytics(teacher_id: int, course_id: int = None) -> Dict:
    courses = Course.query.filter_by(teacher_id=teacher_id).all()
    if not courses:
        return {"error": "未找到课程"}
    target_ids = [course_id] if course_id else [c.id for c in courses]
    course_map = {c.id: c.title for c in courses}

    total_students = db.session.query(func.count(func.distinct(LearningProgress.user_id))).filter(
        LearningProgress.course_id.in_(target_ids)
    ).scalar() or 0

    progress_records = LearningProgress.query.filter(
        LearningProgress.course_id.in_(target_ids)
    ).all()

    progress_dist = {"excellent": 0, "good": 0, "average": 0, "below_average": 0, "inactive": 0}
    for p in progress_records:
        pct = p.progress_percentage or 0
        if pct >= 80:
            progress_dist["excellent"] += 1
        elif pct >= 60:
            progress_dist["good"] += 1
        elif pct >= 40:
            progress_dist["average"] += 1
        elif pct >= 10:
            progress_dist["below_average"] += 1
        else:
            progress_dist["inactive"] += 1

    avg_progress = 0
    if progress_records:
        avg_progress = round(sum(p.progress_percentage or 0 for p in progress_records) / len(progress_records), 1)

    course_analytics = []
    for cid in target_ids:
        c_records = [p for p in progress_records if p.course_id == cid]
        c_avg = round(sum(p.progress_percentage or 0 for p in c_records) / len(c_records), 1) if c_records else 0
        c_students = len(set(p.user_id for p in c_records))

        assessment_count = Assessment.query.filter_by(course_id=cid).count()
        mistake_count = MistakeRecord.query.filter_by(course_id=cid).count()
        submission_count = ProgrammingSubmission.query.filter_by(course_id=cid).count()

        course_analytics.append({
            "course_id": cid,
            "course_title": course_map.get(cid, "未知"),
            "student_count": c_students,
            "avg_progress": c_avg,
            "assessment_count": assessment_count,
            "mistake_count": mistake_count,
            "submission_count": submission_count,
        })

    return {
        "total_students": total_students,
        "avg_progress": avg_progress,
        "progress_distribution": progress_dist,
        "course_analytics": course_analytics,
    }


def get_student_detail_analytics(teacher_id: int, student_id: int) -> Dict:
    courses = Course.query.filter_by(teacher_id=teacher_id).all()
    if not courses:
        return {"error": "未找到课程"}
    course_ids = [c.id for c in courses]

    student = User.query.get(student_id)
    if not student:
        return {"error": "学生不存在"}

    progress_records = LearningProgress.query.filter(
        LearningProgress.user_id == student_id,
        LearningProgress.course_id.in_(course_ids),
    ).all()

    course_progress = []
    for p in progress_records:
        course = Course.query.get(p.course_id)
        course_progress.append({
            "course_id": p.course_id,
            "course_title": course.title if course else "未知",
            "progress": p.progress_percentage or 0,
            "last_accessed": p.last_accessed.isoformat() if p.last_accessed else None,
        })

    mistakes = MistakeRecord.query.filter_by(user_id=student_id).filter(
        MistakeRecord.course_id.in_(course_ids)
    ).all()

    mistake_summary = {
        "total": len(mistakes),
        "unmastered": sum(1 for m in mistakes if m.mastery_status == 'unmastered'),
        "reviewing": sum(1 for m in mistakes if m.mastery_status == 'reviewing'),
        "mastered": sum(1 for m in mistakes if m.mastery_status == 'mastered'),
        "by_type": {},
    }
    for m in mistakes:
        etype = m.error_type_auto or m.error_type_manual or "unknown"
        mistake_summary["by_type"][etype] = mistake_summary["by_type"].get(etype, 0) + 1

    submissions = ProgrammingSubmission.query.filter_by(user_id=student_id).filter(
        ProgrammingSubmission.course_id.in_(course_ids)
    ).all()

    programming_summary = {
        "total_submissions": len(submissions),
        "avg_score": round(sum(s.score or 0 for s in submissions) / len(submissions), 1) if submissions else 0,
        "passed": sum(1 for s in submissions if (s.score or 0) >= 90),
        "needs_improvement": sum(1 for s in submissions if (s.score or 0) < 60),
    }

    evaluations = PracticeEvaluation.query.filter_by(user_id=student_id).all()
    practice_summary = {
        "total": len(evaluations),
        "avg_score": round(sum(e.score or 0 for e in evaluations) / len(evaluations), 1) if evaluations else 0,
    }

    return {
        "student_id": student_id,
        "student_name": student.real_name or student.username,
        "course_progress": course_progress,
        "mistake_summary": mistake_summary,
        "programming_summary": programming_summary,
        "practice_summary": practice_summary,
    }


def generate_ai_learning_report(teacher_id: int, course_id: int = None, report_type: str = "comprehensive", user_id: int = None, user_role: str = None) -> Dict:
    analytics = get_class_learning_analytics(teacher_id, course_id)
    if "error" in analytics:
        return analytics

    prompt = _build_analytics_prompt(analytics, report_type)

    try:
        raw = spark_service.chat(prompt, user_id=user_id, user_role=user_role)
        import re
        cleaned = raw.strip()
        cleaned = re.sub(r'^```(?:json)?', '', cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'```$', '', cleaned).strip()
        try:
            report = json.loads(cleaned)
        except Exception:
            report = {"raw_analysis": raw}
    except Exception as e:
        logger.error("AI learning report generation failed: %s", e)
        report = _fallback_analytics_report(analytics)

    report["data_source"] = analytics
    report["report_type"] = report_type
    report["generated_at"] = datetime.utcnow().isoformat()
    return report


def get_knowledge_mastery_heatmap(teacher_id: int, course_id: int) -> Dict:
    course = Course.query.filter_by(id=course_id, teacher_id=teacher_id).first()
    if not course:
        return {"error": "课程不存在或无权限"}

    mistakes = MistakeRecord.query.filter_by(course_id=course_id).all()
    submissions = ProgrammingSubmission.query.filter_by(course_id=course_id).all()

    knowledge_map = {}
    for m in mistakes:
        tags = []
        try:
            raw_tags = json.loads(m.knowledge_tags) if m.knowledge_tags else []
        except Exception:
            raw_tags = []
        for t in (raw_tags if isinstance(raw_tags, list) else [raw_tags]):
            if isinstance(t, dict):
                tag_str = str(t.get('name', t.get('label', t.get('tag', str(t)))))
            elif t is not None:
                tag_str = str(t).strip()
            else:
                continue
            if not tag_str:
                continue
            tags.append(tag_str)
        for tag in tags:
            if tag not in knowledge_map:
                knowledge_map[tag] = {"total_mistakes": 0, "unmastered": 0, "reviewing": 0, "mastered": 0}
            knowledge_map[tag]["total_mistakes"] += 1
            if m.mastery_status == 'unmastered':
                knowledge_map[tag]["unmastered"] += 1
            elif m.mastery_status == 'reviewing':
                knowledge_map[tag]["reviewing"] += 1
            elif m.mastery_status == 'mastered':
                knowledge_map[tag]["mastered"] += 1

    for s in submissions:
        question_data = {}
        try:
            assessment = Assessment.query.get(s.assessment_id)
            if assessment:
                questions = json.loads(assessment.questions) if assessment.questions else []
                if 0 <= s.question_index < len(questions):
                    question_data = questions[s.question_index]
        except Exception:
            pass
        raw_tags = question_data.get("knowledge_tags", [])
        safe_tags = []
        for t in (raw_tags if isinstance(raw_tags, list) else [raw_tags]):
            if isinstance(t, dict):
                tag_str = str(t.get('name', t.get('label', t.get('tag', str(t)))))
            elif t is not None:
                tag_str = str(t).strip()
            else:
                continue
            if tag_str:
                safe_tags.append(tag_str)
        for tag in safe_tags:
            if tag not in knowledge_map:
                knowledge_map[tag] = {"total_submissions": 0, "avg_score": 0, "scores": []}
            knowledge_map[tag].setdefault("total_submissions", 0)
            knowledge_map[tag].setdefault("scores", [])
            knowledge_map[tag]["total_submissions"] += 1
            knowledge_map[tag]["scores"].append(s.score or 0)

    heatmap = []
    for tag, data in knowledge_map.items():
        scores = data.get("scores", [])
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        mastery_rate = 0
        total = data.get("total_mistakes", 0)
        if total > 0:
            mastery_rate = round(data.get("mastered", 0) / total * 100, 1)
        heatmap.append({
            "knowledge_tag": tag,
            "mastery_rate": mastery_rate,
            "avg_programming_score": avg_score,
            "total_mistakes": data.get("total_mistakes", 0),
            "unmastered_count": data.get("unmastered", 0),
            "reviewing_count": data.get("reviewing", 0),
            "mastered_count": data.get("mastered", 0),
            "total_submissions": data.get("total_submissions", 0),
        })

    heatmap.sort(key=lambda x: x["mastery_rate"])
    return {"course_id": course_id, "course_title": course.title, "heatmap": heatmap}


def get_at_risk_students(teacher_id: int, threshold: float = 40.0) -> List[Dict]:
    courses = Course.query.filter_by(teacher_id=teacher_id).all()
    if not courses:
        return []
    course_ids = [c.id for c in courses]

    low_progress = LearningProgress.query.filter(
        LearningProgress.course_id.in_(course_ids),
        LearningProgress.progress_percentage < threshold,
    ).all()

    at_risk = []
    for lp in low_progress:
        user = User.query.get(lp.user_id)
        course = Course.query.get(lp.course_id)
        mistake_count = MistakeRecord.query.filter(
            MistakeRecord.user_id == lp.user_id,
            MistakeRecord.course_id == lp.course_id,
            MistakeRecord.mastery_status.in_(['unmastered', 'reviewing'])
        ).count()
        failed_submissions = ProgrammingSubmission.query.filter(
            ProgrammingSubmission.user_id == lp.user_id,
            ProgrammingSubmission.course_id == lp.course_id,
            ProgrammingSubmission.score < 60,
        ).count()

        risk_score = 0
        risk_score += (100 - (lp.progress_percentage or 0)) * 0.4
        risk_score += min(mistake_count * 5, 30)
        risk_score += min(failed_submissions * 8, 30)

        at_risk.append({
            "student_id": lp.user_id,
            "student_name": (user.real_name or user.username) if user else "未知",
            "course_id": lp.course_id,
            "course_title": course.title if course else "未知",
            "progress": lp.progress_percentage or 0,
            "unmastered_mistakes": mistake_count,
            "failed_submissions": failed_submissions,
            "risk_score": round(min(risk_score, 100), 1),
            "risk_level": "high" if risk_score >= 60 else "medium" if risk_score >= 30 else "low",
        })

    at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
    return at_risk


def _build_analytics_prompt(analytics: Dict, report_type: str) -> str:
    course_info = ""
    for c in analytics.get("course_analytics", []):
        course_info += f"\n- {c['course_title']}: {c['student_count']}名学生, 平均进度{c['avg_progress']}%, {c['assessment_count']}次考核, {c['mistake_count']}条错题"

    return f"""你是资深教育数据分析师。请基于以下学情数据生成分析报告。

总学生数：{analytics.get('total_students', 0)}
平均进度：{analytics.get('avg_progress', 0)}%
进度分布：优秀{analytics.get('progress_distribution', {}).get('excellent', 0)}人, 良好{analytics.get('progress_distribution', {}).get('good', 0)}人, 一般{analytics.get('progress_distribution', {}).get('average', 0)}人, 待提高{analytics.get('progress_distribution', {}).get('below_average', 0)}人, 不活跃{analytics.get('progress_distribution', {}).get('inactive', 0)}人

各课程详情：{course_info}

报告类型：{report_type}

请严格以JSON格式输出分析报告，包含以下字段：
{{
  "summary": "总体学情概述（2-3句话）",
  "key_findings": ["关键发现1", "关键发现2", "关键发现3"],
  "risk_warnings": ["风险预警1", "风险预警2"],
  "teaching_suggestions": ["教学建议1", "教学建议2", "教学建议3"],
  "resource_recommendations": ["资源建议1", "资源建议2"],
  "next_steps": ["下一步行动1", "下一步行动2"]
}}

只输出JSON，不要输出其他内容。"""


def _fallback_analytics_report(analytics: Dict) -> Dict:
    dist = analytics.get("progress_distribution", {})
    total = sum(dist.values()) or 1
    below = dist.get("below_average", 0) + dist.get("inactive", 0)
    return {
        "summary": f"共{analytics.get('total_students', 0)}名学生，平均进度{analytics.get('avg_progress', 0)}%，{below}名学生需要重点关注。",
        "key_findings": [
            f"优秀率{round(dist.get('excellent', 0) / total * 100, 1)}%",
            f"待提高学生占比{round(below / total * 100, 1)}%",
            "建议加强针对性辅导",
        ],
        "risk_warnings": ["部分学生进度滞后，存在掉队风险"],
        "teaching_suggestions": ["对进度滞后学生进行一对一辅导", "调整教学节奏，增加互动环节"],
        "resource_recommendations": ["补充基础练习资源", "提供进阶挑战题目"],
        "next_steps": ["制定分层教学计划", "安排学困生专项辅导"],
    }
