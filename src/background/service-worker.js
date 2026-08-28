/** 서비스 워커 진입점. 팝업 명령을 받아 실행 루프를 돌린다. */

import { MSG, RUN_PHASE, STORAGE_KEY } from '../shared/constants.js'
import { createLogger } from '../shared/logger.js'
import { attempt, err, ok } from '../shared/result.js'
import { localStore, sessionStore } from '../shared/storage.js'
import { DEFAULT_SETTINGS, mergeSettings } from '../shared/settings.js'
import { isNaverUrl } from '../shared/naver-url.js'
import { createSystemRandom } from '../generator/random.js'
import { BUILT_IN_TEMPLATE_SETS } from '../generator/templates/index.js'
import { createOrchestrator } from './orchestrator.js'
import { keepAliveSleep } from './keep-alive.js'
import { summarize } from './run-state.js'
import { clearStopRequest, requestStop } from './stop-signal.js'
import { STOP_ACTION, canStartRun, resolveStopAction } from './run-guard.js'
import * as messaging from './messaging.js'

const log = createLogger('background')

/** 같은 워커 인스턴스 안에서의 중복 실행을 막는다. */
let activeRunId = null

const loadSettings = async () => {
  const stored = await localStore().read(STORAGE_KEY.SETTINGS, DEFAULT_SETTINGS)
  if (!stored.ok) return stored
  return ok(mergeSettings(stored.value))
}

const readRunState = async () => sessionStore().read(STORAGE_KEY.RUN_STATE, null)

const handleStart = async () => {
  const persisted = await readRunState()
  if (!persisted.ok) return persisted

  const guard = canStartRun({
    persistedState: persisted.value,
    workerRunId: activeRunId,
    now: Date.now(),
  })
  if (!guard.allowed) return err(guard.reason)
  if (guard.reason !== '') log.info(guard.reason)

  const settings = await loadSettings()
  if (!settings.ok) return settings

  const runId = `run-${Date.now()}`
  activeRunId = runId
  log.info('실행 시작', { runId, dryRun: settings.value.dryRun, limit: settings.value.maxItemsPerRun })

  const orchestrator = createOrchestrator({
    messaging,
    store: sessionStore(),
    random: createSystemRandom(),
    sleep: keepAliveSleep,
    now: () => Date.now(),
    log,
    templateSets: BUILT_IN_TEMPLATE_SETS,
  })

  try {
    return await orchestrator.run({ runId, settings: settings.value })
  } finally {
    activeRunId = null
  }
}

const handleStop = async () => {
  const store = sessionStore()
  const persisted = await store.read(STORAGE_KEY.RUN_STATE, null)
  if (!persisted.ok) return persisted

  const decision = resolveStopAction({ persistedState: persisted.value, workerRunId: activeRunId })
  log.info(`중단 요청: ${decision.action}`)

  if (decision.action === STOP_ACTION.NONE) {
    return ok({ stopped: false, message: decision.message })
  }

  if (decision.action === STOP_ACTION.FINALIZE) {
    // 받아 줄 루프가 없다. 직접 끝냄으로 확정하지 않으면 시작도 중단도 영영 막힌다.
    const finalized = await store.patch(STORAGE_KEY.RUN_STATE, {
      phase: RUN_PHASE.DONE,
      finishedAt: Date.now(),
    })
    if (!finalized.ok) return finalized
    await clearStopRequest(store)
    return ok({ stopped: true, message: decision.message })
  }

  const signalled = await requestStop(store)
  if (!signalled.ok) return signalled
  // 팝업 피드백용 표시. 실제 중단 판단은 별도 신호가 담당한다.
  await store.patch(STORAGE_KEY.RUN_STATE, { phase: RUN_PHASE.STOPPING })
  return ok({ stopped: true, message: decision.message })
}

const handleStatus = async () => {
  const persisted = await readRunState()
  if (!persisted.ok) return persisted
  if (!persisted.value) return ok(null)
  return ok(summarize(persisted.value))
}

/** 현재 활성 탭의 DOM 구조를 덤프한다. 셀렉터가 안 맞을 때 쓴다. */
const handleProbe = async () => {
  const tabs = await attempt(() => chrome.tabs.query({ active: true, currentWindow: true }), '활성 탭 조회')
  if (!tabs.ok) return tabs

  const [tab] = tabs.value
  if (!tab?.id) return err('활성 탭을 찾을 수 없습니다.')
  if (!isNaverUrl(tab.url)) return err('네이버 페이지에서 실행해 주세요.')

  const ready = await messaging.ensureContentScript(tab.id)
  if (!ready.ok) return ready
  return messaging.sendToTab(tab.id, MSG.PROBE_DUMP, null, { timeout: 10000 })
}

const HANDLERS = Object.freeze({
  [MSG.RUN_START]: handleStart,
  [MSG.RUN_STOP]: handleStop,
  [MSG.RUN_STATUS]: handleStatus,
  [MSG.PROBE_PAGE]: handleProbe,
})

const toWire = (result) =>
  result?.ok ? { ok: true, value: result.value } : { ok: false, error: result?.error ?? '알 수 없는 오류' }

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = HANDLERS[message?.type]
  if (!handler) return false

  handler(message.payload)
    .then((result) => sendResponse(toWire(result)))
    .catch((cause) => {
      log.error(`${message.type} 처리 중 예외`, cause)
      sendResponse(toWire(err(cause instanceof Error ? cause.message : String(cause))))
    })
  return true
})

chrome.runtime.onInstalled.addListener(async () => {
  const store = localStore()
  const existing = await store.read(STORAGE_KEY.SETTINGS, null)
  if (existing.ok && existing.value === null) {
    await store.write(STORAGE_KEY.SETTINGS, DEFAULT_SETTINGS)
    log.info('기본 설정을 저장했습니다.')
  }
  // 새 설치/업데이트 시 이전 실행 상태를 남겨 두지 않는다.
  await sessionStore().remove(STORAGE_KEY.RUN_STATE)
})

log.info('서비스 워커 준비 완료')
