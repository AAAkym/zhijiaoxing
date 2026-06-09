import json

from flask import Blueprint, request, jsonify, session
from src.models.user import db
from src.models.knowledge_base import CourseSyllabus, CourseChapter, KnowledgePoint, TeachingCase, CourseExercise
from src.utils.auth import require_auth, require_role

kb_bp = Blueprint('knowledge_base', __name__)


@kb_bp.route('/knowledge-base/courses/<int:course_id>/syllabus', methods=['GET'])
@require_auth
def get_syllabus(course_id):
    try:
        syllabus = CourseSyllabus.query.filter_by(course_id=course_id).first()
        if not syllabus:
            return jsonify({'error': 'Syllabus not found'}), 404
        return jsonify({'syllabus': syllabus.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/syllabus', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_or_update_syllabus(course_id):
    try:
        data = request.get_json() or {}
        syllabus = CourseSyllabus.query.filter_by(course_id=course_id).first()
        if syllabus:
            for key in ['course_code', 'credit', 'total_hours', 'theory_hours',
                        'practice_hours', 'semester', 'description']:
                if key in data:
                    setattr(syllabus, key, data[key])
            for key in ['prerequisite_courses', 'course_objectives',
                        'assessment_methods', 'textbook', 'references']:
                if key in data:
                    val = data[key]
                    setattr(syllabus, key, json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val)
        else:
            fields = {}
            for key in ['course_code', 'credit', 'total_hours', 'theory_hours',
                        'practice_hours', 'semester', 'description']:
                if key in data:
                    fields[key] = data[key]
            for key in ['prerequisite_courses', 'course_objectives',
                        'assessment_methods', 'textbook', 'references']:
                if key in data:
                    val = data[key]
                    fields[key] = json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val
            syllabus = CourseSyllabus(course_id=course_id, **fields)
            db.session.add(syllabus)
        db.session.commit()
        return jsonify({'syllabus': syllabus.to_dict()}), 200 if syllabus else 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/chapters', methods=['GET'])
@require_auth
def get_chapters(course_id):
    try:
        parent_id = request.args.get('parent_id', type=int)
        query = CourseChapter.query.filter_by(course_id=course_id)
        if parent_id is not None:
            query = query.filter_by(parent_id=parent_id)
        else:
            query = query.filter_by(parent_id=None)
        chapters = query.order_by(CourseChapter.order_index).all()
        return jsonify({'chapters': [c.to_dict(include_children=True) for c in chapters]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/chapters/<int:chapter_id>', methods=['GET'])
@require_auth
def get_chapter(chapter_id):
    try:
        chapter = CourseChapter.query.get(chapter_id)
        if not chapter:
            return jsonify({'error': 'Chapter not found'}), 404
        return jsonify({'chapter': chapter.to_dict(include_children=True)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/chapters', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_chapter(course_id):
    try:
        data = request.get_json() or {}
        if not data.get('title'):
            return jsonify({'error': 'Title is required'}), 400
        json_fields = ['objectives', 'key_points', 'difficulties', 'teaching_methods']
        fields = {'course_id': course_id}
        for key in ['title', 'description', 'order_index', 'teaching_hours',
                    'chapter_type', 'parent_id', 'status']:
            if key in data:
                fields[key] = data[key]
        for key in json_fields:
            if key in data:
                val = data[key]
                fields[key] = json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val
        chapter = CourseChapter(**fields)
        db.session.add(chapter)
        db.session.commit()
        return jsonify({'chapter': chapter.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/chapters/<int:chapter_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'teacher'])
def update_chapter(chapter_id):
    try:
        chapter = CourseChapter.query.get(chapter_id)
        if not chapter:
            return jsonify({'error': 'Chapter not found'}), 404
        data = request.get_json() or {}
        json_fields = ['objectives', 'key_points', 'difficulties', 'teaching_methods']
        for key in ['title', 'description', 'order_index', 'teaching_hours',
                    'chapter_type', 'parent_id', 'status']:
            if key in data:
                setattr(chapter, key, data[key])
        for key in json_fields:
            if key in data:
                val = data[key]
                setattr(chapter, key, json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val)
        db.session.commit()
        return jsonify({'chapter': chapter.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/chapters/<int:chapter_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'teacher'])
def delete_chapter(chapter_id):
    try:
        chapter = CourseChapter.query.get(chapter_id)
        if not chapter:
            return jsonify({'error': 'Chapter not found'}), 404
        _delete_chapter_recursive(chapter)
        db.session.commit()
        return jsonify({'message': 'Chapter deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


def _delete_chapter_recursive(chapter):
    for child in CourseChapter.query.filter_by(parent_id=chapter.id).all():
        _delete_chapter_recursive(child)
    KnowledgePoint.query.filter_by(chapter_id=chapter.id).delete()
    TeachingCase.query.filter_by(chapter_id=chapter.id).delete()
    CourseExercise.query.filter_by(chapter_id=chapter.id).delete()
    db.session.delete(chapter)


@kb_bp.route('/knowledge-base/courses/<int:course_id>/knowledge-points', methods=['GET'])
@require_auth
def get_knowledge_points(course_id):
    try:
        chapter_id = request.args.get('chapter_id', type=int)
        query = KnowledgePoint.query.filter_by(course_id=course_id)
        if chapter_id:
            query = query.filter_by(chapter_id=chapter_id)
        kps = query.order_by(KnowledgePoint.order_index).all()
        return jsonify({'knowledge_points': [kp.to_dict() for kp in kps]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/knowledge-points/<int:kp_id>', methods=['GET'])
@require_auth
def get_knowledge_point(kp_id):
    try:
        kp = KnowledgePoint.query.get(kp_id)
        if not kp:
            return jsonify({'error': 'Knowledge point not found'}), 404
        return jsonify({'knowledge_point': kp.to_dict(include_children=True)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/knowledge-points', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_knowledge_point(course_id):
    try:
        data = request.get_json() or {}
        if not data.get('title') or not data.get('chapter_id'):
            return jsonify({'error': 'Title and chapter_id are required'}), 400
        json_fields = ['prerequisites', 'related_concepts', 'formulas', 'examples', 'tags']
        fields = {'course_id': course_id}
        for key in ['title', 'definition', 'content', 'order_index', 'difficulty_level',
                    'importance', 'chapter_id', 'parent_id', 'source', 'source_url', 'status']:
            if key in data:
                fields[key] = data[key]
        for key in json_fields:
            if key in data:
                val = data[key]
                fields[key] = json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val
        kp = KnowledgePoint(**fields)
        db.session.add(kp)
        db.session.commit()
        return jsonify({'knowledge_point': kp.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/knowledge-points/<int:kp_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'teacher'])
def update_knowledge_point(kp_id):
    try:
        kp = KnowledgePoint.query.get(kp_id)
        if not kp:
            return jsonify({'error': 'Knowledge point not found'}), 404
        data = request.get_json() or {}
        json_fields = ['prerequisites', 'related_concepts', 'formulas', 'examples', 'tags']
        for key in ['title', 'definition', 'content', 'order_index', 'difficulty_level',
                    'importance', 'chapter_id', 'parent_id', 'source', 'source_url', 'status']:
            if key in data:
                setattr(kp, key, data[key])
        for key in json_fields:
            if key in data:
                val = data[key]
                setattr(kp, key, json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val)
        db.session.commit()
        return jsonify({'knowledge_point': kp.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/knowledge-points/<int:kp_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'teacher'])
def delete_knowledge_point(kp_id):
    try:
        kp = KnowledgePoint.query.get(kp_id)
        if not kp:
            return jsonify({'error': 'Knowledge point not found'}), 404
        for child in KnowledgePoint.query.filter_by(parent_id=kp_id).all():
            db.session.delete(child)
        db.session.delete(kp)
        db.session.commit()
        return jsonify({'message': 'Knowledge point deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/teaching-cases', methods=['GET'])
@require_auth
def get_teaching_cases(course_id):
    try:
        chapter_id = request.args.get('chapter_id', type=int)
        kp_id = request.args.get('knowledge_point_id', type=int)
        case_type = request.args.get('case_type')
        query = TeachingCase.query.filter_by(course_id=course_id)
        if chapter_id:
            query = query.filter_by(chapter_id=chapter_id)
        if kp_id:
            query = query.filter_by(knowledge_point_id=kp_id)
        if case_type:
            query = query.filter_by(case_type=case_type)
        cases = query.order_by(TeachingCase.created_at.desc()).all()
        return jsonify({'teaching_cases': [c.to_dict() for c in cases]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/teaching-cases/<int:case_id>', methods=['GET'])
@require_auth
def get_teaching_case(case_id):
    try:
        case = TeachingCase.query.get(case_id)
        if not case:
            return jsonify({'error': 'Teaching case not found'}), 404
        return jsonify({'teaching_case': case.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/teaching-cases', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_teaching_case(course_id):
    try:
        data = request.get_json() or {}
        if not data.get('title') or not data.get('chapter_id'):
            return jsonify({'error': 'Title and chapter_id are required'}), 400
        json_fields = ['visualization', 'tags']
        fields = {'course_id': course_id}
        for key in ['title', 'case_type', 'background', 'problem_description',
                    'analysis', 'solution', 'conclusion', 'dataset_description',
                    'code_example', 'difficulty_level', 'chapter_id',
                    'knowledge_point_id', 'source', 'source_url', 'status']:
            if key in data:
                fields[key] = data[key]
        for key in json_fields:
            if key in data:
                val = data[key]
                fields[key] = json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val
        case = TeachingCase(**fields)
        db.session.add(case)
        db.session.commit()
        return jsonify({'teaching_case': case.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/teaching-cases/<int:case_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'teacher'])
def update_teaching_case(case_id):
    try:
        case = TeachingCase.query.get(case_id)
        if not case:
            return jsonify({'error': 'Teaching case not found'}), 404
        data = request.get_json() or {}
        json_fields = ['visualization', 'tags']
        for key in ['title', 'case_type', 'background', 'problem_description',
                    'analysis', 'solution', 'conclusion', 'dataset_description',
                    'code_example', 'difficulty_level', 'chapter_id',
                    'knowledge_point_id', 'source', 'source_url', 'status']:
            if key in data:
                setattr(case, key, data[key])
        for key in json_fields:
            if key in data:
                val = data[key]
                setattr(case, key, json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val)
        db.session.commit()
        return jsonify({'teaching_case': case.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/teaching-cases/<int:case_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'teacher'])
def delete_teaching_case(case_id):
    try:
        case = TeachingCase.query.get(case_id)
        if not case:
            return jsonify({'error': 'Teaching case not found'}), 404
        db.session.delete(case)
        db.session.commit()
        return jsonify({'message': 'Teaching case deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/exercises', methods=['GET'])
@require_auth
def get_exercises(course_id):
    try:
        chapter_id = request.args.get('chapter_id', type=int)
        kp_id = request.args.get('knowledge_point_id', type=int)
        exercise_type = request.args.get('exercise_type')
        difficulty = request.args.get('difficulty_level')
        include_answer = request.args.get('include_answer', 'false').lower() == 'true'
        query = CourseExercise.query.filter_by(course_id=course_id)
        if chapter_id:
            query = query.filter_by(chapter_id=chapter_id)
        if kp_id:
            query = query.filter_by(knowledge_point_id=kp_id)
        if exercise_type:
            query = query.filter_by(exercise_type=exercise_type)
        if difficulty:
            query = query.filter_by(difficulty_level=difficulty)
        exercises = query.order_by(CourseExercise.chapter_id, CourseExercise.order_index).all()
        return jsonify({'exercises': [e.to_dict(include_answer=include_answer) for e in exercises]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/exercises/<int:exercise_id>', methods=['GET'])
@require_auth
def get_exercise(exercise_id):
    try:
        include_answer = request.args.get('include_answer', 'false').lower() == 'true'
        exercise = CourseExercise.query.get(exercise_id)
        if not exercise:
            return jsonify({'error': 'Exercise not found'}), 404
        return jsonify({'exercise': exercise.to_dict(include_answer=include_answer)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/exercises', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_exercise(course_id):
    try:
        data = request.get_json() or {}
        if not data.get('title') or not data.get('chapter_id') or not data.get('content') or not data.get('correct_answer'):
            return jsonify({'error': 'Title, chapter_id, content and correct_answer are required'}), 400
        json_fields = ['options', 'hints', 'knowledge_tags']
        fields = {'course_id': course_id}
        for key in ['title', 'exercise_type', 'difficulty_level', 'content',
                    'correct_answer', 'answer_analysis', 'score', 'estimated_minutes',
                    'chapter_id', 'knowledge_point_id', 'source', 'source_url', 'status']:
            if key in data:
                fields[key] = data[key]
        for key in json_fields:
            if key in data:
                val = data[key]
                fields[key] = json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val
        exercise = CourseExercise(**fields)
        db.session.add(exercise)
        db.session.commit()
        return jsonify({'exercise': exercise.to_dict(include_answer=True)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/exercises/<int:exercise_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'teacher'])
def update_exercise(exercise_id):
    try:
        exercise = CourseExercise.query.get(exercise_id)
        if not exercise:
            return jsonify({'error': 'Exercise not found'}), 404
        data = request.get_json() or {}
        json_fields = ['options', 'hints', 'knowledge_tags']
        for key in ['title', 'exercise_type', 'difficulty_level', 'content',
                    'correct_answer', 'answer_analysis', 'score', 'estimated_minutes',
                    'chapter_id', 'knowledge_point_id', 'source', 'source_url', 'status']:
            if key in data:
                setattr(exercise, key, data[key])
        for key in json_fields:
            if key in data:
                val = data[key]
                setattr(exercise, key, json.dumps(val, ensure_ascii=False) if not isinstance(val, str) else val)
        db.session.commit()
        return jsonify({'exercise': exercise.to_dict(include_answer=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/exercises/<int:exercise_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'teacher'])
def delete_exercise(exercise_id):
    try:
        exercise = CourseExercise.query.get(exercise_id)
        if not exercise:
            return jsonify({'error': 'Exercise not found'}), 404
        db.session.delete(exercise)
        db.session.commit()
        return jsonify({'message': 'Exercise deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/overview', methods=['GET'])
@require_auth
def get_course_knowledge_overview(course_id):
    try:
        syllabus = CourseSyllabus.query.filter_by(course_id=course_id).first()
        chapters = CourseChapter.query.filter_by(course_id=course_id, parent_id=None).order_by(CourseChapter.order_index).all()
        kp_count = KnowledgePoint.query.filter_by(course_id=course_id).count()
        case_count = TeachingCase.query.filter_by(course_id=course_id).count()
        exercise_count = CourseExercise.query.filter_by(course_id=course_id).count()
        exercise_type_stats = db.session.query(
            CourseExercise.exercise_type, db.func.count(CourseExercise.id)
        ).filter_by(course_id=course_id).group_by(CourseExercise.exercise_type).all()
        difficulty_stats = db.session.query(
            CourseExercise.difficulty_level, db.func.count(CourseExercise.id)
        ).filter_by(course_id=course_id).group_by(CourseExercise.difficulty_level).all()
        return jsonify({
            'syllabus': syllabus.to_dict() if syllabus else None,
            'chapters': [c.to_dict(include_children=True) for c in chapters],
            'statistics': {
                'knowledge_point_count': kp_count,
                'teaching_case_count': case_count,
                'exercise_count': exercise_count,
                'exercise_type_distribution': {t: c for t, c in exercise_type_stats},
                'difficulty_distribution': {d: c for d, c in difficulty_stats},
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@kb_bp.route('/knowledge-base/courses/<int:course_id>/validate', methods=['GET'])
@require_auth
@require_role(['admin', 'teacher'])
def validate_course_knowledge(course_id):
    try:
        from src.services.knowledge_base_validator import validate_course
        result = validate_course(course_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
