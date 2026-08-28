/**
 * 실행 시작/중단 가능 여부 판단.
 *
 * MV3 서비스 워커는 실행 도중 언제든 종료될 수 있다. 그러면 실행 루프가 사라져
 * 저장된 상태가 WRITING 에 고정되고, 아무도 DONE 으로 바꿔 주지 않는다.
 * 이때 시작도 중단도 막히면 확장이 브라우저 세션 내내 못 쓰게 된다.
 */

import { describe, expect, test } from 'vitest'
import { RUN_PHASE } from '../src/shared/constants.js'
import { canStartRun, resolveStopAction, STOP_ACTION } from '../src/background/run-guard.js'

const NOW = 1_000_000
const MINUTE = 60_000

const stateAt = (phase, lastActivityAt, results = []) => ({
  phase,
  startedAt: lastActivityAt,
  results,
})

describe('canStartRun', () => {
  test('저장된 실행 상태가 없으면 시작할 수 있다', () => {
    const result = canStartRun({ persistedState: null, workerRunId: null, now: NOW })

    expect(result.allowed).toBe(true)
  })

  test('끝난 실행이 남아 있어도 시작할 수 있다', () => {
    const result = canStartRun({
      persistedState: stateAt(RUN_PHASE.DONE, NOW - MINUTE),
      workerRunId: null,
      now: NOW,
    })

    expect(result.allowed).toBe(true)
  })

  test('실패로 끝난 실행이 남아 있어도 시작할 수 있다', () => {
    const result = canStartRun({
      persistedState: stateAt(RUN_PHASE.FAILED, NOW - MINUTE),
      workerRunId: null,
      now: NOW,
    })

    expect(result.allowed).toBe(true)
  })

  test('이 워커에서 실제로 실행 중이면 막는다', () => {
    const result = canStartRun({
      persistedState: stateAt(RUN_PHASE.WRITING, NOW),
      workerRunId: 'run-1',
      now: NOW,
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('이미 실행 중')
  })

  test('방금 진행된 실행 상태가 있으면 막는다', () => {
    const result = canStartRun({
      persistedState: stateAt(RUN_PHASE.WRITING, NOW - 5_000),
      workerRunId: null,
      now: NOW,
    })

    expect(result.allowed).toBe(false)
  })

  test('워커가 죽어 오래 멈춘 실행 상태는 유령으로 보고 시작을 허용한다', () => {
    const result = canStartRun({
      persistedState: stateAt(RUN_PHASE.WRITING, NOW - 10 * MINUTE),
      workerRunId: null,
      now: NOW,
    })

    expect(result.allowed).toBe(true)
    expect(result.reason).toContain('중단된')
  })

  test('STOPPING 상태로 굳은 것도 유령으로 처리한다', () => {
    const result = canStartRun({
      persistedState: stateAt(RUN_PHASE.STOPPING, NOW - 10 * MINUTE),
      workerRunId: null,
      now: NOW,
    })

    expect(result.allowed).toBe(true)
  })

  test('마지막 항목 처리 시각을 활동 시각으로 본다', () => {
    // 시작은 오래됐지만 방금 항목을 처리했다면 살아 있는 실행이다.
    const result = canStartRun({
      persistedState: stateAt(RUN_PHASE.WRITING, NOW - 30 * MINUTE, [{ at: NOW - 3_000 }]),
      workerRunId: null,
      now: NOW,
    })

    expect(result.allowed).toBe(false)
  })

  test('활동 시각을 알 수 없으면 유령으로 보지 않는다', () => {
    const result = canStartRun({
      persistedState: { phase: RUN_PHASE.WRITING },
      workerRunId: null,
      now: NOW,
    })

    expect(result.allowed).toBe(false)
  })
})

describe('resolveStopAction', () => {
  test('실행 상태가 없으면 할 일이 없다', () => {
    const result = resolveStopAction({ persistedState: null, workerRunId: null, now: NOW })

    expect(result.action).toBe(STOP_ACTION.NONE)
    expect(result.message).toContain('실행 중인 작업이 없습니다')
  })

  test('이미 끝난 실행은 할 일이 없다', () => {
    const result = resolveStopAction({
      persistedState: stateAt(RUN_PHASE.DONE, NOW - MINUTE),
      workerRunId: null,
      now: NOW,
    })

    expect(result.action).toBe(STOP_ACTION.NONE)
  })

  test('이 워커에서 실행 중이면 신호만 보낸다', () => {
    const result = resolveStopAction({
      persistedState: stateAt(RUN_PHASE.WRITING, NOW),
      workerRunId: 'run-1',
      now: NOW,
    })

    expect(result.action).toBe(STOP_ACTION.SIGNAL)
    expect(result.message).toContain('현재 항목을 마치고')
  })

  test('루프가 없는데 활성 상태로 남아 있으면 직접 정리한다', () => {
    // 신호를 보내 봐야 받아 줄 루프가 없다. 상태를 끝냄으로 확정해야 교착이 풀린다.
    const result = resolveStopAction({
      persistedState: stateAt(RUN_PHASE.WRITING, NOW - 10 * MINUTE),
      workerRunId: null,
      now: NOW,
    })

    expect(result.action).toBe(STOP_ACTION.FINALIZE)
    expect(result.message).toContain('정리')
  })

  test('STOPPING 으로 굳은 상태도 직접 정리한다', () => {
    const result = resolveStopAction({
      persistedState: stateAt(RUN_PHASE.STOPPING, NOW - 10 * MINUTE),
      workerRunId: null,
      now: NOW,
    })

    expect(result.action).toBe(STOP_ACTION.FINALIZE)
  })
})
