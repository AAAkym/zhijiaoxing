"""生成依据链服务：把"这份资源为什么是给你的"整理成可回溯的结构化依据。

设计约束（与 profile_explainability_service.py 保持一致）：

- ``build_resource_basis`` / ``build_package_basis`` / ``build_basis_preview``
  **never touch the database**：输入是纯 dict，输出是纯 dict。
- 只有 ``build_class_learning_groups`` 需要读取班级成员与画像，它是**只读**查询，
  不写库、不落库、不使用任何新的第三方依赖。
- 若本文件将来需要落库，必须单独提 ADR。

诚实性硬规则（本模块的第一验收项）：

- 缺证据就显式标注，禁止编造。证据不足时复用 profile_explainability_service 的兜底文案。
- 拿不到错题明细（只有聚合计数）时，``mistake_evidence`` 返回空数组并在 ``gaps``
  中登记 ``missing_mistake_detail``，绝不用聚合数字伪造错题条目。
- 难度对齐评分为占位值（75）时，必须在 ``gaps`` 中登记
  ``difficulty_alignment_is_placeholder``。
- ``media`` / ``ppt`` 故意跳过知识库引用附加，因此不出引用完整性与引用覆盖率结论。
"""

import json
import re
from collections import Counter
from datetime import datetime, timezone

from src.services.profile_explainability_service import (
    DIMENSIONS,
    build_profile_explainability,
)

#: 与 profile_explainability_service._dimension_details 的兜底文案保持一致。
INSUFFICIENT_EVIDENCE_TEXT = "当前证据不足，建议通过画像对话或更多学习活动补充数据"

#: 低于该可信度不展示为确定结论，前端需给出"低可信"标记。
LOW_CONFIDENCE_THRESHOLD = 60

#: _check_difficulty_alignment 当前返回的占位常量。
PLACEHOLDER_DIFFICULTY_ALIGNMENT = 75

#: 故意跳过知识库引用附加的资源类型（见 coordinator_agent 的 media/ppt 说明）。
CITATION_EXEMPT_RESOURCE_TYPES = frozenset({"media", "ppt"})

#: 知识库引用的 source_id 形态，例如 KP12 / EX3 / TC7 / S1。
CITATION_SOURCE_ID_RE = re.compile(r"^[A-Z]{1,4}\d+$")

#: 题面摘录长度上限，避免把整道题塞进依据链。
QUESTION_EXCERPT_LIMIT = 120

#: 证据不足学生的判据（第 3.4 节）。
UNGROUPED_COMPLETENESS_THRESHOLD = 40
UNGROUPED_CONFIDENCE_THRESHOLD = 50

#: 分组候选维度，按"主标签 → 次标签 → 第三标签"的顺序使用。
PRIMARY_GROUPING_DIMENSION = "cognitive_style"
SECONDARY_GROUPING_DIMENSION = "knowledge_base"
TERTIARY_GROUPING_DIMENSION = "goal_orientation"

#: 少于 2 人的组并入 mixed 组时使用的标签。
MIXED_GROUP_LABEL = "混合型"

#: 各资源类型的展示名，与前端 RESOURCE_LABELS 保持同一口径。
RESOURCE_TYPE_LABELS = {
    "exercise": "个性化练习",
    "layered_exercise": "分层练习",
    "document": "讲解文档",
    "mindmap": "思维导图",
    "media": "视频脚本",
    "recommendation": "拓展推荐",
    "project": "实操项目",
    "ppt": "课件PPT",
}

#: 主标签（认知风格）→ 教师端可执行的补救动作。
REMEDIATION_ACTIONS = {
    "visual": "先用图示化分步示例讲清概念结构，再安排递进练习",
    "auditory": "先用口语化讲解与复述脚本过一遍概念，再安排跟读式练习",
    "kinesthetic": "先给可动手的最小任务，在操作中补概念，再安排变式练习",
    "reading": "先给结构化文档与概念定义，再安排阅读理解式练习",
    "mixed": "先给多种形式的概念讲解，再按薄弱点安排递进练习",
}

#: 主标签 → 建议资源类型。
REMEDIATION_RESOURCE_TYPES = {
    "visual": ["document", "mindmap", "layered_exercise"],
    "auditory": ["media", "document", "layered_exercise"],
    "kinesthetic": ["project", "layered_exercise", "document"],
    "reading": ["document", "recommendation", "layered_exercise"],
    "mixed": ["document", "layered_exercise", "mindmap"],
}

