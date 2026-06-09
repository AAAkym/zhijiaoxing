import json
import re
import logging

from src.models.knowledge_base import CourseSyllabus, CourseChapter, KnowledgePoint, TeachingCase, CourseExercise
from src.models.course import Course
from src.models.user import db

logger = logging.getLogger(__name__)

ACADEMIC_TERMS = {
    'ml': {'机器学习', '监督学习', '无监督学习', '强化学习', '过拟合', '欠拟合', '泛化', '偏差', '方差',
           '回归', '分类', '聚类', '降维', '特征', '正则化', '交叉验证', '训练集', '测试集', '验证集',
           '梯度下降', '损失函数', '优化', '超参数', '模型选择', '集成学习', 'Bagging', 'Boosting',
           '决策树', '支持向量机', '神经网络', '深度学习', '卷积', '循环', '注意力机制',
           '贝叶斯', '概率', '似然', '先验', '后验', '熵', '信息增益', '基尼指数',
           '主成分分析', 'PCA', 'SVD', 'LDA', '核函数', '核技巧', 'Mercer',
           '反向传播', '激活函数', 'ReLU', 'Sigmoid', 'Softmax', 'Dropout', 'BatchNorm',
           '随机森林', 'AdaBoost', 'GBDT', 'XGBoost', 'K-Means', 'DBSCAN',
           '精确率', '召回率', 'F1', 'AUC', 'ROC', 'MSE', 'RMSE', 'MAE', 'R²',
           '欠定', '超定', '凸优化', '对偶', 'KKT', '拉格朗日',
           '过采样', '欠采样', 'SMOTE', '特征选择', '特征提取', '特征工程',
           '线性', '非线性', '参数', '非参数', '生成模型', '判别模型',
           '经验风险', '结构风险', 'VC维', 'Rademacher复杂度',
           '协方差', '相关系数', '独立同分布', 'i.i.d.', '极大似然估计', 'MLE',
           '最大后验', 'MAP', '贝叶斯推断', '变分推断', 'MCMC',
           '卷积神经网络', 'CNN', '循环神经网络', 'RNN', 'LSTM', 'GRU',
           '生成对抗网络', 'GAN', '自编码器', 'VAE', 'Transformer',
           '迁移学习', '元学习', '少样本学习', '自监督学习', '半监督学习',
           '数据增强', '早停', '学习率', '动量', '权重衰减', '批大小'},
}

FORMULA_PATTERNS = [
    r'[=≈≠≤≥<>]\s*',
    r'[Σ∏∫]\s*',
    r'[α-ωΑ-Ω]\s*',
    r'\^[\d{]+',
    r'\\frac\{',
    r'\\sum\{',
    r'\\sqrt',
    r'\d+\s*[+\-*/]\s*\d+',
]


def validate_course(course_id):
    result = {
        'course_id': course_id,
        'valid': True,
        'completeness': {},
        'academic_rigor': {},
        'teaching_utility': {},
        'errors': [],
        'warnings': [],
        'score': 0,
    }

    course = Course.query.get(course_id)
    if not course:
        result['valid'] = False
        result['errors'].append(f'Course {course_id} not found')
        return result

    _validate_completeness(course_id, result)
    _validate_academic_rigor(course_id, result)
    _validate_teaching_utility(course_id, result)

    total_checks = 0
    passed_checks = 0
    for category in ['completeness', 'academic_rigor', 'teaching_utility']:
        for check_name, check_result in result[category].items():
            total_checks += 1
            if check_result.get('passed', False):
                passed_checks += 1

    result['score'] = round((passed_checks / total_checks) * 100, 1) if total_checks > 0 else 0
    result['valid'] = result['score'] >= 60 and len(result['errors']) == 0

    return result


