import { describe, it, expect } from 'vitest'
import { computeFu, classifyWait, isPinfuShape } from './fu'
import { decompose } from './decompose'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, Meld, WinContext, WinSource } from './types'

const ctx = (overrides: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
  ...overrides,
})

const hand = (
  concealed: string, winning: string,
  winSource: WinSource = 'ron', melds: Meld[] = [],
): Hand => ({
  concealed: parseTiles(concealed),
  melds,
  winningTile: parseTiles(winning)[0],
  winSource,
})

/** Fu of the first interpretation — used where the hand is unambiguous. */
const fuOf = (h: Hand, c: WinContext = ctx()) =>
  computeFu(decompose(h)[0], h, c, WRC_2025)

describe('computeFu — base components', () => {
  it('scores a closed pinfu ron as 30 fu', () => {
    // 234m 456p 678s 234s, pair 5m (not a value tile), ryanmen wait on 2m.
    const h = hand('34m456p678s234s55m', '2m')
    const result = fuOf(h)
    expect(result.total).toBe(30)
    expect(result.lines.map((l) => l.id)).toEqual(['base', 'menzen-ron'])
  })

  it('scores a closed pinfu tsumo as 20 fu', () => {
    const h = hand('34m456p678s234s55m', '2m', 'tsumo')
    const result = fuOf(h)
    expect(result.total).toBe(20)
    expect(result.lines.map((l) => l.id)).toEqual(['base'])
  })

  it('adds 2 fu for a non-pinfu tsumo', () => {
    // 111m ankou (terminal) blocks pinfu; winning 5s completes the tanki pair.
    const h = hand('111m234m456p678s5s', '5s', 'tsumo')
    expect(fuOf(h).lines.find((l) => l.id === 'tsumo')).toEqual({ id: 'tsumo', fu: 2 })
  })

  it('scores chiitoitsu as a flat 25 fu', () => {
    const h = hand('1122m3344p5566s7z', '7z')
    const chiitoi = decompose(h).find((i) => i.structure === 'chiitoitsu')!
    const result = computeFu(chiitoi, h, ctx(), WRC_2025)
    expect(result.total).toBe(25)
    expect(result.lines).toEqual([{ id: 'chiitoitsu', fu: 25 }])
  })
})

describe('computeFu — triplets and kans', () => {
  it('scores a concealed simple triplet as 4 fu and a concealed terminal triplet as 8', () => {
    // Winning tile completes the tanki pair (9s), leaving the triplet untouched by the win.
    const simple = hand('222m345m456p678s9s', '9s')
    expect(fuOf(simple).lines.find((l) => l.id === 'ankou')).toEqual(
      { id: 'ankou', fu: 4, tile: { suit: 'm', rank: 2, red: false } })

    const terminal = hand('111m345m456p678s9s', '9s')
    expect(fuOf(terminal).lines.find((l) => l.id === 'ankou')).toEqual(
      { id: 'ankou', fu: 8, tile: { suit: 'm', rank: 1, red: false } })
  })

  it('treats a concealed triplet completed by ron as an open triplet', () => {
    // Shanpon wait between 111m and 99s; ron on 1m makes that triplet open for fu.
    const h = hand('11m345m456p678s99s', '1m')
    const shanpon = decompose(h).find((i) =>
      i.groups.some((g) => g.kind === 'triplet' && g.containsWinningTile))!
    const result = computeFu(shanpon, h, ctx(), WRC_2025)
    expect(result.lines.find((l) => l.id === 'minko')).toEqual(
      { id: 'minko', fu: 4, tile: { suit: 'm', rank: 1, red: false },
        note: 'completed by ron' })
  })

  it('scores the four kan types correctly', () => {
    const kan = (kind: Meld['kind'], notation: string): Meld =>
      ({ kind, tiles: parseTiles(notation) })

    // Winning tile completes the tanki pair (9s); the kan meld supplies its own group.
    const ankanSimple = hand('345m456p678s9s', '9s', 'ron', [kan('ankan', '2222m')])
    expect(fuOf(ankanSimple).lines.find((l) => l.id === 'ankan')?.fu).toBe(16)

    const ankanTerminal = hand('345m456p678s9s', '9s', 'ron', [kan('ankan', '1111m')])
    expect(fuOf(ankanTerminal).lines.find((l) => l.id === 'ankan')?.fu).toBe(32)

    const minkanSimple = hand('345m456p678s9s', '9s', 'ron', [kan('minkan', '2222m')])
    expect(fuOf(minkanSimple).lines.find((l) => l.id === 'minkan')?.fu).toBe(8)

    const minkanTerminal = hand('345m456p678s9s', '9s', 'ron', [kan('minkan', '1111m')])
    expect(fuOf(minkanTerminal).lines.find((l) => l.id === 'minkan')?.fu).toBe(16)
  })
})

