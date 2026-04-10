# 修复笔记保存失败 — 4条日志错误

## 问题分析（4条日志 = 2种错误）

### 错误类型 1：`'str' object has no attribute '_sa_instance_state'`（2条）
- **根因**：StudyNote 模型中 `content` 字段存在 Column 与 Relationship 同名冲突
- **状态**：✅ 已在上一轮修复（relationship 已重命名为 `teaching_content`）

### 错误类型 2：`(sqlite3.OperationalError) table study_notes has no column named content`（2条）⚠️ 核心问题
- **根因**：SQLite 数据库 `study_notes` 表缺少 `content` 列
- **证据**：通过 PRAGMA table_info 确认，表中 12 个列，唯独没有 `content`
- **原因推测**：建表时模型可能处于中间状态，或表被重建时使用了不完整的 schema
- **影响**：即使模型已修复，INSERT 时 SQLite 仍报错，因为物理表层面就没有这个列

---

## 修复计划

### 步骤 1：扩展自动迁移函数，补齐 `content` 列
**文件**: [main.py](backend/src/main.py) 第 140-146 行

将 `content` 列加入 `model_columns` 自动迁移字典：
```python
model_columns = {
    'content': 'TEXT NOT NULL DEFAULT ""',   # ← 新增：笔记正文（核心字段）
    'video_timestamp': 'REAL',
    'tags': 'TEXT',
    'is_auto_generated': 'BOOLEAN DEFAULT 0',
    'is_public': 'BOOLEAN DEFAULT 0',
    'content_id': 'INTEGER',
}
```

### 步骤 2：验证 ContentBookmark 模型是否有相同隐患
**文件**: [course.py](backend/src/models/course.py) 第 479 行起

检查 ContentBookmark 是否也存在 `content` Column + Relationship 同名冲突（之前发现过但未处理），如有则一并修复。

### 步骤 3：重启后端验证迁移日志
重启 Flask 后端，确认控制台输出：
```
[DB Migration] [OK] Added column: study_notes.content (TEXT NOT NULL DEFAULT "")
[DB Migration] 数据库 Schema 迁移完成
```

### 步骤 4：前端测试验证
用户在浏览器中执行新建笔记 → 填写标题和内容 → 点击保存，确认不再报错。

---

## 影响范围
- 仅修改 `main.py` 的 `ensure_table_columns()` 函数（增加 1 个键值对）
- 可能修改 `course.py` 的 ContentBookmark 模型（防御性修复）
- 不涉及前端改动
- 不涉及数据丢失风险（ALTER TABLE ADD COLUMN 是安全操作）
