import { describe, expect, test, vi } from 'vitest'
import { ITEM_STATUS, LIMITS, MSG, RUN_PHASE, STORAGE_KEY } from '../src/shared/constants.js'
import { fillFormTimeoutMs } from '../src/shared/timing.js'
import { err, ok } from '../src/shared/result.js'
import { mergeSettings } from '../src/shared/settings.js'
import { createRandom } from '../src/generator/random.js'
import { createOrchestrator } from '../src/background/orchestrator.js'
import { requestStop } from '../src/background/stop-signal.js'

const silentLog = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }

const LIST_TAB_ID = 1
const FORM_TAB_ID = 2

/**
 * 실제 동작을 흉내낸다.
 * - "리뷰쓰기" 는 **새 창**을 연다 (목록 탭을 이동시키지 않는다)
 * - 등록 성공은 폼 창의 URL 리다이렉트로 확인된다
 * - 등록한 항목은 목록에서 사라진다
 */
const createFakeMessaging = ({
  items,
  failOn = {},
  tabFailure = null,
  navigateFailure = null,
  onSubmit = null,
  formTabFailure = null,
  registrationFailure = null,
}) => {
  let remaining = items.map((item) => ({ ...item }))
  let openedKey = null
  const calls = []
  const closedTabs = []

  const messaging = {
    openReviewListTab: vi.fn(async () => (tabFailure ? err(tabFailure) : ok(LIST_TAB_ID))),
    ensureReady: vi.fn(async () => ok('ready')),
    navigateTab: vi.fn(async () => (navigateFailure ? err(navigateFailure) : ok('navigated'))),
    waitForFormTab: vi.fn(async () => (formTabFailure ? err(formTabFailure) : ok(FORM_TAB_ID))),
    getTab: vi.fn(async (id) =>
      ok({
        id,
        url:
          id === FORM_TAB_ID
            ? `https://shopping.naver.com/popup/reviews/form?orderNo=1&productOrderNos=${openedKey ?? 'x'}`
            : 'https://shopping.naver.com/my/writable-reviews',
      }),
    ),
    watchRegistration: vi.fn(() => ({
      wait: async () => (registrationFailure ? err(registrationFailure) : ok('registered-redirect')),
      stop: () => {},
    })),
    closeTab: vi.fn(async (id) => {
      closedTabs.push(id)
      return ok('closed')
    }),
    sendToTab: vi.fn(async (_tabId, type, payload) => {
      calls.push({ type, payload })
      // 실제 페이지에서는 OPEN_ITEM 응답이 끊겨도 폼이 열리므로, 실패로 응답하더라도
      // 어떤 항목을 열었는지는 기록된다. 페이크도 그렇게 동작해야 현실을 반영한다.
      if (type === MSG.OPEN_ITEM) openedKey = payload.key
      if (failOn[type]) return err(failOn[type])

      if (type === MSG.SCAN_LIST) {
        if (remaining.length === 0) return err('작성 가능한 리뷰가 없습니다.')
        return ok({ items: remaining.map((item, index) => ({ ...item, index })), total: remaining.length })
      }
      if (type === MSG.OPEN_ITEM) {
        // 페이지 이동으로 응답이 끊겨도 폼은 실제로 열린다.
        // 그래서 실패를 반환하는 경우에도 "무엇을 열었는지"는 기록해 둔다.
        openedKey = payload.key
        return ok({ opened: true })
      }
      if (type === MSG.FILL_FORM) return ok({ rating: { strategy: 'radio-input' }, text: { length: 50 } })
      if (type === MSG.SUBMIT_FORM) {
        if (onSubmit) await onSubmit()
        remaining = remaining.filter((item) => item.key !== openedKey)
        return ok({
          submitted: payload.dryRun !== true,
          dryRun: payload.dryRun === true,
          evidence: 'success-text',
          warnings: [],
        })
      }
      if (type === MSG.LOAD_MORE) return ok({ loaded: false })
      return err(`처리하지 않는 타입: ${type}`)
    }),
  }

  return { messaging, calls, closedTabs, remainingCount: () => remaining.length }
}

