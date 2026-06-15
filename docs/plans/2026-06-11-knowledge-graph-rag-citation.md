# 智教星知识图谱 + 画像融合 + RAG 引用溯源 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Flask+React+SQLite 架构上，补齐知识图谱LLM增强解析、画像/课程画像融合、RAG引用核验增强、Agent协同可视化四条核心能力。

**Architecture:** 增量扩展现有 `SyllabusGraphService`、`RagCitationService`、`ProfileAgent`、`CoordinatorAgent`，不引入新依赖；前端增强 `KnowledgeGraphWorkspace` 组件。

**Tech Stack:** Flask, SQLAlchemy, Spark LLM API, React, SVG, Vite

---

## 现有代码与规格差距分析

| 能力 | 现有状态 | 缺口 |
|------|---------|------|
| 大纲解析 | `SyllabusGraphService._parse_text_syllabus` 仅用正则规则 | 缺少 Spark LLM 结构化抽取回退 |
| ProfileAgent | 仅用关键词规则抽取画像维度 | 缺少 LLM 结构化抽取双轨 |
| 画像融合 | Coordinator 简单引用 course_profile | 缺少先修链匹配、认知风格权重、目标排序 |
| RAG核验 | `verify()` 基础覆盖率和假引用检测 | 缺少 unsupported 标记和自动降级 |
| Agent可视化 | 基础状态面板 | 缺少引用覆盖率、产物摘要、泳道布局 |
| 前端 | 基础图谱+RAG面板 | 缺少 DOCX 上传、引用展开、Agent泳道 |
| API | 4个核心端点已有 | 资源生成接口需确保 rag_required/citation_style 透传 |

---

## File Structure

### 后端修改文件
- `backend/src/services/syllabus_graph_service.py` — 增加 LLM 抽取方法
- `backend/src/services/rag_citation_service.py` — 增强核验逻辑
- `backend/src/services/multi_agent/profile_agent.py` — 增加 LLM 双轨
- `backend/src/services/multi_agent/coordinator_agent.py` — 增强融合策略
- `backend/src/services/multi_agent/shared_state.py` — 增加引用覆盖率追踪
- `backend/src/routes/knowledge_graph_routes.py` — 确保 API 完整
- `backend/src/routes/resource_generation.py` — 确保 rag_required 透传

### 前端修改文件
- `frontend/src/components/KnowledgeGraphWorkspace.jsx` — DOCX上传+Agent泳道+引用展开
- `frontend/src/services/api.js` — 确保 API 调用完整

### 新增测试文件
- `backend/tests/test_syllabus_graph.py`
- `backend/tests/test_rag_citation.py`
- `backend/tests/test_profile_agent_llm.py`
- `backend/tests/test_integration_kg_rag.py`

---

### Task 1: LLM 增强大纲解析（Spark 回退双轨）

**Files:**
- Modify: `backend/src/services/syllabus_graph_service.py`

- [ ] **Step 1: 在 SyllabusGraphService 中添加 Spark LLM 抽取方法**

在 `_parse_text_syllabus` 方法中，当规则解析结果节点数不足时，调用 Spark 做结构化抽取，失败时回退到规则结果。

```python
def _parse_text_syllabus(self, text, course):
    # 先用规则解析
    rule_result = self._rule_based_parse(text, course)

    # 如果规则解析结果太简陋（章节<2 或 知识点总数<5），尝试 LLM 抽取
    total_kps = sum(len(ch.get("knowledge_points", [])) for ch in rule_result.get("chapters", []))
    if len(rule_result.get("chapters", [])) < 2 or total_kps < 5:
        try:
            llm_result = self._llm_based_parse(text, course)
            if llm_result and len(llm_result.get("chapters", [])) >= len(rule_result.get("chapters", [])):
                return llm_result
        except Exception as e:
            logger.warning(f"LLM syllabus extraction failed, falling back to rules: {e}")

    return rule_result
```

- [ ] **Step 2: 将现有规则解析逻辑提取为 `_rule_based_parse` 方法**

将原 `_parse_text_syllabus` 的全部逻辑移入 `_rule_based_parse`，保持签名和返回格式不变。

- [ ] **Step 3: 实现 `_llm_based_parse` 方法**

