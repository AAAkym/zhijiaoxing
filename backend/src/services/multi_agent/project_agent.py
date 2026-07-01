import json
import logging
import re
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

            # 最终降级保障：若结果仍含 error，尝试生成降级项目
            if "error" in result and task_type in (
                "generate_coding_project", "generate_comprehensive_project"
            ):
                logger.warning(
                    f"ProjectAgent {task_type} 返回 error，尝试最终降级生成"
                )
                try:
                    fallback = self._build_fallback_project(
                        task.get("topic", "学习主题"),
                        task.get("language", "python"),
                        task.get("knowledge_points", []),
                        task.get("difficulty", "intermediate"),
                    )
                    result = fallback
                except Exception as fallback_err:
                    logger.error(
                        f"ProjectAgent 最终降级生成也失败: {fallback_err}",
                        exc_info=True,
                    )

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
            logger.error(f"ProjectAgent error: {e}", exc_info=True)
            # 最外层异常保障：尝试降级生成
            try:
                fallback = self._build_fallback_project(
                    task.get("topic", "学习主题"),
                    task.get("language", "python"),
                    task.get("knowledge_points", []),
                    task.get("difficulty", "intermediate"),
                )
                agent_monitor.update_status(
                    self.agent_name, AgentStatus.SUCCESS
                )
                return fallback
            except Exception:
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
6. 每个子任务的 code_template 必须是真实的代码骨架（含函数签名、类定义和TODO注释），reference_solution 必须是该子任务的完整可运行实现代码，严禁填写"代码模板（含注释和TODO标记）"或"参考实现代码（完整可运行）"等占位文字
7. 包含评分标准
8. full_code 必须是一个完整可运行的完整脚本，可以直接复制到文件中运行

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
      "code_template": "该任务的真实代码骨架，包含类定义/函数签名和TODO注释，不少于15行有效代码",
      "reference_solution": "该任务的完整可运行实现代码，包含所有细节，不少于20行有效代码",
      "expected_output": "预期输出说明",
      "hints": ["提示1", "提示2"]
    }}
  ],
  "full_code": "完整可运行的代码（包含所有import、数据处理、核心逻辑、输出展示），长度不少于80行",
  "scoring_criteria": [
    {{"item": "评分项", "points": 分值, "description": "评分标准描述"}}
  ]
}}

