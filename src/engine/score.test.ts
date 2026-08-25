import { describe, it, expect } from 'vitest'
import { score } from './score'
import { WRC_2025 } from './rulesets/wrc2025'
import { RON_TABLE } from './scoreTable.fixture'

// WRC 2025 ships with kiriageMangan: true (confirmed against the official rulebook in
// task 3). The published RON_TABLE fixture is the base score table, i.e. scoring without
// kiriage rounding, so table-driven and kiriage-sensitive tests are run against this
// kiriage-off variant instead of WRC_2025 directly.
const NO_KIRIAGE = { ...WRC_2025, kiriageMangan: false }

const base = {
  yakumanMultiplier: 0,
  isDealer: false,
  winSource: 'ron' as const,
  honba: 0,
  riichiSticks: 0,
}

describe('score — non-dealer ron', () => {
  it('scores 1 han 30 fu as 1000', () => {
    expect(score({ ...base, han: 1, fu: 30 }, WRC_2025).handTotal).toBe(1000)
  })

  it('scores 3 han 30 fu as 3900', () => {
    expect(score({ ...base, han: 3, fu: 30 }, WRC_2025).handTotal).toBe(3900)
  })

  it('scores 3 han 40 fu as 5200', () => {
    expect(score({ ...base, han: 3, fu: 40 }, WRC_2025).handTotal).toBe(5200)
  })

  it('scores 4 han 30 fu as 7700 when the ruleset has kiriage off', () => {
    expect(score({ ...base, han: 4, fu: 30 }, NO_KIRIAGE).handTotal).toBe(7700)
  })

  it('caps 4 han 40 fu at mangan because base points exceed 2000', () => {
    const result = score({ ...base, han: 4, fu: 40 }, WRC_2025)
    expect(result.handTotal).toBe(8000)
    expect(result.limitClass).toBe('mangan')
  })

  it('scores chiitoitsu 2 han 25 fu as 1600', () => {
    expect(score({ ...base, han: 2, fu: 25 }, WRC_2025).handTotal).toBe(1600)
  })
})

describe('score — dealer ron', () => {
  it('scores 1 han 30 fu as 1500', () => {
    expect(score({ ...base, han: 1, fu: 30, isDealer: true }, WRC_2025).handTotal).toBe(1500)
  })

  it('scores mangan as 12000', () => {
    expect(score({ ...base, han: 5, fu: 30, isDealer: true }, WRC_2025).handTotal).toBe(12000)
  })
})

