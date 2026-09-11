from celery import shared_task


@shared_task(name="src.tasks.personalized_reminder_tasks.create_due_reminders")
def create_due_reminders():
    from src.main import app
    from src.services.personalized_notification_service import personalized_notification_service

    with app.app_context():
        return personalized_notification_service.run_due_reminders()
