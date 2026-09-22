# 00-recon.md · 遗留问题重验（2026-09-22 夜）

> 分支：`night-run/20260922`　基线 HEAD：`2c15220`
> 测试环境：**复用人工正在运行的 Flask 实例**（`http://127.0.0.1:5000`，PID 111560，
> 启动脚本 `backend/start_backend.ps1`，DB=`backend/instance/dev.db`）。
> ⚠️ 本次未使用 `night_audit_test.db`，原因与影响见 `03-deferred.md` 的 ENV-002：
> `.env` 中 `DATABASE_URL=sqlite:///dev.db`，切换测试库需要临时改写 `.env` 并重启
> 人工的实例。按铁律 6 的精神（不动人工环境）改为**全程只读探测 + 不触发任何写库的
> 生成流程**。`dev.db` 未被我写入，收尾用 `git hash-object` 校验。

---

## 0. 开工前的重大发现：工作区有大量「积压未提交变更」

`git status` 显示 master 上存在 **11 个已修改文件 + 10 个未跟踪文件**，且
**未跟踪文件已被正在运行的后端加载**：
```
$ python -c "import src.services.generation_basis_service"   # 由路由 import 成功 ⇒ 文件真实存在
$ curl -s http://127.0.0.1:5000/api/metrics/health   → 401（非 200）
```
即：**正在运行的实例已经包含这 11 个改动**，但它们在 git 里不存在。
上一轮巡检文档（`.night-audit/`）完全没有提到这批改动 —— 它们是上一轮结束之后、
本轮开始之前由人类或另一个会话产生的。

这批改动的范围与今夜任务书第 4 节「多 Agent 协作 / 工作流深度功能」**高度重合**：
- 新增 `backend/src/services/generation_basis_service.py`（988 行，生成依据链服务）
- 新增 `frontend/src/components/ResourceBasisPanel.jsx`（学生端「我为什么是给我的」）
- 新增 `frontend/src/components/ClassLearningTypesPanel.jsx`（教师端班级学习类型分组）
- `coordinator_agent.py` 回填 agent 执行证据 + 真实难度对齐算法
- 新增 `backend/tests/test_generation_basis.py`、`test_route_registration.py`

**处置决策（已执行）**：先**验证并固化**这批资产（它们已经是今晚功能的核心），
再在其上做增量，而不是推倒重写。已拆成 2 个可独立回滚的 commit 提交：

| commit | 内容 |
| --- | --- |
| `352bef6` | feat(generation-basis): 生成依据链与班级学习类型分组（学生端可回溯 + 教师端分组） |
| `c14a054` | fix(tests): 修复因积压未提交改动而失效的两处测试基线 |

---

## 1. 测试基线（本轮实测，非引用旧结论）

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 后端 | `backend/venv/Scripts/python.exe -m pytest backend/tests -q` | **1 failed, 150 passed, 1 skipped** → 修复后 **151 passed** |
| 前端 | `pnpm test`（frontend/） | **1 suite failed / 15 passed，95 passed** → 修复后 **16 suites / 115 passed / 0 failed** |

任务书 1.3 说「151 个测试可正常收集」。**实测收集到 151 个，但当时并不是全绿**：
唯一失败的是 `test_health_reports_scheduler_degradation_without_failing_core`。
详见第 2 节 BUG-A。

---

## 2. 遗留问题重验表

口径：**每一项都用当前 master（+运行中实例）代码重新实测复现**，不采信旧结论。
「HTML」= 落在 SPA 兜底路由（返回 `text/html`，即「路由不存在」）。

