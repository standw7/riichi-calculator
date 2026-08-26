/**
 * Non-dealer / dealer ron totals from the published riichi score table.
 * Transcribed by hand from a printed source — never generate this from score().
 * This is the *base* table, i.e. scoring without kiriage mangan rounding: the '4-30' and
 * '3-60' cells (7700/11600) are the un-rounded values, not the kiriage-rounded 8000/12000.
 * Key: `${han}-${fu}` → { nonDealerRon, dealerRon }
 */
export const RON_TABLE: Record<string, { nonDealerRon: number; dealerRon: number }> = {
  '1-30': { nonDealerRon: 1000, dealerRon: 1500 },
  '1-40': { nonDealerRon: 1300, dealerRon: 2000 },
  '1-50': { nonDealerRon: 1600, dealerRon: 2400 },
  '1-60': { nonDealerRon: 2000, dealerRon: 2900 },
  '1-70': { nonDealerRon: 2300, dealerRon: 3400 },
  '2-25': { nonDealerRon: 1600, dealerRon: 2400 },
  '2-30': { nonDealerRon: 2000, dealerRon: 2900 },
  '2-40': { nonDealerRon: 2600, dealerRon: 3900 },
  '2-50': { nonDealerRon: 3200, dealerRon: 4800 },
  '2-60': { nonDealerRon: 3900, dealerRon: 5800 },
  '2-70': { nonDealerRon: 4500, dealerRon: 6800 },
  '3-25': { nonDealerRon: 3200, dealerRon: 4800 },
  '3-30': { nonDealerRon: 3900, dealerRon: 5800 },
  '3-40': { nonDealerRon: 5200, dealerRon: 7700 },
  '3-50': { nonDealerRon: 6400, dealerRon: 9600 },
  '3-60': { nonDealerRon: 7700, dealerRon: 11600 },
  '4-25': { nonDealerRon: 6400, dealerRon: 9600 },
  '4-30': { nonDealerRon: 7700, dealerRon: 11600 },
  '4-40': { nonDealerRon: 8000, dealerRon: 12000 },
  '5-30': { nonDealerRon: 8000, dealerRon: 12000 },
  '6-30': { nonDealerRon: 12000, dealerRon: 18000 },
  '7-30': { nonDealerRon: 12000, dealerRon: 18000 },
  '8-30': { nonDealerRon: 16000, dealerRon: 24000 },
  '10-30': { nonDealerRon: 16000, dealerRon: 24000 },
  '11-30': { nonDealerRon: 24000, dealerRon: 36000 },
  '12-30': { nonDealerRon: 24000, dealerRon: 36000 },
  '13-30': { nonDealerRon: 32000, dealerRon: 48000 },
}
