/**
 * 네이버 페이지는 클래스명이 난독화되어 자주 바뀐다.
 * 그래서 클래스 대신 텍스트 / role / 속성 기반으로 요소를 찾는다.
 */

const CLICKABLE_SELECTOR = 'button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'

/**
 * 레이아웃 정보를 제공하는 환경인지(jsdom 등에서는 크기 검사를 건너뛴다).
 * isVisible 이 요소마다 호출하므로 결과를 캐시한다 — 캐시하지 않으면 요소 수만큼
 * 강제 레이아웃이 발생한다. 이 값은 문서 수명 동안 바뀌지 않는다.
 */
let layoutSupport = null

/**
 * 양성(레이아웃 있음)일 때만 캐시한다.
 *
 * false 를 캐시하면 위험하다. 콘텐츠 스크립트가 폼 팝업 창에 주입되는 시점에는
 * body 가 아직 0x0 으로 측정될 수 있는데, 그때 false 로 굳으면 그 창이 살아 있는 동안
 * 크기 0인 요소가 전부 "보임" 으로 통과해 화면 밖 컨트롤을 채우고 클릭하게 된다.
 */
const hasLayout = () => {
  if (layoutSupport === true) return true
  if (typeof document === 'undefined' || !document.body) return false

  const rect = document.body.getBoundingClientRect()
  if (rect.width > 0 || rect.height > 0) {
    layoutSupport = true
    return true
  }
  return false
}

export const isVisible = (element) => {
  if (!element || element.nodeType !== 1) return false
  if (element.hasAttribute('hidden')) return false
  if (element.getAttribute('aria-hidden') === 'true') return false

  const view = element.ownerDocument?.defaultView
  if (view) {
    const style = view.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
  }
  if (hasLayout()) {
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return false
  }
  return true
}

/**
 * 요소를 검색한다.
 *
 * pierceShadow 는 기본값이 false 다. shadow root 를 찾으려면 querySelectorAll('*') 로
 * 트리 전체를 매번 배열화해야 하는데, 폼 탐색은 이 함수를 한 번에 수십 번 호출하고
 * waitForForm 이 그것을 200ms 마다 반복하므로 비용이 감당되지 않는다.
 * 네이버 리뷰 페이지가 shadow DOM 을 쓴다는 근거도 없다.
 * 진단(probe)처럼 1회성으로 넓게 훑어야 할 때만 켠다.
 */
export const deepQueryAll = (selector, root = document, options = {}) => {
  const { pierceShadow = false } = options
  if (!pierceShadow) return [...(root?.querySelectorAll?.(selector) ?? [])]

  const found = []
  const visit = (node) => {
    if (!node?.querySelectorAll) return
    found.push(...node.querySelectorAll(selector))
    for (const child of node.querySelectorAll('*')) {
      if (child.shadowRoot) visit(child.shadowRoot)
    }
  }
  visit(root)
  return found
}

export const visibleAll = (selector, root = document, options = {}) =>
  deepQueryAll(selector, root, options).filter(isVisible)

/** 셀렉터 후보를 순서대로 시도해 처음 보이는 요소를 반환한다. */
export const findFirstVisible = (selectors, root = document) => {
  for (const selector of selectors) {
    const [match] = visibleAll(selector, root)
    if (match) return match
  }
  return null
}

export const textOf = (element) => {
  if (!element) return ''
  const raw = element.innerText ?? element.textContent ?? ''
  return raw.replace(/\s+/gu, ' ').trim()
}

const matchesText = (element, needles, exact) => {
  const text = textOf(element)
  if (text === '') return false
  return needles.some((needle) => (exact ? text === needle : text.includes(needle)))
}

/**
 * 텍스트로 요소를 찾는다. 가장 안쪽(자식이 더 적은) 요소를 우선한다 —
 * 상위 컨테이너가 같은 텍스트를 포함해 잘못 잡히는 것을 막는다.
 */
