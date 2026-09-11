from datetime import datetime, timezone


DIMENSIONS = (
    ("knowledge_base", "知识基础"),
    ("cognitive_style", "认知风格"),
    ("error_patterns", "易错模式"),
    ("learning_pace", "学习节奏"),
    ("interest_areas", "兴趣领域"),
    ("goal_orientation", "目标导向"),
    ("time_availability", "时间可用性"),
    ("interaction_preference", "互动偏好"),
)

DEFAULT_VALUES = {
    "knowledge_base": {},
    "cognitive_style": "mixed",
    "error_patterns": [],
    "learning_pace": "moderate",
    "interest_areas": [],
    "goal_orientation": "exam",
    "time_availability": {},
    "interaction_preference": "guided",
}

VALUE_LABELS = {
    "visual": "视觉型",
    "auditory": "听觉型",
    "kinesthetic": "实践型",
    "reading": "阅读型",
    "mixed": "混合型",
    "fast": "较快",
    "moderate": "适中",
    "slow": "偏慢",
    "adaptive": "自适应",
    "exam": "应试导向",
    "career": "职业导向",
    "hobby": "兴趣导向",
    "research": "研究导向",
    "guided": "引导式",
    "exploratory": "探索式",
    "challenging": "挑战式",
}


def build_empty_profile(user_id=None):
    """Return a transient profile payload. This function never touches the database."""
    return {
        "id": None,
        "user_id": user_id,
        **DEFAULT_VALUES,
        "confidence_score": 0.0,
        "last_updated": None,
        "update_source": "none",
        "created_at": None,
        "dimension_names": dict(DIMENSIONS),
    }


def _has_value(key, value):
    if key in ("knowledge_base", "time_availability"):
        return isinstance(value, dict) and bool(value)
    if key in ("error_patterns", "interest_areas"):
        return isinstance(value, list) and bool(value)
    return value not in (None, "", DEFAULT_VALUES[key])


def _parse_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _latest_timestamp(*values):
    parsed = [_parse_datetime(value) for value in values]
    parsed = [value for value in parsed if value]
    return max(parsed).isoformat() if parsed else None


def _confidence(source_count, sample_count, updated_at, has_value):
    if not has_value and source_count == 0:
        return 0

    coverage = min(source_count / 3, 1) * 35
    corroboration = 30 if source_count >= 2 else 18 if source_count == 1 else 0
    sample = min(sample_count / 10, 1) * 15

    updated = _parse_datetime(updated_at)
    recency = 0
    if updated:
        days = max(0, (datetime.now(timezone.utc) - updated).days)
        recency = 20 if days <= 7 else 14 if days <= 30 else 8 if days <= 90 else 2

    return round(min(100, coverage + corroboration + sample + recency))


def _display_value(key, value):
    if key == "knowledge_base" and isinstance(value, dict):
        public = [(name, score) for name, score in value.items() if not str(name).startswith("_")]
        if public:
            return "、".join(f"{name} {score}" for name, score in public[:4])
        trend = value.get("_practice_trend")
        return {"strong": "练习表现较强", "moderate": "练习表现中等", "weak": "练习表现较弱"}.get(trend, "待积累数据")
    if key == "error_patterns" and isinstance(value, list):
        names = [item.get("knowledge_point") or item.get("error_type") for item in value if isinstance(item, dict)]
        return "、".join(filter(None, names[:4])) or "待积累数据"
    if key == "interest_areas" and isinstance(value, list):
        names = [item.get("name") if isinstance(item, dict) else str(item) for item in value]
        return "、".join(filter(None, names[:4])) or "待积累数据"
    if key == "time_availability" and isinstance(value, dict):
        return "、".join(f"{name}: {amount}" for name, amount in list(value.items())[:4]) or "待积累数据"
    return VALUE_LABELS.get(value, str(value) if value not in (None, "") else "待积累数据")


def _append_evidence(items, text):
    if text and len(items) < 3:
        items.append(text)


def _dimension_details(profile, signals, key, label):
    practice = signals.get("practice") or {}
    mistakes = signals.get("mistakes") or {}
    interaction = signals.get("interaction") or {}
    progress = signals.get("progress") or {}
    content = signals.get("content_preferences") or {}
    time_data = signals.get("time_distribution") or {}
    programming = signals.get("programming") or {}
    knowledge = profile.get("knowledge_base") or {}
    value = profile.get(key, DEFAULT_VALUES[key])
    has_value = _has_value(key, value)
    sources = []
    evidence = []
    sample_count = 0

    if has_value:
        sources.append("画像对话/人工设置")

    if key == "knowledge_base":
        total = int(practice.get("total_practices") or practice.get("count") or 0)
        if total:
            sources.append("练习评测")
            sample_count += total
            _append_evidence(evidence, f"共完成{total}次练习，平均分{practice.get('avg_score', 0)}分")
        embedded_programming = knowledge.get("_programming_stats") if isinstance(knowledge, dict) else {}
        programming = programming or embedded_programming or {}
        if programming.get("total_submissions"):
            sources.append("编程提交")
            sample_count += int(programming.get("total_submissions") or 0)
            _append_evidence(evidence, f"编程提交通过率{round(float(programming.get('pass_rate') or 0) * 100)}%")
        weak = mistakes.get("top_knowledge_points") or mistakes.get("weak_points") or []
        if weak:
            sources.append("错题记录")
            sample_count += int(mistakes.get("total") or len(weak))
            names = [item[0] if isinstance(item, (list, tuple)) else item.get("point", "") for item in weak[:3]]
            _append_evidence(evidence, f"薄弱知识点集中在：{'、'.join(filter(None, names))}")
    elif key == "cognitive_style":
        total_videos = int(interaction.get("total_videos") or interaction.get("videos_watched") or 0)
        if total_videos:
            sources.append("视频学习行为")
            sample_count += total_videos
            completed = interaction.get("completed_videos") or interaction.get("videos_completed") or 0
            _append_evidence(evidence, f"观看{total_videos}个视频，完成{completed}个；该行为只作为辅助证据")
    elif key == "error_patterns":
        total = int(mistakes.get("total") or 0)
        if total:
            sources.append("错题记录")
            sample_count += total
            error_types = mistakes.get("by_error_type") or mistakes.get("error_type_distribution") or []
            if isinstance(error_types, dict) and error_types:
                top = sorted(error_types.items(), key=lambda item: item[1], reverse=True)[:2]
                _append_evidence(evidence, "高频错误类型：" + "、".join(f"{name}({count})" for name, count in top))
            _append_evidence(evidence, f"系统累计分析{total}条错题记录")
        programming_total = int(programming.get("total_submissions") or 0)
        syntax_issues = int(programming.get("syntax_issue_count") or 0)
        logic_issues = int(programming.get("logic_issue_count") or 0)
        if programming_total and (syntax_issues or logic_issues):
            sources.append("编程评测")
            sample_count += programming_total
            _append_evidence(
                evidence,
                f"{programming_total}次编程提交中，语法薄弱{syntax_issues}次、逻辑薄弱{logic_issues}次",
            )
    elif key == "learning_pace":
        courses = progress.get("courses") or []
        if courses:
            sources.append("课程进度")
            sample_count += len(courses)
            avg = sum(float(item.get("progress") or item.get("progress_percentage") or 0) for item in courses) / len(courses)
            _append_evidence(evidence, f"{len(courses)}门课程平均完成进度{round(avg, 1)}%")
        recent = practice.get("recent_scores") or []
        if recent:
            sources.append("近期练习")
            sample_count += len(recent)
            _append_evidence(evidence, f"最近{len(recent)}次练习均分{round(sum(recent) / len(recent), 1)}分")
    elif key == "interest_areas":
        categories = content.get("category_distribution") or []
        if categories:
            sources.append("选课与内容偏好")
            sample_count += sum(int(item.get("value") or 0) for item in categories)
            _append_evidence(evidence, "常学内容类别：" + "、".join(item.get("name", "") for item in categories[:3]))
    elif key == "goal_orientation":
        if has_value:
            _append_evidence(evidence, "目标来自画像对话或学生主动设置，尚无行为数据可直接替代")
            sample_count = 1
    elif key == "time_availability":
        total_hours = float(time_data.get("total_estimated_hours") or 0)
        if total_hours:
            sources.append("学习活跃时间")
            sample_count += len(time_data.get("daily_trend") or [])
            _append_evidence(evidence, f"统计周期内预计学习{round(total_hours, 1)}小时")
    elif key == "interaction_preference":
        questions = int(interaction.get("total_questions") or interaction.get("questions_asked") or 0)
        discussions = int(interaction.get("total_discussions") or 0)
        if questions or discussions:
            sources.append("问答与讨论")
            sample_count += questions + discussions
            _append_evidence(evidence, f"主动提问{questions}次，参与讨论{discussions}次")
        completed = int(interaction.get("completed_videos") or interaction.get("videos_completed") or 0)
        if completed:
            sources.append("视频学习行为")
            sample_count += completed
            _append_evidence(evidence, f"完成{completed}个教学视频")

    sources = list(dict.fromkeys(sources))
    updated_at = _latest_timestamp(
        profile.get("last_updated"),
        practice.get("last_at"),
        progress.get("last_at"),
        interaction.get("last_at"),
    )
    if not evidence:
        evidence.append("当前证据不足，建议通过画像对话或更多学习活动补充数据")

    return {
        "key": key,
        "label": label,
        "value": value,
        "display_value": _display_value(key, value),
        "is_complete": has_value,
        "confidence": _confidence(len(sources), sample_count, updated_at, has_value),
        "data_sources": sources,
        "evidence": evidence,
        "sample_count": sample_count,
        "updated_at": updated_at,
    }


