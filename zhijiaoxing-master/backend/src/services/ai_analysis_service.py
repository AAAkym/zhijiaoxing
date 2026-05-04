import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func, distinct, case

from src.models.user import db, User
from src.models.course import (
    Course, LearningProgress, PracticeEvaluation,
    Assessment, TeachingContent, MistakeRecord,
)
from src.models.ai_analysis import (
    AIAnalysisReport, AIInsight, AnalysisNotification, AnalysisAccessLog,
)
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)


def _mask_sensitive(data: dict) -> dict:
    masked = {}
    for k, v in data.items():
        if isinstance(v, dict):
            masked[k] = _mask_sensitive(v)
        elif isinstance(v, list):
            masked[k] = [_mask_sensitive(i) if isinstance(i, dict) else i for i in v]
        elif k in ('email', 'phone', 'name', 'username', 'real_name', 'password'):
            masked[k] = '***'
        else:
            masked[k] = v
    return masked


def _collect_weekly_metrics() -> Dict:
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    total_users = User.query.count()
    new_users_this_week = User.query.filter(User.created_at >= week_ago).count()
    new_users_last_week = User.query.filter(
        User.created_at >= two_weeks_ago, User.created_at < week_ago
    ).count()

    active_students = LearningProgress.query.filter(
        LearningProgress.last_accessed >= week_ago
    ).distinct(LearningProgress.user_id).count()

    total_courses = Course.query.count()
    active_courses = Course.query.filter_by(status='active').count()
    new_courses = Course.query.filter(Course.created_at >= week_ago).count()

    avg_progress = db.session.query(
        func.avg(LearningProgress.progress_percentage)
    ).scalar() or 0

    total_practices = PracticeEvaluation.query.filter(
        PracticeEvaluation.created_at >= week_ago
    ).count()

    total_mistakes = MistakeRecord.query.filter(
        MistakeRecord.created_at >= week_ago
    ).count()

    completion_rate = 0
    total_lp = LearningProgress.query.count()
    if total_lp > 0:
        completed = LearningProgress.query.filter(
            LearningProgress.progress_percentage >= 100
        ).count()
        completion_rate = round(completed / total_lp * 100, 1)

    user_growth_rate = 0
    if new_users_last_week > 0:
        user_growth_rate = round(
            (new_users_this_week - new_users_last_week) / new_users_last_week * 100, 1
        )

    return {
        'total_users': total_users,
        'new_users_this_week': new_users_this_week,
        'new_users_last_week': new_users_last_week,
        'user_growth_rate': user_growth_rate,
        'active_students': active_students,
        'total_courses': total_courses,
        'active_courses': active_courses,
        'new_courses': new_courses,
        'avg_progress': round(avg_progress, 1),
        'completion_rate': completion_rate,
        'total_practices': total_practices,
        'total_mistakes': total_mistakes,
        'period_start': week_ago.isoformat(),
        'period_end': now.isoformat(),
    }


def _collect_monthly_metrics() -> Dict:
    now = datetime.utcnow()
    month_ago = now - timedelta(days=30)
    two_months_ago = now - timedelta(days=60)

    weekly = _collect_weekly_metrics()

    monthly_new_users = User.query.filter(User.created_at >= month_ago).count()
    prev_month_new_users = User.query.filter(
        User.created_at >= two_months_ago, User.created_at < month_ago
    ).count()

    monthly_active = LearningProgress.query.filter(
        LearningProgress.last_accessed >= month_ago
    ).distinct(LearningProgress.user_id).count()

    course_engagement = db.session.query(
        Course.title,
        func.count(func.distinct(LearningProgress.user_id)).label('students'),
        func.avg(LearningProgress.progress_percentage).label('avg_progress'),
        func.count(LearningProgress.id).label('records'),
    ).outerjoin(LearningProgress).group_by(Course.id).all()

    course_data = []
    for c in course_engagement:
        course_data.append({
            'title': c.title,
            'students': c.students,
            'avg_progress': round(c.avg_progress or 0, 1),
            'records': c.records,
        })

    monthly_practices = PracticeEvaluation.query.filter(
        PracticeEvaluation.created_at >= month_ago
    ).count()

    monthly_mistakes = MistakeRecord.query.filter(
        MistakeRecord.created_at >= month_ago
    ).count()

    monthly_growth_rate = 0
    if prev_month_new_users > 0:
        monthly_growth_rate = round(
            (monthly_new_users - prev_month_new_users) / prev_month_new_users * 100, 1
        )

    weekly.update({
        'monthly_new_users': monthly_new_users,
        'prev_month_new_users': prev_month_new_users,
        'monthly_growth_rate': monthly_growth_rate,
        'monthly_active': monthly_active,
        'monthly_practices': monthly_practices,
        'monthly_mistakes': monthly_mistakes,
        'course_engagement': course_data,
    })
    return weekly


