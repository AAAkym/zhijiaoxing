"""为班级 1 的全部学生虚拟填充画像与学习证据（仅写入本机 dev.db）。

目的：让「班级学习类型分组」与「生成依据链」展示真实运行效果。

诚实性说明：本脚本只写入**结构真实**的记录（画像 8 维、练习评测、错题记录、
学习进度），所有可信度/完整度都由 build_profile_explainability 依据这些真实
行计算得出，不直接写死 confidence_score/completeness_score。

用法：
    python _seed_virtual_profiles.py            # 写入
    python _seed_virtual_profiles.py --reset    # 先清理本脚本写入的数据再写入
"""
import argparse
import json
import logging
import os
import random
import sys
from datetime import datetime, timedelta

os.environ['FLASK_ENV'] = 'development'
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 关闭 SQLAlchemy 的 SQL 回显，避免淹没脚本输出
logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

from src.main import app
from src.models.user import db, User, ClassGroupStudent
from src.models.student_profile import StudentProfile
from src.models.course import (
    Course, Assessment, PracticeEvaluation, MistakeRecord, LearningProgress,
)

#: 虚拟数据统一标记，便于一键清理
SEED_SOURCE = 'virtual_seed'
COURSE_ID = 4           # Python 程序设计（班级 1 已绑定，含 7 个考核、51 个知识点）
CLASS_ID = 1

