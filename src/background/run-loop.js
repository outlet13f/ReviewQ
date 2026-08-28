/**
 * 실행 루프 본체.
 * 목록 훑기 -> 다음 항목 고르기 -> 처리 -> 목록 복귀 -> 지연을 반복한다.
 *
 * 생명주기(탭 확보, 시작/종료 상태 확정)는 orchestrator.js 가 맡고
 * 여기서는 반복 자체만 다룬다.
 */

import { MSG, RUN_PHASE, STORAGE_KEY } from '../shared/constants.js'
import { err, ok } from '../shared/result.js'
import { delayFromRange } from '../generator/random.js'
import { isStopRequested } from './stop-signal.js'
import { nextPendingItem, shouldStop, withError, withFinished, withItemResult, withPhase, withStopRequested } from './run-state.js'

/** 실행 상태를 저장한다. 저장 실패가 실행을 멈추지는 않지만 조용히 넘기지도 않는다. */
export const persistRunState = async (store, log, state) => {
  const written = await store.write(STORAGE_KEY.RUN_STATE, state)
  if (!written.ok) log.warn('실행 상태 저장 실패', written.error)
  return state
}

/**
 * @param {{messaging: object, store: object, random: object, sleep: Function, now: Function, log: object, processItem: Function}} deps
 * @returns {(tabId: number, initialState: object) => Promise<object>}
 */
export const createRunLoop = ({ messaging, store, random, sleep, now, log, processItem }) => {
  /** 중단 신호는 별도 키에 있어 실행 상태 저장에 덮어써지지 않는다. */
  const applyExternalStop = async (state) => {
    if (state.stopRequested) return state
    return (await isStopRequested(store)) ? withStopRequested(state) : state
  }

  const scanItems = async (tabId) => {
    const scanned = await messaging.sendToTab(tabId, MSG.SCAN_LIST)
    if (scanned.ok) return ok(scanned.value.items ?? [])

    // 목록이 비었으면 "더보기" 를 눌러 한 번 더 시도한다.
    const loaded = await messaging.sendToTab(tabId, MSG.LOAD_MORE)
    if (!loaded.ok || loaded.value?.loaded !== true) return err(scanned.error)

    const retried = await messaging.sendToTab(tabId, MSG.SCAN_LIST)
    return retried.ok ? ok(retried.value.items ?? []) : err(retried.error)
  }

  /** 이번 반복에서 처리할 항목을 고른다. 없으면 종료 사유를 남긴다. */
  const pickNext = async (tabId, state) => {
    const items = await scanItems(tabId)
    if (!items.ok) return { item: null, endReason: `목록 훑기 종료: ${items.error}` }

    const item = nextPendingItem(state, items.value)
    return item ? { item, endReason: null } : { item: null, endReason: '처리할 항목이 더 없습니다.' }
  }

  return async (tabId, initialState) => {
    let state = initialState

    for (;;) {
      state = await applyExternalStop(state)
      const stop = shouldStop(state)
      if (stop) {
        log.info(`실행 종료: ${stop.message}`)
        return withFinished(state, now())
      }

      const { item, endReason } = await pickNext(tabId, state)
      if (!item) {
        log.info(endReason)
        return withFinished(state, now())
      }

      state = withPhase(state, RUN_PHASE.WRITING)
      const outcome = await processItem({ tabId, state, item })
      state = withItemResult(state, { ...outcome, key: item.key, productName: item.productName, at: now() })
      await persistRunState(store, log, state)
      log.info(`[${outcome.status}] ${item.productName || item.key} - ${outcome.message}`)

      // 폼 페이지에 남아 있을 수 있으므로 항상 목록으로 되돌린다.
      const back = await messaging.navigateTab(tabId, state.settings.reviewListUrl)
      if (!back.ok) return withError(state, `목록으로 돌아가지 못했습니다: ${back.error}`)

      await sleep(delayFromRange(state.settings.delayMs.betweenItems, random))
    }
  }
}
