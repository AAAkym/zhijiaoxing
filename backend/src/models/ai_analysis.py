from datetime import datetime
import json

from src.models.user import db


class AIAnalysisReport(db.Model):
    __tablename__ = 'ai_analysis_reports'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    report_type = db.Column(db.String(20), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    period_start = db.Column(db.DateTime, nullable=False)
    period_end = db.Column(db.DateTime, nullable=False)
    summary = db.Column(db.Text, default='')
    key_metrics = db.Column(db.Text, default='{}')
    anomalies = db.Column(db.Text, default='[]')
    recommendations = db.Column(db.Text, default='[]')
    detailed_analysis = db.Column(db.Text, default='')
    roi_analysis = db.Column(db.Text, default='')
    resource_optimization = db.Column(db.Text, default='')
    status = db.Column(db.String(20), default='generated')
    generated_by = db.Column(db.String(20), default='ai')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self, include_detail=False):
        result = {
            'id': self.id,
            'report_type': self.report_type,
            'title': self.title,
            'period_start': self.period_start.isoformat() if self.period_start else None,
            'period_end': self.period_end.isoformat() if self.period_end else None,
            'summary': self.summary,
            'key_metrics': json.loads(self.key_metrics) if isinstance(self.key_metrics, str) else self.key_metrics,
            'anomalies': json.loads(self.anomalies) if isinstance(self.anomalies, str) else self.anomalies,
            'recommendations': json.loads(self.recommendations) if isinstance(self.recommendations, str) else self.recommendations,
            'status': self.status,
            'generated_by': self.generated_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_detail:
            result['detailed_analysis'] = self.detailed_analysis
            result['roi_analysis'] = self.roi_analysis
            result['resource_optimization'] = self.resource_optimization
        return result


class TargetedQuestionGroup(db.Model):
    __tablename__ = 'targeted_question_groups'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'))
    title = db.Column(db.String(200), default='')
    questions = db.Column(db.Text, default='[]')
    weak_tags = db.Column(db.Text, default='[]')
    difficulty = db.Column(db.String(20), default='adaptive')
    choice_count = db.Column(db.Integer, default=0)
    programming_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='question_groups')

    def to_dict(self, include_questions=False):
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'title': self.title,
            'weak_tags': json.loads(self.weak_tags) if isinstance(self.weak_tags, str) else self.weak_tags,
            'difficulty': self.difficulty,
            'choice_count': self.choice_count,
            'programming_count': self.programming_count,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_questions:
            result['questions'] = json.loads(self.questions) if isinstance(self.questions, str) else self.questions
        return result


class AIInsight(db.Model):
    __tablename__ = 'ai_insights'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    insight_type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    risk_level = db.Column(db.String(20), default='low')
    confidence = db.Column(db.Float, default=0.0)
    affected_count = db.Column(db.Integer, default=0)
    metrics_data = db.Column(db.Text, default='{}')
    recommendations = db.Column(db.Text, default='[]')
    status = db.Column(db.String(20), default='active')
    valid_until = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'insight_type': self.insight_type,
            'title': self.title,
            'description': self.description,
            'risk_level': self.risk_level,
            'confidence': round(self.confidence, 2) if self.confidence else 0,
            'affected_count': self.affected_count,
            'metrics_data': json.loads(self.metrics_data) if isinstance(self.metrics_data, str) else self.metrics_data,
            'recommendations': json.loads(self.recommendations) if isinstance(self.recommendations, str) else self.recommendations,
            'status': self.status,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class AnalysisNotification(db.Model):
    __tablename__ = 'analysis_notifications'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    notification_type = db.Column(db.String(50), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, default='')
    related_id = db.Column(db.Integer)
    related_type = db.Column(db.String(50))
    channel = db.Column(db.String(20), default='system')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='analysis_notifications')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'notification_type': self.notification_type,
            'title': self.title,
            'content': self.content,
            'related_id': self.related_id,
            'related_type': self.related_type,
            'channel': self.channel,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AnalysisAccessLog(db.Model):
    __tablename__ = 'analysis_access_logs'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    resource_type = db.Column(db.String(50), nullable=False)
    resource_id = db.Column(db.Integer)
    access_level = db.Column(db.String(20), default='basic')
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'access_level': self.access_level,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
