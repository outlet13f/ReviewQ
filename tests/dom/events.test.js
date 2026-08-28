// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { blurElement, focusElement, humanClick } from '../../src/content/dom/events.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('humanClick', () => {
  test('mousedown -> mouseup -> click 순서로 이벤트를 보낸다', () => {
    document.body.innerHTML = '<button id="b">등록</button>'
    const button = document.getElementById('b')
    const seen = []
    for (const type of ['mousedown', 'mouseup', 'click']) {
      button.addEventListener(type, () => seen.push(type))
    }

    humanClick(button)

    expect(seen).toEqual(['mousedown', 'mouseup', 'click'])
  })

  test('mousedown 에만 바인딩된 위젯도 반응한다', () => {
    document.body.innerHTML = '<span id="star">★</span>'
    const star = document.getElementById('star')
    const handler = vi.fn()
    star.addEventListener('mousedown', handler)

    humanClick(star)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('이벤트가 상위로 버블링된다', () => {
    document.body.innerHTML = '<div id="root"><button id="b">등록</button></div>'
    const handler = vi.fn()
    document.getElementById('root').addEventListener('click', handler)

    humanClick(document.getElementById('b'))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('요소가 없으면 false 를 반환한다', () => {
    expect(humanClick(null)).toBe(false)
  })
})

describe('focusElement', () => {
  test('포커스와 focusin 을 발생시킨다', () => {
    document.body.innerHTML = '<textarea id="t"></textarea>'
    const textarea = document.getElementById('t')
    const handler = vi.fn()
    textarea.addEventListener('focusin', handler)

    focusElement(textarea)

    expect(handler).toHaveBeenCalled()
    expect(document.activeElement).toBe(textarea)
  })

  test('요소가 없으면 false 다', () => {
    expect(focusElement(null)).toBe(false)
  })
})

describe('blurElement', () => {
  test('change 이벤트를 발생시킨다', () => {
    document.body.innerHTML = '<textarea id="t"></textarea>'
    const textarea = document.getElementById('t')
    const handler = vi.fn()
    textarea.addEventListener('change', handler)

    blurElement(textarea)

    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('요소가 없으면 false 다', () => {
    expect(blurElement(null)).toBe(false)
  })
})
