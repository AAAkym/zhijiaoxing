# 🌟 智教星 - 智能教学管理平台

> 基于 Spark 星火大模型的 AI 驱动教学解决方案，集成 Multi-Agent 架构与全链路智能教学能力

<br />

---

## 📖 项目简介

**智教星**是一款功能完整的智能教学管理平台，深度集成**讯飞 Spark 星火大模型**，采用创新的 **Multi-Agent 多智能体架构**，为管理员、教师和学生提供全方位的 AI 辅助教学服务。系统采用前后端分离架构，支持 SSE 流式交互、WebSocket 实时通信、数据可视化分析和智能内容生成，助力教育数字化转型。

### 🎯 核心亮点

- 🤖 **Multi-Agent 架构** - 8 个专业智能体协同工作（协调、文档、练习、媒体、画像、项目、推荐）
- 🧠 **AI 深度集成** - Spark 星火大模型驱动，智能生成教学内容、答疑解惑、学情分析
- 👥 **三端完整** - 管理员、教师、学生平台功能齐全，覆盖教学全流程
- ⚡ **实时互动** - SSE 流式响应 + WebSocket 双向通信，师生互动零延迟
- 📊 **数据驱动** - 丰富的可视化图表，多维度学情分析与 AI 智能诊断
- 🎨 **现代 UI** - React 19 + Tailwind CSS 4 + shadcn/ui，响应式设计
- 📱 **PWA 支持** - Service Worker 离线缓存，支持安装到桌面
- 📝 **富内容编辑** - Tiptap 富文本编辑器 + CodeMirror 代码编辑器
- 📈 **全链路监控** - Prometheus + Grafana + ELK 日志栈，告警与指标一目了然
- 🔒 **安全可靠** - 完善的权限控制、数据加密保护、内容版本管理

---

## 🚀 快速开始

### 环境要求

- **Python**: 3.11 或更高版本（开发环境使用 3.14）
- **Node.js**: 18 或更高版本
- **包管理器**: pnpm（推荐）或 npm
- **Redis**: 5.0+（用于 Celery 任务队列和缓存，可选）
- **Elasticsearch**: 8.11+（搜索引擎，可选）

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd 项目位置
```

### 2. 后端启动

```bash
# 进入后端目录
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

✅ 后端将在 **http://localhost:5000** 启动（支持 threaded 模式，兼容 SSE 流式响应）

> 💡 **提示**：启动时会自动创建默认测试账号和必要的数据库表（SQLite 模式下自动迁移）

### 3. 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖（推荐使用 pnpm）
pnpm install
# 或 npm install

