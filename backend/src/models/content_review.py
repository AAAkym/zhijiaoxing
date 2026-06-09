from src.models.user import db
from datetime import datetime


class ContentReview(db.Model):
    __tablename__ = 'content_reviews'

    id = db.Column(db.Integer, primary_key=True)
    content_id = db.Column(db.Integer, nullable=False)
    content_type = db.Column(db.String(30), nullable=False)  # 'knowledge_point', 'teaching_case', 'exercise', 'teaching_content'
    content_title = db.Column(db.String(200), default='')
    content_body = db.Column(db.Text, default='')
    source = db.Column(db.String(20), default='ai')  # 'ai', 'teacher', 'student'
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Review workflow
    status = db.Column(db.String(20), default='pending')  # pending, auto_reviewing, manual_reviewing, spot_checking, passed, rejected
    review_mechanism = db.Column(db.String(20), default='auto')  # auto, manual, spot_check

    # Auto review results
    auto_score = db.Column(db.Float, default=None)
    auto_review_result = db.Column(db.Text, default='')
    auto_reviewed_at = db.Column(db.DateTime, default=None)

    # Manual review
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    review_comment = db.Column(db.Text, default='')
    review_score = db.Column(db.Integer, default=None)
    reviewed_at = db.Column(db.DateTime, default=None)

    # Version tracking
    version = db.Column(db.Integer, default=1)
    previous_version_id = db.Column(db.Integer, db.ForeignKey('content_reviews.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author = db.relationship('User', foreign_keys=[author_id], backref='authored_reviews')
    reviewer = db.relationship('User', foreign_keys=[reviewer_id], backref='conducted_reviews')
    previous_version = db.relationship('ContentReview', remote_side=[id], backref='next_versions')

    def to_dict(self, include_content=False):
        d = {
            'id': self.id,
            'content_id': self.content_id,
            'content_type': self.content_type,
            'content_title': self.content_title,
            'source': self.source,
            'author_id': self.author_id,
            'status': self.status,
            'review_mechanism': self.review_mechanism,
            'auto_score': self.auto_score,
            'auto_reviewed_at': self.auto_reviewed_at.isoformat() if self.auto_reviewed_at else None,
            'reviewer_id': self.reviewer_id,
            'review_comment': self.review_comment,
            'review_score': self.review_score,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'version': self.version,
            'previous_version_id': self.previous_version_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_content:
            d['content_body'] = self.content_body
            d['auto_review_result'] = self.auto_review_result
        return d


class ReviewRule(db.Model):
    __tablename__ = 'review_rules'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    rule_type = db.Column(db.String(20), default='auto')  # auto, manual, spot_check
    enabled = db.Column(db.Boolean, default=True)
    threshold = db.Column(db.Float, default=60.0)
    description = db.Column(db.Text, default='')
    config = db.Column(db.Text, default='{}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'rule_type': self.rule_type,
            'enabled': self.enabled,
            'threshold': self.threshold,
            'description': self.description,
            'config': self.config,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ReviewOperationLog(db.Model):
    __tablename__ = 'review_operation_logs'

    id = db.Column(db.Integer, primary_key=True)
    review_id = db.Column(db.Integer, db.ForeignKey('content_reviews.id'), nullable=True)
    operator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    detail = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    operator = db.relationship('User', foreign_keys=[operator_id])
    review = db.relationship('ContentReview', foreign_keys=[review_id])

    def to_dict(self):
        return {
            'id': self.id,
            'review_id': self.review_id,
            'operator_id': self.operator_id,
            'operator_name': self.operator.real_name or self.operator.username if self.operator else None,
            'action': self.action,
            'detail': self.detail,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
