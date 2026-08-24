import type { RuleSet } from './types'

// Verified against the official WRC Rules 2025 rulebook (v20250526, 25 May 2025),
// published at https://www.worldriichi.org/wrc-rules and hosted at
// https://static1.squarespace.com/static/634a7884c297a25f06589b79/t/6834d67360e19c1da6c0d12c/1748293243651/WRC+Rules+2025.pdf
export const WRC_2025: RuleSet = Object.freeze({
  id: 'wrc2025',
  name: 'WRC 2025',

  akaDoraCount: 0, // "No red fives." (Abstract, "Core rules")
  kuitan: true, // "Open Tan'yao and after-attaching (ato-zuke) are allowed." (Abstract, "Core rules")
  atozuke: true, // "Open Tan'yao and after-attaching (ato-zuke) are allowed." (Abstract, "Core rules")
  // "Mangan rounding up (kiriage mangan): 4 han 30 fu, 3 han 60 fu and more are scored
  // mangan." (Abstract, "Scoring"; repeated at §13.4 Scoring table). The plan defaulted this
  // to false with no VERIFY marker, but the rulebook confirms kiriage mangan is used.
  kiriageMangan: true,
  kazoe: 'yakuman', // "Counted yakuman: 13 han and greater scores yonbaiman" — §11.2, base value 8,000, equal to a single yakuman (§11.2 base value table)
  multipleYakuman: true, // "Multiple yakuman are scored for hands having several yakuman yaku." (Abstract, "Scoring"; §9.1)
  doubleYakuman: false, // "No double yakuman for winning on a specific wait." (Abstract, "Scoring")
  // "A double wind pair is worth 2 fu." (Abstract, "Yaku and minipoints"; confirmed by the
  // §11.3 fu table, where the pair row scores 2 fu for both "Value honours" and "Double wind".)
  doubleWindPairFu: 2,
  openPinfuFu: 30, // §11.3 fu table: base "Winning" is 20 fu, plus 10 fu "Open pinfu" bonus when an open hand would otherwise score no minipoints, totaling 30.
  pao: true, // "Liability payment applies for Big Dragons, Big Winds and Four Quads." (Abstract, "Liability payment and abortive draws"; §9.1.1)
  // "Blessing of Man is worth mangan, not cumulative with other yaku and dora." (Abstract,
  // "Yaku and minipoints"; §11.5.4: Renhou is a flat five-han yaku that doesn't combine with
  // dora, which is mangan value regardless of fu).
  renhou: 'mangan',
  nagashiMangan: false, // "No Nagashi Mangan." (Abstract, "Yaku and minipoints")
})
