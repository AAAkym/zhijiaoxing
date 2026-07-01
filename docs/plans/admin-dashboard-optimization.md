# 管理员端优化方案

> 本文档基于软件杯 A3 赛题要求，分析管理员端当前实现并提出优化方向，旨在提升系统的创新价值与实用性（35%）、功能实现及技术要求（45%）。

---

## 一、当前功能现状分析

### 1.1 已实现功能模块

| 功能模块 | 实现内容 | 实现位置 |
|---|---|---|
| **系统概览** | 用户统计、课程统计、在线用户、系统状态卡片 | `AdminDashboard.jsx` (L91-176) |
| **AI 内容审核** | AI 生成内容质量评分、版本对比、操作日志 | `AIContentReview/index.jsx` |
| **AI 智能分析** | 流失预测、内容趋势、教学归因、资源优化洞察 | `AIAnalysisDashboard.jsx` |
| **Token 用量** | API 调用统计、趋势图、用户排名、明细记录 | `TokenUsage.jsx` |
| **用户管理** | CRUD 操作、角色分配、分页查询 | `UserManagement.jsx` + `admin.py` (L25-52) |
| **课程管理** | 基础课程管理功能 | `CourseManagement.jsx` |
| **数据分析** | 用户增长、课程活跃度、学习进度、日活动量图表 | `DataAnalytics.jsx` |
| **系统设置** | 基础/AI/邮件/安全/备份配置，支持 AI 和邮件测试 | `SystemSettings.jsx` + `admin.py` (L794-999) |

### 1.2 后端 API 端点（16 个）

| API 路径 | 功能 |
|---|---|
| `/admin/users` (GET/POST) | 用户列表/创建用户 |
| `/admin/users/<id>` (PUT/DELETE) | 更新/删除用户 |
| `/admin/token-usage/summary` | Token 用量汇总 |
| `/admin/token-usage/trend` | Token 用量趋势 |
| `/admin/token-usage/records` | Token 用量明细 |
| `/admin/token-usage/user-ranking` | 用户用量排名 |
| `/admin/dashboard/stats` | 仪表盘统计数据 |
| `/admin/dashboard/user_activity` | 用户活动数据 |
| `/admin/dashboard/course_stats` | 课程统计数据 |
| `/admin/settings` (GET/PUT) | 系统设置读写 |
| `/admin/settings/test-ai` | AI 配置测试 |
| `/admin/settings/test-email` | 邮件配置测试 |
| `/admin/settings/backup` | 数据备份 |

### 1.3 现状评估

| 维度 | 当前状态 | 赛题关联 | 优化空间 |
|---|---|---|---|
| **多智能体展示** | ❌ 未展示 Agent 运行状态 | 创新价值 35% | **高** - 需体现赛题核心 |
| **知识图谱管理** | ⚠️ 仅教师端有，管理员端缺失 | 功能实现 45% | **高** - 需全局管理视角 |
| **学习效果评估** | ⚠️ 分散在各模块，无汇总 | 加分项 F5 | **中** - 需统一仪表盘 |
| **成本控制** | ✅ Token 用量已有 | 实用性 | **中** - 可增加预警功能 |
| **安全审计** | ⚠️ AI 内容审核已有，操作日志分散 | NF3 防幻觉 | **中** - 可统一审计模块 |
| **性能监控** | ❌ 无响应时间监控 | NF4 响应时间 | **中** - 可增加性能指标 |

---

## 二、优化方向总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                    管理员端优化架构                                   │
├─────────────────────────────────────────────────────────────────────┤
│  P0 核心优化（赛题关键）                                              │
│  ├── 智能体监控与管理中心                                            │
│  │   ├── Agent 运行状态实时监控                                      │
│  │   ├── Agent 任务调度可视化                                        │
│  │   └── Agent 性能指标分析                                          │
│  └── 知识图谱全局管理中心                                            │
│      ├── 跨课程图谱统计                                              │
│      ├── 图谱质量评估                                                │
│      └── 图谱健康诊断                                                │
├─────────────────────────────────────────────────────────────────────┤
│  P1 重要优化（加分项）                                                │
│  ├── 学习效果评估汇总仪表盘                                          │
│  │   ├── 全平台学习效果指标                                          │
│  │   ├── 高风险学生预警                                              │
│  │   └── 画像趋势分析                                                │
│  └── 成本与资源优化                                                  │
│      ├── Token 用量预警                                              │
│      ├── 预算管理                                                    │
│      └── 资源生成成本分析                                            │
├─────────────────────────────────────────────────────────────────────┤
│  P2 增强优化（非功能需求）                                            │
│  ├── 安全与审计中心                                                  │
│  │   ├── 操作审计日志                                                │
│  │   ├── 内容安全监控                                                │
│  │   └── 数据备份管理                                                │
│  └── 系统性能监控                                                    │
│      ├── 响应时间统计                                                │
│      ├── SSE/WebSocket 稳定性                                        │
│      └── 错误率监控                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 三、P0 核心优化方案

