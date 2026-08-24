import type { Group, Interpretation } from './decompose'
import type { Hand, Tile, WinContext, Wind } from './types'
import type { RuleSet } from './rulesets/types'
import { isClosed } from './hand'
import { isTerminalOrHonor, WIND_ORDER } from './tiles'

export type WaitType = 'ryanmen' | 'penchan' | 'kanchan' | 'shanpon' | 'tanki'

export interface FuLine {
  id: string
  fu: number
  tile?: Tile
  note?: string
}

export interface FuResult {
  lines: FuLine[]
  /** Total before rounding. */
  raw: number
  /** Rounded up to the next 10, except chiitoitsu's flat 25. */
  total: number
  wait: WaitType | null
}

const windTile = (wind: Wind): number => WIND_ORDER.indexOf(wind) + 1

const isDragon = (tile: Tile): boolean => tile.suit === 'z' && tile.rank >= 5

/** A concealed triplet completed by ron is scored as an open triplet. */
export function isEffectivelyOpenTriplet(group: Group, hand: Hand): boolean {
  if (group.open) return true
  return group.containsWinningTile && hand.winSource === 'ron'
}

export function classifyWait(interp: Interpretation, hand: Hand): WaitType | null {
  const group = interp.groups.find((g) => g.containsWinningTile)
  if (!group) return null
  if (group.kind === 'pair') return 'tanki'
  if (group.kind === 'triplet') return 'shanpon'
  if (group.kind !== 'sequence') return null

  const ranks = group.tiles.map((t) => t.rank).sort((a, b) => a - b)
  const low = ranks[0]
  const won = hand.winningTile.rank

  if (won === low + 1) return 'kanchan'
  if (won === low) return low === 7 ? 'penchan' : 'ryanmen'
  return low === 1 ? 'penchan' : 'ryanmen'
}

/** Whether a pair is worth fu on its own: a dragon, the seat wind, or the round wind. */
function isValuePair(group: Group, ctx: WinContext): boolean {
  const tile = group.tiles[0]
  if (tile.suit !== 'z') return false
  if (isDragon(tile)) return true
  return tile.rank === windTile(ctx.seatWind) || tile.rank === windTile(ctx.roundWind)
}

function pairFu(group: Group, ctx: WinContext, rules: RuleSet): FuLine | null {
  const tile = group.tiles[0]
  if (!isValuePair(group, ctx)) return null

  if (isDragon(tile)) return { id: 'value-pair', fu: 2, tile, note: 'dragon' }

  const isSeat = tile.rank === windTile(ctx.seatWind)
  const isRound = tile.rank === windTile(ctx.roundWind)
  if (isSeat && isRound) {
    return { id: 'value-pair', fu: rules.doubleWindPairFu, tile, note: 'seat and round wind' }
  }
  if (isSeat) return { id: 'value-pair', fu: 2, tile, note: 'seat wind' }
  return { id: 'value-pair', fu: 2, tile, note: 'round wind' }
}

function setFu(group: Group, hand: Hand): FuLine | null {
  const tile = group.tiles[0]
  const honorOrTerminal = isTerminalOrHonor(tile)

  if (group.kind === 'kan') {
    return group.open
      ? { id: 'minkan', fu: honorOrTerminal ? 16 : 8, tile }
      : { id: 'ankan', fu: honorOrTerminal ? 32 : 16, tile }
  }

  if (group.kind !== 'triplet') return null

  if (isEffectivelyOpenTriplet(group, hand)) {
    const line: FuLine = { id: 'minko', fu: honorOrTerminal ? 4 : 2, tile }
    if (!group.open) line.note = 'completed by ron'
    return line
  }
  return { id: 'ankou', fu: honorOrTerminal ? 8 : 4, tile }
}

export function isPinfuShape(
  interp: Interpretation, hand: Hand, ctx: WinContext,
): boolean {
  if (interp.structure !== 'standard') return false
  if (!isClosed(hand)) return false

  const blocks = interp.groups.filter((g) => g.kind !== 'pair')
  if (blocks.length !== 4 || !blocks.every((g) => g.kind === 'sequence')) return false

  const pair = interp.groups.find((g) => g.kind === 'pair')
  if (!pair) return false
  // A pinfu pair may not be a dragon, the seat wind, or the round wind.
  if (isValuePair(pair, ctx)) return false

  return classifyWait(interp, hand) === 'ryanmen'
}

export function computeFu(
  interp: Interpretation, hand: Hand, ctx: WinContext, rules: RuleSet,
): FuResult {
  if (interp.structure === 'chiitoitsu') {
    return { lines: [{ id: 'chiitoitsu', fu: 25 }], raw: 25, total: 25, wait: 'tanki' }
  }
  if (interp.structure === 'kokushi') {
    return { lines: [], raw: 0, total: 0, wait: classifyWait(interp, hand) }
  }

  const closed = isClosed(hand)
  const pinfu = isPinfuShape(interp, hand, ctx)
  const wait = classifyWait(interp, hand)
  const lines: FuLine[] = [{ id: 'base', fu: 20 }]

  if (closed && hand.winSource === 'ron') lines.push({ id: 'menzen-ron', fu: 10 })
  if (hand.winSource === 'tsumo' && !pinfu) lines.push({ id: 'tsumo', fu: 2 })

  for (const group of interp.groups) {
    const line = setFu(group, hand)
    if (line) lines.push(line)
  }

  const pair = interp.groups.find((g) => g.kind === 'pair')
  if (pair) {
    const line = pairFu(pair, ctx, rules)
    if (line) lines.push(line)
  }

  if (!pinfu && wait && (wait === 'tanki' || wait === 'kanchan' || wait === 'penchan')) {
    lines.push({ id: 'wait', fu: 2, note: wait })
  }

  const raw = lines.reduce((sum, line) => sum + line.fu, 0)
  const rounded = Math.ceil(raw / 10) * 10
  // An open hand whose components total 20 fu is scored as openPinfuFu.
  const total = !closed && rounded === 20 ? rules.openPinfuFu : rounded

  return { lines, raw, total, wait }
}
