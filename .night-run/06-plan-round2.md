# 06-二次巡检 · 边界定义与作战计划

> 用户指令（本轮）：把检测出的 BUG-A/B/C/D **按严重程度逐个攻破**，
> 但**必须先确定边界**，确保**不触碰** `03-deferred.md` 里"只记录不修"的问题。
> 并**二次确认** `05-roadmap.md` 的未来方向，且要给**细致解释**。

---

## 一、边界定义（先划线，再动手）

### 1.1 绝对禁区（来自 `03-deferred.md` + 任务书铁律，本轮一律不动）

| 编号 | 内容 | 禁触范围 |
| --- | --- | --- |
| SEC-001 | `backend/.env` 被跟踪 | **不碰** `.env`、不做 `git rm --cached`、不轮换密钥 |
| SEC-002 | `config.py` 硬编码 PPT 凭据 | **不读也不改** `config.py` 那两个默认值 |
| SEC-003 | 学生越权 | 本轮**不尝试复测**（需登录/改密会写库） |
| SEC-004 | 鉴权装饰器重复 | **不统一、不重构**任何鉴权链路 |
| SEC-006 | WebSocket connect 无鉴权 | **不改** `websocket_service.py` 的鉴权逻辑 |
| BUG-007 | `/api/push/*` 不存在 | **不新增订阅表**（铁律 5：不改 schema） |
| BUG-014 | SSE 返回 200 | **不改任何端点状态码**（对外契约） |
| BUG-015/016/017/018 | 死代码 / localStorage / .env.example / SW 前缀 | **不修** |
| ENV-002 | 必须用测试库 | 沿用上轮方案：`dev.db` 只读 + 副本 |
| BUG-ENV-003 | sqlalchemy echo | **不追根因** |

> ⚠️ 特别提示：**BUG-B（被禁用的测试套件）与 SEC-006 相邻但不重叠**。
> `StudentInteractionPanel.test.jsx` 测的是**前端组件行为**（调没调 `connect()`/`joinCourse()`），
> 不是 WebSocket 服务端鉴权。我只修**测试本身的缺陷**，不碰服务端鉴权——这条边界必须守住。
> 若发现某个被禁用测试**必须改产品代码**才能通过，则**不动它**，登记为新的 deferred。

### 1.2 本轮允许改动的范围

- 只修 `frontend/jest.config.js`（解除误禁用）与**测试文件自身**；
- 允许**纯新增**测试文件；
- 允许极小范围的产品修复（仅在"测试揭示的是产品真实缺陷且改动是纯新增/无契约变更"时），
  每处都必须单独说明理由。

---

## 二、BUG-A/B/C/D 的严重程度重排

> 用户要求"按严重程度逐个攻破"。我重新评估后的排序与报告原始编号**不同**，
> 理由见每条说明。**这不是推翻原编号，而是按"实际危害"重排攻坚顺序。**

### 严重度矩阵

| 排序 | 编号 | 问题 | 隐蔽性 | 爆炸半径 | 修复风险 | 综合严重度 |
| --- | --- | --- | --- | --- | --- | --- |
| **1** | **BUG-B′** | **6 个测试套件被静默禁用，102 个用例从未运行** | **极高** | **极高** | 低 | 🔴 **S 级** |
| 2 | BUG-C | 生产构建失败而测试全绿 | 高 | 高 | 低 | 🔴 S 级（已修） |
| 3 | BUG-A | 长期红灯淹没真实回归 | 中 | 中 | 低 | 🟡 A 级（已修） |
| 4 | BUG-B | `import.meta` 致整套件无法解析 | 中 | 中 | 低 | 🟡 A 级（已修） |
| 5 | BUG-D | 分组接口边界 | — | — | — | ⚪ 非缺陷（已复核） |

### 为什么 BUG-B′ 排第一（本轮新增发现）

上一夜的 BUG-B 只看到 `searchApi.test.js` **1 个**套件无法解析。
本轮深挖发现**真正的问题更大**：`jest.config.js` 的 `testPathIgnorePatterns` 里
**硬编码排除了 6 个测试文件**，累计 **102 个测试用例从未被执行**：

| 被禁用文件 | 用例数 | 实测通过/失败 | 失败原因 |
| --- | --- | --- | --- |
| `StudyNotes/__tests__/VideoNotesPanel.test.jsx` | 31 | 19 / **12 失败** | 折叠态断言与实现不符 |
| `MistakeBook/__tests__/MistakeBook.test.jsx` | 30 | 16 / **14 失败** | 统计卡/筛选/空态未渲染 |
| `Search/__tests__/SearchBar.test.jsx` | 17 | 10 / **7 失败** | 下拉/热词/键盘导航 |
| `Search/__tests__/SearchResults.test.jsx` | 17 | 1 / **16 失败** | 组件依赖缺失 |
| `__tests__/StudentInteractionPanel.test.jsx` | 7 | 4 / **3 失败** | 挂载/卸载时序 |
| `CourseLearningPage.test.jsx` | 0 | **套件无法运行** | "must contain at least one test" |
| **合计** | **102** | | |