/**
 * 실제 chrome.storage 와 같은 의미의 저장소.
 * 읽을 때 값을 가공하지 않는다 — 가공하면 "쓰기가 앞선 쓰기를 덮어쓰는" 결함을 가리게 된다.
 */
const createFakeStore = () => {
  const data = new Map()
  let writes = 0
  return {
    writes: () => writes,
    read: async (key, fallback) => ok(data.has(key) ? data.get(key) : fallback),
    write: async (key, value) => {
      writes += 1
      data.set(key, value)
      return ok(value)
    },
    snapshot: () => data,
  }
}

/**
 * 중단 요청은 service-worker 가 쓰는 것과 **같은 모듈**을 호출한다.
 * 테스트가 저장 방식을 따로 흉내내면, 구현이 바뀔 때 테스트만 통과하고 실제로는 깨질 수 있다.
 */
const requestStopVia = (store) => requestStop(store)

const buildOrchestrator = (overrides = {}) => {
  const store = overrides.store ?? createFakeStore()
  const fake = createFakeMessaging(overrides.messagingOptions ?? { items: [] })
  const sleeps = []
  const orchestrator = createOrchestrator({
    messaging: fake.messaging,
    store,
    random: createRandom(1),
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    now: () => 1000,
    log: silentLog,
    templateSets: undefined,
  })
  return { orchestrator, store, fake, sleeps }
}

const threeItems = [
  { key: 'name:사과', productName: '사과 3kg' },
  { key: 'name:텀블러', productName: '스테인리스 텀블러' },
  { key: 'name:양말', productName: '무지 양말 5팩' },
]