### 3.1 智能体监控与管理中心

#### 3.1.1 功能设计

| 功能 | 详细说明 | UI 设计建议 |
|---|---|---|
| **Agent 运行状态实时监控** | 展示 8 个智能体的运行状态（运行中/空闲/错误）、当前任务队列长度、成功率 | 顶部状态栏 + 8 个 Agent 状态卡片（颜色区分） |
| **Agent 任务调度可视化** | 展示 Multi-Agent 协作流程图、任务分发路径、当前任务执行进度 | 流程图组件（Mermaid 或自定义 SVG） |
| **Agent 性能指标分析** | 各 Agent 平均响应时间、生成质量评分、Token 消耗对比 | 雷达图 + 柱状图对比 |

#### 3.1.2 数据模型设计

```python
# backend/src/models/agent_status.py

class AgentStatus(db.Model):
    """智能体状态记录"""
    __tablename__ = 'agent_status'

    id = db.Column(db.Integer, primary_key=True)
    agent_name = db.Column(db.String(50), nullable=False)  # coordinator/document/exercise/media/profile/project/recommendation/knowledge_graph
    status = db.Column(db.String(20), default='idle')  # running/idle/error/disabled
    current_task_id = db.Column(db.String(36))  # 当前任务 UUID
    task_count_today = db.Column(db.Integer, default=0)  # 今日任务数
    success_count_today = db.Column(db.Integer, default=0)  # 今日成功数
    error_count_today = db.Column(db.Integer, default=0)  # 今日错误数
    avg_response_time_ms = db.Column(db.Float, default=0)  # 平均响应时间（毫秒）
    last_active_at = db.Column(db.DateTime)  # 最后活跃时间
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentTaskLog(db.Model):
    """智能体任务日志"""
    __tablename__ = 'agent_task_log'

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(36), nullable=False)  # 任务 UUID
    coordinator_id = db.Column(db.String(36))  # 协调 Agent 分配的 ID
    agent_name = db.Column(db.String(50), nullable=False)  # 执行的 Agent
    task_type = db.Column(db.String(50))  # generate_document/generate_exercise/generate_video/update_profile...
    input_summary = db.Column(db.Text)  # 输入摘要
    output_summary = db.Column(db.Text)  # 输出摘要
    status = db.Column(db.String(20))  # pending/running/completed/failed
    response_time_ms = db.Column(db.Float)  # 响应时间
    token_used = db.Column(db.Integer)  # 消耗 Token
    quality_score = db.Column(db.Float)  # AI 评估的质量评分 (0-100)
    error_message = db.Column(db.Text)  # 错误信息
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

#### 3.1.3 API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/agents/status` | 获取所有 Agent 当前状态 |
| GET | `/admin/agents/performance` | 获取 Agent 性能指标统计 |
| GET | `/admin/agents/tasks/recent` | 获取近期任务日志（分页） |
| GET | `/admin/agents/tasks/flow?task_id=<id>` | 获取指定任务的协作流程 |
| POST | `/admin/agents/<name>/enable` | 启用指定 Agent |
| POST | `/admin/agents/<name>/disable` | 禁用指定 Agent |

#### 3.1.4 前端组件设计

```jsx
// frontend/src/components/admin/AgentMonitorCenter.jsx

/**
 * 智能体监控中心组件
 * 展示 8 个 Agent 的运行状态、任务调度流程、性能指标
 */

function AgentStatusCard({ agent }) {
  const statusColor = {
    running: 'bg-green-100 text-green-700 border-green-300',
    idle: 'bg-gray-100 text-gray-700 border-gray-300',
    error: 'bg-red-100 text-red-700 border-red-300',
    disabled: 'bg-yellow-100 text-yellow-700 border-yellow-300'
  }

  return (
    <Card className={`border-l-4 ${statusColor[agent.status]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">{agent.display_name}</h4>
            <p className="text-sm text-muted">{agent.description}</p>
          </div>
          <Badge>{agent.status}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>今日任务: {agent.task_count_today}</div>
          <div>成功率: {agent.success_rate}%</div>
          <div>响应: {agent.avg_response_time_ms}ms</div>
        </div>
      </CardContent>
    </Card>
  )
}

