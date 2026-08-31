/**
 * 실행 상태 -> 팝업 표시 값 변환.
 *
 * chrome API 에 의존하지 않는 순수 함수로 두어 팝업 로직을 검증 가능하게 만든다.
 * 특히 shouldPoll 은 중요하다 — 팝업이 상태를 물어볼 때마다 서비스 워커가 깨어나므로,
 * 볼 것이 없는데 계속 물어보면 워커가 영영 잠들지 못한다.
 */

import { RUN_PHASE } from '../shared/constants.js'

const ACTIVE_PHASES = new Set([RUN_PHASE.SCANNING, RUN_PHASE.WRITING, RUN_PHASE.STOPPING])

const PHASE_LABEL = Object.freeze({
  [RUN_PHASE.IDLE]: '대기',
  [RUN_PHASE.SCANNING]: '목록 확인 중',
  [RUN_PHASE.WRITING]: '리뷰 작성 중',
  [RUN_PHASE.STOPPING]: '중단 중',
  [RUN_PHASE.DONE]: '완료',
  [RUN_PHASE.FAILED]: '실패',
})

const badgeFor = (isDryRun) =>
  isDryRun
    ? Object.freeze({ text: '드라이런', className: 'badge dry' })
    : Object.freeze({ text: '실제 등록', className: 'badge live' })

/**
 * 실행 기록이 없을 때의 화면.
 * 배지는 **현재 설정**에서 온다. 여기에 "드라이런"을 하드코딩하면
 * 드라이런을 끈 사용자에게 "등록되지 않는다"고 거짓 표시하게 된다.
 */
const idleView = (settings) =>
  Object.freeze({
    isRunning: false,
    shouldPoll: false,
    phaseLabel: PHASE_LABEL[RUN_PHASE.IDLE],
    progressText: '0 / 0',
    // 설정을 모르면 안전한 쪽(드라이런)으로 표시한다.
    badge: badgeFor(settings?.dryRun !== false),
    results: Object.freeze([]),
    notice: null,
  })

const noticeFor = (summary) => {
  if (typeof summary.error === 'string' && summary.error !== '') {
    return Object.freeze({ message: summary.error, kind: 'error' })
  }
  if (summary.phase === RUN_PHASE.DONE) {
    return Object.freeze({ message: '실행이 끝났습니다.', kind: 'ok' })
  }
  return null
}

/**
 * @param {object|null} summary run-state.summarize() 결과
 * @param {{dryRun?: boolean}} [settings] 실행 기록이 없을 때 배지를 정할 현재 설정
 * @returns {Readonly<object>} 화면에 그대로 넣을 값들
 */
export const describeRun = (summary, settings) => {
  if (!summary) return idleView(settings)

  const isRunning = ACTIVE_PHASES.has(summary.phase)
  const counts = summary.counts ?? { failed: 0 }

  return Object.freeze({
    isRunning,
    shouldPoll: isRunning,
    phaseLabel: PHASE_LABEL[summary.phase] ?? summary.phase,
    progressText: `${summary.completed ?? 0} / ${summary.limit ?? 0} (실패 ${counts.failed ?? 0})`,
    badge: badgeFor(summary.dryRun !== false),
    results: Object.freeze(summary.recent ?? []),
    notice: noticeFor(summary),
  })
}
