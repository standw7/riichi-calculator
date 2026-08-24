# Riichi Scoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully tested, framework-free TypeScript riichi mahjong scoring engine that takes a hand plus win context plus a ruleset and returns the score decomposed into yaku, fu, dora, and payment arithmetic, each carrying the evidence needed to explain it.

**Architecture:** Seven pure pipeline functions (`validate` → `decompose` → `detectYaku` / `computeFu` / `countDora` → `score` → `selectBest`), orchestrated by a single `calculate()` entry point. Nothing returns a bare number: every stage returns structured data describing what it decided and why. Rulesets are frozen config objects passed as parameters, never module globals.

**Tech Stack:** TypeScript 5, Vite 6, Vitest 3, ESLint 9 (flat config). No runtime dependencies in the engine.

**Spec:** `docs/superpowers/specs/2026-08-24-riichi-calculator-design.md`

## Global Constraints

- Node 24+, npm 11+ (developer machine already has both).
- **`src/engine/**` must never import from `src/ui/**` or from `react`.** Enforced by ESLint `no-restricted-imports`; a violation must fail `npm run lint`.
- The engine has **zero runtime dependencies**. Dev dependencies are fine.
- A **red five is a flag on an ordinary five** (`red: true`), never a 35th tile type.
- All tile arithmetic goes through a **34-slot count array**; index order is manzu 0–8, pinzu 9–17, souzu 18–26, winds 27–30 (E,S,W,N), dragons 31–33 (White, Green, Red).
- Every exported function is **pure**: no mutation of inputs, no module-level mutable state, no `Date`/`Math.random`.
- TypeScript `strict: true`. No `any` in engine code.
- Commit after every task. Commit messages use Conventional Commits (`feat:`, `test:`, `chore:`).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/types.ts` | All shared interfaces and type aliases. No logic. |
| `src/engine/tiles.ts` | Tile model, id↔tile conversion, count arrays, notation parse/serialize. |
| `src/engine/rulesets/types.ts` | `RuleSet` interface. |
| `src/engine/rulesets/wrc2025.ts` | The `WRC_2025` frozen preset. |
| `src/engine/hand.ts` | Hand-level helpers: closed/open test, tile enumeration, meld slot arithmetic. |
| `src/engine/validate.ts` | Hand and context validation, returning structured states. |
| `src/engine/decompose.ts` | Enumerates every legal interpretation, including winning-tile assignment. |
| `src/engine/score.ts` | han+fu → limit class, base points, payments, arithmetic steps. |
| `src/engine/fu.ts` | Itemized fu lines and wait classification. |
| `src/engine/yaku/types.ts` | `YakuRule`, `YakuContext`, `Evidence`, `YakuResult`. No logic. |
| `src/engine/yaku/helpers.ts` | Shared predicates used by many rules (suit analysis, triplet counting). |
| `src/engine/yaku/oneHan.ts` | Situational and one-han yaku, including generated yakuhai rules. |
| `src/engine/yaku/twoHan.ts` | Two-han yaku. |
| `src/engine/yaku/threeHan.ts` | Honitsu, junchan, ryanpeikou, chinitsu. |
| `src/engine/yaku/yakuman.ts` | The yakuman set. |
| `src/engine/yaku/registry.ts` | The assembled `YAKU_RULES` array. |
| `src/engine/yaku/detect.ts` | `detectYaku` — matching, supersession, yakuman precedence. |
| `src/engine/dora.ts` | Dora / aka / ura counting from indicators. |
| `src/engine/select.ts` | Best-interpretation selection. |
| `src/engine/calculate.ts` | Top-level orchestration. |
| `src/engine/index.ts` | Public barrel export. |

Tests mirror the source tree under `src/engine/**/*.test.ts`, colocated so a file and its tests move together.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`
- Create: `src/engine/index.ts`, `src/engine/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test`, `npm run lint`, `npm run build`.

- [ ] **Step 1: Scaffold the Vite app**

```bash
cd ~/Downloads/Projects/Riichi
npm create vite@latest . -- --template react-ts
npm install
npm install -D vitest @vitest/coverage-v8
```

Answer "Ignore files and continue" if prompted about the existing directory — `PLD.md`, `docs/`, and `.gitignore` must survive.

- [ ] **Step 2: Move the generated App into `src/ui/`**

```bash
mkdir -p src/ui src/engine
git mv src/App.tsx src/ui/App.tsx 2>/dev/null || mv src/App.tsx src/ui/App.tsx
mv src/App.css src/ui/App.css
```

Then fix the import in `src/main.tsx`:

```tsx
import App from './ui/App.tsx'
```

And in `src/ui/App.tsx`, fix the CSS and asset imports:

```tsx
import './App.css'
```

Delete the `reactLogo`/`viteLogo` imports and their JSX if the template included them, leaving a minimal component:

```tsx
export default function App() {
  return <h1>Riichi Calculator</h1>
}
```

- [ ] **Step 3: Add the test script and Vitest config**

Add to `package.json` `"scripts"`:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "lint": "eslint .",
  "build": "tsc -b && vite build"
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
```

- [ ] **Step 4: Add the engine boundary lint rule**

In `eslint.config.js`, append this config object to the exported array:

```js
{
  files: ['src/engine/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['react', 'react-dom', 'react/*'], message: 'The engine must not depend on React.' },
        { group: ['**/ui/**', '../ui/*', './ui/*'], message: 'The engine must not import from the UI layer.' },
      ],
    }],
  },
}
```

- [ ] **Step 5: Write a smoke test proving the harness works**

Create `src/engine/index.ts`:

```ts
export const ENGINE_VERSION = '0.1.0'
```

Create `src/engine/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ENGINE_VERSION } from './index'

describe('engine harness', () => {
  it('exports a version string', () => {
    expect(ENGINE_VERSION).toBe('0.1.0')
  })
})
```

- [ ] **Step 6: Verify the whole toolchain**

Run each and confirm:

```bash
npm test          # Expected: 1 passed
npm run lint      # Expected: no errors
npm run build     # Expected: builds to dist/ with no type errors
```

- [ ] **Step 7: Verify the boundary rule actually fires**

Temporarily add `import 'react'` as the first line of `src/engine/index.ts`, then:

```bash
npm run lint
```

Expected: FAIL with "The engine must not depend on React." Remove the import and confirm `npm run lint` passes again. This step exists because a lint rule that was never observed failing is not known to work.

- [ ] **Step 8: Create the GitHub repo and push**

```bash
gh repo create standw7/riichi-calculator --public --source=. --remote=origin --description "Riichi mahjong scoring calculator that explains where every point came from"
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project with engine boundary lint rule"
git push -u origin main
```

---

## Task 2: Tile model and notation

**Files:**
- Create: `src/engine/types.ts`, `src/engine/tiles.ts`, `src/engine/tiles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Suit = 'm' | 'p' | 's' | 'z'`
  - `type Wind = 'E' | 'S' | 'W' | 'N'`
  - `interface Tile { suit: Suit; rank: number; red: boolean }`
  - `tileId(tile: Tile): number` — 0–33
  - `tileFromId(id: number): Tile` — always `red: false`
  - `toCounts(tiles: Tile[]): number[]` — length 34
  - `parseTiles(notation: string): Tile[]`
  - `tilesToNotation(tiles: Tile[]): string`
  - `sortTiles(tiles: Tile[]): Tile[]`
  - `isHonor(tile: Tile): boolean`
  - `isTerminal(tile: Tile): boolean` — rank 1 or 9 in a numbered suit
  - `isTerminalOrHonor(tile: Tile): boolean`
  - `WIND_ORDER: readonly Wind[]` — `['E','S','W','N']`

- [ ] **Step 1: Write the failing tests**

Create `src/engine/tiles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  tileId, tileFromId, toCounts, parseTiles, tilesToNotation,
  sortTiles, isHonor, isTerminal, isTerminalOrHonor,
} from './tiles'

describe('tileId', () => {
  it('maps manzu to 0-8', () => {
    expect(tileId({ suit: 'm', rank: 1, red: false })).toBe(0)
    expect(tileId({ suit: 'm', rank: 9, red: false })).toBe(8)
  })

  it('maps pinzu to 9-17 and souzu to 18-26', () => {
    expect(tileId({ suit: 'p', rank: 1, red: false })).toBe(9)
    expect(tileId({ suit: 's', rank: 1, red: false })).toBe(18)
  })

  it('maps winds to 27-30 and dragons to 31-33', () => {
    expect(tileId({ suit: 'z', rank: 1, red: false })).toBe(27)  // East
    expect(tileId({ suit: 'z', rank: 4, red: false })).toBe(30)  // North
    expect(tileId({ suit: 'z', rank: 7, red: false })).toBe(33)  // Red dragon
  })

  it('ignores the red flag, so a red five shares its id with a normal five', () => {
    expect(tileId({ suit: 'p', rank: 5, red: true }))
      .toBe(tileId({ suit: 'p', rank: 5, red: false }))
  })
})

describe('tileFromId', () => {
  it('round-trips every id', () => {
    for (let id = 0; id < 34; id++) {
      expect(tileId(tileFromId(id))).toBe(id)
    }
  })
})

describe('toCounts', () => {
  it('counts red fives against the ordinary five slot', () => {
    const counts = toCounts([
      { suit: 'p', rank: 5, red: true },
      { suit: 'p', rank: 5, red: false },
    ])
    expect(counts[tileId({ suit: 'p', rank: 5, red: false })]).toBe(2)
    expect(counts).toHaveLength(34)
  })
})

describe('parseTiles', () => {
  it('parses a multi-suit hand', () => {
    expect(parseTiles('123m')).toEqual([
      { suit: 'm', rank: 1, red: false },
      { suit: 'm', rank: 2, red: false },
      { suit: 'm', rank: 3, red: false },
    ])
  })

  it('parses rank 0 as a red five', () => {
    expect(parseTiles('0p')).toEqual([{ suit: 'p', rank: 5, red: true }])
  })

  it('parses honors', () => {
    expect(parseTiles('17z')).toEqual([
      { suit: 'z', rank: 1, red: false },
      { suit: 'z', rank: 7, red: false },
    ])
  })

  it('rejects an honor rank above 7', () => {
    expect(() => parseTiles('8z')).toThrow('Invalid honor rank: 8')
  })

  it('rejects digits with no suit letter', () => {
    expect(() => parseTiles('123')).toThrow('Trailing digits without a suit')
  })

  it('rejects an unknown suit letter', () => {
    expect(() => parseTiles('1x')).toThrow('Unknown suit: x')
  })

  it('returns an empty array for an empty string', () => {
    expect(parseTiles('')).toEqual([])
  })
})

describe('tilesToNotation', () => {
  it('round-trips a mixed hand', () => {
    const notation = '1230m0p77z'
    expect(tilesToNotation(parseTiles(notation))).toBe(notation)
  })

  it('groups tiles by suit in m,p,s,z order', () => {
    expect(tilesToNotation(parseTiles('1z1s1p1m'))).toBe('1m1p1s1z')
  })
})

describe('sortTiles', () => {
  it('sorts manzu, pinzu, souzu, then honors', () => {
    expect(tilesToNotation(sortTiles(parseTiles('1z5s3p9m')))).toBe('9m3p5s1z')
  })

  it('places a red five alongside ordinary fives', () => {
    expect(tilesToNotation(sortTiles(parseTiles('6p0p4p')))).toBe('40p6p')
  })
})

describe('tile predicates', () => {
  it('identifies honors', () => {
    expect(isHonor({ suit: 'z', rank: 1, red: false })).toBe(true)
    expect(isHonor({ suit: 'm', rank: 1, red: false })).toBe(false)
  })

  it('identifies terminals as 1 and 9 of numbered suits only', () => {
    expect(isTerminal({ suit: 'm', rank: 1, red: false })).toBe(true)
    expect(isTerminal({ suit: 'm', rank: 5, red: false })).toBe(false)
    expect(isTerminal({ suit: 'z', rank: 1, red: false })).toBe(false)
  })

  it('identifies terminals and honors together', () => {
    expect(isTerminalOrHonor({ suit: 'z', rank: 5, red: false })).toBe(true)
    expect(isTerminalOrHonor({ suit: 's', rank: 9, red: false })).toBe(true)
    expect(isTerminalOrHonor({ suit: 's', rank: 8, red: false })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/tiles.test.ts
```

Expected: FAIL — `Failed to resolve import "./tiles"`.

- [ ] **Step 3: Create the shared types**

Create `src/engine/types.ts`:

```ts
export type Suit = 'm' | 'p' | 's' | 'z'

export type Wind = 'E' | 'S' | 'W' | 'N'

export interface Tile {
  suit: Suit
  /** 1-9 for numbered suits; 1-4 winds (E,S,W,N), 5-7 dragons (White,Green,Red) for 'z'. */
  rank: number
  red: boolean
}
```

- [ ] **Step 4: Implement the tile module**

Create `src/engine/tiles.ts`:

```ts
import type { Suit, Tile, Wind } from './types'

const SUIT_ORDER: readonly Suit[] = ['m', 'p', 's', 'z']
const SUIT_BASE: Record<Suit, number> = { m: 0, p: 9, s: 18, z: 27 }

export const WIND_ORDER: readonly Wind[] = ['E', 'S', 'W', 'N']

export function tileId(tile: Tile): number {
  return SUIT_BASE[tile.suit] + tile.rank - 1
}

export function tileFromId(id: number): Tile {
  if (id < 0 || id > 33) throw new Error(`Tile id out of range: ${id}`)
  if (id >= 27) return { suit: 'z', rank: id - 26, red: false }
  if (id >= 18) return { suit: 's', rank: id - 17, red: false }
  if (id >= 9) return { suit: 'p', rank: id - 8, red: false }
  return { suit: 'm', rank: id + 1, red: false }
}

export function toCounts(tiles: Tile[]): number[] {
  const counts = new Array<number>(34).fill(0)
  for (const tile of tiles) counts[tileId(tile)] += 1
  return counts
}

export function isHonor(tile: Tile): boolean {
  return tile.suit === 'z'
}

export function isTerminal(tile: Tile): boolean {
  return tile.suit !== 'z' && (tile.rank === 1 || tile.rank === 9)
}

export function isTerminalOrHonor(tile: Tile): boolean {
  return isHonor(tile) || isTerminal(tile)
}

export function parseTiles(notation: string): Tile[] {
  const tiles: Tile[] = []
  let pending: number[] = []

  for (const char of notation) {
    if (char >= '0' && char <= '9') {
      pending.push(Number(char))
      continue
    }
    if (!SUIT_ORDER.includes(char as Suit)) {
      throw new Error(`Unknown suit: ${char}`)
    }
    const suit = char as Suit
    for (const digit of pending) {
      if (digit === 0) {
        if (suit === 'z') throw new Error('Honors have no red five')
        tiles.push({ suit, rank: 5, red: true })
      } else if (suit === 'z' && digit > 7) {
        throw new Error(`Invalid honor rank: ${digit}`)
      } else {
        tiles.push({ suit, rank: digit, red: false })
      }
    }
    pending = []
  }

  if (pending.length > 0) throw new Error('Trailing digits without a suit')
  return tiles
}

export function tilesToNotation(tiles: Tile[]): string {
  let out = ''
  for (const suit of SUIT_ORDER) {
    const inSuit = tiles.filter((t) => t.suit === suit)
    if (inSuit.length === 0) continue
    out += inSuit.map((t) => (t.red ? '0' : String(t.rank))).join('') + suit
  }
  return out
}

export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const byId = tileId(a) - tileId(b)
    if (byId !== 0) return byId
    // Red fives sort before ordinary fives so notation renders '40p6p'.
    return Number(b.red) - Number(a.red)
  })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/engine/tiles.test.ts
```

Expected: PASS, all cases green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/tiles.ts src/engine/tiles.test.ts
git commit -m "feat: add tile model, count arrays, and mahjong notation parsing"
```

---

## Task 3: Ruleset configuration

**Files:**
- Create: `src/engine/rulesets/types.ts`, `src/engine/rulesets/wrc2025.ts`, `src/engine/rulesets/wrc2025.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface RuleSet` — the full flag set from spec §5
  - `const WRC_2025: RuleSet` — frozen
  - `type KazoeTreatment = 'yakuman' | 'sanbaiman'`
  - `type RenhouTreatment = 'none' | 'mangan' | 'yakuman'`

- [ ] **Step 1: Confirm the WRC 2025 flag values before coding**

The values below are this plan's best-effort defaults. Before implementing, check each
against the published WRC 2025 rulebook. Where the rulebook confirms a value, delete the
`VERIFY` comment. Where it contradicts, change the value and note the source. Where you
cannot find a ruling, leave the `VERIFY` comment in place so it surfaces in review rather
than silently becoming folklore.

The flags most likely to differ from a Tenhou/Mahjong-Soul intuition are `akaDoraCount`
(WRC has historically used **no** red fives), `doubleYakuman` (historically **not** granted),
and `doubleWindPairFu`.

- [ ] **Step 2: Write the failing test**

Create `src/engine/rulesets/wrc2025.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/engine/rulesets/wrc2025.test.ts
```

Expected: FAIL — `Failed to resolve import "./wrc2025"`.

- [ ] **Step 4: Define the RuleSet interface**

Create `src/engine/rulesets/types.ts`:

```ts
export type KazoeTreatment = 'yakuman' | 'sanbaiman'
export type RenhouTreatment = 'none' | 'mangan' | 'yakuman'

export interface RuleSet {
  readonly id: string
  readonly name: string

  /** Number of red fives in the wall. 0 disables aka dora entirely. */
  readonly akaDoraCount: number
  /** Whether tanyao may be scored with an open hand. */
  readonly kuitan: boolean
  /** Whether a yaku may be established only by the winning tile. */
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
  /** Whether pao / sekinin barai liability applies. */
  readonly pao: boolean
  readonly renhou: RenhouTreatment
  readonly nagashiMangan: boolean
}
```

- [ ] **Step 5: Implement the preset**

Create `src/engine/rulesets/wrc2025.ts`:

```ts
import type { RuleSet } from './types'

export const WRC_2025: RuleSet = Object.freeze({
  id: 'wrc2025',
  name: 'WRC 2025',

  akaDoraCount: 0,        // VERIFY: WRC has historically played without red fives.
  kuitan: true,
  atozuke: true,          // VERIFY
  kiriageMangan: false,
  kazoe: 'yakuman',       // VERIFY
  multipleYakuman: true,  // VERIFY
  doubleYakuman: false,   // VERIFY: WRC has historically capped at a single yakuman.
  doubleWindPairFu: 4,    // VERIFY
  openPinfuFu: 30,
  pao: true,              // VERIFY
  renhou: 'none',         // VERIFY
  nagashiMangan: true,    // VERIFY
})
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx vitest run src/engine/rulesets/wrc2025.test.ts
```

Expected: PASS.

Note: `Object.freeze` only throws on assignment in strict mode. ES modules are always strict,
so the freeze test passes as written.

- [ ] **Step 7: Commit**

```bash
git add src/engine/rulesets
git commit -m "feat: add RuleSet interface and frozen WRC 2025 preset"
```

---

## Task 4: Score calculation and the payments table

This task is deliberately early: it is entirely self-contained, it is the stage most amenable
to verification against published tables, and having it working makes every later task's
output checkable end-to-end.

**Files:**
- Create: `src/engine/score.ts`, `src/engine/score.test.ts`, `src/engine/scoreTable.fixture.ts`

**Interfaces:**
- Consumes: `RuleSet` from `./rulesets/types`.
- Produces:
  - `type LimitClass = 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'kazoe-yakuman' | 'yakuman'`
  - `type Payments = { kind: 'ron'; discarderPays: number } | { kind: 'tsumo'; dealerPays: number; nonDealerPays: number } | { kind: 'tsumo-all'; eachPays: number }`
  - `interface ScoreStep { label: string; expression: string; value: number }`
  - `interface ScoreInput { han: number; fu: number; yakumanMultiplier: number; isDealer: boolean; winSource: 'ron' | 'tsumo'; honba: number; riichiSticks: number }`
  - `interface ScoreResult { limitClass: LimitClass | null; basePoints: number; payments: Payments; handTotal: number; total: number; steps: ScoreStep[] }`
  - `score(input: ScoreInput, rules: RuleSet): ScoreResult`

**Domain notes for the implementer** (riichi scoring is not guessable — these are the rules):

