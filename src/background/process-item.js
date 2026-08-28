/**
 * 항목 하나를 처리하는 파이프라인.
 * 본문 생성 -> 폼 창 열기 -> 채우기 -> 등록 -> 완료 확인 -> 창 정리.
 *
 * 실측(2026-08-27): 목록의 "리뷰쓰기" 는 같은 탭을 이동시키지 않고 **새 창**을 연다.
 * 목록 탭과 폼 창을 나눠 다뤄야 한다. 목록 탭에 폼 메시지를 보내면 전건이 타임아웃된다.
 */

import { ITEM_STATUS, MSG } from '../shared/constants.js'
import { delayFromRange } from '../generator/random.js'
import { composeForItem } from '../generator/template-engine.js'
import { fillFormTimeoutMs } from '../shared/timing.js'
import { parseReviewFormUrl } from '../shared/review-form-url.js'

const failure = (message, extra = {}) => Object.freeze({ status: ITEM_STATUS.FAILED, message, ...extra })

const composeText = ({ random, templateSets, log }, state, item) => {
  const composed = composeForItem({
    settings: state.settings,
    sets: templateSets,
    item,
    random,
    recentTexts: state.recentTexts,
  })
  if (composed.ok) {
    for (const warning of composed.value.warnings) log.warn(`[${item.productName}] ${warning}`)
  }
  return composed
}

/** 목록에서 항목을 열고, 새로 뜬 폼 창을 잡아 준비될 때까지 기다린다. */
const openFormTab = async ({ messaging, log }, listTabId, item) => {
  // 창이 열리면서 응답이 끊길 수 있으므로 실패를 허용한다.
  const opened = await messaging.sendToTab(listTabId, MSG.OPEN_ITEM, { key: item.key, index: item.index })
  if (!opened.ok) log.info(`폼 열기 응답 없음(창 전환으로 추정): ${opened.error}`)

  const formTab = await messaging.waitForFormTab(listTabId)
  if (!formTab.ok) return formTab

  const ready = await messaging.ensureReady(formTab.value)
  return ready.ok ? { ok: true, value: formTab.value } : ready
}

const fillForm = ({ messaging }, formTabId, state, text) =>
  messaging.sendToTab(
    formTabId,
    MSG.FILL_FORM,
    {
      rating: state.settings.rating,
      text,
      humanTyping: state.settings.humanTyping,
      typingDelayRange: state.settings.delayMs.typingChar,
      answerSurveys: state.settings.answerSurveys,
    },
    { timeout: fillFormTimeoutMs({ textLength: text.length, settings: state.settings }) },
  )

/**
 * 등록하고 완료를 확인한다.
 * 완료 판정은 페이지 텍스트가 아니라 **폼 창의 URL 리다이렉트**로 한다
 * (returnUrl 의 action=REVIEW_REGISTERED). 훨씬 확실하다.
 */
const submitAndConfirm = async ({ messaging, log }, formTabId, timeout) => {
  // 버튼을 누르기 전에 감시를 시작해야 리다이렉트를 놓치지 않는다.
  const watcher = messaging.watchRegistration(formTabId)

  const submitted = await messaging.sendToTab(formTabId, MSG.SUBMIT_FORM, { dryRun: false })
  if (!submitted.ok) log.info(`등록 응답 없음(페이지 이동으로 추정): ${submitted.error}`)

  const registered = await watcher.wait(timeout)
  watcher.stop()
  return registered
}

/** 드라이런: 등록 버튼 상태만 확인하고 누르지 않는다. */
const previewSubmit = async ({ messaging, log }, formTabId, item, text, formKey) => {
  const preview = await messaging.sendToTab(formTabId, MSG.SUBMIT_FORM, { dryRun: true })
  for (const warning of preview.ok ? (preview.value.warnings ?? []) : []) {
    log.warn(`[${item.productName}] ${warning}`)
  }
  return Object.freeze({ status: ITEM_STATUS.DRY_RUN, message: '드라이런 - 등록하지 않음', text, formKey })
}

/** 폼 URL 의 productOrderNos — 목록 DOM 에 없는 항목 고유 식별자. */
const formKeyOf = async ({ messaging }, formTabId) => {
  const tab = await messaging.getTab(formTabId)
  return tab.ok ? parseReviewFormUrl(tab.value.url).key : null
}

const runOnFormTab = async (deps, { formTabId, state, item, text }) => {
  const formKey = await formKeyOf(deps, formTabId)

  const filled = await fillForm(deps, formTabId, state, text)
  if (!filled.ok) return failure(`폼 입력 실패: ${filled.error}`, { text, formKey })

  await deps.sleep(delayFromRange(state.settings.delayMs.afterFill, deps.random))

  if (state.settings.dryRun) return previewSubmit(deps, formTabId, item, text, formKey)

  const timeout = fillFormTimeoutMs({ textLength: 0, settings: state.settings })
  const registered = await submitAndConfirm(deps, formTabId, timeout)
  if (!registered.ok) return failure(`등록 확인 실패: ${registered.error}`, { text, formKey })

  return Object.freeze({
    status: ITEM_STATUS.SUBMITTED,
    message: `등록 완료 (${registered.value})`,
    text,
    formKey,
  })
}

/**
 * @param {{messaging: object, random: object, sleep: Function, log: object, templateSets?: object[]}} deps
 * @returns {(input: {tabId: number, state: object, item: object}) => Promise<object>}
 */
export const createItemProcessor = (deps) => async ({ tabId, state, item }) => {
  const composed = composeText(deps, state, item)
  if (!composed.ok) return failure(`본문 생성 실패: ${composed.error}`)
  const { text } = composed.value

  const formTab = await openFormTab(deps, tabId, item)
  if (!formTab.ok) return failure(`리뷰 폼 창을 열지 못했습니다: ${formTab.error}`)

  try {
    return await runOnFormTab(deps, { formTabId: formTab.value, state, item, text })
  } finally {
    // 남겨 두면 다음 항목에서 이 창을 새 폼으로 오인한다.
    await deps.messaging.closeTab(formTab.value)
  }
}
