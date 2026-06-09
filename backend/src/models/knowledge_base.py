from datetime import datetime
import json

from src.models.user import db


class CourseSyllabus(db.Model):
    __tablename__ = 'course_syllabuses'
    __table_args__ = (
        db.Index('idx_syllabuses_course', 'course_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False, unique=True)
    course_code = db.Column(db.String(30))
    credit = db.Column(db.Float, default=3.0)
    total_hours = db.Column(db.Integer, default=48)
    theory_hours = db.Column(db.Integer, default=32)
    practice_hours = db.Column(db.Integer, default=16)
    semester = db.Column(db.String(20))
    prerequisite_courses = db.Column(db.Text, default='[]')
    course_objectives = db.Column(db.Text, default='[]')
    assessment_methods = db.Column(db.Text, default='{}')
    textbook = db.Column(db.Text, default='{}')
    references = db.Column(db.Text, default='[]')
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref='syllabus')

    def to_dict(self):
        def _safe_json(val, default=None):
            if val is None:
                return default
            if isinstance(val, (dict, list)):
                return val
            try:
                return json.loads(val)
            except Exception:
                return default

        return {
            'id': self.id,
            'course_id': self.course_id,
            'course_code': self.course_code,
            'credit': self.credit,
            'total_hours': self.total_hours,
            'theory_hours': self.theory_hours,
            'practice_hours': self.practice_hours,
            'semester': self.semester,
            'prerequisite_courses': _safe_json(self.prerequisite_courses, []),
            'course_objectives': _safe_json(self.course_objectives, []),
            'assessment_methods': _safe_json(self.assessment_methods, {}),
            'textbook': _safe_json(self.textbook, {}),
            'references': _safe_json(self.references, []),
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class CourseChapter(db.Model):
    __tablename__ = 'course_chapters'
    __table_args__ = (
        db.Index('idx_chapters_course_order', 'course_id', 'order_index'),
        db.Index('idx_chapters_parent', 'parent_id'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('course_chapters.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    order_index = db.Column(db.Integer, default=0)
    teaching_hours = db.Column(db.Integer, default=0)
    chapter_type = db.Column(db.String(20), default='theory')
    objectives = db.Column(db.Text, default='[]')
    key_points = db.Column(db.Text, default='[]')
    difficulties = db.Column(db.Text, default='[]')
    teaching_methods = db.Column(db.Text, default='[]')
    status = db.Column(db.String(20), default='published')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref='chapters')
    parent = db.relationship('CourseChapter', remote_side=[id], backref='children')

    def to_dict(self, include_children=False):
        def _safe_json(val, default=None):
            if val is None:
                return default
            if isinstance(val, (dict, list)):
                return val
            try:
                return json.loads(val)
            except Exception:
                return default

        result = {
            'id': self.id,
            'course_id': self.course_id,
            'parent_id': self.parent_id,
            'title': self.title,
            'description': self.description,
            'order_index': self.order_index,
            'teaching_hours': self.teaching_hours,
            'chapter_type': self.chapter_type,
            'objectives': _safe_json(self.objectives, []),
            'key_points': _safe_json(self.key_points, []),
            'difficulties': _safe_json(self.difficulties, []),
            'teaching_methods': _safe_json(self.teaching_methods, []),
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            result['children'] = [c.to_dict() for c in (self.children or [])]
        return result


class KnowledgePoint(db.Model):
    __tablename__ = 'knowledge_points'
    __table_args__ = (
        db.Index('idx_kp_chapter', 'chapter_id'),
        db.Index('idx_kp_course', 'course_id'),
        db.Index('idx_kp_parent', 'parent_id'),
        db.Index('idx_kp_difficulty', 'difficulty_level'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    chapter_id = db.Column(db.Integer, db.ForeignKey('course_chapters.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('knowledge_points.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    definition = db.Column(db.Text)
    content = db.Column(db.Text)
    order_index = db.Column(db.Integer, default=0)
    difficulty_level = db.Column(db.String(20), default='intermediate')
    importance = db.Column(db.String(20), default='core')
    prerequisites = db.Column(db.Text, default='[]')
    related_concepts = db.Column(db.Text, default='[]')
    formulas = db.Column(db.Text, default='[]')
    examples = db.Column(db.Text, default='[]')
    tags = db.Column(db.Text, default='[]')
    source = db.Column(db.String(100))
    source_url = db.Column(db.String(500))
    status = db.Column(db.String(20), default='published')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref='knowledge_points')
    chapter = db.relationship('CourseChapter', backref='knowledge_points')
    parent = db.relationship('KnowledgePoint', remote_side=[id], backref='children')

    def to_dict(self, include_children=False):
        def _safe_json(val, default=None):
            if val is None:
                return default
            if isinstance(val, (dict, list)):
                return val
            try:
                return json.loads(val)
            except Exception:
                return default

        result = {
            'id': self.id,
            'course_id': self.course_id,
            'chapter_id': self.chapter_id,
            'parent_id': self.parent_id,
            'title': self.title,
            'definition': self.definition,
            'content': self.content,
            'order_index': self.order_index,
            'difficulty_level': self.difficulty_level,
            'importance': self.importance,
            'prerequisites': _safe_json(self.prerequisites, []),
            'related_concepts': _safe_json(self.related_concepts, []),
            'formulas': _safe_json(self.formulas, []),
            'examples': _safe_json(self.examples, []),
            'tags': _safe_json(self.tags, []),
            'source': self.source,
            'source_url': self.source_url,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_children:
            result['children'] = [c.to_dict() for c in (self.children or [])]
        return result


class TeachingCase(db.Model):
    __tablename__ = 'teaching_cases'
    __table_args__ = (
        db.Index('idx_cases_chapter', 'chapter_id'),
        db.Index('idx_cases_course', 'course_id'),
        db.Index('idx_cases_kp', 'knowledge_point_id'),
        db.Index('idx_cases_type', 'case_type'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    chapter_id = db.Column(db.Integer, db.ForeignKey('course_chapters.id'), nullable=False)
    knowledge_point_id = db.Column(db.Integer, db.ForeignKey('knowledge_points.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    case_type = db.Column(db.String(30), default='application')
    background = db.Column(db.Text)
    problem_description = db.Column(db.Text)
    analysis = db.Column(db.Text)
    solution = db.Column(db.Text)
    conclusion = db.Column(db.Text)
    dataset_description = db.Column(db.Text)
    code_example = db.Column(db.Text)
    visualization = db.Column(db.Text, default='{}')
    difficulty_level = db.Column(db.String(20), default='intermediate')
    tags = db.Column(db.Text, default='[]')
    source = db.Column(db.String(100))
    source_url = db.Column(db.String(500))
    status = db.Column(db.String(20), default='published')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref='teaching_cases')
    chapter = db.relationship('CourseChapter', backref='teaching_cases')
    knowledge_point = db.relationship('KnowledgePoint', backref='teaching_cases')

    def to_dict(self):
        def _safe_json(val, default=None):
            if val is None:
                return default
            if isinstance(val, (dict, list)):
                return val
            try:
                return json.loads(val)
            except Exception:
                return default

        return {
            'id': self.id,
            'course_id': self.course_id,
            'chapter_id': self.chapter_id,
            'knowledge_point_id': self.knowledge_point_id,
            'title': self.title,
            'case_type': self.case_type,
            'background': self.background,
            'problem_description': self.problem_description,
            'analysis': self.analysis,
            'solution': self.solution,
            'conclusion': self.conclusion,
            'dataset_description': self.dataset_description,
            'code_example': self.code_example,
            'visualization': _safe_json(self.visualization, {}),
            'difficulty_level': self.difficulty_level,
            'tags': _safe_json(self.tags, []),
            'source': self.source,
            'source_url': self.source_url,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class CourseExercise(db.Model):
    __tablename__ = 'course_exercises'
    __table_args__ = (
        db.Index('idx_exercises_chapter', 'chapter_id'),
        db.Index('idx_exercises_course', 'course_id'),
        db.Index('idx_exercises_kp', 'knowledge_point_id'),
        db.Index('idx_exercises_type_difficulty', 'exercise_type', 'difficulty_level'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    chapter_id = db.Column(db.Integer, db.ForeignKey('course_chapters.id'), nullable=False)
    knowledge_point_id = db.Column(db.Integer, db.ForeignKey('knowledge_points.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    exercise_type = db.Column(db.String(30), default='choice')
    difficulty_level = db.Column(db.String(20), default='intermediate')
    content = db.Column(db.Text, nullable=False)
    options = db.Column(db.Text, default='[]')
    correct_answer = db.Column(db.Text, nullable=False)
    answer_analysis = db.Column(db.Text)
    hints = db.Column(db.Text, default='[]')
    knowledge_tags = db.Column(db.Text, default='[]')
    score = db.Column(db.Float, default=5.0)
    estimated_minutes = db.Column(db.Integer, default=5)
    source = db.Column(db.String(100))
    source_url = db.Column(db.String(500))
    status = db.Column(db.String(20), default='published')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref='exercises')
    chapter = db.relationship('CourseChapter', backref='exercises')
    knowledge_point = db.relationship('KnowledgePoint', backref='exercises')

    def to_dict(self, include_answer=False):
        def _safe_json(val, default=None):
            if val is None:
                return default
            if isinstance(val, (dict, list)):
                return val
            try:
                return json.loads(val)
            except Exception:
                return default

        result = {
            'id': self.id,
            'course_id': self.course_id,
            'chapter_id': self.chapter_id,
            'knowledge_point_id': self.knowledge_point_id,
            'title': self.title,
            'exercise_type': self.exercise_type,
            'difficulty_level': self.difficulty_level,
            'content': self.content,
            'options': _safe_json(self.options, []),
            'hints': _safe_json(self.hints, []),
            'knowledge_tags': _safe_json(self.knowledge_tags, []),
            'score': self.score,
            'estimated_minutes': self.estimated_minutes,
            'source': self.source,
            'source_url': self.source_url,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_answer:
            result['correct_answer'] = _safe_json(self.correct_answer, self.correct_answer)
            result['answer_analysis'] = self.answer_analysis
        return result
