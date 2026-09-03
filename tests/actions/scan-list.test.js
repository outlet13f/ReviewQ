// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadMoreItems, openReviewForm, scanReviewList } from '../../src/content/actions/scan-list.js'

const row = (productName, storeName, buttonText = '리뷰 쓰기', buttonId = '') =>
  `<li>
     <a href="/products/1"><strong>${productName}</strong></a>
     <a href="https://smartstore.naver.com/shop">${storeName}</a>
     <button ${buttonId ? `id="${buttonId}"` : ''}>${buttonText}</button>
   </li>`

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('scanReviewList', () => {
  test('작성 가능한 항목과 상품명/스토어명을 뽑는다', () => {
    document.body.innerHTML = `<ul>${row('유기농 사과 3kg', '행복농장')}${row('스테인리스 텀블러', '리빙샵')}</ul>`

    const result = scanReviewList()

    expect(result.ok).toBe(true)
    expect(result.value.total).toBe(2)
    expect(result.value.items[0]).toMatchObject({
      index: 0,
      key: 'name:유기농 사과 3kg',
      productName: '유기농 사과 3kg',
      storeName: '행복농장',
    })
    expect(result.value.items[1].key).toBe('name:스테인리스 텀블러')
  })

  test('이미 작성한 항목은 제외한다', () => {
    document.body.innerHTML = `<ul>${row('사과', '농장')}${row('배', '농장', '작성완료')}</ul>`

    const result = scanReviewList()

    expect(result.value.total).toBe(1)
    expect(result.value.items[0].productName).toBe('사과')
  })

  test('"한달사용기 작성" 같은 변형 문구도 인식한다', () => {
    document.body.innerHTML = `<ul>${row('노트북 파우치', '디지털샵', '한달사용기 작성')}</ul>`

    expect(scanReviewList().value.total).toBe(1)
  })

  test('상품명도 다른 텍스트도 없으면 위치로 키를 만든다', () => {
    document.body.innerHTML = '<ul><li><button>리뷰 쓰기</button></li></ul>'

    expect(scanReviewList().value.items[0].key).toBe('index:0')
  })

  test('상품명이 없어도 항목 텍스트가 다르면 서로 다른 키가 된다', () => {
    document.body.innerHTML = `
      <ul>
        <li><span>2026.08.01 주문</span><button>리뷰 쓰기</button></li>
        <li><span>2026.08.14 주문</span><button>리뷰 쓰기</button></li>
      </ul>
    `

    const [first, second] = scanReviewList().value.items

    expect(first.key).toMatch(/^text:/)
    expect(first.key).not.toBe(second.key)
  })

  test('트리거 라벨만 같은 항목들이 같은 키로 뭉치지 않는다', () => {
    document.body.innerHTML = `
      <ul>
        <li><em>A 상품</em><button>리뷰 쓰기</button></li>
        <li><em>B 상품</em><button>리뷰 쓰기</button></li>
      </ul>
    `

    const keys = new Set(scanReviewList().value.items.map((item) => item.key))

    expect(keys.size).toBe(2)
  })

  test('작성 가능한 항목이 없으면 안내 메시지를 반환한다', () => {
    document.body.innerHTML = '<ul><li>주문 내역이 없습니다</li></ul>'

    const result = scanReviewList()

    expect(result.ok).toBe(false)
    expect(result.error).toContain('로그인')
  })
})

describe('openReviewForm', () => {
  test('key 가 일치하는 항목의 버튼을 클릭한다', () => {
    document.body.innerHTML = `<ul>${row('사과', '농장', '리뷰 쓰기', 'btn-a')}${row('텀블러', '리빙샵', '리뷰 쓰기', 'btn-b')}</ul>`
    const handler = vi.fn()
    document.getElementById('btn-b').addEventListener('click', handler)

    const result = openReviewForm({ key: 'name:텀블러' })

    expect(result.ok).toBe(true)
    expect(result.value.item.productName).toBe('텀블러')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('key 를 못 찾으면 위치로 추측하지 않고 실패한다', () => {
    // 목록은 등록·더보기 접힘 등으로 수시로 바뀐다. 같은 위치가 다른 상품을 가리키면
    // A 상품용으로 만든 본문이 B 상품 폼에 입력된다.
    document.body.innerHTML = `<ul>${row('사과', '농장', '리뷰 쓰기', 'btn-a')}${row('텀블러', '리빙샵', '리뷰 쓰기', 'btn-b')}</ul>`
    const handler = vi.fn()
    document.getElementById('btn-b').addEventListener('click', handler)

    const result = openReviewForm({ key: 'name:없는상품', index: 1 })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('목록이 바뀌어')
    expect(handler).not.toHaveBeenCalled()
  })

  test('남은 항목 수를 함께 알려준다', () => {
    document.body.innerHTML = `<ul>${row('사과', '농장')}${row('텀블러', '리빙샵')}</ul>`

    expect(openReviewForm({ index: 0 }).value.remaining).toBe(2)
  })

  test('버튼이 없으면 실패한다', () => {
    document.body.innerHTML = '<ul><li>없음</li></ul>'

    expect(openReviewForm({ index: 0 }).ok).toBe(false)
  })

  test('범위를 벗어난 index 는 실패한다', () => {
    document.body.innerHTML = `<ul>${row('사과', '농장')}</ul>`

    const result = openReviewForm({ index: 5 })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('6번째')
  })
})

describe('loadMoreItems', () => {
  test('더보기 버튼을 누른다', () => {
    document.body.innerHTML = '<button id="more">더보기</button>'
    const handler = vi.fn()
    document.getElementById('more').addEventListener('click', handler)

    const result = loadMoreItems()

    expect(result.value.loaded).toBe(true)
    expect(handler).toHaveBeenCalled()
  })

  test('버튼이 없으면 loaded:false 를 반환한다', () => {
    document.body.innerHTML = '<p>끝</p>'

    expect(loadMoreItems().value.loaded).toBe(false)
  })
})
