// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  closestListItem,
  deepQueryAll,
  dropAncestors,
  findAllClickableByText,
  findAllIncludingHidden,
  findByLabel,
  findByText,
  findClickableByText,
  findFirstVisible,
  isDisabled,
  isVisible,
  labelFor,
  textOf,
  visibleAll,
} from '../../src/content/dom/finder.js'

const setBody = (html) => {
  document.body.innerHTML = html
}

beforeEach(() => setBody(''))

describe('isVisible', () => {
  test('일반 요소는 보이는 것으로 본다', () => {
    setBody('<button id="b">등록</button>')

    expect(isVisible(document.getElementById('b'))).toBe(true)
  })

  test('display:none 은 숨김으로 본다', () => {
    setBody('<button id="b" style="display:none">등록</button>')

    expect(isVisible(document.getElementById('b'))).toBe(false)
  })

  test('visibility:hidden 과 opacity:0 도 숨김이다', () => {
    setBody('<span id="a" style="visibility:hidden">x</span><span id="b" style="opacity:0">y</span>')

    expect(isVisible(document.getElementById('a'))).toBe(false)
    expect(isVisible(document.getElementById('b'))).toBe(false)
  })

  test('hidden 속성과 aria-hidden 을 존중한다', () => {
    setBody('<div id="a" hidden>x</div><div id="b" aria-hidden="true">y</div>')

    expect(isVisible(document.getElementById('a'))).toBe(false)
    expect(isVisible(document.getElementById('b'))).toBe(false)
  })

  test('요소가 아니면 false 다', () => {
    expect(isVisible(null)).toBe(false)
    expect(isVisible(document.createTextNode('x'))).toBe(false)
  })
})

describe('textOf', () => {
  test('공백을 정리한 텍스트를 반환한다', () => {
    setBody('<div id="a">  리뷰\n   쓰기  </div>')

    expect(textOf(document.getElementById('a'))).toBe('리뷰 쓰기')
  })

  test('요소가 없으면 빈 문자열이다', () => {
    expect(textOf(null)).toBe('')
  })
})

describe('deepQueryAll', () => {
  test('일반 DOM 에서 요소를 찾는다', () => {
    setBody('<div><button>리뷰 쓰기</button></div>')

    expect(deepQueryAll('button')).toHaveLength(1)
  })

  test('pierceShadow 옵션을 주면 shadow DOM 안쪽까지 찾는다', () => {
    setBody('<div id="host"></div>')
    const host = document.getElementById('host')
    host.attachShadow({ mode: 'open' }).innerHTML = '<button>리뷰 쓰기</button>'

    const found = deepQueryAll('button', document, { pierceShadow: true })

    expect(found).toHaveLength(1)
    expect(textOf(found[0])).toBe('리뷰 쓰기')
  })

  test('기본 호출은 전체 트리를 훑지 않는다', () => {
    // shadow root 를 찾으려고 매번 querySelectorAll('*') 를 돌리면
    // 폼 탐색 한 번에 수십 회의 전체 문서 순회가 발생한다.
    // waitForForm 은 이 탐색을 200ms 마다 최대 75회 반복한다.
    setBody('<div><button>리뷰 쓰기</button></div>')
    const documentSpy = vi.spyOn(Document.prototype, 'querySelectorAll')
    const elemSpy = vi.spyOn(Element.prototype, 'querySelectorAll')

    deepQueryAll('button')

    const selectors = [
      ...documentSpy.mock.calls.map((call) => call[0]),
      ...elemSpy.mock.calls.map((call) => call[0]),
    ]
    documentSpy.mockRestore()
    elemSpy.mockRestore()

    expect(selectors.filter((selector) => selector === '*')).toHaveLength(0)
  })
})


describe('findByText', () => {
  test('텍스트를 포함한 가장 안쪽 요소를 고른다', () => {
    setBody('<div id="outer">바깥 리뷰 쓰기 텍스트<span id="inner">리뷰 쓰기</span></div>')

    expect(findByText(['리뷰 쓰기']).id).toBe('inner')
  })

  test('exact 옵션은 완전 일치만 찾는다', () => {
    setBody('<span id="a">리뷰 쓰기 안내</span><span id="b">리뷰 쓰기</span>')

    expect(findByText(['리뷰 쓰기'], { exact: true }).id).toBe('b')
  })

  test('없으면 null 이다', () => {
    setBody('<span>다른 글자</span>')

    expect(findByText(['리뷰 쓰기'])).toBeNull()
  })
})

