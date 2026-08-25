import { describe, it, expect } from 'vitest'
import { randomWinningHand } from './generate'
import { tileId } from '../tiles'
import { validate } from '../validate'

const SEED_COUNT = 5000
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i + 1)

describe('randomWinningHand', () => {
  it('produces exactly 14 tiles (13 concealed + the winning tile) for every seed', () => {
    for (const seed of SEEDS) {
      const { hand } = randomWinningHand(seed)
      expect(hand.concealed.length, `seed ${seed}`).toBe(13)
      expect(hand.melds.length, `seed ${seed}`).toBe(0)
    }
  })

  it('never places more than 4 copies of any tile id', () => {
    for (const seed of SEEDS) {
      const { hand } = randomWinningHand(seed)
      const counts = new Array<number>(34).fill(0)
      for (const tile of [...hand.concealed, hand.winningTile]) counts[tileId(tile)] += 1
      for (const count of counts) expect(count, `seed ${seed}`).toBeLessThanOrEqual(4)
    }
  })

  it('produces a hand and context that pass validate() for every seed', () => {
    for (const seed of SEEDS) {
      const { hand, ctx } = randomWinningHand(seed)
      const result = validate(hand, ctx)
      expect(result.ok, `seed ${seed}: ${JSON.stringify(result.issues)}`).toBe(true)
    }
  })

  it('is deterministic: the same seed always produces an identical hand and context', () => {
    for (const seed of [1, 2, 3, 42, 999, 123456]) {
      const first = randomWinningHand(seed)
      const second = randomWinningHand(seed)
      expect(second, `seed ${seed}`).toEqual(first)
    }
  })

  it('never throws across a wide seed range, including seeds beyond the fuzz range', () => {
    for (let seed = 1; seed <= 20000; seed++) {
      expect(() => randomWinningHand(seed), `seed ${seed}`).not.toThrow()
    }
  })
})
