import json
import logging
from src.services.multi_agent import AgentBase
from src.services.multi_agent.shared_state import (
    AgentStatus,
    shared_state,
    message_bus,
    agent_monitor,
)
from src.services.knowledge_base_service import knowledge_base_service

logger = logging.getLogger(__name__)

DOCUMENT_SYSTEM_PROMPT = """你是一位专业的课程文档撰写专家智能体，负责根据学生画像生成个性化的专业课程讲解文档。

## 你的职责
根据学生专业、认知风格、知识基础等信息，生成结构清晰、内容深入、风格适配的课程讲解文档。

## 文档生成原则
1. 结构层次分明：章节→小节→知识点→示例
2. 内容循序渐进：从基础概念到高级应用
3. 理论实践结合：每个核心概念配以实际案例
4. 适配学生水平：根据知识基础调整内容深度
5. 标注重点难点：标记关键知识点和常见误区

## 知识库内容使用规则
当提供了课程知识库内容时，必须：
1. 文档结构必须与知识库中的章节体系一致
2. 知识点讲解必须基于知识库中的定义和内容，不得随意编造
3. 文档中的示例应参考知识库中的教学案例
4. 术语使用必须与知识库中的定义保持一致
5. 复习思考题应覆盖知识库中的核心知识点

## 学生画像适配
- 视觉型：增加图表描述、流程图文字版、结构化展示
- 动觉型：增加实操步骤、动手实验指导
- 阅读型：增加详细文字阐述、文献引用
- 初学者：增加概念解释、入门引导
- 进阶者：增加深度分析、前沿拓展

## 输出格式
严格返回以下JSON格式，不要添加任何markdown代码块标记。
注意：下方尖括号 <...> 中的说明是填写指引，必须替换为针对本主题的实际内容，禁止保留占位文字：
{
  "document": {
    "title": "<填写本文档的实际标题>",
    "summary": "<填写200字以内的实际内容摘要>",
    "target_audience": "<填写目标读者描述>",
    "estimated_reading_time_minutes": 30,
    "sections": [
      {
        "section_id": "s1",
        "title": "<填写本章节的实际标题>",
        "key_points": ["<填写实际要点1>", "<填写实际要点2>"],
        "content": "<填写章节正文，至少200字，包含概念定义、核心要素、相关原理的详细讲解>",
        "examples": [
          {
            "title": "<填写本示例的实际标题，禁止写'示例标题'>",
            "description": "<填写本示例的实际描述，禁止写'示例描述'>",
            "content": "<填写本示例的实际内容/代码/步骤，禁止写'示例内容'>"
          }
        ],
        "common_mistakes": ["<填写实际误区1>", "<填写实际误区2>"],
        "further_reading": ["<填写实际扩展阅读1>"]
      }
    ],
    "glossary": [
      {"term": "<填写实际术语>", "definition": "<填写实际定义>"}
    ],
    "review_questions": ["<填写实际复习思考题1>"]
  }
}

## 重要提醒
- content字段不得为空，每个章节至少200字的详细讲解
- 至少生成3个章节，每个章节包含至少2个key_points和1个example
- examples 中每个示例的 title/description/content 必须是与本章节知识点相关的实际内容，严禁使用"示例标题""示例描述""示例内容"等占位文字
- glossary至少包含5个术语
- review_questions至少包含3道题
- 直接输出纯JSON，不要用```json```包裹"""


MINDMAP_SYSTEM_PROMPT = """你是一位专业的知识结构化专家智能体，负责将课程知识点组织为层次分明、逻辑清晰的思维导图结构。

## 你的职责
根据给定主题和知识点，生成结构完整、内容丰富的思维导图，确保涵盖核心概念、主要分支、子分支及关键细节。

## 思维导图生成原则
1. 根节点为核心主题，必须清晰明确
2. 第一层为主要知识领域（至少3个分支，建议4-6个）
3. 第二层为各领域下的核心概念（每个分支至少2个子节点）
4. 第三层为具体知识点、应用场景或细节（尽可能展开）
5. 每个节点必须有name和description
6. 核心节点标记is_core为true
7. 关系类型必须准确：包含、并列、因果、递进

## 节点内容要求
- name：简洁准确，5-15字
- description：简要说明该节点的核心含义，10-50字
- is_core：核心概念标true，辅助概念标false
- relationship_type：与父节点的关系类型

## 输出格式
严格返回以下JSON格式，不要添加任何markdown代码块标记：
{
  "mindmap": {
    "root": {
      "name": "根节点名称",
      "description": "整体概述",
      "is_core": true,
      "relationship_type": null,
      "children": [
        {
          "name": "主要分支1",
          "description": "分支概述",
          "is_core": true,
          "relationship_type": "包含",
          "children": [
            {
              "name": "子概念1",
              "description": "概念说明",
              "is_core": false,
              "relationship_type": "并列",
              "children": []
            }
          ]
        }
      ]
    }
  }
}

## 重要提醒
- 至少生成4个一级分支
- 每个一级分支至少2个二级子节点
- 二级节点下尽可能有三级节点
- 所有节点的description不得为空
- 直接输出纯JSON，不要用```json```包裹"""


