export function ensureObject(content) {
  if (content === null || content === undefined) return {}
  if (typeof content === 'object') return content
  if (typeof content === 'string') {
    let text = content.trim()
    if (text.startsWith('```')) {
      const lines = text.split('\n')
      text = lines.slice(1, lines[lines.length - 1]?.trim() === '```' ? -1 : undefined).join('\n')
    }
    try {
      return JSON.parse(text)
    } catch {
      const start = text.indexOf('{')
      const end = text.lastIndexOf('}')
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(text.slice(start, end + 1))
        } catch {
          let braceCount = 0
          let jsonStart = null
          for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
              if (braceCount === 0) jsonStart = i
              braceCount++
            } else if (text[i] === '}') {
              braceCount--
              if (braceCount === 0 && jsonStart !== null) {
                try {
                  return JSON.parse(text.slice(jsonStart, i + 1))
                } catch {
                  jsonStart = null
                }
              }
            }
          }
        }
      }
      return { raw_response: text }
    }
  }
  return { raw_response: String(content) }
}

function humanizeKey(key) {
  const map = {
    key_points: '核心要点',
    key_concepts: '核心概念',
    examples: '示例',
    common_mistakes: '常见误区',
    further_reading: '扩展阅读',
    review_questions: '复习思考题',
    learning_objectives: '学习目标',
    prerequisites: '前置知识',
    scoring_criteria: '评分标准',
    extension_challenges: '扩展挑战',
    tasks: '任务列表',
    steps: '操作步骤',
    hints: '提示',
    glossary: '术语表',
    sections: '章节',
    chapters: '章节',
    recommendations: '推荐资源',
    resources: '资源列表',
  }
  return map[key] || key.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function normalizeLanguage(lang) {
  if (!lang) return 'python'
  const map = {
    python: 'python', py: 'python', python3: 'python',
    javascript: 'javascript', js: 'javascript', es6: 'javascript',
    typescript: 'javascript', ts: 'javascript',
    java: 'java', cpp: 'cpp', 'c++': 'cpp', c: 'c',
  }
  return map[lang.toLowerCase().trim()] || lang.toLowerCase().trim()
}

function stripCodeFence(code) {
  if (!code || typeof code !== 'string') return code
  let text = code.trim()
  if (text.startsWith('```')) {
    const lines = text.split('\n')
    text = lines.slice(1, lines[lines.length - 1]?.trim() === '```' ? -1 : undefined).join('\n')
  }
  return text
}

export function convertMindmap(rawContent, topic = '') {
  const data = ensureObject(rawContent)
  const source = data.mindmap || data

  if (source.root) {
    return { root: normalizeMindmapNode(source.root, topic) }
  }
  if (source.nodes || source.children) {
    return { root: normalizeMindmapNode(source, topic) }
  }
  if (source.sections || source.chapters) {
    return { root: buildMindmapFromDocument(source, topic) }
  }
  if (source.tasks || source.project_title) {
    return { root: buildMindmapFromProject(source, topic) }
  }
  return { root: buildMindmapFromGeneric(source, topic) }
}

function normalizeMindmapNode(node, fallbackName = '') {
  if (!node || typeof node !== 'object') {
    return {
      name: node ? String(node) : fallbackName,
      description: '',
      is_core: false,
      relationship_type: '包含',
      children: [],
    }
  }

  const name = node.name || node.title || node.label || node.text || fallbackName
  let description = node.description || node.summary || node.content || node.detail || ''
  if (typeof description === 'string' && description.length > 200) {
    description = description.slice(0, 200) + '...'
  }

  let isCore = Boolean(node.is_core)
  if (!isCore) {
    const imp = node.importance || ''
    isCore = ['core', '核心', 'high', '重要'].includes(imp)
  }

  const relType = node.relationship_type || node.relation || node.link_type || '包含'

  const rawChildren = node.children || node.subtopics || node.branches || node.items || []
  const children = (Array.isArray(rawChildren) ? rawChildren : []).map(child => {
    if (child && typeof child === 'object') return normalizeMindmapNode(child)
    if (typeof child === 'string' && child.trim()) {
      return { name: child.trim(), description: '', is_core: false, relationship_type: '包含', children: [] }
    }
    return null
  }).filter(Boolean)

  return { name, description, is_core: isCore, relationship_type: relType, children }
}

function buildMindmapFromDocument(data, topic) {
  const rootName = data.title || data.document?.title || topic || '知识结构'
  const root = {
    name: rootName,
    description: data.summary || '',
    is_core: true,
    relationship_type: null,
    children: [],
  }

  const sections = data.sections || data.chapters || []
  for (const sec of sections) {
    if (!sec || typeof sec !== 'object') continue
    const secName = sec.title || sec.section_title || '未命名章节'
    let secDesc = sec.content || sec.summary || ''
    if (typeof secDesc === 'string' && secDesc.length > 150) secDesc = secDesc.slice(0, 150) + '...'

    const secNode = {
      name: secName,
      description: secDesc,
      is_core: true,
      relationship_type: '包含',
      children: [],
    }

    const keyPoints = sec.key_points || sec.key_concepts || []
    for (const kp of keyPoints) {
      if (typeof kp === 'string') {
        secNode.children.push({ name: kp, description: '', is_core: false, relationship_type: '并列', children: [] })
      } else if (kp && typeof kp === 'object') {
        secNode.children.push(normalizeMindmapNode(kp))
      }
    }

    const examples = sec.examples || []
    for (const ex of examples) {
      const exName = ex?.title || '示例'
      secNode.children.push({ name: exName, description: '示例', is_core: false, relationship_type: '递进', children: [] })
    }

    const mistakes = sec.common_mistakes || []
    for (const cm of mistakes) {
      secNode.children.push({
        name: typeof cm === 'string' ? cm : cm?.title || '常见误区',
        description: '常见误区',
        is_core: false,
        relationship_type: '因果',
        children: [],
      })
    }

    root.children.push(secNode)
  }

  const glossary = data.glossary || []
  if (glossary.length > 0) {
    const glossaryNode = {
      name: '术语表',
      description: '核心术语定义',
      is_core: false,
      relationship_type: '包含',
      children: glossary.map(item => {
        if (typeof item === 'object') {
          return { name: item.term || '', description: item.definition || '', is_core: false, relationship_type: '并列', children: [] }
        }
        return { name: String(item), description: '', is_core: false, relationship_type: '并列', children: [] }
      }),
    }
    root.children.push(glossaryNode)
  }

  return root
}

function buildMindmapFromProject(data, topic) {
  const rootName = data.project_title || data.title || topic || '项目结构'
  const root = {
    name: rootName,
    description: data.project_description || data.description || '',
    is_core: true,
    relationship_type: null,
    children: [],
  }

  const objectives = data.learning_objectives || data.prerequisites || []
  if (objectives.length > 0) {
    root.children.push({
      name: '学习目标',
      description: '项目学习目标',
      is_core: true,
      relationship_type: '包含',
      children: objectives.map(obj => ({
        name: String(obj),
        description: '',
        is_core: false,
        relationship_type: '并列',
        children: [],
      })),
    })
  }

  const tasks = data.tasks || []
  if (tasks.length > 0) {
    const tasksNode = {
      name: '任务分解',
      description: `共${tasks.length}个子任务`,
      is_core: true,
      relationship_type: '包含',
      children: [],
    }
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      if (!task || typeof task !== 'object') continue
      const taskName = task.title || `任务${i + 1}`
      let taskDesc = task.description || ''
      if (typeof taskDesc === 'string' && taskDesc.length > 150) taskDesc = taskDesc.slice(0, 150) + '...'

      const taskNode = {
        name: taskName,
        description: taskDesc,
        is_core: false,
        relationship_type: '递进',
        children: [],
      }

      const steps = task.steps || []
      for (const step of steps) {
        if (typeof step === 'object') {
          taskNode.children.push({
            name: step.instruction || step.step || '',
            description: step.hint || '',
            is_core: false,
            relationship_type: '递进',
            children: [],
          })
        } else if (typeof step === 'string') {
          taskNode.children.push({ name: step, description: '', is_core: false, relationship_type: '递进', children: [] })
        }
      }
      tasksNode.children.push(taskNode)
    }
    root.children.push(tasksNode)
  }

  const scoring = data.scoring_criteria || data.rubric
  if (scoring) {
    const scoringNode = {
      name: '评分标准',
      description: '项目评分细则',
      is_core: false,
      relationship_type: '包含',
      children: [],
    }
    if (Array.isArray(scoring)) {
      for (const item of scoring) {
        if (typeof item === 'object') {
          scoringNode.children.push({
            name: item.item || item.criterion || '',
            description: item.description || '',
            is_core: false,
            relationship_type: '并列',
            children: [],
          })
        }
      }
    } else if (typeof scoring === 'object') {
      for (const [key, val] of Object.entries(scoring)) {
        scoringNode.children.push({
          name: key,
          description: typeof val === 'string' ? val : '',
          is_core: false,
          relationship_type: '并列',
          children: [],
        })
      }
    }
    root.children.push(scoringNode)
  }

  return root
}