```python
def _llm_based_parse(self, text, course):
    from src.services.spark_service import spark_service

    prompt = f"""请将以下课程大纲文本解析为结构化JSON，格式如下：
{{
  "title": "课程名称",
  "objectives": ["目标1", "目标2"],
  "prerequisites": ["先修1"],
  "chapters": [
    {{
      "title": "章节标题",
      "description": "章节描述",
      "teaching_hours": 4,
      "chapter_type": "theory",
      "knowledge_points": [
        {{"title": "知识点标题", "description": "知识点描述", "category": "核心知识点", "related_concepts": ["相关概念"]}}
      ]
    }}
  ]
}}

大纲文本：
{text[:3000]}

请严格返回JSON，不要添加其他文字。"""

    response = spark_service.chat(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    content = response or ""
    # 提取JSON
    json_match = re.search(r'\{[\s\S]*\}', content)
    if not json_match:
        return None
    data = json.loads(json_match.group())
    return self._normalize_structured(json.dumps(data, ensure_ascii=False), course)
```

- [ ] **Step 4: 在文件顶部添加 logger**

```python
import logging
logger = logging.getLogger(__name__)
```

---

### Task 2: ProfileAgent LLM 双轨抽取

**Files:**
- Modify: `backend/src/services/multi_agent/profile_agent.py`

- [ ] **Step 1: 在 ProfileAgent 中添加 LLM 抽取方法**

```python
def _extract_dimension_value_with_llm(self, dimension, user_answer):
    """使用 LLM 做结构化抽取，失败返回 None"""
    from src.services.spark_service import spark_service

    dim_type = dimension['type']
    valid_values = dimension.get('valid_values', [])

    prompt = f"""请从用户回答中提取「{dimension['name']}」维度信息。

抽取说明：{dimension['extract_instruction']}
"""
    if dim_type == 'enum' and valid_values:
        prompt += f"\n可选值：{', '.join(valid_values)}\n请只返回一个可选值。"
    elif dim_type == 'json':
        prompt += "\n请返回JSON对象。"
    elif dim_type == 'json_array':
        prompt += "\n请返回JSON数组。"

    prompt += f"\n\n用户回答：{user_answer}\n\n请只返回提取结果，不要添加其他文字。"

    try:
        response = spark_service.chat(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        if not response:
            return None
        response = response.strip()

        if dim_type == 'enum':
            for val in valid_values:
                if val in response.lower():
                    return val
            return None
        elif dim_type == 'json':
            try:
                return json.loads(response)
            except Exception:
                json_match = re.search(r'\{[\s\S]*\}', response)
                if json_match:
                    return json.loads(json_match.group())
                return None
        elif dim_type == 'json_array':
            try:
                return json.loads(response)
            except Exception:
                json_match = re.search(r'\[[\s\S]*\]', response)
                if json_match:
                    return json.loads(json_match.group())
                return None
    except Exception as e:
        logger.warning(f"LLM extraction failed for {dimension['key']}: {e}")
        return None
```

- [ ] **Step 2: 修改 `_extract_dimension_value` 为双轨模式**

```python
def _extract_dimension_value(self, dimension, user_answer):
    if not user_answer or not user_answer.strip():
        return None

    # 先尝试规则抽取
    rule_result = self._extract_dimension_value_by_rules(dimension, user_answer)

    # 如果规则抽取结果为默认值或空，尝试 LLM 抽取
    dim_type = dimension['type']
    is_default = False
    if dim_type == 'enum':
        valid_values = dimension.get('valid_values', [])
        if rule_result in (valid_values[-1] if 'mixed' in valid_values or 'adaptive' in valid_values else valid_values[0],):
            is_default = True
    elif dim_type in ('json', 'json_array'):
        if not rule_result or rule_result == {} or rule_result == []:
            is_default = True

    if is_default:
        llm_result = self._extract_dimension_value_with_llm(dimension, user_answer)
        if llm_result is not None:
            return llm_result

    return rule_result
```

- [ ] **Step 3: 将原规则抽取逻辑重命名为 `_extract_dimension_value_by_rules`**

将原 `_extract_enum_value`、`_extract_json_value`、`_extract_json_array_value` 的调用逻辑整合到 `_extract_dimension_value_by_rules` 中：

