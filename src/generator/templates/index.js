/** 내장 템플릿 세트 레지스트리와 톤 결정 규칙. */

import { err, ok } from '../../shared/result.js'
import { defaultSet } from './default-set.js'
import { digitalSet, fashionSet, foodSet, livingSet } from './category-sets.js'

export const TONE = Object.freeze({ POSITIVE: 'positive', NEUTRAL: 'neutral', NEGATIVE: 'negative' })

const RATING_TONE = Object.freeze({
  5: TONE.POSITIVE,
  4: TONE.POSITIVE,
  3: TONE.NEUTRAL,
  2: TONE.NEGATIVE,
  1: TONE.NEGATIVE,
})

export const BUILT_IN_TEMPLATE_SETS = Object.freeze([defaultSet, fashionSet, foodSet, digitalSet, livingSet])

export const toneForRating = (rating) => RATING_TONE[Number(rating)] ?? TONE.POSITIVE

/** 없는 id 는 기본 세트로 폴백한다 — 설정이 꼬여도 실행은 계속되어야 한다. */
export const findTemplateSet = (id, sets = BUILT_IN_TEMPLATE_SETS) => {
  const found = Array.isArray(sets) ? sets.find((set) => set?.id === id) : undefined
  return found ?? defaultSet
}

/** 세트가 해당 톤을 정의하지 않으면 기본 세트의 톤을 쓴다. */
export const resolveTone = (templateSet, tone) =>
  templateSet?.tones?.[tone] ?? defaultSet.tones[tone] ?? defaultSet.tones[TONE.POSITIVE]

const SLOT_PATTERN = /\{([a-zA-Z0-9_]+)\}/g

export const extractSlotNames = (pattern) =>
  typeof pattern === 'string' ? [...pattern.matchAll(SLOT_PATTERN)].map((match) => match[1]) : []

/**
 * 패턴이 존재하지 않는 슬롯을 참조하거나 문장 풀이 비어 있으면 실행 시점에 조용히
 * 깨지므로, 세트 등록 시점에 검증한다.
 */
export const validateTemplateSet = (templateSet) => {
  if (typeof templateSet?.id !== 'string' || templateSet.id.trim() === '') {
    return err('템플릿 세트에 id 가 없습니다.')
  }
  const tones = templateSet.tones
  if (typeof tones !== 'object' || tones === null || Object.keys(tones).length === 0) {
    return err(`[${templateSet.id}] 톤이 하나도 정의되지 않았습니다.`)
  }

  const problems = []
  for (const [toneName, tone] of Object.entries(tones)) {
    const patterns = Array.isArray(tone?.patterns) ? tone.patterns : []
    const slots = typeof tone?.slots === 'object' && tone.slots !== null ? tone.slots : {}
    if (patterns.length === 0) problems.push(`[${templateSet.id}/${toneName}] 조합 패턴이 없습니다.`)

    for (const [slotName, pool] of Object.entries(slots)) {
      if (!Array.isArray(pool) || pool.length === 0) {
        problems.push(`[${templateSet.id}/${toneName}] 슬롯 "${slotName}" 의 문장이 비었습니다.`)
      }
    }
    for (const pattern of patterns) {
      for (const slotName of extractSlotNames(pattern)) {
        if (!Array.isArray(slots[slotName]) || slots[slotName].length === 0) {
          problems.push(`[${templateSet.id}/${toneName}] 패턴이 없는 슬롯 "${slotName}" 을 참조합니다.`)
        }
      }
    }
  }

  if (problems.length > 0) return err(problems.join('\n'))
  return ok(templateSet)
}
