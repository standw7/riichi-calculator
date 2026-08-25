import { describe, it, expect } from 'vitest'
import { detectYaku } from './detect'
import { decompose } from '../decompose'
import { parseTiles } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'
import type { Hand, Meld, WinContext, WinSource } from '../types'

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (
  concealed: string, winning: string,
  winSource: WinSource = 'ron', melds: Meld[] = [],
): Hand => ({
  concealed: parseTiles(concealed), melds,
  winningTile: parseTiles(winning)[0], winSource,
})

const chi = (n: string): Meld =>
  ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })

const idsFor = (h: Hand, c: WinContext = ctx()): string[][] =>
  decompose(h).map((i) => detectYaku(i, h, c, WRC_2025).map((y) => y.id))

const hasYaku = (h: Hand, id: string, c: WinContext = ctx()): boolean =>
  idsFor(h, c).some((ids) => ids.includes(id))

const hanFor = (h: Hand, id: string, c: WinContext = ctx()): number | undefined => {
  for (const interp of decompose(h)) {
    const found = detectYaku(interp, h, c, WRC_2025).find((y) => y.id === id)
    if (found) return found.han
  }
  return undefined
}

describe('honitsu', () => {
  it('applies to one suit plus honors', () => {
    expect(hasYaku(hand('123456789m111z9m', '9m'), 'honitsu')).toBe(true)
  })

  it('drops to 2 han when open', () => {
    const h = hand('456789m111z9m', '9m', 'ron', [chi('123m')])
    expect(hanFor(h, 'honitsu')).toBe(2)
  })

  it('does not apply to a hand with two suits', () => {
    expect(hasYaku(hand('123456m789p111z9m', '9m'), 'honitsu')).toBe(false)
  })
})

describe('chinitsu', () => {
  // 111m 234m 567m 888m 99m
  it('applies to a single suit with no honors and scores 6 han closed', () => {
    const h = hand('111234567888m9m', '9m')
    expect(hanFor(h, 'chinitsu')).toBe(6)
  })

  it('suppresses honitsu', () => {
    const h = hand('111234567888m9m', '9m')
    expect(hasYaku(h, 'honitsu')).toBe(false)
  })

  it('drops to 5 han when open', () => {
    const h = hand('111567888m9m', '9m', 'ron', [chi('234m')])
    expect(hanFor(h, 'chinitsu')).toBe(5)
  })
})

describe('junchan', () => {
  it('applies when every group holds a terminal and no honors are present', () => {
    expect(hasYaku(hand('123m123p789s789m9p', '9p'), 'junchan')).toBe(true)
  })

  it('suppresses chanta', () => {
    const h = hand('123m123p789s789m9p', '9p')
    expect(hasYaku(h, 'chanta')).toBe(false)
  })

  it('does not apply when an honor is present', () => {
    expect(hasYaku(hand('123m123p789s111z9m', '9m'), 'junchan')).toBe(false)
  })
})

describe('ryanpeikou', () => {
  it('applies to two pairs of identical sequences in a closed hand', () => {
    const h = hand('112233445566m7p', '7p')
    expect(hasYaku(h, 'ryanpeikou')).toBe(true)
  })

  it('suppresses iipeikou', () => {
    const h = hand('112233445566m7p', '7p')
    for (const ids of idsFor(h)) {
      if (ids.includes('ryanpeikou')) expect(ids).not.toContain('iipeikou')
    }
  })

  it('does not apply to a single iipeikou', () => {
    expect(hasYaku(hand('112233m456p78s99s', '9s'), 'ryanpeikou')).toBe(false)
  })
})
