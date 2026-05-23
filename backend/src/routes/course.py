from flask import Blueprint, request, jsonify, session
from src.models.user import User, db
from src.models.course import Course, TeachingContent, Assessment, PracticeEvaluation, VideoLesson, ProgrammingSubmission, MistakeRecord, LearningProgress, CourseQuestion, CourseDiscussion, HandRaise, StudyNote, ContentBookmark
from src.services.spark_service import spark_service
from src.services.knowledge_base import knowledge_base_service
from src.utils.auth import require_auth, require_role
import json
import os
import re
from werkzeug.utils import secure_filename


_OPTION_LINE_RE = re.compile(r'^\s*[\(\uff08]?([A-D])[\)\uff09]?\s*[\.\u3001:\uff1a]?\s*(.*)', re.IGNORECASE)
MAX_ASSESSMENT_PARSE_CHARS = int(os.environ.get('ASSESSMENT_PARSE_MAX_CHARS', '200000'))
MAX_ASSESSMENT_PARSE_QUESTIONS = int(os.environ.get('ASSESSMENT_PARSE_MAX_QUESTIONS', '100'))


def _parse_generated_assessment_text(text: str):
    """Parse an LLM assessment response with bounded, linear-time work."""
    if not text or not text.strip():
        return []

    source = text.strip()[:MAX_ASSESSMENT_PARSE_CHARS]
    questions = []
    current_lines = []

    def flush_block():
        if not current_lines or len(questions) >= MAX_ASSESSMENT_PARSE_QUESTIONS:
            return

        lines = [line.strip() for line in current_lines if line.strip()]
        current_lines.clear()
        if not lines:
            return

        question_text = lines[0]
        options = []
        correct = None
        explanation = ''

        for idx, line in enumerate(lines[1:], start=1):
            opt_match = _OPTION_LINE_RE.match(line)
            if opt_match:
                option_text = opt_match.group(2).strip()
                if option_text:
                    options.append(option_text)
                continue

            lower_line = line.lower()
            if 'answer' in lower_line or 'correct' in lower_line or '\u7b54\u6848' in line or line.startswith('\u6b63\u786e'):
                match = re.search(r'([A-D])', line.upper())
                if match:
                    correct = ord(match.group(1)) - ord('A')
                continue

            if 'explanation' in lower_line or line.startswith(('\u89e3\u6790', '\u89e3\u91ca')):
                explanation = '\n'.join(lines[idx:])
                break

        questions.append({
            'question': question_text if options else '\n'.join(lines),
            'options': options,
            'correctAnswer': correct,
            'explanation': explanation,
        })

    for raw_line in source.splitlines():
        if not raw_line.strip():
            flush_block()
            if len(questions) >= MAX_ASSESSMENT_PARSE_QUESTIONS:
                break
            continue
        current_lines.append(raw_line)

    flush_block()
    return questions


def _serialize_assessment(assessment: Assessment):
    """将 Assessment 实例转换为对前端友好的 dict，确保 questions/answers 字段为解析后的结构（数组或原始文本）。"""
    a = assessment.to_dict()
    # 解析 questions 字段（数据库中保存为 JSON 字符串或纯文本）
    q = a.get('questions')
    try:
        if isinstance(q, str):
            parsed = json.loads(q)
            a['questions'] = parsed
        else:
            a['questions'] = q
    except Exception:
        # 非 JSON 字符串，则尝试用解析器进行结构化解析
        parsed = _parse_generated_assessment_text(q if isinstance(q, str) else str(q))
        if parsed:
            a['questions'] = parsed
        else:
            # 回退为原始文本包装在单题中
            a['questions'] = [{
                'question': q if isinstance(q, str) else str(q),
                'options': [],
                'correctAnswer': None,
                'explanation': ''
            }]

    # 解析 answers 字段为 JSON（如果可能）
    ans = a.get('answers')
    try:
        if isinstance(ans, str) and ans.strip():
            a['answers'] = json.loads(ans)
    except Exception:
        # 保持原样
        a['answers'] = ans

    return a
course_bp = Blueprint('course', __name__)


