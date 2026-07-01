import json
import logging
import re
from datetime import datetime
from src.services.multi_agent import AgentBase

logger = logging.getLogger(__name__)


PROFILE_DIMENSIONS = [
    {
        'key': 'knowledge_base',
        'name': '知识基础',
        'question': '请告诉我你目前的专业方向和已掌握的主要知识领域？你觉得自己在哪些科目上比较强，哪些比较薄弱？',
        'extract_instruction': '从用户回答中提取：1)专业方向 2)已掌握的知识领域及掌握程度(0-100) 3)薄弱领域',
        'type': 'json',
    },
    {
        'key': 'cognitive_style',
        'name': '认知风格',
        'question': '你平时学习时更喜欢哪种方式？比如看视频教程、听讲座、动手实践、还是阅读教材？你觉得哪种方式学得最快？',
        'extract_instruction': '从用户回答中判断认知风格：visual(视觉型-偏好视频/图表)、auditory(听觉型-偏好听讲/播客)、kinesthetic(动觉型-偏好动手实践)、reading(阅读型-偏好文字教材)、mixed(混合型)',
        'type': 'enum',
        'valid_values': ['visual', 'auditory', 'kinesthetic', 'reading', 'mixed'],
    },
    {
        'key': 'error_patterns',
        'name': '易错点模式',
        'question': '你在学习中经常犯哪类错误？比如：概念理解偏差、计算粗心、思路不清晰、还是知识遗忘？有没有反复出错的题目类型？',
        'extract_instruction': '从用户回答中提取易错点模式列表，每项包含：知识点、错误类型(概念/计算/思路/遗忘/其他)、频率(高/中/低)',
        'type': 'json_array',
    },
    {
        'key': 'learning_pace',
        'name': '学习节奏',
        'question': '你平时的学习节奏是怎样的？喜欢快速推进还是慢慢消化？每天大概能投入多少时间学习？',
        'extract_instruction': '从用户回答中判断学习节奏：fast(快速推进)、moderate(适中节奏)、slow(慢慢消化)、adaptive(灵活调整)',
        'type': 'enum',
        'valid_values': ['fast', 'moderate', 'slow', 'adaptive'],
    },
    {
        'key': 'interest_areas',
        'name': '兴趣领域',
        'question': '除了专业课程，你对哪些领域或话题特别感兴趣？比如人工智能、设计、音乐、体育等？这些兴趣是否影响了你的学习方向？',
        'extract_instruction': '从用户回答中提取兴趣领域列表，每项包含：领域名称、权重(0-1)',
        'type': 'json_array',
    },
    {
        'key': 'goal_orientation',
        'name': '目标导向',
        'question': '你当前最主要的学习目标是什么？是为了通过考试、职业发展、个人兴趣、还是学术研究？',
        'extract_instruction': '从用户回答中判断目标导向：exam(应试)、career(职业发展)、hobby(个人兴趣)、research(学术研究)',
        'type': 'enum',
        'valid_values': ['exam', 'career', 'hobby', 'research'],
    },
]


