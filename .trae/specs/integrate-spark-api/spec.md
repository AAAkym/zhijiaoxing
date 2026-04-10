# 讯飞星火API集成规范

## Why
用户提供了讯飞星火大模型的完整API凭证（包括API密码、AppID、APISecret、APIKey），需要将这些凭证正确配置到系统中，并确保教师端和学生端的四个核心AI功能模块能够正常调用该API，实现智能内容生成、题目生成、错题分析和AI学习助手功能。

## What Changes
- 更新后端环境配置文件(.env)，使用用户提供的API密码格式进行认证
- 验证教师端内容生成区域的API调用链路完整性
- 验证考核管理题目生成功能的API集成
- 验证学生端错题本AI学情分析功能的API连接
- 验证学生端AI学习助手对话功能的API可用性
- 添加API配置验证和错误处理机制

## Impact
- Affected specs: 无（独立的新功能配置）
- Affected code:
  - backend/.env（API凭证配置）
  - backend/src/services/spark_service.py（API服务层）
  - backend/src/routes/ai_assistant.py（AI助手路由）
  - backend/src/routes/mistake_book.py（错题本路由）
  - frontend/src/components/TeacherDashboard.jsx（教师端内容生成UI）
  - frontend/src/components/AIChatPanel.jsx（学生端AI学习助手UI）
  - frontend/src/components/MistakeBook/AIAnalysisPanel.jsx（错题分析UI）

## ADDED Requirements

### Requirement: API凭证安全配置
系统 SHALL 在后端.env文件中安全存储讯飞星火API凭证信息：
- 使用SPARK_API_PASSWORD字段存储完整的API密码（格式：APIKey:APISecret）
- 配置SPARK_APP_ID用于应用标识
- 确保API URL、模型名称等参数正确设置
- 支持超时时间配置以适应不同网络环境

#### Scenario: 成功配置API凭证
- **WHEN** 用户在.env文件中提供正确的API密码和AppID
- **THEN** 系统能够成功解析凭证并建立与讯飞星火API的连接
- **AND** 所有AI功能模块可以正常调用API服务

### Requirement: 教师端内容生成功能
系统 SHALL 为教师提供基于AI的内容生成能力：
- 根据课程标题和主题自动生成教学内容
- 支持知识库参考增强生成质量
- 提供流式输出体验，实时显示生成进度
- 生成内容包括核心概念、关键步骤、常见误区等结构化信息

#### Scenario: 教师成功生成教学内容
- **WHEN** 教师选择课程并输入主题后点击"生成内容"按钮
- **THEN** 系统调用讯飞星火API生成相关教学内容
- **AND** 内容以流式方式实时显示在界面上
- **AND** 生成完成后可保存至数据库并与视频关联

### Requirement: 考核管理题目生成功能
系统 SHALL 为教师提供智能化的考核题目生成能力：
- 根据课程主题自动生成选择题（支持自定义数量）
- 题目包含题干、选项、正确答案索引、详细解析
- 支持难度等级控制（easy/medium/hard）
- 生成的题目符合JSON标准格式，可直接导入考核系统

#### Scenario: 教师成功生成考核题目
- **WHEN** 教师在考核管理界面输入主题和题目数量
- **THEN** 系统调用API生成指定数量的高质量选择题
- **AND** 返回的题目数据符合系统要求的JSON格式
- **AND** 每道题都包含完整的选项和解析信息

### Requirement: 学生端错题本AI学情分析
系统 SHALL 为学生提供智能化的错题分析和学习建议：
- 对单个错题进行深度错误原因分析
- 识别知识点漏洞并提供针对性学习建议
- 支持批量错题综合分析，识别错误模式
- 提供流式输出，提升用户体验
- 分析结果保存至数据库供后续查看

#### Scenario: 学生成功获取错题AI分析
- **WHEN** 学生在错题本中点击某道错题的"AI分析"按钮
- **THEN** 系统调用API对该错题进行全面分析
- **AND** 以流式方式展示错误原因、知识点漏洞和学习建议
- **AND** 分析结果自动保存至数据库

#### Scenario: 学生批量分析多个错题
- **WHEN** 学生选择多道错题并点击"批量分析"
- **THEN** 系统对选中的错题进行综合模式分析
- **AND** 输出整体错误模式、薄弱环节汇总和系统性学习建议

### Requirement: 学生端AI学习助手
系统 SHALL 为学生提供个性化的AI学习助手对话功能：
- 支持多种AI风格切换（学术型、幽默型、鼓励型、简洁型）
- 结合上下文和知识库进行智能问答
- 支持流式对话，实时显示回答过程
- 维护对话历史记录，支持会话持久化
- 超出知识范围时诚实说明并建议咨询老师

#### Scenario: 学生与AI助手成功对话
- **WHEN** 学生在学习页面打开AI助手并输入问题
- **THEN** 系统根据学生的AI风格偏好调用API生成回答
- **AND** 回答以流式方式逐字显示
- **AND** 对话历史自动保存并可恢复

## MODIFIED Requirements

### Requirement: API认证机制优化
将现有的API_KEY+API_SECRET组合认证方式修改为直接使用API_PASSWORD认证：
- 优先读取SPARK_API_PASSWORD环境变量
- 保持向后兼容性，当未设置PASSWORD时仍支持KEY+SECRET组合
- 在请求头中正确设置Authorization: Bearer token
- 设置X-Appid头传递应用标识

## REMOVED Requirements
无
