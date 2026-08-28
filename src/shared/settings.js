/** 설정 기본값과 경계 검증. 저장소/사용자 입력은 신뢰하지 않는다. */

import { LIMITS } from './constants.js'
import { err, ok } from './result.js'
import { isNaverUrl } from './naver-url.js'

/** 네이버쇼핑 "작성 가능한 리뷰" 목록. 계정/개편에 따라 다를 수 있어 설정으로 노출한다. */
export const DEFAULT_REVIEW_LIST_URL = 'https://shopping.naver.com/my/writable-reviews'

export const DEFAULT_SETTINGS = Object.freeze({
  reviewListUrl: DEFAULT_REVIEW_LIST_URL,
  /** 한 번 실행에서 처리할 최대 리뷰 수. 사고 범위를 제한한다. */
  maxItemsPerRun: 10,
  /** true 면 폼만 채우고 등록 버튼을 누르지 않는다. */
  dryRun: true,
  /** 기본 별점. */
  rating: 5,
  minReviewLength: LIMITS.MIN_REVIEW_LENGTH,
  templateSetId: 'default',
  /** 사람처럼 한 글자씩 입력할지. false 면 한 번에 붙여넣는다. */
  humanTyping: true,
  /**
   * 상품 평가 설문(맛/포장/유통기한 등)을 별점에 맞춰 자동 선택할지.
   * 설문이 필수면 끄면 등록 자체가 안 된다. 다만 "유통기한이 얼마나 남았나" 처럼
   * 별점으로 알 수 없는 **사실 항목**도 함께 답하게 되므로 끌 수 있게 둔다.
   */
  answerSurveys: true,
  delayMs: Object.freeze({
    typingChar: Object.freeze([25, 70]),
    afterFill: Object.freeze([700, 1800]),
    betweenItems: Object.freeze([4000, 9000]),
  }),
  /** 연속 실패가 이 횟수에 도달하면 실행을 중단한다. */
  stopOnConsecutiveFailures: 3,
  similarityThreshold: LIMITS.SIMILARITY_THRESHOLD,
})

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const clampInt = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

const normalizeRange = (value, fallback) => {
  if (!Array.isArray(value) || value.length !== 2) return fallback
  const min = Number.parseInt(value[0], 10)
  const max = Number.parseInt(value[1], 10)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return fallback
  const lo = Math.max(0, Math.min(min, max))
  const hi = Math.max(lo, Math.max(min, max))
  return Object.freeze([lo, hi])
}

/** 호스트 판별은 shared/naver-url.js 하나만 쓴다(같은 규칙이 두 벌 존재하지 않도록). */
const isHttpsNaverUrl = (value) => isNaverUrl(value)

/** [min, max] 두 값이 모두 0 ~ limit 안에 있는지. */
const isRangeWithin = (range, limit) => {
  if (!Array.isArray(range) || range.length !== 2) return false
  return range.every((value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= limit
  })
}

/**
 * 저장소에서 읽은 값을 관용적으로 병합한다. 잘못된 필드는 기본값으로 되돌린다.
 * 런타임 로드용 — 여기서 실패시키면 확장 자체가 멈추므로 클램프한다.
 */
