/**
 * Compares our engine against a third-party scorer over many generated hands.
 *
 * Sweep mode:   npm run fuzz:differential -- <count>
 * Explain mode: npm run fuzz:differential -- --explain <seed>
 *   Prints, for one seed: the hand notation, our full result (status, yaku
 *   ids, han, fu lines, handTotal, and every alternative interpretation with
 *   its handTotal), and the oracle's result (yaku names, fu list, han, fu,
 *   total). Use this instead of writing a throwaway debug script to inspect
 *   an individual seed.
 *
 * Mismatches are adjudicated by hand — the oracle is not automatically trusted.
 *
 * Oracle: riichi-score@3.0.0 (MIT, https://github.com/cwebley/kotenho, dev-only
 * dependency). Chosen and pinned in commit b60c317; that commit message records
 * the package, its license, and its dev-only placement. No separate written
 * vetting record (e.g. a survey of alternative packages) exists beyond that
 * commit and the ruleset mapping below, which is the actual evidence for how
 * its options were mapped onto WRC_2025.
 *
 * riichi-score's Ruleset below is configured to match WRC_2025 as closely as its
 * options allow (openTanyao/doubleWindPairFu/openPinfuMinimumFu/kiriageMangan/
 * kazoeYakuman/doubleYakuman all mirror src/engine/rulesets/wrc2025.ts; akaDora is
 * zeroed because WRC_2025 has akaDoraCount: 0 and, independently, the generator
 * never produces a red five).
 *
 * Coverage limits: the generator (src/engine/fuzz/generate.ts) never produces
 * melds, dora indicators, or honba/riichi-stick counts (every generated hand
 * is fully concealed, dora-free, and honba 0). So meld-call attribution, kan
 * fu, and dora/aka/ura counting are all out of scope for this sweep by
 * construction — a clean sweep here says nothing about those paths, only
 * about concealed standard/chiitoitsu/kokushi hands scored without dora.
 *
 * Known, expected divergence #1: our engine reports `han: 0` for a yakuman
 * candidate (yakuman bypasses the ordinary han total by design — see
 * src/engine/calculate.ts and the corpus fixture's kokushi/daisangen cases).
 * riichi-score does the same (verified by hand against the daisangen corpus
 * case during Step 4 vetting), so no special-casing was needed in practice —
 * but the comparator below still treats han as informational rather than a
 * fatal mismatch source in that one case.
 *
 * Known, expected divergence #2 — genuine "tied-interpretation" han/fu
 * differences at an identical total: a single physical 14-tile hand can have
 * more than one valid grouping (e.g. which of several identical winning-tile
 * copies is "the" one, changing wait classification and therefore fu). Our
 * selectBest (src/engine/select.ts) breaks ties on handTotal, then han, then
 * fu — all descending — and exposes every non-winning grouping via
 * `alternatives`. A han/fu difference from the oracle is tolerated as a real
 * tie ONLY when `alternatives` contains at least one entry whose handTotal
 * equals `best`'s: that is direct evidence our own engine found more than one
 * equally-paying way to read the hand, so the oracle picking a different one
 * is a display-order choice, not a scoring disagreement. When no such
 * alternative exists, there is nothing to tie-break — a han/fu difference at
 * equal total is reported as a MISMATCH, because kiriage mangan can hide a
 * real fu bug behind an unchanged payout (4 han 30 fu and 4 han 40 fu both
 * pay mangan) and equal-han/unequal-fu has no tie-break story at all (fu
 * isn't part of the rank() comparator once han is equal, so a genuine
 * fu-computation difference would never surface an alternative to justify
 * it). Commit b60c317's message records the result of the last sweep run under
 * this rule: 5000 hands generated (4279 compared), 0 mismatches, and the 6
 * tied-interpretation cases all carrying a real equal-handTotal alternative
 * per the `hasEqualPayoutTie` check in `sweep()` below. No separate per-seed
 * adjudication log exists beyond that commit message and this harness's own
 * classification logic — rerun `npm run fuzz:differential` to reproduce it.
 */
import { calculate as oracleCalculate, createGameState } from 'riichi-score'
import type { Direction, MahjongTile, WinningTile } from 'riichi-score'
import { randomWinningHand } from '../src/engine/fuzz/generate'
import { calculate, type CalculationResult } from '../src/engine/calculate'
import type { Candidate } from '../src/engine/select'
import { WRC_2025 } from '../src/engine/rulesets/wrc2025'
import { sortTiles, tilesToNotation } from '../src/engine/tiles'
import type { Hand, Tile, WinContext, Wind } from '../src/engine/types'

