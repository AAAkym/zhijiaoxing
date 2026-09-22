# 第二轮：只记录、不修复清单

> 本文件记录第二轮夜间巡查中发现、但**本轮不修复**的问题。
> 与 `03-deferred.md`（第一轮冻结清单）同级，两者都不得触碰。
> 每一项都给出了证据与建议动作，供人类决策。

---

## R2-DEF-001：SearchBar 防抖计时器在卸载时未清理

- **位置**：`frontend/src/components/Search/SearchBar.jsx`
- **现象**：防抖用的是 `debounceRef.current = setTimeout(...)`，
  组件卸载时**没有任何 `useEffect` 清理**这个计时器。
- **证据**：在测试中，上一个用例遗留的 300ms 计时器会在下一个用例里触发，
  造成 `autocomplete` 被重复调用、界面出现意外的 `no-results`。
  第一轮是通过在测试侧加 `afterEach` 排空计时器绕过的，产品代码未动。
- **真实影响**：用户在防抖窗口内（300ms）切换页面 / 关闭面板，
  计时器仍会触发回调，对已卸载组件调用 `setState` 并发出多余的网络请求。
  React 18+ 不再打印该警告，因此线上不会报错，只会静默多发请求。
- **建议修复**：新增一个 `useEffect(() => () => clearTimeout(debounceRef.current), [])`
  在卸载时清理。
- **本轮为何不改**：属于产品行为变更，超出"纯增量、不动产品逻辑"的边界。

---

## R2-DEF-002：MistakeBook 页面结构缺少状态筛选标签与关联语义

- **位置**：`frontend/src/components/MistakeBook/MistakeList.jsx`（标签）、
  `frontend/src/components/MistakeBook/index.jsx`（状态切换按钮）
- **现象**：
  1. 全仓库只在测试文件中出现过字符串 `状态筛选:`，产品代码**从未渲染**它。
     真实的状态筛选是 `index.jsx` 里的四颗切换按钮（全部 / 未掌握 / 复习中 / 已掌握）。
  2. `课程筛选:` 与 `状态筛选` 这类标签都是普通 `<span>`，
     **没有** `htmlFor` / `aria-labelledby` 与对应的下拉框关联，
     因此 Radix `SelectTrigger` 在可访问性树里是**没有名字**的。
- **证据**：`getByRole('combobox', { name: /课程筛选/i })` 永远失败；
  `getByRole('button', { name: /刷新/i })` 在只渲染 `MistakeList` 时也永远失败
  （"刷新"按钮其实在父组件 `MistakeBook` 的头部）。
- **真实影响**：屏幕阅读器用户无法得知该下拉框的用途，是真实的 WCAG 缺陷。
- **建议修复**：给 `Select` 加 `aria-label="课程筛选"`，或把 `<span>` 换成
  带 `htmlFor` 的 `<label>` 并给 `SelectTrigger` 加 `id`。
- **本轮为何不改**：属产品 UI 变更，超出边界；测试已改为断言真实存在的元素。

---

## R2-DEF-003：VideoNotesPanel 多处交互元素缺少可访问名

- **位置**：`frontend/src/components/StudyNotes/VideoNotesPanel.jsx`
- **现象**：
  1. 折叠态的展开按钮、笔记卡片上的"编辑"/"删除"按钮都是**纯图标 Button**，
     既无文本也无 `aria-label`，在可访问性树里没有名字
     （`getByRole('button', { name: /删除/i })` 永远失败）。
  2. 加载指示器只是一个 `<Loader2 className="animate-spin">` 图标，
     **没有** `role="status"`，也没有 `aria-live` / `aria-label`。
  3. 时间戳是一个带 `cursor-pointer` 的 `Badge`，但它是 `<span>` 而非
     `<button>`，只能靠鼠标点击，键盘无法聚焦。
- **证据**：测试中 `getByRole('button', { name: /播放|删除/i })` 与
  `getByRole('status')` 全部失败；改用 `data-testid` 定位图标后通过。
- **真实影响**：键盘与屏幕阅读器用户无法操作编辑/删除，也感知不到加载状态。
- **建议修复**：给图标按钮补 `aria-label`；给加载容器加 `role="status"`；
  把时间戳 `Badge` 换成真正的 `<button>`。
- **本轮为何不改**：属产品 UI 变更，超出边界；测试已改为断言真实渲染的图标。

---

## R2-DEF-004：lucide-react 测试替身曾以白名单方式静默失效（本轮已加固，留作教训）

- **位置**：`frontend/jest.setup.js`
- **现象**：原替身列了约 90 个图标名。任何组件用到名单外的图标
  （例如 `Download`）都会解构出 `undefined`，React 抛
  `Element type is invalid ... but got: undefined`，
  **报错信息完全指不到根因**（指到 `render()` 那一行）。
- **本轮处理**：已改为 `Proxy` 兜底，任何被访问的图标名都返回可渲染组件。
- **保留原因**：这类"测试替身静默失真"是本轮反复出现的失败模式
  （同类的还有 `localStorage` 假替身、`api-mock` 缺成员），
  值得作为模式记录：**替身必须默认可用，而不是默认缺失**。

---

## R2-DEF-005：整合测试中自相矛盾的 mock 设置（已修，记录成因）

- **位置**：`frontend/src/components/StudyNotes/__tests__/VideoNotesPanel.test.jsx`
- **现象**：同一用例内连着两次 `notes.getNotes.mockResolvedValue(...)`，
  第一次设为空列表（期望断言"暂无笔记"），第二次立刻覆盖成有 1 条笔记，
  于是"暂无笔记"永远不可能出现。
- **本轮处理**：删除被覆盖的那次调用。
- **保留原因**：这是"用例自我否定"的典型样本 —— 断言与设置互相矛盾，
  且因为套件被整体排除，长期无人发现。
