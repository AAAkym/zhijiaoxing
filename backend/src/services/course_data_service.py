import json
import re
import html
import logging

logger = logging.getLogger(__name__)


class DataCleaner:
    @staticmethod
    def clean_text(text):
        if not text or not isinstance(text, str):
            return ''
        text = html.unescape(text)
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\s+', ' ', text).strip()
        text = text.replace('\u3000', ' ')
        text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        return text

    @staticmethod
    def clean_html_to_markdown(html_content):
        if not html_content or not isinstance(html_content, str):
            return ''
        text = html_content
        text = re.sub(r'<h[1-6][^>]*>(.*?)</h[1-6]>', lambda m: f'\n## {m.group(1).strip()}\n', text, flags=re.DOTALL)
        text = re.sub(r'<p[^>]*>(.*?)</p>', lambda m: f'\n{m.group(1).strip()}\n', text, flags=re.DOTALL)
        text = re.sub(r'<li[^>]*>(.*?)</li>', lambda m: f'- {m.group(1).strip()}\n', text, flags=re.DOTALL)
        text = re.sub(r'<strong[^>]*>(.*?)</strong>', r'**\1**', text, flags=re.DOTALL)
        text = re.sub(r'<em[^>]*>(.*?)</em>', r'*\1*', text, flags=re.DOTALL)
        text = re.sub(r'<code[^>]*>(.*?)</code>', r'`\1`', text, flags=re.DOTALL)
        text = re.sub(r'<pre[^>]*>(.*?)</pre>', lambda m: f'\n```\n{m.group(1).strip()}\n```\n', text, flags=re.DOTALL)
        text = re.sub(r'<br\s*/?>', '\n', text)
        text = re.sub(r'<blockquote[^>]*>(.*?)</blockquote>', lambda m: f'\n> {m.group(1).strip()}\n', text, flags=re.DOTALL)
        text = re.sub(r'<a[^>]*href=["\']([^"\']*)["\'][^>]*>(.*?)</a>', r'[\2](\1)', text, flags=re.DOTALL)
        text = re.sub(r'<img[^>]*alt=["\']([^"\']*)["\'][^>]*src=["\']([^"\']*)["\'][^>]*/?\s*>', r'![\1](\2)', text, flags=re.DOTALL)
        text = re.sub(r'<hr\s*/?>', '\n---\n', text)
        text = re.sub(r'<[^>]+>', '', text)
        text = html.unescape(text)
        text = text.replace('\xa0', ' ')
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    @staticmethod
    def normalize_json_field(value, default=None):
        if value is None:
            return default if default is not None else []
        if isinstance(value, (list, dict)):
            return value
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                return parsed
            except json.JSONDecodeError:
                return default if default is not None else []
        return default if default is not None else []

    @staticmethod
    def standardize_difficulty(level):
        if not level:
            return 'intermediate'
        level = str(level).lower().strip()
        mapping = {
            'beginner': 'beginner', 'easy': 'beginner', '基础': 'beginner', '初级': 'beginner', '入门': 'beginner',
            'intermediate': 'intermediate', 'medium': 'intermediate', '中等': 'intermediate', '中级': 'intermediate',
            'advanced': 'advanced', 'hard': 'advanced', '困难': 'advanced', '高级': 'advanced',
        }
        return mapping.get(level, 'intermediate')

    @staticmethod
    def standardize_exercise_type(etype):
        if not etype:
            return 'choice'
        etype = str(etype).lower().strip()
        mapping = {
            'choice': 'choice', 'single_choice': 'choice', '单选': 'choice', '选择题': 'choice',
            'multiple_choice': 'multiple_choice', '多选': 'multiple_choice', '多选题': 'multiple_choice',
            'fill': 'fill', 'fill_blank': 'fill', '填空': 'fill', '填空题': 'fill',
            'short_answer': 'short_answer', '简答': 'short_answer', '简答题': 'short_answer',
            'calculation': 'calculation', '计算': 'calculation', '计算题': 'calculation',
            'programming': 'programming', '编程': 'programming', '编程题': 'programming',
            'true_false': 'true_false', '判断': 'true_false', '判断题': 'true_false',
        }
        return mapping.get(etype, 'choice')

    @staticmethod
    def standardize_case_type(ctype):
        if not ctype:
            return 'application'
        ctype = str(ctype).lower().strip()
        mapping = {
            'application': 'application', '应用': 'application', '应用案例': 'application',
            'experiment': 'experiment', '实验': 'experiment', '实验案例': 'experiment',
            'project': 'project', '项目': 'project', '项目案例': 'project',
            'analysis': 'analysis', '分析': 'analysis', '分析案例': 'analysis',
            'demonstration': 'demonstration', '演示': 'demonstration', '演示案例': 'demonstration',
        }
        return mapping.get(ctype, 'application')

    @staticmethod
    def validate_and_clean_exercise(data):
        errors = []
        if not data.get('title'):
            errors.append('title is required')
        if not data.get('content'):
            errors.append('content is required')
        if not data.get('correct_answer') and data.get('correct_answer') != 0:
            errors.append('correct_answer is required')
        if not data.get('chapter_id'):
            errors.append('chapter_id is required')

        etype = DataCleaner.standardize_exercise_type(data.get('exercise_type'))
        if etype in ('choice', 'multiple_choice'):
            options = DataCleaner.normalize_json_field(data.get('options'))
            if not options or len(options) < 2:
                errors.append(f'{etype} exercise must have at least 2 options')

        cleaned = {
            'title': DataCleaner.clean_text(data.get('title', '')),
            'exercise_type': etype,
            'difficulty_level': DataCleaner.standardize_difficulty(data.get('difficulty_level')),
            'content': DataCleaner.clean_text(data.get('content', '')),
            'options': DataCleaner.normalize_json_field(data.get('options'), []),
            'correct_answer': data.get('correct_answer'),
            'answer_analysis': DataCleaner.clean_text(data.get('answer_analysis', '')),
            'hints': DataCleaner.normalize_json_field(data.get('hints'), []),
            'knowledge_tags': DataCleaner.normalize_json_field(data.get('knowledge_tags'), []),
            'score': float(data.get('score', 5.0)),
            'estimated_minutes': int(data.get('estimated_minutes', 5)),
            'chapter_id': data.get('chapter_id'),
            'knowledge_point_id': data.get('knowledge_point_id'),
            'source': data.get('source', ''),
            'source_url': data.get('source_url', ''),
        }
        return cleaned, errors


