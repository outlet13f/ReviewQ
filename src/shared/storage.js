/**
 * chrome.storage 얇은 래퍼. 저장 영역을 주입할 수 있어 테스트 가능하다.
 * 모든 반환값은 새 객체 — 저장된 값을 직접 변형하지 않는다.
 */

import { LIMITS } from './constants.js'
import { attempt, err, ok } from './result.js'

const resolveArea = (name) => {
  const api = globalThis.chrome?.storage?.[name]
  if (!api) throw new Error(`chrome.storage.${name} 를 사용할 수 없습니다.`)
  return api
}

/**
 * @param {{get: Function, set: Function, remove?: Function}} area
 */
export const createStore = (area) => {
  const read = async (key, fallback) => {
    const result = await attempt(() => area.get(key), `저장소 읽기(${key})`)
    if (!result.ok) return result
    const value = result.value?.[key]
    return ok(value === undefined ? fallback : value)
  }

  const write = async (key, value) => attempt(() => area.set({ [key]: value }), `저장소 쓰기(${key})`)

  /** 기존 객체를 변형하지 않고 새 객체를 만들어 저장한다. */
  const patch = async (key, changes) => {
    const current = await read(key, {})
    if (!current.ok) return current
    const base = typeof current.value === 'object' && current.value !== null ? current.value : {}
    const next = Object.freeze({ ...base, ...changes })
    const written = await write(key, next)
    if (!written.ok) return written
    return ok(next)
  }

  const remove = async (key) => {
    if (typeof area.remove !== 'function') return err('저장소가 remove 를 지원하지 않습니다.')
    return attempt(() => area.remove(key), `저장소 삭제(${key})`)
  }

  return Object.freeze({ read, write, patch, remove })
}

/** 리스트 앞쪽에 항목을 추가하고 상한을 넘으면 잘라낸다. 원본 배열은 그대로 둔다. */
export const prependCapped = (list, item, cap = LIMITS.MAX_LIST_ENTRIES) => {
  const safeList = Array.isArray(list) ? list : []
  return Object.freeze([item, ...safeList].slice(0, Math.max(1, cap)))
}

export const localStore = () => createStore(resolveArea('local'))
export const sessionStore = () => createStore(resolveArea('session'))
