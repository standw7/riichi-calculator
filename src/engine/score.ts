import type { RuleSet } from './rulesets/types'

export type LimitClass =
  | 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'kazoe-yakuman' | 'yakuman'

export type Payments =
  | { kind: 'ron'; discarderPays: number }
  | { kind: 'tsumo'; dealerPays: number; nonDealerPays: number }
  | { kind: 'tsumo-all'; eachPays: number }

export interface ScoreStep {
  /** Stable machine key for this step; display copy is looked up by id in src/content. */
  id: string
  expression: string
  value: number
}

export interface ScoreInput {
  han: number
  fu: number
  /** 0 for a normal hand; 1 for one yakuman, 2 for a double yakuman, and so on. */
  yakumanMultiplier: number
  isDealer: boolean
  winSource: 'ron' | 'tsumo'
  honba: number
  riichiSticks: number
}

export interface ScoreResult {
  limitClass: LimitClass | null
  basePoints: number
  payments: Payments
  /** The hand's value, excluding honba and riichi sticks. */
  handTotal: number
  /** What the winner actually receives, including honba and riichi sticks. */
  total: number
  steps: ScoreStep[]
}

const roundUp100 = (points: number): number => Math.ceil(points / 100) * 100
const fmt = (n: number): string => n.toLocaleString('en-US')

interface BaseResult {
  basePoints: number
  limitClass: LimitClass | null
  step: ScoreStep
}

function computeBase(input: ScoreInput, rules: RuleSet): BaseResult {
  const { han, fu, yakumanMultiplier } = input

  if (yakumanMultiplier > 0) {
    return {
      basePoints: 8000 * yakumanMultiplier,
      limitClass: 'yakuman',
      step: {
        id: 'base-points',
        expression: `yakuman × ${yakumanMultiplier} = 8,000 × ${yakumanMultiplier}`,
        value: 8000 * yakumanMultiplier,
      },
    }
  }

  const limited = (limitClass: LimitClass, basePoints: number): BaseResult => ({
    basePoints,
    limitClass,
    step: {
      id: 'base-points',
      expression: `${han} han is a ${limitClass.replace('-', ' ')}`,
      value: basePoints,
    },
  })

  if (han >= 13) {
    return rules.kazoe === 'sanbaiman'
      ? limited('sanbaiman', 6000)
      : limited('kazoe-yakuman', 8000)
  }
  if (han >= 11) return limited('sanbaiman', 6000)
  if (han >= 8) return limited('baiman', 4000)
  if (han >= 6) return limited('haneman', 3000)
  if (han === 5) return limited('mangan', 2000)

  if (rules.kiriageMangan && ((han === 4 && fu === 30) || (han === 3 && fu === 60))) {
    return {
      basePoints: 2000,
      limitClass: 'mangan',
      step: {
        id: 'base-points',
        expression: `${han} han ${fu} fu is rounded up to mangan by this ruleset`,
        value: 2000,
      },
    }
  }

  const raw = fu * 2 ** (2 + han)
  if (raw >= 2000) {
    return {
      basePoints: 2000,
      limitClass: 'mangan',
      step: {
        id: 'base-points',
        expression: `${fu} × 2^(2 + ${han}) = ${fmt(raw)}, capped at mangan`,
        value: 2000,
      },
    }
  }

  return {
    basePoints: raw,
    limitClass: null,
    step: {
      id: 'base-points',
      expression: `${fu} × 2^(2 + ${han})`,
      value: raw,
    },
  }
}

function payStep(id: string, base: number, multiplier: number): ScoreStep {
  const raw = base * multiplier
  const rounded = roundUp100(raw)
  const expression = raw === rounded
    ? `${fmt(base)} × ${multiplier} = ${fmt(raw)}`
    : `${fmt(base)} × ${multiplier} = ${fmt(raw)} → rounded up to ${fmt(rounded)}`
  return { id, expression, value: rounded }
}

export function score(input: ScoreInput, rules: RuleSet): ScoreResult {
  const { isDealer, winSource, honba, riichiSticks } = input
  const { basePoints, limitClass, step: baseStep } = computeBase(input, rules)
  const steps: ScoreStep[] = [baseStep]

  let payments: Payments
  let handTotal: number
  let honbaTotal: number

  if (winSource === 'ron') {
    const step = payStep('discarder-pays', basePoints, isDealer ? 6 : 4)
    steps.push(step)
    handTotal = step.value
    honbaTotal = 300 * honba
    payments = { kind: 'ron', discarderPays: step.value + honbaTotal }
  } else if (isDealer) {
    const step = payStep('each-player-pays', basePoints, 2)
    steps.push(step)
    handTotal = step.value * 3
    honbaTotal = 300 * honba
    payments = { kind: 'tsumo-all', eachPays: step.value + 100 * honba }
  } else {
    const dealerStep = payStep('dealer-pays', basePoints, 2)
    const nonDealerStep = payStep('each-non-dealer-pays', basePoints, 1)
    steps.push(dealerStep, nonDealerStep)
    handTotal = dealerStep.value + nonDealerStep.value * 2
    honbaTotal = 300 * honba
    payments = {
      kind: 'tsumo',
      dealerPays: dealerStep.value + 100 * honba,
      nonDealerPays: nonDealerStep.value + 100 * honba,
    }
  }

  if (honba > 0) {
    steps.push({
      id: 'honba',
      expression: winSource === 'ron'
        ? `${honba} honba × 300 from the discarder`
        : `${honba} honba × 100 from each player`,
      value: honbaTotal,
    })
  }

  if (riichiSticks > 0) {
    steps.push({
      id: 'riichi-sticks',
      expression: `${riichiSticks} × 1,000 collected from the table`,
      value: riichiSticks * 1000,
    })
  }

  return {
    limitClass,
    basePoints,
    payments,
    handTotal,
    total: handTotal + honbaTotal + riichiSticks * 1000,
    steps,
  }
}
