import json
import random
import logging # 修复：统一导入logging模块，避免重复导入
from flask import Blueprint, request, jsonify, session, Response, current_app
from src.models.user import db, User
from src.models.course import MistakeRecord, PracticeEvaluation, Assessment, Course, StudyNote
from src.services.spark_service import spark_service
from src.services.knowledge_base import knowledge_base_service
from sqlalchemy import func, or_
from datetime import datetime

# 修复：配置日志记录器
logger = logging.getLogger(__name__)

mistake_book_bp = Blueprint('mistake_book', __name__)


def require_auth(f):
    """认证装饰器"""
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@mistake_book_bp.route('/mistakes', methods=['GET'])
@require_auth
def get_mistakes():
    """获取错题列表（支持分页、按课程/状态筛选）"""
    try:
        user_id = session['user_id']
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        course_id = request.args.get('course_id', type=int)
        mastery_status = request.args.get('mastery_status')
        keyword = request.args.get('keyword', '').strip()
        
        query = MistakeRecord.query.filter_by(user_id=user_id)
        
        if course_id:
            query = query.filter_by(course_id=course_id)
        
        if mastery_status:
            valid_statuses = ['unmastered', 'reviewing', 'mastered']
            if mastery_status in valid_statuses:
                query = query.filter_by(mastery_status=mastery_status)
        
        if keyword:
            query = query.filter(
                or_(
                    MistakeRecord.question_content.contains(keyword),
                    MistakeRecord.knowledge_tags.contains(keyword)
                )
            )
        
        query = query.order_by(MistakeRecord.last_mistake_at.desc())
        
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'mistakes': [m.to_dict() for m in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'total_pages': pagination.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/<int:mistake_id>', methods=['GET'])
@require_auth
def get_mistake_detail(mistake_id):
    """获取错题详情"""
    try:
        user_id = session['user_id']
        
        mistake = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        
        if not mistake:
            return jsonify({'error': 'Mistake record not found'}), 404
        
        mistake_dict = mistake.to_dict()
        
        if mistake.note_id:
            note = StudyNote.query.get(mistake.note_id)
            if note:
                mistake_dict['note'] = note.to_dict()
        
        if mistake.assessment_id:
            assessment = Assessment.query.get(mistake.assessment_id)
            if assessment and assessment.questions:
                try:
                    questions = json.loads(assessment.questions) if assessment.questions else []
                    # 修复：增加边界检查，避免索引越界
                    if mistake.question_index is not None and 0 <= mistake.question_index < len(questions):
                        mistake_dict['original_question'] = questions[mistake.question_index]
                    else:
                        # 修复：记录无效的题目索引
                        import logging
                        logging.warning(f"无效的题目索引: question_index={mistake.question_index}, questions_count={len(questions)}")
                except json.JSONDecodeError as e:
                    # 修复：使用具体异常类型
                    import logging
                    logging.error(f"解析题目JSON失败: {str(e)}")
                except Exception as e:
                    # 修复：捕获其他可能的异常
                    import logging
                    logging.error(f"获取原始题目失败: {str(e)}")
        
        return jsonify({'mistake': mistake_dict}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/<int:mistake_id>/status', methods=['PUT'])
@require_auth
def update_mistake_status(mistake_id):
    """更新掌握状态"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data or 'mastery_status' not in data:
            return jsonify({'error': 'mastery_status is required'}), 400
        
        valid_statuses = ['unmastered', 'reviewing', 'mastered']
        new_status = data['mastery_status']
        
        if new_status not in valid_statuses:
            return jsonify({'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400
        
        mistake = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        
        if not mistake:
            return jsonify({'error': 'Mistake record not found'}), 404
        
        mistake.mastery_status = new_status
        mistake.updated_at = datetime.utcnow()
        
        if new_status == 'mastered':
            mistake.note_id = data.get('note_id')
        
        db.session.commit()
        
        return jsonify({
            'message': 'Status updated successfully',
            'mistake': mistake.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/extract', methods=['POST'])
@require_auth
def extract_mistakes():
    """从练习记录中提取错题"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data or 'practice_evaluation_id' not in data:
            return jsonify({'error': 'practice_evaluation_id is required'}), 400
        
        practice_eval = PracticeEvaluation.query.filter_by(
            id=data['practice_evaluation_id'],
            user_id=user_id
        ).first()
        
        if not practice_eval:
            return jsonify({'error': 'Practice evaluation not found'}), 404
        
        assessment = Assessment.query.get(practice_eval.assessment_id)
        if not assessment:
            return jsonify({'error': 'Assessment not found'}), 404
        
        try:
            questions = json.loads(assessment.questions) if assessment.questions else []
            answers = json.loads(assessment.answers) if assessment.answers else []
            user_answers = json.loads(practice_eval.user_answer) if practice_eval.user_answer else []
        except json.JSONDecodeError as e:
            # 修复：使用具体异常类型，提供更详细的错误信息
            return jsonify({'error': f'Failed to parse questions or answers: Invalid JSON format - {str(e)}'}), 400
        except Exception as e:
            # 修复：捕获其他可能的异常
            return jsonify({'error': f'Failed to parse questions or answers: {str(e)}'}), 400
        
        if not isinstance(user_answers, list):
            user_answers = [user_answers]
        
        extracted_mistakes = []
        
        for i, question in enumerate(questions):
            if i >= len(user_answers):
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
                question_content = question.get('content', question.get('question', str(question))) if isinstance(question, dict) else str(question)
                
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
                    elif existing_mistake.mastery_status == 'reviewing':
                        existing_mistake.mastery_status = 'unmastered'
                    # 如果已经是 unmastered 状态，保持不变
                    
                    extracted_mistakes.append(existing_mistake)
                else:
                    knowledge_tags = []
                    if isinstance(question, dict):
                        knowledge_tags = question.get('knowledge_tags', question.get('tags', []))
                    
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
                        knowledge_tags=json.dumps(knowledge_tags) if knowledge_tags else None
                    )
                    db.session.add(new_mistake)
                    extracted_mistakes.append(new_mistake)
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully extracted {len(extracted_mistakes)} mistake(s)',
            'extracted_count': len(extracted_mistakes),
            'mistakes': [m.to_dict() for m in extracted_mistakes]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/stats', methods=['GET'])
@require_auth
def get_mistake_stats():
    """获取错题统计数据"""
    try:
        user_id = session['user_id']
        course_id = request.args.get('course_id', type=int)
        
        query = MistakeRecord.query.filter_by(user_id=user_id)
        if course_id:
            query = query.filter_by(course_id=course_id)
        
        total_mistakes = query.count()
        
        status_counts = db.session.query(
            MistakeRecord.mastery_status,
            func.count(MistakeRecord.id)
        ).filter_by(user_id=user_id)
        
        if course_id:
            status_counts = status_counts.filter_by(course_id=course_id)
        
        status_counts = status_counts.group_by(MistakeRecord.mastery_status).all()
        
        status_stats = {
            'unmastered': 0,
            'reviewing': 0,
            'mastered': 0
        }
        for status, count in status_counts:
            if status in status_stats:
                status_stats[status] = count
        
        course_stats = db.session.query(
            Course.id,
            Course.title,
            func.count(MistakeRecord.id).label('count')
        ).join(MistakeRecord).filter(
            MistakeRecord.user_id == user_id
        ).group_by(Course.id, Course.title).all()
        
        knowledge_point_stats = {}
        all_mistakes = query.all()
        for mistake in all_mistakes:
            if mistake.knowledge_tags:
                try:
                    tags = json.loads(mistake.knowledge_tags)
                    # 修复：确保解析后的结果是列表
                    if isinstance(tags, list):
                        for tag in tags:
                            if tag:  # 修复：过滤空标签
                                knowledge_point_stats[tag] = knowledge_point_stats.get(tag, 0) + 1
                    elif isinstance(tags, str):
                        # 修复：处理标签是字符串的情况（兼容旧数据）
                        knowledge_point_stats[tags] = knowledge_point_stats.get(tags, 0) + 1
                except json.JSONDecodeError as e:
                    # 修复：使用具体异常类型，记录错误但不中断处理
                    import logging
                    logging.warning(f"解析知识点标签JSON失败 (mistake_id={mistake.id}): {str(e)}")
                except Exception as e:
                    import logging
                    logging.warning(f"处理知识点标签失败 (mistake_id={mistake.id}): {str(e)}")
        
        recent_mistakes = query.order_by(MistakeRecord.created_at.desc()).limit(5).all()
        
        # 修复：计算今日待复习的错题数量（未掌握和复习中状态）
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_review_count = db.session.query(func.count(MistakeRecord.id)).filter(
            MistakeRecord.user_id == user_id,
            MistakeRecord.mastery_status.in_(['unmastered', 'reviewing'])
        ).scalar() or 0
        
        return jsonify({
            'stats': {
                'total_mistakes': total_mistakes,
                'by_status': status_stats,
                'by_course': [
                    {'course_id': c.id, 'course_title': c.title, 'count': c.count}
                    for c in course_stats
                ],
                'by_knowledge_point': knowledge_point_stats,
                'today_review': today_review_count  # 新增：今日待复习错题数
            },
            'recent_mistakes': [m.to_dict() for m in recent_mistakes]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def extract_mistakes_from_practice(user_id, practice_eval, assessment):
    """从练习记录中提取错题的辅助函数"""
    try:
        questions = json.loads(assessment.questions) if assessment.questions else []
        answers = json.loads(assessment.answers) if assessment.answers else []
        user_answers = json.loads(practice_eval.user_answer) if practice_eval.user_answer else []
    except:
        return []
    
    if not isinstance(user_answers, list):
        user_answers = [user_answers]
    
    extracted_mistakes = []
    
    for i, question in enumerate(questions):
        if i >= len(user_answers):
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
            question_content = question.get('content', question.get('question', str(question))) if isinstance(question, dict) else str(question)
            
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
                if existing_mistake.mastery_status == 'mastered':
                    existing_mistake.mastery_status = 'reviewing'
                elif existing_mistake.mastery_status == 'reviewing':
                    existing_mistake.mastery_status = 'unmastered'
                
                extracted_mistakes.append(existing_mistake)
            else:
                knowledge_tags = []
                if isinstance(question, dict):
                    knowledge_tags = question.get('knowledge_tags', question.get('tags', []))
                
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
                    knowledge_tags=json.dumps(knowledge_tags) if knowledge_tags else None
                )
                db.session.add(new_mistake)
                extracted_mistakes.append(new_mistake)
    
    return extracted_mistakes


@mistake_book_bp.route('/mistakes/review/start', methods=['POST'])
@require_auth
def start_review():
    """开始复习，根据算法抽取错题"""
    try:
        user_id = session['user_id']
        data = request.get_json() or {}
        
        course_id = data.get('course_id')
        mastery_status = data.get('mastery_status')
        limit = data.get('limit', 10)
        
        if limit < 1:
            limit = 10
        elif limit > 50:
            limit = 50
        
        query = MistakeRecord.query.filter_by(user_id=user_id)
        
        if course_id:
            query = query.filter_by(course_id=course_id)
        
        if mastery_status:
            valid_statuses = ['unmastered', 'reviewing', 'mastered']
            if mastery_status in valid_statuses:
                query = query.filter_by(mastery_status=mastery_status)
        
        all_mistakes = query.all()
        
        if not all_mistakes:
            return jsonify({
                'message': 'No mistakes available for review',
                'questions': [],
                'total': 0
            }), 200
        
        weighted_mistakes = []
        for mistake in all_mistakes:
            weight = 1.0
            
            # 根据掌握状态设置基础权重
            if mistake.mastery_status == 'reviewing':
                weight = 3.0  # 复习中状态权重最高，优先复习
            elif mistake.mastery_status == 'unmastered':
                weight = 2.0  # 未掌握次之
            elif mistake.mastery_status == 'mastered':
                weight = 0.3  # 已掌握偶尔出现（巩固记忆）
            
            # 根据错误次数调整权重：错误越多，越需要复习
            weight *= (1 + mistake.mistake_count * 0.2)
            
            # 根据时间间隔调整权重：距离上次错误时间越长，越可能被选中（遗忘曲线）
            hours_since_mistake = 0
            if mistake.last_mistake_at:
                delta = datetime.utcnow() - mistake.last_mistake_at
                hours_since_mistake = delta.total_seconds() / 3600
            
            if hours_since_mistake > 24:
                # 超过1天未复习，权重增加（最多增加2倍）
                weight *= (1 + min(hours_since_mistake / 24, 2))
            
            weighted_mistakes.append((mistake, weight))
        
        import logging
        logging.debug(f"加权完成: 共 {len(weighted_mistakes)} 道错题，请求抽取 {limit} 道")
        
        total_weight = sum(w for _, w in weighted_mistakes)
        selected_mistakes = []
        
        # 优化选择算法
        if len(weighted_mistakes) <= limit:
            # 如果错题数量不超过限制，全部返回
            selected_mistakes = [m for m, _ in weighted_mistakes]
            logging.info(f"错题数量({len(weighted_mistakes)}) <= 限制({limit})，返回全部")
        else:
            # 使用加权随机抽样算法
            remaining = list(weighted_mistakes)
            current_total_weight = total_weight
            max_iterations = limit * 10  # 修复：防止无限循环的安全限制
            iteration_count = 0
            
            while len(selected_mistakes) < limit and remaining and iteration_count < max_iterations:
                r = random.uniform(0, current_total_weight)
                cumulative = 0
                found = False
                
                for i, (mistake, weight) in enumerate(remaining):
                    cumulative += weight
                    if r <= cumulative:
                        selected_mistakes.append(mistake)
                        current_total_weight -= weight
                        remaining.pop(i)
                        found = True
                        break
                
                if not found:
                    # 修复：如果浮点精度问题导致没选中，随机选一个
                    import random as rnd
                    idx = rnd.randint(0, len(remaining) - 1)
                    mistake, weight = remaining[idx]
                    selected_mistakes.append(mistake)
                    current_total_weight -= weight
                    remaining.pop(idx)
                
                iteration_count += 1
            
            if iteration_count >= max_iterations:
                logging.warning(f"加权随机抽样达到最大迭代次数({max_iterations})，可能存在算法问题")
        
        review_questions = []
        for mistake in selected_mistakes:
            question_data = {
                'mistake_id': mistake.id,
                'question_content': mistake.question_content,
                'knowledge_tags': json.loads(mistake.knowledge_tags) if mistake.knowledge_tags else [],
                'course_title': mistake.course.title if mistake.course else None,
                'mistake_count': mistake.mistake_count,
                'mastery_status': mistake.mastery_status,
                # 修复：增加正确答案字段，前端需要此字段进行答案校验
                'correct_answer': mistake.correct_answer,
                # 修复：增加用户上次错误答案，用于复习时参考
                'user_answer': mistake.user_answer
            }
            
            if mistake.assessment_id:
                assessment = Assessment.query.get(mistake.assessment_id)
                if assessment and assessment.questions:
                    try:
                        questions = json.loads(assessment.questions)
                        if mistake.question_index is not None and mistake.question_index < len(questions):
                            original_q = questions[mistake.question_index]
                            if isinstance(original_q, dict):
                                question_data['question_type'] = original_q.get('type', 'unknown')
                                question_data['options'] = original_q.get('options', [])
                    except:
                        pass
            
            review_questions.append(question_data)
        
        session['review_session'] = {
            'mistake_ids': [m.id for m in selected_mistakes],
            'started_at': datetime.utcnow().isoformat(),
            'total': len(selected_mistakes)
        }
        
        return jsonify({
            'message': 'Review session started',
            'questions': review_questions,
            'total': len(review_questions),
            'session_id': datetime.utcnow().strftime('%Y%m%d%H%M%S')
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/review/submit', methods=['POST'])
@require_auth
def submit_review():
    """提交复习结果，根据作答情况更新掌握状态"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        if not data or 'results' not in data:
            return jsonify({'error': 'results is required'}), 400
        
        results = data['results']
        
        # 修复：增加输入数据验证
        if not isinstance(results, list) or len(results) == 0:
            return jsonify({'error': 'results must be a non-empty array'}), 400
        
        import logging
        logging.info(f"用户 {user_id} 提交复习结果，共 {len(results)} 道题")
        
        updated_mistakes = []
        correct_count = 0
        incorrect_count = 0
        status_transitions = {} # 修复：记录状态转换，便于调试
        
        for result in results:
            mistake_id = result.get('mistake_id')
            user_answer = result.get('user_answer')
            is_correct = result.get('is_correct')
            
            if not mistake_id:
                logging.warning("复习结果中缺少 mistake_id，跳过")
                continue
            
            # 修复：验证 is_correct 是布尔值
            if is_correct is None:
                logging.warning(f"错题 {mistake_id} 缺少 is_correct 字段，默认为错误")
                is_correct = False
            
            mistake = MistakeRecord.query.filter_by(
                id=mistake_id,
                user_id=user_id
            ).first()
            
            if not mistake:
                logging.warning(f"未找到错题记录: mistake_id={mistake_id}, user_id={user_id}")
                continue
            
            old_status = mistake.mastery_status
            
            if is_correct:
                correct_count += 1
                # 状态流转逻辑：答对时升级状态
                if mistake.mastery_status == 'unmastered':
                    mistake.mastery_status = 'reviewing'
                    status_transitions[mistake_id] = f"{old_status} -> reviewing (答对)"
                elif mistake.mastery_status == 'reviewing':
                    mistake.mastery_status = 'mastered'
                    status_transitions[mistake_id] = f"{old_status} -> mastered (答对)"
                else:
                    status_transitions[mistake_id] = f"{old_status} -> {old_status} (已掌握，保持)"
            else:
                incorrect_count += 1
                mistake.mistake_count += 1
                mistake.last_mistake_at = datetime.utcnow()
                # 状态流转逻辑：答错时降级状态
                if mistake.mastery_status == 'mastered':
                    mistake.mastery_status = 'reviewing'
                    status_transitions[mistake_id] = f"{old_status} -> reviewing (答错)"
                elif mistake.mastery_status == 'reviewing':
                    mistake.mastery_status = 'unmastered'
                    status_transitions[mistake_id] = f"{old_status} -> unmastered (答错)"
                else:
                    status_transitions[mistake_id] = f"{old_status} -> {old_status} (仍未掌握，保持)"
            
            # 更新用户答案
            if user_answer is not None:
                mistake.user_answer = str(user_answer)
            mistake.updated_at = datetime.utcnow()
            
            updated_mistakes.append(mistake.to_dict())
        
        # 修复：检查是否有有效的更新操作
        if len(updated_mistakes) == 0:
            logging.warning(f"用户 {user_id} 的复习结果没有更新任何错题")
            return jsonify({
                'message': 'No valid mistakes were updated',
                'summary': {'total': 0, 'correct': 0, 'incorrect': 0, 'accuracy': 0},
                'updated_mistakes': [],
                'still_need_review': [],
                'mastered_in_session': []
            }), 200
        
        db.session.commit()
        
        total = correct_count + incorrect_count
        accuracy = (correct_count / total * 100) if total > 0 else 0
        
        still_need_review = [
            m for m in updated_mistakes
            if m['mastery_status'] in ['unmastered', 'reviewing']
        ]
        
        mastered_in_session = [
            m for m in updated_mistakes
            if m['mastery_status'] == 'mastered'
        ]
        
        # 修复：记录复习统计信息
        logging.info(f"复习完成: 总计={total}, 正确={correct_count}, 错误={incorrect_count}, 正确率={accuracy:.2f}%")
        logging.debug(f"状态转换详情: {status_transitions}")
        
        if 'review_session' in session:
            session.pop('review_session')
        
        return jsonify({
            'message': 'Review submitted successfully',
            'summary': {
                'total': total,
                'correct': correct_count,
                'incorrect': incorrect_count,
                'accuracy': round(accuracy, 2)
            },
            'updated_mistakes': updated_mistakes,
            'still_need_review': still_need_review,
            'mastered_in_session': mastered_in_session
        }), 200
        
    except Exception as e:
        db.session.rollback()
        import logging
        logging.error(f"提交复习失败: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/review/history', methods=['GET'])
@require_auth
def get_review_history():
    """获取复习历史记录"""
    try:
        user_id = session['user_id']
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        from src.models.course import LearningProgress
        
        progress_records = LearningProgress.query.filter_by(
            user_id=user_id
        ).filter(
            LearningProgress.activity_type == 'mistake_review'
        ).order_by(
            LearningProgress.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'history': [p.to_dict() for p in progress_records.items],
            'total': progress_records.total,
            'page': page,
            'per_page': per_page,
            'total_pages': progress_records.pages
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/<int:mistake_id>/analyze', methods=['POST'])
@require_auth
def analyze_mistake(mistake_id):
    """AI 分析单个错题"""
    try:
        user_id = session['user_id']
        
        mistake = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()
        
        if not mistake:
            return jsonify({'error': 'Mistake record not found'}), 404
        
        knowledge_tags = []
        if mistake.knowledge_tags:
            try:
                knowledge_tags = json.loads(mistake.knowledge_tags)
            except:
                knowledge_tags = []

        course_title = mistake.course.title if mistake.course else None

        # 修复：从关联的assessment中获取原始题目的解析信息，提升AI分析准确性
        explanation = None
        try:
            if mistake.assessment and mistake.question_index is not None:
                questions = json.loads(mistake.assessment.questions)
                if isinstance(questions, list) and len(questions) > mistake.question_index:
                    original_question = questions[mistake.question_index]
                    # 支持多种字段名：explanation, analysis, 解析
                    explanation = original_question.get('explanation') or \
                                 original_question.get('analysis') or \
                                 original_question.get('解析')
        except Exception as e:
            # 修复：获取解析失败不应中断主流程，记录日志即可
            import logging
            logging.warning(f"获取题目解析失败（不影响AI分析）: {str(e)}")

        analysis = spark_service.analyze_mistake(
            question_content=mistake.question_content,
            user_answer=mistake.user_answer,
            correct_answer=mistake.correct_answer,
            knowledge_tags=knowledge_tags,
            course_title=course_title,
            explanation=explanation  # 修复：传递题目解析参数
        )
        
        mistake.ai_analysis = analysis
        mistake.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Analysis completed successfully',
            'analysis': analysis,
            'mistake': mistake.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/<int:mistake_id>/analyze/stream', methods=['POST'])
@require_auth
def analyze_mistake_stream(mistake_id):
    """AI 流式分析单个错题"""
    try:
        user_id = session['user_id']
        logger.info(f"[Stream Analysis] 用户 {user_id} 请求流式分析错题 {mistake_id}")

        mistake = MistakeRecord.query.filter_by(id=mistake_id, user_id=user_id).first()

        if not mistake:
            logger.warning(f"[Stream Analysis] 错题记录不存在: mistake_id={mistake_id}")
            return jsonify({'error': 'Mistake record not found'}), 404

        knowledge_tags = []
        if mistake.knowledge_tags:
            try:
                knowledge_tags = json.loads(mistake.knowledge_tags)
            except:
                knowledge_tags = []

        course_title = mistake.course.title if mistake.course else None

        # 修复：从关联的assessment中获取原始题目的解析信息，提升AI分析准确性
        explanation = None
        try:
            if mistake.assessment and mistake.question_index is not None:
                questions = json.loads(mistake.assessment.questions)
                if isinstance(questions, list) and len(questions) > mistake.question_index:
                    original_question = questions[mistake.question_index]
                    # 支持多种字段名：explanation, analysis, 解析
                    explanation = original_question.get('explanation') or \
                                 original_question.get('analysis') or \
                                 original_question.get('解析')
        except Exception as e:
            # 修复：获取解析失败不应中断主流程，记录日志即可
            logger.warning(f"获取题目解析失败（不影响AI分析）: {str(e)}")

        def generate():
            full_analysis = ""
            chunk_count = 0
            try:
                logger.info(f"[Stream Analysis] 开始调用Spark流式API...")
                for chunk in spark_service.analyze_mistake_stream(
                    question_content=mistake.question_content,
                    user_answer=mistake.user_answer,
                    correct_answer=mistake.correct_answer,
                    knowledge_tags=knowledge_tags,
                    course_title=course_title,
                    explanation=explanation
                ):
                    full_analysis += chunk
                    chunk_count += 1
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

                logger.info(f"[Stream Analysis] 流式分析完成, 共 {chunk_count} 个数据块, 总长度: {len(full_analysis)}")

                # 保存分析结果到数据库（需要在应用上下文中操作）
                try:
                    with current_app.app_context():
                        mistake.ai_analysis = full_analysis
                        mistake.updated_at = datetime.utcnow()
                        db.session.commit()
                        logger.info(f"[Stream Analysis] 分析结果已保存到数据库")
                except Exception as db_err:
                    logger.error(f"save AI analysis failed: {str(db_err)}")
                    try:
                        with current_app.app_context():
                            db.session.rollback()
                    except:
                        pass

                yield f"data: {json.dumps({'done': True, 'analysis': full_analysis}, ensure_ascii=False)}\n\n"
            except Exception as e:
                logger.error(f"AI analysis stream error: {str(e)}", exc_info=True)
                error_msg = str(e)
                if "Missing Spark credentials" in error_msg or "Spark API" in error_msg:
                    error_msg = "AI服务未配置，请联系管理员设置API密钥"
                elif "timeout" in error_msg.lower():
                    error_msg = "AI分析超时，请稍后重试"
                yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}\n\n"

        return Response(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive',
            }
        )

    except Exception as e:
        logger.error(f"[Stream Analysis] 接口异常: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/batch-analyze', methods=['POST'])
@require_auth
def batch_analyze_mistakes():
    """批量分析多个错题"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        mistake_ids = data.get('mistake_ids', [])
        
        if not mistake_ids:
            return jsonify({'error': 'mistake_ids is required'}), 400
        
        if len(mistake_ids) > 20:
            return jsonify({'error': 'Maximum 20 mistakes can be analyzed at once'}), 400
        
        mistakes = MistakeRecord.query.filter(
            MistakeRecord.id.in_(mistake_ids),
            MistakeRecord.user_id == user_id
        ).all()
        
        if not mistakes:
            return jsonify({'error': 'No valid mistake records found'}), 404
        
        mistakes_data = []
        for m in mistakes:
            knowledge_tags = []
            if m.knowledge_tags:
                try:
                    knowledge_tags = json.loads(m.knowledge_tags)
                except:
                    knowledge_tags = []
            
            mistakes_data.append({
                'id': m.id,
                'question_content': m.question_content,
                'user_answer': m.user_answer,
                'correct_answer': m.correct_answer,
                'knowledge_tags': knowledge_tags,
                'course_title': m.course.title if m.course else None
            })
        
        analysis = spark_service.analyze_mistakes_batch(mistakes_data)
        
        return jsonify({
            'message': 'Batch analysis completed successfully',
            'analysis': analysis,
            'analyzed_count': len(mistakes)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@mistake_book_bp.route('/mistakes/batch-analyze/stream', methods=['POST'])
@require_auth
def batch_analyze_mistakes_stream():
    """流式批量分析多个错题"""
    try:
        user_id = session['user_id']
        data = request.get_json()
        
        mistake_ids = data.get('mistake_ids', [])
        
        if not mistake_ids:
            return jsonify({'error': 'mistake_ids is required'}), 400
        
        if len(mistake_ids) > 20:
            return jsonify({'error': 'Maximum 20 mistakes can be analyzed at once'}), 400
        
        mistakes = MistakeRecord.query.filter(
            MistakeRecord.id.in_(mistake_ids),
            MistakeRecord.user_id == user_id
        ).all()
        
        if not mistakes:
            return jsonify({'error': 'No valid mistake records found'}), 404
        
        mistakes_data = []
        for m in mistakes:
            knowledge_tags = []
            if m.knowledge_tags:
                try:
                    knowledge_tags = json.loads(m.knowledge_tags)
                except:
                    knowledge_tags = []
            
            mistakes_data.append({
                'id': m.id,
                'question_content': m.question_content,
                'user_answer': m.user_answer,
                'correct_answer': m.correct_answer,
                'knowledge_tags': knowledge_tags,
                'course_title': m.course.title if m.course else None
            })
        
        def generate_analysis():
            full_analysis = ""
            try:
                for chunk in spark_service.chat_stream([{"role": "user", "content": f"""你是一位经验丰富的教育专家，擅长分析学生的错题模式并提供综合学习建议。

以下是学生的多个错题记录：

{json.dumps(mistakes_data, ensure_ascii=False, indent=2)}

请进行综合分析：

## 一、整体错误模式分析
1. 学生在哪些类型的题目上容易出错？
2. 是否存在反复出现的错误类型？
3. 错误的主要原因是什么？（概念理解、计算、审题等）

## 二、知识点薄弱环节汇总
1. 学生最薄弱的知识点有哪些？
2. 这些知识点之间是否存在关联？
3. 哪些前置知识可能没有掌握好？

## 三、综合学习建议
1. 制定怎样的复习计划最有效？
2. 应该优先复习哪些知识点？
3. 推荐的学习资源和练习方法？
4. 如何系统性地提高？

## 四、后续学习路径
请给出一个具体的学习路径建议，帮助学生逐步提高。

请用清晰、有条理的语言进行分析，帮助学生制定有效的学习计划。"""}]):
                    full_analysis += chunk
                    yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

                yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"
            except Exception as e:
                logging.error(f"batch analysis stream error: {str(e)}", exc_info=True)
                error_msg = str(e)
                if "Missing Spark credentials" in error_msg or "Spark API" in error_msg:
                    error_msg = "AI服务未配置，请联系管理员设置API密钥"
                elif "timeout" in error_msg.lower():
                    error_msg = "AI分析超时，请稍后重试"
                yield f"data: {json.dumps({'error': error_msg}, ensure_ascii=False)}\n\n"

        return Response(
            generate_analysis(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Connection': 'keep-alive',
            }
        )
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