class ProfileAgent(AgentBase):
    agent_name = "profiler"
    agent_role = "画像师"
    agent_description = "通过自然语言对话构建学生画像，自动抽取6+维度特征"

    def __init__(self, spark_service=None):
        super().__init__(spark_service)

    def get_capabilities(self):
        return ['dialog_profile', 'feature_extraction', 'profile_update']

    def process(self, task):
        task_type = task.get('type')
        if task_type == 'start_dialog':
            return self.start_dialog(task)
        elif task_type == 'continue_dialog':
            return self.continue_dialog(task)
        elif task_type == 'extract_features':
            return self.extract_features_from_text(task)
        elif task_type == 'generate_summary':
            return self.generate_profile_summary(task)
        return {'error': f'Unknown task type: {task_type}'}

    def start_dialog(self, task):
        user_name = task.get('user_name', '同学')
        first_dimension = PROFILE_DIMENSIONS[0]
        return {
            'type': 'dialog_start',
            'greeting': f'你好{user_name}！我是你的学习画像助手，接下来我会通过几个简单的问题来了解你的学习特点，帮你构建专属的学习画像。这样系统就能为你推荐最合适的学习资源和路径了。',
            'current_round': 0,
            'total_rounds': len(PROFILE_DIMENSIONS),
            'current_dimension': first_dimension['key'],
            'dimension_name': first_dimension['name'],
            'question': first_dimension['question'],
        }

    def continue_dialog(self, task):
        user_answer = task.get('answer', '')
        current_round = task.get('current_round', 0)
        session_features = task.get('extracted_features', {})

        if current_round >= len(PROFILE_DIMENSIONS):
            return {
                'type': 'dialog_complete',
                'message': '太好了！我已经了解了你的学习特点，画像构建完成！你可以在画像看板中查看和调整你的学习画像。',
                'extracted_features': session_features,
            }

        current_dim = PROFILE_DIMENSIONS[current_round]
        extracted = self._extract_dimension_value(current_dim, user_answer)
        if extracted is not None:
            session_features[current_dim['key']] = extracted

        next_round = current_round + 1
        if next_round >= len(PROFILE_DIMENSIONS):
            return {
                'type': 'dialog_complete',
                'message': '太好了！我已经了解了你的学习特点，画像构建完成！你可以在画像看板中查看和调整你的学习画像。',
                'extracted_features': session_features,
            }

        next_dim = PROFILE_DIMENSIONS[next_round]
        feedback = self._generate_feedback(current_dim, extracted, user_answer, current_round)

        return {
            'type': 'dialog_continue',
            'feedback': feedback,
            'current_round': next_round,
            'total_rounds': len(PROFILE_DIMENSIONS),
            'current_dimension': next_dim['key'],
            'dimension_name': next_dim['name'],
            'question': next_dim['question'],
            'extracted_features': session_features,
        }

    def _extract_dimension_value(self, dimension, user_answer):
        if not user_answer or not user_answer.strip():
            return None

        # 先尝试规则抽取
        rule_result = self._extract_dimension_value_by_rules(dimension, user_answer)

        # 判断规则结果是否为默认值或空，决定是否尝试 LLM
        dim_type = dimension['type']
        is_default = False
        if dim_type == 'enum':
            valid_values = dimension.get('valid_values', [])
            fallback_values = []
            if 'mixed' in valid_values:
                fallback_values.append('mixed')
            if 'adaptive' in valid_values:
                fallback_values.append('adaptive')
            if not fallback_values:
                fallback_values = [valid_values[0]] if valid_values else []
            if rule_result in fallback_values:
                is_default = True
        elif dim_type in ('json', 'json_array'):
            if not rule_result or rule_result == {} or rule_result == []:
                is_default = True

        if is_default:
            llm_result = self._extract_dimension_value_with_llm(dimension, user_answer)
            if llm_result is not None:
                return llm_result

        return rule_result

    def _extract_dimension_value_by_rules(self, dimension, user_answer):
        dim_type = dimension['type']
        if dim_type == 'enum':
            return self._extract_enum_value(dimension, user_answer)
        elif dim_type == 'json':
            return self._extract_json_value(dimension, user_answer)
        elif dim_type == 'json_array':
            return self._extract_json_array_value(dimension, user_answer)
        return None

    def _extract_dimension_value_with_llm(self, dimension, user_answer):
        """使用 LLM 做结构化抽取，失败返回 None"""
        from src.services.spark_service import spark_service

        dim_type = dimension['type']
        valid_values = dimension.get('valid_values', [])

        prompt = f"""请从用户回答中提取「{dimension['name']}」维度信息。

抽取说明：{dimension['extract_instruction']}
"""
        if dim_type == 'enum' and valid_values:
            prompt += f"\n可选值：{', '.join(valid_values)}\n请只返回一个可选值。"
        elif dim_type == 'json':
            prompt += "\n请返回JSON对象。"
        elif dim_type == 'json_array':
            prompt += "\n请返回JSON数组。"

        prompt += f"\n\n用户回答：{user_answer}\n\n请只返回提取结果，不要添加其他文字。"

        try:
            response = spark_service.chat(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
            )
            if not response:
                return None
            response = response.strip()

            if dim_type == 'enum':
                for val in valid_values:
                    if val in response.lower():
                        return val
                return None
            elif dim_type == 'json':
                try:
                    return json.loads(response)
                except Exception:
                    json_match = re.search(r'\{[\s\S]*\}', response)
                    if json_match:
                        return json.loads(json_match.group())
                    return None
            elif dim_type == 'json_array':
                try:
                    return json.loads(response)
                except Exception:
                    json_match = re.search(r'\[[\s\S]*\]', response)
                    if json_match:
                        return json.loads(json_match.group())
                    return None
        except Exception as e:
            logger.warning(f"LLM extraction failed for {dimension['key']}: {e}")
            return None

    def _extract_enum_value(self, dimension, user_answer):
        valid_values = dimension.get('valid_values', [])
        answer_lower = user_answer.lower()

        keyword_map = {
            'visual': ['视频', '图表', '图', '看', '视觉', '动画', '演示', 'visual', 'video', 'watch'],
            'auditory': ['听', '讲座', '播客', '音频', '讲', 'auditory', 'listen', 'audio'],
            'kinesthetic': ['动手', '实践', '操作', '实验', '做', '练习', 'kinesthetic', 'practice', 'hands-on'],
            'reading': ['阅读', '看书', '教材', '文字', '笔记', 'reading', 'read', 'text', 'book'],
            'fast': ['快速', '尽快', '高效', '快', '速成', 'fast', 'quick'],
            'moderate': ['适中', '稳定', '按部就班', 'moderate', 'steady'],
            'slow': ['慢慢', '仔细', '消化', '深入理解', 'slow', 'careful'],
            'adaptive': ['灵活', '看情况', '不一定', 'adaptive', 'flexible'],
            'exam': ['考试', '应试', '过级', '考证', 'exam', 'test', 'pass'],
            'career': ['工作', '职业', '就业', '求职', 'career', 'job', 'work'],
            'hobby': ['兴趣', '爱好', '好奇', 'hobby', 'interest', 'fun'],
            'research': ['研究', '学术', '论文', '科研', 'research', 'academic'],
        }

        for valid_val in valid_values:
            keywords = keyword_map.get(valid_val, [])
            for kw in keywords:
                if kw in answer_lower:
                    return valid_val

        return valid_values[-1] if 'mixed' in valid_values or 'adaptive' in valid_values else valid_values[0]

    def _extract_json_value(self, dimension, user_answer):
        if dimension['key'] == 'knowledge_base':
            result = {}
            subject_keywords = {
                'python': ['python', '编程', '代码'],
                'java': ['java'],
                '数学': ['数学', '高数', '线代', '概率'],
                '英语': ['英语', '英文'],
                '数据结构': ['数据结构', '算法'],
                '数据库': ['数据库', 'sql'],
                '机器学习': ['机器学习', '深度学习', 'ai', '人工智能'],
                '前端': ['前端', 'html', 'css', 'javascript', 'react'],
                '后端': ['后端', '服务器', 'flask', 'django'],
            }

            strength_keywords = ['强', '好', '擅长', '优秀', '熟练', '掌握']
            weakness_keywords = ['弱', '差', '薄弱', '不足', '不懂', '不会']

            for subject, keywords in subject_keywords.items():
                for kw in keywords:
                    if kw in user_answer.lower():
                        score = 50
                        for sk in strength_keywords:
                            if sk in user_answer:
                                score = 80
                                break
                        for wk in weakness_keywords:
                            if wk in user_answer:
                                score = 30
                                break
                        result[subject] = score
                        break

            if not result:
                result = {'通用': 50}

            return result

        return {}

    def _extract_json_array_value(self, dimension, user_answer):
        if dimension['key'] == 'error_patterns':
            patterns = []
            error_type_keywords = {
                '概念理解': ['概念', '理解', '原理', '含义', '定义'],
                '计算粗心': ['计算', '粗心', '马虎', '算错', '笔误'],
                '思路不清': ['思路', '方法', '不知道怎么', '无从下手'],
                '知识遗忘': ['遗忘', '忘记', '记不住', '忘了'],
            }
            freq_keywords = {
                '高': ['经常', '总是', '常常', '很多'],
                '中': ['偶尔', '有时', '一些'],
                '低': ['很少', '偶尔', '几乎不'],
            }

            detected_type = '其他'
            for etype, keywords in error_type_keywords.items():
                for kw in keywords:
                    if kw in user_answer:
                        detected_type = etype
                        break
                if detected_type != '其他':
                    break

            freq = '中'
            for f, keywords in freq_keywords.items():
                for kw in keywords:
                    if kw in user_answer:
                        freq = f
                        break

            patterns.append({
                'knowledge_point': '待分析',
                'error_type': detected_type,
                'frequency': freq,
            })
            return patterns

        elif dimension['key'] == 'interest_areas':
            areas = []
            interest_keywords = [
                '人工智能', '设计', '音乐', '体育', '游戏', '摄影',
                '编程', '阅读', '旅行', '电影', '科技', '艺术',
                '金融', '医学', '法律', '教育', '创业',
            ]
            for interest in interest_keywords:
                if interest in user_answer:
                    areas.append({'area': interest, 'weight': 0.7})
            if not areas:
                areas.append({'area': '综合学习', 'weight': 0.5})
            return areas

        return []

    def _generate_feedback(self, dimension, extracted, user_answer, current_round=0):
        dim_name = dimension['name']
        if extracted is None:
            return f'好的，了解了。接下来我们聊聊{PROFILE_DIMENSIONS[min(current_round + 1, len(PROFILE_DIMENSIONS) - 1)]["name"]}方面的情况。'

        if dimension['type'] == 'enum':
            value_map = {
                'visual': '视觉型学习者', 'auditory': '听觉型学习者',
                'kinesthetic': '动觉型学习者', 'reading': '阅读型学习者',
                'mixed': '混合型学习者',
                'fast': '快速学习型', 'moderate': '适中节奏型',
                'slow': '深度消化型', 'adaptive': '灵活调整型',
                'exam': '应试导向型', 'career': '职业发展型',
                'hobby': '兴趣驱动型', 'research': '学术研究型',
            }
            label = value_map.get(extracted, extracted)
            return f'我了解到你在{dim_name}方面属于「{label}」，很好！'
        elif dimension['type'] in ('json', 'json_array'):
            return f'已记录你的{dim_name}信息，我会据此为你定制学习方案。'

        return f'好的，已了解你的{dim_name}情况。'

    def extract_features_from_text(self, task):
        text = task.get('text', '')
        features = {}
        for dim in PROFILE_DIMENSIONS:
            value = self._extract_dimension_value(dim, text)
            if value is not None:
                features[dim['key']] = value
        return {'extracted_features': features}

    def generate_profile_summary(self, task):
        profile_data = task.get('profile', {})
        dimension_scores = []
        for dim in PROFILE_DIMENSIONS:
            key = dim['key']
            value = profile_data.get(key)
            if value is not None and value != '{}' and value != '[]':
                if dim['type'] == 'enum':
                    dimension_scores.append({'dimension': dim['name'], 'key': key, 'value': value, 'filled': True})
                elif dim['type'] in ('json', 'json_array'):
                    dimension_scores.append({'dimension': dim['name'], 'key': key, 'value': value, 'filled': True})
            else:
                dimension_scores.append({'dimension': dim['name'], 'key': key, 'value': None, 'filled': False})

        filled_count = sum(1 for d in dimension_scores if d['filled'])
        return {
            'summary': dimension_scores,
            'completeness': round(filled_count / len(PROFILE_DIMENSIONS), 2),
            'total_dimensions': len(PROFILE_DIMENSIONS),
            'filled_dimensions': filled_count,
        }
