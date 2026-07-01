import json
import logging
from src.services.multi_agent import AgentBase
from src.services.multi_agent.shared_state import (
    AgentStatus,
    AgentMessage,
    MessageType,
    shared_state,
    message_bus,
    agent_monitor,
)
from src.services.knowledge_base_service import knowledge_base_service

logger = logging.getLogger(__name__)

EXERCISE_SYSTEM_PROMPT = """你是一位专业的习题设计专家智能体，负责根据学生画像和知识点生成个性化练习题目。

## 你的职责
根据学生画像中的认知风格、知识基础、易错点模式等信息，生成针对性的练习题目。

## 生成规则
1. 题型分布：选择题40%、填空题30%、简答题20%、编程/实操题10%
2. 难度梯度：基础题60%、进阶题30%、挑战题10%
3. 每题必须包含：题干、选项(选择题)、答案、详细解析、知识点标签、难度等级
4. 针对学生易错点设计陷阱选项和干扰项

## 严格禁止事项（必须遵守）
1. **禁止生成多选题**：所有选择题必须为单选题，有且仅有一个正确选项，绝不允许出现"正确答案是A和C"等多选表述
2. **禁止使用占位符选项**：选项必须填写具体的知识内容，严禁出现"选项A的具体内容"、"选项B"等占位文本
3. **禁止答案与解析矛盾**：answer字段指定的正确答案必须与explanation中声明的答案完全一致

## 选择题格式规范（必须遵守）
- options数组中必须填写4个具体的知识内容选项，例如：["消息队列(MQ)", "远程过程调用(RPC)", "分布式缓存", "负载均衡器"]
- answer字段必须填写正确选项的完整文本（与options中某一项完全一致）
- explanation字段必须以"正确答案：X。"开头（X为选项字母A/B/C/D），然后再展开解析，例如："正确答案：B。中间件的主要作用是……"

## 解析格式规范
解析必须包含以下三部分：
1. 正确答案声明：以"正确答案：X。"开头（X为选项字母）
2. 推理过程：解释为什么该选项正确
3. 常见错误分析：指出其他选项为什么错误或学生容易选错的原因

## 知识库内容使用规则
当提供了课程知识库内容时，必须：
1. 严格基于知识库中的知识点生成题目，确保题目内容与课程教学一致
2. 参考已有教学案例的背景和场景设计应用题
3. 参考已有习题的风格和难度，生成同类型或互补型题目
4. 新题目不得与已有习题重复，但可以延伸和拓展
5. 题目的知识点标签必须与知识库中的知识点对应

## 学生画像适配
- 视觉型学习者：题目中增加图表描述、流程图题
- 动觉型学习者：增加实操题、代码题比例
- 阅读型学习者：增加概念辨析题、论述题
- 易错点针对性：在学生常犯错误类型上增加题目密度

## 输出格式
严格返回以下JSON格式：
{
  "exercises": [
    {
      "id": "ex_001",
      "type": "multiple_choice|fill_blank|short_answer|coding",
      "question": "题目内容",
      "options": ["具体选项内容A", "具体选项内容B", "具体选项内容C", "具体选项内容D"],
      "answer": "与options中正确选项完全一致的文本",
      "explanation": "正确答案：X。详细解析内容...",
      "knowledge_points": ["知识点1", "知识点2"],
      "difficulty": 1-5,
      "estimated_time_minutes": 5,
      "common_mistakes": ["常见错误1", "常见错误2"],
      "hints": ["提示1"]
    }
  ],
  "total_count": 10,
  "difficulty_distribution": {"basic": 6, "intermediate": 3, "advanced": 1},
  "coverage_summary": "知识点覆盖说明"
}"""


