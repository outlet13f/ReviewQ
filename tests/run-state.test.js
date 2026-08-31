import { describe, expect, test } from 'vitest'
import { ITEM_STATUS, RUN_PHASE } from '../src/shared/constants.js'
import { mergeSettings } from '../src/shared/settings.js'
import {
  completedCount,
  createRunState,
  nextPendingItem,
  shouldStop,
  summarize,
  withError,
  withFinished,
  withItemResult,
  withPhase,
  withStopRequested,
} from '../src/background/run-state.js'

const settings = mergeSettings({ maxItemsPerRun: 3, stopOnConsecutiveFailures: 2 })
const baseState = () => createRunState({ runId: 'run-1', settings, startedAt: 1000 })

const submitted = (key) => ({ key, status: ITEM_STATUS.SUBMITTED, text: `리뷰 ${key}` })
const failed = (key) => ({ key, status: ITEM_STATUS.FAILED, message: '오류' })

describe('createRunState', () => {
  test('처리 건수 0 에서 시작한다', () => {
    const state = baseState()

    expect(state.counts).toEqual({ submitted: 0, dryRun: 0, skipped: 0, failed: 0 })
    expect(state.phase).toBe(RUN_PHASE.SCANNING)
    expect(Object.isFrozen(state)).toBe(true)
  })
})

describe('withItemResult', () => {
  test('원본 상태를 변형하지 않는다', () => {
    const state = baseState()

    withItemResult(state, submitted('a'))

    expect(state.counts.submitted).toBe(0)
    expect(state.results).toHaveLength(0)
  })

  test('상태별 건수를 올린다', () => {
    let state = baseState()

    state = withItemResult(state, submitted('a'))
    state = withItemResult(state, { key: 'b', status: ITEM_STATUS.DRY_RUN, text: 'x' })
    state = withItemResult(state, failed('c'))

    expect(state.counts).toEqual({ submitted: 1, dryRun: 1, skipped: 0, failed: 1 })
  })

  test('알 수 없는 상태는 건수를 바꾸지 않는다', () => {
    const state = withItemResult(baseState(), { key: 'a', status: 'WEIRD' })

    expect(state.counts).toEqual({ submitted: 0, dryRun: 0, skipped: 0, failed: 0 })
  })

  test('연속 실패를 세고 성공 시 초기화한다', () => {
    let state = baseState()

    state = withItemResult(state, failed('a'))
    state = withItemResult(state, failed('b'))
    expect(state.consecutiveFailures).toBe(2)

    state = withItemResult(state, submitted('c'))
    expect(state.consecutiveFailures).toBe(0)
  })

  test('실패한 키의 잔존 횟수를 센다', () => {
    let state = withItemResult(baseState(), failed('a'))
    state = withItemResult(state, failed('a'))

    expect(state.retainedCounts).toEqual({ a: 2 })
  })

  test('드라이런도 잔존 횟수에 포함된다', () => {
    // 드라이런은 등록하지 않으므로 항목이 목록에 그대로 남는다.
    const state = withItemResult(baseState(), { key: 'a', status: ITEM_STATUS.DRY_RUN, text: 'x' })

    expect(state.retainedCounts).toEqual({ a: 1 })
  })

  test('등록 성공은 잔존 횟수에 포함되지 않는다', () => {
    // 성공한 항목만 네이버 목록에서 사라진다.
    const state = withItemResult(baseState(), submitted('a'))

    expect(state.retainedCounts).toEqual({})
  })

  test('생성된 본문을 중복 회피용으로 쌓는다', () => {
    const state = withItemResult(baseState(), submitted('a'))

    expect(state.recentTexts).toEqual(['리뷰 a'])
  })

  test('본문이 없으면 recentTexts 를 건드리지 않는다', () => {
    const state = withItemResult(baseState(), failed('a'))

    expect(state.recentTexts).toEqual([])
  })

  test('결과는 최신순으로 쌓이고 미리보기는 잘린다', () => {
    const long = 'ㄱ'.repeat(200)
    let state = withItemResult(baseState(), submitted('a'))
    state = withItemResult(state, { key: 'b', status: ITEM_STATUS.SUBMITTED, text: long })

    expect(state.results[0].key).toBe('b')
    expect(state.results[0].textPreview).toHaveLength(80)
  })
})

describe('shouldStop', () => {
  test('아무 조건도 안 맞으면 null 이다', () => {
    expect(shouldStop(baseState())).toBeNull()
  })

  test('사용자 중단 요청을 최우선으로 본다', () => {
    const state = withStopRequested(baseState())

    expect(shouldStop(state).reason).toBe('user')
    expect(state.phase).toBe(RUN_PHASE.STOPPING)
  })

  test('최대 건수에 도달하면 멈춘다', () => {
    let state = baseState()
    for (const key of ['a', 'b', 'c']) state = withItemResult(state, submitted(key))

    expect(shouldStop(state).reason).toBe('limit')
  })

  test('실패는 최대 건수에 포함되지 않는다', () => {
    let state = baseState()
    state = withItemResult(state, failed('a'))
    state = withItemResult(state, submitted('b'))

    expect(completedCount(state)).toBe(1)
  })

  test('연속 실패 임계값에 도달하면 멈춘다', () => {
    let state = baseState()
    state = withItemResult(state, failed('a'))
    state = withItemResult(state, failed('b'))

    expect(shouldStop(state).reason).toBe('failures')
  })
})