function AgentFlowVisualization({ taskId }) {
  // 使用 Mermaid 或自定义 SVG 展示任务流转
  // Coordinator → DocumentAgent → ExerciseAgent → ...
}

function AgentPerformanceRadar({ metrics }) {
  // 使用 Recharts RadarChart 展示各 Agent 性能对比
  // 维度：响应时间/成功率/质量评分/Token效率/用户满意度
}
```

#### 3.1.5 赛题评分关联

| 评分项 | 占比 | 本功能贡献 |
|---|---|---|
| 创新价值与实用性 | 35% | 直观展示 Multi-Agent 协同机制，体现系统智能化创新 |
| 功能实现及技术要求 | 45% | 展示多智能体架构的稳定运行，证明技术可行性 |

---

### 3.2 知识图谱全局管理中心

#### 3.2.1 功能设计

| 功能 | 详细说明 | UI 设计建议 |
|---|---|---|
| **跨课程图谱统计** | 全平台图谱节点总数、边总数、覆盖率、课程分布 | 统计卡片 + 课程图谱覆盖率柱状图 |
| **图谱质量评估** | 节点完整性评分（有描述/有难度）、关系准确性评估、孤立节点检测 | 质量评分雷达图 + 问题节点列表 |
| **图谱健康诊断** | 自动检测循环依赖、缺失 prerequisite、知识点断层 | 健康报告 + 问题分类统计 + 修复建议 |
| **图谱版本管理** | 图谱更新历史、版本对比、回滚能力 | 版本时间线 + 对比视图 |

#### 3.2.2 数据模型扩展

```python
# backend/src/models/knowledge_graph_health.py

class KnowledgeGraphHealthReport(db.Model):
    """知识图谱健康诊断报告"""
    __tablename__ = 'kg_health_report'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'))
    report_type = db.Column(db.String(20))  # daily/weekly/manual
    total_nodes = db.Column(db.Integer)
    total_edges = db.Column(db.Integer)
    orphan_nodes = db.Column(db.Integer)  # 孤立节点数
    cyclic_dependencies = db.Column(db.Integer)  # 循环依赖数
    missing_prerequisites = db.Column(db.Integer)  # 缺失前置依赖
    avg_node_completeness = db.Column(db.Float)  # 平均节点完整性 (0-100)
    avg_edge_confidence = db.Column(db.Float)  # 平均边置信度 (0-100)
    health_score = db.Column(db.Float)  # 综合健康评分 (0-100)
    issues = db.Column(db.JSON)  # 问题列表 [{type, node_id, description, suggestion}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class KnowledgeGraphVersion(db.Model):
    """知识图谱版本记录"""
    __tablename__ = 'kg_version'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'))
    version_number = db.Column(db.String(20))  # v1.0/v1.1...
    change_summary = db.Column(db.Text)  # 变更摘要
    nodes_snapshot = db.Column(db.JSON)  # 节点快照
    edges_snapshot = db.Column(db.JSON)  # 边快照
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

#### 3.2.3 API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/knowledge-graph/stats` | 全平台图谱统计汇总 |
| GET | `/admin/knowledge-graph/courses/<id>/health` | 课程图谱健康诊断 |
| POST | `/admin/knowledge-graph/courses/<id>/diagnose` | 触发图谱诊断 |
| GET | `/admin/knowledge-graph/courses/<id>/versions` | 图谱版本历史 |
| POST | `/admin/knowledge-graph/courses/<id>/rollback?version=<v>` | 回滚到指定版本 |

#### 3.2.4 前端组件设计

```jsx
// frontend/src/components/admin/KnowledgeGraphCenter.jsx

/**
 * 知识图谱全局管理中心
 * 跨课程统计、质量评估、健康诊断、版本管理
 */

function GraphStatsOverview({ stats }) {
  // 全平台图谱统计卡片
  // 总课程数 / 总节点数 / 总边数 / 平均覆盖率
}

function CourseGraphHealthTable({ courses }) {
  // 课程列表表格，展示各课程图谱健康评分
  // 支持点击进入详细诊断报告
}

function GraphHealthReport({ report }) {
  // 单课程健康诊断报告
  // 问题分类统计 + 问题节点列表 + AI 修复建议
}

function GraphVersionTimeline({ versions }) {
  // 版本时间线组件
  // 支持版本对比和回滚操作
}
```

