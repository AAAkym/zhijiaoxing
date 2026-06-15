# 智教星 - 基于大模型的个性化资源生成与学习多智能体系统

> 本文档面向 AI 助手，旨在帮助快速理解项目核心思路、技术架构、功能模块、实现路径及关键要点，便于高效参与开发与迭代。

---

## 1. 项目背景

### 1.1 赛题信息

- **赛题名称**：A3-基于大模型的个性化资源生成与学习多智能体系统开发
- **出题企业**：科大讯飞股份有限公司
- **赛事**：第十五届中国软件杯大赛 A 组（本科、研究生、高职）
- **赛题核心**：借助大模型技术体系，融合前沿 AI 技术，突破传统教育局限，构建高等教育个性化学习资源体系，开发智能学习多智能体系统

### 1.2 问题域

高等教育中学生面临的核心痛点：

1. **资源繁杂无序**：海量课程资料难以精准匹配自身需求
2. **标准化教学适配不足**：集体讲授无法兼顾每位学生的学习节奏与特点
3. **缺乏智能个性化指导**：传统辅助系统缺少多模态生成、多智能体协同等前沿 AI 支撑
4. **知识吸收效率低**：不同学生在知识基础、学习能力、兴趣方向上差异显著

### 1.3 项目定位

**智教星**是一款面向高等教育的智能教学管理平台，深度集成讯飞 Spark 星火大模型，采用 Multi-Agent 多智能体架构，以计算机/人工智能专业课程为切入点，实现个性化资源的自动化生成与建设，为学生提供定制化、多模态的学习内容，实现"因材施教"的数字化落地。

### 1.4 评分标准

| 评分项 | 占比 | 对应策略 |
|--------|------|----------|
| 创新价值与实用性 | 35% | 多智能体协同架构 + 对话式画像 + 多模态资源生成 |
| 功能实现及技术要求 | 45% | 8个智能体 + 7种资源类型 + SSE流式 + 知识库融合 |
| 配套文档的丰富度 | 10% | 系统开发说明书 + 测试说明书 + 架构图 + 流程图 |
| 演示视频、PPT 效果 | 10% | 7分钟演示视频 + 逻辑清晰的PPT |

---

## 2. 需求分析

### 2.1 赛题基本功能需求（必须实现）

| 编号 | 功能 | 赛题要求 | 当前实现状态 | 实现位置 |
|------|------|----------|-------------|----------|
| F1 | 对话式学习画像自主构建 | 通过自然语言对话自动抽取特征，构建≥6维度动态学生画像，支持随学随新 | ✅ 已实现（8维度） | `profile_agent.py` + `student_profile.py` + `profile_routes.py` |
| F2 | 多智能体协同的资源生成 | 多智能体架构，≥5种类型个性化资源生成 | ✅ 已实现（7种资源类型） | `coordinator_agent.py` + 5个专业Agent |
| F3 | 个性化学习路径规划和资源推送 | 规划动态个性化学习路径，精准推送多类型内容 | ✅ 已实现 | `learning_path_service.py` + `recommendation_agent.py` |
| F4 | 智能辅导（可选加分） | 多模态答疑解惑，文字+图解+视频 | ✅ 已实现 | `ai_tutor_service.py` + `sse_chat_service.py` |
| F5 | 学习效果评估（可选加分） | 多维度精准评估，动态调整推送策略和学习计划 | ✅ 已实现 | `learning_analytics_service.py` + `achievement_service.py` |

### 2.2 赛题非功能性需求

| 编号 | 需求 | 当前实现状态 | 实现位置 |
|------|------|-------------|----------|
| NF1 | 界面美观大方、简洁明了，符合现代AI产品交互规范（流式输出、Markdown渲染、多模态内容卡片化展示） | ✅ 已实现 | React 19 + shadcn/ui + SSE流式 + Mermaid渲染 |
| NF2 | 标注开源项目、AI工具/框架名称、来源及协议 | ⚠️ 需在文档中完善 | README.md 已有致谢部分 |
| NF3 | 防幻觉与内容安全过滤机制 | ✅ 已实现 | `content_review_service.py` + `content_review.py` |
| NF4 | 响应时间合理，提供生成进度追踪或流式呈现机制 | ✅ 已实现 | SSE流式输出 + `shared_state.py` 进度追踪 + ThreadPoolExecutor并行生成 |

