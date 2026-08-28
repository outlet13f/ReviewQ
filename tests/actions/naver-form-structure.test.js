// @vitest-environment jsdom
/**
 * 2026-08-27 실제 리뷰 작성 폼에서 확인한 구조로 만든 픽스처.
 * URL: https://shopping.naver.com/popup/reviews/form?orderNo=...&productOrderNos=...&returnUrl=...
 *
 * 실측 결과:
 * - 별도 팝업 창(window.name="ReviewWrite", 560x834, window.opener 존재)
 * - 별점: div.rating_grade_rating[role=radiogroup] > 5 x button[role=radio]
 *   텍스트가 "5","4","3","2","1" 로 **내림차순**이다
 * - 평가 설문 3개: div.evaluation_grade_rating[role=radiogroup] > 3 x a[role=radio]
 *   -> role=radio 가 총 14개, radiogroup 4개. 전부 aria-label 이 없다
 * - 본문: textarea#reviewInput (maxlength 5000, placeholder 없음)
 * - 등록 버튼: button "등록" 이 **초기에는 disabled**
 * - 동의 체크박스 없음, iframe 없음
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { setRating } from '../../src/content/actions/fill-rating.js'
import { findTextInput } from '../../src/content/actions/fill-text.js'
import { findSubmitButton } from '../../src/content/actions/submit.js'

/** 별점은 5 -> 1 내림차순으로 렌더된다. */
const ratingGroup = () => `
  <div class="rating_grade_rating__0xRI5" role="radiogroup">
    ${[5, 4, 3, 2, 1]
      .map((score) => `<button class="rating_button_grade__mMR2p" role="radio" aria-checked="false" data-score="${score}">${score}</button>`)
      .join('')}
  </div>`

/** 상품 평가 설문. 별점과 같은 role 을 쓰지만 항목이 3개다. */
const evaluationGroup = (options) => `
  <div class="evaluation_grade_rating__m8Ewp" role="radiogroup">
    ${options.map((label) => `<a class="evaluation_button_grade__gdTt0" role="radio" aria-checked="false">${label}</a>`).join('')}
  </div>`

const renderForm = ({ submitDisabled = true } = {}) => {
  document.body.innerHTML = `
    <div class="reviewForm">
      ${ratingGroup()}
      ${evaluationGroup(['맛없어요', '평범해요', '맛있어요'])}
      ${evaluationGroup(['별로예요', '적당해요', '꼼꼼해요'])}
      ${evaluationGroup(['임박상품이에요', '꽤남았어요', '아주넉넉해요'])}
      <textarea id="reviewInput" class="reviewTextArea_input_textarea__LhtP1" maxlength="5000"></textarea>
      <button class="reviewSubmitButton_cancel">취소</button>
      <button class="reviewSubmitButton_button_submit__8ScDh" type="button" ${submitDisabled ? 'disabled' : ''}>등록</button>
    </div>`
}

const clickedScore = () => document.querySelector('[data-score][data-clicked="true"]')?.getAttribute('data-score') ?? null

const trackClicks = () => {
  for (const button of document.querySelectorAll('[data-score]')) {
    button.addEventListener('click', () => button.setAttribute('data-clicked', 'true'))
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('실제 리뷰 폼 — 별점', () => {
  test('5점을 요청하면 5점 버튼을 누른다', () => {
    // 네이버는 별점을 5,4,3,2,1 순서로 렌더한다.
    // 위치(index)로 고르면 5점 요청에 1점이 눌린다.
    renderForm()
    trackClicks()

    const result = setRating(document.body, 5)

    expect(result.ok).toBe(true)
    expect(clickedScore()).toBe('5')
  })

  test('1점을 요청하면 1점 버튼을 누른다', () => {
    renderForm()
    trackClicks()

    setRating(document.body, 1)

    expect(clickedScore()).toBe('1')
  })

  test('3점을 요청하면 3점 버튼을 누른다', () => {
    renderForm()
    trackClicks()

    setRating(document.body, 3)

    expect(clickedScore()).toBe('3')
  })

  test('평가 설문 그룹을 별점으로 착각하지 않는다', () => {
    // role=radio 14개 중 9개가 설문이다. 설문을 누르면 엉뚱한 답변이 등록된다.
    renderForm()
    const surveyClick = vi.fn()
    for (const item of document.querySelectorAll('.evaluation_button_grade__gdTt0')) {
      item.addEventListener('click', surveyClick)
    }

    setRating(document.body, 5)

    expect(surveyClick).not.toHaveBeenCalled()
  })

  test('radiogroup 에 aria-label 이 없어도 그룹을 구분한다', () => {
    // 실측: 4개 radiogroup 전부 aria-label 이 null 이다.
    renderForm()
    trackClicks()

    setRating(document.body, 4)

    expect(clickedScore()).toBe('4')
  })
})

describe('실제 리뷰 폼 — 본문과 등록', () => {
  test('본문 입력칸을 찾는다', () => {
    renderForm()

    expect(findTextInput(document.body)?.id).toBe('reviewInput')
  })

  test('초기에 비활성인 등록 버튼도 찾아 둔다', () => {
    // 별점과 본문을 채우기 전에는 disabled 다. 그렇다고 "버튼이 없다"고 하면 안 된다.
    renderForm({ submitDisabled: true })

    const button = findSubmitButton(document.body)

    expect(button).not.toBeNull()
    expect(button.textContent).toBe('등록')
  })

  test('취소 버튼을 등록 버튼으로 착각하지 않는다', () => {
    renderForm({ submitDisabled: false })

    expect(findSubmitButton(document.body).textContent).toBe('등록')
  })
})
