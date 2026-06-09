import json
import logging
from datetime import datetime
from typing import Dict, List, Optional

from src.models.course import (
    Course,
    CourseGenerationConfig,
    CourseGenerationVersion,
    CourseReview,
    AIFeedback,
    TeachingContent,
    Assessment,
)
from src.models.user import db, User

logger = logging.getLogger(__name__)

GENERATION_STEPS = [
    {"step": 1, "name": "syllabus", "label": "教学大纲"},
    {"step": 2, "name": "core_content", "label": "核心内容"},
    {"step": 3, "name": "exercises", "label": "配套习题"},
    {"step": 4, "name": "materials", "label": "课件材料"},
]

MAX_VERSIONS_PER_STEP = 10


def create_config(teacher_id: int, data: Dict) -> CourseGenerationConfig:
    config = CourseGenerationConfig(
        teacher_id=teacher_id,
        course_id=data.get("course_id"),
        difficulty=data.get("difficulty", 3),
        duration=data.get("duration", 45),
        interaction_level=data.get("interaction_level", "medium"),
        video_ratio=data.get("video_ratio", 40),
        experiment_ratio=data.get("experiment_ratio", 30),
        discussion_ratio=data.get("discussion_ratio", 30),
        teaching_goal=data.get("teaching_goal", "normal"),
        custom_requirements=data.get("custom_requirements", ""),
        current_step=0,
        status="configuring",
    )
    db.session.add(config)
    db.session.commit()
    return config


def update_config(config_id: int, teacher_id: int, data: Dict) -> Optional[CourseGenerationConfig]:
    config = CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()
    if not config:
        return None
    for key in [
        "difficulty", "duration", "interaction_level",
        "video_ratio", "experiment_ratio", "discussion_ratio",
        "teaching_goal", "custom_requirements", "course_id",
    ]:
        if key in data:
            setattr(config, key, data[key])
    config.updated_at = datetime.utcnow()
    db.session.commit()
    return config


def get_config(config_id: int, teacher_id: int) -> Optional[CourseGenerationConfig]:
    return CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()


def get_teacher_configs(teacher_id: int) -> List[CourseGenerationConfig]:
    return CourseGenerationConfig.query.filter_by(teacher_id=teacher_id).order_by(
        CourseGenerationConfig.created_at.desc()
    ).all()


def _build_generation_prompt(config: CourseGenerationConfig, step_name: str, course: Course = None) -> str:
    course_title = course.title if course else "通用课程"
    course_desc = course.description if course else ""

    difficulty_map = {1: "入门级", 2: "初级", 3: "中级", 4: "高级", 5: "专家级"}
    interaction_map = {"low": "低频互动（以讲授为主）", "medium": "中频互动（讲授与互动结合）", "high": "高频互动（以互动讨论为主）"}
    goal_map = {"normal": "普通教学", "remedial": "学困生专项辅导", "advanced": "竞赛培优"}

    diff_label = difficulty_map.get(config.difficulty, "中级")
    inter_label = interaction_map.get(config.interaction_level, "中频互动")
    goal_label = goal_map.get(config.teaching_goal, "普通教学")

    base = f"""你是一位专业的课程设计专家。请根据以下参数生成课程内容：

课程名称：{course_title}
课程描述：{course_desc or '暂无'}
难度等级：{diff_label}（{config.difficulty}/5）
课时长度：{config.duration}分钟
互动频次：{inter_label}
教学资源占比：视频{config.video_ratio}%、实验{config.experiment_ratio}%、讨论{config.discussion_ratio}%
教学目标：{goal_label}"""

    if config.custom_requirements:
        base += f"\n特殊要求：{config.custom_requirements}"

    step_prompts = {
        "syllabus": f"""{base}

请生成该课程的【教学大纲】，要求：
1. 包含课程总体目标（3-5个知识点目标）
2. 按章节/模块划分，每个模块包含：模块名称、教学目标、课时分配、教学方式
3. 总课时数与设定一致（{config.duration}分钟）
4. 格式清晰，使用Markdown格式输出""",

        "core_content": f"""{base}

请生成该课程的【核心教学内容】，要求：
1. 针对教学大纲中的每个模块，展开详细教学内容
2. 包含核心概念讲解、关键步骤说明、常见误区提醒
3. 根据难度等级调整内容深度
4. 适合{config.duration}分钟课时使用
5. 格式清晰，使用Markdown格式输出""",

        "exercises": f"""{base}

请生成该课程的【配套习题】，要求：
1. 每个模块至少3道习题，包含选择题、填空题、简答题
2. 题目难度与课程难度等级匹配
3. 每道题提供标准答案和详细解析
4. 返回严格JSON数组格式，每题包含：question, type, options(选择题), answer, explanation, difficulty, score
5. 总分100分""",

        "materials": f"""{base}

请生成该课程的【课件材料建议】，要求：
1. 列出每个模块需要的课件类型（PPT/视频/实验指导/讨论提纲）
2. 根据资源占比（视频{config.video_ratio}%、实验{config.experiment_ratio}%、讨论{config.discussion_ratio}%）分配各类型材料数量
3. 每个课件材料包含：标题、类型、内容要点、预计时长
4. 格式清晰，使用Markdown格式输出""",
    }

    return step_prompts.get(step_name, base)


