import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func

from src.models.course import (
    Achievement,
    Course,
    LearningProgress,
    MistakeRecord,
    PracticeEvaluation,
    StudyNote,
    UserAchievement,
)
from src.models.user import db

logger = logging.getLogger(__name__)

ACHIEVEMENT_DEFINITIONS = [
    {
        "code": "first_login",
        "name": "初来乍到",
        "description": "首次登录系统",
        "category": "learning_time",
        "icon": "LogIn",
        "level": 1,
        "condition_type": "login_count",
        "condition_value": 1,
        "points": 5,
    },
    {
        "code": "study_3_days",
        "name": "初学乍练",
        "description": "累计学习3天",
        "category": "learning_time",
        "icon": "Clock",
        "level": 1,
        "condition_type": "study_days",
        "condition_value": 3,
        "points": 10,
    },
    {
        "code": "study_7_days",
        "name": "勤学不辍",
        "description": "累计学习7天",
        "category": "learning_time",
        "icon": "Clock",
        "level": 2,
        "condition_type": "study_days",
        "condition_value": 7,
        "points": 20,
    },
    {
        "code": "study_30_days",
        "name": "学海无涯",
        "description": "累计学习30天",
        "category": "learning_time",
        "icon": "Clock",
        "level": 3,
        "condition_type": "study_days",
        "condition_value": 30,
        "points": 50,
    },
    {
        "code": "study_100_days",
        "name": "百日筑基",
        "description": "累计学习100天",
        "category": "learning_time",
        "icon": "Clock",
        "level": 4,
        "condition_type": "study_days",
        "condition_value": 100,
        "points": 100,
    },
    {
        "code": "streak_3",
        "name": "三日之约",
        "description": "连续学习3天",
        "category": "learning_time",
        "icon": "Flame",
        "level": 1,
        "condition_type": "study_streak",
        "condition_value": 3,
        "points": 15,
    },
    {
        "code": "streak_7",
        "name": "一周坚持",
        "description": "连续学习7天",
        "category": "learning_time",
        "icon": "Flame",
        "level": 2,
        "condition_type": "study_streak",
        "condition_value": 7,
        "points": 30,
    },
    {
        "code": "streak_30",
        "name": "月度达人",
        "description": "连续学习30天",
        "category": "learning_time",
        "icon": "Flame",
        "level": 3,
        "condition_type": "study_streak",
        "condition_value": 30,
        "points": 80,
    },
    {
        "code": "first_practice",
        "name": "初试锋芒",
        "description": "完成首次练习",
        "category": "practice",
        "icon": "Target",
        "level": 1,
        "condition_type": "practice_count",
        "condition_value": 1,
        "points": 5,
    },
    {
        "code": "practice_10",
        "name": "勤加练习",
        "description": "累计完成10次练习",
        "category": "practice",
        "icon": "Target",
        "level": 2,
        "condition_type": "practice_count",
        "condition_value": 10,
        "points": 20,
    },
    {
        "code": "practice_50",
        "name": "练习达人",
        "description": "累计完成50次练习",
        "category": "practice",
        "icon": "Target",
        "level": 3,
        "condition_type": "practice_count",
        "condition_value": 50,
        "points": 50,
    },
    {
        "code": "perfect_score",
        "name": "满分达人",
        "description": "获得一次满分",
        "category": "accuracy",
        "icon": "Star",
        "level": 2,
        "condition_type": "perfect_score_count",
        "condition_value": 1,
        "points": 25,
    },
    {
        "code": "accuracy_80",
        "name": "准确率高",
        "description": "累计正确率达到80%",
        "category": "accuracy",
        "icon": "TrendingUp",
        "level": 2,
        "condition_type": "accuracy_rate_80",
        "condition_value": 1,
        "points": 30,
    },
    {
        "code": "accuracy_95",
        "name": "精准射手",
        "description": "累计正确率达到95%",
        "category": "accuracy",
        "icon": "TrendingUp",
        "level": 3,
        "condition_type": "accuracy_rate_95",
        "condition_value": 1,
        "points": 60,
    },
    {
        "code": "first_mistake",
        "name": "知错能改",
        "description": "记录第一道错题",
        "category": "mistake",
        "icon": "BookX",
        "level": 1,
        "condition_type": "mistake_count",
        "condition_value": 1,
        "points": 5,
    },
    {
        "code": "master_5",
        "name": "错题克星",
        "description": "掌握5道错题",
        "category": "mistake",
        "icon": "CheckCircle",
        "level": 1,
        "condition_type": "mastered_count",
        "condition_value": 5,
        "points": 15,
    },
    {
        "code": "master_20",
        "name": "错题终结者",
        "description": "掌握20道错题",
        "category": "mistake",
        "icon": "CheckCircle",
        "level": 2,
        "condition_type": "mastered_count",
        "condition_value": 20,
        "points": 35,
    },
    {
        "code": "master_50",
        "name": "错题大师",
        "description": "掌握50道错题",
        "category": "mistake",
        "icon": "Shield",
        "level": 3,
        "condition_type": "mastered_count",
        "condition_value": 50,
        "points": 80,
    },
    {
        "code": "review_1",
        "name": "温故知新",
        "description": "完成首次错题复习",
        "category": "mistake",
        "icon": "RefreshCw",
        "level": 1,
        "condition_type": "review_count",
        "condition_value": 1,
        "points": 10,
    },
    {
        "code": "review_10",
        "name": "复习标兵",
        "description": "完成10次错题复习",
        "category": "mistake",
        "icon": "RefreshCw",
        "level": 2,
        "condition_type": "review_count",
        "condition_value": 10,
        "points": 30,
    },
    {
        "code": "note_1",
        "name": "笔记新手",
        "description": "创建第一篇笔记",
        "category": "knowledge",
        "icon": "FileText",
        "level": 1,
        "condition_type": "note_count",
        "condition_value": 1,
        "points": 5,
    },
    {
        "code": "note_10",
        "name": "笔记达人",
        "description": "创建10篇笔记",
        "category": "knowledge",
        "icon": "FileText",
        "level": 2,
        "condition_type": "note_count",
        "condition_value": 10,
        "points": 25,
    },
    {
        "code": "note_50",
        "name": "知识宝库",
        "description": "创建50篇笔记",
        "category": "knowledge",
        "icon": "FileText",
        "level": 3,
        "condition_type": "note_count",
        "condition_value": 50,
        "points": 60,
    },
    {
        "code": "enroll_1",
        "name": "启程",
        "description": "加入第一门课程",
        "category": "knowledge",
        "icon": "BookOpen",
        "level": 1,
        "condition_type": "course_count",
        "condition_value": 1,
        "points": 5,
    },
    {
        "code": "enroll_5",
        "name": "博学多才",
        "description": "加入5门课程",
        "category": "knowledge",
        "icon": "BookOpen",
        "level": 2,
        "condition_type": "course_count",
        "condition_value": 5,
        "points": 25,
    },
    {
        "code": "complete_course",
        "name": "课程毕业",
        "description": "完成一门课程",
        "category": "knowledge",
        "icon": "GraduationCap",
        "level": 2,
        "condition_type": "completed_courses",
        "condition_value": 1,
        "points": 40,
    },
]


