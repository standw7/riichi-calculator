import { describe, it, expect } from 'vitest'
import { allTiles, isClosed, isDealer } from './hand'
import { parseTiles } from './tiles'
import type { Hand, Meld, WinContext } from './types'

const hand = (melds: Meld[]): Hand => ({
  concealed: parseTiles('234m567p345s'), melds,
  winningTile: parseTiles('9s')[0], winSource: 'ron',
})

const ankan: Meld = {
  kind: 'ankan', tiles: parseTiles('1111z'),
}

const pon: Meld = {
  kind: 'pon', tiles: parseTiles('999s'), calledTile: parseTiles('9s')[0],
}

describe('isClosed', () => {
  it('is closed with no melds', () => {
    expect(isClosed(hand([]))).toBe(true)
  })

  it('is closed when every meld is an ankan', () => {
    expect(isClosed(hand([ankan]))).toBe(true)
  })

  it('is open when a called meld is present, even alongside an ankan', () => {
    expect(isClosed(hand([ankan, pon]))).toBe(false)
  })

  it('is open with a lone called meld', () => {
    expect(isClosed(hand([pon]))).toBe(false)
  })
})

describe('allTiles', () => {
  it('includes concealed tiles, meld tiles, and the winning tile', () => {
    const h = hand([pon])
    expect(allTiles(h).length).toBe(h.concealed.length + pon.tiles.length + 1)
  })
})

describe('isDealer', () => {
  const ctx = (seatWind: WinContext['seatWind']): WinContext => ({
    seatWind, roundWind: 'E', riichi: 'none', ippatsu: false,
    haitei: false, houtei: false, rinshan: false, chankan: false,
    tenhou: false, chiihou: false,
    doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
  })

  it('is the dealer when seated East', () => {
    expect(isDealer(ctx('E'))).toBe(true)
  })

  it('is not the dealer otherwise', () => {
    expect(isDealer(ctx('S'))).toBe(false)
  })
})