function buildMindmapFromGeneric(data, topic) {
  const rootName = data.title || data.name || topic || '知识结构'
  const root = {
    name: rootName,
    description: data.description || data.summary || '',
    is_core: true,
    relationship_type: null,
    children: [],
  }

  const skipKeys = new Set(['title', 'name', 'description', 'summary', 'raw_response', 'parse_error'])
  for (const [key, value] of Object.entries(data)) {
    if (skipKeys.has(key)) continue
    if (Array.isArray(value) && value.length > 0) {
      const childNode = {
        name: humanizeKey(key),
        description: `${value.length}项`,
        is_core: false,
        relationship_type: '包含',
        children: [],
      }
      for (const item of value.slice(0, 10)) {
        if (typeof item === 'object' && item !== null) {
          const itemName = item.title || item.name || item.term || ''
          const itemDesc = item.description || item.definition || ''
          if (itemName) {
            childNode.children.push({
              name: itemName,
              description: typeof itemDesc === 'string' ? itemDesc.slice(0, 150) : '',
              is_core: false,
              relationship_type: '并列',
              children: [],
            })
          }
        } else if (typeof item === 'string' && item.trim()) {
          childNode.children.push({ name: item.trim().slice(0, 50), description: '', is_core: false, relationship_type: '并列', children: [] })
        }
      }
      if (childNode.children.length > 0) root.children.push(childNode)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const childNode = {
        name: humanizeKey(key),
        description: '',
        is_core: false,
        relationship_type: '包含',
        children: [],
      }
      for (const [subKey, subVal] of Object.entries(value).slice(0, 8)) {
        childNode.children.push({
          name: String(subKey),
          description: typeof subVal !== 'object' ? String(subVal).slice(0, 100) : '',
          is_core: false,
          relationship_type: '并列',
          children: [],
        })
      }
      root.children.push(childNode)
    }
  }

  return root
}

