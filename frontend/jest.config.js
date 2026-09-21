export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/services/api$': '<rootDir>/src/test/api-mock.js',
    '^../services/api$': '<rootDir>/src/test/api-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^vitest$': '<rootDir>/src/test/vitest-shim.js',
    '^\\.\\./\\.\\./\\.\\./services/searchApi$': '<rootDir>/src/services/searchApi.js',
    '^../websocket$': '<rootDir>/src/services/websocket.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['@babel/preset-env', '@babel/preset-react'] }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios|lucide-react)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.jsx',
    '!src/vite-env.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.js',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '<rootDir>/src/components/CourseLearningPage.test.jsx',
    '<rootDir>/src/components/StudyNotes/__tests__/VideoNotesPanel.test.jsx',
    '<rootDir>/src/components/MistakeBook/__tests__/MistakeBook.test.jsx',
    '<rootDir>/src/components/Search/__tests__/SearchBar.test.jsx',
    '<rootDir>/src/components/Search/__tests__/SearchResults.test.jsx',
    '<rootDir>/src/components/__tests__/StudentInteractionPanel.test.jsx',
  ],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  // Vite 在构建时会把 import.meta.env.VITE_* 静态替换成字面量；Jest 不经过
  // Vite，且 CommonJS 下 import.meta 是解析期语法错误，会让整个测试套件
  // "failed to run"（静默失效）。这里按 Vite 的语义补一个等价替换。
  globals: {
    import_meta_env: { VITE_API_BASE_URL: process.env.VITE_API_BASE_URL },
  },
  verbose: true,
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
}
