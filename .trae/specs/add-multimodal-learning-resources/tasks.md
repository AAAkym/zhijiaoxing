# Tasks

- [x] Task 1: 后端代码执行API
  - [x] SubTask 1.1: 创建 `backend/src/routes/code_execution.py`，实现 `POST /code-execution/run` 端点，使用 subprocess 安全执行Python代码，设置10秒超时限制，过滤危险操作（os.system/subprocess/open写入/socket等），返回结构化执行结果（output/error/exit_code）
  - [x] SubTask 1.2: 在 `backend/src/main.py` 中注册 `code_execution_bp` Blueprint

- [x] Task 2: 前端交互式思维导图组件
  - [x] SubTask 2.1: 创建 `frontend/src/components/ui/InteractiveMindMap.jsx`，基于SVG实现树状思维导图渲染，接收树状JSON数据（root/children/name/description/is_core/relationship_type），自动计算节点布局（根节点居中，子节点按层级展开），核心节点深色标注，扩展节点浅色标注，连线标注关系类型
  - [x] SubTask 2.2: 实现节点展开/折叠交互（点击含子节点的节点切换展开状态，带CSS过渡动画）
  - [x] SubTask 2.3: 实现缩放操作（鼠标滚轮缩放0.5x-2x + 工具栏缩放按钮 + 重置按钮）
  - [x] SubTask 2.4: 实现拖拽操作（鼠标拖拽画布平移 + 单节点拖拽调整位置）
  - [x] SubTask 2.5: 实现Markdown/图形视图双模式切换（Markdown视图以缩进列表展示层级结构，图形视图展示SVG可视化）

- [x] Task 3: 前端代码实操组件
  - [x] SubTask 3.1: 创建 `frontend/src/components/ui/CodePlayground.jsx`，基于现有 CodeEditor 组件，布局为左侧代码编辑区 + 右侧输出区，顶部工具栏含"运行"、"重置代码"按钮和语言选择器
  - [x] SubTask 3.2: 实现代码运行功能（调用后端 `/code-execution/run` API，展示运行输出或错误信息，错误以红色标注含行号和错误类型）
  - [x] SubTask 3.3: 实现运行状态指示（运行中显示loading、超时提示）和代码重置功能

- [x] Task 4: 前端API层扩展
  - [x] SubTask 4.1: 在 `frontend/src/services/api.js` 中新增 `codeExecution` 对象，封装 `runCode(code, language)` 方法
  - [x] SubTask 4.2: 在 `api.js` 的 `courseGeneration` 对象中新增 `getCourseResources(courseId, chapterId)` 方法，获取课程关联的生成资源

- [x] Task 5: 学生端课程学习页面资源展示
  - [x] SubTask 5.1: 修改 `CourseLearningPage.jsx`，在课程讲义标签页中新增"学习资源"区域，位于讲义目录上方，以4个资源卡片展示（核心概念讲解文档、知识点思维导图、拓展阅读材料、代码实操案例）
  - [x] SubTask 5.2: 实现资源卡片交互：点击讲解文档卡片展开文档内容面板；点击思维导图卡片打开 InteractiveMindMap 组件弹窗；点击拓展阅读卡片展示推荐资源列表；点击代码实操卡片打开 CodePlayground 组件弹窗
  - [x] SubTask 5.3: 实现资源卡片状态展示（已生成=绿色可用+资源数量，未生成=灰色待生成），切换章节时自动刷新关联资源

- [x] Task 6: 教师端资源类型选项完善
  - [x] SubTask 6.1: 确认 `CourseGenerationWizard.jsx` 中 RESOURCE_TYPES 已包含 document/mindmap/recommendation/project 4种类型及中文标签，确保个性化模式中默认选中这4种类型
  - [x] SubTask 6.2: 验证生成结果面板中 mindmap 和 project 类型有对应的预览展示（mindmap显示JSON结构，project显示代码内容）

# Task Dependencies
- [Task 2, Task 3] 可并行开发（无依赖）
- [Task 4] depends on [Task 1]（代码执行API）
- [Task 5] depends on [Task 2, Task 3, Task 4]（需要组件和API就绪）
- [Task 6] 可独立开发（仅前端配置修改）
