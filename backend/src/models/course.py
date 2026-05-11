from datetime import datetime
import json

from src.models.user import db


class Course(db.Model):
    """课程模型"""
    __tablename__ = 'courses'
    __table_args__ = (
        db.Index('idx_courses_teacher_status', 'teacher_id', 'status'),
        db.Index('idx_courses_category_difficulty', 'category', 'difficulty'),
        db.Index('idx_courses_status_created', 'status', 'created_at'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    category = db.Column(db.String(50), default='programming')
    difficulty = db.Column(db.String(20), default='beginner')
    duration = db.Column(db.String(50))
    status = db.Column(db.String(20), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    teacher = db.relationship('User', backref='courses')
    
    @property
    def student_count(self):
        return len(self.learning_progress) if hasattr(self, 'learning_progress') else 0
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'teacher_id': self.teacher_id,
            'teacher_name': self.teacher.real_name if self.teacher else None,
            'category': self.category or 'programming',
            'difficulty': self.difficulty or 'beginner',
            'duration': self.duration or '',
            'status': self.status or 'active',
            'student_count': self.student_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class TeachingContent(db.Model):
    """教学内容模型"""
    __tablename__ = 'teaching_contents'
    __table_args__ = (
        db.Index('idx_teaching_contents_course_created', 'course_id', 'created_at'),
        db.Index('idx_teaching_contents_video', 'video_id'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video_lessons.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    generated_by_llm = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    course = db.relationship('Course', backref='teaching_contents')
    video = db.relationship('VideoLesson', backref='teaching_contents')
    
    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'video_id': self.video_id,
            'title': self.title,
            'content': self.content,
            'generated_by_llm': self.generated_by_llm,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Assessment(db.Model):
    """考核模型"""
    __tablename__ = 'assessments'
    __table_args__ = (
        db.Index('idx_assessments_course_created', 'course_id', 'created_at', 'id'),
        db.Index('idx_assessments_recommended', 'is_recommended'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    questions = db.Column(db.Text, nullable=False)  # JSON格式存储题目
    answers = db.Column(db.Text)  # JSON格式存储答案
    generated_by_llm = db.Column(db.Boolean, default=False)
    is_recommended = db.Column(db.Boolean, default=False)  # 是否为推荐练习
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    course = db.relationship('Course', backref='assessments')
    
    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'title': self.title,
            'questions': self.questions,
            'answers': self.answers,
            'generated_by_llm': self.generated_by_llm,
            'is_recommended': self.is_recommended or False,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class LearningProgress(db.Model):
    """学习进度模型"""
    __tablename__ = 'learning_progress'
    __table_args__ = (
        db.Index('idx_learning_progress_user_course', 'user_id', 'course_id'),
        db.Index('idx_learning_progress_course_accessed', 'course_id', 'last_accessed'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    progress_percentage = db.Column(db.Float, default=0.0)
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    user = db.relationship('User', backref='learning_progress')
    course = db.relationship('Course', backref='learning_progress')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'course_title': self.course.title if self.course else None,
            'progress_percentage': self.progress_percentage,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None
        }


class PracticeEvaluation(db.Model):
    """练习评测模型"""
    __tablename__ = 'practice_evaluations'
    __table_args__ = (
        db.Index('idx_practice_evaluations_user_assessment', 'user_id', 'assessment_id'),
        db.Index('idx_practice_evaluations_assessment_created', 'assessment_id', 'created_at'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assessment_id = db.Column(db.Integer, db.ForeignKey('assessments.id'), nullable=False)
    user_answer = db.Column(db.Text, nullable=False)
    evaluation_result = db.Column(db.Text)  # 大模型评测结果
    score = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    user = db.relationship('User', backref='practice_evaluations')
    assessment = db.relationship('Assessment', backref='practice_evaluations')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'assessment_id': self.assessment_id,
            'user_answer': self.user_answer,
            'evaluation_result': self.evaluation_result,
            'score': self.score,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class VideoLesson(db.Model):
    """视频课程模型"""
    __tablename__ = 'video_lessons'
    __table_args__ = (
        db.Index('idx_video_lessons_course_order', 'course_id', 'order_index', 'created_at'),
        db.Index('idx_video_lessons_status', 'status'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    video_url = db.Column(db.String(500), nullable=False)
    thumbnail_url = db.Column(db.String(500))
    duration = db.Column(db.Integer)  # 视频时长（秒）
    order_index = db.Column(db.Integer, default=0)  # 排序索引
    views_count = db.Column(db.Integer, default=0)  # 观看次数
    is_free = db.Column(db.Boolean, default=False)  # 是否免费
    status = db.Column(db.String(20), default='published')  # published, draft, archived
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    course = db.relationship('Course', backref='video_lessons')
    
    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'title': self.title,
            'description': self.description,
            'video_url': self.video_url,
            'thumbnail_url': self.thumbnail_url,
            'duration': self.duration,
            'order_index': self.order_index,
            'views_count': self.views_count,
            'is_free': self.is_free,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class VideoProgress(db.Model):
    """视频观看进度模型"""
    __tablename__ = 'video_progress'
    __table_args__ = (
        db.Index('idx_video_progress_user_video', 'user_id', 'video_id'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video_lessons.id'), nullable=False)
    current_time = db.Column(db.Float, default=0.0)  # 当前播放位置（秒）
    completed = db.Column(db.Boolean, default=False)  # 是否观看完成
    last_watched = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    user = db.relationship('User', backref='video_progress')
    video = db.relationship('VideoLesson', backref='user_progress')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'video_id': self.video_id,
            'current_time': self.current_time,
            'completed': self.completed,
            'last_watched': self.last_watched.isoformat() if self.last_watched else None
        }


class CourseQuestion(db.Model):
    """课程问答模型"""
    __tablename__ = 'course_questions'
    __table_args__ = (
        db.Index('idx_course_questions_course_status', 'course_id', 'status', 'created_at'),
        db.Index('idx_course_questions_user_created', 'user_id', 'created_at'),
        db.Index('idx_course_questions_video', 'video_id'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video_lessons.id'), nullable=True)  # 关联视频（可选）
    content_id = db.Column(db.Integer, db.ForeignKey('teaching_contents.id'), nullable=True)  # 关联内容（可选）
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    video_timestamp = db.Column(db.Float, nullable=True)  # 视频时间戳（秒）
    status = db.Column(db.String(20), default='pending')  # pending, answered, resolved
    is_public = db.Column(db.Boolean, default=True)  # 是否公开
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    course = db.relationship('Course', backref='questions')
    user = db.relationship('User', backref='questions')
    video = db.relationship('VideoLesson', backref='questions')
    teaching_content = db.relationship('TeachingContent', backref='questions', foreign_keys=[content_id])
    
    def to_dict(self):
        # 安全获取用户名称
        user_name = None
        if self.user_id:
            try:
                # 尝试从关系中获取用户信息
                if self.user:
                    user_name = self.user.real_name or self.user.username
            except Exception:
                pass
            
            # 如果无法获取用户信息，使用 user_id 作为备选
            if not user_name:
                user_name = f"用户{self.user_id}"
        
        return {
            'id': self.id,
            'course_id': self.course_id,
            'user_id': self.user_id,
            'user_name': user_name,
            'video_id': self.video_id,
            'content_id': self.content_id,
            'title': self.title,
            'content': self.content,
            'video_timestamp': self.video_timestamp,
            'status': self.status,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class QuestionAnswer(db.Model):
    """问题回答模型"""
    __tablename__ = 'question_answers'
    __table_args__ = (
        db.Index('idx_question_answers_question_created', 'question_id', 'created_at'),
        db.Index('idx_question_answers_user_created', 'user_id', 'created_at'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('course_questions.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_teacher_answer = db.Column(db.Boolean, default=False)
    is_accepted = db.Column(db.Boolean, default=False)  # 是否被采纳为最佳答案
    likes_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    question = db.relationship('CourseQuestion', backref='answers')
    user = db.relationship('User', backref='answers')
    
    def to_dict(self):
        # 安全获取用户名称
        user_name = None
        if self.user_id:
            try:
                if self.user:
                    user_name = self.user.real_name or self.user.username
            except Exception:
                pass
            
            if not user_name:
                user_name = f"用户{self.user_id}"
        
        return {
            'id': self.id,
            'question_id': self.question_id,
            'user_id': self.user_id,
            'user_name': user_name,
            'content': self.content,
            'is_teacher_answer': self.is_teacher_answer,
            'is_accepted': self.is_accepted,
            'likes_count': self.likes_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class CourseDiscussion(db.Model):
    """课程讨论模型"""
    __tablename__ = 'course_discussions'
    __table_args__ = (
        db.Index('idx_course_discussions_course_created', 'course_id', 'created_at'),
        db.Index('idx_course_discussions_parent', 'parent_id'),
        db.Index('idx_course_discussions_user_created', 'user_id', 'created_at'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('course_discussions.id'), nullable=True)  # 父评论ID
    content = db.Column(db.Text, nullable=False)
    likes_count = db.Column(db.Integer, default=0)
    is_pinned = db.Column(db.Boolean, default=False)  # 是否置顶
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    course = db.relationship('Course', backref='discussions')
    user = db.relationship('User', backref='discussions')
    parent = db.relationship('CourseDiscussion', remote_side=[id], backref='replies')
    
    def to_dict(self):
        # 安全获取用户名称和头像
        user_name = None
        user_avatar = None
        if self.user_id:
            try:
                if self.user:
                    user_name = self.user.real_name or self.user.username
                    user_avatar = getattr(self.user, 'avatar', None)
            except Exception:
                pass
            
            if not user_name:
                user_name = f"用户{self.user_id}"
        
        return {
            'id': self.id,
            'course_id': self.course_id,
            'user_id': self.user_id,
            'user_name': user_name,
            'user_avatar': user_avatar,
            'parent_id': self.parent_id,
            'content': self.content,
            'likes_count': self.likes_count,
            'is_pinned': self.is_pinned,
            'replies_count': len(self.replies) if hasattr(self, 'replies') else 0,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class HandRaise(db.Model):
    """举手提问模型"""
    __tablename__ = 'hand_raises'
    __table_args__ = (
        db.Index('idx_hand_raises_course_status', 'course_id', 'status', 'created_at'),
        db.Index('idx_hand_raises_user_status', 'user_id', 'status'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video_lessons.id'), nullable=True)
    reason = db.Column(db.Text, nullable=True)  # 举手原因
    status = db.Column(db.String(20), default='waiting')  # waiting, called, resolved
    called_at = db.Column(db.DateTime, nullable=True)  # 被点名时间
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    course = db.relationship('Course', backref='hand_raises')
    user = db.relationship('User', backref='hand_raises')
    video = db.relationship('VideoLesson', backref='hand_raises')
    
    def to_dict(self):
        # 安全获取用户名称
        user_name = None
        if self.user_id:
            try:
                if self.user:
                    user_name = self.user.real_name or self.user.username
            except Exception:
                pass
            
            if not user_name:
                user_name = f"用户{self.user_id}"
        
        return {
            'id': self.id,
            'course_id': self.course_id,
            'user_id': self.user_id,
            'user_name': user_name,
            'video_id': self.video_id,
            'reason': self.reason,
            'status': self.status,
            'called_at': self.called_at.isoformat() if self.called_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class StudyNote(db.Model):
    """学习笔记模型"""
    __tablename__ = 'study_notes'
    __table_args__ = (
        db.Index('idx_study_notes_user_course', 'user_id', 'course_id', 'updated_at'),
        db.Index('idx_study_notes_course_public', 'course_id', 'is_public', 'created_at'),
        db.Index('idx_study_notes_video', 'video_id'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video_lessons.id'), nullable=True)
    content_id = db.Column(db.Integer, db.ForeignKey('teaching_contents.id'), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    video_timestamp = db.Column(db.Float, nullable=True)
    tags = db.Column(db.Text, nullable=True)
    is_auto_generated = db.Column(db.Boolean, default=False)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref='notes')
    course = db.relationship('Course', backref='notes')
    video = db.relationship('VideoLesson', backref='notes')
    teaching_content = db.relationship('TeachingContent', backref='notes')
    
    def to_dict(self):
        import json
        tags_list = []
        if self.tags:
            try:
                tags_list = json.loads(self.tags)
            except:
                tags_list = []
        
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'course_title': self.course.title if self.course else None,
            'video_id': self.video_id,
            'video_title': self.video.title if self.video else None,
            'content_id': self.content_id,
            'title': self.title,
            'content': self.content,
            'video_timestamp': self.video_timestamp,
            'tags': tags_list,
            'is_auto_generated': self.is_auto_generated,
            'is_public': self.is_public,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ContentBookmark(db.Model):
    """内容书签/重点标记模型"""
    __tablename__ = 'content_bookmarks'
    __table_args__ = (
        db.Index('idx_content_bookmarks_user_course', 'user_id', 'course_id', 'created_at'),
        db.Index('idx_content_bookmarks_content', 'content_id'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    video_id = db.Column(db.Integer, db.ForeignKey('video_lessons.id'), nullable=True)
    content_id = db.Column(db.Integer, db.ForeignKey('teaching_contents.id'), nullable=True)
    bookmark_type = db.Column(db.String(20), default='bookmark')  # bookmark, highlight, important
    title = db.Column(db.String(200), nullable=True)
    note = db.Column(db.Text, nullable=True)  # 标记备注
    video_timestamp = db.Column(db.Float, nullable=True)  # 视频时间点
    color = db.Column(db.String(10), default='#FFD700')  # 标记颜色
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    user = db.relationship('User', backref='bookmarks')
    course = db.relationship('Course', backref='bookmarks')
    video = db.relationship('VideoLesson', backref='bookmarks')
    content = db.relationship('TeachingContent', backref='bookmarks')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'video_id': self.video_id,
            'content_id': self.content_id,
            'bookmark_type': self.bookmark_type,
            'title': self.title,
            'note': self.note,
            'video_timestamp': self.video_timestamp,
            'color': self.color,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class MistakeRecord(db.Model):
    """错题记录模型"""
    __tablename__ = 'mistake_records'
    __table_args__ = (
        db.Index('idx_mistake_records_user_course_status', 'user_id', 'course_id', 'mastery_status'),
        db.Index('idx_mistake_records_assessment_question', 'assessment_id', 'question_index'),
        db.Index('idx_mistake_records_last_mistake', 'last_mistake_at'),
        {'extend_existing': True},
    )
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    assessment_id = db.Column(db.Integer, db.ForeignKey('assessments.id'), nullable=True)
    question_index = db.Column(db.Integer, nullable=True)
    question_content = db.Column(db.Text, nullable=False)
    user_answer = db.Column(db.Text, nullable=False)
    correct_answer = db.Column(db.Text, nullable=False)
    mistake_count = db.Column(db.Integer, default=1)
    last_mistake_at = db.Column(db.DateTime, default=datetime.utcnow)
    mastery_status = db.Column(db.String(20), default='unmastered')
    knowledge_tags = db.Column(db.Text, nullable=True)
    ai_analysis = db.Column(db.Text, nullable=True)
    error_type_auto = db.Column(db.String(50), nullable=True)
    error_type_manual = db.Column(db.String(50), nullable=True)
    error_type_confidence = db.Column(db.Float, nullable=True)
    error_reason_detail = db.Column(db.Text, nullable=True)
    error_type_confirmed = db.Column(db.Boolean, default=False)
    note_id = db.Column(db.Integer, db.ForeignKey('study_notes.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref='mistake_records')
    course = db.relationship('Course', backref='mistake_records')
    assessment = db.relationship('Assessment', backref='mistake_records')
    note = db.relationship('StudyNote', backref='linked_mistakes')
    
    def _resolve_answer_display(self, answer_str, options=None):
        if not answer_str or answer_str.strip() == '':
            return {'raw': answer_str, 'display': '未作答', 'label': None}
        
        if options and isinstance(options, list) and len(options) > 0:
            try:
                idx = int(answer_str)
                if 0 <= idx < len(options):
                    label = chr(65 + idx)
                    option_text = options[idx] if isinstance(options[idx], str) else str(options[idx])
                    return {
                        'raw': answer_str,
                        'display': f'{label}. {option_text}',
                        'label': label,
                        'option_text': option_text,
                        'index': idx
                    }
            except (ValueError, TypeError):
                pass
        
        return {'raw': answer_str, 'display': answer_str, 'label': None}

    def _get_original_question_data(self):
        import json
        if not self.assessment or self.question_index is None:
            return None
        try:
            questions = json.loads(self.assessment.questions) if self.assessment.questions else []
            if isinstance(questions, list) and 0 <= self.question_index < len(questions):
                return questions[self.question_index]
        except (json.JSONDecodeError, TypeError, IndexError):
            pass
        return None

    def to_dict(self, include_resolved_answers=False):
        import json
        knowledge_tags = []
        if self.knowledge_tags:
            try:
                knowledge_tags = json.loads(self.knowledge_tags)
            except:
                knowledge_tags = []
        
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'course_title': self.course.title if self.course else None,
            'assessment_id': self.assessment_id,
            'assessment_title': self.assessment.title if self.assessment else None,
            'question_index': self.question_index,
            'question_content': self.question_content,
            'user_answer': self.user_answer,
            'correct_answer': self.correct_answer,
            'mistake_count': self.mistake_count,
            'last_mistake_at': self.last_mistake_at.isoformat() if self.last_mistake_at else None,
            'mastery_status': self.mastery_status,
            'knowledge_tags': knowledge_tags,
            'ai_analysis': self.ai_analysis,
            'error_type_auto': self.error_type_auto,
            'error_type_manual': self.error_type_manual,
            'error_type_confirmed': bool(self.error_type_confirmed),
            'error_type': self.error_type_manual or self.error_type_auto,
            'error_type_confidence': self.error_type_confidence,
            'error_reason_detail': self.error_reason_detail,
            'note_id': self.note_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
        
        if include_resolved_answers:
            original_q = self._get_original_question_data()
            options = None
            question_type = 'unknown'
            
            if original_q and isinstance(original_q, dict):
                options = original_q.get('options', [])
                question_type = original_q.get('type', 'unknown')
                result['original_question'] = original_q
            
            result['question_type'] = question_type
            result['options'] = options
            
            user_resolved = self._resolve_answer_display(self.user_answer, options)
            correct_resolved = self._resolve_answer_display(self.correct_answer, options)
            
            result['user_answer_display'] = user_resolved['display']
            result['user_answer_label'] = user_resolved.get('label')
            result['correct_answer_display'] = correct_resolved['display']
            result['correct_answer_label'] = correct_resolved.get('label')
            result['answer_type'] = 'choice' if (options and len(options) > 0) else 'text'
        
        return result


class ProgrammingSubmission(db.Model):
    __tablename__ = 'programming_submissions'
    __table_args__ = (
        db.Index('idx_programming_submissions_user_assessment', 'user_id', 'assessment_id'),
        db.Index('idx_programming_submissions_course_created', 'course_id', 'created_at'),
        {'extend_existing': True},
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assessment_id = db.Column(db.Integer, db.ForeignKey('assessments.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    question_index = db.Column(db.Integer, default=0)
    language = db.Column(db.String(50), default='python')
    code = db.Column(db.Text, default='')
    standard_answer = db.Column(db.Text, default='')
    score = db.Column(db.Float, default=0)
    max_score = db.Column(db.Float, default=100)
    status = db.Column(db.String(30), default='pending')
    compile_result = db.Column(db.Text, default='')
    runtime_result = db.Column(db.Text, default='')
    io_match_result = db.Column(db.Text, default='')
    syntax_result = db.Column(db.Text, default='')
    logic_result = db.Column(db.Text, default='')
    efficiency_result = db.Column(db.Text, default='')
    line_comparison = db.Column(db.Text, default='')
    ai_feedback = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='programming_submissions')
    assessment = db.relationship('Assessment', backref='programming_submissions')
    course = db.relationship('Course', backref='programming_submissions')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'assessment_id': self.assessment_id,
            'course_id': self.course_id,
            'question_index': self.question_index,
            'language': self.language,
            'code': self.code,
            'standard_answer': self.standard_answer,
            'score': self.score,
            'max_score': self.max_score,
            'status': self.status,
            'compile_result': self.compile_result,
            'runtime_result': self.runtime_result,
            'io_match_result': self.io_match_result,
            'syntax_result': self.syntax_result,
            'logic_result': self.logic_result,
            'efficiency_result': self.efficiency_result,
            'line_comparison': self.line_comparison,
            'ai_feedback': self.ai_feedback,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Achievement(db.Model):
    __tablename__ = 'achievements'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    icon = db.Column(db.String(50), nullable=False)
    level = db.Column(db.Integer, default=1)
    condition_type = db.Column(db.String(50), nullable=False)
    condition_value = db.Column(db.Integer, nullable=False)
    points = db.Column(db.Integer, default=10)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_achievements = db.relationship('UserAchievement', backref='achievement', lazy='dynamic')

    def to_dict(self, unlocked=False, unlocked_at=None):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'icon': self.icon,
            'level': self.level,
            'condition_type': self.condition_type,
            'condition_value': self.condition_value,
            'points': self.points,
            'is_active': self.is_active,
            'unlocked': unlocked,
            'unlocked_at': unlocked_at.isoformat() if unlocked_at else None,
        }


class UserAchievement(db.Model):
    __tablename__ = 'user_achievements'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    achievement_id = db.Column(db.Integer, db.ForeignKey('achievements.id'), nullable=False)
    unlocked_at = db.Column(db.DateTime, default=datetime.utcnow)
    notified = db.Column(db.Boolean, default=False)

    user = db.relationship('User', backref='user_achievements')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'achievement_id': self.achievement_id,
            'achievement': self.achievement.to_dict(unlocked=True, unlocked_at=self.unlocked_at) if self.achievement else None,
            'unlocked_at': self.unlocked_at.isoformat() if self.unlocked_at else None,
            'notified': self.notified,
        }


class CourseGenerationConfig(db.Model):
    __tablename__ = 'course_generation_configs'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    difficulty = db.Column(db.Integer, default=3)
    duration = db.Column(db.Integer, default=45)
    interaction_level = db.Column(db.String(20), default='medium')
    video_ratio = db.Column(db.Integer, default=40)
    experiment_ratio = db.Column(db.Integer, default=30)
    discussion_ratio = db.Column(db.Integer, default=30)
    teaching_goal = db.Column(db.String(50), default='normal')
    custom_requirements = db.Column(db.Text, default='')
    current_step = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='configuring')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    teacher = db.relationship('User', backref='generation_configs')
    course = db.relationship('Course', backref='generation_configs')

    def to_dict(self):
        return {
            'id': self.id,
            'teacher_id': self.teacher_id,
            'course_id': self.course_id,
            'difficulty': self.difficulty,
            'duration': self.duration,
            'interaction_level': self.interaction_level,
            'video_ratio': self.video_ratio,
            'experiment_ratio': self.experiment_ratio,
            'discussion_ratio': self.discussion_ratio,
            'teaching_goal': self.teaching_goal,
            'custom_requirements': self.custom_requirements,
            'current_step': self.current_step,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class CourseGenerationVersion(db.Model):
    __tablename__ = 'course_generation_versions'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    config_id = db.Column(db.Integer, db.ForeignKey('course_generation_configs.id'), nullable=False)
    step = db.Column(db.Integer, nullable=False)
    step_name = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    version_number = db.Column(db.Integer, default=1)
    change_summary = db.Column(db.String(200), default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    config = db.relationship('CourseGenerationConfig', backref='versions')

    def to_dict(self):
        return {
            'id': self.id,
            'config_id': self.config_id,
            'step': self.step,
            'step_name': self.step_name,
            'content': self.content,
            'version_number': self.version_number,
            'change_summary': self.change_summary,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class CourseReview(db.Model):
    __tablename__ = 'course_reviews'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    config_id = db.Column(db.Integer, db.ForeignKey('course_generation_configs.id'), nullable=False)
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    review_type = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='pending')
    comment = db.Column(db.Text, default='')
    score = db.Column(db.Integer, default=None)
    reviewed_at = db.Column(db.DateTime, default=datetime.utcnow)

    config = db.relationship('CourseGenerationConfig', backref='reviews')
    reviewer = db.relationship('User', backref='course_reviews')

    def to_dict(self):
        return {
            'id': self.id,
            'config_id': self.config_id,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer.username if self.reviewer else None,
            'review_type': self.review_type,
            'status': self.status,
            'comment': self.comment,
            'score': self.score,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
        }


class AIFeedback(db.Model):
    __tablename__ = 'ai_feedbacks'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    config_id = db.Column(db.Integer, db.ForeignKey('course_generation_configs.id'), nullable=False)
    original_content = db.Column(db.Text, default='')
    modified_content = db.Column(db.Text, default='')
    modification_type = db.Column(db.String(50), default='')
    feedback_text = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    config = db.relationship('CourseGenerationConfig', backref='ai_feedbacks')

    def to_dict(self):
        return {
            'id': self.id,
            'config_id': self.config_id,
            'original_content': self.original_content[:200] if self.original_content else '',
            'modified_content': self.modified_content[:200] if self.modified_content else '',
            'modification_type': self.modification_type,
            'feedback_text': self.feedback_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
