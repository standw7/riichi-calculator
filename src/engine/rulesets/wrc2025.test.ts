import { describe, it, expect } from 'vitest'
import { WRC_2025 } from './wrc2025'

describe('WRC_2025 preset', () => {
  it('identifies itself for the UI header', () => {
    expect(WRC_2025.id).toBe('wrc2025')
    expect(WRC_2025.name).toBe('WRC 2025')
  })

  it('is frozen so callers cannot mutate the shared preset', () => {
    expect(Object.isFrozen(WRC_2025)).toBe(true)
    expect(() => {
      // @ts-expect-error deliberately violating readonly to prove the freeze
      WRC_2025.kuitan = false
    }).toThrow()
  })

  it('defines every flag the spec requires', () => {
    const required = [
      'akaDoraCount', 'kuitan', 'atozuke', 'kiriageMangan', 'kazoe',
      'multipleYakuman', 'doubleYakuman', 'doubleWindPairFu', 'openPinfuFu',
      'pao', 'renhou', 'nagashiMangan',
    ] as const
    for (const flag of required) {
      expect(WRC_2025[flag]).toBeDefined()
    }
  })
})
