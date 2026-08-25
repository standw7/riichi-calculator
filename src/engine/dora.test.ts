import { describe, it, expect } from 'vitest'
import { countDora, nextTile } from './dora'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, WinContext } from './types'

const tile = (n: string) => parseTiles(n)[0]

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (concealed: string, winning: string): Hand => ({
  concealed: parseTiles(concealed), melds: [],
  winningTile: tile(winning), winSource: 'ron',
})

describe('nextTile', () => {
  it('advances within a numbered suit', () => {
    expect(nextTile(tile('1m'))).toEqual(tile('2m'))
  })

  it('wraps 9 back to 1', () => {
    expect(nextTile(tile('9p'))).toEqual(tile('1p'))
  })

  it('cycles the winds', () => {
    expect(nextTile(tile('1z'))).toEqual(tile('2z'))  // East → South
    expect(nextTile(tile('4z'))).toEqual(tile('1z'))  // North → East
  })

  it('cycles the dragons without leaking into the winds', () => {
    expect(nextTile(tile('5z'))).toEqual(tile('6z'))  // White → Green
    expect(nextTile(tile('7z'))).toEqual(tile('5z'))  // Red → White
  })

  it('never returns a red five', () => {
    expect(nextTile(tile('4p')).red).toBe(false)
  })
})

describe('countDora', () => {
  // 13-tile concealed hand + a separate winning tile = 14 tiles total.
  // Concealed carries a single 2p; the winning 2p completes the pair, so
  // the hand holds exactly two copies of 2p (allTiles = concealed + winningTile).
  const h = hand('234m567p345s678s2p', '2p')

  it('counts every copy of the indicated tile', () => {
    const result = countDora(h, ctx({ doraIndicators: parseTiles('1p') }), WRC_2025)
    expect(result.dora).toBe(2)  // the 2p pair
    expect(result.details).toEqual([
      { indicator: tile('1p'), doraTile: tile('2p'), count: 2 },
    ])
  })

  it('sums multiple indicators', () => {
    const result = countDora(h, ctx({ doraIndicators: parseTiles('1p2m') }), WRC_2025)
    expect(result.dora).toBe(3)  // 2p ×2 plus 3m ×1
  })

  it('ignores ura indicators without riichi', () => {
    const result = countDora(h, ctx({ uraIndicators: parseTiles('1p') }), WRC_2025)
    expect(result.ura).toBe(0)
  })

  it('counts ura indicators when riichi was declared', () => {
    const result = countDora(
      h, ctx({ riichi: 'riichi', uraIndicators: parseTiles('1p') }), WRC_2025)
    expect(result.ura).toBe(2)
  })

  it('counts red fives only when the ruleset uses them', () => {
    const red = hand('234m067p345s678s2p', '2p')  // 0p is the red five
    expect(countDora(red, ctx(), { ...WRC_2025, akaDoraCount: 3 }).aka).toBe(1)
    expect(countDora(red, ctx(), { ...WRC_2025, akaDoraCount: 0 }).aka).toBe(0)
  })

  it('totals dora, aka, and ura together', () => {
    const result = countDora(
      h, ctx({ riichi: 'riichi', doraIndicators: parseTiles('1p'),
        uraIndicators: parseTiles('1m') }), WRC_2025)
    expect(result.total).toBe(result.dora + result.aka + result.ura)
  })
})