describe('findClickableByText', () => {
  test('버튼을 직접 찾는다', () => {
    setBody('<button id="w">리뷰 쓰기</button>')

    expect(findClickableByText(['리뷰 쓰기']).id).toBe('w')
  })

  test('span 으로 감싼 경우 가장 가까운 클릭 가능 조상을 반환한다', () => {
    setBody('<a id="link" href="#"><span><em>리뷰 쓰기</em></span></a>')

    expect(findClickableByText(['리뷰 쓰기']).id).toBe('link')
  })

  test('클릭 가능 조상이 없으면 텍스트 요소를 그대로 반환한다', () => {
    setBody('<div id="plain">리뷰 쓰기</div>')

    expect(findClickableByText(['리뷰 쓰기']).id).toBe('plain')
  })
})

describe('findAllClickableByText', () => {
  test('여러 항목을 문서 순서대로 반환한다', () => {
    setBody(`
      <li><strong>사과</strong><button>리뷰 쓰기</button></li>
      <li><strong>텀블러</strong><button>리뷰 쓰기</button></li>
    `)

    expect(findAllClickableByText(['리뷰 쓰기'])).toHaveLength(2)
  })

  test('제외 단어가 들어간 버튼은 걸러낸다', () => {
    setBody('<button>리뷰 쓰기</button><button>리뷰 쓰기 작성완료</button>')

    const found = findAllClickableByText(['리뷰 쓰기'], { exclude: ['작성완료'] })

    expect(found).toHaveLength(1)
  })

  test('숨겨진 버튼은 제외한다', () => {
    setBody('<button>리뷰 쓰기</button><button style="display:none">리뷰 쓰기</button>')

    expect(findAllClickableByText(['리뷰 쓰기'])).toHaveLength(1)
  })
})

describe('dropAncestors', () => {
  test('조상을 버리고 가장 안쪽만 남긴다', () => {
    setBody('<div id="outer"><div id="inner">x</div></div>')
    const outer = document.getElementById('outer')
    const inner = document.getElementById('inner')

    expect(dropAncestors([outer, inner])).toEqual([inner])
  })
})

describe('findAllIncludingHidden', () => {
  test('숨겨진 라디오도 찾는다', () => {
    setBody('<input type="radio" name="rating" value="5" style="display:none" />')

    expect(findAllIncludingHidden(['input[type="radio"][name*="rating" i]'])).toHaveLength(1)
    expect(visibleAll('input[type="radio"]')).toHaveLength(0)
  })

  test('중복 셀렉터로 찾아도 한 번만 반환한다', () => {
    setBody('<input type="radio" name="rating" />')

    const found = findAllIncludingHidden(['input[type="radio"]', 'input[name="rating"]'])

    expect(found).toHaveLength(1)
  })
})

describe('labelFor', () => {
  test('for 속성으로 연결된 label 을 찾는다', () => {
    setBody('<input id="star5" type="radio" /><label for="star5">5점</label>')

    expect(textOf(labelFor(document.getElementById('star5')))).toBe('5점')
  })

  test('감싸고 있는 label 을 찾는다', () => {
    setBody('<label id="wrap">5점<input id="star5" type="radio" /></label>')

    expect(labelFor(document.getElementById('star5')).id).toBe('wrap')
  })

  test('연결된 label 이 없으면 null 이다', () => {
    setBody('<input id="lonely" type="radio" />')

    expect(labelFor(document.getElementById('lonely'))).toBeNull()
  })
})

describe('findByLabel', () => {
  test('aria-label 로 찾는다', () => {
    setBody('<button id="s5" aria-label="별점 5점 선택"></button>')

    expect(findByLabel(['5점']).id).toBe('s5')
  })

  test('없으면 null 이다', () => {
    setBody('<button aria-label="닫기"></button>')

    expect(findByLabel(['5점'])).toBeNull()
  })
})

describe('isDisabled', () => {
  test('disabled 속성과 aria-disabled 를 본다', () => {
    setBody('<button id="a" disabled>등록</button><button id="b" aria-disabled="true">등록</button><button id="c">등록</button>')

    expect(isDisabled(document.getElementById('a'))).toBe(true)
    expect(isDisabled(document.getElementById('b'))).toBe(true)
    expect(isDisabled(document.getElementById('c'))).toBe(false)
  })
})

describe('closestListItem / findFirstVisible', () => {
  test('버튼이 속한 li 를 찾는다', () => {
    setBody('<ul><li id="row"><button id="btn">리뷰 쓰기</button></li></ul>')

    expect(closestListItem(document.getElementById('btn')).id).toBe('row')
  })

  test('셀렉터 후보를 순서대로 시도한다', () => {
    setBody('<div id="scope"><h4>상품명입니다</h4></div>')
    const scope = document.getElementById('scope')

    expect(textOf(findFirstVisible(['[class*="productName"]', 'h4'], scope))).toBe('상품명입니다')
  })

  test('후보가 모두 없으면 null 이다', () => {
    setBody('<div id="scope"></div>')

    expect(findFirstVisible(['strong', 'h3'], document.getElementById('scope'))).toBeNull()
  })
})
