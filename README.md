<br />

# 智教星 · ZhijiaoXing

### 基于大模型的个性化资源生成与学习多智能体系统

[![赛题](https://img.shields.io/badge/中国软件杯-A3-ff6b6b?style=flat-square&logo=google-chrome&logoColor=white)](https://www.cnsoftbei.com/)
[![出题企业](https://img.shields.io/badge/科大讯飞-Spark-1e88e5?style=flat-square)](https://www.xfyun.cn/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Flask](https://img.shields.io/badge/Flask-2.3-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Tests](https://img.shields.io/badge/测试-185%20pytest%20%2B%20252%20jest-15803d?style=flat-square)](#-质量保障)

**Multi-Agent 协同 · 8 维学生画像 · 3D 知识图谱 · BGE 语义检索 · Excalidraw 实时白板 · SSE 流式对话 · 8 种多模态资源**

[快速开始](#-快速开始) · [亮点](#-亮点一览) · [架构](#-系统架构) · [文档](#-文档导航) · [常见问题](#-常见问题)

***

## 项目简介

高等教育中学生面临**资源繁杂、适配不足、缺乏个性化指导**三大痛点。智教星以**讯飞 Spark 星火大模型**为核心，采用 **Multi-Agent 多智能体架构**，围绕计算机/人工智能专业课程，为每位学生自动生成**定制化、多模态**的学习资源，让"因材施教"在数字化场景下落地。

**核心能力：**

<table>
<tr>
<td width="50%" valign="top">

### 🧠 8 维学生画像
对话式构建，**随学随新**：
- 知识基础 · 认知风格 · 易错点
- 学习节奏 · 兴趣领域 · 目标导向
- 时间可用性 · 互动偏好

> *超出赛题 6 维度要求*

</td>
<td width="50%" valign="top">

### 🤖 10 个智能体协同
**并行生成 7 种资源**：
- 🎛️ Coordinator 协调
- 📄 Document 文档
- ✏️ Exercise 习题
- 🎬 Media 多媒体
- 📚 Recommendation 推荐
- 💻 Project 项目
- 👤 Profile 画像
- 🕸️ KnowledgeGraph 图谱
- 📊 PPT 演示文稿

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🕸️ 3D 知识图谱 + 语义检索
- Word / PDF 上传 → AI 解析 → Three.js 可视化
- 8 种节点 · **7 种关系**（LLM 推理 + 关键词共现 + 语义关联）
- **BGE 中文 embedding + Qdrant local**：自然语言提问，按"意思"召回知识点并一键聚焦图谱节点

</td>
<td width="50%" valign="top">

### 💬 SSE 流式 AI 助教
- 实时流式响应，无白屏等待
- 多轮对话、个性化答疑、RAG 依据链引用
- Markdown + Mermaid + 代码高亮
- AI 内容审核 + 质量评分，**防幻觉**

</td>
</tr>
</table>

***

## ✨ 亮点一览

| 亮点 | 说明 |
| --- | --- |
| 🎛️ **协作流水线时间线** | `agent_execution_logs` 聚类为甘特泳道图：哪个智能体何时跑、跑了多久、是否失败，一屏看清真实协作过程（借鉴 langfuse/LangGraph 范式） |
| 🔗 **生成依据链** | 每条 AI 生成内容附带 citation 证据卡：来源章节/知识点/置信度，可追溯、可跳转，防"AI 黑箱" |
| 🔍 **本地语义检索** | BGE-small-zh（ONNX，无 torch）+ Qdrant local 模式——不额外起服务、不装 ES，dev 环境离线即可"按意思搜" |
| 🖊️ **实时白板协作** | Excalidraw 懒加载嵌入互动面板，Socket.IO 按课程房间 500ms 节流同步，教师画图学生端实时呈现 |
| 📤 **数据导出闭环** | 错题一键导出 **Anki .apkg**（genanki，可增量更新同卡组）；班级成绩三表 **.xlsx**（exceljs 懒加载）；成就**证书打印视图**（@media print 存 PDF） |
| 📸 **OCR 拍照录错题** | tesseract.js 自托管（worker/core/chi_sim+eng 权重全部 vendored，离线可用），识别预填→人工核对→入库，失败自动降级手动填写 |
| 📅 **零依赖月历视图** | AI 学习规划的"第 N 周"里程碑映射到真实日期网格（FullCalendar 在 React 19 下崩溃，手写 ~140 行 MonthGrid 替代） |
| ☁️ **知识点词云** | timdream/wordcloud 把错题标签频次可视化，一眼看到薄弱点 |
| 🛡️ **工程纪律** | 全路由鉴权守卫扫描测试、SEC/BUG 夜间巡查修复链、verify_all.ps1 三段式（jest+build+pytest）防"测试过≠代码没问题" |

***

## 🚀 快速开始

### 📋 环境要求

| 组件            | 版本    | 是否必需           |
| ------------- | ----- | -------------- |
| Python        | 3.11+（dev 实测 3.14 可跑） | ✅ |
| Node.js       | 18+   | ✅              |
| pnpm          | 推荐    | ⭕（也可用 npm）     |
| Redis         | 5.0+  | ⭕（Celery 异步任务，未装则走同步降级） |
| Elasticsearch | 8.11+ | ⭕（搜索引擎，默认禁用走 SQLite fallback） |

> 📄 仓库已含 [`backend/.env.example`](backend/.env.example)——复制为 `backend/.env` 填值即可，不必再从 config.py 反推。

### ⚡ 5 分钟跑起来

**第一步：启动后端** 🐍

```bash
cd backend
python -m venv venv

# Windows PowerShell
.envScriptsActivate.ps1
# Linux / macOS
source venv/bin/activate

pip install -r requirements.txt

# 复制环境模板并填值（至少 SPARK_API_PASSWORD 与 SECRET_KEY）
cp .env.example .env   # Windows: copy .env.example .env

python src/main.py
```

> 后端将运行在 **<http://localhost:5000>**

**第二步：启动前端** ⚛️

```bash
cd frontend
pnpm install
pnpm run dev
```

> 前端将运行在 **<http://localhost:5173>**（Vite 已代理 `/api` 和 `/uploads`）

**第三步：登录系统** 🔑

打开 `http://localhost:5173`，使用默认账号体验：

| 角色        | 用户名       | 密码           | 用途                  |
| --------- | --------- | ------------ | ------------------- |
| 👨‍💼 管理员 | `admin`   | `admin123`   | 用户 / 课程 / 数据管理      |
| 👨‍🏫 教师  | `teacher` | `teacher123` | 课程 / 知识图谱 / AI 内容生成 |
| 👨‍🎓 学生  | `student` | `student123` | 学习 / 3D 图谱 / AI 助教  |

### 🐳 Docker 一键启动

```bash
# Windows
Docker一键启动.bat
# Linux / macOS
./Docker一键启动.sh
```

### 🎯 体验核心功能

> **推荐路径**（5 分钟感受产品力）

1. 👨‍🏫 **教师账号**登录 → 「知识图谱」→ 上传 `.docx` 或 `.pdf` 课程大纲
2. ⏳ 系统自动解析：提取章节、知识点、关系推理 → 生成 3D 可视化图谱
3. 🔄 切换 👨‍🎓 **学生账号** → 「知识图谱」→ 同一课程图谱学生视角
4. 🔍 在图谱顶部输入自然语言 → **语义检索**按意思召回知识点，点击芯片自动聚焦节点
5. 💬 「AI 助教」体验 SSE 流式对话、个性化答疑
6. 🧑‍🏫 教师端「互动管理」→「实时白板」，与学生端同课程白板双向同步
7. 📕 学生端「错题本」→ 拍照 OCR 录入 / 一键导出 Anki 卡组复习

***

## 🏗️ 系统架构

```
┌────────────────────────────────────────────────────────────────────┐
│                          智教星 系统架构                            │
├──────────────────┬──────────────────────────┬──────────────────────┤
│     前端层       │         后端层            │       数据 / AI 层   │
│   React 19       │   Flask 2.3 (threaded)   │   Spark 星火 Ultra   │
│   Vite 6         │   ├─ 35 路由模块          │   ├─ Multi-Agent     │
│   Tailwind 4     │   ├─ 50 服务模块          │   ├─ 知识库 RAG      │
│   shadcn/ui      │   ├─ Multi-Agent 框架     │   ├─ 内容审核        │
│   Three.js R3F   │   ├─ Celery 异步          │   └─ BGE embedding   │
│   Excalidraw     │   ├─ WebSocket            │                      │
│   Tiptap/CM      │   └─ Qdrant local 向量库  │   SQLite / Postgres  │
│   PWA 离线       │                          │   Redis (缓存/队列)  │
│   HTTP/SSE/WS ──▶│ ──────────────────────▶  │   Elasticsearch(可选) │
└──────────────────┴──────────────────────────┴──────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                ▼             ▼             ▼
         ┌──────────┐  ┌──────────┐  ┌──────────────┐
         │Prometheus│  │ Grafana  │  │  ELK Stack   │
         │  指标    │  │  仪表盘  │  │  日志聚合    │
         └──────────┘  └──────────┘  └──────────────┘
```

### 🤖 Multi-Agent 协同工作流

```
                        ┌──────────────────┐
                        │  Coordinator     │
                        │   Agent 🎛️       │
                        │   (总调度)        │
                        └────────┬─────────┘
                                 │
        ┌──────────┬─────────┬───┴────┬──────────┬──────────┬──────────┐
        ▼          ▼         ▼        ▼          ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │Document│ │Exercise│ │ Media  │ │  Reco  │ │Project │ │ Know-  │ │  PPT   │
   │  📄    │ │  ✏️    │ │  🎬    │ │ 📚    │ │  💻    │ │ledge🕸│ │  📊    │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
        │          │         │        │          │          │          │
        └──────────┴─────────┴────────┴──────────┴──────────┴──────────┘
                                 ▼
                    ┌──────────────────────────┐
                    │  ContentConverter 格式转换 │
                    │  ConsistencyCheck 一致性   │
                    │  ContentReview 质量评分    │
                    │  依据链 citation 证据卡    │
                    └────────────┬─────────────┘
                                 ▼
                        📦 资源包（含完整性报告）
```

***

## 🎨 三端功能

<details>
<summary><b>👨‍🏫 教师端</b> — 课程 / 知识图谱 / AI 内容生成</summary>

| 模块         | 核心能力                                     |
| ---------- | ---------------------------------------- |
| 📚 课程管理    | 创建课程、学生分配、进度跟踪、资源上传                      |
| 🕸️ 知识图谱   | Word/PDF 上传 → AI 解析 → 3D 可视化 → 关系推理      |
| 🤖 AI 内容生成 | Multi-Agent 协同生成学习目标 / 知识要点 / 代码示例 / 练习题 |
| 📊 PPT 生成   | 讯飞智能 PPT API 一键生成演示文稿、在线预览、下载与重新生成 |
| 📝 教案管理    | AI 智能生成教案、版本控制、内容优化                      |
| 🎥 视频课程    | 视频上传、流式播放（Range 请求）、视频管理                 |
| 📊 考核管理    | AI 智能出题、编程题评测、考试管理、成绩统计                  |
| 📈 学情分析    | AI 学习分析报告、成绩分布、学习进度追踪                    |
| 💬 师生互动    | 实时问答、讨论、举手响应，以及 **Excalidraw 实时白板**（Socket.IO 同步） |
| 📤 成绩导出    | exceljs 三表 .xlsx：班级概览 / 成绩分布 / 学生成绩       |
| ✅ AI 内容审核  | 质量评分、版本对比、操作日志                           |
| 🎛️ 协作时间线  | 智能体甘特泳道图、失败标注、心跳排除                     |

</details>

<details>
<summary><b>👨‍🎓 学生端</b> — 3D 图谱 / AI 助教 / 错题本</summary>

| 模块          | 核心能力                      |
| ----------- | ------------------------- |
| 📚 我的课程     | 课程列表、学习进度、继续学习、任务跟踪       |
| 🕸️ 3D 知识图谱 | 交互式 3D 图谱、节点展开、学习路径高亮     |
| 🔍 语义检索     | 自然语言提问 → BGE 向量最近邻召回知识点 → 点击聚焦图谱节点 |
| 💬 AI 学习助手  | SSE 流式对话、多轮对话、个性化学习建议     |
| ✍️ 练习评测     | AI 智能评测、编程题提交与评测、详细解析     |
| 📕 错题本      | 错题分类统计、AI 智能分析、针对性练习       |
| 📸 拍照录入     | tesseract.js 离线 OCR 识别预填题干，人工核对入库 |
| 📤 Anki 导出  | 全部错题一键打包 .apkg（genanki），间隔重复复习 |
| ☁️ 知识点词云    | 错题标签频次可视化                  |
| 🗓️ 学习规划日历  | "第 N 周"里程碑映射真实日期网格，零依赖实现 |
| 🛤️ 学习路径    | AI 个性化路径规划、节点追踪、资源推荐      |
| 📝 学习笔记     | 富文本笔记、视频笔记、笔记管理           |
| 🏆 成就系统     | 学习成就解锁、**证书打印**（CERT 编号 + 存为 PDF） |
| 👤 学生画像     | 8 维画像构建、对话式更新、能力评估        |
| 📊 学习进度     | 学习时长、完成任务、成绩趋势、可视化        |
| 🤝 互动学习     | 举手/问答/讨论/**实时白板**（与教师同房间同步） |

</details>

<details>
<summary><b>👨‍💼 管理员端</b> — 用户 / 课程 / 系统配置</summary>

| 模块      | 核心能力                   |
| ------- | ---------------------- |
| 👥 用户管理 | 用户增删、角色分配、权限控制、用户统计    |
| 📚 课程管理 | 课程创建、分类、状态跟踪、教师分配      |
| 🏫 班级管理 | 班级创建、学生分配、班级维护         |
| 📈 数据分析 | 用户增长趋势、课程活跃度、学习进度、多维统计 |
| ⚙️ 系统设置 | 基础配置、功能开关、AI 模型配置、安全设置 |
| 🪙 Token 用量 | AI 调用 Token 统计与限额管理       |

</details>

***

## 🛠️ 技术栈

### ⚛️ 前端

| 技术                                              | 版本           | 用途            |
| ----------------------------------------------- | ------------ | ------------- |
| [React](https://react.dev/)                     | 19.1         | UI 框架         |
| [Vite](https://vitejs.dev/)                     | 6.3          | 构建工具          |
| [Tailwind CSS](https://tailwindcss.com/)        | 4.1          | 原子化 CSS       |
| [shadcn/ui](https://ui.shadcn.com/)             | Latest       | UI 组件库（Radix） |
| [Three.js](https://threejs.org/)                | 0.184        | 3D 引擎         |
| React Three Fiber / drei                        | 9.6 / 10.7   | 3D 渲染框架       |
| [@excalidraw/excalidraw](https://excalidraw.com/) | 0.18       | 实时白板画布       |
| [tesseract.js](https://tesseract.projectnaptha.com/) | —        | 离线 OCR（自托管资产） |
| [exceljs](https://github.com/exceljs/exceljs)   | —            | 成绩 Excel 导出   |
| wordcloud                                       | —            | 知识点词云         |
| [Recharts](https://recharts.org/)               | 2.15         | 数据可视化         |
| [Tiptap](https://tiptap.dev/)                   | 2.4          | 富文本编辑器        |
| [CodeMirror](https://codemirror.net/)           | 6.x          | 代码编辑器         |
| [Framer Motion](https://www.framer.com/motion/) | 12.15        | 动画库           |
| Socket.IO Client                                | 4.8          | WebSocket     |

### 🐍 后端

| 技术                                                 | 版本     | 用途           |
| -------------------------------------------------- | ------ | ------------ |
| [Flask](https://flask.palletsprojects.com/)        | 2.3.3  | Web 框架       |
| [SQLAlchemy](https://www.sqlalchemy.org/)          | 2.0.23 | ORM          |
| Flask-SocketIO                                     | 5.3.6  | WebSocket（含白板转发） |
| [Celery](https://docs.celeryq.dev/)                | 5.3.4  | 异步任务队列       |
| [Redis](https://redis.io/)                         | 5.0.1  | 缓存 / 消息队列    |
| [qdrant-client](https://qdrant.tech/)              | 1.19+  | 向量检索（local 文件模式，无服务端） |
| [fastembed](https://github.com/qdrant/fastembed)   | 0.8+   | BGE 中文 embedding（ONNX，无 torch） |
| [genanki](https://github.com/kerrickstaley/genanki)| 0.13+  | Anki .apkg 错题卡组导出 |
| [PyMuPDF](https://pymupdf.readthedocs.io/)         | 1.24+  | PDF 解析（知识图谱） |
| [python-docx](https://python-docx.readthedocs.io/) | 1.1    | Word 解析      |
| [Prometheus](https://prometheus.io/)               | 0.19   | 指标采集         |
| Spark API                                          | Ultra  | 讯飞星火大模型      |
| 讯飞智能 PPT 生成 API                                   | —      | PPT 演示文稿生成   |

***

## 📂 项目结构

```
project_code/
├── 📁 backend/                  # 后端代码（Flask + Python 3.11+）
│   ├── 📁 src/
│   │   ├── 📁 routes/           # 35 个 API 路由模块
│   │   ├── 📁 services/         # 50 个业务服务层
│   │   │   ├── 📁 multi_agent/  # 10 个智能体实现
│   │   │   └── vector_search_service.py  # BGE+Qdrant 语义检索
│   │   ├── 📁 models/           # 20 个数据模型
│   │   ├── 📁 tasks/            # Celery 异步任务
│   │   ├── 📁 middleware/       # 指标采集等中间件
│   │   └── 📄 main.py           # 应用入口
│   ├── 📁 instance/             # dev.db + qdrant/ 向量库（不入库）
│   ├── 📄 requirements.txt
│   └── 📄 .env.example          # 环境变量模板（含注释与安全提醒）
│
├── 📁 frontend/                 # 前端代码（React 19 + Vite）
│   ├── 📁 src/
│   │   ├── 📁 components/       # 174 个 .jsx 组件（含 ui/、KnowledgeGraph3D/、MistakeBook/ 等子目录）
│   │   ├── 📁 services/         # API 服务层
│   │   ├── 📁 hooks/            # 自定义 Hooks
│   │   └── 📁 public/tesseract/ # OCR 离线资产（worker+wasm+语言包）
│   ├── 📄 package.json
│   ├── ⚙️ vite.config.js
│   └── 🌐 nginx.conf            # 生产环境反向代理
│
├── 📁 docs/                     # 设计文档与证据链
│   ├── 📁 screenshots/          # 界面截图（enrichment/、night-run/ 取证集）
│   ├── 📁 night-run/            # 夜跑自主执行 HTML 报告
│   ├── 📄 enrichment-report-20261006.html  # 开源技术丰富化对比报告
│   └── 📄 安装部署指南.md
│
├── 📁 .night-run/               # 夜间执行工具链
│   ├── shot.py                  # playwright 截图器（UI 登录 + 后端自愈）
│   ├── ws-sync-test.js          # 双客户端 Socket 同步实测脚本
│   └── start-backend-wmi.ps1    # 无控制台后端拉起（pythonw + WMI）
│
├── 📄 verify_all.ps1            # 三段式总验证（jest + build + pytest）
├── 📘 README.md                 # 本文件
├── 📋 agent.md                  # 完整技术文档
└── 🐳 docker-compose.yml
```

***

## ✅ 质量保障

| 项 | 现状 |
| --- | --- |
| 后端测试 | `pytest`：**185 用例**（语义检索 / 删除级联 / 路由守卫 / RAG 引用 / 生成失败链等）|
| 前端测试 | `jest`：**27 套件 252 用例**全绿 |
| 总验证 | `verify_all.ps1`：jest → vite build → pytest，任一失败即整体失败（防"测试过≠代码没问题"） |
| 路由鉴权 | `test_route_guards.py` 全路由遍历断言，防未授权读取 |
| 代码审查 | ESLint 0 error；夜间巡查修复链（SEC-001 密钥外泄处置 / SEC-006 WS 鉴权 / BUG-015~018 等） |
| 证据链 | 每个新功能配 before/after 截图 + 实机验证，见 [enrichment-report](docs/enrichment-report-20261006.html) 与 [night-report](docs/night-run/) |

```bash
# 一键总验证（前端测试 + 前端构建 + 后端测试）
powershell -ExecutionPolicy Bypass -File verify_all.ps1

# 或分开跑
cd backend && venv/Scripts/python.exe -X utf8 -m pytest -q   # 185 用例
cd frontend && npx jest                                    # 252 用例
cd frontend && pnpm run build                              # 生产构建
```

***

## 📑 文档导航

| 文档                                                                         | 说明                                            |
| -------------------------------------------------------------------------- | --------------------------------------------- |
| 📋 [agent.md](agent.md)                                                    | **完整技术文档**（赛题映射 / Multi-Agent 详解 / 知识图谱 / 部署） |
| 📊 [丰富化执行报告](docs/enrichment-report-20261006.html)                        | T1–T8 开源技术落地 before/after 图集与验证汇总            |
| 🌙 [夜间巡查报告](docs/night-run/)                                                | 自主执行修复与架构升级的两轮 HTML 晨报                        |
| 🕸️ [知识图谱 RAG 引用设计](docs/plans/2026-06-11-knowledge-graph-rag-citation.md) | 知识图谱设计文档                                      |
| 🐛 [缺陷修复报告](docs/plans/2026-06-30-defect-fix-report.md)                    | 历史缺陷修复                                        |
| ⚙️ [管理后台优化方案](docs/plans/admin-dashboard-optimization.md)                  | 管理员后台方案                                       |
| 🔄 [个性化教学工作流改造方案](docs/个性化教学工作流产品化改造方案.md)                                    | 工作流产品化设计                                      |
| 🗄️ [数据库设计文档](docs/EduAI-Pro-数据库设计文档.md)                                   | 数据模型与表结构                                      |
| 🏗️ [系统架构设计文档](docs/EduAI-Pro-系统架构设计文档.md)                                 | 架构分层与模块划分                                     |
| 🚀 [安装部署指南](docs/安装部署指南.md)                                                | 生产环境部署                                        |
| 📘 [项目 AI 行为准则](CLAUDE.md)                                                 | AI 协作规范                                       |

***

## ❓ 常见问题

<details>
<summary><b>🔌 登录页面提示 "Network Error"？</b></summary>

**最常见原因：后端 Flask 服务未启动。** 前端通过 Vite 代理 `/api → http://localhost:5000` 访问后端。

排查步骤：

1. 打开后端终端，确认 `python src/main.py` 正在运行且无报错
2. 浏览器直接访问 `http://localhost:5000/api/me`，应返回 401（说明后端存活）
3. 查看后端控制台是否有 `[Proxy Error]` 日志（来自 Vite 代理）
4. 确认 `backend/.env` 中 `SPARK_API_PASSWORD` 已配置（不配置启动也会失败）

</details>

<details>
<summary><b>🔍 语义检索返回"无语义命中"？</b></summary>

语义检索（BGE + Qdrant local）需要先建索引：

```bash
# 已登录会话下触发全量重建（对全部已发布知识点编码入库）
curl -X POST http://localhost:5000/api/search/semantic/reindex \
     -H "Content-Type: application/json" -d '{}'
```

- 首次建索引会下载 BGE 模型权重（~100MB）；国内可设 `HF_ENDPOINT=https://hf-mirror.com` 且 `HF_HUB_DISABLE_XET=1` 规避镜像下载问题，随后落 `~/.cache/fastembed` **离线复用**
- 索引按课程过滤：当前课程没有已发布知识点时会提示无语义命中，切到有知识点的课程即可
- 彻底关闭该功能：`VECTOR_SEARCH_ENABLED=false`（服务返回 `ok:false`，前端提示不可用，不报错）
- 向量库存放在 `backend/instance/qdrant/`（不入库），删了重建即可

</details>

<details>
<summary><b>🕸️ 知识图谱支持哪些文件？</b></summary>

| 格式      | 解析库              | 大小限制  |
| ------- | ---------------- | ----- |
| `.docx` | python-docx 1.1+ | 20 MB |
| `.pdf`  | PyMuPDF (fitz)   | 20 MB |

支持多页 PDF 文字层解析，Word 基于 XML 解析。

</details>

<details>
<summary><b>🗄️ Redis / Elasticsearch 没装能用吗？</b></summary>

可以。两者都是**可选**组件：

- **Redis**：仅 Celery 异步任务与缓存需要；未配置时走同步降级，不影响核心功能
- **Elasticsearch**：全文搜索增强；默认 `ELASTICSEARCH_ENABLED=false` 走 SQLite fallback。语义检索走的是独立链路（BGE+Qdrant local），与 ES 无关

</details>

<details>
<summary><b>🌐 跨域 (CORS) 报错？</b></summary>

开发环境走 Vite 代理（`vite.config.js` 已配置），**通常无需处理 CORS**。生产环境由前端目录下的 [nginx.conf](frontend/nginx.conf) 反向代理 `/api` 与 `/uploads` 到后端。

</details>

<details>
<summary><b>🔑 如何配置讯飞 API 凭据？</b></summary>

复制 `backend/.env.example` 为 `backend/.env` 并填入（**该文件不入库**）：

```bash
# 讯飞 Spark 星火大模型
SPARK_API_PASSWORD=your_api_password
SPARK_API_URL=https://spark-api-open.xf-yun.com/v1/chat/completions
SPARK_MODEL=ultra

# 讯飞智能 PPT 生成（可选，用于 PPT 生成功能）
XFYUN_PPT_APP_ID=your_ppt_app_id
XFYUN_PPT_API_SECRET=your_ppt_api_secret
```

API 申请：<https://www.xfyun.cn/>

</details>

***

## 🧪 测试与构建

```bash
# 后端测试
cd backend && venv/Scripts/python.exe -X utf8 -m pytest -q

# 前端测试
cd frontend && npx jest                # 27 套件 252 用例
cd frontend && npx jest --coverage     # 覆盖率报告

# 生产构建
cd frontend && pnpm build              # 输出到 dist/（含 PWA service-worker）

# 三段式总验证（推荐）
powershell -ExecutionPolicy Bypass -File verify_all.ps1
```

***

## ⭐ 如果这个项目对你有帮助，欢迎 Star！

**祝使用愉快 · 答辩顺利** 🎉