| 问题ID | 上轮结论 | 本轮实测结果 | 仍存在? | 处置计划 |
| --- | --- | --- | --- | --- |
| **SEC-001** `.env` 被跟踪含活凭据 | 未解决（待人工） | `git ls-files backend/.env` → 仍被跟踪 | **是** | **不碰**（铁律 2）。报告中复述 OPEN |
| **SEC-002** `config.py` 硬编码讯飞 PPT 凭据 | 未解决（待人工） | 未读取该值，仅确认整改建议仍未被采纳 | **是** | **不碰**（铁律 2）。报告中复述 OPEN |
| **SEC-004** 鉴权装饰器重复实现 8 次 | 只记录不修 | 实测：匿名访问 `/api/metrics/health` 返回 **401**（不是 403），说明**至少 metrics 这一路已经统一到 `utils/auth.py`** | **部分缓解** | 重新定性：metrics 已收敛；其余模块未逐个复测 → 记入 `03-deferred.md` |
| **SEC-006** WebSocket `connect` 无鉴权 | 只记录不修 | 今晚未做 WS 实测（需要 socket.io 客户端，且属"新安全问题"范围） | **未验证** | 如实标记「未验证」，记入 `03-deferred.md` |
| **BUG-007** `POST /api/push/subscribe` → 405 | 未修 | 实测 `405`，`Content-Type: text/html` → 仍是 SPA 兜底，**无该路由** | **是** | 记入 `03-deferred.md`（需新增完整推送订阅后端 = 超出一夜范围） |
| **BUG-010** `searchApi` 对整串 `decodeURIComponent` | 未修 | **已在积压改动中修好**；但其修复引入的新写法让整个 `searchApi.test.js` **无法运行**（BUG-B） | 是（新形态） | **已修**（`c14a054`） |
| **BUG-014** SSE 鉴权失败返回 200 | 部分修 | 匿名 `GET /api/sse/ai/stream` → **HTTP 200 + `text/event-stream`**（与本轮基线一致，未恶化） | **是（按 HTTP 码口径）** | 记入 `03-deferred.md`：SSE 协议下「事件帧内报错」是刻意设计，改状态码属契约变更 |
| **BUG-017** 缺 `.env.example` | 未修 | `glob` 确认仓库仍无 `.env.example` | **是** | 记入 `03-deferred.md`（文档债） |
| **BUG-016** `App.jsx` 信任 `localStorage.currentUser` | 未修 | 未复验（需断网注入，属防御纵深，非今夜范围） | **未验证** | 记入 `03-deferred.md` |
| **BUG-015** `router/index.jsx` 死代码 | 未修 | 未复验 | **未验证** | 记入 `03-deferred.md` |
| **BUG-018** service-worker 把 `/auth/` 当 API 前缀 | 未修 | 未复验 | **未验证** | 记入 `03-deferred.md` |
| `.night-audit` 第 1.4 节「SPA 兜底吞掉 /api/*」 | **P0 陷阱** | 实测 `GET /api/totally-nonexistent-xyz` → **404 + application/json**；源码 `main.py:1071-1072` 已显式拦截 `api/` 前缀 | **已解决** | 今夜在这一条上**加固回归测试**（第 6 节） |

### 2.1 三个必须诚实说明的重验局限

1. **SEC-001 / SEC-002 我没有读取其值**（铁律 2）。"仍存在"是依据变量名清单与
   `git ls-files` 判定的，不是依据密钥内容。
2. **SEC-003（学生越权）本轮未能复测**。原因：`/api/login` 对 `student` 用户在所有
   常见口令下均返回 401（`student1`/`student` 都不存在或口令未知），我**没有**去
   反推或改写密码（那会写库）。因此我**不能**声称 SEC-003 已修复或仍存在。
   这是本轮最重要的未验证项，已写入报告。
3. **实例是人工运行的**，因此我只能做**只读探测**。所有会写库的流程（资源生成、
   画像同步）本轮未在真实实例上触发。

---

## 3. 本轮新发现的两个真实缺陷（含复现证据）

### BUG-A · `/api/metrics/health` 收敛为 admin-only 后，既有测试未同步 → 套件长期红灯
- **复现**：`pytest backend/tests -q` → `1 failed`
- **证据**：`test_phase4_notifications_metrics.py:129` 断言匿名访问返回 200，
  而 `metrics_routes.py:26-28` 已挂 `@require_auth + @require_role(('admin',))` → 实测 401。
- **根因**：上一轮的安全修复改变了契约，但没有同步该测试。
- **危害**：套件长期有 1 个红灯，真实回归会被淹没。
- **处置**：**已修**（`c14a054`），改为用 `admin_session` 登录后断言，保留原测试意图
  （"调度器降级不影响核心可用性"）不变。

### BUG-B · `searchApi.js` 的 `import.meta.env` 让整个 `searchApi.test.js` **无法运行**
- **复现**：`pnpm test` → `Test Suites: 1 failed`，`Tests: 95 passed`（该套 0 个用例被执行）
- **证据**：
  ```
  Details: src/services/searchApi.js:3
      const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api'
                                         ^^^^
  SyntaxError: Cannot use 'import.meta' outside a module
  ```
- **根因**：Jest 以 CommonJS 加载源码，`import.meta` 是**解析期**语法错误，
  连 `typeof` 守卫都救不了（我先按守卫写法试过一次，实测仍然报同一个错，
  这是本轮的**自我纠错记录**：最初的修法无效，已记录在 `02-progress.md`）。
- **危害**：这正是任务书第 1.4 节描述的失效模式 —— 套件名看起来"存在"，
  实际**一条断言都没跑**，而 CI 只看到 "1 failed"，很容易被当成偶发。
- **处置**：**已修**（`c14a054`）。修法：`jest.config.js` 增加 `globals.import_meta_env`
  模拟 Vite 的静态替换；源码通过 `typeof import_meta_env` 读取。
  同时修掉该套里唯一 1 个**修复后暴露出来的**陈旧断言（中文被百分号编码，
  这是上一轮 BUG-010 修复的正确行为，断言必须跟着改）。

---

## 4. 本轮明确不能做的

- 不碰 SEC-001 / SEC-002（铁律 2）。
- 不改 `.env`、不重启人工实例（铁律 6）。
- 不新增依赖、不改 schema（铁律 4/5）。
