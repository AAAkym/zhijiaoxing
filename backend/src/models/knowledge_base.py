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


class KnowledgeGraphNode(db.Model):
    __tablename__ = 'knowledge_graph_nodes'
    __table_args__ = (
        db.Index('idx_kgn_course_type', 'course_id', 'node_type'),
        db.Index('idx_kgn_course_label', 'course_id', 'label'),
        db.UniqueConstraint('course_id', 'node_type', 'label', name='uq_kgn_course_type_label'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    graph_id = db.Column(db.String(80), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    node_type = db.Column(db.String(30), nullable=False)
    label = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(80))
    weight = db.Column(db.Float, default=1.0)
    source_chunk_ids = db.Column(db.Text, default='[]')
    properties = db.Column(db.Text, default='{}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref='knowledge_graph_nodes')

    def to_dict(self, include_sources=False):
        result = {
            'id': self.id,
            'graph_id': self.graph_id,
            'course_id': self.course_id,
            'node_type': self.node_type,
            'label': self.label,
            'description': self.description,
            'category': self.category,
            'weight': self.weight,
            'properties': _parse_json_value(self.properties, {}),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sources:
            result['source_chunk_ids'] = _parse_json_value(self.source_chunk_ids, [])
        return result


class KnowledgeGraphEdge(db.Model):
    __tablename__ = 'knowledge_graph_edges'
    __table_args__ = (
        db.Index('idx_kge_course_type', 'course_id', 'edge_type'),
        db.Index('idx_kge_source', 'source_node_id'),
        db.Index('idx_kge_target', 'target_node_id'),
        db.UniqueConstraint('course_id', 'source_node_id', 'target_node_id', 'edge_type', name='uq_kge_course_edge'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    graph_id = db.Column(db.String(80), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    source_node_id = db.Column(db.Integer, db.ForeignKey('knowledge_graph_nodes.id'), nullable=False)
    target_node_id = db.Column(db.Integer, db.ForeignKey('knowledge_graph_nodes.id'), nullable=False)
    edge_type = db.Column(db.String(40), nullable=False)
    weight = db.Column(db.Float, default=0.6)
    confidence = db.Column(db.Float, default=0.8)
    evidence_chunk_ids = db.Column(db.Text, default='[]')
    properties = db.Column(db.Text, default='{}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    source_node = db.relationship('KnowledgeGraphNode', foreign_keys=[source_node_id])
    target_node = db.relationship('KnowledgeGraphNode', foreign_keys=[target_node_id])
    course = db.relationship('Course', backref='knowledge_graph_edges')

    def to_dict(self, include_sources=False):
        result = {
            'id': self.id,
            'graph_id': self.graph_id,
            'course_id': self.course_id,
            'source': self.source_node_id,
            'target': self.target_node_id,
            'source_node_id': self.source_node_id,
            'target_node_id': self.target_node_id,
            'edge_type': self.edge_type,
            'weight': self.weight,
            'confidence': self.confidence,
            'properties': _parse_json_value(self.properties, {}),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sources:
            result['evidence_chunk_ids'] = _parse_json_value(self.evidence_chunk_ids, [])
        return result


class KnowledgeSourceChunk(db.Model):
    __tablename__ = 'knowledge_source_chunks'
    __table_args__ = (
        db.Index('idx_ksc_course', 'course_id'),
        db.Index('idx_ksc_type', 'source_type'),
        db.Index('idx_ksc_ref', 'reference_code'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    source_type = db.Column(db.String(40), nullable=False, default='syllabus')
    source_id = db.Column(db.String(80))
    reference_code = db.Column(db.String(30), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(200))
    source_url = db.Column(db.String(500))
    metadata_json = db.Column(db.Text, default='{}')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    course = db.relationship('Course', backref='knowledge_source_chunks')

    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'source_id': self.source_id or f'chunk:{self.id}',
            'source_type': self.source_type,
            'reference_code': self.reference_code,
            'title': self.title,
            'excerpt': self.content[:500],
            'content': self.content,
            'location': self.location,
            'url': self.source_url,
            'metadata': _parse_json_value(self.metadata_json, {}),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class GenerationCitation(db.Model):
    __tablename__ = 'generation_citations'
    __table_args__ = (
        db.Index('idx_gc_package', 'package_id'),
        db.Index('idx_gc_course', 'course_id'),
        db.Index('idx_gc_resource_type', 'resource_type'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    package_id = db.Column(db.String(80))
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    resource_type = db.Column(db.String(40), nullable=False)
    source_chunk_id = db.Column(db.Integer, db.ForeignKey('knowledge_source_chunks.id'), nullable=True)
    source_type = db.Column(db.String(40))
    title = db.Column(db.String(200))
    excerpt = db.Column(db.Text)
    location = db.Column(db.String(200))
    url = db.Column(db.String(500))
    confidence = db.Column(db.Float, default=0.75)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    source_chunk = db.relationship('KnowledgeSourceChunk')
    course = db.relationship('Course')

    def to_dict(self):
        source_code = None
        if self.source_chunk:
            source_code = self.source_chunk.reference_code
        return {
            'id': self.id,
            'package_id': self.package_id,
            'course_id': self.course_id,
            'resource_type': self.resource_type,
            'source_id': source_code or (f'S{self.source_chunk_id}' if self.source_chunk_id else None),
            'source_chunk_id': self.source_chunk_id,
            'source_type': self.source_type,
            'title': self.title,
            'excerpt': self.excerpt,
            'location': self.location,
            'url': self.url,
            'confidence': self.confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


def _parse_json_value(value, default):
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default
