/**
 * 리뷰 목록 탭 선택.
 *
 * "오리진이 같은 아무 탭"을 재사용하면 사용자가 결제·주문을 진행 중이던 탭을
 * 리뷰 목록으로 이동시켜 입력 내용을 날릴 수 있다. pay.naver.com 은 특히 위험하다.
 * 그래서 이미 리뷰 목록에 있는 탭만 재사용하고, 없으면 새 탭을 만든다.
 */

export const TAB_ACTION = Object.freeze({
  /** 이미 리뷰 목록을 보고 있는 탭이 있다. */
  REUSE: 'REUSE',
  /** 남의 작업을 방해하지 않도록 새 탭을 연다. */
  CREATE: 'CREATE',
})

/** 해시와 쿼리 순서를 무시한 비교용 키. 같은 페이지를 다르게 세지 않기 위함이다. */
const pageKey = (value) => {
  try {
    const url = new URL(value)
    const params = [...url.searchParams.entries()].sort(([left], [right]) => left.localeCompare(right))
    const query = params.map(([key, item]) => `${key}=${item}`).join('&')
    return `${url.origin}${url.pathname}?${query}`
  } catch {
    return null
  }
}

/**
 * @param {{tabs: Array<{id?: number, url?: string}>, reviewListUrl: string}} input
 * @returns {{action: string, tabId: number|null}}
 */
export const pickReviewListTab = ({ tabs, reviewListUrl }) => {
  const targetKey = pageKey(reviewListUrl)
  if (targetKey === null || !Array.isArray(tabs)) {
    return Object.freeze({ action: TAB_ACTION.CREATE, tabId: null })
  }

  const match = tabs.find((tab) => Number.isFinite(tab?.id) && pageKey(tab?.url) === targetKey)
  if (match) return Object.freeze({ action: TAB_ACTION.REUSE, tabId: match.id })

  return Object.freeze({ action: TAB_ACTION.CREATE, tabId: null })
}
