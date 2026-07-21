import { describe, expect, it } from 'vitest'
import { runBounded } from './bounded-run'

describe('bounded concurrent run', () => {
  it('processes every item exactly once', async () => {
    const seen: number[] = []
    await runBounded([1, 2, 3, 4, 5], 2, (item) => {
      seen.push(item)
      return Promise.resolve()
    })

    expect([...seen].sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5])
  })

  it('never exceeds the concurrency ceiling', async () => {
    let active = 0
    let peak = 0
    await runBounded(Array.from({ length: 12 }, (_, index) => index), 3, async () => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
    })

    expect(peak).toBeLessThanOrEqual(3)
    expect(active).toBe(0)
  })

  it('does not start a worker for an empty list', async () => {
    let calls = 0
    await runBounded([], 4, () => {
      calls += 1
      return Promise.resolve()
    })

    expect(calls).toBe(0)
  })
})
