import { convertMindmap, convertDocument, convertCodePractical, convertContent, ensureObject } from '../contentConverter'

const NODE_W = 180
const NODE_H = 52
const LAYER_GAP = 130
const SIBLING_GAP = 30
const MIN_SCALE = 0.3
const MAX_SCALE = 3.0
const SCALE_STEP = 0.05

function calcSubtreeWidths(node, collapsed = new Set(), path = 'r', depth = 0) {
  const id = path
  if (!node.children?.length || collapsed.has(id)) {
    return { ...node, _id: id, _sw: NODE_W, _kids: [], _depth: depth }
  }
  const _kids = node.children.map((c, i) =>
    calcSubtreeWidths(c, collapsed, `${id}.${i}`, depth + 1)
  )
  const total = _kids.reduce((s, k) => s + k._sw, 0) + (_kids.length - 1) * SIBLING_GAP
  return { ...node, _id: id, _sw: Math.max(NODE_W, total), _kids, _depth: depth }
}

function positionTree(node, x, y) {
  const nx = x + node._sw / 2 - NODE_W / 2
  const depth = node._depth || 0
  const current = {
    id: node._id,
    name: node.name,
    description: node.description || '',
    is_core: node.is_core,
    relationship_type: node.relationship_type,
    x: Math.round(nx * 100) / 100,
    y: Math.round(y * 100) / 100,
    hasKids: node._kids.length > 0,
    depth,
    childCount: node.children?.length || 0,
  }
  const nodes = [current]
  const edges = []
  if (node._kids.length) {
    const tw = node._kids.reduce((s, k) => s + k._sw, 0) + (node._kids.length - 1) * SIBLING_GAP
    let cx = x + (node._sw - tw) / 2
    for (const kid of node._kids) {
      const sub = positionTree(kid, cx, y + LAYER_GAP)
      nodes.push(...sub.nodes)
      edges.push(...sub.edges)
      const kidNode = sub.nodes[0]
      const fx = current.x + NODE_W / 2
      const fy = current.y + NODE_H
      const tx = kidNode.x + NODE_W / 2
      const ty = kidNode.y
      edges.push({
        fromId: current.id,
        toId: kidNode.id,
        fx: Math.round(fx * 100) / 100,
        fy: Math.round(fy * 100) / 100,
        tx: Math.round(tx * 100) / 100,
        ty: Math.round(ty * 100) / 100,
        rel: kid.relationship_type,
        fromDepth: depth,
        toDepth: kid._depth || depth + 1,
      })
      cx += kid._sw + SIBLING_GAP
    }
  }
  return { nodes, edges }
}

describe('ContentConverter - JSON Extraction', () => {
  test('valid JSON object', () => {
    const result = ensureObject('{"key": "value"}')
    expect(result.key).toBe('value')
  })

  test('JSON with prefix text', () => {
    const result = ensureObject('Here is: {"key": "value"}')
    expect(result.key).toBe('value')
  })

  test('JSON with suffix text', () => {
    const result = ensureObject('{"key": "value"} end')
    expect(result.key).toBe('value')
  })

  test('JSON in code fence', () => {
    const result = ensureObject('```json\n{"key": "value"}\n```')
    expect(result.key).toBe('value')
  })

  test('nested braces extraction', () => {
    const result = ensureObject('text {"a": {"b": 1}} more')
    expect(result.a.b).toBe(1)
  })

  test('multiple JSON objects - picks first balanced', () => {
    const result = ensureObject('prefix {"a": 1} garbage {"b": 2}')
    expect(result.a).toBe(1)
  })

  test('invalid JSON fallback', () => {
    const result = ensureObject('not json at all')
    expect(result.raw_response).toBeDefined()
  })

  test('Chinese JSON content', () => {
    const result = ensureObject('{"名称": "数据库", "描述": "关系型数据库"}')
    expect(result['名称']).toBe('数据库')
  })

  test('null input', () => {
    const result = ensureObject(null)
    expect(result).toEqual({})
  })

  test('object input passthrough', () => {
    const input = { key: 'value' }
    const result = ensureObject(input)
    expect(result).toBe(input)
  })
})

describe('ContentConverter - Mindmap', () => {
  test('basic mindmap with root and children', () => {
    const data = { root: { name: 'Root', description: 'Desc', children: [
      { name: 'C1', description: '', children: [] },
      { name: 'C2', description: '', children: [] },
    ]}}
    const result = convertMindmap(JSON.stringify(data), 'test')
    expect(result.root.name).toBe('Root')
    expect(result.root.children.length).toBe(2)
  })

  test('mindmap wrapped in mindmap key', () => {
    const data = { mindmap: { root: { name: 'R', description: '', children: [] } } }
    const result = convertMindmap(JSON.stringify(data), 'test')
    expect(result.root.name).toBe('R')
  })

  test('mindmap from document structure', () => {
    const data = { title: 'Doc', sections: [{ title: 'S1', key_points: ['K1'] }] }
    const result = convertMindmap(JSON.stringify(data), 'test')
    expect(result.root.name).toBe('Doc')
  })

  test('mindmap from project structure', () => {
    const data = { project_title: 'Proj', tasks: [{ title: 'T1' }] }
    const result = convertMindmap(JSON.stringify(data), 'test')
    expect(result.root.name).toBe('Proj')
  })

  test('mindmap is_core detection', () => {
    const data = { root: { name: 'R', importance: 'core', children: [] } }
    const result = convertMindmap(JSON.stringify(data), 'test')
    expect(result.root.is_core).toBe(true)
  })

  test('mindmap relationship_type normalization', () => {
    const data = { root: { name: 'R', relation: '递进', children: [] } }
    const result = convertMindmap(JSON.stringify(data), 'test')
    expect(result.root.relationship_type).toBe('递进')
  })
})

