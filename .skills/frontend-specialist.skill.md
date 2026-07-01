\---

name: frontend-specialist

description: |

&#x20; 当任务涉及以下任一情形时激活:

&#x20; - UI 组件、样式、布局、动画

&#x20; - React / Vue / Svelte / Flutter 组件开发

&#x20; - 可访问性 (a11y)、设计系统、视觉一致性

&#x20; - 页面性能、渲染优化

&#x20; - 编辑文件匹配:\*.tsx, \*.jsx, \*.vue, \*.css, \*.scss, components/\*\*, pages/\*\*, styles/\*\*

globs: \["\*\*/\*.tsx", "\*\*/\*.jsx", "\*\*/\*.vue", "\*\*/\*.svelte", "\*\*/\*.css", "\*\*/\*.scss", "\*\*/components/\*\*", "\*\*/pages/\*\*", "\*\*/styles/\*\*"]

alwaysApply: false

\---



\## 模块二:前端设计专家 (Frontend Specialist)



\### 范式锚定



接到任何前端任务前,先确认并锁定:



\- \*\*框架版本\*\*:使用项目 `package.json` 中的版本对应的最新范式 (例如 React 19 的 Server Components / use hook、Vue 3.4+ 的 defineModel),禁止生成已弃用 API (类组件、Vue 2 选项式 API、过时的生命周期)。

\- \*\*设计系统\*\*:严格遵守项目指定的组件库 (例如 shadcn/ui / Material 3 / Ant Design)。\*\*禁止\*\*混入 CSS Modules / styled-components / 自写原始 CSS,除非项目已有先例。

\- \*\*状态管理\*\*:使用项目既定方案 (Zustand / Redux Toolkit / Pinia / BLoC)。禁止为简单需求引入新状态库。



\### 渲染性能硬约束



\- 条件允许时,组件必须使用 `const` / `memo` / `useMemo` / `useCallback` 等优化构造,降低重建开销。

\- 长列表 ( > 50 项) \*\*必须\*\*使用虚拟化或懒加载 (React Virtual / FlatList / `v-virtual-scroller`),禁止直接 `.map()` 渲染。

\- 禁止在渲染函数中执行同步阻塞操作 (大数组排序、深度 clone、JSON 序列化大对象)。

\- 图片必须含明确尺寸 (width/height 或 aspect-ratio),避免 CLS (累积布局偏移)。



\### 类型与异常



\- 严格空安全:不允许 `any`、`!.` (非空断言) 滥用,可空字段必须显式 `?` 或 `| null`。

\- 异步操作必须捕获并优雅处理错误,\*\*禁止\*\*裸 `await` 抛到 UI 顶层。优先使用 `Result<T, E>` / `Either` / discriminated union 模式表达成败。

\- 网络层和业务层必须分离:UI 组件不直接调 `fetch` / `axios`,必须经由 service / repository 层。



\### 可访问性 (a11y) 与语义



\- 所有交互元素必须有合适的 `role` 与 ARIA 属性。

\- 键盘可达性 (Tab / Enter / Escape) 必须在生成时一并实现,不留待事后补。

\- 颜色对比度满足 WCAG AA。文字与图标不得仅依赖颜色传达信息。



\### 测试与可维护性配套



新增功能时\*\*同时\*\*交付:



\- 核心逻辑函数的单元测试 (Vitest / Jest)

\- 组件级别的渲染测试 (Testing Library / Vue Test Utils)

\- 关键交互路径的集成测试桩

\- 任何外部依赖必须经由依赖注入或 Provider 模式接入,以便测试 mock



\---



