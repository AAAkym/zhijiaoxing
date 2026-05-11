from flask import Blueprint, request, jsonify, session, Response
from src.utils.auth import require_auth
from src.models.user import db, User
from src.models.course import PracticeEvaluation, Assessment, VideoLesson, TeachingContent, Course
from src.services.spark_service import spark_service
from src.services.knowledge_base import knowledge_base_service
from src.models.student_profile import StudentProfile
import json

ai_bp = Blueprint('ai', __name__)


def get_ai_style_prompt(style):
    """根据AI风格返回对应的系统提示"""
    style_prompts = {
        'academic': """你是一位专业的AI学习助手，风格严谨学术。请根据学生的问题，结合教学内容进行解答。
解答要求：
1. 准确、专业、严谨
2. 提供详细的理论依据和知识点解释
3. 引用相关的学术概念
4. 逻辑清晰，结构完整
5. 鼓励学生深入思考和探索

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。""",
        'humorous': """你是一位风趣幽默的AI学习助手。请用轻松有趣的方式回答学生的问题。
解答要求：
1. 用生动有趣的比喻和例子解释概念
2. 适当加入一些幽默元素，但不要过度
3. 让学习变得愉快和轻松
4. 在幽默中传递准确的知识
5. 保持友好和鼓励的态度

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。""",
        'encouraging': """你是一位充满鼓励的AI学习助手。请用积极向上的方式引导学生学习。
解答要求：
1. 给予充分的肯定和鼓励
2. 循序渐进地引导学生思考
3. 肯定学生的每一点进步
4. 用积极的语言激发学习兴趣
5. 帮助学生建立学习信心
6. 提供具体的学习建议和方法

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。""",
        'concise': """你是一位简洁直接的AI学习助手。请用简洁明了的方式回答问题。
解答要求：
1. 直接回答问题，不啰嗦
2. 重点突出，条理清晰
3. 用最少的话传递最核心的信息
4. 避免冗长的解释
5. 如果需要详细说明，可以分点列出

如果问题超出你的知识范围，请诚实说明并建议学生咨询老师。"""
    }
    return style_prompts.get(style, style_prompts['academic'])


