// @vitest-environment jsdom
/**
 * 상품 평가 설문 자동 선택.
 *
 * 실측(2026-08-27) 리뷰 폼에는 별점 외에 3개 설문이 있었고, 등록 버튼이 초기에 disabled 였다.
 *   div.evaluation_grade_rating[role=radiogroup] > 3 x a[role=radio]
 *   - 맛:        맛없어요 / 평범해요 / 맛있어요
 *   - 포장:      별로예요 / 적당해요 / 꼼꼼해요
 *   - 유통기한:  임박상품이에요 / 꽤남았어요 / 아주넉넉해요
 *
 * 별점 그룹(5개)과 같은 role 을 쓰므로 반드시 구분해야 한다.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fillSurveys, findSurveyGroups } from '../../src/content/actions/fill-survey.js'

const ratingGroup = () => `
  <div class="rating_grade_rating__0xRI5" role="radiogroup">
    ${[5, 4, 3, 2, 1]
      .map((score) => `<button class="rating_button_grade__mMR2p" role="radio" aria-checked="false" data-score="${score}">${score}</button>`)
      .join('')}
  </div>`

const survey = (name, options) => `
  <div class="evaluation_grade_rating__m8Ewp" role="radiogroup" data-survey="${name}">
    ${options
      .map((label, index) => `<a class="evaluation_button_grade__gdTt0" role="radio" aria-checked="false" data-option="${index}">${label}</a>`)
      .join('')}
  </div>`

const renderForm = () => {
  document.body.innerHTML = `
    <div class="reviewForm">
      ${ratingGroup()}
      ${survey('맛', ['맛없어요', '평범해요', '맛있어요'])}
      ${survey('포장', ['별로예요', '적당해요', '꼼꼼해요'])}
      ${survey('유통기한', ['임박상품이에요', '꽤남았어요', '아주넉넉해요'])}
    </div>`
}

const chosen = () =>
  [...document.querySelectorAll('[data-option][data-clicked="true"]')].map((el) => ({
    survey: el.closest('[data-survey]').dataset.survey,
    option: Number(el.dataset.option),
    label: el.textContent,
  }))

const trackClicks = () => {
  for (const option of document.querySelectorAll('[data-option]')) {
    option.addEventListener('click', () => option.setAttribute('data-clicked', 'true'))
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('findSurveyGroups', () => {
  test('별점 그룹(5개)을 설문으로 세지 않는다', () => {
    renderForm()

    const groups = findSurveyGroups(document.body)

    expect(groups).toHaveLength(3)
  })

  test('설문이 없으면 빈 배열이다', () => {
    document.body.innerHTML = ratingGroup()

    expect(findSurveyGroups(document.body)).toEqual([])
  })

  test('이미 선택된 설문은 건너뛴다', () => {
    renderForm()
    document.querySelector('[data-survey="맛"] [data-option="1"]').setAttribute('aria-checked', 'true')

    expect(findSurveyGroups(document.body)).toHaveLength(2)
  })
})

describe('fillSurveys — 별점에 맞춘 선택', () => {
  test('5점이면 가장 긍정적인 선택지를 고른다', () => {
    renderForm()
    trackClicks()

    const result = fillSurveys(document.body, 5)

    expect(result.ok).toBe(true)
    expect(chosen().map((c) => c.label)).toEqual(['맛있어요', '꼼꼼해요', '아주넉넉해요'])
  })

  test('3점이면 중간 선택지를 고른다', () => {
    renderForm()
    trackClicks()

    fillSurveys(document.body, 3)

    expect(chosen().map((c) => c.label)).toEqual(['평범해요', '적당해요', '꽤남았어요'])
  })

  test('1점이면 가장 부정적인 선택지를 고른다', () => {
    renderForm()
    trackClicks()

    fillSurveys(document.body, 1)

    expect(chosen().map((c) => c.option)).toEqual([0, 0, 0])
  })

  test('별점 버튼은 건드리지 않는다', () => {
    renderForm()
    const ratingClick = vi.fn()
    for (const button of document.querySelectorAll('[data-score]')) {
      button.addEventListener('click', ratingClick)
    }

    fillSurveys(document.body, 5)

    expect(ratingClick).not.toHaveBeenCalled()
  })

  test('선택지 개수가 달라도 비율로 고른다', () => {
    document.body.innerHTML = survey('만족도', ['1', '2', '3', '4'])
    trackClicks()

    fillSurveys(document.body, 5)

    expect(chosen()[0].option).toBe(3)
  })

  test('처리한 설문 수를 보고한다', () => {
    renderForm()

    expect(fillSurveys(document.body, 5).value.answered).toBe(3)
  })

  test('설문이 없어도 성공으로 본다', () => {
    document.body.innerHTML = ratingGroup()

    const result = fillSurveys(document.body, 5)

    expect(result.ok).toBe(true)
    expect(result.value.answered).toBe(0)
  })

  test('별점이 범위를 벗어나면 실패한다', () => {
    renderForm()

    expect(fillSurveys(document.body, 0).ok).toBe(false)
  })
})