export const mergeSettings = (stored) => {
  const raw = isPlainObject(stored) ? stored : {}
  const delay = isPlainObject(raw.delayMs) ? raw.delayMs : {}
  return Object.freeze({
    reviewListUrl: isHttpsNaverUrl(raw.reviewListUrl) ? raw.reviewListUrl : DEFAULT_SETTINGS.reviewListUrl,
    maxItemsPerRun: clampInt(raw.maxItemsPerRun, 1, LIMITS.MAX_ITEMS_PER_RUN, DEFAULT_SETTINGS.maxItemsPerRun),
    dryRun: typeof raw.dryRun === 'boolean' ? raw.dryRun : DEFAULT_SETTINGS.dryRun,
    rating: clampInt(raw.rating, 1, 5, DEFAULT_SETTINGS.rating),
    minReviewLength: clampInt(
      raw.minReviewLength,
      LIMITS.MIN_REVIEW_LENGTH,
      LIMITS.MAX_REVIEW_LENGTH,
      DEFAULT_SETTINGS.minReviewLength,
    ),
    templateSetId:
      typeof raw.templateSetId === 'string' && raw.templateSetId.trim() !== ''
        ? raw.templateSetId.trim()
        : DEFAULT_SETTINGS.templateSetId,
    humanTyping: typeof raw.humanTyping === 'boolean' ? raw.humanTyping : DEFAULT_SETTINGS.humanTyping,
    answerSurveys:
      typeof raw.answerSurveys === 'boolean' ? raw.answerSurveys : DEFAULT_SETTINGS.answerSurveys,
    delayMs: Object.freeze({
      typingChar: normalizeRange(delay.typingChar, DEFAULT_SETTINGS.delayMs.typingChar),
      afterFill: normalizeRange(delay.afterFill, DEFAULT_SETTINGS.delayMs.afterFill),
      betweenItems: normalizeRange(delay.betweenItems, DEFAULT_SETTINGS.delayMs.betweenItems),
    }),
    stopOnConsecutiveFailures: clampInt(raw.stopOnConsecutiveFailures, 1, 50, DEFAULT_SETTINGS.stopOnConsecutiveFailures),
    similarityThreshold: Number.isFinite(Number(raw.similarityThreshold))
      ? Math.min(1, Math.max(0, Number(raw.similarityThreshold)))
      : DEFAULT_SETTINGS.similarityThreshold,
  })
}

/**
 * 옵션 화면 저장용 엄격 검증. 사용자가 고칠 수 있는 오류는 메시지로 알린다.
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
export const validateSettings = (raw) => {
  if (!isPlainObject(raw)) return err('설정 형식이 올바르지 않습니다.')

  const problems = []
  if (!isHttpsNaverUrl(raw.reviewListUrl)) {
    problems.push('리뷰 목록 URL은 https 로 시작하는 naver.com 주소여야 합니다.')
  }
  const maxItems = Number.parseInt(raw.maxItemsPerRun, 10)
  if (!Number.isFinite(maxItems) || maxItems < 1 || maxItems > LIMITS.MAX_ITEMS_PER_RUN) {
    problems.push(`1회 최대 처리 건수는 1 ~ ${LIMITS.MAX_ITEMS_PER_RUN} 사이여야 합니다.`)
  }
  const rating = Number.parseInt(raw.rating, 10)
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    problems.push('별점은 1 ~ 5 사이여야 합니다.')
  }
  const minLength = Number.parseInt(raw.minReviewLength, 10)
  if (!Number.isFinite(minLength) || minLength < LIMITS.MIN_REVIEW_LENGTH) {
    problems.push(`최소 글자 수는 ${LIMITS.MIN_REVIEW_LENGTH}자 이상이어야 합니다.`)
  }

  // 지연 값은 폼 입력 대기 예산을 직접 좌우한다(shared/timing.js). 반드시 검증한다.
  const delay = isPlainObject(raw.delayMs) ? raw.delayMs : {}
  if (!isRangeWithin(delay.typingChar, LIMITS.MAX_TYPING_DELAY_MS)) {
    problems.push(`글자 간격은 0 ~ ${LIMITS.MAX_TYPING_DELAY_MS}ms 사이여야 합니다.`)
  }
  if (!isRangeWithin(delay.betweenItems, LIMITS.MAX_BETWEEN_ITEMS_MS)) {
    problems.push(`건 사이 대기는 0 ~ ${LIMITS.MAX_BETWEEN_ITEMS_MS}ms 사이여야 합니다.`)
  }

  if (problems.length > 0) return err(problems.join('\n'))
  return ok(mergeSettings(raw))
}
