# Tasks

- [x] Task 1: 修复练习评测与错题本重复数据问题及概览同步
  - [x] SubTask 1.1: 排查 student.py sync_practice_data 中 _extract_mistakes_from_submission 的调用逻辑，确认是否与 mistake_book.py 中的 extract_mistakes API 存在重复提取
  - [x] SubTask 1.2: 检查去重逻辑——同一 assessment_id + question_index 组合是否正确判断已有记录并更新而非新建（已实现智能状态回退：mastered→reviewing→unmastered）
  - [x] SubTask 1.3: 在 StudentDashboard.jsx 中确保练习提交后切换回概览视图时自动刷新 mistakeStats 数据（completePractice后+useEffect监听currentView）
  - [x] SubTask 1.4: 验证重复问题已解决，提交练习后在错题本中无重复记录

- [x] Task 2: 修复AI错因分析真实API接入
  - [x] SubTask 2.1: 检查 MistakeDetail.jsx 中触发AI分析的代码，确认调用的是 analyze_mistake_stream，传递的参数完整
  - [x] SubTask 2.2: 检查 spark_service.py 的 analyze_mistake 函数正确调用 chat() 接口接入真实LLM（确认已正确调用）
  - [x] SubTask 2.3: 确保AI分析请求包含题目解析(explanation)字段作为上下文信息（新增explanation参数和【题目解析】prompt section）
  - [x] SubTask 2.4: 验证AI分析功能端到端可用：点击分析→显示加载→流式输出结果→保存分析内容

- [x] Task 3: 修复学习笔记加载认证失败问题
  - [x] SubTask 3.1: 排查 "Authentication required" 错误根因——在 api.js request函数中增加401特殊处理（isAuthError标记）
  - [x] SubTask 3.2: 检查 notes.py 后端 get_notes 的 require_auth 装饰器与前端 session 管理的一致性（前端增加智能错误区分）
  - [x] SubTask 3.3: 检查 api.js 中 notes 相关的请求路径是否正确（路径确认无误，增强错误提示）
  - [x] SubTask 3.4: 修复认证链路中的断点——StudyNotes/index.jsx 区分认证错误和其他错误，给出友好提示

- [x] Task 4: 修复新建笔记无法保存的问题
  - [x] SubTask 4.1: 排查 NoteEditor.jsx 的 handleSave → onSave 回调 → StudyNotes index.jsx 中实际调用的API函数链路
  - [x] SubTask 4.2: 检查 createNote API 调用时传递的数据格式是否匹配后端要求
  - [x] SubTask 4.3: 检查后端 create_note 是否有额外的字段校验导致400错误未被友好处理（增加了按HTTP状态码的错误映射）
  - [x] SubTask 4.4: 修复保存逻辑中的问题——NoteEditor.jsx 增加详细错误映射表（401/400/404分类处理）

# Task Dependencies
- Task 1 和 Task 2 可并行执行（涉及不同模块）✅
- Task 3 和 Task 4 可并行执行（同属笔记模块但独立问题）✅
- 所有任务均无交叉依赖 ✅
