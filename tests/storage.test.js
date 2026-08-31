import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createStore, prependCapped } from '../src/shared/storage.js'

/** chrome.storage.StorageArea 를 흉내내는 가짜 저장소. */
const createFakeArea = (initial = {}) => {
  let data = { ...initial }
  return {
    get: vi.fn(async (key) => (key in data ? { [key]: data[key] } : {})),
    set: vi.fn(async (patch) => {
      data = { ...data, ...patch }
    }),
    remove: vi.fn(async (key) => {
      const next = { ...data }
      delete next[key]
      data = next
    }),
    snapshot: () => data,
  }
}

describe('createStore', () => {
  let area
  let store

  beforeEach(() => {
    area = createFakeArea()
    store = createStore(area)
  })

  test('없는 키는 기본값을 반환한다', async () => {
    const result = await store.read('missing', { fallback: true })

    expect(result.ok).toBe(true)
    expect(result.value).toEqual({ fallback: true })
  })

  test('쓰고 나서 읽으면 같은 값이 나온다', async () => {
    await store.write('settings', { rating: 4 })

    const result = await store.read('settings', null)

    expect(result.value).toEqual({ rating: 4 })
  })

  test('patch 는 기존 값을 변형하지 않고 새 객체를 만든다', async () => {
    const original = { rating: 4, dryRun: true }
    await store.write('settings', original)

    const patched = await store.patch('settings', { dryRun: false })

    expect(patched.value).toEqual({ rating: 4, dryRun: false })
    expect(original).toEqual({ rating: 4, dryRun: true })
    expect(Object.isFrozen(patched.value)).toBe(true)
  })

  test('저장된 값이 객체가 아니면 patch 가 새 객체로 대체한다', async () => {
    await store.write('settings', 'broken')

    const patched = await store.patch('settings', { rating: 5 })

    expect(patched.value).toEqual({ rating: 5 })
  })

  test('읽기 오류를 조용히 넘기지 않는다', async () => {
    const failing = createStore({
      get: async () => {
        throw new Error('quota')
      },
      set: async () => {},
    })

    const result = await failing.read('settings', null)

    expect(result.ok).toBe(false)
    expect(result.error).toContain('quota')
  })

  test('쓰기 오류를 보고한다', async () => {
    const failing = createStore({
      get: async () => ({}),
      set: async () => {
        throw new Error('disk full')
      },
    })

    const result = await failing.write('settings', {})

    expect(result.ok).toBe(false)
    expect(result.error).toContain('disk full')
  })

  test('remove 를 지원하지 않는 저장소는 오류를 반환한다', async () => {
    const limited = createStore({ get: async () => ({}), set: async () => {} })

    const result = await limited.remove('settings')

    expect(result.ok).toBe(false)
  })

  test('remove 는 키를 지운다', async () => {
    await store.write('runState', { phase: 'DONE' })

    await store.remove('runState')

    expect(area.snapshot().runState).toBeUndefined()
  })
})

describe('prependCapped', () => {
  test('앞쪽에 추가한다', () => {
    expect(prependCapped(['b', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  })

  test('상한을 넘으면 잘라낸다', () => {
    expect(prependCapped(['b', 'c', 'd'], 'a', 2)).toEqual(['a', 'b'])
  })

  test('원본 배열을 변형하지 않는다', () => {
    const original = ['b']

    prependCapped(original, 'a')

    expect(original).toEqual(['b'])
  })

  test('배열이 아닌 입력도 처리한다', () => {
    expect(prependCapped(null, 'a')).toEqual(['a'])
  })
})
