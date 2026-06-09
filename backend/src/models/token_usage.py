from src.models.user import db
from datetime import datetime


class TokenUsage(db.Model):
    __tablename__ = 'token_usage'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    user_role = db.Column(db.String(20), nullable=True, index=True)
    prompt_tokens = db.Column(db.Integer, default=0)
    completion_tokens = db.Column(db.Integer, default=0)
    total_tokens = db.Column(db.Integer, default=0)
    model = db.Column(db.String(50), default='lite')
    call_type = db.Column(db.String(50), nullable=True)
    request_id = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship('User', backref='token_usages')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_role': self.user_role,
            'prompt_tokens': self.prompt_tokens,
            'completion_tokens': self.completion_tokens,
            'total_tokens': self.total_tokens,
            'model': self.model,
            'call_type': self.call_type,
            'request_id': self.request_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
