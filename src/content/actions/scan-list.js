/** 리뷰 작성 목록에서 아직 안 쓴 항목을 훑고, 지정한 항목의 작성 폼을 연다. */

import { err, ok } from '../../shared/result.js'
import { LIST } from '../dom/selectors.js'
import { closestListItem, findAllClickableByText, findFirstVisible, textOf } from '../dom/finder.js'
import { humanClick } from '../dom/events.js'

const MAX_NAME_LENGTH = 120

const firstText = (container, selectors) => {
  if (!container) return ''
  const found = findFirstVisible(selectors, container)
  return found ? textOf(found).slice(0, MAX_NAME_LENGTH) : ''
}

const HASH_SEED = 5381
const HASH_SHIFT = 5

/** 항목 텍스트를 짧은 안정 키로 압축한다. */
const hashText = (text) => {
  let hash = HASH_SEED
  for (const character of text) {
    hash = ((hash << HASH_SHIFT) + hash + character.codePointAt(0)) >>> 0
  }
  return hash.toString(36)
}

const SIGNATURE_LENGTH = 200

/**
 * 항목을 구별하는 텍스트. 트리거 버튼 라벨("리뷰 쓰기")은 모든 행에서 같으므로 반드시 제외한다.
 * 제외하지 않으면 상품명 없는 행들이 전부 같은 키를 갖게 된다.
 */
const containerSignature = (container, trigger) => {
  const full = textOf(container)
  const label = textOf(trigger)
  const remainder = label === '' ? full : full.replace(label, '')
  return remainder.trim().slice(0, SIGNATURE_LENGTH)
}

/**
 * 항목 식별 키.
 * index 만 쓰면 리뷰를 쓸 때마다 목록이 줄어들어 "index:0" 이 계속 재사용되고,
 * 이미 처리한 키로 오인되어 두 번째 항목부터 건너뛰게 된다.
 * 그래서 상품명 -> 항목 텍스트 해시 -> index 순으로 폴백한다.
 */
const keyFor = (productName, container, trigger, index) => {
  const name = productName.trim()
  if (name !== '') return `name:${name}`

  const signature = containerSignature(container, trigger)
  if (signature !== '') return `text:${hashText(signature)}`
  return `index:${index}`
}

/** 페이지에 항목 컨테이너가 존재하는지. 존재하면 그 안의 트리거만 인정한다. */
const hasItemContainers = () =>
  LIST.itemContainerSelectors.some((selector) => document.querySelector(selector) !== null)

/**
 * 지금 보고 있는 페이지로 이동하는 링크인지.
 * 헤더 제목과 좌측 메뉴의 "리뷰 작성" 이 여기 해당한다. 누르면 새로고침만 될 뿐
 * 리뷰 폼은 열리지 않으므로 작성 버튼일 수 없다.
 */
const isSelfLink = (element) => {
  const href = element.getAttribute?.('href')
  if (!href) return false
  try {
    return new URL(href, location.href).pathname === location.pathname
  } catch {
    return false
  }
}

/**
 * 작성 가능한 항목의 트리거 버튼들. 목록은 리뷰를 쓸 때마다 바뀌므로 매번 새로 훑는다.
 *
 * 헤더와 좌측 메뉴에도 "리뷰 작성" 링크가 있어서, 항목 컨테이너 안에 있는 것만 남긴다.
 * 컨테이너를 하나도 못 찾는 페이지에서는(구조 변경 등) 제한 없이 모두 인정한다.
 */
const collectTriggers = () => {
  const candidates = findAllClickableByText(LIST.writeTriggerTexts, {
    exclude: LIST.alreadyWrittenTexts,
  }).filter((trigger) => !isSelfLink(trigger))

  if (!hasItemContainers()) return candidates

  return candidates.filter((trigger) =>
    LIST.itemContainerSelectors.some((selector) => trigger.closest(selector) !== null),
  )
}

/** 트리거에서 항목 정보를 역추적한다. */
const describeItems = (triggers) =>
  triggers.map((trigger, index) => {
    const container = closestListItem(trigger, LIST.itemContainerSelectors)
    const productName = firstText(container, LIST.productNameSelectors)
    const triggerText = textOf(trigger)
    return Object.freeze({
      index,
      key: keyFor(productName, container, trigger, index),
      productName,
      storeName: firstText(container, LIST.storeNameSelectors),
      triggerText,
      /** 한달사용기는 폼 구조가 일반 리뷰와 다를 수 있다. */
      isMonthlyReview: LIST.monthlyReviewTexts.some((needle) => triggerText.includes(needle)),
    })
  })

/** 작성 가능한 리뷰 목록을 훑는다. */
export const scanReviewList = () => {
  const triggers = collectTriggers()
  if (triggers.length === 0) {
    return err('작성 가능한 리뷰를 찾지 못했습니다. 리뷰 목록 페이지가 맞는지, 로그인 상태인지 확인해 주세요.')
  }

  const items = describeItems(triggers)
  return ok(Object.freeze({ items: Object.freeze(items), total: items.length }))
}

/**
 * 항목의 작성 폼을 연다. 목록은 리뷰를 쓸 때마다 바뀌므로 매번 다시 훑고
 * key 로 먼저 찾은 뒤 없으면 index 로 폴백한다.
 */
export const openReviewForm = ({ key, index = 0 }) => {
  const triggers = collectTriggers()
  if (triggers.length === 0) return err('열 수 있는 리뷰 작성 버튼이 없습니다.')

  const items = describeItems(triggers)
  const matchedByKey = key ? items.findIndex((item) => item.key === key) : -1
  const position = matchedByKey >= 0 ? matchedByKey : index

  const trigger = triggers[position]
  if (!trigger) return err(`목록에서 ${position + 1}번째 항목을 찾지 못했습니다.`)

  humanClick(trigger)
  return ok(Object.freeze({ opened: true, item: items[position], remaining: triggers.length }))
}

/** 목록 "더보기" 를 눌러 항목을 더 불러온다. */
export const loadMoreItems = () => {
  const [button] = findAllClickableByText(LIST.loadMoreTexts, {})
  if (!button) return ok(Object.freeze({ loaded: false }))
  humanClick(button)
  return ok(Object.freeze({ loaded: true }))
}
