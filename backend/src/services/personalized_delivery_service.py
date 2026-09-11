"""Persistent publish, learning-event and feedback-cycle operations."""

import hashlib
import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import func, or_

from src.models.user import db
from src.models.user import User, ClassGroup, ClassGroupCourse, ClassGroupStudent
from src.models.course import (
    Course, Assessment, MistakeRecord, PracticeEvaluation, ProgrammingSubmission,
    VideoLesson, VideoProgress,
)
from src.models.personalized_workflow import PersonalizedWorkflow, PersonalizedWorkflowEvent
from src.models.personalized_learning import PersonalizedTaskDelivery, PersonalizedDeliveryEvent, PersonalizedLearningCycle
from src.services.learning_cycle_agents import FeedbackAgent, ProfileUpdateAgent, EvidenceReviewAgent, build_next_strategy
from src.services.personalized_workflow_service import build_rule_resources, workflow_store
from src.services.personalized_notification_service import personalized_notification_service
from src.services.review_agent import ReviewAgent
from src.services.verified_profile_update_service import apply_verified_cycle_update


ALLOWED_EVENT_TYPES = {"resource_opened", "progress_updated", "resource_completed"}


class DeliveryError(ValueError):
    def __init__(self, message, code="DELIVERY_INVALID", status=400):
        super().__init__(message)
        self.code = code
        self.status = status


def _json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        raise DeliveryError("截止时间格式不正确，请使用ISO时间", "INVALID_DUE_AT")


def _workflow_event(item, event_type, from_state, to_state, message, data=None, key=None, actor_id=None):
    db.session.add(PersonalizedWorkflowEvent(
        workflow_id=item.workflow_id,
        owner_id=item.owner_id,
        actor_id=int(actor_id or item.owner_id),
        event_type=event_type,
        stage="learning_cycle",
        from_state=from_state,
        to_state=to_state,
        message=message,
        event_data_json=_json(data or {}),
        idempotency_key=key,
    ))
    item.state = to_state
    item.version += 1
    item.updated_at = datetime.utcnow()


def _resource_map(resources):
    result = {}
    for resource_type, value in (resources or {}).items():
        if not value:
            continue
        result[resource_type] = {
            "resource_key": resource_type,
            "resource_type": resource_type,
            "content": value,
        }
    return result


def _assessment_questions(resource, topic, knowledge_points):
    """Convert a generated exercise resource into the existing assessment shape."""
    items = resource if isinstance(resource, list) else [resource]
    raw_questions = []
    for item in items:
        if isinstance(item, dict) and isinstance(item.get("questions"), list):
            raw_questions.extend(item["questions"])

    points = [str(value).strip() for value in (knowledge_points or []) if str(value).strip()]
    if not raw_questions:
        raw_questions = [{
            "question": f"请判断哪项最准确地说明了{point}的核心规则。",
            "answer": f"能够说明{point}的适用条件、关键步骤和结果。",
            "knowledge_tags": [point],
        } for point in (points or [topic])]

    normalized = []
    for index, raw in enumerate(raw_questions):
        if not isinstance(raw, dict):
            raw = {"question": str(raw)}
        question_text = str(raw.get("question") or raw.get("title") or "").strip()
        if not question_text:
            continue
        tags = raw.get("knowledge_tags") or raw.get("knowledge_points") or points
        if isinstance(tags, str):
            tags = [tags]
        tags = [str(value).strip() for value in tags if str(value).strip()]
        options = [str(value).strip() for value in (raw.get("options") or []) if str(value).strip()]
        answer = raw.get("answer", raw.get("reference_answer", raw.get("standard_answer")))
        correct = raw.get("correctAnswer", raw.get("correct_answer"))

        if len(options) >= 2:
            if isinstance(correct, str) and len(correct.strip()) == 1 and correct.strip().isalpha():
                correct = ord(correct.strip().upper()) - ord("A")
            if not isinstance(correct, int) and answer is not None:
                try:
                    correct = options.index(str(answer).strip())
                except ValueError:
                    correct = None
            if not isinstance(correct, int) or correct < 0 or correct >= len(options):
                correct = 0
            normalized.append({
                "id": index + 1,
                "question": question_text,
                "type": "choice",
                "options": options,
                "correctAnswer": correct,
                "explanation": str(raw.get("explanation") or answer or "请结合课程讲解复核。"),
                "difficulty": raw.get("difficulty") or "medium",
                "knowledge_tags": tags,
            })
            continue

        reference = str(answer or "请结合课程讲解，说明定义、条件和应用。").strip()
        distractors = [
            "只需记住术语名称，不需要理解适用条件。",
            "该知识点在任何实际场景中都不适用。",
            "只要得到结果，就不需要说明关键步骤。",
        ]
        correct_index = index % 4
        generated_options = distractors[:]
        generated_options.insert(correct_index, reference)
        normalized.append({
            "id": index + 1,
            "question": f"以下哪项最符合“{question_text}”的参考结论？",
            "type": "choice",
            "options": generated_options,
            "correctAnswer": correct_index,
            "explanation": str(raw.get("explanation") or reference),
            "difficulty": raw.get("difficulty") or "medium",
            "knowledge_tags": tags,
        })
    return normalized


