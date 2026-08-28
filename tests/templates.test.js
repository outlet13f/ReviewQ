import { describe, expect, test } from 'vitest'
import {
  BUILT_IN_TEMPLATE_SETS,
  TONE,
  extractSlotNames,
  findTemplateSet,
  resolveTone,
  toneForRating,
  validateTemplateSet,
} from '../src/generator/templates/index.js'

describe('toneForRating', () => {
  test('4~5점은 긍정 톤이다', () => {
    expect(toneForRating(5)).toBe(TONE.POSITIVE)
    expect(toneForRating(4)).toBe(TONE.POSITIVE)
  })

  test('3점은 중립 톤이다', () => {
    expect(toneForRating(3)).toBe(TONE.NEUTRAL)
  })

  test('1~2점은 부정 톤이다', () => {
    expect(toneForRating(2)).toBe(TONE.NEGATIVE)
    expect(toneForRating(1)).toBe(TONE.NEGATIVE)
  })

  test('알 수 없는 별점은 긍정 톤으로 폴백한다', () => {
    expect(toneForRating(99)).toBe(TONE.POSITIVE)
    expect(toneForRating(undefined)).toBe(TONE.POSITIVE)
  })
})

describe('findTemplateSet', () => {
  test('id 가 일치하는 세트를 찾는다', () => {
    expect(findTemplateSet('food').id).toBe('food')
  })

  test('없는 id 는 기본 세트로 폴백한다', () => {
    expect(findTemplateSet('does-not-exist').id).toBe('default')
  })

  test('세트 목록이 배열이 아니면 기본 세트로 폴백한다', () => {
    expect(findTemplateSet('food', null).id).toBe('default')
  })
})

describe('resolveTone', () => {
  test('세트가 정의한 톤을 그대로 반환한다', () => {
    const set = findTemplateSet('fashion')

    expect(resolveTone(set, TONE.POSITIVE)).toBe(set.tones.positive)
  })

  test('세트에 없는 톤은 기본 세트의 톤을 쓴다', () => {
    const fashion = findTemplateSet('fashion')
    const fallback = resolveTone(fashion, TONE.NEGATIVE)

    expect(fashion.tones.negative).toBeUndefined()
    expect(fallback).toBe(findTemplateSet('default').tones.negative)
  })
})

describe('extractSlotNames', () => {
  test('패턴에서 슬롯 이름을 뽑는다', () => {
    expect(extractSlotNames('{delivery} {quality} {closing}')).toEqual(['delivery', 'quality', 'closing'])
  })

  test('문자열이 아니면 빈 배열이다', () => {
    expect(extractSlotNames(null)).toEqual([])
  })
})

describe('validateTemplateSet', () => {
  test('내장 세트는 모두 검증을 통과한다', () => {
    for (const set of BUILT_IN_TEMPLATE_SETS) {
      const result = validateTemplateSet(set)
      expect(result.ok, `${set.id}: ${result.error ?? ''}`).toBe(true)
    }
  })

  test('id 가 없으면 실패한다', () => {
    expect(validateTemplateSet({ tones: {} }).ok).toBe(false)
  })

  test('톤이 하나도 없으면 실패한다', () => {
    expect(validateTemplateSet({ id: 'x', tones: {} }).ok).toBe(false)
  })

  test('존재하지 않는 슬롯을 참조하면 실패한다', () => {
    const broken = {
      id: 'broken',
      tones: { positive: { patterns: ['{missingSlot}'], slots: { other: ['문장.'] } } },
    }

    const result = validateTemplateSet(broken)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('missingSlot')
  })

  test('문장 풀이 비어 있으면 실패한다', () => {
    const broken = {
      id: 'broken',
      tones: { positive: { patterns: ['{a}'], slots: { a: [] } } },
    }

    expect(validateTemplateSet(broken).ok).toBe(false)
  })

  test('조합 패턴이 없으면 실패한다', () => {
    const broken = { id: 'broken', tones: { positive: { patterns: [], slots: { a: ['문장.'] } } } }

    const result = validateTemplateSet(broken)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('조합 패턴')
  })
})