def _collect_quarterly_metrics() -> Dict:
    now = datetime.utcnow()
    quarter_ago = now - timedelta(days=90)
    prev_quarter = now - timedelta(days=180)

    monthly = _collect_monthly_metrics()

    quarterly_new_users = User.query.filter(User.created_at >= quarter_ago).count()
    prev_quarter_new_users = User.query.filter(
        User.created_at >= prev_quarter, User.created_at < quarter_ago
    ).count()

    total_content = TeachingContent.query.count()
    ai_content = TeachingContent.query.filter_by(generated_by_llm=True).count()
    total_assessments = Assessment.query.count()
    ai_assessments = Assessment.query.filter_by(generated_by_llm=True).count()

    quarterly_growth_rate = 0
    if prev_quarter_new_users > 0:
        quarterly_growth_rate = round(
            (quarterly_new_users - prev_quarter_new_users) / prev_quarter_new_users * 100, 1
        )

    monthly.update({
        'quarterly_new_users': quarterly_new_users,
        'prev_quarter_new_users': prev_quarter_new_users,
        'quarterly_growth_rate': quarterly_growth_rate,
        'total_content': total_content,
        'ai_content': ai_content,
        'ai_content_ratio': round(ai_content / total_content * 100, 1) if total_content > 0 else 0,
        'total_assessments': total_assessments,
        'ai_assessments': ai_assessments,
        'ai_assessment_ratio': round(ai_assessments / total_assessments * 100, 1) if total_assessments > 0 else 0,
    })
    return monthly


def _generate_ai_report(report_type: str, metrics: Dict) -> Dict:
    masked = _mask_sensitive(metrics)

    if report_type == 'weekly':
        prompt = f"""你是一位专业的教育数据分析专家。请根据以下平台周度运营数据，生成一份结构化的周报分析。

数据概览（已脱敏）：
{json.dumps(masked, ensure_ascii=False, indent=2)}

请按以下JSON格式输出分析结果（不要输出其他内容）：
{{
  "title": "周度分析报告标题",
  "summary": "200字以内的核心摘要",
  "key_metrics": [
    {{"name": "指标名称", "value": "指标值", "change": "变化趋势描述", "trend": "up/down/stable"}}
  ],
  "anomalies": [
    {{"metric": "异常指标", "description": "异常描述", "severity": "high/medium/low", "suggestion": "处理建议"}}
  ],
  "recommendations": [
    {{"area": "优化领域", "action": "具体行动", "priority": "high/medium/low", "expected_impact": "预期影响"}}
  ],
  "detailed_analysis": "详细的周度分析文本，包含关键业务指标的周期性变化追踪、异常数据识别及原因分析"
}}"""

    elif report_type == 'monthly':
        prompt = f"""你是一位专业的教育数据分析专家。请根据以下平台月度运营数据，生成一份深度月度分析报告。

数据概览（已脱敏）：
{json.dumps(masked, ensure_ascii=False, indent=2)}

请按以下JSON格式输出分析结果（不要输出其他内容）：
{{
  "title": "月度深度分析报告标题",
  "summary": "300字以内的核心摘要",
  "key_metrics": [
    {{"name": "指标名称", "value": "指标值", "change": "环比变化", "trend": "up/down/stable"}}
  ],
  "anomalies": [
    {{"metric": "异常指标", "description": "异常描述", "severity": "high/medium/low", "suggestion": "处理建议"}}
  ],
  "recommendations": [
    {{"area": "优化领域", "action": "具体行动", "priority": "high/medium/low", "expected_impact": "预期影响"}}
  ],
  "detailed_analysis": "详细的月度分析文本，包含多维度趋势分析、环比数据对比及基于数据的优化建议",
  "roi_analysis": "投入产出比分析文本，评估各模块的资源投入效率"
}}"""

    else:
        prompt = f"""你是一位专业的教育战略分析专家。请根据以下平台季度运营数据，生成一份季度战略分析报告。

数据概览（已脱敏）：
{json.dumps(masked, ensure_ascii=False, indent=2)}

请按以下JSON格式输出分析结果（不要输出其他内容）：
{{
  "title": "季度战略分析报告标题",
  "summary": "400字以内的核心摘要",
  "key_metrics": [
    {{"name": "指标名称", "value": "指标值", "change": "同比变化", "trend": "up/down/stable"}}
  ],
  "anomalies": [
    {{"metric": "异常指标", "description": "异常描述", "severity": "high/medium/low", "suggestion": "处理建议"}}
  ],
  "recommendations": [
    {{"area": "优化领域", "action": "具体行动", "priority": "high/medium/low", "expected_impact": "预期影响"}}
  ],
  "detailed_analysis": "详细的季度分析文本，包含战略调整建议",
  "roi_analysis": "投入产出比(ROI)分析文本，量化各模块的投入产出效率",
  "resource_optimization": "资源分配优化方案文本，提供最优资源配置建议"
}}"""

    try:
        response = spark_service.chat([
            {"role": "system", "content": "你是一位专业的教育数据分析专家，擅长从数据中发现规律、识别异常、提供决策建议。请始终以JSON格式输出。"},
            {"role": "user", "content": prompt},
        ])

        cleaned = response.strip()
        if cleaned.startswith('```'):
            lines = cleaned.split('\n')
            cleaned = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])

        result = json.loads(cleaned)
        return result
    except Exception as e:
        logger.error(f"AI report generation failed: {e}")
        return {
            'title': f'{report_type}分析报告（AI生成失败，使用基础模板）',
            'summary': f'基于平台{report_type}数据的自动分析报告。AI分析暂时不可用，显示基础数据摘要。',
            'key_metrics': [],
            'anomalies': [],
            'recommendations': [],
            'detailed_analysis': f'本期关键指标：总用户{metrics.get("total_users", 0)}，新增用户{metrics.get("new_users_this_week", metrics.get("monthly_new_users", 0))}，平均进度{metrics.get("avg_progress", 0)}%。',
            'roi_analysis': '',
            'resource_optimization': '',
        }