#### 3.2.5 赛题评分关联

| 评分项 | 占比 | 本功能贡献 |
|---|---|---|
| 功能实现及技术要求 | 45% | 知识图谱是赛题核心功能，管理员全局管理体现系统完整性 |
| 创新价值与实用性 | 35% | 图谱健康诊断 + AI 修复建议，体现智能化创新 |

---

## 四、P1 重要优化方案

### 4.1 学习效果评估汇总仪表盘

#### 4.1.1 功能设计

| 功能 | 详细说明 |
|---|---|---|
| **全平台学习效果指标** | 综合学习进度完成率、知识点掌握率、测试通过率、练习正确率 |
| **高风险学生预警** | 基于画像自动识别学习困难学生（进度 < 30%、连续错题 > 5、活跃度低） |
| **画像趋势分析** | 全平台学生画像各维度分布变化趋势（知识基础、认知风格、易错点等） |
| **AI 评估报告汇总** | 各课程 AI 学习分析报告汇总展示，支持对比分析 |

#### 4.1.2 API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/learning-effect/overview` | 全平台学习效果指标汇总 |
| GET | `/admin/learning-effect/high-risk-students` | 高风险学生列表 |
| GET | `/admin/learning-effect/profile-trends` | 学生画像趋势分析 |
| GET | `/admin/learning-effect/course-reports` | 各课程 AI 评估报告汇总 |

#### 4.1.3 赛题评分关联

本功能对应赛题 **加分项 F5（学习效果评估）**，实现"多维度精准评估，动态调整推送策略和学习计划"的管理员视角汇总。

---

### 4.2 成本与资源优化

#### 4.2.1 功能设计

| 功能 | 详细说明 |
|---|---|---|
| **Token 用量预警** | 设置日/月阈值，超出自动告警 + 邓件通知管理员 |
| **预算管理** | 按月/季度设置 API 调用预算，实时消耗追踪，超预算自动限制 |
| **资源生成成本分析** | 各类型资源（文档/题目/视频/项目）的生成成本对比，优化建议 |
| **AI 成本优化建议** | AI 分析 Token 使用模式，提出节省建议（如批量生成、缓存策略） |

#### 4.2.2 数据模型扩展

