import { describe, it, expect } from 'vitest'
import { calculate } from './calculate'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, WinContext, WinSource } from './types'

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (concealed: string, winning: string, winSource: WinSource = 'ron'): Hand => ({
  concealed: parseTiles(concealed), melds: [],
  winningTile: parseTiles(winning)[0], winSource,
})

describe('calculate — happy path', () => {
  it('scores riichi + pinfu + tanyao as 3 han 30 fu, 3900', () => {
    const result = calculate(
      hand('34m55m567p345s678s', '2m'), ctx({ riichi: 'riichi' }), WRC_2025)
    expect(result.status).toBe('scored')
    expect(result.best!.yaku.map((y) => y.id).sort())
      .toEqual(['pinfu', 'riichi', 'tanyao'])
    expect(result.best!.han).toBe(3)
    expect(result.best!.fu.total).toBe(30)
    expect(result.best!.score.handTotal).toBe(3900)
  })

  it('adds dora to the han count', () => {
    const result = calculate(
      hand('34m55m567p345s678s', '2m'),
      ctx({ riichi: 'riichi', doraIndicators: parseTiles('4m') }),  // dora is 5m, held ×2
      WRC_2025)
    expect(result.dora.dora).toBe(2)
    expect(result.best!.han).toBe(5)
  })

  it('adds ura dora to the han count when riichi was declared', () => {
    const result = calculate(
      hand('34m55m567p345s678s', '2m'),
      ctx({ riichi: 'riichi', uraIndicators: parseTiles('4m') }),  // ura dora is 5m, held ×2
      WRC_2025)
    expect(result.dora.ura).toBe(2)
    // riichi + pinfu + tanyao (3 han) + 2 ura dora
    expect(result.best!.han).toBe(5)
  })

  it('adds aka dora to the han count under a ruleset that counts red fives', () => {
    const rules = { ...WRC_2025, akaDoraCount: 1 }
    const result = calculate(
      hand('34m05m567p345s678s', '2m'),  // 0m is a red 5m
      ctx({ riichi: 'riichi' }), rules)
    expect(result.dora.aka).toBe(1)
    // riichi + pinfu + tanyao (3 han) + 1 aka dora
    expect(result.best!.han).toBe(4)
  })
})

describe('calculate — validation and yaku requirement', () => {
  it('reports an invalid hand without scoring it', () => {
    const result = calculate(hand('34m55m567p345s67s', '2m'), ctx(), WRC_2025)
    expect(result.status).toBe('invalid')
    expect(result.best).toBeNull()
  })

  it('reports a hand that is not a winning shape', () => {
    // 13 tiles plus the win, but 78s never completes and there is no pair.
    const result = calculate(hand('135m55m567p345s78s', '2m'), ctx(), WRC_2025)
    expect(result.status).toBe('not-a-winning-hand')
  })

  it('reports a complete hand with no yaku', () => {
    // 234m 567m 234p 678s + East pair. Closed ron, no riichi. The East pair is the
    // round wind, which blocks pinfu; the honors block tanyao; nothing else fires.
    const result = calculate(hand('23m567m234p678s11z', '4m'), ctx(), WRC_2025)
    expect(result.status).toBe('no-yaku')
    expect(result.best).toBeNull()
  })

  it('does not let dora alone satisfy the yaku requirement', () => {
    const result = calculate(
      hand('23m567m234p678s11z', '4m'),
      ctx({ doraIndicators: parseTiles('1m') }),  // dora is 2m, held once
      WRC_2025)
    expect(result.dora.dora).toBe(1)
    expect(result.status).toBe('no-yaku')
    expect(result.best).toBeNull()
  })
})

describe('calculate — interpretation selection', () => {
  it('picks the highest-scoring reading and keeps the others', () => {
    // 112233445566m + 77p reads as both ryanpeikou (3 han) and chiitoitsu (2 han).
    const result = calculate(hand('112233445566m7p', '7p'), ctx(), WRC_2025)
    expect(result.status).toBe('scored')
    expect(result.best!.yaku.map((y) => y.id)).toContain('ryanpeikou')
    expect(result.alternatives.length).toBeGreaterThan(0)
    for (const alt of result.alternatives) {
      expect(alt.score.handTotal).toBeLessThanOrEqual(result.best!.score.handTotal)
    }
  })

  it('never returns an alternative that outscores the best', () => {
    const result = calculate(hand('111222333m456p9s', '9s'),
      ctx({ riichi: 'riichi' }), WRC_2025)
    const totals = result.alternatives.map((a) => a.score.handTotal)
    expect(Math.max(0, ...totals)).toBeLessThanOrEqual(result.best!.score.handTotal)
  })
})

describe('calculate — yakuman', () => {
  it('scores daisangen as a yakuman and ignores dora', () => {
    const result = calculate(
      hand('555z666z777z234m5m', '5m'),
      ctx({ doraIndicators: parseTiles('1m') }),  // dora is 2m, held once
      WRC_2025)
    expect(result.best!.yakumanMultiplier).toBe(1)
    expect(result.best!.score.handTotal).toBe(32000)
    expect(result.best!.han).toBe(0)   // dora must not be added to a yakuman hand
  })
})

describe('calculate — honba and sticks', () => {
  it('adds table payments to the total', () => {
    const result = calculate(
      hand('34m55m567p345s678s', '2m'),
      ctx({ riichi: 'riichi', honba: 2, riichiSticks: 1 }), WRC_2025)
    expect(result.best!.score.handTotal).toBe(3900)
    expect(result.best!.score.total).toBe(3900 + 600 + 1000)
  })
})
