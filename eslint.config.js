import js from '@eslint/js'
import globals from 'globals'

/** 확장 각 실행 환경에서 쓸 수 있는 전역. */
const extensionGlobals = Object.freeze({ ...globals.browser, ...globals.webextensions })

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },

  js.configs.recommended,

  {
    // 콘텐츠 스크립트 / UI 페이지 — DOM 과 chrome API 를 쓴다.
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: extensionGlobals,
    },
    rules: {
      // logger.js 가 console 을 감싸므로 그 외의 직접 호출을 막되,
      // 모듈 로더는 logger 를 import 할 수 없어 error 만 허용한다.
      'no-console': ['error', { allow: ['debug', 'info', 'warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-coercion': 'error',
      'no-param-reassign': 'error',
      'prefer-object-spread': 'error',
      'object-shorthand': 'error',
      'no-else-return': 'error',
      'max-depth': ['error', 4],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
    },
  },

  {
    files: ['tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...extensionGlobals },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 테스트는 시나리오를 길게 서술할 수 있다.
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs', 'vitest.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },
]