describe('score — tsumo splits', () => {
  it('splits non-dealer 3 han 30 fu tsumo as 1000/2000', () => {
    const result = score({ ...base, han: 3, fu: 30, winSource: 'tsumo' }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo', dealerPays: 2000, nonDealerPays: 1000 })
    expect(result.handTotal).toBe(4000)
  })

  it('splits dealer 3 han 30 fu tsumo as 2000 all', () => {
    const result = score(
      { ...base, han: 3, fu: 30, isDealer: true, winSource: 'tsumo' }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo-all', eachPays: 2000 })
    expect(result.handTotal).toBe(6000)
  })

  it('splits non-dealer mangan tsumo as 2000/4000', () => {
    const result = score({ ...base, han: 5, fu: 30, winSource: 'tsumo' }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo', dealerPays: 4000, nonDealerPays: 2000 })
  })
})

describe('score — limit classes', () => {
  it.each([
    [5, 'mangan', 8000],
    [6, 'haneman', 12000],
    [8, 'baiman', 16000],
    [11, 'sanbaiman', 24000],
    [13, 'kazoe-yakuman', 32000],
  ] as const)('scores %i han as %s worth %i to a non-dealer ron', (han, cls, total) => {
    const result = score({ ...base, han, fu: 30 }, WRC_2025)
    expect(result.limitClass).toBe(cls)
    expect(result.handTotal).toBe(total)
  })

  it('honours a ruleset that scores kazoe as sanbaiman', () => {
    const rules = { ...WRC_2025, kazoe: 'sanbaiman' as const }
    expect(score({ ...base, han: 13, fu: 30 }, rules).handTotal).toBe(24000)
  })

  it('applies kiriage mangan under WRC 2025, which enables it', () => {
    expect(score({ ...base, han: 4, fu: 30 }, WRC_2025).handTotal).toBe(8000)
    expect(score({ ...base, han: 3, fu: 60 }, WRC_2025).handTotal).toBe(8000)
    expect(score({ ...base, han: 3, fu: 40 }, WRC_2025).handTotal).toBe(5200)
  })

  it('does not round up when the ruleset disables kiriage', () => {
    expect(score({ ...base, han: 4, fu: 30 }, NO_KIRIAGE).handTotal).toBe(7700)
    expect(score({ ...base, han: 3, fu: 60 }, NO_KIRIAGE).handTotal).toBe(7700)
  })
})

describe('score — yakuman', () => {
  it('scores a single yakuman ron as 32000 for a non-dealer', () => {
    const result = score({ ...base, han: 13, fu: 20, yakumanMultiplier: 1 }, WRC_2025)
    expect(result.limitClass).toBe('yakuman')
    expect(result.handTotal).toBe(32000)
  })

  it('scores a double yakuman dealer ron as 96000', () => {
    const result = score(
      { ...base, han: 26, fu: 20, yakumanMultiplier: 2, isDealer: true }, WRC_2025)
    expect(result.handTotal).toBe(96000)
  })
})

describe('score — honba and riichi sticks', () => {
  it('adds 300 per honba from the discarder on a ron', () => {
    const result = score({ ...base, han: 1, fu: 30, honba: 2 }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'ron', discarderPays: 1600 })
    expect(result.handTotal).toBe(1000)
    expect(result.total).toBe(1600)
  })

  it('adds 100 per honba from each player on a tsumo', () => {
    const result = score(
      { ...base, han: 3, fu: 30, winSource: 'tsumo', honba: 1 }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo', dealerPays: 2100, nonDealerPays: 1100 })
    expect(result.total).toBe(4300)
  })

  it('adds riichi sticks to the total but not to any payment', () => {
    const result = score({ ...base, han: 1, fu: 30, riichiSticks: 2 }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'ron', discarderPays: 1000 })
    expect(result.total).toBe(3000)
  })

  it('adds 100 per honba from each player on a dealer tsumo, and the total reconciles', () => {
    const result = score(
      { ...base, han: 3, fu: 30, isDealer: true, winSource: 'tsumo', honba: 2 }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo-all', eachPays: 2200 })
    expect(result.handTotal).toBe(6000)
    expect(result.total).toBe(6600)
    // eachPays × 3 must equal total minus riichi-stick payments (0 here) — the payment
    // split reconstructs the reported total exactly.
    expect(result.payments.kind === 'tsumo-all' ? result.payments.eachPays * 3 : NaN)
      .toBe(result.total - base.riichiSticks * 1000)
  })
})

describe('score — explanation steps', () => {
  it('records the base-point formula with real numbers', () => {
    const result = score({ ...base, han: 3, fu: 30 }, WRC_2025)
    const baseStep = result.steps.find((s) => s.label === 'Base points')
    expect(baseStep).toEqual({
      label: 'Base points',
      expression: '30 × 2^(2 + 3)',
      value: 960,
    })
  })

  it('records the rounding step for a non-dealer ron', () => {
    const result = score({ ...base, han: 3, fu: 30 }, WRC_2025)
    const payStep = result.steps.find((s) => s.label === 'Discarder pays')
    expect(payStep).toEqual({
      label: 'Discarder pays',
      expression: '960 × 4 = 3,840 → rounded up to 3,900',
      value: 3900,
    })
  })
})

describe('score — matches the published table cell by cell', () => {
  it.each(Object.entries(RON_TABLE))('%s', (key, expected) => {
    const [han, fu] = key.split('-').map(Number)
    const common = {
      han, fu, yakumanMultiplier: 0, winSource: 'ron' as const, honba: 0, riichiSticks: 0,
    }
    expect(score({ ...common, isDealer: false }, NO_KIRIAGE).handTotal)
      .toBe(expected.nonDealerRon)
    expect(score({ ...common, isDealer: true }, NO_KIRIAGE).handTotal)
      .toBe(expected.dealerRon)
  })
})