def generate_step_content(config_id: int, teacher_id: int, step: int, user_id: int = None, user_role: str = None) -> Dict:
    config = CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()
    if not config:
        return {"error": "Configuration not found"}

    if step < 1 or step > 4:
        return {"error": "Invalid step number (1-4)"}

    step_info = GENERATION_STEPS[step - 1]
    course = Course.query.get(config.course_id) if config.course_id else None

    from src.services.spark_service import spark_service

    prompt = _build_generation_prompt(config, step_info["name"], course)

    try:
        if step_info["name"] == "exercises":
            content = spark_service.generate_assessment(
                course_title=course.title if course else "通用课程",
                topic=prompt[:500],
                question_count=5,
                user_id=user_id,
                user_role=user_role,
            )
        else:
            content = spark_service.generate_teaching_content(
                course_title=course.title if course else "通用课程",
                topic=prompt[:800],
                user_id=user_id,
                user_role=user_role,
            )
    except Exception as e:
        logger.error(f"AI generation error for step {step}: {e}")
        content = f"生成失败，请重试。错误信息：{str(e)}"

    existing_versions = CourseGenerationVersion.query.filter_by(
        config_id=config_id, step=step
    ).order_by(CourseGenerationVersion.version_number.desc()).all()

    version_number = 1
    if existing_versions:
        version_number = existing_versions[0].version_number + 1

    if len(existing_versions) >= MAX_VERSIONS_PER_STEP:
        oldest = CourseGenerationVersion.query.filter_by(
            config_id=config_id, step=step
        ).order_by(CourseGenerationVersion.version_number.asc()).first()
        if oldest:
            db.session.delete(oldest)

    version = CourseGenerationVersion(
        config_id=config_id,
        step=step,
        step_name=step_info["name"],
        content=content,
        version_number=version_number,
        change_summary=f"AI生成{step_info['label']}",
    )
    db.session.add(version)

    config.current_step = step
    config.status = "generating"
    db.session.commit()

    return {
        "config": config.to_dict(),
        "version": version.to_dict(),
        "step_info": step_info,
    }


