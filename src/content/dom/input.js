/**
 * React 제어 컴포넌트에 값을 넣는다.
 * element.value = x 는 React 내부 상태를 갱신하지 못하므로 네이티브 setter 를 호출한 뒤
 * input 이벤트를 직접 발생시켜야 한다.
 */

import { err, ok } from '../../shared/result.js'
import { blurElement, focusElement } from './events.js'
import { sleep } from '../../shared/async.js'

const nativeValueSetter = (element) => {
  const view = element.ownerDocument?.defaultView ?? globalThis
  const prototypes = [view.HTMLTextAreaElement?.prototype, view.HTMLInputElement?.prototype]
  for (const prototype of prototypes) {
    if (!prototype || !(element instanceof prototype.constructor)) continue
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
    if (descriptor?.set) return descriptor.set
  }
  return null
}

export const isContentEditable = (element) =>
  Boolean(element) && (element.isContentEditable === true || element.getAttribute?.('contenteditable') === 'true')

export const readValue = (element) => {
  if (!element) return ''
  if (isContentEditable(element)) return element.textContent ?? ''
  return element.value ?? ''
}

const emitInput = (element, data) => {
  const InputEventCtor = element.ownerDocument?.defaultView?.InputEvent ?? globalThis.InputEvent
  const event =
    typeof InputEventCtor === 'function'
      ? new InputEventCtor('input', { bubbles: true, composed: true, data, inputType: 'insertText' })
      : new Event('input', { bubbles: true })
  element.dispatchEvent(event)
}

/** 값 전체를 한 번에 설정한다. */
export const setControlledValue = (element, text) => {
  if (!element) return err('값을 넣을 요소가 없습니다.')

  focusElement(element)

  if (isContentEditable(element)) {
    element.textContent = ''
    const inserted = element.ownerDocument?.execCommand?.('insertText', false, text)
    if (!inserted) element.textContent = text
    emitInput(element, text)
    return ok(readValue(element))
  }

  const setter = nativeValueSetter(element)
  if (!setter) return err('입력 요소의 네이티브 setter 를 찾을 수 없습니다.')

  setter.call(element, '')
  emitInput(element, '')
  setter.call(element, text)
  emitInput(element, text)
  return ok(readValue(element))
}

/**
 * 한 글자씩 입력한다. 붙여넣기와 구분되는 입력 패턴을 만들고,
 * 글자 수 카운터가 keyup 에 반응하는 폼에서도 정상 동작한다.
 */
export const typeInto = async (element, text, options = {}) => {
  if (!element) return err('값을 넣을 요소가 없습니다.')
  const { delayFor = () => 40, onProgress } = options

  focusElement(element)

  const editable = isContentEditable(element)
  const setter = editable ? null : nativeValueSetter(element)
  if (!editable && !setter) return err('입력 요소의 네이티브 setter 를 찾을 수 없습니다.')

  if (editable) element.textContent = ''
  else setter.call(element, '')
  emitInput(element, '')

  const characters = [...text]
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]
    const partial = characters.slice(0, index + 1).join('')

    element.dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true }))
    if (editable) element.textContent = partial
    else setter.call(element, partial)
    emitInput(element, character)
    element.dispatchEvent(new KeyboardEvent('keyup', { key: character, bubbles: true }))

    onProgress?.(index + 1, characters.length)
    const delay = delayFor(index)
    if (delay > 0) await sleep(delay)
  }

  blurElement(element)

  const finalValue = readValue(element)
  if (finalValue.trim() === '') return err('입력 후에도 값이 비어 있습니다. 폼이 입력을 거부했을 수 있습니다.')
  return ok(finalValue)
}
