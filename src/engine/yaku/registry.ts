import type { YakuRule } from './types'
import { ONE_HAN_YAKU } from './oneHan'
import { TWO_HAN_YAKU } from './twoHan'

export const YAKU_RULES: readonly YakuRule[] = [...ONE_HAN_YAKU, ...TWO_HAN_YAKU]