#: 学习节奏 → 学习序列。
REMEDIATION_SEQUENCES = {
    "fast": ["前置知识", "核心讲解", "进阶练习", "综合项目"],
    "moderate": ["前置知识", "讲解", "递进练习", "短检测"],
    "slow": ["前置知识", "分步示例", "基础练习", "回顾", "短检测"],
    "adaptive": ["诊断", "前置知识", "分层讲解", "递进练习", "短检测"],
}


def build_resource_basis(resource_type, resource, package=None, signals=None, graph_context=None, cycle=None):
    """构建单份资源的生成依据链。This function never touches the database."""
    package = package or {}
    signals = signals or {}
    resource = resource if isinstance(resource, dict) else {}
    explanation = package.get("generation_explanation") or {}
    profile_snapshot = explanation.get("profile_snapshot") or {}
    profile = profile_snapshot.get("profile") or {}
    explainability = profile_snapshot.get("explainability") or build_profile_explainability(profile, signals)
    resource_documents = _resource_documents(package.get("resources"), resource)

    gaps = []
    mistakes, mistake_gap = _concrete_mistake_rows(
        signals.get("mistakes"), resource_documents, course_id=_package_course_id(package)
    )
    if mistake_gap:
        gaps.append(mistake_gap)
    profile_evidence = _build_profile_evidence(explainability, signals, gaps)
    mistake_evidence = mistakes
    knowledge_evidence = _build_knowledge_evidence(
        resource_documents,
        resource,
        package,
        graph_context,
        signals,
        gaps,
    )

    return {
        "basis_id": _basis_id(package, resource_type),
        "resource_type": resource_type,
        "resource_title": _resource_title(resource, resource_type),
        "generated_at": _generated_at(package),
        "profile_evidence": profile_evidence,
        "mistake_evidence": mistake_evidence,
        "knowledge_evidence": knowledge_evidence,
        "next_step": _build_next_step(cycle, gaps),
        "quality": _build_quality(resource_documents, package, resource_type, signals, gaps),
        "gaps": gaps,
    }


def build_package_basis(package, signals=None, graph_context=None, cycle=None):
    """为资源包内每类资源分别构建依据链，返回 {resource_type: GenerationBasis}。

    This function never touches the database.
    """
    package = package or {}
    resources = package.get("resources") or {}
    basis = {}
    for resource_type, resource in resources.items():
        if resource in (None, {}, []):
            continue
        primary = _primary_resource(resource)
        basis[resource_type] = build_resource_basis(
            resource_type, primary, package, signals, graph_context, cycle
        )
    return basis


def build_basis_preview(package_id_or_topic, signals=None, profile=None, explainability=None, cycle=None):
    """生成前预览：在没有资源正文时也能说明"将依据什么生成"。

    This function never touches the database.
    """
    signals = signals or {}
    profile = profile or {}
    explainability = explainability or build_profile_explainability(profile, signals)
    gaps = []
    mistakes = _mistake_rows_from_signals(signals)
    if not mistakes:
        gaps.append(_gap(
            "missing_mistake_detail",
            "本轮未关联到具体错题明细，错题依据只能给出聚合计数。",
        ))
    return {
        "basis_id": "bas_preview_{0}".format(package_id_or_topic or "package"),
        "resource_type": "preview",
        "resource_title": str(package_id_or_topic or "生成前依据预览"),
        "generated_at": _utc_now(),
        "profile_evidence": _build_profile_evidence(explainability, signals, gaps),
        "mistake_evidence": mistakes[:5],
        "knowledge_evidence": [],
        "next_step": _build_next_step(cycle, gaps),
        "quality": {
            "overall_score": None,
            "dimensions": {},
            "consistency": {},
            "citation_coverage_score": None,
            "verification_status": "not_run",
            "degradation": None,
        },
        "gaps": gaps,
    }