describe('nextPendingItem', () => {
  const items = [{ key: 'a' }, { key: 'b' }, { key: 'c' }]

  /*
   * 성공한 항목은 네이버 목록에서 사라진다. 그래서 "이미 성공한 키"를 추적할 필요가 없고,
   * 추적하면 오히려 해롭다 — 같은 상품을 여러 번 구매하면 항목들의 키가 동일하기 때문이다
   * (실측: 20개 항목 중 3개가 같은 상품명, DOM 에 항목 고유 ID 없음).
   * 따라서 건너뛸 기준은 "실패한 횟수"뿐이다.
   */

  test('아무것도 실패하지 않았으면 첫 항목을 고른다', () => {
    expect(nextPendingItem(baseState(), items).key).toBe('a')
  })

  test('등록 성공한 항목은 목록에서 사라지므로 건너뛰지 않는다', () => {
    // 성공 뒤 목록에 남아 있다면 그것은 사라지지 않은 다른 구매 건이다.
    const state = withItemResult(baseState(), submitted('a'))

    expect(nextPendingItem(state, items).key).toBe('a')
  })

  test('드라이런한 항목은 목록에 남으므로 다음 항목으로 넘어간다', () => {
    const state = withItemResult(baseState(), { key: 'a', status: ITEM_STATUS.DRY_RUN, text: 'x' })

    expect(nextPendingItem(state, items).key).toBe('b')
  })

  test('실패한 항목은 다시 시도하지 않는다', () => {
    const state = withItemResult(baseState(), failed('a'))

    expect(nextPendingItem(state, items).key).toBe('b')
  })

  test('같은 키가 여러 개면 실패한 횟수만큼만 건너뛴다', () => {
    // 같은 상품 3개 중 1개가 실패했다면 나머지 2개는 여전히 처리 대상이다.
    const 동일상품목록 = [{ key: 'name:텀블러' }, { key: 'name:텀블러' }, { key: 'name:텀블러' }]
    const state = withItemResult(baseState(), failed('name:텀블러'))

    expect(nextPendingItem(state, 동일상품목록)).not.toBeNull()
  })

  test('같은 키 전부가 실패했으면 더 고르지 않는다', () => {
    const 동일상품목록 = [{ key: 'name:텀블러' }, { key: 'name:텀블러' }]
    let state = baseState()
    state = withItemResult(state, failed('name:텀블러'))
    state = withItemResult(state, failed('name:텀블러'))

    expect(nextPendingItem(state, 동일상품목록)).toBeNull()
  })

  test('모두 실패했으면 null 이다', () => {
    let state = baseState()
    for (const key of ['a', 'b', 'c']) state = withItemResult(state, failed(key))

    expect(nextPendingItem(state, items)).toBeNull()
  })

  test('배열이 아니면 null 이다', () => {
    expect(nextPendingItem(baseState(), null)).toBeNull()
  })
})

describe('상태 전이', () => {
  test('withPhase 는 단계만 바꾼다', () => {
    const state = withPhase(baseState(), RUN_PHASE.WRITING)

    expect(state.phase).toBe(RUN_PHASE.WRITING)
    expect(state.runId).toBe('run-1')
  })

  test('withFinished 는 완료 시각을 남긴다', () => {
    const state = withFinished(baseState(), 5000)

    expect(state.phase).toBe(RUN_PHASE.DONE)
    expect(state.finishedAt).toBe(5000)
  })

  test('withError 는 실패 단계로 바꾸고 사유를 남긴다', () => {
    const state = withError(baseState(), '탭을 열 수 없음')

    expect(state.phase).toBe(RUN_PHASE.FAILED)
    expect(state.error).toBe('탭을 열 수 없음')
  })
})

describe('summarize', () => {
  test('팝업에 필요한 값만 담는다', () => {
    const state = withItemResult(baseState(), submitted('a'))

    const summary = summarize(state)

    expect(summary).toMatchObject({ phase: RUN_PHASE.SCANNING, completed: 1, limit: 3, dryRun: true })
    expect(summary.recent).toHaveLength(1)
  })

  test('최근 결과는 10건까지만 담는다', () => {
    let state = createRunState({ runId: 'r', settings: mergeSettings({ maxItemsPerRun: 200 }), startedAt: 0 })
    for (let index = 0; index < 15; index += 1) state = withItemResult(state, submitted(`k${index}`))

    expect(summarize(state).recent).toHaveLength(10)
  })
})
