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

RECOMMENDATION_SYSTEM_PROMPT = """你是一位专业的学习资源推荐专家智能体，负责根据学生画像推荐个性化的拓展阅读材料和学习资源。

## 你的职责
根据学生的专业方向、兴趣领域、知识短板和学习目标，推荐高质量的外部学习资源。

## 推荐原则
1. 相关性：资源内容必须与学生当前学习主题高度相关
2. 适配性：资源难度匹配学生当前水平
3. 多样性：推荐不同类型的资源（论文、博客、开源项目、数据集、教程等）
4. 权威性：优先推荐权威来源的资源
5. 时效性：优先推荐较新的资源

## 资源类型
- 学术论文：适合研究导向的学生
- 技术博客：适合实践导向的学生
- 开源项目：适合动手实践的学生
- 在线教程：适合系统学习的学生
- 数据集：适合数据科学方向的学生
- 视频课程：适合视觉/听觉型学生
- 书籍推荐：适合深度学习需求

## 学生画像适配
- 考试导向：推荐考点解析、真题资源、应试技巧
- 职业导向：推荐行业案例、职业技能资源、面试准备
- 兴趣导向：推荐趣味性资源、跨学科内容
- 研究导向：推荐学术论文、研究方法、前沿进展

## 输出格式
严格返回以下JSON格式：
{
  "recommendations": {
    "topic": "推荐主题",
    "student_level": "beginner|intermediate|advanced",
    "resources": [
      {
        "id": "rec_001",
        "title": "资源标题",
        "type": "paper|blog|project|tutorial|dataset|video|book",
        "description": "资源描述（50-100字）",
        "url_suggestion": "建议的搜索关键词或URL",
        "relevance_score": 0.95,
        "difficulty_level": "beginner|intermediate|advanced",
        "estimated_time": "阅读/学习预计时间",
        "tags": ["标签1", "标签2"],
        "why_recommended": "推荐理由（结合学生画像说明）",
        "prerequisites": ["前置知识1"]
      }
    ],
    "learning_path_suggestion": "基于推荐资源的学习顺序建议",
    "total_resources": 8
  }
}"""