# 启动开发服务器
pnpm run dev
# 或 npm run dev
```

✅ 前端将在 **http://localhost:5173** 启动（自动代理 `/api` 和 `/uploads` 到后端）

### 4. 访问系统

打开浏览器访问：**http://localhost:5173**

**默认测试账号**：

| 角色   | 用户名       | 密码         |
| ------ | ----------- | ------------ |
| 管理员 | `admin`     | `admin123`   |
| 教师   | `teacher`   | `teacher123` |
| 学生   | `student`   | `student123` |

---

## 🎨 核心功能

### 👨‍💼 管理员平台

| 功能模块     | 描述                                  |
| ------------ | ------------------------------------- |
| **用户管理** | 添加/删除用户、角色分配、用户统计、权限控制 |
| **课程管理** | 创建/管理课程、课程分类、状态跟踪、教师分配 |
| **班级管理** | 班级创建、学生分配、班级信息维护           |
| **数据分析** | 用户增长趋势、课程活跃度、学习进度、多维度统计图表 |
| **系统设置** | 基础配置、功能开关、AI 模型配置、安全设置 |

### 👨‍🏫 教师平台

| 功能模块          | 描述                                        |
| ----------------- | ------------------------------------------- |
| **课程管理**      | 创建课程、学生管理、进度跟踪、课程资源上传       |
| **AI 内容生成**   | Multi-Agent 协同生成学习目标、知识要点、代码示例、练习题 |
| **教案管理**      | AI 智能生成教案、教案版本控制、内容优化         |
| **视频课程**      | 视频上传、流式播放（支持 Range 请求）、视频管理  |
| **考核管理**      | AI 智能出题、编程题评测、考试管理、成绩统计     |
| **学情分析**      | AI 学习分析报告、成绩分布、学习进度追踪         |
| **师生互动**      | 实时问答、讨论区管理、举手响应、作业批改         |
| **AI 内容审核**   | AI 生成内容质量评分、版本对比、操作日志         |

### 👨‍🎓 学生平台

| 功能模块          | 描述                                       |
| ----------------- | ------------------------------------------ |
| **我的课程**      | 课程列表、学习进度、继续学习、任务完成跟踪      |
| **AI 学习助手**   | SSE 流式对话、多轮对话管理、个性化学习建议      |
| **练习评测**      | AI 智能评测、编程题提交与评测、详细解析、错题本 |
| **错题本**        | 错题分类统计、AI 智能分析、知识图谱、针对性练习 |
| **学习路径**      | AI 规划个性化学习路径、节点追踪、资源推荐       |
| **学习笔记**      | 富文本笔记、视频笔记、笔记管理                |
| **成就系统**      | 学习成就解锁、成就展示、学习激励              |
| **学生画像**      | AI 构建学习画像、多维度能力评估、画像对话       |
| **学习进度**      | 学习时长、完成任务、成绩趋势、数据可视化        |
| **互动学习**      | 向老师提问、参与讨论、查看通知、接收反馈        |

---

## 🛠️ 技术架构

### 前端技术栈

| 技术                    | 版本      | 用途              |
| ----------------------- | --------- | ----------------- |
| **React**               | 19.1      | UI 框架           |
| **Vite**                | 6.3       | 构建工具           |
| **Tailwind CSS**        | 4.1       | 原子化 CSS         |
| **shadcn/ui**           | Latest    | UI 组件库 (Radix)  |
| **React Router**        | 7.6       | 路由管理（懒加载）  |
| **Recharts**            | 2.15      | 数据可视化         |
| **Lucide React**        | 0.510     | 图标库             |
| **Socket.IO Client**    | 4.8       | WebSocket 实时通信  |
| **React Hook Form**     | 7.56      | 表单管理           |
| **Zod**                 | 3.24      | 数据验证           |
| **Tiptap**              | 2.4       | 富文本编辑器       |
| **CodeMirror**          | 6.x       | 代码编辑器         |
| **Framer Motion**       | 12.15     | 动画库             |
| **date-fns**            | 4.1       | 日期处理           |

### 后端技术栈

| 技术                    | 版本     | 用途              |
| ----------------------- | -------- | ----------------- |
| **Flask**               | 2.3.3    | Web 框架          |
| **Python**              | 3.14     | 编程语言（开发环境）|
| **Flask-SQLAlchemy**    | 3.1.1    | ORM 框架          |
| **SQLite**              | -        | 开发数据库         |
| **PostgreSQL**          | -        | 生产数据库（推荐）  |
| **Flask-CORS**          | 4.0.0    | 跨域支持          |
| **Flask-SocketIO**      | 5.3.6    | WebSocket 支持    |
| **Celery**              | 5.3.4    | 异步任务队列       |
| **Redis**               | 5.0.1    | 缓存/消息队列      |
| **Elasticsearch**       | 8.11     | 搜索引擎（可选）   |
| **Spark API**           | Ultra    | 讯飞星火大模型      |
| **Prometheus Client**   | 0.19     | 指标采集          |
| **FPDF2 / python-docx** | Latest   | 文档导出          |
| **Pillow**              | 10+      | 图片处理          |

### Multi-Agent 架构

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
                                         │Project│
                                         │ Agent │
                                         │项目管理│
                                         └──────┘
```

