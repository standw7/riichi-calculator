import { describe, it, expect } from 'vitest'
import { selectBest, type Candidate } from './select'
import { score } from './score'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Interpretation } from './decompose'
import type { FuResult } from './fu'
import type { YakuResult } from './yaku/types'

// A minimal, honestly-typed stand-in interpretation. selectBest never inspects
// interp/yaku contents — it ranks on score.handTotal, han, then fu.total — so these
// only need to satisfy the real types, not represent a specific hand.
const interp: Interpretation = { structure: 'standard', groups: [] }

function fuResult(total: number): FuResult {
  return { lines: [{ id: 'base', fu: total }], raw: total, total, wait: null }
}

function yakuResult(id: string, han: number): YakuResult[] {
  return [{ id, name: id, han, yakuman: 0, evidence: {} }]
}

/** Builds a Candidate whose ScoreResult comes from the real score() function. */
function buildCandidate(han: number, fuTotal: number): Candidate {
  const fu = fuResult(fuTotal)
  return {
    interp,
    yaku: yakuResult(`yaku-${han}h${fuTotal}f`, han),
    fu,
    han,
    yakumanMultiplier: 0,
    score: score({
      han,
      fu: fu.total,
      yakumanMultiplier: 0,
      isDealer: false,
      winSource: 'ron',
      honba: 0,
      riichiSticks: 0,
    }, WRC_2025),
  }
}

describe('selectBest', () => {
  it('picks the highest-scoring candidate even when fed worst-first', () => {
    const worst = buildCandidate(1, 30)
    const middle = buildCandidate(2, 30)
    const best = buildCandidate(3, 30)
    // Sanity-check the fixture actually ascends before trusting the ranking assertion.
    expect(worst.score.handTotal).toBe(1000)
    expect(middle.score.handTotal).toBe(2000)
    expect(best.score.handTotal).toBe(3900)

    const result = selectBest([worst, middle, best])

    expect(result.best).toBe(best)
    expect(result.alternatives).toHaveLength(2)
    expect(result.alternatives).toContain(worst)
    expect(result.alternatives).toContain(middle)
  })

  it('breaks a handTotal tie by han, per the documented tie-break', () => {
    // 4 han 70 fu is capped at mangan by the fu formula; 5 han 30 fu is mangan directly.
    // Both land on the same 2,000 base points and therefore the same handTotal.
    const lowerHan = buildCandidate(4, 70)
    const higherHan = buildCandidate(5, 30)
    expect(lowerHan.score.handTotal).toBe(higherHan.score.handTotal)
    expect(lowerHan.han).not.toBe(higherHan.han)

    const result = selectBest([lowerHan, higherHan])

    expect(result.best).toBe(higherHan)
    expect(result.alternatives).toEqual([lowerHan])
  })
})
