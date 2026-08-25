import type { Hand, Tile, WinContext } from './types'
import type { RuleSet } from './rulesets/types'
import { allTiles } from './hand'
import { tileId } from './tiles'

export interface DoraDetail {
  indicator: Tile
  doraTile: Tile
  count: number
}

export interface DoraResult {
  dora: number
  aka: number
  ura: number
  total: number
  details: DoraDetail[]
  uraDetails: DoraDetail[]
}

/** The indicator points at the dora: 1→2 … 9→1, E→S→W→N→E, White→Green→Red→White. */
export function nextTile(indicator: Tile): Tile {
  const { suit, rank } = indicator
  if (suit !== 'z') return { suit, rank: rank === 9 ? 1 : rank + 1, red: false }
  if (rank <= 4) return { suit, rank: rank === 4 ? 1 : rank + 1, red: false }
  return { suit, rank: rank === 7 ? 5 : rank + 1, red: false }
}

function countIndicators(indicators: Tile[], tiles: Tile[]): DoraDetail[] {
  return indicators.map((indicator) => {
    const doraTile = nextTile(indicator)
    const target = tileId(doraTile)
    return {
      indicator,
      doraTile,
      count: tiles.filter((t) => tileId(t) === target).length,
    }
  })
}

const sum = (details: DoraDetail[]): number =>
  details.reduce((total, detail) => total + detail.count, 0)

export function countDora(hand: Hand, ctx: WinContext, rules: RuleSet): DoraResult {
  const tiles = allTiles(hand)

  const details = countIndicators(ctx.doraIndicators, tiles)
  const uraDetails = ctx.riichi !== 'none'
    ? countIndicators(ctx.uraIndicators, tiles)
    : []

  const dora = sum(details)
  const ura = sum(uraDetails)
  const aka = rules.akaDoraCount > 0 ? tiles.filter((t) => t.red).length : 0

  return { dora, aka, ura, total: dora + aka + ura, details, uraDetails }
}