```python
def _extract_dimension_value_by_rules(self, dimension, user_answer):
    dim_type = dimension['type']
    if dim_type == 'enum':
        return self._extract_enum_value(dimension, user_answer)
    elif dim_type == 'json':
        return self._extract_json_value(dimension, user_answer)
    elif dim_type == 'json_array':
        return self._extract_json_array_value(dimension, user_answer)
    return None
```

- [ ] **Step 4: 在文件顶部添加 logger 和 import**

```python
import json
import logging
import re

logger = logging.getLogger(__name__)
```

---

### Task 3: 画像 + 课程画像融合策略增强

**Files:**
- Modify: `backend/src/services/multi_agent/coordinator_agent.py`

- [ ] **Step 1: 增强 `_plan_generation_strategy` 方法，添加先修链匹配**

在方法中增加从图谱获取先修链并匹配学生薄弱点的逻辑：

```python
def _plan_generation_strategy(self, profile, topic, knowledge_points, resource_types, options):
    # ... 现有策略代码保留 ...

    # 新增：先修链匹配
    course_id = options.get("course_id")
    if course_id and profile.get("knowledge_base"):
        try:
            prereq_chain = self._match_prerequisite_chain(course_id, profile)
            if prereq_chain:
                strategy_parts.append(f"先修补强：{prereq_chain}")
        except Exception as e:
            logger.warning(f"Prerequisite chain matching failed: {e}")

    # 新增：认知风格影响资源类型权重
    cognitive_style = profile.get("cognitive_style", "mixed")
    style_weights = self._get_style_resource_weights(cognitive_style)
    if style_weights:
        strategy_parts.append(f"资源权重：{style_weights}")

    # 新增：学习目标影响推荐排序
    goal = profile.get("goal_orientation", "exam")
    goal_sort = self._get_goal_sort_strategy(goal)
    if goal_sort:
        strategy_parts.append(goal_sort)

    return "；".join(strategy_parts)
```

- [ ] **Step 2: 实现 `_match_prerequisite_chain` 方法**

```python
def _match_prerequisite_chain(self, course_id, profile):
    """从图谱获取先修链，匹配学生薄弱点"""
    from src.models.knowledge_base import KnowledgeGraphNode, KnowledgeGraphEdge

    # 获取先修边和技能节点
    prereq_edges = KnowledgeGraphEdge.query.filter_by(
        course_id=course_id, edge_type="prerequisite"
    ).limit(30).all()
    if not prereq_edges:
        return None

    skill_node_ids = {e.source_node_id for e in prereq_edges}
    skill_nodes = KnowledgeGraphNode.query.filter(
        KnowledgeGraphNode.id.in_(skill_node_ids)
    ).all()
    skill_map = {n.id: n.label for n in skill_nodes}

    # 匹配薄弱点
    kb = profile.get("knowledge_base", {})
    weak_areas = [k for k, v in kb.items() if isinstance(v, (int, float)) and v < 50] if isinstance(kb, dict) else []
    if not weak_areas:
        return None

    matched = []
    for edge in prereq_edges[:10]:
        skill_label = skill_map.get(edge.source_node_id, "")
        for weak in weak_areas:
            if weak.lower() in skill_label.lower() or skill_label.lower() in weak.lower():
                matched.append(skill_label)
                break

    return "、".join(matched[:5]) if matched else None
```

- [ ] **Step 3: 实现 `_get_style_resource_weights` 方法**

```python
def _get_style_resource_weights(self, cognitive_style):
    """认知风格影响资源类型权重"""
    weights = {
        "visual": "视频脚本权重+30%，增加图表描述",
        "auditory": "视频脚本权重+25%，增加旁白讲解",
        "kinesthetic": "实操项目权重+30%，增加编程题比例",
        "reading": "文档权重+30%，增加深度内容",
        "mixed": None,
    }
    return weights.get(cognitive_style)
```

- [ ] **Step 4: 实现 `_get_goal_sort_strategy` 方法**