### 2.3 学生画像维度（8维度，超出赛题6维度要求）

| 维度 | Key | 类型 | 说明 |
|------|-----|------|------|
| 知识基础 | `knowledge_base` | JSON | 专业方向、已掌握领域及掌握程度(0-100)、薄弱领域 |
| 认知风格 | `cognitive_style` | Enum | visual/auditory/kinesthetic/reading/mixed |
| 易错点模式 | `error_patterns` | JSON Array | 知识点、错误类型(概念/计算/思路/遗忘/其他)、频率(高/中/低) |
| 学习节奏 | `learning_pace` | Enum | fast/moderate/slow/adaptive |
| 兴趣领域 | `interest_areas` | JSON Array | 领域名称、权重(0-1) |
| 目标导向 | `goal_orientation` | Enum | exam/career/hobby/research |
| 时间可用性 | `time_availability` | JSON | 每日/每周可用学习时间 |
| 互动偏好 | `interaction_preference` | Enum | guided/exploratory/challenging |

### 2.4 多模态资源类型（7种，超出赛题5种要求）

| 资源类型 | 生成Agent | 说明 | 对应赛题要求 |
|----------|-----------|------|-------------|
| 课程讲解文档 | DocumentAgent | 专业课程讲解文档，支持Markdown/Word导出 | 专业课程讲解文档 |
| 知识点思维导图 | DocumentAgent | Mermaid格式的知识结构图 | 知识点思维导图 |
| 练习题目 | ExerciseAgent | 选择题/填空题/编程题/分层练习 | 不同类型练习题目 |
| 拓展阅读材料 | RecommendationAgent | 论文/博客/教程/视频/书籍推荐 | 拓展阅读材料 |
| 多模态教学视频/动画 | MediaAgent | 视频脚本+动画描述+实际视频生成 | 多模态教学视频/动画 |
| 代码实操案例 | ProjectAgent | 完整项目代码+说明+测试用例 | 代码类实操案例 |
| 实践项目学习材料 | ProjectAgent | 项目需求+架构设计+实现步骤 | 实践项目学习材料 |

---

## 3. 技术选型

### 3.1 技术栈总览

