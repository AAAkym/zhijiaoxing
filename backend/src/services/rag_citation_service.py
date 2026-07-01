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
    REFERENCE_RE = re.compile(r"\[([A-Z]{1,4}\d+)\]")

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
                    location=f"Knowledge point #{kp.id}",
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
                    location=f"Teaching case #{case.id}",
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
                    location=f"Course exercise #{exercise.id}",
                    url=exercise.source_url,
                    confidence=score,
                ))

        evidence.sort(key=lambda item: item.get("confidence", 0), reverse=True)
        selected = evidence[:top_k]
        for idx, item in enumerate(selected, start=1):
            item["source_id"] = item.get("reference_code") or item.get("source_id") or f"S{idx}"
            if not re.match(r"^[A-Z]{1,4}\d+$", str(item["source_id"])):
                item["source_id"] = f"S{idx}"
        return selected

    def build_evidence_prompt(self, evidence, citation_style="bracket"):
        if not evidence:
            return "No reliable evidence was retrieved. If content is generated, explicitly state that knowledge-base evidence is missing."
        lines = [self._citation_instruction(citation_style)]
        for idx, item in enumerate(evidence, start=1):
            code = item.get("source_id") or f"S{idx}"
            item["source_id"] = code
            lines.append(f"[{code}] {item.get('title', '')} - {item.get('location', '')}: {item.get('excerpt', '')}")
        return "\n".join(lines)

    def verify(self, content, citations, rag_required=False, citation_style="bracket"):
        content_text = self._stringify_content(content)
        citations = citations or []
        citation_ids = {
            str(c.get("source_id") or c.get("reference_code") or "")
            for c in citations
            if c and (c.get("source_id") or c.get("reference_code"))
        }
        used_ids = self._extract_reference_ids(content_text)
        issues = []

        if not citations:
            issues.append({"type": "missing_citations", "message": "Content has no attached citation sources."})
        fake_refs = sorted(used_ids - citation_ids)
        if fake_refs:
            issues.append({"type": "unknown_references", "references": fake_refs})
        unused = sorted(citation_ids - used_ids)
        if citations and unused:
            issues.append({"type": "unused_citations", "references": unused})

        sentences = self._claim_sentences(content_text)
        unsupported = []
        for sentence in sentences[:30]:
            if not self._extract_reference_ids(sentence):
                unsupported.append(sentence[:120])
        coverage = 100 if not sentences else round((len(sentences) - len(unsupported)) / len(sentences) * 100, 1)
        if coverage < 60:
            issues.append({"type": "low_coverage", "message": f"Citation coverage is low: {coverage}%"})
        if unsupported:
            issues.append({
                "type": "unsupported_claims",
                "count": len(unsupported),
                "message": "Content contains claim-like sentences without citation markers.",
            })

        unsupported_claims = [
            {
                "text": claim,
                "status": "unsupported",
                "action": "review" if len(claim) > 40 else "flag",
            }
            for claim in unsupported[:10]
        ]

        degradation = None
        if not citations:
            degradation = "no_citations"
        elif fake_refs:
            degradation = "fake_references"
        elif coverage < 40:
            degradation = "low_coverage"
        elif rag_required and unsupported:
            degradation = "unsupported_claims"

        score = max(0, round(coverage - len(fake_refs) * 15 - (20 if not citations else 0), 1))

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
            "degraded": degradation is not None,
            "rag_required": bool(rag_required),
            "citation_style": citation_style or "bracket",
        }

    def attach_citations(
        self,
        content,
        evidence,
        package_id=None,
        course_id=None,
        resource_type="resource",
        rag_required=False,
        citation_style="bracket",
    ):
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
            if citations and not self._extract_reference_ids(self._stringify_content(enriched)):
                refs = " ".join(f"[{c['source_id']}]" for c in citations[:3] if c.get("source_id"))
                enriched["reference_note"] = f"Generated from course knowledge-base evidence {refs}"
            verification = self.verify(
                enriched,
                citations,
                rag_required=rag_required,
                citation_style=citation_style,
            )
            enriched["citations"] = citations
            enriched["verification_report"] = verification
            enriched["citation_coverage_score"] = verification["citation_coverage_score"]
            enriched["rag_required"] = bool(rag_required)
            enriched["citation_style"] = citation_style or "bracket"
            if verification.get("degradation"):
                enriched["degraded"] = True
                enriched["degradation_reason"] = verification["degradation"]
            return enriched

        if citations and not self._extract_reference_ids(content or ""):
            refs = " ".join(f"[{c['source_id']}]" for c in citations[:3] if c.get("source_id"))
            content = f"{content}\n\nReference evidence: {refs}".strip()
        verification = self.verify(
            content,
            citations,
            rag_required=rag_required,
            citation_style=citation_style,
        )
        result = {
            "content": content,
            "citations": citations,
            "verification_report": verification,
            "citation_coverage_score": verification["citation_coverage_score"],
            "rag_required": bool(rag_required),
            "citation_style": citation_style or "bracket",
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

    def _extract_reference_ids(self, text):
        return set(self.REFERENCE_RE.findall(text or ""))

    def _claim_sentences(self, text):
        raw_sentences = re.split(r"[。！？!?；;\n]+", text or "")
        claims = []
        for sentence in raw_sentences:
            cleaned = re.sub(r"\s+", " ", sentence).strip()
            if len(cleaned) <= 10:
                continue
            if cleaned.startswith("{") or cleaned.startswith("["):
                continue
            claims.append(cleaned)
        return claims

    def _citation_instruction(self, citation_style):
        style = (citation_style or "bracket").lower()
        if style == "footnote":
            return "Generate content strictly from the evidence below. Put bracket citation codes like [S1] after supported claims; the renderer may convert them to footnotes."
        if style == "inline":
            return "Generate content strictly from the evidence below. Include inline bracket citation codes like [S1] after each supported claim."
        return "Generate content strictly from the evidence below. Cite supported claims with bracket markers like [S1]."

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
