/**
 * 실행 시작/중단 가능 여부 판단.
 *
 * MV3 서비스 워커는 실행 도중 종료될 수 있다. 그러면 실행 루프가 사라지는데
 * 저장된 상태는 WRITING 에 고정된다. 상태를 DONE 으로 바꿔 주는 주체가 루프뿐이므로,
 * "활성 상태면 시작 거부" 규칙만 두면 시작도 중단도 영영 막힌다.
 *
 * 여기서는 (1) 이 워커에 실제 루프가 있는지, (2) 상태가 오래 방치됐는지를 함께 보고
 * 유령 상태를 걸러낸다. chrome API 에 의존하지 않는 순수 함수라 단독 테스트가 가능하다.
 */

import { LIMITS, RUN_PHASE } from '../shared/constants.js'

const ACTIVE_PHASES = new Set([RUN_PHASE.SCANNING, RUN_PHASE.WRITING, RUN_PHASE.STOPPING])

export const STOP_ACTION = Object.freeze({
  /** 정리할 것이 없다. */
  NONE: 'NONE',
  /** 살아 있는 루프에 중단을 알린다. */
  SIGNAL: 'SIGNAL',
  /** 받아 줄 루프가 없다. 상태를 직접 끝냄으로 확정한다. */
  FINALIZE: 'FINALIZE',
})

const isActive = (state) => ACTIVE_PHASES.has(state?.phase)

const hasLoop = (workerRunId) => workerRunId !== null && workerRunId !== undefined

/** 마지막으로 진행이 있었던 시각. 알 수 없으면 null. */
const lastActivityAt = (state) => {
  const latestResult = Array.isArray(state?.results) && state.results.length > 0 ? state.results[0]?.at : null
  const candidates = [state?.startedAt, latestResult].filter((value) => Number.isFinite(value))
  return candidates.length > 0 ? Math.max(...candidates) : null
}

/** 워커가 죽어 방치된 상태인지. 활동 시각을 모르면 유령으로 단정하지 않는다. */
const isStale = (state, now, staleAfterMs) => {
  const last = lastActivityAt(state)
  if (last === null) return false
  return now - last > staleAfterMs
}

/**
 * @param {{persistedState: object|null, workerRunId: string|null, now: number, staleAfterMs?: number}} input
 * @returns {{allowed: boolean, reason: string}}
 */
export const canStartRun = ({ persistedState, workerRunId, now, staleAfterMs = LIMITS.STALE_RUN_MS }) => {
  if (hasLoop(workerRunId)) {
    return Object.freeze({ allowed: false, reason: '이미 실행 중입니다. 먼저 중단해 주세요.' })
  }
  if (!persistedState || !isActive(persistedState)) {
    return Object.freeze({ allowed: true, reason: '' })
  }
  if (isStale(persistedState, now, staleAfterMs)) {
    return Object.freeze({ allowed: true, reason: '이전에 중단된 실행 기록을 정리하고 새로 시작합니다.' })
  }
  return Object.freeze({ allowed: false, reason: '이미 실행 중입니다. 먼저 중단해 주세요.' })
}

/**
 * @param {{persistedState: object|null, workerRunId: string|null}} input
 * @returns {{action: string, message: string}}
 */
export const resolveStopAction = ({ persistedState, workerRunId }) => {
  if (!persistedState || !isActive(persistedState)) {
    return Object.freeze({ action: STOP_ACTION.NONE, message: '실행 중인 작업이 없습니다.' })
  }
  if (hasLoop(workerRunId)) {
    return Object.freeze({ action: STOP_ACTION.SIGNAL, message: '현재 항목을 마치고 중단합니다.' })
  }
  // 루프가 없으므로 신호를 보내도 아무도 읽지 않는다. 직접 끝내야 교착이 풀린다.
  return Object.freeze({ action: STOP_ACTION.FINALIZE, message: '멈춰 있던 실행 기록을 정리했습니다.' })
}