```
┌──────────────────────────────────────────────────────────────┐
│                        前端技术栈                              │
│  React 19.1 + Vite 6.3 + Tailwind CSS 4.1 + shadcn/ui       │
│  React Router 7.6 + Recharts 2.15 + Socket.IO 4.8           │
│  Tiptap 2.4 + CodeMirror 6.x + Framer Motion 12.15          │
│  Mermaid 11.15 + Three.js 0.184                              │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│                        后端技术栈                              │
│  Flask 2.3.3 + Python 3.14 + SQLAlchemy 3.1.1               │
│  Celery 5.3.4 + Redis 5.0.1 + Flask-SocketIO 5.3.6          │
│  Spark API (Ultra) + Elasticsearch 8.11                      │
│  Prometheus 0.19 + FPDF2/python-docx + Pillow                │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│                      数据层 & 基础设施                         │
│  SQLite(开发) / PostgreSQL(生产) + Redis + Elasticsearch      │
│  Prometheus + Grafana + Alertmanager + ELK Stack              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 关键技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 大模型 | 讯飞Spark星火 | 赛题要求使用科大讯飞相关工具 |
| 多智能体框架 | 自研（AgentBase + Orchestrator） | 赛题要求明确"多智能体协同框架"，自研更灵活可控 |
| 前端框架 | React 19 + Vite | 生态成熟，SSE/WebSocket支持好，组件库丰富 |
| 后端框架 | Flask | 轻量灵活，Python生态与AI工具链契合 |
| 实时通信 | SSE + WebSocket | SSE用于AI流式输出，WebSocket用于师生互动 |
| 异步任务 | Celery + Redis | 资源生成等耗时操作异步化，6个优先级队列 |
| 数据库 | SQLite(开发)/PostgreSQL(生产) | 开发便捷，生产可靠 |
| 搜索引擎 | Elasticsearch | 全文搜索与搜索推荐（可选组件） |
| 监控 | Prometheus + Grafana + ELK | 全链路可观测性 |

### 3.3 AI工具使用说明（赛题要求）

| 工具 | 用途 | 来源 | 协议 |
|------|------|------|------|
| 讯飞Spark星火大模型 | 核心AI能力（对话、生成、分析） | 科大讯飞 | 商业API |
| Claude Code / Trae | AI辅助编程 | Anthropic / 字节跳动 | 商业工具 |

---

## 4. 系统设计

### 4.1 系统整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                          客户端层                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ 管理员端  │  │ 教师端    │  │ 学生端    │  │ PWA 离线支持      │    │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────────┬─────────┘    │
│        └──────────────┴──────────────┴────────────────┘              │
│                          React 19 SPA                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / SSE / WebSocket
┌──────────────────────────────┴──────────────────────────────────────┐
│                          API 网关层                                  │
│  Flask Routes (25+ 模块) + CORS + Session + Metrics Middleware      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                       业务服务层                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              Multi-Agent 多智能体系统                         │    │
│  │  ┌────────────┐                                              │    │
│  │  │ Coordinator│ ── 总调度、策略规划、一致性检查、资源整合        │    │
│  │  └─────┬──────┘                                              │    │
│  │   ┌────┴────┬────────┬────────┬────────┐                     │    │
│  │   ▼         ▼        ▼        ▼        ▼                     │    │
│  │ Document  Exercise  Media  Recommend  Project                 │    │
│  │ Agent     Agent     Agent  Agent      Agent                   │    │
│  │ ┌─────────────────────────────────────────────────────────┐  │    │
│  │ │ SharedState + MessageBus + AgentMonitor                 │  │    │
│  │ └─────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ Spark Service │ │ SSE Chat     │ │ Profile      │               │
│  │ (LLM调用)     │ │ Service      │ │ Sync Service │               │
│  └──────────────┘ └──────────────┘ └──────────────┘               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ Learning Path│ │ Content      │ │ Knowledge    │               │
│  │ Service      │ │ Review Svc   │ │ Base Service │               │
│  └──────────────┘ └──────────────┘ └──────────────┘               │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                       数据持久层                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │ SQLite/  │ │ Redis    │ │ Elasticsearch│ │ File Storage     │  │
│  │ PostgreSQL│ │ (Cache/  │ │ (Search)     │ │ (Uploads/Exports)│  │
│  │          │ │  Queue)  │ │              │ │                  │  │
│  └──────────┘ └──────────┘ └──────────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────────┐
│                    监控 & 运维层                                      │
│  Prometheus + Grafana + Alertmanager + Filebeat + Logstash          │
│  Celery Beat (定时备份/报表/清理/健康检查)                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Multi-Agent 架构详解

#### 4.2.1 智能体清单

| Agent | agent_name | 职责 | 核心能力 |
|-------|-----------|------|----------|
| CoordinatorAgent | coordinator | 总调度中心 | 任务分发、策略规划、一致性检查、资源整合、知识库加载 |
| ProfileAgent | profiler | 学生画像构建 | 对话式画像构建、6+维度特征抽取、画像更新、摘要生成 |
| DocumentAgent | document_agent | 文档生成 | 课程讲解文档、知识点思维导图 |
| ExerciseAgent | exercise_agent | 题目生成 | 选择题/填空题/编程题/分层练习 |
| MediaAgent | media_agent | 多媒体生成 | 视频脚本、动画描述、视频资源 |
| RecommendationAgent | recommendation_agent | 资源推荐 | 论文/博客/教程/视频/书籍推荐 |
| ProjectAgent | project_agent | 项目设计 | 代码实操案例、实践项目学习材料 |

#### 4.2.2 协同工作机制

```
用户请求 → CoordinatorAgent
                │
                ├── 1. 加载学生画像（ProfileAgent数据）
                ├── 2. 加载知识库上下文（KnowledgeBaseService）
                ├── 3. 规划生成策略（认知风格+目标导向+学习节奏）
                ├── 4. 并行分发任务（ThreadPoolExecutor, max_workers=5）
                │       ├── DocumentAgent.process(task)  ──┐
                │       ├── ExerciseAgent.process(task)   ──┤
                │       ├── MediaAgent.process(task)      ──┤  并行执行
                │       ├── RecommendationAgent.process(task)──┤  timeout=120s
                │       └── ProjectAgent.process(task)    ──┘
                ├── 5. 内容格式转换（ContentConverterService）
                ├── 6. 一致性检查（知识点覆盖+难度对齐+交叉引用）
                └── 7. 整合输出资源包（package_id + metadata + completeness_report）
