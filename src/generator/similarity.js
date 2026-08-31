/**
 * 리뷰 중복 방지용 유사도 계산.
 * 한국어는 어절 분리보다 문자 바이그램이 표절 탐지에 잘 맞아 바이그램 자카드를 쓴다.
 */

const NON_CONTENT = /[\s.,!?~"'`()[\]{}<>:;\-_/\\|@#$%^&*+=]/gu
const BIGRAM_SIZE = 2

/** 공백/기호를 제거한 비교용 문자열. */
export const normalize = (text) => (typeof text === 'string' ? text.replace(NON_CONTENT, '').toLowerCase() : '')

/** @returns {Set<string>} */
export const bigrams = (text) => {
  const clean = normalize(text)
  const result = new Set()
  if (clean.length < BIGRAM_SIZE) {
    if (clean.length > 0) result.add(clean)
    return result
  }
  for (let i = 0; i <= clean.length - BIGRAM_SIZE; i += 1) {
    result.add(clean.slice(i, i + BIGRAM_SIZE))
  }
  return result
}

/** 0(완전 다름) ~ 1(동일) */
export const jaccard = (left, right) => {
  const a = bigrams(left)
  const b = bigrams(right)
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const gram of a) {
    if (b.has(gram)) shared += 1
  }
  return shared / (a.size + b.size - shared)
}

/** 후보 텍스트가 기존 텍스트들과 겹치는 최대 정도. */
export const maxSimilarity = (candidate, others) => {
  if (!Array.isArray(others) || others.length === 0) return 0
  return others.reduce((highest, other) => Math.max(highest, jaccard(candidate, other)), 0)
}
