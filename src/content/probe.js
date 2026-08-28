/**
 * 페이지 진단 모드.
 * 셀렉터가 안 맞을 때 실제 DOM 구조를 뽑아 selectors.js 를 고칠 근거를 만든다.
 * 개인정보가 섞일 수 있으니 텍스트는 짧게 자르고, 값(value)은 담지 않는다.
 */

import { LIST, PROBE_SELECTORS } from './dom/selectors.js'
import { findAllClickableByText, isVisible, visibleAll } from './dom/finder.js'
import { findFormRoot } from './actions/form.js'
import { findTextInput } from './actions/fill-text.js'
import { findSubmitButton } from './actions/submit.js'

const TEXT_LIMIT = 40
const PER_SELECTOR_LIMIT = 12
const INTERESTING_ATTRIBUTES = Object.freeze([
  'id',
  'name',
  'type',
  'role',
  'aria-label',
  'aria-checked',
  'placeholder',
  'maxlength',
  'contenteditable',
  'disabled',
])

/** 요소를 사람이 읽을 수 있는 짧은 경로로 표현한다. */
const pathOf = (element) => {
  const parts = []
  let node = element
  while (node && node.nodeType === 1 && parts.length < 4) {
    const tag = node.tagName.toLowerCase()
    const id = node.getAttribute('id')
    parts.unshift(id ? `${tag}#${id}` : tag)
    node = node.parentElement
  }
  return parts.join(' > ')
}

/**
 * 입력 필드는 사용자가 쓴 내용이나 서버가 미리 채운 초안을 담고 있을 수 있다.
 * 진단 결과는 사람이 복사해 공유하는 용도이므로 내용은 담지 않고 길이만 남긴다.
 */
const CONTENT_BEARING_TAGS = new Set(['TEXTAREA', 'INPUT'])

const holdsUserContent = (element) =>
  CONTENT_BEARING_TAGS.has(element.tagName) ||
  element.isContentEditable === true ||
  element.getAttribute?.('contenteditable') === 'true'

const TEXT_NODE = 3
const ELEMENT_NODE = 1

/**
 * 하위 입력 필드의 내용을 건너뛰고 텍스트를 모은다.
 * 필드 자체를 가리는 것만으로는 부족하다 — 상위 컨테이너의 textContent 로 그대로 새기 때문.
 */
const safeText = (element) => {
  if (holdsUserContent(element)) return ''

  let collected = ''
  for (const child of element.childNodes) {
    if (collected.length >= TEXT_LIMIT) break
    if (child.nodeType === TEXT_NODE) collected += child.nodeValue ?? ''
    else if (child.nodeType === ELEMENT_NODE && !holdsUserContent(child)) collected += safeText(child)
  }
  return collected.replace(/\s+/gu, ' ').trim()
}

const contentLengthOf = (element) => {
  const value = typeof element.value === 'string' ? element.value : null
  return (value ?? element.textContent ?? '').length
}

const describe = (element) => {
  const attributes = {}
  for (const name of INTERESTING_ATTRIBUTES) {
    const value = element.getAttribute?.(name)
    if (value !== null && value !== undefined) attributes[name] = String(value).slice(0, TEXT_LIMIT)
  }

  const sensitive = holdsUserContent(element)
  return Object.freeze({
    tag: element.tagName.toLowerCase(),
    text: safeText(element).slice(0, TEXT_LIMIT),
    /** 내용을 가려도 폼이 채워졌는지 판단할 수 있도록 길이만 남긴다. */
    contentLength: sensitive ? contentLengthOf(element) : undefined,
    visible: isVisible(element),
    className: typeof element.className === 'string' ? element.className.slice(0, TEXT_LIMIT) : '',
    attributes,
    path: pathOf(element),
  })
}

/** 확장이 지금 무엇을 고를지 그대로 보여준다 — 셀렉터 문제를 바로 진단할 수 있다. */
const resolvedTargets = () => {
  const formRoot = findFormRoot()
  const textInput = findTextInput(formRoot ?? document)
  const submitButton = findSubmitButton(formRoot ?? document)
  const writeTriggers = findAllClickableByText(LIST.writeTriggerTexts, { exclude: LIST.alreadyWrittenTexts })

  return Object.freeze({
    formRoot: formRoot ? describe(formRoot) : null,
    textInput: textInput ? describe(textInput) : null,
    submitButton: submitButton ? describe(submitButton) : null,
    writeTriggerCount: writeTriggers.length,
    writeTriggers: Object.freeze(writeTriggers.slice(0, PER_SELECTOR_LIMIT).map(describe)),
  })
}

export const probePage = () => {
  const bySelector = {}
  for (const selector of PROBE_SELECTORS) {
    // 진단은 1회성이므로 shadow DOM 까지 훑는다.
    const all = visibleAll(selector, document, { pierceShadow: true })
    bySelector[selector] = Object.freeze({
      count: all.length,
      samples: Object.freeze(all.slice(0, PER_SELECTOR_LIMIT).map(describe)),
    })
  }

  return Object.freeze({
    url: location.href.split('?')[0],
    title: document.title.slice(0, 80),
    resolved: resolvedTargets(),
    bySelector: Object.freeze(bySelector),
  })
}
