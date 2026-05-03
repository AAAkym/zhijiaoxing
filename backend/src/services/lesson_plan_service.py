import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

from src.models.user import db
from src.models.course import Course, TeachingContent, Assessment
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)

LESSON_PLAN_SECTIONS = [
    {"section": "objectives", "label": "教学目标"},
    {"section": "key_points", "label": "重点难点"},
    {"section": "teaching_process", "label": "教学过程"},
    {"section": "interaction_design", "label": "互动设计"},
    {"section": "assessment_design", "label": "评价设计"},
    {"section": "reflection", "label": "教学反思"},
]


def generate_lesson_plan(
    course_id: int,
    topic: str,
    duration: int = 45,
    difficulty: str = "medium",
    teaching_style: str = "lecture",
    student_level: str = "intermediate",
    custom_requirements: str = "",
) -> Dict:
    course = Course.query.get(course_id)
    if not course:
        return {"error": "课程不存在"}

    course_title = course.title
    course_desc = course.description or ""

    contents = []
    for tc in getattr(course, 'teaching_contents', [])[:5]:
        contents.append(f"- {tc.title}: {(tc.content or '')[:300]}")
    knowledge_base = "\n".join(contents) or course_desc

    prompt = _build_lesson_plan_prompt(
        course_title, course_desc, topic, duration,
        difficulty, teaching_style, student_level,
        custom_requirements, knowledge_base,
    )

    try:
        raw = spark_service.chat(prompt)
        plan = _parse_lesson_plan(raw, topic)
    except Exception as e:
        logger.error("AI lesson plan generation failed: %s", e)
        plan = _fallback_lesson_plan(topic, duration, difficulty)

    plan["course_id"] = course_id
    plan["course_title"] = course_title
    plan["topic"] = topic
    plan["duration"] = duration
    plan["difficulty"] = difficulty
    plan["teaching_style"] = teaching_style
    plan["student_level"] = student_level
    plan["generated_at"] = datetime.utcnow().isoformat()

    return plan


def generate_lesson_plan_section(
    course_id: int,
    topic: str,
    section_name: str,
    existing_plan: Dict = None,
    duration: int = 45,
    difficulty: str = "medium",
) -> Dict:
    course = Course.query.get(course_id)
    if not course:
        return {"error": "课程不存在"}

    section_info = next(
        (s for s in LESSON_PLAN_SECTIONS if s["section"] == section_name), None
    )
    if not section_info:
        return {"error": f"无效的教案板块: {section_name}"}

    context = ""
    if existing_plan:
        for key, val in existing_plan.items():
            if key != section_name and isinstance(val, (str, dict)):
                context += f"\n【{key}】: {json.dumps(val, ensure_ascii=False) if isinstance(val, dict) else val}"

    prompt = f"""你是资深教学设计专家。请为以下课程生成教案的【{section_info['label']}】板块。

课程：{course.title}
主题：{topic}
时长：{duration}分钟
难度：{difficulty}

{'已有教案上下文：' + context[:1500] if context else ''}

请严格以JSON格式输出，字段名为"{section_name}"，内容为该板块的详细设计。
只输出JSON，不要输出其他内容。"""

    try:
        raw = spark_service.chat(prompt)
        cleaned = raw.strip()
        import re
        cleaned = re.sub(r'^```(?:json)?', '', cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'```$', '', cleaned).strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return {"section": section_name, "content": parsed.get(section_name, parsed)}
        return {"section": section_name, "content": parsed}
    except Exception as e:
        logger.error("Section generation failed: %s", e)
        return {"section": section_name, "content": f"请手动填写{section_info['label']}"}


