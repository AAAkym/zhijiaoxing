import json
import logging
import random
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask import Blueprint, Response, current_app, jsonify, request, session
from src.utils.auth import require_auth
from sqlalchemy import func, or_

from src.models.course import (
    Assessment,
    Course,
    LearningProgress,
    MistakeRecord,
    PracticeEvaluation,
    StudyNote,
)
from src.models.user import db
from src.services.mistake_intelligence_service import (
    ERROR_TYPE_META,
    build_knowledge_graph,
    build_targeted_practice_plan,
    calc_practice_feedback,
    classify_error_reason,
    normalize_option_answer,
)
from src.services.spark_service import spark_service
from src.services.export_service import generate_pdf, generate_docx
from src.services.targeted_practice_service import (
    generate_ai_targeted_practice,
    get_programming_mistake_detail,
)

logger = logging.getLogger(__name__)
mistake_book_bp = Blueprint("mistake_book", __name__)


def _is_redundant_analysis_text(text: str) -> bool:
    if not text:
        return False
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("##")]
    normalized = []
    for line in lines:
        compact = "".join(ch for ch in line.lower() if ch.isalnum())
        if len(compact) >= 10:
            normalized.append(compact)
    if len(normalized) < 3:
        return False
    return (len(normalized) - len(set(normalized))) >= 2


def _safe_json_loads(value: Any, default: Any):
    if value is None:
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _extract_question_content(question: Any) -> str:
    if isinstance(question, dict):
        return question.get("content") or question.get("question") or ""
    return str(question or "")


def _extract_knowledge_tags(question: Any) -> List[str]:
    if not isinstance(question, dict):
        return []
    tags = question.get("knowledge_tags") or question.get("tags") or []
    if isinstance(tags, str):
        return [tags.strip()] if tags.strip() else []
    if isinstance(tags, list):
        result = []
        for tag in tags:
            if isinstance(tag, dict):
                tag_str = str(tag.get('name', tag.get('label', tag.get('tag', str(tag)))))
                if tag_str.strip():
                    result.append(tag_str.strip())
            elif tag is not None:
                tag_str = str(tag).strip()
                if tag_str:
                    result.append(tag_str)
        return result
    return []


def _is_answer_correct(user_ans: Any, correct_ans: Any) -> bool:
    if user_ans is None and correct_ans is None:
        return True
    if user_ans is None or correct_ans is None:
        return False
    return str(user_ans).strip().lower() == str(correct_ans).strip().lower()


def _get_original_question(mistake: MistakeRecord) -> Optional[Dict[str, Any]]:
    if not mistake.assessment or mistake.question_index is None:
        return None
    questions = _safe_json_loads(mistake.assessment.questions, [])
    if not isinstance(questions, list):
        return None
    if 0 <= mistake.question_index < len(questions):
        q = questions[mistake.question_index]
        if isinstance(q, dict):
            return q
    return None


def _sync_choice_answers_for_mistake(mistake: MistakeRecord) -> Dict[str, Any]:
    q = _get_original_question(mistake)
    options = q.get("options", []) if isinstance(q, dict) else []
    explanation = q.get("explanation") or q.get("analysis") if isinstance(q, dict) else None

    user_res = normalize_option_answer(mistake.user_answer, options)
    correct_res = normalize_option_answer(mistake.correct_answer, options)

    changed = False
    if options and user_res.normalized != (mistake.user_answer or "").strip():
        mistake.user_answer = user_res.normalized
        changed = True
    if options and correct_res.normalized != (mistake.correct_answer or "").strip():
        mistake.correct_answer = correct_res.normalized
        changed = True

    return {
        "changed": changed,
        "options": options,
        "explanation": explanation,
        "user": user_res,
        "correct": correct_res,
    }


def _ensure_error_classification(mistake: MistakeRecord, sync: Optional[Dict[str, Any]] = None) -> bool:
    sync = sync or _sync_choice_answers_for_mistake(mistake)
    if mistake.error_type_auto and mistake.error_reason_detail:
        return False
    result = classify_error_reason(
        question_content=mistake.question_content or "",
        user_answer_display=sync["user"].display,
        correct_answer_display=sync["correct"].display,
        ai_analysis=mistake.ai_analysis,
        explanation=sync.get("explanation"),
    )
    mistake.error_type_auto = result["auto_type"]
    mistake.error_type_confidence = result["confidence"]
    mistake.error_reason_detail = result["detail"]
    return True


