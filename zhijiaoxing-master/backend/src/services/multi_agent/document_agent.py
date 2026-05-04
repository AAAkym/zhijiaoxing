import json
import logging
from src.services.multi_agent import AgentBase
from src.services.multi_agent.shared_state import (
    AgentStatus,
    shared_state,
    message_bus,
    agent_monitor,
)

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

## 学生画像适配
- 视觉型：增加图表描述、流程图文字版、结构化展示
- 动觉型：增加实操步骤、动手实验指导
- 阅读型：增加详细文字阐述、文献引用
- 初学者：增加概念解释、入门引导
- 进阶者：增加深度分析、前沿拓展

## 输出格式
严格返回以下JSON格式：
{
  "document": {
    "title": "文档标题",
    "summary": "200字以内的内容摘要",
    "target_audience": "目标读者描述",
    "estimated_reading_time_minutes": 30,
    "sections": [
      {
        "section_id": "s1",
        "title": "章节标题",
        "key_points": ["要点1", "要点2"],
        "content": "章节正文内容（Markdown格式）",
        "examples": [
          {
            "title": "示例标题",
            "description": "示例描述",
            "content": "示例内容"
          }
        ],
        "common_mistakes": ["误区1", "误区2"],
        "further_reading": ["扩展阅读1"]
      }
    ],
    "glossary": [
      {"term": "术语", "definition": "定义"}
    ],
    "review_questions": ["复习思考题1"]
  }
}"""


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

        cognitive_style = profile.get("cognitive_style", "mixed")
        knowledge_base = profile.get("knowledge_base", {})
        goal = profile.get("goal_orientation", "exam")

        style_instruction = self._get_style_instruction(cognitive_style)
        depth_instruction = self._get_depth_instruction(depth, knowledge_base)
        goal_instruction = self._get_goal_instruction(goal)

        prompt = f"""请生成一份专业的课程讲解文档。

## 主题
{topic}

## 知识点范围
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动规划'}

## 深度要求
{depth_instruction}

## 学生画像适配
{style_instruction}
{goal_instruction}

要求：
1. 文档结构清晰，至少包含3个章节
2. 每个章节包含核心知识点讲解、实际示例、常见误区
3. 内容深度适配学生当前水平
4. 包含术语表和复习思考题

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=DOCUMENT_SYSTEM_PROMPT,
                temperature=0.7,
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

        prompt = f"""请生成一份精简的知识点笔记。

## 主题
{topic}

## 核心概念
{json.dumps(key_concepts, ensure_ascii=False) if key_concepts else '自动提取'}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

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
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_review_summary(self, task):
        profile = task.get("student_profile", {})
        course_content = task.get("course_content", "")
        topics = task.get("topics", [])

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
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_mindmap_content(self, task):
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        depth = task.get("depth", 3)

        prompt = f"""请生成知识点思维导图的结构化内容。

## 主题
{topic}

## 知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '自动提取'}

## 层级深度
{depth}层

要求：
1. 以树状结构组织知识点
2. 每个节点包含：名称、简要说明、关联知识点
3. 标注核心节点和扩展节点
4. 适合可视化展示

返回JSON格式：
{{
  "mindmap": {{
    "root": {{
      "name": "根节点",
      "description": "描述",
      "is_core": true,
      "children": [
        {{
          "name": "子节点",
          "description": "描述",
          "is_core": false,
          "children": []
        }}
      ]
    }}
  }}
}}"""

        try:
            response = self._call_llm(prompt, temperature=0.5)
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

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

    def _parse_json_response(self, response):
        text = response.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            return {"raw_response": text, "parse_error": True}