class DocumentAgent(AgentBase):
    agent_name = "document_agent"
    agent_role = "课程文档专家"
    agent_description = "根据学生画像生成个性化的专业课程讲解文档，包含知识点讲解、示例和误区提醒"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)
        message_bus.register(self.agent_name)
        agent_monitor.register_agent(
            self.agent_name, self.agent_role, self.get_capabilities()
        )

    def get_capabilities(self):
        return [
            "generate_course_document",
            "generate_knowledge_note",
            "generate_review_summary",
            "generate_mindmap_content",
        ]

    def process(self, task):
        task_type = task.get("type")
        agent_monitor.update_status(
            self.agent_name, AgentStatus.RUNNING, task_type
        )
        try:
            if task_type == "generate_course_document":
                result = self._generate_course_document(task)
            elif task_type == "generate_knowledge_note":
                result = self._generate_knowledge_note(task)
            elif task_type == "generate_review_summary":
                result = self._generate_review_summary(task)
            elif task_type == "generate_mindmap_content":
                result = self._generate_mindmap_content(task)
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
            logger.error(f"DocumentAgent error: {e}")
            agent_monitor.update_status(self.agent_name, AgentStatus.FAILED)
            return {"error": str(e)}

    def _generate_course_document(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        depth = task.get("depth", "intermediate")
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        cognitive_style = profile.get("cognitive_style", "mixed")
        knowledge_base = profile.get("knowledge_base", {})
        goal = profile.get("goal_orientation", "exam")

        style_instruction = self._get_style_instruction(cognitive_style)
        depth_instruction = self._get_depth_instruction(depth, knowledge_base)
        goal_instruction = self._get_goal_instruction(goal)
        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请生成一份专业的课程核心概念讲解文档。

## 主题
{topic}

## 知识点范围
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动规划'}

## 深度要求
{depth_instruction}

## 学生画像适配
{style_instruction}
{goal_instruction}
{kb_context}

## 文档内容要求
1. 文档结构清晰，至少包含3个章节
2. 每个章节的content字段必须包含：
   - 概念定义：清晰定义该章节涉及的核心概念
   - 核心要素：列出并解释关键要素和组成部分
   - 相关原理：阐述背后的原理和机制
   - 应用场景：说明在实际中的应用
3. 每个章节至少2个key_points和1个example
4. examples中每个示例必须有title、description和content
5. common_mistakes至少列出1个常见误区
6. 术语表glossary至少包含5个核心术语及其定义
7. 复习思考题review_questions至少3道
8. 所有content字段不得为空，每段至少200字

请严格按照JSON格式输出，不要用```json```包裹。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=DOCUMENT_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)
            shared_state.set(
                "last_document_result", parsed, self.agent_name
            )
            return parsed
        except Exception as e:
            logger.error(f"Document generation failed: {e}")
            return {"error": str(e)}

    def _generate_knowledge_note(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        key_concepts = task.get("key_concepts", [])
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请生成一份精简的知识点笔记。

## 主题
{topic}

## 核心概念
{json.dumps(key_concepts, ensure_ascii=False) if key_concepts else '自动提取'}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}
{kb_context}

要求：
1. 每个知识点用1-3句话概括核心内容
2. 标注重要程度（核心/重要/了解）
3. 列出知识点间的关联关系
4. 适合快速复习使用

