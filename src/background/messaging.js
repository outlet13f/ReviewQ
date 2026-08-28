/** 탭 제어와 콘텐츠 스크립트 통신. chrome API 호출을 이 파일에 모아 둔다. */

import { LIMITS, MSG } from '../shared/constants.js'
import { attempt, err, ok } from '../shared/result.js'
import { waitFor, withTimeout } from '../shared/async.js'
import { createLogger } from '../shared/logger.js'
import { TAB_ACTION, pickReviewListTab } from './tab-picker.js'
import { pickFormTab } from './form-tab.js'
import { isReviewRegisteredUrl } from '../shared/review-form-url.js'

const log = createLogger('messaging')
const CONTENT_LOADER = 'src/content/loader.js'

export const getTab = async (tabId) => attempt(() => chrome.tabs.get(tabId), '탭 조회')

/** 탭 로딩이 끝날 때까지 기다린다. */
export const waitForTabComplete = async (tabId, timeout = LIMITS.TAB_LOAD_TIMEOUT_MS) =>
  waitFor(
    async () => {
      const tab = await getTab(tabId)
      if (!tab.ok) return null
      return tab.value.status === 'complete' ? tab.value : null
    },
    { timeout, label: '탭 로딩' },
  )

/** 콘텐츠 스크립트에 메시지를 보낸다. 응답 형식은 {ok, value|error}. */
export const sendToTab = async (tabId, type, payload, options = {}) => {
  const { timeout = LIMITS.DEFAULT_TIMEOUT_MS + LIMITS.TAB_LOAD_TIMEOUT_MS } = options

  const send = attempt(() => chrome.tabs.sendMessage(tabId, { type, payload }), `메시지 전송(${type})`)
  const response = await withTimeout(send, timeout, `${type} 메시지`)
  if (!response.ok) return response

  const wire = response.value
  if (!wire || typeof wire.ok !== 'boolean') return err(`${type} 응답 형식이 올바르지 않습니다.`)
  return wire.ok ? ok(wire.value) : err(wire.error)
}

/**
 * 콘텐츠 스크립트가 살아 있는지 확인하고, 없으면 주입한다.
 * 페이지 이동 후에도 흐름을 이어가려면 반드시 필요하다.
 */
export const ensureContentScript = async (tabId) => {
  const pinged = await sendToTab(tabId, MSG.PING, null, { timeout: 1500 })
  if (pinged.ok) return pinged

  log.info('콘텐츠 스크립트 재주입', tabId)
  const injected = await attempt(
    () => chrome.scripting.executeScript({ target: { tabId, allFrames: false }, files: [CONTENT_LOADER] }),
    '콘텐츠 스크립트 주입',
  )
  if (!injected.ok) return injected

  return waitFor(
    async () => {
      const result = await sendToTab(tabId, MSG.PING, null, { timeout: 1500 })
      return result.ok ? result.value : null
    },
    { timeout: LIMITS.CONTENT_READY_TIMEOUT_MS, label: '콘텐츠 스크립트 준비' },
  )
}

/** 탭 로딩 완료 + 콘텐츠 스크립트 준비를 한 번에 보장한다. */
export const ensureReady = async (tabId) => {
  const loaded = await waitForTabComplete(tabId)
  if (!loaded.ok) return loaded
  return ensureContentScript(tabId)
}

export const navigateTab = async (tabId, url) => {
  const updated = await attempt(() => chrome.tabs.update(tabId, { url }), '탭 이동')
  if (!updated.ok) return updated
  return ensureReady(tabId)
}

/**
 * 리뷰 목록 탭을 확보한다.
 * 이미 리뷰 목록을 보고 있는 탭만 재사용한다 — 같은 오리진의 다른 페이지를 빼앗으면
 * 사용자가 결제·주문 중이던 작업을 날릴 수 있다.
 */
