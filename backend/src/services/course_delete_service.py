import logging
from pathlib import Path

from sqlalchemy import or_

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
from src.models.user import ClassGroupCourse, db

logger = logging.getLogger(__name__)


def _delete_query(query, label, deleted_counts):
    deleted = query.delete(synchronize_session=False)
    deleted_counts[label] = deleted
    return deleted


def _safe_delete_uploaded_files(urls):
    backend_root = Path(__file__).resolve().parents[2]
    uploads_root = (backend_root / 'uploads').resolve()
    deleted = 0

    for url in urls:
        if not url or not isinstance(url, str) or not url.startswith('/uploads/'):
            continue

        candidate = (backend_root / Path(*url.lstrip('/').split('/'))).resolve()
        try:
            candidate.relative_to(uploads_root)
        except ValueError:
            logger.warning("忽略不在 uploads 目录内的课程资源文件: %s", url)
            continue

        if candidate.is_file():
            candidate.unlink()
            deleted += 1

    return deleted


def delete_course_cascade(course):
    """Delete a course and every DB row that can reference it.

    Bulk deletes are ordered from deepest dependencies to the course row itself so
    large courses do not require loading all ORM objects into memory.
    """
    if isinstance(course, int):
        course = Course.query.get(course)
    if not course:
        raise ValueError('Course not found')

    course_id = course.id
    deleted_counts = {}
    media_urls = [
        url
        for row in VideoLesson.query.with_entities(
            VideoLesson.video_url,
            VideoLesson.thumbnail_url,
        ).filter_by(course_id=course_id)
        for url in row
    ]

    assessment_ids = db.session.query(Assessment.id).filter_by(course_id=course_id)
    content_ids = db.session.query(TeachingContent.id).filter_by(course_id=course_id)
    course_question_ids = db.session.query(CourseQuestion.id).filter_by(course_id=course_id)
    generation_config_ids = db.session.query(CourseGenerationConfig.id).filter_by(course_id=course_id)
    learning_path_ids = db.session.query(LearningPath.id).filter_by(course_id=course_id)
    source_chunk_ids = db.session.query(KnowledgeSourceChunk.id).filter_by(course_id=course_id)
    video_ids = db.session.query(VideoLesson.id).filter_by(course_id=course_id)

    logger.info("开始级联删除课程 course_id=%s, title=%s", course_id, course.title)

    # Deep dependencies.
    _delete_query(QuestionAnswer.query.filter(QuestionAnswer.question_id.in_(course_question_ids)), 'question_answers', deleted_counts)
    _delete_query(PracticeEvaluation.query.filter(PracticeEvaluation.assessment_id.in_(assessment_ids)), 'practice_evaluations', deleted_counts)
    _delete_query(
        ProgrammingSubmission.query.filter(
            or_(
                ProgrammingSubmission.course_id == course_id,
                ProgrammingSubmission.assessment_id.in_(assessment_ids),
            )
        ),
        'programming_submissions',
        deleted_counts,
    )
    _delete_query(
        MistakeRecord.query.filter(
            or_(
                MistakeRecord.course_id == course_id,
                MistakeRecord.assessment_id.in_(assessment_ids),
            )
        ),
        'mistake_records',
        deleted_counts,
    )
    _delete_query(VideoProgress.query.filter(VideoProgress.video_id.in_(video_ids)), 'video_progress', deleted_counts)
    _delete_query(LearningPathNode.query.filter(LearningPathNode.path_id.in_(learning_path_ids)), 'learning_path_nodes', deleted_counts)
    _delete_query(CourseGenerationVersion.query.filter(CourseGenerationVersion.config_id.in_(generation_config_ids)), 'course_generation_versions', deleted_counts)
    _delete_query(CourseReview.query.filter(CourseReview.config_id.in_(generation_config_ids)), 'course_reviews', deleted_counts)
    _delete_query(AIFeedback.query.filter(AIFeedback.config_id.in_(generation_config_ids)), 'ai_feedback', deleted_counts)
    _delete_query(
        GenerationCitation.query.filter(
            or_(
                GenerationCitation.course_id == course_id,
                GenerationCitation.source_chunk_id.in_(source_chunk_ids),
            )
        ),
        'generation_citations',
        deleted_counts,
    )
    _delete_query(KnowledgeGraphEdge.query.filter_by(course_id=course_id), 'knowledge_graph_edges', deleted_counts)

    # Break self-references before bulk deletion.
    CourseDiscussion.query.filter_by(course_id=course_id).update({'parent_id': None}, synchronize_session=False)
    KnowledgePoint.query.filter_by(course_id=course_id).update({'parent_id': None}, synchronize_session=False)
    CourseChapter.query.filter_by(course_id=course_id).update({'parent_id': None}, synchronize_session=False)

    # Rows that can point at videos, generated contents, notes, or discussions.
    _delete_query(CourseQuestion.query.filter_by(course_id=course_id), 'course_questions', deleted_counts)
    _delete_query(HandRaise.query.filter_by(course_id=course_id), 'hand_raises', deleted_counts)
    _delete_query(
        ContentBookmark.query.filter(
            or_(
                ContentBookmark.course_id == course_id,
                ContentBookmark.video_id.in_(video_ids),
                ContentBookmark.content_id.in_(content_ids),
            )
        ),
        'content_bookmarks',
        deleted_counts,
    )
    _delete_query(
        StudyNote.query.filter(
            or_(
                StudyNote.course_id == course_id,
                StudyNote.video_id.in_(video_ids),
                StudyNote.content_id.in_(content_ids),
            )
        ),
        'study_notes',
        deleted_counts,
    )
    _delete_query(CourseDiscussion.query.filter_by(course_id=course_id), 'course_discussions', deleted_counts)

    # Direct course-owned records.
    _delete_query(LearningProgress.query.filter_by(course_id=course_id), 'learning_progress', deleted_counts)
    _delete_query(TargetedQuestionGroup.query.filter_by(course_id=course_id), 'targeted_question_groups', deleted_counts)
    _delete_query(ContentSyncRecord.query.filter_by(course_id=course_id), 'content_sync_records', deleted_counts)
    _delete_query(ClassGroupCourse.query.filter_by(course_id=course_id), 'class_group_courses', deleted_counts)
    _delete_query(CourseGenerationConfig.query.filter_by(course_id=course_id), 'course_generation_configs', deleted_counts)

    # Course materials and assessments.
    _delete_query(TeachingContent.query.filter_by(course_id=course_id), 'teaching_contents', deleted_counts)
    _delete_query(VideoLesson.query.filter_by(course_id=course_id), 'video_lessons', deleted_counts)
    _delete_query(Assessment.query.filter_by(course_id=course_id), 'assessments', deleted_counts)

    # Knowledge base tables.
    _delete_query(TeachingCase.query.filter_by(course_id=course_id), 'teaching_cases', deleted_counts)
    _delete_query(CourseExercise.query.filter_by(course_id=course_id), 'course_exercises', deleted_counts)
    _delete_query(KnowledgePoint.query.filter_by(course_id=course_id), 'knowledge_points', deleted_counts)
    _delete_query(CourseChapter.query.filter_by(course_id=course_id), 'course_chapters', deleted_counts)
    _delete_query(KnowledgeGraphNode.query.filter_by(course_id=course_id), 'knowledge_graph_nodes', deleted_counts)
    _delete_query(KnowledgeSourceChunk.query.filter_by(course_id=course_id), 'knowledge_source_chunks', deleted_counts)
    _delete_query(CourseSyllabus.query.filter_by(course_id=course_id), 'course_syllabuses', deleted_counts)
    _delete_query(LearningPath.query.filter_by(course_id=course_id), 'learning_paths', deleted_counts)

    db.session.delete(course)
    deleted_counts['courses'] = 1
    db.session.commit()

    try:
        deleted_counts['uploaded_files'] = _safe_delete_uploaded_files(media_urls)
    except Exception:
        logger.warning("课程数据库记录已删除，但清理上传文件失败 course_id=%s", course_id, exc_info=True)
        deleted_counts['uploaded_files'] = 0

    logger.info("课程删除成功 course_id=%s, deleted=%s", course_id, deleted_counts)
    return deleted_counts
