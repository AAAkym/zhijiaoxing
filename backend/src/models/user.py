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


class ClassGroup(db.Model):
    __tablename__ = 'class_groups'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    teacher_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    description = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    teacher = db.relationship('User', backref='class_groups')
    students = db.relationship('ClassGroupStudent', backref='class_group', lazy='dynamic')
    courses = db.relationship('ClassGroupCourse', backref='class_group', lazy='dynamic')

    def to_dict(self):
        student_count = self.students.count()
        course_count = self.courses.count()
        return {
            'id': self.id,
            'name': self.name,
            'teacher_id': self.teacher_id,
            'description': self.description,
            'student_count': student_count,
            'course_count': course_count,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ClassGroupStudent(db.Model):
    __tablename__ = 'class_group_students'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    class_group_id = db.Column(db.Integer, db.ForeignKey('class_groups.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    student_name = db.Column(db.String(100), default='')
    student_number = db.Column(db.String(50), default='')
    contact = db.Column(db.String(100), default='')
    joined_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='class_group_memberships')

    def to_dict(self):
        user_dict = self.user.to_dict() if self.user else {}
        return {
            'id': self.id,
            'class_group_id': self.class_group_id,
            'user_id': self.user_id,
            'student_name': self.student_name or user_dict.get('real_name', ''),
            'student_number': self.student_number,
            'contact': self.contact,
            'username': user_dict.get('username', ''),
            'email': user_dict.get('email', ''),
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
        }


class ClassGroupCourse(db.Model):
    __tablename__ = 'class_group_courses'
    __table_args__ = {'extend_existing': True}

    id = db.Column(db.Integer, primary_key=True)
    class_group_id = db.Column(db.Integer, db.ForeignKey('class_groups.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)

    course = db.relationship('Course', backref='class_group_assignments')

    def to_dict(self):
        course_dict = self.course.to_dict() if self.course else {}
        return {
            'id': self.id,
            'class_group_id': self.class_group_id,
            'course_id': self.course_id,
            'course_title': course_dict.get('title', ''),
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
        }
