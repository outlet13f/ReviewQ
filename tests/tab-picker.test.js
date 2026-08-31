/**
 * 리뷰 목록 탭 선택.
 *
 * 오리진이 같다는 이유만으로 아무 탭이나 이동시키면, 사용자가 결제나 주문을
 * 진행 중이던 탭을 빼앗아 입력 중이던 내용을 날릴 수 있다.
 * pay.naver.com 은 특히 그럴 가능성이 높은 오리진이다.
 */

import { describe, expect, test } from 'vitest'
import { TAB_ACTION, pickReviewListTab } from '../src/background/tab-picker.js'

const REVIEW_URL = 'https://order.pay.naver.com/home?tabMenu=REVIEW'

describe('pickReviewListTab', () => {
  test('열린 탭이 없으면 새로 만든다', () => {
    const result = pickReviewListTab({ tabs: [], reviewListUrl: REVIEW_URL })

    expect(result.action).toBe(TAB_ACTION.CREATE)
  })

  test('이미 리뷰 목록에 있는 탭은 재사용한다', () => {
    const tabs = [{ id: 7, url: REVIEW_URL }]

    const result = pickReviewListTab({ tabs, reviewListUrl: REVIEW_URL })

    expect(result.action).toBe(TAB_ACTION.REUSE)
    expect(result.tabId).toBe(7)
  })

  test('같은 오리진이라도 다른 페이지를 쓰고 있으면 빼앗지 않는다', () => {
    // 사용자가 결제 진행 중일 수 있다.
    const tabs = [{ id: 3, url: 'https://order.pay.naver.com/payment/checkout?orderId=123' }]

    const result = pickReviewListTab({ tabs, reviewListUrl: REVIEW_URL })

    expect(result.action).toBe(TAB_ACTION.CREATE)
  })

  test('여러 탭 중 리뷰 목록에 있는 것을 고른다', () => {
    const tabs = [
      { id: 1, url: 'https://order.pay.naver.com/payment/checkout' },
      { id: 2, url: 'https://order.pay.naver.com/history' },
      { id: 9, url: REVIEW_URL },
    ]

    const result = pickReviewListTab({ tabs, reviewListUrl: REVIEW_URL })

    expect(result.tabId).toBe(9)
  })

  test('해시만 다른 탭은 같은 페이지로 본다', () => {
    const tabs = [{ id: 5, url: `${REVIEW_URL}#top` }]

    const result = pickReviewListTab({ tabs, reviewListUrl: REVIEW_URL })

    expect(result.action).toBe(TAB_ACTION.REUSE)
    expect(result.tabId).toBe(5)
  })

  test('쿼리 순서가 달라도 같은 페이지로 본다', () => {
    const tabs = [{ id: 6, url: 'https://order.pay.naver.com/home?b=2&a=1' }]

    const result = pickReviewListTab({ tabs, reviewListUrl: 'https://order.pay.naver.com/home?a=1&b=2' })

    expect(result.action).toBe(TAB_ACTION.REUSE)
  })

  test('URL 이 없거나 깨진 탭은 무시한다', () => {
    const tabs = [{ id: 1 }, { id: 2, url: 'not-a-url' }, { id: 3, url: REVIEW_URL }]

    const result = pickReviewListTab({ tabs, reviewListUrl: REVIEW_URL })

    expect(result.tabId).toBe(3)
  })

  test('id 없는 탭은 재사용 대상이 아니다', () => {
    const tabs = [{ url: REVIEW_URL }]

    const result = pickReviewListTab({ tabs, reviewListUrl: REVIEW_URL })

    expect(result.action).toBe(TAB_ACTION.CREATE)
  })

  test('탭 목록이 배열이 아니면 새로 만든다', () => {
    expect(pickReviewListTab({ tabs: null, reviewListUrl: REVIEW_URL }).action).toBe(TAB_ACTION.CREATE)
  })

  test('리뷰 목록 URL 이 깨져 있으면 새로 만든다', () => {
    const tabs = [{ id: 1, url: REVIEW_URL }]

    expect(pickReviewListTab({ tabs, reviewListUrl: 'not-a-url' }).action).toBe(TAB_ACTION.CREATE)
  })
})
