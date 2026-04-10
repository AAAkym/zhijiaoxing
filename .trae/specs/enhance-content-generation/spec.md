# 教师端内容生成与学生端同步展示优化 Spec

## Why
当前教师端内容生成功能缺少课程-视频层级选择，保存功能不够明确；学生端观看视频时无法同步查看相关教学讲义，影响学习体验。

## What Changes
- 教师端内容生成模块增加课程-视频层级选择功能
- 教师端内容生成页面增加明确的"保存内容"按钮及保存反馈
- 学生端课程学习页面增加视频关联讲义的同步展示功能

## Impact
- Affected code: 
  - frontend/src/components/TeacherDashboard.jsx
  - frontend/src/components/CourseLearningPage.jsx
  - backend/src/routes/course.py

## ADDED Requirements

### Requirement: 课程-视频层级选择功能
教师端内容生成模块 SHALL 提供课程与视频的层级选择功能，教师能够先选择课程，再选择该课程下的视频。

#### Scenario: 选择课程后加载视频列表
- **WHEN** 教师在内容生成页面选择某个课程
- **THEN** 系统自动加载该课程下的视频列表供选择

#### Scenario: 视频选择后展示相关内容
- **WHEN** 教师选择某个视频
- **THEN** 系统展示该视频相关的教学内容信息

### Requirement: 保存内容功能
教师端内容生成页面 SHALL 提供明确的"保存内容"按钮，点击后将教学内容存储至后端数据库。

#### Scenario: 保存成功
- **WHEN** 教师点击"保存内容"按钮
- **THEN** 系统将内容提交至后端，显示"保存成功"提示

#### Scenario: 保存失败
- **WHEN** 保存过程中发生错误
- **THEN** 系统显示"保存失败"及错误信息

### Requirement: 学生端视频关联讲义同步展示
学生端课程学习页面 SHALL 在视频播放时同步展示当前视频关联的教学讲义内容。

#### Scenario: 观看视频时展示关联讲义
- **WHEN** 学生在课程学习页面观看视频
- **THEN** 界面同步展示该视频关联的教学讲义内容

#### Scenario: 切换视频时更新讲义
- **WHEN** 学生切换到另一个视频
- **THEN** 讲义内容自动更新为新视频关联的内容