- Base points = `fu × 2^(2 + han)`, capped at 2000 (mangan).
- Limit classes by han, overriding the formula: 5 → mangan (2000); 6–7 → haneman (3000);
  8–10 → baiman (4000); 11–12 → sanbaiman (6000); 13+ → kazoe (8000, or 6000 if the ruleset
  scores kazoe as sanbaiman).
- Yakuman bypasses han/fu entirely: base = `8000 × yakumanMultiplier`.
- Payments, each **rounded up to the nearest 100 individually**:
  - non-dealer ron: `base × 4`; dealer ron: `base × 6`
  - non-dealer tsumo: `base × 2` from the dealer, `base × 1` from each other player
  - dealer tsumo: `base × 2` from each of the three players
- Honba: ron adds `300 × honba` from the discarder; tsumo adds `100 × honba` from each player.
- Riichi sticks: the winner collects `1000 × riichiSticks` on top.
- `handTotal` excludes honba and sticks; `total` includes them.

> **Spec caveat:** PLD §2's worked example is internally inconsistent — it is headed
> "3 han, 40 fu / 5,200 points" but its arithmetic uses 30 fu and arrives at 3,900. Do not
> copy either number as a fixture. The correct values are 3 han 40 fu non-dealer ron = 5,200
> and 3 han 30 fu non-dealer ron = 3,900.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/score.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { score } from './score'
import { WRC_2025 } from './rulesets/wrc2025'

const base = {
  yakumanMultiplier: 0,
  isDealer: false,
  winSource: 'ron' as const,
  honba: 0,
  riichiSticks: 0,
}

describe('score — non-dealer ron', () => {
  it('scores 1 han 30 fu as 1000', () => {
    expect(score({ ...base, han: 1, fu: 30 }, WRC_2025).handTotal).toBe(1000)
  })

  it('scores 3 han 30 fu as 3900', () => {
    expect(score({ ...base, han: 3, fu: 30 }, WRC_2025).handTotal).toBe(3900)
  })

  it('scores 3 han 40 fu as 5200', () => {
    expect(score({ ...base, han: 3, fu: 40 }, WRC_2025).handTotal).toBe(5200)
  })

  it('scores 4 han 30 fu as 7700 without kiriage', () => {
    expect(score({ ...base, han: 4, fu: 30 }, WRC_2025).handTotal).toBe(7700)
  })

  it('caps 4 han 40 fu at mangan because base points exceed 2000', () => {
    const result = score({ ...base, han: 4, fu: 40 }, WRC_2025)
    expect(result.handTotal).toBe(8000)
    expect(result.limitClass).toBe('mangan')
  })

  it('scores chiitoitsu 2 han 25 fu as 1600', () => {
    expect(score({ ...base, han: 2, fu: 25 }, WRC_2025).handTotal).toBe(1600)
  })
})

describe('score — dealer ron', () => {
  it('scores 1 han 30 fu as 1500', () => {
    expect(score({ ...base, han: 1, fu: 30, isDealer: true }, WRC_2025).handTotal).toBe(1500)
  })

  it('scores mangan as 12000', () => {
    expect(score({ ...base, han: 5, fu: 30, isDealer: true }, WRC_2025).handTotal).toBe(12000)
  })
})

describe('score — tsumo splits', () => {
  it('splits non-dealer 3 han 30 fu tsumo as 1000/2000', () => {
    const result = score({ ...base, han: 3, fu: 30, winSource: 'tsumo' }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo', dealerPays: 2000, nonDealerPays: 1000 })
    expect(result.handTotal).toBe(4000)
  })

  it('splits dealer 3 han 30 fu tsumo as 2000 all', () => {
    const result = score(
      { ...base, han: 3, fu: 30, isDealer: true, winSource: 'tsumo' }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo-all', eachPays: 2000 })
    expect(result.handTotal).toBe(6000)
  })

  it('splits non-dealer mangan tsumo as 2000/4000', () => {
    const result = score({ ...base, han: 5, fu: 30, winSource: 'tsumo' }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo', dealerPays: 4000, nonDealerPays: 2000 })
  })
})

describe('score — limit classes', () => {
  it.each([
    [5, 'mangan', 8000],
    [6, 'haneman', 12000],
    [8, 'baiman', 16000],
    [11, 'sanbaiman', 24000],
    [13, 'kazoe-yakuman', 32000],
  ] as const)('scores %i han as %s worth %i to a non-dealer ron', (han, cls, total) => {
    const result = score({ ...base, han, fu: 30 }, WRC_2025)
    expect(result.limitClass).toBe(cls)
    expect(result.handTotal).toBe(total)
  })

  it('honours a ruleset that scores kazoe as sanbaiman', () => {
    const rules = { ...WRC_2025, kazoe: 'sanbaiman' as const }
    expect(score({ ...base, han: 13, fu: 30 }, rules).handTotal).toBe(24000)
  })

  it('applies kiriage mangan only when the ruleset enables it', () => {
    const rules = { ...WRC_2025, kiriageMangan: true }
    expect(score({ ...base, han: 4, fu: 30 }, rules).handTotal).toBe(8000)
    expect(score({ ...base, han: 3, fu: 60 }, rules).handTotal).toBe(8000)
    expect(score({ ...base, han: 3, fu: 40 }, rules).handTotal).toBe(5200)
  })
})

describe('score — yakuman', () => {
  it('scores a single yakuman ron as 32000 for a non-dealer', () => {
    const result = score({ ...base, han: 13, fu: 20, yakumanMultiplier: 1 }, WRC_2025)
    expect(result.limitClass).toBe('yakuman')
    expect(result.handTotal).toBe(32000)
  })

  it('scores a double yakuman dealer ron as 96000', () => {
    const result = score(
      { ...base, han: 26, fu: 20, yakumanMultiplier: 2, isDealer: true }, WRC_2025)
    expect(result.handTotal).toBe(96000)
  })
})

describe('score — honba and riichi sticks', () => {
  it('adds 300 per honba from the discarder on a ron', () => {
    const result = score({ ...base, han: 1, fu: 30, honba: 2 }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'ron', discarderPays: 1600 })
    expect(result.handTotal).toBe(1000)
    expect(result.total).toBe(1600)
  })

  it('adds 100 per honba from each player on a tsumo', () => {
    const result = score(
      { ...base, han: 3, fu: 30, winSource: 'tsumo', honba: 1 }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'tsumo', dealerPays: 2100, nonDealerPays: 1100 })
    expect(result.total).toBe(4300)
  })

  it('adds riichi sticks to the total but not to any payment', () => {
    const result = score({ ...base, han: 1, fu: 30, riichiSticks: 2 }, WRC_2025)
    expect(result.payments).toEqual({ kind: 'ron', discarderPays: 1000 })
    expect(result.total).toBe(3000)
  })
})

describe('score — explanation steps', () => {
  it('records the base-point formula with real numbers', () => {
    const result = score({ ...base, han: 3, fu: 30 }, WRC_2025)
    const baseStep = result.steps.find((s) => s.label === 'Base points')
    expect(baseStep).toEqual({
      label: 'Base points',
      expression: '30 × 2^(2 + 3)',
      value: 960,
    })
  })

  it('records the rounding step for a non-dealer ron', () => {
    const result = score({ ...base, han: 3, fu: 30 }, WRC_2025)
    const payStep = result.steps.find((s) => s.label === 'Discarder pays')
    expect(payStep).toEqual({
      label: 'Discarder pays',
      expression: '960 × 4 = 3,840 → rounded up to 3,900',
      value: 3900,
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/score.test.ts
```

Expected: FAIL — `Failed to resolve import "./score"`.

- [ ] **Step 3: Implement the scorer**

Create `src/engine/score.ts`:

```ts
import type { RuleSet } from './rulesets/types'

export type LimitClass =
  | 'mangan' | 'haneman' | 'baiman' | 'sanbaiman' | 'kazoe-yakuman' | 'yakuman'

export type Payments =
  | { kind: 'ron'; discarderPays: number }
  | { kind: 'tsumo'; dealerPays: number; nonDealerPays: number }
  | { kind: 'tsumo-all'; eachPays: number }

export interface ScoreStep {
  label: string
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
        label: 'Base points',
        expression: `yakuman × ${yakumanMultiplier} = 8,000 × ${yakumanMultiplier}`,
        value: 8000 * yakumanMultiplier,
      },
    }
  }

  const limited = (limitClass: LimitClass, basePoints: number): BaseResult => ({
    basePoints,
    limitClass,
    step: {
      label: 'Base points',
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
        label: 'Base points',
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
        label: 'Base points',
        expression: `${fu} × 2^(2 + ${han}) = ${fmt(raw)}, capped at mangan`,
        value: 2000,
      },
    }
  }

  return {
    basePoints: raw,
    limitClass: null,
    step: {
      label: 'Base points',
      expression: `${fu} × 2^(2 + ${han})`,
      value: raw,
    },
  }
}

function payStep(label: string, base: number, multiplier: number): ScoreStep {
  const raw = base * multiplier
  const rounded = roundUp100(raw)
  const expression = raw === rounded
    ? `${fmt(base)} × ${multiplier} = ${fmt(raw)}`
    : `${fmt(base)} × ${multiplier} = ${fmt(raw)} → rounded up to ${fmt(rounded)}`
  return { label, expression, value: rounded }
}

export function score(input: ScoreInput, rules: RuleSet): ScoreResult {
  const { isDealer, winSource, honba, riichiSticks } = input
  const { basePoints, limitClass, step: baseStep } = computeBase(input, rules)
  const steps: ScoreStep[] = [baseStep]

  let payments: Payments
  let handTotal: number
  let honbaTotal: number

  if (winSource === 'ron') {
    const step = payStep('Discarder pays', basePoints, isDealer ? 6 : 4)
    steps.push(step)
    handTotal = step.value
    honbaTotal = 300 * honba
    payments = { kind: 'ron', discarderPays: step.value + honbaTotal }
  } else if (isDealer) {
    const step = payStep('Each player pays', basePoints, 2)
    steps.push(step)
    handTotal = step.value * 3
    honbaTotal = 300 * honba
    payments = { kind: 'tsumo-all', eachPays: step.value + 100 * honba }
  } else {
    const dealerStep = payStep('Dealer pays', basePoints, 2)
    const nonDealerStep = payStep('Each non-dealer pays', basePoints, 1)
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
      label: 'Honba',
      expression: winSource === 'ron'
        ? `${honba} honba × 300 from the discarder`
        : `${honba} honba × 100 from each player`,
      value: honbaTotal,
    })
  }

  if (riichiSticks > 0) {
    steps.push({
      label: 'Riichi sticks',
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
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/engine/score.test.ts
```

Expected: PASS.

- [ ] **Step 5: Add the published score table as an independent fixture**

This is the spec's §9 oracle. Encode the standard table **from a published source**, by hand,
without deriving it from `score()` — a fixture generated by the code under test proves nothing.

Create `src/engine/scoreTable.fixture.ts`:

```ts
/**
 * Non-dealer / dealer ron totals from the published riichi score table.
 * Transcribed by hand from a printed source — never generate this from score().
 * Key: `${han}-${fu}` → { nonDealerRon, dealerRon }
 */
export const RON_TABLE: Record<string, { nonDealerRon: number; dealerRon: number }> = {
  '1-30': { nonDealerRon: 1000, dealerRon: 1500 },
  '1-40': { nonDealerRon: 1300, dealerRon: 2000 },
  '1-50': { nonDealerRon: 1600, dealerRon: 2400 },
  '1-60': { nonDealerRon: 2000, dealerRon: 2900 },
  '1-70': { nonDealerRon: 2300, dealerRon: 3400 },
  '2-25': { nonDealerRon: 1600, dealerRon: 2400 },
  '2-30': { nonDealerRon: 2000, dealerRon: 2900 },
  '2-40': { nonDealerRon: 2600, dealerRon: 3900 },
  '2-50': { nonDealerRon: 3200, dealerRon: 4800 },
  '2-60': { nonDealerRon: 3900, dealerRon: 5800 },
  '2-70': { nonDealerRon: 4500, dealerRon: 6800 },
  '3-25': { nonDealerRon: 3200, dealerRon: 4800 },
  '3-30': { nonDealerRon: 3900, dealerRon: 5800 },
  '3-40': { nonDealerRon: 5200, dealerRon: 7700 },
  '3-50': { nonDealerRon: 6400, dealerRon: 9600 },
  '3-60': { nonDealerRon: 7700, dealerRon: 11600 },
  '4-25': { nonDealerRon: 6400, dealerRon: 9600 },
  '4-30': { nonDealerRon: 7700, dealerRon: 11600 },
  '4-40': { nonDealerRon: 8000, dealerRon: 12000 },
  '5-30': { nonDealerRon: 8000, dealerRon: 12000 },
  '6-30': { nonDealerRon: 12000, dealerRon: 18000 },
  '7-30': { nonDealerRon: 12000, dealerRon: 18000 },
  '8-30': { nonDealerRon: 16000, dealerRon: 24000 },
  '10-30': { nonDealerRon: 16000, dealerRon: 24000 },
  '11-30': { nonDealerRon: 24000, dealerRon: 36000 },
  '12-30': { nonDealerRon: 24000, dealerRon: 36000 },
  '13-30': { nonDealerRon: 32000, dealerRon: 48000 },
}
```

- [ ] **Step 6: Write the table-verification test**

Append to `src/engine/score.test.ts`:

```ts
import { RON_TABLE } from './scoreTable.fixture'

describe('score — matches the published table cell by cell', () => {
  it.each(Object.entries(RON_TABLE))('%s', (key, expected) => {
    const [han, fu] = key.split('-').map(Number)
    const common = {
      han, fu, yakumanMultiplier: 0, winSource: 'ron' as const, honba: 0, riichiSticks: 0,
    }
    expect(score({ ...common, isDealer: false }, WRC_2025).handTotal)
      .toBe(expected.nonDealerRon)
    expect(score({ ...common, isDealer: true }, WRC_2025).handTotal)
      .toBe(expected.dealerRon)
  })
})
```

- [ ] **Step 7: Run the full score suite**

```bash
npx vitest run src/engine/score.test.ts
```

Expected: PASS. If any table cell disagrees, **the fixture is right and the code is wrong** —
the fixture came from an external source. Fix `score.ts`, never the fixture.

- [ ] **Step 8: Commit**

```bash
git add src/engine/score.ts src/engine/score.test.ts src/engine/scoreTable.fixture.ts
git commit -m "feat: add score calculation verified against the published points table"
```

---

## Task 5: Hand helpers and validation

**Files:**
- Create: `src/engine/hand.ts`, `src/engine/validate.ts`, `src/engine/validate.test.ts`
- Modify: `src/engine/types.ts` (add `Meld`, `MeldKind`, `Hand`, `WinContext`)

**Interfaces:**
- Consumes: `Tile`, `Wind` from `./types`; `tileId`, `toCounts` from `./tiles`.
- Produces:
  - `type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'`
  - `interface Meld { kind: MeldKind; tiles: Tile[]; calledTile?: Tile }`
  - `interface Hand { concealed: Tile[]; melds: Meld[]; winningTile: Tile; winSource: 'ron' | 'tsumo' }`
  - `interface WinContext { seatWind; roundWind; riichi; ippatsu; haitei; houtei; rinshan; chankan; tenhou; chiihou; doraIndicators; uraIndicators; honba; riichiSticks }`
  - `isClosed(hand: Hand): boolean` — an ankan does not open a hand
  - `allTiles(hand: Hand): Tile[]` — concealed + every meld tile + winning tile
  - `isDealer(ctx: WinContext): boolean` — seat wind East
  - `type ValidationIssue` (discriminated union, codes below)
  - `interface ValidationResult { ok: boolean; issues: ValidationIssue[] }`
  - `validate(hand: Hand, ctx: WinContext): ValidationResult`

**Domain notes for the implementer:**

- A hand is 13 tiles plus the winning tile. Each meld occupies **three** slots of that count
  even when it is a kan of four physical tiles. So the arithmetic is
  `concealed.length + melds.length * 3 + 1 === 14`.
- The **physical** copy limit is separate: count all four tiles of a kan, plus dora and ura
  indicators, and no tile type may exceed four.
- An ankan (closed kan) does **not** open a hand. Every other meld kind does.
- Riichi requires a closed hand.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { validate } from './validate'
import { isClosed } from './hand'
import { parseTiles } from './tiles'
import type { Hand, WinContext, Meld } from './types'

const ctx = (overrides: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
  ...overrides,
})

const hand = (concealed: string, winning: string, overrides: Partial<Hand> = {}): Hand => ({
  concealed: parseTiles(concealed),
  melds: [],
  winningTile: parseTiles(winning)[0],
  winSource: 'ron',
  ...overrides,
})

const pon = (notation: string): Meld => ({
  kind: 'pon',
  tiles: parseTiles(notation),
  calledTile: parseTiles(notation)[0],
})

const ankan = (notation: string): Meld => ({ kind: 'ankan', tiles: parseTiles(notation) })

describe('isClosed', () => {
  it('treats a hand with no melds as closed', () => {
    expect(isClosed(hand('123m456m789m123p1s', '1s'))).toBe(true)
  })

  it('treats a pon as opening the hand', () => {
    expect(isClosed(hand('123m456m789m1s', '1s', { melds: [pon('111p')] }))).toBe(false)
  })

  it('treats an ankan as leaving the hand closed', () => {
    expect(isClosed(hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] }))).toBe(true)
  })
})

describe('validate — tile counts', () => {
  it('accepts a well-formed 14-tile hand', () => {
    expect(validate(hand('123m456m789m123p1s', '1s'), ctx()).ok).toBe(true)
  })

  it('reports how many tiles are still needed', () => {
    const result = validate(hand('123m456m789m12p', '2p'), ctx())
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual({ code: 'incomplete', tilesNeeded: 3 })
  })

  it('reports an overfull hand', () => {
    const result = validate(hand('123m456m789m123p11s2s', '2s'), ctx())
    expect(result.issues).toContainEqual({ code: 'too-many-tiles', excess: 1 })
  })

  it('counts a meld as three slots even when it is a kan', () => {
    const h = hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] })
    expect(validate(h, ctx()).ok).toBe(true)
  })
})

describe('validate — physical copies', () => {
  it('rejects five copies of a tile', () => {
    const result = validate(hand('11111m456m789m1s', '1s'), ctx())
    expect(result.issues).toContainEqual({
      code: 'impossible-duplicates',
      tile: { suit: 'm', rank: 1, red: false },
      count: 5,
    })
  })

  it('counts dora indicators towards the four-copy limit', () => {
    const h = hand('1111m456m789m1s', '1s')
    const result = validate(h, ctx({ doraIndicators: parseTiles('1m') }))
    expect(result.issues).toContainEqual({
      code: 'impossible-duplicates',
      tile: { suit: 'm', rank: 1, red: false },
      count: 5,
    })
  })

  it('counts all four tiles of a kan, not three', () => {
    const h = hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] })
    const result = validate(h, ctx({ doraIndicators: parseTiles('1p') }))
    expect(result.issues).toContainEqual({
      code: 'impossible-duplicates',
      tile: { suit: 'p', rank: 1, red: false },
      count: 5,
    })
  })
})