def _create_bound_assessment(course_id, topic, knowledge_points, resources):
    source_key = "layered_exercise" if resources.get("layered_exercise") else "exercise"
    questions = _assessment_questions(resources.get(source_key), topic, knowledge_points)
    if not questions:
        raise DeliveryError("自动检测题目不完整，系统已保留工作流供重新生成", "ASSESSMENT_BUILD_FAILED", 422)
    assessment = Assessment(
        course_id=course_id,
        title=f"{topic or '个性化学习'}·本轮检测"[:200],
        questions=_json(questions),
        answers=_json([item.get("correctAnswer") for item in questions]),
        generated_by_llm=True,
        is_recommended=True,
    )
    db.session.add(assessment)
    db.session.flush()
    return assessment, source_key


EVIDENCE_ID_FIELDS = {
    "practice_evaluation_ids",
    "mistake_record_ids",
    "programming_submission_ids",
    "video_progress_ids",
}

DELIVERY_STATUSES = {
    "PUBLISHED", "IN_PROGRESS", "WAITING_ASSESSMENT", "ASSESSING",
    "CYCLE_COMPLETED", "PAUSED", "NEEDS_ATTENTION",
}
DELIVERY_DUE_STATUSES = {"none", "active", "due_soon", "overdue", "completed"}


def _parse_query_datetime(value, field_name):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        raise DeliveryError(f"{field_name}格式不正确，请使用ISO时间", "DELIVERY_FILTER_INVALID")


def _normalize_list_filters(filters):
    filters = dict(filters or {})
    try:
        page = max(1, int(filters.get("page") or 1))
        page_size = min(100, max(1, int(filters.get("page_size") or 20)))
    except (TypeError, ValueError):
        raise DeliveryError("分页参数格式不正确", "DELIVERY_FILTER_INVALID")
    status = str(filters.get("status") or "").strip().upper()
    if status and status not in DELIVERY_STATUSES:
        raise DeliveryError("任务状态筛选值不正确", "DELIVERY_FILTER_INVALID")
    due_status = str(filters.get("due_status") or "").strip().lower()
    if due_status and due_status not in DELIVERY_DUE_STATUSES:
        raise DeliveryError("截止状态筛选值不正确", "DELIVERY_FILTER_INVALID")
    result = {
        "page": page,
        "page_size": page_size,
        "q": str(filters.get("q") or "").strip()[:100],
        "status": status,
        "due_status": due_status,
        "published_from": _parse_query_datetime(filters.get("published_from"), "开始时间"),
        "published_to": _parse_query_datetime(filters.get("published_to"), "结束时间"),
    }
    for field in ("course_id", "class_id", "student_user_id"):
        raw = filters.get(field)
        if raw in (None, ""):
            result[field] = None
            continue
        try:
            result[field] = int(raw)
        except (TypeError, ValueError):
            raise DeliveryError("任务筛选编号格式不正确", "DELIVERY_FILTER_INVALID")
    return result


def _apply_due_status_filter(query, due_status, now):
    terminal = or_(
        PersonalizedTaskDelivery.status == "CYCLE_COMPLETED",
        PersonalizedTaskDelivery.completed_at.isnot(None),
    )
    if due_status == "completed":
        return query.filter(terminal)
    query = query.filter(~terminal)
    if due_status == "none":
        return query.filter(PersonalizedTaskDelivery.due_at.is_(None))
    if due_status == "overdue":
        return query.filter(PersonalizedTaskDelivery.due_at < now)
    if due_status == "due_soon":
        from datetime import timedelta
        return query.filter(
            PersonalizedTaskDelivery.due_at >= now,
            PersonalizedTaskDelivery.due_at <= now + timedelta(hours=24),
        )
    if due_status == "active":
        from datetime import timedelta
        return query.filter(PersonalizedTaskDelivery.due_at > now + timedelta(hours=24))
    return query


def _delivery_list_payload(items, total, page, page_size):
    student_ids = {item.student_user_id for item in items}
    course_ids = {item.course_id for item in items}
    class_ids = {item.class_id for item in items}
    students = {item.id: item for item in User.query.filter(User.id.in_(student_ids)).all()} if student_ids else {}
    courses = {item.id: item for item in Course.query.filter(Course.id.in_(course_ids)).all()} if course_ids else {}
    classes = {item.id: item for item in ClassGroup.query.filter(ClassGroup.id.in_(class_ids)).all()} if class_ids else {}
    deliveries = []
    for item in items:
        value = item.to_dict(include_events=False, include_cycles=False)
        student = students.get(item.student_user_id)
        value["student_name"] = (student.real_name or student.username) if student else f"学生{item.student_user_id}"
        value["course_title"] = courses[item.course_id].title if item.course_id in courses else f"课程{item.course_id}"
        value["class_name"] = classes[item.class_id].name if item.class_id in classes else f"班级{item.class_id}"
        deliveries.append(value)
    pages = (total + page_size - 1) // page_size if total else 0
    return {
        "deliveries": deliveries,
        "count": len(deliveries),
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": pages,
            "has_previous": page > 1,
            "has_next": page < pages,
        },
    }