describe('computeFu — the pair', () => {
  it('awards 2 fu for a dragon pair', () => {
    const h = hand('234m456p678s234s5z', '5z')
    expect(fuOf(h).lines.find((l) => l.id === 'value-pair')?.fu).toBe(2)
  })

  it('awards 2 fu for a seat wind pair', () => {
    const h = hand('234m456p678s234s2z', '2z')  // South = seat wind
    expect(fuOf(h, ctx({ seatWind: 'S', roundWind: 'E' }))
      .lines.find((l) => l.id === 'value-pair')?.fu).toBe(2)
  })

  it('awards doubleWindPairFu when the pair is both seat and round wind', () => {
    const h = hand('234m456p678s234s1z', '1z')  // East
    const result = fuOf(h, ctx({ seatWind: 'E', roundWind: 'E' }))
    expect(result.lines.find((l) => l.id === 'value-pair')?.fu)
      .toBe(WRC_2025.doubleWindPairFu)
  })

  it('awards nothing for a pair of a non-value wind', () => {
    const h = hand('234m456p678s234s4z', '4z')  // North, neither seat nor round
    expect(fuOf(h, ctx({ seatWind: 'S', roundWind: 'E' }))
      .lines.find((l) => l.id === 'value-pair')).toBeUndefined()
  })
})

describe('classifyWait', () => {
  const waitOf = (concealed: string, winning: string) => {
    const h = hand(concealed, winning)
    return classifyWait(decompose(h)[0], h)
  }

  it('identifies a ryanmen wait', () => {
    expect(waitOf('34m456p678s234s55m', '2m')).toBe('ryanmen')
  })

  it('identifies a kanchan wait', () => {
    expect(waitOf('24m456p678s234s55m', '3m')).toBe('kanchan')
  })

  it('identifies a penchan wait at the bottom of a suit', () => {
    expect(waitOf('12m456p678s234s55m', '3m')).toBe('penchan')
  })

  it('identifies a penchan wait at the top of a suit', () => {
    expect(waitOf('89m456p678s234s55m', '7m')).toBe('penchan')
  })

  it('identifies a tanki wait', () => {
    expect(waitOf('234m456p678s234s5m', '5m')).toBe('tanki')
  })

  it('identifies a shanpon wait', () => {
    const h = hand('11m345m456p678s99s', '1m')
    const shanpon = decompose(h).find((i) =>
      i.groups.some((g) => g.kind === 'triplet' && g.containsWinningTile))!
    expect(classifyWait(shanpon, h)).toBe('shanpon')
  })
})

describe('computeFu — wait fu and rounding', () => {
  it('adds 2 fu for a kanchan wait and rounds up to the next 10', () => {
    // 20 base + 10 menzen ron + 2 kanchan = 32 → 40.
    const h = hand('24m456p678s234s55m', '3m')
    const result = fuOf(h)
    expect(result.lines.find((l) => l.id === 'wait')).toEqual(
      { id: 'wait', fu: 2, note: 'kanchan' })
    expect(result.raw).toBe(32)
    expect(result.total).toBe(40)
  })

  it('adds no fu for a ryanmen or shanpon wait', () => {
    expect(fuOf(hand('34m456p678s234s55m', '2m'))
      .lines.find((l) => l.id === 'wait')).toBeUndefined()
  })

  it('scores a 20-fu open hand as openPinfuFu', () => {
    const chi = (n: string): Meld =>
      ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })
    // 34m + winning 2m = 234m ryanmen; 456p and 678s sequences; 99p plain pair; chi 234s.
    const h = hand('34m456p678s99p', '2m', 'ron', [chi('234s')])
    const result = fuOf(h)
    expect(result.total).toBe(WRC_2025.openPinfuFu)
  })
})

describe('isPinfuShape', () => {
  it('accepts a closed all-sequence hand with a plain pair and a ryanmen wait', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(true)
  })

  it('rejects a hand containing a triplet', () => {
    const h = hand('111m234m456p678s5s', '5s')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })

  it('rejects a value pair', () => {
    const h = hand('234m456p678s234s5z', '5z')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })

  it('rejects a kanchan wait', () => {
    const h = hand('24m456p678s234s55m', '3m')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })

  it('rejects an open hand', () => {
    const chi = (n: string): Meld =>
      ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })
    const h = hand('34m456p678s99p', '2m', 'ron', [chi('234s')])
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })
})
