import { describe, it, expect } from 'vitest'
import { YAKU_NAMES } from './yaku'
import { YAKU_RULES } from '../engine/yaku/registry'

describe('YAKU_NAMES', () => {
  it('has a display name for every registered yaku id', () => {
    const missing = YAKU_RULES.map((rule) => rule.id).filter((id) => !(id in YAKU_NAMES))
    expect(missing).toEqual([])
  })

  it('has no entry for an unregistered yaku id', () => {
    const known = new Set(YAKU_RULES.map((rule) => rule.id))
    expect(Object.keys(YAKU_NAMES).filter((id) => !known.has(id))).toEqual([])
  })
})
