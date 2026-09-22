# 03-deferred.md · 只记录不修的问题

> 原则：以下问题**今夜一律不动代码**。每条都给出证据、根因推断、建议方案与"为何不在今夜处理"。
> **本文件与最终报告中不出现任何明文凭据值。**

---

## SEC-001 · `backend/.env` 被 git 跟踪且含实测可用的活凭据 🔴 仍为 OPEN

- **证据（本轮复测）**：`git ls-files backend/.env` → 仍输出 `backend/.env`
- **变量名清单（只列名，不列值）**：
  `SECRET_KEY`、`SPARK_API_PASSWORD`、`SPARK_API_KEY`、`SPARK_API_SECRET`、
  `SPARK_APP_ID`、`XFYUN_PPT_APP_ID`、`XFYUN_PPT_API_SECRET`
- **整改建议**（由人类执行，今夜不动手）：
  1. 先**轮换**所有泄露的密钥（顺序很重要：轮换 → 清理 → 验证）。因为已进入 git 历史，
     仅 `git rm --cached` 无法撤回。
  2. 轮换 `SECRET_KEY` 会让所有既有会话失效，需安排在低峰期。
  3. 轮换后再 `git rm --cached backend/.env` + 补 `.env.example`。
- **为何不处理**：任务书铁律 2 明确规定"今晚完全不碰"。任何清理动作都可能让运行中的
  实例立即失效，并制造"已修好"的假象。

## SEC-002 · `config.py` 硬编码讯飞 PPT 默认凭据 🔴 仍为 OPEN

- **位置**：`backend/src/config.py` 的 `XFYUN_PPT_APP_ID` / `XFYUN_PPT_API_SECRET`
  两项 `os.environ.get(...)` 的第二参数（默认值）。
- **本轮复测**：仅确认整改建议未落地；**未读取该默认值内容**（铁律 2）。
- **整改建议**：改为无默认值 + 启动时显式校验并给出人话报错。
- **风险**：该改动会让"没配这两个变量"的部署**启动失败**，属行为变更，
  必须先确认现有部署都配了这两个变量。不在无人监督的夜里动。
- **为何不处理**：铁律 2。

## SEC-006 · WebSocket `connect` 无鉴权 ⚠️ **本轮未验证**

- 上一轮记为 P2：`websocket_service.py` 的 `connect` 处理器不校验身份；
  事件处理器不校验课程归属。
- **本轮状态：未验证。** 我没有写 socket.io 客户端实测，因此**不能**声称它仍在或已修。
  如实登记为"证据不足"。
- **为何不处理**：属"新的安全问题"，人类已明确决策只记录；且本轮无法确证根因。

## SEC-004 · 鉴权装饰器重复实现且行为不一致 🟡 **部分缓解**

- 上一轮证据：`require_admin` 重复 4 次、`require_teacher` 重复 5 次，
  未登录返回 403 而非 401。
- **本轮实测**：匿名访问 `/api/metrics/health` → **401**（不是 403），
  `/api/search/analytics` → **401**，说明**至少这两路已经统一到 `utils/auth.py` 的正版实现**。
- **结论修正**：该问题**范围缩小**，但其余模块（admin/ai_analysis/ai_optimization/analytics、
  course_generation、interaction）我**未逐个复测**，不能判定已全部收敛。
- **建议方案**：统一到单一装饰器模块 + 加一个"所有蓝图不得自定义同名装饰器"的静态检查。
- **为何不处理**：涉及改造既有鉴权链路，属铁律 3 的"不改既有核心链路"范围。

## BUG-007 · PWA 推送订阅接口不存在（405）🟡 仍存在

- **本轮复测**：
  ```
  POST /api/push/subscribe        -> 405  Content-Type: text/html
  POST /api/push/vapid-public-key -> 405  Content-Type: text/html
  ```
  `text/html` + 405 说明它落在 SPA 兜底路由上（GET 才匹配到 `/<path:path>`），
  即 **`/api/push/*` 确实没有任何后端路由**。
- **影响**：`frontend/src/utils/pwa.js` 调用它时静默失败。
- **建议方案**：需要一个完整的 Web Push 后端（VAPID 密钥对生成与持久化、订阅表、
  推送调度、service worker 配合）。**这需要新增数据表（违反铁律 5）与新的密钥管理**。