export const findByText = (needles, options = {}) => {
  const { root = document, selector = '*', exact = false } = options
  const candidates = visibleAll(selector, root).filter((element) => matchesText(element, needles, exact))
  if (candidates.length === 0) return null
  return candidates.reduce((best, current) =>
    textOf(current).length <= textOf(best).length ? current : best,
  )
}

/** 텍스트가 일치하는 클릭 가능한 요소를 찾는다. */
export const findClickableByText = (needles, options = {}) => {
  const { root = document, exact = false } = options
  const direct = findByText(needles, { root, selector: CLICKABLE_SELECTOR, exact })
  if (direct) return direct

  // 클릭 대상이 span 등으로 감싸인 경우 가장 가까운 클릭 가능 조상을 쓴다.
  const labelled = findByText(needles, { root, exact })
  return labelled ? (labelled.closest(CLICKABLE_SELECTOR) ?? labelled) : null
}

/**
 * 속성 셀렉터의 인용된 값에 넣기 위한 이스케이프.
 * CSS.escape 는 식별자용이라 공백까지 이스케이프해 "별점 5" 같은 값이 매칭되지 않는다.
 * 인용 문자열 안에서는 백슬래시와 따옴표만 처리하면 된다.
 */
const quoteAttributeValue = (value) => String(value).replace(/[\\"]/gu, (match) => `\\${match}`)

/** aria-label / title / alt 속성으로 찾는다. 아이콘 버튼용. */
export const findByLabel = (needles, options = {}) => {
  const { root = document } = options
  const attributes = ['aria-label', 'title', 'alt', 'data-label']
  for (const attribute of attributes) {
    for (const needle of needles) {
      const selector = `[${attribute}*="${quoteAttributeValue(needle)}"]`
      const [match] = visibleAll(selector, root)
      if (match) return match
    }
  }
  return null
}

const DEFAULT_ITEM_CONTAINERS = Object.freeze(['li', 'tr', 'article', '[role="listitem"]'])

/**
 * 요소가 속한 카드/행 컨테이너를 찾는다.
 * 네이버는 목록에 li/tr 이 아니라 div 를 쓰므로 후보를 주입할 수 있어야 한다.
 * 후보를 못 찾으면 부모로 폴백하지만, 그 경우 상품명 등을 못 뽑을 수 있다.
 */
export const closestListItem = (element, selectors = DEFAULT_ITEM_CONTAINERS) => {
  if (!element) return null
  for (const selector of selectors) {
    const found = element.closest(selector)
    if (found) return found
  }
  return element.parentElement
}

/** 중첩 매칭 시 가장 안쪽 요소만 남긴다. */
export const dropAncestors = (elements) =>
  elements.filter((element) => !elements.some((other) => other !== element && element.contains(other)))

/** 텍스트가 일치하는 클릭 가능 요소를 문서 순서대로 모두 반환한다. */
export const findAllClickableByText = (needles, options = {}) => {
  const { root = document, exclude = [] } = options
  const matched = visibleAll(CLICKABLE_SELECTOR, root).filter((element) => {
    const text = textOf(element)
    if (text === '') return false
    if (exclude.some((word) => text.includes(word))) return false
    return needles.some((needle) => text.includes(needle))
  })
  return dropAncestors(matched)
}

/** 보이지 않는 요소까지 포함해 모두 찾는다. 커스텀 스타일로 숨긴 radio 등에 필요하다. */
export const findAllIncludingHidden = (selectors, root = document) => {
  const found = selectors.flatMap((selector) => deepQueryAll(selector, root))
  return [...new Set(found)]
}

/** 숨겨진 input 을 대신 클릭할 label 을 찾는다. */
export const labelFor = (input) => {
  if (!input) return null
  const wrapping = input.closest('label')
  if (wrapping) return wrapping
  const id = input.getAttribute('id')
  if (!id) return null
  const doc = input.ownerDocument ?? document
  return doc.querySelector(`label[for="${quoteAttributeValue(id)}"]`)
}

export const isDisabled = (element) =>
  Boolean(element) &&
  (element.disabled === true ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.hasAttribute('disabled'))
