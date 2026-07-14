"""PPT生成与管理路由。

提供端点：
- POST   /ppt/generate          生成PPT（同步等待结果）
- GET    /ppt/list/<course_id>  列出课程的PPT
- GET    /ppt/<content_id>      获取PPT详情（含预览URL）
- GET    /ppt/<content_id>/download  下载.pptx文件
- PUT    /ppt/<content_id>/regenerate 编辑主题后重新生成
- DELETE /ppt/<content_id>      删除PPT记录与文件

存储策略（B2）：复用 TeachingContent 表，content_type='ppt'，
content 字段存JSON元数据 {query, sid, file_name, original_ppt_url, outline}。

静态文件通过 /uploads/ppt/<filename> 路由提供（main.py 中注册）。
"""
import json
import logging
import os
from datetime import datetime
from urllib.parse import quote

from flask import Blueprint, request, jsonify, session, current_app, send_from_directory, abort
from werkzeug.utils import secure_filename

from src.utils.auth import require_auth, require_role
from src.models.user import db
from src.models.course import TeachingContent, Course
from src.services.xfyun_ppt_service import xfyun_ppt_service, is_configured as ppt_is_configured

logger = logging.getLogger(__name__)

ppt_bp = Blueprint('ppt', __name__)

# PPT文件保存目录（与 uploads/videos 平级）
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PPT_UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'ppt')


def _get_public_base_url() -> str:
    """获取后端对外可访问基础URL，用于拼接PPT文件公网下载链接。"""
    return current_app.config.get('PUBLIC_BASE_URL', 'http://localhost:5000').rstrip('/')


def _build_ppt_meta(query: str, sid: str, file_name: str,
                    original_ppt_url: str, outline: str = '') -> str:
    """构建存储到 TeachingContent.content 的PPT元数据JSON字符串。"""
    return json.dumps({
        'query': query,
        'sid': sid,
        'file_name': file_name,
        'original_ppt_url': original_ppt_url,
        'outline': outline or '',
        'generated_at': datetime.utcnow().isoformat(),
    }, ensure_ascii=False)


def _parse_ppt_meta(content_str: str) -> dict:
    """解析 TeachingContent.content 中的PPT元数据。"""
    if not content_str:
        return {}
    try:
        return json.loads(content_str)
    except (json.JSONDecodeError, TypeError):
        return {}


def _build_preview_url(file_name: str, original_ppt_url: str = '') -> str:
    """构建Office Online预览URL。

    优先使用讯飞返回的公网.pptx下载链接（original_ppt_url），
    因为该链接在全球可访问，Office Online服务器能直接获取。
    若 original_ppt_url 缺失或过期，回退到本地 /uploads/ppt/ 路由
    （仅公网部署时可被Office Online访问）。
    """
    # 优先使用讯飞公网URL（localhost开发环境也能预览）
    if original_ppt_url and not original_ppt_url.startswith('http://localhost'):
        file_url = original_ppt_url
    else:
        base = _get_public_base_url()
        file_url = f"{base}/uploads/ppt/{file_name}"
    # Office Online嵌入预览（src参数需URL编码）
    return f"https://view.officeapps.live.com/op/embed.aspx?src={quote(file_url, safe=':/?&=')}"


def _serialize_ppt_content(tc: TeachingContent, include_preview: bool = True) -> dict:
    """将TeachingContent(PPT类型)序列化为前端响应。"""
    meta = _parse_ppt_meta(tc.content)
    result = {
        'id': tc.id,
        'course_id': tc.course_id,
        'title': tc.title,
        'content_type': tc.content_type,
        'created_at': tc.created_at.isoformat() if tc.created_at else None,
        'updated_at': tc.updated_at.isoformat() if tc.updated_at else None,
        'query': meta.get('query', ''),
        'sid': meta.get('sid', ''),
        'file_name': meta.get('file_name', ''),
        'outline': meta.get('outline', ''),
        'original_ppt_url': meta.get('original_ppt_url', ''),
        'generated_at': meta.get('generated_at', ''),
    }
    if include_preview and result['file_name']:
        result['preview_url'] = _build_preview_url(result['file_name'], result.get('original_ppt_url', ''))
        result['download_url'] = f"/api/ppt/{tc.id}/download"
    return result