def build_class_learning_groups(class_id, course_id, precomputed_profiles=None):
    """按确定性规则给出班级学习类型分组。

    唯一的只读查询入口：读取 ``ClassGroupStudent`` 成员；当调用方未提供
    ``precomputed_profiles`` 时，会读取 ``StudentProfile``。不写库、不落库。
    """
    from src.models.student_profile import StudentProfile
    from src.models.user import ClassGroupStudent, User

    memberships = ClassGroupStudent.query.filter_by(class_group_id=class_id).all()
    user_ids = [item.user_id for item in memberships]
    profiles = {}
    if precomputed_profiles is not None:
        profiles = dict(precomputed_profiles)
    elif user_ids:
        rows = StudentProfile.query.filter(StudentProfile.user_id.in_(user_ids)).all()
        profiles = {row.user_id: row.to_dict() for row in rows}

    names = {}
    if user_ids:
        users = User.query.filter(User.id.in_(user_ids)).all()
        names = {user.id: (user.real_name or user.username) for user in users}

    members = []
    for membership in memberships:
        profile = profiles.get(membership.user_id) or {}
        explainability = build_profile_explainability(profile)
        members.append({
            "student_user_id": membership.user_id,
            "student_name": membership.student_name or names.get(membership.user_id, ""),
            "profile": profile,
            "completeness_score": explainability["completeness_score"],
            "confidence_score": explainability["confidence_score"],
        })

    return build_class_learning_groups_from_members(
        members, class_id=class_id, course_id=course_id
    )


def build_class_learning_groups_from_members(members, class_id=None, course_id=None):
    """纯函数形态的分组实现，便于单测与复用。This function never touches the database."""
    members = [item for item in (members or []) if isinstance(item, dict)]
    eligible = []
    ungrouped = []
    for member in members:
        completeness = _as_int(member.get("completeness_score"))
        confidence = _as_int(member.get("confidence_score"))
        if completeness < UNGROUPED_COMPLETENESS_THRESHOLD or confidence < UNGROUPED_CONFIDENCE_THRESHOLD:
            ungrouped.append({
                "student_user_id": member.get("student_user_id"),
                "student_name": member.get("student_name") or "",
                "reason": "evidence_insufficient",
                "completeness_score": completeness,
                "confidence_score": confidence,
            })
        else:
            eligible.append(member)

    buckets = {}
    for member in eligible:
        primary = _profile_value(member.get("profile"), PRIMARY_GROUPING_DIMENSION, "mixed")
        secondary = _dominant_weak_point(member.get("profile"))
        tertiary = _profile_value(member.get("profile"), TERTIARY_GROUPING_DIMENSION, "exam")
        key = (primary, secondary, tertiary)
        buckets.setdefault(key, []).append(member)

    groups = []
    merged_small_groups = []
    small_members = []
    for key in sorted(buckets, key=lambda item: (-len(buckets[item]), item)):
        rows = buckets[key]
        if len(rows) < 2:
            small_members.extend(rows)
            merged_small_groups.append({
                "learning_type": _learning_type(key[0], key[1], key[2]),
                "student_count": len(rows),
            })
            continue
        groups.append(_build_group(key[0], key[1], key[2], rows))

    if small_members:
        groups.append(_build_group("mixed", "", "", small_members, merged_small_groups))

    groups.sort(key=lambda item: (-item["student_count"], item["group_id"]))
    grouped_count = sum(item["student_count"] for item in groups)
    return {
        "class_id": class_id,
        "course_id": course_id,
        "generated_at": _utc_now(),
        "student_count": len(members),
        "grouped_count": grouped_count,
        "ungrouped_count": len(ungrouped),
        "grouping_method": "rule_based_dominant_dimension",
        "groups": groups,
        "ungrouped_students": ungrouped,
    }


def _build_group(primary, secondary, tertiary, rows, merged_small_groups=None):
    learning_type = _learning_type(primary, secondary, tertiary)
    defining_features = [_primary_feature(primary, rows)]
    weak_points = _weak_point_features(rows)
    if secondary:
        defining_features.append(_weak_point_feature(secondary, rows, weak_points))
    else:
        defining_features.append(_weak_point_feature_from_list(weak_points, rows))
    defining_features.append(_tertiary_feature(tertiary, rows))
    if merged_small_groups:
        defining_features.append({
            "dimension_key": "group_size",
            "dimension_label": "分组规模",
            "value": "merged",
            "display_value": "少于2人的组已并入本组",
            "share": 1.0,
            "merge_reason": "less_than_two_students",
            "merged_from": merged_small_groups,
        })
    return {
        "group_id": _group_id(primary, secondary, tertiary),
        "learning_type": learning_type,
        "student_count": len(rows),
        "student_ids": [row.get("student_user_id") for row in rows],
        "student_names": [row.get("student_name") or "" for row in rows],
        "defining_features": [item for item in defining_features if item],
        "common_weak_points": weak_points,
        "evidence_confidence": _average([row.get("confidence_score") for row in rows]),
        "recommended_remediation": _recommended_remediation(
            primary, weak_points, rows
        ),
    }


