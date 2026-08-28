import { describe, expect, test } from 'vitest'
import { attempt, err, isOk, ok } from '../src/shared/result.js'

describe('ok / err', () => {
  test('성공 결과는 값을 담고 얼려서 반환한다', () => {
    const result = ok(42)

    expect(result).toEqual({ ok: true, value: 42 })
    expect(Object.isFrozen(result)).toBe(true)
  })

  test('원인이 없으면 cause 키를 만들지 않는다', () => {
    expect(Object.keys(err('실패'))).toEqual(['ok', 'error'])
  })

  test('원인이 있으면 함께 담는다', () => {
    const cause = new Error('원본')

    expect(err('감싼 실패', cause).cause).toBe(cause)
  })
})

describe('isOk', () => {
  test('성공만 true 로 본다', () => {
    expect(isOk(ok(1))).toBe(true)
    expect(isOk(err('x'))).toBe(false)
    expect(isOk(null)).toBe(false)
    expect(isOk(undefined)).toBe(false)
  })
})

describe('attempt', () => {
  test('정상 반환값을 감싼다', async () => {
    const result = await attempt(() => 'value', '작업')

    expect(result).toEqual({ ok: true, value: 'value' })
  })

  test('비동기 반환값도 감싼다', async () => {
    const result = await attempt(async () => 'async', '작업')

    expect(result.value).toBe('async')
  })

  test('예외를 라벨과 함께 실패로 바꾼다', async () => {
    const result = await attempt(() => {
      throw new Error('권한 없음')
    }, '탭 조회')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('탭 조회 실패: 권한 없음')
  })

  test('Error 가 아닌 값을 던져도 처리한다', async () => {
    const result = await attempt(() => {
      throw 'string throw'
    }, '작업')

    expect(result.error).toContain('string throw')
  })

  test('원인을 보존해 디버깅할 수 있게 한다', async () => {
    const boom = new Error('boom')

    const result = await attempt(() => {
      throw boom
    }, '작업')

    expect(result.cause).toBe(boom)
  })
})