```

#### 4.2.3 共享状态与通信

- **SharedState**：智能体间共享数据（包状态、策略、结果），基于内存字典
- **MessageBus**：智能体间消息传递，支持日志记录
- **AgentMonitor**：智能体状态监控（IDLE/RUNNING/SUCCESS/FAILED），提供系统摘要

#### 4.2.4 资源生成策略

根据学生画像三维度动态调整：

| 画像维度 | 策略映射 |
|----------|----------|
| 认知风格(visual) | 增加视频脚本和图表类资源权重，文档增加可视化描述 |
| 认知风格(auditory) | 增加旁白讲解比例，推荐播客类资源 |
| 认知风格(kinesthetic) | 增加实操项目权重，习题增加编程题比例 |
| 认知风格(reading) | 增加文档深度，推荐学术论文和技术博客 |
| 目标导向(exam) | 习题侧重考点，文档标注重点，推荐真题资源 |
| 目标导向(career) | 项目侧重实际场景，推荐行业案例和技能资源 |
| 学习节奏(fast) | 资源紧凑高效，信息密度高 |
| 学习节奏(slow) | 分段讲解，增加回顾和练习 |

### 4.3 核心数据模型

| 模型 | 文件 | 核心字段 |
|------|------|----------|
| User | `user.py` | id, username, password_hash, role(admin/teacher/student), avatar |
| StudentProfile | `student_profile.py` | 8维度画像字段 + confidence_score + update_source |
| ProfileDialogSession | `student_profile.py` | 对话式画像构建会话(current_round, extracted_features, messages) |
| Course | `course.py` | 课程/章节/内容/评测/视频/进度 |
| Conversation | `conversation.py` | 对话/消息管理 |
| LearningPath | `learning_path.py` | 学习路径/资源推荐 |
| KnowledgeBase | `knowledge_base.py` | 知识库条目 |
| ContentVersion | `content_version.py` | 内容版本管理 |
| AIAnalysis | `ai_analysis.py` | AI分析报告 |
| TokenUsage | `token_usage.py` | API调用Token用量追踪 |

### 4.4 API 路由模块

| 路由模块 | 文件 | 核心功能 |
|----------|------|----------|
| auth | `auth.py` | 登录/注册/登出 |
| admin | `admin.py` | 管理员后台 |
| teacher | `teacher.py` | 教师功能 |
| student | `student.py` | 学生功能 |
| course | `course.py` | 课程管理 |
| ai_assistant | `ai_assistant.py` | AI助手 |
| ai_tutor_routes | `ai_tutor_routes.py` | AI辅导 |
| resource_generation | `resource_generation.py` | 多智能体资源生成 |
| profile_routes | `profile_routes.py` | 学生画像管理 |
| learning_path_routes | `learning_path_routes.py` | 学习路径 |
| sse_routes | `sse_routes.py` | SSE流式响应 |
| content_review | `content_review.py` | 内容审核 |
| knowledge_base_routes | `knowledge_base_routes.py` | 知识库管理 |
| search_routes | `search_routes.py` | 搜索功能 |
| programming | `programming.py` | 编程题评测 |

### 4.5 前端核心组件

| 组件 | 功能 |
|------|------|
| AdminDashboard | 管理员仪表板（用户/课程/班级/数据分析/系统设置） |
| TeacherDashboard | 教师仪表板（课程管理/AI内容生成/教案/学情分析/互动） |
| StudentDashboard | 学生仪表板（课程/AI助手/练习/错题本/学习路径/成就） |
| AIChatPanel | AI聊天面板（SSE流式对话、Markdown渲染） |
| ProfileBuilder | 学生画像构建（对话式+可视化看板） |
| CourseLearningPage | 课程学习页 |
| CourseGenerationWizard | AI课程生成向导 |
| LearningPlanSystem | 学习计划系统 |
| MistakeBook | 错题本组件组 |
| AIContentReview | AI内容审核组件组 |
| VideoPlayer | 视频播放器 |
| CodePlayground | 代码编辑器（CodeMirror） |

---

## 5. 实现路径

### 5.1 核心流程实现

#### 5.1.1 对话式画像构建流程

```
用户发起画像对话 → ProfileAgent.start_dialog()
    → 逐维度提问（6轮对话，每轮1个维度）
    → 用户回答 → ProfileAgent.continue_dialog()
        → _extract_dimension_value() 关键词匹配抽取特征
            → enum类型: 关键词映射（中英文双语）
            → json类型: 领域关键词+强弱关键词匹配
            → json_array类型: 错误类型/兴趣领域关键词匹配
        → _generate_feedback() 生成反馈
    → 6轮完成 → 保存到 StudentProfile 模型
    → confidence_score 自动计算（8维度填充率）
