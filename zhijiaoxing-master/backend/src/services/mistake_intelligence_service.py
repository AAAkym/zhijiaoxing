from __future__ import annotations

import json
import math
import random
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from itertools import combinations
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

ERROR_TYPE_CONCEPT = "concept_understanding"
ERROR_TYPE_CALCULATION = "calculation_error"
ERROR_TYPE_READING = "question_misread"
ERROR_TYPE_OTHER = "other"

ERROR_TYPE_META: Dict[str, Dict[str, str]] = {
    ERROR_TYPE_CONCEPT: {
        "label": "概念理解偏差",
        "description": "对核心知识点理解不透彻，概念迁移或规则应用出现偏差。",
    },
    ERROR_TYPE_CALCULATION: {
        "label": "计算失误",
        "description": "运算过程出现数字、符号、步骤或单位层面的失误。",
    },
    ERROR_TYPE_READING: {
        "label": "审题不清",
        "description": "未准确把握题目要求、条件限制或题干关键语义。",
    },
    ERROR_TYPE_OTHER: {
        "label": "其他",
        "description": "暂无法归入主要类型，建议结合教师点评进一步确认。",
    },
}

_CONCEPT_KEYWORDS = (
    "定义", "概念", "原理", "性质", "定理", "公式", "规则", "分类", "逻辑", "理解", "本质", "条件", "推理",
)
_CALC_KEYWORDS = (
    "计算", "运算", "加", "减", "乘", "除", "符号", "约分", "化简", "代入", "步骤", "单位", "小数", "百分比", "抄错",
)
_READING_KEYWORDS = (
    "审题", "题意", "条件", "范围", "关键", "忽略", "未看清", "误解", "要求", "限定", "陷阱", "多选", "单选",
)


@dataclass
class AnswerResolution:
    raw: str
    normalized: str
    display: str
    index: Optional[int]
    label: Optional[str]


def _safe_json_loads(value: Any, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str):
        return default
    try:
        return json.loads(value)
    except Exception:
        return default