```python
def _get_goal_sort_strategy(self, goal):
    """学习目标影响推荐排序"""
    strategies = {
        "exam": "推荐排序：真题>考点练习>知识文档>拓展资源",
        "career": "推荐排序：行业案例>实操项目>技能资源>理论文档",
        "hobby": "推荐排序：趣味案例>探索项目>视频教程>学术论文",
        "research": "推荐排序：学术论文>研究方法>深度文档>基础练习",
    }
    return strategies.get(goal)
```

---

### Task 4: RAG 引用核验增强（unsupported 标记 + 自动降级）

**Files:**
- Modify: `backend/src/services/rag_citation_service.py`

- [ ] **Step 1: 增强 `verify` 方法，添加 unsupported 标记和自动降级**

```python
def verify(self, content, citations):
    content_text = self._stringify_content(content)
    citations = citations or []
    citation_ids = {str(c.get("source_id") or c.get("reference_code") or "") for c in citations if c}
    used_ids = set(re.findall(r"\[([A-Z]{1,3}\d+)\]", content_text))
    issues = []

    if not citations:
        issues.append({"type": "missing_citations", "message": "内容未附带引用来源"})
    fake_refs = sorted(used_ids - citation_ids)
    if fake_refs:
        issues.append({"type": "unknown_references", "references": fake_refs})
    unused = sorted(citation_ids - used_ids)
    if citations and unused:
        issues.append({"type": "unused_citations", "references": unused})

    sentences = [s.strip() for s in re.split(r"[。！？!?]\s*", content_text) if len(s.strip()) > 18]
    unsupported = []
    for sentence in sentences[:30]:
        if not re.search(r"\[[A-Z]{1,3}\d+\]", sentence):
            unsupported.append(sentence[:120])
    coverage = 100 if not sentences else round((len(sentences) - len(unsupported)) / len(sentences) * 100, 1)
    if coverage < 60:
        issues.append({"type": "low_coverage", "message": f"引用覆盖率较低：{coverage}%"})

    # 新增：标记无引用内容为 unsupported
    unsupported_claims = []
    for claim in unsupported[:10]:
        unsupported_claims.append({
            "text": claim,
            "status": "unsupported",
            "action": "review" if len(claim) > 40 else "flag",
        })

    # 新增：自动降级逻辑
    degradation = None
    if not citations:
        degradation = "no_citations"
    elif fake_refs:
        degradation = "fake_references"
    elif coverage < 40:
        degradation = "low_coverage"

    score = max(0, round(coverage - len(fake_refs) * 15 - (20 if not citations else 0), 1))

    # 修改状态判定：加入降级逻辑
    if degradation == "no_citations" or score < 30:
        status = "failed"
    elif degradation or score < 60:
        status = "needs_review"
    else:
        status = "passed"

    return {
        "status": status,
        "unsupported_claims": unsupported_claims,
        "citation_issues": issues,
        "score": score,
        "citation_coverage_score": coverage,
        "degradation": degradation,
    }
```

- [ ] **Step 2: 增强 `attach_citations` 方法，添加降级状态标记**

在 `attach_citations` 方法中，当 verification_report 的 status 为 failed 或 needs_review 时，在返回结果中添加 `degraded` 标记：

```python
# 在 attach_citations 方法中，verification 获取之后添加：
verification = self.verify(enriched, citations)
enriched["citations"] = citations
enriched["verification_report"] = verification
enriched["citation_coverage_score"] = verification["citation_coverage_score"]
if verification.get("degradation"):
    enriched["degraded"] = True
    enriched["degradation_reason"] = verification["degradation"]
```

---

### Task 5: Agent 协同可视化增强（引用覆盖率 + 产物摘要）

**Files:**
- Modify: `backend/src/services/multi_agent/shared_state.py`
- Modify: `backend/src/routes/resource_generation.py`

- [ ] **Step 1: 在 AgentMonitor 中增加引用覆盖率追踪**

在 `shared_state.py` 的 `AgentMonitor` 类中添加方法：

```python
def update_citation_coverage(self, agent_name, coverage_score):
    """更新智能体的引用覆盖率"""
    if agent_name in self._agents:
        self._agents[agent_name]["citation_coverage"] = coverage_score

def get_citation_summary(self):
    """获取所有智能体的引用覆盖率摘要"""
    summary = {}
    for name, info in self._agents.items():
        summary[name] = {
            "status": info.get("status", AgentStatus.IDLE),
            "citation_coverage": info.get("citation_coverage"),
            "current_task": info.get("current_task"),
        }
    return summary
```

