# Tasks

- [x] Task 1: 创建后端 AI 助教服务层
  - [x] SubTask 1.1: 创建 `ai_tutor_service.py`，实现答疑解惑方法（`answer_question` / `answer_question_stream`），自动注入课程上下文和学生画像，支持图片 OCR 输入，实现超范围检测和模糊问题澄清
  - [x] SubTask 1.2: 实现知识点讲解方法（`explain_knowledge` / `explain_knowledge_stream`），支持基础/进阶/专家三级分层讲解，根据掌握度调整深度，生成代码示例和 Mermaid 图表，关联应用案例
  - [x] SubTask 1.3: 实现学习引导方法（`recommend_resources`、`suggest_learning_path`、`get_learning_progress`），聚合教材/视频/论文/练习数据，支持自定义目标优先级，实现进度仪表盘和日历计划
  - [x] SubTask 1.4: 实现学习诊断方法（`diagnose_knowledge_mastery`、`generate_diagnosis_report` / `generate_diagnosis_report_stream`），聚合错题和编程提交数据，实现布鲁姆分类法多维度评估、错误模式识别、同水平对比、改进方案生成、效果跟踪

- [x] Task 2: 创建后端 AI 助教路由层
  - [x] SubTask 2.1: 创建 `ai_tutor_routes.py`，注册 Blueprint `ai_tutor_bp`
  - [x] SubTask 2.2: 实现答疑解惑端点 `POST /ai-tutor/answer` 和 `POST /ai-tutor/answer/stream`（支持图片上传）
  - [x] SubTask 2.3: 实现知识点讲解端点 `POST /ai-tutor/explain` 和 `POST /ai-tutor/explain/stream`
  - [x] SubTask 2.4: 实现学习引导端点 `GET /ai-tutor/resources`、`POST /ai-tutor/learning-path`、`GET /ai-tutor/progress`
  - [x] SubTask 2.5: 实现学习诊断端点 `GET /ai-tutor/diagnosis`、`POST /ai-tutor/diagnosis/report/stream`、`GET /ai-tutor/diagnosis/comparison`
  - [x] SubTask 2.6: 实现用户反馈端点 `POST /ai-tutor/feedback`
  - [x] SubTask 2.7: 在 `main.py` 中注册新 Blueprint

- [x] Task 3: 前端 API 层扩展
  - [x] SubTask 3.1: 在 `api.js` 中新增 `aiTutor` 对象，封装所有 AI 助教 API 调用（含 SSE 流式接口和图片上传）

- [x] Task 4: 创建前端 AI 助教主面板组件
  - [x] SubTask 4.1: 创建 `AITutorPanel.jsx` 主组件，实现左侧4个Tab导航 + 右侧内容区布局
  - [x] SubTask 4.2: 实现课程选择器和快捷操作栏
  - [x] SubTask 4.3: 实现模块间联动逻辑（答疑→知识标记、诊断→薄弱点提示）
  - [x] SubTask 4.4: 实现用户反馈（点赞/点踩）交互

- [x] Task 5: 创建前端答疑解惑组件
  - [x] SubTask 5.1: 创建 `QuestionAnswer.jsx`，实现对话式问答界面，支持 SSE 流式输出
  - [x] SubTask 5.2: 实现图片上传与预览功能（JPG/PNG，≤10MB）
  - [x] SubTask 5.3: 实现超范围问题提示、模糊问题澄清选项和上下文感知

- [x] Task 6: 创建前端知识点讲解组件
  - [x] SubTask 6.1: 创建 `KnowledgeExplainer.jsx`，实现基础/进阶/专家3层可折叠卡片讲解
  - [x] SubTask 6.2: 实现 Mermaid 图表渲染与导出（PNG/SVG）
  - [x] SubTask 6.3: 实现代码示例语法高亮显示
  - [x] SubTask 6.4: 实现根据掌握度调整默认展开层和应用案例展示

- [x] Task 7: 创建前端学习引导组件
  - [x] SubTask 7.1: 创建 `LearningGuide.jsx`，实现多类型资源推荐列表（教材/视频/论文/练习）
  - [x] SubTask 7.2: 实现可视化学习路径图和自定义目标设置
  - [x] SubTask 7.3: 实现知识点掌握度仪表盘、学习活动时间线和日历式学习计划

- [x] Task 8: 创建前端学习诊断组件
  - [x] SubTask 8.1: 创建 `LearningDiagnosis.jsx`，实现知识点掌握度雷达图和热力图
  - [x] SubTask 8.2: 实现布鲁姆分类法多维度评估可视化
  - [x] SubTask 8.3: 实现诊断报告流式生成与展示（含错误模式识别和同水平对比）
  - [x] SubTask 8.4: 实现改进方案展示（练习题目、资源清单、方法建议）和效果跟踪对比

- [x] Task 9: 替换旧入口与路由集成
  - [x] SubTask 9.1: 在 `StudentDashboard.jsx` 中将"AI学习助手"菜单项替换为"AI助教"，指向新 AITutorPanel
  - [x] SubTask 9.2: 在 `CourseLearningPage.jsx` 中将旧 AI 助手面板替换为 AI 助教侧边栏（保留视频上下文）
  - [x] SubTask 9.3: 在 `App.jsx` 中添加 AI 助教路由

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 3]
- [Task 5, 6, 7, 8] depend on [Task 4]（可并行开发）
- [Task 9] depends on [Task 5, 6, 7, 8]
