import { describe, it, expect } from 'vitest'
import { CORPUS } from './corpus.fixture'
import { calculate } from './calculate'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, WinContext } from './types'

const baseCtx: WinContext = {
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
}

describe('worked-example corpus', () => {
  it('contains at least 20 cases', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(20)
  })

  it.each(CORPUS.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const hand: Hand = {
      concealed: parseTiles(testCase.concealed),
      melds: (testCase.melds ?? []).map((m) => ({
        kind: m.kind,
        tiles: parseTiles(m.tiles),
        calledTile: m.kind === 'ankan' ? undefined : parseTiles(m.tiles)[0],
      })),
      winningTile: parseTiles(testCase.winningTile)[0],
      winSource: testCase.winSource,
    }
    const result = calculate(hand, { ...baseCtx, ...testCase.ctx }, WRC_2025)

    expect(result.status).toBe('scored')
    expect(result.best!.yaku.map((y) => y.id).sort()).toEqual([...testCase.expect.yaku].sort())
    expect(result.best!.han).toBe(testCase.expect.han)
    expect(result.best!.fu.total).toBe(testCase.expect.fu)
    expect(result.best!.score.handTotal).toBe(testCase.expect.handTotal)
  })
})
