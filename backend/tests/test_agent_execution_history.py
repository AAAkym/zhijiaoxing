"""智能体执行历史服务的测试（纯新增）。

覆盖：正常路径 / 空态 / 边界。
"""

import json
from datetime import datetime, timedelta

import pytest

from src.services.agent_execution_history_service import (
    AGENT_LABELS,
    RESOURCE_AGENT_NAMES,
    STAGE_OWNERSHIP,
    agent_label,
    build_agent_execution_history,
    build_pipeline_coverage,
    build_single_latest_execution,
)


def _log(db_session, agent_name, status="success", duration_ms=None, task_type=None,
         created_at=None, user_id=None):
    from src.models.agent_execution_log import AgentExecutionLog

    record = AgentExecutionLog(
        agent_name=agent_name,
        task_type=task_type,
        status=status,
        duration_ms=duration_ms,
        user_id=user_id,
        created_at=created_at or datetime.utcnow(),
    )
    db_session.session.add(record)
    db_session.session.commit()
    return record


def test_history_reports_real_totals_and_per_agent_rows(db_session):
    _log(db_session, "coordinator", duration_ms=1200, task_type="generate_resource_package")
    _log(db_session, "coordinator", duration_ms=800)
    _log(db_session, "document_agent", duration_ms=4000)
    _log(db_session, "exercise_agent", status="failed", duration_ms=250)

    payload = build_agent_execution_history(days=30)

    assert payload["totals"]["records"] == 4
    assert payload["totals"]["success"] == 3
    assert payload["totals"]["failed"] == 1
    assert payload["totals"]["avg_duration_ms"] == round((1200 + 800 + 4000 + 250) / 4)

    rows = {row["agent_name"]: row for row in payload["agents"]}
    # 排序按记录数降序：coordinator 有 2 条排第一。
    assert payload["agents"][0]["agent_name"] == "coordinator"
    assert rows["coordinator"]["total"] == 2
    assert rows["coordinator"]["success_rate"] == 1.0
    assert rows["document_agent"]["avg_duration_ms"] == 4000
    assert rows["exercise_agent"]["failed"] == 1
    assert rows["exercise_agent"]["success_rate"] == 0.0
    assert rows["coordinator"]["agent_label"] == AGENT_LABELS["coordinator"]


def test_history_is_empty_when_no_records_exist(db_session):
    payload = build_agent_execution_history(days=30)

    assert payload["totals"] == {
        "records": 0, "success": 0, "failed": 0,
        "unknown_status": 0, "avg_duration_ms": None,
    }
    assert payload["agents"] == []
    assert payload["recent"] == []
    # 空态下覆盖率必须是 0，而不是被默认成"全部通过"。
    assert payload["pipeline"]["coverage_rate"] == 0
    assert payload["pipeline"]["stages_without_evidence"] == [
        item["stage"] for item in STAGE_OWNERSHIP if item["evidence_required"]
    ]


def test_history_window_excludes_old_records(db_session):
    _log(db_session, "coordinator", created_at=datetime.utcnow() - timedelta(days=40))
    _log(db_session, "coordinator", created_at=datetime.utcnow() - timedelta(days=1))

    assert build_agent_execution_history(days=30)["totals"]["records"] == 1
    assert build_agent_execution_history(days=90)["totals"]["records"] == 2


def test_history_window_days_is_clamped_to_sane_range(db_session):
    # 0 / 负数 / 超大值都必须被夹到 [1, 365]，不允许把整库一次性拉出来。
    assert build_agent_execution_history(days=0)["window_days"] == 1
    assert build_agent_execution_history(days=-5)["window_days"] == 1
    assert build_agent_execution_history(days=99999)["window_days"] == 365
    assert build_agent_execution_history(days=None)["window_days"] == 30


def test_history_limit_is_clamped_and_applied(db_session):
    for _ in range(5):
        _log(db_session, "coordinator")

    assert len(build_agent_execution_history(days=30, limit=2)["recent"]) == 2
    # 明细被截断，但统计口径不受 limit 影响。
    assert build_agent_execution_history(days=30, limit=2)["totals"]["records"] == 5
    assert len(build_agent_execution_history(days=30, limit=0)["recent"]) == 1
    assert len(build_agent_execution_history(days=30, limit=10000)["recent"]) == 5


