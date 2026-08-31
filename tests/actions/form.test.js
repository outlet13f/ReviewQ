// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { findFormRoot, findUncheckedAgreements, requireFormRoot, waitForForm } from '../../src/content/actions/form.js'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('findFormRoot', () => {
  test('본문 입력칸을 포함한 dialog 를 폼 루트로 고른다', () => {
    document.body.innerHTML = `
      <div role="dialog" id="layer"><textarea placeholder="리뷰"></textarea></div>
    `

    expect(findFormRoot().id).toBe('layer')
  })

  test('입력칸이 없는 dialog 는 폼으로 보지 않는다', () => {
    document.body.innerHTML = `
      <div role="dialog" id="alert"><p>알림</p></div>
      <main id="page"><textarea placeholder="리뷰"></textarea></main>
    `

    expect(findFormRoot().id).toBe('page')
  })

  test('별도 페이지 형태(레이어 없음)도 찾는다', () => {
    document.body.innerHTML = '<main id="page"><textarea placeholder="리뷰 작성"></textarea></main>'

    expect(findFormRoot().id).toBe('page')
  })

  test('별점 위젯까지 갖춘 컨테이너를 우선한다', () => {
    // dialog 가 셀렉터 순서상 먼저지만 별점이 없으므로, 별점을 갖춘 main 을 폼으로 본다.
    document.body.innerHTML = `
      <div role="dialog" id="promo"><textarea placeholder="문의 내용"></textarea></div>
      <main id="reviewPage">
        <textarea placeholder="리뷰"></textarea>
        <div role="radiogroup"><span role="radio"></span></div>
      </main>
    `

    expect(findFormRoot().id).toBe('reviewPage')
  })

  test('별점을 못 알아보면 입력칸만 있는 후보로 폴백한다', () => {
    document.body.innerHTML = '<div role="dialog" id="layer"><textarea placeholder="리뷰"></textarea></div>'

    expect(findFormRoot().id).toBe('layer')
  })

  test('입력칸이 아무데도 없으면 null 이다', () => {
    document.body.innerHTML = '<div><p>로딩 중</p></div>'

    expect(findFormRoot()).toBeNull()
  })
})

describe('requireFormRoot', () => {
  test('폼이 있으면 성공한다', () => {
    document.body.innerHTML = '<div role="dialog"><textarea placeholder="리뷰"></textarea></div>'

    expect(requireFormRoot().ok).toBe(true)
  })

  test('폼이 없으면 진단 안내를 담은 오류를 반환한다', () => {
    const result = requireFormRoot()

    expect(result.ok).toBe(false)
    expect(result.error).toContain('페이지 진단')
  })
})

describe('waitForForm', () => {
  test('이미 열려 있으면 바로 반환한다', async () => {
    document.body.innerHTML = '<div role="dialog"><textarea placeholder="리뷰"></textarea></div>'

    const result = await waitForForm(200)

    expect(result.ok).toBe(true)
  })

  test('나중에 나타나도 기다렸다가 잡는다', async () => {
    setTimeout(() => {
      document.body.innerHTML = '<div role="dialog"><textarea placeholder="리뷰"></textarea></div>'
    }, 50)

    const result = await waitForForm(1000)

    expect(result.ok).toBe(true)
  })

  test('시간 안에 안 나타나면 실패한다', async () => {
    const result = await waitForForm(100)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('리뷰 작성 폼')
  })
})

describe('findUncheckedAgreements', () => {
  test('체크되지 않은 동의 항목만 반환한다', () => {
    document.body.innerHTML = `
      <input type="checkbox" name="agreeTerms" />
      <input type="checkbox" name="agreePhoto" checked />
      <input type="checkbox" name="somethingElse" />
    `

    const found = findUncheckedAgreements(document.body)

    expect(found).toHaveLength(1)
    expect(found[0].name).toBe('agreeTerms')
  })

  test('name 과 id 셀렉터에 모두 걸려도 한 번만 반환한다', () => {
    document.body.innerHTML = '<input type="checkbox" name="agreeAll" id="agreeAll" />'

    expect(findUncheckedAgreements(document.body)).toHaveLength(1)
  })

  test('동의 항목이 없으면 빈 배열이다', () => {
    document.body.innerHTML = '<input type="checkbox" name="other" />'

    expect(findUncheckedAgreements(document.body)).toEqual([])
  })
})
