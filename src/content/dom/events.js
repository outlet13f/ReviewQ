/**
 * React 합성 이벤트를 확실히 깨우기 위한 이벤트 디스패치 헬퍼.
 * element.click() 만으로는 mousedown 계열에 바인딩된 별점 위젯이 반응하지 않는다.
 */

const makeEvent = (type, init) => {
  const base = { bubbles: true, cancelable: true, composed: true, ...init }
  if (typeof PointerEvent === 'function' && type.startsWith('pointer')) return new PointerEvent(type, base)
  if (typeof MouseEvent === 'function') return new MouseEvent(type, base)
  return new Event(type, base)
}

const POINTER_SEQUENCE = Object.freeze([
  'pointerover',
  'pointerenter',
  'mouseover',
  'pointermove',
  'mousemove',
  'pointerdown',
  'mousedown',
  'pointerup',
  'mouseup',
  'click',
])

/** 사람이 마우스로 누르는 것과 같은 순서로 이벤트를 보낸다. */
export const humanClick = (element) => {
  if (!element) return false
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'center', inline: 'center' })
  }
  if (typeof element.focus === 'function') element.focus({ preventScroll: true })

  for (const type of POINTER_SEQUENCE) {
    element.dispatchEvent(makeEvent(type, { button: 0, buttons: type.includes('down') ? 1 : 0 }))
  }
  return true
}

/** 포커스만 React 가 알아채도록 준다. */
export const focusElement = (element) => {
  if (!element) return false
  element.dispatchEvent(makeEvent('pointerdown', { button: 0, buttons: 1 }))
  element.dispatchEvent(makeEvent('mousedown', { button: 0, buttons: 1 }))
  if (typeof element.focus === 'function') element.focus({ preventScroll: true })
  element.dispatchEvent(new Event('focus', { bubbles: false }))
  element.dispatchEvent(new Event('focusin', { bubbles: true }))
  return true
}

export const blurElement = (element) => {
  if (!element) return false
  element.dispatchEvent(new Event('change', { bubbles: true }))
  if (typeof element.blur === 'function') element.blur()
  element.dispatchEvent(new Event('focusout', { bubbles: true }))
  element.dispatchEvent(new Event('blur', { bubbles: false }))
  return true
}