**为什么这比 BUG-B 更严重**：`searchApi.test.js` 至少是"红色可见"（CI 会报 fail），
而被 `testPathIgnorePatterns` 排除的套件是**完全不可见**——
它们既不是 pass 也不是 fail，是**不存在**。任何 CI 都会显示 100% 绿色。

**这与本仓库的核心失效模式（安静地坏掉）完全同构**，且规模大 100 倍。

---

## 三、逐条作战方案

### 战役 1 · BUG-B′（S 级）

**目标**：让 102 个被隐藏的用例**重新可见**，并如实呈现其真实状态。

**严格分两步，绝不合并**：

1. **先"解禁并暴露"**：把 6 个文件从 `testPathIgnorePatterns` 移出，
   跑一次完整测试，**如实记录**真实通过/失败数。
   - 这一步**不修任何测试**，纯暴露。
   - 若解禁后 CI 变红，那是**真实状态的正确呈现**，不是回归。
2. **再逐个修复**：按"是否改产品代码"分流：
   - **只改测试**能修的 → 逐个修（用仓库既有范本写法）。
   - **必须改产品代码**才能通过 → **不动**，降级登记到新的 deferred 文件
     `06-deferred-round2.md`，并写明"为什么这需要产品决策"。
3. `CourseLearningPage.test.jsx`（0 用例）→ 需单独判断是**删除**还是**补写**。
   删除属"清理"，补写属"新增"——**我倾向补写**（测试文件存在说明有意图），
   但**会先做证据判断**再决定。

**验收**：给出"解禁前 vs 解禁后"的精确数字对比，并明确标注哪些仍是红的、为什么。

---

### 战役 2 · BUG-C 的纵深加固（已修，本轮补强）

- 已完成：修复 + `apiExportContract.test.js` 防护（且已实测防护能失败）。
- **本轮补强**：把"**测试通过 ≠ 可构建**"变成**可执行的脚本**，
  而不是只写在报告里的建议。
  - 新增一个仓库内脚本（如 `scripts/verify-frontend.sh` 或 npm script），
    一条命令跑完 `test + build`。
  - 边界：**不改 CI 配置**（属 CLAUDE.md 架构冻结闸门的 CI/CD 项），只加本地脚本，
    并在报告里建议人类接入 CI。

---

### 战役 3 · BUG-A 的同类风险扫查（已修，本轮补强）

- 已完成：修复该测试。
- **本轮补强**：检查**是否还有别的测试在"断言一个已经不成立的契约"**。
  做法：全量跑 pytest，确认 0 failed；
  并检查 `pytest.ini`/`conftest` 里是否存在 `--ignore` 或 `deselect` 之类的隐藏排除
  （**与 BUG-B′ 同构的风险点**）。
  - 边界：只**读取与报告**，不删既有测试。

---

### 战役 4 · BUG-D 边界加固（真正的产品级补强）

- 复核结论：不是缺陷。
- **本轮可做**：为"分组接口的越权/不存在语义"**补上回归测试**，
  把"设计如此"这个口头结论**固化成语义锁**。
  - 边界：只在 `tests/` 下**新增**测试，绝不改路由实现。
  - 同时把后端"藏起来的排除项"扫一遍（同战役 3）。

---

## 四、05-roadmap.md 的二次确认

用户要求"二次确认 + 细致解释"。我将对 8 条方向逐条做：

1. **重新核对代码事实**（是否真如上一夜所说）；
2. **给出更细致的解释**：为什么是这个优先级、依赖什么、边界在哪；
3. **明确标注**哪些仍属 deferred 禁区（R-6/R-8 触及 SEC-001/002 与 schema）。

**初步二次确认的一个重要修正（待本轮证据落实）**：

> 上一夜把 **R-5（防静默失效门禁）** 排第 1，理由是 BUG-C。
> 本轮发现 BUG-B′（102 个用例被静默禁用）后，**R-5 的紧迫性大幅上升**，
> 且内容必须**扩展**：不只是"把 build 加进验收"，还必须包含
> **"禁止用 testPathIgnorePatterns 静默禁用测试套件"** 这类检查。
> 这才是本仓库真正的系统性风险。

---

## 五、执行纪律（本轮自我约束）

1. 每改一个文件前，先说明 **OBSERVATIONS / REASONING / PLAN**（CLAUDE.md 要求）。
2. 修改既有文件必须**输出完整内容**，禁止占位符。
3. 新增测试/组件时，**先在仓库里找结构最接近的范本**并复刻其风格。
4. 不改 schema、不加第三方依赖、不动鉴权、不改对外 API 契约。
5. 每个战役结束后**立即**给出"前后数字对比"，不以"看起来好了"作结论。
6. 收尾核验 `dev.db`、`.env` 未被改动，未 push。
---

