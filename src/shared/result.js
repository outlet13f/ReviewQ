/**
 * 명시적 성공/실패 표현. 예외를 삼키지 않고 호출자가 반드시 분기하도록 강제한다.
 * 모든 값은 Object.freeze 로 반환해 호출 측 변형을 막는다.
 */

/** @returns {{ok: true, value: T}} */
export const ok = (value) => Object.freeze({ ok: true, value })

/** @returns {{ok: false, error: string, cause?: unknown}} */
export const err = (error, cause) =>
  Object.freeze(cause === undefined ? { ok: false, error } : { ok: false, error, cause })

export const isOk = (result) => result != null && result.ok === true

/** 동기/비동기 함수를 Result 로 감싼다. 절대 조용히 실패하지 않는다. */
export const attempt = async (fn, label) => {
  try {
    return ok(await fn())
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    return err(`${label} 실패: ${reason}`, cause)
  }
}
