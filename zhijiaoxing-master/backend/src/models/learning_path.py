import json
from datetime import datetime
from src.models.user import db


class LearningPath(db.Model):
    __tablename__ = 'learning_paths'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    path_data = db.Column(db.Text, default='[]')
    current_node_id = db.Column(db.String(100))
    progress_percentage = db.Column(db.Float, default=0.0)
    estimated_days = db.Column(db.Integer, default=30)
    status = db.Column(db.String(20), default='active')
    generated_by = db.Column(db.String(50), default='ai')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='learning_paths')
    course = db.relationship('Course', backref='learning_paths')

    def get_path_data(self):
        try:
            return json.loads(self.path_data) if self.path_data else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_path_data(self, data):
        self.path_data = json.dumps(data, ensure_ascii=False) if data else '[]'

    def to_dict(self):
        path_nodes = self.get_path_data()
        completed = sum(1 for n in path_nodes if n.get('status') == 'completed')
        total = len(path_nodes)
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'title': self.title,
            'description': self.description,
            'path_data': path_nodes,
            'current_node_id': self.current_node_id,
            'progress_percentage': self.progress_percentage,
            'completed_nodes': completed,
            'total_nodes': total,
            'estimated_days': self.estimated_days,
            'status': self.status,
            'generated_by': self.generated_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class LearningPathNode(db.Model):
    __tablename__ = 'learning_path_nodes'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    path_id = db.Column(db.Integer, db.ForeignKey('learning_paths.id'), nullable=False)
    node_id = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    node_type = db.Column(db.String(30), default='knowledge')
    order_index = db.Column(db.Integer, default=0)
    parent_node_id = db.Column(db.String(100))
    prerequisites = db.Column(db.Text, default='[]')
    status = db.Column(db.String(20), default='locked')
    progress_percentage = db.Column(db.Float, default=0.0)
    estimated_minutes = db.Column(db.Integer, default=30)
    resource_ids = db.Column(db.Text, default='[]')
    mastery_level = db.Column(db.Float, default=0.0)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)

    path = db.relationship('LearningPath', backref='nodes')

    def get_prerequisites(self):
        try:
            return json.loads(self.prerequisites) if self.prerequisites else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_prerequisites(self, data):
        self.prerequisites = json.dumps(data, ensure_ascii=False) if data else '[]'

    def get_resource_ids(self):
        try:
            return json.loads(self.resource_ids) if self.resource_ids else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_resource_ids(self, data):
        self.resource_ids = json.dumps(data, ensure_ascii=False) if data else '[]'

    def to_dict(self):
        return {
            'id': self.id,
            'path_id': self.path_id,
            'node_id': self.node_id,
            'title': self.title,
            'description': self.description,
            'node_type': self.node_type,
            'order_index': self.order_index,
            'parent_node_id': self.parent_node_id,
            'prerequisites': self.get_prerequisites(),
            'status': self.status,
            'progress_percentage': self.progress_percentage,
            'estimated_minutes': self.estimated_minutes,
            'resource_ids': self.get_resource_ids(),
            'mastery_level': self.mastery_level,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class ResourceRecommendation(db.Model):
    __tablename__ = 'resource_recommendations'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    resource_type = db.Column(db.String(30), nullable=False)
    resource_id = db.Column(db.Integer)
    title = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text)
    url = db.Column(db.String(500))
    priority = db.Column(db.Integer, default=1)
    relevance_score = db.Column(db.Float, default=0.0)
    reason_knowledge = db.Column(db.Text)
    reason_progress = db.Column(db.Text)
    reason_ability = db.Column(db.Text)
    reason_interest = db.Column(db.Text)
    generated_by_agent = db.Column(db.String(50))
    difficulty = db.Column(db.String(20), default='intermediate')
    estimated_minutes = db.Column(db.Integer, default=30)
    tags = db.Column(db.Text, default='[]')
    is_completed = db.Column(db.Boolean, default=False)
    is_dismissed = db.Column(db.Boolean, default=False)
    feedback_score = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)

    user = db.relationship('User', backref='recommendations')

    def get_tags(self):
        try:
            return json.loads(self.tags) if self.tags else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_tags(self, data):
        self.tags = json.dumps(data, ensure_ascii=False) if data else '[]'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'title': self.title,
            'description': self.description,
            'url': self.url,
            'priority': self.priority,
            'relevance_score': self.relevance_score,
            'reasons': {
                'knowledge': self.reason_knowledge,
                'progress': self.reason_progress,
                'ability': self.reason_ability,
                'interest': self.reason_interest,
            },
            'generated_by_agent': self.generated_by_agent,
            'difficulty': self.difficulty,
            'estimated_minutes': self.estimated_minutes,
            'tags': self.get_tags(),
            'is_completed': self.is_completed,
            'is_dismissed': self.is_dismissed,
            'feedback_score': self.feedback_score,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class LearningPlan(db.Model):
    __tablename__ = 'learning_plans'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    plan_type = db.Column(db.String(20), default='mid_term')
    ai_analysis = db.Column(db.Text)
    goals = db.Column(db.Text, default='[]')
    milestones = db.Column(db.Text, default='[]')
    recommended_sequence = db.Column(db.Text, default='[]')
    estimated_completion = db.Column(db.DateTime)
    ability_expectations = db.Column(db.Text, default='{}')
    generated_by = db.Column(db.String(50), default='ai')
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='learning_plans')

    def get_goals(self):
        try:
            return json.loads(self.goals) if self.goals else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_goals(self, data):
        self.goals = json.dumps(data, ensure_ascii=False) if data else '[]'

    def get_milestones(self):
        try:
            return json.loads(self.milestones) if self.milestones else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_milestones(self, data):
        self.milestones = json.dumps(data, ensure_ascii=False) if data else '[]'

    def get_recommended_sequence(self):
        try:
            return json.loads(self.recommended_sequence) if self.recommended_sequence else []
        except (json.JSONDecodeError, TypeError):
            return []

    def set_recommended_sequence(self, data):
        self.recommended_sequence = json.dumps(data, ensure_ascii=False) if data else '[]'

    def get_ability_expectations(self):
        try:
            return json.loads(self.ability_expectations) if self.ability_expectations else {}
        except (json.JSONDecodeError, TypeError):
            return {}

    def set_ability_expectations(self, data):
        self.ability_expectations = json.dumps(data, ensure_ascii=False) if data else '{}'

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'plan_type': self.plan_type,
            'ai_analysis': self.ai_analysis,
            'goals': self.get_goals(),
            'milestones': self.get_milestones(),
            'recommended_sequence': self.get_recommended_sequence(),
            'estimated_completion': self.estimated_completion.isoformat() if self.estimated_completion else None,
            'ability_expectations': self.get_ability_expectations(),
            'generated_by': self.generated_by,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
