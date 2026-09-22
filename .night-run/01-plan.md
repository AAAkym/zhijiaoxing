# 01-plan.md · 今夜计划（2026-09-22）

> 分支 `night-run/20260922`　基线 `2c15220`

## 0. 与任务书的偏离说明（必须先讲清楚）

任务书第 3 节要求"先侦察 7 项遗留问题 → 再清理 → 再深度实施"。
实际执行时我在**第 0 步就发现工作区有 11 个已修改 + 10 个未跟踪文件，且运行中的实例已经加载了它们**。
这批改动覆盖的正是任务书第 4 节要做的方向（多 Agent 依据链 / 协作可视化）。

因此计划调整为：

1. 先把这批**已存在但未固化**的资产验证、补齐测试、提交（否则一旦回滚/切分支就整体丢失）；
2. 再做**今夜新增**的深度功能，建立在它们之上；
3. roadmap / 防护测试 / 报告按原计划。

## 1. 选定功能（第 4 节"多 Agent 协作 / 工作流"方向）

### 功能一 · 生成依据链（Generation Basis Chain）—— 已在积压改动中，本轮接管并加固
- **可演示**：学生端「个性化学习任务」每份资源上多一个按钮「我为什么是给你的」。
- **可验收**：`GET /api/student/personalized-deliveries/<id>/resources/<key>/basis`
  必须返回 `application/json` 且 `basis.profile_evidence` 非空（有画像时）。
- **可测试**：`backend/tests/test_generation_basis.py` + 前端 `ResourceBasisPanel.test.jsx`。
- **纯新增**：新增服务文件 + 新增只读端点，不改既有响应字段。
- **多 Agent 体现**：`coordinator_agent._backfill_execution_evidence` 把 9 个 Agent 的
  执行记录回填成 `basis_refs / knowledge_point_ids / mistake_ids / quality_score`。

### 功能二 · 班级学习类型分组（Class Learning Types）—— 同上，本轮接管并加固
- **可演示**：教师端「班级管理 → 某班级」多一张「班级学习类型分布」卡片。
- **可验收**：`GET /api/classes/<id>/learning-groups` 返回分组、共同薄弱点与补救措施；
  证据不足的学生必须进 `ungrouped_students` 而不是被编造特征。
- **可测试**：前端 `ClassLearningTypesPanel.test.jsx`（7 例）。
- **多 Agent 体现**：分组结果直接喂给既有的 `class-batches` 批量生成链路。

### 功能三（今夜新增）· Agent 执行证据可视化 + 运行态可验收
> ⚠️ 待定稿：见 `02-progress.md` 中的实时决策记录。

## 2. 防护测试（第 6 节）
- 路由注册断言（已存在于 `test_route_registration.py`，本轮补充今夜新增路由）。
- SPA 兜底不吞 API 断言：**已在源码层修好**（`main.py:1071-1072`），
  因此**不需要 xfail**，直接写正向断言。

## 3. 时间预算（实际开始 2026-09-22 00:33）
| 时段 | 任务 |
| --- | --- |
| 00:33–01:30 | 侦察 + 重验 + 固化积压改动（已完成 2 个 commit） |
| 01:30–04:30 | 功能三实现 + 测试 + 运行态验证 |
| 04:30–05:15 | roadmap + 防护测试 |
| 05:15–06:00 | 报告 + 环境核验 |

## 4. 明确不做
- 不做全项目通扫（上一轮已做）。
- 不改 `.env`、不重启人工实例、不 push。
- 不新增依赖、不改 schema、不碰凭据两处。
