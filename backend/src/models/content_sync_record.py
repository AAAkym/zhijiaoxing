import json
import logging
import os
import uuid
from datetime import datetime

from src.models.user import db

logger = logging.getLogger(__name__)


class ContentSyncRecord(db.Model):
    __tablename__ = 'content_sync_records'
    __table_args__ = (
        db.Index('idx_sync_records_package', 'package_id'),
        db.Index('idx_sync_records_course', 'course_id'),
        db.Index('idx_sync_records_status', 'sync_status'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    package_id = db.Column(db.String(64), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    topic = db.Column(db.String(200), default='')
    content_type = db.Column(db.String(50), nullable=False)
    save_format = db.Column(db.String(20), default='json')
    content_snapshot = db.Column(db.Text)
    teaching_content_id = db.Column(db.Integer, db.ForeignKey('teaching_contents.id'), nullable=True)
    markdown_content = db.Column(db.Text)
    json_content = db.Column(db.Text)
    sync_status = db.Column(db.String(20), default='pending')
    sync_progress = db.Column(db.Integer, default=0)
    sync_error = db.Column(db.Text)
    retry_count = db.Column(db.Integer, default=0)
    max_retries = db.Column(db.Integer, default=3)
    synced_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref='sync_records')
    teacher = db.relationship('User', backref='sync_records')
    teaching_content = db.relationship('TeachingContent', backref='sync_records')

    def to_dict(self):
        return {
            'id': self.id,
            'package_id': self.package_id,
            'course_id': self.course_id,
            'teacher_id': self.teacher_id,
            'topic': self.topic,
            'content_type': self.content_type,
            'save_format': self.save_format,
            'teaching_content_id': self.teaching_content_id,
            'sync_status': self.sync_status,
            'sync_progress': self.sync_progress,
            'sync_error': self.sync_error,
            'retry_count': self.retry_count,
            'max_retries': self.max_retries,
            'synced_at': self.synced_at.isoformat() if self.synced_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
