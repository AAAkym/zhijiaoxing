import json
import logging
import re
from difflib import SequenceMatcher
from typing import Dict, List, Optional

from src.models.user import db
from src.models.course import MistakeRecord, Assessment, ProgrammingSubmission
from src.models.ai_analysis import TargetedQuestionGroup
from src.services.spark_service import spark_service, chat

logger = logging.getLogger(__name__)


_PUNCTUATION_RE = re.compile(r'[\s\u3000-\u303f\uff00-\uffef\u2000-\u206f\u0080-\u00ff\u0021-\u002f\u003a-\u0040\u005b-\u0060\u007b-\u007e]+')


def _extract_json_array(text: str) -> List[Dict]:
    if not text:
        return []
    cleaned = text.strip()
    cleaned = re.sub(r'^```(?:json)?', '', cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'```$', '', cleaned).strip()
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, list) else [parsed] if isinstance(parsed, dict) else []
    except Exception:
        pass
    match = re.search(r'\[.*\]', cleaned, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, list) else []
        except Exception:
            pass
    return []


def _jaccard_similarity(s1: str, s2: str) -> float:
    n1 = _PUNCTUATION_RE.sub('', s1.lower())
    n2 = _PUNCTUATION_RE.sub('', s2.lower())
    if not n1 or not n2:
        return 0.0
    set1, set2 = set(n1), set(n2)
    inter = len(set1 & set2)
    union = len(set1 | set2)
    return inter / union if union > 0 else 0.0


def _is_duplicate_question(new_content: str, existing: List[str], threshold: float = 0.6) -> bool:
    for eq in existing:
        if _jaccard_similarity(new_content, eq) >= threshold:
            return True
    return False


def _collect_student_context(user_id: int, course_id: int = None) -> Dict:
    query = MistakeRecord.query.filter_by(user_id=user_id)
    if course_id:
        query = query.filter_by(course_id=course_id)
    mistakes = query.order_by(MistakeRecord.last_mistake_at.desc()).limit(30).all()

    mistake_summaries = []
    existing_contents = []
    weak_tags = []

    for m in mistakes:
        tags = []
        if m.knowledge_tags:
            try:
                raw_tags = json.loads(m.knowledge_tags) if isinstance(m.knowledge_tags, str) else m.knowledge_tags
            except (json.JSONDecodeError, TypeError):
                raw_tags = []
            for t in (raw_tags if isinstance(raw_tags, list) else [raw_tags]):
                if isinstance(t, dict):
                    tags.append(str(t.get('name', t.get('label', t.get('tag', str(t))))))
                elif t is not None:
                    tags.append(str(t).strip())
        weak_tags.extend([t for t in tags if t])
        mistake_summaries.append({
            'question_content': m.question_content or '',
            'user_answer': m.user_answer or '',
            'correct_answer': m.correct_answer or '',
            'error_type': m.error_type_auto or m.error_type_manual or 'unknown',
            'knowledge_tags': tags,
            'mastery_status': m.mastery_status,
        })
        if m.question_content:
            existing_contents.append(m.question_content)

    from collections import Counter
    tag_counter = Counter(weak_tags)
    top_weak_tags = [t for t, _ in tag_counter.most_common(10)]

    prog_subs = ProgrammingSubmission.query.filter_by(user_id=user_id)
    if course_id:
        prog_subs = prog_subs.filter_by(course_id=course_id)
    prog_subs = prog_subs.order_by(ProgrammingSubmission.created_at.desc()).limit(10).all()

    programming_context = []
    for ps in prog_subs:
        programming_context.append({
            'language': ps.language,
            'score': ps.score,
            'status': ps.status,
            'code_snippet': (ps.code or '')[:200],
        })

    return {
        'mistake_summaries': mistake_summaries,
        'existing_question_contents': existing_contents,
        'weak_tags': top_weak_tags,
        'programming_context': programming_context,
        'total_mistakes': len(mistakes),
        'unmastered_count': sum(1 for m in mistakes if m.mastery_status == 'unmastered'),
    }


