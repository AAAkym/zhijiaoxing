import json
import os
import uuid
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, session, current_app, Response
from src.utils.auth import require_auth
from werkzeug.utils import secure_filename
from PIL import Image
import io
from src.models.user import db
from src.models.course import StudyNote, Course, VideoLesson, MistakeRecord
from sqlalchemy import or_, desc, asc
from sqlalchemy.exc import OperationalError
from src.services.spark_service import spark_service

notes_bp = Blueprint('notes', __name__)

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'notes')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
MAX_IMAGE_SIZE = 5 * 1024 * 1024


def safe_getattr(obj, attr, default=None):
    """安全获取对象属性（防止数据库列不存在导致的OperationalError）

    原因：当数据库表缺少某些列时（如 tags、is_public 等），
    直接访问 obj.attr 会触发 sqlite3.OperationalError。
    此函数通过 try-except 捕获该异常并返回默认值。
    """
    try:
        return getattr(obj, attr, default)
    except OperationalError:
        return default


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def compress_image(image_file, max_width=1920, quality=85):
    try:
        img = Image.open(image_file)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
        if img.width > max_width:
            ratio = max_width / img.width
            new_height = int(img.height * ratio)
            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=quality, optimize=True)
        output.seek(0)
        return output
    except Exception as e:
        print(f"Image compression error: {e}")
        return None


