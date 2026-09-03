// @vitest-environment jsdom
/**
 * 레이아웃 지원 여부 캐시.
 *
 * 모듈 수준 캐시를 다루므로 **별도 파일**로 둔다(vitest 는 파일 단위로 모듈을 격리한다).
 * 같은 파일에서 캐시를 채우면 뒤따르는 다른 테스트의 isVisible 판정까지 바뀐다.
 *
 * 테스트 순서가 중요하다: "레이아웃 없음" 을 먼저 확인해야 한다.
 */

import { describe, expect, test, vi } from 'vitest'
import { isVisible } from '../../src/content/dom/finder.js'

const mockBodyRect = (width, height) =>
  vi
    .spyOn(document.body, 'getBoundingClientRect')
    .mockReturnValue({ width, height, top: 0, left: 0, right: width, bottom: height })

describe('hasLayout 캐시', () => {
  test('레이아웃이 아직 없으면 캐시하지 않고 매번 다시 확인한다', () => {
    // 폼 팝업 창에 주입된 직후에는 body 가 0x0 일 수 있다. 여기서 false 를 캐시하면
    // 그 창이 사는 동안 크기 0인 요소가 전부 "보임" 으로 통과해
    // 화면 밖 컨트롤을 채우고 클릭하게 된다.
    document.body.innerHTML = '<span id="a">1</span>'
    const spy = mockBodyRect(0, 0)

    isVisible(document.getElementById('a'))
    isVisible(document.getElementById('a'))

    const calls = spy.mock.calls.length
    spy.mockRestore()

    expect(calls).toBeGreaterThan(1)
  })

  test('레이아웃이 확인되면 그 뒤로는 측정을 반복하지 않는다', () => {
    // 요소마다 body 를 측정하면 요소 수만큼 강제 레이아웃이 발생한다.
    document.body.innerHTML = '<span id="a">1</span><span id="b">2</span><span id="c">3</span>'
    const spy = mockBodyRect(1024, 768)

    for (const id of ['a', 'b', 'c']) isVisible(document.getElementById(id))

    const calls = spy.mock.calls.length
    spy.mockRestore()

    expect(calls).toBeLessThanOrEqual(1)
  })
})
