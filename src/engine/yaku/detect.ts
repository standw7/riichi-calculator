import type { Interpretation } from '../decompose'
import type { Hand, WinContext } from '../types'
import type { RuleSet } from '../rulesets/types'
import type { YakuContext, YakuResult } from './types'
import { isClosed } from '../hand'
import { YAKU_RULES } from './registry'

export function detectYaku(
  interp: Interpretation, hand: Hand, ctx: WinContext, rules: RuleSet,
): YakuResult[] {
  const yakuContext: YakuContext = { interp, hand, ctx, rules, closed: isClosed(hand) }

  const matched: YakuResult[] = []
  for (const rule of YAKU_RULES) {
    const han = yakuContext.closed ? rule.closedHan : rule.openHan
    if (!rule.yakuman && han === 0) continue

    const evidence = rule.match(yakuContext)
    if (!evidence) continue

    const yakuman = rule.yakuman
      ? (rules.doubleYakuman ? rule.yakuman : Math.min(rule.yakuman, 1))
      : 0
    matched.push({ id: rule.id, han, yakuman, evidence })
  }

  const yakuman = matched.filter((y) => y.yakuman > 0)
  if (yakuman.length > 0) {
    if (!rules.multipleYakuman) {
      const best = yakuman.reduce((a, b) => (b.yakuman > a.yakuman ? b : a))
      return [{ ...best, yakuman: Math.min(best.yakuman, 1) }]
    }
    return applySupersession(yakuman)
  }

  return applySupersession(matched)
}

function applySupersession(results: YakuResult[]): YakuResult[] {
  const byId = new Map(YAKU_RULES.map((rule) => [rule.id, rule]))
  const absorbed = new Set(
    results.flatMap((result) => byId.get(result.id)?.supersedes ?? []))
  return results.filter((result) => !absorbed.has(result.id))
}