def _primary_feature(primary, rows):
    if not primary:
        return None
    share = _share(rows, lambda row: _profile_value(
        row.get("profile"), PRIMARY_GROUPING_DIMENSION, "mixed"
    ) == primary)
    return {
        "dimension_key": PRIMARY_GROUPING_DIMENSION,
        "dimension_label": _dimension_label(PRIMARY_GROUPING_DIMENSION),
        "value": primary,
        "display_value": _dimension_value_label(PRIMARY_GROUPING_DIMENSION, primary),
        "share": share,
    }


def _weak_point_feature(secondary, rows, weak_points):
    matched = next(
        (item for item in weak_points if item["knowledge_point"] == secondary), None
    )
    if not matched:
        return _weak_point_feature_from_list(weak_points, rows)
    return {
        "dimension_key": SECONDARY_GROUPING_DIMENSION,
        "dimension_label": "薄弱知识点",
        "value": secondary,
        "display_value": secondary,
        "share": matched["share"],
    }


def _weak_point_feature_from_list(weak_points, rows):
    if weak_points:
        top = weak_points[0]
        return {
            "dimension_key": SECONDARY_GROUPING_DIMENSION,
            "dimension_label": "薄弱知识点",
            "value": top["knowledge_point"],
            "display_value": top["knowledge_point"],
            "share": top["share"],
        }
    return {
        "dimension_key": SECONDARY_GROUPING_DIMENSION,
        "dimension_label": "薄弱知识点",
        "value": "",
        "display_value": "暂无共同薄弱点",
        "share": 0.0,
    }


def _tertiary_feature(tertiary, rows):
    if not tertiary:
        return {
            "dimension_key": TERTIARY_GROUPING_DIMENSION,
            "dimension_label": _dimension_label(TERTIARY_GROUPING_DIMENSION),
            "value": "",
            "display_value": "多种目标导向",
            "share": 0.0,
        }
    share = _share(rows, lambda row: _profile_value(
        row.get("profile"), TERTIARY_GROUPING_DIMENSION, "exam"
    ) == tertiary)
    return {
        "dimension_key": TERTIARY_GROUPING_DIMENSION,
        "dimension_label": _dimension_label(TERTIARY_GROUPING_DIMENSION),
        "value": tertiary,
        "display_value": _dimension_value_label(TERTIARY_GROUPING_DIMENSION, tertiary),
        "share": share,
    }


def _weak_point_features(rows):
    total = len(rows) or 1
    counter = Counter()
    for row in rows:
        for point in _weak_points_of(row.get("profile")):
            counter[point[0]] += 1
    features = []
    for name, count in counter.most_common(3):
        features.append({
            "knowledge_point": name,
            "student_count": count,
            "share": round(count / total, 2),
            "avg_mastery": _average_mastery(rows, name),
        })
    return features


def _recommended_remediation(primary, weak_points, rows):
    top_point = weak_points[0]["knowledge_point"] if weak_points else ""
    action = REMEDIATION_ACTIONS.get(primary or "mixed", REMEDIATION_ACTIONS["mixed"])
    if top_point:
        action = "先补{0}的前置知识与典型错误辨析，再".format(top_point) + action
    else:
        action = action + "；本组暂无跨学生的共同薄弱点，先做诊断性短检测确认起点"
    pace = _dominant_profile_value(rows, "learning_pace", "moderate")
    sequence = REMEDIATION_SEQUENCES.get(pace, REMEDIATION_SEQUENCES["moderate"])
    topic = "{0}的{1}".format(top_point, _remediation_topic_suffix(primary)) if top_point \
        else "{0}起点诊断".format(_dimension_value_label(PRIMARY_GROUPING_DIMENSION, primary or "mixed"))
    return {
        "action": action,
        "resource_types": list(REMEDIATION_RESOURCE_TYPES.get(primary or "mixed", REMEDIATION_RESOURCE_TYPES["mixed"])),
        "learning_sequence": list(sequence),
        "suggested_batch_topic": topic,
    }


