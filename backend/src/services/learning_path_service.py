import json
import logging
import re
from datetime import datetime, timedelta
from src.models.user import db
from src.models.learning_path import LearningPath, LearningPathNode, ResourceRecommendation, LearningPlan
from src.models.student_profile import StudentProfile
from src.models.course import Course, LearningProgress, PracticeEvaluation, MistakeRecord, VideoLesson, TeachingContent
from src.services.spark_service import spark_service, is_configured as spark_is_configured, SparkServiceError

logger = logging.getLogger(__name__)


class LearningPathService:
    def generate_path(self, user_id, course_id=None):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            return {"error": "请先完成学习画像构建"}

        if course_id:
            course = Course.query.get(course_id)
            if not course:
                return {"error": "课程不存在"}
            existing_course = LearningPath.query.filter_by(
                user_id=user_id, course_id=course_id, status='active'
            ).first()
            if existing_course:
                db.session.delete(existing_course)
            path = self._generate_course_path(user_id, course_id, profile)
        else:
            existing_overall = LearningPath.query.filter_by(
                user_id=user_id, course_id=None, status='active'
            ).all()
            for old_path in existing_overall:
                db.session.delete(old_path)
            path = self._generate_overall_path(user_id, profile)

        return path.to_dict() if path else {"error": "路径生成失败"}

    def _generate_course_path(self, user_id, course_id, profile):
        course = Course.query.get(course_id)
        existing = LearningPath.query.filter_by(
            user_id=user_id, course_id=course_id, status='active'
        ).all()
        for old_path in existing:
            db.session.delete(old_path)

        path = LearningPath(
            user_id=user_id,
            course_id=course_id,
            title=f"{course.title} - 个性化学习路径",
            description=f"基于你的学习画像为《{course.title}》定制的路径",
            generated_by='ai',
        )

        videos = VideoLesson.query.filter_by(course_id=course_id).order_by(VideoLesson.id).all()
        contents = TeachingContent.query.filter_by(course_id=course_id).order_by(TeachingContent.id).all()

        nodes_data = []
        order = 0

        knowledge_base = profile.get_knowledge_base()
        course_kb = {}
        if isinstance(knowledge_base, dict):
            course_kb = {k: v for k, v in knowledge_base.items()
                         if isinstance(v, (int, float))}

        if contents:
            for i, tc in enumerate(contents):
                mastery = self._estimate_mastery(tc.title, course_kb)
                status = 'completed' if mastery >= 80 else 'available' if i == 0 or mastery >= 40 else 'locked'
                if i > 0:
                    status = 'available' if nodes_data[-1]['status'] in ('completed', 'available') else 'locked'
                    if mastery >= 60:
                        status = 'available'

                node = {
                    'node_id': f'content_{tc.id}',
                    'title': tc.title,
                    'description': (tc.content[:100] + '...') if tc.content and len(tc.content) > 100 else (tc.content or ''),
                    'node_type': 'content',
                    'order_index': order,
                    'prerequisites': [nodes_data[-1]['node_id']] if i > 0 else [],
                    'status': status,
                    'progress_percentage': mastery,
                    'estimated_minutes': max(15, len(tc.content or '') // 200) if tc.content else 20,
                    'resource_ids': [tc.id],
                    'mastery_level': mastery / 100.0,
                }
                nodes_data.append(node)
                order += 1

        if videos:
            for i, v in enumerate(videos):
                mastery = self._estimate_mastery(v.title, course_kb)
                prereqs = []
                if nodes_data:
                    prereqs.append(nodes_data[-1]['node_id'])
                elif i > 0:
                    prereqs.append(f'video_{videos[i-1].id}')

                status = 'completed' if mastery >= 80 else 'available' if not prereqs or mastery >= 40 else 'locked'
                if prereqs and nodes_data:
                    status = 'available' if nodes_data[-1]['status'] in ('completed', 'available') else 'locked'
                    if mastery >= 60:
                        status = 'available'

                node = {
                    'node_id': f'video_{v.id}',
                    'title': v.title,
                    'description': v.description or '',
                    'node_type': 'video',
                    'order_index': order,
                    'prerequisites': prereqs,
                    'status': status,
                    'progress_percentage': mastery,
                    'estimated_minutes': int(v.duration // 60) if v.duration else 30,
                    'resource_ids': [v.id],
                    'mastery_level': mastery / 100.0,
                }
                nodes_data.append(node)
                order += 1

        practice_node = {
            'node_id': f'practice_{course_id}',
            'title': f'《{course.title}》综合练习',
            'description': '检验课程学习成果的综合性练习',
            'node_type': 'practice',
            'order_index': order,
            'prerequisites': [nodes_data[-1]['node_id']] if nodes_data else [],
            'status': 'locked',
            'progress_percentage': 0,
            'estimated_minutes': 45,
            'resource_ids': [],
            'mastery_level': 0,
        }
        nodes_data.append(practice_node)

        path.set_path_data(nodes_data)
        completed = sum(1 for n in nodes_data if n['status'] == 'completed')
        path.progress_percentage = round(completed / len(nodes_data) * 100, 1) if nodes_data else 0

        first_available = next((n for n in nodes_data if n['status'] == 'available'), None)
        path.current_node_id = first_available['node_id'] if first_available else None

        pace_multiplier = {'fast': 0.7, 'moderate': 1.0, 'slow': 1.5, 'adaptive': 1.0}
        total_minutes = sum(n['estimated_minutes'] for n in nodes_data)
        path.estimated_days = max(1, int(total_minutes / 60 * pace_multiplier.get(profile.learning_pace, 1.0)))

        db.session.add(path)
        db.session.commit()
        return path

    def _generate_overall_path(self, user_id, profile):
        progresses = LearningProgress.query.filter_by(user_id=user_id).all()
        if not progresses:
            return None

        course_ids = [lp.course_id for lp in progresses]
        courses = Course.query.filter(Course.id.in_(course_ids)).all()

        completed_count = sum(1 for lp in progresses if lp.progress_percentage >= 90)
        active_count = sum(1 for lp in progresses if 0 < lp.progress_percentage < 90)
        display_name = None
        if profile and profile.user:
            display_name = profile.user.real_name or profile.user.username
        title = f"{display_name}的综合学习路径" if display_name else f"综合学习路径（{len(courses)}门课程）"

        path = LearningPath(
            user_id=user_id,
            course_id=None,
            title=title,
            description=f"涵盖{len(courses)}门课程的综合学习路径：{', '.join([c.title for c in courses[:3]])}{'等' if len(courses) > 3 else ''}",
            generated_by='ai',
        )

        nodes_data = []
        order = 0
        knowledge_base = profile.get_knowledge_base()

        for course in courses:
            lp = next((p for p in progresses if p.course_id == course.id), None)
            progress = lp.progress_percentage if lp else 0
            status = 'completed' if progress >= 90 else 'available' if order == 0 or progress > 0 else 'locked'
            if order > 0 and nodes_data[-1]['status'] in ('completed', 'available'):
                status = 'available'

            node = {
                'node_id': f'course_{course.id}',
                'title': course.title,
                'description': course.description or '',
                'node_type': 'course',
                'order_index': order,
                'prerequisites': [nodes_data[-1]['node_id']] if order > 0 else [],
                'status': status,
                'progress_percentage': progress,
                'estimated_minutes': 60 * 3,
                'resource_ids': [],
                'mastery_level': progress / 100.0,
            }
            nodes_data.append(node)
            order += 1

        path.set_path_data(nodes_data)
        total_progress = sum(n['progress_percentage'] for n in nodes_data)
        path.progress_percentage = round(total_progress / len(nodes_data), 1) if nodes_data else 0

        first_available = next((n for n in nodes_data if n['status'] == 'available'), None)
        path.current_node_id = first_available['node_id'] if first_available else None

        db.session.add(path)
        db.session.commit()
        return path

    def _update_existing_path(self, path, profile):
        nodes = path.get_path_data()
        knowledge_base = profile.get_knowledge_base()

        for node in nodes:
            if node.get('node_type') == 'content':
                mastery = self._estimate_mastery(node['title'], knowledge_base)
                node['mastery_level'] = mastery / 100.0
                if mastery >= 80 and node['status'] != 'completed':
                    node['status'] = 'completed'
                    node['progress_percentage'] = 100
            elif node.get('node_type') == 'course':
                course_id = node.get('resource_ids', [None])[0] if node.get('resource_ids') else None
                if not course_id:
                    node_id = node.get('node_id', '')
                    if node_id.startswith('course_'):
                        try:
                            course_id = int(node_id.replace('course_', ''))
                        except (ValueError, AttributeError):
                            course_id = None
                if course_id:
                    progress_record = LearningProgress.query.filter_by(
                        user_id=path.user_id, course_id=course_id
                    ).first()
                    if progress_record:
                        node['progress_percentage'] = progress_record.progress_percentage
                        node['mastery_level'] = progress_record.progress_percentage / 100.0
                        if progress_record.progress_percentage >= 90:
                            node['status'] = 'completed'
                        elif progress_record.progress_percentage > 0:
                            node['status'] = 'available'
                        elif node['status'] == 'locked':
                            pass

        self._recalculate_node_statuses(nodes)

        path.set_path_data(nodes)
        if nodes:
            total_progress = sum(n.get('progress_percentage', 0) for n in nodes)
            path.progress_percentage = round(total_progress / len(nodes), 1)
        else:
            path.progress_percentage = 0
        path.updated_at = datetime.utcnow()
        db.session.commit()
        return path

    def _recalculate_node_statuses(self, nodes):
        node_map = {n['node_id']: n for n in nodes}
        for node in nodes:
            if node['status'] == 'completed':
                continue
            prereqs = node.get('prerequisites', [])
            if not prereqs:
                if node['status'] == 'locked':
                    node['status'] = 'available'
            else:
                all_prereqs_done = all(
                    node_map.get(p, {}).get('status') in ('completed', 'available')
                    for p in prereqs
                )
                if all_prereqs_done and node['status'] == 'locked':
                    node['status'] = 'available'

    def _estimate_mastery(self, title, knowledge_base):
        if not knowledge_base or not title:
            return 0
        title_lower = title.lower()
        for key, value in knowledge_base.items():
            if isinstance(value, (int, float)):
                key_lower = key.lower()
                if key_lower in title_lower or title_lower in key_lower:
                    return value
                overlap = sum(1 for c in key_lower if c in title_lower)
                if overlap > len(key_lower) * 0.5:
                    return value
        return 0

    def update_node_status(self, user_id, path_id, node_id, status):
        path = LearningPath.query.filter_by(id=path_id, user_id=user_id).first()
        if not path:
            return {"error": "路径不存在"}

        nodes = path.get_path_data()
        node = next((n for n in nodes if n['node_id'] == node_id), None)
        if not node:
            return {"error": "节点不存在"}

        node['status'] = status
        if status == 'completed':
            node['progress_percentage'] = 100
            node['mastery_level'] = 1.0
        elif status == 'in_progress':
            node['progress_percentage'] = max(node.get('progress_percentage', 0), 10)

        self._recalculate_node_statuses(nodes)

        path.set_path_data(nodes)
        completed = sum(1 for n in nodes if n['status'] == 'completed')
        path.progress_percentage = round(completed / len(nodes) * 100, 1) if nodes else 0

        if status == 'completed':
            available = [n for n in nodes if n['status'] == 'available']
            path.current_node_id = available[0]['node_id'] if available else None

        path.updated_at = datetime.utcnow()
        db.session.commit()
        return path.to_dict()

    def get_user_paths(self, user_id):
        paths = LearningPath.query.filter_by(user_id=user_id).order_by(
            LearningPath.updated_at.desc()
        ).all()
        return [p.to_dict() for p in paths]

    def get_path_detail(self, user_id, path_id):
        path = LearningPath.query.filter_by(id=path_id, user_id=user_id).first()
        if not path:
            return None
        return path.to_dict()

    def generate_ai_plan(self, user_id):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            return {"error": "请先完成学习画像构建"}

        progresses = LearningProgress.query.filter_by(user_id=user_id).all()
        evaluations = PracticeEvaluation.query.filter_by(user_id=user_id).order_by(
            PracticeEvaluation.created_at.desc()
        ).limit(20).all()
        mistakes = MistakeRecord.query.filter_by(user_id=user_id).all()

        avg_score = 0
        if evaluations:
            scores = [e.score for e in evaluations if e.score is not None]
            avg_score = round(sum(scores) / len(scores), 1) if scores else 0

        mistake_count = len(mistakes)
        unmastered = sum(1 for m in mistakes if m.mastery_status != 'mastered')

        courses_info = []
        for lp in progresses:
            course = Course.query.get(lp.course_id)
            if course:
                courses_info.append(f"- {course.title}: 进度{lp.progress_percentage}%")

        profile_data = profile.to_dict()

        context_summary = self._build_context_summary(profile_data, avg_score, mistake_count, unmastered, courses_info)

        if not spark_is_configured():
            logger.warning("Spark API not configured, using local fallback plan generation")
            plan_data = self._generate_local_plan(profile_data, avg_score, mistake_count, unmastered, courses_info)
            plan_data['ai_analysis'] = f"[本地模式] {context_summary}\n\n由于AI服务暂未配置，系统基于你的学习画像数据自动生成了以下规划建议。配置AI服务后可获得更精准的个性化分析。"
            return self._save_plan(user_id, plan_data)

        prompt = self._build_plan_prompt(profile_data, avg_score, mistake_count, unmastered, courses_info)

        try:
            response = spark_service.chat([
                {"role": "system", "content": "你是一位专业的学习规划师，擅长根据学生数据制定个性化学习方案。请严格按照JSON格式返回，不要包含任何其他文字或markdown标记。"},
                {"role": "user", "content": prompt},
            ])

            if not response or not response.strip():
                logger.warning("AI returned empty response, using fallback")
                plan_data = self._generate_local_plan(profile_data, avg_score, mistake_count, unmastered, courses_info)
                plan_data['ai_analysis'] = f"{context_summary}\n\nAI服务返回了空响应，已使用本地分析生成规划。"
                return self._save_plan(user_id, plan_data)

            plan_data = self._parse_ai_response(response)

            if not plan_data.get('goals') and not plan_data.get('recommended_sequence'):
                logger.warning("AI response parsed but missing key data, enhancing with local analysis")
                local_plan = self._generate_local_plan(profile_data, avg_score, mistake_count, unmastered, courses_info)
                if not plan_data.get('goals'):
                    plan_data['goals'] = local_plan.get('goals', [])
                if not plan_data.get('recommended_sequence'):
                    plan_data['recommended_sequence'] = local_plan.get('recommended_sequence', [])
                if not plan_data.get('milestones'):
                    plan_data['milestones'] = local_plan.get('milestones', [])
                if not plan_data.get('ability_expectations') or plan_data.get('ability_expectations') == {}:
                    plan_data['ability_expectations'] = local_plan.get('ability_expectations', {})

            return self._save_plan(user_id, plan_data)

        except SparkServiceError as e:
            logger.error(f"Spark service error: {e}")
            plan_data = self._generate_local_plan(profile_data, avg_score, mistake_count, unmastered, courses_info)
            plan_data['ai_analysis'] = f"{context_summary}\n\nAI服务暂时不可用（{str(e)[:100]}），已使用本地分析生成规划。"
            return self._save_plan(user_id, plan_data)

        except Exception as e:
            logger.error(f"Generate AI plan unexpected error: {e}", exc_info=True)
            plan_data = self._generate_local_plan(profile_data, avg_score, mistake_count, unmastered, courses_info)
            plan_data['ai_analysis'] = f"{context_summary}\n\n规划生成过程中遇到异常，已使用本地分析生成规划。"
            return self._save_plan(user_id, plan_data)

    def _build_context_summary(self, profile_data, avg_score, mistake_count, unmastered, courses_info):
        parts = []
        cognitive = profile_data.get('cognitive_style', '未知')
        pace = profile_data.get('learning_pace', '未知')
        goal = profile_data.get('goal_orientation', '未知')
        parts.append(f"你的认知风格为{cognitive}型，学习节奏{pace}，目标导向为{goal}。")
        if avg_score > 0:
            parts.append(f"练习平均分{avg_score}分，")
            if avg_score >= 80:
                parts.append("整体表现优秀。")
            elif avg_score >= 60:
                parts.append("仍有提升空间。")
            else:
                parts.append("需要重点加强基础知识。")
        if mistake_count > 0:
            parts.append(f"错题共{mistake_count}道（未掌握{unmastered}道），建议针对性复习。")
        if courses_info:
            parts.append(f"当前在学{len(courses_info)}门课程。")
        return ''.join(parts)

    def _build_plan_prompt(self, profile_data, avg_score, mistake_count, unmastered, courses_info):
        knowledge_base = profile_data.get('knowledge_base', {})
        weak_points = []
        if isinstance(knowledge_base, dict):
            weak_points = [(k, v) for k, v in knowledge_base.items() if isinstance(v, (int, float)) and v < 60]

        weak_str = '、'.join([f'{k}({v}分)' for k, v in weak_points[:5]]) if weak_points else '暂无明显薄弱点'

        return f"""基于以下学生学习数据，生成一份详细的中长期学习规划与发展建议：

## 学生画像
- 认知风格：{profile_data.get('cognitive_style', '未知')}
- 学习节奏：{profile_data.get('learning_pace', '未知')}
- 目标导向：{profile_data.get('goal_orientation', '未知')}
- 互动偏好：{profile_data.get('interaction_preference', '未知')}
- 兴趣领域：{json.dumps(profile_data.get('interest_areas', []), ensure_ascii=False)}
- 薄弱知识点：{weak_str}

## 学习数据
- 练习平均分：{avg_score}
- 错题总数：{mistake_count}（未掌握：{unmastered}）
- 在学课程：
{chr(10).join(courses_info) if courses_info else '暂无'}

请直接返回以下JSON格式（不要包含markdown代码块标记或其他文字）：
{{
  "title": "学习规划标题",
  "ai_analysis": "AI综合分析（2-3段，分析学生当前学习状态、优势和不足）",
  "goals": [
    {{"phase": "短期（1-2周）", "goal": "具体目标", "measurable": "可衡量的指标"}},
    {{"phase": "中期（1个月）", "goal": "具体目标", "measurable": "可衡量的指标"}},
    {{"phase": "长期（3个月）", "goal": "具体目标", "measurable": "可衡量的指标"}}
  ],
  "milestones": [
    {{"week": 1, "tasks": ["任务1", "任务2"], "deliverable": "交付物"}},
    {{"week": 2, "tasks": ["任务1", "任务2"], "deliverable": "交付物"}},
    {{"week": 4, "tasks": ["任务1", "任务2"], "deliverable": "交付物"}}
  ],
  "recommended_sequence": [
    {{"step": 1, "action": "具体行动", "reason": "原因", "estimated_days": 3}},
    {{"step": 2, "action": "具体行动", "reason": "原因", "estimated_days": 5}}
  ],
  "ability_expectations": {{
    "知识掌握": "预期提升描述",
    "问题解决": "预期提升描述",
    "自主学习": "预期提升描述"
  }}
}}"""

    def _generate_local_plan(self, profile_data, avg_score, mistake_count, unmastered, courses_info):
        cognitive = profile_data.get('cognitive_style', 'mixed')
        pace = profile_data.get('learning_pace', 'moderate')
        goal = profile_data.get('goal_orientation', 'exam')
        knowledge_base = profile_data.get('knowledge_base', {})
        interest_areas = profile_data.get('interest_areas', [])
        error_patterns = profile_data.get('error_patterns', [])

        weak_points = []
        if isinstance(knowledge_base, dict):
            weak_points = sorted(
                [(k, v) for k, v in knowledge_base.items() if isinstance(v, (int, float)) and v < 60],
                key=lambda x: x[1]
            )

        goals = [
            {"phase": "短期（1-2周）", "goal": "巩固基础知识，补强薄弱环节", "measurable": f"薄弱知识点掌握度提升至60%以上"},
            {"phase": "中期（1个月）", "goal": "系统提升各科目水平，建立知识体系", "measurable": f"练习平均分提升至{min(avg_score + 15, 85)}分以上"},
            {"phase": "长期（3个月）", "goal": "全面达成学习目标，形成自主学习能力", "measurable": "所有课程进度达到80%以上"},
        ]

        if weak_points:
            goals[0]["goal"] = f"重点攻克{weak_points[0][0]}等薄弱知识点"
            goals[0]["measurable"] = f"{weak_points[0][0]}掌握度从{weak_points[0][1]}%提升至70%"

        pace_week_map = {'fast': 1, 'moderate': 2, 'slow': 3, 'adaptive': 2}
        base_week = pace_week_map.get(pace, 2)

        milestones = [
            {"week": base_week, "tasks": [], "deliverable": "完成基础知识复习"},
            {"week": base_week * 2, "tasks": [], "deliverable": "完成核心知识学习"},
            {"week": base_week * 4, "tasks": [], "deliverable": "完成综合能力提升"},
        ]

        if weak_points:
            for wp in weak_points[:3]:
                milestones[0]["tasks"].append(f"复习{wp[0]}基础知识")
                milestones[1]["tasks"].append(f"练习{wp[0]}相关习题")
        if mistake_count > 0:
            milestones[0]["tasks"].append(f"整理错题本中{min(unmastered, 10)}道未掌握错题")
        for area in (interest_areas if isinstance(interest_areas, list) else [])[:2]:
            milestones[2]["tasks"].append(f"拓展学习{area}相关内容")
        if not milestones[0]["tasks"]:
            milestones[0]["tasks"] = ["制定每日学习计划", "复习课程核心概念"]
        if not milestones[1]["tasks"]:
            milestones[1]["tasks"] = ["完成各章节练习", "整理学习笔记"]
        if not milestones[2]["tasks"]:
            milestones[2]["tasks"] = ["综合练习与测试", "查漏补缺"]

        sequence = []
        step = 1
        if weak_points:
            for wp in weak_points[:3]:
                sequence.append({
                    "step": step,
                    "action": f"系统学习{wp[0]}（当前掌握度{wp[1]}%）",
                    "reason": f"该知识点掌握度低于及格线，是当前最薄弱环节",
                    "estimated_days": 3 if wp[1] < 40 else 2,
                })
                step += 1

        if mistake_count > 0:
            sequence.append({
                "step": step,
                "action": f"针对性复习{unmastered}道未掌握错题",
                "reason": "错题复习是最高效的提升方式，可避免重复犯错",
                "estimated_days": 2,
            })
            step += 1

        style_advice = {
            'visual': '观看视频教程和图解资料',
            'auditory': '听音频讲解和参与讨论',
            'reading': '阅读教材和参考文档',
            'kinesthetic': '动手实操和项目练习',
            'mixed': '综合运用多种学习方式',
        }
        sequence.append({
            "step": step,
            "action": style_advice.get(cognitive, '综合运用多种学习方式'),
            "reason": f"符合你的{cognitive}型认知风格，学习效率更高",
            "estimated_days": 5,
        })
        step += 1

        if courses_info:
            sequence.append({
                "step": step,
                "action": "推进在学课程的学习进度",
                "reason": "保持课程学习连续性，避免知识断层",
                "estimated_days": 7,
            })
            step += 1

        goal_action = {
            'exam': '进行模拟考试和真题训练',
            'career': '完成与职业方向相关的实践项目',
            'hobby': '深入探索感兴趣的领域',
            'research': '阅读研究文献并撰写学习报告',
        }
        sequence.append({
            "step": step,
            "action": goal_action.get(goal, '进行综合练习和测评'),
            "reason": f"与你的{goal}目标导向一致",
            "estimated_days": 5,
        })

        ability = {}
        if weak_points:
            ability["知识掌握"] = f"补强{len(weak_points)}个薄弱知识点后，整体知识掌握度预计提升{len(weak_points) * 10}%"
        else:
            ability["知识掌握"] = "在现有基础上进一步深化理解，预计掌握度提升10-15%"
        ability["问题解决"] = f"通过错题复习和专项练习，解题准确率预计提升{min(20, mistake_count)}%"
        ability["自主学习"] = "建立系统化学习方法后，自主学习效率预计提升30%"

        return {
            'title': f'个性化学习规划 - {goal}导向',
            'ai_analysis': '',
            'goals': goals,
            'milestones': milestones,
            'recommended_sequence': sequence,
            'ability_expectations': ability,
        }

    def _save_plan(self, user_id, plan_data):
        try:
            plan = LearningPlan(
                user_id=user_id,
                title=plan_data.get('title', '个性化学习规划'),
                plan_type='mid_term',
                ai_analysis=plan_data.get('ai_analysis', ''),
                generated_by='ai' if spark_is_configured() else 'local',
            )
            plan.set_goals(plan_data.get('goals', []))
            plan.set_milestones(plan_data.get('milestones', []))
            plan.set_recommended_sequence(plan_data.get('recommended_sequence', []))
            plan.set_ability_expectations(plan_data.get('ability_expectations', {}))

            total_days = sum(s.get('estimated_days', 0) for s in plan_data.get('recommended_sequence', []))
            plan.estimated_completion = datetime.utcnow() + timedelta(days=max(total_days, 7))

            db.session.add(plan)
            db.session.commit()
            return plan.to_dict()
        except Exception as e:
            logger.error(f"Save plan error: {e}", exc_info=True)
            db.session.rollback()
            return {"error": f"保存规划失败: {str(e)}"}

    def _parse_ai_response(self, response):
        if not response:
            return None

        json_str = response.strip()

        if '```json' in json_str:
            try:
                json_str = json_str.split('```json')[1].split('```')[0].strip()
            except IndexError:
                pass
        elif '```' in json_str:
            try:
                json_str = json_str.split('```')[1].split('```')[0].strip()
            except IndexError:
                pass

        json_str = json_str.strip()
        if json_str.startswith('```'):
            json_str = json_str[3:]
        if json_str.endswith('```'):
            json_str = json_str[:-3]
        json_str = json_str.strip()

        try:
            result = json.loads(json_str)
            if isinstance(result, dict):
                return result
        except json.JSONDecodeError:
            pass

        brace_pattern = re.search(r'\{[\s\S]*\}', json_str)
        if brace_pattern:
            try:
                result = json.loads(brace_pattern.group())
                if isinstance(result, dict):
                    return result
            except json.JSONDecodeError:
                pass

        bracket_brace_pattern = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', json_str)
        if bracket_brace_pattern:
            try:
                result = json.loads(bracket_brace_pattern.group())
                if isinstance(result, dict):
                    return result
            except json.JSONDecodeError:
                pass

        logger.warning(f"Failed to parse AI response as JSON, using text as analysis. Response length: {len(response)}")
        return {
            'title': '个性化学习规划',
            'ai_analysis': response[:2000] if response else 'AI分析暂不可用',
            'goals': [],
            'milestones': [],
            'recommended_sequence': [],
            'ability_expectations': {},
        }

    def get_user_plans(self, user_id):
        plans = LearningPlan.query.filter_by(user_id=user_id).order_by(
            LearningPlan.created_at.desc()
        ).all()
        return [p.to_dict() for p in plans]


class RecommendationEngine:
    def generate_recommendations(self, user_id, limit=20):
        profile = StudentProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            return {"error": "请先完成学习画像构建"}

        existing = ResourceRecommendation.query.filter_by(
            user_id=user_id, is_completed=False, is_dismissed=False
        ).order_by(ResourceRecommendation.priority, ResourceRecommendation.relevance_score.desc()).all()

        if existing and len(existing) >= 5:
            return [r.to_dict() for r in existing[:limit]]

        new_recs = self._generate_new_recommendations(user_id, profile)
        return [r.to_dict() for r in new_recs[:limit]]

    def _generate_new_recommendations(self, user_id, profile):
        recommendations = []
        profile_data = profile.to_dict()

        knowledge_base = profile_data.get('knowledge_base', {})
        error_patterns = profile_data.get('error_patterns', [])
        interest_areas = profile_data.get('interest_areas', [])
        cognitive_style = profile_data.get('cognitive_style', 'mixed')
        learning_pace = profile_data.get('learning_pace', 'moderate')
        goal_orientation = profile_data.get('goal_orientation', 'exam')

        weak_points = []
        if isinstance(knowledge_base, dict):
            weak_points = [(k, v) for k, v in knowledge_base.items()
                           if isinstance(v, (int, float)) and v < 60]
            weak_points.sort(key=lambda x: x[1])

        for subject, score in weak_points[:3]:
            rec = ResourceRecommendation(
                user_id=user_id,
                resource_type='exercise',
                title=f'{subject} 专项练习',
                description=f'针对{subject}薄弱环节的强化练习，当前掌握度{score}%',
                priority=0,
                relevance_score=round((100 - score) / 100, 2),
                reason_knowledge=f'知识基础分析：{subject}掌握度仅{score}%，低于及格线，需要重点加强',
                reason_progress=f'学习进度匹配：该内容为当前最薄弱环节，优先学习可最大程度提升整体水平',
                reason_ability=f'能力提升空间：掌握{subject}后，预计综合能力可提升{round((60-score)*0.5, 1)}%',
                reason_interest=f'兴趣偏好匹配：补强基础知识点有助于后续兴趣领域的深入学习',
                generated_by_agent='exercise_agent',
                difficulty='basic' if score < 40 else 'intermediate',
                estimated_minutes=30,
            )
            rec.set_tags([subject, '薄弱强化', '练习'])
            recommendations.append(rec)

        for subject, score in weak_points[:2]:
            rec = ResourceRecommendation(
                user_id=user_id,
                resource_type='document',
                title=f'{subject} 知识点精讲',
                description=f'系统讲解{subject}核心概念和解题方法',
                priority=1,
                relevance_score=round((100 - score) / 100 * 0.9, 2),
                reason_knowledge=f'知识关联性：{subject}基础薄弱，需要通过系统学习建立知识框架',
                reason_progress=f'学习进度匹配：建议在练习前先学习文档，建立理论基础',
                reason_ability=f'能力提升空间：理解核心概念后可举一反三，提升问题解决能力',
                reason_interest='',
                generated_by_agent='document_agent',
                difficulty='basic',
                estimated_minutes=45,
            )
            rec.set_tags([subject, '知识精讲', '文档'])
            recommendations.append(rec)

        style_resource_map = {
            'visual': ('video', '视频讲解', '媒体智能体根据你的视觉型认知风格推荐'),
            'auditory': ('video', '音频/视频讲解', '媒体智能体根据你的听觉型认知风格推荐'),
            'reading': ('document', '深度阅读材料', '文档智能体根据你的阅读型认知风格推荐'),
            'kinesthetic': ('project', '实操案例', '项目智能体根据你的实践型认知风格推荐'),
            'mixed': ('video', '多媒体学习资源', '媒体智能体推荐多种形式的学习资源'),
        }
        style_info = style_resource_map.get(cognitive_style, style_resource_map['mixed'])

        if interest_areas:
            for area in interest_areas[:2]:
                if isinstance(area, str):
                    rec = ResourceRecommendation(
                        user_id=user_id,
                        resource_type=style_info[0],
                        title=f'{area} {style_info[1]}',
                        description=f'与{area}相关的{style_info[1]}，帮助你深入理解',
                        priority=1,
                        relevance_score=0.75,
                        reason_knowledge='',
                        reason_progress='',
                        reason_ability=f'能力提升空间：拓展{area}知识可提升综合应用能力',
                        reason_interest=f'兴趣偏好匹配：{area}是你的兴趣领域，兴趣驱动的学习效率更高',
                        generated_by_agent='media_agent' if style_info[0] == 'video' else 'document_agent',
                        difficulty='intermediate',
                        estimated_minutes=40,
                    )
                    rec.set_tags([area, '兴趣拓展', style_info[0]])
                    recommendations.append(rec)

        for ep in error_patterns[:2]:
            if isinstance(ep, dict):
                point = ep.get('knowledge_point', '')
                etype = ep.get('error_type', '')
                freq = ep.get('frequency', '')
                if point:
                    rec = ResourceRecommendation(
                        user_id=user_id,
                        resource_type='exercise',
                        title=f'{point} 易错题强化',
                        description=f'针对{etype}类型错误的专项训练',
                        priority=0 if freq == '高' else 1,
                        relevance_score=0.85 if freq == '高' else 0.65,
                        reason_knowledge=f'知识关联性：{point}是你的高频易错点，需要针对性训练',
                        reason_progress='',
                        reason_ability=f'能力提升空间：克服{etype}类错误可显著提升解题准确率',
                        reason_interest='',
                        generated_by_agent='exercise_agent',
                        difficulty='intermediate',
                        estimated_minutes=25,
                    )
                    rec.set_tags([point, '易错强化', '练习'])
                    recommendations.append(rec)

        goal_rec_map = {
            'exam': ('exercise', '考试模拟题', '习题智能体根据你的考试目标推荐', 'exam_agent'),
            'career': ('project', '职业实践项目', '项目智能体根据你的职业发展目标推荐', 'project_agent'),
            'hobby': ('document', '兴趣拓展阅读', '文档智能体根据你的兴趣目标推荐', 'document_agent'),
            'research': ('document', '研究文献导读', '文档智能体根据你的研究目标推荐', 'document_agent'),
        }
        goal_info = goal_rec_map.get(goal_orientation, goal_rec_map['exam'])
        rec = ResourceRecommendation(
            user_id=user_id,
            resource_type=goal_info[0],
            title=goal_info[1],
            description=f'基于你的{goal_orientation}目标推荐的个性化资源',
            priority=2,
            relevance_score=0.6,
            reason_knowledge='',
            reason_progress='',
            reason_ability=f'能力提升空间：与你的{goal_orientation}目标直接相关，可提升目标达成能力',
            reason_interest=f'兴趣偏好匹配：{goal_info[2]}',
            generated_by_agent=goal_info[3],
            difficulty='intermediate',
            estimated_minutes=60,
        )
        rec.set_tags([goal_orientation, '目标导向'])
        recommendations.append(rec)

        recommendations.sort(key=lambda r: (r.priority, -r.relevance_score))

        for rec in recommendations:
            db.session.add(rec)
        db.session.commit()

        return recommendations

    def get_recommendations(self, user_id, resource_type=None, priority=None):
        query = ResourceRecommendation.query.filter_by(
            user_id=user_id, is_completed=False, is_dismissed=False
        )
        if resource_type:
            query = query.filter_by(resource_type=resource_type)
        if priority is not None:
            query = query.filter_by(priority=priority)
        return [r.to_dict() for r in query.order_by(
            ResourceRecommendation.priority, ResourceRecommendation.relevance_score.desc()
        ).all()]

    def complete_recommendation(self, user_id, rec_id):
        rec = ResourceRecommendation.query.filter_by(id=rec_id, user_id=user_id).first()
        if not rec:
            return {"error": "推荐不存在"}
        rec.is_completed = True
        rec.completed_at = datetime.utcnow()
        db.session.commit()
        return rec.to_dict()

    def dismiss_recommendation(self, user_id, rec_id):
        rec = ResourceRecommendation.query.filter_by(id=rec_id, user_id=user_id).first()
        if not rec:
            return {"error": "推荐不存在"}
        rec.is_dismissed = True
        db.session.commit()
        return {"status": "dismissed"}

    def feedback_recommendation(self, user_id, rec_id, score):
        rec = ResourceRecommendation.query.filter_by(id=rec_id, user_id=user_id).first()
        if not rec:
            return {"error": "推荐不存在"}
        rec.feedback_score = max(1, min(5, score))
        db.session.commit()
        return rec.to_dict()


learning_path_service = LearningPathService()
recommendation_engine = RecommendationEngine()
