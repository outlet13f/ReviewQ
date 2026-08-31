/**
 * 시드 기반 난수. 테스트에서 같은 시드 -> 같은 결과가 나와야 하므로
 * Math.random 을 직접 쓰지 않고 mulberry32 를 사용한다.
 */

const MULBERRY_INC = 0x6d2b79f5
const UINT32 = 4294967296

const toSeed = (value) => {
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return Math.floor(Math.abs(parsed)) % UINT32
  return 1
}

/**
 * @param {number} seed
 * @returns {Readonly<{next: () => number, int: Function, pick: Function, shuffle: Function, chance: Function}>}
 */
export const createRandom = (seed) => {
  let state = toSeed(seed)

  const next = () => {
    state = (state + MULBERRY_INC) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / UINT32
  }

  /** [min, max] 양끝 포함 정수. */
  const int = (min, max) => {
    const lo = Math.ceil(Math.min(min, max))
    const hi = Math.floor(Math.max(min, max))
    if (lo === hi) return lo
    return lo + Math.floor(next() * (hi - lo + 1))
  }

  const pick = (list) => {
    if (!Array.isArray(list) || list.length === 0) return undefined
    return list[int(0, list.length - 1)]
  }

  /** 원본 배열을 변형하지 않는 Fisher-Yates. */
  const shuffle = (list) => {
    if (!Array.isArray(list)) return []
    const copy = [...list]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = int(0, i)
      const swap = copy[i]
      copy[i] = copy[j]
      copy[j] = swap
    }
    return copy
  }

  const chance = (probability) => next() < probability

  return Object.freeze({ next, int, pick, shuffle, chance })
}

/** 실행 시점마다 달라지는 시드. 프로덕션 경로에서만 사용한다. */
export const createSystemRandom = () => createRandom(Date.now() ^ Math.floor(Math.random() * UINT32))

/** [min, max] 범위에서 지연 시간을 뽑는다. */
export const delayFromRange = (range, random) => {
  const [min, max] = Array.isArray(range) && range.length === 2 ? range : [0, 0]
  return random.int(min, max)
}
