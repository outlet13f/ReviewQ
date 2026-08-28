/**
 * 확장 UI 페이지의 접근성 마크업 회귀 테스트.
 * 브라우저 axe 감사는 CI 에서 재현하기 어려우므로 HTML/CSS 를 직접 파싱해 고정한다.
 */

import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { describe, expect, test } from 'vitest'

const readFixture = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')

const PAGES = Object.freeze({
  popup: readFixture('../src/popup/popup.html'),
  options: readFixture('../src/options/options.html'),
})
const CSS = readFixture('../src/ui/common.css')

/** WCAG 2.5.8 최소 타깃 크기. */
const MIN_TARGET_PX = 24

const docOf = (html) => new JSDOM(html).window.document

/** 라벨 안에 들어 있는 컨트롤 자체의 텍스트를 뺀 라벨 문구. */
const labelText = (label) => {
  const clone = label.cloneNode(true)
  for (const control of clone.querySelectorAll('input, select, textarea, button')) control.remove()
  return (clone.textContent ?? '').replace(/\s+/gu, ' ').trim()
}

/** 접근성 이름을 계산한다(우리 마크업에서 쓰는 방식만 다룬다). */
const accessibleName = (element, doc) => {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel) return ariaLabel.trim()

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    return labelledBy
      .split(/\s+/u)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? '')
      .join(' ')
      .trim()
  }

  const wrapping = element.closest('label')
  if (wrapping) return labelText(wrapping)

  const id = element.getAttribute('id')
  if (id) {
    const explicit = doc.querySelector(`label[for="${id}"]`)
    if (explicit) return labelText(explicit)
  }
  return ''
}

const formControls = (doc) => [...doc.querySelectorAll('input, select, textarea')]

/** CSS 선언 블록에서 한 속성 값을 읽는다. */
const declaration = (css, selector, property) => {
  const block = new RegExp(`${selector.replace(/[.[\]*]/gu, '\\$&')}\\s*\\{([^}]*)\\}`, 'u').exec(css)
  if (!block) return null
  const found = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'u').exec(block[1])
  return found ? found[1].trim() : null
}

describe.each(Object.entries(PAGES))('%s 페이지 — 폼 컨트롤 이름', (_name, html) => {
  const doc = docOf(html)

  test('모든 폼 컨트롤에 접근성 이름이 있다', () => {
    const unnamed = formControls(doc)
      .filter((control) => accessibleName(control, doc) === '')
      .map((control) => control.id || control.type)

    expect(unnamed).toEqual([])
  })

  test('서로 다른 컨트롤이 같은 이름을 갖지 않는다', () => {
    // "최대(ms)" 가 두 개면 스크린리더 사용자는 어느 쪽이 글자 간격인지 알 수 없다.
    const names = formControls(doc).map((control) => accessibleName(control, doc))
    const duplicated = names.filter((name, index) => names.indexOf(name) !== index)

    expect([...new Set(duplicated)]).toEqual([])
  })
})

describe.each(Object.entries(PAGES))('%s 페이지 — 상태 메시지', (_name, html) => {
  const doc = docOf(html)

  test('알림 영역이 라이브 리전으로 선언되어 있다', () => {
    // 저장 성공/실패 같은 피드백이 시각적으로만 바뀌면 스크린리더 사용자는 알 수 없다.
    const notice = doc.getElementById('notice')

    expect(notice).not.toBeNull()
    expect(notice.getAttribute('role')).toBe('status')
    expect(notice.getAttribute('aria-live')).toBe('polite')
  })
})

describe('popup 페이지 — 실행 모드 표시', () => {
  const doc = docOf(PAGES.popup)

  test('드라이런/실제 등록 배지도 라이브 리전이다', () => {
    // 실제 등록으로 바뀌는 것은 안전에 직결되는 정보다.
    const badge = doc.getElementById('mode-badge')

    expect(badge.getAttribute('role')).toBe('status')
  })
})

describe('터치 타깃 크기', () => {
  test('체크박스를 감싼 라벨이 최소 타깃 높이를 확보한다', () => {
    // 라벨 전체가 클릭 시 체크박스를 토글하므로 실제 타깃은 라벨이다.
    const minHeight = declaration(CSS, 'label.inline', 'min-height')

    expect(minHeight).not.toBeNull()
    expect(Number.parseInt(minHeight, 10)).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })
})
