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

## 视频资源搜索
当需要推荐视频学习资源时，你应该为学生生成实际的搜索URL，方便学生直接访问：
- YouTube搜索：https://www.youtube.com/results?search_query=（关键词用+连接）
- Bilibili搜索：https://search.bilibili.com/all?keyword=（使用中文关键词）
搜索关键词的构建原则：
1. YouTube搜索使用英文关键词，应包含主题核心术语，必要时加上"tutorial"、"explained"、"lecture"等后缀
2. Bilibili搜索使用中文关键词，应包含主题中文名称，必要时加上"教程"、"讲解"、"入门"等后缀
3. 搜索关键词应精准、简洁，避免过于宽泛或过于具体
4. 根据学生水平调整搜索难度关键词（如入门用"beginner"/"入门"，进阶用"advanced"/"进阶"）

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
            "generate_video_search",
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
            elif task_type == "generate_video_search":
                result = self._generate_video_search(task)
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
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        cognitive_style = profile.get("cognitive_style", "mixed")
        interest_areas = profile.get("interest_areas", [])
        goal = profile.get("goal_orientation", "exam")
        knowledge_base = profile.get("knowledge_base", {})

        style_hint = self._get_style_resource_hint(cognitive_style)
        goal_hint = self._get_goal_resource_hint(goal)
        interest_hint = self._get_interest_hint(interest_areas)
        level_hint = self._determine_level(knowledge_base)
        kb_context = self._build_kb_context(course_id, chapter_ids)

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
{kb_context}

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
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)

            # 检测解析失败，使用降级推荐确保前端可用
            if parsed.get("parse_error"):
                logger.warning(
                    f"RecommendationAgent JSON 解析失败，使用降级推荐。raw_response 长度: {len(parsed.get('raw_response', ''))}"
                )
                fallback = self._build_fallback_recommendations(task, "JSON 解析失败")
                shared_state.set(
                    "last_recommendation_result", fallback, self.agent_name
                )
                return fallback

            shared_state.set(
                "last_recommendation_result", parsed, self.agent_name
            )
            return parsed
        except Exception as e:
            logger.error(f"RecommendationAgent LLM 调用失败: {e}", exc_info=True)
            fallback = self._build_fallback_recommendations(task, str(e))
            shared_state.set(
                "last_recommendation_result", fallback, self.agent_name
            )
            return fallback

    def _generate_reading_list(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        depth = task.get("depth", "intermediate")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

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
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_project_recommendations(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        skill_level = task.get("skill_level", "intermediate")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

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
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_resource_ranking(self, task):
        topic = task.get("topic", "")
        resources = task.get("resources", [])
        profile = task.get("student_profile", {})
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

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
            response = self._call_llm(prompt, temperature=0.3, user_id=_user_id, user_role=_user_role)
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _build_video_search_prompt(self, topic, knowledge_points, profile):
        cognitive_style = profile.get("cognitive_style", "mixed")
        interest_areas = profile.get("interest_areas", [])
        goal = profile.get("goal_orientation", "exam")
        knowledge_base = profile.get("knowledge_base", {})

        style_hint = self._get_style_resource_hint(cognitive_style)
        goal_hint = self._get_goal_resource_hint(goal)
        interest_hint = self._get_interest_hint(interest_areas)
        level_hint = self._determine_level(knowledge_base)

        prompt = f"""请根据学生的学习主题和薄弱知识点，生成视频搜索推荐。

## 学习主题
{topic}

## 薄弱知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动匹配'}

## 学生画像适配
- 认知风格：{style_hint}
- 学习目标：{goal_hint}
- 兴趣领域：{interest_hint}
- 当前水平：{level_hint}

要求：
1. 为每个薄弱知识点或子主题生成对应的视频搜索推荐
2. YouTube搜索使用英文关键词，Bilibili搜索使用中文关键词
3. 生成可直接访问的搜索URL（YouTube关键词用+连接，Bilibili使用中文关键词）
4. 搜索关键词应精准、简洁，根据学生水平调整难度关键词
5. 每个搜索推荐需说明推荐理由
6. 推荐数量为3-6个视频搜索

请严格按照以下JSON格式输出：
{{
  "video_searches": [
    {{
      "topic": "搜索主题",
      "youtube_query": "英文搜索关键词",
      "bilibili_query": "中文搜索关键词",
      "youtube_url": "https://www.youtube.com/results?search_query=...",
      "bilibili_url": "https://search.bilibili.com/all?keyword=...",
      "description": "为什么推荐搜索这个主题的视频",
      "difficulty": "beginner|intermediate|advanced",
      "estimated_minutes": 30,
      "tags": ["标签1", "标签2"]
    }}
  ]
}}"""

        return prompt

    def _generate_video_search(self, task):
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        profile = task.get("student_profile", {})
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = self._build_video_search_prompt(topic, knowledge_points, profile)

        try:
            response = self._call_llm(
                prompt,
                system_prompt=RECOMMENDATION_SYSTEM_PROMPT,
                temperature=0.5,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)
            shared_state.set(
                "last_video_search_result", parsed, self.agent_name
            )
            return parsed
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
                parts.append(f"### 知识点详情（推荐资源应覆盖这些知识点）\n{ctx['knowledge_points_detail']}")
            if ctx.get("teaching_cases_detail") and ctx["teaching_cases_detail"] != "暂无":
                parts.append(f"### 教学案例（推荐相关实践资源）\n{ctx['teaching_cases_detail']}")
            return "\n\n".join(parts)
        except Exception as e:
            logger.warning(f"Failed to build KB context for recommendation agent: {e}")
            return ""

    def _parse_json_response(self, response):
        """多层降级 JSON 解析，与 document_agent 保持一致的健壮性。

        解析层级：
        1. 去除代码块包装后直接解析
        2. 提取首个 {...} 子串解析
        3. 对 {...} 子串进行括号修复后解析
        4. 提取首个 [...] 子串解析
        5. 对 [...] 子串进行括号修复后解析
        6. 对全文进行括号修复后解析
        7. 全部失败则返回 raw_response + parse_error 标记
        """
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

        # 提取 {...} 子串
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

        # 提取 [...] 子串（资源列表可能直接以数组形式返回）
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            candidate = text[start:end]
            try:
                parsed_arr = json.loads(candidate)
                if isinstance(parsed_arr, list):
                    return {"recommendations": {"resources": parsed_arr, "topic": "", "total_resources": len(parsed_arr)}}
            except json.JSONDecodeError:
                repaired = self._repair_mismatched_brackets(candidate)
                if repaired:
                    try:
                        parsed_arr = json.loads(repaired)
                        if isinstance(parsed_arr, list):
                            return {"recommendations": {"resources": parsed_arr, "topic": "", "total_resources": len(parsed_arr)}}
                    except (json.JSONDecodeError, ValueError):
                        pass

        # 全文括号修复
        repaired_full = self._repair_mismatched_brackets(text)
        if repaired_full:
            try:
                return json.loads(repaired_full)
            except (json.JSONDecodeError, ValueError):
                pass

        return {"raw_response": text, "parse_error": True}

    @staticmethod
    def _repair_mismatched_brackets(text):
        """修复 JSON 文本中不匹配的括号，与 document_agent 实现一致。"""
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

        # 尝试提取首个完整 JSON 对象
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

    def _build_fallback_recommendations(self, task, error_msg=""):
        """当 LLM 调用或解析失败时，基于主题和知识点生成降级推荐列表。

        确保即使 AI 生成失败，前端也能展示可用的拓展资源结构，
        而非空白或错误状态。
        """
        topic = task.get("topic", "学习主题")
        knowledge_points = task.get("knowledge_points", [])
        profile = task.get("student_profile", {})
        goal = profile.get("goal_orientation", "exam")
        count = task.get("count", 6)

        # 根据学习目标定制推荐类型
        if goal == "exam":
            type_hint = "考点解析"
            default_types = ["paper", "tutorial", "book"]
        elif goal == "career":
            type_hint = "职业技能"
            default_types = ["blog", "project", "tutorial"]
        elif goal == "research":
            type_hint = "学术研究"
            default_types = ["paper", "book", "dataset"]
        else:
            type_hint = "综合学习"
            default_types = ["tutorial", "blog", "video"]

        # 基于知识点构建基础推荐
        resources = []
        kp_list = knowledge_points[:count] if knowledge_points else [topic]

        type_labels = {
            "paper": "学术论文", "blog": "技术博客", "project": "开源项目",
            "tutorial": "在线教程", "dataset": "数据集", "video": "视频课程",
            "book": "书籍推荐",
        }

        for idx, kp in enumerate(kp_list):
            rtype = default_types[idx % len(default_types)]
            resources.append({
                "id": f"rec_fallback_{idx + 1:03d}",
                "title": f"{kp} - {type_labels.get(rtype, '学习资源')}",
                "type": rtype,
                "description": f"针对「{kp}」的{type_hint}拓展资源，建议根据关键词检索最新材料。",
                "url_suggestion": f"https://www.google.com/search?q={kp}+{type_labels.get(rtype, '')}",
                "relevance_score": 0.7,
                "difficulty_level": "intermediate",
                "estimated_time": "1-2小时",
                "tags": [kp, type_hint],
                "why_recommended": f"作为{type_hint}方向的基础资源，覆盖知识点「{kp}」。",
                "prerequisites": [],
            })

        return {
            "recommendations": {
                "topic": topic,
                "student_level": "intermediate",
                "resources": resources,
                "learning_path_suggestion": f"建议按以下顺序学习：{' → '.join(kp_list[:3])}",
                "total_resources": len(resources),
                "fallback": True,
                "fallback_reason": error_msg or "LLM 生成失败，已使用降级推荐",
            }
        }