export const openReviewListTab = async (reviewListUrl) => {
  const parsed = await attempt(() => new URL(reviewListUrl), '리뷰 목록 URL 파싱')
  if (!parsed.ok) return err(`리뷰 목록 URL 이 올바르지 않습니다: ${reviewListUrl}`)

  const existing = await attempt(
    () => chrome.tabs.query({ url: `${parsed.value.origin}/*` }),
    '탭 검색',
  )
  if (!existing.ok) return existing

  const decision = pickReviewListTab({ tabs: existing.value, reviewListUrl })

  if (decision.action === TAB_ACTION.REUSE) {
    log.info('리뷰 목록 탭 재사용', decision.tabId)
    await attempt(() => chrome.tabs.update(decision.tabId, { active: true }), '탭 활성화')
    const navigated = await navigateTab(decision.tabId, reviewListUrl)
    if (!navigated.ok) return navigated
    return ok(decision.tabId)
  }

  log.info('리뷰 목록 탭 새로 열기')
  const created = await attempt(() => chrome.tabs.create({ url: reviewListUrl, active: true }), '탭 생성')
  if (!created.ok) return created

  const ready = await ensureReady(created.value.id)
  if (!ready.ok) return ready
  return ok(created.value.id)
}

/** 리뷰 폼 팝업 창이 열릴 때까지 기다린다. */
export const waitForFormTab = async (listTabId, timeout = LIMITS.CONTENT_READY_TIMEOUT_MS) => {
  const found = await waitFor(
    async () => {
      const tabs = await attempt(() => chrome.tabs.query({}), '탭 검색')
      if (!tabs.ok) return null
      return pickFormTab({ tabs: tabs.value, excludeTabId: listTabId })
    },
    { timeout, label: '리뷰 폼 창' },
  )
  return found
}

/**
 * 등록 완료를 감시한다.
 *
 * 폴링으로 URL 을 보면 리다이렉트 직후 창이 닫히는 경우를 놓친다.
 * 그래서 tabs.onUpdated 로 URL 변화를 직접 받는다.
 * **등록 버튼을 누르기 전에 start() 해 두어야** 변화를 놓치지 않는다.
 */
export const watchRegistration = (formTabId) => {
  let settled = null
  const waiters = []

  const settle = (result) => {
    if (settled) return
    settled = result
    chrome.tabs.onUpdated.removeListener(onUpdated)
    chrome.tabs.onRemoved.removeListener(onRemoved)
    for (const resolve of waiters.splice(0)) resolve(result)
  }

  function onUpdated(tabId, changeInfo) {
    if (tabId !== formTabId) return
    if (typeof changeInfo.url === 'string' && isReviewRegisteredUrl(changeInfo.url)) {
      settle(ok('registered-redirect'))
    }
  }

  function onRemoved(tabId) {
    if (tabId !== formTabId) return
    // 리다이렉트를 보지 못한 채 창이 닫혔다면 등록 여부를 단정할 수 없다.
    settle(err('리뷰 폼 창이 등록 완료 신호 없이 닫혔습니다.'))
  }

  chrome.tabs.onUpdated.addListener(onUpdated)
  chrome.tabs.onRemoved.addListener(onRemoved)

  return Object.freeze({
    /** @returns {Promise<{ok:true,value:string}|{ok:false,error:string}>} */
    wait: (timeout = LIMITS.DEFAULT_TIMEOUT_MS) =>
      settled
        ? Promise.resolve(settled)
        : withTimeout(
            new Promise((resolve) => waiters.push(resolve)),
            timeout,
            '등록 완료 신호',
          ),
    stop: () => settle(err('감시를 중단했습니다.')),
  })
}

/** 폼 팝업 창을 닫는다. 이미 닫혔어도 오류로 보지 않는다. */
export const closeTab = async (tabId) => {
  const removed = await attempt(() => chrome.tabs.remove(tabId), '탭 닫기')
  return removed.ok ? removed : ok('이미 닫힘')
}
