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

PROJECT_SYSTEM_PROMPT = """你是一位专业的实践教学设计专家智能体，负责根据学生画像设计代码类实操案例和实践项目学习材料。

## 你的职责
根据学生专业、知识基础、学习目标，设计具有实际应用价值的实操案例和项目学习材料。

## 设计原则
1. 项目驱动：以完成实际项目为目标，边做边学
2. 难度递进：从简单案例到综合项目，逐步提升
3. 理论结合：每个实操步骤关联对应理论知识
4. 评估明确：提供清晰的评分标准和验收条件
5. 可扩展：基础版本可扩展为高级版本

## 项目类型
- 代码实操：编程练习、算法实现、系统开发
- 实验设计：科学实验、数据分析、模型训练
- 案例分析：商业案例、工程案例、研究案例
- 综合项目：跨知识点、多技能的综合实践

## 学生画像适配
- 初学者：提供详细步骤指导、代码模板、参考答案
- 进阶者：提供需求描述、关键提示、自主实现
- 动觉型：增加实操比例，减少理论讲解
- 考试导向：设计与考试题型相似的实操练习
- 职业导向：设计与实际工作场景相关的项目

## 输出格式
严格返回以下JSON格式：
{
  "project": {
    "title": "项目标题",
    "type": "coding|experiment|case_study|comprehensive",
    "difficulty": "beginner|intermediate|advanced",
    "estimated_hours": 4,
    "description": "项目描述（100-200字）",
    "learning_objectives": ["目标1", "目标2"],
    "prerequisites": ["前置知识1", "前置知识2"],
    "knowledge_points_covered": ["知识点1", "知识点2"],
    "tasks": [
      {
        "task_id": "t1",
        "title": "任务标题",
        "description": "任务描述",
        "steps": [
          {
            "step": 1,
            "instruction": "操作指导",
            "hint": "提示信息",
            "expected_output": "预期输出描述",
            "code_template": "代码模板（如适用）"
          }
        ],
        "deliverable": "交付物描述",
        "grading_criteria": [
          {"criterion": "评分标准", "weight": 0.3, "description": "说明"}
        ]
      }
    ],
    "starter_code": "起始代码（如适用）",
    "reference_solution": "参考答案（如适用）",
    "extension_challenges": ["扩展挑战1"],
    "resources_needed": ["所需资源1"],
    "rubric": {
      "excellent": "优秀标准描述",
      "good": "良好标准描述",
      "pass": "及格标准描述",
      "fail": "不及格标准描述"
    }
  }
}"""


