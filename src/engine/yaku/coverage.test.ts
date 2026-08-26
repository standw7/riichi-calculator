import { describe, it, expect } from 'vitest'
import { YAKU_COVERAGE, type CoverageHand } from './coverage.fixture'
import { YAKU_RULES } from './registry'
import { calculate } from '../calculate'
import { parseTiles } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'
import type { Hand, WinContext } from '../types'

const baseCtx: WinContext = {
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
}

const build = (spec: CoverageHand): [Hand, WinContext] => [
  {
    concealed: parseTiles(spec.concealed),
    melds: (spec.melds ?? []).map((m) => ({
      kind: m.kind,
      tiles: parseTiles(m.tiles),
      calledTile: m.kind === 'ankan' ? undefined : parseTiles(m.tiles)[0],
    })),
    winningTile: parseTiles(spec.winningTile)[0],
    winSource: spec.winSource ?? 'ron',
  },
  { ...baseCtx, ...spec.ctx },
]

/** True when any interpretation of the hand yields the yaku. */
const yields = (spec: CoverageHand, id: string): boolean => {
  const [hand, ctx] = build(spec)
  const result = calculate(hand, ctx, WRC_2025)
  const all = [result.best, ...result.alternatives].filter((c) => c !== null)
  return all.some((c) => c!.yaku.some((y) => y.id === id))
}

describe('yaku coverage gate', () => {
  it('every registered yaku has a positive and a negative case', () => {
    const missing = YAKU_RULES
      .map((rule) => rule.id)
      .filter((id) => !(id in YAKU_COVERAGE))
    expect(missing).toEqual([])
  })

  it('no coverage entry refers to an unregistered yaku', () => {
    const known = new Set(YAKU_RULES.map((rule) => rule.id))
    expect(Object.keys(YAKU_COVERAGE).filter((id) => !known.has(id))).toEqual([])
  })

  it.each(Object.entries(YAKU_COVERAGE))('%s — positive case yields the yaku', (id, c) => {
    expect(yields(c.positive, id)).toBe(true)
  })

  it.each(Object.entries(YAKU_COVERAGE))('%s — negative case does not', (id, c) => {
    expect(yields(c.negative, id)).toBe(false)
  })
})
