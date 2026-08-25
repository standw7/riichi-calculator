import type { YakuRule } from './types'
import { isPinfuShape } from '../fu'
import { isTerminalOrHonor } from '../tiles'
import {
  allTilesOf, isDragonTile, sequences, sequenceStart, tripletsAndKans, windRank,
} from './helpers'

const DRAGON_IDS: Record<number, string> =
  { 5: 'haku', 6: 'hatsu', 7: 'chun' }

/** One rule per dragon, so the result can name its source. */
const dragonYakuhai: YakuRule[] = [5, 6, 7].map((rank) => ({
  id: `yakuhai-${DRAGON_IDS[rank]}`,
  closedHan: 1,
  openHan: 1,
  match: ({ interp }) => {
    const group = tripletsAndKans(interp)
      .find((g) => isDragonTile(g.tiles[0]) && g.tiles[0].rank === rank)
    return group
      ? { groups: [group], params: { source: 'dragon', dragon: DRAGON_IDS[rank] } }
      : null
  },
}))

const windYakuhai: YakuRule[] = (['seat', 'round'] as const).map((which) => ({
  id: `yakuhai-${which}`,
  closedHan: 1,
  openHan: 1,
  match: ({ interp, ctx }) => {
    const wind = which === 'seat' ? ctx.seatWind : ctx.roundWind
    const group = tripletsAndKans(interp)
      .find((g) => g.tiles[0].suit === 'z' && g.tiles[0].rank === windRank(wind))
    if (!group) return null
    const source = which === 'seat' ? 'seat-wind' : 'round-wind'
    return { groups: [group], params: { source, wind } }
  },
}))

export const ONE_HAN_YAKU: YakuRule[] = [
  {
    id: 'riichi', closedHan: 1, openHan: 0,
    match: ({ ctx }) => (ctx.riichi === 'riichi' ? {} : null),
  },
  {
    id: 'double-riichi', closedHan: 2, openHan: 0,
    supersedes: ['riichi'],
    match: ({ ctx }) => (ctx.riichi === 'double' ? {} : null),
  },
  {
    id: 'ippatsu', closedHan: 1, openHan: 0,
    match: ({ ctx }) => (ctx.ippatsu && ctx.riichi !== 'none' ? {} : null),
  },
  {
    id: 'menzen-tsumo', closedHan: 1, openHan: 0,
    match: ({ hand, closed }) => (closed && hand.winSource === 'tsumo' ? {} : null),
  },
  {
    id: 'pinfu', closedHan: 1, openHan: 0,
    match: ({ interp, hand, ctx }) => (isPinfuShape(interp, hand, ctx) ? {} : null),
  },
  {
    id: 'iipeikou', closedHan: 1, openHan: 0,
    match: ({ interp, closed }) => {
      if (!closed) return null
      const seen = new Map<number, number>()
      for (const seq of sequences(interp)) {
        const key = seq.tiles[0].suit.charCodeAt(0) * 100 + sequenceStart(seq)
        seen.set(key, (seen.get(key) ?? 0) + 1)
      }
      const pairKey = [...seen.entries()].find(([, count]) => count >= 2)?.[0]
      if (pairKey === undefined) return null
      const groups = sequences(interp).filter((seq) =>
        seq.tiles[0].suit.charCodeAt(0) * 100 + sequenceStart(seq) === pairKey).slice(0, 2)
      return { groups }
    },
  },
  {
    id: 'tanyao', closedHan: 1, openHan: 1,
    match: ({ interp, closed, rules }) => {
      if (!closed && !rules.kuitan) return null
      return allTilesOf(interp).every((t) => !isTerminalOrHonor(t)) ? {} : null
    },
  },
  ...dragonYakuhai,
  ...windYakuhai,
  {
    id: 'haitei', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.haitei ? {} : null),
  },
  {
    id: 'houtei', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.houtei ? {} : null),
  },
  {
    id: 'rinshan', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.rinshan ? {} : null),
  },
  {
    id: 'chankan', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.chankan ? {} : null),
  },
]
