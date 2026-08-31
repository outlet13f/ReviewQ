/**
 * 네이버 호스트 판별.
 *
 * 부분 문자열 매칭(/naver\.com/.test(url))은 공격자가 통제하는 주소를 통과시킨다.
 * 반드시 URL 로 파싱해 호스트명을 확인해야 한다.
 */

import { describe, expect, test } from 'vitest'
import { isNaverUrl } from '../src/shared/naver-url.js'

describe('isNaverUrl', () => {
  test('네이버 하위 도메인을 허용한다', () => {
    expect(isNaverUrl('https://order.pay.naver.com/home?tabMenu=REVIEW')).toBe(true)
    expect(isNaverUrl('https://new-m.pay.naver.com/myreview')).toBe(true)
    expect(isNaverUrl('https://smartstore.naver.com/shop')).toBe(true)
  })

  test('경로나 쿼리에 naver.com 이 들어간 남의 도메인을 막는다', () => {
    expect(isNaverUrl('https://evil.example.com/?ref=naver.com')).toBe(false)
    expect(isNaverUrl('https://evil.example.com/naver.com/login')).toBe(false)
  })

  test('naver.com 을 앞에 붙인 도메인을 막는다', () => {
    expect(isNaverUrl('https://naver.com.attacker.io/steal')).toBe(false)
  })

  test('naver.com 으로 끝나 보이는 유사 도메인을 막는다', () => {
    expect(isNaverUrl('https://notnaver.com/x')).toBe(false)
    expect(isNaverUrl('https://evil-naver.com/x')).toBe(false)
  })

  test('기본적으로 https 만 허용한다', () => {
    expect(isNaverUrl('http://order.pay.naver.com/home')).toBe(false)
  })

  test('requireHttps 를 끄면 http 도 허용한다', () => {
    expect(isNaverUrl('http://order.pay.naver.com/home', { requireHttps: false })).toBe(true)
  })

  test('URL 이 아닌 값을 막는다', () => {
    expect(isNaverUrl('naver.com')).toBe(false)
    expect(isNaverUrl('')).toBe(false)
    expect(isNaverUrl('   ')).toBe(false)
    expect(isNaverUrl(null)).toBe(false)
    expect(isNaverUrl(undefined)).toBe(false)
    expect(isNaverUrl(42)).toBe(false)
  })

  test('javascript: 같은 다른 스킴을 막는다', () => {
    expect(isNaverUrl('javascript:alert(1)')).toBe(false)
    expect(isNaverUrl('javascript:alert(1)', { requireHttps: false })).toBe(false)
  })
})