def _filter_bound_ids(query, model, field, bound_sources):
    if bound_sources is not None and field in bound_sources:
        return query.filter(model.id.in_(bound_sources[field]))
    return query


def collect_evidence_snapshot(
    student_user_id, course_id, started_at, include_delivery_events=None,
    bound_sources=None, expected_assessment_ids=None,
):
    expected_assessment_ids = [int(value) for value in (expected_assessment_ids or [])]
    practice_query = PracticeEvaluation.query.join(Assessment).filter(
        PracticeEvaluation.user_id == student_user_id,
        Assessment.course_id == course_id,
        PracticeEvaluation.created_at >= started_at,
    )
    if expected_assessment_ids:
        practice_query = practice_query.filter(PracticeEvaluation.assessment_id.in_(expected_assessment_ids))
    practices = _filter_bound_ids(
        practice_query, PracticeEvaluation, "practice_evaluation_ids", bound_sources
    ).order_by(PracticeEvaluation.created_at.asc()).all()
    mistake_query = MistakeRecord.query.filter(
        MistakeRecord.user_id == student_user_id,
        MistakeRecord.course_id == course_id,
        MistakeRecord.last_mistake_at >= started_at,
    )
    if expected_assessment_ids:
        mistake_query = mistake_query.filter(MistakeRecord.assessment_id.in_(expected_assessment_ids))
    mistakes = _filter_bound_ids(
        mistake_query, MistakeRecord, "mistake_record_ids", bound_sources
    ).order_by(MistakeRecord.last_mistake_at.asc()).all()
    submission_query = ProgrammingSubmission.query.filter(
        ProgrammingSubmission.user_id == student_user_id,
        ProgrammingSubmission.course_id == course_id,
        ProgrammingSubmission.created_at >= started_at,
    )
    if expected_assessment_ids:
        submission_query = submission_query.filter(ProgrammingSubmission.assessment_id.in_(expected_assessment_ids))
    submissions = _filter_bound_ids(
        submission_query, ProgrammingSubmission, "programming_submission_ids", bound_sources
    ).order_by(ProgrammingSubmission.created_at.asc()).all()
    video_query = VideoProgress.query.join(VideoLesson).filter(
        VideoProgress.user_id == student_user_id,
        VideoLesson.course_id == course_id,
        VideoProgress.last_watched >= started_at,
    )
    videos = _filter_bound_ids(
        video_query, VideoProgress, "video_progress_ids", bound_sources
    ).order_by(VideoProgress.last_watched.asc()).all()

    completed_resources = len({event.resource_key for event in (include_delivery_events or []) if event.event_type == "resource_completed"})
    practice_scores = [float(row.score) for row in practices if row.score is not None]
    programming_passed = sum(
        1 for row in submissions
        if row.status == "passed" or float(row.score or 0) / float(row.max_score or 100) >= 0.6
    )
    source_counts = {
        "practice": len(practices), "mistake": len(mistakes),
        "programming": len(submissions), "video": len(videos),
        "resource_event": completed_resources,
    }
    return {
        "captured_at": datetime.utcnow().isoformat(),
        "window_start": started_at.isoformat(),
        "assessment_scope": {
            "mode": "exact" if expected_assessment_ids else "course_window",
            "assessment_ids": expected_assessment_ids,
        },
        "sources": {
            "practice_evaluation_ids": [row.id for row in practices],
            "mistake_record_ids": [row.id for row in mistakes],
            "programming_submission_ids": [row.id for row in submissions],
            "video_progress_ids": [row.id for row in videos],
        },
        "source_counts": source_counts,
        "source_count": sum(1 for count in source_counts.values() if count),
        "sample_count": sum(source_counts.values()),
        "assessment_source_count": sum(1 for key in ("practice", "mistake", "programming") if source_counts[key]),
        "assessment_sample_count": sum(source_counts[key] for key in ("practice", "mistake", "programming")),
        "engagement_sample_count": source_counts["video"] + source_counts["resource_event"],
        "metrics": {
            "practice_average_score": round(sum(practice_scores) / len(practice_scores), 1) if practice_scores else None,
            "mistake_count": len(mistakes),
            "programming_pass_rate": round(programming_passed / len(submissions), 3) if submissions else None,
            "completed_videos": sum(1 for row in videos if row.completed),
            "completed_resources": completed_resources,
        },
    }