export function convertCodePractical(rawContent, topic = '', options = {}) {
  const data = ensureObject(rawContent)
  const source = data.project || data

  const language = normalizeLanguage(
    options.programming_language || source.programming_language || source.language || 'python'
  )

  const tasks = (source.tasks || []).map((task, idx) => normalizeCodeTask(task, idx))

  let fullCode = source.full_code || source.code || ''
  if (!fullCode) {
    const codeParts = tasks
      .map(t => t.reference_solution)
      .filter(c => c && c.trim())
    if (codeParts.length > 0) {
      fullCode = codeParts.join('\n\n# ' + '='.repeat(40) + '\n\n')
    }
  }
  fullCode = stripCodeFence(fullCode)

  const starterCode = stripCodeFence(source.starter_code || '') || ''
  let referenceSolution = stripCodeFence(source.reference_solution || '') || ''
  if (!fullCode && referenceSolution) {
    fullCode = referenceSolution
  }

  let scoringCriteria = source.scoring_criteria || source.rubric || []
  if (!Array.isArray(scoringCriteria)) {
    if (typeof scoringCriteria === 'object') {
      scoringCriteria = Object.entries(scoringCriteria).map(([key, val]) => ({
        item: key,
        description: typeof val === 'string' ? val : String(val),
      }))
    } else {
      scoringCriteria = []
    }
  }

  return {
    project_title: source.project_title || source.title || topic || '代码实操案例',
    project_description: source.project_description || source.description || '',
    difficulty: source.difficulty || 'intermediate',
    programming_language: language,
    estimated_time: source.estimated_time || source.estimated_hours || '',
    prerequisites: source.prerequisites || source.knowledge_points_covered || [],
    learning_objectives: source.learning_objectives || [],
    tasks,
    full_code: fullCode,
    starter_code: starterCode,
    scoring_criteria: scoringCriteria,
    extension_challenges: source.extension_challenges || [],
  }
}

