from flask import Blueprint, request, jsonify, session
from src.models.user import User, db
from src.models.course import Course, TeachingContent, Assessment, PracticeEvaluation, VideoLesson, ProgrammingSubmission, MistakeRecord
from src.services.spark_service import spark_service
from src.services.knowledge_base import knowledge_base_service
import json
import os
from werkzeug.utils import secure_filename


def _parse_generated_assessment_text(text: str):
    """尝试将 LLM 返回的纯文本解析成结构化的题目列表。
    返回格式: [{ 'question': str, 'options': [str], 'correctAnswer': int|null, 'explanation': str }, ...]
    解析逻辑尽量鲁棒：
    - 首先按空行分段，每段视为一题
    - 每段中查找 A. B. C. D. 类似选项行
    - 查找“答案”或"Answer"所在行，提取正确选项字母并转换为索引
    - 查找“解析”或"解析："后的文本作为解析
    如果无法解析为多题，则将整个文本作为单个简答题的 content。
    """
    if not text or not text.strip():
        return []

    parts = [p.strip() for p in text.split('\n\n') if p.strip()]
    questions = []

    for part in parts:
        lines = [l.strip() for l in part.splitlines() if l.strip()]
        if not lines:
            continue

        # 初始值
        q_text = lines[0]
        options = []
        correct = None
        explanation = ''

        # 收集选项（识别 A. A)、A： 等多种形式）
        for ln in lines[1:]:
            if ln[:2].upper().startswith('A') and (ln[1:2] in ['.', ')', '：', ':'] or ln[1:2].isspace()):
                options.append(ln.split(ln[1], 1)[-1].strip())
                continue
            if ln[:2].upper().startswith('B') and (ln[1:2] in ['.', ')', '：', ':'] or ln[1:2].isspace()):
                options.append(ln.split(ln[1], 1)[-1].strip())
                continue
            if ln[:2].upper().startswith('C') and (ln[1:2] in ['.', ')', '：', ':'] or ln[1:2].isspace()):
                options.append(ln.split(ln[1], 1)[-1].strip())
                continue
            if ln[:2].upper().startswith('D') and (ln[1:2] in ['.', ')', '：', ':'] or ln[1:2].isspace()):
                options.append(ln.split(ln[1], 1)[-1].strip())
                continue

            # 答案行识别
            low = ln.lower()
            if '答案' in ln or 'answer' in low or ln.startswith('正确'):
                # 提取字母
                import re
                m = re.search(r'([A-D])', ln.upper())
                if m:
                    letter = m.group(1)
                    correct = ord(letter) - ord('A')
                else:
                    # 中文格式可能是"答案：C" 或 "答案：  C"
                    m2 = re.search(r'答案[:：\s]*([A-D])', ln.upper())
                    if m2:
                        correct = ord(m2.group(1)) - ord('A')
                continue

            # 解析/解释
            if ln.startswith('解析') or ln.startswith('解释') or '解析：' in ln or '解释：' in ln:
                # 取该行以及后续行为解析
                idx = lines.index(ln)
                explanation = '\n'.join(lines[idx:])
                break

        # 如果没有识别到选项并且文本较长，可以把整个 part 作为题干
        if not options:
            questions.append({
                'question': part,
                'options': [],
                'correctAnswer': None,
                'explanation': ''
            })
        else:
            questions.append({
                'question': q_text,
                'options': options,
                'correctAnswer': correct,
                'explanation': explanation
            })

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


def require_auth(f):
    """认证装饰器"""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


def require_role(roles):
    """角色权限装饰器"""
    def decorator(f):
        def decorated_function(*args, **kwargs):
            if 'user_role' not in session or session['user_role'] not in roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            return f(*args, **kwargs)
        decorated_function.__name__ = f.__name__
        return decorated_function
    return decorator


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
        
        # 检查权限
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403
        
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

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@course_bp.route('/upload/video', methods=['POST'])
@require_auth
@require_role(['admin', 'teacher'])
def upload_video_file():
    """上传视频文件"""
    try:
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
