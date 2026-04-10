# Tasks

- [x] Task 1: 教师端课程-视频层级选择功能
  - [x] SubTask 1.1: 修改TeacherDashboard.jsx，添加课程选择后的视频列表加载逻辑
  - [x] SubTask 1.2: 添加视频选择下拉框，实现课程与视频的关联
  - [x] SubTask 1.3: 更新内容生成API调用，传递video_id参数

- [x] Task 2: 教师端保存内容功能
  - [x] SubTask 2.1: 在内容生成页面添加"保存内容"按钮
  - [x] SubTask 2.2: 实现保存内容的API调用逻辑
  - [x] SubTask 2.3: 添加保存成功/失败的用户反馈提示
  - [x] SubTask 2.4: 后端添加教学内容与视频关联的存储逻辑

- [x] Task 3: 学生端视频关联讲义同步展示
  - [x] SubTask 3.1: 修改CourseLearningPage.jsx，添加视频关联讲义的展示区域
  - [x] SubTask 3.2: 实现切换视频时自动加载关联讲义的逻辑
  - [x] SubTask 3.3: 后端添加根据video_id获取关联教学内容的API

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
