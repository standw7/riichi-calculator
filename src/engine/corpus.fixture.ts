import type { WinContext, WinSource } from './types'

export interface CorpusCase {
  name: string
  concealed: string
  winningTile: string
  winSource: WinSource
  melds?: Array<{ kind: 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'; tiles: string }>
  ctx?: Partial<WinContext>
  expect: {
    yaku: string[]
    han: number
    fu: number
    /** The hand's value excluding honba and riichi sticks. */
    handTotal: number
  }
}

/**
 * Worked examples with expected results.
 * Every case must be checked against a published source before being added —
 * these are the oracle, so a case derived from our own output proves nothing.
 *
 * Every expected value below is derived by hand from the documented rules (base 20 fu;
 * closed ron +10; tsumo +2 unless pinfu; minko 2/4, ankou 4/8, minkan 8/16, ankan 16/32;
 * value pair 2; wait fu 2 for tanki/kanchan/penchan; round up to 10; chiitoitsu flat 25;
 * base points = fu x 2^(2+han) capped at 2000 (mangan); WRC_2025 has kiriage mangan;
 * ron non-dealer x4 / dealer x6; tsumo non-dealer 2+1+1 / dealer 2+2+2; each payment
 * individually rounded up to the nearest 100). Where a case's han/fu land in the printed
 * RON_TABLE (src/engine/scoreTable.fixture.ts, transcribed by hand from a printed score
 * table, independent of this file and of calculate()), the payment is cross-checked
 * against that table too — noted per case below.
 */
export const CORPUS: CorpusCase[] = [
  {
    name: 'riichi + pinfu + tanyao, closed ron, non-dealer',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'ron',
    ctx: { riichi: 'riichi', seatWind: 'S', roundWind: 'E' },
    // fu: 20 base + 10 menzen ron = 30 (pinfu suppresses tsumo/wait fu; ryanmen wait).
    // han: pinfu 1 + riichi 1 + tanyao 1 = 3.
    // base = 30 x 2^5 = 960; non-dealer ron = 960 x 4 = 3840 -> 3900.
    expect: { yaku: ['pinfu', 'riichi', 'tanyao'], han: 3, fu: 30, handTotal: 3900 },
  },
  {
    name: 'riichi + pinfu + tanyao + menzen tsumo, closed tsumo, non-dealer',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'tsumo',
    ctx: { riichi: 'riichi', seatWind: 'S', roundWind: 'E' },
    // fu: pinfu tsumo is fixed at 20 (base 20 only).
    // han: menzen-tsumo 1 + pinfu 1 + riichi 1 + tanyao 1 = 4.
    // base = 20 x 2^6 = 1280; dealer pays 1280x2=2560->2600, each non-dealer 1280->1300;
    // handTotal = 2600 + 1300*2 = 5200.
    expect: {
      yaku: ['menzen-tsumo', 'pinfu', 'riichi', 'tanyao'],
      han: 4, fu: 20, handTotal: 5200,
    },
  },
  {
    name: 'chiitoitsu alone, closed ron, non-dealer',
    concealed: '1122m3344p5566s7z',
    winningTile: '7z',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // fu: flat 25 (chiitoitsu). han: chiitoitsu 2.
    // base = 25 x 2^4 = 400; non-dealer ron = 1600. Cross-check RON_TABLE '2-25' = 1600.
    expect: { yaku: ['chiitoitsu'], han: 2, fu: 25, handTotal: 1600 },
  },
  {
    name: 'yakuhai only on an open pon, tanki wait, non-dealer ron',
    concealed: '234m567p345s5p',
    winningTile: '5p',
    winSource: 'ron',
    melds: [{ kind: 'pon', tiles: '555z' }],
    ctx: { seatWind: 'S', roundWind: 'E' },
    // fu: 20 base + 4 minko (open honor pon) + 2 tanki wait = 26 -> 30 (open, not 20, so
    // openPinfuFu does not apply). han: yakuhai-haku (open) 1.
    // base = 30 x 2^3 = 240; non-dealer ron = 960 -> 1000. Cross-check RON_TABLE '1-30'=1000.
    expect: { yaku: ['yakuhai-haku'], han: 1, fu: 30, handTotal: 1000 },
  },
  {
    name: 'daisangen, non-dealer ron',
    concealed: '555z666z777z234m5m',
    winningTile: '5m',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // 20 base + 10 menzen ron + three honour ankou (8 each) + 2 tanki = 56 -> 60.
    // Yakuman: han reported as 0 (yaku's own han is 0; yakuman bypasses dora/han-add).
    // base = 8000 x 1; non-dealer ron = 8000 x 4 = 32000.
    expect: { yaku: ['daisangen'], han: 0, fu: 60, handTotal: 32000 },
  },
  {
    name: 'riichi with a closed kan (terminal ankan), non-dealer ron — hand with a kan',
    concealed: '234m66p345s78s',
    winningTile: '9s',
    winSource: 'ron',
    melds: [{ kind: 'ankan', tiles: '1111m' }],
    ctx: { riichi: 'riichi', seatWind: 'S', roundWind: 'E' },
    // Groups: ankan 1111m (closed) + 234m + 66p pair + 345s + 789s (won on 9s, ryanmen).
    // fu: 20 base + 10 menzen ron + 32 ankan (terminal, closed) = 62 -> 70.
    // han: riichi 1 (no other yaku: the ankan kills tanyao/pinfu, no yakuhai/dora).
    // base = 70 x 2^3 = 560; non-dealer ron = 2240 -> 2300. Cross-check RON_TABLE '1-70'=2300.
    expect: { yaku: ['riichi'], han: 1, fu: 70, handTotal: 2300 },
  },
  {
    name: 'toitoi + sanankou via shanpon ron — ron-completed triplet does not count as concealed',
    concealed: '111m999p111s44p88s',
    winningTile: '4p',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: ankou 111m, 999p, 111s (all closed) + 444p (pair 44p completed by ron ->
    // scored as an open/minko triplet, so it does NOT count toward suuankou) + pair 88s.
    // Sanankou needs >=3 concealed triplets: 3 remain (111m/999p/111s), so it still fires,
    // but suuankou (needs 4) does not — this is the "shanpon ron costs sanankou [not
    // suuankou]" case. toitoi also fires (all 4 blocks are triplets).
    // fu: 20 base + 10 menzen ron + 8+8+8 (three closed terminal ankou) + 2 (444p minko,
    // completed by ron, simple tile) + 0 (shanpon wait, no wait fu) = 56 -> 60.
    // han: toitoi 2 + sanankou 2 = 4 (closed).
    // 4han/60fu: raw = 60 x 2^6 = 3840 >= 2000, so mangan (base 2000) on the formula alone
    // (kiriage mangan does not even need to apply here). Non-dealer ron = 2000x4 = 8000.
    expect: { yaku: ['sanankou', 'toitoi'], han: 4, fu: 60, handTotal: 8000 },
  },
  {
    name: 'chanta, closed ron, non-dealer',
    concealed: '123m789p123s444z9s',
    winningTile: '9s',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: 123m, 789p, 123s (each holds a terminal; starts 1/7/1 so this is NOT also a
    // sanshoku doujun — the three suits don't share a start), 444z (North wind ankou,
    // holds an honor; North matches neither seat S nor round E, so no yakuhai), pair 99s
    // (terminal, tanki). Every group holds a terminal or honor, at least one sequence, and
    // an honor tile is present, so this is chanta (not junchan, which forbids honors).
    // fu: 20 base + 10 menzen ron + 8 (444z ankou, honor) + 2 (tanki wait) = 40.
    // han: chanta 2 (closed).
    // base = 40 x 2^4 = 640; non-dealer ron = 2560 -> 2600. Cross-check RON_TABLE '2-40'=2600.
    expect: { yaku: ['chanta'], han: 2, fu: 40, handTotal: 2600 },
  },
  {
    name: 'honitsu + ittsu, closed ron, non-dealer',
    concealed: '123m456m789m333z4z',
    winningTile: '4z',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: 123m, 456m, 789m (a full 1-4-7 run in one suit -> ittsu), 333z (West wind
    // ankou; West matches neither seat S nor round E), pair 44z (North, tanki). Only one
    // suit used plus honors -> honitsu. (Not chinitsu: honors are present.)
    // fu: 20 base + 10 menzen ron + 8 (333z ankou, honor) + 2 (tanki) = 40.
    // han: honitsu 3 + ittsu 2 = 5 (closed) -> mangan regardless of fu.
    // Non-dealer ron mangan = 2000 x 4 = 8000.
    expect: { yaku: ['honitsu', 'ittsu'], han: 5, fu: 40, handTotal: 8000 },
  },
  {
    name: 'pinfu + tanyao + menzen tsumo, dealer tsumo',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'tsumo',
    ctx: { seatWind: 'E', roundWind: 'E' },
    // Same shape as case 1/2 but no riichi, dealer seat, tsumo.
    // fu: pinfu tsumo fixed at 20. han: menzen-tsumo 1 + pinfu 1 + tanyao 1 = 3.
    // base = 20 x 2^5 = 640; dealer tsumo: each of 3 pays 640x2=1280 -> 1300.
    // handTotal = 1300 x 3 = 3900 (the textbook "1300 all").
    expect: { yaku: ['menzen-tsumo', 'pinfu', 'tanyao'], han: 3, fu: 20, handTotal: 3900 },
  },
  {
    name: 'riichi + pinfu + tanyao, ron, with honba and riichi sticks on the table',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'ron',
    ctx: {
      riichi: 'riichi', seatWind: 'S', roundWind: 'E', honba: 2, riichiSticks: 3,
    },
    // Identical hand/fu/han to case 1 (han 3, fu 30, handTotal 3900). Honba and riichi
    // sticks add to `total` but must NOT change `handTotal`, which is what this case
    // asserts — 2 honba would add 600 and 3 sticks would add 3000 to `total`, but
    // handTotal stays 3900.
    expect: { yaku: ['pinfu', 'riichi', 'tanyao'], han: 3, fu: 30, handTotal: 3900 },
  },
  {
    name: 'kokushi musou (single wait), non-dealer ron',
    concealed: '119m19p19s123456z',
    winningTile: '7z',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Concealed already holds a pair (1m1m) plus the other 11 orphan types as singles,
    // missing only 7z; winning on 7z completes the 13th type as a NEW single (the pair
    // was already formed before the win), so this is plain kokushi, not the 13-wait.
    // Yakuman -> han reported as 0; fu is 0 for the kokushi structure (fu.ts special-cases
    // it). base = 8000 x 1; non-dealer ron = 8000 x 4 = 32000.
    expect: { yaku: ['kokushi'], han: 0, fu: 0, handTotal: 32000 },
  },
  {
    name: 'suuankou tanki, non-dealer ron',
    concealed: '111m999p111s555z6z',
    winningTile: '6z',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: ankou 111m, 999p, 111s, 555z (haku) + pair 66z (hatsu, tanki). The winning
    // tile lands in the pair, not any triplet, so unlike the shanpon case above, a tanki
    // ron does NOT turn any triplet into an "effectively open" one — all 4 stay concealed,
    // and the wait is tanki, so this is suuankou-tanki (double yakuman), not suuankou.
    // fu: 20 base + 10 menzen ron + 8+8+8 (terminal ankou x3) + 8 (555z honor ankou) +
    // 2 (66z dragon value pair) + 2 (tanki wait) = 66 -> 70.
    // Yakuman -> han reported as 0. WRC_2025 sets doubleYakuman: false ("No double
    // yakuman for winning on a specific wait"), so even though suuankou-tanki is defined
    // as yakuman: 2 in the registry, detectYaku caps it to a single yakuman multiplier
    // under this ruleset. base = 8000 x 1 = 8000; non-dealer ron = 8000 x 4 = 32000.
    expect: { yaku: ['suuankou-tanki'], han: 0, fu: 70, handTotal: 32000 },
  },
  {
    name: 'chuuren poutou (impure, single wait), closed ron, non-dealer',
    concealed: '1111234567899p',
    winningTile: '9p',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Concealed rank counts: 1x4, 2..8 x1, 9x2 — not the pure 1112345678999 pattern (four
    // 1s instead of three, two 9s instead of three), so this is tenpai on 9p alone, not
    // the nine-sided wait: plain chuuren (not chuuren-9).
    // The only valid decomposition is 111 (triplet) + 123 + 456 + 789 + 99 (pair); the
    // winning 9p can be read as completing either the pair (tanki, fu 40) or the 789
    // sequence (ryanmen, fu 38->40) — both round to the same 40 fu, so no ambiguity.
    // Yakuman -> han reported as 0. base = 8000 x 1; non-dealer ron = 32000.
    expect: { yaku: ['chuuren'], han: 0, fu: 40, handTotal: 32000 },
  },
  {
    name: 'sanshoku doujun, open (han reduced from 2 to 1 by the open chi)',
    concealed: '456p456s78m22s',
    winningTile: '9m',
    winSource: 'ron',
    melds: [{ kind: 'chi', tiles: '456m' }],
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: chi 456m (open) + 456p + 456s + 789m (won on 9m, ryanmen) + pair 22s.
    // Same 4-5-6 run in all three suits -> sanshoku doujun, but the hand is open, so it
    // scores openHan 1, not closedHan 2 — the "open hand with a han reduction" case.
    // fu: 20 base only (open, no menzen bonus, no triplets, ryanmen wait) = 20 -> since the
    // hand is open and totals exactly 20, WRC's openPinfuFu (30) applies instead of 20.
    // base = 30 x 2^3 = 240; non-dealer ron = 960 -> 1000. Cross-check RON_TABLE '1-30'=1000.
    expect: { yaku: ['sanshoku-doujun'], han: 1, fu: 30, handTotal: 1000 },
  },
  {
    name: 'double riichi + ippatsu + menzen tsumo + pinfu + tanyao, non-dealer tsumo',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'tsumo',
    ctx: {
      riichi: 'double', ippatsu: true, seatWind: 'S', roundWind: 'E',
    },
    // Same shape as case 1/2. double-riichi (2, supersedes riichi) + ippatsu (1) +
    // menzen-tsumo (1) + pinfu (1) + tanyao (1) = 6 han closed -> haneman (fixed 3000).
    // fu: pinfu tsumo fixed 20 (irrelevant to the score once haneman is reached).
    // Dealer pays 3000x2=6000, each non-dealer pays 3000; handTotal = 6000+3000*2=12000.
    expect: {
      yaku: ['double-riichi', 'ippatsu', 'menzen-tsumo', 'pinfu', 'tanyao'],
      han: 6, fu: 20, handTotal: 12000,
    },
  },
  {
    name: 'junchan, closed ron, non-dealer',
    concealed: '123m789m123p11s78s',
    winningTile: '9s',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: 123m, 789m, 123p, 789s (won on 9s, ryanmen), pair 11s — every group holds a
    // terminal, at least one sequence, and NO honors anywhere -> junchan (supersedes
    // chanta, which does not independently match since it requires an honor tile). The
    // shape is also plain pinfu: four sequences, a non-value pair, and a ryanmen wait.
    // fu: 20 base + 10 menzen ron + 0 (no triplets, ryanmen wait, non-honor pair) = 30.
    // han: junchan 3 + pinfu 1 = 4 (closed). WRC's kiriage mangan rounds 4 han/30 fu up
    // to mangan (base 2000) even though the raw formula (30 x 2^6 = 1920) would not cap.
    // Non-dealer ron mangan = 2000 x 4 = 8000.
    expect: { yaku: ['junchan', 'pinfu'], han: 4, fu: 30, handTotal: 8000 },
  },
  {
    name: 'ryanpeikou + pinfu + menzen tsumo, non-dealer tsumo',
    concealed: '223344m55667p99s',
    winningTile: '7p',
    winSource: 'tsumo',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: 234m x2, 567p x2 (won on 7p, ryanmen), pair 99s. Two identical-sequence
    // pairs closed -> ryanpeikou (3, supersedes iipeikou); the shape is also plain pinfu
    // (four sequences, non-value pair, ryanmen wait) plus menzen-tsumo.
    // fu: pinfu tsumo fixed 20. han: ryanpeikou 3 + pinfu 1 + menzen-tsumo 1 = 5 -> mangan.
    // Tsumo non-dealer mangan: dealer pays 2000x2=4000, each non-dealer pays 2000;
    // handTotal = 4000 + 2000*2 = 8000.
    expect: {
      yaku: ['menzen-tsumo', 'pinfu', 'ryanpeikou'], han: 5, fu: 20, handTotal: 8000,
    },
  },
  {
    name: 'riichi + pinfu + tanyao boosted to mangan by 2 dora, ron, non-dealer',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'ron',
    ctx: {
      riichi: 'riichi', seatWind: 'S', roundWind: 'E',
      doraIndicators: [{ suit: 'm', rank: 4, red: false }],
    },
    // Same shape as case 1 (pinfu 1 + riichi 1 + tanyao 1 = 3 han, fu 30), but a dora
    // indicator of 4m makes 5m the dora tile; the hand holds a 5m pair, so +2 dora.
    // 3 + 2 = 5 han -> mangan (fixed 2000) regardless of fu.
    // Non-dealer ron mangan = 2000 x 4 = 8000.
    expect: { yaku: ['pinfu', 'riichi', 'tanyao'], han: 5, fu: 30, handTotal: 8000 },
  },
  {
    name: 'tanyao with an open kan (minkan), non-dealer ron',
    concealed: '234m567p33p67s',
    winningTile: '8s',
    winSource: 'ron',
    melds: [{ kind: 'minkan', tiles: '5555s' }],
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: minkan 5555s (open, simple) + 234m + 567p + pair 33p + 678s (won on 8s,
    // ryanmen). Every tile is a simple -> tanyao (kuitan is allowed under WRC_2025).
    // fu: 20 base (open, no menzen bonus) + 8 (minkan, simple tile) + 0 (sequences, ryanmen
    // wait, non-value pair) = 28 -> 30 (open and rounded is 30, not 20, so openPinfuFu
    // does not need to apply — it just naturally lands on 30).
    // han: tanyao 1 (open).
    // base = 30 x 2^3 = 240; non-dealer ron = 960 -> 1000. Cross-check RON_TABLE '1-30'=1000.
    expect: { yaku: ['tanyao'], han: 1, fu: 30, handTotal: 1000 },
  },
  {
    name: 'shousangen + two dragon yakuhai, closed ron, non-dealer',
    concealed: '555z666z234m567p7z',
    winningTile: '7z',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // Groups: 555z (haku ankou) + 666z (hatsu ankou) + 234m + 567p + pair 77z (chun,
    // tanki). Two dragon triplets plus the third dragon as the pair -> shousangen; the two
    // dragon triplets also independently satisfy yakuhai-haku and yakuhai-hatsu.
    // fu: 20 base + 10 menzen ron + 8 (555z ankou, honor) + 8 (666z ankou, honor) +
    // 2 (77z dragon value pair) + 2 (tanki wait) = 50.
    // han: shousangen 2 + yakuhai-haku 1 + yakuhai-hatsu 1 = 4 (closed).
    // 4han/50fu: raw = 50 x 2^6 = 3200 >= 2000, so mangan on the formula alone.
    // Non-dealer ron mangan = 2000 x 4 = 8000.
    expect: {
      yaku: ['shousangen', 'yakuhai-haku', 'yakuhai-hatsu'], han: 4, fu: 50, handTotal: 8000,
    },
  },
]
