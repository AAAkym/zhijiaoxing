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

MEDIA_SYSTEM_PROMPT = """你是一位专业的多媒体教学内容设计专家智能体，负责生成教学视频脚本、动画描述和多媒体教学材料。

## 你的职责
根据学生画像和知识点，设计多模态教学内容的脚本和描述，包括视频脚本、动画分镜、图文排版等。

## 生成原则
1. 视频脚本：包含画面描述、旁白文案、字幕文本、时间节点
2. 动画描述：包含场景描述、角色动作、转场效果、关键帧说明
3. 图文材料：包含信息图描述、图解说明、交互式内容设计
4. 时长控制：微课3-5分钟，专题讲解8-15分钟
5. 节奏设计：引入(15%)→讲解(50%)→演示(20%)→总结(15%)

## 学生画像适配
- 视觉型：增加图表动画、流程可视化、色彩标注
- 听觉型：增加旁白讲解、对话式教学、音效提示
- 动觉型：增加交互式演示、实操步骤展示、模拟操作
- 快节奏学习者：紧凑编排，信息密度高
- 慢节奏学习者：分段讲解，留出思考时间

## 输出格式
严格返回以下JSON格式：
{
  "media": {
    "type": "video_script|animation|infographic|interactive",
    "title": "多媒体内容标题",
    "topic": "主题",
    "estimated_duration_minutes": 5,
    "target_style": "visual|auditory|kinesthetic|mixed",
    "script": {
      "scenes": [
        {
          "scene_id": 1,
          "duration_seconds": 30,
          "visual_description": "画面描述",
          "narration": "旁白文案",
          "subtitle": "字幕文本",
          "animation_notes": "动画效果说明",
          "transition": "转场效果",
          "key_frame_description": "关键帧描述"
        }
      ],
      "total_duration_seconds": 300,
      "background_music_suggestion": "背景音乐建议",
      "visual_style": "视觉风格描述"
    },
    "supplementary_materials": [
      {
        "type": "infographic|diagram|interactive_demo",
        "title": "辅助材料标题",
        "description": "材料描述",
        "content_spec": "内容规格说明"
      }
    ]
  }
}"""