### 系统架构

```
┌──────────────────┐      ┌──────────────────────┐      ┌──────────────────┐
│     前端层        │      │       后端层          │      │     数据层        │
│   React 19        │ HTTP │   Flask 2.3.3        │ SQL  │   SQLite/PG      │
│   Vite 6          │ SSE  │   Celery 5.3.4       │ Redis│   Redis 5.0      │
│   Tailwind 4      │ WS   │   Multi-Agent        │ ES   │   Elasticsearch  │
│   shadcn/ui       │─────▶│   Spark API          │─────▶│                  │
│   PWA             │      │   SocketIO           │      │                  │
└──────────────────┘      └──────────────────────┘      └──────────────────┘
                               │           │
                    ┌──────────┘           └──────────┐
                    ▼                                 ▼
          ┌──────────────────┐           ┌──────────────────┐
          │    监控 & 日志     │           │    任务调度        │
          │ Prometheus       │           │ Celery Beat      │
          │ Grafana          │           │ 定时备份/报表/清理  │
          │ Alertmanager     │           │ 6个优先级队列      │
          │ ELK Stack        │           │                  │
          └──────────────────┘           └──────────────────┘
```

---

## 📦 项目结构

```
project_code/
├── backend/                        # 后端代码
│   ├── src/
│   │   ├── routes/                # API 路由（25 个模块）
│   │   │   ├── auth.py            #   认证（登录/注册/登出）
│   │   │   ├── admin.py           #   管理员后台
│   │   │   ├── teacher.py         #   教师功能
│   │   │   ├── student.py         #   学生功能
│   │   │   ├── course.py          #   课程管理
│   │   │   ├── ai_assistant.py    #   AI 助手
│   │   │   ├── ai_analysis.py     #   AI 分析报告
│   │   │   ├── ai_optimization.py #   AI 内容优化
│   │   │   ├── course_generation.py # AI 课程生成
│   │   │   ├── lesson_plan.py     #   教案管理
│   │   │   ├── programming.py     #   编程题评测
│   │   │   ├── learning_path_routes.py # 学习路径
│   │   │   ├── mistake_book.py    #   错题本
│   │   │   ├── achievement.py     #   成就系统
│   │   │   ├── class_management.py # 班级管理
│   │   │   ├── interaction.py     # 师生互动
│   │   │   ├── search_routes.py   #   搜索功能
│   │   │   └── ...                #   更多路由
│   │   ├── services/              # 业务服务层（25+ 个）
│   │   │   ├── spark_service.py   #   星火 API 调用
│   │   │   ├── ai_stream_service.py # AI 流式响应
│   │   │   ├── sse_chat_service.py # SSE 聊天
│   │   │   ├── multi_turn_service.py # 多轮对话
│   │   │   ├── export_service.py  #   PDF/Word 导出
│   │   │   ├── elasticsearch_service.py # ES 搜索
│   │   │   ├── multi_agent/       #   🤖 Multi-Agent 子系统
│   │   │   │   ├── coordinator_agent.py  # 协调 Agent
│   │   │   │   ├── document_agent.py     # 文档 Agent
│   │   │   │   ├── exercise_agent.py     # 练习 Agent
│   │   │   │   ├── media_agent.py        # 媒体 Agent
│   │   │   │   ├── profile_agent.py      # 画像 Agent
│   │   │   │   ├── project_agent.py      # 项目 Agent
│   │   │   │   ├── recommendation_agent.py # 推荐 Agent
│   │   │   │   └── shared_state.py       # 共享状态
│   │   │   └── ...                #   更多服务
│   │   ├── models/                # 数据模型（8 个模块）
│   │   │   ├── user.py            #   用户模型
│   │   │   ├── course.py          #   课程/内容/评测/视频/进度
│   │   │   ├── conversation.py    #   对话/消息
│   │   │   ├── learning_path.py   #   学习路径/资源推荐
│   │   │   ├── student_profile.py #   学生画像
│   │   │   ├── ai_analysis.py     #   AI 分析报告
│   │   │   ├── content_version.py #   内容版本
│   │   │   └── search_log.py      #   搜索日志
│   │   ├── tasks/                 # Celery 异步任务
│   │   │   ├── ai_tasks.py        #   AI 内容生成
│   │   │   ├── email_tasks.py     #   邮件发送
│   │   │   ├── export_tasks.py    #   数据导出/报表
│   │   │   └── maintenance_tasks.py # 运维维护
│   │   ├── middleware/            # 中间件
│   │   │   └── metrics_middleware.py # Prometheus 指标采集
│   │   ├── utils/                 # 工具模块
│   │   ├── alembic/               # 数据库迁移
│   │   ├── celery_app.py          # Celery 入口
│   │   ├── celeryconfig.py        # Celery 配置
│   │   ├── config.py              # 应用配置
│   │   └── main.py                # 应用入口
│   ├── monitoring/                # 监控配置
│   │   ├── prometheus/            #   Prometheus 抓取规则 & 告警
│   │   ├── grafana/               #   Grafana 仪表板 & 数据源
│   │   └── alertmanager/          #   Alertmanager 告警配置
│   ├── logging/                   # 日志配置
│   │   ├── filebeat/              #   Filebeat 配置
│   │   └── logstash/              #   Logstash 管道
│   ├── 搜索引擎配置/               # Elasticsearch 索引配置
│   ├── tests/                     # 后端测试
│   ├── requirements.txt           # Python 依赖
│   └── start_backend.ps1          # Windows 启动脚本
│
├── frontend/                       # 前端代码
│   ├── src/
│   │   ├── components/            # React 组件
│   │   │   ├── ui/                #   基础 UI 组件（40+ 个，shadcn/ui）
│   │   │   ├── AdminDashboard.jsx #   管理员仪表板
│   │   │   ├── TeacherDashboard.jsx # 教师仪表板
│   │   │   ├── StudentDashboard.jsx # 学生仪表板
│   │   │   ├── CourseLearningPage.jsx # 课程学习页
│   │   │   ├── CourseGenerationWizard.jsx # AI 课程生成向导
│   │   │   ├── AIChatPanel.jsx    #   AI 聊天面板
│   │   │   ├── AIAnalysisDashboard.jsx # AI 分析仪表板
│   │   │   ├── ProfileBuilder.jsx #   学生画像构建
│   │   │   ├── LearningPlanSystem.jsx # 学习计划系统
│   │   │   ├── AchievementPanel.jsx # 成就面板
│   │   │   ├── VideoPlayer.jsx    #   视频播放器
│   │   │   ├── MistakeBook/       #   错题本组件组
│   │   │   ├── AIContentReview/   #   AI 内容审核组件组
│   │   │   ├── Search/            #   搜索组件组
│   │   │   ├── StudyNotes/        #   学习笔记组件组
│   │   │   ├── Practice/          #   练习组件组
│   │   │   └── ...                #   更多组件
│   │   ├── services/              # API 服务层
│   │   │   ├── api.js             #   统一 API 封装
│   │   │   ├── searchApi.js       #   搜索 API
│   │   │   └── websocket.js       #   WebSocket 服务
│   │   ├── hooks/                 # 自定义 Hooks
│   │   │   ├── useSSEChat.js      #   SSE 聊天 Hook
│   │   │   └── use-mobile.js      #   移动端检测
│   │   ├── router/                # 路由配置（懒加载）
│   │   ├── lib/                   # 工具库
│   │   ├── utils/                 # 工具模块（懒加载、PWA 等）
│   │   └── styles/                # 自定义样式
│   ├── public/                    # 静态资源 & PWA 文件
│   ├── dist/                      # 构建产物
│   ├── package.json               # Node.js 依赖
│   ├── vite.config.js             # Vite 构建配置
│   └── jest.config.js             # Jest 测试配置
│
├── README.md                       # 项目说明（本文件）
├── 智教星项目开发文档.docx          # 开发文档
├── 智教星答辩文档_完整版.docx       # 答辩文档
├── 教学平台独特性化发展路径研究报告.docx # 研究报告
└── 项目独特性内容战略报告.docx       # 内容战略报告
```

