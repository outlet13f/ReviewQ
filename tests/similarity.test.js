import { describe, expect, test } from 'vitest'
import { bigrams, jaccard, maxSimilarity, normalize } from '../src/generator/similarity.js'

describe('normalize', () => {
  test('공백과 기호를 제거한다', () => {
    expect(normalize('배송이  빨라요! 좋았습니다.')).toBe('배송이빨라요좋았습니다')
  })

  test('문자열이 아니면 빈 문자열을 반환한다', () => {
    expect(normalize(null)).toBe('')
    expect(normalize(42)).toBe('')
  })
})

describe('bigrams', () => {
  test('연속된 두 글자 집합을 만든다', () => {
    expect([...bigrams('배송빠름')]).toEqual(['배송', '송빠', '빠름'])
  })

  test('두 글자보다 짧으면 원문 하나만 담는다', () => {
    expect([...bigrams('가')]).toEqual(['가'])
  })

  test('내용이 없으면 빈 집합이다', () => {
    expect(bigrams('   ').size).toBe(0)
  })
})

describe('jaccard', () => {
  test('동일한 문장은 1 이다', () => {
    expect(jaccard('배송이 빨라서 좋았어요', '배송이 빨라서 좋았어요')).toBe(1)
  })

  test('겹치는 부분이 없으면 0 이다', () => {
    expect(jaccard('가나다라', '마바사아')).toBe(0)
  })

  test('부분적으로 겹치면 0 과 1 사이다', () => {
    const score = jaccard('배송이 빨라서 좋았어요', '배송이 빨라서 만족합니다')

    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  test('한쪽이 비어 있으면 0 이다', () => {
    expect(jaccard('', '배송빠름')).toBe(0)
  })

  test('양쪽 모두 비어 있으면 1 이다', () => {
    expect(jaccard('', '')).toBe(1)
  })
})

describe('maxSimilarity', () => {
  test('가장 비슷한 문장과의 점수를 반환한다', () => {
    const others = ['전혀 다른 이야기', '배송이 빨라서 좋았어요']

    const score = maxSimilarity('배송이 빨라서 좋았어요', others)

    expect(score).toBe(1)
  })

  test('비교 대상이 없으면 0 이다', () => {
    expect(maxSimilarity('아무 문장', [])).toBe(0)
    expect(maxSimilarity('아무 문장', null)).toBe(0)
  })
})
