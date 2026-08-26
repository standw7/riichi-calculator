/**
 * Display copy for score() arithmetic steps, keyed by the step's stable `id`
 * (see ScoreStep in src/engine/score.ts). Kept out of the engine so wording can
 * be rewritten or translated without touching scoring logic — see spec §4.
 *
 * This module must not import anything from src/engine/** — content is data the
 * UI joins to engine output by id, never the other way around.
 */
export const SCORE_STEP_LABELS: Record<string, string> = {
  'base-points': 'Base points',
  'discarder-pays': 'Discarder pays',
  'each-player-pays': 'Each player pays',
  'dealer-pays': 'Dealer pays',
  'each-non-dealer-pays': 'Each non-dealer pays',
  honba: 'Honba',
  'riichi-sticks': 'Riichi sticks',
}
