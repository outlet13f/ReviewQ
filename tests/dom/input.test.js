// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { isContentEditable, readValue, setControlledValue, typeInto } from '../../src/content/dom/input.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

const mountTextarea = () => {
  document.body.innerHTML = '<textarea id="t"></textarea>'
  return document.getElementById('t')
}

const mountEditable = () => {
  document.body.innerHTML = '<div id="e" contenteditable="true"></div>'
  return document.getElementById('e')
}

describe('isContentEditable / readValue', () => {
  test('contenteditable 을 알아본다', () => {
    expect(isContentEditable(mountEditable())).toBe(true)
    expect(isContentEditable(mountTextarea())).toBe(false)
  })

  test('textarea 는 value, contenteditable 은 textContent 를 읽는다', () => {
    const textarea = mountTextarea()
    textarea.value = '리뷰'
    const editable = mountEditable()
    editable.textContent = '후기'

    expect(readValue(textarea)).toBe('리뷰')
    expect(readValue(editable)).toBe('후기')
  })

  test('요소가 없으면 빈 문자열이다', () => {
    expect(readValue(null)).toBe('')
  })
})

describe('setControlledValue', () => {
  test('값을 넣고 input 이벤트를 발생시킨다', () => {
    const textarea = mountTextarea()
    const handler = vi.fn()
    textarea.addEventListener('input', handler)

    const result = setControlledValue(textarea, '배송이 빨랐어요.')

    expect(result.ok).toBe(true)
    expect(textarea.value).toBe('배송이 빨랐어요.')
    expect(handler).toHaveBeenCalled()
  })

  test('인스턴스에 덮어씌운 value setter 를 우회한다 (React 제어 컴포넌트 대응)', () => {
    const textarea = mountTextarea()
    const instanceSetter = vi.fn()
    Object.defineProperty(textarea, 'value', {
      configurable: true,
      get: () => '',
      set: instanceSetter,
    })

    setControlledValue(textarea, '우회 확인')

    // 프로토타입의 네이티브 setter 를 직접 호출하므로 인스턴스 setter 는 불리지 않는다.
    expect(instanceSetter).not.toHaveBeenCalled()
  })

  test('기존 값을 지운 뒤 새 값을 넣는다', () => {
    const textarea = mountTextarea()
    textarea.value = '이전 내용'

    setControlledValue(textarea, '새 내용')

    expect(textarea.value).toBe('새 내용')
  })

  test('contenteditable 에도 값을 넣는다', () => {
    const editable = mountEditable()

    const result = setControlledValue(editable, '후기 본문')

    expect(result.ok).toBe(true)
    expect(editable.textContent).toBe('후기 본문')
  })

  test('요소가 없으면 실패한다', () => {
    expect(setControlledValue(null, 'x').ok).toBe(false)
  })

  test('입력 요소가 아니면 실패한다', () => {
    document.body.innerHTML = '<div id="d"></div>'

    const result = setControlledValue(document.getElementById('d'), 'x')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('setter')
  })
})

describe('typeInto', () => {
  test('한 글자씩 입력해 최종 값을 만든다', async () => {
    const textarea = mountTextarea()

    const result = await typeInto(textarea, '좋아요', { delayFor: () => 0 })

    expect(result.ok).toBe(true)
    expect(textarea.value).toBe('좋아요')
  })

  test('글자마다 input 이벤트를 발생시킨다', async () => {
    const textarea = mountTextarea()
    const handler = vi.fn()
    textarea.addEventListener('input', handler)

    await typeInto(textarea, '좋아요', { delayFor: () => 0 })

    // 초기화 1회 + 글자 3회
    expect(handler).toHaveBeenCalledTimes(4)
  })

  test('keydown / keyup 도 함께 보낸다', async () => {
    const textarea = mountTextarea()
    const keydown = vi.fn()
    const keyup = vi.fn()
    textarea.addEventListener('keydown', keydown)
    textarea.addEventListener('keyup', keyup)

    await typeInto(textarea, 'ab', { delayFor: () => 0 })

    expect(keydown).toHaveBeenCalledTimes(2)
    expect(keyup).toHaveBeenCalledTimes(2)
  })

  test('글자별 지연 시간을 요청한다', async () => {
    const textarea = mountTextarea()
    const delayFor = vi.fn(() => 0)

    await typeInto(textarea, '가나다', { delayFor })

    expect(delayFor).toHaveBeenCalledTimes(3)
  })

  test('진행률 콜백을 호출한다', async () => {
    const textarea = mountTextarea()
    const onProgress = vi.fn()

    await typeInto(textarea, '가나', { delayFor: () => 0, onProgress })

    expect(onProgress).toHaveBeenLastCalledWith(2, 2)
  })

  test('서로게이트 페어(이모지)를 한 글자로 다룬다', async () => {
    const textarea = mountTextarea()

    await typeInto(textarea, '좋아요👍', { delayFor: () => 0 })

    expect(textarea.value).toBe('좋아요👍')
  })

  test('contenteditable 에도 한 글자씩 입력한다', async () => {
    const editable = mountEditable()

    const result = await typeInto(editable, '후기', { delayFor: () => 0 })

    expect(result.ok).toBe(true)
    expect(editable.textContent).toBe('후기')
  })

  test('요소가 없으면 실패한다', async () => {
    const result = await typeInto(null, 'x')

    expect(result.ok).toBe(false)
  })

  test('입력 요소가 아니면 실패한다', async () => {
    document.body.innerHTML = '<div id="d"></div>'

    const result = await typeInto(document.getElementById('d'), 'x', { delayFor: () => 0 })

    expect(result.ok).toBe(false)
  })
})
