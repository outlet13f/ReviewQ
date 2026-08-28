/**
 * 모듈 경계를 가로지르는 불변식.
 * 각 모듈은 단독으로는 올바른데 조합했을 때 깨지는 종류의 결함을 잡는다.
 */

import { describe, expect, test } from 'vitest'
import { composeReview } from '../src/generator/template-engine.js'
import { createRandom } from '../src/generator/random.js'
import { BUILT_IN_TEMPLATE_SETS } from '../src/generator/templates/index.js'
import { FORM } from '../src/content/dom/selectors.js'
import { DEFAULT_REVIEW_LIST_URL } from '../src/shared/settings.js'
import { readFileSync } from 'node:fs'

const SAMPLE_COUNT = 300
const RATINGS = [5, 4, 3, 2, 1]

const generate = (templateSet, rating, seed) =>
  composeReview({ templateSet, rating, random: createRandom(seed), minLength: 20 })

describe('생성기 x 등록 판정기', () => {
  /**
   * 생성한 리뷰 본문이 성공 판정 문구를 포함하면, 그 본문을 폼에 입력하는 순간
   * 페이지에 해당 문구가 존재하게 되어 등록 성공이 오탐된다.
   * 실제로 기본 세트의 "잘 쓰겠습니다, 감사합니다." 가 9.7% 확률로 생성됐다.
   */
  test('생성되는 리뷰 본문은 등록 성공 판정 문구를 포함하지 않는다', () => {
    const collisions = []

    for (const templateSet of BUILT_IN_TEMPLATE_SETS) {
      for (const rating of RATINGS) {
        for (let seed = 0; seed < SAMPLE_COUNT; seed += 1) {
          const result = generate(templateSet, rating, seed)
          if (!result.ok) continue

          const hit = FORM.successTexts.find((needle) => result.value.text.includes(needle))
          if (hit) collisions.push(`[${templateSet.id}/${rating}점] "${hit}" <- ${result.value.text.slice(0, 40)}`)
        }
      }
    }

    expect(collisions.slice(0, 3).join('\n')).toBe('')
  })

  /**
   * 성공 판정 문구가 너무 일반적이면 리뷰 폼에 상시 표시되는 안내 문구
   * ("리뷰 작성 시 최대 500원 적립")와 충돌한다.
   */
  test('등록 성공 판정 문구는 완료를 뜻하는 구체적 표현이다', () => {
    const tooGeneric = ['적립', '감사합니다', '포인트', '리뷰']

    const offenders = FORM.successTexts.filter((needle) => tooGeneric.includes(needle))

    expect(offenders).toEqual([])
  })
})

const MANIFEST = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'))

/**
 * Chrome 매치 패턴 판정.
 * "*.example.com" 이 맨 도메인 example.com 까지 매칭하는지는 문서 표현이 모호하다.
 * 여기서는 **좁은 해석**(서브도메인만)으로 판정한다 — 그래야 manifest 가 맨 도메인을
 * 명시하게 되고, 어느 해석에서도 동작한다.
 */
const matchesPattern = (pattern, url) => {
  const parsed = /^(\*|https?):\/\/([^/]+)(\/.*)$/u.exec(pattern)
  if (!parsed) return false
  const [, scheme, host, path] = parsed

  const target = new URL(url)
  if (scheme !== '*' && `${scheme}:` !== target.protocol) return false

  const hostMatches =
    host === '*'
      ? true
      : host.startsWith('*.')
        ? target.hostname.endsWith(`.${host.slice(2)}`) // 좁은 해석: 서브도메인만
        : target.hostname === host

  if (!hostMatches) return false

  const pathRegex = new RegExp(`^${path.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, '\\$&')).join('.*')}$`, 'u')
  return pathRegex.test(`${target.pathname}${target.search}`)
}

describe('manifest x 기본 설정', () => {
  test('기본 리뷰 목록 URL 이 host_permissions 에 포함된다', () => {
    // 포함되지 않으면 탭 조회와 콘텐츠 스크립트 주입이 전부 실패한다.
    const covered = MANIFEST.host_permissions.some((pattern) => matchesPattern(pattern, DEFAULT_REVIEW_LIST_URL))

    expect(covered, `${DEFAULT_REVIEW_LIST_URL} 를 덮는 host_permissions 가 없습니다`).toBe(true)
  })

  test('기본 리뷰 목록 URL 에 콘텐츠 스크립트가 주입된다', () => {
    const matches = MANIFEST.content_scripts.flatMap((entry) => entry.matches)
    const covered = matches.some((pattern) => matchesPattern(pattern, DEFAULT_REVIEW_LIST_URL))

    expect(covered, `${DEFAULT_REVIEW_LIST_URL} 를 덮는 content_scripts matches 가 없습니다`).toBe(true)
  })

  test('매치 패턴 판정기가 올바르게 동작한다', () => {
    expect(matchesPattern('*://*.naver.com/*', 'https://shopping.naver.com/x')).toBe(true)
    expect(matchesPattern('*://shopping.naver.com/*', 'https://shopping.naver.com/x')).toBe(true)
    expect(matchesPattern('*://*.shopping.naver.com/*', 'https://m.shopping.naver.com/x')).toBe(true)
    expect(matchesPattern('*://*.shopping.naver.com/*', 'https://evil.com/x')).toBe(false)
    expect(matchesPattern('https://shopping.naver.com/*', 'http://shopping.naver.com/x')).toBe(false)
  })
})