def generate_report(report_type: str, admin_id: int) -> Dict:
    now = datetime.utcnow()

    if report_type == 'weekly':
        period_start = now - timedelta(days=7)
        metrics = _collect_weekly_metrics()
    elif report_type == 'monthly':
        period_start = now - timedelta(days=30)
        metrics = _collect_monthly_metrics()
    elif report_type == 'quarterly':
        period_start = now - timedelta(days=90)
        metrics = _collect_quarterly_metrics()
    else:
        return {"error": "Invalid report type. Use: weekly, monthly, quarterly"}

    ai_result = _generate_ai_report(report_type, metrics)

    report = AIAnalysisReport(
        report_type=report_type,
        title=ai_result.get('title', f'{report_type}分析报告'),
        period_start=period_start,
        period_end=now,
        summary=ai_result.get('summary', ''),
        key_metrics=json.dumps(ai_result.get('key_metrics', []), ensure_ascii=False),
        anomalies=json.dumps(ai_result.get('anomalies', []), ensure_ascii=False),
        recommendations=json.dumps(ai_result.get('recommendations', []), ensure_ascii=False),
        detailed_analysis=ai_result.get('detailed_analysis', ''),
        roi_analysis=ai_result.get('roi_analysis', ''),
        resource_optimization=ai_result.get('resource_optimization', ''),
        status='generated',
        generated_by='ai',
    )
    db.session.add(report)
    db.session.commit()

    return report.to_dict(include_detail=True)


def get_reports(report_type: str = None, limit: int = 20) -> List[Dict]:
    query = AIAnalysisReport.query
    if report_type:
        query = query.filter_by(report_type=report_type)
    query = query.order_by(AIAnalysisReport.created_at.desc())
    reports = query.limit(limit).all()
    return [r.to_dict() for r in reports]


def get_report_detail(report_id: int) -> Optional[Dict]:
    report = AIAnalysisReport.query.get(report_id)
    if not report:
        return None
    return report.to_dict(include_detail=True)


