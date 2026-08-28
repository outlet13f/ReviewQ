/**
 * 별점 위젯 조작. 네이버는 시점/페이지에 따라 구현이 달라서
 * 라디오 -> role=radio -> "N점" 라벨 -> 별 아이콘 순서로 전략을 시도한다.
 */

import { err, ok } from '../../shared/result.js'
import { FORM } from '../dom/selectors.js'
import {
  dropAncestors,
  findAllIncludingHidden,
  findByLabel,
  findClickableByText,
  isVisible,
  labelFor,
  textOf,
  visibleAll,
} from '../dom/finder.js'
import { humanClick } from '../dom/events.js'

const STAR_COUNT = 5

/**
 * 같은 소속끼리 묶고 5개짜리 그룹을 우선한다. 다른 평가 항목과 섞이는 것을 막는다.
 * keyOf 는 요소를 반환해도 된다(Map 키로 그대로 쓴다) — 실측 결과 네이버 radiogroup 에는
 * aria-label 이 없어서 문자열 키로 묶으면 전부 한 덩어리가 되어 버린다.
 */
const preferGroupOfFive = (elements, keyOf) => {
  const groups = new Map()
  for (const element of elements) {
    const key = keyOf(element) ?? '__none__'
    groups.set(key, [...(groups.get(key) ?? []), element])
  }
  const all = [...groups.values()]
  return all.find((group) => group.length === STAR_COUNT) ?? all[0] ?? []
}

/**
 * 그룹 안에서 점수에 해당하는 요소를 텍스트/라벨로 고른다.
 * 네이버는 별점을 5,4,3,2,1 **내림차순**으로 렌더하므로 위치로 고르면 정반대가 눌린다.
 * (5점을 요청했는데 1점이 등록된다)
 */
const pickByScore = (group, rating) => {
  const wanted = String(rating)
  return (
    group.find((item) => textOf(item) === wanted) ??
    group.find((item) => FORM.ratingLabelTemplate(rating).some((label) => (item.getAttribute('aria-label') ?? '').includes(label))) ??
    null
  )
}

const forceCheck = (radio) => {
  radio.checked = true
  for (const type of ['input', 'change']) {
    radio.dispatchEvent(new Event(type, { bubbles: true }))
  }
}

/** 자식이 정확히 5개인 별 아이콘 컨테이너를 찾는다. */
const findStarContainer = (root) => {
  for (const selector of FORM.ratingStarContainerSelectors) {
    for (const container of visibleAll(selector, root)) {
      if ([...container.children].filter(isVisible).length === STAR_COUNT) return container
    }
  }
  return null
}

/** 전략 1: 라디오 인풋. 커스텀 스타일로 숨겨진 경우가 많아 label 을 클릭한다. */
const byRadioInput = (root, rating) => {
  const radios = findAllIncludingHidden(FORM.ratingRadioSelectors, root)
  if (radios.length === 0) return null

  const group = preferGroupOfFive(radios, (radio) => radio.getAttribute('name'))
  if (group.length === 0) return null

  const byValue = group.find((radio) => Number.parseInt(radio.value, 10) === rating)
  const target = byValue ?? group[rating - 1]
  if (!target) return null

  humanClick(isVisible(target) ? target : (labelFor(target) ?? target))
  if (target.checked !== true) forceCheck(target)

  return { strategy: 'radio-input', verified: target.checked === true }
}

/** 전략 2: role=radio 위젯. */
const byRoleRadio = (root, rating) => {
  const items = dropAncestors(findAllIncludingHidden(FORM.ratingRoleSelectors, root))
  if (items.length === 0) return null

  // radiogroup 요소 자체를 키로 쓴다. aria-label 은 실제 페이지에서 비어 있다.
  const group = preferGroupOfFive(items, (item) => item.closest('[role="radiogroup"]'))

  // 점수 텍스트로 고르는 것이 우선. 위치는 순서를 알 수 없어 마지막 수단이다.
  const target = pickByScore(group, rating) ?? group[rating - 1]
  if (!target) return null

  humanClick(target)
  return {
    strategy: 'role-radio',
    verified: target.getAttribute('aria-checked') === 'true',
    matchedByScore: pickByScore(group, rating) !== null,
  }
}

/** 전략 3: aria-label/텍스트에 "N점" 이 있는 요소. */
const byRatingLabel = (root, rating) => {
  const needles = FORM.ratingLabelTemplate(rating)
  const target = findByLabel(needles, { root }) ?? findClickableByText(needles, { root })
  if (!target) return null

  humanClick(target)
  return { strategy: 'rating-label', verified: false }
}

/** 전략 4: 별 아이콘 묶음의 N번째 자식. 가장 마지막 수단. */
const byStarContainer = (root, rating) => {
  const container = findStarContainer(root)
  if (!container) return null

  const children = [...container.children].filter(isVisible)
  const target = pickByScore(children, rating) ?? children[rating - 1]
  if (!target) return null

  humanClick(target)
  return { strategy: 'star-container', verified: false }
}

/**
 * 별점 위젯이 있는지만 확인한다(클릭하지 않는다).
 * 폼 루트를 좁히는 데 쓰이므로 부작용이 없어야 한다.
 */
export const hasRatingWidget = (root = document) => {
  const scope = root ?? document
  if (findAllIncludingHidden(FORM.ratingRadioSelectors, scope).length > 0) return true
  if (findAllIncludingHidden(FORM.ratingRoleSelectors, scope).length > 0) return true
  if (findByLabel(FORM.ratingLabelTemplate(STAR_COUNT), { root: scope })) return true
  return findStarContainer(scope) !== null
}

const STRATEGIES = Object.freeze([byRadioInput, byRoleRadio, byRatingLabel, byStarContainer])

/**
 * 별점을 설정한다.
 * @param {Element} root 폼 루트
 * @param {number} rating 1~5
 */
export const setRating = (root, rating) => {
  const value = Number.parseInt(rating, 10)
  if (!Number.isFinite(value) || value < 1 || value > STAR_COUNT) {
    return err(`별점은 1~${STAR_COUNT} 사이여야 합니다. (받은 값: ${rating})`)
  }

  const attempted = []
  for (const strategy of STRATEGIES) {
    const outcome = strategy(root ?? document, value)
    if (!outcome) continue
    attempted.push(outcome.strategy)
    if (outcome.verified) return ok(Object.freeze({ ...outcome, rating: value, attempted }))
    // 검증은 못 했지만 클릭은 됐다 — 다음 전략까지 시도하지 않고 그대로 진행한다.
    return ok(Object.freeze({ ...outcome, rating: value, attempted }))
  }

  return err('별점 위젯을 찾지 못했습니다. 팝업 > 페이지 진단으로 구조를 확인해 주세요.')
}
