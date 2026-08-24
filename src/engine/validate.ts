import type { Hand, Tile, WinContext } from './types'
import { tileFromId, toCounts } from './tiles'
import { allTiles, isClosed, isDealer } from './hand'

export type ValidationIssue =
  | { code: 'incomplete'; tilesNeeded: number }
  | { code: 'too-many-tiles'; excess: number }
  | { code: 'impossible-duplicates'; tile: Tile; count: number }
  | { code: 'context-conflict'; rule: string; message: string }

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

const HAND_SIZE = 14

function checkCounts(hand: Hand): ValidationIssue[] {
  // A meld occupies three slots of the 14 regardless of whether it is a kan.
  const slots = hand.concealed.length + hand.melds.length * 3 + 1
  if (slots < HAND_SIZE) return [{ code: 'incomplete', tilesNeeded: HAND_SIZE - slots }]
  if (slots > HAND_SIZE) return [{ code: 'too-many-tiles', excess: slots - HAND_SIZE }]
  return []
}

function checkDuplicates(hand: Hand, ctx: WinContext): ValidationIssue[] {
  const counts = toCounts([
    ...allTiles(hand),
    ...ctx.doraIndicators,
    ...ctx.uraIndicators,
  ])
  return counts.flatMap((count, id) =>
    count > 4
      ? [{ code: 'impossible-duplicates' as const, tile: tileFromId(id), count }]
      : [])
}

function checkContext(hand: Hand, ctx: WinContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const conflict = (rule: string, message: string): void => {
    issues.push({ code: 'context-conflict', rule, message })
  }

  if (ctx.haitei && ctx.houtei) conflict('haitei', 'A hand cannot be both haitei and houtei.')
  if (ctx.haitei && hand.winSource !== 'tsumo') conflict('haitei', 'Haitei requires a tsumo win.')
  if (ctx.houtei && hand.winSource !== 'ron') conflict('houtei', 'Houtei requires a ron win.')
  if (ctx.rinshan && hand.winSource !== 'tsumo') {
    conflict('rinshan', 'Rinshan kaihou requires a tsumo win.')
  }
  if (ctx.chankan && hand.winSource !== 'ron') conflict('chankan', 'Chankan requires a ron win.')
  if (ctx.ippatsu && ctx.riichi === 'none') {
    conflict('ippatsu', 'Ippatsu is only possible after declaring riichi.')
  }
  if (ctx.riichi !== 'none' && !isClosed(hand)) {
    conflict('riichi', 'Riichi can only be declared with a closed hand.')
  }
  if (ctx.tenhou && ctx.chiihou) {
    conflict('tenhou', 'A hand cannot be both tenhou and chiihou.')
  }
  if (ctx.tenhou && !(isDealer(ctx) && hand.winSource === 'tsumo')) {
    conflict('tenhou', 'Tenhou is a dealer-only hand won by tsumo.')
  }
  if (ctx.chiihou && !(!isDealer(ctx) && hand.winSource === 'tsumo')) {
    conflict('chiihou', 'Chiihou is a non-dealer hand won by tsumo.')
  }
  return issues
}

export function validate(hand: Hand, ctx: WinContext): ValidationResult {
  const issues = [
    ...checkCounts(hand),
    ...checkDuplicates(hand, ctx),
    ...checkContext(hand, ctx),
  ]
  return { ok: issues.length === 0, issues }
}
