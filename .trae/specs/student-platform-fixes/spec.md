# 学生端平台关键功能修复 Spec

## Why
学生端平台存在四个关键功能缺陷：(1) 练习评测与错题本之间出现重复错题数据，且学生概览界面未正确体现最新错题信息；(2) 错题本AI错因分析模块未正确接入真实API，分析结果不准确或缺失；(3) 学习笔记加载时出现"Authentication required"认证失败错误；(4) 新建笔记无法成功保存。这些问题严重影响核心学习流程的可用性。

## What Changes
- **修复练习评测-错题本重复数据问题**：排查并修复错题重复导入的根因，确保每次练习提交只产生唯一的错题记录；在学生概览页面实时展示最新的错题统计
- **修复AI错因分析API接入**：确保AI错因分析使用真实的spark_service API调用，传递完整的题目内容、学生答案、正确答案和解析信息
- **修复学习笔记认证失败问题**：排查笔记加载时的Authentication required错误，修复session/cookie认证链路
- **修复新建笔记保存失败问题**：检查前端提交逻辑和后端处理流程，确保新笔记能成功创建和持久化

## Impact
- Affected specs: 学生概览、练习评测、错题本、学习笔记
- Affected code:
  - 前端: `frontend/src/components/StudentDashboard.jsx`（错题统计展示）
  - 前端: `frontend/src/components/StudyNotes/index.jsx`（笔记加载）
  - 前端: `frontend/src/components/StudyNotes/NoteEditor.jsx`（笔记保存）
  - 前端: `frontend/src/components/MistakeBook/MistakeDetail.jsx`（AI分析触发）
  - 前端: `frontend/src/services/api.js`（请求函数、认证处理）
  - 后端: `backend/src/routes/student.py`（sync_practice_data、_extract_mistakes_from_submission）
  - 后端: `backend/src/routes/mistake_book.py`（extract_mistakes、analyze_mistake）
  - 后端: `backend/src/routes/notes.py`（get_notes、create_note）
  - 后端: `backend/src/services/spark_service.py`（analyze_mistake）

## ADDED Requirements

### Requirement: 练习评测错题去重与概览同步
系统 SHALL 确保练习评测提交后产生的错题记录唯一且准确，并在学生概览中实时反映。

#### Scenario: 练习提交后无重复错题
- **WHEN** 用户完成练习评测并提交答案
- **THEN** 系统 SHALL 仅在错题本中创建唯一对应的错题记录（同一assessment+question_index组合不重复）
- **AND** 若同一题目再次做错，系统 SHALL 更新已有记录而非创建新记录

#### Scenario: 学生概览实时展示错题统计
- **WHEN** 用户在学生概览页面查看学习数据
- **THEN** 概览页 SHALL 展示来自错题本API的最新统计数据（总数、未掌握、复习中、已掌握）
- **AND** 练习提交后切换回概览视图时 SHALL 自动刷新错题统计

### Requirement: AI错因分析真实API接入
系统 SHALL 通过真实AI API进行错因分析，基于完整的题目和作答数据生成有价值的分析结果。

#### Scenario: AI错因分析使用完整数据
- **WHEN** 用户在错题详情页点击AI分析按钮
- **THEN** 系统 SHALL 向spark_service发送包含题目内容、学生选项、正确答案、解析说明的完整数据
- **AND** 返回的分析结果 SHALL 包含错误原因、知识点漏洞识别和学习建议

#### Scenario: AI分析结果正确展示
- **WHEN** AI分析完成后
- **THEN** 分析结果 SHALL 在错题详情页正确渲染展示（支持流式和非流式两种模式）

### Requirement: 学习笔记认证与加载修复
系统 SHALL 确保学习笔记的加载和显示功能正常工作，不再出现认证错误。

#### Scenario: 笔记列表正常加载
- **WHEN** 用户进入学习笔记页面
- **THEN** 系统 SHALL 成功通过认证并返回用户的笔记列表
- **AND** 不再出现 "Authentication required" 错误

#### Scenario: 笔记内容完整显示
- **WHEN** 笔记列表加载完成
- **THEN** 每条笔记的标题、内容、标签、时间等信息均 SHALL 完整正确显示

### Requirement: 笔记保存功能修复
系统 SHALL 确保用户创建的新笔记能够成功保存到后端并立即在列表中可见。

#### Scenario: 新建笔记保存成功
- **WHEN** 用户填写完整的笔记信息（标题、内容、课程）并点击保存
- **THEN** 系统 SHALL 成功将笔记数据提交到后端API并得到201成功响应
- **AND** 笔记列表 SHALL 自动刷新，新笔记出现在列表中

#### Scenario: 笔记保存错误友好提示
- **WHEN** 笔记保存因网络或服务器原因失败
- **THEN** 系统 SHALL 显示明确的错误提示信息，帮助用户理解失败原因

## MODIFIED Requirements

### Requirement: 练习提交流程
现有的练习提交后的错题提取逻辑 SHALL 增加去重检查：
- 提取前先查询是否已存在相同 assessment_id + question_index 的错题记录
- 存在则更新，不存在则新建
- 提取完成后主动刷新错题本统计数据

### Requirement: 认证机制
前端的请求函数和后端的session认证 SHALL 协调一致：
- 确保所有需要认证的API请求都携带有效的session凭证
- 认证失败时前端给出清晰的登录引导提示

## REMOVED Requirements
无
