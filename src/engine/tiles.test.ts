import { describe, it, expect } from 'vitest'
import {
  tileId, tileFromId, toCounts, parseTiles, tilesToNotation,
  sortTiles, isHonor, isTerminal, isTerminalOrHonor,
} from './tiles'

describe('tileId', () => {
  it('maps manzu to 0-8', () => {
    expect(tileId({ suit: 'm', rank: 1, red: false })).toBe(0)
    expect(tileId({ suit: 'm', rank: 9, red: false })).toBe(8)
  })

  it('maps pinzu to 9-17 and souzu to 18-26', () => {
    expect(tileId({ suit: 'p', rank: 1, red: false })).toBe(9)
    expect(tileId({ suit: 's', rank: 1, red: false })).toBe(18)
  })

  it('maps winds to 27-30 and dragons to 31-33', () => {
    expect(tileId({ suit: 'z', rank: 1, red: false })).toBe(27)  // East
    expect(tileId({ suit: 'z', rank: 4, red: false })).toBe(30)  // North
    expect(tileId({ suit: 'z', rank: 7, red: false })).toBe(33)  // Red dragon
  })

  it('ignores the red flag, so a red five shares its id with a normal five', () => {
    expect(tileId({ suit: 'p', rank: 5, red: true }))
      .toBe(tileId({ suit: 'p', rank: 5, red: false }))
  })
})

describe('tileFromId', () => {
  it('round-trips every id', () => {
    for (let id = 0; id < 34; id++) {
      expect(tileId(tileFromId(id))).toBe(id)
    }
  })
})

describe('toCounts', () => {
  it('counts red fives against the ordinary five slot', () => {
    const counts = toCounts([
      { suit: 'p', rank: 5, red: true },
      { suit: 'p', rank: 5, red: false },
    ])
    expect(counts[tileId({ suit: 'p', rank: 5, red: false })]).toBe(2)
    expect(counts).toHaveLength(34)
  })
})

describe('parseTiles', () => {
  it('parses a multi-suit hand', () => {
    expect(parseTiles('123m')).toEqual([
      { suit: 'm', rank: 1, red: false },
      { suit: 'm', rank: 2, red: false },
      { suit: 'm', rank: 3, red: false },
    ])
  })

  it('parses rank 0 as a red five', () => {
    expect(parseTiles('0p')).toEqual([{ suit: 'p', rank: 5, red: true }])
  })

  it('parses honors', () => {
    expect(parseTiles('17z')).toEqual([
      { suit: 'z', rank: 1, red: false },
      { suit: 'z', rank: 7, red: false },
    ])
  })

  it('rejects an honor rank above 7', () => {
    expect(() => parseTiles('8z')).toThrow('Invalid honor rank: 8')
  })

  it('rejects digits with no suit letter', () => {
    expect(() => parseTiles('123')).toThrow('Trailing digits without a suit')
  })

  it('rejects an unknown suit letter', () => {
    expect(() => parseTiles('1x')).toThrow('Unknown suit: x')
  })

  it('returns an empty array for an empty string', () => {
    expect(parseTiles('')).toEqual([])
  })
})

describe('tilesToNotation', () => {
  it('round-trips a mixed hand', () => {
    const notation = '1230m0p77z'
    expect(tilesToNotation(parseTiles(notation))).toBe(notation)
  })

  it('groups tiles by suit in m,p,s,z order', () => {
    expect(tilesToNotation(parseTiles('1z1s1p1m'))).toBe('1m1p1s1z')
  })
})

describe('sortTiles', () => {
  it('sorts manzu, pinzu, souzu, then honors', () => {
    expect(tilesToNotation(sortTiles(parseTiles('1z5s3p9m')))).toBe('9m3p5s1z')
  })

  it('places a red five alongside ordinary fives', () => {
    expect(tilesToNotation(sortTiles(parseTiles('6p0p4p')))).toBe('406p')
  })
})

describe('tile predicates', () => {
  it('identifies honors', () => {
    expect(isHonor({ suit: 'z', rank: 1, red: false })).toBe(true)
    expect(isHonor({ suit: 'm', rank: 1, red: false })).toBe(false)
  })

  it('identifies terminals as 1 and 9 of numbered suits only', () => {
    expect(isTerminal({ suit: 'm', rank: 1, red: false })).toBe(true)
    expect(isTerminal({ suit: 'm', rank: 5, red: false })).toBe(false)
    expect(isTerminal({ suit: 'z', rank: 1, red: false })).toBe(false)
  })

  it('identifies terminals and honors together', () => {
    expect(isTerminalOrHonor({ suit: 'z', rank: 5, red: false })).toBe(true)
    expect(isTerminalOrHonor({ suit: 's', rank: 9, red: false })).toBe(true)
    expect(isTerminalOrHonor({ suit: 's', rank: 8, red: false })).toBe(false)
  })
})