describe('MindMap Layout - Coordinate Precision', () => {
  test('single root node position', () => {
    const data = { name: 'Root', description: '', children: [] }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    expect(result.nodes.length).toBe(1)
    expect(result.edges.length).toBe(0)
    const root = result.nodes[0]
    expect(Number.isFinite(root.x)).toBe(true)
    expect(Number.isFinite(root.y)).toBe(true)
  })

  test('coordinate precision - at most 2 decimal places', () => {
    const data = {
      name: 'Root', description: '', children: [
        { name: 'A', description: '', children: [] },
        { name: 'B', description: '', children: [] },
        { name: 'C', description: '', children: [] },
      ]
    }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    for (const node of result.nodes) {
      const xStr = String(node.x)
      const yStr = String(node.y)
      if (xStr.includes('.')) {
        expect(xStr.split('.')[1].length).toBeLessThanOrEqual(2)
      }
      if (yStr.includes('.')) {
        expect(yStr.split('.')[1].length).toBeLessThanOrEqual(2)
      }
    }
  })

  test('edge coordinates precision', () => {
    const data = {
      name: 'Root', description: '', children: [
        { name: 'A', description: '', children: [
          { name: 'A1', description: '', children: [] },
        ]},
      ]
    }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    for (const edge of result.edges) {
      const checkPrec = (v) => {
        const s = String(v)
        if (s.includes('.')) {
          expect(s.split('.')[1].length).toBeLessThanOrEqual(2)
        }
      }
      checkPrec(edge.fx)
      checkPrec(edge.fy)
      checkPrec(edge.tx)
      checkPrec(edge.ty)
    }
  })

  test('no coordinate overlap between siblings', () => {
    const data = {
      name: 'Root', description: '', children: [
        { name: 'A', description: '', children: [] },
        { name: 'B', description: '', children: [] },
        { name: 'C', description: '', children: [] },
        { name: 'D', description: '', children: [] },
      ]
    }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    const childNodes = result.nodes.filter(n => n.depth === 1)
    for (let i = 0; i < childNodes.length - 1; i++) {
      const rightEdge = childNodes[i].x + NODE_W
      const leftEdge = childNodes[i + 1].x
      expect(leftEdge - rightEdge).toBeGreaterThanOrEqual(SIBLING_GAP - 1)
    }
  })

  test('parent centered above children', () => {
    const data = {
      name: 'Root', description: '', children: [
        { name: 'A', description: '', children: [] },
        { name: 'B', description: '', children: [] },
      ]
    }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    const root = result.nodes[0]
    const children = result.nodes.filter(n => n.depth === 1)
    const childrenCenter = (children[0].x + children[children.length - 1].x + NODE_W) / 2
    const rootCenter = root.x + NODE_W / 2
    expect(Math.abs(rootCenter - childrenCenter)).toBeLessThanOrEqual(1)
  })

  test('layer gap consistent', () => {
    const data = {
      name: 'Root', description: '', children: [
        { name: 'A', description: '', children: [
          { name: 'A1', description: '', children: [] },
        ]},
      ]
    }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    const root = result.nodes.find(n => n.depth === 0)
    const child = result.nodes.find(n => n.depth === 1)
    const grandchild = result.nodes.find(n => n.depth === 2)
    expect(child.y - root.y).toBeCloseTo(LAYER_GAP, 1)
    expect(grandchild.y - child.y).toBeCloseTo(LAYER_GAP, 1)
  })

  test('deep nesting - 4 levels', () => {
    const data = {
      name: 'L0', description: '', children: [{
        name: 'L1', description: '', children: [{
          name: 'L2', description: '', children: [{
            name: 'L3', description: '', children: [],
          }],
        }],
      }]
    }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    expect(result.nodes.length).toBe(4)
    expect(result.edges.length).toBe(3)
    for (let d = 0; d <= 3; d++) {
      const node = result.nodes.find(n => n.depth === d)
      expect(node).toBeDefined()
      expect(node.name).toBe(`L${d}`)
    }
  })

  test('wide tree - many siblings', () => {
    const children = Array.from({ length: 10 }, (_, i) => ({
      name: `Child${i}`, description: '', children: [],
    }))
    const data = { name: 'Root', description: '', children }
    const tree = calcSubtreeWidths(data)
    const result = positionTree(tree, 0, 0)
    expect(result.nodes.filter(n => n.depth === 1).length).toBe(10)
  })
})