重要警告：
- code_template 和 reference_solution 严禁填写占位文字或描述性文字
- 必须填写真实的、语法正确的代码字符串
- full_code 必须是一个完整的、可直接运行的{language}脚本
- 如果是Python，必须包含：所有必要的import、数据加载/生成、核心逻辑、输出展示
- 代码中必须包含详细的中文注释"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=PROJECT_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)

            # 代码质量校验与后处理：检测占位文字，必要时自动补全
            parsed = self._validate_and_enhance_code(parsed, topic, language, knowledge_points, level_hint)

            shared_state.set(
                "last_project_result", parsed, self.agent_name
            )
            return parsed
        except Exception as e:
            logger.error(f"ProjectAgent LLM 调用失败: {e}", exc_info=True)
            # 降级生成：基于主题和语言生成基础项目结构
            fallback = self._build_fallback_project(topic, language, knowledge_points, level_hint)
            shared_state.set(
                "last_project_result", fallback, self.agent_name
            )
            return fallback

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
            first_line = lines[0].strip()
            if first_line.startswith("```") and len(first_line) > 3:
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
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
            return {"raw_response": text, "parse_error": True}

    @staticmethod
    def _repair_mismatched_brackets(text):
        """修复 JSON 文本中不匹配的括号。"""
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

    def _is_placeholder_code(self, code_str):
        """检测代码是否为占位文字而非真实代码。"""
        if not code_str or not isinstance(code_str, str):
            return True
        code_lower = code_str.strip().lower()
        if len(code_lower) < 30:
            return True
        # 常见占位文字模式
        placeholder_patterns = [
            r'代码模板', r'参考实现', r'参考代码', r'待补充',
            r'todo.*标记', r'占位', r'示例代码', r'完整可运行',
            r'代码骨架', r'代码示例', r'这里写代码', r'请在此',
            r'xxx.*代码', r'your.*code', r'code.*here',
        ]
        for pattern in placeholder_patterns:
            if re.search(pattern, code_lower):
                return True
        return False

    def _generate_task_code_templates(self, topic, language, tasks):
        """为任务列表生成代码模板和参考实现（降级模式）。"""
        lang = language.lower()
        result = []
        for i, task in enumerate(tasks):
            task_title = task.get("title", f"任务{i + 1}")
            task_desc = task.get("description", "")
            if isinstance(task, dict):
                task = dict(task)
            else:
                task = {"title": task_title, "description": str(task)}

            # 生成代码模板
            code_template = self._build_code_template(task_title, task_desc, lang, i + 1)
            # 生成参考实现
            reference_solution = self._build_reference_solution(task_title, task_desc, lang, i + 1, topic)

            task["code_template"] = code_template
            task["reference_solution"] = reference_solution
            if not task.get("expected_output"):
                task["expected_output"] = f"完成{task_title}功能，输出正确的执行结果。"
            if not task.get("hints"):
                task["hints"] = [
                    f"先理解{task_title}的核心逻辑",
                    "注意边界条件和异常处理",
                    "编写测试用例验证功能",
                ]
            result.append(task)
        return result

    def _build_code_template(self, title, desc, lang, task_num):
        """为指定任务生成代码模板。"""
        if lang == "python":
            return f'''# 任务{task_num}：{title}
# 任务描述：{desc[:100] if desc else ""}

import os
import sys


def task_{task_num}_setup():
    """任务{task_num}：{title}"""
    # TODO: 初始化数据和变量
    pass


def main():
    """主函数：执行任务{task_num}"""
    print("=== 任务{task_num}：{title} ===")
    # TODO: 调用核心函数
    # TODO: 输出结果
    pass


if __name__ == "__main__":
    main()
'''
        elif lang == "java":
            return f'''// 任务{task_num}：{title}
// 任务描述：{desc[:100] if desc else ""}

public class Task{task_num} {{

    /**
     * 任务{task_num}：{title}
     */
    public static void task{task_num}Setup() {{
        // TODO: 初始化数据和变量
    }}

    public static void main(String[] args) {{
        System.out.println("=== 任务{task_num}：{title} ===");
        // TODO: 调用核心函数
        // TODO: 输出结果
    }}
}}
'''
        elif lang == "javascript":
            return f'''// 任务{task_num}：{title}
// 任务描述：{desc[:100] if desc else ""}

/**
 * 任务{task_num}：{title}
 */
function task{task_num}Setup() {{
    // TODO: 初始化数据和变量
}}

function main() {{
    console.log("=== 任务{task_num}：{title} ===");
    // TODO: 调用核心函数
    // TODO: 输出结果
}}

main();
'''
        elif lang == "cpp" or lang == "c++":
            return f'''// 任务{task_num}：{title}
// 任务描述：{desc[:100] if desc else ""}

#include <iostream>
#include <vector>
using namespace std;

/**
 * 任务{task_num}：{title}
 */
void task{task_num}Setup() {{
    // TODO: 初始化数据和变量
}}

int main() {{
    cout << "=== 任务{task_num}：{title} ===" << endl;
    // TODO: 调用核心函数
    // TODO: 输出结果
    return 0;
}}
'''
        else:
            return f'''// 任务{task_num}：{title}\n// TODO: 实现代码\n'''

    def _build_reference_solution(self, title, desc, lang, task_num, topic):
        """为指定任务生成完整参考实现。"""
        if lang == "python":
            return f'''# 任务{task_num}：{title}
# 任务描述：{desc[:100] if desc else ""}
# 参考实现：完整可运行代码

import os
import sys
from typing import List, Dict, Optional


class {title.replace(' ', '')}Handler:
    """{title}处理器"""

    def __init__(self):
        self.data = []
        self.results = {{}}

    def load_data(self, input_data: List) -> bool:
        """加载输入数据"""
        if not input_data:
            return False
        self.data = input_data
        return True

    def process(self) -> Dict:
        """核心处理逻辑"""
        if not self.data:
            return {{"status": "error", "message": "无数据"}}

        results = []
        for item in self.data:
            # 处理每个数据项
            processed = self._process_item(item)
            results.append(processed)

        self.results = {{
            "status": "success",
            "count": len(results),
            "data": results,
        }}
        return self.results

    def _process_item(self, item):
        """处理单个数据项（可根据任务具体实现）"""
        return {{
            "input": item,
            "output": str(item),
            "status": "processed",
        }}

    def display_results(self):
        """显示处理结果"""
        if not self.results:
            print("暂无结果")
            return
        print(f"处理完成，共 {{self.results.get('count', 0)}} 条记录")
        for i, item in enumerate(self.results.get("data", [])[:5]):
            print(f"  [{{i+1}}] {{item}}")


def main():
    """主函数：演示任务{task_num}功能"""
    print("=" * 50)
    print(f"任务{task_num}：{title}")
    print(f"主题：{topic}")
    print("=" * 50)

    # 初始化
    handler = {title.replace(' ', '')}Handler()

    # 模拟数据
    sample_data = ["示例数据1", "示例数据2", "示例数据3", "示例数据4", "示例数据5"]
    print(f"\n[1/3] 加载 {{len(sample_data)}} 条示例数据...")
    if handler.load_data(sample_data):
        print("  ✓ 数据加载成功")
    else:
        print("  ✗ 数据加载失败")
        return

    # 处理数据
    print(f"\n[2/3] 执行{title}处理...")
    result = handler.process()
    print(f"  ✓ 处理完成：{{result['status']}}")

    # 显示结果
    print(f"\n[3/3] 显示结果...")
    handler.display_results()

    print("\\n✓ 任务{task_num}执行完毕")


if __name__ == "__main__":
    main()
'''
        elif lang == "java":
            return f'''// 任务{task_num}：{title}
// 任务描述：{desc[:100] if desc else ""}
// 参考实现：完整可运行代码

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Task{task_num} {{

    private List<String> data;
    private Map<String, Object> results;

    public Task{task_num}() {{
        this.data = new ArrayList<>();
        this.results = new HashMap<>();
    }}

    /**
     * 加载输入数据
     */
    public boolean loadData(List<String> inputData) {{
        if (inputData == null || inputData.isEmpty()) {{
            return false;
        }}
        this.data = new ArrayList<>(inputData);
        return true;
    }}

    /**
     * 核心处理逻辑
     */
    public Map<String, Object> process() {{
        if (data.isEmpty()) {{
            results.put("status", "error");
            results.put("message", "无数据");
            return results;
        }}

        List<Map<String, String>> processedList = new ArrayList<>();
        for (String item : data) {{
            Map<String, String> processed = new HashMap<>();
            processed.put("input", item);
            processed.put("output", item.toUpperCase());
            processed.put("status", "processed");
            processedList.add(processed);
        }}

        results.put("status", "success");
        results.put("count", processedList.size());
        results.put("data", processedList);
        return results;
    }}

    /**
     * 显示处理结果
     */
    public void displayResults() {{
        if (results.isEmpty()) {{
            System.out.println("暂无结果");
            return;
        }}
        System.out.println("处理完成，共 " + results.get("count") + " 条记录");
        @SuppressWarnings("unchecked")
        List<Map<String, String>> dataList = (List<Map<String, String>>) results.get("data");
        for (int i = 0; i < Math.min(5, dataList.size()); i++) {{
            System.out.println("  [" + (i + 1) + "] " + dataList.get(i));
        }}
    }}

    public static void main(String[] args) {{
        System.out.println("==================================================");
        System.out.println("任务{task_num}：{title}");
        System.out.println("主题：{topic}");
        System.out.println("==================================================");

        Task{task_num} handler = new Task{task_num}();

        // 模拟数据
        List<String> sampleData = new ArrayList<>();
        sampleData.add("示例数据1");
        sampleData.add("示例数据2");
        sampleData.add("示例数据3");
        sampleData.add("示例数据4");
        sampleData.add("示例数据5");

        System.out.println("\\n[1/3] 加载 " + sampleData.size() + " 条示例数据...");
        if (handler.loadData(sampleData)) {{
            System.out.println("  ✓ 数据加载成功");
        }} else {{
            System.out.println("  ✗ 数据加载失败");
            return;
        }}

        // 处理数据
        System.out.println("\\n[2/3] 执行{title}处理...");
        handler.process();
        System.out.println("  ✓ 处理完成");

        // 显示结果
        System.out.println("\\n[3/3] 显示结果...");
        handler.displayResults();

        System.out.println("\\n✓ 任务{task_num}执行完毕");
    }}
}}
'''
        else:
            # 其他语言使用通用模板
            return f'''// 任务{task_num}：{title} - 参考实现\n// 完整可运行代码\n\nfunction main() {{\n  console.log("任务{task_num}：{title}");\n}}\nmain();\n'''

    def _build_full_code(self, topic, language, tasks, difficulty):
        """构建完整可运行的 full_code。

        使用普通字符串 + .replace() 替代 f-string，避免复杂转义导致的 bug。
        """
        lang = language.lower() if language else "python"
        task_titles = [t.get("title", f"任务{i+1}") if isinstance(t, dict) else f"任务{i+1}"
                       for i, t in enumerate(tasks)]
        task_list_str = ", ".join(task_titles[:3])
        # 生成合法的 Python 类名（移除空格和中划线）
        class_name = re.sub(r'[^a-zA-Z0-9_]', '', topic.replace(' ', '').replace('-', ''))
        if not class_name or not class_name[0].isalpha():
            class_name = "Project" + (class_name or "Main")

        if lang == "python":
            template = '''# ================================================================
# __TOPIC__ - 完整代码项目
# 难度：__DIFFICULTY__
# 包含任务：__TASK_LIST__
# 运行方式：直接运行本脚本
# ================================================================

import os
import sys
import time
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


# ================================================================
# 数据模型定义
# ================================================================

@dataclass
class ProjectConfig:
    """项目配置"""
    topic: str
    difficulty: str
    task_count: int
    verbose: bool = True


@dataclass
class TaskResult:
    """任务执行结果"""
    task_id: int
    task_name: str
    status: str
    duration: float
    output: Dict
    error: Optional[str] = None


# ================================================================
# 核心项目类
# ================================================================

class __CLASS_NAME__Project:
    """__TOPIC__项目主类"""

    def __init__(self, config: ProjectConfig):
        self.config = config
        self.results: List[TaskResult] = []
        self.data_store: Dict = {}
        self._init_logging()

    def _init_logging(self):
        """初始化日志输出"""
        if self.config.verbose:
            print(f"[INIT] {self.config.topic} 项目初始化")
            print(f"[INIT] 难度等级：{self.config.difficulty}")
            print(f"[INIT] 任务数量：{self.config.task_count}")

    def run_all_tasks(self) -> List[TaskResult]:
        """执行所有任务"""
        print("\\n" + "=" * 60)
        print(f"开始执行 {self.config.topic} 项目")
        print("=" * 60)

        start_time = time.time()

        for task_id in range(1, self.config.task_count + 1):
            result = self._run_task(task_id)
            self.results.append(result)
            if self.config.verbose:
                status_icon = "✓" if result.status == "success" else "✗"
                print(f"  [{status_icon}] 任务{task_id}: {result.task_name} ({result.duration:.3f}s)")

        total_time = time.time() - start_time
        success_count = sum(1 for r in self.results if r.status == "success")

        print("\\n" + "=" * 60)
        print(f"执行完成：{success_count}/{len(self.results)} 个任务成功")
        print(f"总耗时：{total_time:.3f} 秒")
        print("=" * 60)

        return self.results

    def _run_task(self, task_id: int) -> TaskResult:
        """执行单个任务"""
        task_start = time.time()
        task_name = f"任务{task_id}：数据处理阶段{task_id}"

        try:
            # 根据任务ID执行不同逻辑
            if task_id == 1:
                output = self._task1_data_preparation()
            elif task_id == 2:
                output = self._task2_core_processing()
            elif task_id == 3:
                output = self._task3_result_analysis()
            elif task_id == 4:
                output = self._task4_visualization()
            else:
                output = self._task_generic(task_id)

            duration = time.time() - task_start
            return TaskResult(
                task_id=task_id,
                task_name=task_name,
                status="success",
                duration=duration,
                output=output,
            )
        except Exception as e:
            duration = time.time() - task_start
            return TaskResult(
                task_id=task_id,
                task_name=task_name,
                status="error",
                duration=duration,
                output={},
                error=str(e),
            )

    def _task1_data_preparation(self) -> Dict:
        """任务1：数据准备阶段"""
        sample_data = [
            {"id": 1, "name": "数据项A", "value": 85, "category": "类别1"},
            {"id": 2, "name": "数据项B", "value": 72, "category": "类别1"},
            {"id": 3, "name": "数据项C", "value": 93, "category": "类别2"},
            {"id": 4, "name": "数据项D", "value": 66, "category": "类别2"},
            {"id": 5, "name": "数据项E", "value": 78, "category": "类别1"},
        ]
        self.data_store["raw_data"] = sample_data
        self.data_store["processed_data"] = [
            {**item, "normalized": item["value"] / 100.0}
            for item in sample_data
        ]
        return {
            "raw_count": len(sample_data),
            "categories": list(set(i["category"] for i in sample_data)),
            "avg_value": sum(i["value"] for i in sample_data) / len(sample_data),
        }

    def _task2_core_processing(self) -> Dict:
        """任务2：核心处理阶段"""
        data = self.data_store.get("processed_data", [])
        if not data:
            return {"error": "无数据"}

        # 分类统计
        category_stats = {}
        for item in data:
            cat = item["category"]
            if cat not in category_stats:
                category_stats[cat] = {"count": 0, "total": 0, "items": []}
            category_stats[cat]["count"] += 1
            category_stats[cat]["total"] += item["value"]
            category_stats[cat]["items"].append(item["name"])

        # 排序
        sorted_data = sorted(data, key=lambda x: x["value"], reverse=True)
        self.data_store["sorted_data"] = sorted_data
        self.data_store["category_stats"] = category_stats

        return {
            "sorted_top3": [i["name"] for i in sorted_data[:3]],
            "category_count": len(category_stats),
            "stats": {k: {"count": v["count"], "avg": round(v["total"]/v["count"], 2)}
                     for k, v in category_stats.items()},
        }

    def _task3_result_analysis(self) -> Dict:
        """任务3：结果分析阶段"""
        data = self.data_store.get("processed_data", [])
        if not data:
            return {"error": "无数据"}

        values = [item["value"] for item in data]
        return {
            "count": len(values),
            "sum": sum(values),
            "mean": round(sum(values) / len(values), 2),
            "max": max(values),
            "min": min(values),
            "range": max(values) - min(values),
            "sorted_desc": sorted(values, reverse=True),
            "above_avg": sum(1 for v in values if v > sum(values)/len(values)),
        }

    def _task4_visualization(self) -> Dict:
        """任务4：可视化输出阶段"""
        data = self.data_store.get("processed_data", [])
        if not data:
            return {"error": "无数据"}

        # 文本柱状图
        max_val = max(item["value"] for item in data)
        chart_lines = []
        for item in sorted(data, key=lambda x: x["value"], reverse=True):
            bar_len = int(item["value"] / max_val * 30)
            bar = "█" * bar_len
            chart_lines.append(f"  {item['name']:<8} | {bar} {item['value']}")

        return {
            "chart_title": f"{self.config.topic} - 数据分布",
            "chart": "\\n".join(chart_lines),
            "total_items": len(data),
        }

    def _task_generic(self, task_id: int) -> Dict:
        """通用任务处理"""
        return {
            "task_id": task_id,
            "message": f"任务{task_id}执行完成",
            "timestamp": datetime.now().isoformat(),
        }

    def print_summary(self):
        """打印项目执行总结"""
        print("\\n" + "=" * 60)
        print(f"项目执行总结 - {self.config.topic}")
        print("=" * 60)

        for result in self.results:
            status = "✓ 成功" if result.status == "success" else "✗ 失败"
            print(f"\\n  任务{result.task_id}: {result.task_name}")
            print(f"    状态: {status}")
            print(f"    耗时: {result.duration:.3f}s")
            if result.status == "success":
                for key, val in result.output.items():
                    if not isinstance(val, (list, dict)):
                        print(f"    {key}: {val}")

        # 打印可视化（如果有）
        vis_results = [r for r in self.results if r.output.get("chart")]
        if vis_results:
            print(f"\\n  可视化图表:")
            print(f"  {vis_results[0].output.get('chart_title', '')}")
            print(f"  {vis_results[0].output.get('chart', '')}")


# ================================================================
# 主入口
# ================================================================

def main():
    """主函数"""
    # 配置项目
    config = ProjectConfig(
        topic="__TOPIC__",
        difficulty="__DIFFICULTY__",
        task_count=min(4, max(3, __TASK_COUNT__)),
        verbose=True,
    )

    # 创建并运行项目
    project = __CLASS_NAME__Project(config)
    results = project.run_all_tasks()

    # 打印总结
    project.print_summary()

    # 返回码
    success_count = sum(1 for r in results if r.status == "success")
    return 0 if success_count == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
'''
            # 使用 .replace() 安全地插入变量，避免 f-string 转义问题
            return (template
                    .replace("__TOPIC__", topic)
                    .replace("__DIFFICULTY__", difficulty or "intermediate")
                    .replace("__TASK_LIST__", task_list_str)
                    .replace("__CLASS_NAME__", class_name)
                    .replace("__TASK_COUNT__", str(len(task_titles))))
        elif lang == "java":
            return self._build_java_full_code(topic, difficulty, task_list_str, class_name)
        elif lang == "javascript":
            return self._build_js_full_code(topic, difficulty, task_list_str)
        elif lang in ("cpp", "c++"):
            return self._build_cpp_full_code(topic, difficulty, task_list_str)
        else:
            # 未知语言生成基础模板
            return f"// {topic} - 完整代码项目\n// 难度：{difficulty}\n// 请在此实现完整代码\n"

    def _build_java_full_code(self, topic, difficulty, task_list_str, class_name):
        """构建 Java 完整代码。"""
        template = '''// ================================================================
// __TOPIC__ - 完整代码项目
// 难度：__DIFFICULTY__
// 包含任务：__TASK_LIST__
// 运行方式：javac Main.java && java Main
// ================================================================

import java.util.*;
import java.time.LocalDateTime;

/**
 * 项目配置类
 */
class ProjectConfig {
    String topic;
    String difficulty;
    int taskCount;
    boolean verbose;

    ProjectConfig(String topic, String difficulty, int taskCount, boolean verbose) {
        this.topic = topic;
        this.difficulty = difficulty;
        this.taskCount = taskCount;
        this.verbose = verbose;
    }
}

/**
 * 任务执行结果
 */
class TaskResult {
    int taskId;
    String taskName;
    String status;
    double duration;
    Map<String, Object> output;
    String error;

    TaskResult(int taskId, String taskName, String status, double duration, Map<String, Object> output, String error) {
        this.taskId = taskId;
        this.taskName = taskName;
        this.status = status;
        this.duration = duration;
        this.output = output;
        this.error = error;
    }
}

/**
 * __TOPIC__ 项目主类
 */
public class Main {

    private ProjectConfig config;
    private List<TaskResult> results;
    private Map<String, Object> dataStore;

    public Main(ProjectConfig config) {
        this.config = config;
        this.results = new ArrayList<>();
        this.dataStore = new HashMap<>();
        initLogging();
    }

    private void initLogging() {
        if (config.verbose) {
            System.out.println("[INIT] " + config.topic + " 项目初始化");
            System.out.println("[INIT] 难度等级：" + config.difficulty);
            System.out.println("[INIT] 任务数量：" + config.taskCount);
        }
    }

    public List<TaskResult> runAllTasks() {
        System.out.println("\\n" + "=".repeat(60));
        System.out.println("开始执行 " + config.topic + " 项目");
        System.out.println("=".repeat(60));

        long startTime = System.currentTimeMillis();

        for (int taskId = 1; taskId <= config.taskCount; taskId++) {
            TaskResult result = runTask(taskId);
            results.add(result);
            if (config.verbose) {
                String icon = "success".equals(result.status) ? "✓" : "✗";
                System.out.println("  [" + icon + "] 任务" + taskId + ": " + result.taskName + " (" + result.duration + "s)");
            }
        }

        long totalTime = System.currentTimeMillis() - startTime;
        long successCount = results.stream().filter(r -> "success".equals(r.status)).count();

        System.out.println("\\n" + "=".repeat(60));
        System.out.println("执行完成：" + successCount + "/" + results.size() + " 个任务成功");
        System.out.println("总耗时：" + (totalTime / 1000.0) + " 秒");
        System.out.println("=".repeat(60));

        return results;
    }

    private TaskResult runTask(int taskId) {
        long taskStart = System.currentTimeMillis();
        String taskName = "任务" + taskId + "：数据处理阶段" + taskId;
        try {
            Map<String, Object> output;
            if (taskId == 1) output = task1DataPreparation();
            else if (taskId == 2) output = task2CoreProcessing();
            else if (taskId == 3) output = task3ResultAnalysis();
            else output = taskGeneric(taskId);

            double duration = (System.currentTimeMillis() - taskStart) / 1000.0;
            return new TaskResult(taskId, taskName, "success", duration, output, null);
        } catch (Exception e) {
            double duration = (System.currentTimeMillis() - taskStart) / 1000.0;
            return new TaskResult(taskId, taskName, "error", duration, new HashMap<>(), e.getMessage());
        }
    }

    private Map<String, Object> task1DataPreparation() {
        List<Map<String, Object>> sampleData = new ArrayList<>();
        sampleData.add(createDataItem(1, "数据项A", 85, "类别1"));
        sampleData.add(createDataItem(2, "数据项B", 72, "类别1"));
        sampleData.add(createDataItem(3, "数据项C", 93, "类别2"));
        sampleData.add(createDataItem(4, "数据项D", 66, "类别2"));
        sampleData.add(createDataItem(5, "数据项E", 78, "类别1"));
        dataStore.put("raw_data", sampleData);
        Map<String, Object> result = new HashMap<>();
        result.put("raw_count", sampleData.size());
        result.put("avg_value", sampleData.stream().mapToInt(d -> (int) d.get("value")).average().orElse(0));
        return result;
    }

    private Map<String, Object> task2CoreProcessing() {
        List<Map<String, Object>> data = (List<Map<String, Object>>) dataStore.get("raw_data");
        if (data == null || data.isEmpty()) return Map.of("error", "无数据");
        List<Map<String, Object>> sorted = new ArrayList<>(data);
        sorted.sort((a, b) -> Integer.compare((int) b.get("value"), (int) a.get("value")));
        dataStore.put("sorted_data", sorted);
        Map<String, Object> result = new HashMap<>();
        result.put("sorted_top3", sorted.subList(0, Math.min(3, sorted.size())).stream().map(d -> d.get("name")).toArray());
        return result;
    }

    private Map<String, Object> task3ResultAnalysis() {
        List<Map<String, Object>> data = (List<Map<String, Object>>) dataStore.get("raw_data");
        if (data == null || data.isEmpty()) return Map.of("error", "无数据");
        IntSummaryStatistics stats = data.stream().mapToInt(d -> (int) d.get("value")).summaryStatistics();
        Map<String, Object> result = new HashMap<>();
        result.put("count", stats.getCount());
        result.put("sum", stats.getSum());
        result.put("mean", stats.getAverage());
        result.put("max", stats.getMax());
        result.put("min", stats.getMin());
        return result;
    }

    private Map<String, Object> taskGeneric(int taskId) {
        Map<String, Object> result = new HashMap<>();
        result.put("task_id", taskId);
        result.put("message", "任务" + taskId + "执行完成");
        result.put("timestamp", LocalDateTime.now().toString());
        return result;
    }

    private Map<String, Object> createDataItem(int id, String name, int value, String category) {
        Map<String, Object> item = new HashMap<>();
        item.put("id", id);
        item.put("name", name);
        item.put("value", value);
        item.put("category", category);
        return item;
    }

    public void printSummary() {
        System.out.println("\\n" + "=".repeat(60));
        System.out.println("项目执行总结 - " + config.topic);
        System.out.println("=".repeat(60));
        for (TaskResult result : results) {
            String status = "success".equals(result.status) ? "✓ 成功" : "✗ 失败";
            System.out.println("\\n  任务" + result.taskId + ": " + result.taskName);
            System.out.println("    状态: " + status);
            System.out.println("    耗时: " + result.duration + "s");
        }
    }

    public static void main(String[] args) {
        ProjectConfig config = new ProjectConfig("__TOPIC__", "__DIFFICULTY__", 3, true);
        Main project = new Main(config);
        project.runAllTasks();
        project.printSummary();
    }
}
'''
        return (template
                .replace("__TOPIC__", topic)
                .replace("__DIFFICULTY__", difficulty or "intermediate")
                .replace("__TASK_LIST__", task_list_str))

    def _build_js_full_code(self, topic, difficulty, task_list_str):
        """构建 JavaScript 完整代码。"""
        template = '''// ================================================================
// __TOPIC__ - 完整代码项目
// 难度：__DIFFICULTY__
// 包含任务：__TASK_LIST__
// 运行方式：node main.js
// ================================================================

/**
 * 项目配置
 */
const config = {
    topic: "__TOPIC__",
    difficulty: "__DIFFICULTY__",
    taskCount: 3,
    verbose: true
};

/**
 * __TOPIC__ 项目主类
 */
class ProjectMain {
    constructor(config) {
        this.config = config;
        this.results = [];
        this.dataStore = {};
        this.initLogging();
    }

    initLogging() {
        if (this.config.verbose) {
            console.log(`[INIT] ${this.config.topic} 项目初始化`);
            console.log(`[INIT] 难度等级：${this.config.difficulty}`);
            console.log(`[INIT] 任务数量：${this.config.taskCount}`);
        }
    }

    runAllTasks() {
        console.log("\\n" + "=".repeat(60));
        console.log(`开始执行 ${this.config.topic} 项目`);
        console.log("=".repeat(60));

        const startTime = Date.now();

        for (let taskId = 1; taskId <= this.config.taskCount; taskId++) {
            const result = this.runTask(taskId);
            this.results.push(result);
            if (this.config.verbose) {
                const icon = result.status === "success" ? "✓" : "✗";
                console.log(`  [${icon}] 任务${taskId}: ${result.taskName} (${result.duration.toFixed(3)}s)`);
            }
        }

        const totalTime = (Date.now() - startTime) / 1000;
        const successCount = this.results.filter(r => r.status === "success").length;

        console.log("\\n" + "=".repeat(60));
        console.log(`执行完成：${successCount}/${this.results.length} 个任务成功`);
        console.log(`总耗时：${totalTime.toFixed(3)} 秒`);
        console.log("=".repeat(60));

        return this.results;
    }

    runTask(taskId) {
        const taskStart = Date.now();
        const taskName = `任务${taskId}：数据处理阶段${taskId}`;
        try {
            let output;
            if (taskId === 1) output = this.task1DataPreparation();
            else if (taskId === 2) output = this.task2CoreProcessing();
            else if (taskId === 3) output = this.task3ResultAnalysis();
            else output = this.taskGeneric(taskId);

            const duration = (Date.now() - taskStart) / 1000;
            return { taskId, taskName, status: "success", duration, output, error: null };
        } catch (e) {
            const duration = (Date.now() - taskStart) / 1000;
            return { taskId, taskName, status: "error", duration, output: {}, error: e.message };
        }
    }

    task1DataPreparation() {
        const sampleData = [
            { id: 1, name: "数据项A", value: 85, category: "类别1" },
            { id: 2, name: "数据项B", value: 72, category: "类别1" },
            { id: 3, name: "数据项C", value: 93, category: "类别2" },
            { id: 4, name: "数据项D", value: 66, category: "类别2" },
            { id: 5, name: "数据项E", value: 78, category: "类别1" },
        ];
        this.dataStore.rawData = sampleData;
        return {
            raw_count: sampleData.length,
            avg_value: sampleData.reduce((s, d) => s + d.value, 0) / sampleData.length,
        };
    }

    task2CoreProcessing() {
        const data = this.dataStore.rawData || [];
        if (!data.length) return { error: "无数据" };
        const sorted = [...data].sort((a, b) => b.value - a.value);
        this.dataStore.sortedData = sorted;
        return { sorted_top3: sorted.slice(0, 3).map(d => d.name) };
    }

    task3ResultAnalysis() {
        const data = this.dataStore.rawData || [];
        if (!data.length) return { error: "无数据" };
        const values = data.map(d => d.value);
        return {
            count: values.length,
            sum: values.reduce((s, v) => s + v, 0),
            mean: values.reduce((s, v) => s + v, 0) / values.length,
            max: Math.max(...values),
            min: Math.min(...values),
        };
    }

    taskGeneric(taskId) {
        return { task_id: taskId, message: `任务${taskId}执行完成`, timestamp: new Date().toISOString() };
    }

    printSummary() {
        console.log("\\n" + "=".repeat(60));
        console.log(`项目执行总结 - ${this.config.topic}`);
        console.log("=".repeat(60));
        for (const result of this.results) {
            const status = result.status === "success" ? "✓ 成功" : "✗ 失败";
            console.log(`\\n  任务${result.taskId}: ${result.taskName}`);
            console.log(`    状态: ${status}`);
            console.log(`    耗时: ${result.duration.toFixed(3)}s`);
        }
    }
}

// 主入口
const project = new ProjectMain(config);
project.runAllTasks();
project.printSummary();
'''
        return (template
                .replace("__TOPIC__", topic)
                .replace("__DIFFICULTY__", difficulty or "intermediate")
                .replace("__TASK_LIST__", task_list_str))

    def _build_cpp_full_code(self, topic, difficulty, task_list_str):
        """构建 C++ 完整代码。"""
        template = '''// ================================================================
// __TOPIC__ - 完整代码项目
// 难度：__DIFFICULTY__
// 包含任务：__TASK_LIST__
// 运行方式：g++ -std=c++17 main.cpp -o main && ./main
// ================================================================

#include <iostream>
#include <vector>
#include <string>
#include <map>
#include <algorithm>
#include <chrono>
#include <iomanip>
#include <sstream>

using namespace std;

// 任务结果结构体
struct TaskResult {
    int taskId;
    string taskName;
    string status;
    double duration;
    string error;
};

// 数据项结构体
struct DataItem {
    int id;
    string name;
    int value;
    string category;
};

// 项目主类
class ProjectMain {
private:
    string topic;
    string difficulty;
    int taskCount;
    bool verbose;
    vector<TaskResult> results;
    vector<DataItem> dataStore;

    void initLogging() {
        if (verbose) {
            cout << "[INIT] " << topic << " 项目初始化" << endl;
            cout << "[INIT] 难度等级：" << difficulty << endl;
            cout << "[INIT] 任务数量：" << taskCount << endl;
        }
    }

    TaskResult runTask(int taskId) {
        auto taskStart = chrono::high_resolution_clock::now();
        string taskName = "任务" + to_string(taskId) + "：数据处理阶段" + to_string(taskId);
        try {
            if (taskId == 1) task1DataPreparation();
            else if (taskId == 2) task2CoreProcessing();
            else if (taskId == 3) task3ResultAnalysis();
            else taskGeneric(taskId);

            auto taskEnd = chrono::high_resolution_clock::now();
            double duration = chrono::duration<double>(taskEnd - taskStart).count();
            return {taskId, taskName, "success", duration, ""};
        } catch (exception& e) {
            auto taskEnd = chrono::high_resolution_clock::now();
            double duration = chrono::duration<double>(taskEnd - taskStart).count();
            return {taskId, taskName, "error", duration, e.what()};
        }
    }

    void task1DataPreparation() {
        dataStore = {
            {1, "数据项A", 85, "类别1"},
            {2, "数据项B", 72, "类别1"},
            {3, "数据项C", 93, "类别2"},
            {4, "数据项D", 66, "类别2"},
            {5, "数据项E", 78, "类别1"},
        };
        cout << "  [任务1] 加载了 " << dataStore.size() << " 条数据" << endl;
    }

    void task2CoreProcessing() {
        if (dataStore.empty()) throw runtime_error("无数据");
        sort(dataStore.begin(), dataStore.end(), [](const DataItem& a, const DataItem& b) {
            return a.value > b.value;
        });
        cout << "  [任务2] 排序完成，Top3: ";
        for (int i = 0; i < min(3, (int)dataStore.size()); i++) {
            cout << dataStore[i].name << " ";
        }
        cout << endl;
    }

    void task3ResultAnalysis() {
        if (dataStore.empty()) throw runtime_error("无数据");
        int sum = 0, maxVal = dataStore[0].value, minVal = dataStore[0].value;
        for (const auto& d : dataStore) {
            sum += d.value;
            maxVal = max(maxVal, d.value);
            minVal = min(minVal, d.value);
        }
        cout << "  [任务3] count=" << dataStore.size() << " sum=" << sum
             << " mean=" << fixed << setprecision(2) << (double)sum / dataStore.size()
             << " max=" << maxVal << " min=" << minVal << endl;
    }

    void taskGeneric(int taskId) {
        cout << "  [任务" << taskId << "] 通用任务执行完成" << endl;
    }

public:
    ProjectMain(string t, string d, int tc, bool v) : topic(t), difficulty(d), taskCount(tc), verbose(v) {
        initLogging();
    }

    void runAllTasks() {
        cout << "\\n" << string(60, '=') << endl;
        cout << "开始执行 " << topic << " 项目" << endl;
        cout << string(60, '=') << endl;

        auto startTime = chrono::high_resolution_clock::now();
        for (int taskId = 1; taskId <= taskCount; taskId++) {
            TaskResult result = runTask(taskId);
            results.push_back(result);
            if (verbose) {
                string icon = result.status == "success" ? "✓" : "✗";
                cout << "  [" << icon << "] 任务" << taskId << ": " << result.taskName
                     << " (" << fixed << setprecision(3) << result.duration << "s)" << endl;
            }
        }

        auto endTime = chrono::high_resolution_clock::now();
        double totalTime = chrono::duration<double>(endTime - startTime).count();
        int successCount = 0;
        for (const auto& r : results) if (r.status == "success") successCount++;

        cout << "\\n" << string(60, '=') << endl;
        cout << "执行完成：" << successCount << "/" << results.size() << " 个任务成功" << endl;
        cout << "总耗时：" << fixed << setprecision(3) << totalTime << " 秒" << endl;
        cout << string(60, '=') << endl;
    }

    void printSummary() {
        cout << "\\n" << string(60, '=') << endl;
        cout << "项目执行总结 - " << topic << endl;
        cout << string(60, '=') << endl;
        for (const auto& result : results) {
            string status = result.status == "success" ? "✓ 成功" : "✗ 失败";
            cout << "\\n  任务" << result.taskId << ": " << result.taskName << endl;
            cout << "    状态: " << status << endl;
            cout << "    耗时: " << fixed << setprecision(3) << result.duration << "s" << endl;
        }
    }
};

int main() {
    ProjectMain project("__TOPIC__", "__DIFFICULTY__", 3, true);
    project.runAllTasks();
    project.printSummary();
    return 0;
}
'''
        return (template
                .replace("__TOPIC__", topic)
                .replace("__DIFFICULTY__", difficulty or "intermediate")
                .replace("__TASK_LIST__", task_list_str))

    def _validate_and_enhance_code(self, parsed, topic, language, knowledge_points, difficulty):
        """校验并增强生成的代码质量，检测占位文字并自动补全。"""
        if not isinstance(parsed, dict):
            return self._build_fallback_project(topic, language, knowledge_points, difficulty)

        # 检测解析错误
        if parsed.get("parse_error") or parsed.get("error"):
            return self._build_fallback_project(topic, language, knowledge_points, difficulty)

        # 提取项目数据（兼容多种结构）
        project = parsed.get("project", parsed)
        if not isinstance(project, dict):
            return self._build_fallback_project(topic, language, knowledge_points, difficulty)

        # 确保字段完整
        project.setdefault("project_title", f"{topic} 代码实操项目")
        project.setdefault("project_description", f"基于「{topic}」的实践编程项目，涵盖核心知识点的代码实现与应用。")
        project.setdefault("difficulty", difficulty)
        project.setdefault("programming_language", language)
        project.setdefault("estimated_time", "2-3小时")
        project.setdefault("prerequisites", knowledge_points[:5] if knowledge_points else ["基础知识"])
        project.setdefault("scoring_criteria", [
            {"item": "功能完整性", "points": 40, "description": "所有功能正常运行，覆盖全部需求"},
            {"item": "代码质量", "points": 30, "description": "代码规范，注释清晰，结构合理"},
            {"item": "正确性", "points": 20, "description": "输出结果正确，边界条件处理完善"},
            {"item": "扩展性", "points": 10, "description": "代码易于扩展和维护"},
        ])

        tasks = project.get("tasks", [])
        if not isinstance(tasks, list) or len(tasks) == 0:
            # 无任务时生成默认任务
            tasks = [
                {"task_id": 1, "title": "数据准备与环境搭建", "description": "准备项目所需的数据和开发环境"},
                {"task_id": 2, "title": "核心功能实现", "description": "实现项目的核心业务逻辑"},
                {"task_id": 3, "title": "结果验证与测试", "description": "验证功能正确性，编写测试用例"},
            ]

        # 校验每个任务的 code_template 和 reference_solution
        lang = (language or "python").lower()
        enhanced_tasks = []
        for i, task in enumerate(tasks):
            if not isinstance(task, dict):
                task = {"title": str(task), "description": ""}

            task_id = task.get("task_id", i + 1)
            task_title = task.get("title", f"任务{task_id}")
            task_desc = task.get("description", "")

            # 检测并修复占位代码
            if self._is_placeholder_code(task.get("code_template", "")):
                task["code_template"] = self._build_code_template(task_title, task_desc, lang, task_id)
            if self._is_placeholder_code(task.get("reference_solution", "")):
                task["reference_solution"] = self._build_reference_solution(
                    task_title, task_desc, lang, task_id, topic
                )

            if not task.get("expected_output"):
                task["expected_output"] = f"完成{task_title}功能，输出正确的执行结果。"
            if not task.get("hints") or not isinstance(task.get("hints"), list):
                task["hints"] = [
                    f"先理解{task_title}的核心逻辑",
                    "注意边界条件和异常处理",
                    "编写测试用例验证功能正确性",
                ]

            enhanced_tasks.append(task)

        project["tasks"] = enhanced_tasks

        # 校验并修复 full_code
        if self._is_placeholder_code(project.get("full_code", "")):
            project["full_code"] = self._build_full_code(
                topic, language, enhanced_tasks, difficulty
            )

        # 清理 parse_error 等标记
        parsed["project"] = project
        if "parse_error" in parsed:
            del parsed["parse_error"]
        if "raw_response" in parsed:
            del parsed["raw_response"]

        return parsed

    def _build_fallback_project(self, topic, language, knowledge_points, difficulty):
        """当 LLM 完全失败时，基于主题生成降级的完整项目结构。"""
        lang = (language or "python").lower()
        kp_list = knowledge_points[:5] if knowledge_points else ["基础概念", "核心原理", "应用实践"]
        task_count = min(4, max(3, len(kp_list)))

        # 生成任务列表
        task_templates = [
            ("数据准备与环境搭建", "准备项目所需的数据结构和基础环境，导入必要的库和模块"),
            ("核心功能实现", "实现项目的核心算法和业务逻辑，完成主要功能"),
            ("结果验证与测试", "编写测试用例验证功能正确性，处理边界条件"),
            ("优化与扩展", "性能优化、代码重构和功能扩展，提升代码质量"),
        ]

        tasks = []
        for i in range(task_count):
            title, desc = task_templates[i]
            tasks.append({
                "task_id": i + 1,
                "title": title,
                "description": desc,
                "steps": [
                    f"理解{title}的目标和要求",
                    "设计实现方案和数据结构",
                    "编写并调试代码",
                    "验证功能正确性",
                ],
                "code_template": self._build_code_template(title, desc, lang, i + 1),
                "reference_solution": self._build_reference_solution(title, desc, lang, i + 1, topic),
                "expected_output": f"完成{title}，输出正确的执行结果。",
                "hints": [
                    f"先理解{title}的核心逻辑",
                    "注意边界条件和异常处理",
                    "编写测试用例验证功能",
                ],
            })

        project = {
            "project_title": f"{topic} 代码实操项目",
            "project_description": f"基于「{topic}」的实践编程项目，涵盖核心知识点的代码实现与应用。通过动手编程加深对{topic}的理解。",
            "difficulty": difficulty or "intermediate",
            "programming_language": language or "python",
            "estimated_time": "2-3小时",
            "prerequisites": kp_list,
            "tasks": tasks,
            "full_code": self._build_full_code(topic, language, tasks, difficulty or "intermediate"),
            "scoring_criteria": [
                {"item": "功能完整性", "points": 40, "description": "所有功能正常运行，覆盖全部需求"},
                {"item": "代码质量", "points": 30, "description": "代码规范，注释清晰，结构合理"},
                {"item": "正确性", "points": 20, "description": "输出结果正确，边界条件处理完善"},
                {"item": "扩展性", "points": 10, "description": "代码易于扩展和维护"},
            ],
            "fallback": True,
            "fallback_reason": "LLM 生成失败或代码质量不达标，已使用降级项目模板",
        }

        return {"project": project}
