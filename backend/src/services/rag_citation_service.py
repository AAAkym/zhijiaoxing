import json
import re
from collections import Counter

from src.models.knowledge_base import (
    CourseExercise,
    GenerationCitation,
    KnowledgePoint,
    KnowledgeSourceChunk,
    TeachingCase,
)
from src.models.user import db


class RagCitationService:
    def retrieve(self, course_id, query, chapter_ids=None, knowledge_point_ids=None, top_k=6):
        query = (query or "").strip()
        top_k = max(1, min(int(top_k or 6), 12))
        evidence = []

        chunks = KnowledgeSourceChunk.query.filter_by(course_id=course_id).all()
        for chunk in chunks:
            score = self._score_text(query, f"{chunk.title} {chunk.content}")
            if score > 0:
                item = chunk.to_dict()
                item["confidence"] = score
                evidence.append(item)

        kp_query = KnowledgePoint.query.filter_by(course_id=course_id)
        if chapter_ids:
            kp_query = kp_query.filter(KnowledgePoint.chapter_id.in_(chapter_ids))
        if knowledge_point_ids:
            kp_query = kp_query.filter(KnowledgePoint.id.in_(knowledge_point_ids))
        for kp in kp_query.limit(120).all():
            text = " ".join(filter(None, [kp.title, kp.definition, kp.content, kp.tags]))
            score = self._score_text(query, text)
            if score > 0:
                evidence.append(self._model_evidence(
                    source_id=f"KP{kp.id}",
                    source_type="knowledge_point",
                    title=kp.title,
                    excerpt=(kp.definition or kp.content or "")[:500],
                    location=f"知识点 #{kp.id}",
                    url=kp.source_url,
                    confidence=score,
                    source_chunk_id=None,
                ))

        for case in TeachingCase.query.filter_by(course_id=course_id).limit(80).all():
            text = " ".join(filter(None, [case.title, case.background, case.problem_description, case.analysis, case.conclusion]))
            score = self._score_text(query, text)
            if score > 0:
                evidence.append(self._model_evidence(
                    source_id=f"TC{case.id}",
                    source_type="teaching_case",
                    title=case.title,
                    excerpt=(case.background or case.problem_description or case.analysis or "")[:500],
                    location=f"教学案例 #{case.id}",
                    url=case.source_url,
                    confidence=score,
                ))

        for exercise in CourseExercise.query.filter_by(course_id=course_id).limit(120).all():
            text = " ".join(filter(None, [exercise.title, exercise.content, exercise.answer_analysis, exercise.knowledge_tags]))
            score = self._score_text(query, text)
            if score > 0:
                evidence.append(self._model_evidence(
                    source_id=f"EX{exercise.id}",
                    source_type="exercise",
                    title=exercise.title,
                    excerpt=(exercise.content or "")[:500],
                    location=f"课程习题 #{exercise.id}",
                    url=exercise.source_url,
                    confidence=score,
                ))

        evidence.sort(key=lambda item: item.get("confidence", 0), reverse=True)
        selected = evidence[:top_k]
        for idx, item in enumerate(selected, start=1):
            item["source_id"] = item.get("reference_code") or item.get("source_id") or f"S{idx}"
            if not re.match(r"^[A-Z]{1,3}\d+$", str(item["source_id"])):
                item["source_id"] = f"S{idx}"
        return selected

    def build_evidence_prompt(self, evidence):
        if not evidence:
            return "未检索到可靠证据。生成内容时必须明确说明缺少知识库依据。"
        lines = ["请严格依据以下证据生成，并在相关句子后使用 [S1] 这样的引用标记："]
        for idx, item in enumerate(evidence, start=1):
            code = item.get("source_id") or f"S{idx}"
            item["source_id"] = code
            lines.append(f"[{code}] {item.get('title', '')}｜{item.get('location', '')}：{item.get('excerpt', '')}")
        return "\n".join(lines)

    def verify(self, content, citations):
        content_text = self._stringify_content(content)
        citations = citations or []
        citation_ids = {str(c.get("source_id") or c.get("reference_code") or "") for c in citations if c}
        used_ids = set(re.findall(r"\[([A-Z]{1,3}\d+)\]", content_text))
        issues = []

        if not citations:
            issues.append({"type": "missing_citations", "message": "内容未附带引用来源"})
        fake_refs = sorted(used_ids - citation_ids)
        if fake_refs:
            issues.append({"type": "unknown_references", "references": fake_refs})
        unused = sorted(citation_ids - used_ids)
        if citations and unused:
            issues.append({"type": "unused_citations", "references": unused})

        sentences = [s.strip() for s in re.split(r"[。！？!?]\s*", content_text) if len(s.strip()) > 18]
        unsupported = []
        for sentence in sentences[:30]:
            if not re.search(r"\[[A-Z]{1,3}\d+\]", sentence):
                unsupported.append(sentence[:120])
        coverage = 100 if not sentences else round((len(sentences) - len(unsupported)) / len(sentences) * 100, 1)
        if coverage < 60:
            issues.append({"type": "low_coverage", "message": f"引用覆盖率较低：{coverage}%"})

        # 标记无引用内容为 unsupported
        unsupported_claims = []
        for claim in unsupported[:10]:
            unsupported_claims.append({
                "text": claim,
                "status": "unsupported",
                "action": "review" if len(claim) > 40 else "flag",
            })

        # 自动降级逻辑
        degradation = None
        if not citations:
            degradation = "no_citations"
        elif fake_refs:
            degradation = "fake_references"
        elif coverage < 40:
            degradation = "low_coverage"

        score = max(0, round(coverage - len(fake_refs) * 15 - (20 if not citations else 0), 1))

        # 状态判定：加入降级逻辑
        if degradation == "no_citations" or score < 30:
            status = "failed"
        elif degradation or score < 60:
            status = "needs_review"
        else:
            status = "passed"

        return {
            "status": status,
            "unsupported_claims": unsupported_claims,
            "citation_issues": issues,
            "score": score,
            "citation_coverage_score": coverage,
            "degradation": degradation,
        }

    def attach_citations(self, content, evidence, package_id=None, course_id=None, resource_type="resource"):
        citations = []
        for item in evidence or []:
            citation = {
                "source_id": item.get("source_id") or item.get("reference_code"),
                "source_type": item.get("source_type"),
                "title": item.get("title"),
                "excerpt": item.get("excerpt") or item.get("content", "")[:500],
                "location": item.get("location"),
                "url": item.get("url"),
                "confidence": item.get("confidence", 0.75),
                "source_chunk_id": item.get("id") if item.get("source_type") == "syllabus" else item.get("source_chunk_id"),
            }
            citations.append(citation)
            if package_id:
                db.session.add(GenerationCitation(
                    package_id=package_id,
                    course_id=course_id,
                    resource_type=resource_type,
                    source_chunk_id=citation.get("source_chunk_id"),
                    source_type=citation.get("source_type"),
                    title=citation.get("title"),
                    excerpt=citation.get("excerpt"),
                    location=citation.get("location"),
                    url=citation.get("url"),
                    confidence=citation.get("confidence"),
                ))
        if package_id:
            db.session.commit()

        if isinstance(content, dict):
            enriched = dict(content)
            if citations and "[S" not in self._stringify_content(enriched):
                refs = " ".join(f"[{c['source_id']}]" for c in citations[:3] if c.get("source_id"))
                enriched["reference_note"] = f"本资源生成参考课程知识库证据 {refs}"
            verification = self.verify(enriched, citations)
            enriched["citations"] = citations
            enriched["verification_report"] = verification
            enriched["citation_coverage_score"] = verification["citation_coverage_score"]
            if verification.get("degradation"):
                enriched["degraded"] = True
                enriched["degradation_reason"] = verification["degradation"]
            return enriched
        if citations and "[S" not in (content or ""):
            refs = " ".join(f"[{c['source_id']}]" for c in citations[:3] if c.get("source_id"))
            content = f"{content}\n\n参考依据：{refs}".strip()
        verification = self.verify(content, citations)
        result = {
            "content": content,
            "citations": citations,
            "verification_report": verification,
            "citation_coverage_score": verification["citation_coverage_score"],
        }
        if verification.get("degradation"):
            result["degraded"] = True
            result["degradation_reason"] = verification["degradation"]
        return result

    def _score_text(self, query, text):
        query_tokens = self._tokens(query)
        text_tokens = self._tokens(text)
        if not text_tokens:
            return 0
        if not query_tokens:
            return 0.3
        counts = Counter(text_tokens)
        overlap = sum(counts[t] for t in query_tokens if t in counts)
        if overlap == 0 and query.lower() not in (text or "").lower():
            return 0
        return round(min(0.98, 0.35 + overlap / max(len(query_tokens), 1) * 0.45), 2)

    def _tokens(self, text):
        text = (text or "").lower()
        latin = re.findall(r"[a-zA-Z0-9_]+", text)
        cjk = re.findall(r"[\u4e00-\u9fff]{2,}", text)
        grams = []
        for block in cjk:
            grams.extend(block[i:i + 2] for i in range(max(1, len(block) - 1)))
        return latin + grams

    def _model_evidence(self, source_id, source_type, title, excerpt, location, url=None, confidence=0.5, source_chunk_id=None):
        return {
            "source_id": source_id,
            "source_type": source_type,
            "title": title,
            "excerpt": excerpt,
            "location": location,
            "url": url,
            "confidence": confidence,
            "source_chunk_id": source_chunk_id,
        }

    def _stringify_content(self, content):
        if isinstance(content, str):
            return content
        return json.dumps(content, ensure_ascii=False)


rag_citation_service = RagCitationService()
