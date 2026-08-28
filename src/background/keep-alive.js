/**
 * MV3 서비스 워커는 약 30초 유휴 시 종료된다.
 * setTimeout 은 유휴 타이머를 리셋하지 않으므로, 긴 대기 중간에 chrome API 를 한 번 호출해
 * 실행 루프가 끊기지 않게 한다.
 */

import { sleep } from '../shared/async.js'

const KEEP_ALIVE_CHUNK_MS = 20000

export const keepAliveSleep = async (totalMs) => {
  let remaining = Math.max(0, totalMs)
  while (remaining > 0) {
    const chunk = Math.min(remaining, KEEP_ALIVE_CHUNK_MS)
    await sleep(chunk)
    remaining -= chunk
    if (remaining > 0) await chrome.runtime.getPlatformInfo()
  }
}
