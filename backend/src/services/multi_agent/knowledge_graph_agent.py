import json
import logging
import re
from collections import defaultdict

from src.services.multi_agent import AgentBase

logger = logging.getLogger(__name__)


GRAPH_RELATION_TYPES = {
    "contains",
    "prerequisite",
    "related",
    "supports_objective",
    "applies_to",
    "assesses",
    "recommended_after",
}


class KnowledgeGraphAgent(AgentBase):
    agent_name = "knowledge_graph_agent"
    agent_role = "知识图谱结构化专家"
    agent_description = "将文档提炼出的知识点组织为可落库、可视化的3D知识图谱结构"

    def get_capabilities(self):
        return [
            "build_knowledge_graph",
            "normalize_knowledge_points",
            "infer_knowledge_relations",
        ]

    def process(self, task):
        task_type = task.get("type")
        if task_type != "build_knowledge_graph":
            return {"error": f"Unknown task type: {task_type}"}

        normalized = task.get("normalized") or {}
        raw_text = task.get("raw_text") or normalized.get("raw_text") or ""
        course_title = task.get("course_title") or normalized.get("course", {}).get("title", "")

        graph_plan = self._build_graph_plan(normalized, raw_text, course_title)
        return {
            "normalized": graph_plan["normalized"],
            "relations": graph_plan["relations"],
            "summary": graph_plan["summary"],
        }

    def _build_graph_plan(self, normalized, raw_text, course_title):
        normalized = self._normalize_document_analysis(normalized, course_title)
        relations = []
        relation_budget = self._relation_budget(normalized)

        for chapter in normalized.get("chapters", []):
            previous_title = None
            for kp in chapter.get("knowledge_points", []):
                title = kp.get("title", "").strip()
                if not title:
                    continue
                for related in kp.get("related_concepts", []) or []:
                    relations.append(self._relation(title, str(related), "related", 0.65, "related_concepts"))
                for prereq in kp.get("prerequisites", []) or []:
                    relations.append(self._relation(str(prereq), title, "prerequisite", 0.85, "kp_prerequisites"))
                for app in kp.get("applies_to", []) or []:
                    relations.append(self._relation(title, str(app), "applies_to", 0.6, "applications"))
                if previous_title:
                    relations.append(self._relation(previous_title, title, "recommended_after", 0.55, "chapter_order"))
                previous_title = title

        relations.extend(self._infer_keyword_relations(normalized, relation_budget))
        relations.extend(self._infer_chapter_topic_relations(normalized, relation_budget))
        relations.extend(self._infer_prerequisite_relations(normalized, raw_text, relation_budget))
        relations = self._dedupe_relations(relations)

        return {
            "normalized": normalized,
            "relations": relations,
            "summary": {
                "chapter_count": len(normalized.get("chapters", [])),
                "knowledge_point_count": sum(len(c.get("knowledge_points", [])) for c in normalized.get("chapters", [])),
                "relation_count": len(relations),
            },
        }

    def _normalize_document_analysis(self, normalized, course_title):
        data = dict(normalized or {})
        course = data.get("course") or {}
        course["title"] = course.get("title") or course_title or "课程"
        data["course"] = course

        chapters = []
        seen_chapters = set()
        for idx, chapter in enumerate(data.get("chapters") or [], start=1):
            if not isinstance(chapter, dict):
                chapter = {"title": str(chapter), "knowledge_points": []}
            title = (chapter.get("title") or f"第{idx}章").strip()
            if title in seen_chapters:
                title = f"{title}（{idx}）"
            seen_chapters.add(title)

            kps = []
            seen_kps = set()
            for kp_idx, kp in enumerate(chapter.get("knowledge_points") or [], start=1):
                kp_data = self._normalize_kp(kp, chapter_title=title, order_index=kp_idx)
                kp_title = kp_data.get("title")
                if not kp_title or kp_title in seen_kps or not self._is_meaningful_kp(kp_title, kp_data.get("description", "")):
                    continue
                seen_kps.add(kp_title)
                kps.append(kp_data)

            chapters.append({
                **chapter,
                "title": title,
                "description": chapter.get("description") or "",
                "chapter_type": chapter.get("chapter_type") or "theory",
                "teaching_hours": chapter.get("teaching_hours") or 0,
                "knowledge_points": kps,
            })

        if not chapters:
            chapters.append({
                "title": "课程核心内容",
                "description": data.get("raw_text", "")[:300],
                "chapter_type": "theory",
                "teaching_hours": 0,
                "knowledge_points": [],
            })

        data["chapters"] = chapters
        data["objectives"] = self._normalize_text_list(data.get("objectives"))
        data["prerequisites"] = self._normalize_text_list(data.get("prerequisites"))
        data["references"] = self._normalize_text_list(data.get("references"))
        return data

    def _normalize_kp(self, kp, chapter_title, order_index):
        if isinstance(kp, dict):
            title = kp.get("title") or kp.get("name") or kp.get("label") or ""
            description = kp.get("description") or kp.get("definition") or kp.get("content") or ""
            category = kp.get("category") or "核心知识点"
            difficulty = kp.get("difficulty") or kp.get("difficulty_level") or self._infer_difficulty(title, description)
            related = self._normalize_text_list(kp.get("related_concepts") or kp.get("related"))
            prerequisites = self._normalize_text_list(kp.get("prerequisites"))
            applies_to = self._normalize_text_list(kp.get("applies_to"))
            assessed_by = self._normalize_text_list(kp.get("assessed_by"))
        else:
            title = str(kp)
            description = ""
            category = "核心知识点"
            difficulty = self._infer_difficulty(title, "")
            related = []
            prerequisites = []
            applies_to = []
            assessed_by = []

        title = self._clean_title(title)
        return {
            "title": title,
            "description": description.strip() if isinstance(description, str) else str(description),
            "category": category,
            "difficulty": difficulty,
            "importance": self._infer_importance(title, description, order_index),
            "chapter": chapter_title,
            "order_index": order_index,
            "related_concepts": related,
            "prerequisites": prerequisites,
            "applies_to": applies_to,
            "assessed_by": assessed_by,
        }

    def _relation_budget(self, normalized):
        kp_count = sum(len(ch.get("knowledge_points", []) or []) for ch in normalized.get("chapters", []) or [])
        return {
            "keyword": max(40, min(240, kp_count * 2)),
            "chapter_topic": max(60, min(300, kp_count * 3)),
            "prerequisite": max(30, min(160, kp_count)),
        }

    def _infer_keyword_relations(self, normalized, budget=None):
        buckets = defaultdict(list)
        all_kps = []
        for chapter in normalized.get("chapters", []):
            for kp in chapter.get("knowledge_points", []):
                all_kps.append(kp)
                for token in self._keywords(kp.get("title", "") + " " + kp.get("description", "")):
                    buckets[token].append(kp.get("title", ""))

        relations = []
        for titles in buckets.values():
            unique = [t for i, t in enumerate(titles) if t and t not in titles[:i]]
            if len(unique) < 2:
                continue
            for source, target in zip(unique, unique[1:]):
                relations.append(self._relation(source, target, "related", 0.45, "keyword_overlap"))
        return relations[:(budget or {}).get("keyword", 80)]

    def _infer_chapter_topic_relations(self, normalized, budget=None):
        relations = []
        topic_groups = defaultdict(list)
        for chapter in normalized.get("chapters", []) or []:
            chapter_title = chapter.get("title", "")
            kps = chapter.get("knowledge_points", []) or []
            for index, kp in enumerate(kps):
                title = kp.get("title", "")
                if not title:
                    continue
                if index > 0:
                    previous = kps[index - 1].get("title", "")
                    if previous:
                        relations.append(self._relation(previous, title, "recommended_after", 0.62, "chapter_sequence"))
                for token in self._keywords(f"{chapter_title} {title}") :
                    topic_groups[token].append(title)

        for titles in topic_groups.values():
            unique = [title for index, title in enumerate(titles) if title and title not in titles[:index]]
            if len(unique) < 2:
                continue
            anchor = unique[0]
            for target in unique[1:5]:
                relations.append(self._relation(anchor, target, "related", 0.58, "chapter_topic"))
        return relations[:(budget or {}).get("chapter_topic", 120)]

    def _infer_prerequisite_relations(self, normalized, raw_text, budget=None):
        relations = []
        prereqs = normalized.get("prerequisites") or []
        first_kps = []
        for chapter in normalized.get("chapters", [])[:2]:
            first_kps.extend(kp.get("title", "") for kp in chapter.get("knowledge_points", [])[:4])
        for prereq in prereqs:
            for kp_title in first_kps:
                relations.append(self._relation(prereq, kp_title, "prerequisite", 0.75, "course_prerequisites"))

        if raw_text:
            for match in re.finditer(r"(.{2,30})(?:是|为)(.{2,30})(?:的)?(?:基础|前置|先修)", raw_text):
                relations.append(self._relation(match.group(1).strip(), match.group(2).strip(), "prerequisite", 0.6, "text_pattern"))
        return relations[:(budget or {}).get("prerequisite", 60)]

    def _relation(self, source, target, relation_type, weight, reason):
        relation_type = relation_type if relation_type in GRAPH_RELATION_TYPES else "related"
        return {
            "source": self._clean_title(source),
            "target": self._clean_title(target),
            "relation": relation_type,
            "weight": float(weight),
            "confidence": min(0.95, max(0.4, float(weight))),
            "reason": reason,
        }

    def _dedupe_relations(self, relations):
        result = []
        seen = set()
        for rel in relations:
            source = rel.get("source")
            target = rel.get("target")
            if not source or not target or source == target:
                continue
            key = (source, target, rel.get("relation"))
            if key in seen:
                continue
            seen.add(key)
            result.append(rel)
        return result

    def _normalize_text_list(self, values):
        if not values:
            return []
        if isinstance(values, str):
            values = re.split(r"[、,，;；\n]+", values)
        result = []
        for value in values:
            if isinstance(value, dict):
                value = value.get("title") or value.get("name") or value.get("text") or value.get("description") or ""
            text = self._clean_title(str(value))
            if text and text not in result:
                result.append(text)
        return result

    def _keywords(self, text):
        raw = re.split(r"[\s、,，;；:：/\\()（）【】\[\]<>《》]+", text or "")
        return {token.lower() for token in raw if 2 <= len(token) <= 20}

    def _clean_title(self, value):
        text = str(value or "").strip()
        text = re.sub(r"^(知识点|重点|难点|概念|技能|目标)\s*[:：]", "", text).strip()
        text = re.sub(r"\s+", " ", text)
        return text[:120]

    def _is_meaningful_kp(self, title, description=""):
        if not title or not title.strip():
            return False
        t = title.strip()
        # 过短（1字）或过长（超过50字通常不是知识点标题）
        if len(t) < 2 or len(t) > 50:
            return False
        # 纯数字、纯标点
        if re.match(r'^[\d\s\-—.,;:;!?！？、，。：；]+$', t):
            return False
        # 常见噪声模式
        noise_patterns = [
            r'^第[一二三四五六七八九十\d]+[章节]$',  # 仅"第一章"无内容
            r'^\d+[\.\)、）]',  # 纯序号
            r'^(姓名|学号|班级|院系|专业|教师|日期|学期|学年|成绩|分数|备注|说明|目录|附录|索引|参考文献|致谢)$',
            r'^[\(（].+[\)）]$',  # 纯括号内容
            r'^[A-Z]\.$',  # 单字母
            r'^(是|否|无|有|其他|略|同上|见上|如下)$',  # 无意义短词
        ]
        for pattern in noise_patterns:
            if re.match(pattern, t):
                return False
        # 如果标题和描述都为空或极短，也过滤
        combined = (t + (description or "")).strip()
        if len(combined) < 3:
            return False
        return True

    def _infer_importance(self, title, description, order_index):
        text = f"{title} {description or ''}".lower()
        score = 0.5  # 基础分

        # 核心关键词（强信号）
        core_keywords = ['核心', '基础', '基本', '关键', '重要', '重点', '本质', '原理', '概念', '定义', '根本', '主线']
        for kw in core_keywords:
            if kw in text:
                score += 0.15

        # 应用型关键词
        apply_keywords = ['应用', '实践', '实现', '设计', '开发', '构建', '方法', '技术', '算法', '模型']
        for kw in apply_keywords:
            if kw in text:
                score += 0.1

        # 前置性关键词（说明是基础知识点）
        prereq_keywords = ['前提', '前置', '先修', '预备', '入门', '基础', '初步', '基本概念']
        for kw in prereq_keywords:
            if kw in text:
                score += 0.1

        # 位置因素：前几个知识点通常更重要
        if order_index and order_index <= 3:
            score += 0.1

        return round(min(score, 1.0), 2)

    def _infer_difficulty(self, title, description):
        text = f"{title} {description}"
        if re.search(r"(高级|复杂|优化|架构|综合|源码|原理|advanced)", text, re.I):
            return "advanced"
        if re.search(r"(基础|入门|概念|了解|beginner)", text, re.I):
            return "beginner"
        return "intermediate"


knowledge_graph_agent = KnowledgeGraphAgent()
