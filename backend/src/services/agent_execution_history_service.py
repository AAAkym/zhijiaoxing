"""智能体执行历史服务：把"多智能体到底协作过什么"变成可回溯、可验收的证据。

为什么需要它（现状缺口，有实测依据）：

- `agent_execution_logs` 表里有 **167 条真实执行记录**（coordinator 96 / document 27 /
  project 16 / media 11 / recommendation 11 / exercise 6），但**没有读取入口**：
  `GET /api/resource-generation/agents/status` 只返回 `AgentMonitor` 的**内存态**，
  服务一重启就归零（实测重启后 `total_tasks = 0`，而库里仍有 167 条）。
- `coordinator_agent._generate_resource_package` 会把 9 个 Agent 的 `execution_details`
  打进资源包（`generation_explanation["execution"]`），但**视图层没有任何组件消费它**，
  这份"哪一阶段由哪个智能体负责、耗时多少、命中哪些画像特征"的证据事实上是死的。

设计约束：

- **只读**：只做 SELECT，不写库、不建表、不改 schema（铁律 5）。
- **不改既有契约**：不改 `/agents/status` 的响应字段，只**新增**端点。
- **诚实性硬规则**：`coverage_rate` 的分母是**六阶段流水线里的六个环节**，
  不是"所有已注册 agent"—— 拿不到证据的阶段必须显式列入 `stages_without_evidence`，
  绝不用别的 agent 的记录冒充。
- **零新依赖**：只用标准库 + 现有 SQLAlchemy 模型。
"""

from datetime import datetime, timedelta

from src.models.agent_execution_log import AgentExecutionLog
from src.services.multi_agent.coordinator_agent import GENERATION_STAGES

#: 六阶段流水线中，哪些阶段应当由哪个智能体留下执行记录。
#:
#: 这是一张**显式契约表**，不是从数据里猜出来的：每一行都能在
#: `coordinator_agent._generate_resource_package` 的调用链上找到对应关系。
#: `evidence_required=False` 表示该阶段是**协调器自身**的纯计算步骤，
#: 不产生独立的 agent 执行记录，因此不计入覆盖率分母。
STAGE_OWNERSHIP = (
    {
        "stage": "profile",
        "stage_label": "读取学生画像",
        "owner_agent": "coordinator",
        "evidence_required": True,
        "evidence_note": "协调器读取 student_profile 与 explainability",
    },
    {
        "stage": "knowledge",
        "stage_label": "检索课程知识库",
        "owner_agent": "coordinator",
        "evidence_required": True,
        "evidence_note": "协调器调用 knowledge_base_service / rag_citation_service",
    },
    {
        "stage": "strategy",
        "stage_label": "协调智能体制定策略",
        "owner_agent": "coordinator",
        "evidence_required": True,
        "evidence_note": "协调器生成 generation_strategy 与六阶段计划",
    },
    {
        "stage": "agents",
        "stage_label": "各资源智能体并行生成",
        # 这一阶段由多个专业智能体共同承担，没有单一 owner。
        "owner_agent": None,
        "evidence_required": True,
        "evidence_note": "exercise/document/media/recommendation/project/ppt 等专业智能体",
    },
    {
        "stage": "quality",
        "stage_label": "一致性和质量检查",
        "owner_agent": "coordinator",
        "evidence_required": False,
        "evidence_note": "协调器内部纯计算，不产生独立执行记录",
    },
    {
        "stage": "package",
        "stage_label": "整合个性化资源包",
        "owner_agent": "coordinator",
        "evidence_required": False,
        "evidence_note": "协调器内部纯计算，不产生独立执行记录",
    },
)

#: 阶段 → 展示名，供调用方复用，避免各处重复维护。
#: 注意 `GENERATION_STAGES` 是 `(key, label)` 二元组，不是 dict（实测踩过一次）。
STAGE_LABELS = {stage_key: stage_label for stage_key, stage_label in GENERATION_STAGES}

#: 专业资源智能体名单（与 coordinator_agent.__init__ 中注册的一致）。
RESOURCE_AGENT_NAMES = (
    "exercise_agent",
    "document_agent",
    "media_agent",
    "recommendation_agent",
    "project_agent",
    "ppt_agent",
)

#: 智能体展示名。缺失时回落为 agent_name 本身，不编造。
AGENT_LABELS = {
    "coordinator": "协调智能体",
    "exercise_agent": "练习设计智能体",
    "document_agent": "课程文档智能体",
    "media_agent": "视频脚本智能体",
    "recommendation_agent": "拓展推荐智能体",
    "project_agent": "实操项目智能体",
    "ppt_agent": "课件生成智能体",
}

#: 默认统计窗口（天）。
DEFAULT_WINDOW_DAYS = 30

#: 单次查询最多返回多少条明细。
DEFAULT_LIMIT = 50
MAX_LIMIT = 200


def agent_label(agent_name):
    """返回智能体的中文展示名；未知智能体原样返回，不猜测。"""
    return AGENT_LABELS.get(agent_name, agent_name or "未知智能体")


def _window_start(days):
    """把入参夹到 [1, 365] 天。

    必须区分"没传"和"传了 0/负数/垃圾值"：``x or DEFAULT`` 会把 0 悄悄变成默认值，
    调用方以为"只看今天"，实际拿到 30 天。因此这里只用 None 表示缺省。
    """
    parsed = _as_int(days)
    if parsed is None:
        parsed = DEFAULT_WINDOW_DAYS
    parsed = max(1, min(parsed, 365))
    return datetime.utcnow() - timedelta(days=parsed), parsed


