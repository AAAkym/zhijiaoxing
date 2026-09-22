export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // 组件用相对路径导入 API，测试用 '@/' 别名导入。两条规则必须指向**同一个
    // mock 模块**，否则组件与测试各拿一份不同对象，断言 mock 调用次数永远是 0。
    //
    // 组件侧统一用 '@/services/api' 导入（与仓库多数文件一致），测试也用它，
    // 这样两边命中同一条规则、拿到同一个模块实例 —— 断言 mock 调用次数才有意义。
    // 注意：'../../services/...' 这类更深的相对写法无法被 mapper 可靠拦截，
    // 曾导致组件静默打到真实实现并发起真实网络请求，因此不保留此类规则。
    '^@/services/api$': '<rootDir>/src/test/api-mock.js',
    '^\\./services/api$': '<rootDir>/src/test/api-mock.js',
    '^@/services/searchApi$': '<rootDir>/src/test/searchApi-mock.js',
    '^\\./services/searchApi$': '<rootDir>/src/test/searchApi-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^vitest$': '<rootDir>/src/test/vitest-shim.js',
    // 样式文件在测试里没有意义，统一替换成空对象。必须用 '.*' 前缀：Jest 会先把
    // 相对路径解析成绝对路径再套用 moduleNameMapper。
    '.*\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    // babel-jest 会自动把 babel-preset-jest 追加到 presets 末尾（见 babel-jest
    // 的 presets.concat(jestPresetPath)）。它带来 babel-plugin-jest-hoist，
    // 负责把 jest.mock / vi.mock 提升到文件顶部。不要手动再加 babel-preset-jest。
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react'] }],
  },
  transformIgnorePatterns: ['node_modules/(?!(axios|lucide-react)/)'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.jsx',
    '!src/vite-env.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.js',
  ],
  coverageThreshold: { global: { branches: 80, functions: 80, lines: 80, statements: 80 } },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  // 只排除构建产物。**严禁**在这里逐个列出测试文件来「消红」—— 被排除的测试
  // 既不是 pass 也不是 fail，而是不存在，CI 会显示 100% 绿色。
  // 2026-09-22 巡检发现：此前这里硬编码排除了 6 个文件、102 个用例，使通过率虚高。
  // 若某套件确实修不好，请在报告中登记，而不是删掉它的可见性。
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  // Vite 构建时会把 import.meta.env.VITE_* 静态替换成字面量；Jest 不经过 Vite，
  // 且 CommonJS 下裸写 import.meta 是解析期语法错误，会让整个套件 failed to run。
  globals: { import_meta_env: { VITE_API_BASE_URL: process.env.VITE_API_BASE_URL } },
  verbose: true,
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  // resetMocks 会连 mockResolvedValueOnce 的队列、以及共享 mock 模块里
  // jest.fn(impl) 的默认实现一起清掉，导致「测试里明明设了返回值却拿到空对象」
  // 这类极难排查的失败。clearMocks 已经能满足用例间隔离（只清调用记录、保留实现），
  // 因此这里明确关闭 resetMocks。
  resetMocks: false,
}
