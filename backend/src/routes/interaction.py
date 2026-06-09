from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
from src.models.user import db
from src.models.course import (
    Course, VideoLesson, VideoProgress, TeachingContent,
    CourseQuestion, QuestionAnswer, CourseDiscussion, HandRaise,
    StudyNote, ContentBookmark, LearningProgress
)
from src.services.spark_service import spark_service
from src.services.websocket_service import (
    notify_hand_raise, notify_question, notify_discussion
)
from datetime import datetime
import json

interaction_bp = Blueprint('interaction', __name__)


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


# ==================== 视频进度相关API ====================

@interaction_bp.route('/video_progress/<int:video_id>', methods=['GET'])
@require_auth
def get_video_progress(video_id):
    """获取视频观看进度"""
    try:
        user_id = session['user_id']
        progress = VideoProgress.query.filter_by(user_id=user_id, video_id=video_id).first()
        
        if not progress:
            return jsonify({'progress': None}), 200
        
        return jsonify({'progress': progress.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/video_progress', methods=['POST'])
@require_auth
def update_video_progress():
    """更新视频观看进度"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        video_id = data.get('video_id')
        current_time = data.get('current_time', 0)
        completed = data.get('completed', False)
        
        if not video_id:
            return jsonify({'error': 'video_id is required'}), 400
        
        progress = VideoProgress.query.filter_by(user_id=user_id, video_id=video_id).first()
        
        if not progress:
            progress = VideoProgress(
                user_id=user_id,
                video_id=video_id,
                current_time=current_time,
                completed=completed
            )
            db.session.add(progress)
        else:
            progress.current_time = current_time
            progress.completed = completed
            progress.last_watched = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Progress updated',
            'progress': progress.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== 问答相关API ====================

@interaction_bp.route('/courses/<int:course_id>/questions', methods=['GET'])
@require_auth
def get_course_questions(course_id):
    """获取课程问答列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        video_id = request.args.get('video_id', type=int)
        
        query = CourseQuestion.query.filter_by(course_id=course_id, is_public=True)
        
        if status:
            query = query.filter_by(status=status)
        if video_id:
            query = query.filter_by(video_id=video_id)
        
        questions = query.order_by(CourseQuestion.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        # 构建包含回答的问题列表
        result = []
        for q in questions.items:
            q_dict = q.to_dict()
            # 加载关联的回答
            q_dict['answers'] = [a.to_dict() for a in q.answers]
            result.append(q_dict)
        
        return jsonify({
            'questions': result,
            'total': questions.total,
            'pages': questions.pages,
            'current_page': page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/courses/<int:course_id>/questions', methods=['POST'])
@require_auth
def create_question(course_id):
    """创建问题"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data.get('title') or not data.get('content'):
            return jsonify({'error': 'Title and content are required'}), 400
        
        question = CourseQuestion(
            course_id=course_id,
            user_id=user_id,
            title=data['title'],
            content=data['content'],
            video_id=data.get('video_id'),
            content_id=data.get('content_id'),
            video_timestamp=data.get('video_timestamp'),
            is_public=data.get('is_public', True)
        )
        
        db.session.add(question)
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_question(course_id, question.to_dict(), 'created')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({
            'message': 'Question created',
            'question': question.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/questions/<int:question_id>', methods=['GET'])
@require_auth
def get_question(question_id):
    """获取问题详情"""
    try:
        question = CourseQuestion.query.get(question_id)
        if not question:
            return jsonify({'error': 'Question not found'}), 404
        
        answers = QuestionAnswer.query.filter_by(question_id=question_id).order_by(
            QuestionAnswer.is_accepted.desc(),
            QuestionAnswer.likes_count.desc(),
            QuestionAnswer.created_at
        ).all()
        
        return jsonify({
            'question': question.to_dict(),
            'answers': [a.to_dict() for a in answers]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/questions/<int:question_id>/answers', methods=['POST'])
@require_auth
def create_answer(question_id):
    """创建回答"""
    try:
        user_id = session['user_id']
        user_role = session.get('user_role')
        data = request.get_json()
        
        if not data.get('content'):
            return jsonify({'error': 'Content is required'}), 400
        
        question = CourseQuestion.query.get(question_id)
        if not question:
            return jsonify({'error': 'Question not found'}), 404
        
        answer = QuestionAnswer(
            question_id=question_id,
            user_id=user_id,
            content=data['content'],
            is_teacher_answer=user_role in ['teacher', 'admin']
        )
        
        old_status = question.status
        question.status = 'answered'
        db.session.add(answer)
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_question(question.course_id, {
                'question_id': question_id,
                'answer': answer.to_dict(),
                'old_status': old_status,
                'new_status': question.status
            }, 'answered')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({
            'message': 'Answer created',
            'answer': answer.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/answers/<int:answer_id>/accept', methods=['POST'])
@require_auth
def accept_answer(answer_id):
    """采纳答案"""
    try:
        user_id = session['user_id']
        answer = QuestionAnswer.query.get(answer_id)
        
        if not answer:
            return jsonify({'error': 'Answer not found'}), 404
        
        question = answer.question
        if question.user_id != user_id:
            return jsonify({'error': 'Only question owner can accept answer'}), 403
        
        QuestionAnswer.query.filter_by(question_id=question.id).update({'is_accepted': False})
        answer.is_accepted = True
        question.status = 'resolved'
        
        db.session.commit()
        
        return jsonify({'message': 'Answer accepted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== 讨论区相关API ====================

@interaction_bp.route('/courses/<int:course_id>/discussions', methods=['GET'])
@require_auth
def get_discussions(course_id):
    """获取课程讨论列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        discussions = CourseDiscussion.query.filter_by(
            course_id=course_id, parent_id=None
        ).order_by(
            CourseDiscussion.is_pinned.desc(),
            CourseDiscussion.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
        
        result = []
        for d in discussions.items:
            d_dict = d.to_dict()
            d_dict['replies'] = [r.to_dict() for r in d.replies[:5]]
            result.append(d_dict)
        
        return jsonify({
            'discussions': result,
            'total': discussions.total,
            'pages': discussions.pages,
            'current_page': page
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/courses/<int:course_id>/discussions', methods=['POST'])
@require_auth
def create_discussion(course_id):
    """创建讨论"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data.get('content'):
            return jsonify({'error': 'Content is required'}), 400
        
        discussion = CourseDiscussion(
            course_id=course_id,
            user_id=user_id,
            parent_id=data.get('parent_id'),
            content=data['content']
        )
        
        db.session.add(discussion)
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_discussion(course_id, discussion.to_dict(), 'created')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({
            'message': 'Discussion created',
            'discussion': discussion.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/discussions/<int:discussion_id>/like', methods=['POST'])
@require_auth
def like_discussion(discussion_id):
    """点赞讨论"""
    try:
        discussion = CourseDiscussion.query.get(discussion_id)
        if not discussion:
            return jsonify({'error': 'Discussion not found'}), 404
        
        discussion.likes_count = (discussion.likes_count or 0) + 1
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_discussion(discussion.course_id, discussion.to_dict(), 'liked')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({'likes_count': discussion.likes_count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/discussions/<int:discussion_id>/pin', methods=['POST'])
@require_auth
def pin_discussion(discussion_id):
    """置顶讨论（教师/管理员用）"""
    try:
        user_role = session.get('user_role')
        if user_role not in ['teacher', 'admin']:
            return jsonify({'error': 'Permission denied'}), 403
        
        discussion = CourseDiscussion.query.get(discussion_id)
        if not discussion:
            return jsonify({'error': 'Discussion not found'}), 404
        
        discussion.is_pinned = not discussion.is_pinned
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_discussion(discussion.course_id, discussion.to_dict(), 'pinned')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({
            'message': 'Discussion pinned',
            'is_pinned': discussion.is_pinned
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/discussions/<int:discussion_id>', methods=['DELETE'])
@require_auth
def delete_discussion(discussion_id):
    """删除讨论（教师/管理员用）"""
    try:
        user_role = session.get('user_role')
        if user_role not in ['teacher', 'admin']:
            return jsonify({'error': 'Permission denied'}), 403
        
        discussion = CourseDiscussion.query.get(discussion_id)
        if not discussion:
            return jsonify({'error': 'Discussion not found'}), 404
        
        course_id = discussion.course_id
        db.session.delete(discussion)
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_discussion(course_id, {'discussion_id': discussion_id}, 'deleted')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({'message': 'Discussion deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== 举手提问相关API ====================

@interaction_bp.route('/courses/<int:course_id>/hand_raises', methods=['GET'])
@require_auth
def get_hand_raises(course_id):
    """获取举手列表（教师用）"""
    try:
        user_role = session.get('user_role')
        if user_role not in ['teacher', 'admin']:
            return jsonify({'error': 'Permission denied'}), 403
        
        status = request.args.get('status', 'waiting')
        
        hand_raises = HandRaise.query.filter_by(
            course_id=course_id, status=status
        ).order_by(HandRaise.created_at).all()
        
        return jsonify({
            'hand_raises': [hr.to_dict() for hr in hand_raises]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/courses/<int:course_id>/hand_raises', methods=['POST'])
@require_auth
def create_hand_raise(course_id):
    """学生举手"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        existing = HandRaise.query.filter_by(
            course_id=course_id, user_id=user_id, status='waiting'
        ).first()
        
        if existing:
            return jsonify({'error': 'Already have a pending hand raise'}), 400
        
        hand_raise = HandRaise(
            course_id=course_id,
            user_id=user_id,
            video_id=data.get('video_id'),
            reason=data.get('reason')
        )
        
        db.session.add(hand_raise)
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_hand_raise(course_id, hand_raise.to_dict(), 'created')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({
            'message': 'Hand raised',
            'hand_raise': hand_raise.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/hand_raises/<int:hand_raise_id>/call', methods=['POST'])
@require_auth
def call_hand_raise(hand_raise_id):
    """点名（教师用）"""
    try:
        user_role = session.get('user_role')
        if user_role not in ['teacher', 'admin']:
            return jsonify({'error': 'Permission denied'}), 403
        
        hand_raise = HandRaise.query.get(hand_raise_id)
        if not hand_raise:
            return jsonify({'error': 'Hand raise not found'}), 404
        
        old_status = hand_raise.status
        hand_raise.status = 'called'
        hand_raise.called_at = datetime.utcnow()
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_hand_raise(hand_raise.course_id, hand_raise.to_dict(), 'updated')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({'message': 'Student called'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/hand_raises/<int:hand_raise_id>/resolve', methods=['POST'])
@require_auth
def resolve_hand_raise(hand_raise_id):
    """解决举手"""
    try:
        hand_raise = HandRaise.query.get(hand_raise_id)
        if not hand_raise:
            return jsonify({'error': 'Hand raise not found'}), 404
        
        hand_raise.status = 'resolved'
        db.session.commit()
        
        # 发送 WebSocket 实时通知
        try:
            notify_hand_raise(hand_raise.course_id, hand_raise.to_dict(), 'resolved')
        except Exception as ws_error:
            print(f'WebSocket notification failed: {ws_error}')
        
        return jsonify({'message': 'Hand raise resolved'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== 笔记相关API ====================

@interaction_bp.route('/notes', methods=['GET'])
@require_auth
def get_notes():
    """获取我的笔记"""
    try:
        user_id = session['user_id']
        course_id = request.args.get('course_id', type=int)
        video_id = request.args.get('video_id', type=int)
        
        query = StudyNote.query.filter_by(user_id=user_id)
        
        if course_id:
            query = query.filter_by(course_id=course_id)
        if video_id:
            query = query.filter_by(video_id=video_id)
        
        notes = query.order_by(StudyNote.updated_at.desc()).all()
        
        return jsonify({'notes': [n.to_dict() for n in notes]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/notes', methods=['POST'])
@require_auth
def create_note():
    """创建笔记"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data.get('title') or not data.get('content'):
            return jsonify({'error': 'Title and content are required'}), 400
        
        note = StudyNote(
            user_id=user_id,
            course_id=data['course_id'],
            video_id=data.get('video_id'),
            content_id=data.get('content_id'),
            title=data['title'],
            content=data['content'],
            video_timestamp=data.get('video_timestamp'),
            is_auto_generated=data.get('is_auto_generated', False),
            is_public=data.get('is_public', False)
        )
        
        db.session.add(note)
        db.session.commit()
        
        return jsonify({
            'message': 'Note created',
            'note': note.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/notes/<int:note_id>', methods=['PUT'])
@require_auth
def update_note(note_id):
    """更新笔记"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        note = StudyNote.query.get(note_id)
        if not note:
            return jsonify({'error': 'Note not found'}), 404
        
        if note.user_id != user_id:
            return jsonify({'error': 'Permission denied'}), 403
        
        if 'title' in data:
            note.title = data['title']
        if 'content' in data:
            note.content = data['content']
        if 'is_public' in data:
            note.is_public = data['is_public']
        
        db.session.commit()
        
        return jsonify({'message': 'Note updated', 'note': note.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@require_auth
def delete_note(note_id):
    """删除笔记"""
    try:
        user_id = session['user_id']
        
        note = StudyNote.query.get(note_id)
        if not note:
            return jsonify({'error': 'Note not found'}), 404
        
        if note.user_id != user_id:
            return jsonify({'error': 'Permission denied'}), 403
        
        db.session.delete(note)
        db.session.commit()
        
        return jsonify({'message': 'Note deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/notes/generate', methods=['POST'])
@require_auth
def generate_note():
    """AI生成笔记"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        content = data.get('content')
        video_id = data.get('video_id')
        course_id = data.get('course_id')
        
        if not content:
            return jsonify({'error': 'Content is required'}), 400
        
        prompt = f"""请根据以下学习内容，生成一份结构化的学习笔记：

{content}

请按以下格式输出：
1. 主要知识点
2. 重点内容
3. 学习要点
4. 总结
"""
        
        generated_content = spark_service.chat(prompt, user_id=session.get('user_id'), user_role=session.get('user_role'))
        
        note = StudyNote(
            user_id=user_id,
            course_id=course_id,
            video_id=video_id,
            title='AI生成笔记',
            content=generated_content,
            is_auto_generated=True
        )
        
        db.session.add(note)
        db.session.commit()
        
        return jsonify({
            'message': 'Note generated',
            'note': note.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== 书签/标记相关API ====================

@interaction_bp.route('/bookmarks', methods=['GET'])
@require_auth
def get_bookmarks():
    """获取我的书签"""
    try:
        user_id = session['user_id']
        course_id = request.args.get('course_id', type=int)
        video_id = request.args.get('video_id', type=int)
        bookmark_type = request.args.get('bookmark_type')
        
        query = ContentBookmark.query.filter_by(user_id=user_id)
        
        if course_id:
            query = query.filter_by(course_id=course_id)
        if video_id:
            query = query.filter_by(video_id=video_id)
        if bookmark_type:
            query = query.filter_by(bookmark_type=bookmark_type)
        
        bookmarks = query.order_by(ContentBookmark.created_at.desc()).all()
        
        return jsonify({'bookmarks': [b.to_dict() for b in bookmarks]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/bookmarks', methods=['POST'])
@require_auth
def create_bookmark():
    """创建书签"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        bookmark = ContentBookmark(
            user_id=user_id,
            course_id=data['course_id'],
            video_id=data.get('video_id'),
            content_id=data.get('content_id'),
            bookmark_type=data.get('bookmark_type', 'bookmark'),
            title=data.get('title'),
            note=data.get('note'),
            video_timestamp=data.get('video_timestamp'),
            color=data.get('color', '#FFD700')
        )
        
        db.session.add(bookmark)
        db.session.commit()
        
        return jsonify({
            'message': 'Bookmark created',
            'bookmark': bookmark.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/bookmarks/<int:bookmark_id>', methods=['DELETE'])
@require_auth
def delete_bookmark(bookmark_id):
    """删除书签"""
    try:
        user_id = session['user_id']
        
        bookmark = ContentBookmark.query.get(bookmark_id)
        if not bookmark:
            return jsonify({'error': 'Bookmark not found'}), 404
        
        if bookmark.user_id != user_id:
            return jsonify({'error': 'Permission denied'}), 403
        
        db.session.delete(bookmark)
        db.session.commit()
        
        return jsonify({'message': 'Bookmark deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ==================== 学习总结导出API ====================

@interaction_bp.route('/courses/<int:course_id>/summary', methods=['GET'])
@require_auth
def get_course_summary(course_id):
    """获取课程学习总结"""
    try:
        user_id = session['user_id']
        
        progress = LearningProgress.query.filter_by(user_id=user_id, course_id=course_id).first()
        notes = StudyNote.query.filter_by(user_id=user_id, course_id=course_id).all()
        bookmarks = ContentBookmark.query.filter_by(user_id=user_id, course_id=course_id).all()
        video_progress = VideoProgress.query.join(VideoLesson).filter(
            VideoLesson.course_id == course_id,
            VideoProgress.user_id == user_id
        ).all()
        
        return jsonify({
            'progress': progress.to_dict() if progress else None,
            'notes': [n.to_dict() for n in notes],
            'bookmarks': [b.to_dict() for b in bookmarks],
            'video_progress': [vp.to_dict() for vp in video_progress]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@interaction_bp.route('/courses/<int:course_id>/summary/export', methods=['POST'])
@require_auth
def export_course_summary(course_id):
    """导出学习总结"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        progress = LearningProgress.query.filter_by(user_id=user_id, course_id=course_id).first()
        notes = StudyNote.query.filter_by(user_id=user_id, course_id=course_id).all()
        bookmarks = ContentBookmark.query.filter_by(user_id=user_id, course_id=course_id).all()
        
        export_format = data.get('format', 'markdown')
        
        if export_format == 'markdown':
            content = f"""# {course.title} 学习总结

## 学习进度
完成度: {progress.progress_percentage if progress else 0}%

## 学习笔记
"""
            for note in notes:
                content += f"\n### {note.title}\n{note.content}\n"
            
            content += "\n## 重点标记\n"
            for bookmark in bookmarks:
                content += f"- {bookmark.title or '标记'}: {bookmark.note or ''}\n"
            
        elif export_format == 'json':
            content = json.dumps({
                'course': course.to_dict(),
                'progress': progress.to_dict() if progress else None,
                'notes': [n.to_dict() for n in notes],
                'bookmarks': [b.to_dict() for b in bookmarks]
            }, ensure_ascii=False, indent=2)
        else:
            content = ""
        
        return jsonify({
            'content': content,
            'format': export_format,
            'filename': f'{course.title}_学习总结.{export_format}'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
