from flask import Blueprint, request, jsonify, session
from src.utils.auth import require_auth
from src.models.user import db, User
from datetime import datetime
import base64
import os
import uuid

student_settings_bp = Blueprint('student_settings', __name__)

UPLOAD_FOLDER = 'uploads/avatars'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def ensure_upload_folder():
    upload_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), UPLOAD_FOLDER)
    if not os.path.exists(upload_path):
        os.makedirs(upload_path)
    return upload_path

@student_settings_bp.route('/student/settings', methods=['GET'])
@require_auth
def get_student_settings():
    try:
        user_id = session['user_id']
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'settings': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'real_name': user.real_name,
                'avatar': user.avatar,
                'learning_goal': user.learning_goal,
                'ai_style': user.ai_style,
                'ai_style_name': User.AI_STYLES.get(user.ai_style, user.ai_style)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@student_settings_bp.route('/student/settings/profile', methods=['PUT'])
@require_auth
def update_profile():
    try:
        user_id = session['user_id']
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'real_name' in data:
            real_name = data['real_name']
            if real_name and len(real_name) > 100:
                return jsonify({'error': 'Real name must be less than 100 characters'}), 400
            user.real_name = real_name
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@student_settings_bp.route('/student/settings/avatar', methods=['POST'])
@require_auth
def upload_avatar():
    try:
        user_id = session['user_id']
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data or 'avatar' not in data:
            return jsonify({'error': 'No avatar data provided'}), 400
        
        avatar_data = data['avatar']
        
        if avatar_data.startswith('data:image'):
            header, avatar_data = avatar_data.split(',', 1)
            file_ext = header.split(';')[0].split('/')[1]
            if file_ext not in ALLOWED_EXTENSIONS:
                return jsonify({'error': f'File type not allowed. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        else:
            file_ext = 'png'
        
        try:
            image_data = base64.b64decode(avatar_data)
        except Exception:
            return jsonify({'error': 'Invalid image data'}), 400
        
        if len(image_data) > 5 * 1024 * 1024:
            return jsonify({'error': 'Image size must be less than 5MB'}), 400
        
        upload_path = ensure_upload_folder()
        filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{file_ext}"
        filepath = os.path.join(upload_path, filename)
        
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        avatar_url = f"/uploads/avatars/{filename}"
        user.avatar = avatar_url
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Avatar uploaded successfully',
            'avatar': avatar_url,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@student_settings_bp.route('/student/settings/learning-goal', methods=['PUT'])
@require_auth
def update_learning_goal():
    try:
        user_id = session['user_id']
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'learning_goal' in data:
            learning_goal = data['learning_goal']
            if learning_goal and len(learning_goal) > 1000:
                return jsonify({'error': 'Learning goal must be less than 1000 characters'}), 400
            user.learning_goal = learning_goal
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Learning goal updated successfully',
            'learning_goal': user.learning_goal,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@student_settings_bp.route('/student/settings/ai-style', methods=['PUT'])
@require_auth
def update_ai_style():
    try:
        user_id = session['user_id']
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'ai_style' not in data:
            return jsonify({'error': 'AI style is required'}), 400
        
        ai_style = data['ai_style']
        if ai_style not in User.AI_STYLES:
            return jsonify({'error': f'Invalid AI style. Valid options: {", ".join(User.AI_STYLES.keys())}'}), 400
        
        user.ai_style = ai_style
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'AI style updated successfully',
            'ai_style': user.ai_style,
            'ai_style_name': User.AI_STYLES.get(user.ai_style),
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@student_settings_bp.route('/student/settings', methods=['PUT'])
@require_auth
def update_all_settings():
    try:
        user_id = session['user_id']
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'real_name' in data:
            if data['real_name'] and len(data['real_name']) > 100:
                return jsonify({'error': 'Real name must be less than 100 characters'}), 400
            user.real_name = data['real_name']
        
        if 'learning_goal' in data:
            if data['learning_goal'] and len(data['learning_goal']) > 1000:
                return jsonify({'error': 'Learning goal must be less than 1000 characters'}), 400
            user.learning_goal = data['learning_goal']
        
        if 'ai_style' in data:
            if data['ai_style'] not in User.AI_STYLES:
                return jsonify({'error': f'Invalid AI style'}), 400
            user.ai_style = data['ai_style']
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Settings updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
