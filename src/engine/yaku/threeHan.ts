import type { YakuRule } from './types'
import { isTerminal } from '../tiles'
import { hasHonors, sequences, sequenceStart, suitsUsed } from './helpers'

export const THREE_HAN_YAKU: YakuRule[] = [
  {
    id: 'honitsu', closedHan: 3, openHan: 2,
    match: ({ interp }) =>
      (suitsUsed(interp).size <= 1 && hasHonors(interp) ? {} : null),
  },
  {
    id: 'chinitsu', closedHan: 6, openHan: 5,
    supersedes: ['honitsu'],
    match: ({ interp }) =>
      (suitsUsed(interp).size === 1 && !hasHonors(interp) ? {} : null),
  },
  {
    id: 'junchan', closedHan: 3, openHan: 2,
    supersedes: ['chanta'],
    match: ({ interp }) => {
      if (interp.structure !== 'standard') return null
      if (sequences(interp).length === 0) return null
      if (hasHonors(interp)) return null
      return interp.groups.every((g) => g.tiles.some(isTerminal)) ? {} : null
    },
  },
  {
    id: 'ryanpeikou', closedHan: 3, openHan: 0,
    supersedes: ['iipeikou'],
    match: ({ interp, closed }) => {
      if (!closed || interp.structure !== 'standard') return null
      const seqs = sequences(interp)
      if (seqs.length !== 4) return null
      const counts = new Map<string, number>()
      for (const seq of seqs) {
        const key = `${seq.tiles[0].suit}${sequenceStart(seq)}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const pairsOfSequences = [...counts.values()]
        .reduce((sum, count) => sum + Math.floor(count / 2), 0)
      return pairsOfSequences === 2 ? { groups: seqs } : null
    },
  },
]
