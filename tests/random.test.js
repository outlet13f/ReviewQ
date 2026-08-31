import { describe, expect, test } from 'vitest'
import { createRandom, delayFromRange } from '../src/generator/random.js'

describe('createRandom', () => {
  test('같은 시드는 같은 수열을 만든다', () => {
    // Arrange
    const first = createRandom(42)
    const second = createRandom(42)

    // Act
    const left = [first.next(), first.next(), first.next()]
    const right = [second.next(), second.next(), second.next()]

    // Assert
    expect(left).toEqual(right)
  })

  test('다른 시드는 다른 수열을 만든다', () => {
    const left = createRandom(1).next()
    const right = createRandom(2).next()

    expect(left).not.toBe(right)
  })

  test('next 는 0 이상 1 미만을 반환한다', () => {
    const random = createRandom(7)

    const values = Array.from({ length: 200 }, () => random.next())

    expect(values.every((value) => value >= 0 && value < 1)).toBe(true)
  })

  test('int 는 양끝을 포함한 범위 안에 머문다', () => {
    const random = createRandom(99)

    const values = Array.from({ length: 300 }, () => random.int(3, 6))

    expect(Math.min(...values)).toBe(3)
    expect(Math.max(...values)).toBe(6)
  })

  test('int 는 min 과 max 가 같으면 그 값을 반환한다', () => {
    const random = createRandom(5)

    expect(random.int(4, 4)).toBe(4)
  })

  test('pick 은 빈 배열이나 배열이 아닌 값에 undefined 를 반환한다', () => {
    const random = createRandom(5)

    expect(random.pick([])).toBeUndefined()
    expect(random.pick(null)).toBeUndefined()
  })

  test('pick 은 목록 안의 원소만 반환한다', () => {
    const random = createRandom(11)
    const pool = ['a', 'b', 'c']

    const picks = Array.from({ length: 50 }, () => random.pick(pool))

    expect(picks.every((value) => pool.includes(value))).toBe(true)
  })

  test('shuffle 은 원본 배열을 변형하지 않는다', () => {
    const random = createRandom(3)
    const original = [1, 2, 3, 4, 5]

    const shuffled = random.shuffle(original)

    expect(original).toEqual([1, 2, 3, 4, 5])
    expect(shuffled).toHaveLength(5)
    expect([...shuffled].sort()).toEqual(original)
  })

  test('shuffle 은 배열이 아닌 입력에 빈 배열을 반환한다', () => {
    expect(createRandom(1).shuffle(undefined)).toEqual([])
  })

  test('chance(0) 은 항상 false, chance(1) 은 항상 true', () => {
    const random = createRandom(8)

    expect(Array.from({ length: 20 }, () => random.chance(0)).some(Boolean)).toBe(false)
    expect(Array.from({ length: 20 }, () => random.chance(1)).every(Boolean)).toBe(true)
  })

  test('잘못된 시드도 동작한다', () => {
    const random = createRandom('not-a-number')

    expect(typeof random.next()).toBe('number')
  })
})

describe('delayFromRange', () => {
  test('범위 안의 지연 시간을 반환한다', () => {
    const random = createRandom(21)

    const delay = delayFromRange([100, 200], random)

    expect(delay).toBeGreaterThanOrEqual(100)
    expect(delay).toBeLessThanOrEqual(200)
  })

  test('범위 형식이 잘못되면 0 을 반환한다', () => {
    const random = createRandom(21)

    expect(delayFromRange(null, random)).toBe(0)
    expect(delayFromRange([1, 2, 3], random)).toBe(0)
  })
})