@course_bp.route('/courses', methods=['GET'])
@require_auth
def get_courses():
    """获取课程列表"""
    try:
        user_role = session.get('user_role')
        user_id = session.get('user_id')
        
        if user_role == 'admin':
            # 管理员可以看到所有课程
            courses = Course.query.all()
        elif user_role == 'teacher':
            # 教师只能看到自己的课程
            courses = Course.query.filter_by(teacher_id=user_id).all()
        else:
            # 学生可以看到所有课程
            courses = Course.query.all()
        
        return jsonify({
            'courses': [course.to_dict() for course in courses]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@course_bp.route('/courses', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_course():
    """创建课程"""
    try:
        data = request.get_json()
        
        # 验证必填字段
        if not data.get('title'):
            return jsonify({'error': 'Title is required'}), 400
        
        # 确定教师ID
        teacher_id = data.get('teacher_id')
        if session.get('user_role') == 'teacher':
            teacher_id = session.get('user_id')
        elif not teacher_id:
            return jsonify({'error': 'Teacher ID is required'}), 400
        
        # 验证教师存在
        teacher = User.query.filter_by(id=teacher_id, role='teacher').first()
        if not teacher:
            return jsonify({'error': 'Invalid teacher ID'}), 400
        
        course = Course(
            title=data['title'],
            description=data.get('description', ''),
            teacher_id=teacher_id,
            category=data.get('category', 'programming'),
            difficulty=data.get('difficulty', 'beginner'),
            duration=data.get('duration', ''),
            status=data.get('status', 'active')
        )
        
        db.session.add(course)
        db.session.commit()
        
        return jsonify({
            'message': 'Course created successfully',
            'course': course.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/courses/<int:course_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'teacher'])
def update_course(course_id):
    """更新课程"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # 检查权限
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        data = request.get_json()
        
        if 'title' in data:
            course.title = data['title']
        if 'description' in data:
            course.description = data['description']
        if 'category' in data:
            course.category = data['category']
        if 'difficulty' in data:
            course.difficulty = data['difficulty']
        if 'duration' in data:
            course.duration = data['duration']
        if 'status' in data:
            course.status = data['status']
        if 'teacher_id' in data and session.get('user_role') == 'admin':
            teacher = User.query.filter_by(id=data['teacher_id'], role='teacher').first()
            if not teacher:
                return jsonify({'error': 'Invalid teacher ID'}), 400
            course.teacher_id = data['teacher_id']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Course updated successfully',
            'course': course.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/courses/<int:course_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'teacher'])
def delete_course(course_id):
    """删除课程"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        TeachingContent.query.filter_by(course_id=course_id).delete()
        Assessment.query.filter_by(course_id=course_id).delete()
        LearningProgress.query.filter_by(course_id=course_id).delete()
        VideoLesson.query.filter_by(course_id=course_id).delete()
        CourseQuestion.query.filter_by(course_id=course_id).delete()
        CourseDiscussion.query.filter_by(course_id=course_id).delete()
        HandRaise.query.filter_by(course_id=course_id).delete()
        StudyNote.query.filter_by(course_id=course_id).delete()
        ContentBookmark.query.filter_by(course_id=course_id).delete()
        MistakeRecord.query.filter_by(course_id=course_id).delete()
        ProgrammingSubmission.query.filter_by(course_id=course_id).delete()
        
        db.session.delete(course)
        db.session.commit()
        
        return jsonify({'message': 'Course deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/courses/<int:course_id>/content', methods=['GET'])
@require_auth
def get_course_content(course_id):
    """获取课程内容"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        contents = TeachingContent.query.filter_by(course_id=course_id).all()
        
        return jsonify({
            'course': course.to_dict(),
            'contents': [content.to_dict() for content in contents]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@course_bp.route('/videos/<int:video_id>/content', methods=['GET'])
@require_auth
def get_video_content(video_id):
    """获取视频关联的教学内容"""
    try:
        contents = TeachingContent.query.filter_by(video_id=video_id).all()
        
        return jsonify({
            'contents': [content.to_dict() for content in contents]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@course_bp.route('/teaching_content', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_teaching_content():
    """创建教学内容"""
    try:
        data = request.get_json()
        
        # 验证必填字段
        required_fields = ['course_id', 'title', 'content']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # 检查权限
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        # 创建教学内容
        teaching_content = TeachingContent(
            course_id=data['course_id'],
            video_id=data.get('video_id'),
            title=data['title'],
            content=data['content'],
            generated_by_llm=data.get('generated_by_llm', False)
        )
        
        db.session.add(teaching_content)
        db.session.commit()
        
        return jsonify({
            'message': 'Content created successfully',
            'content': teaching_content.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/generate_content', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def generate_content():
    """生成教学内容"""
    try:
        data = request.get_json()
        
        # 验证必填字段
        required_fields = ['course_id', 'topic']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # 检查权限
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        # 获取相关知识库内容
        knowledge_base = knowledge_base_service.get_knowledge_by_topic(data['topic'])
        
        # 生成内容
        content = spark_service.generate_teaching_content(
            course_title=course.title,
            topic=data['topic'],
            knowledge_base=knowledge_base
        )
        
        # 保存到数据库
        teaching_content = TeachingContent(
            course_id=data['course_id'],
            title=data['topic'],
            content=content,
            generated_by_llm=True,
            video_id=data.get('video_id')
        )
        
        db.session.add(teaching_content)
        db.session.commit()
        
        return jsonify({
            'message': 'Content generated successfully',
            'content': teaching_content.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/generate_assessment', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def generate_assessment():
    """生成考核题目"""
    try:
        data = request.get_json()
        
        # 验证必填字段
        required_fields = ['course_id', 'topic', 'title']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # 检查权限
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        # 获取相关知识库内容
        knowledge_base = knowledge_base_service.get_knowledge_by_topic(data['topic'])
        
        # 生成考核题目（LLM 可能返回纯文本或 JSON）
        raw_questions = spark_service.generate_assessment(
            course_title=course.title,
            topic=data['topic'],
            question_count=data.get('question_count', 5),
            knowledge_base=knowledge_base
        )

        # 规范化：如果 LLM 返回的是 JSON 字符串则直接使用，否则尝试解析为结构化题目数组
        raw_text = raw_questions
        if isinstance(raw_text, str):
            cleaned = raw_text.strip()
            # 去掉可能的 ```json 代码块包装或前缀 "json"
            if cleaned.startswith("```"):
                cleaned = cleaned[3:].strip()
                if cleaned.lower().startswith("json"):
                    cleaned = cleaned[4:].strip()
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3].strip()
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()
            raw_text = cleaned.strip()
        try:
            parsed = json.loads(raw_text)
            normalized_questions = parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            normalized_questions = _parse_generated_assessment_text(raw_text if isinstance(raw_text, str) else str(raw_text))
            # 如果解析失败且返回为空，则保存为单项简答题（文本）
            if not normalized_questions:
                normalized_questions = [{
                    'question': raw_questions,
                    'options': [],
                    'correctAnswer': None,
                    'explanation': ''
                }]

        questions_json = json.dumps(normalized_questions, ensure_ascii=False)

        # 保存到数据库（以 JSON 字符串形式保存 questions 字段）
        assessment = Assessment(
            course_id=data['course_id'],
            title=data['title'],
            questions=questions_json,
            generated_by_llm=True
        )
        
        db.session.add(assessment)
        db.session.commit()
        
        return jsonify({
            'message': 'Assessment generated successfully',
            'assessment': _serialize_assessment(assessment)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/courses/<int:course_id>/assessments', methods=['GET'])
@require_auth
def get_course_assessments(course_id):
    """获取课程考核"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        assessments = (Assessment.query
                       .filter_by(course_id=course_id)
                       .order_by(Assessment.created_at.desc(), Assessment.id.desc())
                       .all())
        
        return jsonify({
            'course': course.to_dict(),
            'assessments': [_serialize_assessment(assessment) for assessment in assessments]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@course_bp.route('/assessments/<int:assessment_id>/stats', methods=['GET'])
@require_auth
@require_role(['admin', 'teacher'])
def get_assessment_stats(assessment_id):
    """统计考核正确率与选项分布（教师端使用）"""
    try:
        assessment = Assessment.query.get(assessment_id)
        if not assessment:
            return jsonify({'error': 'Assessment not found'}), 404

        a = _serialize_assessment(assessment)
        questions = a.get('questions') if isinstance(a, dict) else []
        if not isinstance(questions, list):
            questions = []

        evaluations = PracticeEvaluation.query.filter_by(assessment_id=assessment_id).all()
        total_submissions = len(evaluations)

        overall_correct = 0
        overall_attempts = 0
        question_stats = []

        # 预解析所有用户答案，减少重复解析
        parsed_answers = []
        for ev in evaluations:
            try:
                parsed = json.loads(ev.user_answer) if ev.user_answer else None
            except Exception:
                parsed = None
            parsed_answers.append(parsed)

        for idx, q in enumerate(questions):
            options = q.get('options') if isinstance(q, dict) else []
            options = options if isinstance(options, list) else []
            correct_index = q.get('correctAnswer') if isinstance(q, dict) else None

            option_counts = [0] * len(options)
            correct_count = 0
            attempt_count = 0

            for ans in parsed_answers:
                answer = None
                if isinstance(ans, list) and idx < len(ans):
                    answer = ans[idx]
                elif isinstance(ans, dict):
                    if 'answers' in ans and isinstance(ans.get('answers'), list) and idx < len(ans['answers']):
                        answer = ans['answers'][idx]
                    elif str(idx) in ans:
                        answer = ans.get(str(idx))
                if answer is None:
                    continue
                attempt_count += 1
                if isinstance(answer, int) and 0 <= answer < len(option_counts):
                    option_counts[answer] += 1
                if isinstance(correct_index, int) and answer == correct_index:
                    correct_count += 1

            overall_attempts += attempt_count
            overall_correct += correct_count

            question_stats.append({
                'index': idx,
                'question': q.get('question') if isinstance(q, dict) else str(q),
                'options': options,
                'correctAnswer': correct_index,
                'attempts': attempt_count,
                'correctCount': correct_count,
                'correctRate': round((correct_count / attempt_count) * 100, 2) if attempt_count else 0,
                'optionCounts': option_counts
            })

        overall_rate = round((overall_correct / overall_attempts) * 100, 2) if overall_attempts else 0

        return jsonify({
            'assessment_id': assessment_id,
            'title': assessment.title,
            'total_submissions': total_submissions,
            'overall_correct_rate': overall_rate,
            'questions': question_stats
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@course_bp.route('/courses/<int:course_id>/assessments', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_course_assessment(course_id):
    """创建考核（手动保存或外部内容）"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404

        # 权限检查
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403

        data = request.get_json() or {}
        title = data.get('title')
        questions = data.get('questions')

        if not title or not questions:
            return jsonify({'error': 'title and questions are required'}), 400

        # 如果 questions 是对象或数组，转为 JSON 字符串保存
        if not isinstance(questions, str):
            questions = json.dumps(questions, ensure_ascii=False)

        assessment = Assessment(
            course_id=course_id,
            title=title,
            questions=questions,
            generated_by_llm=False
        )

        db.session.add(assessment)
        db.session.commit()

        return jsonify({'message': 'Assessment created', 'assessment': _serialize_assessment(assessment)}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/assessments/<int:assessment_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'teacher'])
def update_assessment(assessment_id):
    """更新考核内容（允许教师编辑题目）"""
    try:
        assessment = Assessment.query.get(assessment_id)
        if not assessment:
            return jsonify({'error': 'Assessment not found'}), 404

        # 权限检查
        course = Course.query.get(assessment.course_id)
        if session.get('user_role') == 'teacher' and course and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403

        data = request.get_json() or {}
        if 'title' in data:
            assessment.title = data['title']
        if 'questions' in data:
            q = data['questions']
            assessment.questions = q if isinstance(q, str) else json.dumps(q, ensure_ascii=False)
        if 'is_recommended' in data:
            assessment.is_recommended = bool(data['is_recommended'])

        db.session.commit()
        return jsonify({'message': 'Assessment updated', 'assessment': _serialize_assessment(assessment)}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/assessments/<int:assessment_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'teacher'])
def delete_assessment(assessment_id):
    """删除考核"""
    try:
        assessment = Assessment.query.get(assessment_id)
        if not assessment:
            return jsonify({'error': 'Assessment not found'}), 404

        course = Course.query.get(assessment.course_id)
        if session.get('user_role') == 'teacher' and course and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403

        ProgrammingSubmission.query.filter_by(assessment_id=assessment_id).delete()
        MistakeRecord.query.filter_by(assessment_id=assessment_id).delete()
        PracticeEvaluation.query.filter_by(assessment_id=assessment_id).delete()
        
        db.session.delete(assessment)
        db.session.commit()
        
        return jsonify({'message': 'Assessment deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# 视频课程相关API
@course_bp.route('/courses/<int:course_id>/videos', methods=['GET'])
@require_auth
def get_course_videos(course_id):
    """获取课程视频列表"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        videos = VideoLesson.query.filter_by(course_id=course_id).order_by(VideoLesson.order_index, VideoLesson.created_at).all()
        
        return jsonify({
            'course': course.to_dict(),
            'videos': [video.to_dict() for video in videos]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@course_bp.route('/courses/<int:course_id>/videos', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def create_video_lesson(course_id):
    """创建视频课程"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # 检查权限
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        data = request.get_json()
        
        # 验证必填字段
        if not data.get('title') or not data.get('video_url'):
            return jsonify({'error': 'Title and video_url are required'}), 400
        
        # 获取当前最大排序索引
        max_order = db.session.query(db.func.max(VideoLesson.order_index)).filter_by(course_id=course_id).scalar() or 0
        
        video = VideoLesson(
            course_id=course_id,
            title=data['title'],
            description=data.get('description', ''),
            video_url=data['video_url'],
            thumbnail_url=data.get('thumbnail_url'),
            duration=data.get('duration'),
            order_index=max_order + 1,
            is_free=data.get('is_free', False),
            status=data.get('status', 'published')
        )
        
        db.session.add(video)
        db.session.commit()
        
        return jsonify({
            'message': 'Video lesson created successfully',
            'video': video.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/videos/<int:video_id>', methods=['GET'])
@require_auth
def get_video_lesson(video_id):
    """获取单个视频课程详情"""
    try:
        video = VideoLesson.query.get(video_id)
        if not video:
            return jsonify({'error': 'Video not found'}), 404
        
        # 增加观看次数
        video.views_count = (video.views_count or 0) + 1
        db.session.commit()
        
        return jsonify({
            'video': video.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@course_bp.route('/videos/<int:video_id>', methods=['PUT'])
@require_auth
@require_role(['admin', 'teacher'])
def update_video_lesson(video_id):
    """更新视频课程"""
    try:
        video = VideoLesson.query.get(video_id)
        if not video:
            return jsonify({'error': 'Video not found'}), 404
        
        # 检查权限
        course = Course.query.get(video.course_id)
        if session.get('user_role') == 'teacher' and course and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        data = request.get_json()
        
        if 'title' in data:
            video.title = data['title']
        if 'description' in data:
            video.description = data['description']
        if 'video_url' in data:
            video.video_url = data['video_url']
        if 'thumbnail_url' in data:
            video.thumbnail_url = data['thumbnail_url']
        if 'duration' in data:
            video.duration = data['duration']
        if 'order_index' in data:
            video.order_index = data['order_index']
        if 'is_free' in data:
            video.is_free = data['is_free']
        if 'status' in data:
            video.status = data['status']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Video lesson updated successfully',
            'video': video.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@course_bp.route('/videos/<int:video_id>', methods=['DELETE'])
@require_auth
@require_role(['admin', 'teacher'])
def delete_video_lesson(video_id):
    """删除视频课程"""
    try:
        video = VideoLesson.query.get(video_id)
        if not video:
            return jsonify({'error': 'Video not found'}), 404
        
        # 检查权限
        course = Course.query.get(video.course_id)
        if session.get('user_role') == 'teacher' and course and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
        db.session.delete(video)
        db.session.commit()
        
        return jsonify({'message': 'Video lesson deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# 视频文件上传配置
# 统一指向项目根目录下的 uploads/videos，避免与静态服务路径不一致
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'videos')
ALLOWED_EXTENSIONS = {'mp4', 'webm', 'ogg', 'mov'}
MAX_VIDEO_UPLOAD_BYTES = int(os.environ.get('VIDEO_UPLOAD_MAX_BYTES', str(200 * 1024 * 1024)))

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@course_bp.route('/upload/video', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def upload_video_file():
    """上传视频文件"""
    try:
        if request.content_length and request.content_length > MAX_VIDEO_UPLOAD_BYTES:
            return jsonify({'error': 'File too large'}), 413

        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        file = request.files['video']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            # 确保上传目录存在
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            
            # 生成安全的文件名
            filename = secure_filename(file.filename)
            # 添加时间戳避免重名
            from datetime import datetime
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            name, ext = os.path.splitext(filename)
            safe_filename = f"{name}_{timestamp}{ext}"
            
            # 保存文件
            filepath = os.path.join(UPLOAD_FOLDER, safe_filename)
            file.save(filepath)
            
            # 返回视频URL（这里返回相对路径，实际使用时需要根据服务器配置调整）
            video_url = f'/uploads/videos/{safe_filename}'
            
            return jsonify({
                'message': 'Video uploaded successfully',
                'video_url': video_url,
                'filename': safe_filename
            }), 200
        
        return jsonify({'error': 'Invalid file type'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