# ------------------------------------------------------------------ #
#  生成PPT
# ------------------------------------------------------------------ #
@ppt_bp.route('/ppt/generate', methods=['POST'])
@require_auth
def generate_ppt():
    """生成PPT。

    请求体:
        - course_id: int     课程ID（必需）
        - title: str         PPT标题（必需）
        - query: str         PPT主题描述（必需，200-500字为佳）
        - template_id: str   讯飞模板ID（可选）
        - video_id: int      关联视频ID（可选）
    """
    data = request.get_json(silent=True) or {}
    course_id = data.get('course_id')
    title = data.get('title')
    query = data.get('query')

    if not course_id or not title or not query:
        return jsonify({'error': '缺少必需参数: course_id / title / query'}), 400

    # 校验课程存在
    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': f'课程不存在: {course_id}'}), 404

    if not ppt_is_configured():
        return jsonify({'error': '讯飞PPT凭证未配置，请联系管理员设置 XFYUN_PPT_APP_ID / XFYUN_PPT_API_SECRET'}), 503

    user_id = session.get('user_id')
    user_role = session.get('user_role')
    # 仅教师和管理员可生成PPT
    if user_role not in ('teacher', 'admin'):
        return jsonify({'error': '仅教师可生成PPT'}), 403

    try:
        # 调用讯飞PPT服务生成
        result = xfyun_ppt_service.generate(
            query=query,
            save_dir=PPT_UPLOAD_FOLDER,
            template_id=data.get('template_id'),
        )

        # 存储到 TeachingContent（content_type='ppt'）
        meta = _build_ppt_meta(
            query=query,
            sid=result['sid'],
            file_name=result['file_name'],
            original_ppt_url=result['ppt_url'],
            outline=result.get('outline', ''),
        )
        tc = TeachingContent(
            course_id=course_id,
            video_id=data.get('video_id'),
            title=title,
            content=meta,
            generated_by_llm=True,
            content_type='ppt',
        )
        db.session.add(tc)
        db.session.commit()

        logger.info("PPT生成成功: course=%s title=%s file=%s user=%s",
                    course_id, title, result['file_name'], user_id)
        return jsonify({
            'message': 'PPT生成成功',
            'ppt': _serialize_ppt_content(tc),
        })

    except Exception as e:
        db.session.rollback()
        logger.error("PPT生成失败: %s", e, exc_info=True)
        return jsonify({'error': f'PPT生成失败: {str(e)}'}), 500


# ------------------------------------------------------------------ #
#  列出课程PPT
# ------------------------------------------------------------------ #
@ppt_bp.route('/ppt/list/<int:course_id>', methods=['GET'])
@require_auth
def list_ppt(course_id):
    """列出指定课程的所有PPT。"""
    try:
        items = TeachingContent.query.filter_by(
            course_id=course_id, content_type='ppt'
        ).order_by(TeachingContent.created_at.desc()).all()
        return jsonify({
            'course_id': course_id,
            'ppts': [_serialize_ppt_content(tc, include_preview=True) for tc in items],
            'total': len(items),
        })
    except Exception as e:
        logger.error("查询PPT列表失败: %s", e, exc_info=True)
        return jsonify({'error': f'查询失败: {str(e)}'}), 500


# ------------------------------------------------------------------ #
#  获取PPT详情（含预览URL）
# ------------------------------------------------------------------ #
@ppt_bp.route('/ppt/<int:content_id>', methods=['GET'])
@require_auth
def get_ppt(content_id):
    """获取单个PPT详情，含Office Online预览URL。"""
    tc = TeachingContent.query.get(content_id)
    if not tc or tc.content_type != 'ppt':
        return jsonify({'error': 'PPT不存在'}), 404
    return jsonify({'ppt': _serialize_ppt_content(tc, include_preview=True)})


