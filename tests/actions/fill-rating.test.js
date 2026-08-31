// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { hasRatingWidget, setRating } from '../../src/content/actions/fill-rating.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

/** 실제 네이버 폼에서 흔한 형태: 라디오는 숨기고 label 에 스타일을 준다. */
const hiddenRadioMarkup = (name = 'reviewRating') =>
  `<div class="starRating_area">${[1, 2, 3, 4, 5]
    .map(
      (score) =>
        `<input type="radio" id="star${score}" name="${name}" value="${score}" style="display:none" />` +
        `<label for="star${score}">${score}점</label>`,
    )
    .join('')}</div>`

describe('setRating - 라디오 인풋', () => {
  test('value 가 일치하는 라디오를 선택한다', () => {
    document.body.innerHTML = hiddenRadioMarkup()

    const result = setRating(document.body, 4)

    expect(result.ok).toBe(true)
    expect(result.value.strategy).toBe('radio-input')
    expect(result.value.verified).toBe(true)
    expect(document.getElementById('star4').checked).toBe(true)
  })

  test('숨겨진 라디오 대신 label 을 클릭한다', () => {
    document.body.innerHTML = hiddenRadioMarkup()
    const label = document.querySelector('label[for="star5"]')
    const handler = vi.fn()
    label.addEventListener('click', handler)

    setRating(document.body, 5)

    expect(handler).toHaveBeenCalled()
  })

  test('별점 5개짜리 그룹을 다른 설문 그룹과 구분한다', () => {
    document.body.innerHTML = `
      <div>
        <input type="radio" name="scoreSurvey" value="1" /><input type="radio" name="scoreSurvey" value="2" />
      </div>
      ${hiddenRadioMarkup('ratingStar')}
    `

    const result = setRating(document.body, 3)

    expect(result.ok).toBe(true)
    expect(document.querySelector('input[name="ratingStar"][value="3"]').checked).toBe(true)
  })

  test('value 도 라벨도 없으면 위치로 찍지 않는다', () => {
    // 네이버는 별점을 5,4,3,2,1 내림차순으로 렌더한다.
    // 순서를 알 수 없는데 위치로 고르면 정반대 점수가 등록된다.
    document.body.innerHTML = `<div>${[1, 2, 3, 4, 5]
      .map((score) => `<input type="radio" id="s${score}" name="ratingNoValue" />`)
      .join('')}</div>`

    setRating(document.body, 2)

    expect(document.querySelectorAll('input:checked')).toHaveLength(0)
  })

  test('연결된 label 에 "N점" 이 있으면 그것으로 고른다', () => {
    document.body.innerHTML = `<div>${[1, 2, 3, 4, 5]
      .map((score) => `<input type="radio" id="lb${score}" name="ratingLabelled" /><label for="lb${score}">${score}점</label>`)
      .join('')}</div>`

    setRating(document.body, 2)

    expect(document.getElementById('lb2').checked).toBe(true)
  })

  test('change 이벤트를 발생시켜 프레임워크가 값을 인식하게 한다', () => {
    document.body.innerHTML = hiddenRadioMarkup()
    const handler = vi.fn()
    document.body.addEventListener('change', handler)

    setRating(document.body, 1)

    expect(handler).toHaveBeenCalled()
  })
})

describe('setRating - role=radio 위젯', () => {
  test('radiogroup 의 N번째 항목을 클릭한다', () => {
    // 점수 근거(텍스트)가 있어야 고른다. 근거 없이 위치로 찍지 않는다.
    document.body.innerHTML = `<div role="radiogroup" aria-label="별점">${[1, 2, 3, 4, 5]
      .map((score) => `<span role="radio" aria-checked="false" id="rr${score}">${score}</span>`)
      .join('')}</div>`
    const handler = vi.fn()
    document.getElementById('rr4').addEventListener('click', handler)

    const result = setRating(document.body, 4)

    expect(result.value.strategy).toBe('role-radio')
    expect(handler).toHaveBeenCalled()
  })

  test('aria-checked 가 true 면 검증됨으로 표시한다', () => {
    document.body.innerHTML = `<div role="radiogroup">${[1, 2, 3, 4, 5]
      .map((score) => `<span role="radio" aria-checked="${score === 3}" id="rc${score}">${score}</span>`)
      .join('')}</div>`

    const result = setRating(document.body, 3)

    expect(result.value.verified).toBe(true)
  })
})