class ExerciseAgent(AgentBase):
    agent_name = "exercise_agent"
    agent_role = "习题设计专家"
    agent_description = "根据学生画像和知识点生成个性化练习题目，覆盖多种题型和难度梯度"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)
        message_bus.register(self.agent_name)
        agent_monitor.register_agent(
            self.agent_name, self.agent_role, self.get_capabilities()
        )

    def get_capabilities(self):
        return [
            "generate_exercises",
            "generate_targeted_exercises",
            "generate_adaptive_quiz",
            "generate_layered_exercises",
            "analyze_exercise_quality",
        ]

    def process(self, task):
        task_type = task.get("type")
        agent_monitor.update_status(
            self.agent_name, AgentStatus.RUNNING, task_type
        )
        try:
            if task_type == "generate_exercises":
                result = self._generate_exercises(task)
            elif task_type == "generate_targeted_exercises":
                result = self._generate_targeted_exercises(task)
            elif task_type == "generate_adaptive_quiz":
                result = self._generate_adaptive_quiz(task)
            elif task_type == "generate_layered_exercises":
                result = self._generate_layered_exercises(task)
            elif task_type == "analyze_exercise_quality":
                result = self._analyze_quality(task)
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
            logger.error(f"ExerciseAgent error: {e}")
            agent_monitor.update_status(self.agent_name, AgentStatus.FAILED)
            return {"error": str(e)}

    def _generate_exercises(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        count = task.get("count", 10)
        difficulty = task.get("difficulty", 3)
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        cognitive_style = profile.get("cognitive_style", "mixed")
        error_patterns = profile.get("error_patterns", [])
        knowledge_base = profile.get("knowledge_base", {})

        style_hint = self._get_style_hint(cognitive_style)
        error_hint = self._get_error_hint(error_patterns)
        weakness_hint = self._get_weakness_hint(knowledge_base)

        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请为以下学习场景生成{count}道练习题目。

## 学习主题
{topic}

## 知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动提取'}

## 难度等级
{difficulty}/5

## 学生画像适配
{style_hint}
{error_hint}
{weakness_hint}
{kb_context}

## 格式要求（必须严格遵守）
1. 所有选择题必须为单选题，禁止多选
2. options数组中每个选项必须填写具体的知识内容，禁止使用"选项A的具体内容"等占位符
3. answer字段必须填写正确选项的完整文本（与options中某一项完全一致）
4. explanation字段必须以"正确答案：X。"开头（X为选项字母A/B/C/D），然后再展开解析
5. 请严格按照JSON格式输出，包含{count}道题目"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=EXERCISE_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)
            shared_state.set(
                "last_exercise_result", parsed, self.agent_name
            )
            return parsed
        except Exception as e:
            logger.error(f"Exercise generation failed: {e}")
            return {"error": str(e)}

    def _generate_targeted_exercises(self, task):
        profile = task.get("student_profile", {})
        weak_points = task.get("weak_points", [])
        error_types = task.get("error_types", [])
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        if not weak_points:
            weak_points = self._extract_weak_points(profile)

        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请针对学生的薄弱知识点生成专项练习。

## 薄弱知识点
{json.dumps(weak_points, ensure_ascii=False)}

## 常见错误类型
{json.dumps(error_types, ensure_ascii=False)}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}
{kb_context}

