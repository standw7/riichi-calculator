import type { Hand, Meld, Tile } from './types'
import { sortTiles, tileFromId, tileId, tilesToNotation, toCounts } from './tiles'

export type GroupKind = 'sequence' | 'triplet' | 'kan' | 'pair' | 'single'

export interface Group {
  kind: GroupKind
  tiles: Tile[]
  /** True when the group came from a call. An ankan is false. */
  open: boolean
  containsWinningTile: boolean
}

export type HandStructure = 'standard' | 'chiitoitsu' | 'kokushi'

export interface Interpretation {
  structure: HandStructure
  groups: Group[]
}

const ORPHAN_IDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33] as const

export function groupKey(group: Group): string {
  const tiles = tilesToNotation(sortTiles(group.tiles))
  return `${group.kind}:${tiles}:${group.open ? 'o' : 'c'}:${group.containsWinningTile ? 'w' : '-'}`
}

const variantKey = (groups: Group[]): string => groups.map(groupKey).sort().join('|')

const makeGroup = (kind: GroupKind, tiles: Tile[], open = false): Group =>
  ({ kind, tiles, open, containsWinningTile: false })

const copies = (id: number, n: number): Tile[] =>
  Array.from({ length: n }, () => tileFromId(id))

function meldToGroup(meld: Meld): Group {
  const kind: GroupKind =
    meld.kind === 'chi' ? 'sequence' : meld.kind === 'pon' ? 'triplet' : 'kan'
  return makeGroup(kind, [...meld.tiles], meld.kind !== 'ankan')
}

function canFormSequence(counts: number[], id: number): boolean {
  if (id >= 27) return false      // honors form no sequences
  if (id % 9 > 6) return false    // would run past the end of the suit
  return counts[id] > 0 && counts[id + 1] > 0 && counts[id + 2] > 0
}

/** Depth-first extraction of exactly `needed` groups, consuming `counts` entirely. */
function extractGroups(
  counts: number[], needed: number, acc: Group[], out: Group[][],
): void {
  if (needed === 0) {
    if (counts.every((c) => c === 0)) out.push([...acc])
    return
  }
  const id = counts.findIndex((c) => c > 0)
  if (id === -1) return

  if (counts[id] >= 3) {
    counts[id] -= 3
    acc.push(makeGroup('triplet', copies(id, 3)))
    extractGroups(counts, needed - 1, acc, out)
    acc.pop()
    counts[id] += 3
  }

  if (canFormSequence(counts, id)) {
    counts[id] -= 1; counts[id + 1] -= 1; counts[id + 2] -= 1
    acc.push(makeGroup('sequence',
      [tileFromId(id), tileFromId(id + 1), tileFromId(id + 2)]))
    extractGroups(counts, needed - 1, acc, out)
    acc.pop()
    counts[id] += 1; counts[id + 1] += 1; counts[id + 2] += 1
  }
}

function standardPartitions(counts: number[], groupsNeeded: number): Group[][] {
  const partitions: Group[][] = []
  for (let id = 0; id < 34; id++) {
    if (counts[id] < 2) continue
    counts[id] -= 2
    const found: Group[][] = []
    extractGroups(counts, groupsNeeded, [], found)
    for (const groups of found) {
      partitions.push([makeGroup('pair', copies(id, 2)), ...groups])
    }
    counts[id] += 2
  }
  return partitions
}

function chiitoitsuPartition(counts: number[]): Group[] | null {
  if (!counts.every((c) => c === 0 || c === 2)) return null
  if (counts.filter((c) => c === 2).length !== 7) return null
  return counts.flatMap((c, id) => (c === 2 ? [makeGroup('pair', copies(id, 2))] : []))
}

function kokushiPartition(counts: number[]): Group[] | null {
  const orphans = new Set<number>(ORPHAN_IDS)
  for (let id = 0; id < 34; id++) {
    if (!orphans.has(id) && counts[id] !== 0) return null
  }
  const values = ORPHAN_IDS.map((id) => counts[id])
  if (values.some((c) => c < 1 || c > 2)) return null
  if (values.filter((c) => c === 2).length !== 1) return null

  return ORPHAN_IDS.map((id) =>
    counts[id] === 2
      ? makeGroup('pair', copies(id, 2))
      : makeGroup('single', copies(id, 1)))
}

/** One variant per distinct placement of the winning tile among the concealed groups. */
function placeWinningTile(groups: Group[], winId: number): Group[][] {
  const variants: Group[][] = []
  const seen = new Set<string>()

  groups.forEach((group, index) => {
    if (!group.tiles.some((t) => tileId(t) === winId)) return
    const variant = groups.map((g, i) =>
      i === index ? { ...g, containsWinningTile: true } : g)
    const key = variantKey(variant)
    if (seen.has(key)) return
    seen.add(key)
    variants.push(variant)
  })

  return variants
}

export function decompose(hand: Hand): Interpretation[] {
  const meldGroups = hand.melds.map(meldToGroup)
  const counts = toCounts([...hand.concealed, hand.winningTile])
  const winId = tileId(hand.winningTile)
  const groupsNeeded = 4 - hand.melds.length
  if (groupsNeeded < 0) return []

  const candidates: Interpretation[] = []

  for (const partition of standardPartitions(counts, groupsNeeded)) {
    for (const variant of placeWinningTile(partition, winId)) {
      candidates.push({ structure: 'standard', groups: [...variant, ...meldGroups] })
    }
  }

  if (hand.melds.length === 0) {
    for (const [structure, partition] of [
      ['chiitoitsu', chiitoitsuPartition(counts)],
      ['kokushi', kokushiPartition(counts)],
    ] as const) {
      if (!partition) continue
      for (const variant of placeWinningTile(partition, winId)) {
        candidates.push({ structure, groups: variant })
      }
    }
  }

  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.structure}|${variantKey(candidate.groups)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
