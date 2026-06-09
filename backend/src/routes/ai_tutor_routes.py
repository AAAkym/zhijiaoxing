import json
import logging

from flask import Blueprint, Response, request, jsonify, session, stream_with_context
from src.utils.auth import require_auth
from src.models.user import db
from src.services.ai_tutor_service import ai_tutor_service
from src.utils.sse_utils import SSEStream, SSEHeaders

logger = logging.getLogger(__name__)

ai_tutor_bp = Blueprint('ai_tutor', __name__)


@ai_tutor_bp.route('/answer', methods=['POST'])
@require_auth
def answer_question():
    try:
        data = request.get_json()

        if not data or not data.get('question'):
            return jsonify({'error': 'Question is required'}), 400

        user_id = session['user_id']
        question = data['question']
        course_id = data.get('course_id')
        image_data = data.get('image_data')

        result = ai_tutor_service.answer_question(
            question=question,
            user_id=user_id,
            course_id=course_id,
            image_data=image_data,
            user_role=session.get('user_role'),
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error('answer_question failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/answer/stream', methods=['POST'])
@require_auth
def answer_question_stream():
    try:
        data = request.get_json()

        if not data or not data.get('question'):
            return jsonify({'error': 'Question is required'}), 400

        user_id = session['user_id']
        question = data['question']
        course_id = data.get('course_id')
        image_data = data.get('image_data')

        session_user_role = session.get('user_role')

        def generate():
            sse = SSEStream(retry=3000)
            try:
                yield sse.send_config()

                for chunk in ai_tutor_service.answer_question_stream(
                    question=question,
                    user_id=user_id,
                    course_id=course_id,
                    image_data=image_data,
                    user_role=session_user_role,
                ):
                    yield sse.send_message(chunk, event='message')

                yield sse.send_done()
            except Exception as e:
                logger.error('answer_question_stream error: %s', e, exc_info=True)
                db.session.rollback()
                yield sse.send_error(str(e))
                yield sse.send_done()

        return Response(
            stream_with_context(generate()),
            mimetype=SSEHeaders.CONTENT_TYPE,
            headers=SSEHeaders.get_headers(),
        )

    except Exception as e:
        logger.error('answer_question_stream failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/explain', methods=['POST'])
@require_auth
def explain_knowledge():
    try:
        data = request.get_json()

        if not data or not data.get('topic'):
            return jsonify({'error': 'Topic is required'}), 400

        user_id = session['user_id']
        topic = data['topic']
        course_id = data.get('course_id')
        mastery_level = data.get('mastery_level')

        result = ai_tutor_service.explain_knowledge(
            topic=topic,
            user_id=user_id,
            course_id=course_id,
            mastery_level=mastery_level,
            user_role=session.get('user_role'),
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error('explain_knowledge failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/explain/stream', methods=['POST'])
@require_auth
def explain_knowledge_stream():
    try:
        data = request.get_json()

        if not data or not data.get('topic'):
            return jsonify({'error': 'Topic is required'}), 400

        user_id = session['user_id']
        topic = data['topic']
        course_id = data.get('course_id')
        mastery_level = data.get('mastery_level')

        session_user_role = session.get('user_role')

        def generate():
            sse = SSEStream(retry=3000)
            try:
                yield sse.send_config()

                for chunk in ai_tutor_service.explain_knowledge_stream(
                    topic=topic,
                    user_id=user_id,
                    course_id=course_id,
                    mastery_level=mastery_level,
                    user_role=session_user_role,
                ):
                    yield sse.send_message(chunk, event='message')

                yield sse.send_done()
            except Exception as e:
                logger.error('explain_knowledge_stream error: %s', e, exc_info=True)
                db.session.rollback()
                yield sse.send_error(str(e))
                yield sse.send_done()

        return Response(
            stream_with_context(generate()),
            mimetype=SSEHeaders.CONTENT_TYPE,
            headers=SSEHeaders.get_headers(),
        )

    except Exception as e:
        logger.error('explain_knowledge_stream failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/resources', methods=['GET'])
@require_auth
def recommend_resources():
    try:
        topic = request.args.get('topic')
        if not topic:
            return jsonify({'error': 'Topic is required'}), 400

        user_id = session['user_id']
        course_id = request.args.get('course_id', type=int)

        result = ai_tutor_service.recommend_resources(
            topic=topic,
            user_id=user_id,
            course_id=course_id,
            user_role=session.get('user_role'),
        )

        return jsonify({'resources': result}), 200

    except Exception as e:
        logger.error('recommend_resources failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/learning-path', methods=['POST'])
@require_auth
def suggest_learning_path():
    try:
        data = request.get_json() or {}
        user_id = session['user_id']
        course_id = data.get('course_id')
        custom_goals = data.get('custom_goals')

        result = ai_tutor_service.suggest_learning_path(
            user_id=user_id,
            course_id=course_id,
            custom_goals=custom_goals,
            user_role=session.get('user_role'),
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error('suggest_learning_path failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/progress', methods=['GET'])
@require_auth
def get_learning_progress():
    try:
        user_id = session['user_id']

        result = ai_tutor_service.get_learning_progress(user_id=user_id)

        return jsonify(result), 200

    except Exception as e:
        logger.error('get_learning_progress failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/diagnosis', methods=['GET'])
@require_auth
def diagnose_knowledge_mastery():
    try:
        user_id = session['user_id']
        course_id = request.args.get('course_id', type=int)

        result = ai_tutor_service.diagnose_knowledge_mastery(
            user_id=user_id,
            course_id=course_id,
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error('diagnose_knowledge_mastery failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/diagnosis/report/stream', methods=['POST'])
@require_auth
def diagnosis_report_stream():
    try:
        data = request.get_json() or {}
        user_id = session['user_id']
        course_id = data.get('course_id')

        session_user_role = session.get('user_role')

        def generate():
            sse = SSEStream(retry=3000)
            try:
                yield sse.send_config()

                for chunk in ai_tutor_service.generate_diagnosis_report_stream(
                    user_id=user_id,
                    course_id=course_id,
                    user_role=session_user_role,
                ):
                    yield sse.send_message(chunk, event='message')

                yield sse.send_done()
            except Exception as e:
                logger.error('diagnosis_report_stream error: %s', e, exc_info=True)
                db.session.rollback()
                yield sse.send_error(str(e))
                yield sse.send_done()

        return Response(
            stream_with_context(generate()),
            mimetype=SSEHeaders.CONTENT_TYPE,
            headers=SSEHeaders.get_headers(),
        )

    except Exception as e:
        logger.error('diagnosis_report_stream failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/diagnosis/comparison', methods=['GET'])
@require_auth
def diagnosis_comparison():
    try:
        user_id = session['user_id']
        course_id = request.args.get('course_id', type=int)

        result = ai_tutor_service.get_diagnosis_comparison(
            user_id=user_id,
            course_id=course_id,
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error('diagnosis_comparison failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/feedback', methods=['POST'])
@require_auth
def submit_feedback():
    try:
        data = request.get_json()

        if not data or not data.get('interaction_id') or data.get('rating') is None:
            return jsonify({'error': 'interaction_id and rating are required'}), 400

        user_id = session['user_id']
        interaction_id = data['interaction_id']
        rating = data['rating']
        comment = data.get('comment')

        result = ai_tutor_service.submit_feedback(
            user_id=user_id,
            interaction_id=interaction_id,
            rating=rating,
            comment=comment,
        )

        return jsonify(result), 200

    except Exception as e:
        logger.error('submit_feedback failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500


@ai_tutor_bp.route('/diagnosis/export', methods=['POST'])
@require_auth
def export_diagnosis_report():
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        course_id = data.get('course_id')
        report_content = data.get('report_content')

        pdf_bytes = ai_tutor_service.export_diagnosis_report_pdf(
            user_id=user_id,
            course_id=course_id,
            report_content=report_content,
        )

        from datetime import datetime
        filename = f"diagnosis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Type': 'application/pdf',
                'Content-Disposition': f'attachment; filename="{filename}"',
                'Content-Length': len(pdf_bytes),
            }
        )

    except Exception as e:
        logger.error('export_diagnosis_report failed: %s', e, exc_info=True)
        return jsonify({'error': str(e)}), 500