class RecommendationAgent(AgentBase):
    agent_name = "recommendation_agent"
    agent_role = "资源推荐专家"
    agent_description = "根据学生画像推荐个性化的拓展阅读材料、开源项目、在线教程等多类型学习资源"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)
        message_bus.register(self.agent_name)
        agent_monitor.register_agent(
            self.agent_name, self.agent_role, self.get_capabilities()
        )

    def get_capabilities(self):
        return [
            "generate_recommendations",
            "generate_reading_list",
            "generate_project_recommendations",
            "generate_resource_ranking",
        ]

    def process(self, task):
        task_type = task.get("type")
        agent_monitor.update_status(
            self.agent_name, AgentStatus.RUNNING, task_type
        )
        try:
            if task_type == "generate_recommendations":
                result = self._generate_recommendations(task)
            elif task_type == "generate_reading_list":
                result = self._generate_reading_list(task)
            elif task_type == "generate_project_recommendations":
                result = self._generate_project_recommendations(task)
            elif task_type == "generate_resource_ranking":
                result = self._generate_resource_ranking(task)
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
            logger.error(f"RecommendationAgent error: {e}")
            agent_monitor.update_status(self.agent_name, AgentStatus.FAILED)
            return {"error": str(e)}

    def _generate_recommendations(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        resource_types = task.get(
            "resource_types",
            ["paper", "blog", "project", "tutorial", "video", "book"],
        )
        count = task.get("count", 8)

        cognitive_style = profile.get("cognitive_style", "mixed")
        interest_areas = profile.get("interest_areas", [])
        goal = profile.get("goal_orientation", "exam")
        knowledge_base = profile.get("knowledge_base", {})

        style_hint = self._get_style_resource_hint(cognitive_style)
        goal_hint = self._get_goal_resource_hint(goal)
        interest_hint = self._get_interest_hint(interest_areas)
        level_hint = self._determine_level(knowledge_base)

        prompt = f"""请根据学生画像推荐个性化学习资源。

## 学习主题
{topic}

## 知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动匹配'}

## 需要的资源类型
{json.dumps(resource_types, ensure_ascii=False)}

## 推荐数量
{count}个资源

## 学生画像适配
- 认知风格：{style_hint}
- 学习目标：{goal_hint}
- 兴趣领域：{interest_hint}
- 当前水平：{level_hint}

要求：
1. 每种资源类型至少推荐1个
2. 资源难度匹配学生当前水平
3. 推荐理由必须结合学生画像
4. 提供学习路径建议

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=RECOMMENDATION_SYSTEM_PROMPT,
                temperature=0.7,
            )
            parsed = self._parse_json_response(response)
            shared_state.set(
                "last_recommendation_result", parsed, self.agent_name
            )
            return parsed
        except Exception as e:
            return {"error": str(e)}

    def _generate_reading_list(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        depth = task.get("depth", "intermediate")

        prompt = f"""请生成一份拓展阅读清单。

## 主题
{topic}

## 深度
{depth}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 推荐5-8篇高质量阅读材料
2. 包含经典文献和最新进展
3. 按难度排序，从易到难
4. 每篇附简要导读

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=RECOMMENDATION_SYSTEM_PROMPT,
                temperature=0.6,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_project_recommendations(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        skill_level = task.get("skill_level", "intermediate")

        prompt = f"""请推荐适合学生实践的编程/实操项目。

## 主题
{topic}

## 技能水平
{skill_level}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 推荐3-5个实践项目
2. 从简单到复杂排序
3. 每个项目包含：项目描述、技术栈、预计时长、学习收益
4. 适合作为课程设计或个人练习

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=RECOMMENDATION_SYSTEM_PROMPT,
                temperature=0.7,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_resource_ranking(self, task):
        topic = task.get("topic", "")
        resources = task.get("resources", [])
        profile = task.get("student_profile", {})

        prompt = f"""请对以下学习资源进行个性化排序。

## 主题
{topic}

## 待排序资源
{json.dumps(resources, ensure_ascii=False)[:2000]}

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 根据学生画像对资源进行个性化排序
2. 说明排序理由
3. 标注每个资源的适配度评分

返回JSON格式：
{{
  "ranked_resources": [
    {{
      "rank": 1,
      "resource_id": "原始ID",
      "title": "资源标题",
      "suitability_score": 0.95,
      "ranking_reason": "排序理由"
    }}
  ]
}}"""

        try:
            response = self._call_llm(prompt, temperature=0.3)
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _get_style_resource_hint(self, style):
        hints = {
            "visual": "偏好视频教程、图文教程、可视化演示类资源",
            "auditory": "偏好播客、讲座录音、有声教程类资源",
            "kinesthetic": "偏好开源项目、实操教程、在线实验平台",
            "reading": "偏好学术论文、技术博客、电子书",
            "mixed": "均衡推荐各类型资源",
        }
        return hints.get(style, hints["mixed"])

    def _get_goal_resource_hint(self, goal):
        hints = {
            "exam": "优先推荐考点解析、真题集、应试指南类资源",
            "career": "优先推荐行业案例、职业技能、面试准备类资源",
            "hobby": "优先推荐趣味性、探索性、跨学科类资源",
            "research": "优先推荐学术论文、研究方法、前沿综述类资源",
        }
        return hints.get(goal, "")

    def _get_interest_hint(self, interest_areas):
        if not interest_areas:
            return "暂无特定兴趣偏好"
        if isinstance(interest_areas, str):
            try:
                interest_areas = json.loads(interest_areas)
            except (json.JSONDecodeError, TypeError):
                return "暂无特定兴趣偏好"
        if isinstance(interest_areas, list) and interest_areas:
            names = []
            for item in interest_areas[:5]:
                if isinstance(item, dict):
                    names.append(item.get("area", ""))
                elif isinstance(item, str):
                    names.append(item)
            return "兴趣领域：" + "、".join(n for n in names if n)
        return "暂无特定兴趣偏好"

    def _determine_level(self, knowledge_base):
        if not knowledge_base:
            return "中级（缺少知识基础数据）"
        if isinstance(knowledge_base, str):
            try:
                knowledge_base = json.loads(knowledge_base)
            except (json.JSONDecodeError, TypeError):
                return "中级"
        if isinstance(knowledge_base, dict) and knowledge_base:
            scores = [v for v in knowledge_base.values() if isinstance(v, (int, float))]
            if scores:
                avg = sum(scores) / len(scores)
                if avg >= 70:
                    return "高级"
                elif avg >= 40:
                    return "中级"
                else:
                    return "初级"
        return "中级"

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