def _predict_churn_risk() -> List[Dict]:
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    month_ago = now - timedelta(days=30)

    students = User.query.filter_by(role='student').all()
    insights = []

    for student in students:
        recent_progress = LearningProgress.query.filter(
            LearningProgress.user_id == student.id,
            LearningProgress.last_accessed >= week_ago,
        ).count()

        prev_progress = LearningProgress.query.filter(
            LearningProgress.user_id == student.id,
            LearningProgress.last_accessed >= two_weeks_ago,
            LearningProgress.last_accessed < week_ago,
        ).count()

        month_progress = LearningProgress.query.filter(
            LearningProgress.user_id == student.id,
            LearningProgress.last_accessed >= month_ago,
        ).count()

        recent_practices = PracticeEvaluation.query.filter(
            PracticeEvaluation.user_id == student.id,
            PracticeEvaluation.created_at >= week_ago,
        ).count()

        if recent_progress == 0 and month_progress > 0:
            risk_level = 'high'
            confidence = 0.85
        elif recent_progress == 0 and prev_progress > 0:
            risk_level = 'high'
            confidence = 0.78
        elif recent_progress < prev_progress * 0.3 and prev_progress > 0:
            risk_level = 'medium'
            confidence = 0.65
        elif recent_progress < prev_progress * 0.6 and prev_progress > 0:
            risk_level = 'low'
            confidence = 0.50
        else:
            continue

        insights.append({
            'user_id_hash': hash(str(student.id)) % 10000,
            'risk_level': risk_level,
            'confidence': confidence,
            'recent_activity': recent_progress,
            'prev_activity': prev_progress,
            'recent_practices': recent_practices,
            'trend': 'declining' if recent_progress < prev_progress else 'stable',
        })

    return insights


def _analyze_content_trends() -> List[Dict]:
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    courses = Course.query.filter_by(status='active').all()
    trends = []

    for course in courses:
        recent_students = LearningProgress.query.filter(
            LearningProgress.course_id == course.id,
            LearningProgress.last_accessed >= week_ago,
        ).count()

        monthly_students = LearningProgress.query.filter(
            LearningProgress.course_id == course.id,
            LearningProgress.last_accessed >= month_ago,
        ).count()

        avg_progress = db.session.query(
            func.avg(LearningProgress.progress_percentage)
        ).filter(
            LearningProgress.course_id == course.id,
            LearningProgress.last_accessed >= month_ago,
        ).scalar() or 0

        recent_practices = PracticeEvaluation.query.join(
            Assessment, PracticeEvaluation.assessment_id == Assessment.id
        ).filter(
            Assessment.course_id == course.id,
            PracticeEvaluation.created_at >= week_ago,
        ).count()

        heat_score = recent_students * 2 + recent_practices * 1.5 + avg_progress * 0.1

        trend_direction = 'rising' if recent_students > monthly_students * 0.35 else (
            'stable' if recent_students > monthly_students * 0.2 else 'declining'
        )

        trends.append({
            'course_id': course.id,
            'course_title': course.title,
            'heat_score': round(heat_score, 1),
            'recent_students': recent_students,
            'monthly_students': monthly_students,
            'avg_progress': round(avg_progress, 1),
            'trend': trend_direction,
        })

    trends.sort(key=lambda x: x['heat_score'], reverse=True)
    return trends[:20]


def _analyze_teaching_attribution() -> Dict:
    now = datetime.utcnow()
    month_ago = now - timedelta(days=30)

    courses = Course.query.filter_by(status='active').limit(20).all()
    course_factors = []

    for course in courses:
        enrolled = LearningProgress.query.filter(
            LearningProgress.course_id == course.id,
        ).count()

        avg_progress = db.session.query(
            func.avg(LearningProgress.progress_percentage)
        ).filter(LearningProgress.course_id == course.id).scalar() or 0

        content_count = TeachingContent.query.filter_by(course_id=course.id).count()
        ai_content_count = TeachingContent.query.filter_by(
            course_id=course.id, generated_by_llm=True,
        ).count()

        assessment_count = Assessment.query.filter_by(course_id=course.id).count()

        practice_count = PracticeEvaluation.query.join(
            Assessment, PracticeEvaluation.assessment_id == Assessment.id
        ).filter(
            Assessment.course_id == course.id,
            PracticeEvaluation.created_at >= month_ago,
        ).count()

        completion = LearningProgress.query.filter(
            LearningProgress.course_id == course.id,
            LearningProgress.progress_percentage >= 100,
        ).count()

        completion_rate = round(completion / enrolled * 100, 1) if enrolled > 0 else 0

        course_factors.append({
            'course_id': course.id,
            'course_title': course.title,
            'enrolled': enrolled,
            'avg_progress': round(avg_progress, 1),
            'completion_rate': completion_rate,
            'content_count': content_count,
            'ai_content_ratio': round(ai_content_count / content_count * 100, 1) if content_count > 0 else 0,
            'assessment_count': assessment_count,
            'practice_count': practice_count,
        })

    try:
        factors_prompt = f"""基于以下课程数据，分析各教学环节对学习成果的影响权重：

{json.dumps(_mask_sensitive({'courses': course_factors}), ensure_ascii=False, indent=2)}

请以JSON格式输出各因素权重分析：
{{
  "factors": [
    {{"name": "因素名称", "weight": 0.0, "description": "影响描述", "correlation": "positive/negative/neutral"}}
  ],
  "summary": "整体归因分析摘要",
  "recommendations": ["优化建议1", "优化建议2"]
}}"""

        response = spark_service.chat([
            {"role": "system", "content": "你是教学效果分析专家，擅长量化分析各教学环节对学习成果的影响。请以JSON格式输出。"},
            {"role": "user", "content": factors_prompt},
        ])

        cleaned = response.strip()
        if cleaned.startswith('```'):
            lines = cleaned.split('\n')
            cleaned = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])

        attribution = json.loads(cleaned)
    except Exception as e:
        logger.error(f"Teaching attribution AI analysis failed: {e}")
        attribution = {
            'factors': [
                {'name': '教学内容丰富度', 'weight': 0.30, 'description': '教学内容数量与质量对学习进度的正向影响', 'correlation': 'positive'},
                {'name': 'AI内容占比', 'weight': 0.20, 'description': 'AI生成内容对学习效果的辅助作用', 'correlation': 'positive'},
                {'name': '练习频次', 'weight': 0.25, 'description': '课后练习对知识掌握的巩固作用', 'correlation': 'positive'},
                {'name': '考核评估', 'weight': 0.15, 'description': '定期考核对学习动力的促进作用', 'correlation': 'positive'},
                {'name': '互动参与度', 'weight': 0.10, 'description': '课堂互动对学习积极性的影响', 'correlation': 'positive'},
            ],
            'summary': '教学内容丰富度和练习频次是影响学习成果的最重要因素。',
            'recommendations': ['增加教学内容供给', '提升AI内容质量', '加强课后练习设计'],
        }

    return {
        'course_data': course_factors,
        'attribution': attribution,
    }


