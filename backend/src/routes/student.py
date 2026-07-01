from flask import Blueprint, request, jsonify, session
from src.models.user import db
from src.models.course import Course, LearningProgress, PracticeEvaluation, Assessment, MistakeRecord, VideoLesson, VideoProgress, TeachingContent
from sqlalchemy import func
from datetime import datetime, timedelta
import json
import logging
import difflib

from src.services.mistake_intelligence_service import normalize_option_answer

logger = logging.getLogger(__name__)

student_bp = Blueprint('student', __name__)


def _enrich_practice_with_chapter_knowledge(practice):
    """为练习记录补充章节归属与知识点掌握度评估。

    避免审核流程仅关注"练习#X"形式化完成状态，转而基于章节教学目标和知识点要求
    全面评估实际掌握程度。

    返回字段：
    - chapter: 章节归属（最匹配的 TeachingContent.title，找不到则用课程名）
    - knowledge_points: 知识点掌握度列表 [{point, mastery, score}]
    - question_count: 题目数量
    - mastery_level: 整体掌握程度标签（已掌握/部分掌握/未掌握）
    """
    result = {
        'chapter': None,
        'knowledge_points': [],
        'question_count': 0,
        'mastery_level': '未知',
    }
    try:
        assessment = Assessment.query.get(practice.assessment_id)
        if not assessment:
            return result

        # 解析题目 JSON，提取知识点标签和题目数量
        questions = []
        if isinstance(assessment.questions, str):
            try:
                questions = json.loads(assessment.questions)
            except json.JSONDecodeError:
                questions = []
        elif isinstance(assessment.questions, list):
            questions = assessment.questions

        result['question_count'] = len(questions) if isinstance(questions, list) else 0

        # 收集所有知识点标签
        all_tags = []
        if isinstance(questions, list):
            for q in questions:
                if not isinstance(q, dict):
                    continue
                tags = q.get('knowledge_tags') or []
                if isinstance(tags, str):
                    try:
                        tags = json.loads(tags)
                    except (json.JSONDecodeError, TypeError):
                        tags = [tags]
                for tag in tags:
                    tag_text = str(tag).strip()
                    if tag_text and tag_text not in all_tags:
                        all_tags.append(tag_text)

        # 基于 score 评估每个知识点的掌握度
        score = practice.score if practice.score is not None else 0
        if score >= 90:
            mastery_level = '已掌握'
            mastery_desc = '掌握扎实'
        elif score >= 60:
            mastery_level = '部分掌握'
            mastery_desc = '存在薄弱环节'
        else:
            mastery_level = '未掌握'
            mastery_desc = '需要重点复习'
        result['mastery_level'] = mastery_level

        result['knowledge_points'] = [
            {'point': tag, 'mastery': mastery_level, 'mastery_desc': mastery_desc, 'score': score}
            for tag in all_tags[:8]  # 最多返回 8 个知识点，避免过长
        ]

        # 关联章节归属：在同课程下找标题最相似的 TeachingContent
        course_contents = TeachingContent.query.filter_by(course_id=assessment.course_id).all()
        if course_contents:
            # 优先用 assessment.title 匹配，其次用知识点标签匹配
            match_target = assessment.title or ''
            best_match = None
            best_ratio = 0.0
            for tc in course_contents:
                ratio = difflib.SequenceMatcher(None, match_target, tc.title or '').ratio()
                # 标题匹配阈值 0.4
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = tc
            # 如果标题匹配度低，尝试用知识点标签在 content 中搜索
            if best_ratio < 0.4 and all_tags:
                for tc in course_contents:
                    content_text = (tc.content or '').lower()
                    for tag in all_tags:
                        if tag.lower() in content_text:
                            best_match = tc
                            best_ratio = 0.5  # 标记为中等匹配
                            break
                    if best_match:
                        break
            if best_match and best_ratio >= 0.3:
                result['chapter'] = best_match.title
            else:
                # 兜底：用课程名 + "综合" 作为章节归属
                course = Course.query.get(assessment.course_id)
                result['chapter'] = f"{course.title}·综合" if course else '未分类'
        else:
            course = Course.query.get(assessment.course_id)
            result['chapter'] = f"{course.title}·综合" if course else '未分类'

    except Exception as e:
        logger.warning(f"Enrich practice {practice.id} failed: {e}")

    return result


