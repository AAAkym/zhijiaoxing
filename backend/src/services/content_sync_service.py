import json
import logging
import os
import threading
import time
import uuid
from datetime import datetime

from src.models.user import db
from src.models.course import Course, TeachingContent
from src.models.content_sync_record import ContentSyncRecord
from src.models.knowledge_base import CourseChapter, KnowledgePoint, TeachingCase, CourseExercise

logger = logging.getLogger(__name__)

SYNC_STATUS_PENDING = "pending"
SYNC_STATUS_SAVING = "saving"
SYNC_STATUS_SAVED = "saved"
SYNC_STATUS_SYNCING = "syncing"
SYNC_STATUS_SYNCED = "synced"
SYNC_STATUS_FAILED = "failed"
SYNC_STATUS_RETRYING = "retrying"

EXPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "tmp_exports", "content_saves")


class ContentSyncService:

    def save_and_sync(self, course_id, teacher_id, content_type, content_data,
                      topic="", save_format="json", package_id=None, video_id=None):
        if not package_id:
            package_id = f"pkg_{uuid.uuid4().hex[:12]}"

        record = ContentSyncRecord(
            package_id=package_id,
            course_id=course_id,
            teacher_id=teacher_id,
            topic=topic,
            content_type=content_type,
            save_format=save_format,
            sync_status=SYNC_STATUS_SAVING,
            sync_progress=10,
        )
        db.session.add(record)
        db.session.commit()

        try:
            self._save_content(record, content_data, save_format, video_id)
            record.sync_status = SYNC_STATUS_SAVED
            record.sync_progress = 50
            db.session.commit()

            threading.Thread(
                target=self._async_sync_to_students,
                args=(record.id,),
                daemon=True,
            ).start()

            return record.to_dict()
        except Exception as e:
            logger.error(f"Save and sync failed for record {record.id}: {e}")
            record.sync_status = SYNC_STATUS_FAILED
            record.sync_error = str(e)
            record.sync_progress = record.sync_progress or 0
            db.session.commit()
            return record.to_dict()

    def _save_content(self, record, content_data, save_format, video_id=None):
        json_str = self._serialize_content(content_data)
        record.json_content = json_str

        markdown_str = self._generate_markdown(record.content_type, content_data, record.topic)
        record.markdown_content = markdown_str

        snapshot = json_str[:50000] if json_str else ""
        record.content_snapshot = snapshot

        os.makedirs(EXPORT_DIR, exist_ok=True)
        self._export_to_file(record.package_id, record.content_type, json_str, markdown_str, save_format)

        kb_record = self._save_to_knowledge_base(
            record.course_id, record.content_type, content_data, record.topic
        )
        if kb_record:
            record.teaching_content_id = getattr(kb_record, 'id', None)

        record.save_format = save_format
        db.session.commit()

    def _serialize_content(self, content_data):
        if isinstance(content_data, str):
            return content_data
        return json.dumps(content_data, ensure_ascii=False, indent=2)

    def _generate_markdown(self, content_type, content_data, topic):
        data = content_data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                return f"# {topic}\n\n{data}"

        if not isinstance(data, dict):
            return f"# {topic}\n\n{json.dumps(data, ensure_ascii=False, indent=2)}"

        if content_type == "document":
            return self._document_to_markdown(data, topic)
        elif content_type == "mindmap":
            return self._mindmap_to_markdown(data, topic)
        elif content_type == "project":
            return self._project_to_markdown(data, topic)
        elif content_type == "media":
            return self._media_to_markdown(data, topic)
        else:
            return f"# {topic}\n\n{json.dumps(data, ensure_ascii=False, indent=2)}"

    def _document_to_markdown(self, data, topic):
        doc = data.get("document", data)
        parts = []
        title = doc.get("title", topic or "课程文档")
        parts.append(f"# {title}\n")
        if doc.get("summary"):
            parts.append(f"> {doc['summary']}\n")

        for sec in doc.get("sections", []):
            if not isinstance(sec, dict):
                continue
            parts.append(f"\n## {sec.get('title', '')}\n")
            if sec.get("key_points"):
                parts.append("**核心要点：**")
                for kp in sec["key_points"]:
                    parts.append(f"- {kp}")
                parts.append("")
            if sec.get("content"):
                parts.append(sec["content"])
                parts.append("")
            for ex in sec.get("examples", []):
                if isinstance(ex, dict):
                    parts.append(f"### {ex.get('title', '示例')}\n")
                    if ex.get("description"):
                        parts.append(ex["description"])
                    if ex.get("content"):
                        parts.append(f"```\n{ex['content']}\n```")
                    parts.append("")
            if sec.get("common_mistakes"):
                parts.append("### 常见误区\n")
                for cm in sec["common_mistakes"]:
                    parts.append(f"- ⚠️ {cm}")
                parts.append("")

        if doc.get("glossary"):
            parts.append("\n## 术语表\n")
            for item in doc["glossary"]:
                if isinstance(item, dict):
                    parts.append(f"- **{item.get('term', '')}**：{item.get('definition', '')}")
            parts.append("")

        if doc.get("review_questions"):
            parts.append("\n## 复习思考题\n")
            for idx, q in enumerate(doc["review_questions"], 1):
                parts.append(f"{idx}. {q}")

        return "\n".join(parts)

    def _mindmap_to_markdown(self, data, topic):
        mindmap = data.get("mindmap", data)
        root = mindmap.get("root", mindmap)
        parts = []

        def escape_md(text):
            if not text or not isinstance(text, str):
                return text
            text = text.replace("\\", "\\\\")
            text = text.replace("*", "\\*")
            text = text.replace("_", "\\_")
            text = text.replace("[", "\\[")
            text = text.replace("]", "\\]")
            text = text.replace("~", "\\~")
            return text

        def render_node(node, depth=0):
            if not isinstance(node, dict):
                return
            indent = "  " * depth
            prefix = "# " if depth == 0 else "- "
            name = node.get("name", "")
            is_core = node.get("is_core", False)
            core_mark = " ★" if is_core else ""
            rel = node.get("relationship_type", "")
            rel_mark = f" [{rel}]" if rel and depth > 0 else ""
            parts.append(f"{indent}{prefix}{escape_md(name)}{core_mark}{rel_mark}")
            if node.get("description"):
                desc = node["description"]
                if len(desc) > 120:
                    desc = desc[:120] + "..."
                parts.append(f"{indent}  _{escape_md(desc)}_")
            for child in node.get("children", []):
                render_node(child, depth + 1)

        render_node(root)
        return "\n".join(parts)

    def _project_to_markdown(self, data, topic):
        proj = data.get("project", data)
        parts = []
        title = proj.get("project_title", proj.get("title", topic or "代码实操案例"))
        parts.append(f"# {title}\n")
        if proj.get("project_description"):
            parts.append(f"{proj['project_description']}\n")
        if proj.get("difficulty"):
            parts.append(f"**难度**：{proj['difficulty']}")
        if proj.get("programming_language"):
            parts.append(f"**语言**：{proj['programming_language']}")
        if proj.get("estimated_time"):
            parts.append(f"**预计时间**：{proj['estimated_time']}")
        parts.append("")

        if proj.get("prerequisites"):
            parts.append("## 前置知识\n")
            for p in proj["prerequisites"]:
                parts.append(f"- {p}")
            parts.append("")

        if proj.get("learning_objectives"):
            parts.append("## 学习目标\n")
            for obj in proj["learning_objectives"]:
                parts.append(f"- {obj}")
            parts.append("")

        for idx, task in enumerate(proj.get("tasks", []), 1):
            if not isinstance(task, dict):
                continue
            parts.append(f"\n## 任务{idx}：{task.get('title', '')}\n")
            if task.get("description"):
                parts.append(f"{task['description']}\n")
            for step in task.get("steps", []):
                if isinstance(step, dict):
                    parts.append(f"1. {step.get('instruction', step.get('step', ''))}")
                elif isinstance(step, str):
                    parts.append(f"1. {step}")
            if task.get("reference_solution"):
                lang = proj.get("programming_language", "python")
                parts.append(f"\n```{lang}\n{task['reference_solution']}\n```\n")
            if task.get("hints"):
                parts.append("**提示：**\n")
                for h in task["hints"]:
                    parts.append(f"- {h}")
                parts.append("")

        if proj.get("full_code"):
            lang = proj.get("programming_language", "python")
            parts.append(f"\n## 完整代码\n\n```{lang}\n{proj['full_code']}\n```\n")

        if proj.get("scoring_criteria"):
            parts.append("\n## 评分标准\n")
            for sc in proj["scoring_criteria"]:
                if isinstance(sc, dict):
                    item = sc.get("item", sc.get("criterion", ""))
                    pts = sc.get("points", "")
                    desc = sc.get("description", "")
                    parts.append(f"- **{item}**{' (' + str(pts) + '分)' if pts else ''}：{desc}")

        return "\n".join(parts)

    def _media_to_markdown(self, data, topic):
        """将视频脚本/多媒体内容结构化为可读 Markdown。

        覆盖用户要求的六要素：呈现方式、台词、拍摄内容、拍摄形式、分镜规划、视觉元素。
        """
        media = data.get("media", data) if isinstance(data, dict) else {}
        if not isinstance(media, dict):
            return f"# {topic or '视频脚本'}\n\n{json.dumps(data, ensure_ascii=False, indent=2)}"

        parts = []
        title = media.get("title") or topic or "教学视频脚本"
        parts.append(f"# {title}\n")

        # 顶部元信息：呈现方式说明 + 整体视觉风格
        meta_lines = []
        if media.get("type"):
            type_labels = {
                "video_script": "视频脚本",
                "animation": "动画脚本",
                "infographic": "信息图",
                "interactive": "交互式演示",
            }
            meta_lines.append(f"**内容类型**：{type_labels.get(media['type'], media['type'])}")
        if media.get("topic"):
            meta_lines.append(f"**主题**：{media['topic']}")
        if media.get("estimated_duration_minutes"):
            meta_lines.append(f"**预计时长**：{media['estimated_duration_minutes']} 分钟")
        if media.get("target_style"):
            style_labels = {
                "visual": "视觉型",
                "auditory": "听觉型",
                "kinesthetic": "动觉型",
                "mixed": "混合型",
            }
            meta_lines.append(f"**适配学习风格**：{style_labels.get(media['target_style'], media['target_style'])}")
        if media.get("presentation_style"):
            meta_lines.append(f"**呈现方式说明**：{media['presentation_style']}")
        if meta_lines:
            parts.append("\n".join(meta_lines))
            parts.append("")

        script = media.get("script", {})
        if not isinstance(script, dict):
            script = {}

        if script.get("visual_style"):
            parts.append(f"> **整体视觉风格**：{script['visual_style']}\n")
        if script.get("shooting_format_suggestion"):
            parts.append(f"> **拍摄形式建议**：{script['shooting_format_suggestion']}\n")
        if script.get("total_duration_seconds"):
            parts.append(f"> **总时长**：{script['total_duration_seconds']} 秒\n")
        if script.get("background_music_suggestion"):
            parts.append(f"> **背景音乐建议**：{script['background_music_suggestion']}\n")

        # 分镜规划（核心）
        raw_scenes = script.get("scenes", []) or media.get("scenes", [])
        if raw_scenes:
            parts.append("## 分镜规划\n")
            for idx, scene in enumerate(raw_scenes, 1):
                if not isinstance(scene, dict):
                    continue
                # 字段名容错：LLM 可能用 narrative/keyframes 等变体
                scene_id = scene.get("scene_id", idx)
                duration = scene.get("duration_seconds", scene.get("duration", "?"))
                keyframes = scene.get("keyframes") if isinstance(scene.get("keyframes"), list) else None
                narration = scene.get("narration") or scene.get("narrative") or scene.get("voiceover") or ""
                visual_desc = scene.get("visual_description") or scene.get("visual") or scene.get("description") or ""
                key_frame = scene.get("key_frame_description") or (
                    "；".join(f"{k.get('title','')}：{k.get('content','')}" for k in keyframes if isinstance(k, dict))
                    if keyframes else ""
                )
                visual_elems = scene.get("visual_elements")
                if not isinstance(visual_elems, list) and keyframes:
                    visual_elems = [k.get("title") for k in keyframes if isinstance(k, dict) and k.get("title")]
                parts.append(f"### 分镜 {scene_id}（{duration} 秒）\n")

                if scene.get("stage"):
                    parts.append(f"- **阶段**：{scene['stage']}")
                if visual_desc:
                    parts.append(f"- **画面内容描述**：{visual_desc}")
                if narration:
                    parts.append(f"- **旁白台词**：\n\n  > {narration}")
                if scene.get("subtitle"):
                    parts.append(f"- **字幕文本**：{scene['subtitle']}")
                if scene.get("shooting_format"):
                    parts.append(f"- **拍摄形式建议**：{scene['shooting_format']}")
                if scene.get("animation_notes") or scene.get("animation"):
                    parts.append(f"- **动画/特效说明**：{scene.get('animation_notes') or scene.get('animation')}")
                if key_frame:
                    parts.append(f"- **关键帧视觉元素**：{key_frame}")
                if visual_elems:
                    if isinstance(visual_elems, list):
                        parts.append("- **视觉元素清单**：" + "、".join(str(v) for v in visual_elems))
                    else:
                        parts.append(f"- **视觉元素清单**：{visual_elems}")
                if scene.get("transition"):
                    parts.append(f"- **转场效果**：{scene['transition']}")
                parts.append("")

        # 辅助材料
        supplements = media.get("supplementary_materials", [])
        if supplements:
            parts.append("## 辅助教学材料\n")
            for idx, sup in enumerate(supplements, 1):
                if not isinstance(sup, dict):
                    continue
                sup_title = sup.get("title", f"辅助材料{idx}")
                sup_type = sup.get("type", "")
                parts.append(f"### {sup_title}" + (f"（{sup_type}）" if sup_type else "") + "\n")
                if sup.get("description"):
                    parts.append(f"{sup['description']}\n")
                if sup.get("content_spec"):
                    parts.append(f"**规格说明**：{sup['content_spec']}\n")

        # 容错：若结构化字段全空，回退原始 JSON
        if len(parts) <= 1:
            return f"# {title}\n\n{json.dumps(data, ensure_ascii=False, indent=2)}"

        return "\n".join(parts)

    def _export_to_file(self, package_id, content_type, json_str, markdown_str, save_format):
        base_dir = os.path.join(EXPORT_DIR, package_id)
        os.makedirs(base_dir, exist_ok=True)

        if save_format in ("json", "both"):
            json_path = os.path.join(base_dir, f"{content_type}.json")
            with open(json_path, "w", encoding="utf-8") as f:
                f.write(json_str or "{}")

        if save_format in ("markdown", "both"):
            md_path = os.path.join(base_dir, f"{content_type}.md")
            with open(md_path, "w", encoding="utf-8") as f:
                f.write(markdown_str or "")

    def _save_to_knowledge_base(self, course_id, content_type, content_data, topic):
        chapter = self._get_or_create_chapter(course_id, topic)

        if content_type == "mindmap":
            return self._save_mindmap_to_kp(course_id, chapter, content_data, topic)
        elif content_type == "document":
            return self._save_document_to_kp(course_id, chapter, content_data, topic)
        elif content_type == "project":
            return self._save_project_to_exercise(course_id, chapter, content_data, topic)
        elif content_type == "recommendation":
            return self._save_recommendation_to_case(course_id, chapter, content_data, topic)
        elif content_type == "media":
            # 视频脚本：由前端 content.create 调用 /teaching_content 直接落库为
            # TeachingContent（content_type='media'），供视频观看右侧栏按课程查询使用。
            # 此处无需重复写入知识库表，避免与 TeachingContent 产生冗余记录。
            return None
        return None

    def _get_or_create_chapter(self, course_id, topic):
        existing = CourseChapter.query.filter_by(
            course_id=course_id, title=topic
        ).first()
        if existing:
            return existing

        max_order = db.session.query(db.func.max(CourseChapter.order_index)).filter_by(
            course_id=course_id
        ).scalar() or 0

        chapter = CourseChapter(
            course_id=course_id,
            title=topic,
            description=f"AI生成的{topic}相关内容",
            order_index=max_order + 1,
            chapter_type="theory",
            status="published",
        )
        db.session.add(chapter)
        db.session.commit()
        return chapter

    def _save_mindmap_to_kp(self, course_id, chapter, content_data, topic):
        data = content_data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                data = {}

        root = data.get("root", data)
        root_name = root.get("name", topic) if isinstance(root, dict) else topic
        root_desc = root.get("description", "") if isinstance(root, dict) else ""

        kp = KnowledgePoint(
            course_id=course_id,
            chapter_id=chapter.id,
            title=f"{root_name} - 知识结构思维导图",
            definition=root_desc,
            content=json.dumps(data, ensure_ascii=False),
            order_index=0,
            difficulty_level="intermediate",
            importance="core",
            source="ai_generated",
            status="published",
        )
        db.session.add(kp)

        if isinstance(root, dict):
            self._save_mindmap_children_to_kp(course_id, chapter, root.get("children", []), kp.id)

        db.session.commit()
        return kp

    def _save_mindmap_children_to_kp(self, course_id, chapter, children, parent_id, start_order=1):
        for idx, child in enumerate(children):
            if not isinstance(child, dict):
                continue
            name = child.get("name", f"节点{idx + 1}")
            desc = child.get("description", "")
            importance = "core" if child.get("is_core") else "supplementary"

            kp = KnowledgePoint(
                course_id=course_id,
                chapter_id=chapter.id,
                parent_id=parent_id,
                title=name,
                definition=desc,
                content="",
                order_index=start_order + idx,
                difficulty_level="intermediate",
                importance=importance,
                source="ai_generated",
                status="published",
            )
            db.session.add(kp)
            db.session.flush()

            if child.get("children"):
                self._save_mindmap_children_to_kp(
                    course_id, chapter, child["children"], kp.id, 1
                )

    def _save_document_to_kp(self, course_id, chapter, content_data, topic):
        data = content_data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                data = {}

        sections = data.get("sections", [])
        for idx, sec in enumerate(sections):
            if not isinstance(sec, dict):
                continue
            title = sec.get("title", f"第{idx + 1}节")
            content = sec.get("content", "")
            key_points = sec.get("key_points", [])

            kp = KnowledgePoint(
                course_id=course_id,
                chapter_id=chapter.id,
                title=title,
                definition=content[:500] if content else "",
                content=json.dumps(sec, ensure_ascii=False),
                order_index=idx,
                difficulty_level="intermediate",
                importance="core",
                prerequisites=json.dumps(key_points, ensure_ascii=False),
                source="ai_generated",
                status="published",
            )
            db.session.add(kp)

        db.session.commit()
        return chapter

    def _save_project_to_exercise(self, course_id, chapter, content_data, topic):
        data = content_data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                data = {}

        project_title = data.get("project_title", topic)
        language = data.get("programming_language", "python")
        tasks = data.get("tasks", [])

        for idx, task in enumerate(tasks):
            if not isinstance(task, dict):
                continue
            title = task.get("title", f"任务{idx + 1}")
            description = task.get("description", "")
            code_template = task.get("code_template", "")
            reference_solution = task.get("reference_solution", "")

            content_parts = []
            if description:
                content_parts.append(description)
            steps = task.get("steps", [])
            for step in steps:
                if isinstance(step, dict):
                    content_parts.append(f"步骤: {step.get('instruction', step.get('step', ''))}")
                    if step.get("hint"):
                        content_parts.append(f"提示: {step['hint']}")
                elif isinstance(step, str):
                    content_parts.append(f"步骤: {step}")
            content_text = "\n\n".join(content_parts) if content_parts else description or project_title

            hints_list = task.get("hints", [])
            if isinstance(hints_list, str):
                hints_list = [hints_list]

            exercise = CourseExercise(
                course_id=course_id,
                chapter_id=chapter.id,
                title=f"{project_title} - {title}",
                exercise_type="coding",
                content=content_text,
                correct_answer=reference_solution or code_template or "请参考代码模板完成练习",
                answer_analysis=code_template,
                hints=json.dumps(hints_list, ensure_ascii=False) if hints_list else "[]",
                knowledge_tags=json.dumps([language, "coding"], ensure_ascii=False),
                difficulty_level=data.get("difficulty", "intermediate"),
                source="ai_generated",
                status="published",
            )
            db.session.add(exercise)

        if not tasks:
            full_code = data.get("full_code", "")
            exercise = CourseExercise(
                course_id=course_id,
                chapter_id=chapter.id,
                title=project_title,
                exercise_type="coding",
                content=data.get("project_description", ""),
                correct_answer=full_code or data.get("starter_code", "") or "请参考代码模板完成练习",
                answer_analysis=data.get("starter_code", ""),
                hints="[]",
                knowledge_tags=json.dumps([language, "coding"], ensure_ascii=False),
                difficulty_level=data.get("difficulty", "intermediate"),
                source="ai_generated",
                status="published",
            )
            db.session.add(exercise)

        db.session.commit()
        return chapter

    def _save_recommendation_to_case(self, course_id, chapter, content_data, topic):
        data = content_data
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except (json.JSONDecodeError, TypeError):
                data = {"items": [{"title": topic, "background": data[:2000]}]}

        items = []
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            items = (
                data.get("items")
                or data.get("recommendations")
                or data.get("resources")
                or []
            )
            if not items:
                for key, val in data.items():
                    if isinstance(val, list) and val and isinstance(val[0], dict):
                        items = val
                        break

            if not items and data.get("categories"):
                for cat_items in data.get("categories", {}).values():
                    if isinstance(cat_items, list):
                        items.extend(cat_items)

        if not items:
            items = [data] if isinstance(data, dict) else [{"title": f"{topic} - 拓展阅读", "background": json.dumps(data, ensure_ascii=False)[:2000]}]

        saved_count = 0
        for idx, item in enumerate(items):
            if isinstance(item, str) and item.strip():
                item = {"title": item.strip(), "background": ""}
            if not isinstance(item, dict):
                continue

            title = item.get("title") or item.get("name") or item.get("resource_name") or f"推荐资源{idx + 1}"
            background = item.get("description") or item.get("summary") or item.get("content") or item.get("background") or ""
            if isinstance(background, (dict, list)):
                background = json.dumps(background, ensure_ascii=False)[:2000]

            case_type = item.get("category") or item.get("type") or item.get("source_type") or "reference"
            key_points = item.get("key_points") or []
            if isinstance(key_points, list):
                analysis = "\n".join(f"• {kp}" for kp in key_points[:10])
            else:
                analysis = ""

            solution = json.dumps(item, ensure_ascii=False)

            tags_list = [case_type]
            priority = item.get("priority", "medium")
            if priority:
                tags_list.append(f"priority:{priority}")
            difficulty = item.get("difficulty") or item.get("level") or ""
            source_url = item.get("url") or item.get("link") or ""

            tc = TeachingCase(
                course_id=course_id,
                chapter_id=chapter.id,
                title=title,
                case_type=case_type,
                background=background[:2000] if background else "",
                problem_description=f"优先级: {priority}" if priority else "",
                analysis=analysis[:2000] if analysis else "",
                solution=solution,
                conclusion=item.get("author", ""),
                difficulty_level=difficulty if difficulty in ("beginner", "intermediate", "advanced") else "intermediate",
                tags=json.dumps(tags_list, ensure_ascii=False),
                source="ai_generated",
                source_url=source_url[:500] if source_url else "",
                status="published",
            )
            db.session.add(tc)
            saved_count += 1

        if saved_count == 0:
            tc = TeachingCase(
                course_id=course_id,
                chapter_id=chapter.id,
                title=f"{topic} - 拓展阅读",
                case_type="reference",
                background=json.dumps(data, ensure_ascii=False)[:2000],
                solution=json.dumps(data, ensure_ascii=False),
                source="ai_generated",
                status="published",
            )
            db.session.add(tc)

        db.session.commit()
        return chapter

    def _async_sync_to_students(self, record_id):
        from src.main import app

        with app.app_context():
            record = ContentSyncRecord.query.get(record_id)
            if not record:
                return

            try:
                record.sync_status = SYNC_STATUS_SYNCING
                record.sync_progress = 60
                db.session.commit()

                self._perform_sync(record)

                record.sync_status = SYNC_STATUS_SYNCED
                record.sync_progress = 100
                record.synced_at = datetime.utcnow()
                db.session.commit()

                logger.info(f"Content sync completed for record {record_id}")

            except Exception as e:
                logger.error(f"Content sync failed for record {record_id}: {e}")
                record = ContentSyncRecord.query.get(record_id)
                if record:
                    record.sync_status = SYNC_STATUS_FAILED
                    record.sync_error = str(e)
                    record.sync_progress = record.sync_progress or 0
                    db.session.commit()

    def _perform_sync(self, record):
        course = Course.query.get(record.course_id)
        if not course:
            raise ValueError(f"Course {record.course_id} not found")

        record.sync_progress = 70
        db.session.commit()

        chapter = CourseChapter.query.filter_by(
            course_id=record.course_id, title=record.topic
        ).first()

        if not chapter:
            chapter = CourseChapter.query.filter_by(
                course_id=record.course_id
            ).order_by(CourseChapter.order_index.desc()).first()

        if not chapter:
            logger.warning(f"No chapters found for course {record.course_id}, sync verification skipped")
            record.sync_progress = 95
            db.session.commit()
            return

        record.sync_progress = 85
        db.session.commit()

        if record.content_type == "mindmap":
            kp_count = KnowledgePoint.query.filter_by(
                chapter_id=chapter.id, source="ai_generated"
            ).count()
            if kp_count == 0:
                logger.warning(f"Mindmap data not found in knowledge base for chapter {chapter.id}, sync may be incomplete")
        elif record.content_type == "project":
            ex_count = CourseExercise.query.filter_by(
                chapter_id=chapter.id, source="ai_generated"
            ).count()
            if ex_count == 0:
                logger.warning(f"Project data not found in knowledge base for chapter {chapter.id}, sync may be incomplete")
        elif record.content_type == "recommendation":
            tc_count = TeachingCase.query.filter_by(
                chapter_id=chapter.id, source="ai_generated"
            ).count()
            if tc_count == 0:
                logger.warning(f"Recommendation data not found in knowledge base for chapter {chapter.id}, sync may be incomplete")

        record.sync_progress = 95
        db.session.commit()

        time.sleep(0.1)

    def get_sync_status(self, package_id=None, record_id=None, course_id=None):
        query = ContentSyncRecord.query

        if record_id:
            record = query.get(record_id)
            return record.to_dict() if record else None

        if package_id:
            records = query.filter_by(package_id=package_id).all()
            return [r.to_dict() for r in records]

        if course_id:
            records = query.filter_by(course_id=course_id).order_by(
                ContentSyncRecord.created_at.desc()
            ).limit(50).all()
            return [r.to_dict() for r in records]

        return []

    def retry_sync(self, record_id):
        record = ContentSyncRecord.query.get(record_id)
        if not record:
            return {"error": "Record not found"}

        if record.sync_status not in (SYNC_STATUS_FAILED,):
            return {"error": f"Cannot retry: current status is {record.sync_status}"}

        if record.retry_count >= record.max_retries:
            return {"error": f"Max retries ({record.max_retries}) exceeded"}

        record.retry_count += 1
        record.sync_status = SYNC_STATUS_RETRYING
        record.sync_error = None
        db.session.commit()

        threading.Thread(
            target=self._async_sync_to_students,
            args=(record.id,),
            daemon=True,
        ).start()

        return record.to_dict()

    def batch_save_and_sync(self, course_id, teacher_id, resources, topic="",
                            save_format="json", package_id=None, video_id=None):
        if not package_id:
            package_id = f"pkg_{uuid.uuid4().hex[:12]}"

        results = []
        for content_type, content_data in resources.items():
            if not content_data:
                continue
            try:
                result = self.save_and_sync(
                    course_id=course_id,
                    teacher_id=teacher_id,
                    content_type=content_type,
                    content_data=content_data,
                    topic=topic,
                    save_format=save_format,
                    package_id=package_id,
                    video_id=video_id,
                )
                results.append(result)
            except Exception as e:
                logger.error(f"Batch save failed for {content_type}: {e}")
                results.append({
                    "content_type": content_type,
                    "sync_status": SYNC_STATUS_FAILED,
                    "sync_error": str(e),
                    "package_id": package_id,
                })

        return {
            "package_id": package_id,
            "total": len(results),
            "results": results,
        }

    def get_package_summary(self, package_id):
        records = ContentSyncRecord.query.filter_by(package_id=package_id).all()
        if not records:
            return None

        summary = {
            "package_id": package_id,
            "course_id": records[0].course_id,
            "topic": records[0].topic,
            "total_types": len(records),
            "statuses": {},
            "overall_status": SYNC_STATUS_SYNCED,
            "records": [r.to_dict() for r in records],
        }

        for r in records:
            status = r.sync_status
            summary["statuses"][r.content_type] = status
            if status in (SYNC_STATUS_FAILED,):
                summary["overall_status"] = SYNC_STATUS_FAILED
            elif status in (SYNC_STATUS_PENDING, SYNC_STATUS_SAVING, SYNC_STATUS_SAVED,
                            SYNC_STATUS_SYNCING, SYNC_STATUS_RETRYING):
                if summary["overall_status"] != SYNC_STATUS_FAILED:
                    summary["overall_status"] = status

        return summary


content_sync_service = ContentSyncService()
