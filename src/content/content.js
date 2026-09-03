/**
 * 콘텐츠 스크립트 진입점.
 * 상태를 갖지 않는다 — 페이지가 새로 로드되어도 background 가 흐름을 이어갈 수 있도록
 * 각 단계를 독립적인 메시지 핸들러로 노출한다.
 */

import { LIMITS, MSG } from '../shared/constants.js'
import { createLogger } from '../shared/logger.js'
import { err, ok } from '../shared/result.js'
import { createSystemRandom, delayFromRange } from '../generator/random.js'
import { DEFAULT_SETTINGS } from '../shared/settings.js'
import { loadMoreItems, openReviewForm, scanReviewList } from './actions/scan-list.js'
import { requireFormRoot, waitForForm } from './actions/form.js'
import { setRating } from './actions/fill-rating.js'
import { fillSurveys } from './actions/fill-survey.js'
import { fillReviewText } from './actions/fill-text.js'
import { submitReview } from './actions/submit.js'
import { probePage } from './probe.js'

const log = createLogger('content')
const random = createSystemRandom()

/** Error 객체는 메시지로 보내기 어려우므로 cause 를 떼어낸다. */
const toWire = (result) =>
  result?.ok ? { ok: true, value: result.value } : { ok: false, error: result?.error ?? '알 수 없는 오류' }

/** 별점 -> 본문 순서로 폼을 채운다. */
const fillForm = async (payload) => {
  // 기본값은 한 곳(DEFAULT_SETTINGS)에서만 정의한다.
  const {
    rating,
    text,
    humanTyping = DEFAULT_SETTINGS.humanTyping,
    typingDelayRange = DEFAULT_SETTINGS.delayMs.typingChar,
    answerSurveys = DEFAULT_SETTINGS.answerSurveys,
  } = payload ?? {}

  const form = await waitForForm(LIMITS.CONTENT_READY_TIMEOUT_MS)
  if (!form.ok) return form

  const ratingResult = setRating(form.value, rating)
  if (!ratingResult.ok) return ratingResult

  // 설문이 필수면 채우지 않는 한 등록 버튼이 활성화되지 않는다.
  const surveyResult = answerSurveys ? fillSurveys(form.value, rating) : ok({ answered: 0, total: 0 })
  if (!surveyResult.ok) return surveyResult

  const textResult = await fillReviewText(form.value, text, {
    humanTyping,
    delayFor: () => delayFromRange(typingDelayRange, random),
  })
  if (!textResult.ok) return textResult

  return ok(
    Object.freeze({
      rating: ratingResult.value,
      survey: surveyResult.value,
      text: textResult.value,
    }),
  )
}

const handleSubmit = async (payload) => {
  const root = requireFormRoot()
  if (!root.ok) return root
  return submitReview(root.value, {
    dryRun: payload?.dryRun !== false,
    timeout: LIMITS.DEFAULT_TIMEOUT_MS,
  })
}

const HANDLERS = Object.freeze({
  [MSG.PING]: async () => ok({ url: location.href, readyAt: Date.now() }),
  [MSG.SCAN_LIST]: async () => scanReviewList(),
  [MSG.OPEN_ITEM]: async (payload) => openReviewForm(payload ?? {}),
  [MSG.FILL_FORM]: async (payload) => fillForm(payload),
  [MSG.SUBMIT_FORM]: async (payload) => handleSubmit(payload),
  [MSG.LOAD_MORE]: async () => loadMoreItems(),
  [MSG.PROBE_DUMP]: async () => ok(probePage()),
})

const dispatch = async (message) => {
  const type = message?.type
  const handler = typeof type === 'string' && Object.hasOwn(HANDLERS, type) ? HANDLERS[type] : null
  if (!handler) return err(`알 수 없는 메시지 타입: ${type}`)
  try {
    return await handler(message.payload)
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    log.error(`${message.type} 처리 중 예외`, cause)
    return err(`${message.type} 처리 실패: ${reason}`)
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // `in` 은 프로토타입 체인까지 본다. 자체 속성만 인정한다.
  if (typeof message?.type !== 'string' || !Object.hasOwn(HANDLERS, message.type)) return false
  dispatch(message).then((result) => sendResponse(toWire(result)))
  return true
})

log.info('준비 완료', location.href.split('?')[0])