def _clamp_limit(limit):
    """同 `_window_start`：0 必须夹到 1，而不是被当成"没传"从而回到 50。"""
    parsed = _as_int(limit)
    if parsed is None:
        parsed = DEFAULT_LIMIT
    return max(1, min(parsed, MAX_LIMIT))


def _as_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _as_float(value):
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_agent_execution_history(days=DEFAULT_WINDOW_DAYS, agent_name=None, limit=DEFAULT_LIMIT):
    """汇总智能体执行历史（只读）。

    返回结构（全部字段都来自真实查询，缺数据就返回空/None，不补默认值）：

    ```
    {
      "window_days": 30,
      "generated_at": "...",
      "totals": {"records": n, "success": n, "failed": n, "avg_duration_ms": n|None},
      "agents": [ {agent_name, agent_label, total, success, failed, success_rate,
                   avg_duration_ms, last_executed_at, task_types: [...]} ],
      "pipeline": {"stages": [...], "coverage_rate": 0.8,
                   "stages_with_evidence": [...], "stages_without_evidence": [...]},
      "recent": [ ...明细... ]
    }
    ```
    """
    since, window_days = _window_start(days)
    limit = _clamp_limit(limit)

    query = AgentExecutionLog.query.filter(AgentExecutionLog.created_at >= since)
    if agent_name:
        query = query.filter(AgentExecutionLog.agent_name == agent_name)
    records = query.order_by(AgentExecutionLog.created_at.desc()).all()

    totals = _build_totals(records)
    agents = _build_agent_rows(records)
    return {
        "window_days": window_days,
        "generated_at": datetime.utcnow().isoformat(),
        "filter": {"agent_name": agent_name or None},
        "totals": totals,
        "agents": agents,
        "pipeline": build_pipeline_coverage(records),
        "recent": [record.to_dict() for record in records[:limit]],
    }


def _build_totals(records):
    durations = [
        record.duration_ms for record in records
        if isinstance(record.duration_ms, int) and record.duration_ms > 0
    ]
    success = sum(1 for record in records if record.status == "success")
    failed = sum(1 for record in records if record.status == "failed")
    return {
        "records": len(records),
        "success": success,
        "failed": failed,
        "unknown_status": len(records) - success - failed,
        "avg_duration_ms": round(sum(durations) / len(durations)) if durations else None,
    }


def _build_agent_rows(records):
    grouped = {}
    for record in records:
        row = grouped.setdefault(record.agent_name, {
            "agent_name": record.agent_name,
            "agent_label": agent_label(record.agent_name),
            "total": 0,
            "success": 0,
            "failed": 0,
            "durations": [],
            "last_executed_at": None,
            "task_types": [],
        })
        row["total"] += 1
        if record.status == "success":
            row["success"] += 1
        elif record.status == "failed":
            row["failed"] += 1
        if isinstance(record.duration_ms, int) and record.duration_ms > 0:
            row["durations"].append(record.duration_ms)
        created = record.created_at.isoformat() if record.created_at else None
        if created and (row["last_executed_at"] is None or created > row["last_executed_at"]):
            row["last_executed_at"] = created
        if record.task_type and record.task_type not in row["task_types"]:
            row["task_types"].append(record.task_type)

    rows = []
    for row in grouped.values():
        durations = row.pop("durations")
        row["avg_duration_ms"] = round(sum(durations) / len(durations)) if durations else None
        row["success_rate"] = round(row["success"] / row["total"], 2) if row["total"] else 0
        row["failed_count"] = row["failed"]
        rows.append(row)
    rows.sort(key=lambda item: (-item["total"], item["agent_name"]))
    return rows


def build_pipeline_coverage(records):
    """把六阶段流水线与真实执行记录对齐，并**如实**报告覆盖情况。

    分母只算 `evidence_required=True` 的阶段。拿不到证据的阶段进
    `stages_without_evidence`，前端必须显式展示为"无执行证据"，
    而不是静默按"通过"处理。
    """
    agents_seen = {record.agent_name for record in records}
    stages = []
    with_evidence = []
    without_evidence = []

    for spec in STAGE_OWNERSHIP:
        owner = spec["owner_agent"]
        if owner is None:
            # "agents" 阶段：只要任一专业智能体留下记录即算有证据。
            matched = sorted(name for name in agents_seen if name in RESOURCE_AGENT_NAMES)
        else:
            matched = [owner] if owner in agents_seen else []

        has_evidence = bool(matched)
        stage = {
            "stage": spec["stage"],
            "stage_label": spec["stage_label"],
            "owner_agent": owner,
            "owner_label": agent_label(owner) if owner else "多个专业智能体",
            "evidence_required": spec["evidence_required"],
            "evidence_note": spec["evidence_note"],
            "matched_agents": matched,
            "has_evidence": has_evidence,
        }
        stages.append(stage)
        if not spec["evidence_required"]:
            continue
        if has_evidence:
            with_evidence.append(spec["stage"])
        else:
            without_evidence.append(spec["stage"])

    required = [item for item in STAGE_OWNERSHIP if item["evidence_required"]]
    coverage = round(len(with_evidence) / len(required), 2) if required else 0
    return {
        "stages": stages,
        "coverage_rate": coverage,
        "stages_with_evidence": with_evidence,
        "stages_without_evidence": without_evidence,
    }


def build_single_latest_execution(agent_name):
    """返回某个智能体最近一次真实执行记录；没有记录就返回 None，不编造。"""
    record = (
        AgentExecutionLog.query
        .filter(AgentExecutionLog.agent_name == agent_name)
        .order_by(AgentExecutionLog.created_at.desc())
        .first()
    )
    return record.to_dict() if record else None
