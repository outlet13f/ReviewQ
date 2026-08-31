/**
 * 실행 상태. 순수 함수만 모여 있고 모든 전이는 새 객체를 반환한다.
 * MV3 서비스 워커는 언제든 종료될 수 있으므로 이 객체를 그대로 storage.session 에 저장한다.
 */

import { ITEM_STATUS, LIMITS, RUN_PHASE } from '../shared/constants.js'
import { prependCapped } from '../shared/storage.js'

const RECENT_TEXTS_CAP = 60
const RESULTS_CAP = LIMITS.MAX_ITEMS_PER_RUN

const emptyCounts = () => Object.freeze({ submitted: 0, dryRun: 0, skipped: 0, failed: 0 })

export const createRunState = ({ runId, settings, startedAt, recentTexts = [] }) =>
  Object.freeze({
    runId,
    settings,
    phase: RUN_PHASE.SCANNING,
    startedAt,
    finishedAt: null,
    stopRequested: false,
    consecutiveFailures: 0,
    counts: emptyCounts(),
    /**
     * 키별로 "시도했지만 항목이 목록에 그대로 남은" 횟수.
     * 등록에 성공한 항목만 네이버 목록에서 사라진다. 드라이런과 실패는 남는다.
     */
    retainedCounts: Object.freeze({}),
    results: Object.freeze([]),
    recentTexts: Object.freeze(recentTexts.slice(0, RECENT_TEXTS_CAP)),
    error: null,
  })

export const withPhase = (state, phase) => Object.freeze({ ...state, phase })

export const withStopRequested = (state) =>
  Object.freeze({ ...state, stopRequested: true, phase: RUN_PHASE.STOPPING })

export const withError = (state, error) =>
  Object.freeze({ ...state, phase: RUN_PHASE.FAILED, error, finishedAt: Date.now() })

export const withFinished = (state, finishedAt) =>
  Object.freeze({ ...state, phase: RUN_PHASE.DONE, finishedAt })

const bumpCount = (counts, status) => {
  const key = {
    [ITEM_STATUS.SUBMITTED]: 'submitted',
    [ITEM_STATUS.DRY_RUN]: 'dryRun',
    [ITEM_STATUS.SKIPPED]: 'skipped',
    [ITEM_STATUS.FAILED]: 'failed',
  }[status]
  if (!key) return counts
  return Object.freeze({ ...counts, [key]: counts[key] + 1 })
}

/**
 * 한 항목 처리 결과를 반영한다.
 * @param {object} state
 * @param {{key: string, productName?: string, status: string, message?: string, text?: string}} result
 */
export const withItemResult = (state, result) => {
  const isFailure = result.status === ITEM_STATUS.FAILED
  const isRetained = result.status !== ITEM_STATUS.SUBMITTED
  const entry = Object.freeze({
    key: result.key,
    productName: result.productName ?? '',
    status: result.status,
    message: result.message ?? '',
    textPreview: typeof result.text === 'string' ? result.text.slice(0, 80) : '',
    /** 폼 URL 의 productOrderNos. 목록 DOM 에는 없는 주문 단위 식별자다. */
    formKey: result.formKey ?? null,
    at: result.at ?? Date.now(),
  })

  const nextRecent =
    typeof result.text === 'string' && result.text !== ''
      ? prependCapped(state.recentTexts, result.text, RECENT_TEXTS_CAP)
      : state.recentTexts

  return Object.freeze({
    ...state,
    counts: bumpCount(state.counts, result.status),
    consecutiveFailures: isFailure ? state.consecutiveFailures + 1 : 0,
    // 등록 성공만 목록에서 사라진다. 그 외(드라이런·실패·건너뜀)는 항목이 남으므로
    // 다음 스캔에서 같은 항목을 다시 집지 않도록 센다.
    retainedCounts: isRetained
      ? Object.freeze({ ...state.retainedCounts, [result.key]: (state.retainedCounts[result.key] ?? 0) + 1 })
      : state.retainedCounts,
    results: prependCapped(state.results, entry, RESULTS_CAP),
    recentTexts: nextRecent,
  })
}

/** 처리 완료 건수(실패 제외). 최대 건수 제한 기준. */
export const completedCount = (state) => state.counts.submitted + state.counts.dryRun

/**
 * 실행을 멈춰야 하는지 판단한다.
 * @returns {{reason: string, message: string} | null}
 */
export const shouldStop = (state) => {
  if (state.stopRequested) {
    return { reason: 'user', message: '사용자가 중단했습니다.' }
  }
  const limit = state.settings?.maxItemsPerRun ?? 0
  if (completedCount(state) >= limit) {
    return { reason: 'limit', message: `1회 최대 처리 건수(${limit}건)에 도달했습니다.` }
  }
  const failureLimit = state.settings?.stopOnConsecutiveFailures ?? Number.POSITIVE_INFINITY
  if (state.consecutiveFailures >= failureLimit) {
    return {
      reason: 'failures',
      message: `연속 ${state.consecutiveFailures}건 실패로 중단했습니다. 페이지 구조가 바뀌었을 수 있습니다.`,
    }
  }
  return null
}

/**
 * 다음에 처리할 항목을 고른다.
 *
 * 등록에 **성공한** 항목만 네이버 목록에서 사라진다. 드라이런과 실패는 목록에 남는다.
 * 같은 상품을 여러 번 구매하면 항목들의 키가 같으므로(DOM 에 항목 고유 ID 없음),
 * 키가 같은 것 중 **목록에 남은 채로 시도된 횟수만큼** 앞에서 건너뛴다.
 *
 * 이렇게 해야
 *  - 드라이런이 1번 항목만 반복하지 않고 목록 전체를 미리볼 수 있고
 *  - 같은 상품 3개 중 1개가 실패해도 나머지 2개를 계속 처리할 수 있다.
 *
 * 알려진 한계: 등록에 성공했는데도 목록이 갱신되지 않으면(서버 반영 지연) 같은 건을
 * 다시 시도할 수 있다. 다만 네이버가 중복 리뷰를 거부하므로 그 시도는 실패로 기록되고,
 * 남은 횟수가 늘어 다음부터는 건너뛴다. 즉 스스로 교정된다.
 * 그래도 maxItemsPerRun 을 낮게 유지하는 편이 안전하다.
 */
export const nextPendingItem = (state, items) => {
  if (!Array.isArray(items)) return null

  const seen = new Map()
  for (const item of items) {
    const occurrence = seen.get(item.key) ?? 0
    seen.set(item.key, occurrence + 1)
    if (occurrence >= (state.retainedCounts[item.key] ?? 0)) return item
  }
  return null
}

/** 팝업에 보여줄 요약. */
export const summarize = (state) =>
  Object.freeze({
    runId: state.runId,
    phase: state.phase,
    counts: state.counts,
    completed: completedCount(state),
    limit: state.settings?.maxItemsPerRun ?? 0,
    dryRun: state.settings?.dryRun !== false,
    consecutiveFailures: state.consecutiveFailures,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    error: state.error,
    recent: Object.freeze(state.results.slice(0, 10)),
  })
