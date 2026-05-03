import json
import logging
import hashlib
from datetime import datetime
from typing import Dict, List, Optional

from src.models.user import db
from src.models.course import (
    Course, TeachingContent, Assessment, MistakeRecord,
    PracticeEvaluation, ProgrammingSubmission, AIFeedback,
)
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)


def collect_training_data(teacher_id: int = None, limit: int = 500) -> Dict:
    query = AIFeedback.query
    if teacher_id:
        configs = []
        feedbacks = query.limit(limit).all()
    else:
        feedbacks = query.limit(limit).all()

    training_samples = []
    for fb in feedbacks:
        sample = {
            "id": fb.id,
            "original_content": fb.original_content or "",
            "modified_content": fb.modified_content or "",
            "modification_type": fb.modification_type or "",
            "feedback_text": fb.feedback_text or "",
            "created_at": fb.created_at.isoformat() if fb.created_at else None,
        }
        if fb.original_content and fb.modified_content:
            sample["quality_signal"] = _compute_quality_signal(
                fb.original_content, fb.modified_content, fb.feedback_text
            )
            training_samples.append(sample)

    return {
        "total_samples": len(training_samples),
        "samples": training_samples[:100],
        "quality_distribution": _analyze_quality_distribution(training_samples),
    }


def evaluate_ai_output_quality(content_type: str = "all", sample_size: int = 50) -> Dict:
    results = {}

    if content_type in ("all", "teaching_content"):
        contents = TeachingContent.query.filter_by(generated_by_llm=True).limit(sample_size).all()
        content_scores = []
        for tc in contents:
            score = _evaluate_content_quality(tc.content or "")
            content_scores.append({"id": tc.id, "title": tc.title, "quality_score": score})
        results["teaching_content"] = {
            "count": len(content_scores),
            "avg_score": round(sum(s["quality_score"] for s in content_scores) / len(content_scores), 2) if content_scores else 0,
            "samples": content_scores[:10],
        }

    if content_type in ("all", "assessment"):
        assessments = Assessment.query.filter_by(generated_by_llm=True).limit(sample_size).all()
        assessment_scores = []
        for a in assessments:
            questions = []
            try:
                questions = json.loads(a.questions) if a.questions else []
            except Exception:
                pass
            score = _evaluate_assessment_quality(questions)
            assessment_scores.append({"id": a.id, "title": a.title, "quality_score": score, "question_count": len(questions)})
        results["assessment"] = {
            "count": len(assessment_scores),
            "avg_score": round(sum(s["quality_score"] for s in assessment_scores) / len(assessment_scores), 2) if assessment_scores else 0,
            "samples": assessment_scores[:10],
        }

    if content_type in ("all", "mistake_analysis"):
        mistakes = MistakeRecord.query.filter(MistakeRecord.ai_analysis.isnot(None)).limit(sample_size).all()
        analysis_scores = []
        for m in mistakes:
            score = _evaluate_analysis_quality(m.ai_analysis or "")
            analysis_scores.append({"id": m.id, "quality_score": score})
        results["mistake_analysis"] = {
            "count": len(analysis_scores),
            "avg_score": round(sum(s["quality_score"] for s in analysis_scores) / len(analysis_scores), 2) if analysis_scores else 0,
        }

    return results


def optimize_ai_prompt(prompt_type: str, current_issues: List[str] = None) -> Dict:
    issues = current_issues or ["内容重复", "深度不足", "格式不规范"]

    optimization_prompt = f"""你是AI提示词优化专家。请分析以下AI生成内容的常见问题，并给出优化后的提示词建议。

内容类型：{prompt_type}
常见问题：{', '.join(issues)}

请以JSON格式输出优化建议：
{{
  "identified_issues": ["问题1", "问题2"],
  "optimized_prompt_additions": ["提示词补充1", "提示词补充2"],
  "quality_check_rules": ["质量检查规则1", "质量检查规则2"],
  "expected_improvements": ["预期改进1", "预期改进2"]
}}

只输出JSON。"""

    try:
        raw = spark_service.chat(optimization_prompt)
        import re
        cleaned = re.sub(r'^```(?:json)?', '', raw.strip(), flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'```$', '', cleaned).strip()
        result = json.loads(cleaned)
        result["prompt_type"] = prompt_type
        result["optimized_at"] = datetime.utcnow().isoformat()
        return result
    except Exception as e:
        logger.error("AI prompt optimization failed: %s", e)
        return {
            "prompt_type": prompt_type,
            "identified_issues": issues,
            "optimized_prompt_additions": ["增加输出格式约束", "要求内容多样性", "添加质量自检环节"],
            "quality_check_rules": ["检查输出格式是否正确", "检查内容是否有重复", "检查深度是否足够"],
            "expected_improvements": ["减少重复内容", "提升内容深度", "规范输出格式"],
        }


