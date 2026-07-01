# 智教星 - 基于大模型的个性化资源生成与学习多智能体系统

> **第十五届中国软件杯大赛 A 组赛题 A3** | 出题企业：科大讯飞股份有限公司
>
> 深度集成讯飞 Spark 星火大模型，采用 Multi-Agent 多智能体架构，以计算机/人工智能专业课程为切入点，实现个性化资源的自动化生成与建设，为学生提供定制化、多模态的学习内容，实现"因材施教"的数字化落地。

---

## 一、比赛背景与项目目标

### 1.1 赛题信息

| 项目 | 内容 |
|---|---|
| **赛题名称** | A3 - 基于大模型的个性化资源生成与学习多智能体系统开发 |
| **赛事** | 第十五届中国软件杯大赛 A 组（本科、研究生、高职） |
| **出题企业** | 科大讯飞股份有限公司 |
| **答疑群** | QQ 群 1072584310 |

### 1.2 问题域

高等教育中学生面临的核心痛点：

1. **资源繁杂无序** — 海量课程资料难以精准匹配自身需求
2. **标准化教学适配不足** — 集体讲授无法兼顾每位学生的学习节奏与特点
3. **缺乏智能个性化指导** — 传统辅助系统缺少多模态生成、多智能体协同等前沿 AI 支撑
4. **知识吸收效率低** — 不同学生在知识基础、学习能力、兴趣方向上差异显著

### 1.3 项目目标

构建多智能体系统，为学生打造专属的个性化资源学习智能体，借助多智能体协作实现智能化、精准化的学习引导。依托高等教育资源，融合多模态生成、代码辅助开发等技术，以计算机/人工智能专业课程为切入点，实现个性化资源的自动化生成与建设，根据学生个体情况提供定制化、多模态的学习内容。

---

## 二、赛题要求与实现映射

### 2.1 基本功能需求（必须实现）

