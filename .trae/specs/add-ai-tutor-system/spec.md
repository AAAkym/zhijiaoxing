# AI助教系统 Spec

## Why
当前系统虽已具备 AI 对话（spark_service）、错题分析、靶向练习等分散能力，但缺乏一个统一的、面向学生的 AI 助教入口。学生需要在不同页面分别使用视频助手、错题分析、练习评测等功能，无法获得连贯的个性化学习辅导体验。需要一个整合答疑、知识点讲解、学习引导和学习诊断四大核心模块的 AI 助教系统，让学生通过一个统一入口即可获得全方位学习支持，同时替换现有分散的"AI学习助手"入口。

## What Changes
- 新增后端 AI 助教服务（`ai_tutor_service.py`），整合现有 spark_service 能力并新增4大模块专用方法
- 新增后端 AI 助教路由（`ai_tutor_routes.py`），提供4大模块的 REST/SSE 端点
- 新增前端 AI 助教主页面组件（`AITutorPanel.jsx`），作为学生端统一入口
- 新增前端4个功能子组件：答疑解惑、知识点讲解、学习引导、学习诊断
- 复用现有 StudentProfile、LearningProgress、MistakeRecord、Course 等数据模型
- 复用现有 spark_service 的 chat/chat_stream 接口，通过精心设计的 prompt 实现各模块功能
- **BREAKING**: 删除 StudentDashboard 中旧的"AI学习助手"菜单项和对应面板，用新 AI 助教系统替代
- 删除 CourseLearningPage 中旧的 AI 学习助手面板，统一使用新系统

## Impact
- Affected specs: AI助教交互流程、学生学习路径、错题本与靶向练习联动
- Affected code:
  - 新增: `backend/src/services/ai_tutor_service.py`, `backend/src/routes/ai_tutor_routes.py`
  - 新增: `frontend/src/components/AITutor/AITutorPanel.jsx`, `QuestionAnswer.jsx`, `KnowledgeExplainer.jsx`, `LearningGuide.jsx`, `LearningDiagnosis.jsx`
  - 修改: `backend/src/main.py`（注册新 Blueprint）, `frontend/src/App.jsx`（添加路由）, `frontend/src/services/api.js`（新增 API 调用）
  - 修改: `frontend/src/components/StudentDashboard.jsx`（替换旧AI学习助手入口）
  - 修改: `frontend/src/components/CourseLearningPage.jsx`（替换旧AI助手面板）

## ADDED Requirements

### Requirement: 答疑解惑模块
系统 SHALL 提供一个智能答疑模块，支持学生针对课程内容提问并获得精准解答。

#### Scenario: 文本提问与回答
- **WHEN** 学生在答疑模块输入关于课程内容的文本问题（支持≥500字长文本）
- **THEN** 系统调用 AI 生成回答，回答内容需：
  - 准确理解问题意图
  - 使用学术性语言，避免口语化表达，关键概念标注来源
  - 复杂问题分点作答，重要结论加粗显示
  - 自动注入学生当前学习课程的上下文信息
  - 使用 SSE 流式输出，实时展示生成过程

#### Scenario: 图片输入支持
- **WHEN** 学生上传图片（JPG/PNG格式，≤10MB）作为问题补充
- **THEN** 系统对图片进行 OCR 文字识别，将识别出的文字内容与文本问题合并后提交给 AI

#### Scenario: 超范围问题识别
- **WHEN** 学生提出的问题明显超出当前课程范围
- **THEN** 系统礼貌提示该问题超出课程范围，并尝试给出相关方向性指引

#### Scenario: 模糊问题澄清
- **WHEN** 学生提出的问题存在模糊或歧义
- **THEN** 系统提供最多3个澄清性追问选项供学生选择，明确问题意图后再作答

#### Scenario: 上下文感知答疑
- **WHEN** 学生在某个课程页面发起答疑
- **THEN** 系统自动获取该课程的标题、大纲、教学内容作为上下文，结合学生画像中的认知风格和互动偏好调整回答风格

### Requirement: 知识点讲解模块
系统 SHALL 提供分层知识点讲解功能，支持由浅入深的概念解释和多样化示例。

#### Scenario: 三级分层讲解
- **WHEN** 学生请求讲解某个知识点
- **THEN** 系统按3个层次输出讲解内容：
  1. **基础层**：使用生活化类比解释核心概念，避免专业术语
  2. **进阶层**：包含完整概念定义、原理阐述与标准案例
  3. **专家层**：提供理论背景、前沿研究与应用扩展
  - 每层以可折叠卡片形式展示，默认根据学生掌握度决定展开层

#### Scenario: 根据学生水平调整深度
- **WHEN** 学生画像中该知识点的掌握度 >= 60%
- **THEN** 系统默认从进阶层开始讲解，基础层折叠
- **WHEN** 学生画像中该知识点的掌握度 < 30%
- **THEN** 系统从基础层开始完整讲解

#### Scenario: 代码示例生成
- **WHEN** 知识点涉及编程内容
- **THEN** 系统生成包含语法高亮与注释的代码示例，支持 Python/Java/C++ 等主流编程语言

#### Scenario: 可视化辅助
- **WHEN** 知识点适合用思维导图或流程图展示（如算法流程、架构关系）
- **THEN** 系统在讲解中生成 Mermaid 格式的图表代码，前端渲染为可视化图形，支持导出 PNG/SVG 格式

#### Scenario: 案例库关联
- **WHEN** 讲解核心知识点时
- **THEN** 系统关联3-5个不同场景的应用案例，每个案例包含场景描述和关键要点

