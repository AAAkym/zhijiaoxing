import json

import pytest
from flask import Flask

from src.models.ai_analysis import TargetedQuestionGroup
from src.models.content_sync_record import ContentSyncRecord
from src.models.course import (
    AIFeedback,
    Assessment,
    ContentBookmark,
    Course,
    CourseDiscussion,
    CourseGenerationConfig,
    CourseGenerationVersion,
    CourseQuestion,
    CourseReview,
    HandRaise,
    LearningProgress,
    MistakeRecord,
    PracticeEvaluation,
    ProgrammingSubmission,
    QuestionAnswer,
    StudyNote,
    TeachingContent,
    VideoLesson,
    VideoProgress,
)
from src.models.knowledge_base import (
    CourseChapter,
    CourseExercise,
    CourseSyllabus,
    GenerationCitation,
    KnowledgeGraphEdge,
    KnowledgeGraphNode,
    KnowledgePoint,
    KnowledgeSourceChunk,
    TeachingCase,
)
from src.models.learning_path import LearningPath, LearningPathNode
from src.models.user import ClassGroup, ClassGroupCourse, User, db as _db
from src.routes.course import course_bp
from src.services.course_delete_service import delete_course_cascade


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test-secret'
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    _db.init_app(app)
    app.register_blueprint(course_bp, url_prefix='/api')
    return app


@pytest.fixture
def db_session(app):
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


def _add(db_session, *items):
    db_session.session.add_all(items)
    db_session.session.flush()
    return items if len(items) > 1 else items[0]