| 编号 | 赛题要求 | 本项目实现 | 实现位置 |
|---|---|---|---|
| **F1** | 对话式学习画像自主构建（≥6 维度，随学随新） | ✅ 已实现 **8 维度**动态画像，自然语言对话抽取特征 | [profile_agent.py](file:///c:/Users/33552/Desktop/project_code/backend/src/services/multi_agent/profile_agent.py) |
| **F2** | 多智能体协同资源生成（≥5 种类型） | ✅ 已实现 **7 种资源类型**，8 个智能体协作 | [coordinator_agent.py](file:///c:/Users/33552/Desktop/project_code/backend/src/services/multi_agent/coordinator_agent.py) |
| **F3** | 个性化学习路径规划与资源推送 | ✅ 动态学习路径 + 多类型资源精准推送 | [learning_path_routes.py](file:///c:/Users/33552/Desktop/project_code/backend/src/routes/learning_path_routes.py) |
| **F4** | 智能辅导（可选加分） | ✅ 多模态答疑：文字 + 图解 + SSE 流式 | [ai_assistant.py](file:///c:/Users/33552/Desktop/project_code/backend/src/routes/ai_assistant.py) |
| **F5** | 学习效果评估（可选加分） | ✅ 多维度评估 + 动态调整推送策略 | [ai_analysis.py](file:///c:/Users/33552/Desktop/project_code/backend/src/routes/ai_analysis.py) |

### 2.2 非功能性需求

| 编号 | 赛题要求 | 本项目实现 |
|---|---|---|
| **NF1** | 界面美观、交互清晰（流式输出、Markdown 渲染、多模态卡片化展示） | React 19 + shadcn/ui + SSE 流式 + Mermaid 渲染 + Framer Motion 动画 |
| **NF2** | 标注开源项目、AI 工具/框架名称、来源及协议 | 见 [第八章：开源项目与 AI 工具声明](#八开源项目与-ai-工具声明) |
| **NF3** | 防幻觉与内容安全过滤机制 | [content_review_service.py](file:///c:/Users/33552/Desktop/project_code/backend/src/services/content_review_service.py) 质量评分 + 版本对比 |
| **NF4** | 响应时间合理，提供生成进度追踪或流式呈现 | SSE 流式输出 + [shared_state.py](file:///c:/Users/33552/Desktop/project_code/backend/src/services/multi_agent/shared_state.py) 进度追踪 + ThreadPoolExecutor 并行生成 |

### 2.3 学生画像维度（8 维度，超出赛题 6 维度要求）

| 维度 | 说明 |
|---|---|
| 知识基础 | 专业方向、已掌握领域及掌握程度 (0-100)、薄弱领域 |
| 认知风格 | visual / auditory / kinesthetic / reading / mixed |
| 易错点模式 | 知识点、错误类型（概念/计算/思路/遗忘/其他）、频率 |
| 学习节奏 | fast / moderate / slow / adaptive |
| 兴趣领域 | 领域名称、权重 (0-1) |
| 目标导向 | exam / career / hobby / research |
| 时间可用性 | 每日/每周可用学习时间 |
| 互动偏好 | guided / exploratory / challenging |

### 2.4 多模态资源类型（7 种，超出赛题 5 种要求）

| 资源类型 | 生成 Agent | 对应赛题要求 |
|---|---|---|
| 专业课程讲解文档 | DocumentAgent | 专业课程讲解文档 |
| 知识点思维导图 | DocumentAgent | 知识点思维导图 |
| 不同类型练习题目 | ExerciseAgent | 不同类型练习题目 |
| 拓展阅读材料 | RecommendationAgent | 拓展阅读材料 |
| 多模态教学视频/动画 | MediaAgent | 多模态教学视频/动画 |
| 代码实操案例 | ProjectAgent | 代码类实操案例 |
| 实践项目学习材料 | ProjectAgent | 实践项目学习材料 |

---

## 三、核心功能

### 3.1 Multi-Agent 多智能体架构

```
                    ┌─────────────────┐
                    │  Coordinator    │  协调 Agent（总调度）
                    │  Agent          │
                    └────────┬────────┘
                             │
          ┌──────────┬───────┼───────┬──────────┐
          ▼          ▼       ▼       ▼          ▼
    ┌──────────┐┌────────┐┌──────┐┌──────┐┌──────────┐
    │ Document ││Exercise││Media ││Profile││Recommend │
    │ Agent    ││ Agent  ││Agent ││Agent ││ Agent    │
    │ 文档生成 ││ 题目生成││多媒体││学生画像││ 资源推荐  │
    └──────────┘└────────┘└──────┘└──────┘└──────────┘
                                         ┌──────┐
                                         │Knowledge│
                                         │Graph   │
                                         │图谱生成│
                                         └──────┘
```

### 3.2 功能模块总览

#### 管理员平台

| 功能 | 说明 |
|---|---|
| 用户管理 | 添加/删除用户、角色分配、用户统计、权限控制 |
| 课程管理 | 创建/管理课程、课程分类、状态跟踪、教师分配 |
| 班级管理 | 班级创建、学生分配、班级信息维护 |
| 数据分析 | 用户增长趋势、课程活跃度、学习进度、多维度统计图表 |
| 系统设置 | 基础配置、功能开关、AI 模型配置、安全设置 |

#### 教师平台

| 功能 | 说明 |
|---|---|
| 课程管理 | 创建课程、学生管理、进度跟踪、课程资源上传 |
| 知识图谱管理 | Word/PDF 上传 → AI 解析 → 3D 可视化图谱 → 关系推理 |
| AI 内容生成 | Multi-Agent 协同生成学习目标、知识要点、代码示例、练习题 |
| 教案管理 | AI 智能生成教案、教案版本控制、内容优化 |
| 视频课程 | 视频上传、流式播放（支持 Range 请求）、视频管理 |
| 考核管理 | AI 智能出题、编程题评测、考试管理、成绩统计 |
| 学情分析 | AI 学习分析报告、成绩分布、学习进度追踪 |
| 师生互动 | 实时问答、讨论区管理、举手响应、作业批改 |
| AI 内容审核 | AI 生成内容质量评分、版本对比、操作日志 |

#### 学生平台

| 功能 | 说明 |
|---|---|
| 我的课程 | 课程列表、学习进度、继续学习、任务完成跟踪 |
| 3D 知识图谱 | 交互式 3D 图谱、节点展开/聚焦、学习路径高亮 |
| AI 学习助手 | SSE 流式对话、多轮对话管理、个性化学习建议 |
| 练习评测 | AI 智能评测、编程题提交与评测、详细解析、错题本 |
| 错题本 | 错题分类统计、AI 智能分析、知识图谱、针对性练习 |
| 学习路径 | AI 规划个性化学习路径、节点追踪、资源推荐 |
| 学习笔记 | 富文本笔记、视频笔记、笔记管理 |
| 成就系统 | 学习成就解锁、成就展示、学习激励 |
| 学生画像 | AI 构建学习画像、多维度能力评估、画像对话 |
| 学习进度 | 学习时长、完成任务、成绩趋势、数据可视化 |
| 互动学习 | 向老师提问、参与讨论、查看通知、接收反馈 |

### 3.3 3D 知识图谱系统

| 能力 | 技术实现 |
|---|---|
| 文档上传解析 | 支持 Word（.docx）、PDF（.pdf）智能解析，自动提取章节、知识点、描述 |
| 节点生成 | 8 种节点类型（课程、章节、知识点、目标、技能、案例、练习、资源） |
| 关系推理 | LLM 跨章节推理 + Jaccard 关键词共现 + 语义关系推断，支持 7 种边类型 |
| 3D 可视化 | Three.js + React Three Fiber + drei，支持拖拽旋转、缩放平移、节点点击、相机聚焦动画 |
| 学习路径 | prerequisite 边自动生成可视化学习路径，金色虚线动画高亮 |
| 难度识别 | 节点难度环（入门/进阶/高级），绿色/金色/红色外环提示 |
| 性能优化 | 节点 > 150 自动降精度几何体，力导向布局，自适应迭代 |

#### 边类型系统

| 边类型 | 用途 | 颜色 |
|---|---|---|
| `contains` | 层级包含关系（课程→章节→知识点） | 绿色 |
| `prerequisite` | 学习前置依赖（A 需先学习 B） | 红色 |
| `related` | 语义关联（关键词共现） | 蓝色 |
| `supports_objective` | 支撑课程目标 | 金色 |
| `applies_to` | 知识点应用场景 | 紫色 |
| `assesses` | 评估/考核 | 青色 |
| `recommended_after` | 建议学习顺序 | 橙色 |

#### 关系推理引擎三层架构

```
┌────────────────────────────────────────────────────────┐
│               知识图谱推理引擎                           │
├────────────────────────────────────────────────────────┤
│ 第一层：LLM 跨章节推理                                  │
│  └─ 识别章节间概念依赖、跨章节关联、核心概念提取        │
├────────────────────────────────────────────────────────┤
│ 第二层：关键词共现推理                                  │
│  └─ Jaccard 相似度 ≥ 0.15 且共同关键词 ≥ 2 建边         │
├────────────────────────────────────────────────────────┤
│ 第三层：语义关系推理                                    │
│  └─ 实践类节点 ↔ 核心知识点 applies_to 关联             │
└────────────────────────────────────────────────────────┘
```

---

## 四、技术架构

### 4.1 前端技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| React | 19.1 | UI 框架 |
| Vite | 6.3 | 构建工具 |
| Tailwind CSS | 4.1 | 原子化 CSS |
| shadcn/ui | Latest | UI 组件库 (Radix) |
| React Three Fiber | 8.17 | 3D 渲染框架 |
| @react-three/drei | 9.114 | 3D 辅助组件 |
| Three.js | 0.184 | 3D 引擎 |
| React Router | 7.6 | 路由管理（懒加载） |
| Recharts | 2.15 | 数据可视化 |
| Socket.IO Client | 4.8 | WebSocket 实时通信 |
| Tiptap | 2.4 | 富文本编辑器 |
| CodeMirror | 6.x | 代码编辑器 |
| Framer Motion | 12.15 | 动画库 |

### 4.2 后端技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| Flask | 2.3.3 | Web 框架 |
| Python | 3.14 | 编程语言 |
| Flask-SQLAlchemy | 3.1.1 | ORM 框架 |
| Flask-SocketIO | 5.3.6 | WebSocket 支持 |
| PyMuPDF | Latest | PDF 文档解析（知识图谱） |
| python-docx | 1.1 | Word 文档解析 |
| Celery | 5.3.4 | 异步任务队列 |
| Redis | 5.0.1 | 缓存/消息队列 |
| Spark API | Ultra | 讯飞星火大模型 |
| Prometheus Client | 0.19 | 指标采集 |

### 4.3 系统架构

```
┌──────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│     前端层        │      │       后端层          │      │     数据层        │
│   React 19        │ HTTP │   Flask 2.3.3        │ SQL  │   SQLite/PG      │
│   Vite 6          │ SSE  │   Celery 5.3.4       │ Redis│   Redis 5.0      │
│   Tailwind 4      │ WS   │   Multi-Agent        │ ES   │   Elasticsearch  │
│   shadcn/ui       │─────▶│   Spark API          │─────▶│                  │
│   @react-three/fiber│      │   3D 图谱 API         │      │ 知识图谱节点/边存储 │
│   PWA             │      │   PyMuPDF 解析       │      │                  │
└──────────────────┘      └──────────────────────┘      └──────────────────┘
                               │           │
                    ┌──────────┘           └──────────┐
                    ▼                                 ▼
          ┌──────────────────┐           ┌──────────────────┐
          │    监控 & 日志     │           │    任务调度        │
          │ Prometheus       │           │ Celery Beat      │
          │ Grafana          │           │ 定时备份/报表/清理  │
          │ ELK Stack        │           │ 6 个优先级队列     │
          └──────────────────┘           └──────────────────┘
```

### 4.4 知识图谱数据模型

```
┌─────────────────────────────────────────────────────────────────┐
│   知识图谱实体（Knowledge Graph）                               │
├─────────────────────────────────────────────────────────────────┤
│   KnowledgeGraphNode（节点）                                    │
│   ├── id                      · 节点 UUID                       │
│   ├── course_id               · 所属课程 ID                     │
│   ├── node_type               · 8 种节点类型                    │
│   │                            course/chapter/knowledge_point   │
│   │                            objective/skill/case/           │
│   │                            exercise/resource               │
│   ├── name/label              · 名称/标签                       │
│   ├── description             · 详细描述                        │
│   ├── category                · 分类（核心知识点/基础概念等）   │
│   ├── properties              · JSON 扩展字段（难度等）         │
│   ├── source_chunk_ids        · 来源片段 ID                     │
│   └── created_at/updated_at                                     │
├─────────────────────────────────────────────────────────────────┤
│   KnowledgeGraphEdge（边）                                      │
│   ├── id/source_node_id/target_node_id                          │
│   ├── edge_type               · 7 种关系类型                    │
│   ├── weight/confidence       · 权重/置信度                     │
│   └── source_chunk_ids                                          │
├─────────────────────────────────────────────────────────────────┤
│   KnowledgeSourceChunk（来源片段）                              │
│   ├── course_id / source_type（syllabus/text/docx/pdf）         │
│   ├── chunk_text              · 内容片段                        │
│   ├── position                · 原始位置                        │
│   └── metadata                · JSON 元数据                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 五、快速开始

### 5.1 环境要求

- **Python**: 3.11 或更高版本
- **Node.js**: 18 或更高版本
- **包管理器**: pnpm（推荐）或 npm
- **Redis**: 5.0+（用于 Celery 任务队列和缓存，可选）
- **Elasticsearch**: 8.11+（搜索引擎，可选）

### 5.2 后端启动

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入 Spark API 密钥等配置

# 启动后端服务
python src/main.py
```

后端将在 http://localhost:5000 启动（支持 threaded 模式，兼容 SSE 流式响应）

### 5.3 前端启动

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev
```

前端将在 http://localhost:5173 启动（自动代理 /api 和 /uploads 到后端）

### 5.4 访问系统

打开浏览器访问：http://localhost:5173

**默认测试账号**：

| 角色 | 用户名 | 密码 |
|---|---|---|
| 管理员 | `admin` | `admin123` |
| 教师 | `teacher` | `teacher123` |
| 学生 | `student` | `student123` |

### 5.5 快速体验核心功能

1. 使用**教师账号**登录 → 进入「知识图谱」模块
2. 点击「上传大纲文件」，选择 `.docx` 或 `.pdf` 文件
3. 系统自动解析 → 提取章节、知识点、关联关系
4. 自动生成 3D 知识图谱（节点 + 连线 + 关系推理）
5. 切换到**学生账号** → 在侧边栏「知识图谱」模块可视化查看
6. 使用**学生账号** → 进入「AI 助教」体验对话式学习画像构建

---

## 六、项目结构

```
project_code/
├── backend/                        # 后端代码
│   ├── src/
│   │   ├── routes/                # API 路由（25+ 模块）
│   │   │   ├── auth.py            # 认证（登录/注册/登出）
│   │   │   ├── knowledge_graph_routes.py # 知识图谱 API
│   │   │   ├── admin.py           # 管理员后台
│   │   │   ├── teacher.py         # 教师功能
│   │   │   ├── student.py         # 学生功能
│   │   │   ├── course.py          # 课程管理
│   │   │   ├── ai_assistant.py    # AI 助手
│   │   │   ├── ai_analysis.py     # AI 分析报告
│   │   │   ├── learning_path_routes.py # 学习路径
│   │   │   ├── programming.py     # 编程题评测
│   │   │   └── ...                # 更多路由
│   │   ├── services/              # 业务服务层（25+ 个）
│   │   │   ├── spark_service.py   # 星火 API 调用
│   │   │   ├── syllabus_graph_service.py # 3D 知识图谱构建
│   │   │   ├── multi_agent/       # Multi-Agent 子系统
│   │   │   │   ├── coordinator_agent.py  # 协调 Agent
│   │   │   │   ├── document_agent.py     # 文档 Agent
│   │   │   │   ├── exercise_agent.py     # 练习 Agent
│   │   │   │   ├── media_agent.py        # 媒体 Agent
│   │   │   │   ├── profile_agent.py      # 画像 Agent
│   │   │   │   ├── project_agent.py      # 项目 Agent
│   │   │   │   ├── recommendation_agent.py # 推荐 Agent
│   │   │   │   ├── knowledge_graph_agent.py # 知识图谱 Agent
│   │   │   │   └── shared_state.py       # 共享状态
│   │   │   └── ...                # 更多服务
│   │   ├── models/                # 数据模型（8+ 模块）
│   │   │   ├── user.py            # 用户模型
│   │   │   ├── course.py          # 课程/内容/评测/视频/进度
│   │   │   ├── knowledge_base.py  # 知识图谱节点/边/来源
│   │   │   ├── student_profile.py # 学生画像
│   │   │   └── ...                # 更多模型
│   │   ├── tasks/                 # Celery 异步任务
│   │   └── main.py                # 应用入口
│   ├── requirements.txt           # Python 依赖
│   └── start_backend.ps1          # Windows 启动脚本
│
├── frontend/                       # 前端代码
│   ├── src/
│   │   ├── components/            # React 组件
│   │   │   ├── ui/                # 基础 UI 组件（40+ 个，shadcn/ui）
│   │   │   ├── KnowledgeGraph3D/  # 3D 知识图谱可视化组
│   │   │   │   ├── KnowledgeGraphScene.jsx # 3D 场景
│   │   │   │   ├── KnowledgeGraph3D.jsx   # 学生端图谱面板
│   │   │   │   ├── NodeDetailPanel.jsx    # 节点详情面板
│   │   │   │   └── GraphToolbar.jsx       # 工具栏
│   │   │   ├── KnowledgeGraphManager.jsx  # 教师端图谱管理
│   │   │   ├── AITutor/           # AI 助教组件
│   │   │   ├── MistakeBook/       # 错题本组件组
│   │   │   └── ...                # 更多组件
│   │   ├── services/              # API 服务层
│   │   ├── hooks/                 # 自定义 Hooks
│   │   └── router/                # 路由配置（懒加载）
│   ├── package.json               # Node.js 依赖
│   └── vite.config.js             # Vite 构建配置
│
├── docs/                            # 设计文档
│   └── plans/
│       └── 2026-06-11-knowledge-graph-rag-citation.md
│
├── README.md                       # 项目说明（本文件）
├── agent.md                        # AI Agent 架构与实现指南
└── 智教星项目开发文档.docx         # 开发文档
```

---

## 七、配置说明

### 7.1 后端环境变量（`backend/.env`）

```bash
# Spark 星火大模型 API 配置（科大讯飞）
SPARK_API_PASSWORD=your_api_password_here
SPARK_API_URL=https://spark-api-open.xf-yun.com/v1/chat/completions
SPARK_MODEL=lite

# 数据库配置（开发环境使用 SQLite）
DATABASE_URL=sqlite:///instance/dev.db

# Flask 配置
SECRET_KEY=your-secret-key-change-this-in-production
FLASK_ENV=development

# Redis 配置（Celery 任务队列 & 缓存）
REDIS_URL=redis://localhost:6379/0

# Elasticsearch 配置（可选）
ELASTICSEARCH_ENABLED=false
```

### 7.2 前端环境变量（`frontend/.env.development`）

```bash
VITE_API_BASE_URL=/api
VITE_APP_ENV=development
VITE_DEBUG=true
VITE_API_TIMEOUT=30000
```

### 7.3 知识图谱 API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/knowledge-graph/courses/<id>/import-syllabus` | 上传 Word/PDF 并解析为图谱 |
| GET | `/api/knowledge-graph/courses/<id>` | 获取课程知识图谱数据 |
| DELETE | `/api/knowledge-graph/courses/<id>` | 彻底清除课程知识图谱 |
| GET | `/api/knowledge-graph/courses/<id>/profile` | 获取课程知识图谱分析报告 |

---

## 八、开源项目与 AI 工具声明

> 依据赛题非功能性需求 NF2 要求，此处标注系统使用的开源项目、AI 工具/框架名称、来源及相关协议。

### 8.1 AI 工具与模型

| 工具 | 用途 | 来源 | 协议/类型 |
|---|---|---|---|
| 讯飞 Spark 星火大模型 | 核心AI能力（对话、生成、分析） | [科大讯飞](https://www.xfyun.cn/) | 商业 API（赛题要求） |
| Claude Code / Trae | AI 辅助编程开发 | Anthropic / 字节跳动 | 商业工具 |

### 8.2 前端开源项目

| 项目 | 用途 | 来源 | 协议 |
|---|---|---|---|
| [React](https://react.dev/) | UI 框架 | Meta | MIT |
| [Vite](https://vitejs.dev/) | 构建工具 | Evan You | MIT |
| [Tailwind CSS](https://tailwindcss.com/) | 样式框架 | Tailwind Labs | MIT |
| [shadcn/ui](https://ui.shadcn.com/) | UI 组件库 | shadcn | MIT |
| [Three.js](https://threejs.org/) | 3D 渲染引擎 | Mr.doob | MIT |
| [React Three Fiber](https://r3f.docs.pmnd.rs/) | Three.js React 集成 | pmndrs | MIT |
| [@react-three/drei](https://github.com/pmndrs/drei) | 3D 辅助组件库 | pmndrs | MIT |
| [Recharts](https://recharts.org/) | 数据可视化 | Recharts | MIT |
| [Socket.IO](https://socket.io/) | WebSocket 通信 | Socket.IO | MIT |
| [Tiptap](https://tiptap.dev/) | 富文本编辑器 | Tiptap | MIT |
| [CodeMirror](https://codemirror.net/) | 代码编辑器 | CodeMirror | MIT |
| [Framer Motion](https://www.framer.com/motion/) | 动画库 | Framer | MIT |

### 8.3 后端开源项目

| 项目 | 用途 | 来源 | 协议 |
|---|---|---|---|
| [Flask](https://flask.palletsprojects.com/) | Web 框架 | Pallets | BSD-3-Clause |
| [SQLAlchemy](https://www.sqlalchemy.org/) | ORM 框架 | SQLAlchemy | MIT |
| [Celery](https://docs.celeryq.dev/) | 任务队列 | Celery Project | BSD-3-Clause |
| [Redis](https://redis.io/) | 缓存/消息队列 | Redis Labs | RSAL |
| [PyMuPDF](https://pymupdf.readthedocs.io/) | PDF 解析 | Artifex | AGPL-3.0 |
| [python-docx](https://python-docx.readthedocs.io/) | Word 解析 | Steve Canny | MIT |
| [Prometheus](https://prometheus.io/) | 监控系统 | CNCF | Apache-2.0 |
| [Grafana](https://grafana.com/) | 可视化 | Grafana Labs | AGPL-3.0 |
| [Elasticsearch](https://www.elastic.co/) | 搜索引擎 | Elastic | SSPL |

---

## 九、提交规范

### 9.1 初赛作品提交清单

依据赛题「初赛作品提交要求」，提交内容如下：

| 序号 | 提交项 | 要求 | 状态 |
|---|---|---|---|
| 1 | **演示 PPT** | 清晰展示智能体应用价值、前沿AI技术融合思路与实现方法、创新价值、核心功能 | 待提交 |
| 2 | **可完整运行的项目文件** | 包含项目源码、数据集、模型部署配置文件，文件整理规范，可在常规环境下正常运行 | 待提交 |
| 3 | **演示视频** | 时长 ≤ 7 分钟，清晰展示操作流程、核心功能、多模态资源生成效果及前沿AI技术应用成果 | 待提交 |
| 4 | **配套文档** | 系统开发说明书、测试说明书，格式统一、内容完整 | 待提交 |
| 5 | **AI Coding 工具说明** | 如使用 AI Coding 工具，给出相关说明 | 待提交 |

### 9.2 提交文件组织结构

```
智教星_提交包/
├── 源代码/
│   ├── backend/                    # 后端源码
│   │   ├── src/                    # 源代码
│   │   ├── requirements.txt        # Python 依赖清单
│   │   ├── .env.example            # 配置模板（不含真实密钥）
│   │   └── start_backend.ps1       # 启动脚本
│   ├── frontend/                   # 前端源码
│   │   ├── src/                    # 源代码
│   │   ├── package.json            # Node.js 依赖清单
│   │   ├── pnpm-lock.yaml          # 依赖版本锁定
│   │   └── vite.config.js          # 构建配置
│   └── README.md                   # 项目说明（本文件）
│
├── 文档/
│   ├── 智教星项目开发文档.docx      # 系统开发说明书
│   ├── 智教星答辩文档_完整版.docx   # 答辩文档
│   ├── 测试说明书.docx              # 测试说明书
│   └── AI_Coding工具使用说明.md     # AI Coding 工具说明
│
├── 演示材料/
│   ├── 智教星演示PPT.pptx           # 演示 PPT
│   └── 智教星演示视频.mp4           # 演示视频（≤ 7 分钟）
│
└── 数据/
    └── 课程知识库/                  # 自行构造的专业课程初始知识库
        ├── Python程序设计大纲.docx
        └── 人工智能基础大纲.pdf
```

### 9.3 不提交的内容

以下内容**不提交**，评委可通过依赖清单自动恢复：

| 排除目录 | 原因 | 恢复方式 |
|---|---|---|
| `frontend/node_modules/` | npm 依赖，体积过大（858 MB） | `pnpm install` |
| `backend/venv/` | Python 虚拟环境 | `python -m venv venv && pip install -r requirements.txt` |
| `backend/instance/` | 本地 SQLite 数据库 | 启动后端自动创建 |
| `backend/uploads/` | 用户上传的测试文件 | 非源码 |
| `backend/__pycache__/` | Python 缓存 | 自动生成 |

### 9.4 评委运行指南

```bash
# 1. 后端启动
cd 源代码/backend
python -m venv venv
.\venv\Scripts\Activate.ps1         # Windows
pip install -r requirements.txt
cp .env.example .env                # 配置 Spark API 密钥
python src/main.py

# 2. 前端启动
cd 源代码/frontend
pnpm install
pnpm run dev

# 3. 访问系统
# 打开 http://localhost:5173
# 使用默认账号登录（见 5.4 节）
```

---

## 十、评分标准与自评

### 10.1 评分项与占比

| 评分项 | 占比 | 本项目对应策略 |
|---|---|---|
| **创新价值与实用性** | 35% | Multi-Agent 协同架构 + 对话式画像（8 维度）+ 多模态资源生成（7 种）+ 3D 知识图谱可视化 |
| **功能实现及技术要求** | 45% | 8 个智能体协作 + SSE 流式输出 + 知识图谱关系推理引擎 + 防幻觉内容审核 + 全链路监控 |
| **配套文档的丰富度** | 10% | 系统开发说明书 + 测试说明书 + 架构图 + 流程图 + API 文档 |
| **演示视频、PPT 效果** | 10% | 7 分钟演示视频 + 逻辑清晰的 PPT |

### 10.2 赛题功能自评矩阵

| 赛题要求 | 要求值 | 实现值 | 达标 |
|---|---|---|---|
| 学生画像维度 | ≥ 6 | 8 | ✅ 超出 |
| 多模态资源类型 | ≥ 5 | 7 | ✅ 超出 |
| 多智能体角色 | 明确框架 | 8 个 Agent | ✅ 达标 |
| 大模型工具 | 科大讯飞 | Spark 星火 Ultra | ✅ 达标 |
| 界面交互规范 | 流式/Markdown/卡片 | SSE + Mermaid + shadcn/ui | ✅ 达标 |
| 防幻觉机制 | 内容安全过滤 | AI 内容审核 + 质量评分 | ✅ 达标 |
| 响应时间 | 合理范围 | SSE 流式 + 并行生成 + 进度追踪 | ✅ 达标 |
| 开源标注 | 显著位置 | README 第八章 | ✅ 达标 |

---

## 十一、3D 知识图谱使用指南

### 11.1 教师端：上传文档生成图谱

1. 教师登录后，在侧边栏选择「知识图谱」
2. 选择目标课程后点击「上传知识点文件」
3. 选择 Word（.docx）或 PDF（.pdf）文件
4. 系统自动解析并展示生成过程：
   - 解析章节层级
   - 提取知识点（含描述/难度/分类）
   - 关系推理引擎自动建立跨章节关联
5. 生成完成后可在右侧 3D 可视化区域查看
6. 支持删除现有图谱重新上传

### 11.2 学生端：交互式 3D 图谱浏览

1. 学生登录后，在侧边栏选择「知识图谱」
2. 选择课程查看该课程的知识图谱
3. 交互方式：

| 操作 | 说明 |
|---|---|
| 鼠标拖拽 | 3D 场景自由旋转 |
| 滚轮 | 缩放图谱远近 |
| 右键平移 | 平移视角 |
| 单击节点 | 查看节点详情面板（展示节点信息/关联关系/邻居节点） |
| 双击节点 | 展开节点，相机聚焦，节点放大显示 |

4. 筛选工具栏：按节点类型筛选、选择学习路径可视化、查看图谱统计信息

---

## 十二、常见问题

### Q1: 如何配置 Spark API？

在 `backend/.env` 文件中配置：

```bash
SPARK_API_PASSWORD=your_api_password
```

### Q2: 知识图谱支持哪些文件格式？

| 格式 | 解析库 | 说明 |
|---|---|---|
| .docx | python-docx 1.1+ | 基于 XML 解析 |
| .pdf | PyMuPDF (fitz) | 支持多页 PDF，文字层解析 |

上传文件大小不超过 20MB。

### Q3: 如何清除已上传的知识图谱？

在教师端「知识图谱」模块选择课程后，点击「清除图谱」按钮即可彻底删除该课程的所有知识图谱数据。

### Q4: 数据库在哪里？

开发环境默认使用 SQLite，数据库文件在 `backend/instance/dev.db`。生产环境推荐切换为 PostgreSQL。

### Q5: 前端无法连接后端？

1. 检查后端是否在 `localhost:5000` 运行
2. 确认 `frontend/.env.development` 中 `VITE_API_BASE_URL=/api`
3. Vite 代理配置在 `vite.config.js` 中已预设

### Q6: Redis 未安装会影响使用吗？

Redis 主要用于 Celery 任务队列和生产环境缓存。开发环境下缓存会自动降级为 SimpleCache，但异步任务需要 Redis。

### Q7: 3D 知识图谱渲染很慢怎么办？

1. 检查显卡驱动是否开启硬件加速
2. 浏览器建议使用 Chrome/Edge 最新版
3. 节点数超过 150 会自动降低渲染精度
4. 确保浏览器的 WebGL 已启用（可通过 `chrome://gpu` 检查）

---

## 十三、测试与开发

### 13.1 运行测试

```bash
# 后端测试
cd backend
pytest

# 前端测试
cd frontend
pnpm test
```

### 13.2 构建生产版本

```bash
cd frontend
pnpm build
# 构建产物在 dist/ 目录（含 PWA 的 service-worker.js）
```

### 13.3 配置检查

```bash
python backend/check_config.py
```

---

## 十四、相关文档

| 文档 | 说明 |
|---|---|
| [agent.md](agent.md) | AI Agent 架构与实现指南 |
| [知识图谱设计文档](docs/plans/2026-06-11-knowledge-graph-rag-citation.md) | 知识图谱设计文档 |
| 智教星项目开发文档.docx | 完整开发文档 |
| 智教星答辩文档_完整版.docx | 答辩演示文档 |

---

## 十五、Multi-Agent 架构详解

### 15.1 智能体清单

| Agent | agent_name | 职责 | 核心能力 |
|-------|-----------|------|----------|
| CoordinatorAgent | coordinator | 总调度中心 | 任务分发、策略规划、一致性检查、资源整合、知识库加载 |
| ProfileAgent | profiler | 学生画像构建 | 对话式画像构建、6+维度特征抽取、画像更新、摘要生成 |
| DocumentAgent | document_agent | 文档生成 | 课程讲解文档、知识点思维导图 |
| ExerciseAgent | exercise_agent | 题目生成 | 选择题/填空题/编程题/分层练习 |
| MediaAgent | media_agent | 多媒体生成 | 视频脚本、动画描述、视频资源 |
| RecommendationAgent | recommendation_agent | 资源推荐 | 论文/博客/教程/视频/书籍推荐 |
| ProjectAgent | project_agent | 项目设计 | 代码实操案例、实践项目学习材料 |

### 15.2 协同工作机制

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
                ├── 6. 一致性检查（知识点覆盖40%+难度对齐30%+交叉引用30%）
                └── 7. 整合输出资源包（package_id + metadata + completeness_report）
```

### 15.3 共享状态与通信

- **SharedState**：智能体间共享数据（包状态、策略、结果），基于内存字典
- **MessageBus**：智能体间消息传递，支持日志记录
- **AgentMonitor**：智能体状态监控（IDLE/RUNNING/SUCCESS/FAILED），提供系统摘要

### 15.4 资源生成策略

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

---

## 十六、核心数据模型

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

---

## 十七、创新点与差异化优势

### 17.1 架构创新

1. **自研Multi-Agent框架**：AgentBase抽象基类 + Orchestrator调度器 + SharedState共享状态 + MessageBus消息总线 + AgentMonitor监控，形成完整的智能体协同框架
2. **并行生成+一致性保障**：5个Agent并行工作（ThreadPoolExecutor），生成后三重一致性检查（知识点覆盖40%+难度对齐30%+交叉引用30%）
3. **策略驱动的资源生成**：根据学生画像三维度（认知风格+目标导向+学习节奏）动态调整生成策略

### 17.2 交互创新

1. **对话式画像构建**：摒弃传统表单，6轮自然语言对话自动抽取8维度特征
2. **SSE流式输出**：AI响应实时流式呈现，避免长时间白屏等待
3. **多模态内容卡片化展示**：Markdown渲染 + Mermaid思维导图 + 代码高亮 + 视频播放

### 17.3 工程创新

1. **全链路可观测性**：Prometheus指标采集 + Grafana可视化 + ELK日志栈 + Alertmanager告警
2. **Celery异步任务体系**：6个优先级队列 + Beat定时任务（备份/报表/清理/健康检查）
3. **知识库融合生成**：资源生成时自动加载课程知识库上下文，提升生成内容的专业性和准确性
4. **PWA离线支持**：Service Worker缓存，支持安装到桌面

---

## 十八、注意事项与约束

### 18.1 赛题硬性约束

- **AI工具要求**：开发过程中使用的AI辅助工具需选用**科大讯飞相关工具**
- **知识库要求**：需自行构造至少一门完整高校专业课程的初始知识库/文档集
- **多智能体框架**：须明确系统中"多智能体协同框架"
- **开源协议**：使用开源项目需标注名称、来源及相关协议
- **演示视频**：时长≤7分钟

### 18.2 技术约束

- Spark API调用需配置 `SPARK_API_PASSWORD` 环境变量
- 开发环境默认SQLite，生产环境推荐PostgreSQL
- Redis为可选组件（开发环境缓存降级为SimpleCache）
- Elasticsearch为可选组件（默认关闭）

### 18.3 开发注意事项

- 所有Agent通过 `_call_llm()` 统一调用Spark API，支持 `user_id` 和 `user_role` 参数
- 资源生成超时控制为120秒
- 学生画像 `confidence_score` 基于8维度填充率自动计算
- 内容转换服务 `ContentConverterService` 自动处理mindmap/project/document/recommendation格式
- 前端通过Vite代理 `/api` 和 `/uploads` 到后端（开发环境）

---

## 十九、团队信息

**项目名称**：智教星 - 基于大模型的个性化资源生成与学习多智能体系统

**赛题编号**：A3

**技术栈**：React 19 + Flask 2.3 + Spark 星火大模型 + Multi-Agent + Three.js 3D 知识图谱

**适用场景**：在线教育系统、智慧课堂、企业培训平台、个性化学习系统、编程教学与评测、知识图谱辅助教学

**项目规模**：约 97,000+ 行源代码（前端 500+ 组件文件，后端 25+ 路由模块 / 25+ 服务模块）

---

**祝使用愉快！**
