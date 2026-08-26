import { describe, it, expect } from 'vitest'
import { SCORE_STEP_LABELS } from './score'

describe('SCORE_STEP_LABELS', () => {
  it('has a label for every step id score() can emit', () => {
    const ids = [
      'base-points', 'discarder-pays', 'each-player-pays',
      'dealer-pays', 'each-non-dealer-pays', 'honba', 'riichi-sticks',
    ]
    for (const id of ids) {
      expect(SCORE_STEP_LABELS[id], `missing label for step id "${id}"`).toBeDefined()
    }
  })
})