#: 每名学生的画像与证据模板。cognitive_style 决定主分组维度，
#: weak_points 决定次分组维度（班级分组规则：认知风格 → 薄弱知识点 → 目标导向）。
STUDENT_TEMPLATES = [
    {
        'username': 'student',
        'cognitive_style': 'visual',
        'learning_pace': 'slow',
        'goal_orientation': 'exam',
        'interaction_preference': 'guided',
        'interest_areas': ['算法可视化', '数据结构'],
        'time_availability': {'weekend': 4, 'weekday_evening': 2},
        'knowledge_base': {'变量与数据类型': 82, '循环结构': 55},
        'weak_points': ['循环结构', '函数定义与返回值'],
        'error_patterns': [
            {'knowledge_point': '循环结构', 'error_type': '边界条件遗漏'},
            {'knowledge_point': '函数定义与返回值', 'error_type': '返回值缺失'},
        ],
        'avg_score': 68,
    },
    {
        'username': 'stu001',
        'cognitive_style': 'visual',
        'learning_pace': 'moderate',
        'goal_orientation': 'exam',
        'interaction_preference': 'exploratory',
        'interest_areas': ['前端开发', '可视化'],
        'time_availability': {'weekend': 3, 'weekday_evening': 3},
        'knowledge_base': {'变量与数据类型': 76, '循环结构': 61},
        'weak_points': ['循环结构', '字典'],
        'error_patterns': [
            {'knowledge_point': '循环结构', 'error_type': '边界条件遗漏'},
            {'knowledge_point': '字典', 'error_type': '键值混淆'},
        ],
        'avg_score': 72,
    },
    {
        'username': 'stu002',
        'cognitive_style': 'visual',
        'learning_pace': 'fast',
        'goal_orientation': 'career',
        'interaction_preference': 'challenging',
        'interest_areas': ['数据可视化', '爬虫'],
        'time_availability': {'weekend': 6, 'weekday_evening': 4},
        'knowledge_base': {'变量与数据类型': 88, '循环结构': 74},
        'weak_points': ['循环结构'],
        'error_patterns': [{'knowledge_point': '循环结构', 'error_type': '循环条件错误'}],
        'avg_score': 84,
    },
    {
        'username': 'stu003',
        'cognitive_style': 'kinesthetic',
        'learning_pace': 'moderate',
        'goal_orientation': 'career',
        'interaction_preference': 'exploratory',
        'interest_areas': ['项目实战', '自动化脚本'],
        'time_availability': {'weekend': 3, 'weekday_evening': 2},
        'knowledge_base': {'变量与数据类型': 70, '循环结构': 58},
        'weak_points': ['函数定义与返回值', '模块导入'],
        'error_patterns': [
            {'knowledge_point': '函数定义与返回值', 'error_type': '参数传递错误'},
            {'knowledge_point': '模块导入', 'error_type': '导入路径错误'},
        ],
        'avg_score': 70,
    },
    {
        'username': 'stu004',
        'cognitive_style': 'kinesthetic',
        'learning_pace': 'slow',
        'goal_orientation': 'career',
        'interaction_preference': 'guided',
        'interest_areas': ['项目实战', '游戏开发'],
        'time_availability': {'weekend': 5, 'weekday_evening': 1},
        'knowledge_base': {'变量与数据类型': 64, '循环结构': 48},
        'weak_points': ['函数定义与返回值', '字典'],
        'error_patterns': [
            {'knowledge_point': '函数定义与返回值', 'error_type': '返回值缺失'},
            {'knowledge_point': '字典', 'error_type': '键值混淆'},
        ],
        'avg_score': 62,
    },
    {
        'username': 'stu005',
        'cognitive_style': 'reading',
        'learning_pace': 'moderate',
        'goal_orientation': 'research',
        'interaction_preference': 'guided',
        'interest_areas': ['算法理论', '文献阅读'],
        'time_availability': {'weekend': 2, 'weekday_evening': 4},
        'knowledge_base': {'变量与数据类型': 80, '循环结构': 66},
        'weak_points': ['字典', '异常处理'],
        'error_patterns': [
            {'knowledge_point': '字典', 'error_type': '键值混淆'},
            {'knowledge_point': '异常处理', 'error_type': '异常类型不匹配'},
        ],
        'avg_score': 76,
    },
    {
        'username': 'stu006',
        'cognitive_style': 'reading',
        'learning_pace': 'fast',
        'goal_orientation': 'research',
        'interaction_preference': 'challenging',
        'interest_areas': ['算法理论', '机器学习'],
        'time_availability': {'weekend': 6, 'weekday_evening': 5},
        'knowledge_base': {'变量与数据类型': 92, '循环结构': 81},
        'weak_points': ['异常处理'],
        'error_patterns': [{'knowledge_point': '异常处理', 'error_type': '异常类型不匹配'}],
        'avg_score': 88,
    },
    {
        'username': 'stu007',
        'cognitive_style': 'auditory',
        'learning_pace': 'moderate',
        'goal_orientation': 'hobby',
        'interaction_preference': 'guided',
        'interest_areas': ['音频处理', '脚本工具'],
        'time_availability': {'weekend': 3, 'weekday_evening': 2},
        'knowledge_base': {'变量与数据类型': 72, '循环结构': 60},
        'weak_points': ['模块导入', '文件读写'],
        'error_patterns': [
            {'knowledge_point': '模块导入', 'error_type': '导入路径错误'},
            {'knowledge_point': '文件读写', 'error_type': '编码未指定'},
        ],
        'avg_score': 71,
    },
    {
        'username': 'stu008',
        'cognitive_style': 'auditory',
        'learning_pace': 'slow',
        'goal_orientation': 'hobby',
        'interaction_preference': 'exploratory',
        'interest_areas': ['多媒体处理', '创意编程'],
        'time_availability': {'weekend': 4, 'weekday_evening': 2},
        'knowledge_base': {'变量与数据类型': 66, '循环结构': 52},
        'weak_points': ['模块导入', '循环结构'],
        'error_patterns': [
            {'knowledge_point': '模块导入', 'error_type': '导入路径错误'},
            {'knowledge_point': '循环结构', 'error_type': '边界条件遗漏'},
        ],
        'avg_score': 65,
    },
    {
        'username': 'stu009',
        'cognitive_style': 'mixed',
        'learning_pace': 'adaptive',
        'goal_orientation': 'exam',
        'interaction_preference': 'guided',
        'interest_areas': ['综合练习'],
        'time_availability': {'weekend': 3, 'weekday_evening': 3},
        'knowledge_base': {'变量与数据类型': 74, '循环结构': 63},
        'weak_points': ['字典', '文件读写'],
        'error_patterns': [
            {'knowledge_point': '字典', 'error_type': '键值混淆'},
            {'knowledge_point': '文件读写', 'error_type': '编码未指定'},
        ],
        'avg_score': 73,
    },
]


