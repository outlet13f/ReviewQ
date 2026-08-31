import { afterEach, describe, expect, test, vi } from 'vitest'
import { createLogger } from '../src/shared/logger.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createLogger', () => {
  test('접두어와 스코프를 붙여 출력한다', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const log = createLogger('content')

    log.info('준비 완료')

    expect(spy).toHaveBeenCalledWith('[ReviewQ][content] 준비 완료')
  })

  test('추가 상세 정보를 두 번째 인자로 전달한다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const log = createLogger('background')
    const detail = new Error('실패')

    log.error('예외 발생', detail)

    expect(spy).toHaveBeenCalledWith('[ReviewQ][background] 예외 발생', detail)
  })

  test('네 가지 레벨을 모두 제공한다', () => {
    const spies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
    const log = createLogger('test')

    log.debug('d')
    log.info('i')
    log.warn('w')
    log.error('e')

    for (const spy of Object.values(spies)) expect(spy).toHaveBeenCalledTimes(1)
  })

  test('로거는 변경할 수 없다', () => {
    expect(Object.isFrozen(createLogger('x'))).toBe(true)
  })
})