def get_ai_usage_stats(teacher_id: int = None) -> Dict:
    total_content = TeachingContent.query.filter_by(generated_by_llm=True)
    total_assessments = Assessment.query.filter_by(generated_by_llm=True)
    total_mistake_analysis = MistakeRecord.query.filter(MistakeRecord.ai_analysis.isnot(None))
    total_programming = ProgrammingSubmission.query.filter(ProgrammingSubmission.ai_feedback.isnot(None))

    if teacher_id:
        course_ids = [c.id for c in Course.query.filter_by(teacher_id=teacher_id).all()]
        total_content = total_content.filter(TeachingContent.course_id.in_(course_ids))
        total_assessments = total_assessments.filter(Assessment.course_id.in_(course_ids))
        total_mistake_analysis = total_mistake_analysis.filter(MistakeRecord.course_id.in_(course_ids))
        total_programming = total_programming.filter(ProgrammingSubmission.course_id.in_(course_ids))

    feedback_count = AIFeedback.query.count()

    return {
        "generated_content_count": total_content.count(),
        "generated_assessment_count": total_assessments.count(),
        "mistake_analysis_count": total_mistake_analysis.count(),
        "programming_feedback_count": total_programming.count(),
        "user_feedback_count": feedback_count,
        "feedback_rate": round(feedback_count / max(total_content.count() + total_assessments.count(), 1) * 100, 1),
    }


def _compute_quality_signal(original: str, modified: str, feedback: str) -> str:
    if not original or not modified:
        return "neutral"
    orig_len = len(original)
    mod_len = len(modified)
    if mod_len < orig_len * 0.5:
        return "negative"
    if mod_len > orig_len * 1.5:
        return "positive_expansion"
    if feedback and any(w in feedback for w in ["好", "满意", "优秀", "不错"]):
        return "positive"
    if feedback and any(w in feedback for w in ["差", "不满意", "错误", "不好"]):
        return "negative"
    return "neutral"


def _analyze_quality_distribution(samples: List[Dict]) -> Dict:
    dist = {"positive": 0, "positive_expansion": 0, "neutral": 0, "negative": 0}
    for s in samples:
        signal = s.get("quality_signal", "neutral")
        dist[signal] = dist.get(signal, 0) + 1
    return dist


def _evaluate_content_quality(content: str) -> float:
    if not content:
        return 0.0
    score = 50.0
    if len(content) > 200:
        score += 10
    if len(content) > 500:
        score += 10
    if any(kw in content for kw in ["概念", "原理", "方法", "步骤"]):
        score += 10
    if any(kw in content for kw in ["示例", "例子", "例如"]):
        score += 5
    if any(kw in content for kw in ["注意", "误区", "常见错误"]):
        score += 5
    if content.count("\n") > 5:
        score += 5
    if any(kw in content for kw in ["总结", "归纳", "要点"]):
        score += 5
    return min(round(score, 1), 100.0)


def _evaluate_assessment_quality(questions: List) -> float:
    if not questions:
        return 0.0
    score = 40.0
    score += min(len(questions) * 5, 20)
    has_explanation = sum(1 for q in questions if isinstance(q, dict) and q.get("explanation"))
    score += min(has_explanation * 5, 15)
    has_variety = len(set(q.get("type", "choice") for q in questions if isinstance(q, dict)))
    score += min(has_variety * 5, 15)
    has_difficulty = sum(1 for q in questions if isinstance(q, dict) and q.get("difficulty"))
    score += min(has_difficulty * 2, 10)
    return min(round(score, 1), 100.0)


def _evaluate_analysis_quality(analysis: str) -> float:
    if not analysis:
        return 0.0
    score = 40.0
    if len(analysis) > 100:
        score += 15
    if len(analysis) > 300:
        score += 10
    if any(kw in analysis for kw in ["原因", "分析", "建议", "改进"]):
        score += 15
    if any(kw in analysis for kw in ["知识点", "概念", "方法"]):
        score += 10
    if any(kw in analysis for kw in ["练习", "巩固", "复习"]):
        score += 10
    return min(round(score, 1), 100.0)