def generate_mixed_question_group(
    user_id: int,
    course_id: int = None,
    choice_count: int = 5,
    programming_count: int = 2,
    difficulty: str = 'adaptive',
) -> Dict:
    ctx = _collect_student_context(user_id, course_id)
    if not ctx['mistake_summaries']:
        return {"error": "暂无错题数据，无法生成靶向题组"}

    existing = ctx['existing_question_contents']
    weak_tags = ctx['weak_tags']
    safe_tags = [str(t) for t in weak_tags if t is not None]
    tags_text = "、".join(safe_tags) if safe_tags else "综合"

    course_title = ""
    if course_id:
        course = Assessment.query.filter_by(course_id=course_id).first()
        if course:
            from src.models.course import Course
            c = Course.query.get(course_id)
            if c:
                course_title = c.title

    choice_questions = []
    if choice_count > 0:
        choice_questions = _generate_choice_questions(
            ctx, existing, weak_tags, tags_text, course_title, choice_count, difficulty
        )

    programming_questions = []
    if programming_count > 0 and ctx['programming_context']:
        programming_questions = _generate_programming_questions(
            ctx, existing, weak_tags, tags_text, course_title, programming_count, difficulty
        )

    all_questions = choice_questions + programming_questions
    deduped = _dedup_question_group(all_questions, existing)

    choice_cnt = len([q for q in deduped if q.get('type') == 'choice'])
    prog_cnt = len([q for q in deduped if q.get('type') == 'programming'])
    title = f"靶向题组 · {tags_text[:20]} · {choice_cnt}选择+{prog_cnt}编程"

    group = TargetedQuestionGroup(
        user_id=user_id,
        course_id=course_id,
        title=title,
        questions=json.dumps(deduped, ensure_ascii=False),
        weak_tags=json.dumps(weak_tags[:5], ensure_ascii=False),
        difficulty=difficulty,
        choice_count=choice_cnt,
        programming_count=prog_cnt,
        status='active',
    )
    db.session.add(group)
    db.session.commit()

    return {
        'id': group.id,
        'questions': deduped,
        'total': len(deduped),
        'choice_count': choice_cnt,
        'programming_count': prog_cnt,
        'weak_tags': weak_tags[:5],
        'difficulty': difficulty,
        'title': title,
        'generated_at': group.created_at.isoformat() if group.created_at else None,
    }


def _generate_choice_questions(ctx, existing, weak_tags, tags_text, course_title, count, difficulty):
    summaries = ctx['mistake_summaries'][:10]
    summaries_text = "\n".join([
        f"错题{i+1}: {s['question_content'][:100]} | 错误类型: {s['error_type']} | 知识点: {', '.join(s['knowledge_tags'][:3])}"
        for i, s in enumerate(summaries)
    ])
    original_text = "\n".join([f"- {q[:80]}" for q in existing[:10]])

    diff_guide = {
        'easy': '全部为基础纠偏题(easy)',
        'medium': '全部为能力巩固题(medium)',
        'hard': '全部为冲刺迁移题(hard)',
        'adaptive': f'基础纠偏(easy){max(2, count//3)}道、能力巩固(medium){max(2, count//3)}道、冲刺迁移(hard){max(1, count - 2*(count//3))}道',
    }.get(difficulty, f'混合难度，基础{count//3}道、中等{count//3}道、困难{count-count//3*2}道')

    prompt = f"""你是教育专家，根据学生错题生成靶向选择题。

课程：{course_title or '综合'}
薄弱知识点：{tags_text}

=== 原始错题（严禁重复） ===
{original_text}

=== 错题分析 ===
{summaries_text}

生成 {count} 道选择题，难度分布：{diff_guide}

【去重要求】
1. 题目内容必须全新，不得与原始错题重复或相似
2. 不得仅改写原始错题
3. 每道题考查角度必须不同
4. 四个选项互不相同且有迷惑性

【JSON格式】严格输出数组：
[{{"content": "题目", "options": ["A选项", "B选项", "C选项", "D选项"], "correctAnswer": 0, "knowledge_tags": ["标签"], "explanation": "解析", "difficulty": "easy", "type": "choice"}}]

correctAnswer是正确选项索引(0-3)。只输出JSON数组："""

    try:
        result = chat([
            {"role": "system", "content": "你是教育专家，擅长生成高质量选择题。只输出JSON数组。"},
            {"role": "user", "content": prompt},
        ])
        questions = _extract_json_array(result)
        for q in questions:
            q['type'] = 'choice'
            q['score'] = 10
        return questions
    except Exception as e:
        logger.error(f"Choice question generation failed: {e}")
    return []