def _validate_completeness(course_id, result):
    comp = result['completeness']

    syllabus = CourseSyllabus.query.filter_by(course_id=course_id).first()
    comp['syllabus_exists'] = {
        'passed': syllabus is not None,
        'detail': '课程大纲存在' if syllabus else '缺少课程大纲',
    }

    if syllabus:
        comp['syllabus_objectives'] = {
            'passed': _safe_json_len(syllabus.course_objectives) >= 3,
            'detail': f'课程目标 {_safe_json_len(syllabus.course_objectives)} 项（需≥3）',
        }
        comp['syllabus_textbook'] = {
            'passed': _safe_json_len(syllabus.textbook) > 0,
            'detail': '教材信息已填写' if _safe_json_len(syllabus.textbook) > 0 else '缺少教材信息',
        }
        comp['syllabus_references'] = {
            'passed': _safe_json_len(syllabus.references) >= 2,
            'detail': f'参考文献 {_safe_json_len(syllabus.references)} 条（需≥2）',
        }
        comp['syllabus_assessment'] = {
            'passed': _safe_json_len(syllabus.assessment_methods) >= 2,
            'detail': f'考核方式 {_safe_json_len(syllabus.assessment_methods)} 种（需≥2）',
        }

    chapters = CourseChapter.query.filter_by(course_id=course_id, parent_id=None).order_by(CourseChapter.order_index).all()
    comp['chapters_exist'] = {
        'passed': len(chapters) >= 3,
        'detail': f'章节数 {len(chapters)}（需≥3）',
    }

    _ch_obj_ok = all(_safe_json_len(ch.objectives) > 0 for ch in chapters) if chapters else False
    comp['chapters_have_objectives'] = {
        'passed': _ch_obj_ok,
        'detail': '所有章节有教学目标' if _ch_obj_ok else '部分章节缺少教学目标',
    }

    _ch_kp_ok = all(_safe_json_len(ch.key_points) > 0 for ch in chapters) if chapters else False
    comp['chapters_have_key_points'] = {
        'passed': _ch_kp_ok,
        'detail': '所有章节有重点' if _ch_kp_ok else '部分章节缺少重点',
    }

    kp_count = KnowledgePoint.query.filter_by(course_id=course_id).count()
    comp['knowledge_points_sufficient'] = {
        'passed': kp_count >= 10,
        'detail': f'知识点 {kp_count} 个（需≥10）',
    }

    kp_with_definition = KnowledgePoint.query.filter(
        KnowledgePoint.course_id == course_id,
        KnowledgePoint.definition.isnot(None),
        KnowledgePoint.definition != '',
    ).count()
    comp['kp_with_definitions'] = {
        'passed': kp_with_definition >= kp_count * 0.5 if kp_count > 0 else False,
        'detail': f'有定义的知识点 {kp_with_definition}/{kp_count}（需≥50%）',
    }

    kp_with_content = KnowledgePoint.query.filter(
        KnowledgePoint.course_id == course_id,
        KnowledgePoint.content.isnot(None),
        KnowledgePoint.content != '',
    ).count()
    comp['kp_with_content'] = {
        'passed': kp_with_content >= kp_count * 0.5 if kp_count > 0 else False,
        'detail': f'有详细内容的知识点 {kp_with_content}/{kp_count}（需≥50%）',
    }

    case_count = TeachingCase.query.filter_by(course_id=course_id).count()
    comp['teaching_cases_sufficient'] = {
        'passed': case_count >= len(chapters) * 0.5 if chapters else False,
        'detail': f'教学案例 {case_count} 个（需≥章节数的50%）',
    }

    exercise_count = CourseExercise.query.filter_by(course_id=course_id).count()
    comp['exercises_sufficient'] = {
        'passed': exercise_count >= 10,
        'detail': f'习题 {exercise_count} 道（需≥10）',
    }

    exercise_types = db.session.query(CourseExercise.exercise_type).filter_by(course_id=course_id).distinct().all()
    type_count = len(exercise_types)
    comp['exercise_type_diversity'] = {
        'passed': type_count >= 2,
        'detail': f'习题类型 {type_count} 种（需≥2）',
    }

    difficulties = db.session.query(CourseExercise.difficulty_level).filter_by(course_id=course_id).distinct().all()
    diff_count = len(difficulties)
    comp['exercise_difficulty_diversity'] = {
        'passed': diff_count >= 2,
        'detail': f'难度层次 {diff_count} 种（需≥2）',
    }

    chapters_with_cases = db.session.query(TeachingCase.chapter_id).filter_by(course_id=course_id).distinct().count()
    comp['case_coverage'] = {
        'passed': chapters_with_cases >= len(chapters) * 0.5 if chapters else False,
        'detail': f'有案例的章节 {chapters_with_cases}/{len(chapters)}（需≥50%）',
    }

    chapters_with_exercises = db.session.query(CourseExercise.chapter_id).filter_by(course_id=course_id).distinct().count()
    comp['exercise_coverage'] = {
        'passed': chapters_with_exercises >= len(chapters) * 0.5 if chapters else False,
        'detail': f'有习题的章节 {chapters_with_exercises}/{len(chapters)}（需≥50%）',
    }


