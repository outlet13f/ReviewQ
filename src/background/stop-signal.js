/**
 * 중단 신호.
 *
 * 실행 상태(RUN_STATE)에 중단 플래그를 같이 두면, 오케스트레이터가 항목을 마치고
 * 자신의 상태를 통째로 저장할 때 사용자가 방금 누른 중단 요청을 덮어써 버린다.
 * 사용자는 항목 처리 중(실행 시간의 대부분)에 중단을 누르므로 이 경합은 흔하게 발생한다.
 *
 * 그래서 중단 신호는 **오케스트레이터가 절대 쓰지 않는** 별도 키에 둔다.
 * 쓰는 쪽은 서비스 워커(사용자 요청), 읽는 쪽은 오케스트레이터뿐이다.
 */

import { STORAGE_KEY } from '../shared/constants.js'

/** 사용자가 중단을 요청했다고 표시한다. */
export const requestStop = (store) => store.write(STORAGE_KEY.STOP_REQUEST, true)

/** 새 실행을 시작할 때 이전 신호를 지운다. 남아 있으면 즉시 멈춰 버린다. */
export const clearStopRequest = (store) => store.write(STORAGE_KEY.STOP_REQUEST, false)

/** @returns {Promise<boolean>} 읽기에 실패하면 실행을 계속한다(중단은 명시적 신호일 때만). */
export const isStopRequested = async (store) => {
  const result = await store.read(STORAGE_KEY.STOP_REQUEST, false)
  return result.ok && result.value === true
}
