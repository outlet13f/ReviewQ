/**
 * 상품 평가 설문 자동 선택.
 *
 * 실측(2026-08-27): 리뷰 폼에는 별점 외에 3개 설문이 있고 등록 버튼이 초기에 disabled 다.
 * 설문이 필수라면 이걸 채우지 않으면 등록 자체가 불가능하다.
 *
 * 선택 기준은 별점이다. 5점이면 가장 긍정, 3점이면 중간, 1점이면 가장 부정을 고른다.
 * 리뷰 본문 톤과 어긋나지 않게 하기 위함이다.
 *
 * 주의: 설문 중에는 "유통기한이 얼마나 남았나" 처럼 **사실을 묻는 항목**도 있다.
 * 별점으로는 알 수 없는 값이므로, 이 기능은 설정(answerSurveys)으로 끌 수 있어야 한다.
 */

import { err, ok } from '../../shared/result.js'
import { FORM } from '../dom/selectors.js'
import { isVisible, textOf, visibleAll } from '../dom/finder.js'
import { humanClick } from '../dom/events.js'

const RATING_MAX = 5
/** 별점 그룹은 선택지가 5개다. 설문과 구분하는 기준. */
const RATING_OPTION_COUNT = 5

const optionsOf = (group) => [...group.querySelectorAll('[role="radio"]')].filter(isVisible)

const isAnswered = (group) => optionsOf(group).some((option) => option.getAttribute('aria-checked') === 'true')

/**
 * 아직 답하지 않은 설문 그룹들.
 * 별점 그룹(선택지 5개)은 제외한다 — setRating 이 따로 다룬다.
 */
export const findSurveyGroups = (root = document) => {
  // 셀렉터 후보들이 같은 요소를 중복 매칭하므로 반드시 중복을 제거한다.
  const unique = new Set(FORM.surveyGroupSelectors.flatMap((selector) => visibleAll(selector, root)))

  return [...unique].filter((group) => {
    const count = optionsOf(group).length
    return count > 0 && count !== RATING_OPTION_COUNT && !isAnswered(group)
  })
}

/**
 * 별점(1~5)을 선택지 개수에 맞춰 위치로 환산한다.
 * 선택지는 부정 -> 긍정 순으로 놓여 있다고 본다(실측 3종 모두 그러했다).
 */
const optionIndexFor = (rating, optionCount) => {
  const ratio = (rating - 1) / (RATING_MAX - 1)
  return Math.round(ratio * (optionCount - 1))
}

/**
 * 설문을 별점에 맞춰 채운다.
 * @param {Element} root 폼 루트
 * @param {number} rating 1~5
 */
export const fillSurveys = (root, rating) => {
  const value = Number.parseInt(rating, 10)
  if (!Number.isFinite(value) || value < 1 || value > RATING_MAX) {
    return err(`별점은 1~${RATING_MAX} 사이여야 합니다. (받은 값: ${rating})`)
  }

  const groups = findSurveyGroups(root ?? document)
  const answered = groups.reduce((count, group) => {
    const options = optionsOf(group)
    const target = options[optionIndexFor(value, options.length)]
    if (!target) return count

    humanClick(target)
    return count + 1
  }, 0)

  return ok(Object.freeze({ answered, total: groups.length, labels: groups.map((g) => textOf(g).slice(0, 30)) }))
}
