import { describe, expect, test, vi } from 'vitest'
import { sleep, waitFor, withTimeout } from '../src/shared/async.js'
import { err, ok } from '../src/shared/result.js'

describe('sleep', () => {
  test('음수도 안전하게 처리한다', async () => {
    await expect(sleep(-100)).resolves.toBeUndefined()
  })
})

describe('waitFor', () => {
  test('처음부터 참이면 즉시 성공한다', async () => {
    const produce = vi.fn(() => 'ready')

    const result = await waitFor(produce, { timeout: 500, interval: 10 })

    expect(result).toEqual(ok('ready'))
    expect(produce).toHaveBeenCalledTimes(1)
  })

  test('몇 번 폴링한 뒤 성공한다', async () => {
    let calls = 0
    const produce = () => {
      calls += 1
      return calls >= 3 ? 'ready' : null
    }

    const result = await waitFor(produce, { timeout: 1000, interval: 5 })

    expect(result.ok).toBe(true)
    expect(calls).toBe(3)
  })

  test('시간이 지나면 라벨을 담은 오류를 반환한다', async () => {
    const result = await waitFor(() => null, { timeout: 30, interval: 5, label: '리뷰 폼' })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('리뷰 폼')
    expect(result.error).toContain('30ms')
  })

  test('예외가 나도 계속 폴링하고 마지막 오류를 알려준다', async () => {
    const result = await waitFor(
      () => {
        throw new Error('아직 렌더 안 됨')
      },
      { timeout: 30, interval: 5 },
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('아직 렌더 안 됨')
  })

  test('비동기 produce 도 지원한다', async () => {
    const result = await waitFor(async () => 'async-ready', { timeout: 100, interval: 5 })

    expect(result.value).toBe('async-ready')
  })
})

describe('withTimeout', () => {
  test('제때 끝나면 원래 값을 반환한다', async () => {
    const result = await withTimeout(Promise.resolve(ok('done')), 500, '작업')

    expect(result).toEqual(ok('done'))
  })

  test('늦으면 타임아웃 오류를 반환한다', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve(ok('late')), 200))

    const result = await withTimeout(slow, 20, '메시지 전송')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('메시지 전송')
    expect(result.error).toContain('20ms')
  })

  test('실패 결과도 그대로 통과시킨다', async () => {
    const result = await withTimeout(Promise.resolve(err('내부 오류')), 500, '작업')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('내부 오류')
  })
})