# [T8] 02:40 BUG-B′ 深挖 · 根因已用实验证明

## OBSERVATIONS（只描述看到的）

1. `jest.config.js` 的 `testPathIgnorePatterns` 里**硬编码排除了 6 个测试文件**。
2. 这 6 个文件**都真实存在**，合计 **102 个测试用例**。
3. 用 `--testPathIgnorePatterns` 覆盖后强制运行，得到：
   ```
   Test Suites: 6 failed, 18 passed, 24 total
   Tests:       52 failed, 174 passed, 226 total
   ```
   即：**解禁后 52 个用例红**。而解禁前 CI 显示 **124/124 全绿**。
4. 逐套件失败数：VideoNotesPanel 12/31、MistakeBook 14/30、SearchBar 7/17、
   SearchResults 16/17、StudentInteractionPanel 3/7、CourseLearningPage **套件无法运行**。

## 关键实验（每一条都是可复现的证据，不是推测）

| 实验 | 操作 | 结果 | 结论 |
| --- | --- | --- | --- |
| E1 | `typeof vi` / `vi === jest` | `object` / **`false`** | 全局 `vi` **不等于** `jest` |
| E2 | `jest.mock(path)` 无工厂 | **通过**，是 mock 函数 | 自动 mock 正常 |
| E3 | `jest.mock(path, factory)` | **失败**：`Cannot find module '...' from 'jest.setup.js'` | 工厂形式在**提升后**解析路径时出错 |
| E4 | `jest.mock('@/services/searchApi', factory)` | **通过** | **换成别名路径就好了** |
| E5 | 删掉 `jest.config.js` 第 13 行 mapper | 测试更糟（连无工厂形式也不通） | 该行是**为别的问题打的补丁** |
| E6 | 加 `babel-preset-jest` 到 presets | **Duplicate plugin/preset detected** | babel-jest **本来就会自动追加**它 |
| E7 | 读 `babel-jest/build/index.js` 源码 | `presets: (inputOptions.presets ?? []).concat(jestPresetPath)` | **确认** babel-jest 无条件追加 jest preset |

## REASONING（建立因果链，不接受"可能"）

**根因：`moduleNameMapper` 里的相对路径映射，污染了被提升（hoisted）的 mock 路径解析。**

链条如下：

1. `babel-jest` 总会注入 `babel-preset-jest`（E7 源码级证据），
   它包含 `babel-plugin-jest-hoist`，会把 `jest.mock`/`vi.mock` **提升到文件顶部**。
2. 提升后的 `vi.mock('../../services/searchApi', factory)` 在**模块加载最早期**执行，
   此时 Jest 用 `moduleNameMapper` 解析这个路径。
3. `jest.config.js` 第 13 行写死了
   `'^\\.\\./\\.\\./\\.\\./services/searchApi$': '<rootDir>/src/services/searchApi.js'`。
   这个正则本意是给 `searchApi.test.js` 用的补丁，但它是**全局生效**的。
4. 提升后的工厂调用发生在 `jest.setup.js` 的解析上下文里
   （E3 的报错原文就是 `from 'jest.setup.js'`），
   于是相对路径 `../../services/searchApi` 被**相对错误的基础目录**解析 → `Cannot find module`。

**E4 是判决性证据**：同一个文件、同一个工厂，
**只把相对路径换成 `@/` 别名就通过了**。说明缺陷在路径映射，不在测试逻辑，也不在产品代码。

**为什么这 6 个文件当初被禁用**：维护者（很可能是 AI 辅助）遇到这批失败时，
选择了在 `testPathIgnorePatterns` 里**逐个注释掉**——
这消除了红色，但**把 102 个用例变成了"不存在"**。
这比让它们红着更危险：红色会被看见，不存在不会被看见。

## PLAN（最小原子操作）

修 `jest.config.js`，只做两件事：

1. **移除那 6 行静默排除**，让 102 个用例重新进入视野。
2. **修掉制造污染的 mapper 行**：删掉第 13 行那条相对路径映射，
   并同步把 `searchApi.test.js` 的导入改为 `@/` 别名（与仓库其他测试一致）。

**不做的事**：
- 不改产品代码（除非某个失败被证明是产品缺陷）；
- 不改 `babel` 配置（E7 证明 babel 配置本来就是对的）；
- 不删除任何测试文件。

**预期**：解禁后**仍然会有红的**——那是**真实状态**，不是回归。
下一步逐个判定"测试过时"还是"产品缺陷"，前者改测试，后者**登记 deferred 不动手**。