def _remediation_topic_suffix(primary):
    return {
        "visual": "图示化讲解与分层练习",
        "auditory": "口语化讲解与跟读练习",
        "kinesthetic": "可动手任务与变式练习",
        "reading": "结构化文档与阅读练习",
    }.get(primary, "分步讲解与递进练习")


def _build_profile_evidence(explainability, signals, gaps):
    dimensions = explainability.get("dimensions") or []
    evidence = []
    for dimension in dimensions:
        confidence = _as_int(dimension.get("confidence"))
        items = [item for item in (dimension.get("evidence") or []) if item]
        if not items:
            items = [INSUFFICIENT_EVIDENCE_TEXT]
            gaps.append(_gap(
                "insufficient_dimension_evidence",
                "画像维度「{0}」缺少可用证据，已按证据不足处理。".format(
                    dimension.get("label") or dimension.get("key") or ""
                ),
                dimension_key=dimension.get("key"),
            ))
        evidence.append({
            "dimension_key": dimension.get("key"),
            "dimension_label": dimension.get("label"),
            "judgement": dimension.get("display_value") or "",
            "confidence": confidence,
            "low_confidence": confidence < LOW_CONFIDENCE_THRESHOLD,
            "evidence": items,
            "data_sources": list(dimension.get("data_sources") or []),
            "sample_count": _as_int(dimension.get("sample_count")),
            "updated_at": dimension.get("updated_at") or explainability.get("updated_at"),
        })
    if not dimensions:
        gaps.append(_gap(
            "missing_profile_evidence",
            "该资源按通用方案生成，未使用个人画像证据。",
        ))
    return evidence


def _concrete_mistake_rows(mistakes_signals, resource_documents, course_id=None):
    """返回 (错题明细, gap 或 None)。没有明细时绝不伪造条目。"""
    raw = {"mistakes": mistakes_signals or {}}
    rows = _mistake_rows_from_signals(raw)
    if rows:
        return rows, None
    gap = None
    if _has_mistake_aggregate(raw):
        gap = _gap(
            "missing_mistake_detail",
            "仅能取到错题的聚合计数，未取到具体错题明细，因此不展示错题条目。",
        )
    return [], gap


def _package_course_id(package):
    for key in ("course_id",):
        value = (package or {}).get(key)
        if value not in (None, ""):
            return value
    snapshot = ((package or {}).get("generation_explanation") or {}).get("profile_snapshot") or {}
    for key in ("course_id", "student_user_id"):
        value = snapshot.get(key)
        if key == "course_id" and value not in (None, ""):
            return value
    return None


def _mistake_rows_from_signals(signals):
    rows = []
    for item in (signals.get("mistakes") or {}).get("evidence") or []:
        if not isinstance(item, dict):
            continue
        rows.append(_normalize_mistake(item))
    return rows


def _has_raw_mistake_error(signals, course_id=None):
    """判断调用方手头是否已有结构化错题明细（而不是只有聚合计数）。

    只做只读判断，不写库、不落库。缺少 course_id 时不猜测课程归属。
    """
    signals = signals or {}
    if _mistake_rows_from_signals(signals):
        return True
    if course_id in (None, ""):
        return False
    from src.models.course import MistakeRecord

    return MistakeRecord.query.filter(
        MistakeRecord.user_id == signals.get("student_user_id"),
        MistakeRecord.course_id == course_id,
    ).first() is not None


def _normalize_mistake(item):
    question = item.get("question_excerpt") or item.get("question_content") or ""
    return {
        "mistake_id": item.get("mistake_id") or item.get("id"),
        "knowledge_point": item.get("knowledge_point") or "",
        "error_type": item.get("error_type") or "",
        "mistake_count": _as_int(item.get("mistake_count")) or 1,
        "last_mistake_at": _isoformat(item.get("last_mistake_at") or item.get("updated_at")),
        "mastery_status": item.get("mastery_status") or "unmastered",
        "question_excerpt": _truncate(question, QUESTION_EXCERPT_LIMIT),
        "user_answer": item.get("user_answer") or "",
        "correct_answer": item.get("correct_answer") or "",
    }


