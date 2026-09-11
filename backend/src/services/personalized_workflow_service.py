"""Persistent personalized teaching workflow and local resource fallback."""

import json
from datetime import datetime, timedelta
from uuid import uuid4

from src.models.personalized_workflow import PersonalizedWorkflow, PersonalizedWorkflowEvent
from src.models.user import db


WORKFLOW_STATES = (
    "DRAFT", "COLLECTING_EVIDENCE", "DIAGNOSING", "WAITING_APPROVAL",
    "GENERATING", "READY_TO_PUBLISH", "PUBLISHED", "LEARNING",
    "WAITING_ASSESSMENT", "ASSESSING", "UPDATING_PROFILE", "COMPLETED",
    "PAUSED", "NEEDS_ATTENTION",
)

ALLOWED_TRANSITIONS = {
    "DRAFT": {"WAITING_APPROVAL", "PAUSED"},
    "COLLECTING_EVIDENCE": {"DIAGNOSING", "PAUSED"},
    "DIAGNOSING": {"WAITING_APPROVAL", "NEEDS_ATTENTION", "PAUSED"},
    "WAITING_APPROVAL": {"GENERATING", "PAUSED"},
    "GENERATING": {"READY_TO_PUBLISH", "NEEDS_ATTENTION"},
    "READY_TO_PUBLISH": {"PUBLISHED", "PAUSED"},
    "PUBLISHED": {"LEARNING", "PAUSED"},
    "LEARNING": {"WAITING_ASSESSMENT", "PAUSED"},
    "WAITING_ASSESSMENT": {"ASSESSING", "PAUSED"},
    "ASSESSING": {"UPDATING_PROFILE", "NEEDS_ATTENTION"},
    "UPDATING_PROFILE": {"COMPLETED", "NEEDS_ATTENTION"},
    "COMPLETED": set(),
    "NEEDS_ATTENTION": {"GENERATING", "WAITING_APPROVAL", "PAUSED"},
    "PAUSED": {
        "DRAFT", "COLLECTING_EVIDENCE", "DIAGNOSING", "WAITING_APPROVAL",
        "READY_TO_PUBLISH", "PUBLISHED", "LEARNING", "WAITING_ASSESSMENT",
        "NEEDS_ATTENTION",
    },
}


class WorkflowTransitionError(ValueError):
    pass


def _json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


