import { describe, it, expect } from 'vitest'
import { ENGINE_VERSION } from './index'

describe('engine harness', () => {
  it('exports a version string', () => {
    expect(ENGINE_VERSION).toBe('0.1.0')
  })
})