def test_history_filters_by_agent_name(db_session):
    _log(db_session, "coordinator")
    _log(db_session, "media_agent")

    payload = build_agent_execution_history(days=30, agent_name="media_agent")

    assert payload["totals"]["records"] == 1
    assert [row["agent_name"] for row in payload["agents"]] == ["media_agent"]
    assert payload["filter"]["agent_name"] == "media_agent"


def test_pipeline_coverage_counts_only_required_stages():
    from src.models.agent_execution_log import AgentExecutionLog

    # 只让 coordinator 有记录：profile/knowledge/strategy 三个必需阶段有证据，
    # agents 阶段没有 → 覆盖率 3/4，且 agents 必须出现在缺口里。
    fake = [AgentExecutionLog(agent_name="coordinator", status="success")]
    pipeline = build_pipeline_coverage(fake)

    assert pipeline["coverage_rate"] == 0.75
    assert pipeline["stages_with_evidence"] == ["profile", "knowledge", "strategy"]
    assert pipeline["stages_without_evidence"] == ["agents"]

    stages = {item["stage"]: item for item in pipeline["stages"]}
    # quality / package 是协调器内部纯计算，不计入分母，也不需要 owner 记录。
    assert stages["quality"]["evidence_required"] is False
    assert stages["package"]["evidence_required"] is False


def test_pipeline_marks_agents_stage_when_any_specialist_reports():
    from src.models.agent_execution_log import AgentExecutionLog

    fake = [AgentExecutionLog(agent_name=name, status="success") for name in RESOURCE_AGENT_NAMES]
    pipeline = build_pipeline_coverage(fake)

    stages = {item["stage"]: item for item in pipeline["stages"]}
    assert stages["agents"]["has_evidence"] is True
    assert stages["agents"]["matched_agents"] == sorted(RESOURCE_AGENT_NAMES)
    # 没有 coordinator 记录时，三个协调器阶段必须如实标为无证据。
    assert pipeline["stages_without_evidence"] == ["profile", "knowledge", "strategy"]


def test_pipeline_never_invents_evidence_for_unknown_agents():
    from src.models.agent_execution_log import AgentExecutionLog

    fake = [AgentExecutionLog(agent_name="totally_unknown_agent", status="success")]
    pipeline = build_pipeline_coverage(fake)

    assert pipeline["coverage_rate"] == 0
    assert all(item["has_evidence"] is False for item in pipeline["stages"])


def test_latest_execution_returns_none_instead_of_inventing_one(db_session):
    assert build_single_latest_execution("document_agent") is None

    _log(db_session, "document_agent", task_type="generate_course_document")
    latest = build_single_latest_execution("document_agent")

    assert latest["agent_name"] == "document_agent"
    assert latest["task_type"] == "generate_course_document"


def test_unknown_agent_label_falls_back_to_the_raw_name():
    assert agent_label("brand_new_agent") == "brand_new_agent"
    assert agent_label(None) == "未知智能体"


def test_history_route_is_registered_and_requires_auth(client):
    """防静默失效：路由必须真的在 url_map 里，且未登录不得落到 SPA 兜底。"""
    from src.main import app

    rules = {str(rule) for rule in app.url_map.iter_rules()}
    assert "/api/resource-generation/agents/history" in rules

    response = client.get("/api/resource-generation/agents/history")
    assert response.status_code == 401
    assert response.is_json


def test_history_route_returns_json_payload_for_logged_in_user(client, auth_session, db_session):
    _log(db_session, "coordinator", duration_ms=1500, task_type="generate_resource_package")

    with client.session_transaction() as sess:
        sess["user_id"] = auth_session.id
        sess["user_role"] = auth_session.role
        sess["username"] = auth_session.username

    response = client.get("/api/resource-generation/agents/history?days=7&limit=10")

    assert response.status_code == 200
    assert response.is_json
    payload = response.get_json()
    assert payload["window_days"] == 7
    assert payload["totals"]["records"] == 1
    assert payload["agents"][0]["agent_name"] == "coordinator"
    # 响应必须真的可 JSON 序列化（历史上有过把 datetime 直接塞进 jsonify 的翻车）。
    assert json.loads(response.get_data(as_text=True))["pipeline"]["coverage_rate"] == 0.75
