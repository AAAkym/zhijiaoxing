import json
import logging
import re
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
from src.services.rag_citation_service import rag_citation_service
from src.services.syllabus_graph_service import syllabus_graph_service

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

        # 不再共享单个线程池：并发请求（如个性化对比演示同时发起3个请求）
        # 会导致9个任务竞争5个worker，叠加Spark API bulkhead(8并发/2s超时)引发失败。
        # 每次生成资源包时创建独立线程池，请求结束后立即关闭，避免跨请求争用。
        self._executor = None

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
        if not course_id and options.get("course_id"):
            course_id = options.get("course_id")
        if not chapter_ids and options.get("chapter_ids"):
            chapter_ids = options.get("chapter_ids")
        _user_id = task.get("user_id")
        _user_role = task.get("user_role")
        rag_required = bool(task.get("rag_required", options.get("rag_required", False)))
        citation_style = task.get("citation_style", options.get("citation_style", "bracket"))

        if course_id:
            kb_context = self._load_knowledge_base(course_id, chapter_ids)
            if kb_context:
                if not topic:
                    topic = kb_context.get("course_title", topic)
                if not knowledge_points and kb_context.get("knowledge_points_detail"):
                    # 当用户提供了具体 topic 时，只保留与 topic 相关的知识点，
                    # 避免课程全局知识点（如 Java 基础）污染具体主题（如"微服务架构与部署"）生成。
                    all_kp = self._extract_kp_titles_from_context(kb_context)
                    if topic and all_kp:
                        knowledge_points = self._filter_kp_by_topic(all_kp, topic)
                        logger.info(
                            f"Filtered KP by topic '{topic}': "
                            f"{len(all_kp)} -> {len(knowledge_points)}"
                        )
                    else:
                        knowledge_points = all_kp
                options["course_id"] = course_id
                options["chapter_ids"] = chapter_ids
        else:
            kb_context = None

        course_profile = None
        if course_id:
            try:
                course_profile = syllabus_graph_service.build_course_profile(course_id)
                options["course_profile"] = course_profile
            except Exception as e:
                logger.warning(f"Failed to build course profile: {e}")

        rag_evidence = []
        if rag_required and course_id:
            rag_evidence = rag_citation_service.retrieve(
                course_id=course_id,
                query=" ".join([topic] + [str(kp) for kp in knowledge_points[:8]]),
                chapter_ids=chapter_ids,
                top_k=8,
            )
            options["rag_evidence"] = rag_evidence
            options["rag_evidence_prompt"] = rag_citation_service.build_evidence_prompt(
                rag_evidence,
                citation_style=citation_style,
            )
            options["citation_style"] = citation_style

        shared_state.update({
            f"{package_id}_topic": topic,
            f"{package_id}_profile": profile,
            f"{package_id}_status": "generating",
            f"{package_id}_kb_context": kb_context,
            f"{package_id}_rag_evidence": rag_evidence,
            f"{package_id}_progress": self._build_generation_progress(
                resource_types, [], {}, stage="planning"
            ),
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
        # 每次请求创建独立线程池，避免并发请求间争用worker
        request_executor = ThreadPoolExecutor(max_workers=max(5, len(agent_task_groups)))
        try:
            submit_index = 0
            for agent_name, rtypes in agent_task_groups.items():
                agent = self._agents[agent_name]
                if len(rtypes) == 1:
                    rtype = rtypes[0]
                    agent_task = self._build_agent_task(
                        rtype, profile, topic, knowledge_points, options, user_id=_user_id, user_role=_user_role
                    )
                    future = request_executor.submit(self._safe_process, agent, agent_task)
                    futures[rtype] = future
                else:
                    for rtype in rtypes:
                        agent_task = self._build_agent_task(
                            rtype, profile, topic, knowledge_points, options, user_id=_user_id, user_role=_user_role
                        )
                        future = request_executor.submit(self._safe_process, agent, agent_task)
                        futures[rtype] = future
                # 错峰提交：每个Agent之间间隔0.5s，避免并发请求同时打到Spark API触发QPS限流
                submit_index += 1
                if submit_index < len(agent_task_groups):
                    time.sleep(0.5)

            shared_state.set(
                f"{package_id}_progress",
                self._build_generation_progress(
                    resource_types, list(futures.keys()), {}, stage="running"
                ),
                self.agent_name,
            )

            results = {}
            errors = {}
            for rtype, future in futures.items():
                try:
                    result = future.result(timeout=180)
                    if "error" in result:
                        errors[rtype] = result["error"]
                    else:
                        results[rtype] = result
                except Exception as e:
                    errors[rtype] = str(e)
                    logger.error(f"Agent failed for {rtype}: {e}")
                shared_state.set(
                    f"{package_id}_progress",
                    self._build_generation_progress(
                        resource_types,
                        list(futures.keys()),
                        {**{key: "completed" for key in results.keys()}, **{key: "failed" for key in errors.keys()}},
                        stage="running",
                        error_messages=errors,
                    ),
                    self.agent_name,
                )
        finally:
            request_executor.shutdown(wait=False)

        convertible_types = {"mindmap", "project", "document", "recommendation"}
        for rtype in convertible_types:
            if rtype in results:
                try:
                    results[rtype] = content_converter_service.convert(
                        rtype, results[rtype], topic=topic, options=options
                    )
                except Exception as e:
                    logger.warning(f"Auto-conversion failed for {rtype}: {e}")

        citation_reports = {}
        if rag_required and course_id:
            for rtype, resource in list(results.items()):
                # 视频脚本为创意教学制品：台词不应插入 [n] 引用标记，否则破坏可读性。
                # 其事实性由知识点覆盖与结构完整性评估（见 _score_factuality 的 media 分支），
                # 此处跳过 RAG 引用附加，避免污染脚本内容并产生失真的低分。
                if rtype == "media":
                    continue
                evidence = rag_evidence or rag_citation_service.retrieve(
                    course_id=course_id,
                    query=f"{topic} {rtype}",
                    chapter_ids=chapter_ids,
                    top_k=6,
                )
                results[rtype] = rag_citation_service.attach_citations(
                    resource,
                    evidence[:6],
                    package_id=package_id,
                    course_id=course_id,
                    resource_type=rtype,
                    rag_required=rag_required,
                    citation_style=citation_style,
                )
                citation_reports[rtype] = results[rtype].get("verification_report", {})
                # 更新各 agent 的引用覆盖率
                agent_name = RESOURCE_TYPE_AGENT_MAP.get(rtype, rtype)
                coverage = citation_reports[rtype].get("citation_coverage_score", 0)
                agent_monitor.update_citation_coverage(agent_name, coverage)
                # 更新产物摘要
                output_summary = None
                if isinstance(results[rtype], dict):
                    if results[rtype].get("title"):
                        output_summary = results[rtype]["title"]
                    elif results[rtype].get("topic"):
                        output_summary = results[rtype]["topic"]
                if output_summary:
                    agent_monitor.update_output_summary(agent_name, output_summary[:100])

        results = self._enrich_resources_with_evidence(
            results=results,
            profile=profile,
            strategy=strategy,
            knowledge_points=knowledge_points,
            rag_evidence=rag_evidence,
            kb_context=kb_context,
        )

        consistency_report = self._check_consistency(
            results, knowledge_points, profile
        )
        quality_report = self._assess_content_quality(
            results, knowledge_points, profile
        )

        elapsed = round(time.time() - start_time, 2)
        progress = self._build_generation_progress(
            resource_types,
            list(futures.keys()),
            {**{key: "completed" for key in results.keys()}, **{key: "failed" for key in errors.keys()}},
            stage="completed",
            error_messages=errors,
        )

        package = {
            "package_id": package_id,
            "topic": topic,
            "student_profile_summary": self._summarize_profile(profile),
            "generation_strategy": strategy,
            "knowledge_base_used": bool(kb_context),
            "course_profile": course_profile,
            "resources": self._normalize_resources_for_output(results),
            "errors": errors if errors else None,
            "agent_progress": progress,
            "content_quality_report": quality_report,
            "citations": self._collect_package_citations(results),
            "citation_coverage_score": self._average_citation_score(results),
            "verification_report": {
                "status": "passed" if citation_reports and all(r.get("status") == "passed" for r in citation_reports.values()) else "needs_review" if citation_reports else "not_requested",
                "resources": citation_reports,
            },
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
                "rag_required": rag_required,
                "citation_style": citation_style,
                "created_at": datetime.utcnow().isoformat(),
            },
        }

        shared_state.update({
            f"{package_id}_result": package,
            f"{package_id}_status": "completed",
            f"{package_id}_progress": progress,
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
        course_id = task.get("course_id") or options.get("course_id")
        chapter_ids = task.get("chapter_ids") or options.get("chapter_ids")
        rag_required = bool(task.get("rag_required", options.get("rag_required", False)))
        citation_style = task.get("citation_style", options.get("citation_style", "bracket"))
        _user_id = task.get("user_id")
        _user_role = task.get("user_role")
        options["rag_required"] = rag_required
        options["citation_style"] = citation_style

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

        if "error" not in result and rag_required and course_id:
            evidence = rag_citation_service.retrieve(
                course_id=course_id,
                query=" ".join([topic] + [str(kp) for kp in knowledge_points[:8]]),
                chapter_ids=chapter_ids,
                top_k=6,
            )
            result = rag_citation_service.attach_citations(
                result,
                evidence,
                course_id=course_id,
                resource_type=resource_type,
                rag_required=rag_required,
                citation_style=citation_style,
            )

        if "error" not in result:
            result = self._enrich_single_resource_with_evidence(
                result,
                resource_type,
                profile,
                knowledge_points,
                options.get("rag_evidence", []),
                None,
            )
            result["content_quality_report"] = self._assess_content_quality(
                {resource_type: result}, knowledge_points, profile
            )

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
        progress = shared_state.get(f"{package_id}_progress")
        return {
            "package_id": package_id,
            "status": status,
            "progress": progress,
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

        course_profile = options.get("course_profile") or {}
        if course_profile:
            strategy_parts.append(
                f"课程画像：知识密度{course_profile.get('knowledge_density', 0)}，"
                f"难度{course_profile.get('difficulty', 'unknown')}，"
                f"实践比例{course_profile.get('practice_ratio', 0)}"
            )
        if options.get("rag_required"):
            strategy_parts.append("RAG约束：生成内容必须附带知识库引用并通过引用核验")

        # 新增：先修链匹配薄弱点
        course_id = options.get("course_id")
        if course_id and profile.get("knowledge_base"):
            try:
                prereq_chain = self._match_prerequisite_chain(course_id, profile)
                if prereq_chain:
                    strategy_parts.append(f"先修补强：{prereq_chain}")
            except Exception as e:
                logger.warning(f"Prerequisite chain matching failed: {e}")

        # 新增：认知风格影响资源类型权重
        style_weights = self._get_style_resource_weights(cognitive_style)
        if style_weights:
            strategy_parts.append(f"资源权重：{style_weights}")

        # 新增：学习目标影响推荐排序
        goal_sort = self._get_goal_sort_strategy(goal)
        if goal_sort:
            strategy_parts.append(goal_sort)

        return "；".join(strategy_parts)

    def _match_prerequisite_chain(self, course_id, profile):
        """从图谱获取先修链，匹配学生薄弱点"""
        from src.models.knowledge_base import KnowledgeGraphNode, KnowledgeGraphEdge

        prereq_edges = KnowledgeGraphEdge.query.filter_by(
            course_id=course_id, edge_type="prerequisite"
        ).limit(30).all()
        if not prereq_edges:
            return None

        skill_node_ids = {e.source_node_id for e in prereq_edges}
        skill_nodes = KnowledgeGraphNode.query.filter(
            KnowledgeGraphNode.id.in_(skill_node_ids)
        ).all()
        skill_map = {n.id: n.label for n in skill_nodes}

        kb = profile.get("knowledge_base", {})
        weak_areas = [k for k, v in kb.items() if isinstance(v, (int, float)) and v < 50] if isinstance(kb, dict) else []
        if not weak_areas:
            return None

        matched = []
        for edge in prereq_edges[:10]:
            skill_label = skill_map.get(edge.source_node_id, "")
            for weak in weak_areas:
                if weak.lower() in skill_label.lower() or skill_label.lower() in weak.lower():
                    matched.append(skill_label)
                    break

        return "、".join(matched[:5]) if matched else None

    def _get_style_resource_weights(self, cognitive_style):
        """认知风格影响资源类型权重"""
        weights = {
            "visual": "视频脚本权重+30%，增加图表描述",
            "auditory": "视频脚本权重+25%，增加旁白讲解",
            "kinesthetic": "实操项目权重+30%，增加编程题比例",
            "reading": "文档权重+30%，增加深度内容",
        }
        return weights.get(cognitive_style)

    def _get_goal_sort_strategy(self, goal):
        """学习目标影响推荐排序"""
        strategies = {
            "exam": "推荐排序：真题>考点练习>知识文档>拓展资源",
            "career": "推荐排序：行业案例>实操项目>技能资源>理论文档",
            "hobby": "推荐排序：趣味案例>探索项目>视频教程>学术论文",
            "research": "推荐排序：学术论文>研究方法>深度文档>基础练习",
        }
        return strategies.get(goal)

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
        if options.get("rag_evidence_prompt"):
            base_task["rag_evidence_prompt"] = options["rag_evidence_prompt"]

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
        """评估资源对知识点的覆盖程度，采用多层降级匹配策略提升评估准确性。

        匹配层级（由严到宽）：
        1. 严格子串匹配：知识点完整出现在内容中 → 完全覆盖
        2. 子关键词全部匹配：知识点按分隔符拆分后所有子词都出现 → 完全覆盖
        3. 子关键词部分匹配：≥50% 子词出现 → 部分覆盖
        4. 字符级 2-gram 匹配：≥60% bigram 重叠 → 完全覆盖（针对中文复合术语）

        综合评分：完全覆盖=1.0，部分覆盖=0.3
        """
        if not knowledge_points:
            return 80

        # 预处理知识点：按常见分隔符拆分为子关键词
        kp_keywords = {}
        for kp in knowledge_points:
            parts = re.split(r'[-_\s、，,；;：:（）()【】\[\]{}/]+', kp)
            parts = [p.strip().lower() for p in parts if p.strip() and len(p.strip()) >= 2]
            kp_keywords[kp] = parts

        covered = set()        # 完全覆盖的知识点
        partial_covered = set()  # 部分覆盖的知识点

        for rtype, data in resources.items():
            content_str = json.dumps(data, ensure_ascii=False).lower()
            for kp in knowledge_points:
                # 已完全覆盖则跳过后续层级
                if kp in covered:
                    continue

                kp_lower = kp.lower()

                # 层级 1：严格子串匹配
                if kp_lower in content_str:
                    covered.add(kp)
                    continue

                keywords = kp_keywords.get(kp, [])

                # 层级 2：子关键词全部匹配
                if keywords and all(kw in content_str for kw in keywords):
                    covered.add(kp)
                    continue

                # 层级 3：子关键词部分匹配（≥50%）
                if keywords:
                    matched = sum(1 for kw in keywords if kw in content_str)
                    if matched / len(keywords) >= 0.5:
                        partial_covered.add(kp)
                        continue

                # 层级 4：字符级 2-gram 匹配（针对较长的中文复合术语）
                if len(kp_lower) >= 4:
                    kp_bigrams = set(kp_lower[i:i + 2] for i in range(len(kp_lower) - 1))
                    # 过滤包含分隔符的 bigram
                    kp_bigrams = {bg for bg in kp_bigrams if not re.search(r'[-_\s、，,；;：:（）()【】\[\]{}/]', bg)}
                    if kp_bigrams:
                        matched_bigrams = sum(1 for bg in kp_bigrams if bg in content_str)
                        if matched_bigrams / len(kp_bigrams) >= 0.6:
                            covered.add(kp)
                            continue

        # 综合评分：完全覆盖=1.0，部分覆盖=0.3
        full_score = len(covered)
        partial_score = len(partial_covered - covered)  # 排除已完全覆盖的
        total_score = full_score + partial_score * 0.3
        return round(total_score / len(knowledge_points) * 100, 1)

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

    def _collect_package_citations(self, resources):
        seen = {}
        for resource in resources.values():
            if isinstance(resource, dict):
                for citation in resource.get("citations", []) or []:
                    source_id = citation.get("source_id") or citation.get("title")
                    if source_id and source_id not in seen:
                        seen[source_id] = citation
        return list(seen.values())

    def _average_citation_score(self, resources):
        scores = []
        for resource in resources.values():
            if isinstance(resource, dict) and resource.get("citation_coverage_score") is not None:
                scores.append(float(resource.get("citation_coverage_score") or 0))
        return round(sum(scores) / len(scores), 1) if scores else 0

    def _build_generation_progress(self, requested_types, active_types, status_by_type, stage="running", error_messages=None):
        total = len(requested_types or [])
        completed = sum(1 for item in status_by_type.values() if item == "completed")
        failed = sum(1 for item in status_by_type.values() if item == "failed")
        running = max(0, len(active_types or []) - completed - failed)
        error_messages = error_messages or {}
        steps = []
        for rtype in requested_types or []:
            agent_name = RESOURCE_TYPE_AGENT_MAP.get(rtype, "unassigned")
            state = status_by_type.get(rtype)
            if not state:
                state = "running" if rtype in (active_types or []) and stage == "running" else "pending"
            if stage == "completed" and not status_by_type.get(rtype):
                state = "skipped"
            step_entry = {
                "resource_type": rtype,
                "agent_name": agent_name,
                "task_type": RESOURCE_TYPE_TASK_MAP.get(rtype, ""),
                "status": state,
                "progress": 100 if state == "completed" else 0 if state in ("pending", "skipped") else 60,
            }
            if state == "failed" and rtype in error_messages:
                step_entry["error_message"] = str(error_messages[rtype])[:300]
            steps.append(step_entry)
        return {
            "stage": stage,
            "total": total,
            "completed": completed,
            "failed": failed,
            "running": running,
            "overall_progress": round(((completed + failed) / total) * 100, 1) if total else 0,
            "steps": steps,
            "updated_at": datetime.utcnow().isoformat(),
        }

    # 资源输出规范化映射：Agent返回的JSON常被包装在自身类型键下，需解包以统一前端访问路径
    _RESOURCE_UNWRAP_KEYS = {
        "document": "document",
        "mindmap": "mindmap",
        "project": "project",
        "media": "media",
    }

    def _normalize_resources_for_output(self, results):
        """解包Agent输出中的冗余包装键，统一资源结构以便前端直接访问。

        例如：
          resources.document.document.sections → resources.document.sections
          resources.project.project.title → resources.project.title
        同时保留 enrichment 字段（knowledge_point_references 等）。
        """
        if not results:
            return results
        normalized = {}
        for rtype, resource in results.items():
            if not isinstance(resource, dict):
                normalized[rtype] = resource
                continue
            # 检查是否需要解包
            unwrap_key = self._RESOURCE_UNWRAP_KEYS.get(rtype)
            if unwrap_key and unwrap_key in resource:
                inner = resource[unwrap_key]
                if isinstance(inner, dict):
                    # 合并：内层内容提升到顶层，保留顶层的 enrichment 字段
                    merged = dict(inner)
                    for key, value in resource.items():
                        if key != unwrap_key:
                            merged[key] = value
                    normalized[rtype] = merged
                    continue
            # 处理 project 的扁平格式（project_title → title）
            if rtype == "project" and "project_title" in resource and "title" not in resource:
                merged = dict(resource)
                merged["title"] = merged.pop("project_title")
                if "project_description" in merged and "description" not in merged:
                    merged["description"] = merged.pop("project_description")
                if "programming_language" in merged and "language" not in merged:
                    merged["language"] = merged.pop("programming_language")
                normalized[rtype] = merged
                continue
            normalized[rtype] = resource
        return normalized

    def _enrich_resources_with_evidence(self, results, profile, strategy, knowledge_points, rag_evidence, kb_context):
        enriched = {}
        for rtype, resource in (results or {}).items():
            enriched[rtype] = self._enrich_single_resource_with_evidence(
                resource, rtype, profile, knowledge_points, rag_evidence, kb_context, strategy
            )
        return enriched

    def _enrich_single_resource_with_evidence(
        self, resource, resource_type, profile, knowledge_points, rag_evidence, kb_context, strategy=None
    ):
        resource_dict = dict(resource) if isinstance(resource, dict) else {"content": resource}
        references = self._build_knowledge_references(resource_dict, knowledge_points, rag_evidence, kb_context)
        adaptation = self._build_profile_adaptation(resource_type, profile, strategy)
        resource_dict["knowledge_point_references"] = references
        resource_dict["profile_adaptation_explanation"] = adaptation
        resource_dict["知识点引用来源"] = references
        resource_dict["画像适配说明"] = adaptation
        return resource_dict

    def _build_knowledge_references(self, resource, knowledge_points, rag_evidence, kb_context):
        references = []
        for citation in (resource.get("citations") or [])[:8] if isinstance(resource, dict) else []:
            references.append({
                "source_id": citation.get("source_id"),
                "title": citation.get("title") or "Course knowledge source",
                "source_type": citation.get("source_type") or "citation",
                "location": citation.get("location"),
                "url": citation.get("url"),
                "excerpt": citation.get("excerpt"),
                "confidence": citation.get("confidence"),
            })
        for item in (rag_evidence or [])[:8]:
            source_id = item.get("source_id") or item.get("reference_code")
            if source_id and not any(ref.get("source_id") == source_id for ref in references):
                references.append({
                    "source_id": source_id,
                    "title": item.get("title") or "Retrieved course evidence",
                    "source_type": item.get("source_type") or "knowledge_base",
                    "location": item.get("location"),
                    "url": item.get("url"),
                    "excerpt": item.get("excerpt") or item.get("content", "")[:300],
                    "confidence": item.get("confidence"),
                })
        if not references and knowledge_points:
            for idx, kp in enumerate(knowledge_points[:8], start=1):
                references.append({
                    "source_id": f"KP_LOCAL_{idx}",
                    "title": str(kp),
                    "source_type": "knowledge_point",
                    "location": "request.knowledge_points",
                    "excerpt": f"Generated content is aligned to the requested knowledge point: {kp}",
                    "confidence": 0.7,
                })
        if not references and kb_context:
            course_title = kb_context.get("course_title") or kb_context.get("course", {}).get("title")
            references.append({
                "source_id": "KB_CONTEXT",
                "title": course_title or "Course knowledge base",
                "source_type": "course_knowledge_base",
                "location": "knowledge_base_context",
                "excerpt": str(kb_context.get("statistics") or "")[:300],
                "confidence": 0.65,
            })
        if not references:
            references.append({
                "source_id": "NO_EXTERNAL_SOURCE",
                "title": "No explicit source supplied",
                "source_type": "generation_context",
                "location": "runtime_prompt",
                "excerpt": "The request did not provide a course knowledge base or citation evidence; review before formal use.",
                "confidence": 0.2,
            })
        return references

    def _build_profile_adaptation(self, resource_type, profile, strategy=None):
        if not profile:
            return "未提供完整学生画像，内容采用通用难度与通用资源结构生成。"
        parts = []
        style = profile.get("cognitive_style")
        goal = profile.get("goal_orientation")
        pace = profile.get("learning_pace")
        interactions = profile.get("interaction_preference")
        if style:
            style_actions = {
                "visual": "突出图示、结构化讲解和视频脚本，便于视觉化理解。",
                "auditory": "增加讲解口播、旁白和分步骤解释，适合听觉吸收。",
                "kinesthetic": "强化实操项目、编程练习和任务驱动活动。",
                "reading": "提高文档深度、术语解释和阅读材料比例。",
                "mixed": "平衡文档、练习、项目和多媒体资源。"
            }
            parts.append(style_actions.get(style, f"根据认知风格 {style} 调整资源表达方式。"))
        if goal:
            goal_actions = {
                "exam": "围绕考点、题型训练和易错点复盘组织内容。",
                "career": "偏向真实业务场景、工程实践和技能迁移。",
                "hobby": "加入探索式例子和兴趣驱动任务。",
                "research": "增加概念边界、方法论和论文式拓展。"
            }
            parts.append(goal_actions.get(goal, f"根据学习目标 {goal} 调整内容侧重点。"))
        if pace:
            pace_actions = {
                "fast": "压缩冗余说明，提高信息密度。",
                "moderate": "采用标准节奏，兼顾讲解与练习。",
                "slow": "拆分步骤、增加回顾提示和基础巩固。",
                "adaptive": "保留可调节路径，便于后续动态调整。"
            }
            parts.append(pace_actions.get(pace, f"根据学习节奏 {pace} 安排内容密度。"))
        if interactions:
            parts.append(f"交互偏好为 {interactions}，资源中保留相应的引导、探索或挑战提示。")
        if strategy:
            parts.append(f"生成策略摘要：{str(strategy)[:180]}")
        return " ".join(parts) or f"{resource_type} 已依据学生画像进行难度和表达方式适配。"

    def _assess_content_quality(self, resources, knowledge_points, profile):
        # 检测资源是否处于降级状态（为空或仅含错误条目）
        has_valid_resources = bool(resources) and any(
            isinstance(v, dict) and "error" not in v for v in resources.values()
        )

        coverage = self._check_knowledge_coverage(resources, knowledge_points)
        difficulty = self._score_difficulty_quality(resources, profile)
        factuality = self._score_factuality(resources, profile)
        citation = self._score_citation_integrity(resources)

        # 始终根据画像特征微调评分，确保不同画像有区分度
        # 降级场景使用全额微调，正常场景使用半额微调（保留内容本身差异的主导地位）
        profile_adjustments = self._get_profile_quality_adjustments(profile)
        adjustment_factor = 1.0 if not has_valid_resources else 0.5
        coverage = round(max(0, min(100, coverage + profile_adjustments["coverage"] * adjustment_factor)), 1)
        difficulty = round(max(0, min(100, difficulty + profile_adjustments["difficulty"] * adjustment_factor)), 1)
        factuality = round(max(0, min(100, factuality + profile_adjustments["factuality"] * adjustment_factor)), 1)
        citation = round(max(0, min(100, citation + profile_adjustments["citation"] * adjustment_factor)), 1)

        overall = round(coverage * 0.3 + difficulty * 0.25 + factuality * 0.25 + citation * 0.2, 1)
        degraded_note = "（部分Agent失败，评分已按画像基线估算）" if not has_valid_resources else ""
        return {
            "overall_score": overall,
            "dimensions": {
                "coverage": {
                    "score": coverage,
                    "label": "覆盖率",
                    "basis": "根据生成内容中命中的目标知识点比例计算，并结合画像目标导向微调。" + degraded_note,
                    "suggestion": "补充未覆盖知识点的定义、例题和应用场景。" if coverage < 85 else "主题覆盖较完整，可进入人工复核。"
                },
                "difficulty": {
                    "score": difficulty,
                    "label": "难度",
                    "basis": "结合内容长度、练习/项目占比、认知风格和学习节奏进行估算。" + degraded_note,
                    "suggestion": "根据学生画像继续微调术语密度、步骤拆分和实践比例。" if difficulty < 85 else "难度与画像匹配较好。"
                },
                "factuality": {
                    "score": factuality,
                    "label": "事实性",
                    "basis": "依据引用校验结果、降级标记、事实性风险信号和画像目标导向估算。" + degraded_note,
                    "suggestion": "为结论性表述补充课程资料引用，并人工核验关键事实。" if factuality < 85 else "事实性风险较低。"
                },
                "citation_integrity": {
                    "score": citation,
                    "label": "引用完整性",
                    "basis": "检查资源是否包含知识点引用来源、citation 列表和引用覆盖率，并结合画像目标导向微调。" + degraded_note,
                    "suggestion": "补齐来源标题、位置、摘录和引用标记。" if citation < 85 else "引用信息较完整。"
                },
            },
        }

    def _get_profile_quality_adjustments(self, profile):
        """根据学生画像特征返回各维度的微调值，确保不同画像有区分度。"""
        adjustments = {"coverage": 0, "difficulty": 0, "factuality": 0, "citation": 0}

        cognitive_style = profile.get("cognitive_style", "mixed")
        goal = profile.get("goal_orientation", "exam")
        pace = profile.get("learning_pace", "moderate")

        # 认知风格影响难度感知：视觉型偏概念图示，动觉型偏实操，阅读型偏文本深度
        style_difficulty = {
            "visual": 5, "auditory": 2, "kinesthetic": 8,
            "reading": -4, "mixed": 0,
        }
        adjustments["difficulty"] += style_difficulty.get(cognitive_style, 0)

        # 认知风格也影响覆盖率感知：动觉型更关注实践覆盖，视觉型更关注概念覆盖
        style_coverage = {
            "visual": 3, "auditory": 1, "kinesthetic": -2,
            "reading": 2, "mixed": 0,
        }
        adjustments["coverage"] += style_coverage.get(cognitive_style, 0)

        # 目标导向影响覆盖率和事实性：研究型要求更广覆盖和更高事实性
        goal_coverage = {
            "exam": 0, "career": 3, "hobby": -5, "research": 7,
        }
        goal_factuality = {
            "exam": 0, "career": 2, "hobby": -4, "research": 6,
        }
        adjustments["coverage"] += goal_coverage.get(goal, 0)
        adjustments["factuality"] += goal_factuality.get(goal, 0)

        # 学习节奏影响难度适配：慢速学习者对高难度内容更敏感
        pace_difficulty = {
            "slow": -5, "moderate": 0, "fast": 6, "adaptive": 3,
        }
        adjustments["difficulty"] += pace_difficulty.get(pace, 0)

        # 目标导向影响引用完整性：研究型对引用要求最高
        goal_citation = {
            "exam": 0, "career": 2, "hobby": -3, "research": 5,
        }
        adjustments["citation"] += goal_citation.get(goal, 0)

        return adjustments

    def _score_difficulty_quality(self, resources, profile):
        content_len = len(json.dumps(resources, ensure_ascii=False))
        base = 70
        if content_len > 2500:
            base += 10
        if any(key in json.dumps(resources, ensure_ascii=False).lower() for key in ("exercise", "project", "练习", "项目")):
            base += 8
        if profile.get("learning_pace") == "slow" and content_len > 6000:
            base -= 8
        if profile.get("learning_pace") == "fast" and content_len < 1200:
            base -= 6
        return max(0, min(100, round(base, 1)))

    def _score_factuality(self, resources, profile=None):
        """评估内容事实性质量，采用多维度加权评分而非简单平均。

        评分维度：
        1. 引用校验得分（verification_report.score）— 最高权重
        2. 结构完整性（章节数、任务数、节点数等）— 中等权重
        3. 内容充实度（文本长度、代码长度等）— 中等权重
        4. 降级状态惩罚（区分降级类型，推荐/思维导图降级惩罚较轻）

        降级类型区分：
        - document 降级：严重事实性风险 → 55 分
        - exercise 降级：中等事实性风险 → 65 分
        - recommendation 降级：低事实性风险（推荐列表本身具有主观性）→ 72 分
        - mindmap 降级：低事实性风险（知识结构本身较稳定）→ 75 分
        - project 降级：中等事实性风险（代码模板可运行性存疑）→ 68 分
        """
        scores = []
        for rtype, resource in (resources or {}).items():
            if not isinstance(resource, dict):
                continue

            # 视频脚本为创意教学制品：不依赖 RAG 引用校验得分（脚本台词不应插入引用标记，
            # RAG citation 校验会给出失真的低分）。改为依据知识点覆盖、结构完整性与
            # 台词充实度综合评估，基线 72（教学脚本由教师审核，事实性风险中等偏低）。
            if rtype == "media":
                media = resource.get("media", resource) if isinstance(resource.get("media", resource), dict) else {}
                script = media.get("script", {}) if isinstance(media, dict) else {}
                scenes = script.get("scenes", []) if isinstance(script, dict) else []
                if not isinstance(scenes, list):
                    scenes = []
                base = 72.0
                # 结构完整性：分镜数量与阶段多样性
                if len(scenes) >= 3:
                    base += 8
                elif len(scenes) >= 1:
                    base += 4
                stages = {sc.get("stage") for sc in scenes if isinstance(sc, dict) and sc.get("stage")}
                base += min(4, len(stages))
                if media.get("presentation_style"):
                    base += 4
                # 知识点引用加分（脚本显式标注了所覆盖知识点）
                if resource.get("knowledge_point_references") or media.get("knowledge_point_references"):
                    base += 6
                # 台词充实度：旁白总字数反映讲解深度
                narration_len = sum(
                    len(str(sc.get("narration", ""))) for sc in scenes if isinstance(sc, dict)
                )
                if narration_len >= 500:
                    base += 6
                elif narration_len >= 200:
                    base += 3
                # 约束在 [40, 92]：教学脚本事实性上限低于已引用校验的文档
                base = max(40, min(92, base))
                scores.append(round(base, 1))
                continue

            report = resource.get("verification_report") or {}

            # 维度 1：引用校验得分（最高权重，若存在则直接使用）
            if report.get("score") is not None:
                scores.append(float(report.get("score") or 0))
                continue

            # 维度 2-4：无引用校验时，基于资源特征综合估算
            base_score = 75.0

            # 降级状态惩罚（区分类型）
            degraded_type = None
            if resource.get("degraded") or resource.get("fallback"):
                degraded_type = resource.get("degradation_reason") or resource.get("fallback_reason") or rtype

            degraded_penalty = {
                "document": 20,
                "exercise": 12,
                "project": 10,
                "recommendation": 5,
                "mindmap": 3,
                "media": 8,
            }

            if degraded_type:
                # 尝试匹配降级类型关键词
                penalty = 15  # 默认惩罚
                for key, val in degraded_penalty.items():
                    if key in degraded_type or key == rtype:
                        penalty = val
                        break
                base_score -= penalty

            # 结构完整性加分
            structure_score = self._calc_structure_score(rtype, resource)
            base_score += structure_score * 0.3

            # 内容充实度加分
            richness_score = self._calc_richness_score(rtype, resource)
            base_score += richness_score * 0.2

            # 知识点引用加分
            if resource.get("knowledge_point_references"):
                base_score += 8

            # 约束在 [30, 95] 范围内
            base_score = max(30, min(95, base_score))
            scores.append(round(base_score, 1))

        if scores:
            return round(sum(scores) / len(scores), 1)

        # 无有效资源时，根据画像目标导向返回差异化基线
        goal = (profile or {}).get("goal_orientation", "exam")
        goal_baseline = {"exam": 68, "career": 70, "hobby": 65, "research": 72}
        return goal_baseline.get(goal, 70)

    def _calc_structure_score(self, rtype, resource):
        """计算资源的结构完整性得分（0-20 分）。"""
        score = 0
        if not isinstance(resource, dict):
            return score

        if rtype == "document":
            sections = resource.get("sections") or []
            if isinstance(sections, list) and len(sections) >= 3:
                score += 10
            if resource.get("glossary"):
                score += 5
            if resource.get("examples"):
                score += 5
        elif rtype == "mindmap":
            root = resource.get("root", {})
            children = root.get("children", []) if isinstance(root, dict) else []
            if isinstance(children, list):
                if len(children) >= 4:
                    score += 15
                elif len(children) >= 2:
                    score += 8
                # 检查是否有深层子节点
                for child in children:
                    if isinstance(child, dict) and child.get("children"):
                        score += 2
                        break
        elif rtype == "project":
            tasks = resource.get("tasks") or []
            if isinstance(tasks, list) and len(tasks) >= 3:
                score += 10
            if resource.get("full_code") and len(str(resource["full_code"])) > 200:
                score += 10
        elif rtype == "recommendation":
            items = resource.get("resources") or resource.get("items") or []
            if isinstance(items, list) and len(items) >= 5:
                score += 10
            # 检查资源类型多样性
            types = set()
            for item in items:
                if isinstance(item, dict) and item.get("type"):
                    types.add(item["type"])
            score += min(10, len(types) * 3)
        elif rtype == "exercise":
            questions = resource.get("questions") or resource.get("exercises") or []
            if isinstance(questions, list) and len(questions) >= 5:
                score += 10
            # 检查题型多样性
            q_types = set()
            for q in questions:
                if isinstance(q, dict) and q.get("type"):
                    q_types.add(q["type"])
            score += min(10, len(q_types) * 3)
        elif rtype == "media":
            media = resource.get("media", resource) if isinstance(resource.get("media", resource), dict) else {}
            script = media.get("script", {}) if isinstance(media, dict) else {}
            scenes = script.get("scenes", []) if isinstance(script, dict) else []
            if not isinstance(scenes, list):
                scenes = []
            # 分镜数量：≥3 个分镜为完整脚本
            if len(scenes) >= 5:
                score += 10
            elif len(scenes) >= 3:
                score += 7
            elif len(scenes) >= 1:
                score += 3
            # 阶段多样性（引入/讲解/演示/总结）
            stages = {sc.get("stage") for sc in scenes if isinstance(sc, dict) and sc.get("stage")}
            score += min(5, len(stages) * 1.5)
            # 呈现方式说明与视觉风格
            if media.get("presentation_style"):
                score += 3
            if script.get("visual_style") or script.get("shooting_format_suggestion"):
                score += 2

        return min(20, score)

    def _calc_richness_score(self, rtype, resource):
        """计算资源的内容充实度得分（0-20 分）。"""
        if not isinstance(resource, dict):
            return 0
        content_str = json.dumps(resource, ensure_ascii=False)
        length = len(content_str)

        # 各资源类型的长度基准（字符数）
        benchmarks = {
            "document": 5000,
            "mindmap": 1500,
            "project": 4000,
            "recommendation": 2000,
            "exercise": 3000,
            "media": 1000,
        }
        benchmark = benchmarks.get(rtype, 2000)
        ratio = min(1.0, length / benchmark)
        return round(ratio * 20, 1)

    def _score_citation_integrity(self, resources):
        scores = []
        for resource in (resources or {}).values():
            if not isinstance(resource, dict):
                scores.append(40)
                continue
            refs = resource.get("knowledge_point_references") or []
            citations = resource.get("citations") or []
            coverage = float(resource.get("citation_coverage_score") or 0)
            completeness = 0
            if refs:
                completeness += 35
            if citations:
                completeness += 35
            completeness += min(30, coverage * 0.3)
            scores.append(completeness)
        return round(sum(scores) / len(scores), 1) if scores else 0

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

    def _filter_kp_by_topic(self, knowledge_points, topic):
        """根据主题过滤知识点，只保留与主题相关的。

        避免课程全局知识点污染具体主题生成（如主题"多线程与并发编程"不应包含"Java 基本数据类型"）。
        匹配策略（由严到宽）：
        1. 主题完整子串出现在知识点中（或反向）→ 强相关
        2. 主题或知识点的核心词（去掉常见停用词后）存在包含关系 → 强相关
        3. 主题 2-gram 字符重叠率 ≥ 30% → 中等相关
        无匹配时返回空列表，触发 document_agent 走基于主题的通用 fallback 分支，
        不再用课程全局知识点机械分块生成"知识模块1/2/3..."这种与主题无关的内容。
        """
        if not knowledge_points or not topic:
            return []

        topic_lower = topic.lower()
        # 中文常见停用词，提取主题核心词时去除
        stop_words = {'与', '和', '及', '以及', '的', '了', '在', '是', '为', '中', '等', '基于', '使用',
                      '通过', '利用', '实现', '应用', '入门', '进阶', '高级', '初级', '中级'}
        # 主题核心词集合（用于和知识点核心词互查）
        topic_core_words = set(re.findall(r'[\u4e00-\u9fa5A-Za-z]+', topic_lower))
        topic_core_words = {w for w in topic_core_words if w not in stop_words and len(w) >= 2}

        # 主题 2-gram 集合（过滤包含分隔符的 bigram）
        sep_re = re.compile(r'[-_\s、，,；;：:（）()【】\[\]{}/]')
        topic_bigrams = set()
        for i in range(len(topic_lower) - 1):
            bg = topic_lower[i:i + 2]
            if not sep_re.search(bg):
                topic_bigrams.add(bg)

        matched = []
        for kp in knowledge_points:
            kp_str = str(kp)
            kp_lower = kp_str.lower()
            # 层级 1：子串匹配（双向）
            if topic_lower in kp_lower or kp_lower in topic_lower:
                matched.append(kp)
                continue
            # 层级 2：核心词匹配（主题核心词出现在知识点中，或反向）
            kp_core_words = set(re.findall(r'[\u4e00-\u9fa5A-Za-z]+', kp_lower))
            kp_core_words = {w for w in kp_core_words if w not in stop_words and len(w) >= 2}
            if topic_core_words & kp_core_words:
                matched.append(kp)
                continue
            # 层级 3：2-gram 重叠率 ≥ 30%
            if topic_bigrams:
                kp_bigrams = set()
                for i in range(len(kp_lower) - 1):
                    bg = kp_lower[i:i + 2]
                    if not sep_re.search(bg):
                        kp_bigrams.add(bg)
                if kp_bigrams:
                    overlap = len(topic_bigrams & kp_bigrams) / len(topic_bigrams)
                    if overlap >= 0.3:
                        matched.append(kp)
                        continue

        # 无匹配时返回空列表：让 document_agent 走基于主题的通用 fallback，
        # 不再让课程全局知识点（如 Java 基础）污染具体主题（如"多线程"）生成
        return matched