export interface Oracle {
  name: string
  /** Returns null when the oracle declines to score the hand. */
  score(hand: Hand, ctx: WinContext): { han: number; fu: number; total: number } | null
}

const WIND_TO_DIRECTION: Record<Wind, Direction> = {
  E: 'east', S: 'south', W: 'west', N: 'north',
}

function toOracleTile(tile: Tile): MahjongTile {
  if (tile.suit === 'z') return `${tile.rank}z` as MahjongTile
  const rank = tile.red ? 0 : tile.rank
  return `${rank}${tile.suit}` as MahjongTile
}

/** Any seat other than the winner's own — ron's payer never affects scoring here,
 * since the generator never produces melds (so no call-source rule applies). */
function otherSeat(seatWind: Wind): Direction {
  const order: Wind[] = ['E', 'S', 'W', 'N']
  const next = order[(order.indexOf(seatWind) + 1) % 4]
  return WIND_TO_DIRECTION[next]
}

const ORACLE_RULESET = {
  openTanyao: true,
  doubleWindPairFu: 2 as const,
  openPinfuMinimumFu: 30 as const,
  kiriageMangan: true,
  kazoeYakuman: true,
  doubleYakuman: {
    daisuushii: false, kokushi13Wait: false, suuankouTanki: false, junseiChuuren: false,
  },
  akaDora: { manzu: 0, pinzu: 0, souzu: 0 },
}

/** Builds the riichi-score request for a generated hand and runs it through the oracle. */
function runOracle(hand: Hand, ctx: WinContext) {
  const winningTile: WinningTile = hand.winSource === 'tsumo'
    ? { tile: toOracleTile(hand.winningTile), isTsumo: true }
    : { tile: toOracleTile(hand.winningTile), from: otherSeat(ctx.seatWind) }

  const gameState = createGameState({
    roundWind: WIND_TO_DIRECTION[ctx.roundWind],
    seatWind: WIND_TO_DIRECTION[ctx.seatWind],
    doraIndicators: ctx.doraIndicators.map(toOracleTile),
    uradoraIndicators: ctx.uraIndicators.map(toOracleTile),
    isRiichi: ctx.riichi !== 'none',
    isDoubleRiichi: ctx.riichi === 'double',
    isIppatsu: ctx.ippatsu,
    isHaitei: ctx.haitei,
    isHoutei: ctx.houtei,
    isRinshan: ctx.rinshan,
    isChankan: ctx.chankan,
    isTenhou: ctx.tenhou,
    isChiihou: ctx.chiihou,
    honbaCount: ctx.honba,
    ruleset: ORACLE_RULESET,
  })

  return oracleCalculate({
    closedTiles: hand.concealed.map(toOracleTile),
    openMelds: [],
    winningTile,
    gameState,
  })
}

const riichiScoreOracle: Oracle = {
  name: 'riichi-score@3.0.0',
  score(hand, ctx) {
    const analysis = runOracle(hand, ctx)
    if (!analysis.valid || analysis.handInterpretations.length === 0) return null
    const best = analysis.handInterpretations[0]
    if (best.yaku.length === 0) return null

    return { han: best.han, fu: best.fu, total: best.totalWinnings }
  },
}

const oracle: Oracle = riichiScoreOracle

function formatHand(hand: Hand, ctx: WinContext): string {
  const concealed = tilesToNotation(sortTiles(hand.concealed))
  const winning = tilesToNotation([hand.winningTile])
  const riichi = ctx.riichi === 'none' ? 'no riichi' : ctx.riichi
  return `${concealed} + [${winning}] (${hand.winSource}, seat ${ctx.seatWind}, round ${ctx.roundWind}, ${riichi})`
}

function formatCandidate(label: string, c: Candidate): string {
  const yaku = c.yaku.map((y) => `${y.id}(${y.han}${y.yakuman ? ` yakuman×${y.yakuman}` : ''})`).join(', ')
  const fuLines = c.fu.lines.map((l) => `${l.id}:${l.fu}${l.note ? `(${l.note})` : ''}`).join(' + ')
  return [
    `${label}: han=${c.han} fu=${c.fu.total} (raw ${c.fu.raw}, wait ${c.fu.wait ?? 'n/a'}) `
      + `handTotal=${c.score.handTotal} total=${c.score.total} limit=${c.score.limitClass ?? 'none'}`,
    `${label} yaku: ${yaku || '(none)'}`,
    `${label} fu lines: ${fuLines || '(none)'}`,
  ].join('\n')
}

