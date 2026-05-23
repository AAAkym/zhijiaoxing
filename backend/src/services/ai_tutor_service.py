import base64
import io
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, Generator, List, Optional

from sqlalchemy import func, desc

from src.models.user import db
from src.models.course import (
    Course, TeachingContent, VideoLesson, Assessment,
    MistakeRecord, ProgrammingSubmission, LearningProgress,
    PracticeEvaluation,
)
from src.models.student_profile import StudentProfile
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)


def _extract_tag_name(tag) -> str:
    if isinstance(tag, dict):
        return str(tag.get('name', tag.get('label', tag.get('tag', str(tag)))))
    if tag is not None:
        return str(tag).strip()
    return ''


def _parse_knowledge_tags(raw_tags) -> List[str]:
    if not raw_tags:
        return []
    try:
        parsed = json.loads(raw_tags) if isinstance(raw_tags, str) else raw_tags
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(parsed, list):
        parsed = [parsed]
    result = []
    for t in parsed:
        name = _extract_tag_name(t)
        if name:
            result.append(name)
    return result


def _safe_json_loads(text: str, default=None):
    if not text:
        return default
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default


def _clean_ai_json(raw: str):
    cleaned = raw.strip()
    cleaned = re.sub(r'^```(?:json)?', '', cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'```$', '', cleaned).strip()
    return cleaned