def _build_lesson_plan_prompt(
    course_title, course_desc, topic, duration,
    difficulty, teaching_style, student_level,
    custom_requirements, knowledge_base,
) -> str:
    style_map = {
        "lecture": "讲授式（以教师讲授为主，配合板书和演示）",
        "interactive": "互动式（师生互动讨论，启发式教学）",
        "flipped": "翻转课堂（课前预习+课中讨论+课后巩固）",
        "project": "项目式（以项目任务驱动学习）",
        "hybrid": "混合式（讲授+互动+实践结合）",
    }
    level_map = {
        "beginner": "初学者（零基础或基础薄弱）",
        "intermediate": "中级（有一定基础）",
        "advanced": "高级（基础扎实，追求深入）",
    }
    diff_map = {
        "easy": "简单", "medium": "中等", "hard": "困难",
    }

    style_label = style_map.get(teaching_style, style_map["hybrid"])
    level_label = level_map.get(student_level, level_map["intermediate"])
    diff_label = diff_map.get(difficulty, "中等")

    return f"""你是资深教学设计专家。请为以下课程生成完整的教案。

课程名称：{course_title}
课程简介：{course_desc or '暂无'}
教学主题：{topic}
课时长度：{duration}分钟
难度等级：{diff_label}
教学风格：{style_label}
学生水平：{level_label}
{f'特殊要求：{custom_requirements}' if custom_requirements else ''}

参考知识库：
{knowledge_base[:2000]}

请严格以JSON格式输出完整教案，包含以下字段：
{{
  "title": "教案标题",
  "objectives": {{
    "knowledge": ["知识目标1", "知识目标2"],
    "ability": ["能力目标1", "能力目标2"],
    "emotion": ["情感目标1"]
  }},
  "key_points": {{
    "key": ["教学重点1", "教学重点2"],
    "difficulty": ["教学难点1", "教学难点2"],
    "solutions": ["突破方案1", "突破方案2"]
  }},
  "teaching_process": [
    {{
      "phase": "导入",
      "duration_minutes": 5,
      "activities": "活动描述",
      "teacher_actions": "教师活动",
      "student_actions": "学生活动",
      "resources": "所需资源"
    }},
    {{
      "phase": "新授",
      "duration_minutes": 25,
      "activities": "活动描述",
      "teacher_actions": "教师活动",
      "student_actions": "学生活动",
      "resources": "所需资源"
    }},
    {{
      "phase": "练习",
      "duration_minutes": 10,
      "activities": "活动描述",
      "teacher_actions": "教师活动",
      "student_actions": "学生活动",
      "resources": "所需资源"
    }},
    {{
      "phase": "总结",
      "duration_minutes": 5,
      "activities": "活动描述",
      "teacher_actions": "教师活动",
      "student_actions": "学生活动",
      "resources": "所需资源"
    }}
  ],
  "interaction_design": [
    {{
      "type": "提问/讨论/小组活动/实验",
      "timing": "时间节点",
      "description": "互动描述",
      "expected_outcome": "预期效果"
    }}
  ],
  "assessment_design": {{
    "formative": ["过程性评价方式1", "过程性评价方式2"],
    "summative": ["总结性评价方式1"],
    "rubric": "评价标准描述"
  }},
  "reflection": {{
    "anticipated_challenges": ["预期挑战1"],
    "improvement_ideas": ["改进思路1"],
    "follow_up": "课后延伸建议"
  }}
}}

只输出JSON，不要输出其他内容。各阶段时长总和必须等于{duration}分钟。"""


def _parse_lesson_plan(raw: str, topic: str) -> Dict:
    import re
    cleaned = raw.strip()
    cleaned = re.sub(r'^```(?:json)?', '', cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'```$', '', cleaned).strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass
    match = re.search(r'\{.*\}', cleaned, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return _fallback_lesson_plan(topic, 45, "medium")


def _fallback_lesson_plan(topic: str, duration: int, difficulty: str) -> Dict:
    return {
        "title": f"{topic}教案",
        "objectives": {
            "knowledge": [f"掌握{topic}的基本概念和核心原理"],
            "ability": [f"能够运用{topic}解决实际问题"],
            "emotion": ["培养科学思维和学习兴趣"],
        },
        "key_points": {
            "key": [f"{topic}的核心概念", f"{topic}的关键方法"],
            "difficulty": [f"{topic}的抽象理解", f"{topic}的灵活应用"],
            "solutions": ["通过实例演示降低理解难度", "分层练习逐步提升"],
        },
        "teaching_process": [
            {"phase": "导入", "duration_minutes": 5, "activities": "情境导入，激发兴趣", "teacher_actions": "展示生活实例，提出问题", "student_actions": "观察思考，回答问题", "resources": "多媒体课件"},
            {"phase": "新授", "duration_minutes": max(15, duration - 20), "activities": "核心知识讲解与演示", "teacher_actions": "系统讲解，示范操作", "student_actions": "听讲记录，参与讨论", "resources": "课件、演示工具"},
            {"phase": "练习", "duration_minutes": 10, "activities": "巩固练习与反馈", "teacher_actions": "布置练习，巡回指导", "student_actions": "独立完成，交流讨论", "resources": "练习题"},
            {"phase": "总结", "duration_minutes": 5, "activities": "课堂总结与拓展", "teacher_actions": "归纳要点，布置作业", "student_actions": "整理笔记，提出疑问", "resources": "作业单"},
        ],
        "interaction_design": [
            {"type": "提问", "timing": "导入环节", "description": "通过问题引导思考", "expected_outcome": "激发学习兴趣"},
            {"type": "讨论", "timing": "新授环节", "description": "小组讨论核心概念", "expected_outcome": "深化理解"},
        ],
        "assessment_design": {
            "formative": ["课堂提问", "练习反馈"],
            "summative": ["课后作业"],
            "rubric": "根据理解深度和应用能力综合评定",
        },
        "reflection": {
            "anticipated_challenges": ["学生基础差异较大"],
            "improvement_ideas": ["分层教学，因材施教"],
            "follow_up": "下节课继续深化拓展",
        },
    }
