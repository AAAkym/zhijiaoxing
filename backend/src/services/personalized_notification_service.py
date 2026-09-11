import os
from datetime import datetime, timedelta

from flask import current_app

from src.models.user import db
from src.models.personalized_learning import PersonalizedTaskDelivery
from src.models.personalized_notification import PersonalizedTaskNotification


NOTIFICATION_COPY = {
    "published": ("新的个性化任务", "教师已发布“{title}”，请按推荐顺序开始学习。"),
    "due_soon": ("任务即将截止", "“{title}”将在24小时内截止，请及时完成。"),
    "overdue": ("任务已经逾期", "“{title}”已超过截止时间，任务仍可继续，请尽快完成。"),
    "paused": ("任务已暂停", "教师已暂停“{title}”，当前学习记录会被保留。"),
    "resumed": ("任务已恢复", "教师已恢复“{title}”，你可以继续学习。"),
    "manual_reminder": ("教师提醒你完成任务", "请关注“{title}”的学习进度和截止时间。"),
    "next_cycle_ready": ("下一轮学习方案已生成", "“{title}”本轮分析完成，下一轮个性化方案已经准备好。"),
}


class NotificationError(ValueError):
    def __init__(self, message, code="NOTIFICATION_INVALID", status=400):
        super().__init__(message)
        self.code = code
        self.status = status