describe('setRating - "N점" 라벨', () => {
  test('aria-label 에 별점이 있는 버튼을 클릭한다', () => {
    document.body.innerHTML = `<div>${[1, 2, 3, 4, 5]
      .map((score) => `<button id="lb${score}" aria-label="별점 ${score}점 선택"></button>`)
      .join('')}</div>`
    const handler = vi.fn()
    document.getElementById('lb2').addEventListener('click', handler)

    const result = setRating(document.body, 2)

    expect(result.value.strategy).toBe('rating-label')
    expect(handler).toHaveBeenCalled()
  })
})

describe('setRating - 별 아이콘 묶음', () => {
  test('점수 라벨이 있는 별 아이콘을 클릭한다', () => {
    document.body.innerHTML = `<div class="starRating">${[1, 2, 3, 4, 5]
      .map((score) => `<a href="#" id="st${score}" aria-label="${score}점"></a>`)
      .join('')}</div>`
    const handler = vi.fn()
    document.getElementById('st5').addEventListener('click', handler)

    const result = setRating(document.body, 5)

    // aria-label 근거가 있으면 더 앞선 전략(rating-label)이 잡을 수도 있다.
    expect(['star-container', 'rating-label']).toContain(result.value.strategy)
    expect(handler).toHaveBeenCalled()
  })

  test('점수 근거가 없는 별 아이콘은 클릭하지 않는다', () => {
    document.body.innerHTML = `<div class="starRating">${[1, 2, 3, 4, 5]
      .map((score) => `<a href="#" id="sx${score}"></a>`)
      .join('')}</div>`
    const handler = vi.fn()
    for (const star of document.querySelectorAll('a')) star.addEventListener('click', handler)

    const result = setRating(document.body, 5)

    expect(result.ok).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  test('자식이 5개가 아닌 컨테이너는 건너뛴다', () => {
    document.body.innerHTML = '<div class="starRating"><a></a><a></a></div>'

    const result = setRating(document.body, 3)

    expect(result.ok).toBe(false)
  })
})

describe('setRating - 오류 처리', () => {
  test('범위를 벗어난 별점은 거부한다', () => {
    document.body.innerHTML = hiddenRadioMarkup()

    expect(setRating(document.body, 0).ok).toBe(false)
    expect(setRating(document.body, 6).ok).toBe(false)
    expect(setRating(document.body, 'abc').ok).toBe(false)
  })

  test('별점 위젯이 없으면 안내 메시지를 반환한다', () => {
    document.body.innerHTML = '<div><p>리뷰를 작성하세요</p></div>'

    const result = setRating(document.body, 5)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('페이지 진단')
  })
})

describe('hasRatingWidget', () => {
  test('라디오 별점을 감지한다', () => {
    document.body.innerHTML = hiddenRadioMarkup()

    expect(hasRatingWidget(document.body)).toBe(true)
  })

  test('role=radio 위젯을 감지한다', () => {
    document.body.innerHTML = '<div role="radiogroup"><span role="radio"></span></div>'

    expect(hasRatingWidget(document.body)).toBe(true)
  })

  test('"5점" 라벨을 감지한다', () => {
    document.body.innerHTML = '<button aria-label="별점 5점"></button>'

    expect(hasRatingWidget(document.body)).toBe(true)
  })

  test('자식 5개인 별 컨테이너를 감지한다', () => {
    document.body.innerHTML = `<div class="starRating">${'<a></a>'.repeat(5)}</div>`

    expect(hasRatingWidget(document.body)).toBe(true)
  })

  test('별점 위젯이 없으면 false 다', () => {
    document.body.innerHTML = '<textarea placeholder="리뷰"></textarea><button>등록</button>'

    expect(hasRatingWidget(document.body)).toBe(false)
  })

  test('탐지만 하고 클릭하지 않는다', () => {
    document.body.innerHTML = hiddenRadioMarkup()
    const handler = vi.fn()
    document.body.addEventListener('click', handler)

    hasRatingWidget(document.body)

    expect(handler).not.toHaveBeenCalled()
    expect(document.querySelectorAll('input:checked')).toHaveLength(0)
  })
})
