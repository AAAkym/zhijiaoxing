import json
from datetime import datetime

from src.models.user import db


def _load_json(value, default):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


class PersonalizedWorkflow(db.Model):
    __tablename__ = "personalized_workflows"
    __table_args__ = (
        db.Index("idx_personalized_workflows_owner_updated", "owner_id", "updated_at"),
        db.Index("idx_personalized_workflows_student_course", "student_user_id", "course_id"),
        db.Index("idx_personalized_workflows_state_updated", "state", "updated_at"),
        {"extend_existing": True},
    )

    workflow_id = db.Column(db.String(40), primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey("class_groups.id"), nullable=False)
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    state = db.Column(db.String(32), nullable=False, default="DRAFT")
    mode = db.Column(db.String(20), nullable=False, default="general")
    topic = db.Column(db.String(200), nullable=False, default="")
    payload_json = db.Column(db.Text, nullable=False, default="{}")
    plan_json = db.Column(db.Text)
    generation_json = db.Column(db.Text)
    review_json = db.Column(db.Text)
    tracking_id = db.Column(db.String(96), nullable=True, unique=True)
    draft_config_id = db.Column(db.Integer, db.ForeignKey("course_generation_configs.id"), nullable=True)
    review_submitted = db.Column(db.Boolean, nullable=False, default=False)
    version = db.Column(db.Integer, nullable=False, default=1)
    last_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    events = db.relationship(
        "PersonalizedWorkflowEvent",
        backref="workflow",
        lazy="select",
        cascade="all, delete-orphan",
        order_by="PersonalizedWorkflowEvent.id",
    )

    def to_dict(self, include_events=True):
        result = {
            "workflow_id": self.workflow_id,
            "owner_id": self.owner_id,
            "course_id": self.course_id,
            "class_id": self.class_id,
            "student_user_id": self.student_user_id,
            "state": self.state,
            "mode": self.mode,
            "topic": self.topic,
            "payload": _load_json(self.payload_json, {}),
            "plan": _load_json(self.plan_json, None),
            "generation": _load_json(self.generation_json, None),
            "review": _load_json(self.review_json, None),
            "tracking_id": self.tracking_id,
            "draft_config_id": self.draft_config_id,
            "review_submitted": bool(self.review_submitted),
            "version": self.version,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
        result["events"] = [event.to_dict() for event in self.events] if include_events else []
        return result


class PersonalizedWorkflowEvent(db.Model):
    __tablename__ = "personalized_workflow_events"
    __table_args__ = (
        db.Index("idx_personalized_workflow_events_workflow_created", "workflow_id", "created_at"),
        db.Index("idx_personalized_workflow_events_owner_created", "owner_id", "created_at"),
        {"extend_existing": True},
    )

    id = db.Column(db.Integer, primary_key=True)
    workflow_id = db.Column(
        db.String(40),
        db.ForeignKey("personalized_workflows.workflow_id", ondelete="CASCADE"),
        nullable=False,
    )
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    event_type = db.Column(db.String(50), nullable=False)
    stage = db.Column(db.String(50), nullable=True)
    from_state = db.Column(db.String(32), nullable=True)
    to_state = db.Column(db.String(32), nullable=True)
    message = db.Column(db.String(500), nullable=False, default="")
    event_data_json = db.Column(db.Text, nullable=False, default="{}")
    idempotency_key = db.Column(db.String(120), nullable=True, unique=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "owner_id": self.owner_id,
            "actor_id": self.actor_id,
            "event_type": self.event_type,
            "stage": self.stage,
            "from_state": self.from_state,
            "to_state": self.to_state,
            "message": self.message,
            "data": _load_json(self.event_data_json, {}),
            "idempotency_key": self.idempotency_key,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