describe('validate — context conflicts', () => {
  const complete = hand('123m456m789m123p1s', '1s')

  it.each([
    ['haitei', { haitei: true }, 'ron' as const, 'Haitei requires a tsumo win.'],
    ['houtei', { houtei: true }, 'tsumo' as const, 'Houtei requires a ron win.'],
    ['rinshan', { rinshan: true }, 'ron' as const, 'Rinshan kaihou requires a tsumo win.'],
    ['chankan', { chankan: true }, 'tsumo' as const, 'Chankan requires a ron win.'],
  ])('rejects %s with the wrong win source', (rule, overrides, winSource, message) => {
    const result = validate({ ...complete, winSource }, ctx(overrides))
    expect(result.issues).toContainEqual({ code: 'context-conflict', rule, message })
  })

  it('rejects ippatsu without riichi', () => {
    const result = validate(complete, ctx({ ippatsu: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'ippatsu',
      message: 'Ippatsu is only possible after declaring riichi.',
    })
  })

  it('rejects riichi on an open hand', () => {
    const open = hand('123m456m789m1s', '1s', { melds: [pon('111p')] })
    const result = validate(open, ctx({ riichi: 'riichi' }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'riichi',
      message: 'Riichi can only be declared with a closed hand.',
    })
  })

  it('rejects haitei and houtei together', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ haitei: true, houtei: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'haitei',
      message: 'A hand cannot be both haitei and houtei.',
    })
  })

  it('rejects tenhou for a non-dealer', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ seatWind: 'S', tenhou: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'tenhou',
      message: 'Tenhou is a dealer-only hand won by tsumo.',
    })
  })

  it('accepts tenhou for a dealer tsumo', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ seatWind: 'E', tenhou: true }))
    expect(result.ok).toBe(true)
  })

  it('rejects chiihou for a dealer', () => {
    const result = validate({ ...complete, winSource: 'tsumo' },
      ctx({ seatWind: 'E', chiihou: true }))
    expect(result.issues).toContainEqual({
      code: 'context-conflict',
      rule: 'chiihou',
      message: 'Chiihou is a non-dealer hand won by tsumo.',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/validate.test.ts
```

Expected: FAIL — `Failed to resolve import "./validate"`.

- [ ] **Step 3: Extend the shared types**

Append to `src/engine/types.ts`:

```ts
export type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'

export interface Meld {
  kind: MeldKind
  tiles: Tile[]
  /** Which tile was claimed from another player. Absent for an ankan. */
  calledTile?: Tile
}

export type WinSource = 'ron' | 'tsumo'

export interface Hand {
  concealed: Tile[]
  melds: Meld[]
  winningTile: Tile
  winSource: WinSource
}

export type RiichiState = 'none' | 'riichi' | 'double'

export interface WinContext {
  seatWind: Wind
  roundWind: Wind
  riichi: RiichiState
  ippatsu: boolean
  haitei: boolean
  houtei: boolean
  rinshan: boolean
  chankan: boolean
  tenhou: boolean
  chiihou: boolean
  doraIndicators: Tile[]
  uraIndicators: Tile[]
  honba: number
  riichiSticks: number
}
```

- [ ] **Step 4: Implement the hand helpers**

Create `src/engine/hand.ts`:

```ts
import type { Hand, Tile, WinContext } from './types'

/** An ankan is concealed; every other meld kind opens the hand. */
export function isClosed(hand: Hand): boolean {
  return hand.melds.every((meld) => meld.kind === 'ankan')
}

/** Every physical tile in the hand, including all four tiles of a kan. */
export function allTiles(hand: Hand): Tile[] {
  return [...hand.concealed, ...hand.melds.flatMap((m) => m.tiles), hand.winningTile]
}

export function isDealer(ctx: WinContext): boolean {
  return ctx.seatWind === 'E'
}
```

- [ ] **Step 5: Implement validation**

Create `src/engine/validate.ts`:

```ts
import type { Hand, Tile, WinContext } from './types'
import { tileFromId, toCounts } from './tiles'
import { allTiles, isClosed, isDealer } from './hand'

export type ValidationIssue =
  | { code: 'incomplete'; tilesNeeded: number }
  | { code: 'too-many-tiles'; excess: number }
  | { code: 'impossible-duplicates'; tile: Tile; count: number }
  | { code: 'context-conflict'; rule: string; message: string }

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

const HAND_SIZE = 14

function checkCounts(hand: Hand): ValidationIssue[] {
  // A meld occupies three slots of the 14 regardless of whether it is a kan.
  const slots = hand.concealed.length + hand.melds.length * 3 + 1
  if (slots < HAND_SIZE) return [{ code: 'incomplete', tilesNeeded: HAND_SIZE - slots }]
  if (slots > HAND_SIZE) return [{ code: 'too-many-tiles', excess: slots - HAND_SIZE }]
  return []
}

function checkDuplicates(hand: Hand, ctx: WinContext): ValidationIssue[] {
  const counts = toCounts([
    ...allTiles(hand),
    ...ctx.doraIndicators,
    ...ctx.uraIndicators,
  ])
  return counts.flatMap((count, id) =>
    count > 4
      ? [{ code: 'impossible-duplicates' as const, tile: tileFromId(id), count }]
      : [])
}

function checkContext(hand: Hand, ctx: WinContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const conflict = (rule: string, message: string): void => {
    issues.push({ code: 'context-conflict', rule, message })
  }

  if (ctx.haitei && ctx.houtei) conflict('haitei', 'A hand cannot be both haitei and houtei.')
  if (ctx.haitei && hand.winSource !== 'tsumo') conflict('haitei', 'Haitei requires a tsumo win.')
  if (ctx.houtei && hand.winSource !== 'ron') conflict('houtei', 'Houtei requires a ron win.')
  if (ctx.rinshan && hand.winSource !== 'tsumo') {
    conflict('rinshan', 'Rinshan kaihou requires a tsumo win.')
  }
  if (ctx.chankan && hand.winSource !== 'ron') conflict('chankan', 'Chankan requires a ron win.')
  if (ctx.ippatsu && ctx.riichi === 'none') {
    conflict('ippatsu', 'Ippatsu is only possible after declaring riichi.')
  }
  if (ctx.riichi !== 'none' && !isClosed(hand)) {
    conflict('riichi', 'Riichi can only be declared with a closed hand.')
  }
  if (ctx.tenhou && ctx.chiihou) {
    conflict('tenhou', 'A hand cannot be both tenhou and chiihou.')
  }
  if (ctx.tenhou && !(isDealer(ctx) && hand.winSource === 'tsumo')) {
    conflict('tenhou', 'Tenhou is a dealer-only hand won by tsumo.')
  }
  if (ctx.chiihou && !(!isDealer(ctx) && hand.winSource === 'tsumo')) {
    conflict('chiihou', 'Chiihou is a non-dealer hand won by tsumo.')
  }
  return issues
}

export function validate(hand: Hand, ctx: WinContext): ValidationResult {
  const issues = [
    ...checkCounts(hand),
    ...checkDuplicates(hand, ctx),
    ...checkContext(hand, ctx),
  ]
  return { ok: issues.length === 0, issues }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npx vitest run src/engine/validate.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/hand.ts src/engine/validate.ts src/engine/validate.test.ts src/engine/types.ts
git commit -m "feat: add hand helpers and structured hand/context validation"
```

---

## Task 6: Hand decomposition

The spec's §3.3 requirement is absolute: **return every legal interpretation, never the
first**. A later stage picks the winner. This task is the algorithmic core of the engine.

**Files:**
- Create: `src/engine/decompose.ts`, `src/engine/decompose.test.ts`

**Interfaces:**
- Consumes: `Hand`, `Meld`, `Tile` from `./types`; `tileId`, `tileFromId`, `toCounts`, `sortTiles`, `tilesToNotation` from `./tiles`.
- Produces:
  - `type GroupKind = 'sequence' | 'triplet' | 'kan' | 'pair' | 'single'`
  - `interface Group { kind: GroupKind; tiles: Tile[]; open: boolean; containsWinningTile: boolean }`
  - `type HandStructure = 'standard' | 'chiitoitsu' | 'kokushi'`
  - `interface Interpretation { structure: HandStructure; groups: Group[] }`
  - `decompose(hand: Hand): Interpretation[]`
  - `groupKey(group: Group): string` — exported for reuse by `select.ts`

**Domain notes for the implementer:**

- `'single'` exists only to represent the twelve lone orphan tiles of a kokushi hand.
- A meld occupies one of the four group slots, so the concealed part must yield
  `4 - melds.length` groups plus the pair.
- Sequences never cross a suit boundary and never involve honors.
- `open` records whether the group came from a **call**. An ankan is `open: false`. The
  separate rule that a concealed triplet completed by ron counts as open *for fu and
  sanankou* is applied later, in `fu.ts` and the yaku rules, using
  `containsWinningTile && winSource === 'ron'`. Do not bake it in here.
- **Winning-tile assignment must be enumerated.** When the winning tile could belong to more
  than one distinct group in a partition, each placement is a separate interpretation, because
  wait type changes the fu. Placements that produce an identical group multiset must be
  deduplicated.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/decompose.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { decompose, type Interpretation } from './decompose'
import { parseTiles, sortTiles, tilesToNotation } from './tiles'
import type { Hand, Meld } from './types'

const hand = (concealed: string, winning: string, overrides: Partial<Hand> = {}): Hand => ({
  concealed: parseTiles(concealed),
  melds: [],
  winningTile: parseTiles(winning)[0],
  winSource: 'ron',
  ...overrides,
})

/** Renders an interpretation as a stable, readable string for assertions. */
const render = (interp: Interpretation): string =>
  interp.groups
    .map((g) => tilesToNotation(sortTiles(g.tiles)) + (g.containsWinningTile ? '*' : ''))
    .sort()
    .join(' ')

const renderAll = (interps: Interpretation[]): string[] => interps.map(render).sort()

describe('decompose — standard hands', () => {
  it('finds the single interpretation of an unambiguous hand', () => {
    const result = decompose(hand('123m456m789m123p1s', '1s'))
    expect(result).toHaveLength(1)
    expect(result[0].structure).toBe('standard')
    expect(render(result[0])).toBe('11s* 123m 123p 456m 789m')
  })

  it('finds both the triplet and sequence readings of 111222333m', () => {
    const result = decompose(hand('111222333m456p9s', '9s'))
    expect(renderAll(result)).toEqual([
      '111m 222m 333m 456p 99s*',
      '123m 123m 123m 456p 99s*',
    ])
  })

  it('finds both partitions of an ambiguous 22334455m block', () => {
    const result = decompose(hand('22334455m678p99s', '9s'))
    expect(renderAll(result)).toEqual([
      '22m 345m 345m 678p 999s*',
      '234m 234m 55m 678p 999s*',
    ])
  })

  it('does not build a sequence across a suit boundary', () => {
    // 9m 1p 2p must not read as a sequence.
    const result = decompose(hand('99m12p345p678p11s', '1s'))
    expect(result).toHaveLength(0)
  })

  it('returns no interpretations for a hand that is not a winning shape', () => {
    expect(decompose(hand('123m456m789m135p1s', '1s'))).toHaveLength(0)
  })
})

describe('decompose — winning tile assignment', () => {
  it('marks exactly one group as containing the winning tile', () => {
    for (const interp of decompose(hand('111222333m456p9s', '9s'))) {
      expect(interp.groups.filter((g) => g.containsWinningTile)).toHaveLength(1)
    }
  })

  it('collapses placements that yield an identical group multiset', () => {
    // The winning 1m could sit in either 123m, but the two readings are the same hand.
    const result = decompose(hand('12312m456m789m99p', '3m'))
    expect(renderAll(result)).toEqual(['123m 123m* 456m 789m 99p'])
  })

  it('enumerates placements that differ, so fu can differ', () => {
    // Holding 1123m and winning on 1m, the winning tile can complete either the
    // 11m pair (a tanki wait, 2 fu) or the 123m sequence (a ryanmen wait, 0 fu).
    const result = decompose(hand('1123m456p789s234s', '1m'))
    expect(renderAll(result)).toEqual([
      '11m 123m* 234s 456p 789s',
      '11m* 123m 234s 456p 789s',
    ])
    for (const interp of result) {
      expect(interp.groups.filter((g) => g.containsWinningTile)).toHaveLength(1)
    }
  })
})

describe('decompose — melds', () => {
  const pon = (notation: string): Meld => ({
    kind: 'pon', tiles: parseTiles(notation), calledTile: parseTiles(notation)[0],
  })
  const ankan = (notation: string): Meld => ({ kind: 'ankan', tiles: parseTiles(notation) })

  it('treats a meld as one of the four groups', () => {
    const result = decompose(hand('123m456m789m1s', '1s', { melds: [pon('111p')] }))
    expect(result).toHaveLength(1)
    expect(render(result[0])).toBe('11s* 111p 123m 456m 789m')
  })

  it('marks a called meld as open and an ankan as closed', () => {
    const open = decompose(hand('123m456m789m1s', '1s', { melds: [pon('111p')] }))[0]
    expect(open.groups.find((g) => g.kind === 'triplet')?.open).toBe(true)

    const closed = decompose(hand('123m456m789m1s', '1s', { melds: [ankan('1111p')] }))[0]
    const kan = closed.groups.find((g) => g.kind === 'kan')
    expect(kan?.open).toBe(false)
    expect(kan?.tiles).toHaveLength(4)
  })
})

describe('decompose — seven pairs', () => {
  it('recognises chiitoitsu', () => {
    const result = decompose(hand('1122m3344p5566s7z', '7z'))
    expect(result.map((r) => r.structure)).toEqual(['chiitoitsu'])
    expect(result[0].groups).toHaveLength(7)
    expect(result[0].groups.every((g) => g.kind === 'pair')).toBe(true)
  })

  it('rejects four-of-a-kind as two pairs', () => {
    const result = decompose(hand('1111m3344p5566s7z', '7z'))
    expect(result.some((r) => r.structure === 'chiitoitsu')).toBe(false)
  })

  it('returns both the chiitoitsu and ryanpeikou readings when a hand is both', () => {
    const result = decompose(hand('112233445566m7p', '7p'))
    const structures = result.map((r) => r.structure)
    expect(structures).toContain('chiitoitsu')
    expect(structures).toContain('standard')
  })
})

describe('decompose — thirteen orphans', () => {
  it('recognises kokushi musou', () => {
    const result = decompose(hand('19m19p19s1234567z', '1m'))
    expect(result.map((r) => r.structure)).toEqual(['kokushi'])
    expect(result[0].groups.filter((g) => g.kind === 'pair')).toHaveLength(1)
    expect(result[0].groups.filter((g) => g.kind === 'single')).toHaveLength(12)
  })

  it('rejects a hand missing an orphan type', () => {
    const result = decompose(hand('19m19p19s123456z1m', '1m'))
    expect(result.some((r) => r.structure === 'kokushi')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/decompose.test.ts
```

Expected: FAIL — `Failed to resolve import "./decompose"`.

- [ ] **Step 3: Implement decomposition**

Create `src/engine/decompose.ts`:

```ts
import type { Hand, Meld, Tile } from './types'
import { sortTiles, tileFromId, tileId, tilesToNotation, toCounts } from './tiles'

export type GroupKind = 'sequence' | 'triplet' | 'kan' | 'pair' | 'single'

export interface Group {
  kind: GroupKind
  tiles: Tile[]
  /** True when the group came from a call. An ankan is false. */
  open: boolean
  containsWinningTile: boolean
}

export type HandStructure = 'standard' | 'chiitoitsu' | 'kokushi'

export interface Interpretation {
  structure: HandStructure
  groups: Group[]
}

const ORPHAN_IDS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33] as const

export function groupKey(group: Group): string {
  const tiles = tilesToNotation(sortTiles(group.tiles))
  return `${group.kind}:${tiles}:${group.open ? 'o' : 'c'}:${group.containsWinningTile ? 'w' : '-'}`
}

const variantKey = (groups: Group[]): string => groups.map(groupKey).sort().join('|')

const makeGroup = (kind: GroupKind, tiles: Tile[], open = false): Group =>
  ({ kind, tiles, open, containsWinningTile: false })

const copies = (id: number, n: number): Tile[] =>
  Array.from({ length: n }, () => tileFromId(id))

function meldToGroup(meld: Meld): Group {
  const kind: GroupKind =
    meld.kind === 'chi' ? 'sequence' : meld.kind === 'pon' ? 'triplet' : 'kan'
  return makeGroup(kind, [...meld.tiles], meld.kind !== 'ankan')
}

function canFormSequence(counts: number[], id: number): boolean {
  if (id >= 27) return false      // honors form no sequences
  if (id % 9 > 6) return false    // would run past the end of the suit
  return counts[id] > 0 && counts[id + 1] > 0 && counts[id + 2] > 0
}

/** Depth-first extraction of exactly `needed` groups, consuming `counts` entirely. */
function extractGroups(
  counts: number[], needed: number, acc: Group[], out: Group[][],
): void {
  if (needed === 0) {
    if (counts.every((c) => c === 0)) out.push([...acc])
    return
  }
  const id = counts.findIndex((c) => c > 0)
  if (id === -1) return

  if (counts[id] >= 3) {
    counts[id] -= 3
    acc.push(makeGroup('triplet', copies(id, 3)))
    extractGroups(counts, needed - 1, acc, out)
    acc.pop()
    counts[id] += 3
  }

  if (canFormSequence(counts, id)) {
    counts[id] -= 1; counts[id + 1] -= 1; counts[id + 2] -= 1
    acc.push(makeGroup('sequence',
      [tileFromId(id), tileFromId(id + 1), tileFromId(id + 2)]))
    extractGroups(counts, needed - 1, acc, out)
    acc.pop()
    counts[id] += 1; counts[id + 1] += 1; counts[id + 2] += 1
  }
}

function standardPartitions(counts: number[], groupsNeeded: number): Group[][] {
  const partitions: Group[][] = []
  for (let id = 0; id < 34; id++) {
    if (counts[id] < 2) continue
    counts[id] -= 2
    const found: Group[][] = []
    extractGroups(counts, groupsNeeded, [], found)
    for (const groups of found) {
      partitions.push([makeGroup('pair', copies(id, 2)), ...groups])
    }
    counts[id] += 2
  }
  return partitions
}

function chiitoitsuPartition(counts: number[]): Group[] | null {
  if (!counts.every((c) => c === 0 || c === 2)) return null
  if (counts.filter((c) => c === 2).length !== 7) return null
  return counts.flatMap((c, id) => (c === 2 ? [makeGroup('pair', copies(id, 2))] : []))
}

function kokushiPartition(counts: number[]): Group[] | null {
  const orphans = new Set<number>(ORPHAN_IDS)
  for (let id = 0; id < 34; id++) {
    if (!orphans.has(id) && counts[id] !== 0) return null
  }
  const values = ORPHAN_IDS.map((id) => counts[id])
  if (values.some((c) => c < 1 || c > 2)) return null
  if (values.filter((c) => c === 2).length !== 1) return null

  return ORPHAN_IDS.map((id) =>
    counts[id] === 2
      ? makeGroup('pair', copies(id, 2))
      : makeGroup('single', copies(id, 1)))
}

/** One variant per distinct placement of the winning tile among the concealed groups. */
function placeWinningTile(groups: Group[], winId: number): Group[][] {
  const variants: Group[][] = []
  const seen = new Set<string>()

  groups.forEach((group, index) => {
    if (!group.tiles.some((t) => tileId(t) === winId)) return
    const variant = groups.map((g, i) =>
      i === index ? { ...g, containsWinningTile: true } : g)
    const key = variantKey(variant)
    if (seen.has(key)) return
    seen.add(key)
    variants.push(variant)
  })

  return variants
}

export function decompose(hand: Hand): Interpretation[] {
  const meldGroups = hand.melds.map(meldToGroup)
  const counts = toCounts([...hand.concealed, hand.winningTile])
  const winId = tileId(hand.winningTile)
  const groupsNeeded = 4 - hand.melds.length
  if (groupsNeeded < 0) return []

  const candidates: Interpretation[] = []

  for (const partition of standardPartitions(counts, groupsNeeded)) {
    for (const variant of placeWinningTile(partition, winId)) {
      candidates.push({ structure: 'standard', groups: [...variant, ...meldGroups] })
    }
  }

  if (hand.melds.length === 0) {
    for (const [structure, partition] of [
      ['chiitoitsu', chiitoitsuPartition(counts)],
      ['kokushi', kokushiPartition(counts)],
    ] as const) {
      if (!partition) continue
      for (const variant of placeWinningTile(partition, winId)) {
        candidates.push({ structure, groups: variant })
      }
    }
  }

  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.structure}|${variantKey(candidate.groups)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/engine/decompose.test.ts
```

Expected: PASS. If the ambiguous-block test disagrees on ordering, fix the assertion's sort —
never loosen it to `expect.arrayContaining`, which would stop catching missing interpretations.

- [ ] **Step 5: Add a property test that decompositions conserve tiles**

Append to `src/engine/decompose.test.ts`:

```ts
import { toCounts } from './tiles'

describe('decompose — invariants', () => {
  const hands: Array<[string, string]> = [
    ['123m456m789m123p1s', '1s'],
    ['111222333m456p9s', '9s'],
    ['112233445566m7p', '7p'],
    ['1122m3344p5566s7z', '7z'],
    ['19m19p19s1234567z', '1m'],
    ['1123m456p789s234s', '1m'],
  ]

  it.each(hands)('every interpretation of %s+%s uses exactly the input tiles', (c, w) => {
    const h = hand(c, w)
    const expected = toCounts([...h.concealed, h.winningTile])
    for (const interp of decompose(h)) {
      const actual = toCounts(interp.groups.flatMap((g) => g.tiles))
      expect(actual).toEqual(expected)
    }
  })

  it.each(hands)('no interpretation of %s+%s is returned twice', (c, w) => {
    const rendered = decompose(hand(c, w)).map(render)
    expect(new Set(rendered).size).toBe(rendered.length)
  })
})
```

- [ ] **Step 6: Run the full decomposition suite**

```bash
npx vitest run src/engine/decompose.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine/decompose.ts src/engine/decompose.test.ts
git commit -m "feat: enumerate every legal hand interpretation including winning-tile placement"
```

---

## Task 7: Fu computation

**Files:**
- Create: `src/engine/fu.ts`, `src/engine/fu.test.ts`

**Interfaces:**
- Consumes: `Interpretation`, `Group` from `./decompose`; `Hand`, `WinContext`, `Tile`, `Wind` from `./types`; `RuleSet`; `isClosed` from `./hand`.
- Produces:
  - `type WaitType = 'ryanmen' | 'penchan' | 'kanchan' | 'shanpon' | 'tanki'`
  - `interface FuLine { id: string; fu: number; tile?: Tile; note?: string }`
  - `interface FuResult { lines: FuLine[]; raw: number; total: number; wait: WaitType | null }`
  - `computeFu(interp, hand, ctx, rules): FuResult`
  - `classifyWait(interp, hand): WaitType | null` — exported for reuse
  - `isPinfuShape(interp, hand, ctx): boolean` — exported so the pinfu yaku rule shares this logic
  - `isEffectivelyOpenTriplet(group, hand): boolean` — exported for sanankou

**Domain notes for the implementer** (these values are not guessable):

| Component | Simple tile | Terminal or honor |
|---|---|---|
| Open triplet (minko) | 2 | 4 |
| Closed triplet (ankou) | 4 | 8 |
| Open kan (minkan / shouminkan) | 8 | 16 |
| Closed kan (ankan) | 16 | 32 |

- Base 20 fu. Closed ron adds 10 (menzen kafu). Tsumo adds 2.
- Pair: 2 fu if it is a dragon, the seat wind, or the round wind. A pair that is **both** seat
  and round wind is worth `rules.doubleWindPairFu`.
- Wait: tanki, kanchan, and penchan are 2 fu; ryanmen and shanpon are 0.
- **A concealed triplet completed by ron counts as an open triplet.** This is the single most
  commonly mis-implemented fu rule, and it also governs sanankou.
- Round the total **up** to the next 10.
- Chiitoitsu is a flat 25 fu with no other components and no rounding.
- Pinfu suppresses both the tsumo bonus and the wait fu: closed pinfu tsumo is 20 fu, closed
  pinfu ron is 30 fu.
- An open hand whose components total 20 fu is scored as `rules.openPinfuFu` (30).

- [ ] **Step 1: Write the failing tests**

Create `src/engine/fu.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeFu, classifyWait, isPinfuShape } from './fu'
import { decompose } from './decompose'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, Meld, WinContext, WinSource } from './types'

const ctx = (overrides: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
  ...overrides,
})

const hand = (
  concealed: string, winning: string,
  winSource: WinSource = 'ron', melds: Meld[] = [],
): Hand => ({
  concealed: parseTiles(concealed),
  melds,
  winningTile: parseTiles(winning)[0],
  winSource,
})

/** Fu of the first interpretation — used where the hand is unambiguous. */
const fuOf = (h: Hand, c: WinContext = ctx()) =>
  computeFu(decompose(h)[0], h, c, WRC_2025)

describe('computeFu — base components', () => {
  it('scores a closed pinfu ron as 30 fu', () => {
    // 234m 456p 678s 234s, pair 5m (not a value tile), ryanmen wait on 2m.
    const h = hand('34m456p678s234s55m', '2m')
    const result = fuOf(h)
    expect(result.total).toBe(30)
    expect(result.lines.map((l) => l.id)).toEqual(['base', 'menzen-ron'])
  })

  it('scores a closed pinfu tsumo as 20 fu', () => {
    const h = hand('34m456p678s234s55m', '2m', 'tsumo')
    const result = fuOf(h)
    expect(result.total).toBe(20)
    expect(result.lines.map((l) => l.id)).toEqual(['base'])
  })

  it('adds 2 fu for a non-pinfu tsumo', () => {
    // 111m ankou blocks pinfu.
    const h = hand('111m234m456p678s55s', '5s', 'tsumo')
    expect(fuOf(h).lines.find((l) => l.id === 'tsumo')).toEqual({ id: 'tsumo', fu: 2 })
  })

  it('scores chiitoitsu as a flat 25 fu', () => {
    const h = hand('1122m3344p5566s7z', '7z')
    const chiitoi = decompose(h).find((i) => i.structure === 'chiitoitsu')!
    const result = computeFu(chiitoi, h, ctx(), WRC_2025)
    expect(result.total).toBe(25)
    expect(result.lines).toEqual([{ id: 'chiitoitsu', fu: 25 }])
  })
})

describe('computeFu — triplets and kans', () => {
  it('scores a concealed simple triplet as 4 fu and a concealed terminal triplet as 8', () => {
    const simple = hand('222m345m456p678s99s', '9s')
    expect(fuOf(simple).lines.find((l) => l.id === 'ankou')).toEqual(
      { id: 'ankou', fu: 4, tile: { suit: 'm', rank: 2, red: false } })

    const terminal = hand('111m345m456p678s99s', '9s')
    expect(fuOf(terminal).lines.find((l) => l.id === 'ankou')).toEqual(
      { id: 'ankou', fu: 8, tile: { suit: 'm', rank: 1, red: false } })
  })

  it('treats a concealed triplet completed by ron as an open triplet', () => {
    // Shanpon wait between 111m and 99s; ron on 1m makes that triplet open for fu.
    const h = hand('11m345m456p678s99s', '1m')
    const shanpon = decompose(h).find((i) =>
      i.groups.some((g) => g.kind === 'triplet' && g.containsWinningTile))!
    const result = computeFu(shanpon, h, ctx(), WRC_2025)
    expect(result.lines.find((l) => l.id === 'minko')).toEqual(
      { id: 'minko', fu: 4, tile: { suit: 'm', rank: 1, red: false },
        note: 'completed by ron' })
  })

  it('scores the four kan types correctly', () => {
    const kan = (kind: Meld['kind'], notation: string): Meld =>
      ({ kind, tiles: parseTiles(notation) })

    const ankanSimple = hand('345m456p678s99s', '9s', 'ron', [kan('ankan', '2222m')])
    expect(fuOf(ankanSimple).lines.find((l) => l.id === 'ankan')?.fu).toBe(16)

    const ankanTerminal = hand('345m456p678s99s', '9s', 'ron', [kan('ankan', '1111m')])
    expect(fuOf(ankanTerminal).lines.find((l) => l.id === 'ankan')?.fu).toBe(32)

    const minkanSimple = hand('345m456p678s99s', '9s', 'ron', [kan('minkan', '2222m')])
    expect(fuOf(minkanSimple).lines.find((l) => l.id === 'minkan')?.fu).toBe(8)

    const minkanTerminal = hand('345m456p678s99s', '9s', 'ron', [kan('minkan', '1111m')])
    expect(fuOf(minkanTerminal).lines.find((l) => l.id === 'minkan')?.fu).toBe(16)
  })
})

describe('computeFu — the pair', () => {
  it('awards 2 fu for a dragon pair', () => {
    const h = hand('234m456p678s234s5z', '5z')
    expect(fuOf(h).lines.find((l) => l.id === 'value-pair')?.fu).toBe(2)
  })

  it('awards 2 fu for a seat wind pair', () => {
    const h = hand('234m456p678s234s2z', '2z')  // South = seat wind
    expect(fuOf(h, ctx({ seatWind: 'S', roundWind: 'E' }))
      .lines.find((l) => l.id === 'value-pair')?.fu).toBe(2)
  })

  it('awards doubleWindPairFu when the pair is both seat and round wind', () => {
    const h = hand('234m456p678s234s1z', '1z')  // East
    const result = fuOf(h, ctx({ seatWind: 'E', roundWind: 'E' }))
    expect(result.lines.find((l) => l.id === 'value-pair')?.fu)
      .toBe(WRC_2025.doubleWindPairFu)
  })

  it('awards nothing for a pair of a non-value wind', () => {
    const h = hand('234m456p678s234s4z', '4z')  // North, neither seat nor round
    expect(fuOf(h, ctx({ seatWind: 'S', roundWind: 'E' }))
      .lines.find((l) => l.id === 'value-pair')).toBeUndefined()
  })
})

describe('classifyWait', () => {
  const waitOf = (concealed: string, winning: string) => {
    const h = hand(concealed, winning)
    return classifyWait(decompose(h)[0], h)
  }

  it('identifies a ryanmen wait', () => {
    expect(waitOf('34m456p678s234s55m', '2m')).toBe('ryanmen')
  })

  it('identifies a kanchan wait', () => {
    expect(waitOf('24m456p678s234s55m', '3m')).toBe('kanchan')
  })

  it('identifies a penchan wait at the bottom of a suit', () => {
    expect(waitOf('12m456p678s234s55m', '3m')).toBe('penchan')
  })

  it('identifies a penchan wait at the top of a suit', () => {
    expect(waitOf('89m456p678s234s55m', '7m')).toBe('penchan')
  })

  it('identifies a tanki wait', () => {
    expect(waitOf('234m456p678s234s5m', '5m')).toBe('tanki')
  })

  it('identifies a shanpon wait', () => {
    const h = hand('11m345m456p678s99s', '1m')
    const shanpon = decompose(h).find((i) =>
      i.groups.some((g) => g.kind === 'triplet' && g.containsWinningTile))!
    expect(classifyWait(shanpon, h)).toBe('shanpon')
  })
})

describe('computeFu — wait fu and rounding', () => {
  it('adds 2 fu for a kanchan wait and rounds up to the next 10', () => {
    // 20 base + 10 menzen ron + 2 kanchan = 32 → 40.
    const h = hand('24m456p678s234s55m', '3m')
    const result = fuOf(h)
    expect(result.lines.find((l) => l.id === 'wait')).toEqual(
      { id: 'wait', fu: 2, note: 'kanchan' })
    expect(result.raw).toBe(32)
    expect(result.total).toBe(40)
  })

  it('adds no fu for a ryanmen or shanpon wait', () => {
    expect(fuOf(hand('34m456p678s234s55m', '2m'))
      .lines.find((l) => l.id === 'wait')).toBeUndefined()
  })

  it('scores a 20-fu open hand as openPinfuFu', () => {
    const chi = (n: string): Meld =>
      ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })
    const h = hand('34m456p678s', '2m', 'ron', [chi('234s')])
    const result = fuOf(h)
    expect(result.total).toBe(WRC_2025.openPinfuFu)
  })
})

describe('isPinfuShape', () => {
  it('accepts a closed all-sequence hand with a plain pair and a ryanmen wait', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(true)
  })

  it('rejects a hand containing a triplet', () => {
    const h = hand('111m234m456p678s55s', '5s')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })

  it('rejects a value pair', () => {
    const h = hand('234m456p678s234s5z', '5z')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })

  it('rejects a kanchan wait', () => {
    const h = hand('24m456p678s234s55m', '3m')
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })

  it('rejects an open hand', () => {
    const chi = (n: string): Meld =>
      ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })
    const h = hand('34m456p678s', '2m', 'ron', [chi('234s')])
    expect(isPinfuShape(decompose(h)[0], h, ctx())).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/fu.test.ts
```

Expected: FAIL — `Failed to resolve import "./fu"`.

- [ ] **Step 3: Implement fu**

Create `src/engine/fu.ts`:

```ts
import type { Group, Interpretation } from './decompose'
import type { Hand, Tile, WinContext, Wind } from './types'
import type { RuleSet } from './rulesets/types'
import { isClosed } from './hand'
import { isTerminalOrHonor, WIND_ORDER } from './tiles'

export type WaitType = 'ryanmen' | 'penchan' | 'kanchan' | 'shanpon' | 'tanki'

export interface FuLine {
  id: string
  fu: number
  tile?: Tile
  note?: string
}

export interface FuResult {
  lines: FuLine[]
  /** Total before rounding. */
  raw: number
  /** Rounded up to the next 10, except chiitoitsu's flat 25. */
  total: number
  wait: WaitType | null
}

const windTile = (wind: Wind): number => WIND_ORDER.indexOf(wind) + 1

const isDragon = (tile: Tile): boolean => tile.suit === 'z' && tile.rank >= 5

/** A concealed triplet completed by ron is scored as an open triplet. */
export function isEffectivelyOpenTriplet(group: Group, hand: Hand): boolean {
  if (group.open) return true
  return group.containsWinningTile && hand.winSource === 'ron'
}

export function classifyWait(interp: Interpretation, hand: Hand): WaitType | null {
  const group = interp.groups.find((g) => g.containsWinningTile)
  if (!group) return null
  if (group.kind === 'pair') return 'tanki'
  if (group.kind === 'triplet') return 'shanpon'
  if (group.kind !== 'sequence') return null

  const ranks = group.tiles.map((t) => t.rank).sort((a, b) => a - b)
  const low = ranks[0]
  const won = hand.winningTile.rank

  if (won === low + 1) return 'kanchan'
  if (won === low) return low === 7 ? 'penchan' : 'ryanmen'
  return low === 1 ? 'penchan' : 'ryanmen'
}

function pairFu(group: Group, ctx: WinContext, rules: RuleSet): FuLine | null {
  const tile = group.tiles[0]
  if (tile.suit !== 'z') return null

  if (isDragon(tile)) return { id: 'value-pair', fu: 2, tile, note: 'dragon' }

  const isSeat = tile.rank === windTile(ctx.seatWind)
  const isRound = tile.rank === windTile(ctx.roundWind)
  if (isSeat && isRound) {
    return { id: 'value-pair', fu: rules.doubleWindPairFu, tile, note: 'seat and round wind' }
  }
  if (isSeat) return { id: 'value-pair', fu: 2, tile, note: 'seat wind' }
  if (isRound) return { id: 'value-pair', fu: 2, tile, note: 'round wind' }
  return null
}

function setFu(group: Group, hand: Hand): FuLine | null {
  const tile = group.tiles[0]
  const honorOrTerminal = isTerminalOrHonor(tile)

  if (group.kind === 'kan') {
    return group.open
      ? { id: 'minkan', fu: honorOrTerminal ? 16 : 8, tile }
      : { id: 'ankan', fu: honorOrTerminal ? 32 : 16, tile }
  }

  if (group.kind !== 'triplet') return null

  if (isEffectivelyOpenTriplet(group, hand)) {
    const line: FuLine = { id: 'minko', fu: honorOrTerminal ? 4 : 2, tile }
    if (!group.open) line.note = 'completed by ron'
    return line
  }
  return { id: 'ankou', fu: honorOrTerminal ? 8 : 4, tile }
}

export function isPinfuShape(
  interp: Interpretation, hand: Hand, ctx: WinContext,
): boolean {
  if (interp.structure !== 'standard') return false
  if (!isClosed(hand)) return false

  const blocks = interp.groups.filter((g) => g.kind !== 'pair')
  if (blocks.length !== 4 || !blocks.every((g) => g.kind === 'sequence')) return false

  const pair = interp.groups.find((g) => g.kind === 'pair')
  if (!pair) return false
  // A pinfu pair may not be a dragon, the seat wind, or the round wind.
  if (pairFu(pair, ctx, { doubleWindPairFu: 2 } as RuleSet) !== null) return false

  return classifyWait(interp, hand) === 'ryanmen'
}

export function computeFu(
  interp: Interpretation, hand: Hand, ctx: WinContext, rules: RuleSet,
): FuResult {
  if (interp.structure === 'chiitoitsu') {
    return { lines: [{ id: 'chiitoitsu', fu: 25 }], raw: 25, total: 25, wait: 'tanki' }
  }
  if (interp.structure === 'kokushi') {
    return { lines: [], raw: 0, total: 0, wait: classifyWait(interp, hand) }
  }

  const closed = isClosed(hand)
  const pinfu = isPinfuShape(interp, hand, ctx)
  const wait = classifyWait(interp, hand)
  const lines: FuLine[] = [{ id: 'base', fu: 20 }]

  if (closed && hand.winSource === 'ron') lines.push({ id: 'menzen-ron', fu: 10 })
  if (hand.winSource === 'tsumo' && !pinfu) lines.push({ id: 'tsumo', fu: 2 })

  for (const group of interp.groups) {
    const line = setFu(group, hand)
    if (line) lines.push(line)
  }

  const pair = interp.groups.find((g) => g.kind === 'pair')
  if (pair) {
    const line = pairFu(pair, ctx, rules)
    if (line) lines.push(line)
  }

  if (!pinfu && wait && (wait === 'tanki' || wait === 'kanchan' || wait === 'penchan')) {
    lines.push({ id: 'wait', fu: 2, note: wait })
  }

  const raw = lines.reduce((sum, line) => sum + line.fu, 0)
  const rounded = Math.ceil(raw / 10) * 10
  // An open hand whose components total 20 fu is scored as openPinfuFu.
  const total = !closed && rounded === 20 ? rules.openPinfuFu : rounded

  return { lines, raw, total, wait }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/engine/fu.test.ts
```

Expected: PASS.

Note on `isPinfuShape`: it calls `pairFu` with a stub ruleset because it only needs to know
*whether* the pair is a value pair, not how much it is worth. If that reads as a hack during
review, extract a small `isValuePair(group, ctx): boolean` and have both call it.

- [ ] **Step 5: Commit**

```bash
git add src/engine/fu.ts src/engine/fu.test.ts
git commit -m "feat: add itemized fu computation with wait classification and pinfu shape"
```

---

## Task 8: Yaku registry and one-han yaku

**Files:**
- Create: `src/engine/yaku/types.ts`, `src/engine/yaku/helpers.ts`, `src/engine/yaku/oneHan.ts`, `src/engine/yaku/registry.ts`, `src/engine/yaku/detect.ts`, `src/engine/yaku/oneHan.test.ts`

**Interfaces:**
- Consumes: `Interpretation`, `Group` from `../decompose`; `Hand`, `WinContext`, `Tile` from `../types`; `RuleSet`; `isClosed` from `../hand`; `isPinfuShape`, `isEffectivelyOpenTriplet` from `../fu`.
- Produces:
  - `interface Evidence { tiles?: Tile[]; groups?: Group[]; params?: Record<string, string | number> }`
  - `interface YakuContext { interp; hand; ctx; rules; closed: boolean }`
  - `interface YakuRule { id; name; closedHan; openHan; yakuman?; supersedes?; match(c: YakuContext): Evidence | null }`
  - `interface YakuResult { id: string; name: string; han: number; yakuman: number; evidence: Evidence }`
  - `YAKU_RULES: readonly YakuRule[]`
  - `detectYaku(interp, hand, ctx, rules): YakuResult[]`
  - helpers: `blocks`, `tripletsAndKans`, `concealedTripletCount`, `suitsUsed`, `hasHonors`, `allTilesOf`

**Domain notes for the implementer:**

- `openHan: 0` means the yaku **cannot** be scored with an open hand.
- `supersedes` removes lower yaku that the higher one absorbs: double riichi absorbs riichi,
  ryanpeikou absorbs iipeikou, chinitsu absorbs honitsu, junchan absorbs chanta.
- If any yakuman matches, **only yakuman are returned** — normal yaku do not add to a yakuman
  hand. `rules.multipleYakuman === false` caps the total multiplier at 1;
  `rules.doubleYakuman === false` clamps each rule's own multiplier to 1.
- Yakuhai is not one rule but five: three dragons, the seat wind, and the round wind. A tile
  that is both seat and round wind therefore matches twice and scores 2 han, which is correct.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/yaku/oneHan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectYaku } from './detect'
import { decompose } from '../decompose'
import { parseTiles } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'
import type { Hand, Meld, WinContext, WinSource } from '../types'

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (
  concealed: string, winning: string,
  winSource: WinSource = 'ron', melds: Meld[] = [],
): Hand => ({
  concealed: parseTiles(concealed), melds,
  winningTile: parseTiles(winning)[0], winSource,
})

const chi = (n: string): Meld =>
  ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })
const pon = (n: string): Meld =>
  ({ kind: 'pon', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })

/** Yaku ids from the first interpretation, sorted for stable assertions. */
const yakuOf = (h: Hand, c: WinContext = ctx()): string[] =>
  detectYaku(decompose(h)[0], h, c, WRC_2025).map((y) => y.id).sort()

const findYaku = (h: Hand, id: string, c: WinContext = ctx()) =>
  detectYaku(decompose(h)[0], h, c, WRC_2025).find((y) => y.id === id)

describe('riichi family', () => {
  it('detects riichi', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(yakuOf(h, ctx({ riichi: 'riichi' }))).toContain('riichi')
  })

  it('detects double riichi and suppresses plain riichi', () => {
    const h = hand('34m456p678s234s55m', '2m')
    const ids = yakuOf(h, ctx({ riichi: 'double' }))
    expect(ids).toContain('double-riichi')
    expect(ids).not.toContain('riichi')
  })

  it('scores double riichi as 2 han', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(findYaku(h, 'double-riichi', ctx({ riichi: 'double' }))?.han).toBe(2)
  })

  it('detects ippatsu only alongside riichi', () => {
    const h = hand('34m456p678s234s55m', '2m')
    expect(yakuOf(h, ctx({ riichi: 'riichi', ippatsu: true }))).toContain('ippatsu')
    expect(yakuOf(h, ctx())).not.toContain('ippatsu')
  })
})