function normalizeCodeTask(task, index) {
  if (!task || typeof task !== 'object') {
    return {
      task_id: index + 1,
      title: `任务${index + 1}`,
      description: '',
      steps: [],
      code_template: '',
      reference_solution: '',
      expected_output: '',
      hints: [],
      deliverable: '',
    }
  }

  const steps = (task.steps || []).map(step => {
    if (typeof step === 'object') {
      return {
        instruction: step.instruction || step.step || '',
        hint: step.hint || '',
        expected_output: step.expected_output || step.expected_output_description || '',
      }
    }
    return { instruction: String(step), hint: '', expected_output: '' }
  })

  let hints = task.hints || []
  if (typeof hints === 'string') hints = [hints]

  return {
    task_id: task.task_id || index + 1,
    title: task.title || `任务${index + 1}`,
    description: task.description || '',
    steps,
    code_template: stripCodeFence(task.code_template || ''),
    reference_solution: stripCodeFence(task.reference_solution || ''),
    expected_output: task.expected_output || '',
    hints,
    deliverable: task.deliverable || '',
  }
}

export function convertDocument(rawContent, topic = '') {
  const data = ensureObject(rawContent)
  const source = data.document || data

  const title = source.title || source.document_title || topic || '课程文档'
  const summary = source.summary || source.abstract || ''
  const targetAudience = source.target_audience || ''
  const readingTime = source.estimated_reading_time_minutes || 0

  const sections = (source.sections || source.chapters || []).map((sec, idx) => {
    if (!sec || typeof sec !== 'object') return null
    return normalizeDocumentSection(sec, idx)
  }).filter(Boolean)

  const fallbackSections = sections.length > 0 ? sections : buildSectionsFromGeneric(source)

  const glossary = (source.glossary || []).map(item => {
    if (typeof item === 'object') {
      return { term: item.term || item.word || '', definition: item.definition || item.meaning || '' }
    }
    const parts = String(item).split('：', 2)
    return { term: parts[0]?.trim() || String(item), definition: parts[1]?.trim() || '' }
  })

  const reviewQuestions = (source.review_questions || source.questions || []).map(q => {
    if (typeof q === 'string') return q
    if (typeof q === 'object') return q.question || q.text || String(q)
    return String(q)
  })

  const markdown = generateDocumentMarkdown(title, summary, fallbackSections, glossary, reviewQuestions)

  return {
    title,
    summary,
    target_audience: targetAudience,
    estimated_reading_time_minutes: readingTime,
    sections: fallbackSections,
    glossary,
    review_questions: reviewQuestions,
    markdown,
  }
}

