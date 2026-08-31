/** 접두어가 붙은 구조화 로거. 실패는 항상 남긴다. */

const PREFIX = '[ReviewQ]'

/*
 * 이 모듈이 console 을 감싸는 유일한 지점이다. 다른 파일은 createLogger 를 쓴다.
 * level 은 아래 createLogger 가 고정한 네 가지 중 하나이므로 임의 호출이 아니다.
 */
const emit = (level, scope, message, detail) => {
  const line = `${PREFIX}[${scope}] ${message}`
  if (detail === undefined) {
    // eslint-disable-next-line no-console
    console[level](line)
    return
  }
  // eslint-disable-next-line no-console
  console[level](line, detail)
}

export const createLogger = (scope) =>
  Object.freeze({
    debug: (message, detail) => emit('debug', scope, message, detail),
    info: (message, detail) => emit('info', scope, message, detail),
    warn: (message, detail) => emit('warn', scope, message, detail),
    error: (message, detail) => emit('error', scope, message, detail),
  })