```

#### 5.1.2 多智能体资源生成流程

```
用户选择课程/主题/资源类型 → POST /api/resource-generation/generate
    → CoordinatorAgent._generate_resource_package()
        → 加载知识库上下文（KnowledgeBaseService.build_knowledge_context_for_prompt）
        → 规划生成策略（_plan_generation_strategy）
        → 并行分发任务（ThreadPoolExecutor, 5个Agent并行）
            → 每个Agent调用 Spark API（_call_llm）
            → 超时控制 120s
        → 内容格式转换（ContentConverterService.convert）
            → mindmap/project/document/recommendation 自动转换
        → 一致性检查（_check_consistency）
            → 知识点覆盖率 40% + 难度对齐 30% + 交叉引用 30%
        → 输出资源包（package_id + resources + consistency_report + metadata）
```

#### 5.1.3 SSE流式交互流程

```
前端发起SSE请求 → EventSource(/api/sse/chat)
    → sse_chat_service 处理
    → 调用 Spark API chat_stream()
    → 逐token推送到前端
    → 前端实时渲染Markdown
```

#### 5.1.4 学习路径规划流程

```
获取学生画像 → 分析知识薄弱点 → LearningPathService
    → 调用Spark API规划路径节点
    → 每个节点关联推荐资源
    → 保存路径到数据库
    → 支持动态调整（基于学习行为反馈）
