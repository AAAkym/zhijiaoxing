from datetime import datetime

from src.models.user import db


class PersonalizedTaskNotification(db.Model):
    __tablename__ = "personalized_task_notifications"
    __table_args__ = (
        db.Index("idx_task_notifications_user_read_created", "user_id", "is_read", "created_at"),
        db.Index("idx_task_notifications_delivery_created", "delivery_id", "created_at"),
        {"extend_existing": True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    delivery_id = db.Column(
        db.String(40),
        db.ForeignKey("personalized_task_deliveries.delivery_id", ondelete="CASCADE"),
        nullable=False,
    )
    notification_type = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False, default="")
    action = db.Column(db.String(40), nullable=False, default="open_task")
    idempotency_key = db.Column(db.String(180), nullable=False, unique=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    read_at = db.Column(db.DateTime)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "delivery_id": self.delivery_id,
            "notification_type": self.notification_type,
            "title": self.title,
            "content": self.content,
            "action": self.action,
            "is_read": bool(self.is_read),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }
