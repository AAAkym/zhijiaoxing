# 多模态学习资源生成与展示 Spec

## Why
当前系统的教师端内容生成功能仅支持标准课程生成流程，缺少核心概念讲解文档、知识点思维导图、拓展阅读材料、代码实操案例等4种关键资源类型的生成选项。学生端的课程学习页面没有突出展示这些个性化学习资源，且代码实操缺少沉浸式编辑体验，思维导图仅有数据生成能力而无可视化交互渲染。需要打通"教师端生成→学生端展示"的完整链路，并实现代码编辑器和交互式思维导图两大核心交互组件。

## What Changes
- 在教师端 CourseGenerationWizard 的个性化模式中，新增4种资源类型生成选项（核心概念讲解文档、知识点思维导图、拓展阅读材料、代码实操案例），系统基于知识库课程内容自动生成匹配的教学内容
- 在学生端 CourseLearningPage 的课程讲义标签页中，新增"学习资源"区域，突出展示4种个性化学习资源卡片
- 新增 CodePlayground 组件，基于现有 CodeEditor 扩展，集成代码运行（调用后端执行API）、错误提示、输出展示功能
- 新增 InteractiveMindMap 组件，将后端生成的树状JSON思维导图数据渲染为交互式可视化图形，支持节点展开/折叠、缩放、拖拽操作，同时保留Markdown格式视图切换
- 后端新增代码执行API端点，支持Python代码的安全沙箱执行

## Impact
- Affected specs: 教师端内容生成流程、学生端课程学习页面、代码实操交互体验、思维导图可视化
- Affected code:
  - 修改: `frontend/src/components/CourseGenerationWizard.jsx`（新增4种资源类型选项）
  - 修改: `frontend/src/components/CourseLearningPage.jsx`（新增学习资源展示区域）
  - 修改: `frontend/src/services/api.js`（新增代码执行API、资源获取API）
  - 新增: `frontend/src/components/ui/CodePlayground.jsx`（代码实操组件）
  - 新增: `frontend/src/components/ui/InteractiveMindMap.jsx`（交互式思维导图组件）
  - 新增: `backend/src/routes/code_execution.py`（代码执行API）
  - 修改: `backend/src/main.py`（注册新Blueprint）

## ADDED Requirements

### Requirement: 教师端4种资源类型生成选项
系统 SHALL 在教师端内容生成功能模块中，提供核心概念讲解文档、知识点思维导图、拓展阅读材料、代码实操案例4种内容生成选项，基于当前数据库中的课程内容和教学主题进行智能分析，自动生成与具体课程高度匹配的教学内容。

#### Scenario: 选择资源类型并生成
- **WHEN** 教师在 CourseGenerationWizard 个性化模式中选择一种或多种资源类型并点击生成
- **THEN** 系统调用对应智能体（DocumentAgent生成讲解文档和思维导图、RecommendationAgent生成拓展阅读、ProjectAgent生成代码实操案例），将知识库中该课程的章节内容、知识点定义、教学案例注入prompt，生成与课程高度匹配的内容

#### Scenario: 生成内容与课程匹配
- **WHEN** 系统基于课程ID生成资源
- **THEN** 生成内容必须：1)知识点与课程大纲一致；2)术语使用与知识库定义统一；3)案例场景与教学案例关联；4)难度等级与课程设置匹配

#### Scenario: 生成结果预览
- **WHEN** 资源生成完成
- **THEN** 教师可在生成结果面板中按资源类型Tab切换预览，每种资源类型显示对应的结构化内容

### Requirement: 学生端学习资源突出展示
系统 SHALL 在学生端"我的课程-课程学习"页面的核心区域突出显示核心概念讲解文档、知识点思维导图、拓展阅读材料、代码实操案例4种学习资源，确保学生能够直观、便捷地访问。

#### Scenario: 课程学习页面资源展示
- **WHEN** 学生进入 CourseLearningPage 的课程讲义标签页
- **THEN** 页面在讲义目录上方显示"学习资源"区域，以4个资源卡片形式展示：
  - 📄 核心概念讲解文档（点击展开文档内容）
  - 🧠 知识点思维导图（点击打开交互式思维导图）
  - 📚 拓展阅读材料（点击查看推荐资源列表）
  - 💻 代码实操案例（点击打开代码实操环境）

