import base64
import io
import json
import logging
import re
import uuid
import zipfile
from collections import defaultdict
from xml.etree import ElementTree as ET

from docx import Document

from src.models.course import Course
from src.models.knowledge_base import (
    CourseChapter,
    CourseSyllabus,
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    KnowledgePoint,
    KnowledgeSourceChunk,
)
from src.models.user import db
from src.services.multi_agent.knowledge_graph_agent import knowledge_graph_agent

logger = logging.getLogger(__name__)


NODE_TYPES = {
    "course", "chapter", "knowledge_point", "objective", "skill",
    "case", "exercise", "resource",
}
EDGE_TYPES = {
    "contains", "prerequisite", "related", "supports_objective",
    "applies_to", "assesses", "recommended_after",
}


class SyllabusGraphService:
    def clear_graph(self, course_id):
        """彻底删除指定课程的全部知识图谱数据及所有关联数据"""
        course = Course.query.get(course_id)
        if not course:
            return {"error": "Course not found"}
        node_count = KnowledgeGraphNode.query.filter_by(course_id=course_id).count()
        edge_count = KnowledgeGraphEdge.query.filter_by(course_id=course_id).count()
        # 删除所有类型的来源片段（不仅限于 syllabus）
        chunk_count = KnowledgeSourceChunk.query.filter_by(course_id=course_id).count()
        self._clear_existing_graph(course_id, delete_all_chunks=True)
        db.session.commit()
        return {
            "deleted_nodes": node_count,
            "deleted_edges": edge_count,
            "deleted_source_chunks": chunk_count,
            "message": f"已彻底删除课程 {course.title} 的全部知识图谱数据",
        }

    def import_syllabus(self, course_id, input_type, content=None, file_id=None):
        course = Course.query.get(course_id)
        if not course:
            return {"error": "Course not found"}

        normalized = self.parse_syllabus(input_type, content=content, file_id=file_id, course=course)
        graph_plan = knowledge_graph_agent.process({
            "type": "build_knowledge_graph",
            "normalized": normalized,
            "raw_text": normalized.get("raw_text", ""),
            "course_title": course.title,
        })
        if "error" in graph_plan:
            logger.warning("Knowledge graph agent failed, fallback to raw normalized result: %s", graph_plan["error"])
        else:
            normalized = graph_plan.get("normalized") or normalized
        graph_id = f"kg_{course_id}_{uuid.uuid4().hex[:8]}"

        self._clear_existing_graph(course_id)
        source_chunks = self._create_source_chunks(course_id, normalized)
        node_cache = {}
        created_nodes = 0
        created_edges = 0

        course_node, is_new = self._upsert_node(
            graph_id, course_id, "course", normalized["course"].get("title") or course.title,
            normalized["course"].get("description") or course.description or "",
            category="课程", source_chunk_ids=[c.id for c in source_chunks[:1]],
        )
        node_cache[("course", course_node.label)] = course_node
        created_nodes += int(is_new)

        objective_nodes = []
        for objective in normalized.get("objectives", []):
            node, is_new = self._upsert_node(
                graph_id, course_id, "objective", objective, objective,
                category="课程目标", source_chunk_ids=self._chunk_ids_for_text(source_chunks, objective),
            )
            objective_nodes.append(node)
            created_nodes += int(is_new)
            created_edges += self._upsert_edge(
                graph_id, course_id, course_node.id, node.id, "supports_objective", 1.0, 0.95,
                self._chunk_ids_for_text(source_chunks, objective),
            )

        previous_chapter_node = None
        kp_nodes = []
        for chapter_index, chapter in enumerate(normalized.get("chapters", []), start=1):
            ch_label = chapter.get("title") or f"第{chapter_index}章"
            ch_node, is_new = self._upsert_node(
                graph_id, course_id, "chapter", ch_label, chapter.get("description", ""),
                category=chapter.get("chapter_type", "theory"),
                source_chunk_ids=self._chunk_ids_for_text(source_chunks, ch_label),
                properties={"order_index": chapter_index, "teaching_hours": chapter.get("teaching_hours", 0)},
            )
            created_nodes += int(is_new)
            created_edges += self._upsert_edge(
                graph_id, course_id, course_node.id, ch_node.id, "contains", 1.0, 1.0,
                self._chunk_ids_for_text(source_chunks, ch_label),
            )
            if previous_chapter_node:
                created_edges += self._upsert_edge(
                    graph_id, course_id, previous_chapter_node.id, ch_node.id, "recommended_after", 0.7, 0.8, []
                )
            previous_chapter_node = ch_node

            for objective_node in objective_nodes:
                created_edges += self._upsert_edge(
                    graph_id, course_id, ch_node.id, objective_node.id, "supports_objective", 0.7, 0.75, []
                )

            previous_kp_node = None
            for kp_index, kp in enumerate(chapter.get("knowledge_points", []), start=1):
                kp_label = kp.get("title") if isinstance(kp, dict) else str(kp)
                if not kp_label:
                    continue
                kp_props = {"chapter": ch_label, "order_index": kp_index}
                if isinstance(kp, dict):
                    if kp.get("difficulty"):
                        kp_props["difficulty"] = kp["difficulty"]
                    if kp.get("assessed_by"):
                        kp_props["assessed_by"] = str(kp["assessed_by"])
                kp_node, is_new = self._upsert_node(
                    graph_id, course_id, "knowledge_point", kp_label,
                    kp.get("description", "") if isinstance(kp, dict) else "",
                    category=kp.get("category", "核心知识点") if isinstance(kp, dict) else "核心知识点",
                    source_chunk_ids=self._chunk_ids_for_text(source_chunks, kp_label),
                    properties=kp_props,
                )
                kp_nodes.append(kp_node)
                created_nodes += int(is_new)
                created_edges += self._upsert_edge(
                    graph_id, course_id, ch_node.id, kp_node.id, "contains", 1.0, 0.95,
                    self._chunk_ids_for_text(source_chunks, kp_label),
                )
                if previous_kp_node:
                    created_edges += self._upsert_edge(
                        graph_id, course_id, previous_kp_node.id, kp_node.id, "recommended_after", 0.65, 0.75, []
                    )
                previous_kp_node = kp_node

                for related in (kp.get("related_concepts", []) if isinstance(kp, dict) else []):
                    related_node, is_new = self._upsert_node(
                        graph_id, course_id, "knowledge_point", str(related), "", "关联概念",
                        self._chunk_ids_for_text(source_chunks, str(related)),
                    )
                    created_nodes += int(is_new)
                    created_edges += self._upsert_edge(
                        graph_id, course_id, kp_node.id, related_node.id, "related", 0.6, 0.7,
                        self._chunk_ids_for_text(source_chunks, str(related)),
                    )

        for prereq in normalized.get("prerequisites", []):
            prereq_node, is_new = self._upsert_node(
                graph_id, course_id, "skill", str(prereq), "", "先修要求",
                self._chunk_ids_for_text(source_chunks, str(prereq)),
            )
            created_nodes += int(is_new)
            for kp_node in kp_nodes[:12]:
                created_edges += self._upsert_edge(
                    graph_id, course_id, prereq_node.id, kp_node.id, "prerequisite", 0.9, 0.85,
                    self._chunk_ids_for_text(source_chunks, str(prereq)),
                )

        # 关系推理引擎：建立跨章节关联 + 语义关系增强
        created_edges += self._infer_cross_chapter_relations(
            graph_id, course_id, kp_nodes, source_chunks
        )
        created_edges += self._infer_semantic_relations(
            graph_id, course_id, kp_nodes, source_chunks
        )
        if graph_plan and graph_plan.get("relations"):
            created_edges += self._apply_agent_relations(graph_id, course_id, kp_nodes, graph_plan["relations"])

        db.session.commit()
        quality_report = self.build_quality_report(course_id)
        return {
            "graph_id": graph_id,
            "nodes_created": created_nodes,
            "edges_created": created_edges,
            "source_chunks": [chunk.to_dict() for chunk in source_chunks],
            "quality_report": quality_report,
            "graph_plan": graph_plan.get("summary") if isinstance(graph_plan, dict) else None,
        }

    def parse_syllabus(self, input_type, content=None, file_id=None, course=None):
        input_type = self._detect_input_type(input_type, content, file_id)
        if input_type == "docx":
            text = self._read_docx_text(content, file_id)
        elif input_type == "pdf":
            text = self._read_pdf_text(content, file_id)
        elif input_type == "json":
            return self._normalize_structured(content, course)
        elif input_type in ("text", "markdown"):
            text = content or ""
        else:
            raise ValueError("input_type must be one of: json, text, markdown, docx, pdf")
        if not (text or "").strip():
            raise ValueError("未能从上传文件中提取到可解析文本，请确认文件不是扫描图片或加密文档")
        analysis = self._parse_text_syllabus(text, course)
        analysis["_analysis_budget"] = self._build_analysis_budget(text, analysis)
        return self._postprocess_analysis(analysis)

    def _detect_input_type(self, input_type, content=None, file_id=None):
        declared = (input_type or "text").lower()
        if declared == "json":
            return declared
        try:
            binary = self._to_binary(content, file_id)
        except Exception:
            return declared
        if binary.startswith(b"%PDF"):
            return "pdf"
        if binary.startswith((b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")):
            return "docx"
        return declared

    def get_graph(self, course_id, node_type=None, edge_type=None, include_sources=True):
        nodes_query = KnowledgeGraphNode.query.filter_by(course_id=course_id)
        if node_type:
            nodes_query = nodes_query.filter_by(node_type=node_type)
        nodes = nodes_query.order_by(KnowledgeGraphNode.id).all()
        node_ids = {n.id for n in nodes}

        edges_query = KnowledgeGraphEdge.query.filter_by(course_id=course_id)
        if edge_type:
            edges_query = edges_query.filter_by(edge_type=edge_type)
        edges = [
            e for e in edges_query.order_by(KnowledgeGraphEdge.id).all()
            if e.source_node_id in node_ids and e.target_node_id in node_ids
        ]

        source_map = {}
        if include_sources:
            source_map = {c.id: c.to_dict() for c in KnowledgeSourceChunk.query.filter_by(course_id=course_id).all()}

        return {
            "nodes": [self._format_node_for_graph(n, source_map if include_sources else None) for n in nodes],
            "edges": [e.to_dict(include_sources=include_sources) for e in edges],
            "metrics": self._build_metrics(nodes, edges),
            "quality_report": self.build_quality_report(course_id),
        }

    def build_course_profile(self, course_id):
        graph = self.get_graph(course_id, include_sources=False)
        nodes = graph["nodes"]
        edges = graph["edges"]
        kp_count = sum(1 for n in nodes if n["node_type"] == "knowledge_point")
        chapter_count = sum(1 for n in nodes if n["node_type"] == "chapter")
        prereq_count = sum(1 for e in edges if e["edge_type"] == "prerequisite")
        practice_count = sum(1 for n in nodes if n["node_type"] in ("case", "exercise", "skill"))
        return {
            "knowledge_density": round(kp_count / max(chapter_count, 1), 2),
            "core_knowledge_count": kp_count,
            "chapter_count": chapter_count,
            "prerequisite_strength": round(prereq_count / max(kp_count, 1), 2),
            "practice_ratio": round(practice_count / max(len(nodes), 1), 2),
            "difficulty": "advanced" if kp_count > 40 or prereq_count > 20 else "intermediate" if kp_count > 15 else "beginner",
        }

    def build_quality_report(self, course_id):
        nodes = KnowledgeGraphNode.query.filter_by(course_id=course_id).all()
        edges = KnowledgeGraphEdge.query.filter_by(course_id=course_id).all()
        chunk_count = KnowledgeSourceChunk.query.filter_by(course_id=course_id).count()
        connected = set()
        for edge in edges:
            connected.add(edge.source_node_id)
            connected.add(edge.target_node_id)
        missing_citations = sum(1 for n in nodes if not json.loads(n.source_chunk_ids or "[]"))
        return {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "isolated_node_count": sum(1 for n in nodes if n.id not in connected),
            "source_coverage_rate": round((len(nodes) - missing_citations) / max(len(nodes), 1) * 100, 1),
            "average_edge_weight": round(sum(e.weight or 0 for e in edges) / max(len(edges), 1), 2),
            "missing_citation_count": missing_citations,
            "source_chunk_count": chunk_count,
        }

    def _normalize_structured(self, content, course):
        data = content
        if isinstance(content, str):
            data = json.loads(content or "{}")
        data = data or {}
        chapters = data.get("chapters") or data.get("units") or []
        normalized_chapters = []
        for idx, ch in enumerate(chapters, start=1):
            if isinstance(ch, str):
                normalized_chapters.append({"title": ch, "knowledge_points": []})
                continue
            key_points = ch.get("knowledge_points") or ch.get("key_points") or ch.get("points") or []
            normalized_chapters.append({
                "title": ch.get("title") or ch.get("name") or f"第{idx}章",
                "description": ch.get("description") or ch.get("summary") or "",
                "teaching_hours": ch.get("teaching_hours") or ch.get("hours") or 0,
                "chapter_type": ch.get("chapter_type") or "theory",
                "knowledge_points": self._normalize_kp_list(key_points),
            })
        return {
            "course": {
                "title": data.get("title") or data.get("course_title") or getattr(course, "title", ""),
                "description": data.get("description") or getattr(course, "description", ""),
            },
            "objectives": self._normalize_text_list(data.get("objectives") or data.get("course_objectives") or []),
            "prerequisites": self._normalize_text_list(data.get("prerequisites") or data.get("prerequisite_courses") or []),
            "references": self._normalize_text_list(data.get("references") or []),
            "chapters": normalized_chapters,
            "raw_text": json.dumps(data, ensure_ascii=False),
        }

    def _parse_text_syllabus(self, text, course):
        """AI + 规则协同解析：始终同时运行两种引擎，合并结果"""
        # 第一步：规则解析（快速、确定性）
        rule_result = self._rule_based_parse(text, course)

        # 第二步：尝试 LLM 解析（语义理解更强）
        llm_result = None
        try:
            llm_result = self._llm_based_parse(text, course)
        except Exception as e:
            logger.warning(f"LLM syllabus extraction failed: {e}")

        # 如果 LLM 完全失败，直接返回规则结果
        if not llm_result:
            return rule_result

        # 第三步：协同合并 — 取两者之长
        return self._merge_parse_results(rule_result, llm_result, course)

    def _merge_parse_results(self, rule_result, llm_result, course):
        """合并规则解析和 LLM 解析的结果，取两者之长"""
        merged = {
            "course": llm_result.get("course") or rule_result.get("course", {}),
            "raw_text": rule_result.get("raw_text", ""),
            "_analysis_budget": rule_result.get("_analysis_budget") or llm_result.get("_analysis_budget"),
        }

        # 合并目标：LLM 语义理解更准确，优先；规则补充遗漏
        rule_objectives = set(o for o in rule_result.get("objectives", []) if len(o) > 2)
        llm_objectives = set(o for o in llm_result.get("objectives", []) if len(o) > 2)
        merged["objectives"] = list(llm_objectives | rule_objectives)[:15]

        # 合并先修要求
        rule_prereqs = set(p for p in rule_result.get("prerequisites", []) if len(p) > 1)
        llm_prereqs = set(p for p in llm_result.get("prerequisites", []) if len(p) > 1)
        merged["prerequisites"] = list(llm_prereqs | rule_prereqs)[:12]

        # 合并参考文献
        merged["references"] = list(dict.fromkeys(
            rule_result.get("references", []) + llm_result.get("references", [])
        ))[:15]

        # 合并章节与知识点（核心逻辑）
        # 策略：以 LLM 结果为骨架（结构更合理），用规则结果补充遗漏的知识点
        llm_chapters = llm_result.get("chapters", [])
        rule_chapters = rule_result.get("chapters", [])
        llm_kp_count = self._count_knowledge_points(llm_chapters)
        rule_kp_count = self._count_knowledge_points(rule_chapters)

        # 长 PDF、项目申报书、教辅资料常常超过 LLM 单次上下文窗口。
        # 如果规则解析明显抽到更多章节/知识点，说明 LLM 只看到了前段摘要，
        # 此时应以规则结构为主，再融合 LLM 的语义知识点，避免最终只剩少量节点。
        if rule_kp_count >= max(20, llm_kp_count * 2):
            llm_chapters = self._merge_llm_kps_into_rule_chapters(rule_chapters, llm_chapters)

        # 构建 LLM 知识点集合用于去重
        llm_kp_set = set()
        for ch in llm_chapters:
            for kp in ch.get("knowledge_points", []):
                title = kp.get("title", "") if isinstance(kp, dict) else str(kp)
                if title:
                    llm_kp_set.add(title.strip())

        # 从规则结果中提取 LLM 遗漏的知识点
        missing_kps = []
        for ch in rule_chapters:
            for kp in ch.get("knowledge_points", []):
                title = kp.get("title", "") if isinstance(kp, dict) else str(kp)
                title = self._summarize_to_kp_title(title)
                if title and title not in llm_kp_set:
                    missing_kps.append({
                        "title": title,
                        "description": kp.get("description", "") if isinstance(kp, dict) else "",
                        "category": kp.get("category", "补充知识点") if isinstance(kp, dict) else "补充知识点",
                    })

        # 如果有遗漏知识点，追加到最后一个章节或新建补充章节
        if missing_kps and llm_chapters:
            self._distribute_missing_kps(llm_chapters, missing_kps)
        elif missing_kps and not llm_chapters:
            llm_chapters.append({
                "title": "补充知识点",
                "description": "规则解析补充的知识点",
            "knowledge_points": missing_kps[:self._analysis_budget(merged).get("total_kp_limit", 60)],
                "teaching_hours": 0,
                "chapter_type": "theory",
            })

        merged["chapters"] = llm_chapters if llm_chapters else rule_chapters

        # 为 LLM 结果中缺少 description 的知识点补充规则解析的描述
        rule_kp_desc = {}
        for ch in rule_chapters:
            for kp in ch.get("knowledge_points", []):
                if isinstance(kp, dict):
                    t = kp.get("title", "").strip()
                    d = kp.get("description", "").strip()
                    if t and d:
                        rule_kp_desc[t] = d

        for ch in merged["chapters"]:
            for kp in ch.get("knowledge_points", []):
                if isinstance(kp, dict):
                    t = kp.get("title", "").strip()
                    if t and not kp.get("description", "").strip() and t in rule_kp_desc:
                        kp["description"] = rule_kp_desc[t]

        return self._postprocess_analysis(merged)

    def _build_analysis_budget(self, text, analysis=None):
        text = text or ""
        analysis = analysis or {}
        chapters = [ch for ch in analysis.get("chapters", []) or [] if isinstance(ch, dict)]
        candidate_count = self._count_knowledge_points(chapters)
        line_count = len([line for line in text.splitlines() if line.strip()])
        text_len = len(text)
        chapter_count = max(len(chapters), 1)

        estimated_total = max(
            candidate_count,
            min(260, max(12, text_len // 110, line_count // 3)),
        )
        if text_len < 2500 and candidate_count <= 20:
            estimated_total = max(candidate_count, 8)
        elif text_len > 12000 or line_count > 500:
            estimated_total = max(estimated_total, min(360, candidate_count or line_count // 2))

        per_chapter = max(4, min(28, int((estimated_total / chapter_count) + 3)))
        return {
            "text_length": text_len,
            "line_count": line_count,
            "chapter_count": chapter_count,
            "candidate_kp_count": candidate_count,
            "total_kp_limit": int(max(estimated_total, candidate_count)),
            "per_chapter_kp_limit": per_chapter,
        }

    def _analysis_budget(self, analysis):
        budget = (analysis or {}).get("_analysis_budget") or {}
        if budget:
            return budget
        return self._build_analysis_budget((analysis or {}).get("raw_text", ""), analysis)

    def _chapter_kp_limit(self, chapter, budget):
        current_count = len(chapter.get("knowledge_points", []) or [])
        base = int((budget or {}).get("per_chapter_kp_limit") or 12)
        if current_count > base:
            return min(current_count, max(base, int(current_count * 0.85)))
        return base

    def _count_knowledge_points(self, chapters):
        return sum(len(ch.get("knowledge_points", []) or []) for ch in chapters or [] if isinstance(ch, dict))

    def _merge_llm_kps_into_rule_chapters(self, rule_chapters, llm_chapters):
        merged = [dict(ch) for ch in rule_chapters or [] if isinstance(ch, dict)]
        if not merged:
            return llm_chapters or []

        def norm(value):
            return self._clean_compare_text(value)

        for llm_ch in llm_chapters or []:
            if not isinstance(llm_ch, dict):
                continue
            llm_title = llm_ch.get("title", "")
            target = None
            for rule_ch in merged:
                rule_title = rule_ch.get("title", "")
                if norm(llm_title) and (norm(llm_title) in norm(rule_title) or norm(rule_title) in norm(llm_title)):
                    target = rule_ch
                    break
            if target is None:
                target = merged[0]

            existing = {
                self._clean_compare_text(kp.get("title", "") if isinstance(kp, dict) else str(kp))
                for kp in target.get("knowledge_points", []) or []
            }
            for kp in llm_ch.get("knowledge_points", []) or []:
                title = kp.get("title", "") if isinstance(kp, dict) else str(kp)
                compare = self._clean_compare_text(title)
                if compare and compare not in existing:
                    target.setdefault("knowledge_points", []).append(kp)
                    existing.add(compare)
        return merged

    def _distribute_missing_kps(self, chapters, missing_kps):
        if not chapters:
            return
        chapter_count = len(chapters)
        limit = self._analysis_budget({"chapters": chapters}).get("total_kp_limit", 120)
        for index, kp in enumerate(missing_kps[:limit]):
            target = chapters[index % chapter_count]
            existing = {
                self._clean_compare_text(item.get("title", "") if isinstance(item, dict) else str(item))
                for item in target.get("knowledge_points", []) or []
            }
            compare = self._clean_compare_text(kp.get("title", "") if isinstance(kp, dict) else str(kp))
            if compare and compare not in existing:
                target.setdefault("knowledge_points", []).append(kp)

    def _postprocess_analysis(self, analysis):
        analysis = analysis or {}
        chapters = analysis.get("chapters") or []
        budget = self._analysis_budget(analysis)
        chapter_titles = {self._clean_compare_text(ch.get("title", "")) for ch in chapters if isinstance(ch, dict)}
        cleaned_chapters = []
        global_seen = set()

        for chapter in chapters:
            if not isinstance(chapter, dict):
                continue
            title = (chapter.get("title") or "").strip()
            if not title or self._is_noise_line(title):
                continue

            cleaned_kps = []
            local_seen = set()
            for kp in chapter.get("knowledge_points") or []:
                kp_data = kp if isinstance(kp, dict) else {"title": str(kp), "description": ""}
                kp_title = self._summarize_to_kp_title(kp_data.get("title", ""))
                compare = self._clean_compare_text(kp_title)
                if (
                    not kp_title
                    or compare in local_seen
                    or compare in global_seen
                    or compare in chapter_titles
                    or self._is_pseudo_knowledge_point(kp_title)
                ):
                    continue
                local_seen.add(compare)
                global_seen.add(compare)
                cleaned_kps.append({
                    **kp_data,
                    "title": kp_title,
                    "description": (kp_data.get("description") or "")[:240],
                    "category": kp_data.get("category") or "核心知识点",
                })

            if not cleaned_kps:
                cleaned_kps = self._derive_kps_from_chapter(chapter)
                for kp in cleaned_kps:
                    global_seen.add(self._clean_compare_text(kp["title"]))

            cleaned_chapters.append({
                **chapter,
                "title": title,
                "description": chapter.get("description") or "",
                "knowledge_points": cleaned_kps[:self._chapter_kp_limit(chapter, budget)],
            })

        analysis["chapters"] = cleaned_chapters
        analysis["objectives"] = self._normalize_text_list(analysis.get("objectives"))[:12]
        analysis["prerequisites"] = self._normalize_text_list(analysis.get("prerequisites"))[:10]
        analysis["references"] = self._normalize_text_list(analysis.get("references"))[:12]
        return analysis

    def _clean_compare_text(self, text):
        text = re.sub(r"^\d+(?:\.\d+)*\s*", "", str(text or ""))
        text = re.sub(r"[\s:：。；;，,、（）()\[\]【】]+", "", text)
        return text.lower()

    def _is_pseudo_knowledge_point(self, text):
        value = str(text or "").strip()
        if self._is_noise_line(value):
            return True
        if re.search(r"(论文题目|本科生课程论文|评阅人|复核人|指导教师|参考文献|出版社|学报|\[J\]|\[M\]|\[D\])", value):
            return True
        if re.match(r"^\[?\d+\]?\s*[\u4e00-\u9fa5]{1,4}[,.，．]", value):
            return True
        if re.match(r"^\d+(?:\.\d+)*\s*(引言|结论|摘要|关键词|参考文献|未来发展趋势|发展路径|问题及成因分析)", value):
            return True
        return False

    def _derive_kps_from_chapter(self, chapter):
        title = chapter.get("title") or ""
        description = chapter.get("description") or ""
        candidates = []
        title_clean = re.sub(r"^\d+(?:\.\d+)*\s*", "", title).strip()

        if re.search(r"(现状|发展)", title_clean):
            candidates.append(f"{title_clean}现状")
        if re.search(r"(问题|成因|挑战)", title_clean):
            candidates.extend([f"{title_clean}核心问题", f"{title_clean}成因机制"])
        if re.search(r"(路径|策略|对策|协同)", title_clean):
            candidates.extend([f"{title_clean}实施路径", f"{title_clean}协同机制"])
        if re.search(r"(趋势|展望|未来)", title_clean):
            candidates.extend([f"{title_clean}趋势判断", f"{title_clean}发展方向"])
        if re.search(r"(安全|现代化|供应链)", title_clean):
            candidates.append(title_clean)

        candidates.extend(self._extract_kp_candidates_from_line(description))
        result = []
        seen = set()
        for candidate in candidates:
            title = self._summarize_to_kp_title(candidate)
            compare = self._clean_compare_text(title)
            if title and compare not in seen and not self._is_pseudo_knowledge_point(title):
                seen.add(compare)
                result.append({"title": title, "description": description[:180], "category": "核心知识点"})
        return result

    def _rule_based_parse(self, text, course):
        lines = [line.strip(" \t\r\n#-*•·") for line in (text or "").splitlines() if line.strip()]
        objectives, prereqs, refs = [], [], []
        chapters = []
        current = None
        for line in lines:
            if self._is_noise_line(line):
                continue
            if re.search(r"(课程目标|教学目标|学习目标|培养目标|目标)", line):
                objectives.extend(self._split_items(line))
                continue
            if re.search(r"(先修|前置|基础要求|预备知识)", line):
                prereqs.extend(self._split_items(line))
                continue
            if re.search(r"(参考|教材|文献|资料)", line):
                refs.append(line)
                continue
            if re.match(
                r"^(第?\s*[一二三四五六七八九十百\d]+\s*[章节篇单元]|"
                r"\d+(?:\.\d+)+\s+.+|"
                r"[一二三四五六七八九十百\d]+[\.、]\s*|"
                r"chapter\s*\d+|unit\s*\d+|module\s*\d+)",
                line,
                re.I,
            ):
                if current:
                    self._finalize_rule_chapter(current)
                current = {"title": line, "description": "", "knowledge_points": [], "teaching_hours": 0, "chapter_type": "theory"}
                title_kp = self._knowledge_point_from_heading(line)
                if title_kp:
                    current["knowledge_points"].append(title_kp)
                chapters.append(current)
                continue
            if current:
                if len(line) > 18 and not current["description"]:
                    current["description"] = line
                    continue
                items = self._extract_kp_candidates_from_line(line)
                for item in items:
                    title = self._summarize_to_kp_title(item)
                    if title and title not in (kp.get("title") for kp in current["knowledge_points"]):
                        current["knowledge_points"].append({"title": title, "description": item if item != title else ""})

        if current:
            self._finalize_rule_chapter(current)

        if not chapters:
            chunks = self._extract_candidate_terms(text)
            if not chunks:
                chunks = self._split_items("；".join(lines))
            fallback_budget = self._build_analysis_budget(text, {
                "chapters": [{"title": "课程核心内容", "knowledge_points": [{"title": item} for item in chunks]}]
            })
            chapters.append({
                "title": "课程核心内容",
                "description": (text or "")[:300],
                "knowledge_points": [{"title": item, "description": ""} for item in chunks[:fallback_budget["total_kp_limit"]]],
                "teaching_hours": 0,
                "chapter_type": "theory",
            })

        result = {
            "course": {"title": getattr(course, "title", "课程"), "description": getattr(course, "description", "")},
            "objectives": [o for o in objectives if len(o) > 2][:12],
            "prerequisites": [p for p in prereqs if len(p) > 1][:10],
            "references": refs[:12],
            "chapters": chapters,
            "raw_text": text or "",
        }
        result["_analysis_budget"] = self._build_analysis_budget(text, result)
        return result

    def _is_noise_line(self, line):
        text = (line or "").strip()
        if not text:
            return True
        if len(text) <= 1:
            return True
        if re.fullmatch(r"[_\-\s\d年月日/\\:.：（）()]+", text):
            return True
        if re.search(r"(姓名|学号|专业|指导教师|评阅人|复核人|得分|目录|目\s*录|第\s*\d+\s*页)", text):
            return True
        if re.search(r"(摘\s*要|关键词|参考文献|致谢)$", text) and len(text) <= 12:
            return True
        return False

    def _knowledge_point_from_heading(self, line):
        text = (line or "").strip()
        if not text:
            return None
        cleaned = re.sub(r"^\d+(?:\.\d+)*[、.．]?\s*", "", text)
        cleaned = re.sub(r"^[一二三四五六七八九十百]+[、.．]?\s*", "", cleaned)
        parts = re.split(r"[:：]", cleaned, maxsplit=1)
        title = parts[0].strip(" -—")
        description = parts[1].strip() if len(parts) > 1 else cleaned
        if len(title) > 48:
            title = title[:48].strip()
        if (
            len(title) < 2
            or self._is_noise_line(title)
            or self._is_pseudo_knowledge_point(title)
            or re.fullmatch(r"(项目方案|研究背景|实施计划|经费预算|团队成员|申报基础)", title)
        ):
            return None
        return {
            "title": title,
            "description": description[:240] if description != title else "",
            "category": "核心知识点",
        }

    def _extract_kp_candidates_from_line(self, line):
        text = (line or "").strip()
        if not text or self._is_noise_line(text):
            return []
        items = self._split_items(text)
        scored = []
        for item in items or [text]:
            item = item.strip(" -:：()（）[]【】")
            score = self._knowledge_signal_score(item)
            if score >= 2:
                scored.append(item)
        return scored[:4]

    def _knowledge_signal_score(self, text):
        if not text:
            return 0
        score = 0
        if 4 <= len(text) <= 36:
            score += 1
        if re.search(r"(概念|原理|机制|方法|模型|体系|策略|流程|结构|特征|关系|影响|问题|路径|优化|发展|安全|现代化|供应链)", text):
            score += 2
        if re.search(r"(掌握|理解|分析|比较|解释|应用|构建|识别|评估|总结|归纳)", text):
            score += 1
        if re.search(r"[。！？!?]{1,}$", text) and len(text) > 45:
            score -= 1
        if re.search(r"(随着|同时|因此|此外|然而|本文|本研究|主要包括|可以看出)", text) and len(text) > 50:
            score -= 1
        if len(text) > 80:
            score -= 2
        return score

    def _summarize_to_kp_title(self, text):
        item = re.sub(r"\s+", " ", str(text or "")).strip(" -:：。；;，,")
        if not item or self._knowledge_signal_score(item) < 2:
            return ""
        item = re.sub(r"^\d+(?:\.\d+)*\s*", "", item)
        item = re.sub(r"^(掌握|理解|了解|熟悉|分析|应用|能够|学会)\s*", "", item)
        if len(item) <= 36:
            return item
        for pattern in [
            r"([^，。；;]{4,36}(?:概念|原理|机制|方法|模型|体系|策略|流程|结构|特征|关系|影响|问题|路径|优化|发展|安全|现代化|供应链))",
            r"([^，。；;]{4,36})",
        ]:
            match = re.search(pattern, item)
            if match:
                return match.group(1).strip()
        return item[:36].strip()

    def _finalize_rule_chapter(self, chapter):
        seen = set()
        cleaned = []
        for kp in chapter.get("knowledge_points", []):
            title = self._summarize_to_kp_title(kp.get("title", ""))
            if not title or title in seen:
                continue
            seen.add(title)
            cleaned.append({
                "title": title,
                "description": kp.get("description", "")[:180],
                "category": "核心知识点",
            })
        if not cleaned and chapter.get("description"):
            for candidate in self._extract_kp_candidates_from_line(chapter["description"]):
                title = self._summarize_to_kp_title(candidate)
                if title and title not in seen:
                    seen.add(title)
                    cleaned.append({"title": title, "description": candidate, "category": "核心知识点"})
        chapter["knowledge_points"] = cleaned

    def _normalize_kp_list(self, key_points):
        result = []
        for kp in key_points or []:
            if isinstance(kp, str):
                result.append({"title": kp, "description": ""})
            elif isinstance(kp, dict):
                result.append({
                    "title": kp.get("title") or kp.get("name") or "",
                    "description": kp.get("description") or kp.get("definition") or "",
                    "category": kp.get("category") or "核心知识点",
                    "related_concepts": kp.get("related_concepts") or kp.get("related") or [],
                })
        return [kp for kp in result if kp["title"]]

    def _normalize_text_list(self, values):
        if values is None:
            return []
        if isinstance(values, str):
            values = self._split_items(values) or [values]
        result = []
        for item in values:
            if isinstance(item, dict):
                text = (
                    item.get("title")
                    or item.get("name")
                    or item.get("objective")
                    or item.get("description")
                    or item.get("content")
                    or item.get("text")
                    or ""
                )
            else:
                text = str(item)
            text = text.strip()
            if text and text not in result:
                result.append(text)
        return result

    def _llm_based_parse(self, text, course):
        """使用 Spark LLM 做深度结构化抽取，提取实体、概念、关系"""
        from src.services.spark_service import spark_service

        prompt = f"""你是一位知识图谱专家。请对以下课程大纲文本进行深度解析，提取实体、概念和关系，输出结构化JSON。

要求：
1. 识别所有核心概念、技能、案例、练习等实体
2. 为每个知识点提取详细描述、难度等级、关联概念
3. 建立知识点间的语义关系（前置依赖、应用关系、评估关系等）
4. 识别跨章节的概念关联

输出JSON格式：
{{
  "title": "课程名称",
  "description": "课程描述",
  "objectives": ["目标1", "目标2"],
  "prerequisites": ["先修1"],
  "chapters": [
    {{
      "title": "章节标题",
      "description": "章节描述",
      "teaching_hours": 4,
      "chapter_type": "theory/practice/mixed",
      "knowledge_points": [
        {{
          "title": "知识点标题",
          "description": "详细描述该知识点的核心内容",
          "category": "核心知识点/基础概念/进阶技能/应用实践",
          "difficulty": "beginner/intermediate/advanced",
          "related_concepts": ["相关概念1", "相关概念2"],
          "applies_to": ["应用场景1"],
          "assessed_by": ["评估方式1"]
        }}
      ]
    }}
  ],
  "cross_chapter_relations": [
    {{"source": "知识点A", "target": "知识点B", "relation": "prerequisite/related/applies_to", "strength": 0.8}}
  ]
}}

大纲文本：
{text[:4000]}

请严格返回JSON，不要添加其他文字。"""

        response = spark_service.chat(
            messages=[{"role": "user", "content": prompt}],
        )
        content = response or ""
        json_match = re.search(r'\{[\s\S]*\}', content)
        if not json_match:
            return None
        data = json.loads(json_match.group())
        # 保存跨章节关系供后续使用
        self._cross_chapter_relations = data.get("cross_chapter_relations", [])
        return self._normalize_structured(json.dumps(data, ensure_ascii=False), course)

    def _read_docx_text(self, content, file_id):
        binary = self._to_binary(content, file_id)
        parts = []

        try:
            doc = Document(io.BytesIO(binary))
            parts.extend(p.text.strip() for p in doc.paragraphs if p.text and p.text.strip())
            for table in doc.tables:
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells if cell.text and cell.text.strip()]
                    if cells:
                        parts.append(" | ".join(cells))
        except Exception as exc:
            logger.warning(f"python-docx extraction failed: {exc}")

        try:
            parts.extend(self._extract_docx_xml_text(binary))
        except Exception as exc:
            logger.warning(f"DOCX XML extraction failed: {exc}")

        deduped = []
        for part in parts:
            text = self._cleanup_extracted_text(part)
            if text and text not in deduped:
                deduped.append(text)
        return "\n".join(deduped)

    def _read_pdf_text(self, content, file_id):
        """解析 PDF 文件内容为纯文本"""
        binary = self._to_binary(content, file_id)

        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=binary, filetype="pdf")
            try:
                text_parts = [page.get_text("text") for page in doc]
                text = "\n".join(t for t in text_parts if t and t.strip())
                if text.strip():
                    return text
            finally:
                doc.close()
        except Exception as exc:
            logger.warning(f"PyMuPDF PDF extraction failed: {exc}")

        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(binary))
            text_parts = [page.extract_text() or "" for page in reader.pages]
            text = "\n".join(t for t in text_parts if t.strip())
            if text.strip():
                return text
        except Exception as exc:
            logger.warning(f"pypdf PDF extraction failed: {exc}")

        raise ValueError("未能从 PDF 中提取到文本，请确认 PDF 不是扫描图片或已加密")

    def _to_binary(self, content, file_id):
        if file_id:
            if hasattr(file_id, "read"):
                pos = None
                try:
                    pos = file_id.tell()
                except Exception:
                    pos = None
                data = file_id.read()
                if pos is not None:
                    try:
                        file_id.seek(pos)
                    except Exception:
                        pass
                return data
            if isinstance(file_id, (bytes, bytearray)):
                return bytes(file_id)
        raw = content or ""
        if isinstance(raw, (bytes, bytearray)):
            return bytes(raw)
        if isinstance(raw, str) and raw.startswith("data:") and "," in raw:
            raw = raw.split(",", 1)[1]
        if isinstance(raw, str):
            try:
                return base64.b64decode(raw, validate=False)
            except Exception:
                return raw.encode("utf-8", errors="ignore")
        return bytes(raw or b"")

    def _extract_docx_xml_text(self, binary):
        with zipfile.ZipFile(io.BytesIO(binary)) as zf:
            text_parts = []
            skip_names = {
                "word/styles.xml",
                "word/settings.xml",
                "word/numbering.xml",
                "word/fontTable.xml",
                "word/webSettings.xml",
            }
            names = [
                name for name in zf.namelist()
                if name.startswith("word/")
                and name.endswith(".xml")
                and name not in skip_names
                and "/_rels/" not in name
            ]
            names.sort(key=lambda name: (name != "word/document.xml", name))
            for name in names:
                text_parts.extend(self._extract_xml_text(zf.read(name)))
            return text_parts

    def _extract_xml_text(self, xml_bytes):
        try:
            root = ET.fromstring(xml_bytes)
        except Exception:
            return []
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        parts = []
        for node in root.findall(".//w:p", ns):
            text = "".join(t.text or "" for t in node.findall(".//w:t", ns))
            text = self._cleanup_extracted_text(text)
            if text:
                parts.append(text)
        return parts

    def _cleanup_extracted_text(self, text):
        cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
        cleaned = cleaned.replace("\u00a0", " ")
        return cleaned

    def _create_source_chunks(self, course_id, normalized):
        chunks = []
        raw_parts = []
        if normalized.get("raw_text"):
            raw_parts.append(("课程大纲原文", normalized["raw_text"]))
        for chapter in normalized.get("chapters", []):
            text = chapter.get("description", "")
            kp_text = "；".join(kp.get("title", "") for kp in chapter.get("knowledge_points", []))
            raw_parts.append((chapter.get("title", "章节"), f"{chapter.get('title', '')}\n{text}\n知识点：{kp_text}"))
        for idx, (title, text) in enumerate(raw_parts, start=1):
            for part_idx, piece in enumerate(self._chunk_text(text), start=1):
                chunk = KnowledgeSourceChunk(
                    course_id=course_id,
                    source_type="syllabus",
                    source_id=f"syllabus:{idx}:{part_idx}",
                    reference_code=f"S{len(chunks) + 1}",
                    title=title,
                    content=piece,
                    location=f"{title} / 片段{part_idx}",
                    metadata_json=json.dumps({"origin": "syllabus_import"}, ensure_ascii=False),
                )
                db.session.add(chunk)
                chunks.append(chunk)
        db.session.flush()
        return chunks

    def _chunk_text(self, text, size=700):
        text = re.sub(r"\s+", " ", text or "").strip()
        if not text:
            return []
        return [text[i:i + size] for i in range(0, len(text), size)]

    def _split_items(self, text):
        cleaned = re.sub(
            r"^(课程目标|教学目标|学习目标|培养目标|目标|先修课程|先修|前置知识|参考资料|参考文献|教材|知识点|重点|难点)\s*[:：]?",
            "",
            text or "",
        ).strip()
        parts = re.split(r"[、,，;；]\s*|\d+[.、)]\s*", cleaned)
        results = []
        for part in parts:
            item = part.strip(" -:：()（）[]【】")
            if 2 <= len(item) <= 80 and item not in results:
                results.append(item)
        return results

    def _extract_candidate_terms(self, text):
        terms = []
        for line in (text or "").splitlines():
            line = line.strip(" \t\r\n#-*•·")
            if not line:
                continue
            if re.search(r"(知识点|重点|难点|掌握|理解|熟悉|了解|应用|实验|实践)", line):
                terms.extend(self._split_items(line))
            elif 2 <= len(line) <= 40 and not re.search(r"[。！？.!?]", line):
                terms.append(line)
        deduped = []
        for term in terms:
            if term and term not in deduped:
                deduped.append(term)
        return deduped[:30]

    def _upsert_node(self, graph_id, course_id, node_type, label, description="", category=None, source_chunk_ids=None, properties=None):
        node_type = node_type if node_type in NODE_TYPES else "knowledge_point"
        label = (label or "").strip()[:200]
        node = KnowledgeGraphNode.query.filter_by(course_id=course_id, node_type=node_type, label=label).first()
        is_new = node is None
        if not node:
            node = KnowledgeGraphNode(course_id=course_id, node_type=node_type, label=label, graph_id=graph_id)
            db.session.add(node)
        node.description = description or node.description
        node.category = category or node.category
        node.source_chunk_ids = json.dumps(source_chunk_ids or [], ensure_ascii=False)
        node.properties = json.dumps(properties or {}, ensure_ascii=False)
        db.session.flush()
        return node, is_new

    def _upsert_edge(self, graph_id, course_id, source_id, target_id, edge_type, weight, confidence, evidence_chunk_ids):
        if source_id == target_id:
            return 0
        edge_type = edge_type if edge_type in EDGE_TYPES else "related"
        edge = KnowledgeGraphEdge.query.filter_by(
            course_id=course_id,
            source_node_id=source_id,
            target_node_id=target_id,
            edge_type=edge_type,
        ).first()
        if edge:
            edge.weight = max(edge.weight or 0, weight)
            edge.confidence = max(edge.confidence or 0, confidence)
            return 0
        db.session.add(KnowledgeGraphEdge(
            graph_id=graph_id,
            course_id=course_id,
            source_node_id=source_id,
            target_node_id=target_id,
            edge_type=edge_type,
            weight=weight,
            confidence=confidence,
            evidence_chunk_ids=json.dumps(evidence_chunk_ids or [], ensure_ascii=False),
        ))
        return 1

    def _chunk_ids_for_text(self, chunks, text):
        text = (text or "").lower()
        if not text:
            return []
        matches = [c.id for c in chunks if text[:30] in (c.content or "").lower()]
        return matches[:3] or ([chunks[0].id] if chunks else [])

    def _infer_cross_chapter_relations(self, graph_id, course_id, kp_nodes, source_chunks):
        """推理跨章节的知识点关联关系"""
        created = 0
        # 1. 使用 LLM 返回的跨章节关系
        cross_relations = getattr(self, '_cross_chapter_relations', [])
        if cross_relations:
            # 构建标签 → 节点映射
            label_to_node = {}
            for node in kp_nodes:
                label_to_node[node.label.strip()] = node
                # 也支持部分匹配
                label_to_node[node.label.strip().lower()] = node

            for rel in cross_relations:
                source_label = rel.get("source", "").strip()
                target_label = rel.get("target", "").strip()
                relation_type = rel.get("relation", "related")
                strength = rel.get("strength", 0.6)

                source_node = label_to_node.get(source_label) or label_to_node.get(source_label.lower())
                target_node = label_to_node.get(target_label) or label_to_node.get(target_label.lower())

                # 模糊匹配：如果精确匹配失败，尝试包含匹配
                if not source_node:
                    for label, node in label_to_node.items():
                        if source_label in label or label in source_label:
                            source_node = node
                            break
                if not target_node:
                    for label, node in label_to_node.items():
                        if target_label in label or label in target_label:
                            target_node = node
                            break

                if source_node and target_node and source_node.id != target_node.id:
                    edge_type = relation_type if relation_type in EDGE_TYPES else "related"
                    weight = min(1.0, max(0.3, strength))
                    created += self._upsert_edge(
                        graph_id, course_id, source_node.id, target_node.id,
                        edge_type, weight, weight * 0.9, []
                    )

        # 2. 基于关键词共现的关联推理
        if len(kp_nodes) > 1:
            created += self._infer_keyword_relations(graph_id, course_id, kp_nodes)

        return created

    def _infer_keyword_relations(self, graph_id, course_id, kp_nodes):
        """基于关键词重叠推理知识点间的关联"""
        created = 0
        # 提取每个知识点的关键词
        node_keywords = {}
        for node in kp_nodes:
            desc = (node.description or "").lower()
            label = (node.label or "").lower()
            # 简单分词：按常见分隔符拆分
            words = set(re.split(r'[，,、；;：:\s]+', desc + ' ' + label))
            words = {w for w in words if len(w) >= 2}
            node_keywords[node.id] = words

        # 计算关键词重叠度
        node_ids = list(node_keywords.keys())
        for i in range(len(node_ids)):
            for j in range(i + 1, len(node_ids)):
                a, b = node_ids[i], node_ids[j]
                kw_a, kw_b = node_keywords[a], node_keywords[b]
                if not kw_a or not kw_b:
                    continue
                overlap = kw_a & kw_b
                if len(overlap) >= 2:
                    # 至少2个共同关键词才建立关联
                    jaccard = len(overlap) / len(kw_a | kw_b)
                    if jaccard >= 0.15:
                        weight = min(0.8, 0.3 + jaccard)
                        created += self._upsert_edge(
                            graph_id, course_id, a, b, "related", weight, weight * 0.85, []
                        )
        return created

    def _infer_semantic_relations(self, graph_id, course_id, kp_nodes, source_chunks):
        """推理语义关系：基于知识点属性建立 applies_to / assesses 关系"""
        created = 0
        # 按类别分组
        core_kps = []
        practice_kps = []
        for node in kp_nodes:
            cat = (node.category or "").lower()
            label = (node.label or "").lower()
            if any(kw in cat or kw in label for kw in ['应用', '实践', '案例', '练习', 'exercise', 'case', 'practice']):
                practice_kps.append(node)
            else:
                core_kps.append(node)

        # 实践类知识点 → 应用于 核心知识点
        for practice_node in practice_kps:
            p_label = (practice_node.label or "").lower()
            p_desc = (practice_node.description or "").lower()
            for core_node in core_kps:
                c_label = (core_node.label or "").lower()
                # 如果实践知识点的标签/描述包含核心知识点的关键词
                if c_label and (c_label in p_label or c_label in p_desc):
                    created += self._upsert_edge(
                        graph_id, course_id, practice_node.id, core_node.id,
                        "applies_to", 0.7, 0.75, []
                    )
                    break  # 每个实践节点只关联最匹配的一个核心节点

        return created

    def _apply_agent_relations(self, graph_id, course_id, kp_nodes, relations):
        node_index = {}
        for node in kp_nodes:
            node_index.setdefault(node.label.strip(), []).append(node)
            node_index.setdefault(node.label.strip().lower(), []).append(node)

        def resolve(label):
            if not label:
                return None
            raw = str(label).strip()
            lower = raw.lower()
            if raw in node_index and node_index[raw]:
                return node_index[raw][0]
            if lower in node_index and node_index[lower]:
                return node_index[lower][0]
            for key, nodes in node_index.items():
                if raw in key or key in raw:
                    return nodes[0]
            return None

        created = 0
        for rel in relations or []:
            source_node = resolve(rel.get("source"))
            target_node = resolve(rel.get("target"))
            if not source_node or not target_node or source_node.id == target_node.id:
                continue
            edge_type = rel.get("relation") if rel.get("relation") in EDGE_TYPES else "related"
            weight = float(rel.get("weight") or 0.6)
            confidence = float(rel.get("confidence") or weight)
            created += self._upsert_edge(
                graph_id,
                course_id,
                source_node.id,
                target_node.id,
                edge_type,
                max(0.3, min(1.0, weight)),
                max(0.3, min(1.0, confidence)),
                [],
            )
        return created

    def _clear_existing_graph(self, course_id, delete_all_chunks=False):
        KnowledgeGraphEdge.query.filter_by(course_id=course_id).delete()
        KnowledgeGraphNode.query.filter_by(course_id=course_id).delete()
        if delete_all_chunks:
            # 彻底清除：删除所有类型的来源片段
            KnowledgeSourceChunk.query.filter_by(course_id=course_id).delete()
        else:
            # 仅清除大纲导入的来源片段
            KnowledgeSourceChunk.query.filter_by(course_id=course_id, source_type="syllabus").delete()
        db.session.flush()

    def _format_node_for_graph(self, node, source_map=None):
        data = node.to_dict(include_sources=True)
        data["label"] = node.label
        data["type"] = node.node_type
        data["size"] = 18 + min(28, int((node.weight or 1) * 10))
        data["color"] = {
            "course": "#2563eb",
            "chapter": "#059669",
            "knowledge_point": "#d97706",
            "objective": "#7c3aed",
            "skill": "#dc2626",
            "case": "#0891b2",
            "exercise": "#4f46e5",
            "resource": "#475569",
        }.get(node.node_type, "#64748b")
        if source_map is not None:
            data["sources"] = [source_map[cid] for cid in data.get("source_chunk_ids", []) if cid in source_map]
        return data

    def _build_metrics(self, nodes, edges):
        by_type = defaultdict(int)
        for node in nodes:
            by_type[node.node_type] += 1
        return {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "node_types": dict(by_type),
            "average_weight": round(sum(e.weight or 0 for e in edges) / max(len(edges), 1), 2),
        }


syllabus_graph_service = SyllabusGraphService()
