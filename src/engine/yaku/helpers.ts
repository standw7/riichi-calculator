import type { Group, Interpretation } from '../decompose'
import type { Hand, Suit, Tile, Wind } from '../types'
import { isEffectivelyOpenTriplet } from '../fu'
import { WIND_ORDER } from '../tiles'

/** The four non-pair blocks of a standard hand. */
export const blocks = (interp: Interpretation): Group[] =>
  interp.groups.filter((g) => g.kind !== 'pair' && g.kind !== 'single')

export const tripletsAndKans = (interp: Interpretation): Group[] =>
  interp.groups.filter((g) => g.kind === 'triplet' || g.kind === 'kan')

export const sequences = (interp: Interpretation): Group[] =>
  interp.groups.filter((g) => g.kind === 'sequence')

export const concealedTripletCount = (interp: Interpretation, hand: Hand): number =>
  tripletsAndKans(interp).filter((g) => !isEffectivelyOpenTriplet(g, hand)).length

export const allTilesOf = (interp: Interpretation): Tile[] =>
  interp.groups.flatMap((g) => g.tiles)

export const suitsUsed = (interp: Interpretation): Set<Suit> =>
  new Set(allTilesOf(interp).filter((t) => t.suit !== 'z').map((t) => t.suit))

export const hasHonors = (interp: Interpretation): boolean =>
  allTilesOf(interp).some((t) => t.suit === 'z')

export const windRank = (wind: Wind): number => WIND_ORDER.indexOf(wind) + 1

export const isDragonTile = (tile: Tile): boolean => tile.suit === 'z' && tile.rank >= 5

/** Lowest rank of a sequence, used for sanshoku and ittsu matching. */
export const sequenceStart = (group: Group): number =>
  Math.min(...group.tiles.map((t) => t.rank))