def _validate_academic_rigor(course_id, result):
    rigor = result['academic_rigor']

    kps = KnowledgePoint.query.filter_by(course_id=course_id).all()
    kp_with_formulas = sum(1 for kp in kps if _safe_json_len(kp.formulas) > 0)
    rigor['formulas_present'] = {
        'passed': kp_with_formulas >= len(kps) * 0.2 if kps else True,
        'detail': f'包含公式的知识点 {kp_with_formulas}/{len(kps)}（建议≥20%）',
    }

    kp_with_source = sum(1 for kp in kps if kp.source)
    rigor['kp_sources'] = {
        'passed': kp_with_source >= len(kps) * 0.3 if kps else True,
        'detail': f'标注来源的知识点 {kp_with_source}/{len(kps)}（建议≥30%）',
    }

    kp_with_definition = sum(1 for kp in kps if kp.definition and len(kp.definition.strip()) > 10)
    rigor['kp_definition_quality'] = {
        'passed': kp_with_definition >= len(kps) * 0.5 if kps else True,
        'detail': f'有完整定义的知识点 {kp_with_definition}/{len(kps)}（需≥50%）',
    }

    cases = TeachingCase.query.filter_by(course_id=course_id).all()
    cases_with_analysis = sum(1 for c in cases if c.analysis and len(c.analysis.strip()) > 20)
    rigor['case_analysis_quality'] = {
        'passed': cases_with_analysis >= len(cases) * 0.5 if cases else True,
        'detail': f'有详细分析的教学案例 {cases_with_analysis}/{len(cases)}（建议≥50%）',
    }

    cases_with_conclusion = sum(1 for c in cases if c.conclusion and len(c.conclusion.strip()) > 10)
    rigor['case_conclusion_quality'] = {
        'passed': cases_with_conclusion >= len(cases) * 0.5 if cases else True,
        'detail': f'有结论总结的教学案例 {cases_with_conclusion}/{len(cases)}（建议≥50%）',
    }

    exercises = CourseExercise.query.filter_by(course_id=course_id).all()
    exercises_with_analysis = sum(1 for e in exercises if e.answer_analysis and len(e.answer_analysis.strip()) > 10)
    rigor['exercise_analysis_quality'] = {
        'passed': exercises_with_analysis >= len(exercises) * 0.5 if exercises else True,
        'detail': f'有解析的习题 {exercises_with_analysis}/{len(exercises)}（需≥50%）',
    }

    all_kp_tags = set()
    for kp in kps:
        tags = _safe_json_parse(kp.tags)
        if isinstance(tags, list):
            all_kp_tags.update(tags)
    academic_overlap = all_kp_tags & ACADEMIC_TERMS.get('ml', set())
    rigor['academic_terminology'] = {
        'passed': len(academic_overlap) >= 5,
        'detail': f'使用学术术语 {len(academic_overlap)} 个（需≥5）',
    }

    chapters = CourseChapter.query.filter_by(course_id=course_id).all()
    logical_order = True
    for i in range(1, len(chapters)):
        if chapters[i].order_index <= chapters[i-1].order_index:
            logical_order = False
            break
    rigor['chapter_logical_order'] = {
        'passed': logical_order,
        'detail': '章节顺序逻辑合理' if logical_order else '章节顺序存在逻辑问题',
    }

    prerequisite_kps = 0
    for kp in kps:
        prereqs = _safe_json_parse(kp.prerequisites)
        if isinstance(prereqs, list) and len(prereqs) > 0:
            prerequisite_kps += 1
    rigor['knowledge_prerequisites'] = {
        'passed': prerequisite_kps >= len(kps) * 0.1 if kps else True,
        'detail': f'标注前置知识的知识点 {prerequisite_kps}/{len(kps)}（建议≥10%）',
    }