---

## 🔑 配置说明

### 后端环境变量 (`backend/.env`)

```bash
# Spark 星火大模型 API 配置
SPARK_API_PASSWORD=your_api_password_here
SPARK_API_URL=https://spark-api-open.xf-yun.com/v1/chat/completions
SPARK_MODEL=lite

# 数据库配置（开发环境使用 SQLite）
DATABASE_URL=sqlite:///instance/dev.db
# 生产环境推荐 PostgreSQL
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=zhijiaoxing_db
# DB_USER=zhijiaoxing_user
# DB_PASSWORD=zhijiaoxing_password

# Flask 配置
SECRET_KEY=your-secret-key-change-this-in-production
FLASK_ENV=development

# Redis 配置（Celery 任务队列 & 缓存）
REDIS_URL=redis://localhost:6379/0

# Elasticsearch 配置（可选）
ELASTICSEARCH_ENABLED=false
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200
```

### 前端环境变量 (`frontend/.env.development`)

```bash
VITE_API_BASE_URL=/api
VITE_APP_ENV=development
VITE_DEBUG=true
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEVTOOLS=true
```

### 前端环境变量 (`frontend/.env.production`)

```bash
VITE_API_BASE_URL=/api
VITE_APP_ENV=production
VITE_DEBUG=false
VITE_API_TIMEOUT=30000
VITE_ENABLE_DEVTOOLS=false
```

