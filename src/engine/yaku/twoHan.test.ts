import { describe, it, expect } from 'vitest'
import { detectYaku } from './detect'
import { decompose, type Interpretation } from '../decompose'
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
const kan = (kind: Meld['kind'], n: string): Meld =>
  ({ kind, tiles: parseTiles(n) })

/** True when any interpretation of the hand yields the given yaku id. */
const hasYaku = (h: Hand, id: string, c: WinContext = ctx()): boolean =>
  decompose(h).some((i: Interpretation) =>
    detectYaku(i, h, c, WRC_2025).some((y) => y.id === id))

const hanFor = (h: Hand, id: string, c: WinContext = ctx()): number | undefined => {
  for (const interp of decompose(h)) {
    const found = detectYaku(interp, h, c, WRC_2025).find((y) => y.id === id)
    if (found) return found.han
  }
  return undefined
}

describe('chiitoitsu', () => {
  it('applies to seven pairs in a closed hand', () => {
    expect(hasYaku(hand('1122m3344p5566s7z', '7z'), 'chiitoitsu')).toBe(true)
  })

  it('does not apply to a standard hand', () => {
    expect(hasYaku(hand('123m456m789m123p1s', '1s'), 'chiitoitsu')).toBe(false)
  })
})

describe('ittsu', () => {
  it('applies to 123 456 789 in one suit', () => {
    expect(hasYaku(hand('123456789m234p5s', '5s'), 'ittsu')).toBe(true)
  })

  it('does not apply when the runs span different suits', () => {
    expect(hasYaku(hand('123m456m789p234p5s', '5s'), 'ittsu')).toBe(false)
  })

  it('drops to 1 han when the hand is open', () => {
    const h = hand('456789m234p5s', '5s', 'ron', [chi('123m')])
    expect(hanFor(h, 'ittsu')).toBe(1)
  })
})

describe('sanshoku doujun', () => {
  it('applies to the same run in all three suits', () => {
    expect(hasYaku(hand('234m234p234s567m5s', '5s'), 'sanshoku-doujun')).toBe(true)
  })

  it('does not apply when one suit is missing', () => {
    expect(hasYaku(hand('234m234p567m789m5s', '5s'), 'sanshoku-doujun')).toBe(false)
  })
})

describe('sanshoku doukou', () => {
  it('applies to the same triplet in all three suits', () => {
    expect(hasYaku(hand('222m222p222s456m5s', '5s'), 'sanshoku-doukou')).toBe(true)
  })
})

describe('toitoi', () => {
  it('applies when all four blocks are triplets', () => {
    const h = hand('222m333p444s5z', '5z', 'ron', [pon('666s')])
    expect(hasYaku(h, 'toitoi')).toBe(true)
  })

  it('does not apply when the hand contains a sequence', () => {
    expect(hasYaku(hand('222m333p456s777m5s', '5s'), 'toitoi')).toBe(false)
  })
})

describe('sanankou', () => {
  it('applies to three concealed triplets', () => {
    const h = hand('222m333p444s456m5s', '5s', 'tsumo')
    expect(hasYaku(h, 'sanankou')).toBe(true)
  })

  it('does not count a triplet completed by ron as concealed', () => {
    // Ron on 2m completes the third triplet, leaving only two concealed.
    const h = hand('22m333p444s456m55s', '2m')
    expect(hasYaku(h, 'sanankou')).toBe(false)
  })

  it('does count that triplet when the same hand is won by tsumo', () => {
    const h = hand('22m333p444s456m55s', '2m', 'tsumo')
    expect(hasYaku(h, 'sanankou')).toBe(true)
  })
})

describe('sankantsu', () => {
  it('applies to exactly three kans', () => {
    const h = hand('456m5s', '5s', 'ron', [
      kan('ankan', '1111m'), kan('minkan', '2222p'), kan('ankan', '3333s'),
    ])
    expect(hasYaku(h, 'sankantsu')).toBe(true)
  })
})

describe('chanta', () => {
  it('applies when every group holds a terminal or honor and one sequence exists', () => {
    expect(hasYaku(hand('123m123p789s111z9m', '9m'), 'chanta')).toBe(true)
  })

  it('does not apply when a group is all simples', () => {
    expect(hasYaku(hand('123m456p789s111z9m', '9m'), 'chanta')).toBe(false)
  })

  it('does not apply to a hand with no sequences', () => {
    const h = hand('111m999p111z9s', '9s', 'ron', [pon('999s')])
    expect(hasYaku(h, 'chanta')).toBe(false)
  })
})

describe('honroutou', () => {
  it('applies when every tile is a terminal or honor', () => {
    const h = hand('111m999p111z9s', '9s', 'ron', [pon('999s')])
    expect(hasYaku(h, 'honroutou')).toBe(true)
  })

  it('does not apply when a simple is present', () => {
    expect(hasYaku(hand('111m999p111z234s9s', '9s'), 'honroutou')).toBe(false)
  })
})

describe('shousangen', () => {
  it('applies to two dragon triplets plus a pair of the third', () => {
    expect(hasYaku(hand('555z666z77z234m56m', '7m'), 'shousangen')).toBe(true)
  })

  it('does not apply when all three dragons are triplets', () => {
    expect(hasYaku(hand('555z666z777z234m5m', '5m'), 'shousangen')).toBe(false)
  })
})
