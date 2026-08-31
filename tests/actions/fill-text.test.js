// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { fillReviewText, findTextInput } from '../../src/content/actions/fill-text.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('findTextInput', () => {
  test('검색창이 함께 있어도 리뷰 입력칸을 고른다', () => {
    document.body.innerHTML = `
      <input type="text" id="search" placeholder="검색어를 입력하세요" maxlength="100" />
      <textarea id="review" placeholder="리뷰를 남겨주세요" maxlength="1000"></textarea>
    `

    expect(findTextInput(document.body).id).toBe('review')
  })

  test('name 이 search 인 입력칸은 제외한다', () => {
    document.body.innerHTML = `
      <input type="text" id="q" name="searchKeyword" maxlength="50" />
      <textarea id="review"></textarea>
    `

    expect(findTextInput(document.body).id).toBe('review')
  })

  test('리뷰 힌트가 있는 textarea 를 우선한다', () => {
    document.body.innerHTML = `
      <textarea id="other"></textarea>
      <textarea id="review" aria-label="상품 리뷰 작성"></textarea>
    `

    expect(findTextInput(document.body).id).toBe('review')
  })

  test('contenteditable 도 후보로 잡는다', () => {
    document.body.innerHTML = '<div id="editor" contenteditable="true" aria-label="후기 입력"></div>'

    expect(findTextInput(document.body).id).toBe('editor')
  })

  test('disabled 입력칸은 제외한다', () => {
    document.body.innerHTML = '<textarea id="off" disabled></textarea><textarea id="on"></textarea>'

    expect(findTextInput(document.body).id).toBe('on')
  })

  test('숨겨진 입력칸은 제외한다', () => {
    document.body.innerHTML = '<textarea id="hidden" style="display:none"></textarea>'

    expect(findTextInput(document.body)).toBeNull()
  })

  test('후보가 없으면 null 이다', () => {
    document.body.innerHTML = '<p>입력칸 없음</p>'

    expect(findTextInput(document.body)).toBeNull()
  })
})

describe('fillReviewText', () => {
  test('본문을 입력하고 결과를 반환한다', async () => {
    document.body.innerHTML = '<textarea id="review" placeholder="리뷰"></textarea>'

    const result = await fillReviewText(document.body, '배송이 빨라서 좋았어요.', {
      humanTyping: true,
      delayFor: () => 0,
    })

    expect(result.ok).toBe(true)
    expect(document.getElementById('review').value).toBe('배송이 빨라서 좋았어요.')
    expect(result.value.length).toBe('배송이 빨라서 좋았어요.'.length)
    expect(result.value.matched).toBe(true)
  })

  test('humanTyping 을 끄면 한 번에 입력한다', async () => {
    document.body.innerHTML = '<textarea id="review" placeholder="리뷰"></textarea>'

    const result = await fillReviewText(document.body, '한 번에 입력합니다.', { humanTyping: false })

    expect(result.ok).toBe(true)
    expect(document.getElementById('review').value).toBe('한 번에 입력합니다.')
  })

  test('미리보기는 60자까지만 담는다', async () => {
    document.body.innerHTML = '<textarea placeholder="리뷰"></textarea>'
    const long = '좋'.repeat(200)

    const result = await fillReviewText(document.body, long, { humanTyping: false })

    expect(result.value.preview).toHaveLength(60)
  })

  test('빈 본문은 거부한다', async () => {
    document.body.innerHTML = '<textarea placeholder="리뷰"></textarea>'

    expect((await fillReviewText(document.body, '   ')).ok).toBe(false)
    expect((await fillReviewText(document.body, null)).ok).toBe(false)
  })

  test('입력칸이 없으면 안내 메시지를 반환한다', async () => {
    document.body.innerHTML = '<p>없음</p>'

    const result = await fillReviewText(document.body, '리뷰 본문')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('입력 필드')
  })
})
