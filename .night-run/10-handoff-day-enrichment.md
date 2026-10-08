# 10-handoff-day-enrichment.md · 第一梯队丰富化任务交接文档

> 用途：若会话额度中断，主人或下一会话凭此文档无缝继续。
> 任务书：第一梯队 6 项开源技术全部落地，每项 before/after 截图，最终产出前后对比 HTML。
> 仓库状态基线：起点 814fe8f（第二轮晨报后），服务 backend:5000 / frontend:5173。

## 进度总览

| 项 | 内容 | 状态 | commit |
|---|---|---|---|
| T1 | 错题知识点词云 | ✅ 代码完成已提交（见已知问题） | 28bb9fc |
| T2 | FullCalendar 学习规划日历 | ⚠️ 代码完成，卡在 locale 导入报错（解法见下） | 未提交 |
| T3 | genanki 错题导出 Anki | 未开始（方案见下） | — |
| T4 | exceljs 成绩导出 Excel | 未开始 | — |
| T5 | 成就证书 PDF | 未开始（用打印方案，见下） | — |
| T6 | tesseract.js 拍照录错题 | 未开始 | — |
| T7 | Excalidraw 实时白板 | 未开始（集成方案见下） | — |
| Z | verify_all + 前后对比 HTML | 未开始（模板参考 docs/night-run/night-report-round2-20261006.html） | — |

## before 基线截图（已存 docs/screenshots/enrichment/）

- T1-T6-before-mistakebook.png（错题本列表）
- T1-before-mistake-stats.png（错题统计 tab）
- T2-before-learning-plan.png（学习规划）
- T5-before-achievements.png（学习成就）
- T7-before-interaction.png（教师互动管理）

## T1 已知问题（诚实标注）

- 代码：KnowledgeWordCloud.jsx（timdream/wordcloud 薄包装），jest 30/30 过。
- react-wordcloud 在 React19+Vite 下整页白屏（模块级崩溃）已弃用。
- 浏览器端词云画布偶发空白：错题本父组件数据刷新导致统计面板周期性重挂载，
  绘制窗口被掐断。wordcloud 库本身手动调用已验证可画。浏览器复验待做：
  错题本 → 统计分析 tab → 滚到「知识点错题统计」卡看词云。
- 浏览器操作经验：Radix Tabs 用 CUA 坐标点击（574,359 附近）才有效，
  evaluate 的 click()/pointerdown 派发对 Radix 无效；页面滚动用 evaluate 改 scrollTop。

## T2 卡点与解法（当前正在做）

- 现象：`Missing "./locales/zh-cn" specifier in "@fullcalendar/core"`，Vite 白屏遮罩。
- 已排除：不是 core@7 混入（现四包全 6.1.21 互配）；不是 Vite 缓存（已清 .vite 重启）；
  带 .js 扩展名导入同样报错（连 `./locales/zh-cn.js` 都说 missing）。
- 最可能根因：pnpm 树里仍有一份 core@7 被 Vite 解析到（node -e 查的是顶层，
  Vite 走的是学习规划组件的依赖闭包）。可查：`ls node_modules/.pnpm | grep fullcalendar+core`。
- **务实解法（推荐，一步到位）**：直接删掉 zhCnLocale 导入与 locale prop，
  日历用英文默认 UI + `firstDay: 1`（周一起始），事件标题本来就是中文。
  日历的核心价值是"规划铺上月历"，locale 只是锦上添花，不要再烧预算。
- 代码位置：src/components/LearningPlanSystem.jsx 头部 4 行 import +
  CalendarView 组件（文件尾）+ tabs 数组 + 渲染分支。删 locale 后提交。

## T3~T7 执行方案（按此直接干）

- **T3 Anki 导出（后端）**：backend venv `pip install genanki`（MIT）。
  在 routes/student.py 或错题相关路由加 `GET /api/mistakes/export/anki`：
  查当前学生 mistakes → 每条生成 genanki.Model/Note（正面=题目，背面=答案/解析）→
  Package 写临时文件 send_file 返回 .apkg。前端错题本头部「导出」下拉加「导出 Anki 卡组」，
  触发下载（window.open 或 axios blob）。commit：`feat(mistake-book): Anki 卡组导出（T3）`。
- **T4 Excel 导出（前端）**：`pnpm add exceljs`。教师端班级管理详情（ClassManagement.jsx）
  「导出成绩 Excel」按钮：用已有 stats（成绩分布/学生列表）生成工作簿，exceljs 写 buffer，
  Blob 下载。commit：`feat(class-mgmt): 班级成绩 Excel 导出（T4）`。
- **T5 成就证书（前端，打印方案）**：不用 pdfmake（默认 vfs 无中文字体，嵌字 10MB 不值）。
  学习成就页每张"已解锁"徽章加「生成证书」→ 打开打印友好弹层（品牌头+成就名+日期+印章样式）→
  window.print() 存 PDF。commit：`feat(achievement): 成就证书打印视图（T5）`。
- **T6 OCR 拍照录错题（前端）**：`pnpm add tesseract.js`。错题本列表页加「拍照录入」按钮：
  file input 选图 → tesseract.recognize(img, 'chi_sim+eng')（语言包走 CDN，首次联网加载）
  → OCR 文本填入弹层 textarea →「保存为错题」调 mistakeBook 现有创建接口
  （查 services/api.js 里 mistakeBook 是否有 create；没有就在
  backend routes/mistake*.py 加 POST /api/mistakes——查有没有现成的）。
  commit：`feat(mistake-book): 拍照 OCR 录入错题（T6）`。
- **T7 Excalidraw 白板（前端，最复杂放最后）**：`pnpm add @excalidraw/excalidraw`。
  教师端互动管理 + 学生端互动面板各加「实时白板」区：懒加载 Excalidraw 组件，
  onChange 节流 500ms 后 socket.emit('whiteboard_sync', {course_id, elements})，
  对端 on 接收后 excalidrawAPI.updateScene({elements})。后端 websocket_service.py
  加 whiteboard_sync 事件转发（鉴权同其他事件：需 session user_id，转发到 course_<id> 房间）。
  jest 需在 jest.setup.js 给 @excalidraw/excalidraw 加替身（默认可用原则）。
  transformIgnorePatterns 可能需加 excalidraw。commit：
  `feat(interaction): Excalidraw 实时白板（T7）`。
- **每项的 after 截图**：存 docs/screenshots/enrichment/T{n}-after-*.png。
  浏览器操作要点：登录态丢失就重登（student/student123, teacher/teacher123）；
  Radix 下拉/tab 用 CUA 坐标点击；点完等 2.5s。

## 最终产出（阶段 Z）

1. `verify_all.ps1` 全绿（后台跑，powershell -ExecutionPolicy Bypass -File verify_all.ps1）。
2. 每项 after 截图补齐。
3. 前后对比 HTML：`docs/enrichment-report-20261006.html`，仿 night-report-round2 的
   逐改动图集格式（内联 CSS、卡片式、before/after 并排、commit 哈希、验证方式、
   T1 已知问题与 T2 locale 折衷如实标注）。截图相对路径 ../screenshots/enrichment/xxx.png。
4. 全部 commit 后 git status 干净，最终汇报主人。

## 红线提醒（延续）

- 不碰密钥/.env（SEC-001/002 冻结）；不 force push；不加运行时依赖未经主人同意
  （第一梯队六项已获同意，超出清单的依赖先问）。