def _generate_programming_questions(ctx, existing, weak_tags, tags_text, course_title, count, difficulty):
    summaries = ctx['mistake_summaries'][:5]
    prog_ctx = ctx['programming_context'][:3]

    summaries_text = "\n".join([
        f"错题{i+1}: {s['question_content'][:80]} | 知识点: {', '.join(s['knowledge_tags'][:2])}"
        for i, s in enumerate(summaries)
    ])
    lang_info = ", ".join(set(p['language'] for p in prog_ctx if p.get('language')))

    prompt = f"""你是编程教育专家，根据学生错题和编程水平生成靶向编程题。

课程：{course_title or '综合'}
薄弱知识点：{tags_text}
学生常用语言：{lang_info or 'python'}

=== 错题分析 ===
{summaries_text}

生成 {count} 道编程题，难度：{difficulty}

【去重要求】
1. 题目必须全新，不得与原始错题重复
2. 每道题考查不同知识点或技能

【JSON格式】严格输出数组：
[{{"content": "题目描述，包含输入输出要求", "starter_code": "def solution():\\n    pass", "standard_answer": "参考解答代码", "test_cases": [{{"input": "示例输入", "expected_output": "期望输出"}}], "knowledge_tags": ["标签"], "explanation": "解题思路", "difficulty": "medium", "language": "python", "type": "programming", "score": 25}}]

test_cases至少2个。只输出JSON数组："""

    try:
        result = chat([
            {"role": "system", "content": "你是编程教育专家，擅长生成高质量编程题。只输出JSON数组。"},
            {"role": "user", "content": prompt},
        ])
        questions = _extract_json_array(result)
        for q in questions:
            q['type'] = 'programming'
            q.setdefault('language', 'python')
            q.setdefault('score', 25)
            q.setdefault('starter_code', '')
            q.setdefault('test_cases', [])
            q.setdefault('standard_answer', '')
        return questions
    except Exception as e:
        logger.error(f"Programming question generation failed: {e}")
    return []


def _dedup_question_group(questions: List[Dict], existing: List[str]) -> List[Dict]:
    if not questions:
        return []
    unique = []
    seen = list(existing)
    for q in questions:
        content = q.get('content', '').strip()
        if not content:
            continue
        if not _is_duplicate_question(content, seen):
            unique.append(q)
            seen.append(content)
    logger.info(f"[靶向题组去重] 生成 {len(questions)} 道，保留 {len(unique)} 道")
    return unique


def get_programming_mistake_detail(mistake_id: int) -> Optional[Dict]:
    mistake = MistakeRecord.query.get(mistake_id)
    if not mistake:
        return None

    result = mistake.to_dict() if hasattr(mistake, 'to_dict') else {}

    if mistake.error_type_auto == 'programming_error' or mistake.assessment_id:
        submission = ProgrammingSubmission.query.filter_by(
            assessment_id=mistake.assessment_id,
            user_id=mistake.user_id,
        ).order_by(ProgrammingSubmission.created_at.desc()).first()

        if submission:
            code_diff = _build_code_diff(submission.code or '', submission.standard_answer or '')
            result['programming_detail'] = {
                'language': submission.language,
                'user_code': submission.code,
                'standard_code': submission.standard_answer,
                'score': submission.score,
                'max_score': submission.max_score,
                'status': submission.status,
                'compile_result': _safe_json_parse(submission.compile_result),
                'runtime_result': _safe_json_parse(submission.runtime_result),
                'io_match_result': _safe_json_parse(submission.io_match_result),
                'syntax_result': _safe_json_parse(submission.syntax_result),
                'logic_result': _safe_json_parse(submission.logic_result),
                'efficiency_result': _safe_json_parse(submission.efficiency_result),
                'line_comparison': _safe_json_parse(submission.line_comparison),
                'ai_feedback': _safe_json_parse(submission.ai_feedback),
                'code_diff': code_diff,
            }

    return result


