import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, process: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-irregular-whitespace': 'warn',
      'no-useless-escape': 'warn',
      // a11y 静态检查（第二轮 D-6）：先以 warn 级接入产出首轮清单，不阻塞 CI；
      // 清单消化后再逐条升级为 error。规则集用 recommended 而非 strict。
      // （recommended 自带 error 级，这里整体降为 warn）
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules).map(([k, v]) => [
          k,
          // 数组形态的第一位才是级别（如 no-static-element-interactions 带 options）
          Array.isArray(v) && v[0] === 'error' ? ['warn', ...v.slice(1)] : v === 'error' ? 'warn' : v,
        ])
      ),
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['**/__tests__/**/*.{js,jsx}', '**/*.test.{js,jsx}', 'jest.setup.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, ...globals.jest, vi: 'readonly' },
    },
  },
  {
    files: ['vite.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/service-worker.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, openDB: 'readonly' },
    },
  },
]