describe('menzen tsumo', () => {
  it('applies to a closed tsumo', () => {
    expect(yakuOf(hand('34m456p678s234s55m', '2m', 'tsumo'))).toContain('menzen-tsumo')
  })

  it('does not apply to an open tsumo', () => {
    const h = hand('34m456p678s', '2m', 'tsumo', [chi('234s')])
    expect(yakuOf(h)).not.toContain('menzen-tsumo')
  })

  it('does not apply to a closed ron', () => {
    expect(yakuOf(hand('34m456p678s234s55m', '2m'))).not.toContain('menzen-tsumo')
  })
})

describe('pinfu', () => {
  it('applies to a closed all-sequence hand with a plain pair and ryanmen wait', () => {
    expect(yakuOf(hand('34m456p678s234s55m', '2m'))).toContain('pinfu')
  })

  it('does not apply when the hand contains a triplet', () => {
    expect(yakuOf(hand('111m234m456p678s55s', '5s'))).not.toContain('pinfu')
  })
})

describe('iipeikou', () => {
  it('applies to two identical sequences in a closed hand', () => {
    expect(yakuOf(hand('112233m456p78s99s', '9s'))).toContain('iipeikou')
  })

  it('does not apply to an open hand', () => {
    const h = hand('112233m456p9s', '9s', 'ron', [chi('789s')])
    expect(yakuOf(h)).not.toContain('iipeikou')
  })
})

