from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='student')
    real_name = db.Column(db.String(100))
    avatar = db.Column(db.String(500), nullable=True)
    learning_goal = db.Column(db.Text, nullable=True)
    ai_style = db.Column(db.String(50), default='academic')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    AI_STYLES = {
        'academic': '严谨学术型',
        'humorous': '幽默风趣型',
        'encouraging': '鼓励引导型',
        'concise': '简洁直接型'
    }

    def __repr__(self):
        return f'<User {self.username}>'
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'real_name': self.real_name,
            'avatar': self.avatar,
            'learning_goal': self.learning_goal,
            'ai_style': self.ai_style,
            'ai_style_name': self.AI_STYLES.get(self.ai_style, self.ai_style),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
