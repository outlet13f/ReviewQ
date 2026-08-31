/**
 * 템플릿 조합 리뷰 생성기.
 * 순수 함수 — DOM/chrome API 에 의존하지 않아 단독 테스트가 가능하다.
 */

import { LIMITS } from '../shared/constants.js'
import { err, ok } from '../shared/result.js'
import { maxSimilarity } from './similarity.js'
import { findTemplateSet, resolveTone, toneForRating } from './templates/index.js'

const SLOT_RE = /\{([a-zA-Z0-9_]+)\}/g
const SENTENCE_END_RE = /[.!?]/gu
const FILLER_SLOT = 'filler'

const collapseSpaces = (text) => text.replace(/\s+/gu, ' ').trim()

/** 패턴의 {슬롯} 을 문장 풀에서 무작위로 채운다. */
const fillPattern = (pattern, slots, random) => {
  const missing = []
  const filled = pattern.replace(SLOT_RE, (_match, slotName) => {
    const choice = random.pick(slots[slotName])
    if (choice === undefined) {
      missing.push(slotName)
      return ''
    }
    return choice
  })
  return { text: collapseSpaces(filled), missing }
}

/** 문장 안에 남은 {productName} 같은 컨텍스트 변수를 치환한다. */
const applyContext = (text, context) => {
  const unresolved = []
  const applied = text.replace(SLOT_RE, (match, key) => {
    const value = context?.[key]
    if (typeof value !== 'string' || value.trim() === '') {
      unresolved.push(key)
      return match
    }
    return value.trim()
  })
  return { text: collapseSpaces(applied), unresolved }
}

/** 최소 글자 수(네이버 포인트 조건)를 맞추기 위해 중복되지 않는 filler 문장을 덧붙인다. */
const padToMinLength = (text, fillerPool, random, minLength) => {
  if (text.length >= minLength) return text
  const candidates = random.shuffle(Array.isArray(fillerPool) ? fillerPool : [])
  return candidates.reduce((current, sentence) => {
    if (current.length >= minLength || current.includes(sentence)) return current
    return `${current} ${sentence}`
  }, text)
}

/** 최대 글자 수 초과 시 문장 경계에서 자른다. 단어 중간에서 끊기지 않게 한다. */
export const trimToMaxLength = (text, maxLength) => {
  if (text.length <= maxLength) return text
  const head = text.slice(0, maxLength)
  const boundaries = [...head.matchAll(SENTENCE_END_RE)]
  const last = boundaries.at(-1)
  if (last) return head.slice(0, last.index + 1).trim()
  return head.trim()
}

/**
 * 리뷰 본문 한 건을 만든다.
 * @param {object} options
 * @param {object} options.templateSet 사용할 템플릿 세트
 * @param {number} options.rating 별점(1~5) — 톤을 결정한다
 * @param {object} options.random createRandom() 인스턴스
 * @param {number} [options.minLength]
 * @param {number} [options.maxLength]
 * @param {string[]} [options.recentTexts] 중복 회피용 최근 생성 결과
 * @param {number} [options.similarityThreshold]
 * @param {object} [options.context] {productName, optionName, storeName}
 */
export const composeReview = ({
  templateSet,
  rating,
  random,
  minLength = LIMITS.MIN_REVIEW_LENGTH,
  maxLength = LIMITS.MAX_REVIEW_LENGTH,
  recentTexts = [],
  similarityThreshold = LIMITS.SIMILARITY_THRESHOLD,
  context = {},
  maxAttempts = LIMITS.MAX_COMPOSE_ATTEMPTS,
}) => {
  if (!random || typeof random.pick !== 'function') return err('난수 생성기가 필요합니다.')

  const tone = toneForRating(rating)
  const toneData = resolveTone(templateSet, tone)
  const patterns = Array.isArray(toneData?.patterns) ? toneData.patterns : []
  const slots = toneData?.slots ?? {}
  if (patterns.length === 0) return err(`템플릿 세트에 ${tone} 톤 조합 패턴이 없습니다.`)

  let best = null

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const pattern = random.pick(patterns)
    const filled = fillPattern(pattern, slots, random)
    if (filled.missing.length > 0) {
      return err(`템플릿 슬롯을 찾을 수 없습니다: ${[...new Set(filled.missing)].join(', ')}`)
    }

    const contextual = applyContext(filled.text, context)
    if (contextual.unresolved.length > 0) {
      return err(`치환할 값이 없는 변수가 있습니다: ${[...new Set(contextual.unresolved)].join(', ')}`)
    }

    const padded = padToMinLength(contextual.text, slots[FILLER_SLOT], random, minLength)
    const text = trimToMaxLength(padded, maxLength)
    const similarity = maxSimilarity(text, recentTexts)

    if (best === null || similarity < best.similarity) {
      best = Object.freeze({ text, tone, pattern, similarity, attempts: attempt })
    }
    if (text.length >= minLength && similarity <= similarityThreshold) {
      return ok(Object.freeze({ ...best, text, similarity, attempts: attempt, warnings: Object.freeze([]) }))
    }
  }

  if (best === null) return err('리뷰 본문 생성에 실패했습니다.')

  const warnings = []
  if (best.text.length < minLength) {
    warnings.push(`최소 ${minLength}자를 채우지 못했습니다(현재 ${best.text.length}자). 템플릿 문장을 늘려 주세요.`)
  }
  if (best.similarity > similarityThreshold) {
    warnings.push(`최근 작성한 리뷰와 ${Math.round(best.similarity * 100)}% 유사합니다. 문장 풀을 늘리는 게 좋습니다.`)
  }
  return ok(Object.freeze({ ...best, warnings: Object.freeze(warnings) }))
}

/** 설정에 담긴 templateSetId 로 세트를 고르고 본문을 만든다. */
export const composeForItem = ({ settings, sets, item, random, recentTexts }) => {
  const templateSet = findTemplateSet(settings.templateSetId, sets)
  return composeReview({
    templateSet,
    rating: settings.rating,
    random,
    minLength: settings.minReviewLength,
    recentTexts,
    similarityThreshold: settings.similarityThreshold,
    context: {
      productName: item?.productName ?? '',
      optionName: item?.optionName ?? '',
      storeName: item?.storeName ?? '',
    },
  })
}
