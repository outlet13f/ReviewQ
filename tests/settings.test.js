import { describe, expect, test } from 'vitest'
import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from '../src/shared/settings.js'

describe('mergeSettings', () => {
  test('입력이 없으면 기본값을 그대로 쓴다', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS)
  })

  test('naver.com 이 아닌 URL 은 기본값으로 되돌린다', () => {
    const merged = mergeSettings({ reviewListUrl: 'https://evil.example.com/hook' })

    expect(merged.reviewListUrl).toBe(DEFAULT_SETTINGS.reviewListUrl)
  })

  test('http 주소는 거부한다', () => {
    expect(mergeSettings({ reviewListUrl: 'http://order.pay.naver.com/x' }).reviewListUrl).toBe(
      DEFAULT_SETTINGS.reviewListUrl,
    )
  })

  test('naver.com 하위 https 주소는 받아들인다', () => {
    const url = 'https://new-m.pay.naver.com/myreview'

    expect(mergeSettings({ reviewListUrl: url }).reviewListUrl).toBe(url)
  })

  test('최대 처리 건수를 허용 범위로 자른다', () => {
    expect(mergeSettings({ maxItemsPerRun: 9999 }).maxItemsPerRun).toBe(200)
    expect(mergeSettings({ maxItemsPerRun: 0 }).maxItemsPerRun).toBe(1)
    expect(mergeSettings({ maxItemsPerRun: 'abc' }).maxItemsPerRun).toBe(DEFAULT_SETTINGS.maxItemsPerRun)
  })

  test('별점을 1~5 로 자른다', () => {
    expect(mergeSettings({ rating: 9 }).rating).toBe(5)
    expect(mergeSettings({ rating: -3 }).rating).toBe(1)
  })

  test('뒤집힌 지연 범위를 오름차순으로 정리한다', () => {
    const merged = mergeSettings({ delayMs: { betweenItems: [9000, 1000] } })

    expect(merged.delayMs.betweenItems).toEqual([1000, 9000])
  })

  test('지연 범위 형식이 틀리면 기본값을 쓴다', () => {
    const merged = mergeSettings({ delayMs: { typingChar: 'fast' } })

    expect(merged.delayMs.typingChar).toEqual(DEFAULT_SETTINGS.delayMs.typingChar)
  })

  test('불리언이 아닌 dryRun 은 기본값(true)을 유지한다', () => {
    expect(mergeSettings({ dryRun: 'no' }).dryRun).toBe(true)
    expect(mergeSettings({ dryRun: false }).dryRun).toBe(false)
  })

  test('런타임 로드 경로도 지연 상한을 클램프한다', () => {
    // 구버전 설정이나 손상된 저장소가 그대로 통과하면 수십 시간짜리 대기에 갇힌다.
    const merged = mergeSettings({
      delayMs: {
        typingChar: [5000, 9000],
        betweenItems: [10000000, 10000000],
        afterFill: [99999999, 99999999],
      },
    })

    expect(merged.delayMs.typingChar[1]).toBeLessThanOrEqual(500)
    expect(merged.delayMs.betweenItems[1]).toBeLessThanOrEqual(120000)
    expect(merged.delayMs.afterFill[1]).toBeLessThanOrEqual(10000)
  })

  test('반환값은 변경할 수 없다', () => {
    const merged = mergeSettings({})

    expect(Object.isFrozen(merged)).toBe(true)
    expect(Object.isFrozen(merged.delayMs)).toBe(true)
  })
})

describe('validateSettings', () => {
  test('올바른 입력을 통과시킨다', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, maxItemsPerRun: 5 })

    expect(result.ok).toBe(true)
    expect(result.value.maxItemsPerRun).toBe(5)
  })

  test('객체가 아니면 실패한다', () => {
    expect(validateSettings('nope').ok).toBe(false)
  })

  test('잘못된 URL 을 오류로 알린다', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, reviewListUrl: 'not-a-url' })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('naver.com')
  })

  test('여러 문제를 한 번에 모아 보여준다', () => {
    // 개수를 고정하면 검증 항목이 늘 때마다 깨진다. 각 문제가 보고되는지를 본다.
    const result = validateSettings({ reviewListUrl: 'nope', maxItemsPerRun: 0, rating: 9, minReviewLength: 1 })

    expect(result.ok).toBe(false)
    for (const expected of ['naver.com', '최대 처리 건수', '별점', '최소 글자 수']) {
      expect(result.error).toContain(expected)
    }
  })

  test('글자 간격이 허용 범위를 넘으면 실패한다', () => {
    // 글자당 지연이 과도하면 한 건 입력에 수 분이 걸려 폼 대기 상한에 걸린다.
    const result = validateSettings({
      ...DEFAULT_SETTINGS,
      delayMs: { ...DEFAULT_SETTINGS.delayMs, typingChar: [10, 5000] },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('글자 간격')
  })

  test('건 사이 대기가 허용 범위를 넘으면 실패한다', () => {
    const result = validateSettings({
      ...DEFAULT_SETTINGS,
      delayMs: { ...DEFAULT_SETTINGS.delayMs, betweenItems: [0, 999999] },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('건 사이 대기')
  })

  test('입력 후 대기가 허용 범위를 넘으면 실패한다', () => {
    const result = validateSettings({
      ...DEFAULT_SETTINGS,
      delayMs: { ...DEFAULT_SETTINGS.delayMs, afterFill: [0, 999999] },
    })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('입력 후 대기')
  })

  test('지연 값이 음수면 실패한다', () => {
    const result = validateSettings({
      ...DEFAULT_SETTINGS,
      delayMs: { ...DEFAULT_SETTINGS.delayMs, typingChar: [-10, 50] },
    })

    expect(result.ok).toBe(false)
  })

  test('허용 범위 안의 지연 값은 통과한다', () => {
    const result = validateSettings({
      ...DEFAULT_SETTINGS,
      delayMs: { typingChar: [0, 500], afterFill: [700, 1800], betweenItems: [0, 120000] },
    })

    expect(result.ok).toBe(true)
  })

  test('최소 글자 수가 20 미만이면 실패한다', () => {
    const result = validateSettings({ ...DEFAULT_SETTINGS, minReviewLength: 5 })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('20자')
  })
})
