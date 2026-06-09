import json
import logging
import time
import uuid
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from src.services.multi_agent import AgentBase
from src.services.multi_agent.shared_state import (
    AgentStatus,
    AgentMessage,
    MessageType,
    SharedState,
    MessageBus,
    AgentMonitor,
    shared_state,
    message_bus,
    agent_monitor,
)
from src.services.multi_agent.exercise_agent import ExerciseAgent
from src.services.multi_agent.document_agent import DocumentAgent
from src.services.multi_agent.media_agent import MediaAgent
from src.services.multi_agent.recommendation_agent import RecommendationAgent
from src.services.multi_agent.project_agent import ProjectAgent
from src.services.knowledge_base_service import knowledge_base_service
from src.services.content_converter_service import content_converter_service

logger = logging.getLogger(__name__)

COORDINATOR_SYSTEM_PROMPT = """你是一位多智能体资源生成系统的协调者，负责分析学生需求、制定资源生成计划、协调各专业智能体工作、确保资源一致性。

## 你的职责
1. 分析学生画像和学习需求，确定资源生成策略
2. 将任务分解并分发给5个专业智能体
3. 协调各智能体的工作节奏和依赖关系
4. 检查各智能体生成资源的一致性
5. 整合所有资源，生成完整的学习资源包

## 智能体团队
- exercise_agent（习题设计专家）：生成个性化练习题目
- document_agent（课程文档专家）：生成课程讲解文档和知识笔记
- media_agent（多媒体教学专家）：生成视频脚本和动画描述
- recommendation_agent（资源推荐专家）：推荐拓展学习资源
- project_agent（实践项目设计专家）：设计实操案例和项目

## 协调策略
1. 并行生成：5个智能体可并行工作，互不依赖
2. 一致性保障：所有资源必须覆盖相同的知识点，难度匹配学生画像
3. 交叉引用：文档中提到的概念在习题中有对应练习，视频脚本与文档内容对齐
4. 质量检查：生成后进行一致性验证

## 输出格式
返回完整的资源包JSON：
{
  "package_id": "唯一标识",
  "topic": "主题",
  "student_profile_summary": "画像摘要",
  "generation_strategy": "生成策略说明",
  "resources": {
    "exercises": {...},
    "document": {...},
    "media": {...},
    "recommendations": {...},
    "project": {...}
  },
  "consistency_report": {
    "knowledge_coverage": "知识点覆盖一致性",
    "difficulty_alignment": "难度对齐一致性",
    "cross_reference_check": "交叉引用检查",
    "overall_score": 0-100
  },
  "metadata": {
    "total_generation_time_seconds": 0,
    "agents_used": [],
    "created_at": "时间戳"
  }
}"""

RESOURCE_TYPE_AGENT_MAP = {
    "exercise": "exercise_agent",
    "document": "document_agent",
    "media": "media_agent",
    "recommendation": "recommendation_agent",
    "project": "project_agent",
    "mindmap": "document_agent",
    "layered_exercise": "exercise_agent",
}

RESOURCE_TYPE_TASK_MAP = {
    "exercise": "generate_exercises",
    "document": "generate_course_document",
    "media": "generate_video_script",
    "recommendation": "generate_recommendations",
    "project": "generate_coding_project",
    "mindmap": "generate_mindmap_content",
    "layered_exercise": "generate_layered_exercises",
}


