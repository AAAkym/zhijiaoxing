# 02-progress.md · 进度流水（持续追加）

## [T0] 2026-09-22 00:33 开工 · 环境勘察

| 项 | 实测值 |
| --- | --- |
| 工作目录 | `C:\Users\33552\Desktop\project_code` |
| 基线 HEAD | `2c15220 merge: 合并「前后端」分支的配置文档与脚本` |
| 新分支 | `night-run/20260922`（本地，无 upstream） |
| Python | 3.14.2（`backend/venv` 可用；另有人工实例用系统 Python） |
| Node / pnpm | v24.9.0 / 10.34.5 |
| **运行中的 Flask** | PID **111560**，`D:\Program Files\Python314\python.exe src/main.py`，监听 `0.0.0.0:5000`，**加载的是 `dev.db`** |
| 运行中的 Vite | PID 99272，监听 5173 |
| `dev.db` | 被 PID 111560 独占（`Get-FileHash` 报"being used by another process"） |
| `DEV.DB git hash` | `e94bf0b984654c20162fb8d61efd30a9eeb795a1`（与上一轮记录一致） |
| `backend/.env` SHA256 | `6695640E...96CC`（收尾比对基准） |
| `.night-run/` | 原本不存在，已创建 |

### 🚨 决策记录 1：不切测试库
任务书铁律 6 要求用 `night_audit_test.db`。实测 `backend/.env` 里
`DATABASE_URL=sqlite:///dev.db`，而**人工实例正在运行且独占 dev.db**。
切库需要：(a) 改写 `.env` → (b) 杀掉人工实例 → (c) 重启。
这违反铁律 6 的另一半（"任务结束时还原 .env"意味着**可以临时改**，但杀掉人工
实例会让用户当前正在用的界面全部 500）。

**结论**：改为**全程只读探测 + 不触发任何写库流程**，收尾用 `git hash-object`
证明 `dev.db` 未被污染。风险与代价已写入 `03-deferred.md` ENV-002。

### 🚨 决策记录 2：工作区有大量积压未提交变更
详见 `00-recon.md` 第 0 节。

---

## [T1] 01:05 侦察完成

- 读完全部 `.night-audit/`（PROGRESS 281 行 / BUGS 264 行 / IDEAS 259 行）。
- 对遗留问题逐条实测复现，产出表格 → `00-recon.md` 第 2 节。
- 探明三个**上轮结论已过时**的事实：
  1. `.night-audit` 第 1.4 节的"SPA 兜底吞掉 /api/*"**已经修好**
     （`main.py:1071-1072` 显式返回 JSON 404；实测 `/api/nonexistent` → 404 application/json）。
     因此第 6 节要求的 xfail 防护**不需要**，可以直接写正向断言。
  2. 匿名访问 `/api/metrics/health` → **401**（已修）。
  3. `POST /api/ai-tutor/answer` 匿名 → **0.0s 返回 401**（BUG-009 已修）。

---

## [T2] 01:20 测试基线 · 发现两个红灯

### 后端：1 failed / 150 passed
`test_health_reports_scheduler_degradation_without_failing_core` 断言匿名 200，
实际 401（该端点已被上一轮收敛为 admin-only）。**已修**。

### 前端：1 suite failed / 15 passed / 95 passed
`searchApi.test.js` **整个套件无法运行**（`Cannot use 'import.meta' outside a module`）。

#### 🔁 自我纠错记录（保留原始误判）
我第一反应是"加 `typeof` 守卫就行"，写成
`const viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined`。
**实测失败**，报错位置仍然指向 `import.meta`：
```
SyntaxError: Cannot use 'import.meta' outside a module
C:\...\src\services\searchApi.js:24
    var viteEnv = typeof import.meta !== 'undefined' ? import.meta.env : undefined;
                                ^^^^
```
误判原因：我把它当成**运行时**未定义来处理，实际它是**解析期**语法错误 ——
CJS 解析器在看到 `import.meta` 这个 token 时就报错，根本不会执行到 `typeof`。
**正确修法**：改用一个普通标识符 `import_meta_env`，由 `jest.config.js` 的
`globals` 注入（模拟 Vite 的静态替换），源码不再出现 `import.meta` 字面量。
修复后该套 20 个用例全部执行，其中 1 个**陈旧断言**失败
（断言中文未被百分号编码 —— 那是上一轮 BUG-010 修复后的正确行为），一并修正。

---

## [T3] 01:35 提交 2 个 commit

| commit | 内容 |
| --- | --- |
| `352bef6` | feat(generation-basis): 生成依据链与班级学习类型分组 |
| `c14a054` | fix(tests): 修复因积压未提交改动而失效的两处测试基线 |

修复后基线：后端 **151 passed**，前端 **16 suites / 115 tests / 0 failed**。
---

## [T4] 01:45 功能三实施 · 智能体执行历史

