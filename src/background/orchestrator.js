/**
 * 실행 생명주기.
 * 탭을 확보하고, 루프를 돌리고, 시작/종료 상태를 확정한다.
 * 반복 자체는 run-loop.js, 항목 처리는 process-item.js 가 맡는다.
 *
 * 의존성을 주입받으므로 chrome API 없이도 테스트할 수 있다.
 */

import { RUN_PHASE } from '../shared/constants.js'
import { err, ok } from '../shared/result.js'
import { clearStopRequest } from './stop-signal.js'
import { createItemProcessor } from './process-item.js'
import { createRunLoop, persistRunState } from './run-loop.js'
import { createRunState, summarize, withError, withPhase } from './run-state.js'

/**
 * @param {object} deps
 * @param {object} deps.messaging openReviewListTab / ensureReady / sendToTab / navigateTab
 * @param {object} deps.store read / write
 * @param {object} deps.random createRandom() 인스턴스
 * @param {(ms:number)=>Promise<void>} deps.sleep
 * @param {()=>number} deps.now
 * @param {object} deps.log
 * @param {object[]} [deps.templateSets]
 */
export const createOrchestrator = (deps) => {
  const { messaging, store, random, sleep, now, log, templateSets } = deps
  const processItem = createItemProcessor({ messaging, random, sleep, log, templateSets })
  const runLoop = createRunLoop({ messaging, store, random, sleep, now, log, processItem })

  const failRun = async (state, message) => {
    const failed = withError(state, message)
    await persistRunState(store, log, failed)
    return err(failed.error)
  }

  /**
   * 실행을 시작한다.
   * @returns {Promise<{ok:true,value:object}|{ok:false,error:string}>}
   */
  const run = async ({ runId, settings }) => {
    // 이전 실행의 중단 신호가 남아 있으면 새 실행이 즉시 멈춘다.
    await clearStopRequest(store)

    const initial = createRunState({ runId, settings, startedAt: now() })
    await persistRunState(store, log, initial)

    const tab = await messaging.openReviewListTab(settings.reviewListUrl)
    if (!tab.ok) return failRun(initial, `리뷰 목록 페이지를 열지 못했습니다: ${tab.error}`)

    try {
      const finished = await runLoop(tab.value, withPhase(initial, RUN_PHASE.SCANNING))
      await persistRunState(store, log, finished)
      return ok(summarize(finished))
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      log.error('실행 중 예외', cause)
      return failRun(initial, `실행 중 예외가 발생했습니다: ${reason}`)
    }
  }

  return Object.freeze({ run })
}