```python
# backend/src/models/budget_config.py

class BudgetConfig(db.Model):
    """预算配置"""
    __tablename__ = 'budget_config'

    id = db.Column(db.Integer, primary_key=True)
    budget_type = db.Column(db.String(20))  # monthly/quarterly
    token_limit = db.Column(db.Integer)  # Token 上限
    cost_limit = db.Column(db.Float)  # 金额上限（元）
    alert_threshold = db.Column(db.Float)  # 预警阈值（百分比，如 80%）
    auto_limit = db.Column(db.Boolean, default=False)  # 超预算自动限制
    period_start = db.Column(db.DateTime)
    period_end = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

---

## 五、P2 增强优化方案

### 5.1 安全与审计中心

#### 5.1.1 功能设计

| 功能 | 详细说明 |
|---|---|---|
| **操作审计日志** | 全平台用户操作日志记录（登录、创建、修改、删除），支持按用户/时间/操作类型筛选 |
| **内容安全监控** | AI 生成内容安全评分趋势、敏感词拦截统计、违规内容处理记录 |
| **数据备份管理** | 自动备份状态、备份恢复测试、存储空间监控、手动触发备份 |

#### 5.1.2 赛题评分关联

对应赛题 **非功能需求 NF3（防幻觉与内容安全过滤机制）**，提供管理员视角的安全监控和审计能力。

---

### 5.2 系统性能监控

#### 5.2.1 功能设计

| 功能 | 详细说明 |
|---|---|---|
| **响应时间统计** | API 平均响应时间、SSE 流式输出延迟、WebSocket 连接延迟 |
| **SSE/WebSocket 稳定性** | 流式连接成功率、断开重连次数、平均连接时长 |
| **错误率监控** | API 错误率统计、4xx/5xx 分类、异常堆栈记录、自动告警 |

#### 5.2.2 赛题评分关联

对应赛题 **非功能需求 NF4（响应时间合理，提供生成进度追踪或流式呈现）**，提供性能监控和优化依据。

---

## 六、实现计划

### 6.1 阶段划分

| 阶段 | 周期 | 内容 | 优先级 |
|---|---|---|---|
| **阶段一** | 1-2 周 | 智能体监控与管理中心 | P0 |
| **阶段二** | 1 周 | 知识图谱全局管理中心 | P0 |
| **阶段三** | 1 周 | 学习效果评估汇总仪表盘 | P1 |
| **阶段四** | 0.5 周 | Token 用量预警 + 预算管理 | P1 |
| **阶段五** | 0.5 周 | 安全与审计中心 | P2 |
| **阶段六** | 0.5 周 | 系统性能监控 | P2 |

### 6.2 阶段一详细任务（智能体监控中心）

| 任务 | 说明 | 预估工作量 |
|---|---|---|
| 1. 创建 `AgentStatus` 和 `AgentTaskLog` 数据模型 | 后端数据库扩展 | 2h |
| 2. 在 Multi-Agent 服务中集成状态上报 | 修改 `shared_state.py` 添加状态同步 | 4h |
| 3. 创建 `/admin/agents/*` API 端点 | 后端路由和服务 | 4h |
| 4. 创建 `AgentMonitorCenter.jsx` 前端组件 | React 组件开发 | 6h |
| 5. 集成到 `AdminDashboard.jsx` 侧边栏 | 路由和菜单配置 | 1h |
| 6. 测试和调试 | 功能测试、边界测试 | 3h |

**阶段一总工作量：约 20 小时**

### 6.3 阶段二详细任务（知识图谱全局管理）

| 任务 | 说明 | 预估工作量 |
|---|---|---|
| 1. 创建 `KnowledgeGraphHealthReport` 数据模型 | 后端数据库扩展 | 2h |
| 2. 实现图谱健康诊断算法 | 孤立节点检测、循环依赖检测、缺失前置检测 | 6h |
| 3. 创建 `/admin/knowledge-graph/*` API 端点 | 后端路由和服务 | 4h |
| 4. 创建 `KnowledgeGraphCenter.jsx` 前端组件 | React 组件开发 | 6h |
| 5. 集成到管理员侧边栏 | 路由和菜单配置 | 1h |
| 6. 测试和调试 | 功能测试、性能测试 | 3h |

**阶段二总工作量：约 22 小时**

---

## 七、技术要点

### 7.1 Agent 状态实时同步方案

```python
# backend/src/services/multi_agent/shared_state.py 扩展

class SharedState:
    """多智能体共享状态 - 扩展状态上报"""

    def __init__(self):
        self._state = {}
        self._status_reporter = AgentStatusReporter()

    def update_agent_status(self, agent_name: str, status: str, task_id: str = None):
        """更新 Agent 状态并上报数据库"""
        self._state[f"{agent_name}_status"] = status
        self._status_reporter.report(agent_name, status, task_id)


class AgentStatusReporter:
    """Agent 状态上报器"""

    def report(self, agent_name: str, status: str, task_id: str = None):
        """将状态写入数据库"""
        from src.models.agent_status import AgentStatus

        record = AgentStatus.query.filter_by(agent_name=agent_name).first()
        if not record:
            record = AgentStatus(agent_name=agent_name)
            db.session.add(record)

        record.status = status
        record.current_task_id = task_id
        record.last_active_at = datetime.utcnow()

        if status == 'running':
            record.task_count_today += 1
        elif status == 'completed':
            record.success_count_today += 1
        elif status == 'error':
            record.error_count_today += 1

        db.session.commit()
```

### 7.2 图谱健康诊断算法

```python
# backend/src/services/kg_health_service.py

class KnowledgeGraphHealthService:
    """知识图谱健康诊断服务"""

    def diagnose(self, course_id: int) -> dict:
        """执行图谱健康诊断"""
        nodes = KnowledgeGraphNode.query.filter_by(course_id=course_id).all()
        edges = KnowledgeGraphEdge.query.filter_by(course_id=course_id).all()

        issues = []

        # 1. 孤立节点检测
        connected_nodes = set()
        for edge in edges:
            connected_nodes.add(edge.source_node_id)
            connected_nodes.add(edge.target_node_id)

        orphan_nodes = [n for n in nodes if n.id not in connected_nodes]
        for node in orphan_nodes:
            issues.append({
                'type': 'orphan_node',
                'node_id': node.id,
                'description': f'节点 "{node.label}" 无任何关联关系',
                'suggestion': '建议添加与其他知识点的关联关系'
            })

        # 2. 循环依赖检测 (DFS)
        graph = self._build_graph(edges)
        cycles = self._detect_cycles(graph)
        for cycle in cycles:
            issues.append({
                'type': 'cyclic_dependency',
                'description': f'存在循环依赖: {cycle}',
                'suggestion': '建议检查 prerequisite 关系是否合理'
            })

        # 3. 缺失前置依赖检测
        knowledge_nodes = [n for n in nodes if n.node_type == 'knowledge_point']
        for node in knowledge_nodes:
            prereqs = [e for e in edges if e.target_node_id == node.id and e.edge_type == 'prerequisite']
            if not prereqs and node.category == '核心知识点':
                issues.append({
                    'type': 'missing_prerequisite',
                    'node_id': node.id,
                    'description': f'核心知识点 "{node.label}" 缺少前置依赖',
                    'suggestion': '建议添加学习前置知识点'
                })

        # 计算健康评分
        health_score = 100 - len(issues) * 5  # 每个问题扣 5 分

        return {
            'total_nodes': len(nodes),
            'total_edges': len(edges),
            'orphan_nodes': len(orphan_nodes),
            'cyclic_dependencies': len(cycles),
            'missing_prerequisites': len([i for i in issues if i['type'] == 'missing_prerequisite']),
            'health_score': max(0, health_score),
            'issues': issues
        }

    def _build_graph(self, edges):
        """构建邻接图"""
        graph = {}
        for edge in edges:
            if edge.source_node_id not in graph:
                graph[edge.source_node_id] = []
            graph[edge.source_node_id].append(edge.target_node_id)
        return graph

    def _detect_cycles(self, graph):
        """DFS 检测循环依赖"""
        cycles = []
        visited = set()
        rec_stack = set()

        def dfs(node, path):
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in graph.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor, path)
                elif neighbor in rec_stack:
                    # 找到循环
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    cycles.append(cycle)

            path.pop()
            rec_stack.remove(node)

        for node in graph:
            if node not in visited:
                dfs(node, [])

        return cycles
```

---

## 八、预期效果

### 8.1 评分提升预期

| 评分项 | 当前贡献 | 优化后贡献 | 提升 |
|---|---|---|---|
| 创新价值与实用性 (35%) | 中等 | **高** - Multi-Agent 可视化 + 图谱健康诊断 | +15% |
| 功能实现及技术要求 (45%) | 高 | **更高** - 知识图谱全局管理 + Agent 监控 | +10% |
| 配套文档的丰富度 (10%) | 高 | 保持 | 0 |
| 演示视频、PPT 效果 (10%) | 中等 | **高** - Agent 监控界面演示效果好 | +5% |

**总体评分提升预期：+30% → 更高竞争力**

### 8.2 演示效果提升

| 场景 | 优化前 | 优化后 |
|---|---|---|
| **Multi-Agent 展示** | 无可视化界面，仅代码文档 | 实时监控界面，任务流转图，评委直观看到协同机制 |
| **知识图谱展示** | 仅教师端上传管理 | 管理员全局统计 + 健康诊断报告，体现系统完整性 |
| **学习效果展示** | 分散各模块 | 统一仪表盘 + 高风险预警，体现智能化评估 |

---

## 九、相关文档

| 文档 | 说明 |
|---|---|---|
| [README.md](../../README.md) | 项目总体说明 |
| [agent.md](../../agent.md) | Multi-Agent 架构与实现指南 |
| [知识图谱设计文档](2026-06-11-knowledge-graph-rag-citation.md) | 知识图谱技术细节 |

---

## 十、附录

### A. Agent 名称映射表

| Agent 名称 | 显示名称 | 功能描述 |
|---|---|---|
| `coordinator` | 协调 Agent | 总调度，任务分发，结果整合 |
| `document` | 文档 Agent | 课程讲解文档、知识点思维导图生成 |
| `exercise` | 练习 Agent | 选择题、填空题、编程题生成 |
| `media` | 媒体 Agent | 视频脚本、动画描述、多模态内容生成 |
| `profile` | 画像 Agent | 学生画像构建、更新、分析 |
| `project` | 项目 Agent | 代码实操案例、实践项目材料生成 |
| `recommendation` | 推荐 Agent | 拓展阅读材料、资源推荐 |
| `knowledge_graph` | 图谱 Agent | 知识图谱节点生成、关系推理 |

### B. 知识图谱节点类型

| 节点类型 | 说明 |
|---|---|
| `course` | 课程根节点 |
| `chapter` | 章节 |
| `knowledge_point` | 知识点 |
| `objective` | 学习目标 |
| `skill` | 技能要求 |
| `case` | 案例 |
| `exercise` | 练习/测试 |
| `resource` | 学习资源 |

---

**文档版本：v1.0**

**创建时间：2026-06-19**

**维护者：智教星开发团队**