class CoordinatorAgent(AgentBase):
    agent_name = "coordinator"
    agent_role = "协调者"
    agent_description = "多智能体资源生成系统的协调中心，负责任务分发、一致性检查和资源整合"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)
        message_bus.register(self.agent_name)
        agent_monitor.register_agent(
            self.agent_name, self.agent_role, self.get_capabilities()
        )

        self.exercise_agent = ExerciseAgent(spark_service)
        self.document_agent = DocumentAgent(spark_service)
        self.media_agent = MediaAgent(spark_service)
        self.recommendation_agent = RecommendationAgent(spark_service)
        self.project_agent = ProjectAgent(spark_service)

        self._agents = {
            "exercise_agent": self.exercise_agent,
            "document_agent": self.document_agent,
            "media_agent": self.media_agent,
            "recommendation_agent": self.recommendation_agent,
            "project_agent": self.project_agent,
        }

        self._executor = ThreadPoolExecutor(max_workers=5)

    def get_capabilities(self):
        return [
            "generate_resource_package",
            "generate_single_resource",
            "consistency_check",
            "get_generation_status",
        ]

    def process(self, task):
        task_type = task.get("type")
        agent_monitor.update_status(
            self.agent_name, AgentStatus.RUNNING, task_type
        )
        try:
            if task_type == "generate_resource_package":
                result = self._generate_resource_package(task)
            elif task_type == "generate_single_resource":
                result = self._generate_single_resource(task)
            elif task_type == "consistency_check":
                result = self._consistency_check(task)
            elif task_type == "get_generation_status":
                result = self._get_generation_status(task)
            else:
                result = {"error": f"Unknown task type: {task_type}"}

            if "error" not in result:
                agent_monitor.update_status(
                    self.agent_name, AgentStatus.SUCCESS
                )
            else:
                agent_monitor.update_status(
                    self.agent_name, AgentStatus.FAILED
                )
            return result
        except Exception as e:
            logger.error(f"CoordinatorAgent error: {e}")
            agent_monitor.update_status(self.agent_name, AgentStatus.FAILED)
            return {"error": str(e)}

    def _generate_resource_package(self, task):
        start_time = time.time()
        package_id = f"pkg_{uuid.uuid4().hex[:12]}"

        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        resource_types = task.get(
            "resource_types",
            ["exercise", "document", "media", "recommendation", "project"],
        )
        options = task.get("options", {})
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get("user_id")
        _user_role = task.get("user_role")

        if course_id:
            kb_context = self._load_knowledge_base(course_id, chapter_ids)
            if kb_context:
                if not topic:
                    topic = kb_context.get("course_title", topic)
                if not knowledge_points and kb_context.get("knowledge_points_detail"):
                    knowledge_points = self._extract_kp_titles_from_context(kb_context)
                options["course_id"] = course_id
                options["chapter_ids"] = chapter_ids
        else:
            kb_context = None

        shared_state.update({
            f"{package_id}_topic": topic,
            f"{package_id}_profile": profile,
            f"{package_id}_status": "generating",
            f"{package_id}_kb_context": kb_context,
        }, self.agent_name)

        strategy = self._plan_generation_strategy(
            profile, topic, knowledge_points, resource_types, options
        )
        shared_state.set(
            f"{package_id}_strategy", strategy, self.agent_name
        )

        agent_task_groups = {}
        for rtype in resource_types:
            agent_name = RESOURCE_TYPE_AGENT_MAP.get(rtype)
            if not agent_name or agent_name not in self._agents:
                continue
            if agent_name not in agent_task_groups:
                agent_task_groups[agent_name] = []
            agent_task_groups[agent_name].append(rtype)

        futures = {}
        for agent_name, rtypes in agent_task_groups.items():
            agent = self._agents[agent_name]
            if len(rtypes) == 1:
                rtype = rtypes[0]
                agent_task = self._build_agent_task(
                    rtype, profile, topic, knowledge_points, options, user_id=_user_id, user_role=_user_role
                )
                future = self._executor.submit(self._safe_process, agent, agent_task)
                futures[rtype] = future
            else:
                for rtype in rtypes:
                    agent_task = self._build_agent_task(
                        rtype, profile, topic, knowledge_points, options, user_id=_user_id, user_role=_user_role
                    )
                    future = self._executor.submit(self._safe_process, agent, agent_task)
                    futures[rtype] = future

        results = {}
        errors = {}
        for rtype, future in futures.items():
            try:
                result = future.result(timeout=120)
                if "error" in result:
                    errors[rtype] = result["error"]
                else:
                    results[rtype] = result
            except Exception as e:
                errors[rtype] = str(e)
                logger.error(f"Agent failed for {rtype}: {e}")

        convertible_types = {"mindmap", "project", "document", "recommendation"}
        for rtype in convertible_types:
            if rtype in results:
                try:
                    results[rtype] = content_converter_service.convert(
                        rtype, results[rtype], topic=topic, options=options
                    )
                except Exception as e:
                    logger.warning(f"Auto-conversion failed for {rtype}: {e}")

        consistency_report = self._check_consistency(
            results, knowledge_points, profile
        )

        elapsed = round(time.time() - start_time, 2)

        package = {
            "package_id": package_id,
            "topic": topic,
            "student_profile_summary": self._summarize_profile(profile),
            "generation_strategy": strategy,
            "knowledge_base_used": bool(kb_context),
            "resources": results,
            "errors": errors if errors else None,
            "completeness_report": {
                "requested_types": resource_types,
                "generated_types": list(results.keys()),
                "failed_types": list(errors.keys()) if errors else [],
                "missing_types": [rt for rt in resource_types if rt not in results and rt not in errors],
                "skipped_types": [rt for rt in resource_types if RESOURCE_TYPE_AGENT_MAP.get(rt) is None],
                "completeness_rate": round(len(results) / len(resource_types) * 100, 1) if resource_types else 0,
                "is_complete": len(results) == len(resource_types),
            },
            "consistency_report": consistency_report,
            "metadata": {
                "total_generation_time_seconds": elapsed,
                "agents_used": list(results.keys()),
                "failed_agents": list(errors.keys()) if errors else [],
                "resource_types_requested": resource_types,
                "resource_types_generated": list(results.keys()),
                "course_id": course_id,
                "chapter_ids": chapter_ids,
                "created_at": datetime.utcnow().isoformat(),
            },
        }

        shared_state.update({
            f"{package_id}_result": package,
            f"{package_id}_status": "completed",
        }, self.agent_name)

        return package

    def _generate_single_resource(self, task):
        resource_type = task.get("resource_type", "")
        agent_name = RESOURCE_TYPE_AGENT_MAP.get(resource_type)
        if not agent_name or agent_name not in self._agents:
            return {"error": f"Unknown resource type: {resource_type}"}

        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        options = task.get("options", {})
        _user_id = task.get("user_id")
        _user_role = task.get("user_role")

        agent_task = self._build_agent_task(
            resource_type, profile, topic, knowledge_points, options, user_id=_user_id, user_role=_user_role
        )
        agent = self._agents[agent_name]
        result = self._safe_process(agent, agent_task)

        if "error" not in result and resource_type in ("mindmap", "project", "document"):
            try:
                result = content_converter_service.convert(
                    resource_type, result, topic=topic, options=options
                )
            except Exception as e:
                logger.warning(f"Auto-conversion failed for {resource_type}: {e}")

        return result

    def _consistency_check(self, task):
        resources = task.get("resources", {})
        knowledge_points = task.get("knowledge_points", [])
        profile = task.get("student_profile", {})
        return self._check_consistency(resources, knowledge_points, profile)

    def _get_generation_status(self, task):
        package_id = task.get("package_id", "")
        if not package_id:
            return {"error": "package_id required"}
        status = shared_state.get(f"{package_id}_status")
        result = shared_state.get(f"{package_id}_result")
        return {
            "package_id": package_id,
            "status": status,
            "result_available": result is not None,
        }

    def _plan_generation_strategy(
        self, profile, topic, knowledge_points, resource_types, options
    ):
        cognitive_style = profile.get("cognitive_style", "mixed")
        goal = profile.get("goal_orientation", "exam")
        learning_pace = profile.get("learning_pace", "moderate")

        strategy_parts = []
        style_strategies = {
            "visual": "视觉型学生：增加视频脚本和图表类资源权重，文档中增加可视化描述",
            "auditory": "听觉型学生：增加视频脚本中旁白讲解比例，推荐播客类资源",
            "kinesthetic": "动觉型学生：增加实操项目权重，习题中增加编程题比例",
            "reading": "阅读型学生：增加文档深度，推荐学术论文和技术博客",
            "mixed": "混合型学生：均衡分配各类资源",
        }
        strategy_parts.append(
            style_strategies.get(cognitive_style, style_strategies["mixed"])
        )

        goal_strategies = {
            "exam": "应试导向：习题侧重考点，文档标注重点，推荐真题资源",
            "career": "职业导向：项目侧重实际场景，推荐行业案例和技能资源",
            "hobby": "兴趣导向：内容增加趣味性，推荐探索性资源",
            "research": "研究导向：文档增加学术深度，推荐论文和研究方法",
        }
        strategy_parts.append(
            goal_strategies.get(goal, goal_strategies["exam"])
        )

        pace_strategies = {
            "fast": "快节奏：资源紧凑高效，信息密度高",
            "moderate": "适中节奏：标准编排，重点内容适当重复",
            "slow": "慢节奏：分段讲解，增加回顾和练习",
            "adaptive": "灵活节奏：提供可调节的资源组合",
        }
        strategy_parts.append(
            pace_strategies.get(learning_pace, pace_strategies["moderate"])
        )

        return "；".join(strategy_parts)

    def _build_agent_task(
        self, resource_type, profile, topic, knowledge_points, options, user_id=None, user_role=None
    ):
        task_type = RESOURCE_TYPE_TASK_MAP.get(resource_type, "")
        base_task = {
            "type": task_type,
            "student_profile": profile,
            "topic": topic,
            "knowledge_points": knowledge_points,
            "user_id": user_id,
            "user_role": user_role,
        }

        if options.get("course_id"):
            base_task["course_id"] = options["course_id"]
        if options.get("chapter_ids"):
            base_task["chapter_ids"] = options["chapter_ids"]

        if resource_type == "exercise":
            base_task.update({
                "count": options.get("exercise_count", 10),
                "difficulty": options.get("difficulty", 3),
            })
        elif resource_type == "document":
            base_task.update({
                "depth": options.get("document_depth", "intermediate"),
            })
        elif resource_type == "media":
            base_task.update({
                "duration_minutes": options.get("video_duration", 5),
                "video_type": options.get("video_type", "micro_lecture"),
            })
        elif resource_type == "recommendation":
            base_task.update({
                "count": options.get("recommendation_count", 8),
                "resource_types": options.get(
                    "resource_types",
                    ["paper", "blog", "project", "tutorial", "video", "book"],
                ),
            })
        elif resource_type == "project":
            base_task.update({
                "language": options.get("programming_language", "Python"),
                "difficulty": options.get("project_difficulty", "intermediate"),
            })
        elif resource_type == "mindmap":
            base_task.update({
                "depth": options.get("mindmap_depth", 3),
            })
        elif resource_type == "layered_exercise":
            base_task.update({
                "count": options.get("exercise_count", 12),
            })

        return base_task

    def _check_consistency(self, resources, knowledge_points, profile):
        if not resources:
            return {
                "knowledge_coverage": "无资源可检查",
                "difficulty_alignment": "无资源可检查",
                "cross_reference_check": "无资源可检查",
                "overall_score": 0,
            }

        coverage_score = self._check_knowledge_coverage(resources, knowledge_points)
        difficulty_score = self._check_difficulty_alignment(resources, profile)
        cross_ref_score = self._check_cross_references(resources)

        overall = round(
            (coverage_score * 0.4 + difficulty_score * 0.3 + cross_ref_score * 0.3), 1
        )

        return {
            "knowledge_coverage": f"覆盖率评分: {coverage_score}/100",
            "difficulty_alignment": f"难度对齐评分: {difficulty_score}/100",
            "cross_reference_check": f"交叉引用评分: {cross_ref_score}/100",
            "overall_score": overall,
        }

    def _check_knowledge_coverage(self, resources, knowledge_points):
        if not knowledge_points:
            return 80
        covered = set()
        for rtype, data in resources.items():
            content_str = json.dumps(data, ensure_ascii=False).lower()
            for kp in knowledge_points:
                if kp.lower() in content_str:
                    covered.add(kp)
        if not knowledge_points:
            return 80
        return round(len(covered) / len(knowledge_points) * 100, 1)

    def _check_difficulty_alignment(self, resources, profile):
        return 75

    def _check_cross_references(self, resources):
        if len(resources) <= 1:
            return 70
        topic_mentions = {}
        for rtype, data in resources.items():
            content_str = json.dumps(data, ensure_ascii=False)
            topic_mentions[rtype] = len(content_str)
        if all(v > 100 for v in topic_mentions.values()):
            return 80
        return 65

    def _summarize_profile(self, profile):
        if not profile:
            return "未提供学生画像"
        parts = []
        if profile.get("cognitive_style"):
            style_map = {
                "visual": "视觉型", "auditory": "听觉型",
                "kinesthetic": "动觉型", "reading": "阅读型", "mixed": "混合型",
            }
            parts.append(f"认知风格：{style_map.get(profile['cognitive_style'], profile['cognitive_style'])}")
        if profile.get("goal_orientation"):
            goal_map = {
                "exam": "应试导向", "career": "职业导向",
                "hobby": "兴趣导向", "research": "研究导向",
            }
            parts.append(f"学习目标：{goal_map.get(profile['goal_orientation'], profile['goal_orientation'])}")
        if profile.get("learning_pace"):
            pace_map = {
                "fast": "快速", "moderate": "适中",
                "slow": "慢速", "adaptive": "灵活",
            }
            parts.append(f"学习节奏：{pace_map.get(profile['learning_pace'], profile['learning_pace'])}")
        return "；".join(parts) if parts else "基础画像"

    def _safe_process(self, agent, task):
        try:
            return agent.process(task)
        except Exception as e:
            logger.error(f"Agent {agent.agent_name} crashed: {e}")
            return {"error": str(e)}

    def get_all_agents_status(self):
        return agent_monitor.get_status()

    def get_system_summary(self):
        return agent_monitor.get_summary()

    def get_message_log(self, limit=100):
        return message_bus.get_log(limit)

    def get_shared_state_snapshot(self):
        return shared_state.snapshot()

    def _load_knowledge_base(self, course_id, chapter_ids=None):
        try:
            ctx = knowledge_base_service.build_knowledge_context_for_prompt(
                course_id, chapter_ids
            )
            if ctx:
                logger.info(
                    f"Loaded KB context for course {course_id}: "
                    f"{ctx.get('statistics', {})}"
                )
            return ctx
        except Exception as e:
            logger.warning(f"Failed to load knowledge base for course {course_id}: {e}")
            return None

    def _extract_kp_titles_from_context(self, kb_context):
        titles = []
        kp_detail = kb_context.get("knowledge_points_detail", "")
        if kp_detail and kp_detail != "暂无":
            for line in kp_detail.split("\n"):
                line = line.strip()
                if line.startswith("【") and "】" in line:
                    title = line[1:line.index("】")]
                    titles.append(title)
        return titles
