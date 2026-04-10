# 🌟 智教星 - 智能教学管理平台

> 基于 Spark4.0 Ultra 星火大模型的完整 AI 驱动教学解决方案

<br />

***

## 📖 项目简介

**智教星**是一款功能完整的智能教学管理平台，深度集成**Spark4.0 Ultra 星火大模型**，为管理员、教师和学生提供全方位的 AI 辅助教学服务。系统采用现代化的前后端分离架构，支持实时互动、数据可视化和智能内容生成，助力教育数字化转型。

### 🎯 核心亮点

- 🤖 **AI 深度集成** - Spark4.0 Ultra 大模型驱动，智能生成教学内容、答疑解惑
- 👥 **三端完整** - 管理员、教师、学生平台功能齐全，覆盖教学全流程
- ⚡ **实时互动** - WebSocket 双向通信，师生互动零延迟
- 📊 **数据驱动** - 丰富的可视化图表，多维度学情分析
- 🎨 **现代 UI** - 响应式设计，支持桌面和移动设备，UI 美观易用
- 🔒 **安全可靠** - 完善的权限控制，数据加密保护

***

## 🚀 快速开始

### 环境要求

- **Python**: 3.11 或更高版本
- **Node.js**: 18 或更高版本
- **包管理器**: npm 或 pnpm

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
# 编辑 .env 文件，填入 Spark API 密钥

# 启动后端服务
python src/main.py
```

✅ 后端将在 **<http://localhost:5000>** 启动

### 3. 前端启动

```bash
# 进入前端目录
cd frontend

# 安装依赖
pnpm install
# 或 npm install

# 配置环境变量（可选，默认已配置）
cp .env.example .env

# 启动开发服务器
pnpm run dev
# 或 npm run dev
```

✅ 前端将在 **<http://localhost:5173>** 启动

### 4. 访问系统

打开浏览器访问：**<http://localhost:5173>**

**默认测试账号**：

- 管理员：`admin` / `admin123`
- 教师：`teacher` / `teacher123`
- 学生：`student` / `student123`

***

## 🎨 核心功能

### 👨‍💼 管理员平台

| 功能模块     | 描述                        |
| -------- | ------------------------- |
| **用户管理** | 添加/删除用户、角色分配、用户统计、权限控制    |
| **课程管理** | 创建/管理课程、课程分类、状态跟踪、教师分配    |
| **数据分析** | 用户增长趋势、课程活跃度、学习进度、多维度统计图表 |
| **系统设置** | 基础配置、功能开关、AI 模型配置、安全设置    |

### 👨‍🏫 教师平台

| 功能模块        | 描述                               |
| ----------- | -------------------------------- |
| **课程管理**    | 创建课程、学生管理、进度跟踪、课程资源上传            |
| **AI 内容生成** | 基于 Spark4.0 生成学习目标、知识要点、代码示例、练习题 |
| **考核管理**    | AI 智能出题、考试管理、成绩统计、学情分析           |
| **师生互动**    | 实时问答、讨论区管理、举手响应、作业批改             |

### 👨‍🎓 学生平台

| 功能模块        | 描述                    |
| ----------- | --------------------- |
| **我的课程**    | 课程列表、学习进度、继续学习、任务完成跟踪 |
| **AI 学习助手** | 智能问答对话、学习疑问解答、个性化学习建议 |
| **练习评测**    | AI 智能评测、详细解析、错题本、成绩统计 |
| **学习进度**    | 学习时长、完成任务、成绩趋势、数据可视化  |
| **互动学习**    | 向老师提问、参与讨论、查看通知、接收反馈  |

***

## 🛠️ 技术架构

### 前端技术栈

| 技术                   | 版本     | 用途      |
| -------------------- | ------ | ------- |
| **React**            | 19     | UI 框架   |
| **Vite**             | 6      | 构建工具    |
| **Tailwind CSS**     | 4      | 原子化 CSS |
| **shadcn/ui**        | Latest | UI 组件库  |
| **React Router**     | 7      | 路由管理    |
| **Recharts**         | 2      | 数据可视化   |
| **Lucide React**     | Latest | 图标库     |
| **Socket.IO Client** | 4      | 实时通信    |
| **React Hook Form**  | 7      | 表单管理    |
| **Zod**              | 3      | 数据验证    |

### 后端技术栈

| 技术                   | 版本    | 用途       |
| -------------------- | ----- | -------- |
| **Flask**            | 3.0   | Web 框架   |
| **Python**           | 3.11  | 编程语言     |
| **Flask-SQLAlchemy** | 3.1   | ORM 框架   |
| **SQLite**           | -     | 数据库      |
| **Flask-CORS**       | 4.0   | 跨域支持     |
| **Celery**           | 5.3   | 异步任务     |
| **Redis**            | 5.0   | 缓存/消息队列  |
| **Elasticsearch**    | 8.11  | 搜索引擎（可选） |
| **Spark4.0 API**     | Ultra | 大模型集成    |

### 架构特点

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   前端层    │ ──────> │   后端层     │ ──────> │   数据层    │
│  React 19   │  HTTP   │  Flask 3.0   │  SQL    │   SQLite    │
│  Vite 6     │  WS     │  Celery      │  Redis  │  Elasticsearch│
│  Tailwind   │         │  Spark API   │         │             │
└─────────────┘         └──────────────┘         └─────────────┘
```