class PersonalizedWorkflowStore:
    def create(self, owner_id, payload):
        workflow_id = f"wf_{uuid4().hex}"
        item = PersonalizedWorkflow(
            workflow_id=workflow_id,
            owner_id=int(owner_id),
            course_id=int(payload["course_id"]),
            class_id=int(payload["class_id"]),
            student_user_id=int(payload["student_user_id"]),
            state="DRAFT",
            mode=payload.get("mode") or "general",
            topic=payload.get("topic") or "",
            payload_json=_json(payload),
            plan_json=_json(payload),
        )
        db.session.add(item)
        db.session.commit()
        return item.to_dict()

    def get_owned(self, workflow_id, owner_id):
        item = PersonalizedWorkflow.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id)
        ).first()
        return item.to_dict() if item else None

    def list_owned(self, owner_id, state=None, limit=20, offset=0):
        query = PersonalizedWorkflow.query.filter_by(owner_id=int(owner_id))
        if state:
            query = query.filter_by(state=state)
        items = query.order_by(PersonalizedWorkflow.updated_at.desc()).offset(offset).limit(limit).all()
        return [item.to_dict(include_events=False) for item in items]

    def update_owned(self, workflow_id, owner_id, **changes):
        item = PersonalizedWorkflow.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id)
        ).first()
        if not item:
            return None
        json_fields = {
            "payload": "payload_json",
            "plan": "plan_json",
            "generation": "generation_json",
            "review": "review_json",
        }
        scalar_fields = {
            "tracking_id", "draft_config_id", "review_submitted", "last_error", "completed_at"
        }
        for key, value in changes.items():
            if key in json_fields:
                setattr(item, json_fields[key], _json(value) if value is not None else None)
                if key == "payload" and value:
                    item.mode = value.get("mode") or item.mode
                    item.topic = value.get("topic") or item.topic
            elif key in scalar_fields:
                setattr(item, key, value)
        item.version += 1
        item.updated_at = datetime.utcnow()
        db.session.commit()
        return item.to_dict()

    def add_event(self, workflow_id, owner_id, event, state=None):
        item = PersonalizedWorkflow.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id)
        ).first()
        if not item:
            return None
        from_state = item.state
        if state and state != from_state and state not in ALLOWED_TRANSITIONS.get(from_state, set()):
            raise WorkflowTransitionError(f"工作流不能从{from_state}进入{state}")
        idempotency_key = event.get("idempotency_key")
        if idempotency_key:
            existing = PersonalizedWorkflowEvent.query.filter_by(idempotency_key=idempotency_key).first()
            if existing:
                return item.to_dict()
        target_state = state or from_state
        record = PersonalizedWorkflowEvent(
            workflow_id=workflow_id,
            owner_id=int(owner_id),
            actor_id=int(event.get("actor_id") or owner_id),
            event_type=event.get("event_type") or event.get("stage") or "workflow_update",
            stage=event.get("stage"),
            from_state=from_state,
            to_state=target_state,
            message=event.get("message") or "",
            event_data_json=_json(event.get("data") or {}),
            idempotency_key=idempotency_key,
        )
        db.session.add(record)
        item.state = target_state
        item.version += 1
        item.updated_at = datetime.utcnow()
        db.session.commit()
        return item.to_dict()

    def claim_generation(self, workflow_id, owner_id, tracking_id):
        now = datetime.utcnow()
        updated = 0
        source_state = None
        for candidate_state in ("WAITING_APPROVAL", "NEEDS_ATTENTION"):
            updated = PersonalizedWorkflow.query.filter(
                PersonalizedWorkflow.workflow_id == workflow_id,
                PersonalizedWorkflow.owner_id == int(owner_id),
                PersonalizedWorkflow.state == candidate_state,
                PersonalizedWorkflow.generation_json.is_(None),
            ).update({
                PersonalizedWorkflow.state: "GENERATING",
                PersonalizedWorkflow.tracking_id: tracking_id,
                PersonalizedWorkflow.last_error: None,
                PersonalizedWorkflow.version: PersonalizedWorkflow.version + 1,
                PersonalizedWorkflow.updated_at: now,
            }, synchronize_session=False)
            if updated:
                source_state = candidate_state
                break
        if not updated:
            db.session.rollback()
            return None
        db.session.add(PersonalizedWorkflowEvent(
            workflow_id=workflow_id,
            owner_id=int(owner_id),
            actor_id=int(owner_id),
            event_type="generation_started",
            stage="generation",
            from_state=source_state,
            to_state="GENERATING",
            message="开始生成资源",
            event_data_json=_json({"tracking_id": tracking_id}),
            idempotency_key=f"{workflow_id}:generation_started:{tracking_id}",
        ))
        db.session.commit()
        return self.get_owned(workflow_id, owner_id)

    def complete_generation(self, workflow_id, owner_id, result, review, target_state):
        item = PersonalizedWorkflow.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id)
        ).first()
        if not item:
            return None
        if item.state != "GENERATING":
            raise WorkflowTransitionError(f"工作流当前状态为{item.state}，不能完成生成")
        item.generation_json = _json(result)
        item.review_json = _json(review)
        item.state = target_state
        item.last_error = None if target_state == "READY_TO_PUBLISH" else review.get("summary")
        item.version += 1
        item.updated_at = datetime.utcnow()
        db.session.add(PersonalizedWorkflowEvent(
            workflow_id=workflow_id,
            owner_id=int(owner_id),
            actor_id=int(owner_id),
            event_type="review_completed",
            stage="review",
            from_state="GENERATING",
            to_state=target_state,
            message=review.get("summary") or "ReviewAgent审核完成",
            event_data_json=_json({"can_submit": bool(review.get("can_submit"))}),
            idempotency_key=f"{workflow_id}:review_completed",
        ))
        db.session.commit()
        return item.to_dict()

    def recover_stale_owned(self, workflow_id, owner_id, stale_after_seconds=300, now=None):
        item = PersonalizedWorkflow.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id)
        ).first()
        now = now or datetime.utcnow()
        if not item or item.state != "GENERATING" or item.generation_json:
            return item.to_dict() if item else None
        if item.updated_at and item.updated_at > now - timedelta(seconds=stale_after_seconds):
            return item.to_dict()
        item.state = "NEEDS_ATTENTION"
        item.last_error = "服务中断导致生成未完成，可以重新继续生成"
        item.version += 1
        item.updated_at = now
        db.session.add(PersonalizedWorkflowEvent(
            workflow_id=workflow_id,
            owner_id=int(owner_id),
            actor_id=int(owner_id),
            event_type="generation_recovered",
            stage="generation",
            from_state="GENERATING",
            to_state="NEEDS_ATTENTION",
            message=item.last_error,
            event_data_json="{}",
            idempotency_key=f"{workflow_id}:generation_recovered:{item.version}",
        ))
        db.session.commit()
        return item.to_dict()

    def pause(self, workflow_id, owner_id):
        item = PersonalizedWorkflow.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id)
        ).first()
        if not item:
            return None
        return self.add_event(
            workflow_id, owner_id,
            {
                "event_type": "workflow_paused",
                "stage": "approval",
                "message": "工作流已暂停",
                "data": {"resume_state": item.state},
            },
            "PAUSED",
        )

    def resume(self, workflow_id, owner_id):
        item = PersonalizedWorkflow.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id)
        ).first()
        if not item:
            return None
        if item.state != "PAUSED":
            raise WorkflowTransitionError(f"工作流当前状态为{item.state}，不能执行恢复")
        pause_event = PersonalizedWorkflowEvent.query.filter_by(
            workflow_id=workflow_id, owner_id=int(owner_id), event_type="workflow_paused"
        ).order_by(PersonalizedWorkflowEvent.id.desc()).first()
        resume_state = "WAITING_APPROVAL"
        if pause_event:
            resume_state = pause_event.to_dict()["data"].get("resume_state") or resume_state
        if resume_state not in ALLOWED_TRANSITIONS["PAUSED"]:
            resume_state = "WAITING_APPROVAL"
        return self.add_event(
            workflow_id, owner_id,
            {"event_type": "workflow_resumed", "stage": "approval", "message": "工作流已恢复，等待确认"},
            resume_state,
        )

    def clear_for_tests(self):
        PersonalizedWorkflowEvent.query.delete()
        PersonalizedWorkflow.query.delete()
        db.session.commit()


