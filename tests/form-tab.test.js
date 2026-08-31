/**
 * 리뷰 폼 팝업 창 찾기.
 *
 * 목록의 "리뷰쓰기" 는 같은 탭을 이동시키지 않고 **새 창**을 연다.
 * 그래서 이후 단계(별점·본문·등록)는 목록 탭이 아니라 이 창에 보내야 한다.
 */

import { describe, expect, test } from 'vitest'
import { pickFormTab } from '../src/background/form-tab.js'

const FORM_URL = 'https://shopping.naver.com/popup/reviews/form?orderNo=1&productOrderNos=2'
const OTHER_FORM_URL = 'https://shopping.naver.com/popup/reviews/form?orderNo=9&productOrderNos=8'
const LIST_URL = 'https://shopping.naver.com/my/writable-reviews'

describe('pickFormTab', () => {
  test('열린 탭이 없으면 null 이다', () => {
    expect(pickFormTab({ tabs: [], excludeTabId: 1 })).toBeNull()
  })

  test('리뷰 폼 탭을 찾는다', () => {
    const tabs = [
      { id: 1, url: LIST_URL },
      { id: 2, url: FORM_URL },
    ]

    expect(pickFormTab({ tabs, excludeTabId: 1 })).toBe(2)
  })

  test('목록 탭은 고르지 않는다', () => {
    // 목록 탭이 어떤 이유로 폼 URL 을 갖게 되어도 제외한다.
    const tabs = [{ id: 1, url: FORM_URL }]

    expect(pickFormTab({ tabs, excludeTabId: 1 })).toBeNull()
  })

  test('폼이 아닌 탭은 무시한다', () => {
    const tabs = [
      { id: 3, url: 'https://shopping.naver.com/my/reviews' },
      { id: 4, url: 'https://example.com/' },
    ]

    expect(pickFormTab({ tabs, excludeTabId: 1 })).toBeNull()
  })

  test('폼 탭이 여러 개면 가장 마지막에 열린 것을 고른다', () => {
    // 이전 실행에서 닫히지 않은 창이 남아 있을 수 있다.
    const tabs = [
      { id: 5, url: FORM_URL },
      { id: 7, url: OTHER_FORM_URL },
    ]

    expect(pickFormTab({ tabs, excludeTabId: 1 })).toBe(7)
  })

  test('URL 이 없거나 깨진 탭을 건너뛴다', () => {
    const tabs = [{ id: 2 }, { id: 3, url: 'not-a-url' }, { id: 4, url: FORM_URL }]

    expect(pickFormTab({ tabs, excludeTabId: 1 })).toBe(4)
  })

  test('id 가 없는 탭은 고르지 않는다', () => {
    expect(pickFormTab({ tabs: [{ url: FORM_URL }], excludeTabId: 1 })).toBeNull()
  })

  test('탭 목록이 배열이 아니면 null 이다', () => {
    expect(pickFormTab({ tabs: null, excludeTabId: 1 })).toBeNull()
  })
})
