/**
 * 네이버 호스트 판별.
 *
 * 문자열 포함 검사(`/naver\.com/.test(url)`)는 안 된다.
 * `https://evil.example.com/?ref=naver.com` 이나 `https://naver.com.attacker.io` 가 통과한다.
 * 반드시 URL 로 파싱해 호스트명 자체를 확인한다.
 */

const NAVER_SUFFIX = '.naver.com'
const HTTPS = 'https:'

/**
 * @param {unknown} value 검사할 URL 문자열
 * @param {{requireHttps?: boolean}} [options] requireHttps 기본값 true
 * @returns {boolean}
 */
export const isNaverUrl = (value, options = {}) => {
  const { requireHttps = true } = options
  if (typeof value !== 'string' || value.trim() === '') return false

  let url
  try {
    url = new URL(value)
  } catch {
    return false
  }

  // https 를 요구하지 않더라도 http(s) 외의 스킴은 받지 않는다.
  if (requireHttps ? url.protocol !== HTTPS : url.protocol !== HTTPS && url.protocol !== 'http:') {
    return false
  }
  return url.hostname.endsWith(NAVER_SUFFIX)
}
