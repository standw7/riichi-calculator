import type { Interpretation } from './decompose'
import type { FuResult } from './fu'
import type { ScoreResult } from './score'
import type { YakuResult } from './yaku/types'

export interface Candidate {
  interp: Interpretation
  yaku: YakuResult[]
  fu: FuResult
  han: number
  yakumanMultiplier: number
  score: ScoreResult
}

/** Highest final payment wins; ties break on han, then fu. */
function rank(a: Candidate, b: Candidate): number {
  if (a.score.handTotal !== b.score.handTotal) return b.score.handTotal - a.score.handTotal
  if (a.han !== b.han) return b.han - a.han
  return b.fu.total - a.fu.total
}

export function selectBest(
  candidates: Candidate[],
): { best: Candidate | null; alternatives: Candidate[] } {
  if (candidates.length === 0) return { best: null, alternatives: [] }
  const [best, ...alternatives] = [...candidates].sort(rank)
  return { best, alternatives }
}