class ProjectAgent(AgentBase):
    agent_name = "project_agent"
    agent_role = "实践项目设计专家"
    agent_description = "根据学生画像设计代码类实操案例和实践项目学习材料，包含任务分解、评分标准和参考方案"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)
        message_bus.register(self.agent_name)
        agent_monitor.register_agent(
            self.agent_name, self.agent_role, self.get_capabilities()
        )

    def get_capabilities(self):
        return [
            "generate_coding_project",
            "generate_experiment_design",
            "generate_case_study",
            "generate_comprehensive_project",
        ]

    def process(self, task):
        task_type = task.get("type")
        agent_monitor.update_status(
            self.agent_name, AgentStatus.RUNNING, task_type
        )
        try:
            if task_type == "generate_coding_project":
                result = self._generate_coding_project(task)
            elif task_type == "generate_experiment_design":
                result = self._generate_experiment_design(task)
            elif task_type == "generate_case_study":
                result = self._generate_case_study(task)
            elif task_type == "generate_comprehensive_project":
                result = self._generate_comprehensive_project(task)
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
            logger.error(f"ProjectAgent error: {e}")
            agent_monitor.update_status(self.agent_name, AgentStatus.FAILED)
            return {"error": str(e)}

    def _generate_coding_project(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        language = task.get("language", "Python")
        difficulty = task.get("difficulty", "intermediate")
        knowledge_points = task.get("knowledge_points", [])
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        knowledge_base = profile.get("knowledge_base", {})
        goal = profile.get("goal_orientation", "exam")
        level_hint = self._determine_difficulty(difficulty, knowledge_base)
        goal_hint = self._get_goal_project_hint(goal)
        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请设计一个与课程主题紧密相关的代码实操项目。

## 项目主题
{topic}

## 编程语言
{language}

## 难度等级
{level_hint}

## 涉及知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动规划'}

## 学生画像适配
{goal_hint}
{kb_context}

## 关键要求
1. 代码必须是与主题直接相关的真实实现，禁止生成"Hello World"等入门级示例
   - 机器学习主题：必须包含数据加载与预处理、特征工程、模型构建与训练、交叉验证、性能评估（准确率/F1/AUC等）、结果可视化
   - 深度学习主题：必须包含数据集加载、网络架构定义、训练循环（含loss计算和反向传播）、验证与早停、测试评估
   - 数据分析主题：必须包含数据清洗、探索性分析（EDA）、统计检验、可视化图表、结论总结
   - 算法实现主题：必须包含算法核心逻辑、时间/空间复杂度分析、与基准方法的对比实验、性能测试
2. 例如：如果主题是机器学习，代码应包含真实的数据加载、模型训练、评估流程；如果主题是数据结构，代码应包含完整的算法实现和性能对比
3. 代码必须完整可运行，包含所有必要的import语句、数据准备、核心逻辑和输出展示
4. 代码中必须有详细的中文注释，解释每个关键步骤的原理和目的
5. 项目分解为3-5个子任务，从基础实现到进阶优化逐步递进
6. 每个子任务包含完整代码、运行说明和预期输出
7. 包含评分标准

请严格按照以下JSON格式输出：
{{
  "project_title": "项目标题",
  "project_description": "项目描述和应用场景",
  "difficulty": "{level_hint}",
  "programming_language": "{language}",
  "estimated_time": "预计完成时间",
  "prerequisites": ["前置知识1", "前置知识2"],
  "tasks": [
    {{
      "task_id": 1,
      "title": "子任务标题",
      "description": "任务描述",
      "steps": ["步骤1", "步骤2"],
      "code_template": "代码模板（含注释和TODO标记）",
      "reference_solution": "参考实现代码（完整可运行）",
      "expected_output": "预期输出说明",
      "hints": ["提示1", "提示2"]
    }}
  ],
  "full_code": "完整可运行的代码（包含所有import、数据处理、核心逻辑、输出展示）",
  "scoring_criteria": [
    {{"item": "评分项", "points": 分值, "description": "评分标准描述"}}
  ]
}}

注意：full_code 必须是一个完整的、可直接运行的Python脚本，长度不少于50行，包含：
- 所有必要的import语句（numpy, pandas, sklearn, matplotlib等）
- 数据加载/生成代码（使用sklearn内置数据集或生成模拟数据）
- 完整的模型训练/算法实现流程
- 结果输出和可视化
- 详细的中文注释解释每一步的原理"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=PROJECT_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)
            shared_state.set(
                "last_project_result", parsed, self.agent_name
            )
            return parsed
        except Exception as e:
            return {"error": str(e)}

    def _generate_experiment_design(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        experiment_type = task.get("experiment_type", "data_analysis")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = f"""请设计一个实验/数据分析项目。

## 实验主题
{topic}

## 实验类型
{experiment_type}（数据分析/机器学习/科学实验/模拟仿真）

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 包含实验目的、假设、方法、步骤
2. 提供数据集描述或获取方式
3. 包含实验报告模板
4. 标注关键注意事项

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=PROJECT_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_case_study(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        case_type = task.get("case_type", "business")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = f"""请设计一个案例分析项目。

## 案例主题
{topic}

## 案例类型
{case_type}（商业案例/工程案例/研究案例/教学案例）

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 提供完整的案例背景描述
2. 设计3-5个分析问题
3. 包含分析框架和方法指导
4. 提供参考分析思路

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=PROJECT_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_comprehensive_project(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        duration_weeks = task.get("duration_weeks", 2)
        team_size = task.get("team_size", 1)
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = f"""请设计一个综合实践项目。

## 项目主题
{topic}

## 项目周期
{duration_weeks}周

## 团队规模
{team_size}人

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 项目需涵盖多个知识点和技能
2. 按周分解任务，设置里程碑
3. 包含个人任务和团队协作任务
4. 提供完整的项目管理指导
5. 包含最终展示和答辩要求

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=PROJECT_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _determine_difficulty(self, requested, knowledge_base):
        if isinstance(knowledge_base, str):
            try:
                knowledge_base = json.loads(knowledge_base)
            except (json.JSONDecodeError, TypeError):
                knowledge_base = {}
        if isinstance(knowledge_base, dict) and knowledge_base:
            scores = [v for v in knowledge_base.values() if isinstance(v, (int, float))]
            if scores:
                avg = sum(scores) / len(scores)
                if avg >= 70:
                    return "高级（学生基础扎实，设计挑战性项目）"
                elif avg >= 40:
                    return "中级（学生有一定基础，设计适度挑战项目）"
                else:
                    return "初级（学生基础薄弱，提供详细步骤指导）"
        return requested

    def _get_goal_project_hint(self, goal):
        hints = {
            "exam": "学生目标为应试，请设计与考试题型相似的实操练习，重点覆盖高频考点",
            "career": "学生目标为职业发展，请设计与实际工作场景相关的项目，增加简历亮点",
            "hobby": "学生目标为兴趣学习，请设计有趣味性的项目，激发学习动力",
            "research": "学生目标为学术研究，请设计研究型项目，培养科研能力",
        }
        return hints.get(goal, "")

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
            if ctx.get("chapter_list"):
                parts.append(f"### 章节结构\n{ctx['chapter_list']}")
            if ctx.get("knowledge_points_detail") and ctx["knowledge_points_detail"] != "暂无":
                parts.append(f"### 知识点详情（项目应覆盖这些知识点）\n{ctx['knowledge_points_detail']}")
            if ctx.get("teaching_cases_detail") and ctx["teaching_cases_detail"] != "暂无":
                parts.append(f"### 教学案例（可参考案例设计项目场景）\n{ctx['teaching_cases_detail']}")
            if ctx.get("exercises_detail") and ctx["exercises_detail"] != "暂无":
                parts.append(f"### 已有习题（项目可延伸这些习题内容）\n{ctx['exercises_detail']}")
            return "\n\n".join(parts)
        except Exception as e:
            logger.warning(f"Failed to build KB context for project agent: {e}")
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
