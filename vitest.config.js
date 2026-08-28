import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      /**
       * 순수 로직과 DOM 로직만 측정한다.
       * 제외 대상은 chrome.* API 를 직접 호출하는 접착 코드로, 실제 브라우저에서만 검증 가능하다
       * (service-worker / messaging / keep-alive / content 라우터 / loader / UI).
       */
      include: [
        'src/generator/**',
        'src/shared/**',
        'src/content/dom/**',
        'src/content/actions/**',
        'src/content/probe.js',
        'src/background/run-state.js',
        'src/background/orchestrator.js',
        'src/background/run-guard.js',
        'src/background/stop-signal.js',
        'src/background/run-loop.js',
        'src/background/process-item.js',
        'src/background/tab-picker.js',
        'src/background/form-tab.js',
        'src/ui/run-view.js',
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
})
