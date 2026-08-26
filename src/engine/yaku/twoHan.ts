import type { Group } from '../decompose'
import type { YakuRule } from './types'
import type { Suit } from '../types'
import { isTerminal, isTerminalOrHonor } from '../tiles'
import {
  allTilesOf, blocks, concealedTripletCount, isDragonTile,
  sequences, sequenceStart, tripletsAndKans,
} from './helpers'

const NUMBER_SUITS: readonly Suit[] = ['m', 'p', 's']

const holdsTerminalOrHonor = (group: Group): boolean =>
  group.tiles.some(isTerminalOrHonor)

export const TWO_HAN_YAKU: YakuRule[] = [
  {
    id: 'chiitoitsu', closedHan: 2, openHan: 0,
    match: ({ interp }) => (interp.structure === 'chiitoitsu' ? {} : null),
  },
  {
    id: 'ittsu', closedHan: 2, openHan: 1,
    match: ({ interp }) => {
      for (const suit of NUMBER_SUITS) {
        const inSuit = sequences(interp).filter((s) => s.tiles[0].suit === suit)
        const groups = [1, 4, 7]
          .map((start) => inSuit.find((s) => sequenceStart(s) === start))
          .filter((g): g is Group => g !== undefined)
        if (groups.length === 3) return { groups, params: { suit } }
      }
      return null
    },
  },
  {
    id: 'sanshoku-doujun', closedHan: 2, openHan: 1,
    match: ({ interp }) => {
      for (let start = 1; start <= 7; start++) {
        const groups = NUMBER_SUITS
          .map((suit) => sequences(interp)
            .find((s) => s.tiles[0].suit === suit && sequenceStart(s) === start))
          .filter((g): g is Group => g !== undefined)
        if (groups.length === 3) return { groups, params: { start } }
      }
      return null
    },
  },
  {
    id: 'sanshoku-doukou', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      for (let rank = 1; rank <= 9; rank++) {
        const groups = NUMBER_SUITS
          .map((suit) => tripletsAndKans(interp)
            .find((g) => g.tiles[0].suit === suit && g.tiles[0].rank === rank))
          .filter((g): g is Group => g !== undefined)
        if (groups.length === 3) return { groups, params: { rank } }
      }
      return null
    },
  },
  {
    id: 'toitoi', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      if (interp.structure !== 'standard') return null
      const sets = blocks(interp)
      return sets.length === 4 && sets.every((g) => g.kind !== 'sequence')
        ? { groups: sets }
        : null
    },
  },
  {
    id: 'sanankou', closedHan: 2, openHan: 2,
    match: ({ interp, hand }) =>
      (concealedTripletCount(interp, hand) >= 3 ? {} : null),
  },
  {
    id: 'sankantsu', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      const kans = interp.groups.filter((g) => g.kind === 'kan')
      return kans.length === 3 ? { groups: kans } : null
    },
  },
  {
    id: 'chanta', closedHan: 2, openHan: 1,
    match: ({ interp }) => {
      if (interp.structure !== 'standard') return null
      if (sequences(interp).length === 0) return null
      if (!interp.groups.every(holdsTerminalOrHonor)) return null
      // Distinguish from junchan: chanta requires at least one honor.
      return allTilesOf(interp).some((t) => t.suit === 'z') ? {} : null
    },
  },
  {
    id: 'honroutou', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      const tiles = allTilesOf(interp)
      if (!tiles.every(isTerminalOrHonor)) return null
      // All-terminal hands are chinroutou, a yakuman handled elsewhere.
      return tiles.some((t) => t.suit === 'z') && tiles.some(isTerminal) ? {} : null
    },
  },
  {
    id: 'shousangen', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      const dragonSets = tripletsAndKans(interp).filter((g) => isDragonTile(g.tiles[0]))
      const pair = interp.groups.find((g) => g.kind === 'pair')
      if (dragonSets.length !== 2) return null
      if (!pair || !isDragonTile(pair.tiles[0])) return null
      return { groups: [...dragonSets, pair] }
    },
  },
]
