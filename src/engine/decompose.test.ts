import { describe, it, expect } from 'vitest'
import { decompose, type Interpretation } from './decompose'
import { parseTiles, sortTiles, tilesToNotation, toCounts } from './tiles'
import type { Hand, Meld } from './types'

const hand = (concealed: string, winning: string, overrides: Partial<Hand> = {}): Hand => ({
  concealed: parseTiles(concealed),
  melds: [],
  winningTile: parseTiles(winning)[0],
  winSource: 'ron',
  ...overrides,
})

/** Renders an interpretation as a stable, readable string for assertions. */
const render = (interp: Interpretation): string =>
  interp.groups
    .map((g) => tilesToNotation(sortTiles(g.tiles)) + (g.containsWinningTile ? '*' : ''))
    .sort()
    .join(' ')

const renderAll = (interps: Interpretation[]): string[] => interps.map(render).sort()

describe('decompose — standard hands', () => {
  it('finds the single interpretation of an unambiguous hand', () => {
    const result = decompose(hand('123m456m789m123p1s', '1s'))
    expect(result).toHaveLength(1)
    expect(result[0].structure).toBe('standard')
    expect(render(result[0])).toBe('11s* 123m 123p 456m 789m')
  })

  it('finds both the triplet and sequence readings of 111222333m', () => {
    const result = decompose(hand('111222333m456p9s', '9s'))
    expect(renderAll(result)).toEqual([
      '111m 222m 333m 456p 99s*',
      '123m 123m 123m 456p 99s*',
    ])
  })

  it('finds both partitions of an ambiguous 22334455m block', () => {
    const result = decompose(hand('22334455m678p99s', '9s'))
    expect(renderAll(result)).toEqual([
      '22m 345m 345m 678p 999s*',
      '234m 234m 55m 678p 999s*',
    ])
  })

  it('does not build a sequence across a suit boundary', () => {
    // 9m 1p 2p would be a valid run only if sequences could cross suits.
    // Everything else resolves: 345p, 678p, 123s, 99s. So the only reading
    // that completes this hand is the illegal one, and there must be none.
    const result = decompose(hand('9m12345678p1239s', '9s'))
    expect(result).toHaveLength(0)
  })

  it('returns no interpretations for a hand that is not a winning shape', () => {
    expect(decompose(hand('123m456m789m135p1s', '1s'))).toHaveLength(0)
  })
})

describe('decompose — winning tile assignment', () => {
  it('marks exactly one group as containing the winning tile', () => {
    for (const interp of decompose(hand('111222333m456p9s', '9s'))) {
      expect(interp.groups.filter((g) => g.containsWinningTile)).toHaveLength(1)
    }
  })

  it('collapses placements that yield an identical group multiset', () => {
    // The winning 1m could sit in either 123m, but the two readings are the same hand.
    const result = decompose(hand('12312m456m789m99p', '3m'))
    expect(renderAll(result)).toEqual(['123m 123m* 456m 789m 99p'])
  })

  it('enumerates placements that differ, so fu can differ', () => {
    // Holding 1123m and winning on 1m, the winning tile can complete either the
    // 11m pair (a tanki wait, 2 fu) or the 123m sequence (a ryanmen wait, 0 fu).
    const result = decompose(hand('1123m456p789s234s', '1m'))
    expect(renderAll(result)).toEqual([
      '11m 123m* 234s 456p 789s',
      '11m* 123m 234s 456p 789s',
    ])
    for (const interp of result) {
      expect(interp.groups.filter((g) => g.containsWinningTile)).toHaveLength(1)
    }
  })
})

describe('decompose — melds', () => {
  const pon = (notation: string): Meld => ({
    kind: 'pon', tiles: parseTiles(notation), calledTile: parseTiles(notation)[0],
  })
  const ankan = (notation: string): Meld => ({ kind: 'ankan', tiles: parseTiles(notation) })

  it('treats a meld as one of the four groups', () => {
    const result = decompose(hand('123m456m789m1s', '1s', { melds: [pon('111p')] }))
    expect(result).toHaveLength(1)
    expect(render(result[0])).toBe('111p 11s* 123m 456m 789m')
  })

  it('marks a called meld as open and an ankan as closed', () => {
    const open = decompose(hand('123m456m789m1s', '1s', { melds: [pon('111p')] }))[0]
    expect(open.groups.find((g) => g.kind === 'triplet')?.open).toBe(true)

    const closed = decompose(hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] }))[0]
    const kan = closed.groups.find((g) => g.kind === 'kan')
    expect(kan?.open).toBe(false)
    expect(kan?.tiles).toHaveLength(4)
  })
})

describe('decompose — seven pairs', () => {
  it('recognises chiitoitsu', () => {
    const result = decompose(hand('1122m3344p5566s7z', '7z'))
    expect(result.map((r) => r.structure)).toEqual(['chiitoitsu'])
    expect(result[0].groups).toHaveLength(7)
    expect(result[0].groups.every((g) => g.kind === 'pair')).toBe(true)
  })

  it('rejects four-of-a-kind as two pairs', () => {
    const result = decompose(hand('1111m3344p5566s7z', '7z'))
    expect(result.some((r) => r.structure === 'chiitoitsu')).toBe(false)
  })

  it('returns both the chiitoitsu and ryanpeikou readings when a hand is both', () => {
    const result = decompose(hand('112233445566m7p', '7p'))
    const structures = result.map((r) => r.structure)
    expect(structures).toContain('chiitoitsu')
    expect(structures).toContain('standard')
  })
})

describe('decompose — thirteen orphans', () => {
  it('recognises kokushi musou', () => {
    const result = decompose(hand('19m19p19s1234567z', '1m'))
    expect(result.map((r) => r.structure)).toEqual(['kokushi'])
    expect(result[0].groups.filter((g) => g.kind === 'pair')).toHaveLength(1)
    expect(result[0].groups.filter((g) => g.kind === 'single')).toHaveLength(12)
  })

  it('rejects a hand missing an orphan type', () => {
    const result = decompose(hand('19m19p19s123456z1m', '1m'))
    expect(result.some((r) => r.structure === 'kokushi')).toBe(false)
  })
})

describe('decompose — invariants', () => {
  const hands: Array<[string, string]> = [
    ['123m456m789m123p1s', '1s'],
    ['111222333m456p9s', '9s'],
    ['112233445566m7p', '7p'],
    ['1122m3344p5566s7z', '7z'],
    ['19m19p19s1234567z', '1m'],
    ['1123m456p789s234s', '1m'],
  ]

  it.each(hands)('every interpretation of %s+%s uses exactly the input tiles', (c, w) => {
    const h = hand(c, w)
    const expected = toCounts([...h.concealed, h.winningTile])
    for (const interp of decompose(h)) {
      const actual = toCounts(interp.groups.flatMap((g) => g.tiles))
      expect(actual).toEqual(expected)
    }
  })

  it.each(hands)('no interpretation of %s+%s is returned twice', (c, w) => {
    const rendered = decompose(hand(c, w)).map(render)
    expect(new Set(rendered).size).toBe(rendered.length)
  })
})