- [ ] **Step 2: 在 CoordinatorAgent 生成完成后更新引用覆盖率**

在 `coordinator_agent.py` 的 `_generate_resource_package` 方法中，在 citation_reports 生成后添加：

```python
# 更新各 agent 的引用覆盖率
for rtype, report in citation_reports.items():
    agent_name = RESOURCE_TYPE_AGENT_MAP.get(rtype, rtype)
    coverage = report.get("citation_coverage_score", 0)
    agent_monitor.update_citation_coverage(agent_name, coverage)
```

- [ ] **Step 3: 在资源生成 API 中添加引用覆盖率端点**

在 `resource_generation.py` 路由中添加：

```python
@resource_gen_bp.route("/agents/citation-coverage", methods=["GET"])
def get_citation_coverage():
    try:
        from src.services.multi_agent.shared_state import agent_monitor
        return jsonify({"coverage": agent_monitor.get_citation_summary()}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

---

### Task 6: 前端增强（DOCX 上传 + Agent 泳道 + 引用展开）

**Files:**
- Modify: `frontend/src/components/KnowledgeGraphWorkspace.jsx`
- Modify: `frontend/src/services/api.js`

- [ ] **Step 1: 在前端 API 中添加 DOCX 上传支持**

在 `api.js` 的 `knowledgeGraph` 对象中添加：

```javascript
importSyllabusDocx: (courseId, formData) =>
  fetch(`${API_BASE_URL}/knowledge-graph/courses/${courseId}/import-syllabus`, {
    method: 'POST',
    credentials: 'include',
    body: formData,  // FormData, 不设 Content-Type 让浏览器自动设置
  }).then(res => {
    if (!res.ok) throw new Error('Upload failed')
    return res.json()
  }),
```

- [ ] **Step 2: 在 KnowledgeGraphWorkspace 中添加 DOCX 上传 UI**

在大纲导入 Card 中添加文件上传选项：

```jsx
// 在 inputType Select 中添加 docx 选项
<SelectItem value="docx">DOCX 文件</SelectItem>