#### Scenario: 资源卡片状态展示
- **WHEN** 某类资源已生成
- **THEN** 对应卡片显示绿色可用状态，标注资源数量
- **WHEN** 某类资源未生成
- **THEN** 对应卡片显示灰色待生成状态，提示"暂无资源"

#### Scenario: 资源与课程章节关联
- **WHEN** 学生切换不同章节
- **THEN** 学习资源区域自动刷新，展示与当前章节关联的资源

### Requirement: 代码实操案例组件
系统 SHALL 提供沉浸式代码实操组件 CodePlayground，集成代码编辑、运行、错误提示功能。

#### Scenario: 代码编辑与语法高亮
- **WHEN** 学生打开代码实操案例
- **THEN** 系统展示 CodePlayground 组件，左侧为代码编辑区（基于现有CodeEditor），预填案例代码，支持语法高亮、行号、自动补全

#### Scenario: 代码运行与结果展示
- **WHEN** 学生点击"运行"按钮
- **THEN** 系统将代码发送至后端执行API，在右侧输出区展示运行结果（标准输出）或错误信息（含行号定位和错误类型标注）
- **WHEN** 代码运行超时（>10秒）
- **THEN** 系统终止执行并提示"运行超时"

#### Scenario: 代码重置
- **WHEN** 学生点击"重置代码"按钮
- **THEN** 代码编辑区恢复为案例初始代码，输出区清空

#### Scenario: 错误提示
- **WHEN** 代码执行产生语法错误或运行时错误
- **THEN** 输出区以红色文字展示错误信息，包含错误类型、错误行号、错误描述

### Requirement: 交互式思维导图组件
系统 SHALL 提供 InteractiveMindMap 组件，将后端生成的树状JSON思维导图数据渲染为交互式可视化图形，同时支持Markdown格式视图切换。

#### Scenario: 可视化思维导图渲染
- **WHEN** 学生打开知识点思维导图
- **THEN** 系统将后端返回的树状JSON数据渲染为可视化思维导图，根节点居中，子节点按层级向外展开，核心节点以深色标注，扩展节点以浅色标注，节点间连线标注关系类型（因果/包含/并列/递进）

#### Scenario: 节点展开/折叠
- **WHEN** 学生点击含子节点的节点
- **THEN** 该节点的子节点展开或折叠，展开时带动画过渡效果

#### Scenario: 缩放操作
- **WHEN** 学生使用鼠标滚轮或工具栏缩放按钮
- **THEN** 思维导图整体缩放，支持0.5x-2x范围

#### Scenario: 拖拽操作
- **WHEN** 学生按住鼠标拖拽画布
- **THEN** 思维导图整体平移；按住单个节点拖拽可调整节点位置

#### Scenario: Markdown视图切换
- **WHEN** 学生点击"Markdown视图"切换按钮
- **THEN** 思维导图切换为Markdown缩进格式展示，保留层级结构
- **WHEN** 学生点击"图形视图"切换按钮
- **THEN** 恢复可视化图形展示

### Requirement: 后端代码执行API
系统 SHALL 提供安全的Python代码执行API，支持代码实操案例的在线运行。

#### Scenario: 代码执行请求
- **WHEN** 前端发送 POST 请求至 `/code-execution/run`，请求体包含 `{ "code": "...", "language": "python" }`
- **THEN** 系统在安全沙箱中执行代码，返回 `{ "output": "运行输出", "error": null, "exit_code": 0 }` 或 `{ "output": "", "error": "错误信息", "exit_code": 1 }`

#### Scenario: 执行超时保护
- **WHEN** 代码执行超过10秒
- **THEN** 系统强制终止进程，返回 `{ "error": "执行超时（10秒限制）", "exit_code": -1 }`

#### Scenario: 安全限制
- **WHEN** 代码包含危险操作（文件系统写入、网络请求、子进程创建等）
- **THEN** 系统拒绝执行并返回安全警告信息

## MODIFIED Requirements

### Requirement: CourseGenerationWizard资源类型列表
CourseGenerationWizard 中的 RESOURCE_TYPES 列表 SHALL 更新为包含以下6种类型：document（核心概念讲解文档）、mindmap（知识点思维导图）、layered_exercise（分层次练习题）、media（教学视频/动画）、recommendation（拓展阅读材料）、project（代码实操案例），每种类型需显示中文名称和描述。

## REMOVED Requirements
无