class PersonalizedNotificationService:
    def create(self, delivery, notification_type, idempotency_key, commit=False):
        if notification_type not in NOTIFICATION_COPY:
            raise NotificationError("通知类型不受支持")
        existing = PersonalizedTaskNotification.query.filter_by(idempotency_key=idempotency_key).first()
        if existing:
            return existing, True
        title, content = NOTIFICATION_COPY[notification_type]
        notification = PersonalizedTaskNotification(
            user_id=delivery.student_user_id,
            delivery_id=delivery.delivery_id,
            notification_type=notification_type,
            title=title,
            content=content.format(title=delivery.title),
            idempotency_key=idempotency_key[:180],
        )
        db.session.add(notification)
        if commit:
            db.session.commit()
        return notification, False

    def list_for_user(self, user_id, page=1, page_size=20, unread_only=False):
        page = max(1, int(page or 1))
        page_size = min(100, max(1, int(page_size or 20)))
        query = PersonalizedTaskNotification.query.filter_by(user_id=int(user_id))
        if unread_only:
            query = query.filter_by(is_read=False)
        total = query.count()
        items = query.order_by(
            PersonalizedTaskNotification.created_at.desc(),
            PersonalizedTaskNotification.id.desc(),
        ).offset((page - 1) * page_size).limit(page_size).all()
        unread_count = PersonalizedTaskNotification.query.filter_by(
            user_id=int(user_id), is_read=False
        ).count()
        pages = (total + page_size - 1) // page_size if total else 0
        return {
            "notifications": [item.to_dict() for item in items],
            "unread_count": unread_count,
            "pagination": {
                "page": page, "page_size": page_size, "total": total, "pages": pages,
                "has_previous": page > 1, "has_next": page < pages,
            },
        }

    def mark_read(self, user_id, notification_id):
        item = PersonalizedTaskNotification.query.filter_by(
            id=int(notification_id), user_id=int(user_id)
        ).first()
        if not item:
            raise NotificationError("通知不存在或无权访问", "NOTIFICATION_NOT_FOUND", 404)
        if not item.is_read:
            item.is_read = True
            item.read_at = datetime.utcnow()
            db.session.commit()
        return item.to_dict()

    def mark_all_read(self, user_id):
        now = datetime.utcnow()
        items = PersonalizedTaskNotification.query.filter_by(
            user_id=int(user_id), is_read=False
        ).all()
        for item in items:
            item.is_read = True
            item.read_at = now
        db.session.commit()
        return len(items)

    def create_manual_reminders(self, owner_id, delivery_ids, now=None):
        now = now or datetime.utcnow()
        ids = list(dict.fromkeys(str(value).strip() for value in (delivery_ids or []) if str(value).strip()))
        if not ids or len(ids) > 100:
            raise NotificationError("请选择1至100个有效任务", "REMINDER_DELIVERY_IDS_INVALID")
        owned = {
            item.delivery_id: item for item in PersonalizedTaskDelivery.query.filter(
                PersonalizedTaskDelivery.owner_id == int(owner_id),
                PersonalizedTaskDelivery.delivery_id.in_(ids),
            ).all()
        }
        created = 0
        results = []
        day_key = now.strftime("%Y%m%d")
        for delivery_id in ids:
            delivery = owned.get(delivery_id)
            if not delivery:
                results.append({"delivery_id": delivery_id, "status": "skipped", "reason": "任务不存在或无权操作"})
                continue
            if delivery.get_due_status(now) == "completed":
                results.append({"delivery_id": delivery_id, "status": "skipped", "reason": "任务已经完成"})
                continue
            _, repeated = self.create(
                delivery, "manual_reminder",
                f"{delivery_id}:manual_reminder:{owner_id}:{day_key}",
            )
            created += 0 if repeated else 1
            results.append({
                "delivery_id": delivery_id,
                "status": "skipped" if repeated else "created",
                "reason": "今天已经提醒过" if repeated else "提醒已创建",
            })
        db.session.commit()
        return {
            "requested_count": len(ids), "created_count": created,
            "skipped_count": len(ids) - created, "results": results,
        }

    def run_due_reminders(self, now=None):
        now = now or datetime.utcnow()
        candidates = PersonalizedTaskDelivery.query.filter(
            PersonalizedTaskDelivery.due_at.isnot(None),
            PersonalizedTaskDelivery.status != "CYCLE_COMPLETED",
            PersonalizedTaskDelivery.completed_at.is_(None),
            PersonalizedTaskDelivery.due_at <= now + timedelta(hours=24),
        ).all()
        created = 0
        repeated = 0
        for delivery in candidates:
            notification_type = "overdue" if delivery.due_at < now else "due_soon"
            window = delivery.due_at.strftime("%Y%m%d%H%M")
            _, was_repeated = self.create(
                delivery, notification_type,
                f"{delivery.delivery_id}:{notification_type}:{window}",
            )
            repeated += int(was_repeated)
            created += int(not was_repeated)
        db.session.commit()
        return {"checked_count": len(candidates), "created_count": created, "repeated_count": repeated}

    def scheduler_status(self):
        redis_url = current_app.config.get("REDIS_URL") or os.environ.get("REDIS_URL") or "redis://localhost:6379/0"
        redis_result = {"available": False, "message": "Redis不可用"}
        try:
            import redis
            client = redis.Redis.from_url(redis_url, socket_connect_timeout=0.5, socket_timeout=0.5)
            client.ping()
            redis_result = {"available": True, "message": "Redis连接正常"}
        except Exception as exc:
            redis_result["message"] = f"Redis不可用：{type(exc).__name__}"

        worker_available = False
        if redis_result["available"]:
            try:
                from src.celery_app import celery_app
                replies = celery_app.control.inspect(timeout=0.8).ping() or {}
                worker_available = bool(replies)
            except Exception:
                worker_available = False
        beat_enabled = os.environ.get("CELERY_BEAT_ENABLED", "false").lower() in ("1", "true", "yes")
        enabled = redis_result["available"] and worker_available and beat_enabled
        return {
            "enabled": enabled,
            "redis": redis_result,
            "worker": {"available": worker_available, "message": "Worker在线" if worker_available else "未检测到Celery Worker"},
            "beat": {"available": beat_enabled, "message": "Beat已声明启用" if beat_enabled else "CELERY_BEAT_ENABLED未启用"},
            "message": "定时提醒已启用" if enabled else "定时提醒未启用；任务列表和手动提醒仍可使用",
        }


personalized_notification_service = PersonalizedNotificationService()