def _optimize_resources() -> Dict:
    now = datetime.utcnow()
    month_ago = now - timedelta(days=30)

    total_content = TeachingContent.query.count()
    ai_content = TeachingContent.query.filter_by(generated_by_llm=True).count()
    total_assessments = Assessment.query.count()
    ai_assessments = Assessment.query.filter_by(generated_by_llm=True).count()

    course_stats = db.session.query(
        Course.id, Course.title,
        func.count(func.distinct(LearningProgress.user_id)).label('students'),
        func.avg(LearningProgress.progress_percentage).label('progress'),
    ).outerjoin(LearningProgress).group_by(Course.id).all()

    resource_data = []
    for cs in course_stats:
        content_count = TeachingContent.query.filter_by(course_id=cs.id).count()
        assessment_count = Assessment.query.filter_by(course_id=cs.id).count()
        practice_count = PracticeEvaluation.query.join(
            Assessment, PracticeEvaluation.assessment_id == Assessment.id
        ).filter(
            Assessment.course_id == cs.id,
            PracticeEvaluation.created_at >= month_ago,
        ).count()

        roi = round(cs.progress * cs.students / max(content_count + assessment_count, 1), 2) if cs.students > 0 else 0

        resource_data.append({
            'course_id': cs.id,
            'course_title': cs.title,
            'students': cs.students,
            'avg_progress': round(cs.progress or 0, 1),
            'content_count': content_count,
            'assessment_count': assessment_count,
            'practice_count': practice_count,
            'roi': roi,
        })

    resource_data.sort(key=lambda x: x['roi'], reverse=True)

    try:
        opt_prompt = f"""基于以下平台资源投入数据，提供资源分配优化建议：

总体数据：总教学内容{total_content}个（AI生成{ai_content}个），总考核{total_assessments}个（AI生成{ai_assessments}个）

各课程资源投入与产出：
{json.dumps(_mask_sensitive({'resources': resource_data[:15]}), ensure_ascii=False, indent=2)}

请以JSON格式输出优化建议：
{{
  "current_efficiency": "当前资源利用效率评估",
  "optimization_plan": [
    {{"area": "优化领域", "current": "当前状态", "suggested": "建议调整", "expected_roi_change": "预期ROI变化", "priority": "high/medium/low"}}
  ],
  "resource_reallocation": "资源重新分配建议文本",
  "ai_automation_suggestions": ["AI自动化建议1", "AI自动化建议2"]
}}"""

        response = spark_service.chat([
            {"role": "system", "content": "你是教育资源配置优化专家，擅长基于数据分析提供最优资源配置方案。请以JSON格式输出。"},
            {"role": "user", "content": opt_prompt},
        ])

        cleaned = response.strip()
        if cleaned.startswith('```'):
            lines = cleaned.split('\n')
            cleaned = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])

        optimization = json.loads(cleaned)
    except Exception as e:
        logger.error(f"Resource optimization AI analysis failed: {e}")
        optimization = {
            'current_efficiency': '资源利用效率中等，部分课程投入产出比偏低',
            'optimization_plan': [
                {'area': '低ROI课程内容', 'current': '内容冗余', 'suggested': '精简优化', 'expected_roi_change': '+15%', 'priority': 'high'},
                {'area': 'AI内容生成', 'current': f'{round(ai_content/total_content*100,1) if total_content else 0}%AI占比', 'suggested': '提升至60%', 'expected_roi_change': '+20%', 'priority': 'medium'},
            ],
            'resource_reallocation': '建议将低ROI课程的资源向高ROI课程倾斜，同时扩大AI自动化生成比例。',
            'ai_automation_suggestions': ['扩大AI教学内容自动生成范围', '增加AI自动出题比例'],
        }

    return {
        'summary': {
            'total_content': total_content,
            'ai_content': ai_content,
            'ai_content_ratio': round(ai_content / total_content * 100, 1) if total_content > 0 else 0,
            'total_assessments': total_assessments,
            'ai_assessments': ai_assessments,
            'ai_assessment_ratio': round(ai_assessments / total_assessments * 100, 1) if total_assessments > 0 else 0,
        },
        'course_resources': resource_data[:20],
        'optimization': optimization,
    }