请严格按照JSON格式输出，格式同课程文档但更精简。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=DOCUMENT_SYSTEM_PROMPT,
                temperature=0.5,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_review_summary(self, task):
        profile = task.get("student_profile", {})
        course_content = task.get("course_content", "")
        topics = task.get("topics", [])
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = f"""请根据课程内容生成复习总结文档。

## 课程内容
{course_content[:3000]}

## 复习主题
{json.dumps(topics, ensure_ascii=False) if topics else '全部主题'}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 提炼核心知识点清单
2. 梳理知识点间的逻辑关系
3. 标注高频考点和易错点
4. 提供记忆技巧和口诀

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=DOCUMENT_SYSTEM_PROMPT,
                temperature=0.5,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_mindmap_content(self, task):
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        depth = task.get("depth", 3)
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请为主题"{topic}"生成一个完整的知识结构思维导图。

## 主题
{topic}

## 参考知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '请根据主题自动规划知识体系'}

## 层级深度要求
{depth}层（建议：根节点→主要领域→核心概念→具体细节）

{kb_context}

## 生成要求
1. 根节点为"{topic}"，description为该主题的整体概述
2. 第一层分支覆盖该主题的4-6个主要知识领域，**必须围绕"{topic}"本身展开**
3. 每个第一层分支下至少2个核心概念（第二层）
4. 核心概念下展开具体知识点或应用场景（第三层）
5. 每个节点必须有有意义的description（10-50字），不得使用"知识模块1/2/3"等占位符命名
6. 标记核心节点is_core=true
7. 准确标注relationship_type（包含/并列/因果/递进）

## 主题相关性约束（关键）
1. **所有分支与节点必须与"{topic}"直接相关**，不得引入课程全局但与主题无关的知识点
2. "参考知识点"列表仅作为参考，**只选取其中与"{topic}"强相关的部分**，无关的请直接忽略
3. 若参考知识点均与主题无关，请基于"{topic}"本身自动规划 4-6 个核心领域（如基础概念、核心原理、应用场景、进阶拓展）
4. 第一层分支命名必须体现"{topic}"的子领域特征（如主题"多线程与并发编程"可分：线程基础、同步机制、线程池、并发工具、JMM 内存模型），禁止使用通用占位符

请严格按照JSON格式输出，不要用```json```包裹。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=MINDMAP_SYSTEM_PROMPT,
                temperature=0.5,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)

            # 检测解析失败，使用降级思维导图确保多分支结构
            if parsed.get("parse_error"):
                logger.warning(
                    f"DocumentAgent mindmap JSON 解析失败，使用降级多分支结构。raw_response 长度: {len(parsed.get('raw_response', ''))}"
                )
                return self._build_fallback_mindmap(topic, knowledge_points)

            # 校验解析结果是否包含有效的多分支结构
            mindmap_data = parsed.get("mindmap", parsed)
            root = mindmap_data.get("root", {}) if isinstance(mindmap_data, dict) else {}
            children = root.get("children", []) if isinstance(root, dict) else []
            if not children or len(children) < 2:
                logger.warning(f"DocumentAgent mindmap 分支不足（{len(children)}个），使用降级多分支结构")
                return self._build_fallback_mindmap(topic, knowledge_points)

            return parsed
        except Exception as e:
            logger.error(f"DocumentAgent mindmap 生成失败: {e}", exc_info=True)
            return self._build_fallback_mindmap(topic, knowledge_points)

    def _build_fallback_mindmap(self, topic, knowledge_points=None):
        """当 LLM 生成失败或分支不足时，基于主题构建降级的多分支思维导图。

        设计原则：
        1. 始终围绕主题生成 4 个有语义的分支（基础概念/核心原理/应用场景/进阶拓展），
           不再用"知识模块1/2/3..."这种与主题无关的占位符命名。
        2. 若传入了 knowledge_points，按关键词将其归类到对应分支下作为子节点；
           无法归类且与主题强相关的知识点放入"相关知识点"分支。
        3. 确保思维导图始终呈现多模块连接的完整结构，而非单一根节点。
        """
        knowledge_points = knowledge_points or []
        topic = topic or "知识结构"

        # 4 个固定语义分支模板（围绕主题展开）
        branch_templates = [
            {
                "name": "基础概念",
                "description": f"{topic}的核心定义与基本术语",
                "is_core": True,
                "relationship_type": "包含",
                "keywords": ["基础", "概念", "定义", "术语", "入门", "基本", "简介", "概述", "原理"],
                "children": [
                    {"name": "定义与内涵", "description": f"{topic}的基本定义", "is_core": True, "relationship_type": "并列", "children": []},
                    {"name": "基本术语", "description": f"{topic}领域的常用术语", "is_core": False, "relationship_type": "并列", "children": []},
                ],
            },
            {
                "name": "核心原理",
                "description": f"{topic}的主要理论与方法论",
                "is_core": True,
                "relationship_type": "包含",
                "keywords": ["原理", "机制", "理论", "方法", "算法", "模型", "架构", "设计", "实现", "流程"],
                "children": [
                    {"name": "理论基础", "description": f"{topic}的底层理论", "is_core": True, "relationship_type": "并列", "children": []},
                    {"name": "关键方法", "description": f"{topic}的常用方法", "is_core": False, "relationship_type": "并列", "children": []},
                ],
            },
            {
                "name": "应用场景",
                "description": f"{topic}的实际应用与案例",
                "is_core": False,
                "relationship_type": "包含",
                "keywords": ["应用", "场景", "案例", "实例", "实践", "实战", "项目", "demo", "示例"],
                "children": [
                    {"name": "典型应用", "description": f"{topic}的典型应用场景", "is_core": False, "relationship_type": "并列", "children": []},
                    {"name": "案例分析", "description": f"{topic}相关案例剖析", "is_core": False, "relationship_type": "递进", "children": []},
                ],
            },
            {
                "name": "进阶拓展",
                "description": f"{topic}的高级主题与前沿",
                "is_core": False,
                "relationship_type": "包含",
                "keywords": ["进阶", "高级", "拓展", "扩展", "前沿", "趋势", "优化", "调优", "最佳实践", "源码"],
                "children": [
                    {"name": "前沿趋势", "description": f"{topic}的最新进展", "is_core": False, "relationship_type": "递进", "children": []},
                    {"name": "扩展资源", "description": f"深入学习{topic}的资源", "is_core": False, "relationship_type": "并列", "children": []},
                ],
            },
        ]

        # 主题核心词：用于判断传入的知识点是否与主题强相关
        topic_lower = topic.lower()

        # 把传入的知识点按关键词归类到对应分支
        related_kp_unclassified = []  # 与主题相关但无法归类到具体分支的知识点
        # 主题 2-gram 核心词集合
        topic_core = {topic_lower[i:i+2] for i in range(len(topic_lower)-1) if len(topic_lower[i:i+2]) == 2}
        for kp in knowledge_points:
            kp_name = kp if isinstance(kp, str) else (kp.get("name") or kp.get("title") or str(kp))
            kp_lower = str(kp_name).lower()
            # 主题相关性判断：双向子串包含，或 2-gram 核心词有交集
            kp_core = {kp_lower[i:i+2] for i in range(len(kp_lower)-1) if len(kp_lower[i:i+2]) == 2}
            is_related = (topic_lower in kp_lower or kp_lower in topic_lower
                          or bool(topic_core & kp_core))

            if not is_related:
                # 与主题无关的知识点不放入导图，避免污染
                continue

            # 关键词归类
            classified = False
            for branch in branch_templates:
                if any(kw in kp_lower for kw in branch["keywords"]):
                    branch["children"].append({
                        "name": kp_name,
                        "description": f"{kp_name}的核心要点",
                        "is_core": True,
                        "relationship_type": "并列",
                        "children": [],
                    })
                    classified = True
                    break
            if not classified:
                related_kp_unclassified.append(kp_name)

        # 与主题相关但无法归类的知识点，单独放入"相关知识点"分支
        if related_kp_unclassified:
            branch_templates.append({
                "name": "相关知识点",
                "description": f"与{topic}直接相关的重要知识点",
                "is_core": True,
                "relationship_type": "并列",
                "keywords": [],
                "children": [
                    {
                        "name": kp_name,
                        "description": f"{kp_name}的核心要点",
                        "is_core": True,
                        "relationship_type": "并列",
                        "children": [],
                    }
                    for kp_name in related_kp_unclassified[:12]  # 最多 12 个，避免过长
                ],
            })

        return {
            "mindmap": {
                "root": {
                    "name": topic,
                    "description": f"{topic}的知识体系（降级生成）",
                    "is_core": True,
                    "relationship_type": None,
                    "children": branch_templates,
                }
            },
            "fallback": True,
            "fallback_reason": "LLM 生成失败或分支不足，已使用基于主题的降级多分支结构",
        }

    def _get_style_instruction(self, style):
        instructions = {
            "visual": "学生偏好视觉学习，请在文档中增加：1)结构化表格展示对比信息 2)流程描述（用文字描述流程图） 3)层次分明的列表展示",
            "auditory": "学生偏好听觉学习，请在文档中增加：1)对话式讲解风格 2)口头论述式的概念阐述 3)便于朗读的节奏感表达",
            "kinesthetic": "学生偏好动手实践，请在文档中增加：1)实操步骤说明 2)动手实验指导 3)代码示例和运行结果",
            "reading": "学生偏好阅读学习，请在文档中增加：1)详细的文字阐述 2)文献引用和出处 3)深入的理论分析",
            "mixed": "学生为混合型学习者，请均衡使用以上各种表达方式",
        }
        return instructions.get(style, instructions["mixed"])

    def _get_depth_instruction(self, depth, knowledge_base):
        if isinstance(knowledge_base, str):
            try:
                knowledge_base = json.loads(knowledge_base)
            except (json.JSONDecodeError, TypeError):
                knowledge_base = {}
        avg_score = 50
        if isinstance(knowledge_base, dict) and knowledge_base:
            scores = [v for v in knowledge_base.values() if isinstance(v, (int, float))]
            if scores:
                avg_score = sum(scores) / len(scores)

        if depth == "beginner" or avg_score < 40:
            return "内容深度：入门级，从零开始讲解，多用类比和通俗语言，避免专业术语堆砌"
        elif depth == "advanced" or avg_score >= 70:
            return "内容深度：高级，侧重深度分析和前沿拓展，减少基础概念解释"
        else:
            return "内容深度：中级，适度讲解基础概念，重点展开核心知识点"

    def _get_goal_instruction(self, goal):
        instructions = {
            "exam": "学生目标为应试，请在文档中标注高频考点、考试重点，提供典型考题分析",
            "career": "学生目标为职业发展，请在文档中增加行业应用案例、职业技能关联",
            "hobby": "学生目标为兴趣学习，请在文档中增加趣味性内容、拓展阅读",
            "research": "学生目标为学术研究，请在文档中增加学术前沿、研究方法、论文引用",
        }
        return instructions.get(goal, "")

    def _build_kb_context(self, course_id, chapter_ids=None):
        if not course_id:
            return ""
        try:
            ctx = knowledge_base_service.build_knowledge_context_for_prompt(
                course_id, chapter_ids
            )
            if not ctx:
                return ""
            parts = []
            parts.append(f"\n## 课程知识库内容（课程：{ctx['course_title']}）")
            if ctx.get("syllabus_text"):
                parts.append(f"### 课程大纲\n{ctx['syllabus_text']}")
            if ctx.get("chapter_list"):
                parts.append(f"### 章节结构（文档结构应与此一致）\n{ctx['chapter_list']}")
            if ctx.get("knowledge_points_detail") and ctx["knowledge_points_detail"] != "暂无":
                parts.append(f"### 知识点详情（讲解必须基于这些内容）\n{ctx['knowledge_points_detail']}")
            if ctx.get("teaching_cases_detail") and ctx["teaching_cases_detail"] != "暂无":
                parts.append(f"### 教学案例（可作为文档示例）\n{ctx['teaching_cases_detail']}")
            return "\n\n".join(parts)
        except Exception as e:
            logger.warning(f"Failed to build KB context for document agent: {e}")
            return ""

    def _parse_json_response(self, response):
        text = response.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            first_line = lines[0].strip()
            if first_line.startswith("```") and len(first_line) > 3:
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            candidate = text[start:end]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                repaired = self._repair_mismatched_brackets(candidate)
                if repaired:
                    try:
                        return json.loads(repaired)
                    except (json.JSONDecodeError, ValueError):
                        pass
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            candidate = text[start:end]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                repaired = self._repair_mismatched_brackets(candidate)
                if repaired:
                    try:
                        return json.loads(repaired)
                    except (json.JSONDecodeError, ValueError):
                        pass
        repaired_full = self._repair_mismatched_brackets(text)
        if repaired_full:
            try:
                return json.loads(repaired_full)
            except (json.JSONDecodeError, ValueError):
                pass
        return {"raw_response": text, "parse_error": True}

    @staticmethod
    def _repair_mismatched_brackets(text):
        if not text or not isinstance(text, str):
            return None

        chars = list(text)
        stack = []
        in_str = False
        esc = False

        for i, ch in enumerate(chars):
            if esc:
                esc = False
                continue
            if ch == '\\' and in_str:
                esc = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch in '{[':
                stack.append(ch)
            elif ch in '}]':
                if stack:
                    last_ch = stack[-1]
                    if (ch == '}' and last_ch == '{') or (ch == ']' and last_ch == '['):
                        stack.pop()
                    else:
                        expected = '}' if last_ch == '{' else ']'
                        chars[i] = expected
                        stack.pop()
                else:
                    chars[i] = ''

        result = ''.join(chars).rstrip()
        while stack:
            last_ch = stack.pop()
            expected = '}' if last_ch == '{' else ']'
            result += expected

        try:
            json.loads(result)
            return result
        except json.JSONDecodeError:
            pass

        brace_count = 0
        json_start = None
        for i, ch in enumerate(result):
            if ch == '{':
                if brace_count == 0:
                    json_start = i
                brace_count += 1
            elif ch == '}':
                brace_count -= 1
                if brace_count == 0 and json_start is not None:
                    candidate = result[json_start:i + 1]
                    try:
                        json.loads(candidate)
                        return candidate
                    except (json.JSONDecodeError, ValueError):
                        json_start = None

        return None
