import { describe, it, expect } from 'vitest'
import { randomWinningHand } from './generate'
import { calculate } from '../calculate'
import { decompose } from '../decompose'
import { toCounts } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'

const SEEDS = Array.from({ length: 2000 }, (_, i) => i + 1)

describe('fuzz invariants', () => {
  it('never throws and never returns an inconsistent status', () => {
    for (const seed of SEEDS) {
      const { hand, ctx } = randomWinningHand(seed)
      const result = calculate(hand, ctx, WRC_2025)
      if (result.status === 'scored') {
        expect(result.best, `seed ${seed}`).not.toBeNull()
        expect(result.best!.yaku.length, `seed ${seed}`).toBeGreaterThan(0)
      } else {
        expect(result.best, `seed ${seed}`).toBeNull()
      }
    }
  })

  it('always produces a winning decomposition for a generated hand', () => {
    for (const seed of SEEDS) {
      const { hand } = randomWinningHand(seed)
      expect(decompose(hand).length, `seed ${seed}`).toBeGreaterThan(0)
    }
  })

  it('conserves tiles across every interpretation', () => {
    for (const seed of SEEDS) {
      const { hand } = randomWinningHand(seed)
      const expected = toCounts([...hand.concealed, hand.winningTile])
      for (const interp of decompose(hand)) {
        expect(toCounts(interp.groups.flatMap((g) => g.tiles)), `seed ${seed}`)
          .toEqual(expected)
      }
    }
  })

  it('never ranks an alternative above the best', () => {
    for (const seed of SEEDS) {
      const { hand, ctx } = randomWinningHand(seed)
      const result = calculate(hand, ctx, WRC_2025)
      if (result.status !== 'scored') continue
      for (const alt of result.alternatives) {
        expect(alt.score.handTotal, `seed ${seed}`)
          .toBeLessThanOrEqual(result.best!.score.handTotal)
      }
    }
  })

  it('keeps fu a positive multiple of 10, or exactly 25 for chiitoitsu', () => {
    for (const seed of SEEDS) {
      const { hand, ctx } = randomWinningHand(seed)
      const result = calculate(hand, ctx, WRC_2025)
      if (result.status !== 'scored') continue
      const fu = result.best!.fu.total
      const ok = fu === 25 || (fu >= 20 && fu % 10 === 0)
      expect(ok, `seed ${seed} produced ${fu} fu`).toBe(true)
    }
  })
})