def ensure_achievements_seeded():
    for defn in ACHIEVEMENT_DEFINITIONS:
        existing = Achievement.query.filter_by(code=defn["code"]).first()
        if not existing:
            achievement = Achievement(**defn)
            db.session.add(achievement)
    db.session.commit()


def get_user_stats(user_id: int) -> Dict:
    study_days = db.session.query(func.count(func.distinct(func.date(LearningProgress.last_accessed)))).filter(
        LearningProgress.user_id == user_id
    ).scalar() or 0

    practice_count = PracticeEvaluation.query.filter_by(user_id=user_id).count()

    perfect_scores = PracticeEvaluation.query.filter_by(user_id=user_id).filter(
        PracticeEvaluation.score == 100
    ).count()

    total_practices = PracticeEvaluation.query.filter_by(user_id=user_id).count()
    avg_score = 0
    if total_practices > 0:
        avg_score = db.session.query(func.avg(PracticeEvaluation.score)).filter(
            PracticeEvaluation.user_id == user_id
        ).scalar() or 0

    mistake_count = MistakeRecord.query.filter_by(user_id=user_id).count()
    mastered_count = MistakeRecord.query.filter_by(user_id=user_id, mastery_status="mastered").count()
    reviewing_count = MistakeRecord.query.filter_by(user_id=user_id, mastery_status="reviewing").count()

    note_count = StudyNote.query.filter_by(user_id=user_id).count()

    course_count = LearningProgress.query.filter_by(user_id=user_id).count()
    completed_courses = LearningProgress.query.filter_by(user_id=user_id).filter(
        LearningProgress.progress_percentage >= 100
    ).count()

    review_count = MistakeRecord.query.filter_by(user_id=user_id).filter(
        MistakeRecord.mastery_status.in_(["reviewing", "mastered"])
    ).count()

    login_dates = db.session.query(func.date(LearningProgress.last_accessed)).filter(
        LearningProgress.user_id == user_id
    ).distinct().order_by(func.date(LearningProgress.last_accessed).desc()).limit(100).all()

    login_date_list = sorted([str(row[0]) for row in login_dates])
    study_streak = _calc_streak(login_date_list)

    return {
        "study_days": study_days,
        "study_streak": study_streak,
        "practice_count": practice_count,
        "perfect_score_count": perfect_scores,
        "accuracy_rate_80": 1 if (total_practices > 0 and avg_score >= 80) else 0,
        "accuracy_rate_95": 1 if (total_practices > 0 and avg_score >= 95) else 0,
        "mistake_count": mistake_count,
        "mastered_count": mastered_count,
        "reviewing_count": reviewing_count,
        "review_count": review_count,
        "note_count": note_count,
        "course_count": course_count,
        "completed_courses": completed_courses,
        "login_count": max(1, study_days),
    }


