import json
from datetime import datetime
from src.models.user import db


class StudentProfile(db.Model):
    __tablename__ = 'student_profiles'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)

    knowledge_base = db.Column(db.Text, default='{}')
    cognitive_style = db.Column(db.String(50), default='mixed')
    error_patterns = db.Column(db.Text, default='[]')
    learning_pace = db.Column(db.String(20), default='moderate')
    interest_areas = db.Column(db.Text, default='[]')
    goal_orientation = db.Column(db.String(30), default='exam')
    time_availability = db.Column(db.Text, default='{}')
    interaction_preference = db.Column(db.String(30), default='guided')

    confidence_score = db.Column(db.Float, default=0.0)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    update_source = db.Column(db.String(20), default='dialog')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='student_profile')

    VALID_COGNITIVE_STYLES = ['visual', 'auditory', 'kinesthetic', 'reading', 'mixed']
    VALID_LEARNING_PACES = ['fast', 'moderate', 'slow', 'adaptive']
    VALID_GOAL_ORIENTATIONS = ['exam', 'career', 'hobby', 'research']
    VALID_INTERACTION_PREFS = ['guided', 'exploratory', 'challenging']

    DIMENSION_NAMES = {
        'knowledge_base': '知识基础',
        'cognitive_style': '认知风格',
        'error_patterns': '易错点模式',
        'learning_pace': '学习节奏',
        'interest_areas': '兴趣领域',
        'goal_orientation': '目标导向',
        'time_availability': '时间可用性',
        'interaction_preference': '互动偏好'
    }

    def _parse_json(self, value, default=None):
        if not value:
            return default or {}
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return default or {}

    def _set_json(self, value):
        return json.dumps(value, ensure_ascii=False) if value else '{}'

    def get_knowledge_base(self):
        return self._parse_json(self.knowledge_base, {})

    def set_knowledge_base(self, data):
        self.knowledge_base = self._set_json(data)

    def get_error_patterns(self):
        return self._parse_json(self.error_patterns, [])

    def set_error_patterns(self, data):
        self.error_patterns = self._set_json(data) if data else '[]'

    def get_interest_areas(self):
        return self._parse_json(self.interest_areas, [])

    def set_interest_areas(self, data):
        self.interest_areas = self._set_json(data) if data else '[]'

    def get_time_availability(self):
        return self._parse_json(self.time_availability, {})

    def set_time_availability(self, data):
        self.time_availability = self._set_json(data)

    def update_dimension(self, dimension, value):
        if dimension == 'knowledge_base':
            self.set_knowledge_base(value)
        elif dimension == 'cognitive_style':
            if value in self.VALID_COGNITIVE_STYLES:
                self.cognitive_style = value
        elif dimension == 'error_patterns':
            self.set_error_patterns(value)
        elif dimension == 'learning_pace':
            if value in self.VALID_LEARNING_PACES:
                self.learning_pace = value
        elif dimension == 'interest_areas':
            self.set_interest_areas(value)
        elif dimension == 'goal_orientation':
            if value in self.VALID_GOAL_ORIENTATIONS:
                self.goal_orientation = value
        elif dimension == 'time_availability':
            self.set_time_availability(value)
        elif dimension == 'interaction_preference':
            if value in self.VALID_INTERACTION_PREFS:
                self.interaction_preference = value
        self.last_updated = datetime.utcnow()
        self._recalculate_confidence()

    def _recalculate_confidence(self):
        filled = 0
        total = 8
        if self.knowledge_base and self.knowledge_base != '{}':
            filled += 1
        if self.cognitive_style and self.cognitive_style != 'mixed':
            filled += 1
        if self.error_patterns and self.error_patterns != '[]':
            filled += 1
        if self.learning_pace and self.learning_pace != 'moderate':
            filled += 1
        if self.interest_areas and self.interest_areas != '[]':
            filled += 1
        if self.goal_orientation and self.goal_orientation != 'exam':
            filled += 1
        if self.time_availability and self.time_availability != '{}':
            filled += 1
        if self.interaction_preference and self.interaction_preference != 'guided':
            filled += 1
        self.confidence_score = round(filled / total, 2)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'knowledge_base': self.get_knowledge_base(),
            'cognitive_style': self.cognitive_style,
            'error_patterns': self.get_error_patterns(),
            'learning_pace': self.learning_pace,
            'interest_areas': self.get_interest_areas(),
            'goal_orientation': self.goal_orientation,
            'time_availability': self.get_time_availability(),
            'interaction_preference': self.interaction_preference,
            'confidence_score': self.confidence_score,
            'last_updated': self.last_updated.isoformat() if self.last_updated else None,
            'update_source': self.update_source,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'dimension_names': self.DIMENSION_NAMES,
        }


class ProfileDialogSession(db.Model):
    __tablename__ = 'profile_dialog_sessions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='active')
    current_round = db.Column(db.Integer, default=0)
    max_rounds = db.Column(db.Integer, default=6)
    extracted_features = db.Column(db.Text, default='{}')
    messages = db.Column(db.Text, default='[]')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='profile_sessions')

    def get_messages(self):
        try:
            return json.loads(self.messages) if self.messages else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_messages(self, msgs):
        self.messages = json.dumps(msgs, ensure_ascii=False)

    def add_message(self, role, content, metadata=None):
        msgs = self.get_messages()
        msgs.append({
            'role': role,
            'content': content,
            'metadata': metadata or {},
            'timestamp': datetime.utcnow().isoformat()
        })
        self.set_messages(msgs)

    def get_extracted_features(self):
        try:
            return json.loads(self.extracted_features) if self.extracted_features else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    def set_extracted_features(self, features):
        self.extracted_features = json.dumps(features, ensure_ascii=False)

    def update_feature(self, dimension, value):
        features = self.get_extracted_features()
        features[dimension] = value
        self.set_extracted_features(features)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'status': self.status,
            'current_round': self.current_round,
            'max_rounds': self.max_rounds,
            'extracted_features': self.get_extracted_features(),
            'messages': self.get_messages(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
