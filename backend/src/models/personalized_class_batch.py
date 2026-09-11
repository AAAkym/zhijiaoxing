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


class PersonalizedClassBatch(db.Model):
    __tablename__ = "personalized_class_batches"
    __table_args__ = (
        db.Index("idx_class_batches_owner_updated", "owner_id", "updated_at"),
        db.Index("idx_class_batches_class_state", "class_id", "state"),
        {"extend_existing": True},
    )

    batch_id = db.Column(db.String(40), primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey("class_groups.id"), nullable=False)
    state = db.Column(db.String(32), nullable=False, default="PREFLIGHT")
    topic = db.Column(db.String(200), nullable=False)
    knowledge_points_json = db.Column(db.Text, nullable=False, default="[]")
    required_resource_types_json = db.Column(db.Text, nullable=False, default="[]")
    options_json = db.Column(db.Text, nullable=False, default="{}")
    student_count = db.Column(db.Integer, nullable=False, default=0)
    ready_count = db.Column(db.Integer, nullable=False, default=0)
    generated_count = db.Column(db.Integer, nullable=False, default=0)
    published_count = db.Column(db.Integer, nullable=False, default=0)
    version = db.Column(db.Integer, nullable=False, default=1)
    last_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    published_at = db.Column(db.DateTime)

    items = db.relationship(
        "PersonalizedClassBatchItem", backref="batch", lazy="select",
        cascade="all, delete-orphan", order_by="PersonalizedClassBatchItem.id",
    )

    def to_dict(self, include_items=True):
        result = {
            "batch_id": self.batch_id, "owner_id": self.owner_id,
            "course_id": self.course_id, "class_id": self.class_id,
            "state": self.state, "topic": self.topic,
            "knowledge_points": _load_json(self.knowledge_points_json, []),
            "required_resource_types": _load_json(self.required_resource_types_json, []),
            "options": _load_json(self.options_json, {}),
            "student_count": self.student_count, "ready_count": self.ready_count,
            "generated_count": self.generated_count, "published_count": self.published_count,
            "version": self.version, "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
        }
        result["items"] = [item.to_dict() for item in self.items] if include_items else []
        return result


class PersonalizedClassBatchItem(db.Model):
    __tablename__ = "personalized_class_batch_items"
    __table_args__ = (
        db.UniqueConstraint("batch_id", "student_user_id", name="uq_class_batch_student"),
        db.Index("idx_class_batch_items_batch_state", "batch_id", "state"),
        db.Index("idx_class_batch_items_student_created", "student_user_id", "created_at"),
        {"extend_existing": True},
    )

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(40), db.ForeignKey("personalized_class_batches.batch_id", ondelete="CASCADE"), nullable=False)
    student_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    student_name = db.Column(db.String(100), nullable=False, default="")
    workflow_id = db.Column(db.String(40), db.ForeignKey("personalized_workflows.workflow_id"), unique=True)
    delivery_id = db.Column(db.String(40), db.ForeignKey("personalized_task_deliveries.delivery_id"), unique=True)
    state = db.Column(db.String(32), nullable=False, default="PROFILE_REQUIRED")
    profile_status = db.Column(db.String(24), nullable=False, default="missing")
    profile_summary_json = db.Column(db.Text, nullable=False, default="{}")
    resource_types_json = db.Column(db.Text, nullable=False, default="[]")
    generation_mode = db.Column(db.String(32))
    review_passed = db.Column(db.Boolean, nullable=False, default=False)
    attempt_count = db.Column(db.Integer, nullable=False, default=0)
    version = db.Column(db.Integer, nullable=False, default=1)
    last_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    published_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "id": self.id, "batch_id": self.batch_id,
            "student_user_id": self.student_user_id, "student_name": self.student_name,
            "workflow_id": self.workflow_id, "delivery_id": self.delivery_id,
            "state": self.state, "profile_status": self.profile_status,
            "profile_summary": _load_json(self.profile_summary_json, {}),
            "resource_types": _load_json(self.resource_types_json, []),
            "generation_mode": self.generation_mode, "review_passed": bool(self.review_passed),
            "attempt_count": self.attempt_count, "version": self.version,
            "last_error": self.last_error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "published_at": self.published_at.isoformat() if self.published_at else None,
        }