def test_delete_course_cascade_removes_related_rows(db_session):
    db = db_session

    teacher = _add(db, User(
        username='teacher_delete',
        email='teacher_delete@example.com',
        password_hash='x',
        role='teacher',
    ))
    student = _add(db, User(
        username='student_delete',
        email='student_delete@example.com',
        password_hash='x',
        role='student',
    ))
    course = _add(db, Course(title='Java', description='Delete me', teacher_id=teacher.id))

    video = _add(db, VideoLesson(
        course_id=course.id,
        title='Lesson 1',
        video_url='/uploads/videos/course-delete.mp4',
    ))
    content = _add(db, TeachingContent(
        course_id=course.id,
        video_id=video.id,
        title='Lecture notes',
        content='content',
    ))
    assessment = _add(db, Assessment(
        course_id=course.id,
        title='Quiz',
        questions=json.dumps([{'question': 'Q?'}]),
        answers=json.dumps(['A']),
    ))
    note = _add(db, StudyNote(
        user_id=student.id,
        course_id=course.id,
        video_id=video.id,
        content_id=content.id,
        title='note',
        content='note body',
    ))
    question = _add(db, CourseQuestion(
        course_id=course.id,
        user_id=student.id,
        video_id=video.id,
        content_id=content.id,
        title='question',
        content='question body',
    ))
    discussion = _add(db, CourseDiscussion(
        course_id=course.id,
        user_id=student.id,
        content='root',
    ))
    _add(db, CourseDiscussion(
        course_id=course.id,
        user_id=teacher.id,
        parent_id=discussion.id,
        content='reply',
    ))

    _add(
        db,
        QuestionAnswer(question_id=question.id, user_id=teacher.id, content='answer'),
        VideoProgress(user_id=student.id, video_id=video.id),
        PracticeEvaluation(user_id=student.id, assessment_id=assessment.id, user_answer='A'),
        ProgrammingSubmission(user_id=student.id, assessment_id=assessment.id, course_id=course.id),
        MistakeRecord(
            user_id=student.id,
            course_id=course.id,
            assessment_id=assessment.id,
            note_id=note.id,
            question_content='Q',
            user_answer='B',
            correct_answer='A',
        ),
        HandRaise(course_id=course.id, user_id=student.id, video_id=video.id),
        ContentBookmark(user_id=student.id, course_id=course.id, video_id=video.id, content_id=content.id),
        LearningProgress(user_id=student.id, course_id=course.id),
        TargetedQuestionGroup(user_id=student.id, course_id=course.id, title='weak points'),
    )

    config = _add(db, CourseGenerationConfig(teacher_id=teacher.id, course_id=course.id))
    _add(
        db,
        CourseGenerationVersion(config_id=config.id, step=1, step_name='outline', content='{}'),
        CourseReview(config_id=config.id, reviewer_id=teacher.id, review_type='teacher'),
        AIFeedback(config_id=config.id),
    )

    syllabus = _add(db, CourseSyllabus(course_id=course.id, course_code='JAVA101'))
    parent_chapter = _add(db, CourseChapter(course_id=course.id, title='Chapter 1'))
    child_chapter = _add(db, CourseChapter(course_id=course.id, parent_id=parent_chapter.id, title='Chapter 1.1'))
    parent_kp = _add(db, KnowledgePoint(course_id=course.id, chapter_id=parent_chapter.id, title='OOP'))
    child_kp = _add(db, KnowledgePoint(
        course_id=course.id,
        chapter_id=child_chapter.id,
        parent_id=parent_kp.id,
        title='Class',
    ))
    node_a = _add(db, KnowledgeGraphNode(graph_id='g', course_id=course.id, node_type='concept', label='A'))
    node_b = _add(db, KnowledgeGraphNode(graph_id='g', course_id=course.id, node_type='concept', label='B'))
    chunk = _add(db, KnowledgeSourceChunk(
        course_id=course.id,
        reference_code='S1',
        title='Source',
        content='source content',
    ))
    _add(
        db,
        TeachingCase(course_id=course.id, chapter_id=parent_chapter.id, knowledge_point_id=parent_kp.id, title='case'),
        CourseExercise(
            course_id=course.id,
            chapter_id=child_chapter.id,
            knowledge_point_id=child_kp.id,
            title='exercise',
            content='exercise',
            correct_answer='A',
        ),
        KnowledgeGraphEdge(
            graph_id='g',
            course_id=course.id,
            source_node_id=node_a.id,
            target_node_id=node_b.id,
            edge_type='related',
        ),
        GenerationCitation(
            course_id=course.id,
            resource_type='lecture',
            source_chunk_id=chunk.id,
            title='citation',
        ),
    )

    path = _add(db, LearningPath(user_id=student.id, course_id=course.id, title='Path'))
    group = _add(db, ClassGroup(name='Class A', teacher_id=teacher.id))
    _add(
        db,
        LearningPathNode(path_id=path.id, node_id='n1', title='Node'),
        ContentSyncRecord(
            package_id='pkg',
            course_id=course.id,
            teacher_id=teacher.id,
            content_type='lecture',
            teaching_content_id=content.id,
        ),
        ClassGroupCourse(class_group_id=group.id, course_id=course.id),
    )
    db.session.commit()

    deleted = delete_course_cascade(course)

    assert deleted['courses'] == 1
    assert Course.query.get(course.id) is None

    for model in (
        VideoLesson,
        TeachingContent,
        Assessment,
        LearningProgress,
        CourseQuestion,
        QuestionAnswer,
        VideoProgress,
        PracticeEvaluation,
        ProgrammingSubmission,
        MistakeRecord,
        HandRaise,
        StudyNote,
        ContentBookmark,
        CourseDiscussion,
        CourseGenerationConfig,
        CourseGenerationVersion,
        CourseReview,
        AIFeedback,
        CourseSyllabus,
        CourseChapter,
        KnowledgePoint,
        TeachingCase,
        CourseExercise,
        KnowledgeGraphNode,
        KnowledgeGraphEdge,
        KnowledgeSourceChunk,
        GenerationCitation,
        ContentSyncRecord,
        TargetedQuestionGroup,
        LearningPath,
        LearningPathNode,
        ClassGroupCourse,
    ):
        assert model.query.count() == 0, model.__name__


def test_teacher_delete_course_route_uses_cascade(app, db_session):
    teacher = _add(db_session, User(
        username='route_teacher',
        email='route_teacher@example.com',
        password_hash='x',
        role='teacher',
    ))
    course = _add(db_session, Course(title='Route Course', teacher_id=teacher.id))
    _add(db_session, LearningProgress(user_id=teacher.id, course_id=course.id))
    db_session.session.commit()

    client = app.test_client()
    with client.session_transaction() as sess:
        sess['user_id'] = teacher.id
        sess['user_role'] = 'teacher'

    response = client.delete(f'/api/courses/{course.id}')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['deleted']['courses'] == 1
    assert Course.query.count() == 0
    assert LearningProgress.query.count() == 0