- **为何不处理**：改 schema + 触及环境配置，两项都在"需人工批准的架构变更"里。

## BUG-014 · SSE 鉴权失败返回 HTTP 200 🟡 仍存在（但需澄清设计意图）

- **本轮复测**：匿名 `GET /api/sse/ai/stream?prompt=hi` →
  **200 + `text/event-stream`**（错误以 SSE 事件帧传递）。
- **澄清**：SSE 协议下`EventSource`本身无法读取非 2xx 的响应体，
  因此"用 200 + error 帧"是**业内常见做法**，不一定是缺陷。
  上一轮把它列为 P2 是站在"HTTP 语义正确性"角度。两种视角都成立。
- **建议方案**：若要让网关/监控能识别失败，可**新增**一个响应头
  （如 `X-SSE-Auth: failed`）或**新增**一个并行的非流式探测端点，
  而**不是**改既有端点的状态码（那是对外契约变更）。
- **为何不处理**：改状态码属"调整对外 API 契约"，需人工批准。

## BUG-017 · 缺 `.env.example` 🟡 仍存在

- **本轮复测**：`glob` 全仓库未发现 `.env.example`。
- **影响**：30+ 个环境变量只能靠读 `config.py` 反推（上一轮已列出完整清单）。
- **为何不处理**：纯文档债，优先级低于今夜的功能实施。建议人类用上一轮报告里的
  变量清单直接生成。

## BUG-016 · `App.jsx` 网络异常时信任 `localStorage.currentUser` ⚠️ **未验证**

- 需要"断网 + 手工注入 localStorage"才能复现，本轮未做。
- **为何不处理**：防御纵深问题，且未验证 → 按铁律 1 不写成结论。

## BUG-015 · `frontend/src/router/index.jsx` 是死代码 ⚠️ **未验证**

- 本轮未重新 grep 确认。上一轮证据（全前端只有该文件自身引用）看起来可信，
  但**未复测**，因此不作为今夜结论。
- **为何不处理**：属清理类改动，非本夜范围。

## BUG-018 · service-worker 把 `/auth/` 当作 API 前缀 ⚠️ **未验证**

- 本轮未复测。

---

## 今夜新发现但**不修**的问题

## BUG-SILENT-001 · `/api/metrics/health` 收敛为 admin-only 后测试未同步

- 已在 commit `c14a054` 修复（属"测试基线修复"，不是产品改动）。

## ENV-002 · 未能按要求使用 `night_audit_test.db`

- **事实**：任务书铁律 6 要求用测试库 `backend/instance/night_audit_test.db`。
  实测 `backend/.env` 的 `DATABASE_URL=sqlite:///dev.db`，且**人工实例（PID 111560）
  正在运行并独占 `dev.db`**。
- **我的处置**（如实说明，不掩饰）：
  1. **没有**改写 `.env`；
  2. **没有**杀掉人工实例；
  3. 改用**真实 WSGI 服务器 + `dev.db` 的 SQLite 备份副本**（`night_run_verify.db`）
     做运行态验收，验收后删除副本；
  4. 全程对 `dev.db` 只做只读访问，收尾用 `git hash-object` 校验未被改动。
- **为何这样做**：杀实例会让用户当前正在使用的界面全部 500；改 `.env` 再改回来
  期间若有写入，会污染生产库。两害相权，选择"不打扰人工环境 + 用副本做真实验收"。
- **代价（必须诚实标注）**：因此 **SEC-003（学生越权）本轮无法复测** —— 我不知道
  `student` 用户的密码，而重置密码会写库。**SEC-003 本轮状态 = 未验证。**
- **建议**：给 `night_audit_test.db` 配一个独立的开发用账号密码，写进
  `backend/.env.test`（不入库），这样下一轮巡检就不必再牺牲一项验证。

## BUG-ENV-003 · SQLAlchemy echo 在运行时大量输出

- **观察**：WSGI 验收时 sqlalchemy.engine 的 INFO 日志刷屏。
- **根因未确认**：我没定位到具体开启 `echo=True` 的位置，**不猜测**。
- **为何不处理**：不确定根因，且仅影响日志噪音。
