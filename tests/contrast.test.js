/**
 * WCAG 2.1 AA 색상 대비 회귀 테스트.
 * 브라우저 axe 감사는 CI 에서 재현하기 어려우므로, CSS 값에서 직접 계산해 고정한다.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { contrastRatio, parseHex, readCssVariable, relativeLuminance } from './helpers/contrast.js'

const CSS = readFileSync(new URL('../src/ui/common.css', import.meta.url), 'utf8')

/** 본문 크기 텍스트(18.66px bold 미만)에 요구되는 AA 대비. */
const AA_NORMAL_TEXT = 4.5
const WHITE = '#ffffff'

const variable = (name) => readCssVariable(CSS, name)

describe('대비 계산 유틸', () => {
  test('알려진 값을 정확히 계산한다', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  test('순서가 바뀌어도 같은 값이다', () => {
    expect(contrastRatio('#03c75a', WHITE)).toBeCloseTo(contrastRatio(WHITE, '#03c75a'), 10)
  })

  test('상대 명도는 검정 0, 흰색 1 이다', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
  })

  test('16진수 색상을 분해한다', () => {
    expect(parseHex('#03c75a')).toEqual({ red: 3, green: 199, blue: 90 })
  })

  test('형식이 잘못되면 실패한다', () => {
    expect(() => parseHex('rgb(0,0,0)')).toThrow('16진수')
  })

  test('CSS 변수를 읽는다', () => {
    expect(readCssVariable(':root { --accent: #123456; }', 'accent')).toBe('#123456')
  })

  test('없는 CSS 변수는 실패한다', () => {
    expect(() => readCssVariable(':root {}', 'nope')).toThrow('찾을 수 없습니다')
  })
})

describe('WCAG AA 대비 — 브랜드 색상', () => {
  /** button.primary — 흰 글자를 얹는 배경. 실행/저장 버튼. */
  test('기본 버튼 배경은 흰 글자와 AA 대비를 만족한다', () => {
    const ratio = contrastRatio(variable('accent'), WHITE)

    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })

  /** button.primary:hover — 호버 상태도 같은 기준을 지켜야 한다. */
  test('기본 버튼 호버 배경도 흰 글자와 AA 대비를 만족한다', () => {
    const ratio = contrastRatio(variable('accent-dark'), WHITE)

    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })

  /** .status.SUBMITTED — 흰 배경 위 11px bold 텍스트라 large-text 예외가 적용되지 않는다. */
  test('SUBMITTED 상태 텍스트는 흰 배경과 AA 대비를 만족한다', () => {
    const ratio = contrastRatio(variable('accent-dark'), WHITE)

    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })

  test('호버 색은 기본 색보다 어둡다', () => {
    expect(relativeLuminance(variable('accent-dark'))).toBeLessThan(relativeLuminance(variable('accent')))
  })
})

describe('WCAG AA 대비 — 상태 색상', () => {
  const onWhite = [
    ['danger', '.status.FAILED / 오류 메시지'],
    ['warn', '.status.DRY_RUN / 드라이런 배지'],
    ['muted', '.hint 보조 설명'],
    ['fg', '본문 텍스트'],
  ]

  test.each(onWhite)('--%s 는 흰 배경과 AA 대비를 만족한다 (%s)', (name) => {
    const ratio = contrastRatio(variable(name), WHITE)

    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })
})