workflow_store = PersonalizedWorkflowStore()


def build_rule_resources(topic, knowledge_points, resource_types):
    """Create editable local resources when the external model is unavailable."""
    points = [str(item).strip() for item in knowledge_points if str(item).strip()] or [topic]
    point_text = "、".join(points)
    builders = {
        "document": lambda: {"title": f"{topic}学习讲义", "content": f"本讲义围绕{point_text}展开，按照概念、示例、常见错误和总结组织。"},
        "mindmap": lambda: {"title": f"{topic}知识结构", "content": {"root": topic, "children": [{"name": item} for item in points]}},
        "layered_exercise": lambda: {"title": f"{topic}分层练习", "questions": [{"question": f"请说明{item}的核心规则。", "answer": f"围绕{item}的定义、条件和应用作答。", "explanation": "用于检查概念理解。", "difficulty": "基础"} for item in points]},
        "exercise": lambda: {"title": f"{topic}分层练习", "questions": [{"question": f"请说明{item}的核心规则。", "answer": f"围绕{item}的定义、条件和应用作答。", "explanation": "用于检查概念理解。", "difficulty": "基础"} for item in points]},
        "recommendation": lambda: {"title": f"{topic}学习建议", "content": [f"先理解{points[0]}", "完成基础练习", "根据错题进行复习"], "external_status": "未使用外部内容"},
        "media": lambda: {"title": f"{topic}视频脚本", "script": [{"scene": "导入", "voiceover": f"本节学习{topic}。"}, {"scene": "讲解", "voiceover": f"依次理解{point_text}。"}]},
        "project": lambda: {"title": f"{topic}实践项目", "description": f"通过一个小型任务应用{point_text}。", "steps": ["明确输入与输出", "完成核心实现", "测试边界情况"], "acceptance_criteria": ["实现能够运行", "覆盖核心知识点", "能够解释关键步骤"]},
        "ppt": lambda: {"title": f"{topic}课件大纲", "slides": [{"title": "学习目标", "content": points}, {"title": "核心讲解", "content": [point_text]}, {"title": "练习与总结", "content": ["完成检测并总结易错点"]}], "external_status": "外部PPT文件未生成，已返回可编辑课件大纲"},
    }
    return {resource_type: builders[resource_type]() for resource_type in resource_types if resource_type in builders}