def _calc_streak(date_list: List[str]) -> int:
    if not date_list:
        return 0
    from datetime import date as date_type
    today = date_type.today()
    streak = 0
    check_date = today
    date_set = set(date_list)
    while str(check_date) in date_set:
        streak += 1
        check_date = check_date - timedelta(days=1)
    return streak


def check_and_unlock(user_id: int) -> List[Dict]:
    stats = get_user_stats(user_id)
    unlocked = UserAchievement.query.filter_by(user_id=user_id).all()
    unlocked_codes = {ua.achievement.code for ua in unlocked if ua.achievement}

    newly_unlocked = []
    all_achievements = Achievement.query.filter_by(is_active=True).all()

    for ach in all_achievements:
        if ach.code in unlocked_codes:
            continue

        current_value = stats.get(ach.condition_type, 0)
        if current_value >= ach.condition_value:
            ua = UserAchievement(user_id=user_id, achievement_id=ach.id)
            db.session.add(ua)
            newly_unlocked.append(ach.to_dict(unlocked=True, unlocked_at=datetime.utcnow()))

    if newly_unlocked:
        db.session.commit()

    return newly_unlocked


def get_all_achievements_with_status(user_id: int) -> Dict:
    stats = get_user_stats(user_id)
    unlocked_list = UserAchievement.query.filter_by(user_id=user_id).all()
    unlocked_map = {ua.achievement_id: ua for ua in unlocked_list}

    all_achievements = Achievement.query.filter_by(is_active=True).order_by(
        Achievement.category, Achievement.level
    ).all()

    result = []
    total_points = 0
    unlocked_count = 0

    for ach in all_achievements:
        ua = unlocked_map.get(ach.id)
        is_unlocked = ua is not None
        current_value = stats.get(ach.condition_type, 0)

        if is_unlocked:
            total_points += ach.points
            unlocked_count += 1

        result.append({
            **ach.to_dict(unlocked=is_unlocked, unlocked_at=ua.unlocked_at if ua else None),
            "current_value": min(current_value, ach.condition_value),
            "progress": min(100, round(current_value / ach.condition_value * 100, 1)) if ach.condition_value > 0 else 0,
        })

    categories = {}
    for item in result:
        cat = item["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item)

    return {
        "achievements": result,
        "categories": categories,
        "total_count": len(all_achievements),
        "unlocked_count": unlocked_count,
        "total_points": total_points,
        "stats": stats,
    }


def get_unlocked_achievements(user_id: int) -> List[Dict]:
    unlocked = UserAchievement.query.filter_by(user_id=user_id).order_by(
        UserAchievement.unlocked_at.desc()
    ).all()
    return [ua.to_dict() for ua in unlocked]


def get_newly_unlocked(user_id: int) -> List[Dict]:
    unlocked = UserAchievement.query.filter_by(user_id=user_id, notified=False).all()
    result = []
    for ua in unlocked:
        ua.notified = True
        result.append(ua.to_dict())
    if result:
        db.session.commit()
    return result
