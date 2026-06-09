import json
import logging

from src.models.knowledge_base import (
    CourseSyllabus,
    CourseChapter,
    KnowledgePoint,
    TeachingCase,
    CourseExercise,
)
from src.models.course import Course
from src.models.user import db

logger = logging.getLogger(__name__)


class KnowledgeBaseService:

    def get_course_outline(self, course_id):
        course = Course.query.get(course_id)
        if not course:
            return None

        syllabus = CourseSyllabus.query.filter_by(course_id=course_id).first()
        chapters = (
            CourseChapter.query.filter_by(course_id=course_id, parent_id=None)
            .order_by(CourseChapter.order_index)
            .all()
        )

        result = {
            "course": {
                "id": course.id,
                "title": course.title,
                "description": course.description,
                "category": getattr(course, "category", ""),
                "difficulty": getattr(course, "difficulty", ""),
                "duration": getattr(course, "duration", ""),
            },
            "syllabus": syllabus.to_dict() if syllabus else None,
            "chapters": [self._build_chapter_tree(ch) for ch in chapters],
        }

        total_kps = KnowledgePoint.query.filter_by(course_id=course_id).count()
        total_cases = TeachingCase.query.filter_by(course_id=course_id).count()
        total_exercises = CourseExercise.query.filter_by(course_id=course_id).count()
        result["statistics"] = {
            "total_chapters": len(chapters),
            "total_knowledge_points": total_kps,
            "total_teaching_cases": total_cases,
            "total_exercises": total_exercises,
        }

        return result

    def get_chapter_detail(self, chapter_id):
        chapter = CourseChapter.query.get(chapter_id)
        if not chapter:
            return None

        knowledge_points = (
            KnowledgePoint.query.filter_by(chapter_id=chapter_id, parent_id=None)
            .order_by(KnowledgePoint.order_index)
            .all()
        )

        teaching_cases = TeachingCase.query.filter_by(chapter_id=chapter_id).all()
        exercises = CourseExercise.query.filter_by(chapter_id=chapter_id).all()

        return {
            "chapter": chapter.to_dict(include_children=True),
            "knowledge_points": [self._build_kp_tree(kp) for kp in knowledge_points],
            "teaching_cases": [tc.to_dict() for tc in teaching_cases],
            "exercises": [ex.to_dict(include_answer=True) for ex in exercises],
        }

    def get_knowledge_point_context(self, kp_id):
        kp = KnowledgePoint.query.get(kp_id)
        if not kp:
            return None

        teaching_cases = TeachingCase.query.filter_by(knowledge_point_id=kp_id).all()
        exercises = CourseExercise.query.filter_by(knowledge_point_id=kp_id).all()

        children = (
            KnowledgePoint.query.filter_by(parent_id=kp_id)
            .order_by(KnowledgePoint.order_index)
            .all()
        )

        chapter = CourseChapter.query.get(kp.chapter_id)

        return {
            "knowledge_point": kp.to_dict(include_children=True),
            "chapter": chapter.to_dict() if chapter else None,
            "teaching_cases": [tc.to_dict() for tc in teaching_cases],
            "exercises": [ex.to_dict(include_answer=True) for ex in exercises],
            "children": [c.to_dict() for c in children],
        }

    def search_exercises(self, course_id, chapter_id=None, difficulty=None, exercise_type=None):
        query = CourseExercise.query.filter_by(course_id=course_id)
        if chapter_id:
            query = query.filter_by(chapter_id=chapter_id)
        if difficulty:
            query = query.filter_by(difficulty_level=difficulty)
        if exercise_type:
            query = query.filter_by(exercise_type=exercise_type)
        return [ex.to_dict(include_answer=True) for ex in query.all()]

    def get_teaching_cases_for_knowledge_point(self, kp_id):
        cases = TeachingCase.query.filter_by(knowledge_point_id=kp_id).all()
        return [tc.to_dict() for tc in cases]

    def get_teaching_cases_for_chapter(self, chapter_id):
        cases = TeachingCase.query.filter_by(chapter_id=chapter_id).all()
        return [tc.to_dict() for tc in cases]

    def build_knowledge_context_for_prompt(self, course_id, chapter_ids=None):
        outline = self.get_course_outline(course_id)
        if not outline:
            return None

        chapter_list_text = self._format_chapter_list(outline["chapters"])

        knowledge_points_detail = []
        teaching_cases_detail = []
        exercises_detail = []

        target_chapters = outline["chapters"]
        if chapter_ids:
            target_chapters = [
                ch for ch in outline["chapters"] if ch["id"] in chapter_ids
            ]

        for ch in target_chapters:
            detail = self.get_chapter_detail(ch["id"])
            if detail:
                for kp in detail["knowledge_points"]:
                    knowledge_points_detail.append(self._format_kp_for_prompt(kp))
                for tc in detail["teaching_cases"]:
                    teaching_cases_detail.append(self._format_case_for_prompt(tc))
                for ex in detail["exercises"]:
                    exercises_detail.append(self._format_exercise_for_prompt(ex))

        syllabus_text = ""
        if outline.get("syllabus"):
            s = outline["syllabus"]
            objectives = s.get("course_objectives", [])
            textbook = s.get("textbook", {})
            syllabus_text = f"课程代码：{s.get('course_code', '')}\n"
            syllabus_text += f"学分：{s.get('credit', '')}\n"
            syllabus_text += f"总学时：{s.get('total_hours', '')}\n"
            if objectives:
                syllabus_text += "课程目标：\n" + "\n".join(
                    f"  - {obj}" for obj in objectives
                ) + "\n"
            if textbook:
                syllabus_text += f"教材：{textbook.get('title', '')}（{textbook.get('author', '')}，{textbook.get('year', '')}）\n"

        return {
            "course_title": outline["course"]["title"],
            "course_description": outline["course"]["description"],
            "syllabus_text": syllabus_text,
            "chapter_list": chapter_list_text,
            "knowledge_points_detail": "\n\n".join(knowledge_points_detail) if knowledge_points_detail else "暂无",
            "teaching_cases_detail": "\n\n".join(teaching_cases_detail) if teaching_cases_detail else "暂无",
            "exercises_detail": "\n\n".join(exercises_detail) if exercises_detail else "暂无",
            "statistics": outline.get("statistics", {}),
        }

    def _build_chapter_tree(self, chapter):
        result = chapter.to_dict()
        children = (
            CourseChapter.query.filter_by(parent_id=chapter.id)
            .order_by(CourseChapter.order_index)
            .all()
        )
        if children:
            result["children"] = [self._build_chapter_tree(ch) for ch in children]
        return result

    def _build_kp_tree(self, kp):
        result = kp.to_dict()
        children = (
            KnowledgePoint.query.filter_by(parent_id=kp.id)
            .order_by(KnowledgePoint.order_index)
            .all()
        )
        if children:
            result["children"] = [self._build_kp_tree(c) for c in children]
        return result

    def _format_chapter_list(self, chapters, indent=0):
        lines = []
        for ch in chapters:
            prefix = "  " * indent
            lines.append(f"{prefix}第{ch['order_index']}章 {ch['title']}（{ch.get('teaching_hours', 0)}学时）")
            key_points = ch.get("key_points", [])
            if key_points:
                for kp in key_points[:5]:
                    lines.append(f"{prefix}  · {kp}")
            if ch.get("children"):
                lines.append(self._format_chapter_list(ch["children"], indent + 1))
        return "\n".join(lines)

    def _format_kp_for_prompt(self, kp):
        parts = [f"【{kp['title']}】"]
        if kp.get("definition"):
            parts.append(f"定义：{kp['definition']}")
        if kp.get("content"):
            content = kp["content"]
            if len(content) > 500:
                content = content[:500] + "..."
            parts.append(f"内容：{content}")
        if kp.get("difficulty_level"):
            parts.append(f"难度：{kp['difficulty_level']}")
        if kp.get("importance"):
            parts.append(f"重要性：{kp['importance']}")
        if kp.get("formulas"):
            formulas = kp["formulas"]
            if isinstance(formulas, str):
                try:
                    formulas = json.loads(formulas)
                except (json.JSONDecodeError, TypeError):
                    formulas = []
            if isinstance(formulas, list):
                for f in formulas[:3]:
                    if isinstance(f, dict):
                        parts.append(f"公式 - {f.get('name', '')}: {f.get('formula', '')}")
                    elif isinstance(f, str):
                        parts.append(f"公式: {f}")
        if kp.get("tags"):
            tags = kp["tags"]
            if isinstance(tags, list):
                parts.append(f"标签：{', '.join(str(t) for t in tags[:5])}")
        if kp.get("children"):
            for child in kp["children"]:
                parts.append(f"  子知识点：{child.get('title', '')}")
        return "\n".join(parts)

    def _format_case_for_prompt(self, tc):
        parts = [f"【教学案例：{tc['title']}】"]
        if tc.get("case_type"):
            parts.append(f"类型：{tc['case_type']}")
        if tc.get("background"):
            bg = tc["background"]
            if len(bg) > 300:
                bg = bg[:300] + "..."
            parts.append(f"背景：{bg}")
        if tc.get("problem_description"):
            pd = tc["problem_description"]
            if len(pd) > 300:
                pd = pd[:300] + "..."
            parts.append(f"问题描述：{pd}")
        if tc.get("conclusion"):
            cl = tc["conclusion"]
            if len(cl) > 200:
                cl = cl[:200] + "..."
            parts.append(f"结论：{cl}")
        return "\n".join(parts)

    def _format_exercise_for_prompt(self, ex):
        parts = [f"【习题：{ex['title']}】"]
        if ex.get("exercise_type"):
            parts.append(f"题型：{ex['exercise_type']}")
        if ex.get("difficulty_level"):
            parts.append(f"难度：{ex['difficulty_level']}")
        if ex.get("content"):
            c = ex["content"]
            if len(c) > 300:
                c = c[:300] + "..."
            parts.append(f"题目：{c}")
        if ex.get("correct_answer"):
            parts.append(f"答案：{ex['correct_answer']}")
        if ex.get("answer_analysis"):
            aa = ex["answer_analysis"]
            if len(aa) > 300:
                aa = aa[:300] + "..."
            parts.append(f"解析：{aa}")
        return "\n".join(parts)


knowledge_base_service = KnowledgeBaseService()