describe('tanyao', () => {
  it('applies when every tile is between 2 and 8', () => {
    expect(yakuOf(hand('234m567p345s678s22p', '2p'))).toContain('tanyao')
  })

  it('does not apply when the hand contains a terminal', () => {
    expect(yakuOf(hand('123m567p345s678s22p', '2p'))).not.toContain('tanyao')
  })

  it('does not apply when the hand contains an honor', () => {
    expect(yakuOf(hand('234m567p345s678s11z', '1z'))).not.toContain('tanyao')
  })

  it('applies to an open hand only when the ruleset allows kuitan', () => {
    const h = hand('234m567p678s22p', '2p', 'ron', [chi('345s')])
    const interp = decompose(h)[0]
    expect(detectYaku(interp, h, ctx(), WRC_2025).map((y) => y.id)).toContain('tanyao')
    const noKuitan = { ...WRC_2025, kuitan: false }
    expect(detectYaku(interp, h, ctx(), noKuitan).map((y) => y.id)).not.toContain('tanyao')
  })
})

describe('yakuhai', () => {
  it('names the dragon it came from', () => {
    const h = hand('234m567p345s555z2z', '2z')
    const result = findYaku(h, 'yakuhai-haku')
    expect(result?.han).toBe(1)
    expect(result?.evidence.params).toEqual({ source: 'White dragon' })
  })

  it('detects a seat wind triplet', () => {
    const h = hand('234m567p345s222z5p', '5p')  // South triplet, seat wind South
    const result = findYaku(h, 'yakuhai-seat', ctx({ seatWind: 'S', roundWind: 'E' }))
    expect(result?.han).toBe(1)
    expect(result?.evidence.params).toEqual({ source: 'Seat wind (South)' })
  })

  it('detects a round wind triplet', () => {
    const h = hand('234m567p345s111z5p', '5p')  // East triplet, round wind East
    expect(findYaku(h, 'yakuhai-round', ctx({ seatWind: 'S', roundWind: 'E' }))?.han).toBe(1)
  })

  it('scores a double wind triplet as two separate yaku', () => {
    const h = hand('234m567p345s111z5p', '5p')
    const ids = yakuOf(h, ctx({ seatWind: 'E', roundWind: 'E' }))
    expect(ids).toContain('yakuhai-seat')
    expect(ids).toContain('yakuhai-round')
  })

  it('applies to an open pon', () => {
    const h = hand('234m567p345s5p', '5p', 'ron', [pon('555z')])
    expect(findYaku(h, 'yakuhai-haku')?.han).toBe(1)
  })
})

