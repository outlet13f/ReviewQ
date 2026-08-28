/**
 * 리뷰 작성 폼 URL 판별과 파싱.
 *
 * 실측(2026-08-27): 목록의 "리뷰쓰기" 를 누르면 **별도 팝업 창**이 열린다.
 *   https://shopping.naver.com/popup/reviews/form
 *     ?orderNo=...&productOrderNos=...&returnUrl=...action%3DREVIEW_REGISTERED...
 *
 * 이 URL 이 두 가지 문제를 해결해 준다.
 *  - productOrderNos: 목록 DOM 에 없던 **항목 고유 식별자**
 *  - action=REVIEW_REGISTERED: 페이지 텍스트를 뒤지는 것보다 확실한 **등록 성공 신호**
 */

import { isNaverUrl } from './naver-url.js'

const FORM_PATH = '/popup/reviews/form'
const REDIRECT_PATH = '/popup/reviews/redirect'
const REGISTERED_ACTION = 'REVIEW_REGISTERED'

const EMPTY = Object.freeze({ orderNo: null, productOrderNos: null, key: null })

/** 네이버 도메인이면서 파싱 가능한 URL 만 통과시킨다. */
const parseNaverUrl = (value) => {
  if (!isNaverUrl(value)) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export const isReviewFormUrl = (value) => parseNaverUrl(value)?.pathname === FORM_PATH

/**
 * 등록 완료 리다이렉트인지.
 * 폼 URL 의 returnUrl 파라미터 안에도 REVIEW_REGISTERED 문자열이 들어 있으므로
 * 단순 문자열 검사가 아니라 **경로와 action 파라미터**를 함께 본다.
 */
export const isReviewRegisteredUrl = (value) => {
  const url = parseNaverUrl(value)
  if (!url || url.pathname !== REDIRECT_PATH) return false
  return url.searchParams.get('action') === REGISTERED_ACTION
}

/**
 * 폼 URL 에서 주문 식별자를 뽑는다.
 * @returns {{orderNo: string|null, productOrderNos: string|null, key: string|null}}
 */
export const parseReviewFormUrl = (value) => {
  const url = parseNaverUrl(value)
  if (!url || url.pathname !== FORM_PATH) return EMPTY

  const productOrderNos = url.searchParams.get('productOrderNos')
  const orderNo = url.searchParams.get('orderNo')

  const key = productOrderNos ? `productOrder:${productOrderNos}` : orderNo ? `order:${orderNo}` : null

  return Object.freeze({ orderNo, productOrderNos, key })
}
