# 学生端练习评测与错题本优化 Spec

## Why
学生端应用在练习评测模块存在第四题完成时出现黑屏的严重问题，影响用户体验；错题本功能需要全面的完整性检测；练习评测与错题本之间缺乏可靠的实时同步机制，导致数据不一致，影响学习效率。

## What Changes
- **修复练习评测第四题黑屏问题**：定位并彻底解决用户完成第四题时页面黑屏的根因，增加边界条件防护
- **全面检测与优化错题本功能**：对错题本的开始复习流程、列表加载、详情查看等核心场景进行完整性测试和稳定性优化
- **实现练习评测-错题本实时同步机制**：确保练习提交后错题能实时、准确地同步到错题本，并基于错题数据进行学习内容整理优化

## Impact
- Affected specs: 练习评测模块、错题本模块
- Affected code:
  - 前端: `frontend/src/components/Practice/` (QuestionPanel.jsx, PracticeContext.jsx, ResultPage.jsx, index.jsx)
  - 前端: `frontend/src/components/MistakeBook/` (index.jsx, MistakeList.jsx, MistakeDetail.jsx, MistakeReview.jsx)
  - 后端: `backend/src/routes/student.py` (sync_practice_data, _extract_mistakes_from_submission)
  - 后端: `backend/src/routes/mistake_book.py` (错题本全部API)
  - 数据模型: `backend/src/models/course.py` (MistakeRecord, PracticeEvaluation, Assessment)

## ADDED Requirements

### Requirement: 练习评测第四题黑屏问题修复
系统 SHALL 确保练习评测模块在任何题目数量下均能正常渲染，不会因题目索引越界、数据格式异常或状态管理错误导致黑屏。

#### Scenario: 完成第四题时不出现黑屏
- **WHEN** 用户在练习评测中答题到第四题（index=3）或切换至该题
- **THEN** 页面 SHALL 正常渲染题目内容（题干、选项/输入框、导航栏），不出现空白/黑屏
- **AND** 导航栏中第四题按钮 SHALL 正确高亮显示当前题目位置
- **AND** 题目切换功能（上一题/下一题）在第四题处 SHALL 正常工作

#### Scenario: 边界条件防护
- **WHEN** 题目数据包含缺失字段（如缺少 options、question、correctAnswer 等）
- **THEN** 系统 SHALL 使用合理的默认值进行降级渲染，而非崩溃或黑屏
- **WHEN** questions 数组为空或 currentIndex 越界
- **THEN** 系统 SHALL 显示友好的错误提示界面，而非空白页

### Requirement: 错题本功能完整性与稳定性
系统 SHALL 提供完整、稳定的错题本功能，覆盖从错题收集到复习闭环的全部核心交互场景。

#### Scenario: 开始复习流程正常
- **WHEN** 用户点击"开始复习"按钮
- **THEN** 系统 SHALL 根据加权算法正确抽取待复习错题
- **AND** 复习界面 SHALL 正确展示题目内容、选项和作答区域
- **AND** 提交复习结果后 SHALL 正确更新掌握状态

#### Scenario: 错题列表加载与展示正常
- **WHEN** 用户进入错题本页面
- **THEN** 错题列表 SHALL 在合理时间内加载完成并正确展示
- **AND** 支持按课程筛选、按掌握状态筛选、分页浏览
- **AND** 每条错题记录 SHALL 正确显示题目内容摘要、错误次数、掌握状态等信息

#### Scenario: 错题详情查看正常
- **WHEN** 用户点击某条错题记录查看详情
- **THEN** 详情页 SHALL 展示完整的题目内容、用户答案、正确答案
- **AND** 支持 AI 分析功能和状态更新操作

### Requirement: 练习评测-错题本实时同步
系统 SHALL 在练习评测提交后自动、实时地将错题同步到错题本，保证两端数据一致。

#### Scenario: 练习提交后错题自动同步
- **WHEN** 用户完成练习评测并提交答案
- **THEN** 系统 SHALL 自动识别所有答错的题目
- **AND** 将错题信息（题目内容、用户答案、正确答案、知识点标签等）实时写入错题本
- **AND** 同步结果 SHALL 在前端给出明确反馈（同步成功/失败及错题数量）

#### Scenario: 错题去重与更新
- **WHEN** 同一道题目再次被做错
- **THEN** 系统 SHALL 更新已有错题记录的错误次数和时间戳
- **AND** 将掌握状态重置为"未掌握"
- **AND** 不创建重复的错题记录

#### Scenario: 学习内容系统性整理
- **WHEN** 错题本中有新的错题数据
- **THEN** 系统 SHALL 基于知识点标签统计薄弱环节
- **AND** 为用户提供针对性的复习建议和学习路径

## MODIFIED Requirements

### Requirement: 练习评测提交流程
现有的练习提交流程 SHALL 增加同步状态的明确反馈和错误恢复机制：
- 提交成功后 SHALL 显示同步到错题本的结果（新增/更新了多少道错题）
- 同步失败时 SHALL 有明确的错误提示和重试机制
- 本地缓存机制 SHALL 与在线同步形成互补

### Requirement: 错题本数据一致性
错题本的数据查询和展示 SHALL 确保与练习评测数据的实时一致：
- 刷新错题本列表时 SHALL 能看到最新的练习错题
- 错题统计数据 SHALL 准确反映当前所有错题状态
- 复习完成后状态变更 SHALL 立即在列表中体现

## REMOVED Requirements
无