def ensure_list(value: Any) -> List[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def normalize_tag(tag: Any) -> str:
    if tag is None:
        return ""
    tag_text = str(tag).strip()
    return re.sub(r"\s+", " ", tag_text)


def normalize_option_answer(answer: Any, options: Optional[Sequence[Any]]) -> AnswerResolution:
    raw = "" if answer is None else str(answer).strip()
    if raw == "":
        return AnswerResolution(raw="", normalized="", display="未作答", index=None, label=None)

    option_list = list(options or [])
    if not option_list:
        return AnswerResolution(raw=raw, normalized=raw, display=raw, index=None, label=None)

    cleaned = raw.strip()
    if len(cleaned) == 1 and cleaned.upper() in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        letter_index = ord(cleaned.upper()) - 65
        if 0 <= letter_index < len(option_list):
            option_text = str(option_list[letter_index])
            return AnswerResolution(
                raw=raw,
                normalized=str(letter_index),
                display=f"{cleaned.upper()}. {option_text}",
                index=letter_index,
                label=cleaned.upper(),
            )

    try:
        idx = int(cleaned)
        if 0 <= idx < len(option_list):
            label = chr(65 + idx)
            option_text = str(option_list[idx])
            return AnswerResolution(
                raw=raw,
                normalized=str(idx),
                display=f"{label}. {option_text}",
                index=idx,
                label=label,
            )
    except Exception:
        pass

    lowered = cleaned.lower()
    for idx, option in enumerate(option_list):
        option_text = str(option).strip()
        if option_text.lower() == lowered:
            label = chr(65 + idx)
            return AnswerResolution(
                raw=raw,
                normalized=str(idx),
                display=f"{label}. {option_text}",
                index=idx,
                label=label,
            )

    return AnswerResolution(raw=raw, normalized=raw, display=raw, index=None, label=None)


def extract_text_from_analysis(analysis: Optional[str]) -> str:
    if not analysis:
        return ""
    return re.sub(r"\s+", " ", analysis).strip().lower()


def classify_error_reason(
    question_content: str,
    user_answer_display: str,
    correct_answer_display: str,
    ai_analysis: Optional[str] = None,
    explanation: Optional[str] = None,
) -> Dict[str, Any]:
    text = " ".join(
        [
            question_content or "",
            user_answer_display or "",
            correct_answer_display or "",
            explanation or "",
            ai_analysis or "",
        ]
    ).lower()

    calc_score = sum(1 for key in _CALC_KEYWORDS if key in text)
    reading_score = sum(1 for key in _READING_KEYWORDS if key in text)
    concept_score = sum(1 for key in _CONCEPT_KEYWORDS if key in text)

    scored = [
        (ERROR_TYPE_CONCEPT, concept_score),
        (ERROR_TYPE_CALCULATION, calc_score),
        (ERROR_TYPE_READING, reading_score),
    ]
    scored.sort(key=lambda item: item[1], reverse=True)

    top_type, top_score = scored[0]
    second_score = scored[1][1]

    if top_score <= 0:
        selected = ERROR_TYPE_OTHER
        confidence = 0.45
    else:
        selected = top_type
        confidence = min(0.95, 0.55 + 0.08 * top_score + 0.04 * max(0, top_score - second_score))

    meta = ERROR_TYPE_META[selected]
    evidence = []
    if selected != ERROR_TYPE_OTHER:
        keywords = {
            ERROR_TYPE_CONCEPT: _CONCEPT_KEYWORDS,
            ERROR_TYPE_CALCULATION: _CALC_KEYWORDS,
            ERROR_TYPE_READING: _READING_KEYWORDS,
        }[selected]
        evidence = [key for key in keywords if key in text][:5]

    detail = (
        f"系统判定为【{meta['label']}】。"
        f"主要依据：{meta['description']}"
        f"{' 触发线索：' + '、'.join(evidence) if evidence else ''}"
    )

    return {
        "auto_type": selected,
        "auto_type_label": meta["label"],
        "confidence": round(confidence, 2),
        "detail": detail,
        "evidence": evidence,
    }


def parse_knowledge_tags(raw_tags: Any) -> List[str]:
    tags = _safe_json_loads(raw_tags, raw_tags)
    normalized = [normalize_tag(tag) for tag in ensure_list(tags)]
    return [tag for tag in normalized if tag]


def _node_mastery_score(unmastered: int, reviewing: int, mastered: int, total_mistakes: int) -> float:
    # Score is 0-100; higher means better mastery.
    penalty = unmastered * 18 + reviewing * 9 + total_mistakes * 4
    reward = mastered * 6
    score = 78 + reward - penalty
    return round(max(0.0, min(100.0, score)), 2)


def _node_weakness_score(unmastered: int, reviewing: int, total_mistakes: int) -> float:
    score = unmastered * 0.8 + reviewing * 0.45 + total_mistakes * 0.2
    return round(min(10.0, score), 2)


def build_knowledge_graph(mistakes: Sequence[Any]) -> Dict[str, Any]:
    node_counter: Dict[str, Counter] = defaultdict(Counter)
    co_occurrence = Counter()

    for mistake in mistakes:
        tags = parse_knowledge_tags(getattr(mistake, "knowledge_tags", None))
        if not tags:
            continue

        uniq_tags = sorted(set(tags))
        for tag in uniq_tags:
            node_counter[tag]["total"] += 1
            node_counter[tag][getattr(mistake, "mastery_status", "unmastered") or "unmastered"] += 1
            node_counter[tag]["mistake_count_sum"] += int(getattr(mistake, "mistake_count", 1) or 1)

        for left, right in combinations(uniq_tags, 2):
            co_occurrence[(left, right)] += 1

    nodes = []
    for tag, counter in node_counter.items():
        total = int(counter["total"])
        unmastered = int(counter["unmastered"])
        reviewing = int(counter["reviewing"])
        mastered = int(counter["mastered"])
        mistake_sum = int(counter["mistake_count_sum"])
        mastery_score = _node_mastery_score(unmastered, reviewing, mastered, total)
        weakness_score = _node_weakness_score(unmastered, reviewing, total)

        if weakness_score >= 5.0:
            level = "high"
            color = "#ef4444"
        elif weakness_score >= 3.0:
            level = "medium"
            color = "#f59e0b"
        else:
            level = "low"
            color = "#10b981"

        size = round(18 + math.log(total + 1) * 10 + weakness_score * 2, 2)

        nodes.append(
            {
                "id": tag,
                "label": tag,
                "count": total,
                "mistake_count_sum": mistake_sum,
                "mastery_score": mastery_score,
                "weakness_score": weakness_score,
                "weakness_level": level,
                "color": color,
                "size": size,
                "status_breakdown": {
                    "unmastered": unmastered,
                    "reviewing": reviewing,
                    "mastered": mastered,
                },
            }
        )

    links = []
    for (left, right), weight in co_occurrence.items():
        links.append(
            {
                "source": left,
                "target": right,
                "weight": weight,
                "style": "solid" if weight >= 3 else "dashed",
                "opacity": round(min(0.9, 0.25 + weight * 0.15), 2),
            }
        )

    nodes.sort(key=lambda item: (item["weakness_score"], item["count"]), reverse=True)
    links.sort(key=lambda item: item["weight"], reverse=True)

    avg_mastery = round(sum(node["mastery_score"] for node in nodes) / len(nodes), 2) if nodes else 0.0
    weak_nodes = [node for node in nodes if node["weakness_level"] in {"high", "medium"}]

    return {
        "nodes": nodes,
        "links": links,
        "metrics": {
            "knowledge_points": len(nodes),
            "connections": len(links),
            "average_mastery": avg_mastery,
            "weak_points": len(weak_nodes),
        },
        "weak_points": weak_nodes[:12],
    }


def _difficulty_rank(value: str) -> int:
    return {"easy": 1, "medium": 2, "hard": 3}.get((value or "medium").lower(), 2)


def _normalize_question_difficulty(question: Dict[str, Any]) -> str:
    val = (question.get("difficulty") or "").strip().lower()
    if val in {"easy", "medium", "hard"}:
        return val
    return "medium"


def _extract_assessment_questions(assessments: Iterable[Any]) -> List[Dict[str, Any]]:
    bank = []
    for assessment in assessments:
        questions = _safe_json_loads(getattr(assessment, "questions", None), [])
        answers = _safe_json_loads(getattr(assessment, "answers", None), [])
        if not isinstance(questions, list):
            continue

        for idx, question in enumerate(questions):
            if not isinstance(question, dict):
                continue
            tags = parse_knowledge_tags(question.get("knowledge_tags") or question.get("tags"))
            options = ensure_list(question.get("options"))
            bank.append(
                {
                    "assessment_id": getattr(assessment, "id", None),
                    "assessment_title": getattr(assessment, "title", None),
                    "course_id": getattr(assessment, "course_id", None),
                    "question_index": idx,
                    "question_content": question.get("content") or question.get("question") or "",
                    "question_type": question.get("type") or ("choice" if options else "essay"),
                    "options": options,
                    "correct_answer": answers[idx] if idx < len(answers) else question.get("correctAnswer") or question.get("correct_answer"),
                    "difficulty": _normalize_question_difficulty(question),
                    "knowledge_tags": tags,
                    "source_question": question,
                }
            )
    return bank


def build_targeted_practice_plan(
    mistakes: Sequence[Any],
    assessments: Sequence[Any],
    limit: int = 18,
) -> Dict[str, Any]:
    limit = max(6, min(40, int(limit or 18)))
    graph = build_knowledge_graph(mistakes)
    weak_points = graph.get("weak_points", [])
    target_tags = [node["id"] for node in weak_points[:8]]

    if not target_tags:
        target_tags = [node["id"] for node in graph.get("nodes", [])[:6]]

    bank = _extract_assessment_questions(assessments)

    ranked_questions = []
    target_set = set(target_tags)
    for question in bank:
        tags = set(question.get("knowledge_tags") or [])
        if not tags:
            continue
        overlap = tags.intersection(target_set)
        if not overlap:
            continue

        base = len(overlap) * 10
        diff_rank = _difficulty_rank(question.get("difficulty", "medium"))
        # Encourage easier questions first while keeping hard questions available.
        score = base + (4 - abs(2 - diff_rank))
        ranked_questions.append((question, score, overlap))

    ranked_questions.sort(key=lambda item: item[1], reverse=True)

    phase_template = [
        {"phase": 1, "name": "基础纠偏", "difficulty": "easy", "ratio": 0.4},
        {"phase": 2, "name": "能力巩固", "difficulty": "medium", "ratio": 0.4},
        {"phase": 3, "name": "冲刺迁移", "difficulty": "hard", "ratio": 0.2},
    ]

    phase_targets = []
    remaining = limit
    for idx, phase in enumerate(phase_template):
        if idx == len(phase_template) - 1:
            count = remaining
        else:
            count = max(1, int(round(limit * phase["ratio"])))
            remaining -= count
        phase_targets.append({**phase, "count": count})

    selected = []
    used = set()
    for phase in phase_targets:
        desired = phase["difficulty"]
        count = phase["count"]
        candidates = [item for item in ranked_questions if item[0]["difficulty"] == desired and (item[0]["assessment_id"], item[0]["question_index"]) not in used]
        if len(candidates) < count:
            candidates += [item for item in ranked_questions if (item[0]["assessment_id"], item[0]["question_index"]) not in used and item not in candidates]

        bucket = []
        for question, score, overlap in candidates[:count]:
            qid = (question["assessment_id"], question["question_index"])
            used.add(qid)
            bucket.append(
                {
                    **question,
                    "match_score": score,
                    "matched_tags": sorted(list(overlap)),
                    "phase": phase["phase"],
                    "phase_name": phase["name"],
                }
            )
        selected.extend(bucket)

    selected = selected[:limit]

    phase_stats: Dict[int, Dict[str, Any]] = {}
    for q in selected:
        phase = q["phase"]
        if phase not in phase_stats:
            phase_stats[phase] = {
                "phase": phase,
                "name": q["phase_name"],
                "difficulty": q["difficulty"],
                "count": 0,
                "knowledge_tags": Counter(),
            }
        phase_stats[phase]["count"] += 1
        phase_stats[phase]["knowledge_tags"].update(q.get("matched_tags") or [])

    stage_plan = []
    for phase in sorted(phase_stats.keys()):
        current = phase_stats[phase]
        stage_plan.append(
            {
                "phase": current["phase"],
                "name": current["name"],
                "difficulty": current["difficulty"],
                "question_count": current["count"],
                "focus_tags": [tag for tag, _ in current["knowledge_tags"].most_common(4)],
                "goal": {
                    1: "先纠正高频错误并重建概念锚点",
                    2: "在中等难度下稳定正确率与解题步骤",
                    3: "通过综合题提升迁移与抗干扰能力",
                }.get(current["phase"], "强化训练"),
            }
        )

    # Feedback estimation based on current mistake states.
    total = len(mistakes)
    mastered = len([m for m in mistakes if getattr(m, "mastery_status", "") == "mastered"])
    reviewing = len([m for m in mistakes if getattr(m, "mastery_status", "") == "reviewing"])
    baseline_accuracy = round((mastered + reviewing * 0.5) / total * 100, 2) if total else 0.0

    return {
        "target_tags": target_tags,
        "recommended_questions": selected,
        "stage_plan": stage_plan,
        "plan_metrics": {
            "question_total": len(selected),
            "target_tag_count": len(target_tags),
            "baseline_effectiveness": baseline_accuracy,
            "expected_improvement": min(25.0, round(len(target_tags) * 2.2 + len(stage_plan) * 1.5, 2)),
        },
    }


def calc_practice_feedback(
    before_mastery_rate: float,
    after_accuracy: float,
    completed_count: int,
    wrong_count: int,
) -> Dict[str, Any]:
    delta = round(after_accuracy - before_mastery_rate, 2)
    if delta >= 12:
        level = "excellent"
        advice = "进步明显，可适当提高难度并增加综合题。"
    elif delta >= 4:
        level = "good"
        advice = "保持当前节奏，下一阶段增加中高难度比例。"
    elif delta >= 0:
        level = "steady"
        advice = "进步平稳，建议加强基础错因复盘后再提速。"
    else:
        level = "warning"
        advice = "效果未达预期，建议回到第一阶段重做基础纠偏。"

    return {
        "effect_level": level,
        "delta_accuracy": delta,
        "completed_count": completed_count,
        "wrong_count": wrong_count,
        "advice": advice,
    }