def confirm_step(config_id: int, teacher_id: int, step: int, modified_content: str = None, change_summary: str = "") -> Dict:
    config = CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()
    if not config:
        return {"error": "Configuration not found"}

    latest_version = CourseGenerationVersion.query.filter_by(
        config_id=config_id, step=step
    ).order_by(CourseGenerationVersion.version_number.desc()).first()

    if not latest_version:
        return {"error": "No content found for this step"}

    if modified_content and modified_content != latest_version.content:
        original_content = latest_version.content
        existing_versions = CourseGenerationVersion.query.filter_by(
            config_id=config_id, step=step
        ).order_by(CourseGenerationVersion.version_number.desc()).all()

        version_number = existing_versions[0].version_number + 1 if existing_versions else 1

        if len(existing_versions) >= MAX_VERSIONS_PER_STEP:
            oldest = CourseGenerationVersion.query.filter_by(
                config_id=config_id, step=step
            ).order_by(CourseGenerationVersion.version_number.asc()).first()
            if oldest:
                db.session.delete(oldest)

        new_version = CourseGenerationVersion(
            config_id=config_id,
            step=step,
            step_name=latest_version.step_name,
            content=modified_content,
            version_number=version_number,
            change_summary=change_summary or "教师手动修改",
        )
        db.session.add(new_version)

        feedback = AIFeedback(
            config_id=config_id,
            original_content=original_content[:5000],
            modified_content=modified_content[:5000],
            modification_type=f"step_{step}_edit",
            feedback_text=change_summary,
        )
        db.session.add(feedback)

    if step >= 4:
        config.status = "reviewing"
    else:
        config.status = "generating"

    config.current_step = step
    db.session.commit()

    return {"config": config.to_dict(), "confirmed_step": step}


def get_step_versions(config_id: int, step: int) -> List[Dict]:
    versions = CourseGenerationVersion.query.filter_by(
        config_id=config_id, step=step
    ).order_by(CourseGenerationVersion.version_number.desc()).all()
    return [v.to_dict() for v in versions]


def get_version_diff(config_id: int, step: int, version_a: int, version_b: int) -> Dict:
    va = CourseGenerationVersion.query.filter_by(config_id=config_id, step=step, version_number=version_a).first()
    vb = CourseGenerationVersion.query.filter_by(config_id=config_id, step=step, version_number=version_b).first()
    if not va or not vb:
        return {"error": "Version not found"}
    return {
        "version_a": va.to_dict(),
        "version_b": vb.to_dict(),
    }


def rollback_to_version(config_id: int, step: int, version_number: int, teacher_id: int) -> Dict:
    config = CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()
    if not config:
        return {"error": "Configuration not found"}

    target = CourseGenerationVersion.query.filter_by(
        config_id=config_id, step=step, version_number=version_number
    ).first()
    if not target:
        return {"error": "Version not found"}

    existing = CourseGenerationVersion.query.filter_by(
        config_id=config_id, step=step
    ).order_by(CourseGenerationVersion.version_number.desc()).all()

    new_version_number = existing[0].version_number + 1 if existing else 1

    if len(existing) >= MAX_VERSIONS_PER_STEP:
        oldest = CourseGenerationVersion.query.filter_by(
            config_id=config_id, step=step
        ).order_by(CourseGenerationVersion.version_number.asc()).first()
        if oldest:
            db.session.delete(oldest)

    new_version = CourseGenerationVersion(
        config_id=config_id,
        step=step,
        step_name=target.step_name,
        content=target.content,
        version_number=new_version_number,
        change_summary=f"回滚至版本{version_number}",
    )
    db.session.add(new_version)
    db.session.commit()

    return {"version": new_version.to_dict()}


def submit_for_review(config_id: int, teacher_id: int) -> Dict:
    config = CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()
    if not config:
        return {"error": "Configuration not found"}

    config.status = "approved"
    db.session.commit()

    review = CourseReview(
        config_id=config_id,
        reviewer_id=teacher_id,
        review_type="self_review",
        status="approved",
        comment="教师自审通过",
        reviewed_at=datetime.utcnow(),
    )
    db.session.add(review)
    db.session.commit()

    return {"config": config.to_dict(), "review": review.to_dict()}