describe('createOrchestrator.run', () => {
  test('드라이런으로 목록의 모든 항목을 처리한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: true })
    const { orchestrator, fake } = buildOrchestrator({ messagingOptions: { items: threeItems } })

    const result = await orchestrator.run({ runId: 'run-1', settings })

    expect(result.ok).toBe(true)
    expect(result.value.counts).toEqual({ submitted: 0, dryRun: 3, skipped: 0, failed: 0 })
    expect(result.value.phase).toBe(RUN_PHASE.DONE)
    expect(fake.remainingCount()).toBe(0)
  })

  test('드라이런을 끄면 실제 등록으로 집계한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: false })
    const { orchestrator } = buildOrchestrator({ messagingOptions: { items: threeItems } })

    const result = await orchestrator.run({ runId: 'run-2', settings })

    expect(result.value.counts.submitted).toBe(3)
    expect(result.value.counts.dryRun).toBe(0)
  })

  test('최대 처리 건수에서 멈춘다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 2, dryRun: true })
    const { orchestrator, fake } = buildOrchestrator({ messagingOptions: { items: threeItems } })

    const result = await orchestrator.run({ runId: 'run-3', settings })

    expect(result.value.completed).toBe(2)
    expect(fake.remainingCount()).toBe(1)
  })

  test('건 사이에 설정된 지연을 넣는다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: true, delayMs: { betweenItems: [5000, 5000] } })
    const { orchestrator, sleeps } = buildOrchestrator({ messagingOptions: { items: [threeItems[0]] } })

    await orchestrator.run({ runId: 'run-4', settings })

    expect(sleeps).toContain(5000)
  })

  test('폼 입력 실패는 해당 항목만 실패로 남기고 계속 진행한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: true, stopOnConsecutiveFailures: 10 })
    const { orchestrator } = buildOrchestrator({
      messagingOptions: { items: threeItems, failOn: { [MSG.FILL_FORM]: '입력 필드를 찾지 못했습니다' } },
    })

    const result = await orchestrator.run({ runId: 'run-5', settings })

    expect(result.value.counts.failed).toBe(3)
    expect(result.value.recent[0].message).toContain('입력 필드를 찾지 못했습니다')
  })

  test('연속 실패 임계값에 도달하면 중단한다', async () => {
    // 등록 실패는 "SUBMIT_FORM 응답 실패"가 아니라 "등록 완료 신호 없음"으로 판정한다.
    // 창이 전환되면 응답이 끊기는 것이 정상이기 때문이다.
    const settings = mergeSettings({ maxItemsPerRun: 10, dryRun: false, stopOnConsecutiveFailures: 2 })
    const { orchestrator } = buildOrchestrator({
      messagingOptions: { items: threeItems, registrationFailure: '리뷰 폼 창이 등록 완료 신호 없이 닫혔습니다.' },
    })

    const result = await orchestrator.run({ runId: 'run-6', settings })

    expect(result.value.counts.failed).toBe(2)
    expect(result.value.phase).toBe(RUN_PHASE.DONE)
  })

  test('등록 응답이 끊겨도 완료 신호를 받으면 성공으로 본다', async () => {
    // 등록 버튼을 누르면 폼 창이 리다이렉트되어 메시지 응답이 끊긴다. 정상 흐름이다.
    const settings = mergeSettings({ maxItemsPerRun: 1, dryRun: false })
    const { orchestrator } = buildOrchestrator({
      messagingOptions: { items: [threeItems[0]], failOn: { [MSG.SUBMIT_FORM]: 'message port closed' } },
    })

    const result = await orchestrator.run({ runId: 'run-6b', settings })

    expect(result.value.counts.submitted).toBe(1)
    expect(result.value.counts.failed).toBe(0)
  })

  test('처리 후 폼 창을 닫는다', async () => {
    // 닫지 않으면 다음 항목에서 이 창을 새 폼으로 오인한다.
    const settings = mergeSettings({ maxItemsPerRun: 2, dryRun: true })
    const { orchestrator, fake } = buildOrchestrator({ messagingOptions: { items: threeItems } })

    await orchestrator.run({ runId: 'run-6c', settings })

    expect(fake.closedTabs.length).toBe(2)
  })

  test('폼 창이 열리지 않으면 실패로 기록한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 1, dryRun: true, stopOnConsecutiveFailures: 1 })
    const { orchestrator } = buildOrchestrator({
      messagingOptions: { items: threeItems, formTabFailure: '리뷰 폼 창 대기 시간을 초과했습니다.' },
    })

    const result = await orchestrator.run({ runId: 'run-6d', settings })

    expect(result.value.counts.failed).toBe(1)
    expect(result.value.recent[0].message).toContain('리뷰 폼 창을 열지 못했습니다')
  })

  test('폼 열기 응답이 없어도(페이지 이동) 계속 진행한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: true })
    const { orchestrator } = buildOrchestrator({
      messagingOptions: { items: [threeItems[0]], failOn: { [MSG.OPEN_ITEM]: 'message port closed' } },
    })

    const result = await orchestrator.run({ runId: 'run-7', settings })

    expect(result.value.counts.dryRun).toBe(1)
  })

  test('목록이 비면 정상 종료한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: true })
    const { orchestrator } = buildOrchestrator({ messagingOptions: { items: [] } })

    const result = await orchestrator.run({ runId: 'run-8', settings })

    expect(result.ok).toBe(true)
    expect(result.value.completed).toBe(0)
    expect(result.value.phase).toBe(RUN_PHASE.DONE)
  })

  test('리뷰 목록 탭을 못 열면 실패를 반환한다', async () => {
    const settings = mergeSettings({})
    const { orchestrator, store } = buildOrchestrator({
      messagingOptions: { items: threeItems, tabFailure: '탭 생성 거부' },
    })

    const result = await orchestrator.run({ runId: 'run-9', settings })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('탭 생성 거부')
    expect(store.snapshot().get(STORAGE_KEY.RUN_STATE).phase).toBe(RUN_PHASE.FAILED)
  })

  test('목록으로 돌아가지 못하면 실패 상태로 끝낸다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: true })
    const { orchestrator, store } = buildOrchestrator({
      messagingOptions: { items: threeItems, navigateFailure: '네트워크 오류' },
    })

    await orchestrator.run({ runId: 'run-10', settings })

    expect(store.snapshot().get(STORAGE_KEY.RUN_STATE).phase).toBe(RUN_PHASE.FAILED)
  })

  test('항목 사이에 들어온 중단 요청을 반영한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 10, dryRun: true })
    const store = createFakeStore()
    const { orchestrator } = buildOrchestrator({ store, messagingOptions: { items: threeItems } })

    // 첫 항목이 끝난 직후 중단을 요청한다.
    const original = store.write
    let itemsSeen = 0
    store.write = async (key, value) => {
      const written = await original(key, value)
      if (key === STORAGE_KEY.RUN_STATE && value?.results?.length === 1 && itemsSeen === 0) {
        itemsSeen += 1
        await requestStopVia(store)
      }
      return written
    }

    const result = await orchestrator.run({ runId: 'run-11', settings })

    expect(result.value.completed).toBe(1)
    expect(result.value.phase).toBe(RUN_PHASE.DONE)
  })

  test('항목 처리 도중 들어온 중단 요청을 잃지 않는다', async () => {
    // 사용자는 대부분 항목 처리 중(가장 긴 구간)에 중단을 누른다.
    // 오케스트레이터가 항목 종료 후 자신의 상태를 통째로 저장하면 이 플래그가 지워질 수 있다.
    const settings = mergeSettings({ maxItemsPerRun: 10, dryRun: true })
    const store = createFakeStore()
    let alreadyRequested = false
    const { orchestrator } = buildOrchestrator({
      store,
      messagingOptions: {
        items: threeItems,
        onSubmit: async () => {
          if (alreadyRequested) return
          alreadyRequested = true
          await requestStopVia(store)
        },
      },
    })

    const result = await orchestrator.run({ runId: 'run-12', settings })

    expect(result.value.completed).toBe(1)
    expect(result.value.phase).toBe(RUN_PHASE.DONE)
  })

  test('이전 실행에서 남은 중단 신호가 새 실행을 멈추지 않는다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 10, dryRun: true })
    const store = createFakeStore()
    await requestStop(store) // 직전 실행에서 눌린 중단이 남아 있는 상태
    const { orchestrator } = buildOrchestrator({ store, messagingOptions: { items: threeItems } })

    const result = await orchestrator.run({ runId: 'run-15', settings })

    expect(result.value.completed).toBe(3)
  })

  test('진행 상황을 매 항목마다 저장한다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 5, dryRun: true })
    const store = createFakeStore()
    const { orchestrator } = buildOrchestrator({ store, messagingOptions: { items: threeItems } })

    await orchestrator.run({ runId: 'run-13', settings })

    // 시작 1회 + 항목 3회 + 종료 1회
    expect(store.writes()).toBeGreaterThanOrEqual(5)
  })

  test('폼 입력 대기 시간을 본문 길이와 타이핑 속도에 맞춰 정한다', async () => {
    // 고정 타임아웃이면 느린 타이핑 설정에서 background 가 먼저 끊고
    // 아직 입력 중인 항목을 실패로 기록한 뒤 탭을 이동시켜 작업을 버린다.
    const settings = mergeSettings({
      maxItemsPerRun: 1,
      dryRun: true,
      humanTyping: true,
      delayMs: { typingChar: [400, 500] },
    })
    const { orchestrator, fake } = buildOrchestrator({ messagingOptions: { items: [threeItems[0]] } })

    await orchestrator.run({ runId: 'run-16', settings })

    const fillCall = fake.messaging.sendToTab.mock.calls.find((call) => call[1] === MSG.FILL_FORM)
    const textLength = fillCall[2].text.length
    expect(fillCall[3]?.timeout).toBe(fillFormTimeoutMs({ textLength, settings }))
    expect(fillCall[3].timeout).toBeGreaterThan(LIMITS.DEFAULT_TIMEOUT_MS + LIMITS.TAB_LOAD_TIMEOUT_MS)
  })

  test('생성한 본문을 결과에 남긴다', async () => {
    const settings = mergeSettings({ maxItemsPerRun: 1, dryRun: true })
    const { orchestrator } = buildOrchestrator({ messagingOptions: { items: [threeItems[0]] } })

    const result = await orchestrator.run({ runId: 'run-14', settings })

    expect(result.value.recent[0].status).toBe(ITEM_STATUS.DRY_RUN)
    expect(result.value.recent[0].textPreview.length).toBeGreaterThan(10)
  })
})
