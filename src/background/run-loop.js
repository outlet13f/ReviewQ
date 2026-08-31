/**
 * 실행 루프 본체.
 * 목록 훑기 -> 다음 항목 고르기 -> 처리 -> 목록 복귀 -> 지연을 반복한다.
 *
 * 생명주기(탭 확보, 시작/종료 상태 확정)는 orchestrator.js 가 맡고
 * 여기서는 반복 자체만 다룬다.
 */

import { LIMITS, MSG, RUN_PHASE, STORAGE_KEY } from '../shared/constants.js'
import { err, ok } from '../shared/result.js'
import { delayFromRange } from '../generator/random.js'
import { waitFor } from '../shared/async.js'
import { isStopRequested } from './stop-signal.js'
import {
  nextPendingItem,
  shouldStop,
  withError,
  withFinished,
  withItemResult,
  withPhase,
  withStopRequested,
} from './run-state.js'

/** 탭이 아직 리뷰 목록에 있는지. 경로만 비교한다(쿼리는 페이지네이션 등으로 달라질 수 있다). */
const isReviewListUrl = (tabUrl, reviewListUrl) => {
  try {
    return new URL(tabUrl).pathname === new URL(reviewListUrl).pathname
  } catch {
    return false
  }
}

/** 실행 상태를 저장한다. 저장 실패가 실행을 멈추지는 않지만 조용히 넘기지도 않는다. */
export const persistRunState = async (store, log, state) => {
  const written = await store.write(STORAGE_KEY.RUN_STATE, state)
  if (!written.ok) log.warn('실행 상태 저장 실패', written.error)
  return state
}

/** 중단 신호는 별도 키에 있어 실행 상태 저장에 덮어써지지 않는다. */
const applyExternalStop = async ({ store }, state) => {
  if (state.stopRequested) return state
  return (await isStopRequested(store)) ? withStopRequested(state) : state
}

/**
 * 더보기로 항목이 실제로 늘어날 때까지 기다렸다가 다시 훑는다.
 * 더보기는 XHR 로 항목을 가져오므로 클릭 직후 재스캔하면 같은 DOM 을 보고 항상 실패한다.
 */
const retryScanAfterLoadMore = async ({ messaging }, tabId, previousError) => {
  const appeared = await waitFor(
    async () => {
      const retried = await messaging.sendToTab(tabId, MSG.SCAN_LIST)
      return retried.ok ? (retried.value.items ?? []) : null
    },
    { timeout: LIMITS.CONTENT_READY_TIMEOUT_MS, label: '더보기 항목 로딩' },
  )
  return appeared.ok ? ok(appeared.value) : err(previousError)
}

const scanItems = async (deps, tabId) => {
  const scanned = await deps.messaging.sendToTab(tabId, MSG.SCAN_LIST)
  if (scanned.ok) return ok(scanned.value.items ?? [])

  // 목록이 비었으면 "더보기" 를 눌러 한 번 더 시도한다.
  const loaded = await deps.messaging.sendToTab(tabId, MSG.LOAD_MORE)
  if (!loaded.ok || loaded.value?.loaded !== true) return err(scanned.error)

  return retryScanAfterLoadMore(deps, tabId, scanned.error)
}

/** 이번 반복에서 처리할 항목을 고른다. 없으면 종료 사유를 남긴다. */
const pickNext = async (deps, tabId, state) => {
  const items = await scanItems(deps, tabId)
  if (!items.ok) return { item: null, endReason: `목록 훑기 종료: ${items.error}` }

  const item = nextPendingItem(state, items.value)
  return item ? { item, endReason: null } : { item: null, endReason: '처리할 항목이 더 없습니다.' }
}

/** 항목 하나를 처리하고 결과를 상태에 반영한다. */
const runOne = async ({ processItem, store, log, now }, tabId, state, item) => {
  const outcome = await processItem({ tabId, state, item })
  const next = withItemResult(state, {
    ...outcome,
    key: item.key,
    productName: item.productName,
    at: now(),
  })
  await persistRunState(store, log, next)
  log.info(`[${outcome.status}] ${item.productName || item.key} - ${outcome.message}`)
  return next
}

/**
 * 목록 탭을 리뷰 목록 상태로 되돌린다.
 *
 * 리뷰 폼은 별도 창으로 열리므로 목록 탭이 그대로인 경우가 많다. 그때는 새로고침하지 않는다 —
 * 매번 새로고침하면 더보기로 펼친 항목이 다시 접히고, 항목마다 페이지 로드 비용이 든다.
 */
const returnToList = async ({ messaging }, tabId, state) => {
  const tab = await messaging.getTab(tabId)
  if (tab.ok && isReviewListUrl(tab.value.url, state.settings.reviewListUrl)) {
    return ok('목록 유지')
  }
  return messaging.navigateTab(tabId, state.settings.reviewListUrl)
}

/**
 * @param {{messaging: object, store: object, random: object, sleep: Function, now: Function, log: object, processItem: Function}} deps
 * @returns {(tabId: number, initialState: object, onState?: Function) => Promise<object>}
 */
export const createRunLoop = (deps) => async (tabId, initialState, onState) => {
  let state = initialState

  for (;;) {
    // 예외로 루프를 벗어나도 호출 측이 최신 상태를 알 수 있게 매번 알린다.
    onState?.(state)
    state = await applyExternalStop(deps, state)

    const stop = shouldStop(state)
    if (stop) {
      deps.log.info(`실행 종료: ${stop.message}`)
      return withFinished(state, deps.now())
    }

    const { item, endReason } = await pickNext(deps, tabId, state)
    if (!item) {
      deps.log.info(endReason)
      return withFinished(state, deps.now())
    }

    state = await runOne(deps, tabId, withPhase(state, RUN_PHASE.WRITING), item)

    const back = await returnToList(deps, tabId, state)
    if (!back.ok) return withError(state, `목록으로 돌아가지 못했습니다: ${back.error}`)

    await deps.sleep(delayFromRange(state.settings.delayMs.betweenItems, deps.random))
  }
}
