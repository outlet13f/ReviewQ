/** 리뷰 본문 입력 필드를 찾아 채운다. */

import { err, ok } from '../../shared/result.js'
import { FORM } from '../dom/selectors.js'
import { isDisabled, visibleAll } from '../dom/finder.js'
import { readValue, setControlledValue, typeInto } from '../dom/input.js'

const REVIEW_HINT = /리뷰|후기|상품|사용|의견|작성/u
/** 리뷰 입력칸으로 볼 만한 maxlength 기준값. 이 값에 가까울수록 점수가 높다. */
const REFERENCE_MAXLENGTH = 1000

const attributesText = (element) =>
  [
    element.getAttribute('placeholder'),
    element.getAttribute('aria-label'),
    element.getAttribute('name'),
    element.getAttribute('id'),
    element.getAttribute('title'),
  ]
    .filter(Boolean)
    .join(' ')

const isExcluded = (element) =>
  FORM.textInputExcludeSelectors.some((selector) => {
    try {
      return element.matches(selector)
    } catch {
      return false
    }
  })

/** 입력 필드 후보에 점수를 매긴다. 리뷰 힌트가 있는 textarea 가 가장 높다. */
const scoreCandidate = (element) => {
  let score = 0
  if (element.tagName === 'TEXTAREA') score += 100
  if (element.getAttribute('contenteditable') === 'true' || element.isContentEditable) score += 60
  if (REVIEW_HINT.test(attributesText(element))) score += 80

  const maxLength = Number.parseInt(element.getAttribute('maxlength') ?? '', 10)
  if (Number.isFinite(maxLength)) score += Math.min(50, (maxLength / REFERENCE_MAXLENGTH) * 50)
  return score
}

/** 본문 입력 필드를 고른다. 없으면 null. */
export const findTextInput = (root = document) => {
  const candidates = FORM.textInputSelectors
    .flatMap((selector) => visibleAll(selector, root))
    .filter((element) => !isExcluded(element) && !isDisabled(element))

  const unique = [...new Set(candidates)]
  if (unique.length === 0) return null

  return unique
    .map((element) => ({ element, score: scoreCandidate(element) }))
    .sort((left, right) => right.score - left.score)[0].element
}

/**
 * 본문을 입력한다.
 * @param {Element} root 폼 루트
 * @param {string} text
 * @param {{humanTyping?: boolean, delayFor?: (index:number)=>number}} options
 */
export const fillReviewText = async (root, text, options = {}) => {
  if (typeof text !== 'string' || text.trim() === '') return err('입력할 리뷰 본문이 비어 있습니다.')

  const input = findTextInput(root)
  if (!input) return err('리뷰 본문 입력 필드를 찾지 못했습니다.')

  const { humanTyping = true, delayFor } = options
  const result = humanTyping ? await typeInto(input, text, { delayFor }) : setControlledValue(input, text)
  if (!result.ok) return result

  const written = readValue(input)
  if (written.trim() === '') return err('본문 입력이 반영되지 않았습니다.')

  return ok(
    Object.freeze({
      length: written.length,
      preview: written.slice(0, 60),
      matched: written.trim() === text.trim(),
    }),
  )
}