class MediaAgent(AgentBase):
    agent_name = "media_agent"
    agent_role = "多媒体教学专家"
    agent_description = "根据学生画像生成教学视频脚本、动画描述和多模态教学材料设计方案"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)
        message_bus.register(self.agent_name)
        agent_monitor.register_agent(
            self.agent_name, self.agent_role, self.get_capabilities()
        )

    def get_capabilities(self):
        return [
            "generate_video_script",
            "generate_animation_script",
            "generate_infographic_spec",
            "generate_interactive_demo_spec",
        ]

    def process(self, task):
        task_type = task.get("type")
        agent_monitor.update_status(
            self.agent_name, AgentStatus.RUNNING, task_type
        )
        try:
            if task_type == "generate_video_script":
                result = self._generate_video_script(task)
            elif task_type == "generate_animation_script":
                result = self._generate_animation_script(task)
            elif task_type == "generate_infographic_spec":
                result = self._generate_infographic_spec(task)
            elif task_type == "generate_interactive_demo_spec":
                result = self._generate_interactive_demo_spec(task)
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
            logger.error(f"MediaAgent error: {e}")
            agent_monitor.update_status(self.agent_name, AgentStatus.FAILED)
            return {"error": str(e)}

    def _generate_video_script(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        knowledge_points = task.get("knowledge_points", [])
        duration = task.get("duration_minutes", 5)
        video_type = task.get("video_type", "micro_lecture")
        course_id = task.get("course_id")
        chapter_ids = task.get("chapter_ids")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        cognitive_style = profile.get("cognitive_style", "mixed")
        learning_pace = profile.get("learning_pace", "moderate")

        style_hint = self._get_video_style_hint(cognitive_style)
        pace_hint = self._get_pace_hint(learning_pace)
        type_instruction = self._get_video_type_instruction(video_type)
        kb_context = self._build_kb_context(course_id, chapter_ids)

        prompt = f"""请生成一份教学视频脚本。

## 主题
{topic}

## 知识点
{json.dumps(knowledge_points, ensure_ascii=False) if knowledge_points else '根据主题自动规划'}

## 视频类型
{type_instruction}

## 时长
{duration}分钟

## 学生画像适配
{style_hint}
{pace_hint}
{kb_context}

要求：
1. 按场景分镜设计，每个场景包含画面描述、旁白、字幕
2. 控制总时长在{duration}分钟左右
3. 包含引入、讲解、演示、总结四个阶段
4. 画面描述要具体，便于视频制作团队执行

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=MEDIA_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            parsed = self._parse_json_response(response)
            shared_state.set("last_media_result", parsed, self.agent_name)
            return parsed
        except Exception as e:
            return {"error": str(e)}

    def _generate_animation_script(self, task):
        profile = task.get("student_profile", {})
        topic = task.get("topic", "")
        concept = task.get("concept", topic)
        animation_style = task.get("animation_style", "whiteboard")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = f"""请生成一份教学动画脚本。

## 动画主题
{topic}

## 核心概念
{concept}

## 动画风格
{animation_style}（白板动画/扁平化动画/3D动画/手绘风格）

## 学生画像
{json.dumps(profile, ensure_ascii=False)}

要求：
1. 设计5-8个动画场景
2. 每个场景包含：角色动作描述、场景切换效果、文字标注
3. 重点概念用动画效果强调（放大、变色、闪烁等）
4. 适合2-3分钟的动画时长

请严格按照JSON格式输出。"""

        try:
            response = self._call_llm(
                prompt,
                system_prompt=MEDIA_SYSTEM_PROMPT,
                temperature=0.7,
                user_id=_user_id,
                user_role=_user_role,
            )
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_infographic_spec(self, task):
        topic = task.get("topic", "")
        data_points = task.get("data_points", [])
        layout = task.get("layout", "vertical")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = f"""请生成一份信息图设计规格。

## 主题
{topic}

## 数据要点
{json.dumps(data_points, ensure_ascii=False) if data_points else '根据主题自动提取'}

## 布局方向
{layout}

要求：
1. 设计信息图的版面布局
2. 包含标题区、内容区、数据可视化区、注释区
3. 描述每个区域的视觉元素
4. 标注配色方案和字体建议
5. 适合A4尺寸展示

返回JSON格式：
{{
  "infographic": {{
    "title": "信息图标题",
    "layout": "vertical|horizontal",
    "color_scheme": ["#主色", "#辅色", "#强调色"],
    "sections": [
      {{
        "area": "标题区|内容区|数据区|注释区",
        "position": "top|center|bottom|left|right",
        "elements": [
          {{
            "type": "text|chart|icon|diagram",
            "content": "元素内容描述",
            "style": "样式描述"
          }}
        ]
      }}
    ]
  }}
}}"""

        try:
            response = self._call_llm(prompt, temperature=0.6, user_id=_user_id, user_role=_user_role)
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _generate_interactive_demo_spec(self, task):
        topic = task.get("topic", "")
        interaction_type = task.get("interaction_type", "simulation")
        _user_id = task.get('user_id')
        _user_role = task.get('user_role')

        prompt = f"""请生成交互式演示内容的设计规格。

## 主题
{topic}

## 交互类型
{interaction_type}（模拟/拖拽/问答/探索式）

要求：
1. 设计交互流程和用户操作路径
2. 包含初始状态、交互步骤、反馈机制
3. 描述每个交互元素的视觉表现和行为
4. 适配移动端和桌面端

返回JSON格式：
{{
  "interactive_demo": {{
    "title": "演示标题",
    "interaction_type": "simulation",
    "flow": [
      {{
        "step": 1,
        "description": "步骤描述",
        "user_action": "用户操作",
        "feedback": "系统反馈",
        "visual_state": "视觉状态描述"
      }}
    ],
    "components": [
      {{
        "name": "组件名",
        "type": "button|slider|drag|input",
        "behavior": "行为描述"
      }}
    ]
  }}
}}"""

        try:
            response = self._call_llm(prompt, temperature=0.6, user_id=_user_id, user_role=_user_role)
            return self._parse_json_response(response)
        except Exception as e:
            return {"error": str(e)}

    def _get_video_style_hint(self, style):
        hints = {
            "visual": "学生偏好视觉学习，视频设计重点：1)丰富的图表和动画展示 2)关键信息用高亮标注 3)流程图和思维导图动画化 4)减少纯文字画面",
            "auditory": "学生偏好听觉学习，视频设计重点：1)详细清晰的旁白讲解 2)对话式教学风格 3)音效辅助记忆 4)适当停顿留出思考时间",
            "kinesthetic": "学生偏好动手实践，视频设计重点：1)增加实操演示环节 2)分步骤操作展示 3)提供暂停练习提示 4)代码/实验实时演示",
            "reading": "学生偏好阅读学习，视频设计重点：1)字幕完整详细 2)关键概念文字强调 3)提供文字版补充材料 4)引用文献标注",
            "mixed": "学生为混合型学习者，请均衡使用以上各种表达方式",
        }
        return hints.get(style, hints["mixed"])

    def _get_pace_hint(self, pace):
        hints = {
            "fast": "学生学习节奏快，视频编排紧凑，信息密度高，减少重复内容",
            "moderate": "学生学习节奏适中，标准编排，重点内容适当重复强调",
            "slow": "学生学习节奏慢，分段讲解，每个知识点后留出思考时间，增加回顾环节",
            "adaptive": "学生节奏灵活，提供可调节的播放速度建议，标注可跳过的基础内容",
        }
        return hints.get(pace, hints["moderate"])

    def _get_video_type_instruction(self, video_type):
        instructions = {
            "micro_lecture": "微课视频（3-5分钟），聚焦单一知识点，快速讲解核心概念",
            "topic_lecture": "专题讲解视频（8-15分钟），系统讲解一个主题的多个方面",
            "demo": "实操演示视频，重点展示操作步骤和运行效果",
            "review": "复习总结视频，快速回顾核心知识点，强化记忆",
        }
        return instructions.get(video_type, instructions["micro_lecture"])

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
                parts.append(f"### 知识点详情（视频内容应覆盖这些知识点）\n{ctx['knowledge_points_detail']}")
            if ctx.get("teaching_cases_detail") and ctx["teaching_cases_detail"] != "暂无":
                parts.append(f"### 教学案例（可作为视频演示场景）\n{ctx['teaching_cases_detail']}")
            return "\n\n".join(parts)
        except Exception as e:
            logger.warning(f"Failed to build KB context for media agent: {e}")
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
