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
 * 선택지 문구의 성향 사전.
 *
 * **위치로 고르면 안 된다.** 같은 페이지의 별점은 5,4,3,2,1 내림차순인데
 * 설문도 그 관례를 따른다면 "부정->긍정 순" 가정이 정반대가 되어
 * 5점 리뷰에 "맛없어요" 가 선택된다. 그래서 순서가 아니라 문구의 의미로 고른다.
 */
const SENTIMENT = Object.freeze({
  positive: Object.freeze(['맛있', '꼼꼼', '좋아', '만족', '넉넉', '빨라', '우수', '최고', '예뻐', '튼튼', '신선']),
  neutral: Object.freeze(['평범', '적당', '보통', '무난', '그저', '꽤남']),
  negative: Object.freeze(['맛없', '별로', '아쉬', '나빠', '부족', '임박', '느려', '불만', '실망']),
})

/** 별점 -> 원하는 성향. 리뷰 본문 톤과 같은 기준을 쓴다. */
const sentimentFor = (rating) => {
  if (rating >= 4) return 'positive'
  if (rating === 3) return 'neutral'
  return 'negative'
}

/** 숫자 근거(value/data-value/aria-label)가 있으면 그것으로 고른다. */
const pickByNumericValue = (options, rating, optionCount) => {
  const scaled = Math.round(((rating - 1) / (RATING_MAX - 1)) * (optionCount - 1)) + 1
  return (
    options.find((option) => {
      const raw = option.getAttribute('data-value') ?? option.getAttribute('value')
      return raw !== null && Number.parseInt(raw, 10) === scaled
    }) ?? null
  )
}

/** 문구의 성향으로 고른다. */
const pickBySentiment = (options, rating) => {
  const wanted = SENTIMENT[sentimentFor(rating)]
  return options.find((option) => wanted.some((word) => textOf(option).includes(word))) ?? null
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
    // 숫자 근거 -> 문구 성향 순으로 시도한다. 둘 다 없으면 **고르지 않는다**.
    const target = pickByNumericValue(options, value, options.length) ?? pickBySentiment(options, value)
    if (!target) return count

    humanClick(target)
    return count + 1
  }, 0)

  return ok(
    Object.freeze({
      answered,
      /** 근거가 없어 건너뛴 설문. 등록 버튼이 비활성으로 남는 원인이 될 수 있다. */
      skipped: groups.length - answered,
      total: groups.length,
    }),
  )
}