def generate_insight(insight_type: str, admin_id: int) -> Dict:
    now = datetime.utcnow()

    if insight_type == 'churn_prediction':
        raw_data = _predict_churn_risk()
        title = '用户流失风险预警'
        risk_levels = {'high': 0, 'medium': 0, 'low': 0}
        for item in raw_data:
            risk_levels[item['risk_level']] = risk_levels.get(item['risk_level'], 0) + 1

        high_risk = [i for i in raw_data if i['risk_level'] == 'high']

        insight = AIInsight(
            insight_type='churn_prediction',
            title=title,
            description=f'检测到{len(raw_data)}名用户存在流失风险，其中高风险{risk_levels["high"]}人，中风险{risk_levels["medium"]}人，低风险{risk_levels["low"]}人。',
            risk_level='high' if risk_levels['high'] > 5 else ('medium' if risk_levels['high'] > 0 else 'low'),
            confidence=0.78 if high_risk else 0.60,
            affected_count=len(raw_data),
            metrics_data=json.dumps({
                'risk_distribution': risk_levels,
                'high_risk_sample': high_risk[:5],
            }, ensure_ascii=False),
            recommendations=json.dumps([
                {'action': '发送个性化学习推荐', 'target': 'high_risk', 'priority': 'high'},
                {'action': '推送学习激励通知', 'target': 'medium_risk', 'priority': 'medium'},
                {'action': '教师主动关怀', 'target': 'high_risk', 'priority': 'high'},
            ], ensure_ascii=False),
            valid_until=now + timedelta(days=7),
        )

    elif insight_type == 'content_trend':
        raw_data = _analyze_content_trends()
        rising = [i for i in raw_data if i['trend'] == 'rising']
        declining = [i for i in raw_data if i['trend'] == 'declining']

        insight = AIInsight(
            insight_type='content_trend',
            title='热门内容趋势分析',
            description=f'分析{len(raw_data)}门课程内容热度，{len(rising)}门上升趋势，{len(declining)}门下降趋势。',
            risk_level='low',
            confidence=0.72,
            affected_count=len(raw_data),
            metrics_data=json.dumps({
                'rising_courses': rising[:5],
                'declining_courses': declining[:5],
                'top_courses': raw_data[:5],
            }, ensure_ascii=False),
            recommendations=json.dumps([
                {'action': '增加热门课程内容供给', 'target': 'rising_courses', 'priority': 'high'},
                {'action': '优化下降课程内容质量', 'target': 'declining_courses', 'priority': 'medium'},
                {'action': '推广高热度课程', 'target': 'top_courses', 'priority': 'medium'},
            ], ensure_ascii=False),
            valid_until=now + timedelta(days=7),
        )

    elif insight_type == 'teaching_attribution':
        result = _analyze_teaching_attribution()
        factors = result.get('attribution', {}).get('factors', [])

        insight = AIInsight(
            insight_type='teaching_attribution',
            title='教学效果归因分析',
            description=result.get('attribution', {}).get('summary', '教学效果影响因素分析完成。'),
            risk_level='low',
            confidence=0.70,
            affected_count=len(result.get('course_data', [])),
            metrics_data=json.dumps({
                'factors': factors,
                'course_count': len(result.get('course_data', [])),
            }, ensure_ascii=False),
            recommendations=json.dumps([
                {'action': r, 'priority': 'medium'} for r in result.get('attribution', {}).get('recommendations', [])
            ], ensure_ascii=False),
            valid_until=now + timedelta(days=14),
        )

    elif insight_type == 'resource_optimization':
        result = _optimize_resources()
        opt = result.get('optimization', {})

        insight = AIInsight(
            insight_type='resource_optimization',
            title='资源投入优化建议',
            description=opt.get('current_efficiency', '资源投入产出分析完成。'),
            risk_level='medium',
            confidence=0.68,
            affected_count=len(result.get('course_resources', [])),
            metrics_data=json.dumps({
                'summary': result.get('summary', {}),
                'top_roi_courses': result.get('course_resources', [])[:5],
            }, ensure_ascii=False),
            recommendations=json.dumps([
                {'action': r, 'priority': 'medium'} for r in opt.get('ai_automation_suggestions', [])
            ], ensure_ascii=False),
            valid_until=now + timedelta(days=14),
        )

    else:
        return {"error": "Invalid insight type. Use: churn_prediction, content_trend, teaching_attribution, resource_optimization"}

    db.session.add(insight)
    db.session.commit()

    return insight.to_dict()


def get_insights(insight_type: str = None, status: str = None, limit: int = 20) -> List[Dict]:
    query = AIInsight.query
    if insight_type:
        query = query.filter_by(insight_type=insight_type)
    if status:
        query = query.filter_by(status=status)
    query = query.order_by(AIInsight.created_at.desc())
    insights = query.limit(limit).all()
    return [i.to_dict() for i in insights]


def get_insight_detail(insight_id: int) -> Optional[Dict]:
    insight = AIInsight.query.get(insight_id)
    if not insight:
        return None
    return insight.to_dict()


def dismiss_insight(insight_id: int) -> Optional[Dict]:
    insight = AIInsight.query.get(insight_id)
    if not insight:
        return None
    insight.status = 'dismissed'
    insight.updated_at = datetime.utcnow()
    db.session.commit()
    return insight.to_dict()


def create_notification(user_id: int, notification_type: str, title: str,
                        content: str, related_id: int = None,
                        related_type: str = None, channel: str = 'system') -> Dict:
    notification = AnalysisNotification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        content=content,
        related_id=related_id,
        related_type=related_type,
        channel=channel,
    )
    db.session.add(notification)
    db.session.commit()
    return notification.to_dict()


def get_notifications(user_id: int, unread_only: bool = False, limit: int = 50) -> List[Dict]:
    query = AnalysisNotification.query.filter_by(user_id=user_id)
    if unread_only:
        query = query.filter_by(is_read=False)
    query = query.order_by(AnalysisNotification.created_at.desc())
    notifications = query.limit(limit).all()
    return [n.to_dict() for n in notifications]


def mark_notification_read(notification_id: int, user_id: int) -> Optional[Dict]:
    notification = AnalysisNotification.query.filter_by(
        id=notification_id, user_id=user_id
    ).first()
    if not notification:
        return None
    notification.is_read = True
    db.session.commit()
    return notification.to_dict()