def _reset(db_session):
    """清理本脚本先前写入的数据（按标记识别，不动其它业务数据）。"""
    user_ids = [u.id for u in User.query.filter(User.username.in_(
        [t['username'] for t in STUDENT_TEMPLATES])).all()]
    if not user_ids:
        return 0
    removed = 0
    removed += MistakeRecord.query.filter(
        MistakeRecord.user_id.in_(user_ids),
        MistakeRecord.error_type_manual == SEED_SOURCE,
    ).delete(synchronize_session=False)
    removed += PracticeEvaluation.query.filter(
        PracticeEvaluation.user_id.in_(user_ids),
        PracticeEvaluation.evaluation_result == SEED_SOURCE,
    ).delete(synchronize_session=False)
    removed += LearningProgress.query.filter(
        LearningProgress.user_id.in_(user_ids)).delete(synchronize_session=False)
    db_session.commit()
    return removed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reset', action='store_true', help='先清理本脚本写入的数据')
    args = parser.parse_args()

    rng = random.Random(20260922)

    with app.app_context():
        if args.reset:
            n = _reset(db.session)
            print(f'[reset] 清理 {n} 行虚拟证据')

        course = Course.query.get(COURSE_ID)
        if course is None:
            print(f'ERROR: course {COURSE_ID} 不存在')
            return 1
        assessments = Assessment.query.filter_by(course_id=COURSE_ID).order_by(Assessment.id).all()
        if not assessments:
            print(f'ERROR: course {COURSE_ID} 没有考核记录，无法挂靠练习评测')
            return 1

        members = {m.user_id: m for m in ClassGroupStudent.query.filter_by(class_group_id=CLASS_ID).all()}
        now = datetime.utcnow()

        created_profiles = created_practice = created_mistakes = created_progress = 0

        for template in STUDENT_TEMPLATES:
            user = User.query.filter_by(username=template['username']).first()
            if user is None:
                print(f"  SKIP {template['username']}: 用户不存在")
                continue
            if user.id not in members:
                print(f"  SKIP {template['username']}: 不在班级 {CLASS_ID} 中")
                continue

            # ---- 画像：8 个维度全部填充，confidence 由模型统一重算 ----
            profile = StudentProfile.query.filter_by(user_id=user.id).first()
            if profile is None:
                profile = StudentProfile(user_id=user.id)
                db.session.add(profile)
                created_profiles += 1

            profile.cognitive_style = template['cognitive_style']
            profile.learning_pace = template['learning_pace']
            profile.goal_orientation = template['goal_orientation']
            profile.interaction_preference = template['interaction_preference']
            profile.set_interest_areas(template['interest_areas'])
            profile.set_time_availability(template['time_availability'])
            profile.set_knowledge_base(template['knowledge_base'])
            profile.set_error_patterns(template['error_patterns'])
            profile.update_source = 'dialog'
            profile.last_updated = now - timedelta(days=rng.randint(1, 5))
            profile._recalculate_confidence()

            # ---- 练习评测：真实挂靠 course 4 的考核记录 ----
            if not PracticeEvaluation.query.filter_by(
                    user_id=user.id, evaluation_result=SEED_SOURCE).first():
                base = template['avg_score']
                for index in range(6):
                    assessment = assessments[index % len(assessments)]
                    score = max(35.0, min(100.0, base + rng.randint(-9, 9)))
                    db.session.add(PracticeEvaluation(
                        user_id=user.id,
                        assessment_id=assessment.id,
                        user_answer=f'print("answer-{index}")',
                        evaluation_result=SEED_SOURCE,
                        score=round(score, 1),
                        created_at=now - timedelta(days=rng.randint(1, 20), hours=index),
                    ))
                    created_practice += 1

            # ---- 错题记录：带 knowledge_tags，供依据链读取明细 ----
            if not MistakeRecord.query.filter_by(
                    user_id=user.id, error_type_manual=SEED_SOURCE).first():
                for index, weak in enumerate(template['weak_points']):
                    error_type = next(
                        (item['error_type'] for item in template['error_patterns']
                         if item['knowledge_point'] == weak),
                        '概念理解偏差',
                    )
                    db.session.add(MistakeRecord(
                        user_id=user.id,
                        course_id=COURSE_ID,
                        assessment_id=assessments[index % len(assessments)].id,
                        question_index=index + 1,
                        question_content=f'关于「{weak}」的练习题：请写出正确实现并说明边界条件。',
                        user_answer=f'# 学生 {template["username"]} 的作答（第 {index + 1} 题）',
                        correct_answer=f'# 「{weak}」的标准实现',
                        mistake_count=rng.randint(1, 4),
                        last_mistake_at=now - timedelta(days=rng.randint(1, 15)),
                        mastery_status='unmastered' if index == 0 else 'reviewing',
                        knowledge_tags=json.dumps([weak], ensure_ascii=False),
                        error_type_auto=error_type,
                        error_type_manual=SEED_SOURCE,
                        error_reason_detail=f'在「{weak}」上出现「{error_type}」。',
                        error_type_confidence=round(rng.uniform(0.72, 0.95), 2),
                    ))
                    created_mistakes += 1

            # ---- 学习进度：第二个证据来源，帮助可信度越过 50 阈值 ----
            if not LearningProgress.query.filter_by(user_id=user.id, course_id=COURSE_ID).first():
                db.session.add(LearningProgress(
                    user_id=user.id,
                    course_id=COURSE_ID,
                    progress_percentage=round(rng.uniform(35, 92), 1),
                    last_accessed=now - timedelta(days=rng.randint(1, 6)),
                ))
                created_progress += 1

        db.session.commit()
        print(f'[seed] profiles+={created_profiles} practice+={created_practice} '
              f'mistakes+={created_mistakes} progress+={created_progress}')
        return 0


if __name__ == '__main__':
    sys.exit(main())
