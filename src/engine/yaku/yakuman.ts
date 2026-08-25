import type { YakuRule } from './types'
import type { Tile } from '../types'
import { classifyWait } from '../fu'
import { isTerminal } from '../tiles'
import {
  allTilesOf, concealedTripletCount, hasHonors, isDragonTile,
  suitsUsed, tripletsAndKans,
} from './helpers'

const CHUUREN_PATTERN = [3, 1, 1, 1, 1, 1, 1, 1, 3]

const isGreenTile = (tile: Tile): boolean =>
  (tile.suit === 's' && [2, 3, 4, 6, 8].includes(tile.rank)) ||
  (tile.suit === 'z' && tile.rank === 6)

/** Rank counts 1-9 for a single-suit hand. */
function rankCounts(tiles: Tile[]): number[] {
  const counts = new Array<number>(9).fill(0)
  for (const tile of tiles) counts[tile.rank - 1] += 1
  return counts
}

function isChuurenShape(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false
  const counts = rankCounts(tiles)
  return counts.every((count, i) => count >= CHUUREN_PATTERN[i])
}

export const YAKUMAN_YAKU: YakuRule[] = [
  {
    id: 'kokushi', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => (interp.structure === 'kokushi' ? {} : null),
  },
  {
    id: 'kokushi-13',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['kokushi'],
    match: ({ interp }) =>
      (interp.structure === 'kokushi' &&
        interp.groups.some((g) => g.kind === 'pair' && g.containsWinningTile)
        ? {} : null),
  },
  {
    id: 'suuankou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp, hand }) =>
      (interp.structure === 'standard' && concealedTripletCount(interp, hand) === 4
        ? {} : null),
  },
  {
    id: 'suuankou-tanki',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['suuankou'],
    match: ({ interp, hand }) =>
      (interp.structure === 'standard' &&
        concealedTripletCount(interp, hand) === 4 &&
        classifyWait(interp, hand) === 'tanki'
        ? {} : null),
  },
  {
    id: 'daisangen', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => {
      const dragons = tripletsAndKans(interp).filter((g) => isDragonTile(g.tiles[0]))
      return dragons.length === 3 ? { groups: dragons } : null
    },
  },
  {
    id: 'shousuushii', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => {
      const winds = tripletsAndKans(interp)
        .filter((g) => g.tiles[0].suit === 'z' && g.tiles[0].rank <= 4)
      const pair = interp.groups.find((g) => g.kind === 'pair')
      if (winds.length !== 3) return null
      if (!pair || pair.tiles[0].suit !== 'z' || pair.tiles[0].rank > 4) return null
      return { groups: [...winds, pair] }
    },
  },
  {
    id: 'daisuushii',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['shousuushii'],
    match: ({ interp }) => {
      const winds = tripletsAndKans(interp)
        .filter((g) => g.tiles[0].suit === 'z' && g.tiles[0].rank <= 4)
      return winds.length === 4 ? { groups: winds } : null
    },
  },
  {
    id: 'tsuuiisou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) =>
      (allTilesOf(interp).every((t) => t.suit === 'z') ? {} : null),
  },
  {
    id: 'chinroutou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) =>
      (allTilesOf(interp).every(isTerminal) ? {} : null),
  },
  {
    id: 'ryuuiisou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) =>
      (allTilesOf(interp).every(isGreenTile) ? {} : null),
  },
  {
    id: 'chuuren', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp, closed }) => {
      if (!closed || hasHonors(interp) || suitsUsed(interp).size !== 1) return null
      return isChuurenShape(allTilesOf(interp)) ? {} : null
    },
  },
  {
    id: 'chuuren-9',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['chuuren'],
    match: ({ interp, hand, closed }) => {
      if (!closed || hasHonors(interp) || suitsUsed(interp).size !== 1) return null
      const tiles = allTilesOf(interp)
      if (!isChuurenShape(tiles)) return null
      // A nine-sided wait means the thirteen tiles held were exactly the pure pattern.
      const counts = rankCounts(tiles)
      counts[hand.winningTile.rank - 1] -= 1
      return counts.every((count, i) => count === CHUUREN_PATTERN[i]) ? {} : null
    },
  },
  {
    id: 'suukantsu', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => {
      const kans = interp.groups.filter((g) => g.kind === 'kan')
      return kans.length === 4 ? { groups: kans } : null
    },
  },
  {
    id: 'tenhou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ ctx }) => (ctx.tenhou ? {} : null),
  },
  {
    id: 'chiihou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ ctx }) => (ctx.chiihou ? {} : null),
  },
]
