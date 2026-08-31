/**
 * 리뷰 폼 팝업 창 찾기.
 *
 * 실측(2026-08-27): 목록의 "리뷰쓰기" 는 같은 탭을 이동시키지 않고
 * window.open 으로 **새 창**(window.name="ReviewWrite", 560x834)을 연다.
 * 따라서 별점·본문·등록은 목록 탭이 아니라 이 창에 보내야 한다.
 */

import { isReviewFormUrl } from '../shared/review-form-url.js'

/**
 * @param {{tabs: Array<{id?: number, url?: string}>, excludeTabId: number}} input
 * @returns {number|null} 폼 탭 id
 */
export const pickFormTab = ({ tabs, excludeTabId }) => {
  if (!Array.isArray(tabs)) return null

  const candidates = tabs.filter(
    (tab) => Number.isFinite(tab?.id) && tab.id !== excludeTabId && isReviewFormUrl(tab?.url),
  )
  // 이전 실행에서 닫히지 않은 창이 남아 있을 수 있으므로 가장 마지막(최근) 것을 쓴다.
  return candidates.at(-1)?.id ?? null
}