def _extract_mistakes_core(user_id: int, assessment: Assessment, user_answer_payload: Any) -> List[MistakeRecord]:
    questions = _safe_json_loads(assessment.questions, [])
    answers = _safe_json_loads(assessment.answers, [])
    user_answers = _safe_json_loads(user_answer_payload, [])
    if not isinstance(questions, list):
        return []
    if not isinstance(user_answers, list):
        user_answers = [user_answers]

    extracted = []
    for idx, question in enumerate(questions):
        if idx >= len(user_answers):
            continue
        user_ans = user_answers[idx]
        correct_ans = answers[idx] if idx < len(answers) else None
        if _is_answer_correct(user_ans, correct_ans):
            existing_correct = MistakeRecord.query.filter_by(
                user_id=user_id,
                assessment_id=assessment.id,
                question_index=idx,
            ).first()
            if existing_correct and existing_correct.mastery_status != 'mastered':
                existing_correct.mastery_status = 'mastered'
            continue

        options = question.get("options", []) if isinstance(question, dict) else []
        normalized_user = normalize_option_answer(user_ans, options).normalized
        normalized_correct = normalize_option_answer(correct_ans, options).normalized if correct_ans is not None else ""

        existing = MistakeRecord.query.filter_by(
            user_id=user_id,
            assessment_id=assessment.id,
            question_index=idx,
        ).first()
        if existing:
            existing.mistake_count += 1
            existing.last_mistake_at = datetime.utcnow()
            existing.user_answer = normalized_user
            if existing.mastery_status == "mastered":
                existing.mastery_status = "reviewing"
            elif existing.mastery_status == "reviewing":
                existing.mastery_status = "unmastered"
            extracted.append(existing)
            continue

        created = MistakeRecord(
            user_id=user_id,
            course_id=assessment.course_id,
            assessment_id=assessment.id,
            question_index=idx,
            question_content=_extract_question_content(question),
            user_answer=normalized_user,
            correct_answer=normalized_correct,
            mistake_count=1,
            last_mistake_at=datetime.utcnow(),
            mastery_status="unmastered",
            knowledge_tags=json.dumps(_extract_knowledge_tags(question), ensure_ascii=False),
        )
        db.session.add(created)
        extracted.append(created)

    return extracted


def _base_query(user_id: int, course_id: Optional[int] = None):
    query = MistakeRecord.query.filter_by(user_id=user_id)
    if course_id:
        query = query.filter_by(course_id=course_id)
    return query