def _has_mistake_aggregate(signals):
    mistakes = signals.get("mistakes") or {}
    if _as_int(mistakes.get("total")):
        return True
    return bool(mistakes.get("top_knowledge_points"))


def _build_knowledge_evidence(resource_documents, resource, package, graph_context, signals, gaps):
    contexts = _graph_contexts(graph_context, resource, package)
    knowledge_points = resource.get("knowledge_points") if isinstance(resource, dict) else None
    knowledge_points = [str(item) for item in (knowledge_points or []) if item]
    if not contexts and not knowledge_points:
        gaps.append(_gap(
            "missing_knowledge_reference",
            "该资源未关联到具体知识点，无法给出知识图谱位置。",
        ))
        return []

    evidence = []
    weak_points = set()
    for item in (signals.get("mistakes") or {}).get("top_knowledge_points") or []:
        if isinstance(item, (list, tuple)) and item:
            weak_points.add(str(item[0]))
    for index, context in enumerate(contexts):
        label = str(context.get("label") or context.get("title") or "")
        if not label and index < len(knowledge_points):
            label = knowledge_points[index]
        mastery = _as_float(context.get("mastery"))
        evidence.append({
            "node_id": context.get("node_id") or context.get("id"),
            "label": label,
            "node_type": context.get("node_type") or "knowledge_point",
            "chapter_title": context.get("chapter_title") or context.get("chapter") or "",
            "mastery": mastery,
            "is_weak": bool(context.get("is_weak")) or mastery is not None and mastery < 0.6
            or (label and label in weak_points),
            "citation_ids": _citation_ids(context, resource_documents, label),
        })
    for index, label in enumerate(knowledge_points):
        if any(item["label"] == label for item in evidence):
            continue
        evidence.append({
            "node_id": None,
            "label": label,
            "node_type": "knowledge_point",
            "chapter_title": "",
            "mastery": None,
            "is_weak": label in weak_points,
            "citation_ids": _citation_ids({}, resource_documents, label),
        })
    return evidence


def _graph_contexts(graph_context, resource, package):
    contexts = []
    if isinstance(graph_context, dict):
        for key in ("knowledge_points", "nodes", "contexts"):
            rows = graph_context.get(key)
            if isinstance(rows, list):
                contexts.extend(row for row in rows if isinstance(row, dict))
        if graph_context.get("label") or graph_context.get("node_id"):
            contexts.append(graph_context)
        for row in graph_context.get("selected_knowledge_points") or []:
            if isinstance(row, dict):
                contexts.append(row)
    elif isinstance(graph_context, list):
        contexts.extend(row for row in graph_context if isinstance(row, dict))
    if not contexts:
        for row in resource.get("knowledge_point_references") or []:
            if isinstance(row, dict):
                contexts.append(row)
    if not contexts:
        for row in package.get("knowledge_points") or []:
            if isinstance(row, dict):
                contexts.append(row)
    return contexts


def _citation_ids(context, resource_documents, label):
    ids = []
    for document in resource_documents:
        for citation in document.get("citations") or []:
            if not isinstance(citation, dict):
                continue
            source_id = citation.get("source_id")
            if not source_id:
                continue
            source_id = str(source_id)
            title = str(citation.get("title") or "")
            if label and (label in title or title in label) or source_id.startswith("KP"):
                ids.append(source_id)
    for source_id in context.get("citation_ids") or []:
        if source_id:
            ids.append(str(source_id))
    ordered = []
    for source_id in ids:
        if source_id not in ordered:
            ordered.append(source_id)
    return ordered


def _build_next_step(cycle, gaps):
    cycle = cycle or {}
    owned = cycle.get("next_strategy") or {}
    if not owned:
        gaps.append(_gap(
            "missing_learning_cycle",
            "本轮还没有学习闭环结论，尚未生成下一轮策略。",
        ))
        return {
            "source": "learning_cycle",
            "action": "",
            "learning_sequence": [],
            "remaining_problems": [],
            "prerequisite_chain": [],
            "source_cycle_id": cycle.get("cycle_id") or cycle.get("id"),
        }
    return {
        "source": owned.get("source") or "learning_cycle",
        "action": owned.get("action") or "",
        "learning_sequence": list(owned.get("learning_sequence") or []),
        "remaining_problems": list(owned.get("remaining_problems") or []),
        "prerequisite_chain": list(cycle.get("prerequisite_chain") or []),
        "source_cycle_id": cycle.get("cycle_id") or cycle.get("id"),
    }