@notes_bp.route('/notes', methods=['GET'])
@require_auth
def get_notes():
    """获取笔记列表（支持分页、按课程/视频筛选、排序）

    增强健壮性：使用 safe_getattr 安全访问可能缺失的数据库列，
    防止因 tags/is_public 等列不存在导致 OperationalError。
    """
    try:
        user_id = session['user_id']

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        course_id = request.args.get('course_id', type=int)
        video_id = request.args.get('video_id', type=int)
        sort_by = request.args.get('sort_by', 'updated_at')
        sort_order = request.args.get('sort_order', 'desc')
        is_public = request.args.get('is_public')

        query = StudyNote.query.filter_by(user_id=user_id)

        if course_id:
            query = query.filter_by(course_id=course_id)

        if video_id:
            query = query.filter_by(video_id=video_id)

        # 使用安全方式过滤 is_public（防止列不存在）
        if is_public is not None:
            try:
                is_public_bool = is_public.lower() in ['true', '1', 'yes']
                query = query.filter(StudyNote.is_public == is_public_bool)
            except OperationalError as e:
                # 如果 is_public 列不存在，跳过此过滤条件
                current_app.logger.warning(f"is_public 列可能不存在，跳过公开状态过滤: {e}")

        # 安全获取排序列（防止列名错误）
        try:
            sort_column = getattr(StudyNote, sort_by, StudyNote.updated_at)
        except AttributeError:
            sort_column = StudyNote.updated_at

        if sort_order == 'asc':
            query = query.order_by(asc(sort_column))
        else:
            query = query.order_by(desc(sort_column))

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        # 安全序列化笔记数据（to_dict 内部会访问 tags 等字段）
        notes_list = []
        for note in pagination.items:
            try:
                notes_list.append(note.to_dict())
            except OperationalError as e:
                # 如果某条笔记的某些列无法访问，记录警告并跳过该条
                current_app.logger.warning(f"笔记 ID={note.id} 序列化失败，可能缺少列: {e}")
                continue

        return jsonify({
            'notes': notes_list,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'total_pages': pagination.pages
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes', methods=['POST'])
@require_auth
def create_note():
    """创建笔记"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data.get('title') or not data.get('title').strip():
            return jsonify({'error': 'Title is required'}), 400
        
        if not data.get('content') or not data.get('content').strip():
            return jsonify({'error': 'Content is required'}), 400
        
        if not data.get('course_id'):
            return jsonify({'error': 'course_id is required'}), 400
        
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        if data.get('video_id'):
            video = VideoLesson.query.get(data['video_id'])
            if not video:
                return jsonify({'error': 'Video not found'}), 404
        
        tags_json = None
        if data.get('tags'):
            if isinstance(data['tags'], list):
                tags_json = json.dumps(data['tags'])
            elif isinstance(data['tags'], str):
                tags_json = json.dumps([data['tags']])
        
        note = StudyNote(
            user_id=user_id,
            course_id=data['course_id'],
            video_id=data.get('video_id'),
            content_id=data.get('content_id'),
            title=data['title'].strip(),
            content=data['content'].strip(),
            video_timestamp=data.get('video_timestamp'),
            tags=tags_json,
            is_auto_generated=data.get('is_auto_generated', False),
            is_public=data.get('is_public', False)
        )
        
        db.session.add(note)
        db.session.commit()
        
        return jsonify({
            'message': 'Note created successfully',
            'note': note.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/<int:note_id>', methods=['GET'])
@require_auth
def get_note_detail(note_id):
    """获取笔记详情"""
    try:
        user_id = session['user_id']
        
        note = StudyNote.query.get(note_id)
        
        if not note:
            return jsonify({'error': 'Note not found'}), 404
        
        if note.user_id != user_id and not note.is_public:
            return jsonify({'error': 'Permission denied'}), 403
        
        note_dict = note.to_dict()
        
        if note.course:
            note_dict['course_title'] = note.course.title
            note_dict['course_description'] = note.course.description
        
        if note.video:
            note_dict['video_title'] = note.video.title
            note_dict['video_url'] = note.video.video_url
        
        return jsonify({'note': note_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/<int:note_id>', methods=['PUT'])
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
            if not data['title'] or not data['title'].strip():
                return jsonify({'error': 'Title cannot be empty'}), 400
            note.title = data['title'].strip()
        
        if 'content' in data:
            if not data['content'] or not data['content'].strip():
                return jsonify({'error': 'Content cannot be empty'}), 400
            note.content = data['content'].strip()
        
        if 'video_timestamp' in data:
            note.video_timestamp = data['video_timestamp']
        
        if 'is_public' in data:
            note.is_public = data['is_public']
        
        if 'tags' in data:
            if isinstance(data['tags'], list):
                note.tags = json.dumps(data['tags'])
            elif isinstance(data['tags'], str):
                note.tags = json.dumps([data['tags']])
            else:
                note.tags = None
        
        note.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Note updated successfully',
            'note': note.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/<int:note_id>', methods=['DELETE'])
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
        
        return jsonify({'message': 'Note deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/search', methods=['GET'])
@require_auth
def search_notes():
    """搜索笔记（支持全文搜索、按标签筛选）

    增强健壮性：安全处理标签筛选和笔记序列化。
    """
    try:
        user_id = session['user_id']

        keyword = request.args.get('keyword', '').strip()
        tag = request.args.get('tag', '').strip()
        course_id = request.args.get('course_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        # 基础查询（不依赖特殊列）
        query = StudyNote.query.filter(
            or_(
                StudyNote.user_id == user_id,
                safe_getattr(StudyNote, 'is_public') == True
            ) if hasattr(StudyNote, 'is_public') else
            (StudyNote.user_id == user_id)
        )

        if keyword:
            query = query.filter(
                or_(
                    StudyNote.title.contains(keyword),
                    StudyNote.content.contains(keyword)
                )
            )

        # 安全的标签筛选（防止 tags 列不存在）
        if tag:
            try:
                query = query.filter(StudyNote.tags.contains(tag))
            except OperationalError as e:
                current_app.logger.warning(f"tags 列不存在，无法按标签筛选: {e}")

        if course_id:
            query = query.filter_by(course_id=course_id)

        query = query.order_by(StudyNote.updated_at.desc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        results = []
        for note in pagination.items:
            try:
                note_dict = note.to_dict()
                if keyword:
                    note_dict['matched_in'] = []
                    if keyword.lower() in note.title.lower():
                        note_dict['matched_in'].append('title')
                    if keyword.lower() in note.content.lower():
                        note_dict['matched_in'].append('content')
                results.append(note_dict)
            except OperationalError as e:
                current_app.logger.warning(f"搜索结果中笔记 ID={note.id} 序列化失败: {e}")
                continue

        return jsonify({
            'notes': results,
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'total_pages': pagination.pages,
            'keyword': keyword,
            'tag': tag
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/<int:note_id>/tags', methods=['POST'])
@require_auth
def add_note_tag(note_id):
    """添加标签

    增强健壮性：安全访问和修改 note.tags 字段。
    """
    try:
        user_id = session['user_id']
        data = request.get_json()

        if not data.get('tag') or not data.get('tag').strip():
            return jsonify({'error': 'Tag is required'}), 400

        new_tag = data['tag'].strip()

        note = StudyNote.query.get(note_id)

        if not note:
            return jsonify({'error': 'Note not found'}), 404

        if note.user_id != user_id:
            return jsonify({'error': 'Permission denied'}), 403

        # 安全读取现有标签（防止 tags 列不存在）
        current_tags = []
        tags_str = safe_getattr(note, 'tags', None)
        if tags_str:
            try:
                current_tags = json.loads(tags_str)
            except (json.JSONDecodeError, TypeError):
                current_tags = []

        if not isinstance(current_tags, list):
            current_tags = []

        if new_tag not in current_tags:
            current_tags.append(new_tag)
            # 安全写入标签（防止 tags 列不存在）
            try:
                note.tags = json.dumps(current_tags)
                note.updated_at = datetime.utcnow()
                db.session.commit()
            except OperationalError as e:
                db.session.rollback()
                return jsonify({'error': f'无法保存标签，数据库可能缺少 tags 列: {e}'}), 500

        return jsonify({
            'message': 'Tag added successfully',
            'tags': current_tags
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/<int:note_id>/tags/<path:tag>', methods=['DELETE'])
@require_auth
def delete_note_tag(note_id, tag):
    """删除标签

    增强健壮性：安全访问和修改 note.tags 字段。
    """
    try:
        user_id = session['user_id']

        note = StudyNote.query.get(note_id)

        if not note:
            return jsonify({'error': 'Note not found'}), 404

        if note.user_id != user_id:
            return jsonify({'error': 'Permission denied'}), 403

        # 安全读取现有标签（防止 tags 列不存在）
        current_tags = []
        tags_str = safe_getattr(note, 'tags', None)
        if tags_str:
            try:
                current_tags = json.loads(tags_str)
            except (json.JSONDecodeError, TypeError):
                current_tags = []

        if not isinstance(current_tags, list):
            current_tags = []

        if tag in current_tags:
            current_tags.remove(tag)
            # 安全写入标签（防止 tags 列不存在）
            try:
                note.tags = json.dumps(current_tags) if current_tags else None
                note.updated_at = datetime.utcnow()
                db.session.commit()
                return jsonify({
                    'message': 'Tag removed successfully',
                    'tags': current_tags
                }), 200
            except OperationalError as e:
                db.session.rollback()
                return jsonify({'error': f'无法保存标签，数据库可能缺少 tags 列: {e}'}), 500
        else:
            return jsonify({'error': 'Tag not found'}), 404

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/tags', methods=['GET'])
@require_auth
def get_all_tags():
    """获取用户所有笔记的标签

    增强健壮性：使用 safe_getattr 安全访问 note.tags，
    防止 tags 列不存在时导致整个 API 失败。
    """
    try:
        user_id = session['user_id']

        notes = StudyNote.query.filter_by(user_id=user_id).all()

        all_tags = set()
        for note in notes:
            # 使用安全方式访问 tags 字段（防止列不存在）
            tags_str = safe_getattr(note, 'tags', None)
            if tags_str:
                try:
                    tags = json.loads(tags_str)
                    if isinstance(tags, list):
                        all_tags.update(tags)
                except (json.JSONDecodeError, TypeError):
                    pass

        return jsonify({
            'tags': sorted(list(all_tags))
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/stats', methods=['GET'])
@require_auth
def get_notes_stats():
    """获取笔记统计

    增强健壮性：使用 safe_getattr 安全访问 tags/is_public/is_auto_generated，
    防止这些列不存在时导致统计功能完全不可用。
    """
    try:
        user_id = session['user_id']

        # 总笔记数（基础查询，不依赖特殊列）
        total_notes = StudyNote.query.filter_by(user_id=user_id).count()

        # 公开笔记数（安全访问 is_public 列）
        try:
            public_notes = StudyNote.query.filter_by(user_id=user_id, is_public=True).count()
        except OperationalError:
            public_notes = 0
            current_app.logger.warning("is_public 列不存在，公开笔记数默认为0")

        # 自动生成笔记数（安全访问 is_auto_generated 列）
        try:
            auto_generated = StudyNote.query.filter_by(user_id=user_id, is_auto_generated=True).count()
        except OperationalError:
            auto_generated = 0
            current_app.logger.warning("is_auto_generated 列不存在，自动生成笔记数默认为0")

        # 按课程分组统计（不依赖特殊列）
        notes_by_course = db.session.query(
            Course.id,
            Course.title,
            db.func.count(StudyNote.id).label('count')
        ).join(StudyNote).filter(
            StudyNote.user_id == user_id
        ).group_by(Course.id, Course.title).all()

        # 标签统计（安全访问 tags 列）
        all_notes = StudyNote.query.filter_by(user_id=user_id).all()
        tag_count = {}
        for note in all_notes:
            tags_str = safe_getattr(note, 'tags', None)
            if tags_str:
                try:
                    tags = json.loads(tags_str)
                    if isinstance(tags, list):
                        for tag in tags:
                            tag_count[tag] = tag_count.get(tag, 0) + 1
                except (json.JSONDecodeError, TypeError):
                    pass

        # 最近5条笔记（安全序列化）
        recent_notes = StudyNote.query.filter_by(user_id=user_id)\
            .order_by(StudyNote.updated_at.desc())\
            .limit(5).all()

        recent_notes_list = []
        for note in recent_notes:
            try:
                recent_notes_list.append(note.to_dict())
            except OperationalError as e:
                current_app.logger.warning(f"最近笔记 ID={note.id} 序列化失败: {e}")
                continue

        return jsonify({
            'stats': {
                'total_notes': total_notes,
                'public_notes': public_notes,
                'auto_generated': auto_generated,
                'by_course': [
                    {'course_id': c.id, 'course_title': c.title, 'count': c.count}
                    for c in notes_by_course
                ],
                'by_tag': tag_count
            },
            'recent_notes': recent_notes_list
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/upload-image', methods=['POST'])
@require_auth
def upload_note_image():
    """上传笔记图片"""
    try:
        user_id = session['user_id']
        
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_IMAGE_SIZE:
            return jsonify({'error': f'File too large. Maximum size is {MAX_IMAGE_SIZE // (1024*1024)}MB'}), 400
        
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        original_filename = secure_filename(file.filename)
        file_ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'jpg'
        unique_filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        compressed = compress_image(file)
        if compressed:
            with open(filepath, 'wb') as f:
                f.write(compressed.getvalue())
        else:
            file.save(filepath)
        
        image_url = f"/uploads/notes/{unique_filename}"
        
        return jsonify({
            'message': 'Image uploaded successfully',
            'url': image_url,
            'filename': unique_filename
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/<int:note_id>/summarize', methods=['POST'])
@require_auth
def summarize_note(note_id):
    """AI 生成笔记摘要"""
    try:
        user_id = session['user_id']
        
        note = StudyNote.query.get(note_id)
        
        if not note:
            return jsonify({'error': 'Note not found'}), 404
        
        if note.user_id != user_id:
            return jsonify({'error': 'Permission denied'}), 403
        
        course_title = note.course.title if note.course else None
        
        summary = spark_service.summarize_note(
            note_title=note.title,
            note_content=note.content,
            course_title=course_title
        )
        
        return jsonify({
            'message': 'Summary generated successfully',
            'summary': summary,
            'note_id': note_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/<int:note_id>/summarize/stream', methods=['POST'])
@require_auth
def summarize_note_stream(note_id):
    """AI 流式生成笔记摘要"""
    try:
        user_id = session['user_id']
        
        note = StudyNote.query.get(note_id)
        
        if not note:
            return jsonify({'error': 'Note not found'}), 404
        
        if note.user_id != user_id:
            return jsonify({'error': 'Permission denied'}), 403
        
        course_title = note.course.title if note.course else None
        
        def generate():
            try:
                for chunk in spark_service.summarize_note_stream(
                    note_title=note.title,
                    note_content=note.content,
                    course_title=course_title
                ):
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                
                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/organize', methods=['POST'])
@require_auth
def organize_notes():
    """AI 整理多篇笔记"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        note_ids = data.get('note_ids', [])
        
        if not note_ids:
            return jsonify({'error': 'note_ids is required'}), 400
        
        if len(note_ids) > 20:
            return jsonify({'error': 'Maximum 20 notes can be organized at once'}), 400
        
        notes = StudyNote.query.filter(
            StudyNote.id.in_(note_ids),
            StudyNote.user_id == user_id
        ).all()

        if not notes:
            return jsonify({'error': 'No valid notes found'}), 404

        notes_data = []
        for note in notes:
            # 安全读取标签（防止 tags 列不存在）
            tags_list = []
            tags_str = safe_getattr(note, 'tags', None)
            if tags_str:
                try:
                    tags_list = json.loads(tags_str)
                    if not isinstance(tags_list, list):
                        tags_list = []
                except (json.JSONDecodeError, TypeError):
                    tags_list = []

            notes_data.append({
                'id': note.id,
                'title': note.title,
                'content': note.content[:500] if note.content else '',
                'course_title': note.course.title if note.course else None,
                'tags': tags_list
            })

        organized = spark_service.organize_notes(notes_data)

        return jsonify({
            'message': 'Notes organized successfully',
            'organized_content': organized,
            'organized_count': len(notes)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/organize/stream', methods=['POST'])
@require_auth
def organize_notes_stream():
    """AI 流式整理多篇笔记

    增强健壮性：安全读取笔记的 tags 字段。
    """
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        note_ids = data.get('note_ids', [])
        
        if not note_ids:
            return jsonify({'error': 'note_ids is required'}), 400
        
        if len(note_ids) > 20:
            return jsonify({'error': 'Maximum 20 notes can be organized at once'}), 400
        
        notes = StudyNote.query.filter(
            StudyNote.id.in_(note_ids),
            StudyNote.user_id == user_id
        ).all()

        if not notes:
            return jsonify({'error': 'No valid notes found'}), 404

        notes_data = []
        for note in notes:
            # 安全读取标签（防止 tags 列不存在）
            tags_list = []
            tags_str = safe_getattr(note, 'tags', None)
            if tags_str:
                try:
                    tags_list = json.loads(tags_str)
                    if not isinstance(tags_list, list):
                        tags_list = []
                except (json.JSONDecodeError, TypeError):
                    tags_list = []

            notes_data.append({
                'id': note.id,
                'title': note.title,
                'content': note.content[:500] if note.content else '',
                'course_title': note.course.title if note.course else None,
                'tags': tags_list
            })
        
        def generate():
            try:
                for chunk in spark_service.organize_notes_stream(notes_data):
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                
                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/recommend-tags', methods=['POST'])
@require_auth
def recommend_tags():
    """AI 推荐标签"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        title = data.get('title', '')
        content = data.get('content', '')
        
        if not title and not content:
            return jsonify({'error': 'title or content is required'}), 400
        
        user_notes = StudyNote.query.filter_by(user_id=user_id).all()
        existing_tags = set()
        for note in user_notes:
            # 安全读取标签（防止 tags 列不存在）
            tags_str = safe_getattr(note, 'tags', None)
            if tags_str:
                try:
                    tags = json.loads(tags_str)
                    if isinstance(tags, list):
                        existing_tags.update(tags)
                except (json.JSONDecodeError, TypeError):
                    pass
        
        recommended = spark_service.recommend_tags(
            note_title=title,
            note_content=content,
            existing_tags=list(existing_tags)
        )
        
        recommended_tags = [tag.strip() for tag in recommended.split(',') if tag.strip()]
        
        return jsonify({
            'message': 'Tags recommended successfully',
            'recommended_tags': recommended_tags[:5],
            'existing_tags': list(existing_tags)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/weekly-report', methods=['POST'])
@require_auth
def generate_weekly_report():
    """生成周学习报告"""
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        
        week_start = data.get('week_start')
        week_end = data.get('week_end')
        
        if not week_start or not week_end:
            today = datetime.utcnow()
            week_end = today.strftime('%Y-%m-%d')
            week_start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
        
        start_date = datetime.strptime(week_start, '%Y-%m-%d')
        end_date = datetime.strptime(week_end, '%Y-%m-%d')
        
        notes = StudyNote.query.filter(
            StudyNote.user_id == user_id,
            StudyNote.created_at >= start_date,
            StudyNote.created_at <= end_date
        ).all()
        
        mistakes = MistakeRecord.query.filter(
            MistakeRecord.user_id == user_id,
            MistakeRecord.created_at >= start_date,
            MistakeRecord.created_at <= end_date
        ).all()
        
        notes_data = []
        for note in notes:
            notes_data.append({
                'id': note.id,
                'title': note.title,
                'course_title': note.course.title if note.course else None,
                'created_at': note.created_at.isoformat() if note.created_at else None
            })
        
        mistakes_data = []
        for m in mistakes:
            mistakes_data.append({
                'id': m.id,
                'question_content': m.question_content[:100] if m.question_content else '',
                'mistake_count': m.mistake_count,
                'course_title': m.course.title if m.course else None
            })
        
        report = spark_service.generate_weekly_report(
            notes=notes_data,
            mistakes=mistakes_data,
            week_start=week_start,
            week_end=week_end
        )
        
        return jsonify({
            'message': 'Weekly report generated successfully',
            'report': report,
            'notes_count': len(notes),
            'mistakes_count': len(mistakes),
            'week_start': week_start,
            'week_end': week_end
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@notes_bp.route('/notes/weekly-report/stream', methods=['POST'])
@require_auth
def generate_weekly_report_stream():
    """流式生成周学习报告"""
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        
        week_start = data.get('week_start')
        week_end = data.get('week_end')
        
        if not week_start or not week_end:
            today = datetime.utcnow()
            week_end = today.strftime('%Y-%m-%d')
            week_start = (today - timedelta(days=7)).strftime('%Y-%m-%d')
        
        start_date = datetime.strptime(week_start, '%Y-%m-%d')
        end_date = datetime.strptime(week_end, '%Y-%m-%d')
        
        notes = StudyNote.query.filter(
            StudyNote.user_id == user_id,
            StudyNote.created_at >= start_date,
            StudyNote.created_at <= end_date
        ).all()
        
        mistakes = MistakeRecord.query.filter(
            MistakeRecord.user_id == user_id,
            MistakeRecord.created_at >= start_date,
            MistakeRecord.created_at <= end_date
        ).all()
        
        notes_data = []
        for note in notes:
            notes_data.append({
                'id': note.id,
                'title': note.title,
                'course_title': note.course.title if note.course else None,
                'created_at': note.created_at.isoformat() if note.created_at else None
            })
        
        mistakes_data = []
        for m in mistakes:
            mistakes_data.append({
                'id': m.id,
                'question_content': m.question_content[:100] if m.question_content else '',
                'mistake_count': m.mistake_count,
                'course_title': m.course.title if m.course else None
            })
        
        def generate():
            try:
                for chunk in spark_service.generate_weekly_report_stream(
                    notes=notes_data,
                    mistakes=mistakes_data,
                    week_start=week_start,
                    week_end=week_end
                ):
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
                
                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
