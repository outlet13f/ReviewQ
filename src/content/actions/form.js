/** 리뷰 작성 폼 루트를 찾고 열릴 때까지 기다린다. */

import { err, ok } from '../../shared/result.js'
import { FORM } from '../dom/selectors.js'
import { findFirstVisible, isVisible, visibleAll } from '../dom/finder.js'
import { waitFor } from '../../shared/async.js'
import { findTextInput } from './fill-text.js'
import { hasRatingWidget } from './fill-rating.js'

/**
 * 폼 루트를 찾는다.
 * 본문 입력칸 + 별점 위젯을 모두 가진 가장 좁은 컨테이너를 우선한다 —
 * body 가 루트로 잡히면 등록 버튼을 페이지 전체에서 찾게 되어 헤더의 다른 "등록" 을 누를 수 있다.
 * 둘 다 갖춘 후보가 없으면 입력칸만 가진 후보로 폴백한다(별점 구현을 못 알아본 경우).
 */
export const findFormRoot = () => {
  let inputOnlyFallback = null

  for (const selector of FORM.rootSelectors) {
    for (const candidate of visibleAll(selector)) {
      if (!findTextInput(candidate)) continue
      if (hasRatingWidget(candidate)) return candidate
      inputOnlyFallback = inputOnlyFallback ?? candidate
    }
  }
  return inputOnlyFallback
}

/** 폼이 화면에 나타날 때까지 기다린다. */
export const waitForForm = async (timeout) => {
  const result = await waitFor(() => findFormRoot(), { timeout, label: '리뷰 작성 폼' })
  if (!result.ok) return result
  return ok(result.value)
}

/** 폼이 사라질 때까지 기다린다. 제출 성공 판정에 쓴다. */
export const waitForFormGone = async (root, timeout) => {
  if (!root) return ok('폼 없음')
  const result = await waitFor(() => (root.isConnected && isVisible(root) ? null : true), {
    timeout,
    label: '리뷰 작성 폼 닫힘',
  })
  return result
}

/**
 * 미체크 상태인 동의 체크박스를 보고한다. 자동으로 체크하지 않는다.
 * 셀렉터 후보가 서로 겹칠 수 있으므로 같은 요소를 중복 보고하지 않는다.
 */
export const findUncheckedAgreements = (root) => {
  const scope = root ?? document
  const matched = new Set(FORM.agreementSelectors.flatMap((selector) => [...scope.querySelectorAll(selector)]))
  return [...matched].filter((checkbox) => checkbox.checked === false)
}

export const requireFormRoot = () => {
  const root = findFormRoot()
  if (!root) return err('리뷰 작성 폼을 찾지 못했습니다. 팝업 > 페이지 진단으로 구조를 확인해 주세요.')
  return ok(root)
}

export { findFirstVisible }