function formatOurs(result: CalculationResult): string {
  const lines = [`status: ${result.status}`]
  if (result.best) lines.push(formatCandidate('best', result.best))
  result.alternatives.forEach((alt, i) => lines.push(formatCandidate(`alt[${i}]`, alt)))
  return lines.join('\n')
}

function formatOracle(hand: Hand, ctx: WinContext): string {
  const analysis = runOracle(hand, ctx)
  if (!analysis.valid) return `invalid: ${analysis.errors.join('; ')}`
  if (analysis.handInterpretations.length === 0) return 'no interpretations'

  const best = analysis.handInterpretations[0]
  const yaku = best.yaku.map((y) => `${y.name}(${y.han}${y.limit ? ` ${y.limit}` : ''})`).join(', ')
  const fuList = best.fuList.map((f) => `${f.reason}:${f.value}`).join(' + ')
  return [
    `han=${best.han} fu=${best.fu} (raw ${best.rawFu}) total=${best.totalWinnings} `
      + `limit=${best.limit ?? 'none'} interpretations=${analysis.handInterpretations.length}`,
    `yaku: ${yaku || '(none)'}`,
    `fu list: ${fuList || '(none)'}`,
  ].join('\n')
}

function explain(seed: number): void {
  const { hand, ctx } = randomWinningHand(seed)
  console.log(`seed ${seed}`)
  console.log(`hand: ${formatHand(hand, ctx)}`)
  console.log(`\n--- ours ---`)
  console.log(formatOurs(calculate(hand, ctx, WRC_2025)))
  console.log(`\n--- ${oracle.name} ---`)
  console.log(formatOracle(hand, ctx))
}

function sweep(count: number): void {
  let compared = 0
  // A genuine disagreement about what the winner is actually paid, OR a han/fu
  // divergence with no equal-handTotal alternative to justify it as a tie.
  // This is the only category that fails the sweep.
  const mismatches: string[] = []
  // Same total, AND our engine reports a real equal-handTotal alternative —
  // see "Known, expected divergence #2" above. Reported for visibility, not a failure.
  const tieBreakNotes: string[] = []

  for (let seed = 1; seed <= count; seed++) {
    const { hand, ctx } = randomWinningHand(seed)
    const ours = calculate(hand, ctx, WRC_2025)
    if (ours.status !== 'scored') continue

    const theirs = oracle.score(hand, ctx)
    if (!theirs) continue

    compared += 1
    const mine = ours.best!
    const line = `seed ${seed}: ours ${mine.han}h/${mine.fu.total}f/${mine.score.handTotal} ` +
      `vs ${oracle.name} ${theirs.han}h/${theirs.fu}f/${theirs.total}`

    if (mine.score.handTotal !== theirs.total) {
      mismatches.push(line)
      continue
    }

    // han is informational-only here too: our engine zeroes han on a yakuman
    // candidate by design (divergence #1 above).
    const hanMismatch = mine.han !== theirs.han && !(mine.yakumanMultiplier > 0 && theirs.han === 0)
    const fuMismatch = mine.fu.total !== theirs.fu
    if (!hanMismatch && !fuMismatch) continue

    const hasEqualPayoutTie = ours.alternatives.some((alt) => alt.score.handTotal === mine.score.handTotal)
    if (hasEqualPayoutTie) {
      tieBreakNotes.push(line)
    } else {
      mismatches.push(`${line}  [no equal-handTotal alternative — not a tolerated tie]`)
    }
  }

  console.log(`Compared ${compared} hands against ${oracle.name}.`)
  console.log('Coverage note: generated hands are fully concealed, dora-free, and honba 0 — '
    + 'meld attribution, kan fu, and dora/aka/ura counting are not exercised by this sweep.')
  if (tieBreakNotes.length > 0) {
    console.log(`\n${tieBreakNotes.length} tied-interpretation notes (same total, different han/fu, `
      + `backed by a real equal-handTotal alternative — not failures):`)
    for (const line of tieBreakNotes.slice(0, 50)) console.log(line)
  }
  console.log(`\n${mismatches.length} mismatches (total payout disagreed, or han/fu diverged with no tie to justify it).`)
  for (const line of mismatches.slice(0, 50)) console.log(line)
  process.exit(mismatches.length === 0 ? 0 : 1)
}

const args = process.argv.slice(2)
if (args[0] === '--explain') {
  const seed = Number(args[1])
  if (!Number.isInteger(seed)) {
    console.error('Usage: npm run fuzz:differential -- --explain <seed>')
    process.exit(1)
  }
  explain(seed)
} else {
  sweep(Number(args[0] ?? 5000))
}