def _strategy_suggestions(profile, signals):
    suggestions = []

    def add(feature, action, resources):
        suggestions.append({"feature": feature, "action": action, "affected_resources": resources})

    style = profile.get("cognitive_style")
    style_actions = {
        "visual": ("增加图示、思维导图和可视化讲解", ["document", "mindmap", "media"]),
        "auditory": ("增加旁白、口语化说明和分步骤讲解", ["media", "document"]),
        "kinesthetic": ("增加编程练习、实操案例和任务驱动内容", ["exercise", "project"]),
        "reading": ("增加结构化文档深度和拓展阅读", ["document", "recommendation"]),
    }
    if _has_value("cognitive_style", style) and style in style_actions:
        action, resources = style_actions[style]
        add(f"认知风格：{VALUE_LABELS.get(style, style)}", action, resources)

    goal = profile.get("goal_orientation")
    goal_actions = {
        "exam": ("突出考点、易错点和真题变式", ["exercise", "document"]),
        "career": ("突出行业场景、技能任务和实践项目", ["project", "recommendation"]),
        "hobby": ("从趣味案例切入并提供探索任务", ["media", "project"]),
        "research": ("提高理论深度并增加论文与开放问题", ["document", "recommendation"]),
    }
    if _has_value("goal_orientation", goal) and goal in goal_actions:
        action, resources = goal_actions[goal]
        add(f"学习目标：{VALUE_LABELS.get(goal, goal)}", action, resources)

    pace = profile.get("learning_pace")
    if _has_value("learning_pace", pace) and pace == "slow":
        add("学习节奏：偏慢", "分段讲解，增加回顾和基础练习", ["document", "exercise"])
    elif _has_value("learning_pace", pace) and pace == "fast":
        add("学习节奏：较快", "提高信息密度并增加挑战任务", ["document", "exercise", "project"])

    weak = (signals.get("mistakes") or {}).get("top_knowledge_points") or []
    if weak:
        names = [item[0] if isinstance(item, (list, tuple)) else item.get("point", "") for item in weak[:3]]
        add("薄弱知识点：" + "、".join(filter(None, names)), "先补前置知识，再安排递进练习", ["document", "exercise"])

    programming = signals.get("programming") or {}
    syntax_issues = int(programming.get("syntax_issue_count") or 0)
    logic_issues = int(programming.get("logic_issue_count") or 0)
    if syntax_issues or logic_issues:
        weaknesses = []
        if syntax_issues:
            weaknesses.append(f"语法{syntax_issues}次")
        if logic_issues:
            weaknesses.append(f"逻辑{logic_issues}次")
        add(
            "编程薄弱模式：" + "、".join(weaknesses),
            "增加代码纠错示例、分步调试和渐进式编程任务",
            ["document", "exercise", "project"],
        )

    return suggestions


def build_generation_strategy_mapping(profile_data, signals=None, resource_types=None):
    """Build the explainable profile-to-generation mapping without database writes."""
    profile = {**build_empty_profile(profile_data.get("user_id") if profile_data else None), **(profile_data or {})}
    signals = signals or {}
    requested = set(resource_types or [])
    mappings = _strategy_suggestions(profile, signals)
    dimension_details = {
        key: _dimension_details(profile, signals, key, label)
        for key, label in DIMENSIONS
    }
    feature_dimensions = {
        "认知风格": "cognitive_style",
        "学习目标": "goal_orientation",
        "学习节奏": "learning_pace",
        "薄弱知识点": "error_patterns",
        "编程薄弱模式": "error_patterns",
    }
    for item in mappings:
        dimension_key = next(
            (key for prefix, key in feature_dimensions.items() if item["feature"].startswith(prefix)),
            None,
        )
        detail = dimension_details.get(dimension_key) or {}
        item["evidence"] = detail.get("evidence", ["画像已确认该特征"])
        item["judgement"] = item["feature"]
    if requested:
        mappings = [
            {**item, "affected_resources": [rtype for rtype in item["affected_resources"] if rtype in requested]}
            for item in mappings
        ]
        mappings = [item for item in mappings if item["affected_resources"]]

    weak_points = (signals.get("mistakes") or {}).get("top_knowledge_points") or []
    adopted_features = [item["feature"] for item in mappings]
    return {
        "summary": "；".join(f"{item['feature']} → {item['action']}" for item in mappings)
        or "现有证据不足，本次不添加未经证实的个性化规则",
        "adopted_features": adopted_features,
        "mappings": mappings,
        "weak_points": weak_points[:5],
        "requested_resources": list(resource_types or []),
    }


def build_profile_explainability(profile_data, signals=None):
    profile = {**build_empty_profile(profile_data.get("user_id") if profile_data else None), **(profile_data or {})}
    signals = signals or {}
    dimensions = [_dimension_details(profile, signals, key, label) for key, label in DIMENSIONS]
    completed = sum(1 for item in dimensions if item["is_complete"])
    unique_sources = sorted({source for item in dimensions for source in item["data_sources"]})
    confidence_values = [item["confidence"] for item in dimensions if item["is_complete"] or item["data_sources"]]
    updated_at = _latest_timestamp(*(item["updated_at"] for item in dimensions))
    return {
        "completeness_score": round(completed / len(DIMENSIONS) * 100),
        "confidence_score": round(sum(confidence_values) / len(confidence_values)) if confidence_values else 0,
        "source_count": len(unique_sources),
        "data_sources": unique_sources,
        "updated_at": updated_at,
        "dimensions": dimensions,
        "strategy_suggestions": _strategy_suggestions(profile, signals),
    }
