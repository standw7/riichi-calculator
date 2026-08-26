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
const pon = (n: string): Meld =>
  ({ kind: 'pon', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })

/** Yaku ids from the first interpretation, sorted for stable assertions. */
const yakuOf = (h: Hand, c: WinContext = ctx()): string[] =>
  detectYaku(decompose(h)[0], h, c, WRC_2025).map((y) => y.id).sort()

const findYaku = (h: Hand, id: string, c: WinContext = ctx()) =>
  detectYaku(decompose(h)[0], h, c, WRC_2025).find((y) => y.id === id)

describe('riichi family', () => {
  it('detects riichi', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(yakuOf(h, ctx({ riichi: 'riichi' }))).toContain('riichi')
  })

  it('detects double riichi and suppresses plain riichi', () => {
    const h = hand('34m456p678s234s55m', '2m')
    const ids = yakuOf(h, ctx({ riichi: 'double' }))
    expect(ids).toContain('double-riichi')
    expect(ids).not.toContain('riichi')
  })

  it('scores double riichi as 2 han', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(findYaku(h, 'double-riichi', ctx({ riichi: 'double' }))?.han).toBe(2)
  })

  it('detects ippatsu only alongside riichi', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(yakuOf(h, ctx({ riichi: 'riichi', ippatsu: true }))).toContain('ippatsu')
    expect(yakuOf(h, ctx())).not.toContain('ippatsu')
  })

  it('does not award closed-only yaku to an open hand', () => {
    // riichi/ippatsu match on context alone, so the openHan: 0 gate in detectYaku
    // is the only thing excluding them here.
    const h = hand('34m456p678s55m', '2m', 'ron', [chi('234s')])
    const ids = yakuOf(h, ctx({ riichi: 'riichi', ippatsu: true }))
    expect(ids).not.toContain('riichi')
    expect(ids).not.toContain('ippatsu')
  })
})

describe('menzen tsumo', () => {
  it('applies to a closed tsumo', () => {
    expect(yakuOf(hand('34m456p678s234s55m', '2m', 'tsumo'))).toContain('menzen-tsumo')
  })

  it('does not apply to an open tsumo', () => {
    const h = hand('34m456p678s55m', '2m', 'tsumo', [chi('234s')])
    expect(yakuOf(h)).not.toContain('menzen-tsumo')
  })

  it('does not apply to a closed ron', () => {
    expect(yakuOf(hand('34m456p678s234s55m', '2m'))).not.toContain('menzen-tsumo')
  })
})

describe('pinfu', () => {
  it('applies to a closed all-sequence hand with a plain pair and ryanmen wait', () => {
    expect(yakuOf(hand('34m456p678s234s55m', '2m'))).toContain('pinfu')
  })

  it('does not apply when the hand contains a triplet', () => {
    expect(yakuOf(hand('111m234m456p678s5s', '5s'))).not.toContain('pinfu')
  })
})

describe('iipeikou', () => {
  it('applies to two identical sequences in a closed hand', () => {
    expect(yakuOf(hand('112233m456p78s99s', '9s'))).toContain('iipeikou')
  })

  it('does not apply to an open hand', () => {
    const h = hand('112233m456p9s', '9s', 'ron', [chi('789s')])
    expect(yakuOf(h)).not.toContain('iipeikou')
  })
})

describe('tanyao', () => {
  it('applies when every tile is between 2 and 8', () => {
    expect(yakuOf(hand('234m567p345s678s2p', '2p'))).toContain('tanyao')
  })

  it('does not apply when the hand contains a terminal', () => {
    expect(yakuOf(hand('123m567p345s678s2p', '2p'))).not.toContain('tanyao')
  })

  it('does not apply when the hand contains an honor', () => {
    expect(yakuOf(hand('234m567p345s678s1z', '1z'))).not.toContain('tanyao')
  })

  it('applies to an open hand only when the ruleset allows kuitan', () => {
    const h = hand('234m567p678s2p', '2p', 'ron', [chi('345s')])
    const interp = decompose(h)[0]
    expect(detectYaku(interp, h, ctx(), WRC_2025).map((y) => y.id)).toContain('tanyao')
    const noKuitan = { ...WRC_2025, kuitan: false }
    expect(detectYaku(interp, h, ctx(), noKuitan).map((y) => y.id)).not.toContain('tanyao')
  })
})

describe('yakuhai', () => {
  it('names the dragon it came from', () => {
    const h = hand('234m567p345s555z2z', '2z')
    const result = findYaku(h, 'yakuhai-haku')
    expect(result?.han).toBe(1)
    expect(result?.evidence.params).toEqual({ source: 'dragon', dragon: 'haku' })
  })

  it('detects a seat wind triplet', () => {
    const h = hand('234m567p345s222z5p', '5p')  // South triplet, seat wind South
    const result = findYaku(h, 'yakuhai-seat', ctx({ seatWind: 'S', roundWind: 'E' }))
    expect(result?.han).toBe(1)
    expect(result?.evidence.params).toEqual({ source: 'seat-wind', wind: 'S' })
  })

  it('detects a round wind triplet', () => {
    const h = hand('234m567p345s111z5p', '5p')  // East triplet, round wind East
    expect(findYaku(h, 'yakuhai-round', ctx({ seatWind: 'S', roundWind: 'E' }))?.han).toBe(1)
  })

  it('scores a double wind triplet as two separate yaku', () => {
    const h = hand('234m567p345s111z5p', '5p')
    const ids = yakuOf(h, ctx({ seatWind: 'E', roundWind: 'E' }))
    expect(ids).toContain('yakuhai-seat')
    expect(ids).toContain('yakuhai-round')
  })

  it('applies to an open pon', () => {
    const h = hand('234m567p345s5p', '5p', 'ron', [pon('555z')])
    expect(findYaku(h, 'yakuhai-haku')?.han).toBe(1)
  })
})

describe('situational yaku', () => {
  const closed = hand('34m456p678s234s55m', '2m', 'tsumo')
  const ronHand = hand('34m456p678s234s55m', '2m')

  it('detects haitei on a tsumo', () => {
    expect(yakuOf(closed, ctx({ haitei: true }))).toContain('haitei')
  })

  it('detects houtei on a ron', () => {
    expect(yakuOf(ronHand, ctx({ houtei: true }))).toContain('houtei')
  })

  it('detects rinshan on a tsumo', () => {
    expect(yakuOf(closed, ctx({ rinshan: true }))).toContain('rinshan')
  })

  it('detects chankan on a ron', () => {
    expect(yakuOf(ronHand, ctx({ chankan: true }))).toContain('chankan')
  })
})