---

## ⚙️ 异步任务 & 定时调度

### Celery 队列配置

系统使用 6 个优先级队列处理不同类型的任务：

| 队列            | 用途           |
| --------------- | -------------- |
| `default`       | 默认任务        |
| `ai`            | AI 内容生成     |
| `email`         | 邮件发送        |
| `export`        | 数据导出        |
| `maintenance`   | 运维维护        |
| `high_priority` | 高优先级任务    |

### Celery Beat 定时任务

| 任务           | 调度        | 说明            |
| -------------- | ----------- | --------------- |
| 数据库备份      | 每日 02:00  | 自动备份数据库   |
| 周报表生成      | 每周一 09:00 | 生成系统周报表   |
| 日志清理        | 每日 03:00  | 清理 30 天前日志 |
| 缓存清理        | 每小时      | 清理过期缓存     |
| 系统健康检查    | 每 5 分钟   | 检查系统运行状态 |

---

## 📊 监控 & 日志

### 监控栈

系统内置完整的可观测性方案：

| 组件            | 用途                    |
| --------------- | ----------------------- |
| **Prometheus**  | 指标采集（请求耗时、活跃用户、错误追踪） |
| **Grafana**     | 可视化仪表板（预置 EduAI Dashboard）    |
| **Alertmanager**| 告警管理与通知           |
| **Filebeat**    | 日志采集                 |
| **Logstash**    | 日志处理管道             |

### 监控配置文件

```
backend/monitoring/
├── prometheus/
│   ├── prometheus.yml      # Prometheus 抓取配置
│   └── alert_rules.yml     # 告警规则
├── grafana/
│   ├── dashboards/         # 仪表板 JSON
│   └── provisioning/       # 自动配置（数据源 & 仪表板）
└── alertmanager/
    └── alertmanager.yml    # 告警通知配置
```

---

## 🧪 测试与开发

### 运行测试

```bash
# 后端测试
cd backend
pytest

# 前端测试
cd frontend
pnpm test
```