# ------------------------------------------------------------------ #
#  下载.pptx文件
# ------------------------------------------------------------------ #
@ppt_bp.route('/ppt/<int:content_id>/download', methods=['GET'])
@require_auth
def download_ppt(content_id):
    """下载PPT的.pptx源文件。"""
    tc = TeachingContent.query.get(content_id)
    if not tc or tc.content_type != 'ppt':
        return jsonify({'error': 'PPT不存在'}), 404

    meta = _parse_ppt_meta(tc.content)
    file_name = meta.get('file_name')
    if not file_name:
        return jsonify({'error': 'PPT文件信息缺失'}), 404

    safe_name = secure_filename(file_name)
    file_path = os.path.join(PPT_UPLOAD_FOLDER, safe_name)
    if not os.path.exists(file_path):
        return jsonify({'error': 'PPT文件不存在于服务器'}), 404

    return send_from_directory(
        PPT_UPLOAD_FOLDER, safe_name,
        as_attachment=True,
        download_name=f"{tc.title}.pptx" if tc.title else safe_name,
    )


# ------------------------------------------------------------------ #
#  编辑主题后重新生成
# ------------------------------------------------------------------ #
@ppt_bp.route('/ppt/<int:content_id>/regenerate', methods=['PUT'])
@require_auth
@require_role(('teacher', 'admin'))
def regenerate_ppt(content_id):
    """编辑PPT主题描述后重新生成。

    请求体:
        - query: str  新的PPT主题描述（必需）
        - title: str  新标题（可选，不传则保留原标题）
    """
    tc = TeachingContent.query.get(content_id)
    if not tc or tc.content_type != 'ppt':
        return jsonify({'error': 'PPT不存在'}), 404

    data = request.get_json(silent=True) or {}
    new_query = data.get('query')
    if not new_query:
        return jsonify({'error': '缺少新的主题描述 query'}), 400

    if not ppt_is_configured():
        return jsonify({'error': '讯飞PPT凭证未配置'}), 503

    try:
        result = xfyun_ppt_service.generate(
            query=new_query,
            save_dir=PPT_UPLOAD_FOLDER,
        )

        # 删除旧文件（可选，保留历史也可）
        old_meta = _parse_ppt_meta(tc.content)
        old_file = old_meta.get('file_name')
        if old_file:
            old_path = os.path.join(PPT_UPLOAD_FOLDER, secure_filename(old_file))
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    logger.warning("删除旧PPT文件失败: %s", old_path)

        # 更新记录
        if data.get('title'):
            tc.title = data['title']
        tc.content = _build_ppt_meta(
            query=new_query,
            sid=result['sid'],
            file_name=result['file_name'],
            original_ppt_url=result['ppt_url'],
            outline=result.get('outline', ''),
        )
        tc.updated_at = datetime.utcnow()
        db.session.commit()

        logger.info("PPT重新生成成功: id=%s title=%s", content_id, tc.title)
        return jsonify({
            'message': 'PPT重新生成成功',
            'ppt': _serialize_ppt_content(tc, include_preview=True),
        })

    except Exception as e:
        db.session.rollback()
        logger.error("PPT重新生成失败: %s", e, exc_info=True)
        return jsonify({'error': f'重新生成失败: {str(e)}'}), 500


# ------------------------------------------------------------------ #
#  删除PPT
# ------------------------------------------------------------------ #
@ppt_bp.route('/ppt/<int:content_id>', methods=['DELETE'])
@require_auth
@require_role(('teacher', 'admin'))
def delete_ppt(content_id):
    """删除PPT记录与对应文件。"""
    tc = TeachingContent.query.get(content_id)
    if not tc or tc.content_type != 'ppt':
        return jsonify({'error': 'PPT不存在'}), 404

    try:
        meta = _parse_ppt_meta(tc.content)
        file_name = meta.get('file_name')
        if file_name:
            file_path = os.path.join(PPT_UPLOAD_FOLDER, secure_filename(file_name))
            if os.path.exists(file_path):
                os.remove(file_path)

        db.session.delete(tc)
        db.session.commit()
        return jsonify({'message': 'PPT已删除'})
    except Exception as e:
        db.session.rollback()
        logger.error("删除PPT失败: %s", e, exc_info=True)
        return jsonify({'error': f'删除失败: {str(e)}'}), 500


# ------------------------------------------------------------------ #
#  凭证状态查询（供前端判断功能可用性）
# ------------------------------------------------------------------ #
@ppt_bp.route('/ppt/status', methods=['GET'])
@require_auth
def ppt_status():
    """查询PPT功能是否可用（凭证是否配置）。"""
    return jsonify({'available': ppt_is_configured()})