@mistake_book_bp.route("/mistakes", methods=["GET"])
@require_auth
def get_mistakes():
    try:
        user_id = session["user_id"]
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        course_id = request.args.get("course_id", type=int)
        mastery_status = request.args.get("mastery_status")
        keyword = request.args.get("keyword", "").strip()

        query = _base_query(user_id, course_id=course_id)
        if mastery_status in {"unmastered", "reviewing", "mastered"}:
            query = query.filter_by(mastery_status=mastery_status)
        if keyword:
            query = query.filter(
                or_(
                    MistakeRecord.question_content.contains(keyword),
                    MistakeRecord.knowledge_tags.contains(keyword),
                )
            )

        pagination = query.order_by(MistakeRecord.last_mistake_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

        changed = False
        payload = []
        for mistake in pagination.items:
            sync = _sync_choice_answers_for_mistake(mistake)
            changed = sync["changed"] or changed
            changed = _ensure_error_classification(mistake, sync) or changed
            payload.append(mistake.to_dict(include_resolved_answers=True))
        if changed:
            db.session.commit()

        return jsonify(
            {
                "mistakes": payload,
                "total": pagination.total,
                "page": page,
                "per_page": per_page,
                "total_pages": pagination.pages,
            }
        ), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>", methods=["GET"])
@require_auth
def get_mistake_detail(mistake_id):
    try:
        user_id = session["user_id"]
        mistake = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        if not mistake:
            return jsonify({"error": "Mistake record not found"}), 404
        sync = _sync_choice_answers_for_mistake(mistake)
        changed = sync["changed"]
        changed = _ensure_error_classification(mistake, sync) or changed
        if changed:
            db.session.commit()
        result = mistake.to_dict(include_resolved_answers=True)
        if mistake.note_id:
            note = StudyNote.query.get(mistake.note_id)
            if note:
                result["note"] = note.to_dict()
        return jsonify({"mistake": result}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>/status", methods=["PUT"])
@require_auth
def update_mistake_status(mistake_id):
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        new_status = data.get("mastery_status")
        if new_status not in {"unmastered", "reviewing", "mastered"}:
            return jsonify({"error": "Invalid mastery_status"}), 400
        mistake = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        if not mistake:
            return jsonify({"error": "Mistake record not found"}), 404
        mistake.mastery_status = new_status
        if new_status == "mastered":
            mistake.note_id = data.get("note_id")
        mistake.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Status updated", "mistake": mistake.to_dict(include_resolved_answers=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/extract", methods=["POST"])
@require_auth
def extract_mistakes():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        practice_id = data.get("practice_evaluation_id")
        if not practice_id:
            return jsonify({"error": "practice_evaluation_id is required"}), 400
        practice = PracticeEvaluation.query.filter_by(id=practice_id, user_id=user_id).first()
        if not practice:
            return jsonify({"error": "Practice evaluation not found"}), 404
        assessment = Assessment.query.get(practice.assessment_id)
        if not assessment:
            return jsonify({"error": "Assessment not found"}), 404
        mistakes = _extract_mistakes_core(user_id, assessment, practice.user_answer)
        db.session.commit()
        return jsonify({"message": f"Successfully extracted {len(mistakes)} mistake(s)", "extracted_count": len(mistakes), "mistakes": [m.to_dict(include_resolved_answers=True) for m in mistakes]}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/stats", methods=["GET"])
@require_auth
def get_mistake_stats():
    try:
        user_id = session["user_id"]
        course_id = request.args.get("course_id", type=int)
        query = _base_query(user_id, course_id=course_id)
        mistakes = query.all()

        status_stats = {"unmastered": 0, "reviewing": 0, "mastered": 0}
        knowledge_point_stats: Dict[str, int] = {}
        error_type_stats: Dict[str, int] = {}
        for mistake in mistakes:
            status_stats[mistake.mastery_status if mistake.mastery_status in status_stats else "unmastered"] += 1
            error_type = mistake.error_type_manual or mistake.error_type_auto or "other"
            error_type_stats[error_type] = error_type_stats.get(error_type, 0) + 1
            tags = _safe_json_loads(mistake.knowledge_tags, [])
            if isinstance(tags, str):
                tags = [tags]
            if isinstance(tags, list):
                for tag in tags:
                    if isinstance(tag, dict):
                        tag_text = str(tag.get('name', tag.get('label', tag.get('tag', str(tag))))).strip()
                    elif tag is not None:
                        tag_text = str(tag).strip()
                    else:
                        tag_text = ''
                    if tag_text:
                        knowledge_point_stats[tag_text] = knowledge_point_stats.get(tag_text, 0) + 1

        course_query = db.session.query(Course.id, Course.title, func.count(MistakeRecord.id).label("count")).join(MistakeRecord).filter(MistakeRecord.user_id == user_id)
        if course_id:
            course_query = course_query.filter(MistakeRecord.course_id == course_id)
        by_course = course_query.group_by(Course.id, Course.title).all()

        recent = query.order_by(MistakeRecord.created_at.desc()).limit(5).all()
        today_review = db.session.query(func.count(MistakeRecord.id)).filter(MistakeRecord.user_id == user_id, MistakeRecord.mastery_status.in_(["unmastered", "reviewing"])).scalar() or 0

        return jsonify(
            {
                "stats": {
                    "total_mistakes": len(mistakes),
                    "by_status": status_stats,
                    "by_course": [{"course_id": c.id, "course_title": c.title, "count": c.count} for c in by_course],
                    "by_knowledge_point": knowledge_point_stats,
                    "by_error_type": error_type_stats,
                    "today_review": today_review,
                },
                "recent_mistakes": [m.to_dict(include_resolved_answers=True) for m in recent],
            }
        ), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>", methods=["DELETE"])
@require_auth
def delete_mistake(mistake_id):
    try:
        user_id = session["user_id"]
        mistake = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        if not mistake:
            return jsonify({"error": "Mistake not found"}), 404
        db.session.delete(mistake)
        db.session.commit()
        return jsonify({"message": "Mistake deleted", "id": mistake_id}), 200
    except Exception as e:
        logger.error(f"Delete mistake error: {e}")
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/batch-delete", methods=["POST"])
@require_auth
def batch_delete_mistakes():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        ids = data.get("ids", [])
        if not ids:
            return jsonify({"error": "No IDs provided"}), 400
        deleted = MistakeRecord.query.filter(
            MistakeRecord.id.in_(ids), MistakeRecord.user_id == user_id
        ).delete(synchronize_session=False)
        db.session.commit()
        return jsonify({"message": f"Deleted {deleted} mistakes", "deleted_count": deleted}), 200
    except Exception as e:
        logger.error(f"Batch delete mistakes error: {e}")
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/review/start", methods=["POST"])
@require_auth
def start_review():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        course_id = data.get("course_id")
        mastery_status = data.get("mastery_status")
        limit = max(1, min(50, int(data.get("limit", 10))))

        query = _base_query(user_id, course_id=course_id)
        if mastery_status in {"unmastered", "reviewing", "mastered"}:
            query = query.filter_by(mastery_status=mastery_status)
        mistakes = query.all()
        if not mistakes:
            return jsonify({"message": "No mistakes available for review", "questions": [], "total": 0}), 200

        weighted = []
        for m in mistakes:
            w = {"reviewing": 3.0, "unmastered": 2.0, "mastered": 0.3}.get(m.mastery_status, 1.0)
            w *= 1 + m.mistake_count * 0.2
            weighted.append((m, w))

        random.shuffle(weighted)
        weighted.sort(key=lambda item: item[1], reverse=True)
        selected = [item[0] for item in weighted[:limit]]
        questions = []
        for m in selected:
            sync = _sync_choice_answers_for_mistake(m)
            _ensure_error_classification(m, sync)
            payload = m.to_dict(include_resolved_answers=True)
            payload["mistake_id"] = m.id
            payload["explanation"] = sync.get("explanation")
            questions.append(payload)
        db.session.commit()
        session["review_session"] = {"mistake_ids": [m.id for m in selected], "started_at": datetime.utcnow().isoformat(), "total": len(selected)}
        return jsonify({"message": "Review session started", "questions": questions, "total": len(questions), "session_id": datetime.utcnow().strftime("%Y%m%d%H%M%S")}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/review/submit", methods=["POST"])
@require_auth
def submit_review():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        results = data.get("results")
        if not isinstance(results, list) or not results:
            return jsonify({"error": "results must be a non-empty array"}), 400

        updated, correct_count, incorrect_count = [], 0, 0
        for result in results:
            mistake_id = result.get("mistake_id")
            if not mistake_id:
                continue
            m = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
            if not m:
                continue
            is_correct = bool(result.get("is_correct"))
            if is_correct:
                correct_count += 1
                if m.mastery_status == "unmastered":
                    m.mastery_status = "reviewing"
                elif m.mastery_status == "reviewing":
                    m.mastery_status = "mastered"
            else:
                incorrect_count += 1
                m.mistake_count += 1
                m.last_mistake_at = datetime.utcnow()
                if m.mastery_status == "mastered":
                    m.mastery_status = "reviewing"
                elif m.mastery_status == "reviewing":
                    m.mastery_status = "unmastered"

            if result.get("user_answer") is not None:
                q = _get_original_question(m)
                options = q.get("options", []) if q else []
                m.user_answer = normalize_option_answer(result.get("user_answer"), options).normalized
            m.updated_at = datetime.utcnow()
            sync = _sync_choice_answers_for_mistake(m)
            _ensure_error_classification(m, sync)
            updated.append(m.to_dict(include_resolved_answers=True))

        db.session.commit()
        if "review_session" in session:
            session.pop("review_session")
        total = correct_count + incorrect_count
        accuracy = round((correct_count / total * 100), 2) if total else 0
        return jsonify({"message": "Review submitted successfully", "summary": {"total": total, "correct": correct_count, "incorrect": incorrect_count, "accuracy": accuracy}, "updated_mistakes": updated, "still_need_review": [m for m in updated if m.get("mastery_status") in {"unmastered", "reviewing"}], "mastered_in_session": [m for m in updated if m.get("mastery_status") == "mastered"]}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/review/history", methods=["GET"])
@require_auth
def get_review_history():
    try:
        user_id = session["user_id"]
        page = request.args.get("page", 1, type=int)
        per_page = request.args.get("per_page", 20, type=int)
        records = LearningProgress.query.filter_by(user_id=user_id).filter(LearningProgress.activity_type == "mistake_review").order_by(LearningProgress.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({"history": [r.to_dict() for r in records.items], "total": records.total, "page": page, "per_page": per_page, "total_pages": records.pages}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>/analyze", methods=["POST"])
@require_auth
def analyze_mistake(mistake_id):
    try:
        user_id = session["user_id"]
        m = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        if not m:
            return jsonify({"error": "Mistake record not found"}), 404
        sync = _sync_choice_answers_for_mistake(m)
        analysis = spark_service.analyze_mistake(question_content=m.question_content, user_answer=sync["user"].display, correct_answer=sync["correct"].display, knowledge_tags=_safe_json_loads(m.knowledge_tags, []), course_title=m.course.title if m.course else None, explanation=sync.get("explanation"), user_id=session.get('user_id'), user_role=session.get('user_role'))
        classify = classify_error_reason(question_content=m.question_content, user_answer_display=sync["user"].display, correct_answer_display=sync["correct"].display, ai_analysis=analysis, explanation=sync.get("explanation"))
        m.ai_analysis = analysis
        m.error_type_auto = classify["auto_type"]
        m.error_type_confidence = classify["confidence"]
        if not m.error_type_manual:
            m.error_reason_detail = classify["detail"]
        m.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Analysis completed successfully", "analysis": analysis, "classification": classify, "mistake": m.to_dict(include_resolved_answers=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>/analyze/stream", methods=["POST"])
@require_auth
def analyze_mistake_stream(mistake_id):
    try:
        user_id = session["user_id"]
        m = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        if not m:
            return jsonify({"error": "Mistake record not found"}), 404
        sync = _sync_choice_answers_for_mistake(m)
        # 修复：在生成器外预先获取 course_title，避免延迟加载问题
        course_title_value = m.course.title if m.course else None
        question_content_value = m.question_content
        knowledge_tags_value = _safe_json_loads(m.knowledge_tags, [])
        explanation_value = sync.get("explanation")
        mistake_id_value = m.id
        session_user_id = session.get('user_id')
        session_user_role = session.get('user_role')
        # 修复：在生成器外捕获实际app对象，current_app是LocalProxy，在生成器内无法解析
        app_ref = current_app._get_current_object()

        def generate():
            full_text = ""
            # 修复：使用实际app对象创建应用上下文
            with app_ref.app_context():
                try:
                    for chunk in spark_service.analyze_mistake_stream(question_content=question_content_value, user_answer=sync["user"].display, correct_answer=sync["correct"].display, knowledge_tags=knowledge_tags_value, course_title=course_title_value, explanation=explanation_value, user_id=session_user_id, user_role=session_user_role):
                        full_text += chunk
                        yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                    if _is_redundant_analysis_text(full_text):
                        regenerated = spark_service.analyze_mistake(
                            question_content=question_content_value,
                            user_answer=sync["user"].display,
                            correct_answer=sync["correct"].display,
                            knowledge_tags=knowledge_tags_value,
                            course_title=course_title_value,
                            explanation=explanation_value,
                            user_id=session_user_id,
                            user_role=session_user_role,
                        )
                        if regenerated and regenerated.strip():
                            full_text = regenerated
                            yield f"data: {json.dumps({'meta': '检测到重复内容，已自动重新分析并替换结果', 'replace': full_text}, ensure_ascii=False)}\n\n"
                    classify = classify_error_reason(question_content=question_content_value, user_answer_display=sync["user"].display, correct_answer_display=sync["correct"].display, ai_analysis=full_text, explanation=explanation_value)
                    updated = MistakeRecord.query.get(mistake_id_value)
                    if updated:
                        updated.ai_analysis = full_text
                        updated.error_type_auto = classify["auto_type"]
                        updated.error_type_confidence = classify["confidence"]
                        if not updated.error_type_manual:
                            updated.error_reason_detail = classify["detail"]
                        updated.updated_at = datetime.utcnow()
                        db.session.commit()
                        logger.info(f"[Stream Analysis] 分析结果已保存到数据库: mistake_id={mistake_id_value}")
                    yield f"data: {json.dumps({'done': True, 'analysis': full_text, 'classification': classify}, ensure_ascii=False)}\n\n"
                except Exception as e:
                    logger.error(f"流式分析异常: {str(e)}", exc_info=True)
                    try:
                        db.session.rollback()
                    except Exception:
                        pass
                    yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

        return Response(generate(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>/programming-detail", methods=["GET"])
def get_programming_detail(mistake_id):
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Authentication required"}), 401
        result = get_programming_mistake_detail(mistake_id)
        if not result:
            return jsonify({"error": "Mistake not found"}), 404
        if result.get("user_id") != user_id:
            return jsonify({"error": "Access denied"}), 403
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Get programming detail error: {e}")
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/export", methods=["POST"])
@require_auth
def export_mistakes():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        export_format = data.get("format", "pdf")
        template = data.get("template", "detailed")
        export_mode = data.get("export_mode", "full")
        exclude_careless = data.get("exclude_careless", False)
        course_id = data.get("course_id")
        mastery_status = data.get("mastery_status")
        error_type = data.get("error_type")
        date_from = data.get("date_from")
        date_to = data.get("date_to")
        mistake_ids = data.get("mistake_ids")

        query = MistakeRecord.query.filter_by(user_id=user_id)

        if mistake_ids and isinstance(mistake_ids, list):
            query = query.filter(MistakeRecord.id.in_(mistake_ids))
        else:
            if course_id and str(course_id).strip() and str(course_id) != "all":
                try:
                    query = query.filter_by(course_id=int(course_id))
                except (ValueError, TypeError):
                    pass
            if mastery_status and mastery_status.strip() and mastery_status != "all":
                query = query.filter_by(mastery_status=mastery_status)
            if error_type and error_type.strip() and error_type != "all":
                query = query.filter(
                    db.or_(
                        MistakeRecord.error_type_auto == error_type,
                        MistakeRecord.error_type_manual == error_type,
                    )
                )

            if exclude_careless:
                query = query.filter(
                    db.and_(
                        MistakeRecord.error_type_auto != "careless",
                        MistakeRecord.error_type_manual != "careless",
                    )
                )
            if date_from and date_from.strip():
                try:
                    dt_from = datetime.fromisoformat(date_from)
                    query = query.filter(MistakeRecord.created_at >= dt_from)
                except ValueError:
                    pass
            if date_to and date_to.strip():
                try:
                    dt_to = datetime.fromisoformat(date_to)
                    query = query.filter(MistakeRecord.created_at <= dt_to)
                except ValueError:
                    pass

        mistakes = query.order_by(MistakeRecord.created_at.desc()).all()
        if not mistakes:
            return jsonify({"error": "No mistake records found for the selected criteria", "suggestion": "Try adjusting your filters or select specific mistakes from the list"}), 404

        mistakes_data = []
        for m in mistakes:
            sync = _sync_choice_answers_for_mistake(m)
            _ensure_error_classification(m, sync)
            d = m.to_dict(include_resolved_answers=True)
            mistakes_data.append(d)

        if export_format == "word":
            file_bytes = generate_docx(mistakes_data, template=template, export_mode=export_mode)
            filename = f"mistake_book_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
            mimetype = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        else:
            file_bytes = generate_pdf(mistakes_data, template=template, export_mode=export_mode)
            filename = f"mistake_book_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            mimetype = "application/pdf"

        return Response(
            file_bytes,
            mimetype=mimetype,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Type": mimetype,
            },
        )
    except Exception as e:
        logger.error(f"Export mistakes error: {e}")
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/targeted-practice/generate", methods=["POST"])
@require_auth
def generate_targeted_practice_questions():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        course_id = data.get("course_id")
        question_count = min(20, max(5, int(data.get("question_count", 10))))

        mistakes = _base_query(user_id, course_id=course_id).all()
        if not mistakes:
            return jsonify({"error": "暂无错题记录，无法生成靶向练习"}), 400

        mistake_summaries = []
        all_tags = set()
        course_title_value = None
        for m in mistakes:
            sync = _sync_choice_answers_for_mistake(m)
            _ensure_error_classification(m, sync)
            tags = _safe_json_loads(m.knowledge_tags, [])
            for t in tags:
                if isinstance(t, dict):
                    tag_str = str(t.get('name', t.get('label', t.get('tag', str(t))))).strip()
                elif t is not None:
                    tag_str = str(t).strip()
                else:
                    continue
                if tag_str:
                    all_tags.add(tag_str)
            if not course_title_value and m.course:
                course_title_value = m.course.title
            mistake_summaries.append({
                "question_content": m.question_content or "",
                "error_type": m.error_type_manual or m.error_type_auto or "unknown",
                "user_answer": sync["user"].display,
                "correct_answer": sync["correct"].display,
                "ai_analysis": m.ai_analysis or "暂无分析",
                "knowledge_tags": tags,
                "mistake_count": m.mistake_count,
            })

        practice_json = spark_service.generate_targeted_practice(
            mistake_summaries=mistake_summaries,
            knowledge_tags=sorted(all_tags),
            course_title=course_title_value,
            question_count=question_count,
            user_id=session.get('user_id'),
            user_role=session.get('user_role'),
        )

        try:
            generated_questions = json.loads(practice_json)
            if not isinstance(generated_questions, list):
                generated_questions = []
        except (json.JSONDecodeError, TypeError):
            generated_questions = []

        return jsonify({
            "message": f"已生成 {len(generated_questions)} 道靶向练习题",
            "generated_count": len(generated_questions),
            "question_count_requested": question_count,
            "source_mistake_count": len(mistakes),
            "knowledge_tags": sorted(all_tags),
            "questions": generated_questions,
            "raw_output": practice_json if not generated_questions else None,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/targeted-practice/generate/stream", methods=["POST"])
@require_auth
def generate_targeted_practice_stream():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        course_id = data.get("course_id")
        question_count = min(20, max(5, int(data.get("question_count", 10))))

        mistakes = _base_query(user_id, course_id=course_id).all()
        if not mistakes:
            return jsonify({"error": "暂无错题记录，无法生成靶向练习"}), 400

        mistake_summaries = []
        all_tags = set()
        course_title_value = None
        for m in mistakes:
            sync = _sync_choice_answers_for_mistake(m)
            tags = _safe_json_loads(m.knowledge_tags, [])
            for t in tags:
                if isinstance(t, dict):
                    tag_str = str(t.get('name', t.get('label', t.get('tag', str(t))))).strip()
                elif t is not None:
                    tag_str = str(t).strip()
                else:
                    continue
                if tag_str:
                    all_tags.add(tag_str)
            if not course_title_value and m.course:
                course_title_value = m.course.title
            mistake_summaries.append({
                "question_content": m.question_content or "",
                "error_type": m.error_type_manual or m.error_type_auto or "unknown",
                "user_answer": sync["user"].display,
                "correct_answer": sync["correct"].display,
                "ai_analysis": m.ai_analysis or "暂无分析",
                "knowledge_tags": tags,
                "mistake_count": m.mistake_count,
            })

        course_info = f"所属课程：{course_title_value}" if course_title_value else ""

        # 简化摘要，减少token使用
        summaries_text = "\n\n".join([
            f"错题{i+1}：{s.get('question_content', '未知')[:100]}...\n"
            f"  错因：{s.get('ai_analysis', '暂无分析')[:150]}..."
            for i, s in enumerate(mistake_summaries[:5])  # 最多使用前5道错题
        ])
        
        tags_list = sorted(all_tags) if all_tags else ["未指定"]
        tags_text = "、".join(tags_list)

        prompt = f"""你是一位教育专家，请根据以下学生错题信息，生成一套有针对性的练习题。

{course_info}
知识点标签：{tags_text}

=== 学生原始错题（仅供参考错因，不得重复或改写这些题目）===
{summaries_text}

=== 生成要求 ===
请生成 {question_count} 道选择题，难度分布：简单({question_count//3})、中等({question_count//3})、困难({question_count - 2*(question_count//3)})

【去重要求】
1. 每道题必须是全新的，不得与原始错题重复
2. 四个选项必须互不相同且具有迷惑性
3. 题目重复率为0%

【题目格式】
以严格的JSON数组格式输出，每个题目包含：
   - content: 题目内容
   - options: 4个选项的字符串数组
   - correctAnswer: 正确选项索引(0-3)
   - knowledge_tags: 知识点标签数组
   - explanation: 题目解析
   - difficulty: 难度等级("easy"/"medium"/"hard")

直接输出JSON数组，不要有任何其他文字。"""

        session_user_id = session.get('user_id')
        session_user_role = session.get('user_role')

        def _dedup_questions(generated, originals, threshold=0.6):
            import re as _re2
            def normalize(text):
                return _re2.sub(r'[\s\p{P}]+', '', text.lower(), flags=_re2.UNICODE)
            def sim(s1, s2):
                n1, n2 = normalize(s1), normalize(s2)
                if not n1 or not n2: return 0.0
                if n1 == n2: return 1.0
                set1, set2 = set(n1), set(n2)
                if not set1 or not set2: return 0.0
                return len(set1 & set2) / len(set1 | set2)
            def is_dup(new_q, existing):
                return any(sim(new_q, eq) >= threshold for eq in existing)
            unique, seen = [], []
            for q in generated:
                content = q.get('content', '').strip()
                if not content: continue
                if not is_dup(content, originals) and not is_dup(content, seen):
                    unique.append(q)
                    seen.append(content)
            return unique

        def generate():
            full_text = ""
            logger.info(f"🚀 [靶向练习] 开始流式生成，题目数量: {question_count}")
            try:
                for chunk in spark_service.chat_stream([{"role": "user", "content": prompt}], user_id=session_user_id, user_role=session_user_role):
                    full_text += chunk
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                
                logger.info(f"✅ [靶向练习] 流式生成完成，内容长度: {len(full_text)}")
                
                import re as _re3
                json_match = _re3.search(r'\[.*\]', full_text, _re3.DOTALL)
                parsed = []
                if json_match:
                    try:
                        raw = json.loads(json_match.group(0))
                        if isinstance(raw, list):
                            # 简单验证数据结构
                            parsed = [q for q in raw if isinstance(q, dict) and 'content' in q and 'options' in q]
                            logger.info(f"✅ [靶向练习] 解析成功，生成 {len(parsed)} 道题目")
                        else:
                            logger.warning(f"⚠️ [靶向练习] JSON不是数组格式")
                    except (json.JSONDecodeError, TypeError) as je:
                        logger.error(f"❌ [靶向练习] JSON解析失败: {str(je)}")
                        parsed = []
                else:
                    logger.warning(f"⚠️ [靶向练习] 未找到JSON数组")
                    
                yield f"data: {json.dumps({'done': True, 'questions': parsed}, ensure_ascii=False)}\n\n"
            except Exception as e:
                logger.error(f"❌ [靶向练习] 流式生成异常: {str(e)}", exc_info=True)
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

        return Response(generate(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>/error-analysis", methods=["GET"])
@require_auth
def get_error_analysis(mistake_id):
    try:
        user_id = session["user_id"]
        m = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        if not m:
            return jsonify({"error": "Mistake record not found"}), 404
        sync = _sync_choice_answers_for_mistake(m)
        changed = sync["changed"]
        changed = _ensure_error_classification(m, sync) or changed
        if changed:
            db.session.commit()
        return jsonify({"mistake_id": m.id, "auto_type": m.error_type_auto, "manual_type": m.error_type_manual, "effective_type": m.error_type_manual or m.error_type_auto, "type_meta": ERROR_TYPE_META, "confirmed": bool(m.error_type_confirmed), "confidence": m.error_type_confidence, "detail": m.error_reason_detail, "user_answer": sync["user"].__dict__, "correct_answer": sync["correct"].__dict__}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/<int:mistake_id>/error-analysis", methods=["PUT"])
@require_auth
def update_error_analysis(mistake_id):
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        m = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        if not m:
            return jsonify({"error": "Mistake record not found"}), 404
        manual_type = data.get("manual_type")
        if manual_type is not None and manual_type not in ERROR_TYPE_META:
            return jsonify({"error": f"Invalid manual_type: {manual_type}"}), 400
        if manual_type:
            m.error_type_manual = manual_type
        elif data.get("clear_manual"):
            m.error_type_manual = None
        if "confirmed" in data:
            m.error_type_confirmed = bool(data.get("confirmed"))
        else:
            m.error_type_confirmed = bool(m.error_type_manual)
        if data.get("detail"):
            m.error_reason_detail = str(data.get("detail")).strip()
        m.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Error analysis updated", "mistake": m.to_dict(include_resolved_answers=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/knowledge-graph", methods=["GET"])
@require_auth
def get_knowledge_graph():
    try:
        user_id = session["user_id"]
        course_id = request.args.get("course_id", type=int)
        return jsonify(build_knowledge_graph(_base_query(user_id, course_id=course_id).all())), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/targeted-practice", methods=["GET"])
@require_auth
def get_targeted_practice():
    try:
        user_id = session["user_id"]
        course_id = request.args.get("course_id", type=int)
        limit = request.args.get("limit", 18, type=int)
        use_ai = request.args.get("use_ai", "1")

        if use_ai == "1":
            result = generate_ai_targeted_practice(
                user_id=user_id,
                course_id=course_id,
                question_count=min(20, max(5, limit)),
            )
            if "error" in result:
                return jsonify(result), 400
            return jsonify(result), 200

        mistakes = _base_query(user_id, course_id=course_id).all()
        if not mistakes:
            return jsonify({"target_tags": [], "recommended_questions": [], "stage_plan": [], "plan_metrics": {"question_total": 0, "target_tag_count": 0, "baseline_effectiveness": 0, "expected_improvement": 0}}), 200
        assessment_query = Assessment.query.filter_by(course_id=course_id) if course_id else Assessment.query.filter(Assessment.course_id.in_(sorted({m.course_id for m in mistakes if m.course_id})))
        plan = build_targeted_practice_plan(mistakes=mistakes, assessments=assessment_query.all(), limit=limit)
        return jsonify(plan), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/targeted-practice/adaptive-plan", methods=["POST"])
@require_auth
def generate_adaptive_practice_plan():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        course_id = data.get("course_id")
        
        mistakes = _base_query(user_id, course_id=course_id).all()
        
        all_tags = set()
        course_title = None
        for m in mistakes:
            tags = _safe_json_loads(m.knowledge_tags, [])
            for t in tags:
                all_tags.add(t)
            if not course_title and m.course:
                course_title = m.course.title
        
        total_answered = data.get("total_answered", len(mistakes))
        total_correct = data.get("total_correct", 0)
        total_wrong = data.get("total_wrong", len(mistakes))
        overall_accuracy = round((total_correct / total_answered * 100) if total_answered > 0 else 0, 1)
        
        tag_correct = {}
        tag_total = {}
        for r in data.get("previous_results", []):
            for tag in r.get("knowledge_tags", []):
                tag_total[tag] = tag_total.get(tag, 0) + 1
                if r.get("is_correct", False):
                    tag_correct[tag] = tag_correct.get(tag, 0) + 1
        
        weak_tags = [tag for tag, count in tag_total.items() if tag_correct.get(tag, 0) / count < 0.5] if tag_total else []
        strong_tags = [tag for tag, count in tag_total.items() if tag_correct.get(tag, 0) / count >= 0.8] if tag_total else []
        
        student_performance = {
            "overall_accuracy": overall_accuracy,
            "total_answered": total_answered,
            "total_correct": total_correct,
            "total_wrong": total_wrong,
            "weak_tags": weak_tags,
            "strong_tags": strong_tags,
        }
        
        plan_json = spark_service.generate_adaptive_practice_plan(
            student_performance=student_performance,
            previous_results=data.get("previous_results", []),
            knowledge_tags=sorted(all_tags),
            course_title=course_title,
            user_id=session.get('user_id'),
            user_role=session.get('user_role'),
        )
        
        try:
            plan_data = json.loads(plan_json)
            if not isinstance(plan_data, dict):
                plan_data = {}
        except (json.JSONDecodeError, TypeError):
            plan_data = {}
        
        return jsonify({
            "message": "自适应练习计划已生成",
            "plan": plan_data,
            "student_performance": student_performance,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/targeted-practice/feedback", methods=["POST"])
@require_auth
def submit_targeted_feedback():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        mistakes = _base_query(user_id, course_id=data.get("course_id")).all()
        total = len(mistakes)
        mastered = len([m for m in mistakes if m.mastery_status == "mastered"])
        reviewing = len([m for m in mistakes if m.mastery_status == "reviewing"])
        before_rate = round((mastered + reviewing * 0.5) / total * 100, 2) if total else 0.0
        feedback = calc_practice_feedback(before_mastery_rate=before_rate, after_accuracy=float(data.get("after_accuracy") or 0), completed_count=int(data.get("completed_count") or 0), wrong_count=int(data.get("wrong_count") or 0))
        return jsonify({"before_mastery_rate": before_rate, "feedback": feedback}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/batch-analyze", methods=["POST"])
@require_auth
def batch_analyze_mistakes():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        ids = data.get("mistake_ids") or []
        if not ids:
            return jsonify({"error": "mistake_ids is required"}), 400
        if len(ids) > 20:
            return jsonify({"error": "Maximum 20 mistakes can be analyzed at once"}), 400
        mistakes = MistakeRecord.query.filter(MistakeRecord.id.in_(ids), MistakeRecord.user_id == user_id).all()
        if not mistakes:
            return jsonify({"error": "No valid mistake records found"}), 404
        payload = []
        for m in mistakes:
            sync = _sync_choice_answers_for_mistake(m)
            payload.append({"id": m.id, "question_content": m.question_content, "user_answer": sync["user"].display, "correct_answer": sync["correct"].display, "knowledge_tags": _safe_json_loads(m.knowledge_tags, []), "course_title": m.course.title if m.course else None})
        analysis = spark_service.analyze_mistakes_batch(payload, user_id=session.get('user_id'), user_role=session.get('user_role'))
        return jsonify({"message": "Batch analysis completed successfully", "analysis": analysis, "analyzed_count": len(mistakes)}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@mistake_book_bp.route("/mistakes/batch-analyze/stream", methods=["POST"])
@require_auth
def batch_analyze_mistakes_stream():
    try:
        user_id = session["user_id"]
        data = request.get_json() or {}
        ids = data.get("mistake_ids") or []
        if not ids:
            return jsonify({"error": "mistake_ids is required"}), 400
        if len(ids) > 20:
            return jsonify({"error": "Maximum 20 mistakes can be analyzed at once"}), 400
        mistakes = MistakeRecord.query.filter(MistakeRecord.id.in_(ids), MistakeRecord.user_id == user_id).all()
        if not mistakes:
            return jsonify({"error": "No valid mistake records found"}), 404
        dataset = []
        for m in mistakes:
            sync = _sync_choice_answers_for_mistake(m)
            dataset.append({"id": m.id, "question_content": m.question_content, "user_answer": sync["user"].display, "correct_answer": sync["correct"].display, "knowledge_tags": _safe_json_loads(m.knowledge_tags, []), "course_title": m.course.title if m.course else None})
        prompt = "你是一位教育分析专家，请对错题给出错误模式、薄弱知识点与分阶段改进建议。\\n错题数据：" + json.dumps(dataset, ensure_ascii=False)

        session_user_id = session.get('user_id')
        session_user_role = session.get('user_role')

        def generate():
            try:
                for chunk in spark_service.chat_stream([{"role": "user", "content": prompt}], user_id=session_user_id, user_role=session_user_role):
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\\n\\n"
                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\\n\\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\\n\\n"

        return Response(generate(), mimetype="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
