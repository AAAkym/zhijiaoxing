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


class PersonalizedTaskDelivery(db.Model):
    __tablename__ = "personalized_task_deliveries"
    __table_args__ = (
        db.UniqueConstraint("workflow_id", "student_user_id", name="uq_delivery_workflow_student"),
        db.Index("idx_task_deliveries_owner_updated", "owner_id", "updated_at"),
        db.Index("idx_task_deliveries_student_status", "student_user_id", "status"),
        db.Index("idx_task_deliveries_course_class", "course_id", "class_id"),
        {"extend_existing": True},
    )

    delivery_id = db.Column(db.String(40), primary_key=True)
    workflow_id = db.Column(db.String(40), db.ForeignKey("personalized_workflows.workflow_id"), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey("class_groups.id"), nullable=False)
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="PUBLISHED")
    title = db.Column(db.String(200), nullable=False)
    instructions = db.Column(db.Text, default="")
    resource_snapshot_json = db.Column(db.Text, nullable=False, default="{}")
    strategy_snapshot_json = db.Column(db.Text, nullable=False, default="{}")
    baseline_snapshot_json = db.Column(db.Text, nullable=False, default="{}")
    completion_rules_json = db.Column(db.Text, nullable=False, default="{}")
    progress_percentage = db.Column(db.Float, nullable=False, default=0.0)
    idempotency_key = db.Column(db.String(120), nullable=False, unique=True)
    version = db.Column(db.Integer, nullable=False, default=1)
    published_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    due_at = db.Column(db.DateTime)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    events = db.relationship("PersonalizedDeliveryEvent", backref="delivery", lazy="select", cascade="all, delete-orphan", order_by="PersonalizedDeliveryEvent.id")
    cycles = db.relationship("PersonalizedLearningCycle", backref="delivery", lazy="select", cascade="all, delete-orphan", order_by="PersonalizedLearningCycle.cycle_number")

    def get_due_status(self, now=None):
        if self.status == "CYCLE_COMPLETED" or self.completed_at:
            return "completed"
        if not self.due_at:
            return "none"
        now = now or datetime.utcnow()
        remaining_seconds = (self.due_at - now).total_seconds()
        if remaining_seconds < 0:
            return "overdue"
        if remaining_seconds <= 24 * 60 * 60:
            return "due_soon"
        return "active"

    def to_dict(self, include_events=False, include_cycles=False):
        due_status = self.get_due_status()
        return {
            "delivery_id": self.delivery_id, "workflow_id": self.workflow_id,
            "owner_id": self.owner_id, "course_id": self.course_id, "class_id": self.class_id,
            "student_user_id": self.student_user_id, "status": self.status,
            "title": self.title, "instructions": self.instructions or "",
            "resources": _load_json(self.resource_snapshot_json, {}),
            "strategy": _load_json(self.strategy_snapshot_json, {}),
            "baseline": _load_json(self.baseline_snapshot_json, {}),
            "completion_rules": _load_json(self.completion_rules_json, {}),
            "progress_percentage": round(float(self.progress_percentage or 0), 1),
            "version": self.version,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "due_at": self.due_at.isoformat() if self.due_at else None,
            "due_status": due_status,
            "is_overdue": due_status == "overdue",
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "events": [event.to_dict() for event in self.events] if include_events else [],
            "cycles": [cycle.to_dict() for cycle in self.cycles] if include_cycles else [],
        }


