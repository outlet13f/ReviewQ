/** 환경에 의존하지 않는 비동기 유틸. content / background 양쪽에서 공유한다. */

import { LIMITS } from './constants.js'
import { err, ok } from './result.js'

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)))

/**
 * produce() 가 truthy 를 반환할 때까지 폴링한다. 무한 대기를 만들지 않는다.
 */
export const waitFor = async (produce, options = {}) => {
  const {
    timeout = LIMITS.DEFAULT_TIMEOUT_MS,
    interval = LIMITS.POLL_INTERVAL_MS,
    label = '조건',
    now = () => Date.now(),
  } = options

  const deadline = now() + timeout
  let lastError = null

  for (;;) {
    try {
      const value = await produce()
      if (value) return ok(value)
    } catch (cause) {
      lastError = cause instanceof Error ? cause.message : String(cause)
    }
    if (now() >= deadline) break
    await sleep(interval)
  }

  const suffix = lastError ? ` (마지막 오류: ${lastError})` : ''
  return err(`${label} 대기 시간(${timeout}ms)을 초과했습니다.${suffix}`)
}

/** 프라미스에 타임아웃을 씌운다. */
export const withTimeout = async (promise, timeout, label) => {
  let timer = null
  const timeoutPromise = new Promise((resolve) => {
    timer = setTimeout(() => resolve(err(`${label} 응답이 ${timeout}ms 안에 오지 않았습니다.`)), timeout)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timer)
  }
}