def _validate_teaching_utility(course_id, result):
    utility = result['teaching_utility']

    chapters = CourseChapter.query.filter_by(course_id=course_id).all()
    chapters_with_hours = sum(1 for ch in chapters if ch.teaching_hours and ch.teaching_hours > 0)
    utility['teaching_hours_specified'] = {
        'passed': chapters_with_hours >= len(chapters) * 0.5 if chapters else True,
        'detail': f'指定学时的章节 {chapters_with_hours}/{len(chapters)}（建议≥50%）',
    }

    chapters_with_methods = sum(1 for ch in chapters if _safe_json_len(ch.teaching_methods) > 0)
    utility['teaching_methods_specified'] = {
        'passed': chapters_with_methods >= len(chapters) * 0.5 if chapters else True,
        'detail': f'指定教学方法的章节 {chapters_with_methods}/{len(chapters)}（建议≥50%）',
    }

    cases = TeachingCase.query.filter_by(course_id=course_id).all()
    cases_with_code = sum(1 for c in cases if c.code_example and len(c.code_example.strip()) > 10)
    utility['code_examples'] = {
        'passed': cases_with_code >= len(cases) * 0.3 if cases else True,
        'detail': f'包含代码示例的案例 {cases_with_code}/{len(cases)}（建议≥30%）',
    }

    case_types = db.session.query(TeachingCase.case_type).filter_by(course_id=course_id).distinct().all()
    utility['case_type_diversity'] = {
        'passed': len(case_types) >= 2,
        'detail': f'案例类型 {len(case_types)} 种（建议≥2）',
    }

    exercises = CourseExercise.query.filter_by(course_id=course_id).all()
    total_score = sum(e.score for e in exercises)
    utility['exercise_scoring'] = {
        'passed': total_score >= 50,
        'detail': f'习题总分 {total_score}（建议≥50）',
    }

    exercises_with_time = sum(1 for e in exercises if e.estimated_minutes and e.estimated_minutes > 0)
    utility['exercise_time_estimation'] = {
        'passed': exercises_with_time >= len(exercises) * 0.5 if exercises else True,
        'detail': f'有预估时间的习题 {exercises_with_time}/{len(exercises)}（建议≥50%）',
    }

    kp_with_examples = sum(1 for kp in KnowledgePoint.query.filter_by(course_id=course_id).all()
                           if _safe_json_len(kp.examples) > 0)
    utility['kp_examples'] = {
        'passed': kp_with_examples >= 3,
        'detail': f'包含示例的知识点 {kp_with_examples}（建议≥3）',
    }

    cases_with_bg = sum(1 for c in cases if c.background and len(c.background.strip()) > 10)
    utility['case_background'] = {
        'passed': cases_with_bg >= len(cases) * 0.5 if cases else True,
        'detail': f'有背景描述的案例 {cases_with_bg}/{len(cases)}（建议≥50%）',
    }


def _safe_json_len(value):
    if value is None:
        return 0
    if isinstance(value, (list, dict)):
        return len(value)
    try:
        parsed = json.loads(value)
        return len(parsed) if isinstance(parsed, (list, dict)) else 0
    except (json.JSONDecodeError, TypeError):
        return 0


def _safe_json_parse(value):
    if value is None:
        return []
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []
