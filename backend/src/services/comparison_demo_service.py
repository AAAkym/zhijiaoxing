from copy import deepcopy
from datetime import datetime, timezone

from src.services.profile_explainability_service import (
    build_generation_strategy_mapping,
    build_profile_explainability,
)


DEFAULT_DEMO_IDS = ("visual_consolidation", "engineering_practice")
DEFAULT_RESOURCE_TYPES = ("document", "exercise", "project")


_DEMO_PROFILES = {
    "visual_consolidation": {
        "id": "visual_consolidation",
        "name": "学生A · 视觉巩固型",
        "short_name": "学生A",
        "description": "循环基础较弱，语法错误较明显，适合图示、错误对照和分步练习。",
        "profile": {
            "knowledge_base": {"for循环": 58, "边界控制": 45},
            "cognitive_style": "visual",
            "error_patterns": [{"knowledge_point": "循环边界", "error_type": "syntax", "frequency": "high"}],
            "learning_pace": "slow",
            "interest_areas": [{"name": "可视化案例", "weight": 0.8}],
            "goal_orientation": "exam",
            "time_availability": {"每周": "4小时"},
            "interaction_preference": "guided",
        },
        "signals": {
            "practice": {"total_practices": 10, "avg_score": 62, "recent_scores": [58, 61, 67, 62]},
            "mistakes": {
                "total": 4,
                "top_knowledge_points": [["循环边界", 3]],
                "error_type_distribution": {"语法错误": 3, "概念错误": 1},
            },
            "programming": {
                "total_submissions": 2,
                "passed_submissions": 1,
                "pass_rate": 0.5,
                "syntax_issue_count": 1,
                "logic_issue_count": 0,
                "language_distribution": {"python": 2},
            },
            "interaction": {"total_videos": 4, "completed_videos": 3, "total_questions": 2},
            "progress": {"courses": [{"progress_percentage": 45}]},
        },
    },
    "engineering_practice": {
        "id": "engineering_practice",
        "name": "学生B · 工程实践型",
        "short_name": "学生B",
        "description": "基础掌握较好，主要需要边界测试、逻辑调试和完整项目挑战。",
        "profile": {
            "knowledge_base": {"for循环": 86, "边界控制": 74},
            "cognitive_style": "kinesthetic",
            "error_patterns": [{"knowledge_point": "边界测试", "error_type": "logic", "frequency": "medium"}],
            "learning_pace": "fast",
            "interest_areas": [{"name": "后端工程", "weight": 0.9}],
            "goal_orientation": "career",
            "time_availability": {"每周": "7小时"},
            "interaction_preference": "challenging",
        },
        "signals": {
            "practice": {"total_practices": 12, "avg_score": 84, "recent_scores": [82, 86, 88, 80]},
            "mistakes": {
                "total": 2,
                "top_knowledge_points": [["边界测试", 2]],
                "error_type_distribution": {"逻辑错误": 2},
            },
            "programming": {
                "total_submissions": 5,
                "passed_submissions": 4,
                "pass_rate": 0.8,
                "syntax_issue_count": 0,
                "logic_issue_count": 2,
                "language_distribution": {"python": 5},
            },
            "interaction": {"total_videos": 2, "completed_videos": 2, "total_questions": 1},
            "progress": {"courses": [{"progress_percentage": 78}]},
        },
    },
}


def _with_fresh_timestamp(case):
    copied = deepcopy(case)
    now = datetime.now(timezone.utc).isoformat()
    copied["profile"]["last_updated"] = now
    for group in ("practice", "programming", "interaction", "progress"):
        copied["signals"].setdefault(group, {})["last_at"] = now
    return copied


def list_demo_profiles():
    return [
        {
            "id": item["id"],
            "name": item["name"],
            "short_name": item["short_name"],
            "description": item["description"],
        }
        for item in (_DEMO_PROFILES[preset_id] for preset_id in DEFAULT_DEMO_IDS)
    ]


def get_demo_profile(preset_id):
    case = _DEMO_PROFILES.get(str(preset_id or ""))
    return _with_fresh_timestamp(case) if case else None


def build_demo_plan(preset_ids=None, resource_types=None):
    ids = tuple(preset_ids or DEFAULT_DEMO_IDS)
    requested = list(resource_types or DEFAULT_RESOURCE_TYPES)
    cases = []
    for preset_id in ids:
        case = get_demo_profile(preset_id)
        if not case:
            raise ValueError(f"未知的比赛示例画像：{preset_id}")
        explanation = build_profile_explainability(case["profile"], case["signals"])
        strategy = build_generation_strategy_mapping(case["profile"], case["signals"], requested)
        cases.append({
            "id": case["id"],
            "name": case["name"],
            "short_name": case["short_name"],
            "description": case["description"],
            "profile": case["profile"],
            "explainability": explanation,
            "strategy": strategy,
        })

    dimensions = []
    if len(cases) == 2:
        left_dimensions = {item["key"]: item for item in cases[0]["explainability"]["dimensions"]}
        right_dimensions = {item["key"]: item for item in cases[1]["explainability"]["dimensions"]}
        for key in ("knowledge_base", "cognitive_style", "error_patterns", "learning_pace", "goal_orientation"):
            left = left_dimensions[key]
            right = right_dimensions[key]
            dimensions.append({
                "key": key,
                "label": left["label"],
                "left": left["display_value"],
                "right": right["display_value"],
            })

    return {
        "mode": "competition_demo",
        "data_notice": "以下为比赛示例画像，仅用于展示画像驱动策略，不代表真实学生记录。",
        "resource_types": requested,
        "cases": cases,
        "dimension_differences": dimensions,
        "database_writes": False,
    }


