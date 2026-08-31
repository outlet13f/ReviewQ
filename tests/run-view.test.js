/**
 * 팝업 표시 로직.
 *
 * 팝업은 chrome API 접착 코드라 테스트가 어렵다. 그래서 "상태 -> 화면에 보일 값"
 * 변환만 순수 함수로 떼어 낸다. 특히 폴링 지속 여부는 서비스 워커 수명에 영향을 주므로
 * 반드시 검증 대상이어야 한다.
 */

import { describe, expect, test } from 'vitest'
import { ITEM_STATUS, RUN_PHASE } from '../src/shared/constants.js'
import { describeRun } from '../src/ui/run-view.js'

const summaryOf = (overrides = {}) => ({
  runId: 'run-1',
  phase: RUN_PHASE.WRITING,
  counts: { submitted: 1, dryRun: 2, skipped: 0, failed: 1 },
  completed: 3,
  limit: 10,
  dryRun: true,
  consecutiveFailures: 0,
  startedAt: 0,
  finishedAt: null,
  error: null,
  recent: [],
  ...overrides,
})

describe('describeRun — 실행 중이 아닐 때', () => {
  test('실행 기록이 없으면 대기 상태로 보여준다', () => {
    const view = describeRun(null)

    expect(view.phaseLabel).toBe('대기')
    expect(view.isRunning).toBe(false)
    expect(view.results).toEqual([])
  })

  test('실행 기록이 없으면 폴링하지 않는다', () => {
    // 폴링 한 번마다 서비스 워커가 깨어난다. 볼 것이 없으면 재우는 게 맞다.
    expect(describeRun(null).shouldPoll).toBe(false)
  })

  test('완료된 실행은 더 폴링하지 않는다', () => {
    const view = describeRun(summaryOf({ phase: RUN_PHASE.DONE, finishedAt: 100 }))

    expect(view.shouldPoll).toBe(false)
    expect(view.isRunning).toBe(false)
  })

  test('실패한 실행도 더 폴링하지 않는다', () => {
    const view = describeRun(summaryOf({ phase: RUN_PHASE.FAILED, error: '탭을 열지 못했습니다' }))

    expect(view.shouldPoll).toBe(false)
  })
})

describe('describeRun — 실행 중일 때', () => {
  test('작성 중이면 폴링을 이어 간다', () => {
    const view = describeRun(summaryOf({ phase: RUN_PHASE.WRITING }))

    expect(view.shouldPoll).toBe(true)
    expect(view.isRunning).toBe(true)
    expect(view.phaseLabel).toBe('리뷰 작성 중')
  })

  test('목록 확인 중에도 폴링한다', () => {
    expect(describeRun(summaryOf({ phase: RUN_PHASE.SCANNING })).shouldPoll).toBe(true)
  })

  test('중단 처리 중에도 폴링한다', () => {
    const view = describeRun(summaryOf({ phase: RUN_PHASE.STOPPING }))

    expect(view.shouldPoll).toBe(true)
    expect(view.phaseLabel).toBe('중단 중')
  })

  test('알 수 없는 단계는 그대로 보여주고 폴링하지 않는다', () => {
    const view = describeRun(summaryOf({ phase: 'WEIRD' }))

    expect(view.phaseLabel).toBe('WEIRD')
    expect(view.shouldPoll).toBe(false)
  })
})

describe('describeRun — 표시 값', () => {
  test('진행률에 완료 수, 상한, 실패 수를 담는다', () => {
    const view = describeRun(summaryOf({ completed: 3, limit: 10, counts: { submitted: 2, dryRun: 1, skipped: 0, failed: 4 } }))

    expect(view.progressText).toBe('3 / 10 (실패 4)')
  })

  test('드라이런 배지를 표시한다', () => {
    const view = describeRun(summaryOf({ dryRun: true }))

    expect(view.badge.text).toBe('드라이런')
    expect(view.badge.className).toContain('dry')
  })

  test('실제 등록 배지를 표시한다', () => {
    const view = describeRun(summaryOf({ dryRun: false }))

    expect(view.badge.text).toBe('실제 등록')
    expect(view.badge.className).toContain('live')
  })

  test('결과 목록을 그대로 전달한다', () => {
    const recent = [{ key: 'a', productName: '사과', status: ITEM_STATUS.SUBMITTED, message: '완료', textPreview: '' }]

    expect(describeRun(summaryOf({ recent })).results).toEqual(recent)
  })

  test('버튼 활성 상태를 실행 여부에서 끌어낸다', () => {
    expect(describeRun(summaryOf({ phase: RUN_PHASE.WRITING }).startDisabled ?? summaryOf()).isRunning).toBe(true)
    expect(describeRun(summaryOf({ phase: RUN_PHASE.DONE })).isRunning).toBe(false)
  })
})

describe('describeRun — 알림', () => {
  test('오류가 있으면 오류 알림을 만든다', () => {
    const view = describeRun(summaryOf({ phase: RUN_PHASE.FAILED, error: '탭을 열지 못했습니다' }))

    expect(view.notice).toEqual({ message: '탭을 열지 못했습니다', kind: 'error' })
  })

  test('정상 완료하면 완료 알림을 만든다', () => {
    const view = describeRun(summaryOf({ phase: RUN_PHASE.DONE }))

    expect(view.notice.kind).toBe('ok')
    expect(view.notice.message).toContain('끝났습니다')
  })

  test('실행 중에는 알림이 없다', () => {
    expect(describeRun(summaryOf({ phase: RUN_PHASE.WRITING })).notice).toBeNull()
  })

  test('실행 기록이 없으면 알림이 없다', () => {
    expect(describeRun(null).notice).toBeNull()
  })
})
