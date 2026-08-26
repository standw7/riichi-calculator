import type { WinContext, WinSource } from '../types'

export interface CoverageHand {
  concealed: string
  winningTile: string
  winSource?: WinSource
  melds?: Array<{ kind: 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'; tiles: string }>
  ctx?: Partial<WinContext>
}

export interface CoverageCase {
  /** A hand that MUST produce this yaku. */
  positive: CoverageHand
  /** A near-miss hand that MUST NOT produce it. */
  negative: CoverageHand
}

/**
 * One entry per id in YAKU_RULES (45 as of this task). Every negative case is a near
 * miss — the same hand shape with exactly one condition changed — never an unrelated
 * hand, so the gate actually proves something. See the yaku-by-yaku comment on each
 * entry for what the one changed condition is.
 */
export const YAKU_COVERAGE: Record<string, CoverageCase> = {
  riichi: {
    positive: { concealed: '34m55m567p345s678s', winningTile: '2m', ctx: { riichi: 'riichi' } },
    negative: { concealed: '34m55m567p345s678s', winningTile: '2m' },
  },
  'double-riichi': {
    // Same declaration, but only single riichi rather than riichi on the first discard.
    positive: { concealed: '34m55m567p345s678s', winningTile: '2m', ctx: { riichi: 'double' } },
    negative: { concealed: '34m55m567p345s678s', winningTile: '2m', ctx: { riichi: 'riichi' } },
  },
  ippatsu: {
    // Same riichi declaration; the negative simply doesn't win within the ippatsu window.
    positive: {
      concealed: '34m55m567p345s678s', winningTile: '2m',
      ctx: { riichi: 'riichi', ippatsu: true },
    },
    negative: {
      concealed: '34m55m567p345s678s', winningTile: '2m',
      ctx: { riichi: 'riichi', ippatsu: false },
    },
  },
  'menzen-tsumo': {
    // Same closed hand; ron instead of tsumo removes it.
    positive: { concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo' },
    negative: { concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'ron' },
  },
  pinfu: {
    // Same tile composition and yaku (tanyao), but the negative wins on a tanki wait
    // instead of ryanmen, and the tanki pair is what pinfu forbids as a non-ryanmen wait.
    positive: { concealed: '34m55m567p345s678s', winningTile: '2m' },
    negative: { concealed: '234m5m567p345s678s', winningTile: '5m' },
  },
  iipeikou: {
    // Identical two 234m runs; the negative calls one of them as an open chi, and
    // iipeikou requires a closed hand.
    positive: { concealed: '223344m567p35s88s', winningTile: '4s' },
    negative: {
      concealed: '234m567p45s88s', winningTile: '3s',
      melds: [{ kind: 'chi', tiles: '234m' }],
    },
  },
  tanyao: {
    positive: { concealed: '34m55m567p345s678s', winningTile: '2m' },
    negative: { concealed: '34m55m567p345s789s', winningTile: '2m' },
  },
  'yakuhai-haku': {
    // Same shape as the pon case, but the dragon only ever forms a pair, never a triplet.
    positive: {
      concealed: '234m567p345s5p', winningTile: '5p',
      melds: [{ kind: 'pon', tiles: '555z' }],
    },
    negative: { concealed: '234m567p345s78s55z', winningTile: '9s' },
  },
  'yakuhai-hatsu': {
    positive: {
      concealed: '234m567p345s5p', winningTile: '5p',
      melds: [{ kind: 'pon', tiles: '666z' }],
    },
    negative: { concealed: '234m567p345s78s66z', winningTile: '9s' },
  },
  'yakuhai-chun': {
    positive: {
      concealed: '234m567p345s5p', winningTile: '5p',
      melds: [{ kind: 'pon', tiles: '777z' }],
    },
    negative: { concealed: '234m567p345s78s77z', winningTile: '9s' },
  },
  'yakuhai-seat': {
    // South is the seat wind (seatWind: S); the negative holds it only as a pair.
    positive: {
      concealed: '234m567p345s5p', winningTile: '5p',
      melds: [{ kind: 'pon', tiles: '222z' }],
      ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '234m567p345s78s22z', winningTile: '9s',
      ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  'yakuhai-round': {
    // West is the round wind here (roundWind: W); the negative holds it only as a pair.
    positive: {
      concealed: '234m567p345s5p', winningTile: '5p',
      melds: [{ kind: 'pon', tiles: '333z' }],
      ctx: { seatWind: 'S', roundWind: 'W' },
    },
    negative: {
      concealed: '234m567p345s78s33z', winningTile: '9s',
      ctx: { seatWind: 'S', roundWind: 'W' },
    },
  },
  haitei: {
    // Same tsumo hand; the negative simply isn't flagged as the last tile of the wall.
    positive: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { haitei: true },
    },
    negative: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { haitei: false },
    },
  },
  houtei: {
    positive: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'ron',
      ctx: { houtei: true },
    },
    negative: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'ron',
      ctx: { houtei: false },
    },
  },
  rinshan: {
    positive: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { rinshan: true },
    },
    negative: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { rinshan: false },
    },
  },
  chankan: {
    positive: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'ron',
      ctx: { chankan: true },
    },
    negative: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'ron',
      ctx: { chankan: false },
    },
  },
  chiitoitsu: {
    positive: { concealed: '1122m3344p5566s7z', winningTile: '7z' },
    // One pair duplicated (four 1m) instead of seven distinct pairs — chiitoitsu
    // explicitly forbids a count of 4 for any tile.
    negative: { concealed: '1111m3344p5566s7z', winningTile: '7z' },
  },
  ittsu: {
    // A full 1-4-7 run in one suit; the negative is missing the 7-8-9 leg.
    positive: { concealed: '123456789m55p45s', winningTile: '3s' },
    negative: { concealed: '123456m55p345s67s', winningTile: '8s' },
  },
  'sanshoku-doujun': {
    // 456 in all three suits; the negative shifts the souzu run to 567/789 (via the
    // extra sequence) so no single start is shared by all three suits.
    positive: {
      concealed: '456m456p456s11z78s', winningTile: '9s', ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '456m456p567s11z78s', winningTile: '9s', ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  'sanshoku-doukou': {
    // A 111 triplet in all three suits; the negative changes the souzu triplet to 222.
    positive: {
      concealed: '111m111p111s4z456m', winningTile: '4z', ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '111m111p222s4z456m', winningTile: '4z', ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  toitoi: {
    // All four blocks are triplets; the negative turns one triplet into a sequence.
    positive: {
      concealed: '999p111s222z4z', winningTile: '4z',
      melds: [{ kind: 'pon', tiles: '111m' }],
    },
    negative: {
      concealed: '78p111s222z44z', winningTile: '9p',
      melds: [{ kind: 'pon', tiles: '111m' }],
    },
  },
  sanankou: {
    // Three concealed ankou; the negative turns one of them into a sequence, leaving
    // only two.
    positive: {
      concealed: '111m999p111s456s4z', winningTile: '4z', ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '111m999p123s456s4z', winningTile: '4z', ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  sankantsu: {
    // Three kan melds; the negative swaps the third kan for a plain pon of the same tile.
    positive: {
      concealed: '456s2z', winningTile: '2z',
      melds: [
        { kind: 'ankan', tiles: '1111m' }, { kind: 'ankan', tiles: '9999p' },
        { kind: 'minkan', tiles: '1111s' },
      ],
    },
    negative: {
      concealed: '456s2z', winningTile: '2z',
      melds: [
        { kind: 'ankan', tiles: '1111m' }, { kind: 'ankan', tiles: '9999p' },
        { kind: 'pon', tiles: '111s' },
      ],
    },
  },
  chanta: {
    // Every group holds a terminal or honor; the negative swaps the 789p run for 456p,
    // a group with neither.
    positive: {
      concealed: '123m789p123s444z9s', winningTile: '9s', ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '123m456p123s444z9s', winningTile: '9s', ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  honroutou: {
    // All tiles terminal-or-honor with both kinds present; the negative swaps the honor
    // triplet for a simple-tile triplet, introducing a non-terminal, non-honor tile.
    positive: {
      concealed: '999p111s222z9s', winningTile: '9s',
      melds: [{ kind: 'pon', tiles: '111m' }],
    },
    negative: {
      concealed: '999p111s555p9s', winningTile: '9s',
      melds: [{ kind: 'pon', tiles: '111m' }],
    },
  },
  shousangen: {
    // Two dragon triplets plus the third dragon as the pair. The negative is the near
    // miss at shousangen's lower boundary: only ONE dragon triplet, with a different
    // dragon as the pair. Relaxing the implementation's `dragonSets.length !== 2` guard
    // to `< 2` would let this one-triplet shape through as shousangen; it must not.
    positive: {
      concealed: '555z666z234m567p7z', winningTile: '7z', ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '555z234m567p345s6z', winningTile: '6z', ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  honitsu: {
    // One suit plus honors; the negative introduces a second number suit.
    positive: { concealed: '123m456m789m333z4z', winningTile: '4z' },
    negative: { concealed: '123m456m789p333z4z', winningTile: '4z' },
  },
  chinitsu: {
    // One suit, no honors; the negative swaps the pair for an honor tile, which pushes
    // the hand into honitsu territory instead.
    positive: { concealed: '123456789p22p34p', winningTile: '5p' },
    negative: { concealed: '123456789p22z34p', winningTile: '5p' },
  },
  junchan: {
    // Every group holds a terminal and no honors are present; the negative swaps the
    // terminal pair (11s) for a simple pair (22s), so no honor is present but the pair
    // no longer holds a terminal either.
    positive: {
      concealed: '123m789m123p11s78s', winningTile: '9s', ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '123m789m123p22s78s', winningTile: '9s', ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  ryanpeikou: {
    // Two pairs of identical sequences; the negative shifts one 567p run to 456p so only
    // one duplicated pair (234m) remains.
    positive: { concealed: '223344m55667p99s', winningTile: '7p' },
    negative: { concealed: '223344m45566p99s', winningTile: '7p' },
  },
  kokushi: {
    // All 13 orphans with the pair (1m1m) already formed before the win; the negative
    // instead never completes the 13th type (7z), tripling 1m instead.
    positive: { concealed: '119m19p19s123456z', winningTile: '7z' },
    negative: { concealed: '119m19p19s123456z', winningTile: '1m' },
  },
  'kokushi-13': {
    // All 13 orphans held as singles, so the winning tile itself forms the pair (the
    // 13-sided wait); the negative already holds the pair before winning on the 13th
    // missing type, which is plain kokushi, not the 13-wait.
    positive: { concealed: '19m19p19s1234567z', winningTile: '1m' },
    negative: { concealed: '119m19p19s123456z', winningTile: '7z' },
  },
  suuankou: {
    // Four concealed ankou completed by tsumo on a shanpon wait (tsumo never turns a
    // triplet "effectively open", so all four stay concealed); the negative is the same
    // shanpon shape but completed by RON, which turns the won triplet into an
    // effectively-open one, leaving only three concealed.
    positive: {
      concealed: '111m999p111s33z44z', winningTile: '4z', winSource: 'tsumo',
    },
    negative: {
      concealed: '111m999p111s44p88s', winningTile: '4p', winSource: 'ron',
    },
  },
  'suuankou-tanki': {
    // Four concealed ankou with the wait on the pair (tanki); the negative has the same
    // four concealed ankou but the wait is shanpon instead of tanki.
    positive: { concealed: '111m999p111s555z6z', winningTile: '6z', winSource: 'ron' },
    negative: { concealed: '111m999p111s33z44z', winningTile: '4z', winSource: 'tsumo' },
  },
  daisangen: {
    // Three dragon triplets; the negative keeps only two and uses the third dragon as
    // the pair instead (shousangen's shape, not daisangen's).
    positive: {
      concealed: '555z666z777z234m5m', winningTile: '5m', ctx: { seatWind: 'S', roundWind: 'E' },
    },
    negative: {
      concealed: '555z666z234m567p7z', winningTile: '7z', ctx: { seatWind: 'S', roundWind: 'E' },
    },
  },
  shousuushii: {
    // Three wind triplets plus the fourth wind as the pair; the negative keeps only two
    // wind triplets, replacing the third with a plain sequence.
    positive: { concealed: '111z222z333z4z456p', winningTile: '4z' },
    negative: { concealed: '111z222z4z456p345p', winningTile: '4z' },
  },
  daisuushii: {
    // All four wind triplets; the negative keeps only three winds as triplets, with the
    // fourth wind as the pair instead (shousuushii's shape).
    positive: { concealed: '111z222z333z444z8s', winningTile: '8s' },
    negative: { concealed: '111z222z333z4z456p', winningTile: '4z' },
  },
  tsuuiisou: {
    // Every tile is an honor; the negative swaps the dragon pair for a simple-tile pair.
    positive: { concealed: '111z222z333z555z6z', winningTile: '6z' },
    negative: { concealed: '111z222z333z555z8s', winningTile: '8s' },
  },
  chinroutou: {
    // Every tile is a terminal (1 or 9), no honors and no simples; the negative swaps
    // one terminal triplet for a simple-tile triplet.
    positive: {
      concealed: '999m999p111s9s', winningTile: '9s',
      melds: [{ kind: 'pon', tiles: '111m' }],
    },
    negative: {
      concealed: '999m999p555s9s', winningTile: '9s',
      melds: [{ kind: 'pon', tiles: '111m' }],
    },
  },
  ryuuiisou: {
    // Every tile is one of the green tiles (2/3/4/6/8 sou, or the green dragon); the
    // negative swaps the green-dragon pair for a white-dragon pair.
    positive: { concealed: '222s666s888s234s6z', winningTile: '6z' },
    negative: { concealed: '222s666s888s234s5z', winningTile: '5z' },
  },
  chuuren: {
    // Concealed holds four 1p and only two 9p (not the pure 3/1x7/3 pattern), so the
    // hand is tenpai on 9p alone. The negative instead holds the exact pure pattern,
    // which is tenpai on all nine tiles and is scored as chuuren-9 (which supersedes and
    // removes plain 'chuuren' from the result).
    positive: { concealed: '1111234567899p', winningTile: '9p' },
    negative: { concealed: '1112345678999p', winningTile: '5p' },
  },
  'chuuren-9': {
    // The exact pure 1112345678999 pattern (tenpai on all nine tiles); the negative is
    // the impure four-1p/two-9p shape above, tenpai on 9p alone, which is plain chuuren.
    positive: { concealed: '1112345678999p', winningTile: '5p' },
    negative: { concealed: '1111234567899p', winningTile: '9p' },
  },
  suukantsu: {
    // Four kan melds; the negative swaps the fourth kan for a plain pon of the same tile.
    positive: {
      concealed: '8s', winningTile: '8s',
      melds: [
        { kind: 'ankan', tiles: '1111m' }, { kind: 'ankan', tiles: '9999p' },
        { kind: 'ankan', tiles: '1111s' }, { kind: 'minkan', tiles: '9999s' },
      ],
    },
    negative: {
      concealed: '8s', winningTile: '8s',
      melds: [
        { kind: 'ankan', tiles: '1111m' }, { kind: 'ankan', tiles: '9999p' },
        { kind: 'ankan', tiles: '1111s' }, { kind: 'pon', tiles: '999s' },
      ],
    },
  },
  tenhou: {
    // Dealer's first tsumo; the negative is the identical dealer tsumo without the flag.
    positive: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { seatWind: 'E', roundWind: 'E', tenhou: true },
    },
    negative: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { seatWind: 'E', roundWind: 'E', tenhou: false },
    },
  },
  chiihou: {
    // Non-dealer's first-go-around tsumo; the negative is the identical tsumo without
    // the flag.
    positive: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { seatWind: 'S', roundWind: 'E', chiihou: true },
    },
    negative: {
      concealed: '34m55m567p345s678s', winningTile: '2m', winSource: 'tsumo',
      ctx: { seatWind: 'S', roundWind: 'E', chiihou: false },
    },
  },
}