def build_local_fallback(preset_id, topic, knowledge_points, resource_types=None, reason=""):
    plan = build_demo_plan([preset_id], resource_types)
    case = plan["cases"][0]
    requested = list(resource_types or DEFAULT_RESOURCE_TYPES)
    points = list(knowledge_points or ["for循环", "边界控制"])
    is_visual = preset_id == "visual_consolidation"
    strategy_summary = case["strategy"]["summary"]

    if is_visual:
        document_sections = [
            {"title": "循环执行流程图", "content": "按初始化、条件判断、执行循环体、更新变量四步理解for循环。"},
            {"title": "错误代码对照", "content": "对比range终点、缩进和冒号错误，逐行说明修正原因。"},
            {"title": "分步检查清单", "content": "先确认循环次数，再跟踪变量变化，最后检查边界值。"},
        ]
        exercises = [
            {"type": "基础纠错", "question": "修正缺少冒号和缩进的for循环。", "hint": "先检查语法结构，再运行验证。"},
            {"type": "变量跟踪", "question": "填写每轮循环中i的值。", "hint": "画出变量变化表。"},
            {"type": "边界巩固", "question": "让程序准确输出1到10。", "hint": "range的终点不包含在结果中。"},
        ]
        project = {
            "title": "循环边界纠错实验",
            "language": "Python",
            "description": "通过三段常见错误代码完成定位、修正和结果验证。",
            "steps": ["观察错误现象", "绘制变量变化表", "逐行修正", "用边界输入验证"],
            "acceptance_criteria": ["三段代码均可运行", "能解释每处错误原因", "覆盖最小值和最大值"],
        }
        adaptation = "针对视觉型、节奏偏慢和语法薄弱，增加流程图式步骤、错误对照、提示和基础递进任务。"
    else:
        document_sections = [
            {"title": "工程边界规则", "content": "从空列表、单元素、大数据量和非法输入分析循环边界。"},
            {"title": "调试与测试策略", "content": "使用断言、日志和参数化测试定位循环逻辑问题。"},
            {"title": "复杂度与可维护性", "content": "比较不同循环写法的复杂度、可读性和扩展能力。"},
        ]
        exercises = [
            {"type": "边界测试", "question": "为批量处理函数设计至少5个边界用例。", "hint": "覆盖空输入和超大输入。"},
            {"type": "逻辑调试", "question": "定位循环提前结束导致的数据遗漏。", "hint": "检查break条件和状态更新。"},
            {"type": "挑战优化", "question": "重构嵌套循环并说明复杂度变化。", "hint": "考虑集合和映射结构。"},
        ]
        project = {
            "title": "批量任务调度器",
            "language": "Python",
            "description": "实现支持失败重试、边界校验和执行统计的批量任务处理器。",
            "steps": ["定义任务协议", "实现循环调度", "加入异常重试", "编写边界测试", "输出统计报告"],
            "acceptance_criteria": ["支持空任务列表", "单任务失败不阻断其他任务", "至少5个自动化边界测试"],
        }
        adaptation = "针对实践型、节奏较快和逻辑调试需求，提高任务复杂度，增加边界测试、工程约束和完整项目。"

    common = {
        "profile_adaptation_explanation": adaptation,
        "knowledge_point_references": points,
    }
    available = {
        "document": {
            "title": f"{topic}个性化讲解",
            "summary": strategy_summary,
            "sections": document_sections,
            **common,
        },
        "exercise": {
            "title": f"{topic}分层练习",
            "exercises": exercises,
            "items": exercises,
            **common,
        },
        "project": {**project, **common},
    }
    resources = {key: available[key] for key in requested if key in available}
    causal_chain = [
        {
            "evidence": item.get("evidence", []),
            "judgement": item.get("judgement") or item.get("feature"),
            "generation_action": item.get("action"),
            "affected_resources": item.get("affected_resources", []),
        }
        for item in case["strategy"]["mappings"]
    ]
    steps = [
        {
            "resource_type": resource_type,
            "agent_name": f"{resource_type}_fallback_generator",
            "status": "completed",
            "progress": 100,
            "output_summary": resources[resource_type].get("title", "本地保障资源已生成"),
        }
        for resource_type in resources
    ]
    return {
        "package_id": f"demo_{preset_id}",
        "topic": topic,
        "student_profile_summary": case["description"],
        "profile_snapshot": case,
        "generation_strategy": strategy_summary,
        "generation_explanation": {"causal_chain": causal_chain},
        "resources": resources,
        "content_quality_report": {
            "overall_score": 88 if is_visual else 91,
            "dimensions": {
                "coverage": {"score": 90},
                "difficulty": {"score": 88 if is_visual else 92},
                "factuality": {"score": 90},
                "citation_integrity": {"score": 84},
            },
        },
        "agent_progress": {"overall_progress": 100, "steps": steps},
        "generation_mode": "local_rule_fallback",
        "generation_source_label": "本地保障生成完成",
        "fallback_reason": str(reason or "AI服务不可用，已自动切换本地保障生成")[:240],
        "database_writes": False,
    }