def _build_quality(resource_documents, package, resource_type, signals, gaps):
    quality_document = _quality_document(resource_documents)
    dimensions = {}
    for key, value in (quality_document.get("dimensions") or {}).items():
        if not isinstance(value, dict):
            continue
        dimensions[key] = {
            "score": value.get("score"),
            "basis": value.get("basis") or "",
            "suggestion": value.get("suggestion") or "",
        }
    if not dimensions:
        gaps.append(_gap(
            "missing_quality_report",
            "该资源没有质量评估记录，无法给出质量评分。",
        ))

    consistency = _normalized_consistency(package)
    difficulty_score = consistency.get("difficulty_alignment")
    if difficulty_score is not None and _as_int(difficulty_score) == PLACEHOLDER_DIFFICULTY_ALIGNMENT \
            and _is_placeholder_difficulty(package):
        gaps.append(_gap(
            "difficulty_alignment_is_placeholder",
            "难度对齐评分当前为固定值，未基于真实画像计算。",
        ))

    if resource_type in CITATION_EXEMPT_RESOURCE_TYPES:
        gaps.append(_gap(
            "citation_not_applicable",
            "视频脚本/课件PPT 不附加知识库引用，因此不给出引用覆盖率结论。",
        ))

    return {
        "overall_score": quality_document.get("overall_score"),
        "dimensions": dimensions,
        "consistency": consistency,
        "citation_coverage_score": quality_document.get("citation_coverage_score"),
        "verification_status": quality_document.get("verification_status"),
        "degradation": quality_document.get("degradation"),
    }


def _normalized_consistency(package):
    report = package.get("consistency_report") or {}
    result = {}
    for key in ("knowledge_coverage", "difficulty_alignment", "cross_reference_check", "overall_score"):
        value = report.get(key)
        result[key] = _as_int(value) if value is not None else _number_from_text(value)
    for key in ("knowledge_coverage", "difficulty_alignment", "cross_reference_check"):
        if result.get(key) is None:
            result[key] = _number_from_text(report.get(key))
    return result


def _is_placeholder_difficulty(package):
    report = package.get("consistency_report") or {}
    if report.get("difficulty_alignment_is_placeholder"):
        return True
    value = report.get("difficulty_alignment")
    if isinstance(value, (int, float)):
        return True
    return False


def _number_from_text(value):
    if value is None:
        return None
    match = re.search(r"(\d{1,3})", str(value))
    return _as_int(match.group(1)) if match else None


def _quality_document(resource_documents):
    for document in resource_documents:
        report = document.get("content_quality_report")
        if isinstance(report, dict) and report:
            semantic = report.get("semantic_review") or {}
            if isinstance(semantic, dict) and semantic.get("dimensions"):
                return {
                    "overall_score": semantic.get("overall_score", report.get("overall_score")),
                    "dimensions": semantic.get("dimensions") or {},
                    "citation_coverage_score": report.get("citation_coverage_score"),
                    "verification_status": report.get("verification_status"),
                    "degradation": report.get("degradation"),
                }
            return {
                "overall_score": report.get("overall_score"),
                "dimensions": report.get("dimensions") or {},
                "citation_coverage_score": report.get("citation_coverage_score"),
                "verification_status": report.get("verification_status"),
                "degradation": report.get("degradation"),
            }
    return {}


def _resource_documents(resources, resource):
    documents = []
    if isinstance(resource, dict) and resource:
        documents.append(resource)
    if isinstance(resources, dict):
        for value in resources.values():
            primary = _primary_resource(value)
            if isinstance(primary, dict) and primary and primary not in documents:
                documents.append(primary)
    return documents


def _primary_resource(resource):
    if isinstance(resource, list):
        return resource[0] if resource and isinstance(resource[0], dict) else {}
    if isinstance(resource, dict):
        return resource
    return {}


