export type KazoeTreatment = 'yakuman' | 'sanbaiman'
export type RenhouTreatment = 'none' | 'mangan' | 'yakuman'

export interface RuleSet {
  readonly id: string
  readonly name: string

  /** Number of red fives in the wall. 0 disables aka dora entirely. */
  readonly akaDoraCount: number
  /** Whether tanyao may be scored with an open hand. */
  readonly kuitan: boolean
  /**
   * Whether a yaku may be established only by the winning tile.
   * Not yet consumed by the engine — represented per PLD §6.3 / spec §5 ahead of use.
   */
  readonly atozuke: boolean
  /** Round 4 han 30 fu and 3 han 60 fu up to mangan. */
  readonly kiriageMangan: boolean
  /** How a hand reaching 13+ counted han is scored. */
  readonly kazoe: KazoeTreatment
  /** Whether several yakuman in one hand stack, or the hand scores a single yakuman. */
  readonly multipleYakuman: boolean
  /** Whether qualifying hands (suuankou tanki, kokushi 13-wait, chuuren 9-wait) score double. */
  readonly doubleYakuman: boolean
  /** Fu for a pair that is both seat wind and round wind. */
  readonly doubleWindPairFu: 2 | 4
  /** Fu awarded to an open hand whose shape would otherwise total 20. */
  readonly openPinfuFu: 20 | 30
  /**
   * Whether pao / sekinin barai liability applies.
   * Not yet consumed by the engine — represented per PLD §6.3 / spec §5 ahead of use.
   */
  readonly pao: boolean
  /**
   * How renhou is scored.
   * Not yet consumed by the engine — represented per PLD §6.3 / spec §5 ahead of use.
   */
  readonly renhou: RenhouTreatment
  /**
   * Whether nagashi mangan is awarded.
   * Not yet consumed by the engine — represented per PLD §6.3 / spec §5 ahead of use.
   */
  readonly nagashiMangan: boolean
}
