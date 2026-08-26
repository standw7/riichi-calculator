import type { Hand, WinContext } from './types'
import type { RuleSet } from './rulesets/types'
import type { DoraResult } from './dora'
import type { ValidationResult } from './validate'
import { countDora } from './dora'
import { computeFu } from './fu'
import { decompose } from './decompose'
import { detectYaku } from './yaku/detect'
import { isDealer } from './hand'
import { score } from './score'
import { selectBest, type Candidate } from './select'
import { validate } from './validate'

export type CalculationStatus = 'scored' | 'invalid' | 'not-a-winning-hand' | 'no-yaku'

export interface CalculationResult {
  status: CalculationStatus
  validation: ValidationResult
  dora: DoraResult
  best: Candidate | null
  alternatives: Candidate[]
}

export function calculate(
  hand: Hand, ctx: WinContext, rules: RuleSet,
): CalculationResult {
  const validation = validate(hand, ctx)
  const dora = countDora(hand, ctx, rules)
  const empty = { validation, dora, best: null, alternatives: [] }

  if (!validation.ok) return { ...empty, status: 'invalid' }

  const interpretations = decompose(hand)
  if (interpretations.length === 0) return { ...empty, status: 'not-a-winning-hand' }

  const candidates: Candidate[] = []
  for (const interp of interpretations) {
    const yaku = detectYaku(interp, hand, ctx, rules)
    // Dora add han but are never a yaku. A hand with no yaku cannot be won.
    if (yaku.length === 0) continue

    const fu = computeFu(interp, hand, ctx, rules)
    const yakumanMultiplier = yaku.reduce((sum, y) => sum + y.yakuman, 0)
    const yakuHan = yaku.reduce((sum, y) => sum + y.han, 0)
    const han = yakumanMultiplier > 0 ? yakuHan : yakuHan + dora.total

    candidates.push({
      interp, yaku, fu, han, yakumanMultiplier,
      score: score({
        han,
        fu: fu.total,
        yakumanMultiplier,
        isDealer: isDealer(ctx),
        winSource: hand.winSource,
        honba: ctx.honba,
        riichiSticks: ctx.riichiSticks,
      }, rules),
    })
  }

  if (candidates.length === 0) return { ...empty, status: 'no-yaku' }

  const { best, alternatives } = selectBest(candidates)
  return { status: 'scored', validation, dora, best, alternatives }
}
