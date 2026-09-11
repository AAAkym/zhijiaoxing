# EduAI Pro 数据库设计文档

## 1. 设计原则

数据库围绕用户、课程、知识点、学习行为、学情画像、推荐结果和智能体工作流建模，保证数据可追溯、关系清晰并支持后续扩展。

## 2. 核心实体

| 实体 | 关键字段 | 说明 |
|---|---|---|
| users | id, username, role, email, password_hash | 用户与角色 |
| courses | id, title, description, owner_id, status | 课程基本信息 |
| knowledge_points | id, course_id, name, parent_id | 课程知识点树 |
| learning_resources | id, course_id, type, title, uri, difficulty | 课件、习题、视频等资源 |
| learning_events | id, user_id, course_id, knowledge_point_id, event_type, score, duration | 学习行为事件 |
| student_profiles | id, user_id, mastery_json, preference_json, updated_at | 动态学情画像 |
| recommendations | id, user_id, resource_id, reason, score, status | 推荐结果及解释 |
| agent_tasks | id, workflow_id, agent_type, input_json, output_json, status | 智能体任务记录 |
| workflow_logs | id, workflow_id, event_type, payload_json, created_at | 协同流程审计 |

## 3. 实体关系

- 一个用户可以拥有多个学习事件、推荐记录和智能体任务。
- 一个课程包含多个知识点和学习资源。
- 一个学习事件可关联一个知识点，画像由用户的多条事件聚合生成。
- 推荐记录引用资源并保存推荐原因，支持后续效果评估。
- 智能体任务通过 `workflow_id` 关联同一轮协同过程，`workflow_logs` 记录状态变化。

## 4. 数据质量与约束

- 用户名、角色和课程标题不能为空；密码只保存哈希值。
- 学习时长不得为负数，分数限制在业务定义范围内。
- 删除课程前检查资源、知识点和学习记录的关联关系。
- 画像更新保留更新时间和来源事件，便于解释与回溯。
- 智能体输入、输出和工作流日志使用 JSON 字段保存结构化上下文，同时保留任务状态和时间戳。

## 5. 首季度实现范围

首季度完成用户、课程、学习行为和基础资源相关表的初步设计，并完成前后端工程中的基础数据链路。画像、推荐和智能体工作流表作为核心扩展模型，随下一阶段算法和协同功能完善后逐步启用。

