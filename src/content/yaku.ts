/**
 * Display names for yaku, keyed by the yaku's stable `id` (see YakuRule /
 * YakuResult in src/engine/yaku/types.ts). Kept out of the engine so copy can be
 * rewritten or translated without touching scoring logic, and so the engine stays
 * translation-ready — see spec §4.
 *
 * This module must not import anything from src/engine/** — content is data the
 * UI joins to engine output by id, never the other way around.
 *
 * One entry per id in YAKU_RULES (45 as of this task; see the coverage gate in
 * src/engine/yaku/coverage.test.ts for the id list this must stay in sync with).
 */
export const YAKU_NAMES: Record<string, string> = {
  // One-han
  riichi: 'Riichi',
  'double-riichi': 'Double riichi',
  ippatsu: 'Ippatsu',
  'menzen-tsumo': 'Menzen tsumo',
  pinfu: 'Pinfu',
  iipeikou: 'Iipeikou',
  tanyao: 'Tanyao',
  'yakuhai-haku': 'Yakuhai — White dragon',
  'yakuhai-hatsu': 'Yakuhai — Green dragon',
  'yakuhai-chun': 'Yakuhai — Red dragon',
  'yakuhai-seat': 'Yakuhai — Seat wind',
  'yakuhai-round': 'Yakuhai — Round wind',
  haitei: 'Haitei raoyue',
  houtei: 'Houtei raoyui',
  rinshan: 'Rinshan kaihou',
  chankan: 'Chankan',

  // Two-han
  chiitoitsu: 'Chiitoitsu',
  ittsu: 'Ittsu',
  'sanshoku-doujun': 'Sanshoku doujun',
  'sanshoku-doukou': 'Sanshoku doukou',
  toitoi: 'Toitoi',
  sanankou: 'Sanankou',
  sankantsu: 'Sankantsu',
  chanta: 'Chanta',
  honroutou: 'Honroutou',
  shousangen: 'Shousangen',

  // Three-han (and up)
  honitsu: 'Honitsu',
  chinitsu: 'Chinitsu',
  junchan: 'Junchan',
  ryanpeikou: 'Ryanpeikou',

  // Yakuman
  kokushi: 'Kokushi musou',
  'kokushi-13': 'Kokushi musou juusan menmachi',
  suuankou: 'Suuankou',
  'suuankou-tanki': 'Suuankou tanki',
  daisangen: 'Daisangen',
  shousuushii: 'Shousuushii',
  daisuushii: 'Daisuushii',
  tsuuiisou: 'Tsuuiisou',
  chinroutou: 'Chinroutou',
  ryuuiisou: 'Ryuuiisou',
  chuuren: 'Chuuren poutou',
  'chuuren-9': 'Junsei chuuren poutou',
  suukantsu: 'Suukantsu',
  tenhou: 'Tenhou',
  chiihou: 'Chiihou',
}
