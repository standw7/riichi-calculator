import type { Group, Interpretation } from '../decompose'
import type { Hand, Tile, WinContext } from '../types'
import type { RuleSet } from '../rulesets/types'

export interface Evidence {
  tiles?: Tile[]
  groups?: Group[]
  params?: Record<string, string | number>
}

export interface YakuContext {
  interp: Interpretation
  hand: Hand
  ctx: WinContext
  rules: RuleSet
  closed: boolean
}

export interface YakuRule {
  id: string
  name: string
  /** Han when the hand is closed. */
  closedHan: number
  /** Han when the hand is open. 0 means the yaku cannot be scored open. */
  openHan: number
  /** Yakuman multiplier. Absent for ordinary yaku. */
  yakuman?: number
  /** Ids of lower yaku this one absorbs. */
  supersedes?: string[]
  match(c: YakuContext): Evidence | null
}

export interface YakuResult {
  id: string
  name: string
  han: number
  yakuman: number
  evidence: Evidence
}