def mark_all_notifications_read(user_id: int) -> int:
    count = AnalysisNotification.query.filter_by(
        user_id=user_id, is_read=False
    ).update({'is_read': True})
    db.session.commit()
    return count


def log_access(user_id: int, resource_type: str, resource_id: int,
               access_level: str, ip_address: str = None) -> Dict:
    log_entry = AnalysisAccessLog(
        user_id=user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        access_level=access_level,
        ip_address=ip_address,
    )
    db.session.add(log_entry)
    db.session.commit()
    return log_entry.to_dict()


def get_dashboard_summary(admin_id: int) -> Dict:
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)

    total_reports = AIAnalysisReport.query.count()
    recent_reports = AIAnalysisReport.query.filter(
        AIAnalysisReport.created_at >= week_ago
    ).count()

    active_insights = AIInsight.query.filter_by(status='active').count()
    high_risk_insights = AIInsight.query.filter(
        AIInsight.status == 'active',
        AIInsight.risk_level.in_(['high', 'medium']),
    ).count()

    unread_notifications = AnalysisNotification.query.filter_by(
        user_id=admin_id, is_read=False,
    ).count()

    latest_report = AIAnalysisReport.query.order_by(
        AIAnalysisReport.created_at.desc()
    ).first()

    latest_insights = AIInsight.query.filter_by(status='active').order_by(
        AIInsight.created_at.desc()
    ).limit(5).all()

    churn_insight = AIInsight.query.filter_by(
        insight_type='churn_prediction', status='active',
    ).order_by(AIInsight.created_at.desc()).first()

    return {
        'total_reports': total_reports,
        'recent_reports': recent_reports,
        'active_insights': active_insights,
        'high_risk_insights': high_risk_insights,
        'unread_notifications': unread_notifications,
        'latest_report': latest_report.to_dict() if latest_report else None,
        'latest_insights': [i.to_dict() for i in latest_insights],
        'churn_summary': json.loads(churn_insight.metrics_data).get('risk_distribution', {}) if churn_insight and churn_insight.metrics_data else {},
    }


def custom_analysis(dimensions: list, metrics: list, time_range: str = '7days',
                    admin_id: int = None) -> Dict:
    now = datetime.utcnow()
    days_map = {'7days': 7, '30days': 30, '90days': 90, '1year': 365}
    days = days_map.get(time_range, 7)
    start_date = now - timedelta(days=days)

    result = {'dimensions': dimensions, 'metrics': {}, 'time_range': time_range}

    if 'users' in dimensions:
        total = User.query.count()
        new_users = User.query.filter(User.created_at >= start_date).count()
        by_role = db.session.query(
            User.role, func.count(User.id)
        ).group_by(User.role).all()
        result['metrics']['users'] = {
            'total': total,
            'new': new_users,
            'by_role': {r: c for r, c in by_role},
        }

    if 'courses' in dimensions:
        total = Course.query.count()
        active = Course.query.filter_by(status='active').count()
        new_courses = Course.query.filter(Course.created_at >= start_date).count()
        result['metrics']['courses'] = {
            'total': total,
            'active': active,
            'new': new_courses,
        }

    if 'learning' in dimensions:
        total_records = LearningProgress.query.count()
        recent_records = LearningProgress.query.filter(
            LearningProgress.last_accessed >= start_date
        ).count()
        avg_progress = db.session.query(
            func.avg(LearningProgress.progress_percentage)
        ).scalar() or 0
        result['metrics']['learning'] = {
            'total_records': total_records,
            'recent_records': recent_records,
            'avg_progress': round(avg_progress, 1),
        }

    if 'content' in dimensions:
        total_content = TeachingContent.query.count()
        ai_content = TeachingContent.query.filter_by(generated_by_llm=True).count()
        total_assessments = Assessment.query.count()
        result['metrics']['content'] = {
            'total_content': total_content,
            'ai_content': ai_content,
            'total_assessments': total_assessments,
        }

    if 'practice' in dimensions:
        total = PracticeEvaluation.query.count()
        recent = PracticeEvaluation.query.filter(
            PracticeEvaluation.created_at >= start_date
        ).count()
        result['metrics']['practice'] = {
            'total': total,
            'recent': recent,
        }

    return result
