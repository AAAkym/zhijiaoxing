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

MEDIA_SYSTEM_PROMPT = """你是一位专业的多媒体教学内容设计专家智能体，负责生成教学视频脚本、动画描述和多媒体教学材料。

## 你的职责
根据学生画像和知识点，设计多模态教学内容的脚本和描述，包括视频脚本、动画分镜、图文排版等。

## 生成原则
1. 视频脚本：包含画面描述、旁白文案、字幕文本、时间节点
2. 动画描述：包含场景描述、角色动作、转场效果、关键帧说明
3. 图文材料：包含信息图描述、图解说明、交互式内容设计
4. 时长控制：微课3-5分钟，专题讲解8-15分钟
5. 节奏设计：引入(15%)→讲解(50%)→演示(20%)→总结(15%)

## 视频脚本六要素（必须完整覆盖）
1. 视频呈现方式说明（presentation_style）：阐述整体呈现形式，如真人讲授/录屏演示/动画讲解/实拍+动画混合/虚拟形象等，说明为何该形式适配本知识点
2. 详细台词文本（narration）：完整旁白台词，口语化、可直接录音使用，含语气提示
3. 具体拍摄内容描述（visual_description）：每个分镜的画面构成、主体对象、场景布置、镜头运动
4. 适宜的拍摄形式建议（shooting_format / shooting_format_suggestion）：实拍/录屏/动画/混合等形式建议，含设备与机位提示
5. 分镜规划（scenes）：按场景编号、时长、阶段（引入/讲解/演示/总结）组织，节奏清晰
6. 必要的视觉元素说明（visual_elements / key_frame_description）：标注关键帧、文字标注、图表动画、色彩高亮、转场特效等视觉要素

## 学生画像适配
- 视觉型：增加图表动画、流程可视化、色彩标注
- 听觉型：增加旁白讲解、对话式教学、音效提示
- 动觉型：增加交互式演示、实操步骤展示、模拟操作
- 快节奏学习者：紧凑编排，信息密度高
- 慢节奏学习者：分段讲解，留出思考时间

## 输出格式
严格返回以下JSON格式。
注意：下方尖括号 <...> 中的说明是填写指引，必须替换为针对本主题的实际内容，禁止保留占位文字或枚举竖线：
{
  "media": {
    "type": "<必须从 video_script / animation / infographic / interactive 中选择一个具体值，不要带竖线>",
    "title": "<填写本多媒体内容的实际标题>",
    "topic": "<填写实际主题>",
    "estimated_duration_minutes": 5,
    "target_style": "<必须从 visual / auditory / kinesthetic / mixed 中选择一个具体值，不要带竖线>",
    "presentation_style": "<填写实际呈现方式说明，例如'真人讲授配合PPT录屏，因本知识点涉及代码演示需实时操作'>",
    "knowledge_point_references": ["<填写本脚本实际覆盖的知识点原文，最多10条>"],
    "script": {
      "scenes": [
        {
          "scene_id": 1,
          "stage": "<从 引入 / 讲解 / 演示 / 总结 中选择一个具体值>",
          "duration_seconds": 30,
          "visual_description": "<填写本分镜的实际画面内容：画面构成、主体对象、场景布置、镜头运动>",
          "narration": "<填写本分镜的完整旁白台词，口语化可直接录音，含语气提示>",
          "subtitle": "<填写本分镜的字幕文本>",
          "shooting_format": "<填写本分镜的拍摄形式建议：实拍/录屏/动画/混合，含设备与机位>",
          "animation_notes": "<填写本分镜的动画/特效说明>",
          "key_frame_description": "<填写本分镜关键帧的视觉元素描述>",
          "visual_elements": ["<填写本分镜的视觉元素，如标题字幕、图表、高亮标注等>"],
          "transition": "<填写本分镜的转场效果>"
        }
      ],
      "total_duration_seconds": 300,
      "background_music_suggestion": "<填写实际背景音乐建议>",
      "visual_style": "<填写实际整体视觉风格>",
      "shooting_format_suggestion": "<填写实际整体拍摄形式建议与器材需求>"
    },
    "supplementary_materials": [
      {
        "type": "<从 infographic / diagram / interactive_demo 中选择一个>",
        "title": "<填写辅助材料实际标题>",
        "description": "<填写材料实际描述>",
        "content_spec": "<填写内容规格说明>"
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
3. 包含引入、讲解、演示、总结四个阶段，并在每场景 stage 字段标注
4. 画面描述要具体，便于视频制作团队执行
5. 必须完整覆盖六要素：
   - presentation_style：开篇说明整体呈现方式（真人讲授/录屏/动画/混合等）及适配理由
   - narration：每场景完整台词，口语化可直接录音
   - visual_description：每场景具体拍摄内容（画面构成、主体、镜头运动）
   - shooting_format / shooting_format_suggestion：每场景及整体拍摄形式建议（含设备机位）
   - scenes 分镜规划：编号、阶段、时长、转场
   - visual_elements / key_frame_description：每场景视觉元素清单与关键帧描述
6. 台词需紧扣核心知识点，保证教育性与逻辑性，可直接落地实施
7. **知识点覆盖（关键）**：上方"知识点"列表中的每一个知识点，都必须在至少一个分镜的 narration（旁白台词）或 visual_description（画面描述）或 subtitle（字幕）中显式提及（使用与知识点列表一致或高度相近的表述）。生成前先在内部分配每个知识点到对应分镜，确保无遗漏。若知识点列表非空，脚本覆盖的知识点数量将直接影响覆盖率评分。
8. 在 media 对象中增加 knowledge_point_references 字段，值为数组，列出本脚本实际覆盖的知识点原文，便于审核与覆盖率统计。**最多 5 条**，仅列出脚本台词中真正讲解到的知识点，禁止把整个课程知识点列表全部塞入，以免输出超长被截断。

## 输出长度控制（关键，违反将导致 JSON 被截断）
1. **scenes 数量严格限制在 3-5 个**，禁止超过 5 个分镜
2. 每个 scene 的 description（描述）≤ 80 字，narration（旁白）≤ 150 字
3. 每个 scene 的 visual_description（画面描述）≤ 60 字
4. knowledge_point_references 数组 ≤ 5 条，每条 excerpt ≤ 50 字
5. 整个 JSON 输出总长度控制在 3000 字以内
6. 不要输出任何注释、说明性文字或 markdown 代码块标记，只输出纯 JSON

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
            # 后处理：强制截断 knowledge_point_references 到 10 条以内，
            # 防止 LLM 输出 80+ 条导致 JSON 超长被截断（即使 prompt 已要求最多 10 条）
            parsed = self._truncate_kp_references(parsed, max_count=10)
            shared_state.set("last_media_result", parsed, self.agent_name)
            return parsed
        except Exception as e:
            return {"error": str(e)}

    def _extract_partial_media(self, raw_text):
        """从被截断的 JSON 文本中提取已完成的 scenes，构造可用的 media 对象。

        当 _repair_truncated_json 修复失败时的最终兜底：
        1. 用正则提取顶层 media 对象的简单字段（title/topic/type 等字符串字段）
        2. 用括号栈逐个提取 scenes 数组中完整的 scene 对象
        3. 组装成 {"media": {"scenes": [...], ...}} 结构返回
        """
        if not raw_text or not isinstance(raw_text, str):
            return None

        media = {"scenes": []}

        # 提取顶层简单字符串字段（type/title/topic/presentation_style/visual_style/shooting_format 等）
        simple_fields = [
            "type", "title", "topic", "target_style", "presentation_style",
            "visual_style", "shooting_format", "shooting_format_suggestion",
            "background_music_suggestion", "estimated_duration_minutes",
        ]
        for field in simple_fields:
            # 匹配 "field": "value" 或 "field": 数字
            m = re.search(
                rf'"{re.escape(field)}"\s*:\s*"((?:[^"\\]|\\.){{0,200}})"',
                raw_text,
            )
            if m:
                media[field] = m.group(1).replace('\\"', '"').replace('\\n', '\n')
            else:
                m2 = re.search(
                    rf'"{re.escape(field)}"\s*:\s*(\d+(?:\.\d+)?)',
                    raw_text,
                )
                if m2:
                    media[field] = float(m2.group(1)) if '.' in m2.group(1) else int(m2.group(1))

        # 提取 scenes 数组中完整的 scene 对象
        # 定位 "scenes": [ 之后的内容
        scenes_start = re.search(r'"scenes"\s*:\s*\[', raw_text)
        if scenes_start:
            arr_start = scenes_start.end()  # [ 后面的位置
            # 用括号栈逐个提取完整的 {...} 对象
            i = arr_start
            n = len(raw_text)
            scenes = []
            while i < n:
                # 跳过空白和逗号
                while i < n and raw_text[i] in ' \t\n\r,':
                    i += 1
                if i >= n or raw_text[i] == ']':
                    break
                if raw_text[i] != '{':
                    i += 1
                    continue
                # 从当前位置开始用括号栈找一个完整的 {...}
                depth = 0
                in_str = False
                esc = False
                obj_start = i
                obj_end = -1
                while i < n:
                    ch = raw_text[i]
                    if esc:
                        esc = False
                        i += 1
                        continue
                    if ch == '\\' and in_str:
                        esc = True
                        i += 1
                        continue
                    if ch == '"':
                        in_str = not in_str
                        i += 1
                        continue
                    if in_str:
                        i += 1
                        continue
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            obj_end = i + 1
                            break
                    i += 1
                if obj_end > obj_start:
                    scene_str = raw_text[obj_start:obj_end]
                    try:
                        scene_obj = json.loads(scene_str)
                        scenes.append(scene_obj)
                    except json.JSONDecodeError:
                        # 单个 scene 解析失败，尝试修复
                        repaired = self._repair_truncated_json(scene_str)
                        if repaired:
                            try:
                                scene_obj = json.loads(repaired)
                                scenes.append(scene_obj)
                            except json.JSONDecodeError:
                                logger.debug(f"MediaAgent skip unparseable scene: {scene_str[:80]}")
                        else:
                            logger.debug(f"MediaAgent skip unparseable scene: {scene_str[:80]}")
                    i = obj_end
                else:
                    # 没有找到闭合 }，说明截断在此 scene 中，跳过
                    break

            if scenes:
                media["scenes"] = scenes
                logger.info(f"MediaAgent extracted {len(scenes)} partial scenes from truncated JSON")

        # 至少要有 type 或 title 字段，否则视为提取失败
        if not media.get("type") and not media.get("title") and not media.get("scenes"):
            return None

        return {"media": media, "partial_extracted": True}

    def _truncate_kp_references(self, parsed, max_count=10):
        """强制截断 media.knowledge_point_references 到 max_count 条以内。

        LLM 经常忽略 prompt 中的"最多10条"约束，输出 80+ 条知识点引用，
        导致 JSON 输出超长被截断，前端解析失败只能 fallback 到 pre 标签显示原始 JSON。
        本方法在 LLM 返回后强制截断，保证输出长度可控。
        """
        if not isinstance(parsed, dict):
            return parsed
        media = parsed.get("media") if isinstance(parsed.get("media"), dict) else None
        if media is None:
            return parsed
        refs = media.get("knowledge_point_references")
        if isinstance(refs, list) and len(refs) > max_count:
            media["knowledge_point_references"] = refs[:max_count]
            logger.info(
                f"MediaAgent truncated knowledge_point_references: "
                f"{len(refs)} -> {max_count}"
            )
        return parsed

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
            # 截断修复：LLM 输出超长被截断导致 JSON 不完整时，尝试补全闭合括号
            if start >= 0:
                repaired = self._repair_truncated_json(text[start:])
                if repaired:
                    try:
                        return json.loads(repaired)
                    except json.JSONDecodeError:
                        pass
            # JS 字面量修复：LLM 偶尔输出 { stage: "1. 引言" } 而非 { "stage": "1. 引言" }，
            # 给无引号的 key 加双引号后重新尝试解析
            if start >= 0:
                fixed = self._fix_js_literal_keys(text[start:])
                if fixed != text[start:]:
                    try:
                        return json.loads(fixed)
                    except json.JSONDecodeError:
                        # 修复后仍失败，尝试 JS 修复 + 截断修复组合
                        repaired_fixed = self._repair_truncated_json(fixed)
                        if repaired_fixed:
                            try:
                                return json.loads(repaired_fixed)
                            except json.JSONDecodeError:
                                pass
            # 最终兜底：从截断的 JSON 中提取已完成的 scenes 与简单字段
            # 这样即使 LLM 输出在第 N 个分镜处被截断，前 N-1 个完整分镜仍可用
            partial = self._extract_partial_media(text)
            if partial:
                logger.info("MediaAgent recovered partial media from truncated JSON")
                return partial
            return {"raw_response": text, "parse_error": True}

    def _repair_truncated_json(self, text):
        """尝试修复被截断的 JSON 文本：补全未闭合的字符串、数组、对象。

        LLM 输出超长时会被截断在字段值/字段名中间，导致 JSON 解析失败。
        本方法通过追踪括号栈与字符串状态，补全缺失的闭合符号，并处理：
        - 截断在 key 中间（key 后无 `:value`）：删除不完整的 key
        - 截断在 `:` 后但 value 前：补 null
        - 截断在 value 中间（字符串/数字/对象）：补全引号或丢弃
        - 尾随逗号：删除
        """
        if not text or not isinstance(text, str):
            return None
        # 第一步：追踪括号栈与字符串状态，找到最后一个"安全截断点"
        stack = []
        in_string = False
        escape = False
        # last_safe_end 记录最后一个可以安全闭合的位置（即某个完整 value 后的逗号或括号）
        last_safe_end = 0
        i = 0
        n = len(text)
        while i < n:
            ch = text[i]
            if escape:
                escape = False
                i += 1
                continue
            if ch == "\\" and in_string:
                escape = True
                i += 1
                continue
            if ch == '"':
                if in_string:
                    # 字符串结束 - 字符串本身是完整 value 或 key
                    in_string = False
                else:
                    in_string = True
                i += 1
                continue
            if in_string:
                i += 1
                continue
            if ch in "{[":
                stack.append(ch)
                i += 1
                continue
            if ch == "}" and stack and stack[-1] == "{":
                stack.pop()
                # 对象闭合是一个安全点
                last_safe_end = i + 1
                i += 1
                continue
            if ch == "]" and stack and stack[-1] == "[":
                stack.pop()
                # 数组闭合是一个安全点
                last_safe_end = i + 1
                i += 1
                continue
            if ch == ",":
                # 逗号后通常是一个完整字段的结束（前提是逗号前有完整 value）
                # 但逗号本身可能是尾随逗号，需要后续判断
                last_safe_end = i
                i += 1
                continue
            # 其他字符（包括冒号、空白、数字、字母等）
            i += 1

        # 第二步：如果仍在字符串中，说明截断在字符串值中间
        if in_string:
            # 回退到最后一个安全点，避免截断在字符串中间
            if last_safe_end > 0:
                truncated = text[:last_safe_end]
            else:
                # 没有安全点，强行补全引号
                truncated = text + '"'
        else:
            # 不在字符串中，但可能截断在 key 中间、`:` 后、value 中间（非字符串）
            # 检查最后一个非空白字符
            stripped = text.rstrip()
            if stripped:
                last_char = stripped[-1]
                # 如果最后一个字符是冒号，说明截断在 `:` 后但 value 前
                if last_char == ":":
                    # 补 null
                    truncated = stripped + " null"
                # 如果最后一个字符是 `{` 或 `[`，说明截断在容器开始后
                elif last_char in "{[":
                    truncated = stripped
                # 如果最后一个字符是逗号，可能是尾随逗号，回退到安全点
                elif last_char == ",":
                    if last_safe_end > 0:
                        truncated = text[:last_safe_end]
                    else:
                        truncated = stripped
                else:
                    # 可能截断在数字/true/false/null 中间，或 key 中间
                    # 尝试回退到最后一个安全点
                    if last_safe_end > 0:
                        truncated = text[:last_safe_end]
                    else:
                        truncated = text
            else:
                truncated = text

        # 第三步：移除尾随逗号（在闭合括号前）
        truncated = re.sub(r',\s*$', '', truncated.rstrip())

        # 第四步：重新计算栈状态，补全闭合符号
        stack = []
        in_string = False
        escape = False
        for ch in truncated:
            if escape:
                escape = False
                continue
            if ch == "\\" and in_string:
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch in "{[":
                stack.append(ch)
            elif ch == "}" and stack and stack[-1] == "{":
                stack.pop()
            elif ch == "]" and stack and stack[-1] == "[":
                stack.pop()

        suffix = "".join("}" if opener == "{" else "]" for opener in reversed(stack))
        if suffix:
            return truncated + suffix
        return truncated if truncated != text else None

    def _fix_js_literal_keys(self, text):
        """修复 JS 对象字面量语法为标准 JSON：给无引号的 key 加双引号。

        LLM 偶尔输出混合语法：外层用标准 JSON，内层数组对象用 JS 字面量
        （如 { stage: "1. 引言", content: "..." }），导致 json.loads 失败。
        本方法用状态机遍历，仅在非字符串区域识别 `{`/`,` 后的无引号 key 并加引号，
        避免误伤字符串内部的冒号。
        """
        if not text or not isinstance(text, str):
            return text
        result = []
        i = 0
        n = len(text)
        in_string = False
        escape = False
        while i < n:
            ch = text[i]
            if escape:
                result.append(ch)
                escape = False
                i += 1
                continue
            if ch == "\\" and in_string:
                result.append(ch)
                escape = True
                i += 1
                continue
            if ch == '"':
                in_string = not in_string
                result.append(ch)
                i += 1
                continue
            if in_string:
                result.append(ch)
                i += 1
                continue
            # 非字符串区域：检测 { 或 , 后的无引号 key
            if ch in "{,":
                result.append(ch)
                i += 1
                # 跳过空白
                while i < n and text[i] in " \t\n\r":
                    result.append(text[i])
                    i += 1
                # 检查是否是标识符起始（字母/下划线，且后续是 key:）
                if i < n and (text[i].isalpha() or text[i] == "_"):
                    # 收集 key
                    key_start = i
                    while i < n and (text[i].isalnum() or text[i] == "_"):
                        i += 1
                    key = text[key_start:i]
                    # 跳过空白
                    while i < n and text[i] in " \t\n\r":
                        i += 1
                    if i < n and text[i] == ":":
                        # 确认是 key:，给 key 加双引号
                        result.append('"')
                        result.append(key)
                        result.append('"')
                    else:
                        # 不是 key:，原样追加 key
                        result.append(key)
                # 注意：此处不追加当前字符，因为上面已处理
                continue
            result.append(ch)
            i += 1
        return "".join(result)
