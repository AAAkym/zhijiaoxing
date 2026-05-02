# Tasks

- [x] Task 1: 修复 AIAnalysisPanel 分析完成后数据展示可靠性
  - [x] 1.1 确认流式完成后的 `setIsAnalyzing(false)` 时序逻辑正确（已有最小显示时间机制，需验证边界情况）
  - [x] 1.2 确保 `onAnalysisComplete` 回调在 `done` 信号到达时被正确调用，且传递的 analysis 值为完整文本
  - [x] 1.3 在 MistakeDetail 中确保 `onAnalysisComplete` 回调正确更新 `aiAnalysis` state，并验证该 state 能正确传给 AIAnalysisPanel 的 `initialAnalysis`
  - [x] 1.4 添加防御性检查：当 SSE 流结束时 `fullAnalysis` 为空但无 error 时，给出友好提示而非空白展示

- [x] Task 2: 在 AIAnalysisPanel 中添加"生成靶向练习"快捷入口
  - [x] 2.1 在 AIAnalysisPanel 组件新增 `onGenerateTargeted` 可选回调 prop
  - [x] 2.2 当分析完成且有内容时，在分析结果底部渲染"🎯 基于此错因生成靶向练习"按钮
  - [x] 2.3 按钮点击时调用 `onGenerateTargeted` 回调，传入当前 mistakeId 和分析内容中的知识点信息

- [x] Task 3: MistakeDetail 集成靶向治疗跳转逻辑
  - [x] 3.1 在 MistakeDetail 中实现 `handleGenerateTargeted` 方法，接收 AIAnalysisPanel 传来的错题上下文
  - [x] 3.2 通过 `onNavigateToTargeted` 回调将错题ID、课程ID、知识点标签传递给父组件 MistakeBook/index.jsx
  - [x] 3.3 MistakeBook/index.jsx 新增 `targetedContext` state 和 `handleNavigateToTargeted` 方法，切换到 targeted Tab 并传入上下文

- [x] Task 4: TargetedTherapy 支持单题触发模式
  - [x] 4.1 TargetedTherapy 新增 `initialContext` 可选 prop（包含 mistakeId, courseId, knowledgeTags）
  - [x] 4.2 当 `initialContext` 存在时，组件以单题模式初始化：标题变为针对性描述，自动设置课程筛选器
  - [x] 4.3 单题模式下高亮显示与传入知识点匹配的推荐题目

- [x] Task 5: 端到端验证
  - [x] 5.1 验证 AI 分析完成 → 内容展示 → 点击靶向练习 → 跳转并展示匹配题目的完整流程
  - [x] 5.2 验证前端构建无报错

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5] depends on [Task 4]