要求：
1. 每个薄弱知识点至少2道题
2. 题目设计要针对学生常犯的错误类型设置陷阱
3. 解析要重点讲解易错点
4. 生成8-12道题目
5. 所有选择题必须为单选题，禁止多选
6. options数组中每个选项必须填写具体的知识内容，禁止使用占位符
7. explanation字段必须以"正确答案：X。"开头（X为选项字母A/B/C/D）

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=EXERCISE_SYSTEM_PROMPT,
                temperature=0.6,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_adaptive_quiz(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        previous_performance = task.get("previous_performance", {})
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        correct_rate = previous_performance.get("correct_rate", 0.5)
        if correct_rate >= 0.8:
            difficulty = 4
        elif correct_rate >= 0.6:
            difficulty = 3
        elif correct_rate >= 0.4:
            difficulty = 2
        else:
            difficulty = 1

        prompt = f"""请根据学生历史表现生成自适应测验。

## 学习主题
{topic}

## 学生历史正确率
{correct_rate * 100:.0f}%

## 自适应难度
{difficulty}/5（根据正确率自动调整）

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 根据正确率调整难度：正确率高则提升难度，低则降低难度
2. 混合不同题型
3. 生成5道题目
4. 包含1道挑战题（即使整体难度较低）

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=EXERCISE_SYSTEM_PROMPT,
                temperature=0.6,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_layered_exercises(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请生成分层次练习题目，包含三个难度层级。

## 学习主题
{topic}

## 知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动提取'}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}
{kb_context}

要求：
1. 基础巩固题（5道）：考查基本概念和定义，难度1-2级，确保学生掌握核心概念
2. 能力提升题（4道）：考查原理理解和应用，难度3级，要求学生能运用知识解决问题
3. 综合应用题（3道）：考查综合分析和创新应用，难度4-5级，要求跨知识点综合运用
4. 所有选择题必须为单选题，禁止多选
5. options数组中每个选项必须填写具体的知识内容，禁止使用占位符
6. explanation字段必须以"正确答案：X。"开头（X为选项字母A/B/C/D）

每题必须包含：
- 题干、选项(选择题)、答案、详细解析
- 知识点标签、难度等级、所属层级
- 常见错误分析

请严格按照JSON格式输出：
{{
  "layered_exercises": {{
    "basic": {{
      "label": "基础巩固",
      "description": "考查基本概念和定义",
      "exercises": [...]
    }},
    "intermediate": {{
      "label": "能力提升",
      "description": "考查原理理解和应用",
      "exercises": [...]
    }},
    "advanced": {{
      "label": "综合应用",
      "description": "考查综合分析和创新应用",
      "exercises": [...]
    }}
  }},
  "total_count": 12,
  "coverage_summary": "知识点覆盖说明"
}}"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=EXERCISE_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)
            shared_state.set(
                "last_layered_exercise_result", parsed, self.agent_name
            )
            return parsed
        except Exception as e:
            logger.error(f"Layered exercise generation failed: {e}")
            return {"error": str(e)}

    def _analyze_quality(self, task):
        exercises = task.get("exercises", [])
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')
        prompt = f"""请分析以下习题集的质量：

{json.dumps(exercises, ensure_ascii=False)[:3000]}

分析维度：
1. 知识点覆盖率
2. 难度梯度合理性
3. 题型多样性
4. 干扰项有效性
5. 解析完整性

返回JSON格式：
{{
  "overall_score": 0-100,
  "coverage_score": 0-100,
  "difficulty_score": 0-100,
  "diversity_score": 0-100,
  "suggestions": ["改进建议1", "改进建议2"]
}}"""

        try:
            response = self._call_llm(prompt, temperature=0.3, user_id=_user_id, user_role=_user_role)
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _get_style_hint(self, style):
        hints = {
            "visual": "学生偏好视觉学习，请在题目中增加图表描述类题目、流程图分析题",
            "auditory": "学生偏好听觉学习，请增加概念辨析和口头论述类题目",
            "kinesthetic": "学生偏好动手实践，请增加实操题、代码编写题、实验设计题比例至20%",
            "reading": "学生偏好阅读学习，请增加概念分析、文献理解类题目",
            "mixed": "学生为混合型学习者，请均衡分配各类题型",
        }
        return hints.get(style, hints["mixed"])

    def _get_error_hint(self, error_patterns):
        if not error_patterns:
            return ""
        if isinstance(error_patterns, str):
            try:
                error_patterns = json.loads(error_patterns)
            except (json.JSONDecodeError, TypeError):
                return ""
        if not isinstance(error_patterns, list) or not error_patterns:
            return ""
        hints = []
        for ep in error_patterns[:3]:
            if isinstance(ep, dict):
                etype = ep.get("error_type", "")
                freq = ep.get("frequency", "")
                hints.append(f"学生常犯{etype}错误（频率：{freq}）")
        return "易错点适配：" + "；".join(hints) if hints else ""

    def _get_weakness_hint(self, knowledge_base):
        if not knowledge_base:
            return ""
        if isinstance(knowledge_base, str):
            try:
                knowledge_base = json.loads(knowledge_base)
            except (json.JSONDecodeError, TypeError):
                return ""
        if not isinstance(knowledge_base, dict):
            return ""
        weak = [k for k, v in knowledge_base.items() if isinstance(v, (int, float)) and v < 50]
        if weak:
            return f"薄弱知识领域：{', '.join(weak)}，请增加这些领域的题目密度"
        return ""

    def _extract_weak_points(self, profile):
        kb = profile.get("knowledge_base", {})
        if isinstance(kb, str):
            try:
                kb = json.loads(kb)
            except (json.JSONDecodeError, TypeError):
                kb = {}
        return [k for k, v in kb.items() if isinstance(v, (int, float)) and v < 50] if isinstance(kb, dict) else []

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
                parts.append(f"### 章节结构\n{ctx['chapter_list']}")
            if ctx.get("knowledge_points_detail") and ctx["knowledge_points_detail"] != "暂无":
                parts.append(f"### 知识点详情\n{ctx['knowledge_points_detail']}")
            if ctx.get("teaching_cases_detail") and ctx["teaching_cases_detail"] != "暂无":
                parts.append(f"### 已有教学案例（可参考场景设计应用题）\n{ctx['teaching_cases_detail']}")
            if ctx.get("exercises_detail") and ctx["exercises_detail"] != "暂无":
                parts.append(f"### 已有习题（请勿重复，可延伸拓展）\n{ctx['exercises_detail']}")
            return "\n\n".join(parts)
        except Exception as e:
            logger.warning(f"Failed to build KB context for exercise agent: {e}")
            return ""

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
