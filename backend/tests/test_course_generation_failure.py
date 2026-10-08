"""课程生成失败必须显式短路，不得把错误文本落库成"内容版本"（第二轮 J2-06）。

缺陷回顾：generate_step_content 在 Spark 调用超时/报错时，曾把
"生成失败，请重试。错误信息：..." 作为 content 写进 CourseGenerationVersion，
前端把这条"版本"当正常内容展示，还配着"确认并继续"按钮——
教师稍不留意就会把报错信息定稿成课程内容。
本测试锁定：失败时返回 {"error": ...} 且**不产生任何版本记录**。
"""

from unittest.mock import patch

import pytest

from src.models.course import CourseGenerationConfig, CourseGenerationVersion
from src.models.user import User
from src.services import course_generation_service as svc


@pytest.fixture
def teacher_user(app, db_session):
    user = User(username="gen_teacher", role="teacher", password_hash="x")
    db_session.session.add(user)
    db_session.session.commit()
    return user


def _make_config(db_session, teacher_id):
    config = CourseGenerationConfig(teacher_id=teacher_id)
    db_session.session.add(config)
    db_session.session.commit()
    return config


def test_generation_failure_returns_error_and_persists_no_version(app, db_session, teacher_user):
    config = _make_config(db_session, teacher_user.id)

    # spark_service 在被测函数内部导入，须 patch 其源模块
    with patch(
        "src.services.spark_service.spark_service.generate_teaching_content",
        side_effect=TimeoutError("read timed out"),
    ):
        result = svc.generate_step_content(config.id, teacher_user.id, step=1)

    assert "error" in result
    assert "AI 生成失败" in result["error"]
    remaining = CourseGenerationVersion.query.filter_by(config_id=config.id).all()
    assert remaining == [], "失败绝不能把错误文本落库成内容版本"


def test_generation_failure_error_is_truncated(app, db_session, teacher_user):
    """超长异常文本应被截断，避免把整段堆栈塞给前端。"""
    config = _make_config(db_session, teacher_user.id)

    with patch(
        "src.services.spark_service.spark_service.generate_teaching_content",
        side_effect=RuntimeError("x" * 5000),
    ):
        result = svc.generate_step_content(config.id, teacher_user.id, step=2)

    assert len(result["error"]) <= 250