@ai_bp.route('/ai_chat', methods=['POST'])
@require_auth
def ai_chat():
    """AI学习助手对话"""
    try:
        data = request.get_json()
        
        if not data.get('question'):
            return jsonify({'error': 'Question is required'}), 400
        
        user_id = session['user_id']
        user = User.query.get(user_id)
        ai_style = user.ai_style if user else 'academic'
        
        context = data.get('context', '')
        topic = data.get('topic', '')
        knowledge_base = knowledge_base_service.get_knowledge_by_topic(topic) if topic else ""
        
        answer = spark_service.ai_tutor_chat(
            question=data['question'],
            context=context,
            knowledge_base=knowledge_base,
            ai_style=ai_style
        )
        
        return jsonify({
            'answer': answer
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/ai_chat_stream', methods=['POST'])
@require_auth
def ai_chat_stream():
    """AI学习助手流式对话"""
    try:
        data = request.get_json()
        
        if not data.get('question'):
            return jsonify({'error': 'Question is required'}), 400
        
        user_id = session['user_id']
        user = User.query.get(user_id)
        ai_style = user.ai_style if user else 'academic'
        
        context = data.get('context', '')
        topic = data.get('topic', '')
        knowledge_base = knowledge_base_service.get_knowledge_by_topic(topic) if topic else ""
        
        system_prompt = get_ai_style_prompt(ai_style)
        
        user_prompt = f"""学生问题：{data['question']}

{f"上下文：{context}" if context else ""}
{f"参考资料：{knowledge_base}" if knowledge_base else ""}

请回答学生的问题。"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        def generate():
            for chunk in spark_service.chat_stream(messages):
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
        
        return Response(generate(), mimetype='text/plain')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/evaluate_practice', methods=['POST'])
@require_auth
def evaluate_practice():
    """练习评测 - 支持两种模式:
    1. assessment_id + user_answer: 基于已有考核的评测
    2. questions + score: 直接提交练习结果（无需assessment_id）
    """
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        if 'questions' in data and 'score' in data:
            questions = data['questions']
            score = data.get('score', 0)
            
            questions_json = questions if isinstance(questions, str) else json.dumps(questions, ensure_ascii=False)
            
            evaluation_result = None
            if questions and len(questions) > 0:
                try:
                    evaluation_result = spark_service.evaluate_practice(
                        question=questions_json,
                        user_answer=json.dumps(data.get('answers', {}), ensure_ascii=False),
                        correct_answer=""
                    )
                except Exception as e:
                    evaluation_result = f"评测完成，得分: {score}%"
            
            return jsonify({
                'message': 'Practice evaluated successfully',
                'evaluation': {
                    'score': score,
                    'evaluation_result': evaluation_result,
                    'question_count': len(questions) if isinstance(questions, list) else 1
                }
            }), 200
        
        if 'assessment_id' in data:
            required_fields = ['assessment_id', 'user_answer']
            for field in required_fields:
                if field not in data or not data[field]:
                    return jsonify({'error': f'{field} is required'}), 400
            
            assessment = Assessment.query.get(data['assessment_id'])
            if not assessment:
                return jsonify({'error': 'Assessment not found'}), 404
            
            evaluation_result = spark_service.evaluate_practice(
                question=assessment.questions,
                user_answer=data['user_answer'],
                correct_answer=assessment.answers or ""
            )
            
            score = data.get('score', 0)
            
            practice_eval = PracticeEvaluation(
                user_id=user_id,
                assessment_id=data['assessment_id'],
                user_answer=data['user_answer'],
                evaluation_result=evaluation_result,
                score=score
            )
            
            db.session.add(practice_eval)
            db.session.commit()
            
            return jsonify({
                'message': 'Practice evaluated successfully',
                'evaluation': practice_eval.to_dict()
            }), 201
        
        return jsonify({'error': 'Either (questions + score) or (assessment_id + user_answer) is required'}), 400
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/practice_history', methods=['GET'])
@require_auth
def get_practice_history():
    """获取练习历史"""
    try:
        user_id = session['user_id']
        
        # 获取查询参数
        course_id = request.args.get('course_id', type=int)
        
        query = PracticeEvaluation.query.filter_by(user_id=user_id)
        
        if course_id:
            # 通过assessment关联过滤课程
            query = query.join(Assessment).filter(Assessment.course_id == course_id)
        
        evaluations = query.order_by(PracticeEvaluation.created_at.desc()).all()
        
        return jsonify({
            'evaluations': [eval.to_dict() for eval in evaluations]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/knowledge_search', methods=['POST'])
@require_auth
def search_knowledge():
    """搜索知识库"""
    try:
        data = request.get_json()
        
        if not data.get('query'):
            return jsonify({'error': 'Query is required'}), 400
        
        results = knowledge_base_service.search_knowledge(data['query'])
        
        return jsonify({
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/video_assistant', methods=['POST'])
@require_auth
def video_assistant_chat():
    try:
        data = request.get_json()
        if not data.get('question'):
            return jsonify({'error': 'Question is required'}), 400

        user_id = session['user_id']
        user = User.query.get(user_id)
        ai_style = user.ai_style if user else 'academic'

        video_id = data.get('video_id')
        course_id = data.get('course_id')
        video_timestamp = data.get('video_timestamp')

        context_parts = []

        if course_id:
            course = Course.query.get(course_id)
            if course:
                context_parts.append(f"当前课程：{course.title}")
                if course.description:
                    context_parts.append(f"课程描述：{course.description}")

        if video_id:
            video = VideoLesson.query.get(video_id)
            if video:
                context_parts.append(f"当前视频：{video.title}")
                if video.description:
                    context_parts.append(f"视频描述：{video.description}")
                if video_timestamp is not None:
                    minutes = int(video_timestamp) // 60
                    seconds = int(video_timestamp) % 60
                    context_parts.append(f"视频播放位置：{minutes}分{seconds}秒")

            contents = TeachingContent.query.filter_by(video_id=video_id).all()
            if contents:
                for tc in contents[:3]:
                    content_text = tc.content[:500] if tc.content else ""
                    context_parts.append(f"视频讲义《{tc.title}》：{content_text}")

        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if profile:
            profile_info = []
            if profile.cognitive_style and profile.cognitive_style != 'mixed':
                profile_info.append(f"认知风格：{profile.cognitive_style}")
            if profile.learning_pace and profile.learning_pace != 'moderate':
                profile_info.append(f"学习节奏：{profile.learning_pace}")
            if profile.goal_orientation and profile.goal_orientation != 'exam':
                profile_info.append(f"学习目标：{profile.goal_orientation}")
            if profile_info:
                context_parts.append(f"学生画像：{', '.join(profile_info)}")

        topic = data.get('topic', '')
        knowledge_base = knowledge_base_service.get_knowledge_by_topic(topic) if topic else ""
        context = "\n".join(context_parts)

        answer = spark_service.ai_tutor_chat(
            question=data['question'],
            context=context,
            knowledge_base=knowledge_base,
            ai_style=ai_style,
        )

        return jsonify({'answer': answer}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@ai_bp.route('/video_assistant_stream', methods=['POST'])
@require_auth
def video_assistant_stream():
    try:
        data = request.get_json()
        if not data.get('question'):
            return jsonify({'error': 'Question is required'}), 400

        user_id = session['user_id']
        user = User.query.get(user_id)
        ai_style = user.ai_style if user else 'academic'

        video_id = data.get('video_id')
        course_id = data.get('course_id')
        video_timestamp = data.get('video_timestamp')

        context_parts = []

        if course_id:
            course = Course.query.get(course_id)
            if course:
                context_parts.append(f"当前课程：{course.title}")

        if video_id:
            video = VideoLesson.query.get(video_id)
            if video:
                context_parts.append(f"当前视频：{video.title}")
                if video_timestamp is not None:
                    minutes = int(video_timestamp) // 60
                    seconds = int(video_timestamp) % 60
                    context_parts.append(f"视频播放位置：{minutes}分{seconds}秒")

            contents = TeachingContent.query.filter_by(video_id=video_id).all()
            if contents:
                for tc in contents[:3]:
                    content_text = tc.content[:500] if tc.content else ""
                    context_parts.append(f"视频讲义《{tc.title}》：{content_text}")

        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if profile:
            profile_info = []
            if profile.cognitive_style and profile.cognitive_style != 'mixed':
                profile_info.append(f"认知风格：{profile.cognitive_style}")
            if profile.learning_pace and profile.learning_pace != 'moderate':
                profile_info.append(f"学习节奏：{profile.learning_pace}")
            if profile_info:
                context_parts.append(f"学生画像：{', '.join(profile_info)}")

        topic = data.get('topic', '')
        knowledge_base = knowledge_base_service.get_knowledge_by_topic(topic) if topic else ""
        context = "\n".join(context_parts)

        system_prompt = get_ai_style_prompt(ai_style)
        user_prompt = f"""学生问题：{data['question']}

{f"上下文：{context}" if context else ""}
{f"参考资料：{knowledge_base}" if knowledge_base else ""}

请回答学生的问题。如果问题与当前视频内容相关，请结合视频内容进行解答。"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        def generate():
            for chunk in spark_service.chat_stream(messages):
                yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"

        return Response(generate(), mimetype='text/plain')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