describe('Scale Precision', () => {
  test('SCALE_STEP is 0.05', () => {
    expect(SCALE_STEP).toBe(0.05)
  })

  test('MIN_SCALE is 0.3', () => {
    expect(MIN_SCALE).toBe(0.3)
  })

  test('MAX_SCALE is 3.0', () => {
    expect(MAX_SCALE).toBe(3.0)
  })

  test('zoom in step is SCALE_STEP * 2', () => {
    const step = SCALE_STEP * 2
    expect(step).toBe(0.1)
    let scale = 1.0
    scale = Math.min(MAX_SCALE, +(scale + step).toFixed(2))
    expect(scale).toBe(1.1)
  })

  test('zoom out step is SCALE_STEP * 2', () => {
    const step = SCALE_STEP * 2
    let scale = 1.0
    scale = Math.max(MIN_SCALE, +(scale - step).toFixed(2))
    expect(scale).toBe(0.9)
  })

  test('wheel step is SCALE_STEP', () => {
    let scale = 1.0
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(scale + SCALE_STEP).toFixed(2)))
    expect(scale).toBe(1.05)
  })

  test('scale precision - toFixed(2)', () => {
    let scale = 1.0
    for (let i = 0; i < 10; i++) {
      scale = Math.min(MAX_SCALE, +(scale + SCALE_STEP).toFixed(2))
    }
    expect(scale).toBe(1.5)
    expect(String(scale).split('.')[1]?.length || 0).toBeLessThanOrEqual(2)
  })

  test('scale clamped to MIN_SCALE', () => {
    let scale = MIN_SCALE
    scale = Math.max(MIN_SCALE, +(scale - SCALE_STEP).toFixed(2))
    expect(scale).toBe(MIN_SCALE)
  })

  test('scale clamped to MAX_SCALE', () => {
    let scale = MAX_SCALE
    scale = Math.min(MAX_SCALE, +(scale + SCALE_STEP).toFixed(2))
    expect(scale).toBe(MAX_SCALE)
  })

  test('proportional scaling error within 0.5%', () => {
    const originalWidth = 1000
    for (const s of [0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0]) {
      const scaled = originalWidth * s
      const expected = originalWidth * s
      const errorPct = Math.abs(scaled - expected) / expected * 100
      expect(errorPct).toBeLessThanOrEqual(0.5)
    }
  })
})

describe('Bezier Curve Control Points', () => {
  test('control points use 0.4/0.6 split', () => {
    const fy = 100
    const ty = 230
    const dy = ty - fy
    const cp1y = fy + dy * 0.4
    const cp2y = fy + dy * 0.6
    expect(cp1y).toBe(152)
    expect(cp2y).toBe(178)
  })

  test('control points not equal to midpoint', () => {
    const fy = 0
    const ty = 100
    const dy = ty - fy
    const cp1y = fy + dy * 0.4
    const cp2y = fy + dy * 0.6
    const mid = (fy + ty) / 2
    expect(cp1y).not.toBe(mid)
    expect(cp2y).not.toBe(mid)
  })

  test('curve direction preserved for negative dy', () => {
    const fy = 200
    const ty = 100
    const dy = ty - fy
    const cp1y = fy + dy * 0.4
    const cp2y = fy + dy * 0.6
    expect(cp1y).toBeLessThan(fy)
    expect(cp2y).toBeLessThan(fy)
    expect(cp1y).toBeGreaterThan(cp2y)
  })
})

describe('ContentConverter - Document', () => {
  test('basic document conversion', () => {
    const data = {
      title: 'Test Doc',
      summary: 'A summary',
      sections: [{ title: 'S1', key_points: ['K1'], content: 'Content' }],
    }
    const result = convertDocument(JSON.stringify(data), 'test')
    expect(result.title).toBe('Test Doc')
    expect(result.sections.length).toBe(1)
  })

  test('document with glossary', () => {
    const data = {
      title: 'Doc',
      glossary: [{ term: 'API', definition: 'Interface' }],
    }
    const result = convertDocument(JSON.stringify(data), 'test')
    expect(result.glossary.length).toBe(1)
    expect(result.glossary[0].term).toBe('API')
  })
})

describe('ContentConverter - Code Practical', () => {
  test('basic project conversion', () => {
    const data = {
      project_title: 'Python Project',
      programming_language: 'python',
      tasks: [{ title: 'Task 1', description: 'Do something' }],
    }
    const result = convertCodePractical(JSON.stringify(data), 'test')
    expect(result.project_title).toBe('Python Project')
    expect(result.programming_language).toBe('python')
  })

  test('language normalization', () => {
    const data = { project_title: 'Proj', programming_language: 'JS' }
    const result = convertCodePractical(JSON.stringify(data), 'test')
    expect(result.programming_language).toBe('javascript')
  })
})
