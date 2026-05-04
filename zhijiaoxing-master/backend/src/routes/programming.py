import difflib
import json
import logging
import os
import re
import subprocess
import tempfile
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from flask import Blueprint, jsonify, request, session

from src.models.course import Assessment, Course, MistakeRecord, ProgrammingSubmission
from src.models.user import db
from src.services.spark_service import spark_service

logger = logging.getLogger(__name__)
programming_bp = Blueprint('programming', __name__)


SUPPORTED_LANGUAGES = ['python', 'javascript', 'java', 'cpp', 'c']
RUNNABLE_LANGUAGES = {'python', 'javascript'}
MAX_QUESTION_COUNT = 20


def require_auth(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


def require_teacher(f):
    def decorated_function(*args, **kwargs):
        if session.get('user_role') not in ('teacher', 'admin'):
            return jsonify({'error': 'Teacher access required'}), 403
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


def _safe_json(value: Any, default: Any):
    if value is None:
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _extract_json_array(text: str) -> List[Dict[str, Any]]:
    if not text:
        return []
    cleaned = text.strip()
    cleaned = re.sub(r'^```(?:json)?', '', cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r'```$', '', cleaned).strip()
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, list) else [parsed]
    except Exception:
        pass
    match = re.search(r'\[.*\]', cleaned, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return []
    return []


FALLBACK_TEMPLATES = [
    {
        'title_template': '{topic}基础输入输出',
        'description_template': '请编写程序，读入若干整数并输出它们的和。',
        'input_format': '第一行输入整数 n，第二行输入 n 个整数，以空格分隔。',
        'output_format': '输出一个整数，表示所有输入整数的和。',
        'constraints': '1 <= n <= 1000，整数绝对值不超过 10^6。',
        'samples': [{'input': '5\n1 2 3 4 5\n', 'output': '15\n', 'explanation': '1+2+3+4+5=15'}],
        'test_cases': [{'input': '3\n2 4 6\n', 'output': '12\n'}, {'input': '1\n-7\n', 'output': '-7\n'}],
        'standard_answer': 'n = int(input())\nnums = list(map(int, input().split()))\nprint(sum(nums[:n]))\n',
        'knowledge_tags': ['{topic}', '输入输出', '基础运算'],
        'explanation_template': '本题考查{topic}的基本输入输出和累加操作。解题思路：1)读取整数n 2)读取n个整数 3)使用sum函数累加并输出。时间复杂度O(n)，空间复杂度O(n)。',
        'difficulty': 'easy',
    },
    {
        'title_template': '{topic}数据处理与统计',
        'description_template': '请编写程序，读入一组数据，找出其中的最大值、最小值并计算平均值。',
        'input_format': '第一行输入整数 n，第二行输入 n 个整数，以空格分隔。',
        'output_format': '输出三个数，分别为最大值、最小值和平均值（保留2位小数），以空格分隔。',
        'constraints': '1 <= n <= 10000，整数绝对值不超过 10^9。',
        'samples': [{'input': '5\n1 5 3 9 2\n', 'output': '9 1 4.00\n', 'explanation': '最大值9，最小值1，平均值(1+5+3+9+2)/5=4.00'}],
        'test_cases': [{'input': '4\n-1 -5 -3 -9\n', 'output': '-1 -9 -4.50\n'}, {'input': '3\n10 20 30\n', 'output': '30 10 20.00\n'}],
        'standard_answer': 'n = int(input())\nnums = list(map(int, input().split()))\nprint(max(nums), min(nums), f"{sum(nums)/len(nums):.2f}")\n',
        'knowledge_tags': ['{topic}', '统计', '遍历'],
        'explanation_template': '本题考查{topic}的数据统计能力。解题思路：1)读取数据 2)使用max/min/sum函数统计 3)格式化输出。时间复杂度O(n)，空间复杂度O(n)。',
        'difficulty': 'easy',
    },
    {
        'title_template': '{topic}字符串处理',
        'description_template': '请编写程序，读入一个字符串，统计其中各字符出现的次数，并按字符ASCII码升序输出。',
        'input_format': '一行输入一个字符串（长度不超过1000）。',
        'output_format': '每行输出一个字符及其出现次数，格式为"字符:次数"，按ASCII码升序排列。',
        'constraints': '字符串长度 1 <= len <= 1000，仅含小写字母。',
        'samples': [{'input': 'abacabad\n', 'output': 'a:4\nb:2\nc:1\nd:1\n', 'explanation': 'a出现4次，b出现2次，c和d各1次'}],
        'test_cases': [{'input': 'hello\n', 'output': 'e:1\nh:1\nl:2\no:1\n'}, {'input': 'aaa\n', 'output': 'a:3\n'}],
        'standard_answer': 's = input().strip()\nfrom collections import Counter\nc = Counter(s)\nfor ch in sorted(c.keys()):\n    print(f"{ch}:{c[ch]}")\n',
        'knowledge_tags': ['{topic}', '字符串', '哈希表'],
        'explanation_template': '本题考查{topic}的字符串处理和哈希表使用。解题思路：1)读取字符串 2)使用Counter统计频率 3)按ASCII排序输出。时间复杂度O(nlogn)，空间复杂度O(n)。',
        'difficulty': 'medium',
    },
    {
        'title_template': '{topic}排序与查找',
        'description_template': '请编写程序，读入n个整数，先排序，然后查找某个目标值是否存在，输出其位置（从1开始），不存在则输出-1。',
        'input_format': '第一行输入整数 n，第二行输入 n 个整数，第三行输入目标值 target。',
        'output_format': '输出目标值的位置（从1开始），不存在则输出 -1。',
        'constraints': '1 <= n <= 10^5，整数绝对值不超过 10^9。',
        'samples': [{'input': '5\n3 1 4 1 5\n1\n', 'output': '1\n', 'explanation': '排序后为1 1 3 4 5，第一个1在位置1'}],
        'test_cases': [{'input': '4\n5 3 1 2\n4\n', 'output': '-1\n'}, {'input': '3\n1 2 3\n3\n', 'output': '3\n'}],
        'standard_answer': 'n = int(input())\nnums = sorted(map(int, input().split()))\ntarget = int(input())\ntry:\n    print(nums.index(target) + 1)\nexcept ValueError:\n    print(-1)\n',
        'knowledge_tags': ['{topic}', '排序', '二分查找'],
        'explanation_template': '本题考查{topic}的排序和查找能力。解题思路：1)读取并排序数据 2)使用二分查找定位目标值 3)输出位置。时间复杂度O(nlogn)，空间复杂度O(n)。',
        'difficulty': 'medium',
    },
    {
        'title_template': '{topic}动态规划',
        'description_template': '请编写程序，读入n个整数，求其最大子数组和（连续子数组的和的最大值）。',
        'input_format': '第一行输入整数 n，第二行输入 n 个整数，以空格分隔。',
        'output_format': '输出一个整数，表示最大子数组和。',
        'constraints': '1 <= n <= 10^5，整数绝对值不超过 10^4。',
        'samples': [{'input': '8\n-2 1 -3 4 -1 2 1 -5\n', 'output': '6\n', 'explanation': '最大子数组为[4,-1,2,1]，和为6'}],
        'test_cases': [{'input': '5\n-1 -2 -3 -4 -5\n', 'output': '-1\n'}, {'input': '3\n1 2 3\n', 'output': '6\n'}],
        'standard_answer': 'n = int(input())\nnums = list(map(int, input().split()))\ncur_max = global_max = nums[0]\nfor x in nums[1:]:\n    cur_max = max(x, cur_max + x)\n    global_max = max(global_max, cur_max)\nprint(global_max)\n',
        'knowledge_tags': ['{topic}', '动态规划', 'Kadane算法'],
        'explanation_template': '本题考查{topic}的动态规划能力（Kadane算法）。解题思路：1)维护当前子数组和与全局最大值 2)每步决定是否重新开始 3)更新全局最大值。时间复杂度O(n)，空间复杂度O(1)。',
        'difficulty': 'hard',
    },
    {
        'title_template': '{topic}递归与回溯',
        'description_template': '请编写程序，读入整数 n，输出1到n的所有排列，按字典序排列，每个排列占一行。',
        'input_format': '一行输入整数 n。',
        'output_format': '输出所有排列，每个排列中的数字以空格分隔，按字典序排列。',
        'constraints': '1 <= n <= 6。',
        'samples': [{'input': '3\n', 'output': '1 2 3\n1 3 2\n2 1 3\n2 3 1\n3 1 2\n3 2 1\n', 'explanation': '3的全排列共6种'}],
        'test_cases': [{'input': '2\n', 'output': '1 2\n2 1\n'}, {'input': '1\n', 'output': '1\n'}],
        'standard_answer': 'from itertools import permutations\nn = int(input())\nfor p in permutations(range(1, n+1)):\n    print(" ".join(map(str, p)))\n',
        'knowledge_tags': ['{topic}', '递归', '回溯', '排列'],
        'explanation_template': '本题考查{topic}的递归与回溯能力。解题思路：1)使用回溯法生成全排列 2)按字典序输出 3)注意剪枝和状态恢复。时间复杂度O(n!)，空间复杂度O(n)。',
        'difficulty': 'hard',
    },
    {
        'title_template': '{topic}栈与队列应用',
        'description_template': '请编写程序，读入一个仅含括号的字符串，判断括号是否匹配。括号类型包括()、[]、{}。',
        'input_format': '一行输入一个仅含括号的字符串。',
        'output_format': '如果括号匹配输出"yes"，否则输出"no"。',
        'constraints': '字符串长度 1 <= len <= 10000。',
        'samples': [{'input': '([]{})\n', 'output': 'yes\n', 'explanation': '括号完全匹配'}, {'input': '([)]\n', 'output': 'no\n', 'explanation': '括号交叉不匹配'}],
        'test_cases': [{'input': '()[]{}\n', 'output': 'yes\n'}, {'input': '((\n', 'output': 'no\n'}],
        'standard_answer': 's = input().strip()\nstack = []\npairs = {")": "(", "]": "[", "}": "{"}\nresult = "yes"\nfor ch in s:\n    if ch in "([{":\n        stack.append(ch)\n    elif ch in pairs:\n        if not stack or stack.pop() != pairs[ch]:\n            result = "no"\n            break\nif stack:\n    result = "no"\nprint(result)\n',
        'knowledge_tags': ['{topic}', '栈', '括号匹配'],
        'explanation_template': '本题考查{topic}的栈应用能力。解题思路：1)使用栈存储左括号 2)遇到右括号时检查栈顶是否匹配 3)最终栈为空则匹配。时间复杂度O(n)，空间复杂度O(n)。',
        'difficulty': 'medium',
    },
    {
        'title_template': '{topic}图论基础',
        'description_template': '请编写程序，读入n个节点m条边的无向图，使用BFS从节点1出发，输出所有可达节点的编号（按BFS访问顺序）。',
        'input_format': '第一行输入两个整数 n 和 m，接下来 m 行每行输入两个整数 u 和 v 表示一条边。',
        'output_format': '输出一行，包含所有从节点1可达的节点编号，以空格分隔。',
        'constraints': '1 <= n <= 1000, 0 <= m <= n*(n-1)/2, 1 <= u,v <= n。',
        'samples': [{'input': '4 4\n1 2\n1 3\n2 4\n3 4\n', 'output': '1 2 3 4\n', 'explanation': '从节点1出发BFS，依次访问1,2,3,4'}],
        'test_cases': [{'input': '3 1\n2 3\n', 'output': '1\n'}, {'input': '3 2\n1 2\n2 3\n', 'output': '1 2 3\n'}],
        'standard_answer': 'from collections import deque\nn, m = map(int, input().split())\nadj = [[] for _ in range(n+1)]\nfor _ in range(m):\n    u, v = map(int, input().split())\n    adj[u].append(v)\n    adj[v].append(u)\nvisited = [False]*(n+1)\nvisited[1] = True\nq = deque([1])\nresult = []\nwhile q:\n    node = q.popleft()\n    result.append(str(node))\n    for nb in adj[node]:\n        if not visited[nb]:\n            visited[nb] = True\n            q.append(nb)\nprint(" ".join(result))\n',
        'knowledge_tags': ['{topic}', '图论', 'BFS'],
        'explanation_template': '本题考查{topic}的图论基础和BFS遍历能力。解题思路：1)构建邻接表 2)从节点1开始BFS 3)记录访问顺序。时间复杂度O(n+m)，空间复杂度O(n+m)。',
        'difficulty': 'hard',
    },
    {
        'title_template': '{topic}贪心算法',
        'description_template': '请编写程序，读入n个活动的开始和结束时间，求最多能参加多少个不重叠的活动。',
        'input_format': '第一行输入整数 n，接下来 n 行每行输入两个整数 s 和 e 表示活动的开始和结束时间。',
        'output_format': '输出一个整数，表示最多能参加的活动数。',
        'constraints': '1 <= n <= 10^5, 0 <= s < e <= 10^9。',
        'samples': [{'input': '3\n1 3\n2 5\n3 6\n', 'output': '2\n', 'explanation': '选择活动(1,3)和(3,6)，共2个'}],
        'test_cases': [{'input': '4\n1 2\n2 3\n3 4\n4 5\n', 'output': '4\n'}, {'input': '2\n1 5\n2 4\n', 'output': '1\n'}],
        'standard_answer': 'n = int(input())\nactivities = []\nfor _ in range(n):\n    s, e = map(int, input().split())\n    activities.append((s, e))\nactivities.sort(key=lambda x: x[1])\ncount = 0\nend = -1\nfor s, e in activities:\n    if s >= end:\n        count += 1\n        end = e\nprint(count)\n',
        'knowledge_tags': ['{topic}', '贪心', '区间调度'],
        'explanation_template': '本题考查{topic}的贪心算法能力（活动选择问题）。解题思路：1)按结束时间排序 2)贪心选择最早结束的活动 3)更新结束时间。时间复杂度O(nlogn)，空间复杂度O(n)。',
        'difficulty': 'medium',
    },
    {
        'title_template': '{topic}数学与数论',
        'description_template': '请编写程序，读入一个正整数 n，判断其是否为质数，如果是质数输出"prime"，否则输出"not prime"。',
        'input_format': '一行输入一个正整数 n。',
        'output_format': '输出"prime"或"not prime"。',
        'constraints': '2 <= n <= 10^12。',
        'samples': [{'input': '7\n', 'output': 'prime\n', 'explanation': '7是质数'}, {'input': '12\n', 'output': 'not prime\n', 'explanation': '12=2*6不是质数'}],
        'test_cases': [{'input': '2\n', 'output': 'prime\n'}, {'input': '1\n', 'output': 'not prime\n'}],
        'standard_answer': 'n = int(input())\nif n < 2:\n    print("not prime")\nelse:\n    i = 2\n    is_prime = True\n    while i * i <= n:\n        if n % i == 0:\n            is_prime = False\n            break\n        i += 1\n    print("prime" if is_prime else "not prime")\n',
        'knowledge_tags': ['{topic}', '数论', '质数判定'],
        'explanation_template': '本题考查{topic}的数论基础和质数判定能力。解题思路：1)特判n<2 2)试除法判断 3)只需检查到sqrt(n)。时间复杂度O(sqrt(n))，空间复杂度O(1)。',
        'difficulty': 'easy',
    },
]


def _fallback_question(topic: str, difficulty: str, language: str, index: int = 0) -> Dict[str, Any]:
    template_index = index % len(FALLBACK_TEMPLATES)
    tpl = FALLBACK_TEMPLATES[template_index]
    title = tpl['title_template'].format(topic=topic)
    description = tpl['description_template'].format(topic=topic)
    explanation = tpl['explanation_template'].format(topic=topic)
    knowledge_tags = [tag.format(topic=topic) for tag in tpl['knowledge_tags']]
    return {
        'id': index + 1,
        'type': 'programming',
        'title': title,
        'question': title,
        'description': description,
        'input_format': tpl['input_format'],
        'output_format': tpl['output_format'],
        'constraints': tpl['constraints'],
        'samples': tpl['samples'],
        'test_cases': tpl['test_cases'],
        'difficulty': tpl.get('difficulty') or difficulty or 'medium',
        'language': language or 'python',
        'score': 100,
        'standard_answer': tpl['standard_answer'],
        'knowledge_tags': knowledge_tags,
        'explanation': explanation,
    }


def _normalize_question(raw: Dict[str, Any], idx: int, topic: str, difficulty: str, language: str) -> Dict[str, Any]:
    fallback = _fallback_question(topic, difficulty, language, idx)
    if not raw or not isinstance(raw, dict):
        return fallback
    q = {}
    q['id'] = idx + 1
    q['type'] = 'programming'
    q['title'] = raw.get('title') or raw.get('question') or fallback['title']
    q['question'] = raw.get('question') or raw.get('title') or q['title']
    q['description'] = raw.get('description') or raw.get('content') or fallback['description']
    q['input_format'] = raw.get('input_format') or raw.get('inputFormat') or fallback['input_format']
    q['output_format'] = raw.get('output_format') or raw.get('outputFormat') or fallback['output_format']
    q['constraints'] = raw.get('constraints') or fallback['constraints']
    raw_samples = raw.get('samples')
    q['samples'] = raw_samples if isinstance(raw_samples, list) and len(raw_samples) > 0 else fallback['samples']
    raw_test_cases = raw.get('test_cases')
    q['test_cases'] = raw_test_cases if isinstance(raw_test_cases, list) and len(raw_test_cases) > 0 else fallback['test_cases']
    q['standard_answer'] = raw.get('standard_answer') or raw.get('reference_answer') or raw.get('answer') or fallback['standard_answer']
    q['difficulty'] = raw.get('difficulty') or difficulty or 'medium'
    q['language'] = raw.get('language') or language or 'python'
    q['score'] = int(raw.get('score') or 100)
    q['explanation'] = raw.get('explanation') or raw.get('analysis') or fallback['explanation']
    raw_tags = raw.get('knowledge_tags')
    q['knowledge_tags'] = raw_tags if isinstance(raw_tags, list) and len(raw_tags) > 0 else fallback['knowledge_tags']
    return q


def _deduplicate_questions(questions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not questions:
        return questions
    seen = set()
    unique = []
    for q in questions:
        title_key = (q.get('title') or '').strip().lower()[:80]
        desc_key = (q.get('description') or '').strip().lower()[:80]
        key = (title_key, desc_key)
        if key in seen:
            continue
        if title_key or desc_key:
            seen.add(key)
        unique.append(q)
    return unique


def _build_programming_prompt(course: Course, topic: str, difficulty: str, language: str, question_count: int) -> str:
    contents = []
    for item in getattr(course, 'teaching_contents', [])[:5]:
        contents.append(f'- {item.title}: {(item.content or "")[:400]}')
    course_context = '\n'.join(contents) or (course.description or '')
    return f"""你是资深 OJ 编程题命题教师。请基于课程内容和考试主题生成 {question_count} 道编程题。
课程名称：{course.title}
课程简介：{course.description or ''}
课程内容摘要：
{course_context[:2500]}

考试主题：{topic}
目标难度：{difficulty}
参考答案语言：{language}

【重要要求】
1. 必须生成恰好 {question_count} 道不同的编程题，每道题有不同的题目场景和核心算法
2. 题目难度应覆盖从简单到困难：至少1道easy、2道medium、1道hard，其余自由分配
3. 每道题必须包含详细的解析（explanation字段），说明解题思路、算法原理、时间复杂度和关键步骤
4. 每道题的test_cases至少包含2个非样例的测试用例，覆盖边界情况和正常情况
5. 严禁生成重复或高度相似的题目，每道题的title和description必须不同

请严格输出 JSON 数组，不要输出 Markdown。每道题必须包含：
title, description, input_format, output_format, constraints, samples, test_cases, difficulty, knowledge_tags, standard_answer, score, explanation。
samples/test_cases 的元素格式为 {{"input":"...","output":"...","explanation":"..."}}。
explanation 字段应包含：1)解题思路 2)算法步骤 3)时间/空间复杂度分析 4)易错点提示。
题目风格参考主流 OJ 平台，描述清晰，输入输出可判定，标准答案可直接运行。"""


def _validate_question_count(count_value) -> int:
    try:
        count = int(count_value)
    except (TypeError, ValueError):
        return 1
    if count < 1:
        return 1
    if count > MAX_QUESTION_COUNT:
        return MAX_QUESTION_COUNT
    return count


@programming_bp.route('/programming/generate', methods=['POST'])
@require_auth
@require_teacher
def generate_programming_assessment():
    try:
        data = request.get_json() or {}
        course_id = data.get('course_id')
        topic = (data.get('topic') or '').strip()
        if not course_id or not topic:
            return jsonify({'error': 'course_id and topic are required'}), 400
        course = Course.query.get(course_id)
        if not course:
            return jsonify({'error': 'Course not found'}), 404
        if session.get('user_role') == 'teacher' and course.teacher_id != session.get('user_id'):
            return jsonify({'error': 'Permission denied'}), 403

        difficulty = data.get('difficulty') or 'medium'
        language = data.get('language') or 'python'
        question_count = _validate_question_count(data.get('question_count'))
        prompt = _build_programming_prompt(course, topic, difficulty, language, question_count)

        parsed = []
        raw = ''
        try:
            raw = spark_service.chat(prompt)
            parsed = _extract_json_array(raw)
            logger.info('AI returned %d items for request of %d questions', len(parsed), question_count)
        except Exception as exc:
            logger.warning('AI programming generation failed, using fallback: %s', exc)

        questions = [
            _normalize_question(item, idx, topic, difficulty, language)
            for idx, item in enumerate(parsed[:question_count * 2])
        ]
        questions = _deduplicate_questions(questions)

        if len(questions) < question_count:
            existing_indices = set()
            for q in questions:
                for i, tpl in enumerate(FALLBACK_TEMPLATES):
                    if tpl['title_template'].format(topic=topic) == q.get('title'):
                        existing_indices.add(i)
            fill_idx = 0
            while len(questions) < question_count:
                tpl_idx = fill_idx % len(FALLBACK_TEMPLATES)
                if tpl_idx not in existing_indices:
                    fb = _fallback_question(topic, difficulty, language, len(questions))
                    questions.append(fb)
                else:
                    fb = _fallback_question(topic, difficulty, language, tpl_idx + len(FALLBACK_TEMPLATES))
                    fb['id'] = len(questions) + 1
                    questions.append(fb)
                fill_idx += 1

        questions = questions[:question_count]

        for i, q in enumerate(questions):
            q['id'] = i + 1

        title = data.get('title') or f'{topic}编程题'
        assessment = Assessment(
            course_id=course.id,
            title=title,
            questions=json.dumps(questions, ensure_ascii=False),
            answers=json.dumps([q['standard_answer'] for q in questions], ensure_ascii=False),
            generated_by_llm=True,
        )
        db.session.add(assessment)
        db.session.commit()

        logger.info('Generated %d programming questions for topic "%s"', len(questions), topic)
        return jsonify({
            'message': 'Programming assessment generated',
            'assessment': assessment.to_dict(),
            'questions': questions,
            'generated_count': len(questions),
            'requested_count': question_count,
            'raw_output': raw if not parsed else None,
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.error('Generate programming assessment error: %s', e)
        return jsonify({'error': str(e)}), 500


def _get_programming_question(assessment: Assessment, question_index: int) -> Dict[str, Any]:
    questions = _safe_json(assessment.questions, [])
    if not isinstance(questions, list) or question_index < 0 or question_index >= len(questions):
        raise ValueError('Programming question not found')
    question = questions[question_index]
    if not isinstance(question, dict) or question.get('type') != 'programming':
        raise ValueError('Question is not a programming question')
    return question


def _run_code(language: str, code: str, test_cases: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if language not in RUNNABLE_LANGUAGES:
        return [], {'passed': False, 'message': f'{language} 暂未配置本地编译/运行器，已跳过真实运行验证。'}
    suffix = '.py' if language == 'python' else '.js'
    command = ['python'] if language == 'python' else ['node']
    results = []
    with tempfile.NamedTemporaryFile('w', suffix=suffix, delete=False, encoding='utf-8') as tmp:
        tmp.write(code)
        path = tmp.name
    try:
        for i, case in enumerate(test_cases[:8]):
            expected = str(case.get('output', '')).strip()
            proc = subprocess.run(
                command + [path],
                input=str(case.get('input', '')),
                capture_output=True,
                text=True,
                timeout=3,
                encoding='utf-8',
                errors='replace',
            )
            actual = (proc.stdout or '').strip()
            passed = proc.returncode == 0 and actual == expected
            results.append({
                'index': i,
                'input': case.get('input', ''),
                'expected_output': expected,
                'actual_output': actual,
                'stderr': (proc.stderr or '').strip()[:1000],
                'return_code': proc.returncode,
                'passed': passed,
            })
    except subprocess.TimeoutExpired:
        results.append({'passed': False, 'error': '运行超时'})
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
    passed_count = len([r for r in results if r.get('passed')])
    return results, {'passed': passed_count == len(results) and len(results) > 0, 'passed_count': passed_count, 'total': len(results)}


def _line_compare(code: str, standard: str) -> List[Dict[str, Any]]:
    diff = difflib.ndiff((standard or '').splitlines(), (code or '').splitlines())
    rows = []
    for line in diff:
        marker = line[:2]
        if marker == '  ':
            kind = 'same'
        elif marker == '- ':
            kind = 'missing_from_student'
        elif marker == '+ ':
            kind = 'extra_in_student'
        else:
            continue
        rows.append({'type': kind, 'content': line[2:]})
    return rows[:200]


def _static_code_metrics(code: str, standard: str) -> Dict[str, float]:
    code_lines = [l.strip() for l in code.splitlines() if l.strip()]
    std_lines = [l.strip() for l in (standard or '').splitlines() if l.strip()]
    similarity = difflib.SequenceMatcher(None, '\n'.join(code_lines), '\n'.join(std_lines)).ratio() if std_lines else 0.0
    has_io = any(token in code for token in ['input', 'scanf', 'cin', 'readLine', 'readline']) and any(token in code for token in ['print', 'printf', 'cout', 'console.log'])
    has_control = any(token in code for token in ['for ', 'while ', 'if ', 'for(', 'while(', 'if('])
    return {
        'similarity': round(similarity, 3),
        'has_io': 1.0 if has_io else 0.0,
        'has_control': 1.0 if has_control else 0.0,
        'line_balance': min(1.0, len(code_lines) / max(1, len(std_lines))) if std_lines else 0.5,
    }


def _score_submission(question: Dict[str, Any], code: str, language: str) -> Dict[str, Any]:
    standard = question.get('standard_answer') or ''
    test_cases = question.get('test_cases') or question.get('samples') or []
    run_results, runtime_summary = _run_code(language, code, test_cases if isinstance(test_cases, list) else [])
    metrics = _static_code_metrics(code, standard)

    io_score = 100.0
    if run_results:
        io_score = round((len([r for r in run_results if r.get('passed')]) / len(run_results)) * 100, 2)
    elif language not in RUNNABLE_LANGUAGES:
        io_score = 55.0 if metrics['has_io'] else 35.0

    syntax_score = 100.0
    if run_results and any(r.get('return_code', 0) != 0 or r.get('error') for r in run_results):
        syntax_score = 45.0
    elif not code.strip():
        syntax_score = 0.0

    logic_score = round((metrics['similarity'] * 55) + (metrics['has_control'] * 20) + (metrics['line_balance'] * 25), 2)
    efficiency_score = 80.0 if metrics['has_control'] else 60.0
    if len(code) > max(2000, len(standard) * 4):
        efficiency_score -= 15

    weights = {'compile': 0.15, 'io': 0.35, 'syntax': 0.15, 'logic': 0.25, 'efficiency': 0.10}
    compile_score = 55.0 if language not in RUNNABLE_LANGUAGES else (100.0 if (not run_results or all(not r.get('stderr') for r in run_results)) else 55.0)
    total = round(
        compile_score * weights['compile'] +
        io_score * weights['io'] +
        syntax_score * weights['syntax'] +
        logic_score * weights['logic'] +
        efficiency_score * weights['efficiency'],
        2,
    )
    if run_results and io_score == 100:
        total = max(total, 92.0)

    feedback = {
        'summary': '代码通过主要样例。' if total >= 90 else '代码仍需修改，重点检查输入输出、核心逻辑和边界条件。',
        'improvement_suggestions': [
            '先用题目样例逐步核对实际输出与期望输出。',
            '对照参考答案检查输入读取、循环边界和结果输出位置。',
            '补充最小值、单元素、负数或边界规模等测试用例。',
        ],
        'metrics': metrics,
    }

    ai_analysis = _ai_code_analysis(question, code, standard, language, run_results, total)
    if ai_analysis:
        feedback['ai_detailed_analysis'] = ai_analysis

    return {
        'score': total,
        'compile_result': {'score': compile_score, 'message': runtime_summary.get('message') or '编译/解释阶段检查完成。'},
        'runtime_result': {'score': io_score, 'summary': runtime_summary, 'cases': run_results},
        'io_match_result': {'score': io_score, 'passed': runtime_summary.get('passed'), 'cases': run_results},
        'syntax_result': {'score': syntax_score, 'message': '未发现明显语法问题。' if syntax_score >= 80 else '运行或静态检查发现语法/解释错误。'},
        'logic_result': {'score': logic_score, 'message': '基于参考答案结构相似度、控制结构和完整性综合评估。'},
        'efficiency_result': {'score': max(0, efficiency_score), 'message': '基于代码长度、控制结构和潜在复杂度的启发式评估。'},
        'line_comparison': _line_compare(code, standard),
        'ai_feedback': feedback,
    }


def _ai_code_analysis(question: Dict[str, Any], code: str, standard: str, language: str, run_results: list, score: float) -> Optional[Dict[str, Any]]:
    if not code.strip():
        return None
    try:
        title = question.get('title') or question.get('question') or '编程题'
        description = question.get('description') or ''
        failed_cases = [r for r in run_results if not r.get('passed')]
        passed_cases = [r for r in run_results if r.get('passed')]
        runtime_errors = [r for r in run_results if r.get('return_code', 0) != 0 or r.get('stderr')]

        prompt = f"""你是一位资深编程教师，请对学生的编程提交进行详细分析。

题目：{title}
题目描述：{description[:500]}
编程语言：{language}
得分：{score}/100

学生代码：
```
{code[:2000]}
```

参考答案：
```
{standard[:2000]}
```

运行结果摘要：
- 通过用例：{len(passed_cases)}/{len(run_results)}
- 失败用例数：{len(failed_cases)}
- 运行时错误数：{len(runtime_errors)}
"""

        if failed_cases:
            prompt += f"\n失败用例详情（最多3个）：\n"
            for fc in failed_cases[:3]:
                prompt += f"- 输入: {str(fc.get('input', ''))[:100]}\n  期望输出: {str(fc.get('expected_output', ''))[:100]}\n  实际输出: {str(fc.get('actual_output', ''))[:100]}\n"
                if fc.get('stderr'):
                    prompt += f"  错误信息: {str(fc['stderr'])[:200]}\n"

        prompt += """
请严格以JSON格式输出分析结果，包含以下字段：
{
  "error_analysis": "具体错误分析，指出代码中的bug、逻辑错误或语法问题",
  "code_quality": "代码质量评估，包括命名规范、代码结构、可读性",
  "optimization_suggestions": "优化建议，如何提升代码性能或简洁性",
  "best_practices": "最佳实践建议，该语言/场景下的推荐写法",
  "learning_points": "学习要点，学生应重点掌握的知识点",
  "step_by_step_fix": "逐步修复建议，按优先级排列的修改步骤"
}

只输出JSON，不要输出其他内容。"""

        raw = spark_service.chat(prompt)
        cleaned = raw.strip()
        cleaned = re.sub(r'^```(?:json)?', '', cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r'```$', '', cleaned).strip()
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
        return None
    except Exception as exc:
        logger.warning('AI code analysis failed: %s', exc)
        return None


def _sync_programming_mistake(user_id: int, assessment: Assessment, question: Dict[str, Any], question_index: int, code: str, standard: str, result: Dict[str, Any]):
    if result['score'] >= 90:
        return None
    content = json.dumps({
        'type': 'programming',
        'title': question.get('title'),
        'description': question.get('description'),
        'input_format': question.get('input_format'),
        'output_format': question.get('output_format'),
        'samples': question.get('samples', []),
    }, ensure_ascii=False)
    analysis = json.dumps({
        'score': result['score'],
        'dimensions': {
            'compile': result['compile_result'],
            'runtime': result['runtime_result'],
            'io_match': result['io_match_result'],
            'syntax': result['syntax_result'],
            'logic': result['logic_result'],
            'efficiency': result['efficiency_result'],
        },
        'line_comparison': result['line_comparison'],
        'feedback': result['ai_feedback'],
    }, ensure_ascii=False)
    existing = MistakeRecord.query.filter_by(user_id=user_id, assessment_id=assessment.id, question_index=question_index).first()
    if existing:
        existing.mistake_count += 1
        existing.last_mistake_at = datetime.utcnow()
        existing.user_answer = code
        existing.correct_answer = standard
        existing.ai_analysis = analysis
        existing.error_type_auto = 'programming_error'
        existing.error_reason_detail = result['ai_feedback'].get('summary')
        existing.updated_at = datetime.utcnow()
        return existing
    mistake = MistakeRecord(
        user_id=user_id,
        course_id=assessment.course_id,
        assessment_id=assessment.id,
        question_index=question_index,
        question_content=content,
        user_answer=code,
        correct_answer=standard,
        knowledge_tags=json.dumps(question.get('knowledge_tags', []), ensure_ascii=False),
        ai_analysis=analysis,
        error_type_auto='programming_error',
        error_reason_detail=result['ai_feedback'].get('summary'),
        mastery_status='unmastered',
    )
    db.session.add(mistake)
    return mistake


@programming_bp.route('/programming/submit', methods=['POST'])
@require_auth
def submit_programming_solution():
    try:
        data = request.get_json() or {}
        assessment_id = data.get('assessment_id')
        question_index = int(data.get('question_index') or 0)
        language = data.get('language') or 'python'
        code = data.get('code') or ''
        if language not in SUPPORTED_LANGUAGES:
            return jsonify({'error': f'Unsupported language: {language}'}), 400
        if not assessment_id or not code.strip():
            return jsonify({'error': 'assessment_id and code are required'}), 400
        assessment = Assessment.query.get(assessment_id)
        if not assessment:
            return jsonify({'error': 'Assessment not found'}), 404
        question = _get_programming_question(assessment, question_index)
        standard = question.get('standard_answer') or ''
        result = _score_submission(question, code, language)

        submission = ProgrammingSubmission(
            user_id=session['user_id'],
            assessment_id=assessment.id,
            course_id=assessment.course_id,
            question_index=question_index,
            language=language,
            code=code,
            standard_answer=standard,
            score=result['score'],
            max_score=question.get('score') or 100,
            status='passed' if result['score'] >= 90 else 'needs_improvement',
            compile_result=json.dumps(result['compile_result'], ensure_ascii=False),
            runtime_result=json.dumps(result['runtime_result'], ensure_ascii=False),
            io_match_result=json.dumps(result['io_match_result'], ensure_ascii=False),
            syntax_result=json.dumps(result['syntax_result'], ensure_ascii=False),
            logic_result=json.dumps(result['logic_result'], ensure_ascii=False),
            efficiency_result=json.dumps(result['efficiency_result'], ensure_ascii=False),
            line_comparison=json.dumps(result['line_comparison'], ensure_ascii=False),
            ai_feedback=json.dumps(result['ai_feedback'], ensure_ascii=False),
        )
        db.session.add(submission)
        mistake = _sync_programming_mistake(session['user_id'], assessment, question, question_index, code, standard, result)
        db.session.commit()
        return jsonify({
            'message': 'Programming submission reviewed',
            'submission': submission.to_dict(),
            'mistake_synced': bool(mistake),
            'mistake_id': mistake.id if mistake else None,
        }), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@programming_bp.route('/teacher/programming/submissions', methods=['GET'])
@require_auth
@require_teacher
def get_programming_submissions():
    try:
        user_id = session.get('user_id')
        query = ProgrammingSubmission.query.join(Course, ProgrammingSubmission.course_id == Course.id)
        if session.get('user_role') == 'teacher':
            query = query.filter(Course.teacher_id == user_id)
        assessment_id = request.args.get('assessment_id', type=int)
        course_id = request.args.get('course_id', type=int)
        if assessment_id:
            query = query.filter(ProgrammingSubmission.assessment_id == assessment_id)
        if course_id:
            query = query.filter(ProgrammingSubmission.course_id == course_id)
        submissions = query.order_by(ProgrammingSubmission.created_at.desc()).limit(200).all()
        return jsonify({'submissions': [s.to_dict() for s in submissions]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