class PersonalizedDeliveryEvent(db.Model):
    __tablename__ = "personalized_delivery_events"
    __table_args__ = (
        db.Index("idx_delivery_events_delivery_time", "delivery_id", "occurred_at"),
        db.Index("idx_delivery_events_student_time", "student_user_id", "occurred_at"),
        db.Index("idx_delivery_events_resource_type", "resource_key", "event_type"),
        {"extend_existing": True},
    )

    id = db.Column(db.Integer, primary_key=True)
    delivery_id = db.Column(db.String(40), db.ForeignKey("personalized_task_deliveries.delivery_id", ondelete="CASCADE"), nullable=False)
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    event_type = db.Column(db.String(40), nullable=False)
    resource_key = db.Column(db.String(80))
    event_data_json = db.Column(db.Text, nullable=False, default="{}")
    idempotency_key = db.Column(db.String(160), nullable=False, unique=True)
    occurred_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    received_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "delivery_id": self.delivery_id,
            "student_user_id": self.student_user_id, "event_type": self.event_type,
            "resource_key": self.resource_key, "data": _load_json(self.event_data_json, {}),
            "occurred_at": self.occurred_at.isoformat() if self.occurred_at else None,
            "received_at": self.received_at.isoformat() if self.received_at else None,
        }


class PersonalizedLearningCycle(db.Model):
    __tablename__ = "personalized_learning_cycles"
    __table_args__ = (
        db.UniqueConstraint("delivery_id", "cycle_number", name="uq_learning_cycle_delivery_number"),
        db.Index("idx_learning_cycles_owner_updated", "owner_id", "updated_at"),
        db.Index("idx_learning_cycles_student_status", "student_user_id", "status"),
        {"extend_existing": True},
    )

    cycle_id = db.Column(db.String(40), primary_key=True)
    delivery_id = db.Column(db.String(40), db.ForeignKey("personalized_task_deliveries.delivery_id", ondelete="CASCADE"), nullable=False)
    workflow_id = db.Column(db.String(40), db.ForeignKey("personalized_workflows.workflow_id"), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    cycle_number = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(32), nullable=False, default="COLLECTING_EVIDENCE")
    evidence_window_start = db.Column(db.DateTime, nullable=False)
    evidence_window_end = db.Column(db.DateTime)
    evidence_snapshot_json = db.Column(db.Text, nullable=False, default="{}")
    assessment_snapshot_json = db.Column(db.Text, nullable=False, default="{}")
    feedback_json = db.Column(db.Text, nullable=False, default="{}")
    profile_before_json = db.Column(db.Text, nullable=False, default="{}")
    profile_proposal_json = db.Column(db.Text, nullable=False, default="{}")
    profile_after_json = db.Column(db.Text, nullable=False, default="{}")
    review_json = db.Column(db.Text, nullable=False, default="{}")
    next_strategy_json = db.Column(db.Text, nullable=False, default="{}")
    next_workflow_id = db.Column(db.String(40), db.ForeignKey("personalized_workflows.workflow_id"))
    tracking_id = db.Column(db.String(96), nullable=False, unique=True)
    idempotency_key = db.Column(db.String(160), nullable=False, unique=True)
    confidence_score = db.Column(db.Integer, nullable=False, default=0)
    last_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "cycle_id": self.cycle_id, "delivery_id": self.delivery_id,
            "workflow_id": self.workflow_id, "owner_id": self.owner_id,
            "student_user_id": self.student_user_id, "cycle_number": self.cycle_number,
            "status": self.status,
            "evidence_window_start": self.evidence_window_start.isoformat() if self.evidence_window_start else None,
            "evidence_window_end": self.evidence_window_end.isoformat() if self.evidence_window_end else None,
            "evidence": _load_json(self.evidence_snapshot_json, {}),
            "assessment": _load_json(self.assessment_snapshot_json, {}),
            "feedback": _load_json(self.feedback_json, {}),
            "profile_before": _load_json(self.profile_before_json, {}),
            "profile_proposal": _load_json(self.profile_proposal_json, {}),
            "profile_after": _load_json(self.profile_after_json, {}),
            "review": _load_json(self.review_json, {}),
            "next_strategy": _load_json(self.next_strategy_json, {}),
            "next_workflow_id": self.next_workflow_id, "tracking_id": self.tracking_id,
            "confidence_score": self.confidence_score, "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
