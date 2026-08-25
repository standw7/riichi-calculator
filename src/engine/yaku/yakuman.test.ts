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

const ankan = (n: string): Meld => ({ kind: 'ankan', tiles: parseTiles(n) })

const best = (h: Hand, c: WinContext = ctx(), rules = WRC_2025) => {
  for (const interp of decompose(h)) {
    const yaku = detectYaku(interp, h, c, rules)
    if (yaku.some((y) => y.yakuman > 0)) return yaku
  }
  return decompose(h).length > 0 ? detectYaku(decompose(h)[0], h, c, rules) : []
}

const ids = (h: Hand, c?: WinContext, rules = WRC_2025): string[] =>
  best(h, c, rules).map((y) => y.id)

describe('kokushi musou', () => {
  it('detects the ordinary form', () => {
    // Pair is 1m and the winning tile is the missing 7z, so this is not a 13-wait.
    const h = hand('119m19p19s123456z', '7z')
    expect(ids(h)).toContain('kokushi')
  })

  it('detects the thirteen-wait form and suppresses the ordinary one', () => {
    const h = hand('19m19p19s1234567z', '1m')
    const result = ids(h)
    expect(result).toContain('kokushi-13')
    expect(result).not.toContain('kokushi')
  })

  it('clamps the thirteen-wait to a single yakuman when the ruleset forbids doubles', () => {
    const h = hand('19m19p19s1234567z', '1m')
    const single = best(h, ctx(), { ...WRC_2025, doubleYakuman: false })
    expect(single.find((y) => y.id === 'kokushi-13')?.yakuman).toBe(1)
  })
})

describe('suuankou', () => {
  it('detects four concealed triplets completed by a shanpon tsumo', () => {
    // Tsumo on 4s completes the fourth triplet; the wait is shanpon, not tanki.
    const h = hand('111m222m333p44s55s', '4s', 'tsumo')
    expect(ids(h)).toContain('suuankou')
  })

  it('detects the tanki form and suppresses the ordinary one', () => {
    // The winning 5s completes the pair, so the wait is tanki.
    const h = hand('111m222m333p444s5s', '5s')
    const result = ids(h)
    expect(result).toContain('suuankou-tanki')
    expect(result).not.toContain('suuankou')
  })
})

describe('honour yakuman', () => {
  it('detects daisangen', () => {
    expect(ids(hand('555z666z777z234m5m', '5m'))).toContain('daisangen')
  })

  it('detects shousuushii', () => {
    expect(ids(hand('111z222z333z44z34m', '2m'))).toContain('shousuushii')
  })

  it('detects daisuushii and suppresses shousuushii', () => {
    const h = hand('111z222z333z444z5m', '5m')
    const result = ids(h)
    expect(result).toContain('daisuushii')
    expect(result).not.toContain('shousuushii')
  })

  it('detects tsuuiisou', () => {
    // Two winds and two dragons, so this is tsuuiisou without also being daisuushii.
    expect(ids(hand('111z222z555z666z7z', '7z'))).toContain('tsuuiisou')
  })
})

describe('tile-restriction yakuman', () => {
  it('detects chinroutou', () => {
    const h = hand('111m999m111p999p9s', '9s')
    expect(ids(h)).toContain('chinroutou')
  })

  it('detects ryuuiisou', () => {
    expect(ids(hand('234s234s666s888s6z', '6z'))).toContain('ryuuiisou')
  })

  it('rejects ryuuiisou when a non-green tile is present', () => {
    // White dragon is not a green tile.
    expect(ids(hand('234s234s666s888s5z', '5z'))).not.toContain('ryuuiisou')
  })
})

describe('chuuren poutou', () => {
  it('detects the ordinary form', () => {
    // The duplicate 5m was already held, so winning on 2m is not a nine-sided wait.
    expect(ids(hand('1113455678999m', '2m'))).toContain('chuuren')
  })

  it('detects the nine-sided wait and suppresses the ordinary form', () => {
    // The thirteen tiles held are exactly 1112345678999m, so any tile wins.
    const h = hand('1112345678999m', '5m')
    const result = ids(h)
    expect(result).toContain('chuuren-9')
    expect(result).not.toContain('chuuren')
  })
})

describe('kan and situational yakuman', () => {
  it('detects suukantsu', () => {
    // Four kans fill all four group slots, leaving one concealed tile plus the win.
    const h = hand('5m', '5m', 'ron', [
      ankan('1111m'), ankan('2222p'), ankan('3333s'),
      { kind: 'minkan', tiles: parseTiles('4444z') },
    ])
    expect(ids(h)).toContain('suukantsu')
  })

  it('detects tenhou', () => {
    const h = hand('123m456m789m123p1s', '1s', 'tsumo')
    expect(ids(h, ctx({ seatWind: 'E', tenhou: true }))).toContain('tenhou')
  })

  it('detects chiihou', () => {
    const h = hand('123m456m789m123p1s', '1s', 'tsumo')
    expect(ids(h, ctx({ seatWind: 'S', chiihou: true }))).toContain('chiihou')
  })
})

describe('yakuman precedence', () => {
  it('returns only yakuman when one is present', () => {
    const h = hand('111z222z333z444z5z', '5z')
    expect(best(h).every((y) => y.yakuman > 0)).toBe(true)
  })

  it('caps the hand at one yakuman when the ruleset forbids stacking', () => {
    const h = hand('111z222z333z444z5z', '5z')  // daisuushii + tsuuiisou
    const single = best(h, ctx(), { ...WRC_2025, multipleYakuman: false })
    expect(single).toHaveLength(1)
    expect(single[0].yakuman).toBe(1)
  })
})