class CourseDataFetcher:
    SOURCES = {
        'csdn': {
            'name': 'CSDN',
            'base_url': 'https://edu.csdn.net',
            'type': 'web',
        },
        'cnki': {
            'name': '中国知网',
            'base_url': 'https://www.cnki.net',
            'type': 'academic',
        },
        'icourse163': {
            'name': '中国大学MOOC',
            'base_url': 'https://www.icourse163.org',
            'type': 'mooc',
        },
        'xuetangx': {
            'name': '学堂在线',
            'base_url': 'https://www.xuetangx.com',
            'type': 'mooc',
        },
        'bilibili': {
            'name': 'B站',
            'base_url': 'https://www.bilibili.com',
            'type': 'video',
        },
        'github': {
            'name': 'GitHub',
            'base_url': 'https://github.com',
            'type': 'code',
        },
        'arxiv': {
            'name': 'arXiv',
            'base_url': 'https://arxiv.org',
            'type': 'paper',
        },
        'scikit_learn': {
            'name': 'Scikit-learn文档',
            'base_url': 'https://scikit-learn.org/stable',
            'type': 'documentation',
        },
    }

    @staticmethod
    def get_available_sources():
        return {k: v for k, v in CourseDataFetcher.SOURCES.items()}

    @staticmethod
    def fetch_from_url(url, timeout=30):
        try:
            import requests
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            }
            resp = requests.get(url, headers=headers, timeout=timeout)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            logger.error(f"Failed to fetch from {url}: {e}")
            return None

    @staticmethod
    def parse_course_outline_from_text(text, source=''):
        if not text:
            return None
        chapters = []
        lines = text.strip().split('\n')
        current_chapter = None
        current_section = None
        for line in lines:
            line = line.strip()
            if not line:
                continue
            ch_match = re.match(r'^第([一二三四五六七八九十\d]+)[章节]\s+(.*)', line)
            if ch_match:
                current_chapter = {
                    'title': f'第{ch_match.group(1)}章 {ch_match.group(2)}'.strip(),
                    'sections': [],
                    'source': source,
                }
                chapters.append(current_chapter)
                current_section = None
                continue
            sec_match = re.match(r'^(\d+\.[\d.]*)\s+(.*)', line)
            if sec_match and current_chapter:
                current_section = {
                    'title': f'{sec_match.group(1)} {sec_match.group(2)}'.strip(),
                    'knowledge_points': [],
                    'source': source,
                }
                current_chapter['sections'].append(current_section)
                continue
            if current_section:
                current_section['knowledge_points'].append({'title': line, 'source': source})
            elif current_chapter:
                current_chapter['sections'].append({'title': line, 'knowledge_points': [], 'source': source})
        return chapters

    @staticmethod
    def import_from_json(json_data, course_id):
        result = {'chapters': 0, 'knowledge_points': 0, 'teaching_cases': 0, 'exercises': 0, 'errors': []}
        try:
            if isinstance(json_data, str):
                json_data = json.loads(json_data)
            if not isinstance(json_data, dict):
                result['errors'].append('Invalid JSON format: expected dict')
                return result
            from src.models.knowledge_base import CourseChapter, KnowledgePoint, TeachingCase, CourseExercise
            from src.models.user import db
            chapters_data = json_data.get('chapters', [])
            for ch_data in chapters_data:
                ch = CourseChapter(
                    course_id=course_id,
                    title=DataCleaner.clean_text(ch_data.get('title', '')),
                    description=DataCleaner.clean_text(ch_data.get('description', '')),
                    order_index=ch_data.get('order_index', 0),
                    teaching_hours=ch_data.get('teaching_hours', 0),
                    chapter_type=ch_data.get('chapter_type', 'theory'),
                    objectives=json.dumps(ch_data.get('objectives', []), ensure_ascii=False),
                    key_points=json.dumps(ch_data.get('key_points', []), ensure_ascii=False),
                    difficulties=json.dumps(ch_data.get('difficulties', []), ensure_ascii=False),
                )
                db.session.add(ch)
                db.session.flush()
                result['chapters'] += 1
                for kp_data in ch_data.get('knowledge_points', []):
                    kp = KnowledgePoint(
                        course_id=course_id,
                        chapter_id=ch.id,
                        title=DataCleaner.clean_text(kp_data.get('title', '')),
                        definition=DataCleaner.clean_text(kp_data.get('definition', '')),
                        content=DataCleaner.clean_text(kp_data.get('content', '')),
                        order_index=kp_data.get('order_index', 0),
                        difficulty_level=DataCleaner.standardize_difficulty(kp_data.get('difficulty_level')),
                        importance=kp_data.get('importance', 'core'),
                        tags=json.dumps(kp_data.get('tags', []), ensure_ascii=False),
                        source=kp_data.get('source', ''),
                        source_url=kp_data.get('source_url', ''),
                    )
                    db.session.add(kp)
                    result['knowledge_points'] += 1
            cases_data = json_data.get('teaching_cases', [])
            for case_data in cases_data:
                case = TeachingCase(
                    course_id=course_id,
                    chapter_id=case_data.get('chapter_id'),
                    knowledge_point_id=case_data.get('knowledge_point_id'),
                    title=DataCleaner.clean_text(case_data.get('title', '')),
                    case_type=DataCleaner.standardize_case_type(case_data.get('case_type')),
                    background=DataCleaner.clean_text(case_data.get('background', '')),
                    problem_description=DataCleaner.clean_text(case_data.get('problem_description', '')),
                    analysis=DataCleaner.clean_text(case_data.get('analysis', '')),
                    solution=DataCleaner.clean_text(case_data.get('solution', '')),
                    conclusion=DataCleaner.clean_text(case_data.get('conclusion', '')),
                    code_example=case_data.get('code_example', ''),
                    difficulty_level=DataCleaner.standardize_difficulty(case_data.get('difficulty_level')),
                    tags=json.dumps(case_data.get('tags', []), ensure_ascii=False),
                    source=case_data.get('source', ''),
                    source_url=case_data.get('source_url', ''),
                )
                db.session.add(case)
                result['teaching_cases'] += 1
            exercises_data = json_data.get('exercises', [])
            for ex_data in exercises_data:
                cleaned, errors = DataCleaner.validate_and_clean_exercise(ex_data)
                if errors:
                    result['errors'].append(f"Exercise '{ex_data.get('title', 'unknown')}': {'; '.join(errors)}")
                    continue
                exercise = CourseExercise(
                    course_id=course_id,
                    **cleaned,
                )
                db.session.add(exercise)
                result['exercises'] += 1
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            result['errors'].append(str(e))
        return result


data_cleaner = DataCleaner()
course_data_fetcher = CourseDataFetcher()