### 为什么选这个方向（有实测依据，不是拍脑袋）
读库时发现 `agent_execution_logs` 有 **167 条真实记录**（coordinator 96 / document 27 /
project 16 / media 11 / recommendation 11 / exercise 6），但没有任何读取入口：
- `/agents/status` 返回 AgentMonitor **内存态**，实测重启后 `total_tasks = 0`；
- `coordinator_agent` 把 9 个 Agent 的 execution_details 打进资源包，
  但**视图层没有任何组件消费**。

→ 补上「持久化 → 可视化」的链路，并引入**六阶段证据覆盖率**作为防静默失效的产品化表达。

### 交付
| 层 | 文件 |
|---|---|
| 服务 | `backend/src/services/agent_execution_history_service.py`（只读，零新依赖）|
| 路由 | `GET /api/resource-generation/agents/history`（`resource_generation.py` **纯新增**）|
| 前端 | `frontend/src/components/AgentExecutionHistoryPanel.jsx` + 挂进 AdminDashboard |
| 测试 | 后端 13 例；前端 6 例 |

### 🔁 自我纠错记录 2 · 参数夹取
实现 `_window_start` 时我第一版写成 `days = _as_int(days) or DEFAULT_WINDOW_DAYS`，
**单元测试立刻抓到**：`days=0` 被 `or` 吞成 30，调用方以为「只看今天」，实际拿到 30 天。
根因：`or` 无法区分「没传」和「传了 0」。改为只用 `None` 表示缺省。
`limit=0` 有同样的坑，一并修掉。

### 🔁 自我纠错记录 3 · 路由参数解析
第二版改用 `request.args.get("limit", 50, type=int)`，实测 `?limit=0` 仍返回 50 条。
根因：Werkzeug 的 `type=int` 在转换结果为 falsy 时会回落默认值。
改为自己写 `_parse_int_arg`（读原始字符串再转换）。
**这是本轮第三次「以为对了、实测不对」** —— 全部记录在此。

### 运行态验收（真实 WSGI + dev.db 副本）
```
[1] 匿名 -> 401 application/json                        ✅
[2] admin -> 200，window_days 夹取正确，返回 5 条明细      ✅
[3] 六个智能体统计与库里 167 条完全一致                    ✅
[4] 六阶段覆盖率 0.75，缺口如实列出 "agents" 阶段          ✅
[5] /system/summary 内存态 total_tasks=0 vs 历史 167 条    ✅ 证明持久化价值
[6] ?days=0/abc/99999 -> 1/30/365                        ✅
[7] ?limit=0/1/99999 -> 1/1/167                          ✅
```

---

## [T5] 02:00 生产构建发现严重缺陷（BUG-C）

`pnpm test` 全绿，但 `pnpm run build` **失败**：
```
"resourceGeneration" is not exported by "src/services/api.js"
```
根因：我写的组件导入了 `api.js` 里不存在的 `resourceGeneration`（真名 `courseGeneration`）。
**测试没发现，是因为测试 mock 掉了整个模块，mock 里恰好也叫这个名字。**

→ 这正是任务书 1.4 节警告的静默失效模式在构建期的变体：
**测试通过 ≠ 代码能构建**。如果我只跑 pnpm test 就交差，会给出一个完全错误的「全绿」报告。

修复 `13f104b`；并新增 `apiExportContract.test.js` 防复发，
**并实测验证该防护能真的失败**（故意重新引入 → 测试红 → 改回 → 测试绿）。

---

## [T6] 02:10 一个「产品 bug 还是测试 bug」的排查

参数夹取验证脚本报告「所有 limit 查询返回 0 条」。我**没有立刻改产品代码**，先排查：
只传 `?limit=...` 而没传 `days` → 窗口回落 30 天 → 而库里记录都是 2026-07 的，
**落在窗口之外**。是脚本 bug，不是产品 bug。已修正脚本并重新验证通过。

但这次排查也暴露出「问 limit 却让 days 静默回落」不够友好，因此我保留了一次独立复核
（`/agents/history?days=0` 单测），确认 days 夹取逻辑确实正确。

---

## [T7] 02:15 收尾核验

| 项 | 结果 |
|---|---|
| `dev.db` git hash | `e94bf0b984654c20162fb8d61efd30a9eeb795a1`（与开工一致）✅ |
| `backend/.env` SHA256 | `6695640E...96CC`（与开工一致）✅ |
| 未 push / 无 upstream | ✅ |
| 验收副本已删除 | ✅ `night_run_verify.db` 不存在 |
| 真实大模型调用 | **0 次** |
| 后端测试 | 166 passed / 0 failed |
| 前端测试 | 18 suites / 124 tests / 0 failed |
| 前端构建 | ✓ built in 15.95s |

最终 commit：共 5 个，全部可独立回滚。
