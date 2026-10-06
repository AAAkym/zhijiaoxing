# 09-recon-round2.md · 第二轮架构调研档案（精简归档）

> 完整调研报告由后台调研 agent 产出（12 个候选仓库、star 数经 GitHub API 核实）。
> 本文件只归档结论与落点，供下一轮直接引用。

## 候选清单与结论

| # | 候选 | star | 结论 | 落点 |
|---|---|---|---|---|
| 1 | langfuse/langfuse（trace 树+延迟瀑布） | 35.4k | **已仿制落地** | G2-01 协作流水线时间线（bab92d8） |
| 2 | geekan/MetaGPT（SOP 阶段条） | 70.8k | **已仿制落地** | G2-02 六阶段等待面板（90f018b） |
| 3 | onyx-dot-app/onyx（SSE 类型化流包） | 32.3k | 仅方案 | 坑位卡 P-2：生成链路 SSE 事件化 |
| 4 | OpenBMB/ChatDev（流水线回放器） | 34.4k | 仅方案 | 生成完成后"过程回放"抽屉 |
| 5 | microsoft/autogen（消息流+Debrief） | 61.3k | 仅方案 | 与 P-2 同一套 SSE 的消息流 |
| 6 | vercel/ai-chatbot（Reasoning 折叠块） | 21k | 仅方案 | 学生端答疑"思考中"折叠 |
| 7 | RAG 引用范式（Onyx/open-webui 共识） | — | 仅方案 | 坑位卡 P-1：依据链证据卡化 |
| 8 | langchain-ai/langgraph（状态机图） | 42.7k | 仅方案 | cytoscape 静态编排图（仅管理员端） |
| 9 | langflow/Flowise（节点画布） | 155k/55k | **不引入** | 编排固定，画布属过度设计 |
| 10 | crewAIInc/crewAI（任务层级） | 59.4k | 仅方案 | 执行历史三级分组 |
| 11 | AgentVerse（课堂模拟） | 5.2k | 仅灵感 | 已停更 |

## 统一数据模型建议（下一轮多个呈现共用）

`{ request_id, stages: [{ stage, agents[], status, started_at, ended_at, tokens, artifacts[], evidence[] }] }`
——同时驱动进度条、瀑布、消息流、回放与依据卡，五个界面一个模型。

## 今晚踩坑记录（供第三轮避让）

1. 课程生成链路（course_generation_service）直调 spark_service，**不写 agent_execution_logs**
   ——做实时协作可视化时不能指望它有日志，需先 SSE 化（P-2）。
2. Spark API 当夜两次 read timeout=120s：LLM 依赖的长耗时是端到端复验的主要阻碍，
   建议给 generate_step 加超时下探（如 60s 快速失败）+ 重试一次。
3. 前端 dev server（后台 shell 启动）会在长会话中途被回收，导致浏览器白屏——
   第三轮应每阶段开工前探活服务。
4. hash 路由页面内组件切换时 Playwright 定位偶发超时：同 cell 内连贯操作 +
   DOM evaluate 直点是有效的兜底手段。
