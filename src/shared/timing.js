/**
 * 작업량 기반 대기 예산 계산.
 *
 * 폼 입력은 "폼이 열리기를 기다리는 시간 + 본문을 한 글자씩 치는 시간"이 걸린다.
 * 이걸 고정 상수로 두면 설정이 허용하는 조합에서 반드시 어긋난다.
 * background 가 먼저 타임아웃되면 콘텐츠 스크립트는 아직 타이핑 중인데
 * 항목이 실패로 기록되고 탭이 목록으로 이동해 그때까지의 입력이 버려진다.
 */

import { LIMITS } from './constants.js'

/** 최악의 경우를 잡기 위해 지연 범위의 상한을 쓴다. */
const upperDelay = (range) => (Array.isArray(range) && range.length === 2 ? Math.max(range[0], range[1]) : 0)

/**
 * 본문을 다 치는 데 걸리는 최대 시간.
 * @param {{textLength: number, settings: object}} input
 * @returns {number} 밀리초
 */
export const estimateTypingMs = ({ textLength, settings }) => {
  if (settings?.humanTyping !== true) return 0
  const length = Number.isFinite(textLength) ? Math.max(0, textLength) : 0
  return length * upperDelay(settings?.delayMs?.typingChar)
}

/**
 * FILL_FORM 메시지 응답을 기다릴 시간.
 * 잘못된 설정이 실행을 영원히 붙잡지 않도록 상한을 둔다.
 * @param {{textLength: number, settings: object}} input
 * @returns {number} 밀리초
 */
export const fillFormTimeoutMs = ({ textLength, settings }) => {
  const budget =
    LIMITS.CONTENT_READY_TIMEOUT_MS + // 폼이 열리기를 기다리는 시간
    estimateTypingMs({ textLength, settings }) + // 본문 입력
    LIMITS.DEFAULT_TIMEOUT_MS // 별점 클릭·왕복 등 여유분

  return Math.round(Math.min(budget, LIMITS.MAX_FILL_TIMEOUT_MS))
}
