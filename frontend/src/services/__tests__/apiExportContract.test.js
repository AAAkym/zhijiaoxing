/**
 * 服务层导出契约回归测试。
 *
 * 背景（真实踩过的坑，值得单独建一个测试文件）：
 * AgentExecutionHistoryPanel.jsx 曾写成 `import { resourceGeneration } from '@/services/api'`，
 * 而 api.js 根本没有导出这个对象。当时：
 *
 * - `pnpm test` 全绿 —— 因为组件测试用 jest.mock('@/services/api') 整个替换了模块，
 *   mock 里恰好也叫 resourceGeneration，于是「引用了一个不存在的导出」被 mock 完美掩盖。
 * - 只有 `pnpm run build` 才报：
 *   "resourceGeneration" is not exported by "src/services/api.js"
 *
 * 也就是说：测试通过 ≠ 代码可构建。这是本仓库最危险的失效模式（功能坏了但表面正常）
 * 在构建期的变体。
 *
 * 注意本文件**不能** `import ... from '@/services/api'`：jest.config.js 的 moduleNameMapper
 * 会把该路径映射到 src/test/api-mock.js，正是不想再被 mock 掩盖才写这个测试。
 * 因此这里直接读 api.js 源码做静态契约校验 —— 不渲染、不需要 DOM。
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = resolve(__dirname, '../..')
const API_SOURCE = readFileSync(resolve(SRC, 'services/api.js'), 'utf8')

/** 组件 → 它从 api.js 具名导入的对象，以及这些对象上被真实调用的方法。 */
const COMPONENT_API_CONTRACT = [
  {
    file: 'components/AgentExecutionHistoryPanel.jsx',
    imported: ['courseGeneration'],
    methods: { courseGeneration: ['getAgentExecutionHistory'] },
  },
  {
    file: 'components/ClassLearningTypesPanel.jsx',
    imported: ['classManagement'],
    methods: { classManagement: ['getClassLearningGroups'] },
  },
  {
    file: 'components/PersonalizedLearningTasks.jsx',
    imported: ['personalizedLearning'],
    methods: {
      personalizedLearning: [
        'getStudentResourceBasis',
        'getStudentDeliveries',
        'startStudentDelivery',
        'completeStudentResource',
      ],
    },
  },
]

/** 取 `export const NAME = {` 到其匹配右花括号之间的源码块。 */
function extractExportedObjectSource(name) {
  const marker = 'export const ' + name + ' = {'
  const start = API_SOURCE.indexOf(marker)
  if (start === -1) return null
  let depth = 0
  for (let i = start + marker.length - 1; i < API_SOURCE.length; i += 1) {
    if (API_SOURCE[i] === '{') depth += 1
    else if (API_SOURCE[i] === '}') {
      depth -= 1
      if (depth === 0) return API_SOURCE.slice(start, i + 1)
    }
  }
  return null
}

/** 从源码里解析出具名导入：import { a, b } from '@/services/api' */
const API_IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*'@\/services\/api'/

function parseApiImports(source) {
  const match = source.match(API_IMPORT_RE)
  if (!match) return []
  return match[1]
    .split(',')
    .map((name) => name.trim().split(/\s+as\s+/)[0].trim())
    .filter(Boolean)
}

const REAL_EXPORT_NAMES = new Set(
  [...API_SOURCE.matchAll(/export const (\w+)/g)].map((m) => m[1])
)

test('every object a component imports from services/api really exists', () => {
  for (const contract of COMPONENT_API_CONTRACT) {
    const source = readFileSync(resolve(SRC, contract.file), 'utf8')
    const imported = parseApiImports(source)

    expect(imported.length).toBeGreaterThan(0)
    for (const name of imported) {
      // 这就是 build 会报错的那一类：导入了 api.js 里不存在的名字。
      expect(REAL_EXPORT_NAMES.has(name)).toBe(true)
    }
    // 双向核对：源码里的具名导入与契约表必须一致，防止契约表过期后静默失效。
    expect([...imported].sort()).toEqual([...contract.imported].sort())
  }
})

test('every method a component calls on services/api is actually exported', () => {
  for (const contract of COMPONENT_API_CONTRACT) {
    for (const [objectName, methods] of Object.entries(contract.methods)) {
      const objectSource = extractExportedObjectSource(objectName)
      expect(objectSource).not.toBeNull()
      for (const method of methods) {
        expect(objectSource).toContain(method + ':')
      }
    }
  }
})

test('the new endpoints are wired to the documented backend paths', () => {
  expect(API_SOURCE).toContain('/resource-generation/agents/history?days=')
  expect(API_SOURCE).toContain('/learning-groups')
  expect(API_SOURCE).toContain('/basis')
})
