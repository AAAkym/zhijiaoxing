import json
import logging
import re
from difflib import SequenceMatcher
from typing import Dict, List, Optional

from src.models.user import db
from src.models.course import MistakeRecord, Assessment, ProgrammingSubmission
from src.services.spark_service import spark_service, chat

logger = logging.getLogger(__name__)


def _jaccard_similarity(s1: str, s2: str) -> float:
    n1 = re.sub(r'[\s\p{P}]+', '', s1.lower(), flags=re.UNICODE)
    n2 = re.sub(r'[\s\p{P}]+', '', s2.lower(), flags=re.UNICODE)
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
                tags = json.loads(m.knowledge_tags) if isinstance(m.knowledge_tags, str) else m.knowledge_tags
            except (json.JSONDecodeError, TypeError):
                tags = []
        weak_tags.extend(tags)
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
    tags_text = "、".join(weak_tags) if weak_tags else "综合"

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

    return {
        'questions': deduped,
        'total': len(deduped),
        'choice_count': len([q for q in deduped if q.get('type') == 'choice']),
        'programming_count': len([q for q in deduped if q.get('type') == 'programming']),
        'weak_tags': weak_tags[:5],
        'difficulty': difficulty,
        'generated_at': __import__('datetime').datetime.utcnow().isoformat(),
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
        json_match = re.search(r'\[.*\]', result, re.DOTALL)
        if json_match:
            questions = json.loads(json_match.group(0))
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
        json_match = re.search(r'\[.*\]', result, re.DOTALL)
        if json_match:
            questions = json.loads(json_match.group(0))
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