function normalizeDocumentSection(section, index) {
  const sectionId = section.section_id || `s${index + 1}`
  const title = section.title || section.section_title || `第${index + 1}节`
  const keyPoints = section.key_points || section.key_concepts || []
  const content = section.content || section.body || ''

  const examples = (section.examples || []).map(ex => {
    if (typeof ex === 'object') {
      return { title: ex.title || '示例', description: ex.description || '', content: ex.content || ex.code || '' }
    }
    return { title: '示例', description: '', content: String(ex) }
  })

  const commonMistakes = section.common_mistakes || section.pitfalls || []
  const furtherReading = section.further_reading || section.references || []

  return {
    section_id: sectionId,
    title,
    key_points: keyPoints,
    content,
    examples,
    common_mistakes: Array.isArray(commonMistakes) ? commonMistakes : [String(commonMistakes)],
    further_reading: Array.isArray(furtherReading) ? furtherReading : [String(furtherReading)],
  }
}

function buildSectionsFromGeneric(data) {
  const sections = []
  const skipKeys = new Set(['title', 'name', 'summary', 'description', 'raw_response', 'parse_error', 'glossary', 'review_questions', 'target_audience'])

  for (const key of Object.keys(data).slice(0, 8)) {
    if (skipKeys.has(key)) continue
    const value = data[key]
    if (typeof value === 'string' && value.length > 50) {
      sections.push({
        section_id: `s${sections.length + 1}`,
        title: humanizeKey(key),
        key_points: [],
        content: value,
        examples: [],
        common_mistakes: [],
        further_reading: [],
      })
    } else if (Array.isArray(value) && value.length > 0) {
      const itemsText = value.slice(0, 5).map(item => {
        if (typeof item !== 'object') return String(item)
        return item.content || item.description || JSON.stringify(item)
      }).join('\n\n')
      if (itemsText) {
        sections.push({
          section_id: `s${sections.length + 1}`,
          title: humanizeKey(key),
          key_points: [],
          content: itemsText,
          examples: [],
          common_mistakes: [],
          further_reading: [],
        })
      }
    }
  }

  return sections
}

function generateDocumentMarkdown(title, summary, sections, glossary, reviewQuestions) {
  const parts = []
  parts.push(`# ${title}\n`)
  if (summary) parts.push(`> ${summary}\n`)

  for (const sec of sections) {
    parts.push(`\n## ${sec.title}\n`)
    if (sec.key_points?.length) {
      parts.push('**核心要点：**')
      for (const kp of sec.key_points) parts.push(`- ${kp}`)
      parts.push('')
    }
    if (sec.content) {
      parts.push(sec.content)
      parts.push('')
    }
    if (sec.examples?.length) {
      parts.push('### 示例\n')
      for (const ex of sec.examples) {
        parts.push(`**${ex.title}**`)
        if (ex.description) parts.push(`\n${ex.description}`)
        if (ex.content) parts.push(`\n\`\`\`\n${ex.content}\n\`\`\``)
        parts.push('')
      }
    }
    if (sec.common_mistakes?.length) {
      parts.push('### 常见误区\n')
      for (const cm of sec.common_mistakes) parts.push(`- ⚠️ ${cm}`)
      parts.push('')
    }
  }

  if (glossary?.length) {
    parts.push('\n## 术语表\n')
    for (const item of glossary) parts.push(`- **${item.term}**：${item.definition}`)
    parts.push('')
  }

  if (reviewQuestions?.length) {
    parts.push('\n## 复习思考题\n')
    reviewQuestions.forEach((q, idx) => parts.push(`${idx + 1}. ${q}`))
    parts.push('')
  }

  return parts.join('\n')
}

export function convertContent(contentType, rawContent, topic = '', options = {}) {
  switch (contentType) {
    case 'mindmap':
      return convertMindmap(rawContent, topic)
    case 'project':
      return convertCodePractical(rawContent, topic, options)
    case 'document':
      return convertDocument(rawContent, topic)
    default:
      return rawContent
  }
}