> 前端测试使用 Jest 29 + React Testing Library，覆盖率阈值 80%

### 开发模式

```bash
# 后端开发
cd backend
python src/main.py

# 前端开发
cd frontend
pnpm run dev
```

### 构建生产版本

```bash
# 前端构建（含代码分割：vendor chunk、ui chunk）
cd frontend
pnpm build

# 构建产物在 dist/ 目录（含 PWA 的 service-worker.js）
```

### 配置检查

```bash
# 诊断后端配置（Spark API、数据库等）
python backend/check_config.py
```

---

## 📝 常见问题

### Q: 如何配置 Spark API？

A: 在 `backend/.env` 文件中配置：

```bash
SPARK_API_PASSWORD=your_api_password
```

或在运行时设置环境变量：

```bash
# Windows PowerShell
$env:SPARK_API_PASSWORD = "your_password"

# Linux/macOS
export SPARK_API_PASSWORD="your_password"
```

### Q: 数据库在哪里？

A: 开发环境默认使用 SQLite，数据库文件在 `backend/instance/dev.db`。生产环境推荐切换为 PostgreSQL，在 `.env` 中配置连接信息即可。

### Q: 如何重置数据库？

A: 删除 `backend/instance/dev.db`，重启后端会自动创建新数据库并初始化默认数据。

### Q: 前端无法连接后端？

A: 检查以下几点：
1. 后端是否在 `localhost:5000` 运行
2. `frontend/.env.development` 中 `VITE_API_BASE_URL=/api`（开发环境通过 Vite 代理）
3. Vite 代理配置在 `vite.config.js` 中已预设

### Q: AI 功能无法使用？

A:
1. 检查 Spark API 密钥是否正确配置
2. 查看后端日志是否有 API 调用错误
3. 运行 `python backend/check_config.py` 诊断配置

### Q: Redis 未安装会影响使用吗？

A: Redis 主要用于 Celery 任务队列和生产环境缓存。开发环境下缓存会自动降级为 SimpleCache，但异步任务（如邮件、批量导出）需要 Redis。

### Q: Elasticsearch 必须安装吗？

A: 不是。Elasticsearch 为可选组件，在 `.env` 中设置 `ELASTICSEARCH_ENABLED=false` 即可关闭（默认关闭）。开启后可使用全文搜索和搜索推荐功能。

---

## 📄 相关文档

| 文档 | 说明 |
| ---- | ---- |
| [智教星项目开发文档.docx](智教星项目开发文档.docx) | 完整开发文档 |
| [智教星答辩文档_完整版.docx](智教星答辩文档_完整版.docx) | 答辩演示文档 |
| [教学平台独特性化发展路径研究报告.docx](教学平台独特性化发展路径研究报告.docx) | 发展路径研究 |
| [项目独特性内容战略报告.docx](项目独特性内容战略报告.docx) | 内容战略报告 |

---

## 👥 团队信息

**项目名称**：智教星 (EduAI) - 智能教学管理平台

**技术栈**：React 19 + Flask 2.3 + Spark 星火大模型 + Multi-Agent

**适用场景**：

- 在线教育系统
- 智慧课堂
- 企业培训平台
- 个性化学习系统
- 编程教学与评测

---

## 🎉 致谢

感谢以下开源项目：

- [讯飞星火大模型](https://www.xfyun.cn/) - AI 能力支持
- [React](https://react.dev/) - 前端框架
- [Flask](https://flask.palletsprojects.com/) - 后端框架
- [Tailwind CSS](https://tailwindcss.com/) - 样式框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件
- [Vite](https://vitejs.dev/) - 构建工具
- [Celery](https://docs.celeryq.dev/) - 任务队列
- [Prometheus](https://prometheus.io/) - 监控系统
- [Grafana](https://grafana.com/) - 可视化
- [Elasticsearch](https://www.elastic.co/) - 搜索引擎

---

**🌟 祝使用愉快！**