class PersonalizedDeliveryService:
    def bind_assessment(self, delivery_id, student_user_id, data):
        item = PersonalizedTaskDelivery.query.filter_by(
            delivery_id=delivery_id, student_user_id=int(student_user_id)
        ).first()
        if not item:
            raise DeliveryError("任务不存在或无权访问", "DELIVERY_NOT_FOUND", 404)
        if PersonalizedLearningCycle.query.filter_by(delivery_id=delivery_id, cycle_number=1).first():
            return None, True
        if item.status != "WAITING_ASSESSMENT":
            raise DeliveryError("请先完成必学资源，再提交学习检测", "ASSESSMENT_NOT_READY", 409)

        supplied = data.get("evidence_ids") if isinstance(data.get("evidence_ids"), dict) else data
        bound = {}
        for field in EVIDENCE_ID_FIELDS:
            if field not in supplied:
                continue
            raw_ids = supplied.get(field)
            if not isinstance(raw_ids, list) or len(raw_ids) > 100:
                raise DeliveryError("检测记录编号格式不正确", "ASSESSMENT_IDS_INVALID")
            try:
                bound[field] = sorted({int(value) for value in raw_ids})
            except (TypeError, ValueError):
                raise DeliveryError("检测记录编号格式不正确", "ASSESSMENT_IDS_INVALID")

        if not bound:
            return None, False

        rules = item.to_dict().get("completion_rules") or {}
        expected_ids = rules.get("assessment_ids") or ([rules["assessment_id"]] if rules.get("assessment_id") else [])
        validated = collect_evidence_snapshot(
            item.student_user_id, item.course_id, item.published_at,
            bound_sources=bound, expected_assessment_ids=expected_ids,
        )["sources"]
        for field, requested_ids in bound.items():
            if set(validated.get(field, [])) != set(requested_ids):
                raise DeliveryError(
                    "检测记录不属于当前学生、课程或学习周期",
                    "ASSESSMENT_EVIDENCE_FORBIDDEN",
                    403,
                )

        digest = hashlib.sha256(_json(bound).encode("utf-8")).hexdigest()[:24]
        event_key = f"{delivery_id}:{student_user_id}:assessment:{digest}"
        existing = PersonalizedDeliveryEvent.query.filter_by(idempotency_key=event_key).first()
        if existing:
            return bound, True
        db.session.add(PersonalizedDeliveryEvent(
            delivery_id=delivery_id,
            student_user_id=int(student_user_id),
            event_type="assessment_bound",
            event_data_json=_json({"sources": bound}),
            idempotency_key=event_key,
        ))
        db.session.commit()
        return bound, False

    def publish(self, workflow_id, owner_id, data, user_role="teacher", commit=True):
        workflow = PersonalizedWorkflow.query.filter_by(workflow_id=workflow_id, owner_id=int(owner_id)).first()
        if not workflow:
            raise DeliveryError("工作流不存在或无权发布", "WORKFLOW_NOT_FOUND", 404)
        existing = PersonalizedTaskDelivery.query.filter_by(
            workflow_id=workflow_id, student_user_id=workflow.student_user_id
        ).first()
        if existing:
            return existing.to_dict(include_events=True, include_cycles=True), True
        if workflow.state != "READY_TO_PUBLISH" or not workflow.generation_json:
            raise DeliveryError("资源尚未完成自动审核，暂时不能发布", "WORKFLOW_NOT_READY", 409)
        class_group = ClassGroup.query.filter_by(id=workflow.class_id).first()
        if not class_group or (user_role == "teacher" and class_group.teacher_id != int(owner_id)):
            raise DeliveryError("班级不存在或已不属于当前教师", "CLASS_FORBIDDEN", 403)
        if not ClassGroupStudent.query.filter_by(
            class_group_id=workflow.class_id, user_id=workflow.student_user_id
        ).first():
            raise DeliveryError("该学生已不在当前班级，不能发布任务", "STUDENT_NOT_IN_CLASS", 403)
        if not ClassGroupCourse.query.filter_by(
            class_group_id=workflow.class_id, course_id=workflow.course_id
        ).first():
            raise DeliveryError("该课程已不再分配给当前班级", "COURSE_NOT_ASSIGNED", 403)

        workflow_data = workflow.to_dict()
        generation = workflow_data.get("generation") or {}
        payload = workflow_data.get("payload") or {}
        resources = generation.get("resources") or {}
        required_types = payload.get("resource_types") or list(resources)
        fallback = build_rule_resources(workflow.topic, payload.get("knowledge_points") or [], required_types)
        for resource_type in required_types:
            if not resources.get(resource_type) and fallback.get(resource_type):
                resources[resource_type] = fallback[resource_type]

        from src.services.spark_service import spark_service
        review = ReviewAgent(spark_service).review_and_repair(resources, {
            "topic": workflow.topic,
            "knowledge_points": payload.get("knowledge_points") or [],
            "resource_types": required_types,
            "strategy": payload.get("strategy") or {},
        }, owner_id, user_role)
        if not review.get("can_submit"):
            raise DeliveryError("自动审核仍发现资源不完整，系统已保留原工作流供继续修复", "PUBLISH_REVIEW_FAILED", 422)

        reviewed_resources = review.get("resources") or {}
        resource_map = _resource_map(reviewed_resources)
        requested_required = data.get("required_resource_keys") or list(resource_map)
        required_keys = [key for key in requested_required if key in resource_map]
        if not required_keys:
            raise DeliveryError("至少需要一个必学资源", "REQUIRED_RESOURCE_MISSING")
        now = datetime.utcnow()
        assessment, assessment_source_key = _create_bound_assessment(
            workflow.course_id,
            workflow.topic,
            payload.get("knowledge_points") or [],
            reviewed_resources,
        )
        baseline = {
            "captured_at": now.isoformat(),
            "profile_snapshot": payload.get("profile_snapshot") or {},
            "selected_evidence": payload.get("selected_evidence") or [],
            "historical_context_only": True,
        }
        delivery = PersonalizedTaskDelivery(
            delivery_id=f"dlv_{uuid4().hex}", workflow_id=workflow_id,
            owner_id=workflow.owner_id, course_id=workflow.course_id, class_id=workflow.class_id,
            student_user_id=workflow.student_user_id, status="PUBLISHED",
            title=str(data.get("title") or workflow.topic or "个性化学习任务")[:200],
            instructions=str(data.get("instructions") or "请按照推荐顺序完成学习资源和检测。"),
            resource_snapshot_json=_json(resource_map),
            strategy_snapshot_json=_json(payload.get("strategy") or {}),
            baseline_snapshot_json=_json(baseline),
            completion_rules_json=_json({
                "required_resource_keys": required_keys,
                "assessment_required": True,
                "assessment_id": assessment.id,
                "assessment_ids": [assessment.id],
                "assessment_title": assessment.title,
                "assessment_source_resource_key": assessment_source_key,
            }),
            idempotency_key=f"{workflow_id}:{workflow.student_user_id}:publish:v1",
            due_at=_parse_datetime(data.get("due_at")), published_at=now,
        )
        db.session.add(delivery)
        db.session.flush()
        personalized_notification_service.create(
            delivery, "published", f"{delivery.delivery_id}:published"
        )
        _workflow_event(workflow, "task_published", "READY_TO_PUBLISH", "PUBLISHED", "个性化学习任务已发布", {"delivery_id": delivery.delivery_id}, f"{workflow_id}:published", owner_id)
        if commit:
            db.session.commit()
        else:
            db.session.flush()
        return delivery.to_dict(include_events=True), False

    def get_for_teacher(self, delivery_id, owner_id):
        item = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id, owner_id=int(owner_id)).first()
        return item.to_dict(include_events=True, include_cycles=True) if item else None

    def list_for_workflow(self, workflow_id, owner_id):
        return [item.to_dict(include_events=True, include_cycles=True) for item in PersonalizedTaskDelivery.query.filter_by(workflow_id=workflow_id, owner_id=int(owner_id)).all()]

    def list_for_teacher(self, owner_id, filters=None):
        values = _normalize_list_filters(filters)
        query = PersonalizedTaskDelivery.query.join(
            User, User.id == PersonalizedTaskDelivery.student_user_id
        ).filter(PersonalizedTaskDelivery.owner_id == int(owner_id))
        if values["q"]:
            pattern = f"%{values['q']}%"
            query = query.filter(or_(
                PersonalizedTaskDelivery.title.ilike(pattern),
                PersonalizedTaskDelivery.instructions.ilike(pattern),
                PersonalizedTaskDelivery.delivery_id.ilike(pattern),
                User.username.ilike(pattern),
                User.real_name.ilike(pattern),
            ))
        for field in ("course_id", "class_id", "student_user_id"):
            if values[field] is not None:
                query = query.filter(getattr(PersonalizedTaskDelivery, field) == values[field])
        if values["status"]:
            query = query.filter(PersonalizedTaskDelivery.status == values["status"])
        if values["published_from"]:
            query = query.filter(PersonalizedTaskDelivery.published_at >= values["published_from"])
        if values["published_to"]:
            query = query.filter(PersonalizedTaskDelivery.published_at <= values["published_to"])
        if values["due_status"]:
            query = _apply_due_status_filter(query, values["due_status"], datetime.utcnow())
        total = query.count()
        items = query.order_by(
            PersonalizedTaskDelivery.published_at.desc(), PersonalizedTaskDelivery.delivery_id.desc()
        ).offset((values["page"] - 1) * values["page_size"]).limit(values["page_size"]).all()
        return _delivery_list_payload(items, total, values["page"], values["page_size"])

    def get_for_student(self, delivery_id, student_user_id):
        item = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id, student_user_id=int(student_user_id)).first()
        return item.to_dict(include_events=True, include_cycles=True) if item else None

    def list_for_student(self, student_user_id, filters=None):
        values = _normalize_list_filters(filters)
        query = PersonalizedTaskDelivery.query.filter_by(student_user_id=int(student_user_id))
        if values["q"]:
            pattern = f"%{values['q']}%"
            query = query.filter(or_(
                PersonalizedTaskDelivery.title.ilike(pattern),
                PersonalizedTaskDelivery.instructions.ilike(pattern),
                PersonalizedTaskDelivery.delivery_id.ilike(pattern),
            ))
        if values["course_id"] is not None:
            query = query.filter(PersonalizedTaskDelivery.course_id == values["course_id"])
        if values["status"]:
            query = query.filter(PersonalizedTaskDelivery.status == values["status"])
        if values["due_status"]:
            query = _apply_due_status_filter(query, values["due_status"], datetime.utcnow())
        total = query.count()
        items = query.order_by(
            PersonalizedTaskDelivery.published_at.desc(), PersonalizedTaskDelivery.delivery_id.desc()
        ).offset((values["page"] - 1) * values["page_size"]).limit(values["page_size"]).all()
        return _delivery_list_payload(items, total, values["page"], values["page_size"])

    def bulk_change_state(self, owner_id, data):
        action = str(data.get("action") or "").strip().lower()
        if action not in ("pause", "resume"):
            raise DeliveryError("批量操作只支持pause或resume", "BULK_ACTION_INVALID")
        raw_ids = data.get("delivery_ids")
        if not isinstance(raw_ids, list) or not raw_ids or len(raw_ids) > 100:
            raise DeliveryError("请选择1至100个任务", "BULK_DELIVERY_IDS_INVALID")
        delivery_ids = list(dict.fromkeys(str(value).strip() for value in raw_ids if str(value).strip()))
        if not delivery_ids:
            raise DeliveryError("请选择有效的任务编号", "BULK_DELIVERY_IDS_INVALID")
        owned = {
            item.delivery_id: item for item in PersonalizedTaskDelivery.query.filter(
                PersonalizedTaskDelivery.owner_id == int(owner_id),
                PersonalizedTaskDelivery.delivery_id.in_(delivery_ids),
            ).all()
        }
        results = []
        changed = 0
        for delivery_id in delivery_ids:
            item = owned.get(delivery_id)
            if not item:
                results.append({"delivery_id": delivery_id, "status": "skipped", "reason": "任务不存在或无权操作"})
                continue
            if action == "pause":
                if item.status == "PAUSED":
                    results.append({"delivery_id": delivery_id, "status": "skipped", "reason": "任务已经暂停"})
                    continue
                if item.status in ("ASSESSING", "CYCLE_COMPLETED"):
                    results.append({"delivery_id": delivery_id, "status": "skipped", "reason": "当前状态不能暂停"})
                    continue
                previous = item.status
                item.status = "PAUSED"
                event_type = "task_paused"
                event_data = {"resume_state": previous, "source": "bulk_operation"}
            else:
                if item.status != "PAUSED":
                    results.append({"delivery_id": delivery_id, "status": "skipped", "reason": "任务当前没有暂停"})
                    continue
                pause_event = PersonalizedDeliveryEvent.query.filter_by(
                    delivery_id=delivery_id, event_type="task_paused"
                ).order_by(PersonalizedDeliveryEvent.id.desc()).first()
                resume_state = (pause_event.to_dict().get("data") or {}).get("resume_state") if pause_event else "IN_PROGRESS"
                item.status = resume_state if resume_state in ("PUBLISHED", "IN_PROGRESS", "WAITING_ASSESSMENT") else "IN_PROGRESS"
                event_type = "task_resumed"
                event_data = {"source": "bulk_operation"}
            item.version += 1
            item.updated_at = datetime.utcnow()
            db.session.add(PersonalizedDeliveryEvent(
                delivery_id=delivery_id,
                student_user_id=item.student_user_id,
                event_type=event_type,
                event_data_json=_json(event_data),
                idempotency_key=f"{delivery_id}:{event_type}:{item.version}",
            ))
            personalized_notification_service.create(
                item,
                "paused" if action == "pause" else "resumed",
                f"{delivery_id}:notification:{event_type}:{item.version}",
            )
            changed += 1
            results.append({"delivery_id": delivery_id, "status": "changed", "new_state": item.status})
        db.session.commit()
        return {
            "action": action,
            "requested_count": len(delivery_ids),
            "changed_count": changed,
            "skipped_count": len(delivery_ids) - changed,
            "results": results,
        }

    def start(self, delivery_id, student_user_id):
        item = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id, student_user_id=int(student_user_id)).first()
        if not item:
            raise DeliveryError("任务不存在或无权访问", "DELIVERY_NOT_FOUND", 404)
        if item.status != "PUBLISHED":
            return item.to_dict(include_events=True), True
        now = datetime.utcnow()
        item.status = "IN_PROGRESS"
        item.started_at = now
        item.updated_at = now
        item.version += 1
        db.session.add(PersonalizedDeliveryEvent(
            delivery_id=delivery_id, student_user_id=student_user_id, event_type="task_started",
            event_data_json="{}", idempotency_key=f"{delivery_id}:task_started", occurred_at=now,
        ))
        workflow = PersonalizedWorkflow.query.filter_by(workflow_id=item.workflow_id).first()
        if workflow and workflow.state == "PUBLISHED":
            _workflow_event(workflow, "student_started", "PUBLISHED", "LEARNING", "学生已开始个性化学习任务", {"delivery_id": delivery_id}, f"{delivery_id}:workflow_started", student_user_id)
        db.session.commit()
        return item.to_dict(include_events=True), False

    def record_event(self, delivery_id, student_user_id, data):
        item = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id, student_user_id=int(student_user_id)).first()
        if not item:
            raise DeliveryError("任务不存在或无权访问", "DELIVERY_NOT_FOUND", 404)
        if item.status not in ("IN_PROGRESS", "WAITING_ASSESSMENT"):
            raise DeliveryError("当前任务状态不能记录学习进度", "DELIVERY_STATE_INVALID", 409)
        event_type = str(data.get("event_type") or "")
        if event_type not in ALLOWED_EVENT_TYPES:
            raise DeliveryError("学习事件类型不允许", "EVENT_TYPE_INVALID")
        resources = item.to_dict()["resources"]
        resource_key = str(data.get("resource_key") or "")
        if resource_key not in resources:
            raise DeliveryError("资源不属于当前任务", "RESOURCE_NOT_FOUND", 404)
        request_key = str(data.get("idempotency_key") or "").strip()
        if not request_key:
            raise DeliveryError("学习事件缺少幂等编号", "IDEMPOTENCY_KEY_REQUIRED")
        full_key = f"{delivery_id}:{student_user_id}:{request_key}"[:160]
        existing = PersonalizedDeliveryEvent.query.filter_by(idempotency_key=full_key).first()
        if existing:
            return item.to_dict(include_events=True), True

        safe_data = {}
        if event_type == "progress_updated":
            try:
                safe_data["progress"] = max(0, min(100, float(data.get("progress", 0))))
            except (TypeError, ValueError):
                raise DeliveryError("资源进度格式不正确", "PROGRESS_INVALID")
        db.session.add(PersonalizedDeliveryEvent(
            delivery_id=delivery_id, student_user_id=student_user_id,
            event_type=event_type, resource_key=resource_key,
            event_data_json=_json(safe_data), idempotency_key=full_key,
        ))
        db.session.flush()
        completed = {
            row.resource_key for row in PersonalizedDeliveryEvent.query.filter_by(
                delivery_id=delivery_id, event_type="resource_completed"
            ).all()
        }
        required = set(item.to_dict()["completion_rules"].get("required_resource_keys") or [])
        item.progress_percentage = round(len(completed & required) / max(len(required), 1) * 100, 1)
        if required and required.issubset(completed):
            item.status = "WAITING_ASSESSMENT"
            workflow = PersonalizedWorkflow.query.filter_by(workflow_id=item.workflow_id).first()
            if workflow and workflow.state == "LEARNING":
                _workflow_event(workflow, "resources_completed", "LEARNING", "WAITING_ASSESSMENT", "必学资源已完成，等待学习检测", {"delivery_id": delivery_id}, f"{delivery_id}:resources_completed", student_user_id)
        item.version += 1
        item.updated_at = datetime.utcnow()
        db.session.commit()
        return item.to_dict(include_events=True), False

    def analyze(self, delivery_id, owner_id=None, student_user_id=None):
        query = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id)
        if owner_id is not None:
            query = query.filter_by(owner_id=int(owner_id))
        if student_user_id is not None:
            query = query.filter_by(student_user_id=int(student_user_id))
        item = query.first()
        if not item:
            raise DeliveryError("任务不存在或无权访问", "DELIVERY_NOT_FOUND", 404)
        existing = PersonalizedLearningCycle.query.filter_by(delivery_id=delivery_id, cycle_number=1).first()
        if existing and existing.status == "COMPLETED":
            return existing.to_dict(), True
        if not existing and item.status != "WAITING_ASSESSMENT":
            raise DeliveryError("请先完成必学资源，再进行效果分析", "ASSESSMENT_NOT_READY", 409)

        workflow = PersonalizedWorkflow.query.filter_by(workflow_id=item.workflow_id).first()
        if existing:
            cycle = existing
            saved = cycle.to_dict()
            evidence = saved["evidence"]
            feedback = saved["feedback"]
            next_strategy = saved["next_strategy"]
        else:
            events = PersonalizedDeliveryEvent.query.filter_by(delivery_id=delivery_id).all()
            bound_sources = {}
            for event in events:
                if event.event_type != "assessment_bound":
                    continue
                event_sources = event.to_dict().get("data", {}).get("sources", {})
                for field in EVIDENCE_ID_FIELDS:
                    if field in event_sources:
                        bound_sources.setdefault(field, set()).update(event_sources[field])
            normalized_bound_sources = {
                field: sorted(values) for field, values in bound_sources.items()
            } or None
            completion_rules = item.to_dict().get("completion_rules") or {}
            expected_assessment_ids = completion_rules.get("assessment_ids") or (
                [completion_rules["assessment_id"]] if completion_rules.get("assessment_id") else []
            )
            evidence = collect_evidence_snapshot(
                item.student_user_id, item.course_id, item.published_at, events,
                normalized_bound_sources, expected_assessment_ids,
            )
            baseline = item.to_dict()["baseline"]
            feedback = FeedbackAgent().analyze(baseline, evidence)
            profile_before = baseline.get("profile_snapshot", {}).get("profile") or {}
            proposal = ProfileUpdateAgent().propose(profile_before, feedback)
            reviewer = EvidenceReviewAgent()
            review = reviewer.review(evidence, feedback, proposal)
            profile_after = reviewer.build_profile_after(profile_before, proposal, review)
            next_strategy = build_next_strategy(feedback)
            now = datetime.utcnow()
            cycle_id = f"cyc_{uuid4().hex}"
            profile_update = apply_verified_cycle_update(
                item.student_user_id,
                {
                    "cycle_id": cycle_id,
                    "course_id": item.course_id,
                    "topic": workflow.topic if workflow else item.title,
                },
                evidence,
                feedback,
                review,
            )
            proposal["permanent_profile_write"] = bool(profile_update.get("updated"))
            review["permanent_profile_write"] = bool(profile_update.get("updated"))
            review["permanent_profile_update"] = profile_update
            profile_after["permanent_profile_updated"] = bool(profile_update.get("updated"))
            profile_after["permanent_profile_update"] = profile_update
            if profile_update.get("updated") and profile_update.get("profile"):
                profile_after["base_profile"] = profile_update["profile"]
            cycle = PersonalizedLearningCycle(
                cycle_id=cycle_id, delivery_id=delivery_id, workflow_id=item.workflow_id,
                owner_id=item.owner_id, student_user_id=item.student_user_id, cycle_number=1,
                status="UPDATING_PROFILE", evidence_window_start=item.published_at, evidence_window_end=now,
                evidence_snapshot_json=_json(evidence), assessment_snapshot_json=_json(evidence.get("sources") or {}),
                feedback_json=_json(feedback), profile_before_json=_json(profile_before),
                profile_proposal_json=_json(proposal), profile_after_json=_json(profile_after),
                review_json=_json(review), next_strategy_json=_json(next_strategy),
                tracking_id=f"trk_cycle_{uuid4().hex}", idempotency_key=f"{delivery_id}:cycle:1",
                confidence_score=feedback.get("confidence_score", 0),
            )
            db.session.add(cycle)
            item.status = "ASSESSING"
            if workflow:
                _workflow_event(workflow, "feedback_analyzed", workflow.state, "UPDATING_PROFILE", "FeedbackAgent和EvidenceReviewAgent已完成分析", {"delivery_id": delivery_id, "cycle_id": cycle.cycle_id}, f"{delivery_id}:feedback_analyzed", item.student_user_id)
            db.session.commit()

        next_payload = dict(workflow.to_dict().get("payload") or {}) if workflow else {}
        next_payload.update({
            "source_cycle_id": cycle.cycle_id,
            "source_delivery_id": delivery_id,
            "strategy": next_strategy,
            "selected_evidence": [{
                "id": "learning_cycle_feedback", "label": feedback.get("summary"),
                "source": "本轮学习反馈", "sample_count": evidence.get("sample_count", 0),
                "confidence": "high" if feedback.get("confidence_score", 0) >= 80 else "medium",
                "selected": True, "available": True,
            }],
        })
        saved_profile_after = cycle.to_dict().get("profile_after") or {}
        if saved_profile_after.get("permanent_profile_updated"):
            profile_snapshot = dict(next_payload.get("profile_snapshot") or {})
            profile_snapshot["profile"] = saved_profile_after.get("base_profile") or {}
            profile_snapshot["source"] = "verified_learning_cycle"
            profile_snapshot["source_cycle_id"] = cycle.cycle_id
            next_payload["profile_snapshot"] = profile_snapshot
        try:
            next_workflow = workflow_store.create(item.owner_id, next_payload)
        except Exception:
            db.session.rollback()
            cycle = PersonalizedLearningCycle.query.filter_by(cycle_id=cycle.cycle_id).first()
            item = PersonalizedTaskDelivery.query.filter_by(delivery_id=delivery_id).first()
            workflow = PersonalizedWorkflow.query.filter_by(workflow_id=item.workflow_id).first()
            cycle.status = "NEEDS_ATTENTION"
            cycle.last_error = "下一轮工作流创建中断，已保留本轮证据，可直接重试"
            item.status = "NEEDS_ATTENTION"
            if workflow and workflow.state != "NEEDS_ATTENTION":
                _workflow_event(workflow, "cycle_interrupted", workflow.state, "NEEDS_ATTENTION", cycle.last_error, {"cycle_id": cycle.cycle_id}, f"{delivery_id}:cycle_interrupted", item.student_user_id)
            db.session.commit()
            raise DeliveryError("分析证据已经保存，下一轮草稿创建暂时中断，请直接重试", "CYCLE_RETRYABLE", 503)
        cycle = PersonalizedLearningCycle.query.filter_by(cycle_id=cycle.cycle_id).first()
        cycle.next_workflow_id = next_workflow["workflow_id"]
        cycle.status = "COMPLETED"
        cycle.completed_at = datetime.utcnow()
        item.status = "CYCLE_COMPLETED"
        item.completed_at = datetime.utcnow()
        item.progress_percentage = 100
        if workflow:
            _workflow_event(workflow, "learning_cycle_completed", workflow.state, "COMPLETED", "本轮学习闭环已完成并创建下一轮草稿", {"cycle_id": cycle.cycle_id, "next_workflow_id": next_workflow["workflow_id"]}, f"{delivery_id}:cycle_completed", item.student_user_id)
        personalized_notification_service.create(
            item, "next_cycle_ready", f"{delivery_id}:next_cycle_ready:{cycle.cycle_id}"
        )
        db.session.commit()
        return cycle.to_dict(), False


personalized_delivery_service = PersonalizedDeliveryService()