***

## 📦 项目结构

```
project_code/
├── backend/                    # 后端代码
│   ├── src/
│   │   ├── routes/            # 路由文件
│   │   ├── services/          # 服务文件（Spark API 集成）
│   │   ├── models/            # 数据模型
│   │   ├── tasks/             # 异步任务（Celery）
│   │   ├── utils/             # 工具函数
│   │   ├── middleware/        # 中间件
│   │   └── main.py            # 入口文件
│   ├── requirements.txt       # Python 依赖
│   ├── .env.example           # 环境变量示例
│   └── check_config.py        # 配置检查工具
│
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── components/        # React 组件
│   │   ├── services/          # API 服务
│   │   ├── hooks/             # 自定义 Hooks
│   │   ├── router/            # 路由配置
│   │   └── App.jsx            # 入口文件
│   ├── public/                # 静态资源
│   ├── package.json           # Node.js 依赖
│   └── .env.example           # 环境变量示例
│
├── README.md                   # 项目说明
├── 比赛提交说明.md              # 提交指南
└── cleanup_for_submission.py   # 清理脚本
```

***

## 🔑 配置说明

### 后端环境变量 (`backend/.env`)

```bash
# Spark 星火大模型 API 配置
SPARK_API_PASSWORD=your_api_password_here
SPARK_MODEL=lite

# 数据库配置
DATABASE_URL=sqlite:///instance/dev.db

# Flask 配置
SECRET_KEY=your-secret-key-change-this-in-production
FLASK_ENV=development

# Redis 配置（Celery 使用）
REDIS_URL=redis://localhost:6379/0
```

### 前端环境变量 (`frontend/.env`)

```bash
# 后端 API 地址
VITE_API_BASE_URL=http://localhost:5000/api

# 生产环境配置
# VITE_API_BASE_URL=https://your-backend-domain.com/api
```

***

## 🎯 功能演示

### 管理员功能

1. **登录系统** - 使用管理员账号登录
2. **用户管理** - 添加/删除用户、查看用户统计图表
3. **课程管理** - 创建课程、分配教师、设置课程信息
4. **数据分析** - 查看系统使用统计、用户增长趋势、课程活跃度
5. **系统设置** - 配置系统参数、AI 模型、安全策略

### 教师功能

1. **课程管理** - 创建和管理个人课程、添加学生
2. **AI 内容生成** - 输入主题，AI 自动生成完整教学内容
3. **考核管理** - AI 智能出题、组织考试、查看成绩分析
4. **学情分析** - 查看学生学习数据、成绩分布、学习进度
5. **师生互动** - 回答学生问题、管理讨论区、处理举手

### 学生功能

1. **我的课程** - 查看已选课程、继续学习、跟踪进度
2. **AI 学习助手** - 与 AI 对话、解答学习疑问、获取建议
3. **练习评测** - 完成练习题、获得 AI 评测和详细解析
4. **学习进度** - 查看个人学习数据、成绩趋势、任务完成情况
5. **互动学习** - 向老师提问、参与讨论、查看反馈

***

## 📊 系统特色

### AI 智能生成

- ✅ 学习目标自动生成
- ✅ 知识要点自动提取
- ✅ 代码示例智能创建
- ✅ 练习题智能命题
- ✅ 答案解析详细生成

### 实时互动

- ✅ WebSocket 双向通信
- ✅ 学生举手实时响应
- ✅ 问答讨论即时互动
- ✅ 师生数据实时同步
- ✅ 延迟 < 2 秒

### 数据可视化

- ✅ 用户增长趋势图
- ✅ 课程活跃度分析
- ✅ 学习成绩分布
- ✅ 学习进度跟踪
- ✅ 多维度统计报表

***

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

### 开发模式

```bash
# 后端开发（已启动）
python src/main.py

# 前端开发（已启动）
pnpm run dev
```

### 构建生产版本

```bash
# 前端构建
cd frontend
pnpm build

# 构建产物在 dist/ 目录
```

***

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

A: 默认使用 SQLite，数据库文件在 `backend/instance/dev.db`

### Q: 如何重置数据库？

A: 删除 `backend/instance/dev.db`，重启后端会自动创建新数据库

### Q: 前端无法连接后端？

A: 检查 `frontend/.env` 中的 `VITE_API_BASE_URL` 是否正确指向后端地址

### Q: AI 功能无法使用？

A:

1. 检查 Spark API 密钥是否正确配置
2. 查看后端日志是否有 API 调用错误
3. 运行 `python backend/check_config.py` 诊断配置

***

***

## 👥 团队信息

**项目名称**：智教星 - 智能教学管理平台

**技术栈**：React 19 + Flask 3.0 + Spark4.0 Ultra

**适用场景**：

- 在线教育系统
- 智慧课堂
- 企业培训平台
- 个性化学习系统

***

***

## 🎉 致谢

感谢以下开源项目：

- [Spark 星火大模型](https://www.xfyun.cn/) - AI 能力支持
- [React](https://react.dev/) - 前端框架
- [Flask](https://flask.palletsprojects.com/) - 后端框架
- [Tailwind CSS](https://tailwindcss.com/) - 样式框架
- [shadcn/ui](https://ui.shadcn.com/) - UI 组件

***

**🌟 祝使用愉快！如有比赛需求，请查阅** **[比赛提交说明.md](比赛提交说明.md)**
