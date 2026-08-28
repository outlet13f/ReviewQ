// @vitest-environment jsdom
import { beforeEach, describe, expect, test } from 'vitest'
import { probePage } from '../src/content/probe.js'

beforeEach(() => {
  document.body.innerHTML = ''
  document.title = '리뷰 작성'
})

describe('probePage', () => {
  test('확장이 실제로 고른 대상을 그대로 보여준다', () => {
    document.body.innerHTML = `
      <div role="dialog" id="layer">
        <textarea id="review" placeholder="리뷰를 남겨주세요"></textarea>
        <button id="submit">리뷰 등록</button>
      </div>
    `

    const report = probePage()

    expect(report.resolved.formRoot.attributes.id).toBe('layer')
    expect(report.resolved.textInput.attributes.id).toBe('review')
    expect(report.resolved.submitButton.text).toBe('리뷰 등록')
  })

  test('리뷰 쓰기 버튼 개수를 알려준다', () => {
    document.body.innerHTML = '<button>리뷰 쓰기</button><button>리뷰 쓰기</button>'

    const report = probePage()

    expect(report.resolved.writeTriggerCount).toBe(2)
    expect(report.resolved.writeTriggers).toHaveLength(2)
  })

  test('셀렉터별 개수와 샘플을 담는다', () => {
    document.body.innerHTML = '<textarea></textarea><button>등록</button>'

    const report = probePage()

    expect(report.bySelector.textarea.count).toBe(1)
    expect(report.bySelector.button.samples[0].tag).toBe('button')
  })

  test('입력 필드의 내용은 담지 않고 길이만 남긴다', () => {
    document.body.innerHTML = '<div id="wrap"><textarea id="t">개인정보가 담긴 초안</textarea></div>'

    const report = probePage()
    const serialized = JSON.stringify(report)

    expect(serialized).not.toContain('개인정보가 담긴 초안')
    expect(report.resolved.textInput.text).toBe('')
    expect(report.resolved.textInput.contentLength).toBeGreaterThan(0)
  })

  test('입력 필드를 감싼 컨테이너 텍스트로도 내용이 새지 않는다', () => {
    document.body.innerHTML = '<div role="dialog"><textarea>비밀 초안입니다</textarea></div>'

    expect(JSON.stringify(probePage())).not.toContain('비밀 초안입니다')
  })

  test('URL 의 쿼리스트링을 제거한다', () => {
    const report = probePage()

    expect(report.url).not.toContain('?')
  })

  test('찾은 대상이 없으면 null 로 표시한다', () => {
    document.body.innerHTML = '<p>빈 페이지</p>'

    const report = probePage()

    expect(report.resolved.formRoot).toBeNull()
    expect(report.resolved.textInput).toBeNull()
    expect(report.resolved.submitButton).toBeNull()
  })
})