def approve_review(config_id: int, reviewer_id: int, review_id: int, status: str, comment: str = "", score: int = None) -> Dict:
    review = CourseReview.query.filter_by(id=review_id, config_id=config_id, reviewer_id=reviewer_id).first()
    if not review:
        return {"error": "Review not found"}

    review.status = status
    review.comment = comment
    review.score = score
    review.reviewed_at = datetime.utcnow()

    if status == "approved":
        config = CourseGenerationConfig.query.get(config_id)
        if config:
            config.status = "approved"

    db.session.commit()
    return {"review": review.to_dict()}


def share_for_peer_review(config_id: int, teacher_id: int, target_teacher_ids: List[int]) -> Dict:
    config = CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()
    if not config:
        return {"error": "Configuration not found"}

    config.status = "peer_reviewing"

    created = []
    for tid in target_teacher_ids:
        if tid == teacher_id:
            continue
        existing = CourseReview.query.filter_by(config_id=config_id, reviewer_id=tid, review_type="peer_review").first()
        if existing:
            continue
        review = CourseReview(
            config_id=config_id,
            reviewer_id=tid,
            review_type="peer_review",
            status="pending",
        )
        db.session.add(review)
        created.append(tid)

    db.session.commit()
    return {"shared_with": created, "count": len(created)}


def get_peer_reviews(config_id: int) -> List[Dict]:
    reviews = CourseReview.query.filter_by(config_id=config_id, review_type="peer_review").order_by(
        CourseReview.reviewed_at.desc()
    ).all()
    return [r.to_dict() for r in reviews]


def get_pending_reviews_for_teacher(teacher_id: int) -> List[Dict]:
    reviews = CourseReview.query.filter_by(reviewer_id=teacher_id, review_type="peer_review", status="pending").all()
    result = []
    for r in reviews:
        config = CourseGenerationConfig.query.get(r.config_id)
        result.append({
            "review": r.to_dict(),
            "config": config.to_dict() if config else None,
        })
    return result


def finalize_course(config_id: int, teacher_id: int) -> Dict:
    config = CourseGenerationConfig.query.filter_by(id=config_id, teacher_id=teacher_id).first()
    if not config:
        return {"error": "Configuration not found"}

    if config.status != "approved":
        return {"error": "Course must be approved before finalization"}

    if not config.course_id:
        return {"error": "请先关联课程后再定稿"}

    versions = CourseGenerationVersion.query.filter_by(config_id=config_id).order_by(
        CourseGenerationVersion.step, CourseGenerationVersion.version_number.desc()
    ).all()

    latest_by_step = {}
    for v in versions:
        if v.step not in latest_by_step:
            latest_by_step[v.step] = v

    course = Course.query.get(config.course_id) if config.course_id else None
    course_title = course.title if course else "新课程"

    created_items = []
    for step_num in sorted(latest_by_step.keys()):
        v = latest_by_step[step_num]
        if v.step_name == "syllabus":
            tc = TeachingContent(
                course_id=config.course_id,
                title=f"{course_title} - 教学大纲",
                content=v.content,
                generated_by_llm=True,
            )
            db.session.add(tc)
            created_items.append(f"TeachingContent: {tc.title}")
        elif v.step_name == "core_content":
            tc = TeachingContent(
                course_id=config.course_id,
                title=f"{course_title} - 核心教学内容",
                content=v.content,
                generated_by_llm=True,
            )
            db.session.add(tc)
            created_items.append(f"TeachingContent: {tc.title}")
        elif v.step_name == "exercises":
            assessment = Assessment(
                course_id=config.course_id,
                title=f"{course_title} - 配套习题",
                questions=v.content,
            )
            db.session.add(assessment)
            created_items.append(f"Assessment: {assessment.title}")
        elif v.step_name == "materials":
            tc = TeachingContent(
                course_id=config.course_id,
                title=f"{course_title} - 课件材料",
                content=v.content,
                generated_by_llm=True,
            )
            db.session.add(tc)
            created_items.append(f"TeachingContent: {tc.title}")

    config.status = "finalized"
    db.session.commit()

    return {
        "config": config.to_dict(),
        "created_items": created_items,
    }