def _safe_json_parse(data):
    if not data:
        return None
    if isinstance(data, dict) or isinstance(data, list):
        return data
    try:
        return json.loads(data)
    except (json.JSONDecodeError, TypeError):
        return data


def _build_code_diff(user_code: str, standard_code: str) -> List[Dict]:
    user_lines = user_code.splitlines()
    standard_lines = standard_code.splitlines()

    matcher = SequenceMatcher(None, user_lines, standard_lines)
    diff = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for k in range(i1, i2):
                diff.append({
                    'type': 'equal',
                    'line_num': k + 1,
                    'user_line': user_lines[k],
                    'standard_line': standard_lines[k - i1 + j1] if (k - i1 + j1) < len(standard_lines) else '',
                })
        elif tag == 'replace':
            max_len = max(i2 - i1, j2 - j1)
            for k in range(max_len):
                u_idx = i1 + k if (i1 + k) < i2 else None
                s_idx = j1 + k if (j1 + k) < j2 else None
                diff.append({
                    'type': 'replace',
                    'line_num': (u_idx + 1) if u_idx is not None else None,
                    'user_line': user_lines[u_idx] if u_idx is not None else '',
                    'standard_line': standard_lines[s_idx] if s_idx is not None else '',
                })
        elif tag == 'delete':
            for k in range(i1, i2):
                diff.append({
                    'type': 'delete',
                    'line_num': k + 1,
                    'user_line': user_lines[k],
                    'standard_line': '',
                })
        elif tag == 'insert':
            for k in range(j1, j2):
                diff.append({
                    'type': 'insert',
                    'line_num': None,
                    'user_line': '',
                    'standard_line': standard_lines[k],
                })

    return diff


def get_question_groups(user_id: int, course_id: int = None, status: str = None, limit: int = 20) -> List[Dict]:
    query = TargetedQuestionGroup.query.filter_by(user_id=user_id)
    if course_id:
        query = query.filter_by(course_id=course_id)
    if status:
        query = query.filter_by(status=status)
    query = query.order_by(TargetedQuestionGroup.created_at.desc())
    groups = query.limit(limit).all()
    return [g.to_dict() for g in groups]


def get_question_group_detail(group_id: int, user_id: int) -> Optional[Dict]:
    group = TargetedQuestionGroup.query.get(group_id)
    if not group or group.user_id != user_id:
        return None
    return group.to_dict(include_questions=True)


def _collect_learning_profile(user_id: int) -> Dict:
    from src.models.student_profile import StudentProfile
    profile = StudentProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        return {"has_profile": False}

    kb = profile.get_knowledge_base()
    error_patterns = profile.get_error_patterns()
    interest_areas = profile.get_interest_areas()

    return {
        "has_profile": True,
        "cognitive_style": profile.cognitive_style,
        "learning_pace": profile.learning_pace,
        "goal_orientation": profile.goal_orientation,
        "interaction_preference": profile.interaction_preference,
        "practice_trend": kb.get("_practice_trend", "unknown"),
        "avg_score": kb.get("_avg_score", 0),
        "recent_scores": kb.get("_recent_scores", []),
        "error_patterns": error_patterns[:5],
        "interest_areas": interest_areas[:5],
        "confidence_score": profile.confidence_score,
    }


