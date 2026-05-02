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

logger = logging.getLogger(__name__)

EXERCISE_SYSTEM_PROMPT = """你是一位专业的习题设计专家智能体，负责根据学生画像和知识点生成个性化练习题目。

## 你的职责
根据学生画像中的认知风格、知识基础、易错点模式等信息，生成针对性的练习题目。

## 生成规则
1. 题型分布：选择题40%、填空题30%、简答题20%、编程/实操题10%
2. 难度梯度：基础题60%、进阶题30%、挑战题10%
3. 每题必须包含：题干、选项(选择题)、答案、详细解析、知识点标签、难度等级
4. 针对学生易错点设计陷阱选项和干扰项
5. 解析必须包含：正确答案推理过程、常见错误分析、知识点关联

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
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "answer": "正确答案",
      "explanation": "详细解析",
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

        cognitive_style = profile.get("cognitive_style", "mixed")
        error_patterns = profile.get("error_patterns", [])
        knowledge_base = profile.get("knowledge_base", {})

        style_hint = self._get_style_hint(cognitive_style)
        error_hint = self._get_error_hint(error_patterns)
        weakness_hint = self._get_weakness_hint(knowledge_base)

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

请严格按照JSON格式输出，包含{count}道题目。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=EXERCISE_SYSTEM_PROMPT,
                temperature=0.7,
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

        if not weak_points:
            weak_points = self._extract_weak_points(profile)

        prompt = f"""请针对学生的薄弱知识点生成专项练习。

## 薄弱知识点
{json.dumps(weak_points, ensure_ascii=False)}

## 常见错误类型
{json.dumps(error_types, ensure_ascii=False)}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 每个薄弱知识点至少2道题
2. 题目设计要针对学生常犯的错误类型设置陷阱
3. 解析要重点讲解易错点
4. 生成8-12道题目

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=EXERCISE_SYSTEM_PROMPT,
                temperature=0.6,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_adaptive_quiz(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        previous_performance = task.get("previous_performance", {})

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
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _analyze_quality(self, task):
        exercises = task.get("exercises", [])
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
            response = self._call_llm(prompt, temperature=0.3)
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
