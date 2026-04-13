from flask import Blueprint, request, jsonify, session
from src.models.user import db
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, MistakeRecord
from sqlalchemy import func
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

student_bp = Blueprint('student', __name__)


def require_auth(f):
    """认证装饰器"""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@student_bp.route('/my_courses', methods=['GET'])
@require_auth
def get_my_courses():
    """获取我的课程"""
    try:
        user_id = session['user_id']
        
        # 获取学生的学习进度记录
        progress_records = LearningProgress.query.filter_by(user_id=user_id).all()
        
        # 如果没有学习进度记录，返回所有可用课程
        if not progress_records:
            courses = Course.query.all()
            course_list = []
            for course in courses:
                course_dict = course.to_dict()
                course_dict['progress_percentage'] = 0.0
                course_dict['last_accessed'] = None
                course_list.append(course_dict)
        else:
            course_list = []
            for progress in progress_records:
                course_dict = progress.course.to_dict()
                course_dict['progress_percentage'] = progress.progress_percentage
                course_dict['last_accessed'] = progress.last_accessed.isoformat() if progress.last_accessed else None
                course_list.append(course_dict)
        
        return jsonify({
            'courses': course_list
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@student_bp.route('/enroll_course', methods=['POST'])
@require_auth
def enroll_course():
    """注册课程"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        if not data.get('course_id'):
            return jsonify({'error': 'Course ID is required'}), 400
        
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        
        # 检查是否已经注册
        existing_progress = LearningProgress.query.filter_by(
            user_id=user_id,
            course_id=data['course_id']
        ).first()
        
        if existing_progress:
            return jsonify({'error': 'Already enrolled in this course'}), 400
        
        # 创建学习进度记录
        progress = LearningProgress(
            user_id=user_id,
            course_id=data['course_id'],
            progress_percentage=0.0
        )
        
        db.session.add(progress)
        db.session.commit()
        
        return jsonify({
            'message': 'Enrolled successfully',
            'progress': progress.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@student_bp.route('/update_progress', methods=['POST'])
@require_auth
def update_progress():
    """更新学习进度"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        required_fields = ['course_id', 'progress_percentage']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'{field} is required'}), 400
        
        # 验证进度百分比
        if not 0 <= data['progress_percentage'] <= 100:
            return jsonify({'error': 'Progress percentage must be between 0 and 100'}), 400
        
        # 查找或创建学习进度记录
        progress = LearningProgress.query.filter_by(
            user_id=user_id,
            course_id=data['course_id']
        ).first()
        
        if not progress:
            # 如果不存在，创建新记录
            progress = LearningProgress(
                user_id=user_id,
                course_id=data['course_id'],
                progress_percentage=data['progress_percentage']
            )
            db.session.add(progress)
        else:
            # 更新现有记录
            progress.progress_percentage = data['progress_percentage']
            progress.last_accessed = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Progress updated successfully',
            'progress': progress.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@student_bp.route('/learning_stats', methods=['GET'])
@require_auth
def get_learning_stats():
    """获取学习统计"""
    try:
        user_id = session['user_id']
        
        # 基础统计
        enrolled_courses = LearningProgress.query.filter_by(user_id=user_id).count()
        completed_courses = LearningProgress.query.filter_by(
            user_id=user_id
        ).filter(LearningProgress.progress_percentage >= 100).count()
        
        # 平均进度
        avg_progress = db.session.query(
            func.avg(LearningProgress.progress_percentage)
        ).filter_by(user_id=user_id).scalar() or 0
        
        # 练习统计
        total_practices = PracticeEvaluation.query.filter_by(user_id=user_id).count()
        avg_score = db.session.query(
            func.avg(PracticeEvaluation.score)
        ).filter_by(user_id=user_id).scalar() or 0
        
        # 最近的学习活动
        recent_progress = LearningProgress.query.filter_by(
            user_id=user_id
        ).order_by(LearningProgress.last_accessed.desc()).limit(5).all()
        
        return jsonify({
            'stats': {
                'enrolled_courses': enrolled_courses,
                'completed_courses': completed_courses,
                'avg_progress': round(avg_progress, 2),
                'total_practices': total_practices,
                'avg_score': round(avg_score, 2)
            },
            'recent_activity': [progress.to_dict() for progress in recent_progress]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@student_bp.route('/practice_stats', methods=['GET'])
@require_auth
def get_practice_stats():
    """获取练习统计"""
    try:
        user_id = session['user_id']
        course_id = request.args.get('course_id', type=int)
        
        query = PracticeEvaluation.query.filter_by(user_id=user_id)
        
        if course_id:
            # 通过assessment关联过滤课程
            query = query.join(Assessment).filter(Assessment.course_id == course_id)
        
        # 获取练习记录
        evaluations = query.order_by(PracticeEvaluation.created_at.desc()).all()
        
        # 统计数据
        total_practices = len(evaluations)
        if total_practices > 0:
            scores = [eval.score for eval in evaluations if eval.score is not None]
            avg_score = sum(scores) / len(scores) if scores else 0
            max_score = max(scores) if scores else 0
            min_score = min(scores) if scores else 0
        else:
            avg_score = max_score = min_score = 0
        
        # 最近的练习记录
        recent_practices = evaluations[:10]  # 最近10次练习
        
        return jsonify({
            'practice_stats': {
                'total_practices': total_practices,
                'avg_score': round(avg_score, 2),
                'max_score': max_score,
                'min_score': min_score
            },
            'recent_practices': [practice.to_dict() for practice in recent_practices]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@student_bp.route('/learning_progress_chart', methods=['GET'])
@require_auth
def get_learning_progress_chart():
    """获取学习进度图表数据"""
    try:
        user_id = session['user_id']
        
        # 获取所有课程的学习进度
        progress_records = LearningProgress.query.filter_by(user_id=user_id).all()
        
        course_names = []
        progress_values = []
        
        for progress in progress_records:
            course_names.append(progress.course.title)
            progress_values.append(progress.progress_percentage)
        
        return jsonify({
            'chart_data': {
                'courses': course_names,
                'progress': progress_values
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@student_bp.route('/sync_practice_data', methods=['POST'])
@require_auth
def sync_practice_data():
    """同步练习数据 - 支持离线数据同步，增强版含错题实时同步"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data or 'submissions' not in data:
            return jsonify({'error': 'Submissions data is required'}), 400
        
        submissions = data['submissions']
        synced_ids = []
        failed_submissions = []
        extracted_mistake_count = 0
        extracted_mistakes_details = []
        
        for submission in submissions:
            try:
                if not submission.get('assessment_id') or not submission.get('answers'):
                    failed_submissions.append({
                        'submission': submission,
                        'error': 'Missing required fields'
                    })
                    continue
                
                assessment = Assessment.query.get(submission['assessment_id'])
                if not assessment:
                    failed_submissions.append({
                        'submission': submission,
                        'error': 'Assessment not found'
                    })
                    continue
                
                existing_eval = PracticeEvaluation.query.filter_by(
                    user_id=user_id,
                    assessment_id=submission['assessment_id']
                ).first()
                
                submission_score = submission.get('score', 0)
                
                if existing_eval:
                    if submission_score > existing_eval.score:
                        existing_eval.user_answer = submission['answers']
                        existing_eval.score = submission_score
                        existing_eval.evaluation_result = submission.get('evaluation_result', '')
                        existing_eval.created_at = datetime.utcnow()
                    synced_ids.append(existing_eval.id)
                else:
                    practice_eval = PracticeEvaluation(
                        user_id=user_id,
                        assessment_id=submission['assessment_id'],
                        user_answer=submission['answers'],
                        evaluation_result=submission.get('evaluation_result', ''),
                        score=submission_score
                    )
                    db.session.add(practice_eval)
                    db.session.flush()
                    synced_ids.append(practice_eval.id)
                
                if submission_score < 100:
                    try:
                        mistake_result = _extract_mistakes_from_submission(
                            user_id, 
                            assessment, 
                            submission['answers'],
                            submission_score
                        )
                        current_mistake_count = len(mistake_result['mistakes'])
                        extracted_mistake_count += current_mistake_count
                        
                        if current_mistake_count > 0 or len(mistake_result['errors']) > 0:
                            extracted_mistakes_details.append({
                                'assessment_id': submission['assessment_id'],
                                'score': submission_score,
                                'mistake_count': current_mistake_count,
                                'skipped_count': len(mistake_result['skipped_questions']),
                                'error_count': len(mistake_result['errors']),
                                'mistakes': mistake_result['mistakes']
                            })
                        
                        logger.info(f'[sync_practice_data] 错题提取完成: assessment={submission["assessment_id"]}, 提取{current_mistake_count}道错题')
                    except Exception as e:
                        logger.error(f'[sync_practice_data] 错题提取异常: assessment={submission["assessment_id"]}, error={str(e)}')
                        extracted_mistakes_details.append({
                            'assessment_id': submission['assessment_id'],
                            'error': str(e),
                            'mistake_count': 0
                        })
                else:
                    logger.info(f'[sync_practice_data] 满分提交，跳过错题提取: assessment={submission["assessment_id"]}, score={submission_score}')
                
            except Exception as e:
                failed_submissions.append({
                    'submission': submission,
                    'error': str(e)
                })
        
        db.session.commit()
        logger.info(f'[sync_practice_data] 同步完成: 用户={user_id}, 成功{len(synced_ids)}条, 失败{len(failed_submissions)}条, 提取错题{extracted_mistake_count}道')
        
        total_practices = PracticeEvaluation.query.filter_by(user_id=user_id).count()
        avg_score = db.session.query(
            func.avg(PracticeEvaluation.score)
        ).filter_by(user_id=user_id).scalar() or 0
        
        response_data = {
            'message': 'Sync completed',
            'synced_count': len(synced_ids),
            'failed_count': len(failed_submissions),
            'failed_submissions': failed_submissions,
            'extracted_mistakes': extracted_mistake_count,
            'extracted_mistake_count': extracted_mistake_count,
            'updated_stats': {
                'total_practices': total_practices,
                'avg_score': round(avg_score, 2)
            }
        }
        
        if extracted_mistakes_details:
            response_data['extracted_mistakes_details'] = extracted_mistakes_details
        
        return jsonify(response_data), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f'[sync_practice_data] 同步失败: {str(e)}', exc_info=True)
        return jsonify({'error': str(e)}), 500


def _extract_mistakes_from_submission(user_id, assessment, user_answer, score):
    """从提交中提取错题 - 增强版，支持多种数据格式和容错处理"""
    result = {
        'mistakes': [],
        'skipped_questions': [],
        'filtered_count': 0,
        'errors': []
    }
    
    try:
        questions = json.loads(assessment.questions) if assessment.questions else []
        answers = json.loads(assessment.answers) if assessment.answers else []
        user_answers = json.loads(user_answer) if user_answer else []
    except Exception as e:
        logger.error(f'[错题提取] 解析题目/答案JSON失败: {str(e)}')
        result['errors'].append({'step': 'parse_json', 'error': str(e)})
        return result
    
    if not isinstance(user_answers, list):
        user_answers = [user_answers]
    
    for i, question in enumerate(questions):
        try:
            if i >= len(user_answers):
                result['skipped_questions'].append({
                    'index': i,
                    'reason': '用户答案索引超出范围'
                })
                continue
            
            user_ans = user_answers[i]
            correct_ans = answers[i] if i < len(answers) else None
            
            is_correct = False
            if isinstance(user_ans, (int, float)) and isinstance(correct_ans, (int, float)):
                is_correct = user_ans == correct_ans
            elif isinstance(user_ans, str) and isinstance(correct_ans, str):
                is_correct = user_ans.strip().lower() == correct_ans.strip().lower()
            elif user_ans is not None and correct_ans is not None:
                is_correct = str(user_ans) == str(correct_ans)
            
            if not is_correct:
                question_content = _extract_question_content(question)
                
                existing_mistake = MistakeRecord.query.filter_by(
                    user_id=user_id,
                    assessment_id=assessment.id,
                    question_index=i
                ).first()
                
                if existing_mistake:
                    existing_mistake.mistake_count += 1
                    existing_mistake.last_mistake_at = datetime.utcnow()
                    existing_mistake.user_answer = str(user_ans)
                    
                    # 优化：智能状态回退逻辑，避免过度降级
                    # 如果已掌握的题再次出错，降级为"复习中"而非直接回到"未掌握"
                    if existing_mistake.mastery_status == 'mastered':
                        existing_mistake.mastery_status = 'reviewing'
                        logger.info(f'[错题提取] 已掌握错题再次出错，降级为复习中: 用户={user_id}, 题目索引={i}')
                    elif existing_mistake.mastery_status == 'reviewing':
                        existing_mistake.mastery_status = 'unmastered'
                        logger.info(f'[错题提取] 复习中的错题再次出错，降级为未掌握: 用户={user_id}, 题目索引={i}')
                    # 如果已经是 unmastered 状态，保持不变
                    
                    result['mistakes'].append({
                        'id': existing_mistake.id,
                        'question_index': i,
                        'action': 'updated',
                        'mistake_count': existing_mistake.mistake_count,
                        'mastery_status': existing_mistake.mastery_status
                    })
                    logger.info(f'[错题提取] 更新已有错题: 用户={user_id}, 题目索引={i}, 累计错误次数={existing_mistake.mistake_count}, 当前状态={existing_mistake.mastery_status}')
                else:
                    knowledge_tags = _extract_knowledge_tags(question)
                    
                    new_mistake = MistakeRecord(
                        user_id=user_id,
                        course_id=assessment.course_id,
                        assessment_id=assessment.id,
                        question_index=i,
                        question_content=question_content,
                        user_answer=str(user_ans),
                        correct_answer=str(correct_ans) if correct_ans else '',
                        mistake_count=1,
                        last_mistake_at=datetime.utcnow(),
                        mastery_status='unmastered',
                        knowledge_tags=json.dumps(knowledge_tags, ensure_ascii=False) if knowledge_tags else None
                    )
                    db.session.add(new_mistake)
                    result['mistakes'].append({
                        'question_index': i,
                        'action': 'created',
                        'content_preview': question_content[:50] + '...' if len(question_content) > 50 else question_content
                    })
                    logger.info(f'[错题提取] 创建新错题: 用户={user_id}, 题目索引={i}, 内容预览={question_content[:30]}...')
            else:
                result['filtered_count'] += 1
                
        except Exception as e:
            error_info = {
                'index': i,
                'error': str(e),
                'error_type': type(e).__name__
            }
            result['errors'].append(error_info)
            result['skipped_questions'].append({
                'index': i,
                'reason': f'处理异常: {str(e)}'
            })
            logger.error(f'[错题提取] 处理第{i}题时出错: {str(e)}', exc_info=True)
    
    logger.info(f'[错题提取] 提取完成: 成功{len(result["mistakes"])}道, 过滤{result["filtered_count"]}道正确题, 跳过{len(result["skipped_questions"])}道, 错误{len(result["errors"])}道')
    return result


def _extract_question_content(question):
    """提取题目内容 - 兼容多种字段格式"""
    if isinstance(question, dict):
        for field in ['content', 'question', 'text', 'title', 'stem', 'body']:
            if field in question and question[field]:
                return str(question[field])
        return str(question)
    return str(question)


def _extract_knowledge_tags(question):
    """提取知识点标签 - 兼容数组和字符串格式"""
    if not isinstance(question, dict):
        return []
    
    tags = question.get('knowledge_tags', question.get('tags', []))
    
    if isinstance(tags, list):
        return tags
    elif isinstance(tags, str):
        try:
            parsed = json.loads(tags)
            return parsed if isinstance(parsed, list) else [t.strip() for t in tags.split(',') if t.strip()]
        except (json.JSONDecodeError, ValueError):
            return [t.strip() for t in tags.split(',') if t.strip()]
    
    return []


@student_bp.route('/dashboard_summary', methods=['GET'])
@require_auth
def get_dashboard_summary():
    """获取学生仪表盘汇总数据 - 用于实时同步"""
    try:
        user_id = session['user_id']
        
        enrolled_courses = LearningProgress.query.filter_by(user_id=user_id).count()
        
        completed_courses = LearningProgress.query.filter_by(
            user_id=user_id,
            progress_percentage=100
        ).count()
        
        avg_progress = db.session.query(
            func.avg(LearningProgress.progress_percentage)
        ).filter_by(user_id=user_id).scalar() or 0
        
        total_practices = PracticeEvaluation.query.filter_by(user_id=user_id).count()
        
        avg_score = db.session.query(
            func.avg(PracticeEvaluation.score)
        ).filter_by(user_id=user_id).scalar() or 0
        
        max_score = db.session.query(
            func.max(PracticeEvaluation.score)
        ).filter_by(user_id=user_id).scalar() or 0
        
        recent_practices = PracticeEvaluation.query.filter_by(user_id=user_id)\
            .order_by(PracticeEvaluation.created_at.desc())\
            .limit(5).all()
        
        recent_progress = LearningProgress.query.filter_by(user_id=user_id)\
            .order_by(LearningProgress.last_accessed.desc())\
            .limit(5).all()
        
        return jsonify({
            'stats': {
                'enrolled_courses': enrolled_courses,
                'completed_courses': completed_courses,
                'avg_progress': round(avg_progress, 2),
                'total_practices': total_practices,
                'avg_score': round(avg_score, 2),
                'max_score': max_score
            },
            'recent_practices': [p.to_dict() for p in recent_practices],
            'recent_progress': [p.to_dict() for p in recent_progress],
            'last_updated': datetime.utcnow().isoformat()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@student_bp.route('/validate_practice_data', methods=['POST'])
@require_auth
def validate_practice_data():
    """验证练习数据完整性"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        validation_results = {
            'is_valid': True,
            'errors': [],
            'warnings': []
        }
        
        if 'assessment_id' in data:
            assessment = Assessment.query.get(data['assessment_id'])
            if not assessment:
                validation_results['is_valid'] = False
                validation_results['errors'].append('Assessment not found')
        
        if 'answers' in data:
            answers = data['answers']
            if isinstance(answers, str):
                try:
                    import json
                    answers = json.loads(answers)
                except:
                    validation_results['is_valid'] = False
                    validation_results['errors'].append('Invalid answers format')
            
            if isinstance(answers, list):
                for i, answer in enumerate(answers):
                    if answer is not None and not isinstance(answer, (int, float)):
                        validation_results['warnings'].append(f'Answer {i} has invalid type')
        
        if 'score' in data:
            score = data['score']
            if not isinstance(score, (int, float)) or score < 0 or score > 100:
                validation_results['warnings'].append('Score should be between 0 and 100')
        
        return jsonify(validation_results), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'is_valid': False}), 500

