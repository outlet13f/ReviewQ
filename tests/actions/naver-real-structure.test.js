// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://shopping.naver.com/my/writable-reviews" }
/**
 * 2026-08-27 실제 https://shopping.naver.com/my/writable-reviews 에서 확인한 구조로 만든 픽스처.
 *
 * 실측 결과:
 * - 작성 버튼 20개, 전부 <button class="WritableReviewListItemWriteButton_btn_review__lLyhd">
 * - 문구 6종: "리뷰쓰기", "한달사용리뷰 쓰기", "리뷰쓰고 최대 {150|300|350|650}원 받기"
 * - 항목 컨테이너는 <li>/<tr> 이 아니라 <div class="WritableReviewListItem_list_item__61g19">
 * - 상품명 a.WritableReviewListItemInfo_link_title / 스토어 a.WritableReviewListItemInfo_link_store
 * (아래 상품명/스토어명은 합성값이다. 실제 구매 내역을 저장소에 남기지 않는다.)
 * - 헤더와 좌측 메뉴에 <a href="/my/writable-reviews">리뷰 작성</a> 이 있어 오탐을 만든다
 * - iframe 6개는 전부 0x0 추적용, shadow DOM 은 없음
 *
 * 클래스명 끝의 해시(__61g19)는 배포마다 바뀌므로 접두어만 부분 매칭한다.
 */

import { beforeEach, describe, expect, test } from 'vitest'
import { scanReviewList } from '../../src/content/actions/scan-list.js'

const listItem = ({ store, product, option, buttonText }) => `
  <div class="WritableReviewListItem_list_item__61g19">
    <div class="WritableReviewListItem_product_item__85AKb">
      <div class="WritableReviewListItem_thumb_area__HOp89">
        <a class="WritableReviewListItem_link_thumb__qkMTl" href="https://m.pay.naver.com/inflow/outlink?u=x"></a>
      </div>
      <div class="WritableReviewListItemInfo_info_area__ZjMO1">
        <a class="WritableReviewListItemInfo_link_store__14e4x" href="https://shopping.naver.com/panel/outlink">${store}</a>
        <a class="WritableReviewListItemInfo_link_title__sxkAa" href="https://m.pay.naver.com/inflow/outlink?u=y">${product}</a>
        <div class="WritableReviewListItemInfo_description__Mn6He">옵션명: ${option}</div>
      </div>
      <div class="WritableReviewListItemWriteButton_review_button_area__JvXhG">
        <button class="WritableReviewListItemWriteButton_btn_review__lLyhd">${buttonText}</button>
      </div>
    </div>
  </div>`

/** 헤더와 좌측 메뉴의 네비게이션 링크 — 실제 페이지에 존재하며 오탐을 만든다. */
const navigation = `
  <div class="_mobileHeader_inner_hNBP2">
    <h2 class="_headerTitle_snb_header_LDUP2">
      <a class="_headerTitle_link_x1Aew" href="/my/writable-reviews">리뷰 작성</a>
    </h2>
  </div>
  <div class="MyLNB_my_lnb__ePQJY">
    <div class="MyLNB_menu__c8e1t">
      <a class="MyLNB_item__w5VuY" href="/my/writable-reviews">리뷰 작성</a>
    </div>
  </div>`

const ITEMS = [
  { store: '샘플마트', product: '스테인리스 텀블러 500ml', option: '실버', buttonText: '리뷰쓰기' },
  { store: '샘플마트', product: '면 티셔츠 화이트', option: 'L 사이즈', buttonText: '리뷰쓰고 최대 150원 받기' },
  { store: '샘플마트', product: '유선 이어폰', option: '1.2m', buttonText: '리뷰쓰고 최대 650원 받기' },
  { store: '샘플마트', product: '캠핑 랜턴', option: '충전식', buttonText: '한달사용리뷰 쓰기' },
]

const renderPage = (items = ITEMS) => {
  document.body.innerHTML = `
    ${navigation}
    <div class="writable-reviews_section_review___dDFM">
      <div class="WritableReviewList_list_review__L4pGI">
        ${items.map(listItem).join('')}
      </div>
    </div>`
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('실제 네이버 목록 페이지 구조', () => {
  test('작성 버튼 문구 6종을 모두 인식한다', () => {
    renderPage()

    const result = scanReviewList()

    expect(result.ok).toBe(true)
    // 네비게이션 링크 2개는 항목이 아니므로 제외되어야 한다.
    expect(result.value.total).toBe(ITEMS.length)
  })

  test('"리뷰쓰고 최대 N원 받기" 처럼 금액이 들어간 문구도 인식한다', () => {
    renderPage([ITEMS[1]])

    const result = scanReviewList()

    expect(result.ok).toBe(true)
    expect(result.value.items[0].triggerText).toContain('리뷰쓰고')
  })

  test('헤더와 좌측 메뉴의 "리뷰 작성" 링크를 항목으로 세지 않는다', () => {
    // 이 링크들을 클릭하면 페이지만 새로고침되고 리뷰 폼은 열리지 않는다.
    document.body.innerHTML = navigation

    const result = scanReviewList()

    expect(result.ok).toBe(false)
  })

  test('div 컨테이너에서 상품명을 뽑는다', () => {
    renderPage([ITEMS[0]])

    const [item] = scanReviewList().value.items

    expect(item.productName).toBe('스테인리스 텀블러 500ml')
  })

  test('div 컨테이너에서 스토어명을 뽑는다', () => {
    renderPage([ITEMS[0]])

    const [item] = scanReviewList().value.items

    expect(item.storeName).toBe('샘플마트')
  })

  test('항목마다 서로 다른 키를 만든다', () => {
    // 상품명 추출이 실패하면 모든 항목이 같은 키가 되어 한 건만 처리하고 멈춘다.
    renderPage()

    const keys = scanReviewList().value.items.map((item) => item.key)

    expect(new Set(keys).size).toBe(ITEMS.length)
    expect(keys.every((key) => key.startsWith('name:'))).toBe(true)
  })

  test('같은 상품을 여러 번 구매하면 그만큼 항목을 만든다', () => {
    // 실측: 20개 항목 중 3개가 같은 상품명이었고
    // DOM 에 항목을 구별할 고유 ID 가 없다. 키는 겹칠 수밖에 없으므로
    // 중복 처리는 run-state 의 실패 횟수 모델이 담당한다(nextPendingItem).
    const 동일상품 = { store: '샘플마트', product: '스테인리스 텀블러 500ml', option: '실버', buttonText: '리뷰쓰기' }
    renderPage([동일상품, 동일상품, 동일상품])

    expect(scanReviewList().value.total).toBe(3)
  })

  test('같은 상품이라도 상품명은 그대로 유지한다', () => {
    const 동일상품 = { store: '샘플마트', product: '스테인리스 텀블러 500ml', option: '실버', buttonText: '리뷰쓰기' }
    renderPage([동일상품, 동일상품])

    const items = scanReviewList().value.items

    expect(items.every((item) => item.productName === '스테인리스 텀블러 500ml')).toBe(true)
  })

  test('한달사용기 항목을 구분해서 표시한다', () => {
    // 폼 구조가 일반 리뷰와 달라 실패할 수 있으므로 결과에서 구분되어야 한다.
    renderPage()

    const items = scanReviewList().value.items

    expect(items.filter((item) => item.isMonthlyReview)).toHaveLength(1)
    expect(items.find((item) => item.isMonthlyReview).productName).toBe('캠핑 랜턴')
  })
})