```

### 5.2 防幻觉与内容安全机制

| 机制 | 实现位置 | 说明 |
|------|----------|------|
| 内容审核评分 | `content_review_service.py` | AI生成内容质量评分 |
| 版本对比 | `content_version.py` | 内容版本管理，支持回滚 |
| 操作日志 | `content_sync_record.py` | 内容变更记录追踪 |
| 一致性检查 | `coordinator_agent.py` | 知识点覆盖+难度对齐+交叉引用三重检查 |
| Token用量监控 | `token_usage.py` | API调用追踪，异常用量告警 |

### 5.3 知识库体系

- **初始知识库**：自行构造的完整高校专业课程（Python课程 + Java课程）
- **种子数据脚本**：`seed_python_course.py` + `seed_java_course.py`
- **知识库服务**：`knowledge_base_service.py` 提供上下文构建、知识点提取
- **知识库验证**：`knowledge_base_validator.py` 确保数据完整性

---

## 6. 开发计划

### 6.1 已完成模块

- [x] 项目基础架构搭建（Flask + React + SQLite）
- [x] 用户认证与权限系统（admin/teacher/student三角色）
- [x] Multi-Agent 多智能体框架（AgentBase + Orchestrator + 7个Agent）
- [x] 对话式学生画像构建（8维度 + 关键词抽取）
- [x] 多智能体协同资源生成（7种资源类型 + 并行生成 + 一致性检查）
- [x] SSE流式对话交互
- [x] 学习路径规划与推荐
- [x] AI辅导系统
- [x] 学习效果评估与成就系统
- [x] 内容审核与版本管理
- [x] 知识库管理
- [x] 编程题评测
- [x] 错题本
- [x] 全链路监控（Prometheus + Grafana + ELK）
- [x] PWA支持
- [x] 前端三端仪表板

### 6.2 待优化/增强项

- [ ] 画像构建增强：引入LLM深度抽取替代纯关键词匹配，提升特征抽取准确度
- [ ] 多模态视频生成：集成SeeDance等多模态生成模型，实现真正的视频/动画生成
- [ ] 代码辅助开发：集成Claude Code等AI编程工具，增强实操案例生成质量
- [ ] 内容安全过滤：增加敏感词过滤和学术事实性校验
- [ ] 性能优化：资源生成响应时间优化，增加缓存策略
- [ ] 测试覆盖：提升单元测试和集成测试覆盖率
- [ ] 文档完善：系统开发说明书、测试说明书

### 6.3 赛题提交物清单

| 提交物 | 要求 | 状态 |
|--------|------|------|
| 演示PPT | 智能体应用价值、AI技术融合、创新价值、核心功能 | ⬜ 待制作 |
| 可运行源码 | 项目源码+数据集+模型部署配置文件 | ✅ 已有 |
| 演示视频 | ≤7分钟，操作流程+核心功能+多模态资源生成+AI技术应用 | ⬜ 待录制 |
| 配套文档 | 系统开发说明书+测试说明书，含架构图/流程图 | ⬜ 待完善 |
| AI Coding工具说明 | 使用说明 | ⬜ 待编写 |

---

## 7. 测试策略

### 7.1 测试分层

| 层级 | 工具 | 范围 | 目标覆盖率 |
|------|------|------|-----------|
| 单元测试 | pytest (后端) / Jest (前端) | Service层核心逻辑、Agent处理逻辑、数据模型 | ≥80% |
| 集成测试 | pytest | API路由端到端、Multi-Agent协同流程、SSE流式 | 关键路径100% |
| E2E测试 | 手动/Playwright | 完整用户流程（画像构建→资源生成→学习路径→评估） | 核心场景 |
| 性能测试 | 手动/Locust | 资源生成响应时间、并发SSE连接、API吞吐 | 响应<30s |

### 7.2 关键测试场景

1. **画像构建**：6轮对话完成8维度画像，特征抽取准确性验证
2. **资源生成**：5个Agent并行生成7种资源，一致性评分>70
3. **SSE流式**：流式输出无断连，Markdown渲染正确
4. **学习路径**：根据画像生成差异化路径，资源推荐与画像匹配
5. **内容安全**：生成内容无敏感信息，事实性错误率<5%
6. **知识库融合**：加载课程知识库后生成资源质量提升

### 7.3 现有测试

- 后端测试：`backend/tests/`（pytest）
- 前端测试：Jest 29 + React Testing Library，覆盖率阈值80%

---

## 8. 项目关键文件索引

### 8.1 后端核心文件

| 文件路径 | 说明 |
|----------|------|
| `backend/src/main.py` | Flask应用入口 |
| `backend/src/config.py` | 应用配置（开发/生产/测试三环境） |
| `backend/src/services/multi_agent/__init__.py` | AgentBase基类 + Orchestrator调度器 |
| `backend/src/services/multi_agent/coordinator_agent.py` | 协调Agent（总调度） |
| `backend/src/services/multi_agent/profile_agent.py` | 画像Agent（对话式画像构建） |
| `backend/src/services/multi_agent/document_agent.py` | 文档Agent |
| `backend/src/services/multi_agent/exercise_agent.py` | 练习Agent |
| `backend/src/services/multi_agent/media_agent.py` | 媒体Agent |
| `backend/src/services/multi_agent/recommendation_agent.py` | 推荐Agent |
| `backend/src/services/multi_agent/project_agent.py` | 项目Agent |
| `backend/src/services/multi_agent/shared_state.py` | 共享状态+消息总线+监控 |
| `backend/src/services/spark_service.py` | Spark星火API调用封装 |
| `backend/src/services/ai_stream_service.py` | AI流式响应服务 |
| `backend/src/services/sse_chat_service.py` | SSE聊天服务 |
| `backend/src/services/learning_path_service.py` | 学习路径服务 |
| `backend/src/services/content_review_service.py` | 内容审核服务 |
| `backend/src/services/knowledge_base_service.py` | 知识库服务 |
| `backend/src/models/student_profile.py` | 学生画像模型 |
| `backend/src/routes/resource_generation.py` | 资源生成API |
| `backend/src/routes/profile_routes.py` | 画像API |
| `backend/src/routes/sse_routes.py` | SSE流式API |

### 8.2 前端核心文件

| 文件路径 | 说明 |
|----------|------|
| `frontend/src/App.jsx` | 应用主入口+路由配置 |
| `frontend/src/components/AIChatPanel.jsx` | AI聊天面板（SSE流式） |
| `frontend/src/components/StudentDashboard.jsx` | 学生仪表板 |
| `frontend/src/components/TeacherDashboard.jsx` | 教师仪表板 |
| `frontend/src/components/AdminDashboard.jsx` | 管理员仪表板 |
| `frontend/src/services/api.js` | 统一API封装 |

### 8.3 配置与部署文件

| 文件路径 | 说明 |
|----------|------|
| `backend/.env` | 环境变量（Spark API密钥、数据库、Redis等） |
| `backend/requirements.txt` | Python依赖 |
| `frontend/package.json` | Node.js依赖 |
| `backend/start_backend.ps1` | Windows启动脚本 |
| `backend/monitoring/` | Prometheus+Grafana+Alertmanager配置 |
| `backend/logging/` | Filebeat+Logstash配置 |

---

## 9. 创新点与差异化优势

### 9.1 架构创新

1. **自研Multi-Agent框架**：AgentBase抽象基类 + Orchestrator调度器 + SharedState共享状态 + MessageBus消息总线 + AgentMonitor监控，形成完整的智能体协同框架
2. **并行生成+一致性保障**：5个Agent并行工作（ThreadPoolExecutor），生成后三重一致性检查（知识点覆盖40%+难度对齐30%+交叉引用30%）
3. **策略驱动的资源生成**：根据学生画像三维度（认知风格+目标导向+学习节奏）动态调整生成策略

### 9.2 交互创新

1. **对话式画像构建**：摒弃传统表单，6轮自然语言对话自动抽取8维度特征
2. **SSE流式输出**：AI响应实时流式呈现，避免长时间白屏等待
3. **多模态内容卡片化展示**：Markdown渲染 + Mermaid思维导图 + 代码高亮 + 视频播放

### 9.3 工程创新

1. **全链路可观测性**：Prometheus指标采集 + Grafana可视化 + ELK日志栈 + Alertmanager告警
2. **Celery异步任务体系**：6个优先级队列 + Beat定时任务（备份/报表/清理/健康检查）
3. **知识库融合生成**：资源生成时自动加载课程知识库上下文，提升生成内容的专业性和准确性
4. **PWA离线支持**：Service Worker缓存，支持安装到桌面

---

## 10. 注意事项与约束

### 10.1 赛题硬性约束

- **AI工具要求**：开发过程中使用的AI辅助工具需选用**科大讯飞相关工具**
- **知识库要求**：需自行构造至少一门完整高校专业课程的初始知识库/文档集
- **多智能体框架**：须明确系统中"多智能体协同框架"
- **开源协议**：使用开源项目需标注名称、来源及相关协议
- **演示视频**：时长≤7分钟

### 10.2 技术约束

- Spark API调用需配置 `SPARK_API_PASSWORD` 环境变量
- 开发环境默认SQLite，生产环境推荐PostgreSQL
- Redis为可选组件（开发环境缓存降级为SimpleCache）
- Elasticsearch为可选组件（默认关闭）

### 10.3 开发注意事项

- 所有Agent通过 `_call_llm()` 统一调用Spark API，支持 `user_id` 和 `user_role` 参数
- 资源生成超时控制为120秒
- 学生画像 `confidence_score` 基于8维度填充率自动计算
- 内容转换服务 `ContentConverterService` 自动处理mindmap/project/document/recommendation格式
- 前端通过Vite代理 `/api` 和 `/uploads` 到后端（开发环境）