// 当 inputType === 'docx' 时显示文件上传
{inputType === 'docx' && (
  <Input
    type="file"
    accept=".docx"
    onChange={(e) => {
      const file = e.target.files[0]
      if (file) setDocxFile(file)
    }}
  />
)}
```

修改 `importSyllabus` 函数处理 DOCX 上传：

```javascript
const importSyllabus = async () => {
  if (!selectedCourse) return
  setImporting(true)
  try {
    if (inputType === 'docx' && docxFile) {
      const formData = new FormData()
      formData.append('file', docxFile)
      formData.append('input_type', 'docx')
      await knowledgeGraph.importSyllabusDocx(selectedCourse, formData)
    } else {
      if (!syllabusText.trim()) return
      await knowledgeGraph.importSyllabus(selectedCourse, {
        input_type: inputType,
        content: inputType === 'json' ? JSON.parse(syllabusText) : syllabusText,
      })
    }
    await loadWorkspace()
  } catch (err) {
    alert(`导入失败：${err.message}`)
  } finally {
    setImporting(false)
  }
}
```

- [ ] **Step 3: 增强 Agent 状态面板为泳道布局**

替换现有 Agent 状态 Card 内容为泳道样式：

```jsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center text-base"><Activity className="w-4 h-4 mr-2" />Agent 协同泳道</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      {agents.length === 0 && <p className="text-sm text-[#6b6560]">暂无状态</p>}
      {agents.map((agent) => {
        const statusColor = {
          idle: 'bg-gray-200', running: 'bg-blue-400 animate-pulse',
          success: 'bg-green-400', failed: 'bg-red-400', waiting: 'bg-yellow-400',
        }[agent.status || 'idle'] || 'bg-gray-200'
        return (
          <div key={agent.name || agent.agent_name} className="flex items-center gap-2 p-2 rounded border">
            <div className={`w-3 h-3 rounded-full ${statusColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agent.role || agent.agent_role || agent.name}</p>
              <p className="text-xs text-[#6b6560] truncate">{agent.current_task || agent.agent_name || '等待任务'}</p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs">{agent.status || 'idle'}</Badge>
              {agent.citation_coverage != null && (
                <p className="text-xs text-[#6b6560] mt-1">引用覆盖 {agent.citation_coverage}%</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  </CardContent>
</Card>
```

- [ ] **Step 4: 在节点详情面板中添加引用展开功能**

在节点详情 Card 中，当有 sources 时添加展开/收起功能：

```jsx
{selectedNode && (
  <>
    <div className="flex items-center justify-between">
      <p className="font-semibold">{selectedNode.label}</p>
      <Badge>{selectedNode.node_type}</Badge>
    </div>
    <p className="text-[#6b6560]">{selectedNode.description || '暂无描述'}</p>
    {(selectedNode.sources || []).length > 0 && (
      <div>
        <p className="text-xs font-medium text-[#6b6560] mb-1">
          证据片段 ({selectedNode.sources.length})
        </p>
        {selectedNode.sources.slice(0, 5).map((source) => (
          <details key={source.id} className="rounded border mb-1">
            <summary className="p-2 cursor-pointer text-sm font-medium">
              [{source.reference_code}] {source.title}
            </summary>
            <div className="p-2 pt-0 text-xs text-[#6b6560] border-t">
              <p>{source.excerpt}</p>
              {source.location && <p className="mt-1 italic">位置：{source.location}</p>}
            </div>
          </details>
        ))}
      </div>
    )}
  </>
)}
```

- [ ] **Step 5: 添加引用覆盖率指标到图谱指标栏**

在图谱指标 grid 中添加引用覆盖率：

```jsx
<div className="grid grid-cols-2 md:grid-cols-5 gap-2">
  <Metric label="节点" value={graph.metrics?.node_count || 0} />
  <Metric label="边" value={graph.metrics?.edge_count || 0} />
  <Metric label="引用覆盖" value={`${graph.quality_report?.source_coverage_rate || 0}%`} />
  <Metric label="孤立节点" value={graph.quality_report?.isolated_node_count || 0} />
  <Metric label="缺失引用" value={graph.quality_report?.missing_citation_count || 0} />
</div>
```

---

### Task 7: 资源生成 API 扩展与集成测试

**Files:**
- Modify: `backend/src/routes/resource_generation.py`
- Create: `backend/tests/test_syllabus_graph.py`
- Create: `backend/tests/test_rag_citation.py`
- Create: `backend/tests/test_integration_kg_rag.py`

- [ ] **Step 1: 确保资源生成 API 透传 rag_required 和 citation_style**

检查 `resource_generation.py` 中的 `generate_package` 和 `generate_personalized` 端点，确保将 `rag_required` 和 `citation_style` 传递给 CoordinatorAgent task：

```python
# 在 generate_package 端点中确认：
task = {
    "type": "generate_resource_package",
    ...
    "rag_required": data.get("rag_required", False),
    "citation_style": data.get("citation_style", "bracket"),
}
```

- [ ] **Step 2: 创建大纲图谱单元测试**

```python
# backend/tests/test_syllabus_graph.py
import json
import pytest
from src.services.syllabus_graph_service import SyllabusGraphService

def test_normalize_structured_json():
    svc = SyllabusGraphService()
    data = {
        "title": "Python程序设计",
        "objectives": ["掌握Python基础语法", "理解面向对象编程"],
        "prerequisites": ["计算机基础"],
        "chapters": [
            {"title": "变量与数据类型", "knowledge_points": [{"title": "变量定义", "description": "变量的概念和命名规则"}]},
            {"title": "控制流", "knowledge_points": [{"title": "if语句", "description": "条件判断"}]},
        ],
    }
    result = svc._normalize_structured(json.dumps(data), None)
    assert result["course"]["title"] == "Python程序设计"
    assert len(result["chapters"]) == 2
    assert len(result["objectives"]) == 2

def test_rule_based_parse_chapters():
    svc = SyllabusGraphService()
    text = """课程目标：掌握Python编程
第一章 变量与数据类型
- 变量定义
- 数据类型转换
第二章 控制流
- if语句
- for循环
先修课程：计算机基础"""
    result = svc._rule_based_parse(text, None)
    assert len(result["chapters"]) >= 2
    assert any("变量" in ch["title"] for ch in result["chapters"])

def test_quality_report():
    svc = SyllabusGraphService()
    report = svc.build_quality_report(999)  # 不存在的课程
    assert report["node_count"] == 0
    assert report["edge_count"] == 0
```

- [ ] **Step 3: 创建 RAG 引用核验单元测试**

```python
# backend/tests/test_rag_citation.py
import pytest
from src.services.rag_citation_service import RagCitationService

def test_verify_passed():
    svc = RagCitationService()
    content = "Python是一种解释型语言[S1]。它支持面向对象编程[S2]。"
    citations = [
        {"source_id": "S1", "title": "Python基础", "excerpt": "解释型语言"},
        {"source_id": "S2", "title": "OOP", "excerpt": "面向对象"},
    ]
    result = svc.verify(content, citations)
    assert result["status"] in ("passed", "needs_review")
    assert result["citation_coverage_score"] > 50

def test_verify_failed_no_citations():
    svc = RagCitationService()
    content = "Python是一种解释型语言。它支持面向对象编程。"
    result = svc.verify(content, [])
    assert result["status"] == "failed"
    assert result["degradation"] == "no_citations"

def test_verify_fake_references():
    svc = RagCitationService()
    content = "Python是解释型的[S1]。面向对象[S99]。"
    citations = [{"source_id": "S1", "title": "基础"}]
    result = svc.verify(content, citations)
    assert any(issue["type"] == "unknown_references" for issue in result["citation_issues"])

def test_verify_unsupported_claims():
    svc = RagCitationService()
    content = "Python是一种解释型语言[S1]。这种语言非常适合初学者因为它语法简洁易读且功能强大。"
    citations = [{"source_id": "S1", "title": "基础"}]
    result = svc.verify(content, citations)
    assert len(result["unsupported_claims"]) > 0
    assert result["unsupported_claims"][0]["status"] == "unsupported"
```

- [ ] **Step 4: 创建集成测试**

```python
# backend/tests/test_integration_kg_rag.py
import json
import pytest
from src.app import create_app
from src.models.user import db as _db

@pytest.fixture
def app():
    app = create_app(testing=True)
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()

@pytest.fixture
def client(app):
    return app.test_client()

def test_import_and_retrieve(client, app):
    """集成测试：导入大纲 -> 生成图谱 -> 检索证据"""
    # 先创建课程
    from src.models.course import Course
    with app.app_context():
        course = Course(title="测试Python课程", description="测试用")
        _db.session.add(course)
        _db.session.commit()
        course_id = course.id

    # 导入大纲
    syllabus = {
        "title": "Python程序设计",
        "objectives": ["掌握Python基础"],
        "chapters": [
            {"title": "变量", "knowledge_points": [{"title": "变量定义"}]},
            {"title": "函数", "knowledge_points": [{"title": "函数定义"}, {"title": "参数传递"}]},
        ],
    }
    resp = client.post(f"/api/knowledge-graph/courses/{course_id}/import-syllabus",
                       json={"input_type": "json", "content": syllabus})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["nodes_created"] >= 3
    assert data["quality_report"]["node_count"] >= 3

    # 获取图谱
    resp = client.get(f"/api/knowledge-graph/courses/{course_id}")
    assert resp.status_code == 200
    graph = resp.get_json()
    assert len(graph["nodes"]) >= 3

    # RAG 检索
    resp = client.post("/api/rag/retrieve",
                       json={"course_id": course_id, "query": "变量定义", "top_k": 3})
    assert resp.status_code == 200
    evidence = resp.get_json()["evidence"]
    assert len(evidence) > 0
```

---

## Self-Review

**1. Spec coverage:**
- 知识图谱数据层 → 已存在，无需修改
- 大纲解析 LLM 增强 → Task 1
- RAG 引用溯源核验 → Task 4
- 画像融合 → Task 3
- ProfileAgent LLM 双轨 → Task 2
- Agent 协同可视化 → Task 5 + Task 6
- API 扩展 → Task 7
- 测试 → Task 7

**2. Placeholder scan:** 无 TBD/TODO/实现稍后等占位符。

**3. Type consistency:** 所有方法签名和字段名与现有代码一致。
