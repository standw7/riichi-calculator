import type { YakuRule } from './types'
import { ONE_HAN_YAKU } from './oneHan'
import { TWO_HAN_YAKU } from './twoHan'
import { THREE_HAN_YAKU } from './threeHan'
import { YAKUMAN_YAKU } from './yakuman'

export const YAKU_RULES: readonly YakuRule[] = [
  ...ONE_HAN_YAKU, ...TWO_HAN_YAKU, ...THREE_HAN_YAKU, ...YAKUMAN_YAKU,
]
