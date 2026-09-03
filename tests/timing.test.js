/**
 * 폼 입력 응답 대기 예산.
 *
 * 고정 타임아웃을 쓰면 설정이 허용하는 조합에서 반드시 깨진다.
 * (글자 지연 500ms x 80자 = 40초 > 고정값 32초)
 * background 가 먼저 타임아웃되면 콘텐츠 스크립트는 계속 타이핑 중인데
 * 항목이 실패로 기록되고 탭이 목록으로 이동해 작업이 버려진다.
 */

import { describe, expect, test } from 'vitest'
import { LIMITS, MAX_FILL_TIMEOUT_MS } from '../src/shared/constants.js'
import { mergeSettings } from '../src/shared/settings.js'
import { estimateTypingMs, fillFormTimeoutMs } from '../src/shared/timing.js'

const LEGACY_FIXED_TIMEOUT = LIMITS.DEFAULT_TIMEOUT_MS + LIMITS.TAB_LOAD_TIMEOUT_MS // 기존 32,000ms

describe('estimateTypingMs', () => {
  test('한 글자씩 입력이 꺼져 있으면 타이핑 시간이 없다', () => {
    const settings = mergeSettings({ humanTyping: false })

    expect(estimateTypingMs({ textLength: 500, settings })).toBe(0)
  })

  test('글자 수 x 지연 상한으로 최악의 경우를 잡는다', () => {
    const settings = mergeSettings({ humanTyping: true, delayMs: { typingChar: [10, 50] } })

    expect(estimateTypingMs({ textLength: 100, settings })).toBe(100 * 50)
  })

  test('본문이 비어 있으면 0 이다', () => {
    const settings = mergeSettings({ humanTyping: true })

    expect(estimateTypingMs({ textLength: 0, settings })).toBe(0)
  })

  test('글자 수가 숫자가 아니면 0 으로 본다', () => {
    const settings = mergeSettings({ humanTyping: true })

    expect(estimateTypingMs({ textLength: undefined, settings })).toBe(0)
  })
})

describe('fillFormTimeoutMs', () => {
  test('폼이 열리기를 기다리는 시간을 포함한다', () => {
    const settings = mergeSettings({ humanTyping: false })

    expect(fillFormTimeoutMs({ textLength: 0, settings })).toBeGreaterThanOrEqual(
      LIMITS.CONTENT_READY_TIMEOUT_MS,
    )
  })

  test('타이핑 시간을 포함한다', () => {
    const settings = mergeSettings({ humanTyping: true, delayMs: { typingChar: [10, 50] } })

    const short = fillFormTimeoutMs({ textLength: 20, settings })
    const long = fillFormTimeoutMs({ textLength: 200, settings })

    expect(long - short).toBe(180 * 50)
  })

  test('기본 설정에서는 타이핑이 예산의 일부일 뿐이고 총량도 과하지 않다', () => {
    // 기본값(25~70ms)으로 80자를 치는 데는 5.6초면 충분하다.
    // 예산 대부분은 폼이 열리기를 기다리는 고정 시간이어야 한다.
    const settings = mergeSettings({})

    const timeout = fillFormTimeoutMs({ textLength: 80, settings })
    const typing = estimateTypingMs({ textLength: 80, settings })

    expect(typing / timeout).toBeLessThan(0.25)
    expect(timeout).toBeLessThan(45_000)
  })

  test('설정이 허용하는 느린 타이핑에서는 기존 고정값을 넘는 예산을 준다', () => {
    // 옵션 화면이 허용하는 최대 지연(500ms) x 80자 = 40초 > 고정값 32초
    const settings = mergeSettings({ humanTyping: true, delayMs: { typingChar: [400, 500] } })

    const timeout = fillFormTimeoutMs({ textLength: 80, settings })

    expect(timeout).toBeGreaterThan(LEGACY_FIXED_TIMEOUT)
  })

  test('최소 글자 수를 크게 잡아도 예산이 따라 늘어난다', () => {
    const settings = mergeSettings({ humanTyping: true, minReviewLength: 1000 })

    const timeout = fillFormTimeoutMs({ textLength: 1000, settings })

    expect(timeout).toBeGreaterThan(LEGACY_FIXED_TIMEOUT)
  })

  test('설정을 아무리 늘려도 상한을 넘지 않는다', () => {
    const settings = mergeSettings({ humanTyping: true, delayMs: { typingChar: [500, 500] } })

    const timeout = fillFormTimeoutMs({ textLength: 100000, settings })

    expect(timeout).toBe(MAX_FILL_TIMEOUT_MS)
  })

  test('검증기가 허용하는 최악의 조합도 상한 안에 들어온다', () => {
    // 상한을 따로 두면 "검증기는 통과시키는데 타임아웃은 못 기다리는" 모순이 생긴다.
    // 그러면 background 가 타이핑 도중 항목을 실패 처리하고 폼 창을 닫아 버린다.
    const settings = mergeSettings({
      humanTyping: true,
      minReviewLength: LIMITS.MAX_REVIEW_LENGTH,
      delayMs: { typingChar: [LIMITS.MAX_TYPING_DELAY_MS, LIMITS.MAX_TYPING_DELAY_MS] },
    })

    const needed = fillFormTimeoutMs({ textLength: LIMITS.MAX_REVIEW_LENGTH, settings })
    const typing = estimateTypingMs({ textLength: LIMITS.MAX_REVIEW_LENGTH, settings })

    expect(needed).toBeGreaterThanOrEqual(typing)
    expect(needed).toBeLessThanOrEqual(MAX_FILL_TIMEOUT_MS)
  })

  test('반환값은 정수 밀리초다', () => {
    const settings = mergeSettings({})

    expect(Number.isInteger(fillFormTimeoutMs({ textLength: 77, settings }))).toBe(true)
  })
})