def _collect_weak_points(user_id: int, course_id: int = None) -> Dict:
    from src.services.mistake_intelligence_service import build_knowledge_graph, parse_knowledge_tags
    query = MistakeRecord.query.filter_by(user_id=user_id)
    if course_id:
        query = query.filter_by(course_id=course_id)
    mistakes = query.order_by(MistakeRecord.last_mistake_at.desc()).limit(50).all()

    if not mistakes:
        return {"weak_tags": [], "mistake_summaries": [], "existing_contents": [], "total_mistakes": 0}

    weak_tags = []
    mistake_summaries = []
    existing_contents = []

    for m in mistakes:
        tags = []
        if m.knowledge_tags:
            try:
                raw_tags = json.loads(m.knowledge_tags) if isinstance(m.knowledge_tags, str) else m.knowledge_tags
            except (json.JSONDecodeError, TypeError):
                raw_tags = []
            for t in (raw_tags if isinstance(raw_tags, list) else [raw_tags]):
                if isinstance(t, dict):
                    tags.append(str(t.get('name', t.get('label', t.get('tag', str(t))))))
                elif t is not None:
                    tags.append(str(t).strip())
        weak_tags.extend([t for t in tags if t])
        mistake_summaries.append({
            'question_content': m.question_content or '',
            'user_answer': m.user_answer or '',
            'correct_answer': m.correct_answer or '',
            'error_type': m.error_type_auto or m.error_type_manual or 'unknown',
            'knowledge_tags': tags,
            'mastery_status': m.mastery_status,
            'mistake_count': m.mistake_count,
        })
        if m.question_content:
            existing_contents.append(m.question_content)

    from collections import Counter
    tag_counter = Counter(weak_tags)
    top_weak_tags = [t for t, _ in tag_counter.most_common(15)]

    return {
        "weak_tags": top_weak_tags,
        "mistake_summaries": mistake_summaries[:15],
        "existing_contents": existing_contents[:20],
        "total_mistakes": len(mistakes),
        "unmastered_count": sum(1 for m in mistakes if m.mastery_status == 'unmastered'),
    }


def _dedup_by_knowledge_point(questions: List[Dict]) -> List[Dict]:
    seen_tags = set()
    unique = []
    for q in questions:
        tags = q.get('knowledge_tags', [])
        if isinstance(tags, str):
            tags = [tags]
        if not isinstance(tags, list):
            tags = [tags] if tags else []
        tags = [str(t).strip() if t is not None else '' for t in tags]
        tags = [t for t in tags if t]
        q['knowledge_tags'] = tags
        if not tags:
            unique.append(q)
            continue
        primary_tag = tags[0]
        if primary_tag not in seen_tags:
            seen_tags.add(primary_tag)
            unique.append(q)
        else:
            secondary_overlap = any(t in seen_tags for t in tags[1:])
            if not secondary_overlap:
                unique.append(q)
                for t in tags:
                    seen_tags.add(t)
    logger.info(f"[知识点去重] 输入 {len(questions)} 道，去重后 {len(unique)} 道")
    return unique