def _extract_correct_answer(question, answers=None, index=None):
    candidates = []
    if isinstance(answers, list) and index is not None and 0 <= index < len(answers):
        candidates.append(answers[index])
    if isinstance(question, dict):
        for key in ['correctAnswer', 'correct_answer', 'answer', 'correct']:
            if key in question:
                candidates.append(question.get(key))

    for candidate in candidates:
        if candidate is None:
            continue
        text = str(candidate).strip()
        if text:
            return text
    return None


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
    """获取我的课程及基于视频完成状态的真实学习进度"""
    try:
        user_id = session['user_id']
        logger.info(f"[get_my_courses] user_id={user_id} 开始获取课程及视频进度")

        # 获取学生的学习进度记录
        progress_records = LearningProgress.query.filter_by(user_id=user_id).all()
        logger.info(f"[get_my_courses] 找到 {len(progress_records)} 条学习进度记录")

        course_list = []
        for progress in progress_records:
            if not progress.course:
                logger.warning(f"[get_my_courses] progress_id={progress.id} 无关联课程，跳过")
                continue

            course = progress.course
            course_id = course.id

            # 1. 获取该课程下所有已发布视频（作为章节/课时）
            videos = VideoLesson.query.filter_by(
                course_id=course_id,
                status='published'
            ).order_by(VideoLesson.order_index.asc(), VideoLesson.id.asc()).all()
            total_videos = len(videos)
            logger.info(f"[get_my_courses] course_id={course_id} 发布视频数={total_videos}")

            # 2. 获取该用户在该课程下的所有视频观看进度
            video_ids = [v.id for v in videos]
            progress_map = {}
            if video_ids:
                vp_records = VideoProgress.query.filter(
                    VideoProgress.user_id == user_id,
                    VideoProgress.video_id.in_(video_ids)
                ).all()
                progress_map = {vp.video_id: vp for vp in vp_records}
                logger.info(f"[get_my_courses] course_id={course_id} 视频进度记录数={len(progress_map)}")

            # 3. 计算基于视频完成状态的真实进度
            completed_count = sum(
                1 for v in videos
                if progress_map.get(v.id) and progress_map[v.id].completed
            )
            video_progress = round(
                (completed_count / total_videos * 100) if total_videos > 0 else 0, 2
            )
            logger.info(f"[get_my_courses] course_id={course_id} 完成视频={completed_count}/{total_videos} 进度={video_progress}%")

            # 4. 总时长（秒 -> 小时，保留一位小数）
            total_duration_seconds = sum(v.duration or 0 for v in videos)
            total_duration_hours = round(total_duration_seconds / 3600, 1)

            # 5. 最近学习时间为所有视频进度的最后观看时间
            last_watched_times = [
                vp.last_watched for vp in progress_map.values()
                if vp.last_watched
            ]
            latest_watch_time = max(last_watched_times) if last_watched_times else None

            # 同时更新 LearningProgress 表，保持进度同步
            try:
                if video_progress != progress.progress_percentage or latest_watch_time != progress.last_accessed:
                    progress.progress_percentage = video_progress
                    if latest_watch_time:
                        progress.last_accessed = latest_watch_time
                    elif video_progress > 0 and not progress.last_accessed:
                        progress.last_accessed = datetime.utcnow()
                    db.session.commit()
                    logger.info(f"[get_my_courses] course_id={course_id} 已同步 LearningProgress 进度={video_progress}%")
            except Exception as sync_err:
                db.session.rollback()
                logger.warning(f"[get_my_courses] course_id={course_id} 同步 LearningProgress 失败: {sync_err}")

            # 6. 下节课：找到第一个未完成的视频
            next_video = None
            for v in videos:
                vp = progress_map.get(v.id)
                if not vp or not vp.completed:
                    next_video = v
                    break
            # 如果全部完成，默认推荐最后一个视频用于复习
            if not next_video and videos:
                next_video = videos[-1]

            course_dict = course.to_dict()
            course_dict['progress_percentage'] = video_progress
            course_dict['last_accessed'] = progress.last_accessed.isoformat() if progress.last_accessed else None
            course_dict['video_stats'] = {
                'total_videos': total_videos,
                'completed_videos': completed_count,
                'total_duration_seconds': total_duration_seconds,
                'total_duration_hours': total_duration_hours,
                'last_watched_at': latest_watch_time.isoformat() if latest_watch_time else None,
                'next_video_title': next_video.title if next_video else None,
                'next_video_id': next_video.id if next_video else None,
            }
            course_list.append(course_dict)

        logger.info(f"[get_my_courses] user_id={user_id} 返回课程数={len(course_list)}")
        return jsonify({
            'courses': course_list
        }), 200

    except Exception as e:
        logger.exception(f"[get_my_courses] user_id={session.get('user_id')} 获取课程失败: {e}")
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
        
        # 最近的练习记录（enriched：补充章节归属与知识点掌握度）
        recent_practices = evaluations[:10]  # 最近10次练习

        # 缓存课程名映射，避免重复查询
        course_name_cache = {}
        enriched_practices = []
        for practice in recent_practices:
            base = practice.to_dict()
            enrichment = _enrich_practice_with_chapter_knowledge(practice)
            base.update(enrichment)
            # 补充 assessment_title 和 course_name（前端展示需要）
            assessment = Assessment.query.get(practice.assessment_id) if practice.assessment_id else None
            if assessment:
                base['assessment_title'] = assessment.title
                if assessment.course_id not in course_name_cache:
                    course = Course.query.get(assessment.course_id)
                    course_name_cache[assessment.course_id] = course.title if course else ''
                base['course_name'] = course_name_cache.get(assessment.course_id, '')
            else:
                base['assessment_title'] = None
                base['course_name'] = ''
            enriched_practices.append(base)

        return jsonify({
            'practice_stats': {
                'total_practices': total_practices,
                'avg_score': round(avg_score, 2),
                'max_score': max_score,
                'min_score': min_score
            },
            'recent_practices': enriched_practices
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@student_bp.route('/learning_progress_chart', methods=['GET'])
@require_auth
def get_learning_progress_chart():
    """获取学习进度图表数据"""
    try:
        user_id = session['user_id']
        
        progress_records = LearningProgress.query.filter_by(user_id=user_id).all()

        course_progress = []
        colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316']
        for i, progress in enumerate(progress_records):
            course_progress.append({
                'name': progress.course.title if progress.course else f'课程{progress.course_id}',
                'progress': round(progress.progress_percentage, 1),
                'color': colors[i % len(colors)]
            })

        weekly_progress = []
        day_names = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        today = datetime.utcnow().date()
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            weekday = date.weekday()
            day_records = LearningProgress.query.filter_by(user_id=user_id).filter(
                func.date(LearningProgress.last_accessed) == date
            ).all()
            hours = round(len(day_records) * 0.5, 1)
            completed = PracticeEvaluation.query.filter_by(user_id=user_id).filter(
                func.date(PracticeEvaluation.created_at) == date
            ).count()
            weekly_progress.append({
                'day': day_names[weekday],
                'hours': hours,
                'completed': completed
            })

        return jsonify({
            'chart_data': {
                'courses': [p.course.title for p in progress_records],
                'progress': [p.progress_percentage for p in progress_records]
            },
            'weekly_progress': weekly_progress,
            'course_progress': course_progress
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
    """从提交中提取错题 - 增强版，支持多种数据格式和容错处理
    
    智能筛选规则：
    1. 完全答对的题目不添加到错题本
    2. 未作答的题目根据配置决定是否添加
    3. 只有真正答错或部分错误的题目才会被添加
    """
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
            options = question.get('options', []) if isinstance(question, dict) else []
            correct_ans = _extract_correct_answer(question, answers=answers, index=i)
            
            # 智能筛选：如果正确答案为空，跳过该题
            if correct_ans is None or correct_ans == '':
                result['skipped_questions'].append({
                    'index': i,
                    'reason': '正确答案未设置，无法判断对错'
                })
                continue
            
            # 智能筛选：如果用户未作答，不添加到错题本（除非明确配置）
            if user_ans is None or user_ans == '' or user_ans == 'null':
                result['skipped_questions'].append({
                    'index': i,
                    'reason': '用户未作答，跳过添加'
                })
                result['filtered_count'] += 1
                continue
            
            # 判断答案是否正确
            user_normalized = normalize_option_answer(user_ans, options).normalized
            correct_normalized = normalize_option_answer(correct_ans, options).normalized
            is_correct = bool(user_normalized) and bool(correct_normalized) and user_normalized == correct_normalized
            # 智能筛选：只有答错的题目才添加到错题本
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
                    existing_mistake.user_answer = user_normalized
                    existing_mistake.correct_answer = correct_normalized
                    
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
                        user_answer=user_normalized,
                        correct_answer=correct_normalized,
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
                existing_mistake = MistakeRecord.query.filter_by(
                    user_id=user_id,
                    assessment_id=assessment.id,
                    question_index=i
                ).first()
                if existing_mistake and existing_mistake.mastery_status != 'mastered':
                    existing_mistake.mastery_status = 'mastered'
                    logger.info(f'[错题提取] 答对题目，升级为已掌握: 用户={user_id}, 题目索引={i}')
                result['filtered_count'] += 1
                logger.debug(f'[错题提取] 过滤答对题目: 用户={user_id}, 题目索引={i}, 用户答案={user_ans}, 正确答案={correct_ans}')
                
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
    if not isinstance(question, dict):
        return []

    tags = question.get('knowledge_tags', question.get('tags', []))

    if isinstance(tags, list):
        result = []
        for t in tags:
            if isinstance(t, dict):
                result.append(str(t.get('name', t.get('label', t.get('tag', str(t))))))
            elif t is not None:
                result.append(str(t).strip())
        return [t for t in result if t]
    elif isinstance(tags, str):
        try:
            parsed = json.loads(tags)
            if isinstance(parsed, list):
                result = []
                for t in parsed:
                    if isinstance(t, dict):
                        result.append(str(t.get('name', t.get('label', t.get('tag', str(t))))))
                    elif t is not None:
                        result.append(str(t).strip())
                return [t for t in result if t]
            return [t.strip() for t in tags.split(',') if t.strip()]
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

        recent_activities = []
        for p in recent_progress:
            course_title = p.course.title if p.course else '未知课程'
            recent_activities.append({
                'description': f'学习了 {course_title}，进度 {round(p.progress_percentage, 1)}%',
                'title': f'学习了 {course_title}',
                'time': p.last_accessed.isoformat() if p.last_accessed else None,
                'created_at': p.last_accessed.isoformat() if p.last_accessed else None,
                'icon': 'book',
                'type': 'learning'
            })
        for e in recent_practices:
            recent_activities.append({
                'description': f'完成了练习评测，得分 {e.score}',
                'title': '完成了练习评测',
                'time': e.created_at.isoformat() if e.created_at else None,
                'created_at': e.created_at.isoformat() if e.created_at else None,
                'icon': 'check',
                'type': 'practice'
            })
        recent_activities.sort(key=lambda x: x.get('time') or '', reverse=True)
        recent_activities = recent_activities[:10]
        
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
            'recent_activities': recent_activities,
            'activities': recent_activities,
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