describe('situational yaku', () => {
  const closed = hand('34m456p678s234s55m', '2m', 'tsumo')
  const ronHand = hand('34m456p678s234s55m', '2m')

  it('detects haitei on a tsumo', () => {
    expect(yakuOf(closed, ctx({ haitei: true }))).toContain('haitei')
  })

  it('detects houtei on a ron', () => {
    expect(yakuOf(ronHand, ctx({ houtei: true }))).toContain('houtei')
  })

  it('detects rinshan on a tsumo', () => {
    expect(yakuOf(closed, ctx({ rinshan: true }))).toContain('rinshan')
  })

  it('detects chankan on a ron', () => {
    expect(yakuOf(ronHand, ctx({ chankan: true }))).toContain('chankan')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/yaku/oneHan.test.ts
```

Expected: FAIL — unresolved import `./detect`.

- [ ] **Step 3: Define the yaku types**

Create `src/engine/yaku/types.ts`:

```ts
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
```

- [ ] **Step 4: Write the shared helpers**

Create `src/engine/yaku/helpers.ts`:

```ts
import type { Group, Interpretation } from '../decompose'
import type { Hand, Suit, Tile, Wind } from '../types'
import { isEffectivelyOpenTriplet } from '../fu'
import { WIND_ORDER } from '../tiles'

/** The four non-pair blocks of a standard hand. */
export const blocks = (interp: Interpretation): Group[] =>
  interp.groups.filter((g) => g.kind !== 'pair' && g.kind !== 'single')

export const tripletsAndKans = (interp: Interpretation): Group[] =>
  interp.groups.filter((g) => g.kind === 'triplet' || g.kind === 'kan')

export const sequences = (interp: Interpretation): Group[] =>
  interp.groups.filter((g) => g.kind === 'sequence')

export const concealedTripletCount = (interp: Interpretation, hand: Hand): number =>
  tripletsAndKans(interp).filter((g) => !isEffectivelyOpenTriplet(g, hand)).length

export const allTilesOf = (interp: Interpretation): Tile[] =>
  interp.groups.flatMap((g) => g.tiles)

export const suitsUsed = (interp: Interpretation): Set<Suit> =>
  new Set(allTilesOf(interp).filter((t) => t.suit !== 'z').map((t) => t.suit))

export const hasHonors = (interp: Interpretation): boolean =>
  allTilesOf(interp).some((t) => t.suit === 'z')

export const windRank = (wind: Wind): number => WIND_ORDER.indexOf(wind) + 1

export const WIND_NAMES: Record<Wind, string> =
  { E: 'East', S: 'South', W: 'West', N: 'North' }

export const isDragonTile = (tile: Tile): boolean => tile.suit === 'z' && tile.rank >= 5

/** Lowest rank of a sequence, used for sanshoku and ittsu matching. */
export const sequenceStart = (group: Group): number =>
  Math.min(...group.tiles.map((t) => t.rank))
```

- [ ] **Step 5: Implement the one-han rules**

Create `src/engine/yaku/oneHan.ts`:

```ts
import type { YakuRule } from './types'
import { isPinfuShape } from '../fu'
import { isTerminalOrHonor } from '../tiles'
import {
  allTilesOf, isDragonTile, sequences, sequenceStart, tripletsAndKans,
  WIND_NAMES, windRank,
} from './helpers'

const DRAGON_NAMES: Record<number, string> =
  { 5: 'White dragon', 6: 'Green dragon', 7: 'Red dragon' }

/** One rule per dragon, so the result can name its source. */
const dragonYakuhai: YakuRule[] = [5, 6, 7].map((rank) => ({
  id: `yakuhai-${{ 5: 'haku', 6: 'hatsu', 7: 'chun' }[rank]}`,
  name: `Yakuhai — ${DRAGON_NAMES[rank]}`,
  closedHan: 1,
  openHan: 1,
  match: ({ interp }) => {
    const group = tripletsAndKans(interp)
      .find((g) => isDragonTile(g.tiles[0]) && g.tiles[0].rank === rank)
    return group
      ? { groups: [group], params: { source: DRAGON_NAMES[rank] } }
      : null
  },
}))

const windYakuhai: YakuRule[] = (['seat', 'round'] as const).map((which) => ({
  id: `yakuhai-${which}`,
  name: which === 'seat' ? 'Yakuhai — Seat wind' : 'Yakuhai — Round wind',
  closedHan: 1,
  openHan: 1,
  match: ({ interp, ctx }) => {
    const wind = which === 'seat' ? ctx.seatWind : ctx.roundWind
    const group = tripletsAndKans(interp)
      .find((g) => g.tiles[0].suit === 'z' && g.tiles[0].rank === windRank(wind))
    if (!group) return null
    const label = which === 'seat' ? 'Seat wind' : 'Round wind'
    return { groups: [group], params: { source: `${label} (${WIND_NAMES[wind]})` } }
  },
}))

export const ONE_HAN_YAKU: YakuRule[] = [
  {
    id: 'riichi', name: 'Riichi', closedHan: 1, openHan: 0,
    match: ({ ctx }) => (ctx.riichi === 'riichi' ? {} : null),
  },
  {
    id: 'double-riichi', name: 'Double riichi', closedHan: 2, openHan: 0,
    supersedes: ['riichi'],
    match: ({ ctx }) => (ctx.riichi === 'double' ? {} : null),
  },
  {
    id: 'ippatsu', name: 'Ippatsu', closedHan: 1, openHan: 0,
    match: ({ ctx }) => (ctx.ippatsu && ctx.riichi !== 'none' ? {} : null),
  },
  {
    id: 'menzen-tsumo', name: 'Menzen tsumo', closedHan: 1, openHan: 0,
    match: ({ hand, closed }) => (closed && hand.winSource === 'tsumo' ? {} : null),
  },
  {
    id: 'pinfu', name: 'Pinfu', closedHan: 1, openHan: 0,
    match: ({ interp, hand, ctx }) => (isPinfuShape(interp, hand, ctx) ? {} : null),
  },
  {
    id: 'iipeikou', name: 'Iipeikou', closedHan: 1, openHan: 0,
    match: ({ interp, closed }) => {
      if (!closed) return null
      const seen = new Map<number, number>()
      for (const seq of sequences(interp)) {
        const key = seq.tiles[0].suit.charCodeAt(0) * 100 + sequenceStart(seq)
        seen.set(key, (seen.get(key) ?? 0) + 1)
      }
      const pairKey = [...seen.entries()].find(([, count]) => count >= 2)?.[0]
      if (pairKey === undefined) return null
      const groups = sequences(interp).filter((seq) =>
        seq.tiles[0].suit.charCodeAt(0) * 100 + sequenceStart(seq) === pairKey).slice(0, 2)
      return { groups }
    },
  },
  {
    id: 'tanyao', name: 'Tanyao', closedHan: 1, openHan: 1,
    match: ({ interp, closed, rules }) => {
      if (!closed && !rules.kuitan) return null
      return allTilesOf(interp).every((t) => !isTerminalOrHonor(t)) ? {} : null
    },
  },
  ...dragonYakuhai,
  ...windYakuhai,
  {
    id: 'haitei', name: 'Haitei raoyue', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.haitei ? {} : null),
  },
  {
    id: 'houtei', name: 'Houtei raoyui', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.houtei ? {} : null),
  },
  {
    id: 'rinshan', name: 'Rinshan kaihou', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.rinshan ? {} : null),
  },
  {
    id: 'chankan', name: 'Chankan', closedHan: 1, openHan: 1,
    match: ({ ctx }) => (ctx.chankan ? {} : null),
  },
]
```

- [ ] **Step 6: Assemble the registry and implement detection**

Create `src/engine/yaku/registry.ts`:

```ts
import type { YakuRule } from './types'
import { ONE_HAN_YAKU } from './oneHan'

export const YAKU_RULES: readonly YakuRule[] = [...ONE_HAN_YAKU]
```

Create `src/engine/yaku/detect.ts`:

```ts
import type { Interpretation } from '../decompose'
import type { Hand, WinContext } from '../types'
import type { RuleSet } from '../rulesets/types'
import type { YakuContext, YakuResult } from './types'
import { isClosed } from '../hand'
import { YAKU_RULES } from './registry'

export function detectYaku(
  interp: Interpretation, hand: Hand, ctx: WinContext, rules: RuleSet,
): YakuResult[] {
  const yakuContext: YakuContext = { interp, hand, ctx, rules, closed: isClosed(hand) }

  const matched: YakuResult[] = []
  for (const rule of YAKU_RULES) {
    const han = yakuContext.closed ? rule.closedHan : rule.openHan
    if (!rule.yakuman && han === 0) continue

    const evidence = rule.match(yakuContext)
    if (!evidence) continue

    const yakuman = rule.yakuman
      ? (rules.doubleYakuman ? rule.yakuman : Math.min(rule.yakuman, 1))
      : 0
    matched.push({ id: rule.id, name: rule.name, han, yakuman, evidence })
  }

  const yakuman = matched.filter((y) => y.yakuman > 0)
  if (yakuman.length > 0) {
    if (!rules.multipleYakuman) {
      const best = yakuman.reduce((a, b) => (b.yakuman > a.yakuman ? b : a))
      return [{ ...best, yakuman: Math.min(best.yakuman, 1) }]
    }
    return applySupersession(yakuman)
  }

  return applySupersession(matched)
}

function applySupersession(results: YakuResult[]): YakuResult[] {
  const byId = new Map(YAKU_RULES.map((rule) => [rule.id, rule]))
  const absorbed = new Set(
    results.flatMap((result) => byId.get(result.id)?.supersedes ?? []))
  return results.filter((result) => !absorbed.has(result.id))
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npx vitest run src/engine/yaku/oneHan.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/yaku
git commit -m "feat: add yaku rule registry, detection, and the one-han yaku set"
```

---

## Task 9: Two-han yaku

**Files:**
- Create: `src/engine/yaku/twoHan.ts`, `src/engine/yaku/twoHan.test.ts`
- Modify: `src/engine/yaku/registry.ts`

**Interfaces:**
- Consumes: helpers from `./helpers`, `YakuRule` from `./types`.
- Produces: `TWO_HAN_YAKU: YakuRule[]` covering `chiitoitsu`, `ittsu`, `sanshoku-doujun`, `chanta`, `toitoi`, `sanshoku-doukou`, `sanankou`, `sankantsu`, `honroutou`, `shousangen`.

**Domain notes for the implementer:**

- `ittsu`, `sanshoku-doujun`, and `chanta` drop to 1 han when the hand is open. `toitoi`,
  `sanshoku-doukou`, `sanankou`, `sankantsu`, `honroutou`, and `shousangen` stay at 2.
- **`sanankou` counts triplets that are concealed *after* the ron rule** — a concealed triplet
  completed by ron does not count. Reuse `concealedTripletCount`.
- `chanta` requires at least one sequence. Without that guard it fires on every honroutou hand,
  which is not how the yaku is normally scored.
- `shousangen` is exactly two dragon triplets plus a pair of the third dragon. Three dragon
  triplets is daisangen, a yakuman, handled in Task 11.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/yaku/twoHan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectYaku } from './detect'
import { decompose, type Interpretation } from '../decompose'
import { parseTiles } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'
import type { Hand, Meld, WinContext, WinSource } from '../types'

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (
  concealed: string, winning: string,
  winSource: WinSource = 'ron', melds: Meld[] = [],
): Hand => ({
  concealed: parseTiles(concealed), melds,
  winningTile: parseTiles(winning)[0], winSource,
})

const chi = (n: string): Meld =>
  ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })
const pon = (n: string): Meld =>
  ({ kind: 'pon', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })
const kan = (kind: Meld['kind'], n: string): Meld =>
  ({ kind, tiles: parseTiles(n) })

/** True when any interpretation of the hand yields the given yaku id. */
const hasYaku = (h: Hand, id: string, c: WinContext = ctx()): boolean =>
  decompose(h).some((i: Interpretation) =>
    detectYaku(i, h, c, WRC_2025).some((y) => y.id === id))

const hanFor = (h: Hand, id: string, c: WinContext = ctx()): number | undefined => {
  for (const interp of decompose(h)) {
    const found = detectYaku(interp, h, c, WRC_2025).find((y) => y.id === id)
    if (found) return found.han
  }
  return undefined
}

describe('chiitoitsu', () => {
  it('applies to seven pairs in a closed hand', () => {
    expect(hasYaku(hand('1122m3344p5566s7z', '7z'), 'chiitoitsu')).toBe(true)
  })

  it('does not apply to a standard hand', () => {
    expect(hasYaku(hand('123m456m789m123p1s', '1s'), 'chiitoitsu')).toBe(false)
  })
})

describe('ittsu', () => {
  it('applies to 123 456 789 in one suit', () => {
    expect(hasYaku(hand('123456789m234p55s', '5s'), 'ittsu')).toBe(true)
  })

  it('does not apply when the runs span different suits', () => {
    expect(hasYaku(hand('123m456m789p234p55s', '5s'), 'ittsu')).toBe(false)
  })

  it('drops to 1 han when the hand is open', () => {
    const h = hand('456789m234p55s', '5s', 'ron', [chi('123m')])
    expect(hanFor(h, 'ittsu')).toBe(1)
  })
})

describe('sanshoku doujun', () => {
  it('applies to the same run in all three suits', () => {
    expect(hasYaku(hand('234m234p234s567m55s', '5s'), 'sanshoku-doujun')).toBe(true)
  })

  it('does not apply when one suit is missing', () => {
    expect(hasYaku(hand('234m234p567m789m55s', '5s'), 'sanshoku-doujun')).toBe(false)
  })
})

describe('sanshoku doukou', () => {
  it('applies to the same triplet in all three suits', () => {
    expect(hasYaku(hand('222m222p222s456m55s', '5s'), 'sanshoku-doukou')).toBe(true)
  })
})

describe('toitoi', () => {
  it('applies when all four blocks are triplets', () => {
    const h = hand('222m333p444s5z', '5z', 'ron', [pon('666s')])
    expect(hasYaku(h, 'toitoi')).toBe(true)
  })

  it('does not apply when the hand contains a sequence', () => {
    expect(hasYaku(hand('222m333p456s777m55s', '5s'), 'toitoi')).toBe(false)
  })
})

describe('sanankou', () => {
  it('applies to three concealed triplets', () => {
    const h = hand('222m333p444s456m5s', '5s', 'tsumo')
    expect(hasYaku(h, 'sanankou')).toBe(true)
  })

  it('does not count a triplet completed by ron as concealed', () => {
    // Ron on 2m completes the third triplet, leaving only two concealed.
    const h = hand('22m333p444s456m55s', '2m')
    expect(hasYaku(h, 'sanankou')).toBe(false)
  })

  it('does count that triplet when the same hand is won by tsumo', () => {
    const h = hand('22m333p444s456m55s', '2m', 'tsumo')
    expect(hasYaku(h, 'sanankou')).toBe(true)
  })
})

describe('sankantsu', () => {
  it('applies to exactly three kans', () => {
    const h = hand('456m55s', '5s', 'ron', [
      kan('ankan', '1111m'), kan('minkan', '2222p'), kan('ankan', '3333s'),
    ])
    expect(hasYaku(h, 'sankantsu')).toBe(true)
  })
})

describe('chanta', () => {
  it('applies when every group holds a terminal or honor and one sequence exists', () => {
    expect(hasYaku(hand('123m123p789s111z99m', '9m'), 'chanta')).toBe(true)
  })

  it('does not apply when a group is all simples', () => {
    expect(hasYaku(hand('123m456p789s111z99m', '9m'), 'chanta')).toBe(false)
  })

  it('does not apply to a hand with no sequences', () => {
    const h = hand('111m999p111z9s', '9s', 'ron', [pon('999s')])
    expect(hasYaku(h, 'chanta')).toBe(false)
  })
})

describe('honroutou', () => {
  it('applies when every tile is a terminal or honor', () => {
    const h = hand('111m999p111z9s', '9s', 'ron', [pon('999s')])
    expect(hasYaku(h, 'honroutou')).toBe(true)
  })

  it('does not apply when a simple is present', () => {
    expect(hasYaku(hand('111m999p111z234s9s', '9s'), 'honroutou')).toBe(false)
  })
})

describe('shousangen', () => {
  it('applies to two dragon triplets plus a pair of the third', () => {
    expect(hasYaku(hand('555z666z77z234m567m', '7m'), 'shousangen')).toBe(true)
  })

  it('does not apply when all three dragons are triplets', () => {
    expect(hasYaku(hand('555z666z777z234m5m', '5m'), 'shousangen')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/yaku/twoHan.test.ts
```

Expected: FAIL — unresolved import `./twoHan` once the registry references it, or assertion
failures because none of these yaku exist yet.

- [ ] **Step 3: Implement the two-han rules**

Create `src/engine/yaku/twoHan.ts`:

```ts
import type { Group } from '../decompose'
import type { YakuRule } from './types'
import type { Suit } from '../types'
import { isTerminal, isTerminalOrHonor } from '../tiles'
import {
  allTilesOf, blocks, concealedTripletCount, isDragonTile,
  sequences, sequenceStart, tripletsAndKans,
} from './helpers'

const NUMBER_SUITS: readonly Suit[] = ['m', 'p', 's']

const holdsTerminalOrHonor = (group: Group): boolean =>
  group.tiles.some(isTerminalOrHonor)

export const TWO_HAN_YAKU: YakuRule[] = [
  {
    id: 'chiitoitsu', name: 'Chiitoitsu', closedHan: 2, openHan: 0,
    match: ({ interp }) => (interp.structure === 'chiitoitsu' ? {} : null),
  },
  {
    id: 'ittsu', name: 'Ittsu', closedHan: 2, openHan: 1,
    match: ({ interp }) => {
      for (const suit of NUMBER_SUITS) {
        const inSuit = sequences(interp).filter((s) => s.tiles[0].suit === suit)
        const groups = [1, 4, 7]
          .map((start) => inSuit.find((s) => sequenceStart(s) === start))
          .filter((g): g is Group => g !== undefined)
        if (groups.length === 3) return { groups, params: { suit } }
      }
      return null
    },
  },
  {
    id: 'sanshoku-doujun', name: 'Sanshoku doujun', closedHan: 2, openHan: 1,
    match: ({ interp }) => {
      for (let start = 1; start <= 7; start++) {
        const groups = NUMBER_SUITS
          .map((suit) => sequences(interp)
            .find((s) => s.tiles[0].suit === suit && sequenceStart(s) === start))
          .filter((g): g is Group => g !== undefined)
        if (groups.length === 3) return { groups, params: { start } }
      }
      return null
    },
  },
  {
    id: 'sanshoku-doukou', name: 'Sanshoku doukou', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      for (let rank = 1; rank <= 9; rank++) {
        const groups = NUMBER_SUITS
          .map((suit) => tripletsAndKans(interp)
            .find((g) => g.tiles[0].suit === suit && g.tiles[0].rank === rank))
          .filter((g): g is Group => g !== undefined)
        if (groups.length === 3) return { groups, params: { rank } }
      }
      return null
    },
  },
  {
    id: 'toitoi', name: 'Toitoi', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      if (interp.structure !== 'standard') return null
      const sets = blocks(interp)
      return sets.length === 4 && sets.every((g) => g.kind !== 'sequence')
        ? { groups: sets }
        : null
    },
  },
  {
    id: 'sanankou', name: 'Sanankou', closedHan: 2, openHan: 2,
    match: ({ interp, hand }) =>
      (concealedTripletCount(interp, hand) >= 3 ? {} : null),
  },
  {
    id: 'sankantsu', name: 'Sankantsu', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      const kans = interp.groups.filter((g) => g.kind === 'kan')
      return kans.length === 3 ? { groups: kans } : null
    },
  },
  {
    id: 'chanta', name: 'Chanta', closedHan: 2, openHan: 1,
    match: ({ interp }) => {
      if (interp.structure !== 'standard') return null
      if (sequences(interp).length === 0) return null
      if (!interp.groups.every(holdsTerminalOrHonor)) return null
      // Distinguish from junchan: chanta requires at least one honor.
      return allTilesOf(interp).some((t) => t.suit === 'z') ? {} : null
    },
  },
  {
    id: 'honroutou', name: 'Honroutou', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      const tiles = allTilesOf(interp)
      if (!tiles.every(isTerminalOrHonor)) return null
      // All-terminal hands are chinroutou, a yakuman handled elsewhere.
      return tiles.some((t) => t.suit === 'z') && tiles.some(isTerminal) ? {} : null
    },
  },
  {
    id: 'shousangen', name: 'Shousangen', closedHan: 2, openHan: 2,
    match: ({ interp }) => {
      const dragonSets = tripletsAndKans(interp).filter((g) => isDragonTile(g.tiles[0]))
      const pair = interp.groups.find((g) => g.kind === 'pair')
      if (dragonSets.length !== 2) return null
      if (!pair || !isDragonTile(pair.tiles[0])) return null
      return { groups: [...dragonSets, pair] }
    },
  },
]
```

- [ ] **Step 4: Register the new rules**

Replace `src/engine/yaku/registry.ts` with:

```ts
import type { YakuRule } from './types'
import { ONE_HAN_YAKU } from './oneHan'
import { TWO_HAN_YAKU } from './twoHan'

export const YAKU_RULES: readonly YakuRule[] = [...ONE_HAN_YAKU, ...TWO_HAN_YAKU]
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/engine/yaku
```

Expected: PASS, including the Task 8 suite.

- [ ] **Step 6: Commit**

```bash
git add src/engine/yaku
git commit -m "feat: add the two-han yaku set"
```

---

## Task 10: Three-han and six-han yaku

**Files:**
- Create: `src/engine/yaku/threeHan.ts`, `src/engine/yaku/threeHan.test.ts`
- Modify: `src/engine/yaku/registry.ts`

**Interfaces:**
- Produces: `THREE_HAN_YAKU: YakuRule[]` covering `honitsu` (3/2), `junchan` (3/2), `ryanpeikou` (3/closed only), `chinitsu` (6/5).

**Domain notes for the implementer:**

- `chinitsu` supersedes `honitsu`; `junchan` supersedes `chanta`; `ryanpeikou` supersedes
  `iipeikou`. Set `supersedes` rather than adding negative conditions to the lower rules.
- `ryanpeikou` is two *separate* iipeikou: four sequences forming two identical pairs. Four
  copies of the same sequence also qualifies.
- `honitsu` requires at least one honor; without one it is chinitsu.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/yaku/threeHan.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectYaku } from './detect'
import { decompose } from '../decompose'
import { parseTiles } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'
import type { Hand, Meld, WinContext, WinSource } from '../types'

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (
  concealed: string, winning: string,
  winSource: WinSource = 'ron', melds: Meld[] = [],
): Hand => ({
  concealed: parseTiles(concealed), melds,
  winningTile: parseTiles(winning)[0], winSource,
})

const chi = (n: string): Meld =>
  ({ kind: 'chi', tiles: parseTiles(n), calledTile: parseTiles(n)[0] })

const idsFor = (h: Hand, c: WinContext = ctx()): string[][] =>
  decompose(h).map((i) => detectYaku(i, h, c, WRC_2025).map((y) => y.id))

const hasYaku = (h: Hand, id: string, c: WinContext = ctx()): boolean =>
  idsFor(h, c).some((ids) => ids.includes(id))

const hanFor = (h: Hand, id: string, c: WinContext = ctx()): number | undefined => {
  for (const interp of decompose(h)) {
    const found = detectYaku(interp, h, c, WRC_2025).find((y) => y.id === id)
    if (found) return found.han
  }
  return undefined
}

describe('honitsu', () => {
  it('applies to one suit plus honors', () => {
    expect(hasYaku(hand('123456789m111z99m', '9m'), 'honitsu')).toBe(true)
  })

  it('drops to 2 han when open', () => {
    const h = hand('456789m111z99m', '9m', 'ron', [chi('123m')])
    expect(hanFor(h, 'honitsu')).toBe(2)
  })

  it('does not apply to a hand with two suits', () => {
    expect(hasYaku(hand('123456m789p111z99m', '9m'), 'honitsu')).toBe(false)
  })
})

describe('chinitsu', () => {
  // 111m 234m 567m 888m 99m
  it('applies to a single suit with no honors and scores 6 han closed', () => {
    const h = hand('111234567888m9m', '9m')
    expect(hanFor(h, 'chinitsu')).toBe(6)
  })

  it('suppresses honitsu', () => {
    const h = hand('111234567888m9m', '9m')
    expect(hasYaku(h, 'honitsu')).toBe(false)
  })

  it('drops to 5 han when open', () => {
    const h = hand('111567888m9m', '9m', 'ron', [chi('234m')])
    expect(hanFor(h, 'chinitsu')).toBe(5)
  })
})

describe('junchan', () => {
  it('applies when every group holds a terminal and no honors are present', () => {
    expect(hasYaku(hand('123m123p789s789m99p', '9p'), 'junchan')).toBe(true)
  })

  it('suppresses chanta', () => {
    const h = hand('123m123p789s789m99p', '9p')
    expect(hasYaku(h, 'chanta')).toBe(false)
  })

  it('does not apply when an honor is present', () => {
    expect(hasYaku(hand('123m123p789s111z99m', '9m'), 'junchan')).toBe(false)
  })
})

describe('ryanpeikou', () => {
  it('applies to two pairs of identical sequences in a closed hand', () => {
    const h = hand('112233445566m7p', '7p')
    expect(hasYaku(h, 'ryanpeikou')).toBe(true)
  })

  it('suppresses iipeikou', () => {
    const h = hand('112233445566m7p', '7p')
    for (const ids of idsFor(h)) {
      if (ids.includes('ryanpeikou')) expect(ids).not.toContain('iipeikou')
    }
  })

  it('does not apply to a single iipeikou', () => {
    expect(hasYaku(hand('112233m456p78s99s', '9s'), 'ryanpeikou')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/yaku/threeHan.test.ts
```

Expected: FAIL — unresolved import `./threeHan`.

- [ ] **Step 3: Implement the rules**

Create `src/engine/yaku/threeHan.ts`:

```ts
import type { YakuRule } from './types'
import { isTerminal } from '../tiles'
import { hasHonors, sequences, sequenceStart, suitsUsed } from './helpers'

export const THREE_HAN_YAKU: YakuRule[] = [
  {
    id: 'honitsu', name: 'Honitsu', closedHan: 3, openHan: 2,
    match: ({ interp }) =>
      (suitsUsed(interp).size <= 1 && hasHonors(interp) ? {} : null),
  },
  {
    id: 'chinitsu', name: 'Chinitsu', closedHan: 6, openHan: 5,
    supersedes: ['honitsu'],
    match: ({ interp }) =>
      (suitsUsed(interp).size === 1 && !hasHonors(interp) ? {} : null),
  },
  {
    id: 'junchan', name: 'Junchan', closedHan: 3, openHan: 2,
    supersedes: ['chanta'],
    match: ({ interp }) => {
      if (interp.structure !== 'standard') return null
      if (sequences(interp).length === 0) return null
      if (hasHonors(interp)) return null
      return interp.groups.every((g) => g.tiles.some(isTerminal)) ? {} : null
    },
  },
  {
    id: 'ryanpeikou', name: 'Ryanpeikou', closedHan: 3, openHan: 0,
    supersedes: ['iipeikou'],
    match: ({ interp, closed }) => {
      if (!closed || interp.structure !== 'standard') return null
      const seqs = sequences(interp)
      if (seqs.length !== 4) return null
      const counts = new Map<string, number>()
      for (const seq of seqs) {
        const key = `${seq.tiles[0].suit}${sequenceStart(seq)}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      const pairsOfSequences = [...counts.values()]
        .reduce((sum, count) => sum + Math.floor(count / 2), 0)
      return pairsOfSequences === 2 ? { groups: seqs } : null
    },
  },
]
```

- [ ] **Step 4: Register the rules**

Update `src/engine/yaku/registry.ts`:

```ts
import type { YakuRule } from './types'
import { ONE_HAN_YAKU } from './oneHan'
import { TWO_HAN_YAKU } from './twoHan'
import { THREE_HAN_YAKU } from './threeHan'

export const YAKU_RULES: readonly YakuRule[] = [
  ...ONE_HAN_YAKU, ...TWO_HAN_YAKU, ...THREE_HAN_YAKU,
]
```

- [ ] **Step 5: Run the whole yaku suite**

```bash
npx vitest run src/engine/yaku
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/yaku
git commit -m "feat: add honitsu, chinitsu, junchan, and ryanpeikou"
```

---

## Task 11: Yakuman

**Files:**
- Create: `src/engine/yaku/yakuman.ts`, `src/engine/yaku/yakuman.test.ts`
- Modify: `src/engine/yaku/registry.ts`

**Interfaces:**
- Produces: `YAKUMAN_YAKU: YakuRule[]` covering `kokushi`, `kokushi-13`, `suuankou`, `suuankou-tanki`, `daisangen`, `shousuushii`, `daisuushii`, `tsuuiisou`, `chinroutou`, `ryuuiisou`, `chuuren`, `chuuren-9`, `suukantsu`, `tenhou`, `chiihou`.

**Domain notes for the implementer:**

- Yakuman rules carry `closedHan: 0, openHan: 0` and a `yakuman` multiplier. `detectYaku`
  already special-cases them so a 0-han rule is not skipped.
- The double-yakuman variants (`kokushi-13`, `suuankou-tanki`, `daisuushii`, `chuuren-9`) each
  supersede their single-yakuman form. `rules.doubleYakuman === false` clamps them to 1 in
  `detectYaku`; the `supersedes` relationship still applies so the hand is not counted twice.
- **Chuuren's nine-sided wait** is exactly the case where removing the winning tile leaves the
  pure 1112345678999 pattern.
- **Ryuuiisou** allows only 2s, 3s, 4s, 6s, 8s and the green dragon.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/yaku/yakuman.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { detectYaku } from './detect'
import { decompose } from '../decompose'
import { parseTiles } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'
import type { Hand, Meld, WinContext, WinSource } from '../types'

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (
  concealed: string, winning: string,
  winSource: WinSource = 'ron', melds: Meld[] = [],
): Hand => ({
  concealed: parseTiles(concealed), melds,
  winningTile: parseTiles(winning)[0], winSource,
})

const ankan = (n: string): Meld => ({ kind: 'ankan', tiles: parseTiles(n) })

const best = (h: Hand, c: WinContext = ctx(), rules = WRC_2025) => {
  for (const interp of decompose(h)) {
    const yaku = detectYaku(interp, h, c, rules)
    if (yaku.some((y) => y.yakuman > 0)) return yaku
  }
  return decompose(h).length > 0 ? detectYaku(decompose(h)[0], h, c, rules) : []
}

const ids = (h: Hand, c?: WinContext, rules = WRC_2025): string[] =>
  best(h, c, rules).map((y) => y.id)

describe('kokushi musou', () => {
  it('detects the ordinary form', () => {
    // Pair is 1m and the winning tile is the missing 7z, so this is not a 13-wait.
    const h = hand('119m19p19s123456z', '7z')
    expect(ids(h)).toContain('kokushi')
  })

  it('detects the thirteen-wait form and suppresses the ordinary one', () => {
    const h = hand('19m19p19s1234567z', '1m')
    const result = ids(h)
    expect(result).toContain('kokushi-13')
    expect(result).not.toContain('kokushi')
  })

  it('clamps the thirteen-wait to a single yakuman when the ruleset forbids doubles', () => {
    const h = hand('19m19p19s1234567z', '1m')
    const single = best(h, ctx(), { ...WRC_2025, doubleYakuman: false })
    expect(single.find((y) => y.id === 'kokushi-13')?.yakuman).toBe(1)
  })
})

describe('suuankou', () => {
  it('detects four concealed triplets completed by a shanpon tsumo', () => {
    // Tsumo on 4s completes the fourth triplet; the wait is shanpon, not tanki.
    const h = hand('111m222m333p44s55s', '4s', 'tsumo')
    expect(ids(h)).toContain('suuankou')
  })

  it('detects the tanki form and suppresses the ordinary one', () => {
    // The winning 5s completes the pair, so the wait is tanki.
    const h = hand('111m222m333p444s5s', '5s')
    const result = ids(h)
    expect(result).toContain('suuankou-tanki')
    expect(result).not.toContain('suuankou')
  })
})

describe('honour yakuman', () => {
  it('detects daisangen', () => {
    expect(ids(hand('555z666z777z234m5m', '5m'))).toContain('daisangen')
  })

  it('detects shousuushii', () => {
    expect(ids(hand('111z222z333z44z34m', '2m'))).toContain('shousuushii')
  })

  it('detects daisuushii and suppresses shousuushii', () => {
    const h = hand('111z222z333z444z5m', '5m')
    const result = ids(h)
    expect(result).toContain('daisuushii')
    expect(result).not.toContain('shousuushii')
  })

  it('detects tsuuiisou', () => {
    // Two winds and two dragons, so this is tsuuiisou without also being daisuushii.
    expect(ids(hand('111z222z555z666z7z', '7z'))).toContain('tsuuiisou')
  })
})

describe('tile-restriction yakuman', () => {
  it('detects chinroutou', () => {
    const h = hand('111m999m111p999p9s', '9s')
    expect(ids(h)).toContain('chinroutou')
  })

  it('detects ryuuiisou', () => {
    expect(ids(hand('234s234s666s888s6z', '6z'))).toContain('ryuuiisou')
  })

  it('rejects ryuuiisou when a non-green tile is present', () => {
    // White dragon is not a green tile.
    expect(ids(hand('234s234s666s888s5z', '5z'))).not.toContain('ryuuiisou')
  })
})

describe('chuuren poutou', () => {
  it('detects the ordinary form', () => {
    // The duplicate 5m was already held, so winning on 2m is not a nine-sided wait.
    expect(ids(hand('1113455678999m', '2m'))).toContain('chuuren')
  })

  it('detects the nine-sided wait and suppresses the ordinary form', () => {
    // The thirteen tiles held are exactly 1112345678999m, so any tile wins.
    const h = hand('1112345678999m', '5m')
    const result = ids(h)
    expect(result).toContain('chuuren-9')
    expect(result).not.toContain('chuuren')
  })
})

describe('kan and situational yakuman', () => {
  it('detects suukantsu', () => {
    // Four kans fill all four group slots, leaving one concealed tile plus the win.
    const h = hand('5m', '5m', 'ron', [
      ankan('1111m'), ankan('2222p'), ankan('3333s'),
      { kind: 'minkan', tiles: parseTiles('4444z') },
    ])
    expect(ids(h)).toContain('suukantsu')
  })

  it('detects tenhou', () => {
    const h = hand('123m456m789m123p1s', '1s', 'tsumo')
    expect(ids(h, ctx({ seatWind: 'E', tenhou: true }))).toContain('tenhou')
  })

  it('detects chiihou', () => {
    const h = hand('123m456m789m123p1s', '1s', 'tsumo')
    expect(ids(h, ctx({ seatWind: 'S', chiihou: true }))).toContain('chiihou')
  })
})

describe('yakuman precedence', () => {
  it('returns only yakuman when one is present', () => {
    const h = hand('111z222z333z444z5z', '5z')
    expect(best(h).every((y) => y.yakuman > 0)).toBe(true)
  })

  it('caps the hand at one yakuman when the ruleset forbids stacking', () => {
    const h = hand('111z222z333z444z5z', '5z')  // daisuushii + tsuuiisou
    const single = best(h, ctx(), { ...WRC_2025, multipleYakuman: false })
    expect(single).toHaveLength(1)
    expect(single[0].yakuman).toBe(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/yaku/yakuman.test.ts
```

Expected: FAIL — unresolved import `./yakuman`.

- [ ] **Step 3: Implement the yakuman rules**

Create `src/engine/yaku/yakuman.ts`:

```ts
import type { YakuRule } from './types'
import type { Tile } from '../types'
import { classifyWait } from '../fu'
import { isTerminal } from '../tiles'
import {
  allTilesOf, concealedTripletCount, hasHonors, isDragonTile,
  suitsUsed, tripletsAndKans,
} from './helpers'

const CHUUREN_PATTERN = [3, 1, 1, 1, 1, 1, 1, 1, 3]

const isGreenTile = (tile: Tile): boolean =>
  (tile.suit === 's' && [2, 3, 4, 6, 8].includes(tile.rank)) ||
  (tile.suit === 'z' && tile.rank === 6)

/** Rank counts 1-9 for a single-suit hand. */
function rankCounts(tiles: Tile[]): number[] {
  const counts = new Array<number>(9).fill(0)
  for (const tile of tiles) counts[tile.rank - 1] += 1
  return counts
}

function isChuurenShape(tiles: Tile[]): boolean {
  if (tiles.length !== 14) return false
  const counts = rankCounts(tiles)
  return counts.every((count, i) => count >= CHUUREN_PATTERN[i])
}

export const YAKUMAN_YAKU: YakuRule[] = [
  {
    id: 'kokushi', name: 'Kokushi musou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => (interp.structure === 'kokushi' ? {} : null),
  },
  {
    id: 'kokushi-13', name: 'Kokushi musou juusan menmachi',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['kokushi'],
    match: ({ interp }) =>
      (interp.structure === 'kokushi' &&
        interp.groups.some((g) => g.kind === 'pair' && g.containsWinningTile)
        ? {} : null),
  },
  {
    id: 'suuankou', name: 'Suuankou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp, hand }) =>
      (interp.structure === 'standard' && concealedTripletCount(interp, hand) === 4
        ? {} : null),
  },
  {
    id: 'suuankou-tanki', name: 'Suuankou tanki',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['suuankou'],
    match: ({ interp, hand }) =>
      (interp.structure === 'standard' &&
        concealedTripletCount(interp, hand) === 4 &&
        classifyWait(interp, hand) === 'tanki'
        ? {} : null),
  },
  {
    id: 'daisangen', name: 'Daisangen', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => {
      const dragons = tripletsAndKans(interp).filter((g) => isDragonTile(g.tiles[0]))
      return dragons.length === 3 ? { groups: dragons } : null
    },
  },
  {
    id: 'shousuushii', name: 'Shousuushii', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => {
      const winds = tripletsAndKans(interp)
        .filter((g) => g.tiles[0].suit === 'z' && g.tiles[0].rank <= 4)
      const pair = interp.groups.find((g) => g.kind === 'pair')
      if (winds.length !== 3) return null
      if (!pair || pair.tiles[0].suit !== 'z' || pair.tiles[0].rank > 4) return null
      return { groups: [...winds, pair] }
    },
  },
  {
    id: 'daisuushii', name: 'Daisuushii',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['shousuushii'],
    match: ({ interp }) => {
      const winds = tripletsAndKans(interp)
        .filter((g) => g.tiles[0].suit === 'z' && g.tiles[0].rank <= 4)
      return winds.length === 4 ? { groups: winds } : null
    },
  },
  {
    id: 'tsuuiisou', name: 'Tsuuiisou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) =>
      (allTilesOf(interp).every((t) => t.suit === 'z') ? {} : null),
  },
  {
    id: 'chinroutou', name: 'Chinroutou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) =>
      (allTilesOf(interp).every(isTerminal) ? {} : null),
  },
  {
    id: 'ryuuiisou', name: 'Ryuuiisou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) =>
      (allTilesOf(interp).every(isGreenTile) ? {} : null),
  },
  {
    id: 'chuuren', name: 'Chuuren poutou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp, closed }) => {
      if (!closed || hasHonors(interp) || suitsUsed(interp).size !== 1) return null
      return isChuurenShape(allTilesOf(interp)) ? {} : null
    },
  },
  {
    id: 'chuuren-9', name: 'Junsei chuuren poutou',
    closedHan: 0, openHan: 0, yakuman: 2, supersedes: ['chuuren'],
    match: ({ interp, hand, closed }) => {
      if (!closed || hasHonors(interp) || suitsUsed(interp).size !== 1) return null
      const tiles = allTilesOf(interp)
      if (!isChuurenShape(tiles)) return null
      // A nine-sided wait means the thirteen tiles held were exactly the pure pattern.
      const counts = rankCounts(tiles)
      counts[hand.winningTile.rank - 1] -= 1
      return counts.every((count, i) => count === CHUUREN_PATTERN[i]) ? {} : null
    },
  },
  {
    id: 'suukantsu', name: 'Suukantsu', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ interp }) => {
      const kans = interp.groups.filter((g) => g.kind === 'kan')
      return kans.length === 4 ? { groups: kans } : null
    },
  },
  {
    id: 'tenhou', name: 'Tenhou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ ctx }) => (ctx.tenhou ? {} : null),
  },
  {
    id: 'chiihou', name: 'Chiihou', closedHan: 0, openHan: 0, yakuman: 1,
    match: ({ ctx }) => (ctx.chiihou ? {} : null),
  },
]
```

- [ ] **Step 4: Register the rules**

Update `src/engine/yaku/registry.ts` to append `...YAKUMAN_YAKU` after `...THREE_HAN_YAKU`,
importing `YAKUMAN_YAKU` from `./yakuman`.

- [ ] **Step 5: Run the whole yaku suite**

```bash
npx vitest run src/engine/yaku
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/yaku
git commit -m "feat: add the yakuman set with double-yakuman variants and precedence"
```

---

## Task 12: Dora counting

**Files:**
- Create: `src/engine/dora.ts`, `src/engine/dora.test.ts`

**Interfaces:**
- Consumes: `Hand`, `WinContext`, `Tile`; `allTiles` from `./hand`; `tileId`, `tileFromId` from `./tiles`.
- Produces:
  - `nextTile(indicator: Tile): Tile`
  - `interface DoraDetail { indicator: Tile; doraTile: Tile; count: number }`
  - `interface DoraResult { dora: number; aka: number; ura: number; total: number; details: DoraDetail[]; uraDetails: DoraDetail[] }`
  - `countDora(hand: Hand, ctx: WinContext, rules: RuleSet): DoraResult`

**Domain notes:** the indicator points at the dora, so 1→2 … 8→9→1; winds cycle
E→S→W→N→E; dragons cycle White→Green→Red→White. Ura-dora count **only** when riichi was
declared. Aka dora count only when `rules.akaDoraCount > 0`.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/dora.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { countDora, nextTile } from './dora'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, WinContext } from './types'

const tile = (n: string) => parseTiles(n)[0]

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (concealed: string, winning: string): Hand => ({
  concealed: parseTiles(concealed), melds: [],
  winningTile: tile(winning), winSource: 'ron',
})

describe('nextTile', () => {
  it('advances within a numbered suit', () => {
    expect(nextTile(tile('1m'))).toEqual(tile('2m'))
  })

  it('wraps 9 back to 1', () => {
    expect(nextTile(tile('9p'))).toEqual(tile('1p'))
  })

  it('cycles the winds', () => {
    expect(nextTile(tile('1z'))).toEqual(tile('2z'))  // East → South
    expect(nextTile(tile('4z'))).toEqual(tile('1z'))  // North → East
  })

  it('cycles the dragons without leaking into the winds', () => {
    expect(nextTile(tile('5z'))).toEqual(tile('6z'))  // White → Green
    expect(nextTile(tile('7z'))).toEqual(tile('5z'))  // Red → White
  })

  it('never returns a red five', () => {
    expect(nextTile(tile('4p')).red).toBe(false)
  })
})

describe('countDora', () => {
  const h = hand('234m567p345s678s22p', '2p')

  it('counts every copy of the indicated tile', () => {
    const result = countDora(h, ctx({ doraIndicators: parseTiles('1p') }), WRC_2025)
    expect(result.dora).toBe(2)  // the 2p pair
    expect(result.details).toEqual([
      { indicator: tile('1p'), doraTile: tile('2p'), count: 2 },
    ])
  })

  it('sums multiple indicators', () => {
    const result = countDora(h, ctx({ doraIndicators: parseTiles('1p2m') }), WRC_2025)
    expect(result.dora).toBe(3)  // 2p ×2 plus 3m ×1
  })

  it('ignores ura indicators without riichi', () => {
    const result = countDora(h, ctx({ uraIndicators: parseTiles('1p') }), WRC_2025)
    expect(result.ura).toBe(0)
  })

  it('counts ura indicators when riichi was declared', () => {
    const result = countDora(
      h, ctx({ riichi: 'riichi', uraIndicators: parseTiles('1p') }), WRC_2025)
    expect(result.ura).toBe(2)
  })

  it('counts red fives only when the ruleset uses them', () => {
    const red = hand('234m067p345s678s2p', '2p')  // 0p is the red five
    expect(countDora(red, ctx(), { ...WRC_2025, akaDoraCount: 3 }).aka).toBe(1)
    expect(countDora(red, ctx(), { ...WRC_2025, akaDoraCount: 0 }).aka).toBe(0)
  })

  it('totals dora, aka, and ura together', () => {
    const result = countDora(
      h, ctx({ riichi: 'riichi', doraIndicators: parseTiles('1p'),
        uraIndicators: parseTiles('1m') }), WRC_2025)
    expect(result.total).toBe(result.dora + result.aka + result.ura)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/dora.test.ts
```

Expected: FAIL — unresolved import `./dora`.

- [ ] **Step 3: Implement dora counting**

Create `src/engine/dora.ts`:

```ts
import type { Hand, Tile, WinContext } from './types'
import type { RuleSet } from './rulesets/types'
import { allTiles } from './hand'
import { tileId } from './tiles'

export interface DoraDetail {
  indicator: Tile
  doraTile: Tile
  count: number
}

export interface DoraResult {
  dora: number
  aka: number
  ura: number
  total: number
  details: DoraDetail[]
  uraDetails: DoraDetail[]
}

/** The indicator points at the dora: 1→2 … 9→1, E→S→W→N→E, White→Green→Red→White. */
export function nextTile(indicator: Tile): Tile {
  const { suit, rank } = indicator
  if (suit !== 'z') return { suit, rank: rank === 9 ? 1 : rank + 1, red: false }
  if (rank <= 4) return { suit, rank: rank === 4 ? 1 : rank + 1, red: false }
  return { suit, rank: rank === 7 ? 5 : rank + 1, red: false }
}

function countIndicators(indicators: Tile[], tiles: Tile[]): DoraDetail[] {
  return indicators.map((indicator) => {
    const doraTile = nextTile(indicator)
    const target = tileId(doraTile)
    return {
      indicator,
      doraTile,
      count: tiles.filter((t) => tileId(t) === target).length,
    }
  })
}

const sum = (details: DoraDetail[]): number =>
  details.reduce((total, detail) => total + detail.count, 0)

export function countDora(hand: Hand, ctx: WinContext, rules: RuleSet): DoraResult {
  const tiles = allTiles(hand)

  const details = countIndicators(ctx.doraIndicators, tiles)
  const uraDetails = ctx.riichi !== 'none'
    ? countIndicators(ctx.uraIndicators, tiles)
    : []

  const dora = sum(details)
  const ura = sum(uraDetails)
  const aka = rules.akaDoraCount > 0 ? tiles.filter((t) => t.red).length : 0

  return { dora, aka, ura, total: dora + aka + ura, details, uraDetails }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/engine/dora.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/dora.ts src/engine/dora.test.ts
git commit -m "feat: count dora, aka dora, and ura dora from indicators"
```

---

## Task 13: Interpretation selection and the `calculate` entry point

**Files:**
- Create: `src/engine/select.ts`, `src/engine/calculate.ts`, `src/engine/calculate.test.ts`
- Modify: `src/engine/index.ts`

**Interfaces:**
- Consumes: everything built so far.
- Produces:
  - `interface Candidate { interp; yaku: YakuResult[]; fu: FuResult; han: number; yakumanMultiplier: number; score: ScoreResult }`
  - `selectBest(candidates: Candidate[]): { best: Candidate | null; alternatives: Candidate[] }`
  - `type CalculationStatus = 'scored' | 'invalid' | 'not-a-winning-hand' | 'no-yaku'`
  - `interface CalculationResult { status; validation: ValidationResult; dora: DoraResult; best: Candidate | null; alternatives: Candidate[] }`
  - `calculate(hand: Hand, ctx: WinContext, rules: RuleSet): CalculationResult`

**Domain notes:**

- Han = the sum of yaku han **plus** dora total. Dora do **not** apply to a yakuman hand.
- **Dora never satisfy the yaku requirement.** A complete hand whose only value is dora returns
  status `'no-yaku'` with `best: null`. This is PLD §13's most important beginner case, and the
  engine must never manufacture a yaku to avoid it.
- Ranking is by final `score.total`, tie-broken by han, then by fu. Losing interpretations are
  returned as `alternatives` for the UI's "Other interpretations" panel.

- [ ] **Step 1: Write the failing tests**

Create `src/engine/calculate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calculate } from './calculate'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, WinContext, WinSource } from './types'

const ctx = (o: Partial<WinContext> = {}): WinContext => ({
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0, ...o,
})

const hand = (concealed: string, winning: string, winSource: WinSource = 'ron'): Hand => ({
  concealed: parseTiles(concealed), melds: [],
  winningTile: parseTiles(winning)[0], winSource,
})

describe('calculate — happy path', () => {
  it('scores riichi + pinfu + tanyao as 3 han 30 fu, 3900', () => {
    const result = calculate(
      hand('34m55m567p345s678s', '2m'), ctx({ riichi: 'riichi' }), WRC_2025)
    expect(result.status).toBe('scored')
    expect(result.best!.yaku.map((y) => y.id).sort())
      .toEqual(['pinfu', 'riichi', 'tanyao'])
    expect(result.best!.han).toBe(3)
    expect(result.best!.fu.total).toBe(30)
    expect(result.best!.score.handTotal).toBe(3900)
  })

  it('adds dora to the han count', () => {
    const result = calculate(
      hand('34m55m567p345s678s', '2m'),
      ctx({ riichi: 'riichi', doraIndicators: parseTiles('4m') }),  // dora is 5m, held ×2
      WRC_2025)
    expect(result.dora.dora).toBe(2)
    expect(result.best!.han).toBe(5)
  })
})

describe('calculate — validation and yaku requirement', () => {
  it('reports an invalid hand without scoring it', () => {
    const result = calculate(hand('34m55m567p345s67s', '2m'), ctx(), WRC_2025)
    expect(result.status).toBe('invalid')
    expect(result.best).toBeNull()
  })

  it('reports a hand that is not a winning shape', () => {
    // 13 tiles plus the win, but 78s never completes and there is no pair.
    const result = calculate(hand('135m55m567p345s78s', '2m'), ctx(), WRC_2025)
    expect(result.status).toBe('not-a-winning-hand')
  })

  it('reports a complete hand with no yaku', () => {
    // 234m 567m 234p 678s + East pair. Closed ron, no riichi. The East pair is the
    // round wind, which blocks pinfu; the honors block tanyao; nothing else fires.
    const result = calculate(hand('23m567m234p678s11z', '4m'), ctx(), WRC_2025)
    expect(result.status).toBe('no-yaku')
    expect(result.best).toBeNull()
  })

  it('does not let dora alone satisfy the yaku requirement', () => {
    const result = calculate(
      hand('23m567m234p678s11z', '4m'),
      ctx({ doraIndicators: parseTiles('1m') }),  // dora is 2m, held once
      WRC_2025)
    expect(result.dora.dora).toBe(1)
    expect(result.status).toBe('no-yaku')
    expect(result.best).toBeNull()
  })
})

describe('calculate — interpretation selection', () => {
  it('picks the highest-scoring reading and keeps the others', () => {
    // 112233445566m + 77p reads as both ryanpeikou (3 han) and chiitoitsu (2 han).
    const result = calculate(hand('112233445566m7p', '7p'), ctx(), WRC_2025)
    expect(result.status).toBe('scored')
    expect(result.best!.yaku.map((y) => y.id)).toContain('ryanpeikou')
    expect(result.alternatives.length).toBeGreaterThan(0)
    for (const alt of result.alternatives) {
      expect(alt.score.handTotal).toBeLessThanOrEqual(result.best!.score.handTotal)
    }
  })

  it('never returns an alternative that outscores the best', () => {
    const result = calculate(hand('111222333m456p9s', '9s'),
      ctx({ riichi: 'riichi' }), WRC_2025)
    const totals = result.alternatives.map((a) => a.score.handTotal)
    expect(Math.max(0, ...totals)).toBeLessThanOrEqual(result.best!.score.handTotal)
  })
})

describe('calculate — yakuman', () => {
  it('scores daisangen as a yakuman and ignores dora', () => {
    const result = calculate(
      hand('555z666z777z234m5m', '5m'),
      ctx({ doraIndicators: parseTiles('1m') }),  // dora is 2m, held once
      WRC_2025)
    expect(result.best!.yakumanMultiplier).toBe(1)
    expect(result.best!.score.handTotal).toBe(32000)
  })
})

describe('calculate — honba and sticks', () => {
  it('adds table payments to the total', () => {
    const result = calculate(
      hand('34m55m567p345s678s', '2m'),
      ctx({ riichi: 'riichi', honba: 2, riichiSticks: 1 }), WRC_2025)
    expect(result.best!.score.handTotal).toBe(3900)
    expect(result.best!.score.total).toBe(3900 + 600 + 1000)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/engine/calculate.test.ts
```

Expected: FAIL — unresolved import `./calculate`.

- [ ] **Step 3: Implement selection**

Create `src/engine/select.ts`:

```ts
import type { Interpretation } from './decompose'
import type { FuResult } from './fu'
import type { ScoreResult } from './score'
import type { YakuResult } from './yaku/types'

export interface Candidate {
  interp: Interpretation
  yaku: YakuResult[]
  fu: FuResult
  han: number
  yakumanMultiplier: number
  score: ScoreResult
}

/** Highest final payment wins; ties break on han, then fu. */
function rank(a: Candidate, b: Candidate): number {
  if (a.score.handTotal !== b.score.handTotal) return b.score.handTotal - a.score.handTotal
  if (a.han !== b.han) return b.han - a.han
  return b.fu.total - a.fu.total
}

export function selectBest(
  candidates: Candidate[],
): { best: Candidate | null; alternatives: Candidate[] } {
  if (candidates.length === 0) return { best: null, alternatives: [] }
  const [best, ...alternatives] = [...candidates].sort(rank)
  return { best, alternatives }
}
```

- [ ] **Step 4: Implement the entry point**

Create `src/engine/calculate.ts`:

```ts
import type { Hand, WinContext } from './types'
import type { RuleSet } from './rulesets/types'
import type { DoraResult } from './dora'
import type { ValidationResult } from './validate'
import { countDora } from './dora'
import { computeFu } from './fu'
import { decompose } from './decompose'
import { detectYaku } from './yaku/detect'
import { isDealer } from './hand'
import { score } from './score'
import { selectBest, type Candidate } from './select'
import { validate } from './validate'

export type CalculationStatus = 'scored' | 'invalid' | 'not-a-winning-hand' | 'no-yaku'

export interface CalculationResult {
  status: CalculationStatus
  validation: ValidationResult
  dora: DoraResult
  best: Candidate | null
  alternatives: Candidate[]
}

export function calculate(
  hand: Hand, ctx: WinContext, rules: RuleSet,
): CalculationResult {
  const validation = validate(hand, ctx)
  const dora = countDora(hand, ctx, rules)
  const empty = { validation, dora, best: null, alternatives: [] }

  if (!validation.ok) return { ...empty, status: 'invalid' }

  const interpretations = decompose(hand)
  if (interpretations.length === 0) return { ...empty, status: 'not-a-winning-hand' }

  const candidates: Candidate[] = []
  for (const interp of interpretations) {
    const yaku = detectYaku(interp, hand, ctx, rules)
    // Dora add han but are never a yaku. A hand with no yaku cannot be won.
    if (yaku.length === 0) continue

    const fu = computeFu(interp, hand, ctx, rules)
    const yakumanMultiplier = yaku.reduce((sum, y) => sum + y.yakuman, 0)
    const yakuHan = yaku.reduce((sum, y) => sum + y.han, 0)
    const han = yakumanMultiplier > 0 ? yakuHan : yakuHan + dora.total

    candidates.push({
      interp, yaku, fu, han, yakumanMultiplier,
      score: score({
        han,
        fu: fu.total,
        yakumanMultiplier,
        isDealer: isDealer(ctx),
        winSource: hand.winSource,
        honba: ctx.honba,
        riichiSticks: ctx.riichiSticks,
      }, rules),
    })
  }

  if (candidates.length === 0) return { ...empty, status: 'no-yaku' }

  const { best, alternatives } = selectBest(candidates)
  return { status: 'scored', validation, dora, best, alternatives }
}
```

- [ ] **Step 5: Export the public surface**

Replace `src/engine/index.ts` with:

```ts
export const ENGINE_VERSION = '0.1.0'

export * from './types'
export * from './tiles'
export * from './hand'
export * from './validate'
export * from './decompose'
export * from './fu'
export * from './dora'
export * from './score'
export * from './select'
export * from './calculate'
export * from './yaku/types'
export { detectYaku } from './yaku/detect'
export { YAKU_RULES } from './yaku/registry'
export * from './rulesets/types'
export { WRC_2025 } from './rulesets/wrc2025'
```

- [ ] **Step 6: Run the whole suite**

```bash
npm test && npm run lint && npm run build
```

Expected: all green. The barrel export is the first place a circular import would surface, so a
build failure here means a module boundary needs untangling, not a re-export tweak.

- [ ] **Step 7: Commit**

```bash
git add src/engine
git commit -m "feat: add interpretation selection and the calculate entry point"
git push
```

---

## Task 14: Worked-example corpus and yaku coverage gate

This is the spec's §9 forcing function. The coverage test **fails until every registered yaku
has both a positive and a negative case**, so completing the fixture is the task, not a
follow-up.

**Files:**
- Create: `src/engine/corpus.fixture.ts`, `src/engine/corpus.test.ts`, `src/engine/yaku/coverage.fixture.ts`, `src/engine/yaku/coverage.test.ts`

**Interfaces:**
- Consumes: `calculate`, `YAKU_RULES`.
- Produces: `CORPUS: CorpusCase[]`, `YAKU_COVERAGE: Record<string, CoverageCase>`.

- [ ] **Step 1: Define the corpus fixture with its seed cases**

Create `src/engine/corpus.fixture.ts`:

```ts
import type { WinContext, WinSource } from './types'

export interface CorpusCase {
  name: string
  concealed: string
  winningTile: string
  winSource: WinSource
  melds?: Array<{ kind: 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'; tiles: string }>
  ctx?: Partial<WinContext>
  expect: {
    yaku: string[]
    han: number
    fu: number
    /** The hand's value excluding honba and riichi sticks. */
    handTotal: number
  }
}

/**
 * Worked examples with expected results.
 * Every case must be checked against a published source before being added —
 * these are the oracle, so a case derived from our own output proves nothing.
 */
export const CORPUS: CorpusCase[] = [
  {
    name: 'riichi + pinfu + tanyao, closed ron, non-dealer',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'ron',
    ctx: { riichi: 'riichi', seatWind: 'S', roundWind: 'E' },
    expect: { yaku: ['pinfu', 'riichi', 'tanyao'], han: 3, fu: 30, handTotal: 3900 },
  },
  {
    name: 'riichi + pinfu + tanyao + menzen tsumo, closed tsumo, non-dealer',
    concealed: '34m55m567p345s678s',
    winningTile: '2m',
    winSource: 'tsumo',
    ctx: { riichi: 'riichi', seatWind: 'S', roundWind: 'E' },
    expect: {
      yaku: ['menzen-tsumo', 'pinfu', 'riichi', 'tanyao'],
      han: 4, fu: 20, handTotal: 5200,
    },
  },
  {
    name: 'chiitoitsu alone, closed ron, non-dealer',
    concealed: '1122m3344p5566s7z',
    winningTile: '7z',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    expect: { yaku: ['chiitoitsu'], han: 2, fu: 25, handTotal: 1600 },
  },
  {
    name: 'yakuhai only on an open pon, tanki wait, non-dealer ron',
    concealed: '234m567p345s5p',
    winningTile: '5p',
    winSource: 'ron',
    melds: [{ kind: 'pon', tiles: '555z' }],
    ctx: { seatWind: 'S', roundWind: 'E' },
    expect: { yaku: ['yakuhai-haku'], han: 1, fu: 30, handTotal: 1000 },
  },
  {
    name: 'daisangen, non-dealer ron',
    concealed: '555z666z777z234m5m',
    winningTile: '5m',
    winSource: 'ron',
    ctx: { seatWind: 'S', roundWind: 'E' },
    // 20 base + 10 menzen ron + three honour ankou (8 each) + 2 tanki = 56 → 60.
    expect: { yaku: ['daisangen'], han: 0, fu: 60, handTotal: 32000 },
  },
]
```

- [ ] **Step 2: Write the corpus test**

Create `src/engine/corpus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CORPUS } from './corpus.fixture'
import { calculate } from './calculate'
import { parseTiles } from './tiles'
import { WRC_2025 } from './rulesets/wrc2025'
import type { Hand, WinContext } from './types'

const baseCtx: WinContext = {
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
}

describe('worked-example corpus', () => {
  it('contains at least 20 cases', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(20)
  })

  it.each(CORPUS.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const hand: Hand = {
      concealed: parseTiles(testCase.concealed),
      melds: (testCase.melds ?? []).map((m) => ({
        kind: m.kind,
        tiles: parseTiles(m.tiles),
        calledTile: m.kind === 'ankan' ? undefined : parseTiles(m.tiles)[0],
      })),
      winningTile: parseTiles(testCase.winningTile)[0],
      winSource: testCase.winSource,
    }
    const result = calculate(hand, { ...baseCtx, ...testCase.ctx }, WRC_2025)

    expect(result.status).toBe('scored')
    expect(result.best!.yaku.map((y) => y.id).sort()).toEqual([...testCase.expect.yaku].sort())
    expect(result.best!.han).toBe(testCase.expect.han)
    expect(result.best!.fu.total).toBe(testCase.expect.fu)
    expect(result.best!.score.handTotal).toBe(testCase.expect.handTotal)
  })
})
```

- [ ] **Step 3: Run it and watch the count assertion fail**

```bash
npx vitest run src/engine/corpus.test.ts
```

Expected: the five seed cases pass; `contains at least 20 cases` FAILS.

- [ ] **Step 4: Expand the corpus to at least 20 cases**

Add fifteen more cases drawn from published worked examples, covering at minimum: an open
hand with a han reduction; a hand with a kan; a shanpon ron that costs sanankou; a chanta
hand; a honitsu hand; a dealer tsumo; a hand with honba and riichi sticks; a kokushi; a
suuankou tanki; and a chuuren.

Each case's expected values must come from the published source, **not** from running
`calculate()` and copying the output. If a case disagrees with the engine, investigate before
changing either side, then record which one was wrong in the commit message.

Re-run until green.

- [ ] **Step 5: Build the yaku coverage gate**

Create `src/engine/yaku/coverage.fixture.ts`:

```ts
import type { WinContext, WinSource } from '../types'

export interface CoverageHand {
  concealed: string
  winningTile: string
  winSource?: WinSource
  melds?: Array<{ kind: 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'; tiles: string }>
  ctx?: Partial<WinContext>
}

export interface CoverageCase {
  /** A hand that MUST produce this yaku. */
  positive: CoverageHand
  /** A near-miss hand that MUST NOT produce it. */
  negative: CoverageHand
}

export const YAKU_COVERAGE: Record<string, CoverageCase> = {
  riichi: {
    positive: { concealed: '34m55m567p345s678s', winningTile: '2m',
      ctx: { riichi: 'riichi' } },
    negative: { concealed: '34m55m567p345s678s', winningTile: '2m' },
  },
  tanyao: {
    positive: { concealed: '34m55m567p345s678s', winningTile: '2m' },
    negative: { concealed: '34m55m567p345s789s', winningTile: '2m' },
  },
  // Every id in YAKU_RULES needs an entry. The coverage test below fails until they all do.
}
```

Create `src/engine/yaku/coverage.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { YAKU_COVERAGE, type CoverageHand } from './coverage.fixture'
import { YAKU_RULES } from './registry'
import { calculate } from '../calculate'
import { parseTiles } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'
import type { Hand, WinContext } from '../types'

const baseCtx: WinContext = {
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
}

const build = (spec: CoverageHand): [Hand, WinContext] => [
  {
    concealed: parseTiles(spec.concealed),
    melds: (spec.melds ?? []).map((m) => ({
      kind: m.kind,
      tiles: parseTiles(m.tiles),
      calledTile: m.kind === 'ankan' ? undefined : parseTiles(m.tiles)[0],
    })),
    winningTile: parseTiles(spec.winningTile)[0],
    winSource: spec.winSource ?? 'ron',
  },
  { ...baseCtx, ...spec.ctx },
]

/** True when any interpretation of the hand yields the yaku. */
const yields = (spec: CoverageHand, id: string): boolean => {
  const [hand, ctx] = build(spec)
  const result = calculate(hand, ctx, WRC_2025)
  const all = [result.best, ...result.alternatives].filter((c) => c !== null)
  return all.some((c) => c!.yaku.some((y) => y.id === id))
}

describe('yaku coverage gate', () => {
  it('every registered yaku has a positive and a negative case', () => {
    const missing = YAKU_RULES
      .map((rule) => rule.id)
      .filter((id) => !(id in YAKU_COVERAGE))
    expect(missing).toEqual([])
  })

  it('no coverage entry refers to an unregistered yaku', () => {
    const known = new Set(YAKU_RULES.map((rule) => rule.id))
    expect(Object.keys(YAKU_COVERAGE).filter((id) => !known.has(id))).toEqual([])
  })

  it.each(Object.entries(YAKU_COVERAGE))('%s — positive case yields the yaku', (id, c) => {
    expect(yields(c.positive, id)).toBe(true)
  })

  it.each(Object.entries(YAKU_COVERAGE))('%s — negative case does not', (id, c) => {
    expect(yields(c.negative, id)).toBe(false)
  })
})
```

- [ ] **Step 6: Fill the coverage fixture until the gate passes**

```bash
npx vitest run src/engine/yaku/coverage.test.ts
```

The first assertion lists exactly which yaku ids are missing. Add an entry for each, then
re-run until green. A negative case should be a **near miss** — a hand one condition away from
the yaku — not an unrelated hand, or the gate proves nothing.

- [ ] **Step 7: Commit**

```bash
git add src/engine/corpus.fixture.ts src/engine/corpus.test.ts src/engine/yaku/coverage.fixture.ts src/engine/yaku/coverage.test.ts
git commit -m "test: add worked-example corpus and a yaku coverage gate"
git push
```

---

## Task 15: Differential fuzzing

**Files:**
- Create: `src/engine/fuzz/generate.ts`, `src/engine/fuzz/invariants.test.ts`, `scripts/differential.ts`
- Modify: `package.json` (add the `fuzz:differential` script)

**Interfaces:**
- Produces:
  - `randomWinningHand(seed: number): { hand: Hand; ctx: WinContext }` — deterministic from the seed
  - `interface Oracle { name: string; score(hand, ctx): { han: number; fu: number; total: number } | null }`

**Domain notes:** the generator builds hands **from** random legal groups rather than drawing
random tiles and filtering, so the yield is 100% winning hands. Determinism matters: the engine
forbids `Math.random`, and a seeded generator makes a failing case reproducible from its seed
alone.

- [ ] **Step 1: Write the generator**

Create `src/engine/fuzz/generate.ts`:

```ts
import type { Hand, Tile, WinContext, Wind } from '../types'
import { tileFromId } from '../tiles'

/** Deterministic 32-bit PRNG — the engine forbids Math.random, and seeds must reproduce. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const WINDS: Wind[] = ['E', 'S', 'W', 'N']

/** Builds a guaranteed-winning 14-tile hand from four random groups plus a pair. */
export function randomWinningHand(seed: number): { hand: Hand; ctx: WinContext } {
  const rand = mulberry32(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]

  const used = new Array<number>(34).fill(0)
  const take = (id: number, n: number): Tile[] | null => {
    if (used[id] + n > 4) return null
    used[id] += n
    return Array.from({ length: n }, () => tileFromId(id))
  }

  const tiles: Tile[] = []

  const addGroup = (): boolean => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const wantSequence = rand() < 0.6
      if (wantSequence) {
        const suitBase = pick([0, 9, 18])
        const start = suitBase + Math.floor(rand() * 7)
        if (used[start] < 4 && used[start + 1] < 4 && used[start + 2] < 4) {
          for (const id of [start, start + 1, start + 2]) take(id, 1)
          tiles.push(...[start, start + 1, start + 2].map(tileFromId))
          return true
        }
      } else {
        const id = Math.floor(rand() * 34)
        const got = take(id, 3)
        if (got) { tiles.push(...got); return true }
      }
    }
    return false
  }

  for (let i = 0; i < 4; i++) {
    if (!addGroup()) return randomWinningHand(seed + 1)
  }

  let pair: Tile[] | null = null
  for (let attempt = 0; attempt < 40 && !pair; attempt++) {
    pair = take(Math.floor(rand() * 34), 2)
  }
  if (!pair) return randomWinningHand(seed + 1)
  tiles.push(...pair)

  const winningIndex = Math.floor(rand() * tiles.length)
  const winningTile = tiles[winningIndex]
  const concealed = tiles.filter((_, i) => i !== winningIndex)

  return {
    hand: { concealed, melds: [], winningTile, winSource: rand() < 0.5 ? 'ron' : 'tsumo' },
    ctx: {
      seatWind: pick(WINDS), roundWind: pick(['E', 'S'] as const),
      riichi: rand() < 0.4 ? 'riichi' : 'none',
      ippatsu: false, haitei: false, houtei: false, rinshan: false, chankan: false,
      tenhou: false, chiihou: false,
      doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
    },
  }
}
```

- [ ] **Step 2: Write the invariant tests**

Create `src/engine/fuzz/invariants.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { randomWinningHand } from './generate'
import { calculate } from '../calculate'
import { decompose } from '../decompose'
import { toCounts } from '../tiles'
import { WRC_2025 } from '../rulesets/wrc2025'

const SEEDS = Array.from({ length: 2000 }, (_, i) => i + 1)

describe('fuzz invariants', () => {
  it('never throws and never returns an inconsistent status', () => {
    for (const seed of SEEDS) {
      const { hand, ctx } = randomWinningHand(seed)
      const result = calculate(hand, ctx, WRC_2025)
      if (result.status === 'scored') {
        expect(result.best, `seed ${seed}`).not.toBeNull()
        expect(result.best!.yaku.length, `seed ${seed}`).toBeGreaterThan(0)
      } else {
        expect(result.best, `seed ${seed}`).toBeNull()
      }
    }
  })

  it('always produces a winning decomposition for a generated hand', () => {
    for (const seed of SEEDS) {
      const { hand } = randomWinningHand(seed)
      expect(decompose(hand).length, `seed ${seed}`).toBeGreaterThan(0)
    }
  })

  it('conserves tiles across every interpretation', () => {
    for (const seed of SEEDS) {
      const { hand } = randomWinningHand(seed)
      const expected = toCounts([...hand.concealed, hand.winningTile])
      for (const interp of decompose(hand)) {
        expect(toCounts(interp.groups.flatMap((g) => g.tiles)), `seed ${seed}`)
          .toEqual(expected)
      }
    }
  })

  it('never ranks an alternative above the best', () => {
    for (const seed of SEEDS) {
      const { hand, ctx } = randomWinningHand(seed)
      const result = calculate(hand, ctx, WRC_2025)
      if (result.status !== 'scored') continue
      for (const alt of result.alternatives) {
        expect(alt.score.handTotal, `seed ${seed}`)
          .toBeLessThanOrEqual(result.best!.score.handTotal)
      }
    }
  })

  it('keeps fu a positive multiple of 10, or exactly 25 for chiitoitsu', () => {
    for (const seed of SEEDS) {
      const { hand, ctx } = randomWinningHand(seed)
      const result = calculate(hand, ctx, WRC_2025)
      if (result.status !== 'scored') continue
      const fu = result.best!.fu.total
      const ok = fu === 25 || (fu >= 20 && fu % 10 === 0)
      expect(ok, `seed ${seed} produced ${fu} fu`).toBe(true)
    }
  })
})
```

- [ ] **Step 3: Run the invariant suite**

```bash
npx vitest run src/engine/fuzz/invariants.test.ts
```

Expected: PASS. Any failure prints the seed — reproduce it with a one-line script before
changing any engine code, and add the reduced case to `corpus.fixture.ts` permanently.

- [ ] **Step 4: Select and vet a third-party oracle**

Search npm for a riichi scoring library. Record in the commit message: the package chosen, its
version, its licence, and whether it is compatible with using it as a **dev-only** dependency.

If no suitable library exists — no maintained package, or an incompatible licence — stop here,
write that finding into the spec's §11 open items, and expand `CORPUS` to 40 cases instead.
That is a legitimate outcome, not a failure; say so plainly rather than forcing a bad
dependency.

- [ ] **Step 5: Write the differential harness**

Create `scripts/differential.ts`:

```ts
/**
 * Compares our engine against a third-party scorer over many generated hands.
 * Run with: npm run fuzz:differential -- <count>
 * Mismatches are adjudicated by hand — the oracle is not automatically trusted.
 */
import { randomWinningHand } from '../src/engine/fuzz/generate'
import { calculate } from '../src/engine/calculate'
import { WRC_2025 } from '../src/engine/rulesets/wrc2025'
import type { Hand, WinContext } from '../src/engine/types'

export interface Oracle {
  name: string
  /** Returns null when the oracle declines to score the hand. */
  score(hand: Hand, ctx: WinContext): { han: number; fu: number; total: number } | null
}

// Replace with the adapter for the package chosen in Step 4.
const oracle: Oracle | null = null

const count = Number(process.argv[2] ?? 5000)

if (!oracle) {
  console.error('No oracle configured — see Task 15 Step 4. Nothing to compare.')
  process.exit(1)
}

let compared = 0
const mismatches: string[] = []

for (let seed = 1; seed <= count; seed++) {
  const { hand, ctx } = randomWinningHand(seed)
  const ours = calculate(hand, ctx, WRC_2025)
  if (ours.status !== 'scored') continue

  const theirs = oracle.score(hand, ctx)
  if (!theirs) continue

  compared += 1
  const mine = ours.best!
  if (mine.han !== theirs.han || mine.fu.total !== theirs.fu
      || mine.score.handTotal !== theirs.total) {
    mismatches.push(
      `seed ${seed}: ours ${mine.han}h/${mine.fu.total}f/${mine.score.handTotal} ` +
      `vs ${oracle.name} ${theirs.han}h/${theirs.fu}f/${theirs.total}`)
  }
}

console.log(`Compared ${compared} hands against ${oracle.name}.`)
for (const line of mismatches.slice(0, 50)) console.log(line)
console.log(`${mismatches.length} mismatches.`)
process.exit(mismatches.length === 0 ? 0 : 1)
```

Add to `package.json` scripts:

```json
{ "fuzz:differential": "tsx scripts/differential.ts" }
```

and install the runner and the chosen oracle as dev dependencies:

```bash
npm install -D tsx
```

- [ ] **Step 6: Run the differential sweep and adjudicate**

```bash
npm run fuzz:differential -- 5000
```

For each mismatch class, work out by hand which side is right. Where our engine is wrong, fix
it and add the reduced case to `CORPUS`. Where the oracle is wrong or merely uses a different
ruleset, record the reason in a comment in `scripts/differential.ts` so the next person does
not re-litigate it.

- [ ] **Step 7: Commit**

```bash
git add src/engine/fuzz scripts/differential.ts package.json package-lock.json
git commit -m "test: add seeded hand generator, invariant fuzzing, and differential harness"
git push
```

---

## Done criteria for this plan

- `npm test`, `npm run lint`, and `npm run build` all pass.
- The coverage gate passes, meaning every registered yaku has a positive and a near-miss case.
- `CORPUS` holds at least 20 externally-sourced worked examples, all passing.
- The published score table matches cell-for-cell.
- Either the differential sweep runs clean, or §11 of the spec records why no oracle was usable
  and `CORPUS` was expanded to 40 cases instead.

The engine is then ready for Plan 2 (calculator UI), which consumes `calculate()` and the
evidence attached to each yaku and fu line.

## Deferred to later plans

Spec sections not covered here, so the boundary is explicit:

- **§6 share URLs** — this plan delivers `parseTiles` / `tilesToNotation`, which are the hard
  half. The query-string codec (`#v=1&h=…&win=…&w=…`) and the paste-in text entry belong to
  Plan 2, where they have a UI to serialise from.
- **§7 user interface** — Plan 2.
- **§8 Learn pages** — Plan 3, generated from `YAKU_RULES`, which this plan exports.
- **§10 deployment** — Plan 3.