class AITutorService:

    STANDARD_DIMENSIONS = ['语法基础', '核心概念', '编程范式', '调试能力', '项目实践']

    _STANDARD_DIMENSION_KEYWORDS = {
        '语法基础': [
            '语法', '变量', '类型', '数据类型', '运算符', '表达式', '语句', '控制流',
            '条件', '循环', '函数', '参数', '返回值', '作用域', 'syntax', 'variable',
            'type', 'operator', 'expression', 'statement', 'loop', 'condition',
            '声明', '赋值', '初始化', '基本输入输出', '格式化', '字符串', '数组', '指针',
        ],
        '核心概念': [
            '面向对象', 'OOP', '类', '对象', '继承', '多态', '封装', '抽象', '接口',
            '设计模式', '数据结构', '算法', '排序', '查找', '递归', '链表', '树', '图',
            '哈希', '栈', '队列', 'class', 'object', 'inheritance', 'polymorphism',
            'encapsulation', 'interface', 'data structure', 'algorithm',
            '集合', '映射', '泛型', '异常', '内存管理', '引用', '方法重载', '方法重写',
        ],
        '编程范式': [
            '函数式', '面向过程', '事件驱动', '响应式', '并发', '并行', '异步', '同步',
            '回调', 'Promise', '协程', '线程', '进程', '设计原则', 'SOLID', 'MVC',
            'functional', 'imperative', 'concurrent', 'async', 'thread',
            '模块化', '组件化', '设计思想', '编程思想', '范式',
        ],
        '调试能力': [
            '调试', '断点', '日志', '错误处理', '异常处理', '测试', '单元测试', '集成测试',
            'debug', 'breakpoint', 'log', 'error handling', 'exception', 'test',
            '排错', '纠错', '堆栈', '跟踪', '性能分析', '代码审查', '边界条件',
        ],
        '项目实践': [
            '项目', '实战', '应用', '开发', '部署', '架构', '框架', 'API', '数据库',
            '项目实践', '综合应用', 'project', 'development', 'deploy', 'framework',
            'Web', '爬虫', '数据分析', '机器学习', '系统设计', '工程化',
        ],
    }

    STANDARD_CATEGORIES = {
        'basics': {
            'label': '基础语法',
            'keywords': ['语法', '变量', '类型', '运算符', '表达式', '控制流', '条件', '循环', '函数', '输入输出', '字符串', '数组'],
        },
        'oop': {
            'label': '面向对象',
            'keywords': ['类', '对象', '继承', '多态', '封装', '抽象', '接口', 'OOP', '面向对象'],
        },
        'data_structures': {
            'label': '数据结构',
            'keywords': ['数组', '链表', '栈', '队列', '树', '图', '哈希', '集合', '字典', '映射'],
        },
        'algorithms': {
            'label': '算法',
            'keywords': ['排序', '查找', '递归', '动态规划', '贪心', '分治', '回溯', '算法'],
        },
        'concurrency': {
            'label': '并发编程',
            'keywords': ['线程', '进程', '并发', '并行', '异步', '同步', '锁', '协程'],
        },
        'debugging': {
            'label': '调试与测试',
            'keywords': ['调试', '测试', '断点', '日志', '异常', '错误处理', '单元测试'],
        },
        'engineering': {
            'label': '工程实践',
            'keywords': ['项目', '框架', '架构', '设计模式', 'API', '数据库', '部署', '工程化'],
        },
    }

    def answer_question(
        self,
        question: str,
        user_id: int,
        course_id: int = None,
        image_data: str = None,
    ) -> Dict[str, Any]:
        try:
            profile = StudentProfile.query.filter_by(user_id=user_id).first()
            cognitive_style = profile.cognitive_style if profile else 'mixed'
            interaction_pref = profile.interaction_preference if profile else 'guided'
            learning_pace = profile.learning_pace if profile else 'moderate'

            course_context = ""
            knowledge_base = ""
            if course_id:
                course = Course.query.get(course_id)
                if course:
                    course_context = f"课程：{course.title}\n课程描述：{course.description or ''}"
                    contents = TeachingContent.query.filter_by(course_id=course_id).all()
                    if contents:
                        kb_parts = [f"【{c.title}】{c.content[:500]}" for c in contents[:10]]
                        knowledge_base = "\n".join(kb_parts)

            image_note = ""
            if image_data:
                ocr_text = self._extract_text_from_image(image_data)
                image_note = f"\n[用户上传了图片，图片中识别到的文字内容如下：]\n{ocr_text}"

            prompt = self._build_answer_prompt(
                question, course_context, knowledge_base,
                cognitive_style, interaction_pref, learning_pace, image_note,
            )

            result = spark_service.chat(prompt)

            is_out_of_scope = False
            clarification_options = []
            knowledge_tags = []

            if "超出课程范围" in result or "不在本课程" in result or "超出范围" in result:
                is_out_of_scope = True

            clarify_match = re.findall(r'(?:澄清|明确|选项)[：:]\s*(.+?)(?:\n|$)', result)
            if clarify_match:
                clarification_options = [opt.strip() for opt in clarify_match[:3]]
            elif "不够明确" in result or "不够清晰" in result or "需要更多信息" in result:
                lines = result.split('\n')
                options = [l.strip().lstrip('0123456789.-、）) ') for l in lines if re.match(r'\s*[1-3][.、）)]', l)]
                if options:
                    clarification_options = options[:3]

            tag_match = re.findall(r'【([^】]+)】', result)
            if not tag_match:
                tag_match = re.findall(r'知识点[：:]\s*(.+?)(?:\n|$)', result)
                if tag_match:
                    tag_match = [t.strip() for t in tag_match[0].split('、') if t.strip()]
            knowledge_tags = tag_match[:5] if tag_match else []

            return {
                "answer": result,
                "is_out_of_scope": is_out_of_scope,
                "clarification_options": clarification_options,
                "knowledge_tags": knowledge_tags,
            }
        except Exception as e:
            logger.error("answer_question failed: %s", e, exc_info=True)
            return {
                "answer": "抱歉，回答问题时出现错误，请稍后重试。",
                "is_out_of_scope": False,
                "clarification_options": [],
                "knowledge_tags": [],
            }

    def answer_question_stream(
        self,
        question: str,
        user_id: int,
        course_id: int = None,
        image_data: str = None,
    ) -> Generator[str, None, None]:
        try:
            profile = StudentProfile.query.filter_by(user_id=user_id).first()
            cognitive_style = profile.cognitive_style if profile else 'mixed'
            interaction_pref = profile.interaction_preference if profile else 'guided'
            learning_pace = profile.learning_pace if profile else 'moderate'

            course_context = ""
            knowledge_base = ""
            if course_id:
                course = Course.query.get(course_id)
                if course:
                    course_context = f"课程：{course.title}\n课程描述：{course.description or ''}"
                    contents = TeachingContent.query.filter_by(course_id=course_id).all()
                    if contents:
                        kb_parts = [f"【{c.title}】{c.content[:500]}" for c in contents[:10]]
                        knowledge_base = "\n".join(kb_parts)

            image_note = ""
            if image_data:
                ocr_text = self._extract_text_from_image(image_data)
                image_note = f"\n[用户上传了图片，图片中识别到的文字内容如下：]\n{ocr_text}"

            prompt = self._build_answer_prompt(
                question, course_context, knowledge_base,
                cognitive_style, interaction_pref, learning_pace, image_note,
            )

            for chunk in spark_service.chat_stream(prompt):
                yield chunk
        except Exception as e:
            logger.error("answer_question_stream failed: %s", e, exc_info=True)
            raise

    def _extract_text_from_image(self, image_data_base64: str) -> str:
        try:
            image_bytes = base64.b64decode(image_data_base64)
            try:
                from PIL import Image
                import pytesseract
                image = Image.open(io.BytesIO(image_bytes))
                text = pytesseract.image_to_string(image, lang='chi_sim+eng')
                return text.strip() if text.strip() else "[图片中未识别到文字内容]"
            except ImportError:
                return "[图片内容无法识别，请安装pytesseract]"
        except Exception as e:
            logger.warning("OCR extraction failed: %s", e)
            return "[图片内容无法识别，请安装pytesseract]"

    def _build_answer_prompt(
        self,
        question: str,
        course_context: str,
        knowledge_base: str,
        cognitive_style: str,
        interaction_pref: str,
        learning_pace: str,
        image_note: str,
    ) -> str:
        style_hints = {
            'visual': '多用图示描述和空间类比',
            'auditory': '多用对话式语气和节奏感强的表述',
            'kinesthetic': '多用动手操作和体验式类比',
            'reading': '多用文字推理和文献引用',
            'mixed': '综合运用多种表达方式',
        }
        pace_hints = {
            'fast': '简洁高效，直接给出核心结论',
            'moderate': '适度展开，兼顾深度与可读性',
            'slow': '循序渐进，逐步推导，每步都给出解释',
            'adaptive': '根据问题复杂度自适应调整详细程度',
        }
        interaction_hints = {
            'guided': '引导式回答，先给方向再展开',
            'exploratory': '启发式回答，提供多角度思考',
            'challenging': '挑战式回答，先提问再揭示答案',
        }

        style_hint = style_hints.get(cognitive_style, style_hints['mixed'])
        pace_hint = pace_hints.get(learning_pace, pace_hints['moderate'])
        interaction_hint = interaction_hints.get(interaction_pref, interaction_hints['guided'])

        return f"""你是一位专业的AI学习助手，请针对学生的问题进行精准解答。

**核心原则：直接回答学生的问题，不要复述或罗列知识库中的全部内容。知识库仅作为参考依据，回答应围绕问题本身展开。**

【学生认知风格】{style_hint}
【学习节奏偏好】{pace_hint}
【互动偏好】{interaction_hint}

{course_context}
{image_note}

【参考知识库】
{knowledge_base[:3000] if knowledge_base else '暂无课程知识库'}

【学生问题】
{question}

【解答要求】
1. **紧扣问题**：先理解学生真正在问什么，再组织回答。如果问题涉及某个错题类型（如"概念理解"、"计算错误"、"逻辑推理"等），请针对该类型的常见误区和改进方法进行解析，而非泛泛介绍课程内容
2. 使用学术性语言，严谨准确
3. 复杂问题需结构化回答（分点、分段、使用标题）
4. 关键结论使用**加粗**标注
5. 引用知识库中的来源时标注出处
6. 如果问题超出课程范围，请礼貌说明，并给出方向性引导（标注"超出课程范围"）
7. 如果问题模糊不明确，请提供最多3个澄清选项供学生选择（标注"需要更多信息"）
8. 在回答末尾用【知识点标签】标注涉及的核心知识点

请回答学生的问题。"""

    def explain_knowledge(
        self,
        topic: str,
        user_id: int,
        course_id: int = None,
        mastery_level: float = None,
    ) -> Dict[str, Any]:
        try:
            profile = StudentProfile.query.filter_by(user_id=user_id).first()

            if mastery_level is None:
                mastery_level = self._calculate_mastery_from_mistakes(user_id, course_id)

            knowledge_base = ""
            if course_id:
                contents = TeachingContent.query.filter_by(course_id=course_id).all()
                if contents:
                    knowledge_base = "\n".join([f"【{c.title}】{c.content[:400]}" for c in contents[:8]])

            standard_category = self._map_to_standard_category(topic)
            standard_category_info = self.STANDARD_CATEGORIES.get(standard_category, {})

            prompt = self._build_explain_prompt(topic, mastery_level, knowledge_base, standard_category, standard_category_info)

            raw = spark_service.chat(prompt)
            cleaned = _clean_ai_json(raw)

            try:
                parsed = json.loads(cleaned)
            except (json.JSONDecodeError, TypeError):
                parsed = {
                    "basic": raw,
                    "advanced": "",
                    "expert": "",
                    "code_examples": [],
                    "mermaid_diagrams": [],
                    "cases": [],
                }

            required_keys = ["basic", "advanced", "expert", "code_examples", "mermaid_diagrams", "cases"]
            for key in required_keys:
                if key not in parsed:
                    parsed[key] = [] if key in ("code_examples", "mermaid_diagrams", "cases") else ""

            parsed["standard_category"] = standard_category
            parsed["standard_category_label"] = standard_category_info.get("label", "基础语法")

            return parsed
        except Exception as e:
            logger.error("explain_knowledge failed: %s", e, exc_info=True)
            standard_category = self._map_to_standard_category(topic)
            return {
                "basic": f"关于「{topic}」的基础解释暂时不可用，请稍后重试。",
                "advanced": "",
                "expert": "",
                "code_examples": [],
                "mermaid_diagrams": [],
                "cases": [],
                "standard_category": standard_category,
                "standard_category_label": self.STANDARD_CATEGORIES.get(standard_category, {}).get("label", "基础语法"),
            }

    def explain_knowledge_stream(
        self,
        topic: str,
        user_id: int,
        course_id: int = None,
        mastery_level: float = None,
    ) -> Generator[str, None, None]:
        try:
            if mastery_level is None:
                mastery_level = self._calculate_mastery_from_mistakes(user_id, course_id)

            knowledge_base = ""
            if course_id:
                contents = TeachingContent.query.filter_by(course_id=course_id).all()
                if contents:
                    knowledge_base = "\n".join([f"【{c.title}】{c.content[:400]}" for c in contents[:8]])

            standard_category = self._map_to_standard_category(topic)
            standard_category_info = self.STANDARD_CATEGORIES.get(standard_category, {})
            prompt = self._build_explain_prompt(topic, mastery_level, knowledge_base, standard_category, standard_category_info)

            for chunk in spark_service.chat_stream(prompt):
                yield chunk
        except Exception as e:
            logger.error("explain_knowledge_stream failed: %s", e, exc_info=True)
            yield "\n\n知识讲解暂时不可用，请稍后重试。"

    def _calculate_mastery_from_mistakes(self, user_id: int, course_id: int = None) -> float:
        query = MistakeRecord.query.filter_by(user_id=user_id)
        if course_id:
            query = query.filter_by(course_id=course_id)
        mistakes = query.all()
        if not mistakes:
            return 50.0

        mastered = sum(1 for m in mistakes if m.mastery_status == 'mastered')
        reviewing = sum(1 for m in mistakes if m.mastery_status == 'reviewing')
        total = len(mistakes)

        mastery = (mastered * 100 + reviewing * 50) / total
        return round(min(mastery, 100.0), 1)

    def _build_explain_prompt(self, topic: str, mastery_level: float, knowledge_base: str, standard_category: str = '', standard_category_info: Dict = None) -> str:
        if mastery_level >= 60:
            start_hint = "学生掌握度较高（>=60%），从进阶层开始讲解，基础层可简要概述"
        elif mastery_level < 30:
            start_hint = "学生掌握度较低（<30%），从基础层开始详细讲解"
        else:
            start_hint = "学生掌握度中等（30%-60%），从基础层概要回顾后进入进阶层"

        category_note = ""
        if standard_category and standard_category_info:
            category_note = f"\n【标准知识分类】{standard_category_info.get('label', '')}（{standard_category}）\n该分类涵盖：{'、'.join(standard_category_info.get('keywords', [])[:8])}"

        return f"""你是一位资深学科教师，请对以下知识点进行三层递进式讲解。

【知识点】{topic}
【学生当前掌握度】{mastery_level}%
【讲解策略】{start_hint}{category_note}

【参考知识库】
{knowledge_base[:2000] if knowledge_base else '暂无'}

请严格以JSON格式输出，包含以下字段：
{{
  "basic": "基础层：使用日常类比解释，避免专业术语，让零基础学生也能理解",
  "advanced": "进阶层：完整定义、原理阐述、标准案例，使用专业术语但给出解释",
  "expert": "专家层：理论背景、前沿研究、高级应用场景",
  "code_examples": ["如果是编程相关主题，提供带语法高亮标记的代码示例，如```python\\nprint('hello')\\n```，非编程主题可为空数组"],
  "mermaid_diagrams": ["如果适合用图表展示（如算法流程、架构图），生成Mermaid语法图表代码，不适合的主题可为空数组"],
  "cases": ["应用案例1：不同场景下的实际应用", "应用案例2", "应用案例3", "应用案例4", "应用案例5"]
}}

要求：
1. 三层讲解层层递进，每层都有独立完整的价值
2. 提供3-5个不同场景的应用案例
3. 编程主题必须包含代码示例
4. 适合图表展示的主题必须包含Mermaid图
5. 只输出JSON，不要输出其他内容"""

    def recommend_resources(
        self,
        topic: str,
        user_id: int,
        course_id: int = None,
    ) -> List[Dict[str, Any]]:
        try:
            resources = []
            topic_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', topic).split())

            user_mastery = self._calculate_mastery_from_mistakes(user_id, course_id)
            user_mastery_context = {
                'mastery': user_mastery,
                'level': 'low' if user_mastery < 40 else ('medium' if user_mastery < 70 else 'high'),
            }

            topic_related_tags = set()
            mistake_query = MistakeRecord.query.filter_by(user_id=user_id)
            if course_id:
                mistake_query = mistake_query.filter_by(course_id=course_id)
            for m in mistake_query.all():
                tags = _parse_knowledge_tags(m.knowledge_tags)
                if not tags:
                    error_type = m.error_type_auto or m.error_type_manual or ''
                    tags = [error_type] if error_type else ['未分类']
                for tag in tags:
                    tag_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', tag).split())
                    if topic_keywords & tag_keywords:
                        topic_related_tags.add(tag)

            topic_related_tag_keywords = set()
            for tag in topic_related_tags:
                topic_related_tag_keywords |= set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', tag).split())

            def _compute_weighted_score(title_overlap, content_overlap, tag_overlap_count, created_at=None):
                score = title_overlap * 3.0 + content_overlap * 2.0 + tag_overlap_count * 1.5
                if created_at:
                    try:
                        days_old = (datetime.utcnow() - created_at).days
                        recency_bonus = max(0, 10 - days_old / 30)
                        score += recency_bonus
                    except Exception:
                        pass
                return round(min(score / max(len(topic_keywords), 1) * 20, 100.0), 1)

            if course_id:
                contents = TeachingContent.query.filter_by(course_id=course_id).all()
                for c in contents:
                    title_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', c.title).split())
                    content_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', (c.content or '')[:500]).split())
                    title_overlap = len(topic_keywords & title_keywords)
                    content_overlap = len(topic_keywords & content_keywords)
                    tag_overlap_count = len(topic_related_tag_keywords & (title_keywords | content_keywords))
                    if title_overlap > 0 or content_overlap > 0 or topic.lower() in c.title.lower():
                        relevance = _compute_weighted_score(
                            title_overlap, content_overlap, tag_overlap_count,
                            getattr(c, 'created_at', None),
                        )
                        resources.append({
                            "type": "textbook",
                            "title": c.title,
                            "description": (c.content or '')[:200],
                            "relevance_score": max(relevance, 50.0),
                            "page_range": f"第1-{max(1, len((c.content or '')[:2000]) // 50)}页",
                            "metadata": {"content_id": c.id, "course_id": c.course_id},
                        })

                videos = VideoLesson.query.filter_by(course_id=course_id).all()
                for v in videos:
                    title_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', v.title).split())
                    desc_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', (v.description or '')).split())
                    title_overlap = len(topic_keywords & title_keywords)
                    content_overlap = len(topic_keywords & desc_keywords)
                    tag_overlap_count = len(topic_related_tag_keywords & (title_keywords | desc_keywords))
                    if title_overlap > 0 or content_overlap > 0 or topic.lower() in v.title.lower():
                        relevance = _compute_weighted_score(
                            title_overlap, content_overlap, tag_overlap_count,
                            getattr(v, 'created_at', None),
                        )
                        resources.append({
                            "type": "video",
                            "title": v.title,
                            "description": v.description or '',
                            "relevance_score": max(relevance, 40.0),
                            "timestamp": f"00:00-{v.duration}" if v.duration else "00:00",
                            "metadata": {
                                "video_id": v.id,
                                "duration": v.duration,
                                "video_url": v.video_url,
                            },
                        })

                assessments = Assessment.query.filter_by(course_id=course_id).all()
                for a in assessments:
                    title_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', a.title).split())
                    questions_text = a.questions or ''
                    q_keywords = set(re.sub(r'[^\w\u4e00-\u9fff]', ' ', questions_text[:500]).split())
                    title_overlap = len(topic_keywords & title_keywords)
                    content_overlap = len(topic_keywords & q_keywords)
                    tag_overlap_count = len(topic_related_tag_keywords & (title_keywords | q_keywords))
                    if title_overlap > 0 or content_overlap > 0 or topic.lower() in a.title.lower():
                        relevance = _compute_weighted_score(
                            title_overlap, content_overlap, tag_overlap_count,
                            getattr(a, 'created_at', None),
                        )
                        resources.append({
                            "type": "practice",
                            "title": a.title,
                            "description": f"练习题，包含{len(_safe_json_loads(questions_text, []))}道题目",
                            "relevance_score": max(relevance, 30.0),
                            "difficulty": "中等",
                            "metadata": {"assessment_id": a.id, "course_id": a.course_id},
                        })

            try:
                mastery_level_desc = user_mastery_context['level']
                weak_points = self._get_weak_knowledge_points(user_id, course_id)
                weak_text = "、".join(weak_points[:5]) if weak_points else topic

                paper_prompt = f"""请根据以下信息推荐1-3篇相关学术论文，严格以JSON格式输出：

主题：{topic}
用户薄弱知识点：{weak_text}
用户掌握度级别：{mastery_level_desc}（low/medium/high）

要求：
- 论文必须与用户的薄弱知识点直接相关
- 如果用户掌握度为low，推荐入门级综述论文；medium推荐进阶研究论文；high推荐前沿研究论文
- 论文标题应真实可信，符合学术命名规范
- 摘要应包含研究问题、方法和主要发现

输出格式：
[
  {{
    "title": "论文标题",
    "abstract": "论文摘要（80字以内，包含研究问题、方法和发现）",
    "relevance_score": 相关度分数(0-100),
    "difficulty": "introductory/intermediate/advanced"
  }}
]
只输出JSON，不要输出其他内容。"""
                paper_raw = spark_service.chat(paper_prompt)
                paper_cleaned = _clean_ai_json(paper_raw)
                paper_list = json.loads(paper_cleaned)
                if isinstance(paper_list, list):
                    for p in paper_list:
                        if isinstance(p, dict) and p.get('title'):
                            resources.append({
                                "type": "paper",
                                "title": p['title'],
                                "description": p.get('abstract', ''),
                                "relevance_score": min(max(p.get('relevance_score', 50), 0), 100),
                                "abstract": p.get('abstract', ''),
                                "difficulty": p.get('difficulty', 'intermediate'),
                                "metadata": {},
                            })
            except Exception as paper_err:
                logger.warning("Paper recommendation generation failed: %s", paper_err)

            mastery_level = user_mastery_context['level']
            for r in resources:
                r_type = r.get('type', '')
                if mastery_level == 'low':
                    if r_type == 'practice':
                        r['relevance_score'] = min(round(r['relevance_score'] * 1.3, 1), 100.0)
                    elif r_type == 'paper':
                        r['relevance_score'] = round(r['relevance_score'] * 0.7, 1)
                elif mastery_level == 'medium':
                    if r_type in ('video', 'textbook'):
                        r['relevance_score'] = min(round(r['relevance_score'] * 1.2, 1), 100.0)
                elif mastery_level == 'high':
                    if r_type == 'paper':
                        r['relevance_score'] = min(round(r['relevance_score'] * 1.3, 1), 100.0)
                    elif r_type == 'practice':
                        r['relevance_score'] = round(r['relevance_score'] * 0.8, 1)

            resources.sort(key=lambda x: x["relevance_score"], reverse=True)
            type_counts = {}
            diverse_resources = []
            for r in resources:
                r_type = r.get('type', 'unknown')
                type_counts[r_type] = type_counts.get(r_type, 0) + 1
                if type_counts[r_type] <= 3:
                    diverse_resources.append(r)

            return diverse_resources[:20]
        except Exception as e:
            logger.error("recommend_resources failed: %s", e, exc_info=True)
            return []

    def suggest_learning_path(
        self,
        user_id: int,
        course_id: int = None,
        custom_goals: List[str] = None,
    ) -> Dict[str, Any]:
        try:
            profile = StudentProfile.query.filter_by(user_id=user_id).first()
            learning_pace = profile.learning_pace if profile else 'moderate'
            cognitive_style = profile.cognitive_style if profile else 'mixed'

            progress_records = LearningProgress.query.filter_by(user_id=user_id)
            if course_id:
                progress_records = progress_records.filter_by(course_id=course_id)
            progress_records = progress_records.all()

            progress_info = ""
            for p in progress_records:
                course = Course.query.get(p.course_id)
                progress_info += f"\n- {course.title if course else '未知课程'}: 进度{p.progress_percentage or 0}%"

            weak_points = self._get_weak_knowledge_points(user_id, course_id)
            weak_text = "、".join(weak_points) if weak_points else "暂无明显薄弱点"

            goals_text = ""
            if custom_goals:
                goals_text = f"\n【学生自定义目标】\n" + "\n".join([f"- {g}" for g in custom_goals])

            prompt = f"""你是一位专业的学习规划师，请根据学生的学习数据生成个性化学习路径。

【学习节奏】{learning_pace}
【认知风格】{cognitive_style}

【当前学习进度】
{progress_info if progress_info else '暂无进度记录'}

【薄弱知识点】
{weak_text}
{goals_text}

请生成3-5步学习路径，严格以JSON格式输出：
{{
  "steps": [
    {{
      "order": 1,
      "title": "步骤标题",
      "description": "步骤详细描述",
      "knowledge_points": ["知识点1", "知识点2"],
      "estimated_time": "预计用时（如：2小时）",
      "priority": "high/medium/low"
    }}
  ]
}}

要求：
1. 步骤按优先级排列，薄弱知识点优先
2. 如有自定义目标，调整步骤优先级以对齐目标
3. 每步给出具体的知识点和预计用时
4. 只输出JSON，不要输出其他内容"""

            raw = spark_service.chat(prompt)
            cleaned = _clean_ai_json(raw)

            try:
                parsed = json.loads(cleaned)
            except (json.JSONDecodeError, TypeError):
                parsed = {
                    "steps": [
                        {
                            "order": 1,
                            "title": "基础巩固",
                            "description": raw[:500],
                            "knowledge_points": weak_points[:3],
                            "estimated_time": "2小时",
                            "priority": "high",
                        }
                    ]
                }

            if "steps" not in parsed:
                parsed = {"steps": []}

            return parsed
        except Exception as e:
            logger.error("suggest_learning_path failed: %s", e, exc_info=True)
            return {"steps": []}

    def _get_weak_knowledge_points(self, user_id: int, course_id: int = None) -> List[str]:
        query = MistakeRecord.query.filter_by(user_id=user_id, mastery_status='unmastered')
        if course_id:
            query = query.filter_by(course_id=course_id)
        mistakes = query.all()

        tag_count = {}
        for m in mistakes:
            tags = _parse_knowledge_tags(m.knowledge_tags)
            if not tags:
                error_type = m.error_type_auto or m.error_type_manual or ''
                tags = [error_type] if error_type else ['未分类']
            for tag in tags:
                tag_count[tag] = tag_count.get(tag, 0) + 1

        sorted_tags = sorted(tag_count.items(), key=lambda x: x[1], reverse=True)
        return [tag for tag, _ in sorted_tags[:10]]

    def get_learning_progress(self, user_id: int) -> Dict[str, Any]:
        try:
            progress_records = LearningProgress.query.filter_by(user_id=user_id).all()

            courses = []
            for p in progress_records:
                course = Course.query.get(p.course_id)
                if not course:
                    continue

                mistakes = MistakeRecord.query.filter_by(
                    user_id=user_id, course_id=p.course_id
                ).all()

                mastery_by_tag = {}
                for m in mistakes:
                    tags = _parse_knowledge_tags(m.knowledge_tags)
                    if not tags:
                        error_type = m.error_type_auto or m.error_type_manual or ''
                        tags = [error_type] if error_type else ['未分类']
                    for tag in tags:
                        if tag not in mastery_by_tag:
                            mastery_by_tag[tag] = {"total": 0, "mastered": 0}
                        mastery_by_tag[tag]["total"] += 1
                        if m.mastery_status == 'mastered':
                            mastery_by_tag[tag]["mastered"] += 1

                tag_mastery = {}
                for tag, data in mastery_by_tag.items():
                    tag_mastery[tag] = round(data["mastered"] / data["total"] * 100, 1) if data["total"] > 0 else 0

                courses.append({
                    "title": course.title,
                    "progress": p.progress_percentage or 0,
                    "mastery_by_tag": tag_mastery,
                })

            recent_mistakes = MistakeRecord.query.filter_by(user_id=user_id).order_by(
                desc(MistakeRecord.created_at)
            ).limit(5).all()

            recent_submissions = ProgrammingSubmission.query.filter_by(user_id=user_id).order_by(
                desc(ProgrammingSubmission.created_at)
            ).limit(5).all()

            recent_activities = []
            for m in recent_mistakes:
                recent_activities.append({
                    "type": "mistake",
                    "content": m.question_content[:100],
                    "course_id": m.course_id,
                    "created_at": m.created_at.isoformat() if m.created_at else None,
                })
            for s in recent_submissions:
                recent_activities.append({
                    "type": "submission",
                    "content": f"编程提交 - {s.language} - 得分{s.score or 0}",
                    "course_id": s.course_id,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                })

            recent_activities.sort(key=lambda x: x.get("created_at") or "", reverse=True)

            weak_points = self._get_weak_knowledge_points(user_id)
            pending_recommendations = []
            for wp in weak_points[:5]:
                pending_recommendations.append({
                    "knowledge_point": wp,
                    "recommendation": f"建议复习「{wp}」相关内容",
                })

            return {
                "courses": courses,
                "recent_activities": recent_activities[:10],
                "pending_recommendations": pending_recommendations,
            }
        except Exception as e:
            logger.error("get_learning_progress failed: %s", e, exc_info=True)
            return {
                "courses": [],
                "recent_activities": [],
                "pending_recommendations": [],
            }

    def diagnose_knowledge_mastery(
        self,
        user_id: int,
        course_id: int = None,
    ) -> Dict[str, Any]:
        try:
            mistake_query = MistakeRecord.query.filter_by(user_id=user_id)
            if course_id:
                mistake_query = mistake_query.filter_by(course_id=course_id)
            mistakes = mistake_query.all()

            tag_stats = {}
            for m in mistakes:
                tags = _parse_knowledge_tags(m.knowledge_tags)
                if not tags:
                    error_type = m.error_type_auto or m.error_type_manual or ''
                    tags = [error_type] if error_type else ['未分类']
                for tag in tags:
                    if tag not in tag_stats:
                        tag_stats[tag] = {
                            "total": 0,
                            "mastered": 0,
                            "reviewing": 0,
                            "unmastered": 0,
                            "error_types": [],
                        }
                    tag_stats[tag]["total"] += 1
                    status = m.mastery_status or 'unmastered'
                    if status in tag_stats[tag]:
                        tag_stats[tag][status] += 1
                    error_type = m.error_type_auto or m.error_type_manual
                    if error_type:
                        tag_stats[tag]["error_types"].append(error_type)

            submission_query = ProgrammingSubmission.query.filter_by(user_id=user_id)
            if course_id:
                submission_query = submission_query.filter_by(course_id=course_id)
            submissions = submission_query.all()

            submission_by_course = {}
            for s in submissions:
                cid = s.course_id
                if cid not in submission_by_course:
                    submission_by_course[cid] = {"total": 0, "scores": []}
                submission_by_course[cid]["total"] += 1
                submission_by_course[cid]["scores"].append(s.score or 0)

            knowledge_points = []
            weak_points = []
            radar_data = []

            for tag, stats in tag_stats.items():
                total = stats["total"]
                if total == 0:
                    continue

                mastery = round(
                    (stats["mastered"] * 100 + stats["reviewing"] * 50) / total, 1
                )
                mastery = min(mastery, 100.0)

                bloom_levels = self._assess_bloom_levels(stats["error_types"])

                kp = {
                    "name": tag,
                    "mastery": mastery,
                    "bloom_levels": bloom_levels,
                }
                knowledge_points.append(kp)

                if mastery < 60:
                    weak_points.append(kp)

                radar_data.append({"axis": tag, "value": mastery})

            for cid, sdata in submission_by_course.items():
                course = Course.query.get(cid)
                avg_score = round(sum(sdata["scores"]) / len(sdata["scores"]), 1) if sdata["scores"] else 0
                tag_name = f"编程实践-{course.title if course else cid}"
                mastery = min(round(avg_score, 1), 100.0)
                kp = {
                    "name": tag_name,
                    "mastery": mastery,
                    "bloom_levels": {
                        "remember": 80 if avg_score >= 60 else 40,
                        "understand": 70 if avg_score >= 60 else 35,
                        "apply": round(avg_score),
                        "analyze": round(avg_score * 0.8),
                        "evaluate": round(avg_score * 0.6),
                        "create": round(avg_score * 0.4),
                    },
                }
                knowledge_points.append(kp)
                if mastery < 60:
                    weak_points.append(kp)
                radar_data.append({"axis": tag_name, "value": mastery})

            knowledge_points.sort(key=lambda x: x["mastery"])
            weak_points.sort(key=lambda x: x["mastery"])

            practice_query = PracticeEvaluation.query.filter_by(user_id=user_id)
            if course_id:
                assessment_ids = [a.id for a in Assessment.query.filter_by(course_id=course_id).all()]
                if assessment_ids:
                    practice_query = practice_query.filter(PracticeEvaluation.assessment_id.in_(assessment_ids))
            practice_count = practice_query.count()

            standard_dimensions = self._compute_standard_dimensions(tag_stats)

            course_outline_points = []
            course_outline_dimensions = []
            if course_id:
                course_obj = Course.query.get(course_id)
                if course_obj:
                    course_outline_points, course_outline_dimensions = self._supplement_from_course_outline(
                        course_obj, tag_stats, knowledge_points, standard_dimensions
                    )

            return {
                "knowledge_points": knowledge_points,
                "weak_points": weak_points,
                "radar_data": radar_data,
                "practice_count": practice_count,
                "standard_dimensions": standard_dimensions,
                "course_outline_points": course_outline_points,
                "course_outline_dimensions": course_outline_dimensions,
            }
        except Exception as e:
            logger.error("diagnose_knowledge_mastery failed: %s", e, exc_info=True)
            return {
                "knowledge_points": [],
                "weak_points": [],
                "radar_data": [],
                "practice_count": 0,
                "standard_dimensions": [],
            }

    def _assess_bloom_levels(self, error_types: List[str]) -> Dict[str, int]:
        bloom = {
            "remember": 80,
            "understand": 70,
            "apply": 60,
            "analyze": 50,
            "evaluate": 40,
            "create": 30,
        }

        if not error_types:
            return bloom

        type_lower = [t.lower() for t in error_types]

        concept_errors = sum(1 for t in type_lower if any(kw in t for kw in ['概念', '理解', '定义', 'concept']))
        calc_errors = sum(1 for t in type_lower if any(kw in t for kw in ['计算', '运算', 'calculation', 'compute']))
        apply_errors = sum(1 for t in type_lower if any(kw in t for kw in ['应用', '运用', 'apply', 'application']))
        logic_errors = sum(1 for t in type_lower if any(kw in t for kw in ['逻辑', '推理', 'logic', 'reasoning']))

        total_errors = len(error_types)

        if concept_errors > 0:
            bloom["remember"] = max(20, 80 - concept_errors * 15)
            bloom["understand"] = max(20, 70 - concept_errors * 12)
        if calc_errors > 0:
            bloom["apply"] = max(20, 60 - calc_errors * 12)
        if apply_errors > 0:
            bloom["apply"] = max(20, bloom["apply"] - apply_errors * 10)
            bloom["analyze"] = max(20, 50 - apply_errors * 10)
        if logic_errors > 0:
            bloom["analyze"] = max(20, 50 - logic_errors * 12)
            bloom["evaluate"] = max(20, 40 - logic_errors * 8)
            bloom["create"] = max(20, 30 - logic_errors * 6)

        return bloom

    def _assess_bloom_levels_consistent(self, mastery: float, total_mistakes: int = 0) -> Dict[str, int]:
        base = max(20, min(95, int(mastery)))
        bloom = {
            "remember": min(100, base + 15),
            "understand": min(100, base + 8),
            "apply": base,
            "analyze": max(20, base - 10),
            "evaluate": max(20, base - 20),
            "create": max(20, base - 30),
        }
        if total_mistakes > 5:
            for key in bloom:
                bloom[key] = max(20, bloom[key] - 5)
        return bloom

    def _map_tag_to_dimension(self, tag: str) -> str:
        tag_lower = tag.lower()
        for dimension, keywords in self._STANDARD_DIMENSION_KEYWORDS.items():
            for kw in keywords:
                if kw.lower() in tag_lower:
                    return dimension
        return '核心概念'

    def _compute_standard_dimensions(self, tag_stats: Dict) -> List[Dict]:
        dimension_data = {
            dim: {"total": 0, "mastered": 0, "reviewing": 0, "unmastered": 0, "tags": []}
            for dim in self.STANDARD_DIMENSIONS
        }
        for tag, stats in tag_stats.items():
            dim = self._map_tag_to_dimension(tag)
            dimension_data[dim]["total"] += stats["total"]
            dimension_data[dim]["mastered"] += stats["mastered"]
            dimension_data[dim]["reviewing"] += stats["reviewing"]
            dimension_data[dim]["unmastered"] += stats["unmastered"]
            dimension_data[dim]["tags"].append(tag)
        result = []
        for dim in self.STANDARD_DIMENSIONS:
            data = dimension_data[dim]
            total = data["total"]
            if total > 0:
                mastery = round((data["mastered"] * 100 + data["reviewing"] * 50) / total, 1)
                mastery = min(mastery, 100.0)
            else:
                mastery = 0.0
            result.append({
                "dimension": dim,
                "mastery": mastery,
                "total_mistakes": total,
                "mastered": data["mastered"],
                "reviewing": data["reviewing"],
                "unmastered": data["unmastered"],
                "tags": data["tags"],
                "bloom_levels": self._assess_bloom_levels_consistent(mastery, total),
            })
        return result

    def _supplement_from_course_outline(self, course, tag_stats, existing_kps, existing_dims):
        existing_names = {kp['name'] for kp in existing_kps}
        existing_dim_tags = set()
        for d in existing_dims:
            existing_dim_tags.update(d.get('tags', []))

        outline_points = []
        outline_dimensions = []

        course_title = (course.title or '').lower()
        course_desc = (course.description or '').lower()
        course_chapters = []
        contents = TeachingContent.query.filter_by(course_id=course.id).order_by(TeachingContent.id).all()
        for tc in contents:
            if tc.title:
                course_chapters.append(tc.title)

        language_keywords = {
            'python': ['变量与数据类型', '条件判断', '循环结构', '函数定义', '列表与元组', '字典与集合', '字符串处理', '文件操作', '异常处理', '面向对象', '模块与包', '列表推导式', '迭代器与生成器', '装饰器', '正则表达式'],
            'java': ['变量与数据类型', '条件判断', '循环结构', '方法定义', '数组', '字符串处理', '面向对象', '封装继承多态', '抽象类与接口', '异常处理', '集合框架', '泛型', 'IO流', '多线程', 'Lambda表达式'],
            'c': ['变量与数据类型', '条件判断', '循环结构', '函数定义', '数组', '指针', '字符串处理', '结构体', '内存管理', '文件操作', '预处理', '位运算'],
            'c++': ['变量与数据类型', '条件判断', '循环结构', '函数定义', '数组', '指针', '引用', '面向对象', 'STL容器', '模板', '异常处理', '文件操作', '智能指针', 'Lambda表达式'],
        }

        matched_lang = None
        for lang in language_keywords:
            if lang in course_title or lang in course_desc:
                matched_lang = lang
                break

        default_points = ['变量与数据类型', '条件判断', '循环结构', '函数/方法', '面向对象', '数据结构', '算法基础', '异常处理', '文件操作', '调试技巧']
        base_points = language_keywords.get(matched_lang, default_points)

        if course_chapters:
            for ch in course_chapters:
                ch_stripped = ch.strip()
                if ch_stripped and ch_stripped not in existing_names:
                    base_points.append(ch_stripped)

        for point in base_points:
            if point not in existing_names:
                existing_names.add(point)
                if point in tag_stats:
                    stats = tag_stats[point]
                    total = stats['total']
                    mastery = round((stats['mastered'] * 100 + stats['reviewing'] * 50) / total, 1) if total > 0 else 0
                else:
                    mastery = 50.0
                outline_points.append({
                    "name": point,
                    "mastery": mastery,
                    "bloom_levels": self._assess_bloom_levels_consistent(mastery),
                    "from_outline": True,
                })

        dim_tags_set = set()
        for d in existing_dims:
            dim_tags_set.update(d.get('tags', []))

        for point in base_points:
            if point not in dim_tags_set:
                dim = self._map_tag_to_dimension(point)
                outline_dimensions.append({
                    "dimension": dim,
                    "tag": point,
                    "from_outline": True,
                })
                dim_tags_set.add(point)

        return outline_points, outline_dimensions

    def _map_to_standard_category(self, topic: str) -> str:
        topic_lower = topic.lower()
        for cat_key, cat_info in self.STANDARD_CATEGORIES.items():
            for kw in cat_info['keywords']:
                if kw.lower() in topic_lower:
                    return cat_key
        return 'basics'

    def generate_diagnosis_report_stream(
        self,
        user_id: int,
        course_id: int = None,
    ) -> Generator[str, None, None]:
        try:
            diagnosis = self.diagnose_knowledge_mastery(user_id, course_id)

            peer_comparison = self._get_peer_comparison(user_id, course_id)

            weak_summary = "\n".join([
                f"- {wp['name']}：掌握度{wp['mastery']}%，布鲁姆层级：{json.dumps(wp.get('bloom_levels', {}), ensure_ascii=False)}"
                for wp in diagnosis.get("weak_points", [])[:10]
            ])

            all_kp_summary = "\n".join([
                f"- {kp['name']}：掌握度{kp['mastery']}%"
                for kp in diagnosis.get("knowledge_points", [])[:15]
            ])

            outline_points = diagnosis.get("course_outline_points", [])
            outline_summary = ""
            if outline_points:
                outline_summary = "\n【课程大纲补充知识点（学生尚无错题记录的知识点）】\n" + "\n".join([
                    f"- {op['name']}：预估掌握度{op['mastery']}%（基于课程大纲推断）"
                    for op in outline_points
                ])

            outline_dims = diagnosis.get("course_outline_dimensions", [])
            outline_dims_summary = ""
            if outline_dims:
                dim_groups = {}
                for od in outline_dims:
                    dim = od['dimension']
                    if dim not in dim_groups:
                        dim_groups[dim] = []
                    dim_groups[dim].append(od['tag'])
                outline_dims_summary = "\n【课程大纲补充维度知识点】\n" + "\n".join([
                    f"- {dim}：{', '.join(tags)}"
                    for dim, tags in dim_groups.items()
                ])

            peer_text = ""
            if peer_comparison:
                peer_text = f"\n【同班平均掌握度】{peer_comparison.get('avg_mastery', 'N/A')}%\n"
                peer_text += f"【超过同学比例】{peer_comparison.get('percentile', 'N/A')}%\n"
                peer_details = peer_comparison.get("tag_comparison", {})
                if peer_details:
                    peer_text += "【各知识点与同学对比】\n"
                    for tag, data in list(peer_details.items())[:10]:
                        peer_text += f"  - {tag}：我{data.get('self', 'N/A')}% / 平均{data.get('peer_avg', 'N/A')}%\n"

            radar_text = json.dumps(diagnosis.get("radar_data", []), ensure_ascii=False)

            standard_dims = diagnosis.get("standard_dimensions", [])
            standard_dims_summary = "\n".join([
                f"- {d['dimension']}：掌握度{d['mastery']}%，布鲁姆层级：{json.dumps(d.get('bloom_levels', {}), ensure_ascii=False)}"
                for d in standard_dims
            ]) if standard_dims else "暂无数据"

            prompt = f"""你是一位资深教育诊断专家，请根据学生的知识掌握数据生成详细的诊断报告。

**重要：无论课程是Python、Java、C++还是其他编程语言，都必须按照统一的分析框架进行评估，确保不同课程的诊断结果具有可比性。**
**重要：即使某课程的学生错题数据较少，也必须基于课程大纲补充知识点，对每个标准化维度进行完整分析，不可因数据少而省略任何维度或简化分析。**

【学生所有知识点掌握情况】
{all_kp_summary if all_kp_summary else '暂无数据'}
{outline_summary}
{outline_dims_summary}

【标准化维度分析】
{standard_dims_summary}

【薄弱知识点详情】
{weak_summary if weak_summary else '暂无明显薄弱点'}
{peer_text}
【雷达图数据】
{radar_text}

请生成完整的诊断报告，严格按照以下统一结构：

## 一、总体评估
- 整体掌握度概述（基于标准化维度的综合评价）
- 学习状态判断

## 二、各维度分析
- 对每个标准化维度（语法基础、核心概念、编程范式、调试能力、项目实践）进行逐一分析
- 每个维度需包含：当前掌握水平、布鲁姆认知层级评估、具体表现
- 各维度分析深度必须一致，不可因课程类型不同而厚此薄彼
- 对于尚无错题记录的知识点，基于课程大纲内容进行合理推断分析

## 三、薄弱环节
- 识别掌握度最低的维度和知识点
- 错误模式分析与根因推测

## 四、改进建议
- 针对每个薄弱维度的具体改进方案
- 学习方法建议

## 五、练习方案
- 推荐的练习内容和顺序
- 预计提升目标与时间规划

## 六、热力图数据
- 以JSON格式输出各知识点掌握度热力图数据，格式为：{{"heatmap": [{{"name": "知识点", "value": 掌握度}}]}}"""

            for chunk in spark_service.chat_stream(prompt):
                yield chunk
        except Exception as e:
            logger.error("generate_diagnosis_report_stream failed: %s", e, exc_info=True)
            raise

    def _get_peer_comparison(self, user_id: int, course_id: int = None) -> Dict[str, Any]:
        try:
            if not course_id:
                progress_records = LearningProgress.query.filter_by(user_id=user_id).all()
                if not progress_records:
                    return {}
                course_id = progress_records[0].course_id

            all_mistakes = MistakeRecord.query.filter_by(course_id=course_id).all()

            other_students = {}
            my_tags = {}

            for m in all_mistakes:
                tags = _parse_knowledge_tags(m.knowledge_tags)
                if not tags:
                    error_type = m.error_type_auto or m.error_type_manual or ''
                    tags = [error_type] if error_type else ['未分类']
                for tag in tags:
                    if m.user_id == user_id:
                        if tag not in my_tags:
                            my_tags[tag] = {"total": 0, "mastered": 0}
                        my_tags[tag]["total"] += 1
                        if m.mastery_status == 'mastered':
                            my_tags[tag]["mastered"] += 1
                    else:
                        if m.user_id not in other_students:
                            other_students[m.user_id] = {}
                        if tag not in other_students[m.user_id]:
                            other_students[m.user_id][tag] = {"total": 0, "mastered": 0}
                        other_students[m.user_id][tag]["total"] += 1
                        if m.mastery_status == 'mastered':
                            other_students[m.user_id][tag]["mastered"] += 1

            if not other_students:
                return {}

            my_avg = 0
            if my_tags:
                my_masteries = [
                    (d["mastered"] / d["total"] * 100) if d["total"] > 0 else 0
                    for d in my_tags.values()
                ]
                my_avg = round(sum(my_masteries) / len(my_masteries), 1)

            peer_masteries = []
            for uid, tags in other_students.items():
                if tags:
                    masteries = [
                        (d["mastered"] / d["total"] * 100) if d["total"] > 0 else 0
                        for d in tags.values()
                    ]
                    peer_masteries.append(sum(masteries) / len(masteries))

            peer_avg = round(sum(peer_masteries) / len(peer_masteries), 1) if peer_masteries else 0

            percentile = 0
            if peer_masteries:
                below = sum(1 for pm in peer_masteries if pm < my_avg)
                percentile = round(below / len(peer_masteries) * 100, 1)

            all_tags = set(list(my_tags.keys()))
            for uid, tags in other_students.items():
                all_tags.update(tags.keys())
            tag_comparison = {}
            for tag in all_tags:
                my_mastery = 0
                if tag in my_tags and my_tags[tag]["total"] > 0:
                    my_mastery = round(my_tags[tag]["mastered"] / my_tags[tag]["total"] * 100, 1)

                peer_tag_scores = []
                for uid, tags in other_students.items():
                    if tag in tags and tags[tag]["total"] > 0:
                        peer_tag_scores.append(tags[tag]["mastered"] / tags[tag]["total"] * 100)

                peer_tag_avg = round(sum(peer_tag_scores) / len(peer_tag_scores), 1) if peer_tag_scores else 0

                tag_comparison[tag] = {
                    "self": my_mastery,
                    "peer_avg": peer_tag_avg,
                }

            return {
                "avg_mastery": my_avg,
                "peer_avg_mastery": peer_avg,
                "percentile": percentile,
                "tag_comparison": tag_comparison,
            }
        except Exception as e:
            logger.error("_get_peer_comparison failed: %s", e, exc_info=True)
            return {}

    def get_diagnosis_comparison(
        self,
        user_id: int,
        course_id: int = None,
    ) -> Dict[str, Any]:
        try:
            current = self.diagnose_knowledge_mastery(user_id, course_id)

            previous = self._get_previous_diagnosis(user_id, course_id)

            deltas = []
            current_map = {kp["name"]: kp for kp in current.get("knowledge_points", [])}
            previous_map = {kp["name"]: kp for kp in previous.get("knowledge_points", [])}

            all_tags = set(list(current_map.keys()) + list(previous_map.keys()))
            for tag in all_tags:
                curr_mastery = current_map.get(tag, {}).get("mastery", 0)
                prev_mastery = previous_map.get(tag, {}).get("mastery", 0)
                delta = round(curr_mastery - prev_mastery, 1)
                deltas.append({
                    "name": tag,
                    "current": curr_mastery,
                    "previous": prev_mastery,
                    "delta": delta,
                })

            deltas.sort(key=lambda x: x["delta"])

            strategy_adjustments = []
            for d in deltas:
                if d["delta"] < -10:
                    strategy_adjustments.append({
                        "knowledge_point": d["name"],
                        "adjustment": f"「{d['name']}」掌握度下降{abs(d['delta'])}%，需要加强复习",
                        "priority": "high",
                    })
                elif d["delta"] < 0:
                    strategy_adjustments.append({
                        "knowledge_point": d["name"],
                        "adjustment": f"「{d['name']}」掌握度略有下降，建议巩固",
                        "priority": "medium",
                    })
                elif d["delta"] >= 20:
                    strategy_adjustments.append({
                        "knowledge_point": d["name"],
                        "adjustment": f"「{d['name']}」掌握度提升{d['delta']}%，可进入更高层次学习",
                        "priority": "low",
                    })

            return {
                "current": current,
                "previous": previous,
                "deltas": deltas,
                "strategy_adjustments": strategy_adjustments,
            }
        except Exception as e:
            logger.error("get_diagnosis_comparison failed: %s", e, exc_info=True)
            return {
                "current": {"knowledge_points": [], "weak_points": [], "radar_data": []},
                "previous": {"knowledge_points": [], "weak_points": [], "radar_data": []},
                "deltas": [],
                "strategy_adjustments": [],
            }

    def _get_previous_diagnosis(self, user_id: int, course_id: int = None) -> Dict[str, Any]:
        try:
            mistake_query = MistakeRecord.query.filter_by(user_id=user_id)
            if course_id:
                mistake_query = mistake_query.filter_by(course_id=course_id)

            cutoff = datetime.utcnow()
            previous_mistakes = mistake_query.filter(
                MistakeRecord.updated_at < cutoff
            ).order_by(desc(MistakeRecord.updated_at)).limit(100).all()

            if not previous_mistakes:
                return {"knowledge_points": [], "weak_points": [], "radar_data": []}

            tag_stats = {}
            for m in previous_mistakes:
                tags = _parse_knowledge_tags(m.knowledge_tags)
                if not tags:
                    error_type = m.error_type_auto or m.error_type_manual or ''
                    tags = [error_type] if error_type else ['未分类']
                for tag in tags:
                    if tag not in tag_stats:
                        tag_stats[tag] = {"total": 0, "mastered": 0, "reviewing": 0, "unmastered": 0}
                    tag_stats[tag]["total"] += 1
                    status = m.mastery_status or 'unmastered'
                    if status in tag_stats[tag]:
                        tag_stats[tag][status] += 1

            knowledge_points = []
            weak_points = []
            radar_data = []

            for tag, stats in tag_stats.items():
                total = stats["total"]
                if total == 0:
                    continue
                mastery = round((stats["mastered"] * 100 + stats["reviewing"] * 50) / total, 1)
                mastery = min(mastery, 100.0)
                kp = {"name": tag, "mastery": mastery, "bloom_levels": {}}
                knowledge_points.append(kp)
                if mastery < 60:
                    weak_points.append(kp)
                radar_data.append({"axis": tag, "value": mastery})

            return {
                "knowledge_points": knowledge_points,
                "weak_points": weak_points,
                "radar_data": radar_data,
            }
        except Exception as e:
            logger.error("_get_previous_diagnosis failed: %s", e, exc_info=True)
            return {"knowledge_points": [], "weak_points": [], "radar_data": []}

    def submit_feedback(
        self,
        user_id: int,
        interaction_id: str,
        rating: int,
        comment: str = None,
    ) -> Dict[str, Any]:
        try:
            feedback_record = {
                "user_id": user_id,
                "interaction_id": interaction_id,
                "rating": rating,
                "comment": comment,
                "created_at": datetime.utcnow().isoformat(),
            }

            try:
                from src.models.course import AIFeedback
                new_feedback = AIFeedback(
                    config_id=0,
                    original_content=interaction_id,
                    modified_content=json.dumps(feedback_record, ensure_ascii=False),
                    modification_type="tutor_feedback",
                    feedback_text=comment or f"评分：{rating}",
                )
                db.session.add(new_feedback)
                db.session.commit()
                logger.info("Feedback saved to AIFeedback: user=%s, interaction=%s, rating=%s", user_id, interaction_id, rating)
            except Exception as db_err:
                logger.warning("Failed to save feedback to DB, logged only: %s", db_err)
                logger.info("Feedback record: %s", json.dumps(feedback_record, ensure_ascii=False))

            return {"status": "ok"}
        except Exception as e:
            logger.error("submit_feedback failed: %s", e, exc_info=True)
            return {"status": "ok"}

    def export_diagnosis_report_pdf(
        self,
        user_id: int,
        course_id: int = None,
        report_content: str = None,
    ) -> bytes:
        from fpdf import FPDF
        from src.services.export_service import _get_cached_font_name, SIMHEI_PATH, MSYH_PATH

        diagnosis = self.diagnose_knowledge_mastery(user_id, course_id)

        course_name = "全部课程"
        if course_id:
            course = Course.query.get(course_id)
            if course:
                course_name = course.title or "未知课程"

        user = None
        from src.models.user import User
        user = User.query.get(user_id)
        user_name = (user.real_name or user.username) if user else "未知"

        font_name = _get_cached_font_name()

        pdf = FPDF(orientation="P", unit="mm", format="A4")
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.set_margins(15, 20, 15)

        try:
            if font_name == "SimHei" and SIMHEI_PATH.exists():
                pdf.add_font("SimHei", fname=str(SIMHEI_PATH))
                pdf.add_font("SimHei", style="B", fname=str(SIMHEI_PATH))
            elif font_name == "MSYH" and MSYH_PATH.exists():
                pdf.add_font("MSYH", fname=str(MSYH_PATH))
                pdf.add_font("MSYH", style="B", fname=str(MSYH_PATH))
        except Exception as e:
            logger.warning(f"Font registration warning: {e}")

        fn = font_name

        pdf.add_page()

        pdf.set_font(fn, "B", 22)
        pdf.set_text_color(51, 51, 51)
        pdf.ln(20)
        pdf.cell(0, 15, "学习诊断报告", align="C", new_x="LMARGIN", new_y="NEXT")

        pdf.set_font(fn, "", 11)
        pdf.set_text_color(128, 128, 128)
        pdf.cell(0, 8, f"学生：{user_name}", align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 8, f"课程：{course_name}", align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 8, f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}", align="C", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(10)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(8)

        knowledge_points = diagnosis.get("knowledge_points", [])
        outline_points = diagnosis.get("course_outline_points", [])
        all_points = knowledge_points + outline_points
        weak_points = diagnosis.get("weak_points", [])
        standard_dimensions = diagnosis.get("standard_dimensions", [])

        pdf.set_font(fn, "B", 14)
        pdf.set_text_color(51, 51, 51)
        pdf.cell(0, 10, "一、知识点掌握度概览", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        if all_points:
            pdf.set_font(fn, "", 9)
            pdf.set_fill_color(240, 240, 240)
            pdf.cell(80, 7, "知识点", border=1, fill=True)
            pdf.cell(30, 7, "掌握度", border=1, fill=True, align="C")
            pdf.cell(30, 7, "状态", border=1, fill=True, align="C")
            pdf.cell(40, 7, "来源", border=1, fill=True, align="C")
            pdf.ln()

            for kp in all_points[:30]:
                name = kp.get("name", "未知")[:20]
                mastery = kp.get("mastery", 0)
                if mastery >= 80:
                    status = "已掌握"
                    pdf.set_text_color(22, 101, 52)
                elif mastery >= 60:
                    status = "复习中"
                    pdf.set_text_color(200, 150, 0)
                else:
                    status = "未掌握"
                    pdf.set_text_color(220, 50, 50)

                source = "课程大纲" if kp.get("from_outline") else "错题记录"

                pdf.set_font(fn, "", 8)
                pdf.set_text_color(0, 0, 0)
                pdf.cell(80, 6, name, border=1)
                pdf.cell(30, 6, f"{mastery}%", border=1, align="C")

                if mastery >= 80:
                    pdf.set_text_color(22, 101, 52)
                elif mastery >= 60:
                    pdf.set_text_color(200, 150, 0)
                else:
                    pdf.set_text_color(220, 50, 50)
                pdf.cell(30, 6, status, border=1, align="C")

                pdf.set_text_color(128, 128, 128)
                pdf.cell(40, 6, source, border=1, align="C")
                pdf.ln()
        else:
            pdf.set_font(fn, "", 10)
            pdf.set_text_color(128, 128, 128)
            pdf.cell(0, 8, "暂无知识点数据", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(8)

        pdf.set_font(fn, "B", 14)
        pdf.set_text_color(51, 51, 51)
        pdf.cell(0, 10, "二、标准化维度分析", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        if standard_dimensions:
            pdf.set_font(fn, "", 9)
            pdf.set_fill_color(240, 240, 240)
            pdf.cell(40, 7, "维度", border=1, fill=True)
            pdf.cell(25, 7, "掌握度", border=1, fill=True, align="C")
            pdf.cell(25, 7, "错题数", border=1, fill=True, align="C")
            pdf.cell(90, 7, "关联知识点", border=1, fill=True)
            pdf.ln()

            for dim in standard_dimensions:
                pdf.set_font(fn, "", 8)
                pdf.set_text_color(0, 0, 0)
                pdf.cell(40, 6, dim.get("dimension", ""), border=1)
                pdf.cell(25, 6, f"{dim.get('mastery', 0)}%", border=1, align="C")
                pdf.cell(25, 6, str(dim.get("total_mistakes", 0)), border=1, align="C")
                tags_str = ", ".join(dim.get("tags", [])[:5])
                pdf.cell(90, 6, tags_str[:30], border=1)
                pdf.ln()
        else:
            pdf.set_font(fn, "", 10)
            pdf.set_text_color(128, 128, 128)
            pdf.cell(0, 8, "暂无维度数据", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(8)

        pdf.set_font(fn, "B", 14)
        pdf.set_text_color(51, 51, 51)
        pdf.cell(0, 10, "三、薄弱环节", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

        if weak_points:
            for i, wp in enumerate(weak_points[:10], 1):
                pdf.set_font(fn, "B", 10)
                pdf.set_text_color(220, 50, 50)
                pdf.cell(0, 7, f"{i}. {wp.get('name', '未知')}（掌握度：{wp.get('mastery', 0)}%）", new_x="LMARGIN", new_y="NEXT")

                bloom = wp.get("bloom_levels", {})
                if bloom:
                    pdf.set_font(fn, "", 8)
                    pdf.set_text_color(128, 128, 128)
                    bloom_str = "  布鲁姆层级："
                    bloom_labels = {"remember": "记忆", "understand": "理解", "apply": "应用", "analyze": "分析", "evaluate": "评价", "create": "创造"}
                    for bk, bl in bloom_labels.items():
                        bloom_str += f"{bl}:{bloom.get(bk, 0)}% "
                    pdf.cell(0, 5, bloom_str, new_x="LMARGIN", new_y="NEXT")
        else:
            pdf.set_font(fn, "", 10)
            pdf.set_text_color(22, 101, 52)
            pdf.cell(0, 8, "暂无明显薄弱点，继续保持！", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(8)

        if report_content:
            pdf.set_font(fn, "B", 14)
            pdf.set_text_color(51, 51, 51)
            pdf.cell(0, 10, "四、AI诊断报告", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(3)

            pdf.set_font(fn, "", 9)
            pdf.set_text_color(51, 51, 51)

            lines = report_content.split('\n')
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    pdf.ln(3)
                    continue

                if stripped.startswith('##') or stripped.startswith('#'):
                    pdf.ln(3)
                    pdf.set_font(fn, "B", 11)
                    heading = stripped.lstrip('#').strip()
                    pdf.cell(0, 7, heading, new_x="LMARGIN", new_y="NEXT")
                    pdf.set_font(fn, "", 9)
                elif stripped.startswith('-') or stripped.startswith('*'):
                    pdf.set_font(fn, "", 9)
                    content = stripped.lstrip('-*').strip()
                    pdf.cell(5, 5, "")
                    pdf.cell(0, 5, f"• {content}", new_x="LMARGIN", new_y="NEXT")
                else:
                    pdf.set_font(fn, "", 9)
                    pdf.multi_cell(0, 5, stripped)

        result = pdf.output()
        logger.info(f"Diagnosis PDF export: user={user_id}, course={course_name}, {len(result)//1024}KB")
        return bytes(result)


ai_tutor_service = AITutorService()