def generate_ai_targeted_practice(
    user_id: int,
    course_id: int = None,
    question_count: int = 10,
) -> Dict:
    profile_data = _collect_learning_profile(user_id)
    weak_data = _collect_weak_points(user_id, course_id)

    if not weak_data['mistake_summaries']:
        return {"error": "暂无错题数据，无法生成靶向练习方案"}

    weak_tags = weak_data['weak_tags']
    existing_contents = weak_data['existing_contents']
    mistake_summaries = weak_data['mistake_summaries']

    safe_tags = [str(t) for t in weak_tags[:10] if t is not None]
    tags_text = "、".join(safe_tags) if safe_tags else "综合"

    course_title = ""
    if course_id:
        from src.models.course import Course
        c = Course.query.get(course_id)
        if c:
            course_title = c.title

    profile_section = ""
    if profile_data.get("has_profile"):
        pace_map = {"fast": "快速", "moderate": "适中", "slow": "缓慢", "adaptive": "自适应"}
        goal_map = {"exam": "应试备考", "career": "职业发展", "hobby": "兴趣学习", "research": "学术研究"}
        style_map = {"visual": "视觉型", "auditory": "听觉型", "kinesthetic": "动觉型", "reading": "阅读型", "mixed": "混合型"}
        inter_map = {"guided": "引导式", "exploratory": "探索式", "challenging": "挑战式"}

        profile_section = f"""
=== 学生学习画像 ===
认知风格：{style_map.get(profile_data['cognitive_style'], profile_data['cognitive_style'])}
学习节奏：{pace_map.get(profile_data['learning_pace'], profile_data['learning_pace'])}
目标导向：{goal_map.get(profile_data['goal_orientation'], profile_data['goal_orientation'])}
互动偏好：{inter_map.get(profile_data['interaction_preference'], profile_data['interaction_preference'])}
练习趋势：{profile_data.get('practice_trend', '未知')}
平均成绩：{profile_data.get('avg_score', 0)}分
近期成绩：{', '.join(str(s) for s in profile_data.get('recent_scores', [])[:5])}分
"""
        if profile_data.get('error_patterns'):
            ep_text = "；".join([
                f"{ep.get('knowledge_point', '未知')}(频率:{ep.get('frequency', '未知')})"
                for ep in profile_data['error_patterns'][:3]
            ])
            profile_section += f"易错模式：{ep_text}\n"

        if profile_data.get('interest_areas'):
            safe_interest = [str(a) for a in profile_data['interest_areas'][:3] if a is not None]
            profile_section += f"兴趣领域：{'、'.join(safe_interest)}\n"

    summaries_text = "\n".join([
        f"错题{i+1}: {s['question_content'][:100]} | 错误类型: {s['error_type']} | "
        f"掌握状态: {s['mastery_status']} | 错误次数: {s['mistake_count']} | "
        f"知识点: {', '.join(str(t) for t in s['knowledge_tags'][:3])}"
        for i, s in enumerate(mistake_summaries[:10])
    ])

    original_text = "\n".join([f"- {q[:80]}" for q in existing_contents[:10]])

    choice_count = max(5, int(question_count * 0.7))
    prog_count = question_count - choice_count

    easy_count = max(2, question_count // 3)
    medium_count = max(2, question_count // 3)
    hard_count = question_count - easy_count - medium_count

    prompt = f"""你是资深教育专家，需根据学生的完整学习数据生成个性化靶向练习题。

课程：{course_title or '综合'}
薄弱知识点：{tags_text}
{profile_section}
=== 原始错题（严禁重复或改写） ===
{original_text}

=== 错题详细分析 ===
{summaries_text}

请生成 {question_count} 道练习题，其中 {choice_count} 道选择题、{prog_count} 道编程题。
难度分布：基础纠偏(easy){easy_count}道、能力巩固(medium){medium_count}道、冲刺迁移(hard){hard_count}道

【核心要求 - 必须严格遵守】
1. 所有题目必须全新原创，严禁与原始错题重复或相似
2. 严禁仅改写原始错题的文字来生成新题
3. 每道题的考查知识点必须不同，禁止相同知识点出现多道题
4. 选择题四个选项必须互不相同且具有迷惑性
5. 编程题必须包含完整的测试用例和参考解答
6. 每道题必须包含详尽的解析说明

【选择题JSON格式】
{{"content": "题干内容", "options": ["选项A的具体内容描述", "选项B的具体内容描述", "选项C的具体内容描述", "选项D的具体内容描述"], "correctAnswer": 0, "knowledge_tags": ["知识点标签"], "explanation": "详细解析，包含解题思路和知识点说明", "difficulty": "easy", "type": "choice", "question_type": "choice"}}

【编程题JSON格式】
{{"content": "题目描述，包含输入输出要求", "starter_code": "def solution():\\n    pass", "standard_answer": "参考解答代码", "test_cases": [{{"input": "示例输入", "expected_output": "期望输出"}}], "knowledge_tags": ["知识点标签"], "explanation": "解题思路和算法说明", "difficulty": "medium", "language": "python", "type": "programming", "question_type": "programming"}}

【选项格式严格要求】
- options数组必须恰好4个元素
- 每个选项必须是具体的知识内容描述，如"使用for循环遍历列表"
- 绝对禁止使用占位文本如"选项A"、"选项B"、"A"、"B"等
- 绝对禁止选项内容重复
- correctAnswer是正确选项索引(0-3)。test_cases至少2个。
严格输出JSON数组，不要有任何其他文字："""

    try:
        result = chat([
            {"role": "system", "content": "你是资深教育专家，擅长根据学生画像生成个性化靶向练习题。只输出JSON数组。"},
            {"role": "user", "content": prompt},
        ])
        questions = _extract_json_array(result)
        if not questions:
            logger.warning(f"[靶向练习] AI返回内容无法解析为JSON数组, 前200字符: {result[:200]}")
            return {"error": "AI生成结果解析失败，请重试"}

        validated = []
        for q in questions:
            if not isinstance(q, dict):
                continue
            if not q.get('content'):
                continue
            q.setdefault('type', 'choice')
            q.setdefault('question_type', q.get('type', 'choice'))
            q.setdefault('knowledge_tags', [])
            q.setdefault('explanation', '')
            q.setdefault('difficulty', 'medium')
            if q['type'] == 'choice':
                if not isinstance(q.get('options'), list) or len(q.get('options', [])) < 2:
                    continue
                opts = q['options']
                if len(opts) < 4:
                    continue
                placeholder_patterns = ['选项A', '选项B', '选项C', '选项D', '选项E', '选项F']
                has_placeholder = any(
                    isinstance(o, str) and (o.strip().upper() in ['A', 'B', 'C', 'D'] or any(p in o for p in placeholder_patterns))
                    for o in opts
                )
                if has_placeholder:
                    logger.warning(f"[靶向练习] 过滤掉含占位选项的题目: {q.get('content', '')[:50]}")
                    continue
                if len(set(str(o).strip() for o in opts)) < len(opts):
                    logger.warning(f"[靶向练习] 过滤掉选项重复的题目: {q.get('content', '')[:50]}")
                    continue
                if isinstance(q.get('correctAnswer'), int) and (q['correctAnswer'] < 0 or q['correctAnswer'] >= len(opts)):
                    q['correctAnswer'] = 0
                q.setdefault('correctAnswer', 0)
                q.setdefault('score', 10)
            elif q['type'] == 'programming':
                q.setdefault('language', 'python')
                q.setdefault('score', 25)
                q.setdefault('starter_code', '')
                q.setdefault('test_cases', [])
                q.setdefault('standard_answer', '')
            validated.append(q)

        deduped = _dedup_question_group(validated, existing_contents)
        deduped = _dedup_by_knowledge_point(deduped)

        choice_questions = [q for q in deduped if q.get('type') == 'choice']
        prog_questions = [q for q in deduped if q.get('type') == 'programming']

        phase_template = [
            {"phase": 1, "name": "基础纠偏", "difficulty": "easy", "ratio": 0.4},
            {"phase": 2, "name": "能力巩固", "difficulty": "medium", "ratio": 0.4},
            {"phase": 3, "name": "冲刺迁移", "difficulty": "hard", "ratio": 0.2},
        ]

        for q in deduped:
            diff = q.get('difficulty', 'medium')
            if diff == 'easy':
                q['phase'] = 1
                q['phase_name'] = '基础纠偏'
            elif diff == 'hard':
                q['phase'] = 3
                q['phase_name'] = '冲刺迁移'
            else:
                q['phase'] = 2
                q['phase_name'] = '能力巩固'
            q['matched_tags'] = q.get('knowledge_tags', [])
            q['match_score'] = 10

        stage_plan = []
        for phase_info in phase_template:
            phase_qs = [q for q in deduped if q.get('phase') == phase_info['phase']]
            if not phase_qs:
                continue
            focus_tags = []
            for q in phase_qs:
                focus_tags.extend(q.get('knowledge_tags', []))
            from collections import Counter
            tag_counter = Counter(focus_tags)
            stage_plan.append({
                "phase": phase_info['phase'],
                "name": phase_info['name'],
                "difficulty": phase_info['difficulty'],
                "question_count": len(phase_qs),
                "focus_tags": [t for t, _ in tag_counter.most_common(4)],
                "goal": {
                    1: "先纠正高频错误并重建概念锚点",
                    2: "在中等难度下稳定正确率与解题步骤",
                    3: "通过综合题提升迁移与抗干扰能力",
                }.get(phase_info['phase'], "强化训练"),
            })

        total_mistakes = weak_data['total_mistakes']
        unmastered = weak_data['unmastered_count']
        baseline = round((total_mistakes - unmastered) / total_mistakes * 100, 2) if total_mistakes else 0.0

        return {
            "target_tags": weak_tags[:8],
            "recommended_questions": deduped,
            "stage_plan": stage_plan,
            "plan_metrics": {
                "question_total": len(deduped),
                "target_tag_count": len(weak_tags[:8]),
                "baseline_effectiveness": baseline,
                "expected_improvement": min(25.0, round(len(weak_tags[:8]) * 2.2 + len(stage_plan) * 1.5, 2)),
            },
            "profile_used": profile_data.get("has_profile", False),
            "ai_generated": True,
        }
    except Exception as e:
        logger.error(f"AI靶向练习生成失败: {e}")
        return {"error": f"AI生成失败: {str(e)}"}