### Requirement: 学习引导模块
系统 SHALL 根据学生问题和学习历史推荐个性化学习资源与路径。

#### Scenario: 多类型资源推荐
- **WHEN** 学生完成一次答疑或知识点讲解后
- **THEN** 系统基于当前知识点推荐相关学习资源，资源类型包括：
  - 教材章节（来自 TeachingContent，精确到页码范围）
  - 视频教程（来自 VideoLesson，提供时间戳定位关键内容）
  - 学术论文（附摘要与核心观点提炼）
  - 分级练习题（基础/中等/挑战三级，来自 Assessment）
  - 每个资源显示标题、类型标签、关联度评分

#### Scenario: 个性化学习路径建议
- **WHEN** 学生请求学习路径建议
- **THEN** 系统基于学生画像（认知风格、学习节奏、目标导向）和当前掌握情况生成可视化学习路径图，包含3-5个步骤的短期学习路径建议
- **WHEN** 学生设置自定义学习目标
- **THEN** 系统根据目标优先级调整路径步骤排序

#### Scenario: 学习进度跟踪
- **WHEN** 学生查看学习引导面板
- **THEN** 系统展示：
  - 各课程知识点掌握度仪表盘（0-100%进度条显示）
  - 最近学习活动时间线
  - 待完成推荐项列表
  - 日历式学习计划与每日/每周学习提醒

### Requirement: 学习诊断模块
系统 SHALL 分析学生在各知识点上的掌握程度，识别薄弱环节并生成诊断报告。

#### Scenario: 多维度能力评估
- **WHEN** 学生请求学习诊断
- **THEN** 系统聚合 MistakeRecord 和 ProgrammingSubmission 数据，按知识点维度计算掌握度，输出：
  - 各知识点掌握度评分（0-100）
  - 薄弱知识点列表（掌握度 < 60%）
  - 知识点掌握度雷达图
  - 基于布鲁姆分类法的多维度评估（记忆/理解/应用/分析/评价/创造）

#### Scenario: 诊断报告生成
- **WHEN** 学生点击"生成诊断报告"
- **THEN** 系统调用 AI 生成结构化诊断报告，包含：
  - 总体学习状态评估
  - 薄弱环节详细分析（含错误模式识别）
  - 与同水平学生对比分析
  - 针对性改进建议
  - 推荐练习方案（链接到靶向治疗模块）
  - 知识点掌握度热力图
  - 报告以 SSE 流式输出

#### Scenario: 改进方案生成
- **WHEN** 诊断报告识别出薄弱知识点
- **THEN** 系统针对每个薄弱知识点提供：
  - 3-5个针对性练习题目
  - 推荐学习资源清单（按优先级排序）
  - 学习方法建议（含时间分配方案）

#### Scenario: 效果跟踪
- **WHEN** 学生执行改进方案后再次请求诊断
- **THEN** 系统生成学习效果对比报告，展示前后掌握度变化，并动态调整后续策略

#### Scenario: 定期评估提醒
- **WHEN** 学生累计完成5次以上练习但尚未查看诊断报告
- **THEN** 系统在 AI 助教面板显示"查看你的学习诊断"提示卡片

### Requirement: AI助教统一入口
系统 SHALL 提供一个统一的 AI 助教面板，作为学生端的核心学习辅助入口。

#### Scenario: 面板布局
- **WHEN** 学生打开 AI 助教面板
- **THEN** 面板以左侧Tab导航 + 右侧内容区的布局展示4个模块：
  1. 💬 答疑解惑（默认激活）
  2. 📚 知识讲解
  3. 🧭 学习引导
  4. 🔍 学习诊断
  - 顶部显示学生当前课程选择器
  - 底部显示快捷操作栏（快速提问、查看诊断、推荐资源）

#### Scenario: 模块间联动
- **WHEN** 学生在答疑模块中询问了某个知识点
- **THEN** 系统自动在知识讲解模块标记该知识点为"最近询问"，在学习引导模块推荐相关资源
- **WHEN** 学习诊断发现某知识点薄弱
- **THEN** 系统在答疑和知识讲解模块的快捷入口中提示"复习薄弱点：[知识点名]"

### Requirement: 内容审核与反馈
系统 SHALL 确保教学内容准确性与适宜性，并支持用户反馈驱动的持续优化。

#### Scenario: 内容审核
- **WHEN** AI 生成回答或讲解内容
- **THEN** 系统对生成内容进行基础审核，过滤不当内容

#### Scenario: 用户反馈收集
- **WHEN** 学生对 AI 回答进行评价（点赞/点踩）
- **THEN** 系统记录反馈数据，用于后续 prompt 优化

## MODIFIED Requirements

### Requirement: 学生端导航入口替换
原有 StudentDashboard 中的"AI学习助手"菜单项和 CourseLearningPage 中的 AI 助手面板 SHALL 被新的 AI 助教系统统一入口替代。

- StudentDashboard 左侧菜单中"AI学习助手"替换为"AI助教"，点击后展示新的 AITutorPanel 组件
- CourseLearningPage 右侧 AI 助手面板替换为可折叠的 AI 助教侧边栏（保留视频上下文感知能力）

## REMOVED Requirements

### Requirement: 旧AI学习助手独立入口
**Reason**: 新 AI 助教系统整合了原有 AI 学习助手的所有功能并大幅扩展，旧入口会导致功能重复和用户困惑
**Migration**: StudentDashboard 的"AI学习助手"菜单项替换为"AI助教"；CourseLearningPage 的 AI 助手面板替换为 AI 助教侧边栏
