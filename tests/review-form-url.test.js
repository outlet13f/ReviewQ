/**
 * 리뷰 작성 폼 URL 판별과 파싱.
 *
 * 실측(2026-08-27): 목록의 "리뷰쓰기" 를 누르면 별도 팝업 창이 열린다.
 * (아래 주문번호는 형식만 같은 합성값이다. 실제 주문번호를 저장소에 남기지 않는다.)
 *   https://shopping.naver.com/popup/reviews/form
 *     ?orderNo=1111111111111111
 *     &productOrderNos=2222222222222222
 *     &returnUrl=https%3A%2F%2Fshopping.naver.com%2Fpopup%2Freviews%2Fredirect
 *                %3Faction%3DREVIEW_REGISTERED%26productOrderId%3D2222222222222222
 *
 * 이 URL 은 두 가지를 준다.
 *  - productOrderNos: 목록 DOM 에는 없는 **항목 고유 식별자**
 *  - action=REVIEW_REGISTERED: 텍스트 매칭보다 확실한 **등록 성공 신호**
 */

import { describe, expect, test } from 'vitest'
import {
  isReviewFormUrl,
  isReviewRegisteredUrl,
  parseReviewFormUrl,
} from '../src/shared/review-form-url.js'

const FORM_URL =
  'https://shopping.naver.com/popup/reviews/form?orderNo=1111111111111111&productOrderNos=2222222222222222&returnUrl=https%3A%2F%2Fshopping.naver.com%2Fpopup%2Freviews%2Fredirect%3Faction%3DREVIEW_REGISTERED%26productOrderId%3D2222222222222222'
const REGISTERED_URL =
  'https://shopping.naver.com/popup/reviews/redirect?action=REVIEW_REGISTERED&productOrderId=2222222222222222'

describe('isReviewFormUrl', () => {
  test('실제 폼 URL 을 알아본다', () => {
    expect(isReviewFormUrl(FORM_URL)).toBe(true)
  })

  test('쿼리가 없어도 경로로 판별한다', () => {
    expect(isReviewFormUrl('https://shopping.naver.com/popup/reviews/form')).toBe(true)
  })

  test('목록 페이지는 폼이 아니다', () => {
    expect(isReviewFormUrl('https://shopping.naver.com/my/writable-reviews')).toBe(false)
  })

  test('등록 완료 리다이렉트는 폼이 아니다', () => {
    expect(isReviewFormUrl(REGISTERED_URL)).toBe(false)
  })

  test('네이버가 아닌 도메인의 같은 경로를 막는다', () => {
    expect(isReviewFormUrl('https://evil.example.com/popup/reviews/form')).toBe(false)
  })

  test('URL 이 아니면 false 다', () => {
    expect(isReviewFormUrl(null)).toBe(false)
    expect(isReviewFormUrl('')).toBe(false)
    expect(isReviewFormUrl('not-a-url')).toBe(false)
  })
})

describe('parseReviewFormUrl', () => {
  test('상품주문번호를 뽑는다', () => {
    expect(parseReviewFormUrl(FORM_URL).productOrderNos).toBe('2222222222222222')
  })

  test('주문번호를 뽑는다', () => {
    expect(parseReviewFormUrl(FORM_URL).orderNo).toBe('1111111111111111')
  })

  test('항목 고유 키를 만든다', () => {
    expect(parseReviewFormUrl(FORM_URL).key).toBe('productOrder:2222222222222222')
  })

  test('상품주문번호가 없으면 주문번호로 키를 만든다', () => {
    const url = 'https://shopping.naver.com/popup/reviews/form?orderNo=123'

    expect(parseReviewFormUrl(url).key).toBe('order:123')
  })

  test('둘 다 없으면 키가 null 이다', () => {
    const url = 'https://shopping.naver.com/popup/reviews/form'

    expect(parseReviewFormUrl(url).key).toBeNull()
  })

  test('폼 URL 이 아니면 전부 null 이다', () => {
    expect(parseReviewFormUrl('https://shopping.naver.com/my/writable-reviews')).toEqual({
      orderNo: null,
      productOrderNos: null,
      key: null,
    })
  })
})

describe('isReviewRegisteredUrl', () => {
  test('등록 완료 리다이렉트를 알아본다', () => {
    expect(isReviewRegisteredUrl(REGISTERED_URL)).toBe(true)
  })

  test('폼 URL 자체는 완료가 아니다', () => {
    // 폼 URL 의 returnUrl 파라미터 안에도 REVIEW_REGISTERED 문자열이 들어 있다.
    // 단순 문자열 포함 검사로는 폼을 열자마자 성공으로 오판한다.
    expect(isReviewRegisteredUrl(FORM_URL)).toBe(false)
  })

  test('다른 action 은 완료가 아니다', () => {
    expect(
      isReviewRegisteredUrl('https://shopping.naver.com/popup/reviews/redirect?action=CANCELLED'),
    ).toBe(false)
  })

  test('네이버가 아닌 도메인을 막는다', () => {
    expect(isReviewRegisteredUrl('https://evil.example.com/?action=REVIEW_REGISTERED')).toBe(false)
  })

  test('URL 이 아니면 false 다', () => {
    expect(isReviewRegisteredUrl(undefined)).toBe(false)
  })
})
