# AI错因分析与靶向治疗集成修复 Spec

## Why
用户反馈两个核心问题：(1) AI完成错因分析后，分析结果未能正确、完整地展示给用户；(2) 靶向治疗功能需基于错题的AI分析结果自动生成专项练习题，且两个模块应无缝集成——用户查看错因分析后可直接获取对应的靶向练习。当前系统存在SSE流式响应完成后数据持久化与前端状态同步的时序问题，以及靶向治疗模块与AI分析结果之间缺乏直接关联。

## What Changes
- 修复 AIAnalysisPanel 中流式分析完成后数据展示的可靠性问题（状态同步、持久化确认）
- 在 MistakeDetail 的 AIAnalysisPanel 底部增加"生成靶向练习"快捷入口按钮，点击后跳转至靶向治疗Tab并携带当前错题的知识点上下文
- 优化 TargetedTherapy 组件支持从单条错题触发模式（基于该错题的AI分析结果生成练习），增强与AI分析的联动性
- 确保分析结果在流式传输完成后正确回写到数据库并在前端稳定显示

## Impact
- Affected specs: 错题本核心流程、AI分析交互、靶向治疗推荐
- Affected code:
  - 前端: `AIAnalysisPanel.jsx`, `MistakeDetail.jsx`, `TargetedTherapy.jsx`, `MistakeBook/index.jsx`
  - 后端: `mistake_book.py` (analyze/stream 接口)

## ADDED Requirements

### Requirement: AI分析完成后结果可靠展示
系统 SHALL 确保 AI 流式分析完成后：
1. 分析文本在前端 `analysis` 状态中完整保留并渲染
2. 后端已将 `full_text` 写入数据库 `ai_analysis` 字段
3. 前端通过 `onAnalysisComplete` 回调更新父组件状态，确保用户切换视图再返回时仍能看到分析结果
4. 流式传输异常中断时，已接收的部分内容不丢失

#### Scenario: 正常完成分析
- **WHEN** 用户在 MistakeDetail 中点击"开始分析"，SSE 流正常返回全部内容并发送 done 信号
- **THEN** 分析面板展示完整的 Markdown 格式化分析内容（错误原因/知识点/学习建议/学习路径各板块），绿色"分析完成！"提示至少显示1.5秒后消失，`onAnalysisComplete` 回调被调用将分析文本传递给 MistakeDetail

#### Scenario: 快速响应场景
- **WHEN** Spark API 在1秒内返回全部内容（如服务未配置时的回退文本）
- **THEN** 加载动画和分析中提示至少保持1.5秒总显示时间，避免内容闪现

### Requirement: AI分析到靶向治疗的快速入口
系统 SHALL 在 AIAnalysisPanel 分析完成后，提供一个"基于此错因生成靶向练习"的操作入口。

#### Scenario: 从错因分析跳转靶向治疗
- **WHEN** 用户在 MistakeDetail 页面完成了某道错题的 AI 错因分析，且分析内容非空
- **THEN** AIAnalysisPanel 底部显示"🎯 基于此错因生成靶向练习"按钮，点击后：
  - 切换至 MistakeBook 的"靶向治疗"Tab
  - 将当前错题的课程ID和知识点标签作为筛选条件传入 TargetedTherapy
  - 自动聚焦于与当前错题薄弱点匹配的练习题目

## MODIFIED Requirements

### Requirement: 靶向治疗支持单题触发模式
原 TargetedTherapy 仅支持从全局错题数据生成方案，修改为支持两种触发模式：
1. **全局模式**（原有）：加载所有错题的靶向练习方案
2. **单题模式**（新增）：基于指定错题的AI分析结果，聚焦生成针对该错题知识点的专项练习

#### Scenario: 单题触发靶向治疗
- **WHEN** 用户从 MistakeDetail 的 AIAnalysisPanel 点击"生成靶向练习"
- **THEN** TargetedTherapy 以单题模式初始化，标题显示"针对 [题目摘要] 的靶向练习"，方案仅包含与该错题知识点匹配的题目

## REMOVED Requirements
无
