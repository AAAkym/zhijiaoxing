from datetime import datetime
from src.models.user import db


class Course(db.Model):
    """课程模型"""
    __tablename__ = 'courses'
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    __table_args__ = {'extend_existing': True}
    
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
    note_id = db.Column(db.Integer, db.ForeignKey('study_notes.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User', backref='mistake_records')
    course = db.relationship('Course', backref='mistake_records')
    assessment = db.relationship('Assessment', backref='mistake_records')
    note = db.relationship('StudyNote', backref='linked_mistakes')
    
    def to_dict(self):
        import json
        knowledge_tags = []
        if self.knowledge_tags:
            try:
                knowledge_tags = json.loads(self.knowledge_tags)
            except:
                knowledge_tags = []
        
        return {
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
            'note_id': self.note_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

