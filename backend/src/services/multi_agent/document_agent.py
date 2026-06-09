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
严格返回以下JSON格式，不要添加任何markdown代码块标记：
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
        "content": "章节正文内容，至少200字，包含概念定义、核心要素、相关原理的详细讲解",
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
}

## 重要提醒
- content字段不得为空，每个章节至少200字的详细讲解
- 至少生成3个章节，每个章节包含至少2个key_points和1个example
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
2. 第一层分支覆盖该主题的4-6个主要知识领域
3. 每个第一层分支下至少2个核心概念（第二层）
4. 核心概念下展开具体知识点或应用场景（第三层）
5. 每个节点必须有有意义的description（10-50字）
6. 标记核心节点is_core=true
7. 准确标注relationship_type（包含/并列/因果/递进）

请严格按照JSON格式输出，不要用```json```包裹。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=MINDMAP_SYSTEM_PROMPT,
                temperature=0.5,
                user_id=_user_id,
                user_role=_user_role,
            )
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
