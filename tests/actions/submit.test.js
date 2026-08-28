// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { findSubmitButton, submitReview } from '../../src/content/actions/submit.js'

const SHORT_TIMEOUT = 120

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('findSubmitButton', () => {
  test('취소를 무시하고 등록 버튼을 찾는다', () => {
    document.body.innerHTML = '<button id="cancel">취소</button><button id="submit">등록</button>'

    expect(findSubmitButton(document.body).id).toBe('submit')
  })

  test('"리뷰 등록" 을 일반 "등록" 보다 우선한다', () => {
    document.body.innerHTML = '<button id="generic">등록</button><button id="review">리뷰 등록</button>'

    expect(findSubmitButton(document.body).id).toBe('review')
  })

  test('임시저장은 제외한다', () => {
    document.body.innerHTML = '<button id="temp">임시저장</button><button id="submit">저장</button>'

    expect(findSubmitButton(document.body).id).toBe('submit')
  })

  test('disabled 버튼은 제외한다', () => {
    document.body.innerHTML = '<button id="off" disabled>등록</button><button id="on">등록하기</button>'

    expect(findSubmitButton(document.body).id).toBe('on')
  })

  test('없으면 null 이다', () => {
    document.body.innerHTML = '<button>닫기</button>'

    expect(findSubmitButton(document.body)).toBeNull()
  })
})

describe('submitReview', () => {
  test('드라이런이면 버튼을 누르지 않는다', async () => {
    document.body.innerHTML = '<button id="submit">리뷰 등록</button>'
    const handler = vi.fn()
    document.getElementById('submit').addEventListener('click', handler)

    const result = await submitReview(document.body, { dryRun: true })

    expect(result.ok).toBe(true)
    expect(result.value.dryRun).toBe(true)
    expect(result.value.submitted).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  test('드라이런에서도 어떤 버튼을 누를지 알려준다', async () => {
    document.body.innerHTML = '<button>리뷰 등록</button>'

    const result = await submitReview(document.body, { dryRun: true })

    expect(result.value.buttonText).toBe('리뷰 등록')
  })

  test('실제 등록 시 성공 문구로 확인한다', async () => {
    document.body.innerHTML = '<div id="form"><button id="submit">리뷰 등록</button></div>'
    document.getElementById('submit').addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', '<p>리뷰가 등록되었습니다</p>')
    })

    const result = await submitReview(document.getElementById('form'), { dryRun: false, timeout: SHORT_TIMEOUT })

    expect(result.ok).toBe(true)
    expect(result.value.submitted).toBe(true)
    expect(result.value.evidence).toBe('success-text')
  })

  test('성공 문구가 없어도 폼이 닫히면 등록으로 본다', async () => {
    document.body.innerHTML = '<div id="form"><button id="submit">리뷰 등록</button></div>'
    document.getElementById('submit').addEventListener('click', () => {
      document.getElementById('form').remove()
    })

    const result = await submitReview(document.getElementById('form'), { dryRun: false, timeout: SHORT_TIMEOUT })

    expect(result.ok).toBe(true)
    expect(result.value.evidence).toBe('form-closed')
  })

  test('폼이 그대로 남아 있으면 실패로 보고한다', async () => {
    document.body.innerHTML = '<div id="form"><button id="submit">리뷰 등록</button></div>'

    const result = await submitReview(document.getElementById('form'), { dryRun: false, timeout: SHORT_TIMEOUT })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('확인하지 못했습니다')
  })

  test('리뷰 본문에 성공 문구가 들어 있어도 등록 성공으로 오판하지 않는다', async () => {
    // 기본 템플릿의 마무리 문장 "잘 쓰겠습니다, 감사합니다." 가 실제로 9.7% 확률로 생성된다.
    // 이 본문이 폼에 입력된 상태에서는 body 전체 검색이 항상 성공을 오탐한다.
    document.body.innerHTML = `
      <div id="form">
        <textarea>배송이 빨랐어요. 잘 쓰겠습니다, 감사합니다.</textarea>
        <button id="submit">리뷰 등록</button>
      </div>
    `

    // 클릭해도 폼이 그대로 남는다 = 등록 실패 상황
    const result = await submitReview(document.getElementById('form'), { dryRun: false, timeout: SHORT_TIMEOUT })

    expect(result.ok).toBe(false)
  })

  test('클릭 전부터 있던 안내 문구를 성공으로 오판하지 않는다', async () => {
    // 네이버 리뷰 폼에는 "리뷰 작성 시 최대 500원 적립" 같은 유인 문구가 상시 표시된다.
    document.body.innerHTML = `
      <div id="form">
        <p>리뷰 작성 시 최대 500원 적립</p>
        <button id="submit">리뷰 등록</button>
      </div>
    `

    const result = await submitReview(document.getElementById('form'), { dryRun: false, timeout: SHORT_TIMEOUT })

    expect(result.ok).toBe(false)
  })

  test('클릭 후 새로 나타난 성공 문구만 등록 성공으로 인정한다', async () => {
    document.body.innerHTML = `
      <div id="form">
        <p>리뷰 작성 시 최대 500원 적립</p>
        <button id="submit">리뷰 등록</button>
      </div>
    `
    document.getElementById('submit').addEventListener('click', () => {
      document.body.insertAdjacentHTML('beforeend', '<p>리뷰가 등록되었습니다</p>')
    })

    const result = await submitReview(document.getElementById('form'), { dryRun: false, timeout: SHORT_TIMEOUT })

    expect(result.ok).toBe(true)
    expect(result.value.evidence).toBe('success-text')
  })

  test('등록 버튼이 없으면 안내 메시지를 반환한다', async () => {
    document.body.innerHTML = '<button>닫기</button>'

    const result = await submitReview(document.body, { dryRun: true })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('페이지 진단')
  })

  test('미체크 동의 체크박스를 자동 체크하지 않고 경고로 알린다', async () => {
    document.body.innerHTML = `
      <div id="form">
        <input type="checkbox" name="agreeTerms" id="agree" />
        <button>리뷰 등록</button>
      </div>
    `

    const result = await submitReview(document.getElementById('form'), { dryRun: true })

    expect(result.value.warnings).toHaveLength(1)
    expect(result.value.warnings[0]).toContain('agreeTerms')
    expect(document.getElementById('agree').checked).toBe(false)
  })
})
