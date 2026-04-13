"""
搜索日志模型

记录用户搜索行为，用于分析和推荐
"""
from datetime import datetime
from src.models.user import db


class SearchLog(db.Model):
    """搜索日志模型"""
    __tablename__ = 'search_logs'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    query = db.Column(db.String(500), nullable=False)
    index_type = db.Column(db.String(50), default='all')
    results_count = db.Column(db.Integer, default=0)
    response_time_ms = db.Column(db.Integer, default=0)
    clicked_result_id = db.Column(db.String(100), nullable=True)
    clicked_result_type = db.Column(db.String(50), nullable=True)
    filters = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    user = db.relationship('User', backref=db.backref('search_logs', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'query': self.query,
            'index_type': self.index_type,
            'results_count': self.results_count,
            'response_time_ms': self.response_time_ms,
            'clicked_result_id': self.clicked_result_id,
            'clicked_result_type': self.clicked_result_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class SearchSuggestion(db.Model):
    """搜索建议模型 - 存储热门搜索词"""
    __tablename__ = 'search_suggestions'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    keyword = db.Column(db.String(200), nullable=False, unique=True, index=True)
    search_count = db.Column(db.Integer, default=1)
    last_searched_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_trending = db.Column(db.Boolean, default=False)
    category = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'keyword': self.keyword,
            'search_count': self.search_count,
            'is_trending': self.is_trending,
            'category': self.category,
            'last_searched_at': self.last_searched_at.isoformat() if self.last_searched_at else None
        }


class UserSearchHistory(db.Model):
    """用户搜索历史模型"""
    __tablename__ = 'user_search_history'
    __table_args__ = {'extend_existing': True}
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    query = db.Column(db.String(500), nullable=False)
    search_count = db.Column(db.Integer, default=1)
    last_searched_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('search_history', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'query': self.query,
            'search_count': self.search_count,
            'last_searched_at': self.last_searched_at.isoformat() if self.last_searched_at else None
        }
    
    @classmethod
    def record_search(cls, user_id: int, query: str):
        """记录用户搜索历史"""
        existing = cls.query.filter_by(user_id=user_id, query=query).first()
        if existing:
            existing.search_count += 1
            existing.last_searched_at = datetime.utcnow()
        else:
            existing = cls(user_id=user_id, query=query)
            db.session.add(existing)
        db.session.commit()
        return existing