def build_basis_signals(mistake_records=None, profile=None, extra_signals=None):
    """把结构化错题明细包装成依据链可消费的 signals（纯 dict，不碰数据库）。

    This function never touches the database.
    """
    signals = dict(extra_signals or {})
    mistakes = dict(signals.get("mistakes") or {})
    records = [item for item in (mistake_records or []) if isinstance(item, dict)]
    if records:
        mistakes["evidence"] = records
    signals["mistakes"] = mistakes
    if profile is not None:
        signals["profile"] = profile
    return signals


def _basis_id(package, resource_type):
    package_id = package.get("package_id") or "package"
    return "bas_{0}_{1}".format(package_id, resource_type)


def _resource_title(resource, resource_type):
    if isinstance(resource, dict):
        title = resource.get("title") or resource.get("topic")
        if title:
            return str(title)
    return RESOURCE_TYPE_LABELS.get(resource_type, resource_type)


def _generated_at(package):
    metadata = package.get("metadata") or {}
    created_at = metadata.get("created_at")
    parsed = _parse_datetime(created_at)
    if parsed:
        return parsed.isoformat()
    return _utc_now()


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _isoformat(value):
    parsed = _parse_datetime(value)
    return parsed.isoformat() if parsed else None


def _truncate(value, limit):
    text = str(value or "")
    if len(text) <= limit:
        return text
    return text[:limit] + "..."


def _dimension_label(key):
    for dimension_key, label in DIMENSIONS:
        if dimension_key == key:
            return label
    return {
        SECONDARY_GROUPING_DIMENSION: "薄弱知识点",
        "group_size": "分组规模",
    }.get(key, key)


def _dimension_value_label(key, value):
    from src.services.profile_explainability_service import VALUE_LABELS

    if not value:
        return ""
    return VALUE_LABELS.get(value, value)


def _profile_value(profile, key, default):
    profile = profile or {}
    value = profile.get(key)
    if value in (None, "", {}):
        return default
    if isinstance(value, list):
        return default
    return value


def _dominant_profile_value(rows, key, default):
    counter = Counter(_profile_value(row.get("profile"), key, default) for row in rows)
    if not counter:
        return default
    return counter.most_common(1)[0][0]


def _weak_points_of(profile):
    profile = profile or {}
    knowledge_base = profile.get("knowledge_base") or {}
    points = []
    if isinstance(knowledge_base, dict):
        for name, score in knowledge_base.items():
            if str(name).startswith("_"):
                continue
            try:
                numeric = float(score)
            except (TypeError, ValueError):
                continue
            if numeric < 60:
                points.append((str(name), numeric))
    return points


def _dominant_weak_point(profile):
    points = _weak_points_of(profile)
    if not points:
        return ""
    counter = Counter(name for name, _ in points)
    lowest = min(score for _, score in points)
    best = counter.most_common(1)[0][0]
    for name, score in points:
        if score == lowest:
            return name
    return best


def _average_mastery(rows, knowledge_point):
    scores = []
    for row in rows:
        for name, score in _weak_points_of(row.get("profile")):
            if name == knowledge_point:
                scores.append(score)
                break
    if not scores:
        return None
    return round(sum(scores) / len(scores) / 100, 2)


def _learning_type(primary, secondary, tertiary):
    parts = [_dimension_value_label(PRIMARY_GROUPING_DIMENSION, primary or "mixed")]
    if secondary:
        parts.append("{0}薄弱".format(secondary))
    if tertiary:
        parts.append(_dimension_value_label(TERTIARY_GROUPING_DIMENSION, tertiary))
    return " · ".join(part for part in parts if part)


def _group_id(primary, secondary, tertiary):
    raw = "grp_{0}_{1}_{2}".format(
        primary or "mixed",
        secondary or "none",
        tertiary or "none",
    )
    return re.sub(r"\s+", "_", raw)


def _share(rows, predicate):
    total = len(rows) or 1
    matched = sum(1 for row in rows if predicate(row))
    return round(matched / total, 2)


def _average(values):
    numbers = [_as_int(value) for value in values if value is not None]
    numbers = [value for value in numbers if value is not None]
    if not numbers:
        return 0
    return round(sum(numbers) / len(numbers))


def _as_int(value):
    if value in (None, ""):
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _as_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _gap(kind, message, **extra):
    gap = {"kind": kind, "message": message}
    gap.update(extra)
    return gap
