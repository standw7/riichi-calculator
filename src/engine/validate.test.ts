import { describe, it, expect } from 'vitest'
import { validate } from './validate'
import { isClosed } from './hand'
import { parseTiles } from './tiles'
import type { Hand, WinContext, Meld } from './types'

const ctx = (overrides: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
  ...overrides,
})

const hand = (concealed: string, winning: string, overrides: Partial<Hand> = {}): Hand => ({
  concealed: parseTiles(concealed),
  melds: [],
  winningTile: parseTiles(winning)[0],
  winSource: 'ron',
  ...overrides,
})

const pon = (notation: string): Meld => ({
  kind: 'pon',
  tiles: parseTiles(notation),
  calledTile: parseTiles(notation)[0],
})

const ankan = (notation: string): Meld => ({ kind: 'ankan', tiles: parseTiles(notation) })

describe('isClosed', () => {
  it('treats a hand with no melds as closed', () => {
    expect(isClosed(hand('123m456m789m123p1s', '1s'))).toBe(true)
  })

  it('treats a pon as opening the hand', () => {
    expect(isClosed(hand('123m456m789m1s', '1s', { melds: [pon('111p')] }))).toBe(false)
  })

  it('treats an ankan as leaving the hand closed', () => {
    expect(isClosed(hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] }))).toBe(true)
  })
})

describe('validate — tile counts', () => {
  it('accepts a well-formed 14-tile hand', () => {
    expect(validate(hand('123m456m789m123p1s', '1s'), ctx()).ok).toBe(true)
  })

  it('reports how many tiles are still needed', () => {
    const result = validate(hand('123m456m789m12p', '2p'), ctx())
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ code: 'incomplete', tilesNeeded: 3 })
  })

  it('reports an overfull hand', () => {
    const result = validate(hand('123m456m789m123p11s2s', '2s'), ctx())
    expect(result.issues).toContainEqual({ code: 'too-many-tiles', excess: 1 })
  })

  it('counts a meld as three slots even when it is a kan', () => {
    const h = hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] })
    expect(validate(h, ctx()).ok).toBe(true)
  })
})

describe('validate — physical copies', () => {
  it('rejects five copies of a tile', () => {
    const result = validate(hand('11111m456m789m1s', '1s'), ctx())
    expect(result.issues).toContainEqual({
      code: 'impossible-duplicates',
      tile: { suit: 'm', rank: 1, red: false },
      count: 5,
    })
  })

  it('counts dora indicators towards the four-copy limit', () => {
    const h = hand('1111m456m789m1s', '1s')
    const result = validate(h, ctx({ doraIndicators: parseTiles('1m') }))
    expect(result.issues).toContainEqual({
      code: 'impossible-duplicates',
      tile: { suit: 'm', rank: 1, red: false },
      count: 5,
    })
  })

  it('counts all four tiles of a kan, not three', () => {
    const h = hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] })
    const result = validate(h, ctx({ doraIndicators: parseTiles('1p') }))
    expect(result.issues).toContainEqual({
      code: 'impossible-duplicates',
      tile: { suit: 'p', rank: 1, red: false },
      count: 5,
    })
  })
})

describe('validate — context conflicts', () => {
  const complete = hand('123m456m789m123p1s', '1s')

  it.each([
    ['haitei', { haitei: true }, 'ron' as const, 'Haitei requires a tsumo win.'],
    ['houtei', { houtei: true }, 'tsumo' as const, 'Houtei requires a ron win.'],
    ['rinshan', { rinshan: true }, 'ron' as const, 'Rinshan kaihou requires a tsumo win.'],
    ['chankan', { chankan: true }, 'tsumo' as const, 'Chankan requires a ron win.'],
  ])('rejects %s with the wrong win source', (rule, overrides, winSource, message) => {
    const result = validate({ ...complete, winSource }, ctx(overrides))
    expect(result.issues).toContainEqual({ code: 'context-conflict', rule, message })
  })

  it('rejects ippatsu without riichi', () => {
    const result = validate(complete, ctx({ ippatsu: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'ippatsu',
      message: 'Ippatsu is only possible after declaring riichi.',
    })
  })

  it('rejects riichi on an open hand', () => {
    const open = hand('123m456m789m1s', '1s', { melds: [pon('111p')] })
    const result = validate(open, ctx({ riichi: 'riichi' }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'riichi',
      message: 'Riichi can only be declared with a closed hand.',
    })
  })

  it('rejects haitei and houtei together', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ haitei: true, houtei: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'haitei',
      message: 'A hand cannot be both haitei and houtei.',
    })
  })

  it('rejects tenhou for a non-dealer', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ seatWind: 'S', tenhou: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'tenhou',
      message: 'Tenhou is a dealer-only hand won by tsumo.',
    })
  })

  it('accepts tenhou for a dealer tsumo', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ seatWind: 'E', tenhou: true }))
    expect(result.ok).toBe(true)
  })

  it('rejects chiihou for a dealer', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ seatWind: 'E', chiihou: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'chiihou',
      message: 'Chiihou is a non-dealer hand won by tsumo.',
    })
  })
})
