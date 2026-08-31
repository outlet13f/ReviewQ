import { describe, expect, test } from 'vitest'
import { composeForItem, composeReview, trimToMaxLength } from '../src/generator/template-engine.js'
import { createRandom } from '../src/generator/random.js'
import { findTemplateSet } from '../src/generator/templates/index.js'
import { mergeSettings } from '../src/shared/settings.js'

const defaultSet = findTemplateSet('default')

describe('trimToMaxLength', () => {
  test('한계 이하면 그대로 반환한다', () => {
    expect(trimToMaxLength('짧은 문장.', 100)).toBe('짧은 문장.')
  })

  test('문장 경계에서 자른다', () => {
    const text = '첫 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다.'

    const trimmed = trimToMaxLength(text, 20)

    // 20자 한계 안에 두 문장(18자)이 들어가므로 마지막 마침표까지 살린다
    expect(trimmed).toBe('첫 문장입니다. 두 번째 문장입니다.')
    expect(trimToMaxLength(text, 10)).toBe('첫 문장입니다.')
  })

  test('문장 경계가 없으면 길이로 자른다', () => {
    expect(trimToMaxLength('가나다라마바사', 3)).toBe('가나다')
  })
})

describe('composeReview', () => {
  test('별점 5점이면 긍정 톤 리뷰를 만든다', () => {
    const random = createRandom(1)

    const result = composeReview({ templateSet: defaultSet, rating: 5, random })

    expect(result.ok).toBe(true)
    expect(result.value.tone).toBe('positive')
    expect(result.value.text.length).toBeGreaterThan(0)
  })

  test('별점 1점이면 부정 톤 리뷰를 만든다', () => {
    const result = composeReview({ templateSet: defaultSet, rating: 1, random: createRandom(2) })

    expect(result.value.tone).toBe('negative')
  })

  test('생성된 본문에 채워지지 않은 슬롯이 남지 않는다', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const result = composeReview({ templateSet: defaultSet, rating: 5, random: createRandom(seed) })

      expect(result.ok).toBe(true)
      expect(result.value.text).not.toMatch(/[{}]/u)
    }
  })

  test('최소 글자 수를 항상 충족한다', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const result = composeReview({
        templateSet: defaultSet,
        rating: 5,
        random: createRandom(seed),
        minLength: 40,
      })

      expect(result.ok).toBe(true)
      expect(result.value.text.length).toBeGreaterThanOrEqual(40)
    }
  })

  test('같은 시드는 같은 본문을 만든다', () => {
    const first = composeReview({ templateSet: defaultSet, rating: 5, random: createRandom(77) })
    const second = composeReview({ templateSet: defaultSet, rating: 5, random: createRandom(77) })

    expect(first.value.text).toBe(second.value.text)
  })

  test('서로 다른 시드는 다양한 본문을 만든다', () => {
    const texts = new Set(
      Array.from(
        { length: 40 },
        (_unused, seed) => composeReview({ templateSet: defaultSet, rating: 5, random: createRandom(seed) }).value.text,
      ),
    )

    expect(texts.size).toBeGreaterThan(25)
  })

  test('최근 작성한 리뷰와 유사하면 다른 본문을 고른다', () => {
    const previous = composeReview({ templateSet: defaultSet, rating: 5, random: createRandom(5) }).value.text

    const next = composeReview({
      templateSet: defaultSet,
      rating: 5,
      random: createRandom(5),
      recentTexts: [previous],
      similarityThreshold: 0.5,
    })

    expect(next.ok).toBe(true)
    expect(next.value.text).not.toBe(previous)
    expect(next.value.similarity).toBeLessThanOrEqual(0.5)
  })

  test('중복을 피할 수 없으면 경고를 담아 반환한다', () => {
    const random = createRandom(9)
    const sample = composeReview({ templateSet: defaultSet, rating: 5, random: createRandom(9) }).value.text

    const result = composeReview({
      templateSet: defaultSet,
      rating: 5,
      random,
      recentTexts: [sample],
      similarityThreshold: -1,
      maxAttempts: 2,
    })

    expect(result.ok).toBe(true)
    expect(result.value.warnings.length).toBeGreaterThan(0)
  })

  test('컨텍스트 변수를 상품명으로 치환한다', () => {
    const set = {
      id: 'ctx',
      tones: { positive: { patterns: ['{intro}'], slots: { intro: ['{productName} 잘 받았습니다.'] } } },
    }

    const result = composeReview({
      templateSet: set,
      rating: 5,
      random: createRandom(1),
      minLength: 1,
      context: { productName: '텀블러' },
    })

    expect(result.value.text).toBe('텀블러 잘 받았습니다.')
  })

  test('치환할 컨텍스트 값이 없으면 실패한다', () => {
    const set = {
      id: 'ctx',
      tones: { positive: { patterns: ['{intro}'], slots: { intro: ['{productName} 후기입니다.'] } } },
    }

    const result = composeReview({ templateSet: set, rating: 5, random: createRandom(1), minLength: 1 })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('productName')
  })

  test('없는 슬롯을 참조하면 실패한다', () => {
    const set = { id: 'bad', tones: { positive: { patterns: ['{nope}'], slots: {} } } }

    const result = composeReview({ templateSet: set, rating: 5, random: createRandom(1) })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('nope')
  })

  test('패턴이 없으면 실패한다', () => {
    const set = { id: 'bad', tones: { positive: { patterns: [], slots: {} } } }

    const result = composeReview({ templateSet: set, rating: 5, random: createRandom(1) })

    expect(result.ok).toBe(false)
  })

  test('난수 생성기가 없으면 실패한다', () => {
    const result = composeReview({ templateSet: defaultSet, rating: 5, random: null })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('난수')
  })
})

describe('composeForItem', () => {
  test('설정의 템플릿 세트와 별점을 사용한다', () => {
    const settings = mergeSettings({ templateSetId: 'food', rating: 3, minReviewLength: 30 })

    const result = composeForItem({
      settings,
      item: { productName: '사과 3kg' },
      random: createRandom(4),
      recentTexts: [],
    })

    expect(result.ok).toBe(true)
    expect(result.value.tone).toBe('neutral')
    expect(result.value.text.length).toBeGreaterThanOrEqual(30)
  })

  test('상품 정보가 없어도 기본 템플릿으로 생성된다', () => {
    const settings = mergeSettings({})

    const result = composeForItem({ settings, item: null, random: createRandom(6), recentTexts: [] })

    expect(result.ok).toBe(true)
  })
})
