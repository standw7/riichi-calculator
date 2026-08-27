# Calculator UI Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the riichi calculator user interface on top of the completed scoring engine — tile entry, results with beginner explanations, share URLs, settings — and deploy it to Cloudflare Pages.

**Architecture:** A single `useReducer` owns a *draft* hand that may be incomplete. A pure `toEngineInput` adapter is the only seam between the draft and the engine's `calculate()`, which runs synchronously on every action. Tiles render from one build-time SVG sprite so evidence highlighting is a CSS class. All display copy lives in `src/content/` and joins engine output by id.

**Tech Stack:** React 19, TypeScript 6 (strict), Vite 8, Vitest 4, React Testing Library, Playwright, ESLint 10 flat config, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-26-calculator-ui-design.md` (extends `docs/superpowers/specs/2026-08-24-riichi-calculator-design.md`)

## Global Constraints

- **Node >= 24, npm >= 11.** Already pinned in `package.json` `engines`.
- **TypeScript strict.** No `any`. No non-null assertions (`!`) in new code except where a test has already proven the value present.
- **The engine is frozen.** `src/engine/**` is complete and has 391 passing tests. Do NOT modify any file under `src/engine/` unless a task explicitly says so. If engine behaviour looks wrong, report BLOCKED — do not "fix" it.
- **Layer boundaries, enforced by ESLint:**
  - `src/engine/**` must not import React, `src/ui/**`, or `src/content/**`.
  - `src/content/**` must not import `src/engine/**`. Content is data the UI joins to engine output by id, never the reverse.
  - `src/ui/**` may import from both.
- **Copy lives in `src/content/`, never in a component or the engine.** A rendered English string inside `src/ui/**` that names a yaku, fu line, or wait is a defect.
- **Tile notation** is the engine's: `1m`–`9m`, `1p`–`9p`, `1s`–`9s`, `1z`–`7z` (1–4 = E,S,W,N; 5–7 = White, Green, Red), and `0m`/`0p`/`0s` for red fives.
- **Never commit red tests.** If a test fails and you believe the plan is wrong, report BLOCKED with the evidence. Do not change an expectation to match the code.
- **Test the behaviour, not the implementation.** A test that passes when you delete the code under test is worthless. Where a task says "prove the test bites", you must actually break the implementation, observe the failure, and restore it.
- **Commit after every task.** Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`).
- **Run `npm run lint` and `npm test` before every commit.** Both must be clean.

## File Structure

```
scripts/
  vendor-tiles.ts             one-shot: fetch, optimise, emit the tile sprite

src/assets/
  tiles.sprite.svg            generated, committed — one <symbol> per tile face
  tileSymbols.ts              generated, committed — Tile -> symbol id

src/content/
  yaku/types.ts               YakuCopy shape (no engine imports)
  yaku/index.ts               YAKU_COPY registry, 45 entries
  yaku/oneHan.ts              copy for the 16 one-han yaku
  yaku/twoHan.ts              copy for the 10 two-han yaku
  yaku/threeHan.ts            copy for the 4 three-han-and-up yaku
  yaku/yakuman.ts             copy for the 15 yakuman
  fu.ts                       fu-line copy as a render function
  wait.ts                     the five wait types
  score.ts                    (exists) score step labels
  status.ts                   copy for invalid / not-a-winning-hand / no-yaku

src/ui/
  App.tsx                     shell: header, layout, settings trigger
  tiles/Tile.tsx              one tile, <use href="#tile-..">
  tiles/TileRow.tsx           a row of tiles with optional highlighting
  tiles/Sprite.tsx            mounts the sprite once at the app root
  calculator/TilePalette.tsx  34-tile palette with used-counts
  calculator/HandWorkspace.tsx concealed + winning tile + melds
  calculator/MeldEditor.tsx   add called set: chi / pon / kan
  calculator/ContextControls.tsx winds, riichi, flags, indicators, honba, sticks
  calculator/TextEntry.tsx    paste notation instead of clicking
  results/ResultsPanel.tsx    orchestrates the results sections
  results/ScoreHeadline.tsx   points + han/fu + limit class
  results/YakuList.tsx        yaku with han and explanations
  results/FuBreakdown.tsx     fu lines and the rounding
  results/DoraList.tsx        dora, aka, ura
  results/PaymentSteps.tsx    the score arithmetic
  results/OtherInterpretations.tsx losing decompositions
  results/StatusNotice.tsx    invalid / not-a-winning-hand / no-yaku
  settings/RulesetPanel.tsx   the five exposed flags
  state/types.ts              CalculatorState, Action, WinContextDraft
  state/reducer.ts            the reducer
  state/toEngineInput.ts      draft -> engine input
  state/hashCodec.ts          state <-> URL hash
  state/useCalculator.ts      the hook that ties reducer + engine + hash together

e2e/
  smoke.spec.ts               one Playwright test

public/
  _redirects                  SPA fallback for Plan 3's routes
```

---

## Task 1: UI test environment and the content boundary rule

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Modify: `eslint.config.js`
- Modify: `vitest.config.ts`
- Create: `src/ui/testSetup.ts`
- Create: `src/ui/smoke.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `.test.tsx` harness (jsdom + React Testing Library) that every later UI task relies on; an ESLint rule forbidding `src/content/**` from importing `src/engine/**`.

- [ ] **Step 1: Install the test dependencies**

```bash
npm install -D jsdom@^27 @testing-library/react@^17 @testing-library/user-event@^15 @testing-library/jest-dom@^7
```

If a listed major is unavailable, install the current major instead and note the version you used in your report. Do not install `@testing-library/react-hooks` — it is obsolete for React 19.

- [ ] **Step 2: Create the test setup file**

Create `src/ui/testSetup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  window.location.hash = ''
})
```

- [ ] **Step 3: Point Vitest at jsdom for .tsx tests**

Replace `vitest.config.ts` entirely:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Engine tests are pure and stay in node. Anything that renders opts in
    // per-file with a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    setupFiles: ['src/ui/testSetup.ts'],
  },
})
```

The per-file docblock is deliberate: it keeps the 391 engine tests running in the fast node environment instead of paying jsdom startup for all of them.

- [ ] **Step 4: Write the smoke test**

Create `src/ui/smoke.test.tsx`. Note the docblock on line 1 — it must be the first thing in the file:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

describe('ui test harness', () => {
  it('renders a component and finds it by role', () => {
    render(<h1>Riichi Calculator</h1>)
    expect(screen.getByRole('heading', { name: 'Riichi Calculator' })).toBeInTheDocument()
  })

  it('gives each test a clean localStorage', () => {
    expect(window.localStorage.length).toBe(0)
    window.localStorage.setItem('probe', '1')
  })
})
```

- [ ] **Step 5: Run the smoke test**

Run: `npx vitest run src/ui/smoke.test.tsx`
Expected: 2 passed. If `toBeInTheDocument` is not a function, the setup file is not loading — check `setupFiles` in the config.

- [ ] **Step 6: Confirm the engine tests still pass in node**

Run: `npm test`
Expected: 393 tests passed (391 engine + 2 new).

- [ ] **Step 7: Add the content boundary rule**

In `eslint.config.js`, add a new config block after the existing `src/engine/**` block:

```js
  {
    files: ['src/content/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['**/engine/**', '../engine/*', './engine/*'],
            message:
              'Content must not import from the engine. Content is data the UI joins to engine output by id.',
          },
          { group: ['react', 'react-dom', 'react/*'], message: 'Content must not depend on React.' },
        ],
      }],
    },
  },
```

- [ ] **Step 8: Prove the rule bites**

Temporarily add this line to the top of `src/content/yaku.ts`:

```ts
import { WRC_2025 } from '../engine/rulesets/wrc2025'
```

Run: `npm run lint`
Expected: FAIL with "Content must not import from the engine."

Now delete that line and re-run: `npm run lint`
Expected: clean.

Record both outcomes in your report. A rule you did not watch fail is a rule you have not tested.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test: add jsdom + React Testing Library harness and the content boundary rule"
```

---

## Task 2: Vendor the tile artwork as a sprite

**Files:**
- Create: `scripts/vendor-tiles.ts`
- Create: `src/assets/tileSymbols.ts` (generated, committed)
- Create: `src/assets/tiles.sprite.svg` (generated, committed)
- Create: `src/assets/tileSymbols.test.ts`
- Create: `LICENSES.md`
- Modify: `package.json` (devDependency `svgo`, script `vendor:tiles`)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `tileSymbolId(tile: { suit: string; rank: number; red: boolean }): string` — returns e.g. `'tile-1m'`, `'tile-0p'`, `'tile-5z'`.
  - `TILE_SYMBOL_IDS: readonly string[]` — all 37 face ids.
  - `src/assets/tiles.sprite.svg` — a single `<svg>` whose children are `<symbol id="tile-…" viewBox="0 0 300 400">`.

**Background — the upstream set:**

`https://github.com/FluffyStuff/riichi-mahjong-tiles` is CC0 / public domain. Its `Regular/` directory has 40 files, all `viewBox="0 0 300 400"`:

- Numbered: `Man1..Man9`, `Pin1..Pin9`, `Sou1..Sou9`
- Red fives: `Man5-Dora`, `Pin5-Dora`, `Sou5-Dora`
- Winds: `Ton` (East), `Nan` (South), `Shaa` (West), `Pei` (North)
- Dragons: `Haku` (White), `Hatsu` (Green), `Chun` (Red)
- Non-faces: `Front`, `Back`, `Blank` — **include `Front` and `Back` in the sprite**, skip `Blank`.

Engine honor ranks: `1z`=East, `2z`=South, `3z`=West, `4z`=North, `5z`=White, `6z`=Green, `7z`=Red.

- [ ] **Step 1: Install svgo**

```bash
npm install -D svgo@^4
```

- [ ] **Step 2: Write the vendoring script**

Create `scripts/vendor-tiles.ts`:

```ts
/**
 * One-shot vendoring of the CC0 riichi tile artwork into a single SVG sprite.
 *
 * Run with: npm run vendor:tiles
 *
 * Output is committed, so builds never touch the network and a re-vendor
 * produces a reviewable diff. Source: FluffyStuff/riichi-mahjong-tiles (CC0).
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { optimize } from 'svgo'

const REPO = 'https://github.com/FluffyStuff/riichi-mahjong-tiles.git'
/** Pinned so a re-vendor is reproducible. Update deliberately, never incidentally. */
const REF = 'master'

/** Upstream basename -> our symbol id suffix. */
const FACES: Record<string, string> = {
  Man1: '1m', Man2: '2m', Man3: '3m', Man4: '4m', Man5: '5m',
  Man6: '6m', Man7: '7m', Man8: '8m', Man9: '9m', 'Man5-Dora': '0m',
  Pin1: '1p', Pin2: '2p', Pin3: '3p', Pin4: '4p', Pin5: '5p',
  Pin6: '6p', Pin7: '7p', Pin8: '8p', Pin9: '9p', 'Pin5-Dora': '0p',
  Sou1: '1s', Sou2: '2s', Sou3: '3s', Sou4: '4s', Sou5: '5s',
  Sou6: '6s', Sou7: '7s', Sou8: '8s', Sou9: '9s', 'Sou5-Dora': '0s',
  Ton: '1z', Nan: '2z', Shaa: '3z', Pei: '4z',
  Haku: '5z', Hatsu: '6z', Chun: '7z',
  Front: 'front', Back: 'back',
}

function extractInner(svg: string): string {
  const open = svg.indexOf('>', svg.indexOf('<svg'))
  const close = svg.lastIndexOf('</svg>')
  if (open === -1 || close === -1) throw new Error('Malformed SVG: no <svg> element')
  return svg.slice(open + 1, close).trim()
}

function main(): void {
  const work = mkdtempSync(join(tmpdir(), 'tiles-'))
  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', REF, REPO, work], {
      stdio: 'inherit',
    })

    const symbols: string[] = []
    for (const [basename, id] of Object.entries(FACES)) {
      const raw = readFileSync(join(work, 'Regular', `${basename}.svg`), 'utf8')
      const { data } = optimize(raw, {
        multipass: true,
        plugins: [
          { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
          // Ids inside a shared sprite collide across symbols unless prefixed.
          { name: 'prefixIds', params: { prefix: `t${id}` } },
        ],
      })
      symbols.push(
        `<symbol id="tile-${id}" viewBox="0 0 300 400">${extractInner(data)}</symbol>`,
      )
    }

    mkdirSync('src/assets', { recursive: true })

    writeFileSync(
      'src/assets/tiles.sprite.svg',
      `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols.join('\n')}\n</svg>\n`,
    )

    const ids = Object.values(FACES).filter((id) => id !== 'front' && id !== 'back')
    writeFileSync(
      'src/assets/tileSymbols.ts',
      `/* GENERATED by scripts/vendor-tiles.ts — do not edit by hand. */\n\n` +
        `export const TILE_SYMBOL_IDS: readonly string[] = [\n` +
        ids.map((id) => `  'tile-${id}',`).join('\n') +
        `\n]\n\n` +
        `export interface TileLike { suit: string; rank: number; red: boolean }\n\n` +
        `/** Symbol id for a tile. Red fives use rank 0, matching engine notation. */\n` +
        `export function tileSymbolId(tile: TileLike): string {\n` +
        `  const rank = tile.red ? 0 : tile.rank\n` +
        `  return \`tile-\${rank}\${tile.suit}\`\n` +
        `}\n`,
    )

    console.log(`Wrote ${symbols.length} symbols.`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

main()
```

- [ ] **Step 3: Add the npm script**

In `package.json` `scripts`, add:

```json
"vendor:tiles": "tsx scripts/vendor-tiles.ts"
```

- [ ] **Step 4: Run it**

Run: `npm run vendor:tiles`
Expected: `Wrote 39 symbols.` and two new files under `src/assets/`.

Sanity-check the output size:

```bash
ls -la src/assets/tiles.sprite.svg
```

Expected: comfortably under 400KB. If it is over 400KB, svgo did not run — check for an error in the output rather than proceeding.

- [ ] **Step 5: Write the test**

Create `src/assets/tileSymbols.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { TILE_SYMBOL_IDS, tileSymbolId } from './tileSymbols'
import { tileFromId } from '../engine/tiles'

const sprite = readFileSync('src/assets/tiles.sprite.svg', 'utf8')

describe('tile symbols', () => {
  it('covers all 34 distinct tiles plus 3 red fives', () => {
    expect(TILE_SYMBOL_IDS).toHaveLength(37)
    expect(new Set(TILE_SYMBOL_IDS).size).toBe(37)
  })

  it('maps every engine tile id to a symbol present in the sprite', () => {
    for (let id = 0; id < 34; id++) {
      const symbolId = tileSymbolId(tileFromId(id))
      expect(TILE_SYMBOL_IDS).toContain(symbolId)
      expect(sprite).toContain(`id="${symbolId}"`)
    }
  })

  it('maps red fives to rank 0', () => {
    expect(tileSymbolId({ suit: 'm', rank: 5, red: true })).toBe('tile-0m')
    expect(tileSymbolId({ suit: 'p', rank: 5, red: true })).toBe('tile-0p')
    expect(tileSymbolId({ suit: 's', rank: 5, red: true })).toBe('tile-0s')
    for (const id of ['tile-0m', 'tile-0p', 'tile-0s']) {
      expect(sprite).toContain(`id="${id}"`)
    }
  })

  it('distinguishes a red five from a normal five', () => {
    expect(tileSymbolId({ suit: 'm', rank: 5, red: false })).toBe('tile-5m')
    expect(tileSymbolId({ suit: 'm', rank: 5, red: true })).toBe('tile-0m')
  })

  it('includes the tile front and back', () => {
    expect(sprite).toContain('id="tile-front"')
    expect(sprite).toContain('id="tile-back"')
  })
})
```

Note this test reads the *committed artifact*. That is the point: it fails if a future re-vendor drops a tile.

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/assets/tileSymbols.test.ts`
Expected: 5 passed.

- [ ] **Step 7: Prove the sprite assertion bites**

Open `src/assets/tiles.sprite.svg` and rename `id="tile-1m"` to `id="tile-1m-broken"`. Re-run the test.
Expected: FAIL on "maps every engine tile id to a symbol present in the sprite".
Restore the id and confirm the test passes again. Record both outcomes.

- [ ] **Step 8: Record the licence**

Create `LICENSES.md`:

```markdown
# Third-party licences

## Tile artwork

`src/assets/tiles.sprite.svg` is derived from
[FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles),
dedicated to the public domain under
[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/).

Attribution is not required by CC0. It is recorded here, and in the site footer,
as a courtesy to the author.

## Development dependencies

`riichi-score` (MIT) is used only by `scripts/differential.ts` to cross-check the
scoring engine. It is a devDependency and is never shipped to the browser.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(assets): vendor CC0 tile artwork as an optimised SVG sprite"
```

---

## Task 3: The Tile component

**Files:**
- Create: `src/ui/tiles/Sprite.tsx`
- Create: `src/ui/tiles/Tile.tsx`
- Create: `src/ui/tiles/TileRow.tsx`
- Create: `src/ui/tiles/Tile.test.tsx`
- Create: `src/ui/tiles/tiles.css`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `tileSymbolId` from `src/assets/tileSymbols.ts` (Task 2).
- Produces:
  - `<Sprite />` — mounts the sprite markup once; must be rendered at the app root before any `<Tile>`.
  - `<Tile tile={t} size?: 'sm'|'md'|'lg' state?: 'normal'|'highlighted'|'dimmed' onClick?: () => void label?: string />`
  - `<TileRow tiles={ts} highlight?: number[] size?: … onTileClick?: (index: number) => void />`

**Background:** the sprite is imported as a raw string so it can be inlined into the DOM. Vite supports this with the `?raw` import suffix. `<use href="#tile-1m">` then resolves against the inlined symbols.

- [ ] **Step 1: Write the failing test**

Create `src/ui/tiles/Tile.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Tile } from './Tile'
import { TileRow } from './TileRow'
import { parseTiles } from '../../engine/tiles'

const tile = (notation: string) => parseTiles(notation)[0]

describe('Tile', () => {
  it('references the sprite symbol for the tile', () => {
    const { container } = render(<Tile tile={tile('3p')} />)
    const use = container.querySelector('use')
    expect(use).toHaveAttribute('href', '#tile-3p')
  })

  it('references the red-five symbol for a red five', () => {
    const { container } = render(<Tile tile={tile('0s')} />)
    expect(container.querySelector('use')).toHaveAttribute('href', '#tile-0s')
  })

  it('renders as a button and fires onClick when clickable', async () => {
    const onClick = vi.fn()
    render(<Tile tile={tile('1z')} onClick={onClick} label="East" />)
    await userEvent.click(screen.getByRole('button', { name: 'East' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders as a plain image with no button role when not clickable', () => {
    render(<Tile tile={tile('1z')} label="East" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('img', { name: 'East' })).toBeInTheDocument()
  })

  it('marks visual state with a class so highlighting costs no re-render', () => {
    const { container, rerender } = render(<Tile tile={tile('5m')} state="highlighted" />)
    const root = container.firstElementChild!
    expect(root.className).toContain('tile--highlighted')
    rerender(<Tile tile={tile('5m')} state="dimmed" />)
    expect(container.firstElementChild!.className).toContain('tile--dimmed')
  })
})

describe('TileRow', () => {
  it('renders one tile per entry in order', () => {
    const { container } = render(<TileRow tiles={parseTiles('123m')} />)
    const uses = [...container.querySelectorAll('use')].map((u) => u.getAttribute('href'))
    expect(uses).toEqual(['#tile-1m', '#tile-2m', '#tile-3m'])
  })

  it('highlights only the indices given', () => {
    const { container } = render(<TileRow tiles={parseTiles('123m')} highlight={[1]} />)
    const classes = [...container.querySelectorAll('.tile')].map((el) => el.className)
    expect(classes[0]).not.toContain('tile--highlighted')
    expect(classes[1]).toContain('tile--highlighted')
    expect(classes[2]).not.toContain('tile--highlighted')
  })

  it('passes the clicked index to onTileClick', async () => {
    const onTileClick = vi.fn()
    render(<TileRow tiles={parseTiles('123m')} onTileClick={onTileClick} />)
    await userEvent.click(screen.getAllByRole('button')[2])
    expect(onTileClick).toHaveBeenCalledWith(2)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/ui/tiles/Tile.test.tsx`
Expected: FAIL — cannot resolve `./Tile`.

- [ ] **Step 3: Allow raw SVG imports**

Add to `vite.config.ts` — the `assetsInclude` entry is not needed for `?raw`, but the TypeScript declaration is. Create `src/vite-env.d.ts` if it does not already exist, and ensure it contains:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Write the Sprite component**

Create `src/ui/tiles/Sprite.tsx`:

```tsx
import spriteMarkup from '../../assets/tiles.sprite.svg?raw'

/**
 * Inlines the tile symbol sheet once, at the app root. Every <Tile> resolves
 * its <use href="#tile-…"> against these symbols, so the artwork is downloaded
 * once and highlighting is a CSS class rather than a new request.
 */
export function Sprite() {
  return <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: spriteMarkup }} />
}
```

`dangerouslySetInnerHTML` is safe here: the markup is a build-time asset committed to this repository, not user input.

- [ ] **Step 5: Write the Tile component**

Create `src/ui/tiles/Tile.tsx`:

```tsx
import type { Tile as TileModel } from '../../engine/types'
import { tileSymbolId } from '../../assets/tileSymbols'
import './tiles.css'

export type TileSize = 'sm' | 'md' | 'lg'
export type TileState = 'normal' | 'highlighted' | 'dimmed'

export interface TileProps {
  tile: TileModel
  size?: TileSize
  state?: TileState
  onClick?: () => void
  /** Accessible name. Callers pass copy from src/content; never hardcode here. */
  label?: string
}

export function Tile({ tile, size = 'md', state = 'normal', onClick, label }: TileProps) {
  const className = `tile tile--${size} tile--${state}`
  const art = (
    <svg className="tile__art" viewBox="0 0 300 400" focusable="false">
      <use href={`#${tileSymbolId(tile)}`} />
    </svg>
  )

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={label}>
        {art}
      </button>
    )
  }
  return (
    <span className={className} role="img" aria-label={label}>
      {art}
    </span>
  )
}
```

- [ ] **Step 6: Write the TileRow component**

Create `src/ui/tiles/TileRow.tsx`:

```tsx
import type { Tile as TileModel } from '../../engine/types'
import { Tile, type TileSize } from './Tile'

export interface TileRowProps {
  tiles: TileModel[]
  /** Indices to highlight — this is how yaku evidence lights up the hand. */
  highlight?: number[]
  size?: TileSize
  onTileClick?: (index: number) => void
  labelFor?: (tile: TileModel) => string
}

export function TileRow({ tiles, highlight, size, onTileClick, labelFor }: TileRowProps) {
  const lit = new Set(highlight ?? [])
  const anyHighlight = lit.size > 0
  return (
    <span className="tile-row">
      {tiles.map((tile, i) => (
        <Tile
          key={i}
          tile={tile}
          size={size}
          state={lit.has(i) ? 'highlighted' : anyHighlight ? 'dimmed' : 'normal'}
          onClick={onTileClick ? () => onTileClick(i) : undefined}
          label={labelFor?.(tile)}
        />
      ))}
    </span>
  )
}
```

- [ ] **Step 7: Write the stylesheet**

Create `src/ui/tiles/tiles.css`:

```css
.tile {
  display: inline-block;
  padding: 0;
  border: none;
  background: none;
  line-height: 0;
  transition: transform 120ms ease, filter 120ms ease, opacity 120ms ease;
}

.tile__art { display: block; width: 100%; height: auto; }

.tile--sm { width: 28px; }
.tile--md { width: 44px; }
.tile--lg { width: 60px; }

button.tile { cursor: pointer; }
button.tile:hover { transform: translateY(-3px); }
button.tile:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; border-radius: 4px; }

.tile--highlighted { filter: drop-shadow(0 0 0 #f59e0b) drop-shadow(0 0 4px #f59e0b); }
.tile--dimmed { opacity: 0.4; }

.tile-row { display: inline-flex; gap: 2px; align-items: flex-end; flex-wrap: wrap; }

@media (prefers-reduced-motion: reduce) {
  .tile { transition: none; }
  button.tile:hover { transform: none; }
}
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/ui/tiles/Tile.test.tsx`
Expected: 8 passed.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add Tile, TileRow and the sprite mount"
```

---

## Task 4: Calculator state and reducer

**Files:**
- Create: `src/ui/state/types.ts`
- Create: `src/ui/state/reducer.ts`
- Create: `src/ui/state/selectors.ts`
- Create: `src/ui/state/reducer.test.ts`

**Interfaces:**
- Consumes: engine types `Tile`, `Meld`, `WinSource`, `WinContext`, `RuleSet`, `WRC_2025`; `sortTiles` and `tileId` from `src/engine/tiles`.
- Produces:
  - `CalculatorState`, `Action`, `initialState(): CalculatorState`
  - `reducer(state: CalculatorState, action: Action): CalculatorState`
  - `tileUsage(state: CalculatorState): number[]` — 34 counts, red fives counted under their rank
  - `concealedCapacity(state: CalculatorState): number` — how many concealed tiles the hand still has room for

**Design notes for the implementer:**

- The engine requires exactly 14 slots: `concealed.length + melds.length * 3 + 1 === 14`. The winning tile is stored **separately** and is not a member of `concealed`. So concealed capacity is `13 - melds.length * 3`.
- A tile may appear at most four times across concealed + melds + winning tile. Red fives share the count of their rank — there are still only four 5m in a wall.
- Undo is a snapshot stack. Push the pre-action snapshot on every action that changes the hand; `CLEAR` pushes too, so it can be undone.
- `concise` is UI preference, not hand state — it is NOT part of the undo snapshot.

- [ ] **Step 1: Write the failing test**

Create `src/ui/state/reducer.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { reducer, initialState } from './reducer'
import { tileUsage, concealedCapacity } from './selectors'
import type { CalculatorState } from './types'
import { parseTiles, tilesToNotation } from '../../engine/tiles'

const t = (notation: string) => parseTiles(notation)[0]

const withTiles = (notation: string): CalculatorState =>
  parseTiles(notation).reduce(
    (s, tile) => reducer(s, { type: 'ADD_TILE', tile }),
    initialState(),
  )

describe('reducer — concealed tiles', () => {
  it('adds a tile', () => {
    const s = reducer(initialState(), { type: 'ADD_TILE', tile: t('3m') })
    expect(tilesToNotation(s.concealed)).toBe('3m')
  })

  it('keeps the concealed hand sorted', () => {
    const s = withTiles('9s1m5p')
    expect(tilesToNotation(s.concealed)).toBe('1m5p9s')
  })

  it('refuses a fifth copy of the same tile', () => {
    const four = withTiles('3m3m3m3m')
    const fifth = reducer(four, { type: 'ADD_TILE', tile: t('3m') })
    expect(fifth.concealed).toHaveLength(4)
    expect(fifth).toBe(four)
  })

  it('counts a red five against its rank', () => {
    const s = withTiles('5m5m5m0m')
    const blocked = reducer(s, { type: 'ADD_TILE', tile: t('5m') })
    expect(blocked.concealed).toHaveLength(4)
  })

  it('refuses a tile once the hand is full', () => {
    const full = withTiles('1112345678999m')
    expect(full.concealed).toHaveLength(13)
    const over = reducer(full, { type: 'ADD_TILE', tile: t('1p') })
    expect(over.concealed).toHaveLength(13)
  })

  it('removes a tile by index', () => {
    const s = reducer(withTiles('1m2m3m'), { type: 'REMOVE_TILE', index: 1 })
    expect(tilesToNotation(s.concealed)).toBe('1m3m')
  })
})

describe('reducer — the winning tile', () => {
  it('stores the winning tile outside the concealed hand', () => {
    const s = reducer(withTiles('1m'), { type: 'SET_WINNING_TILE', tile: t('4p') })
    expect(tilesToNotation(s.concealed)).toBe('1m')
    expect(s.winningTile).toEqual(t('4p'))
  })

  it('counts the winning tile toward the four-copy limit', () => {
    let s = withTiles('7s7s7s')
    s = reducer(s, { type: 'SET_WINNING_TILE', tile: t('7s') })
    const blocked = reducer(s, { type: 'ADD_TILE', tile: t('7s') })
    expect(blocked.concealed).toHaveLength(3)
  })

  it('moves a concealed tile into the winning slot', () => {
    const s = reducer(withTiles('1m2m3m'), { type: 'DESIGNATE_WINNING', index: 0 })
    expect(tilesToNotation(s.concealed)).toBe('2m3m')
    expect(s.winningTile).toEqual(t('1m'))
  })

  it('returns the previous winning tile to the hand when swapping', () => {
    let s = reducer(withTiles('1m2m3m'), { type: 'DESIGNATE_WINNING', index: 0 })
    s = reducer(s, { type: 'DESIGNATE_WINNING', index: 1 })
    expect(tilesToNotation(s.concealed)).toBe('1m2m')
    expect(s.winningTile).toEqual(t('3m'))
  })

  it('ignores a designation for an index that is not there', () => {
    const s = withTiles('1m')
    expect(reducer(s, { type: 'DESIGNATE_WINNING', index: 5 })).toBe(s)
  })

  it('clears the winning tile', () => {
    let s = reducer(initialState(), { type: 'SET_WINNING_TILE', tile: t('4p') })
    s = reducer(s, { type: 'CLEAR_WINNING_TILE' })
    expect(s.winningTile).toBeNull()
  })
})

describe('reducer — melds', () => {
  it('reduces concealed capacity by three per meld', () => {
    expect(concealedCapacity(initialState())).toBe(13)
    const s = reducer(initialState(), {
      type: 'ADD_MELD',
      meld: { kind: 'pon', tiles: parseTiles('222p'), calledTile: t('2p') },
    })
    expect(concealedCapacity(s)).toBe(10)
  })

  it('counts meld tiles toward the four-copy limit', () => {
    const s = reducer(initialState(), {
      type: 'ADD_MELD',
      meld: { kind: 'pon', tiles: parseTiles('222p'), calledTile: t('2p') },
    })
    expect(tileUsage(s)[10]).toBe(3)
  })

  it('removes a meld by index', () => {
    let s = reducer(initialState(), {
      type: 'ADD_MELD',
      meld: { kind: 'pon', tiles: parseTiles('222p'), calledTile: t('2p') },
    })
    s = reducer(s, { type: 'REMOVE_MELD', index: 0 })
    expect(s.melds).toHaveLength(0)
  })
})

describe('reducer — undo and clear', () => {
  it('undoes the last hand change', () => {
    const s = withTiles('1m2m')
    const undone = reducer(s, { type: 'UNDO' })
    expect(tilesToNotation(undone.concealed)).toBe('1m')
  })

  it('is a no-op when there is nothing to undo', () => {
    const s = initialState()
    expect(reducer(s, { type: 'UNDO' })).toBe(s)
  })

  it('clears the hand but can be undone', () => {
    const s = withTiles('1m2m3m')
    const cleared = reducer(s, { type: 'CLEAR' })
    expect(cleared.concealed).toHaveLength(0)
    expect(tilesToNotation(reducer(cleared, { type: 'UNDO' }).concealed)).toBe('1m2m3m')
  })

  it('does not put the concise preference on the undo stack', () => {
    let s = reducer(initialState(), { type: 'TOGGLE_CONCISE' })
    s = reducer(s, { type: 'ADD_TILE', tile: t('1m') })
    const undone = reducer(s, { type: 'UNDO' })
    expect(undone.concise).toBe(true)
    expect(undone.concealed).toHaveLength(0)
  })
})

describe('reducer — context and rules', () => {
  it('patches the win context', () => {
    const s = reducer(initialState(), { type: 'SET_CTX', patch: { seatWind: 'W', honba: 2 } })
    expect(s.ctx.seatWind).toBe('W')
    expect(s.ctx.honba).toBe(2)
    expect(s.ctx.roundWind).toBe('E')
  })

  it('patches the ruleset without mutating the WRC preset', () => {
    const s = reducer(initialState(), { type: 'SET_RULES', patch: { kuitan: false } })
    expect(s.rules.kuitan).toBe(false)
    expect(initialState().rules.kuitan).toBe(true)
  })

  it('toggles the win source', () => {
    const s = reducer(initialState(), { type: 'SET_WIN_SOURCE', source: 'tsumo' })
    expect(s.winSource).toBe('tsumo')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/ui/state/reducer.test.ts`
Expected: FAIL — cannot resolve `./reducer`.

- [ ] **Step 3: Write the state types**

Create `src/ui/state/types.ts`:

```ts
import type { Meld, Tile, WinContext, WinSource } from '../../engine/types'
import type { RuleSet } from '../../engine/rulesets/types'

/** The part of the state that undo restores. */
export interface HandSnapshot {
  concealed: Tile[]
  melds: Meld[]
  winningTile: Tile | null
  winSource: WinSource
  ctx: WinContext
}

export interface CalculatorState extends HandSnapshot {
  rules: RuleSet
  /** Collapse explanations. Persisted to localStorage; never on the undo stack. */
  concise: boolean
  history: HandSnapshot[]
}

export type Action =
  | { type: 'ADD_TILE'; tile: Tile }
  | { type: 'REMOVE_TILE'; index: number }
  | { type: 'SET_WINNING_TILE'; tile: Tile }
  | { type: 'DESIGNATE_WINNING'; index: number }
  | { type: 'CLEAR_WINNING_TILE' }
  | { type: 'ADD_MELD'; meld: Meld }
  | { type: 'REMOVE_MELD'; index: number }
  | { type: 'SET_WIN_SOURCE'; source: WinSource }
  | { type: 'SET_CTX'; patch: Partial<WinContext> }
  | { type: 'SET_RULES'; patch: Partial<RuleSet> }
  | { type: 'TOGGLE_CONCISE' }
  | { type: 'UNDO' }
  | { type: 'CLEAR' }
  | { type: 'LOAD'; snapshot: HandSnapshot }
```

- [ ] **Step 4: Write the selectors**

Create `src/ui/state/selectors.ts`:

```ts
import type { CalculatorState } from './types'
import type { Tile } from '../../engine/types'
import { tileId } from '../../engine/tiles'

/** Every tile the hand currently commits, including melds and the winning tile. */
export function committedTiles(state: CalculatorState): Tile[] {
  return [
    ...state.concealed,
    ...state.melds.flatMap((m) => m.tiles),
    ...(state.winningTile ? [state.winningTile] : []),
  ]
}

/**
 * Counts per distinct tile (34 entries). A red five is indistinguishable from a
 * normal five for wall-count purposes — there are four 5m either way.
 */
export function tileUsage(state: CalculatorState): number[] {
  const counts = new Array<number>(34).fill(0)
  for (const tile of committedTiles(state)) counts[tileId(tile)] += 1
  return counts
}

/** Concealed slots remaining. A meld occupies three of the fourteen; the winning tile one. */
export function concealedCapacity(state: CalculatorState): number {
  return 13 - state.melds.length * 3
}
```

- [ ] **Step 5: Write the reducer**

Create `src/ui/state/reducer.ts`:

```ts
import type { Action, CalculatorState, HandSnapshot } from './types'
import type { Tile, WinContext } from '../../engine/types'
import { sortTiles, tileId } from '../../engine/tiles'
import { WRC_2025 } from '../../engine/rulesets/wrc2025'
import { concealedCapacity, tileUsage } from './selectors'

const emptyContext = (): WinContext => ({
  seatWind: 'E', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
})

export function initialState(): CalculatorState {
  return {
    concealed: [], melds: [], winningTile: null, winSource: 'ron',
    ctx: emptyContext(), rules: WRC_2025, concise: false, history: [],
  }
}

const snapshot = (s: CalculatorState): HandSnapshot => ({
  concealed: s.concealed, melds: s.melds, winningTile: s.winningTile,
  winSource: s.winSource, ctx: s.ctx,
})

/** Applies a hand change, pushing the previous hand onto the undo stack. */
const change = (s: CalculatorState, next: Partial<HandSnapshot>): CalculatorState => ({
  ...s, ...next, history: [...s.history, snapshot(s)],
})

const hasRoomFor = (s: CalculatorState, tile: Tile): boolean =>
  tileUsage(s)[tileId(tile)] < 4

export function reducer(state: CalculatorState, action: Action): CalculatorState {
  switch (action.type) {
    case 'ADD_TILE': {
      if (state.concealed.length >= concealedCapacity(state)) return state
      if (!hasRoomFor(state, action.tile)) return state
      return change(state, { concealed: sortTiles([...state.concealed, action.tile]) })
    }

    case 'REMOVE_TILE':
      return change(state, {
        concealed: state.concealed.filter((_, i) => i !== action.index),
      })

    case 'SET_WINNING_TILE': {
      const cleared = { ...state, winningTile: null }
      if (!hasRoomFor(cleared, action.tile)) return state
      return change(state, { winningTile: action.tile })
    }

    case 'DESIGNATE_WINNING': {
      // Moves a tile out of the hand rather than copying it: the user has
      // entered all fourteen tiles and is now saying which one completed it.
      const tile = state.concealed[action.index]
      if (!tile) return state
      const remaining = state.concealed.filter((_, i) => i !== action.index)
      const restored = state.winningTile
        ? sortTiles([...remaining, state.winningTile])
        : remaining
      return change(state, { concealed: restored, winningTile: tile })
    }

    case 'CLEAR_WINNING_TILE':
      return change(state, { winningTile: null })

    case 'ADD_MELD': {
      if (concealedCapacity(state) - 3 < state.concealed.length) return state
      return change(state, { melds: [...state.melds, action.meld] })
    }

    case 'REMOVE_MELD':
      return change(state, { melds: state.melds.filter((_, i) => i !== action.index) })

    case 'SET_WIN_SOURCE':
      return change(state, { winSource: action.source })

    case 'SET_CTX':
      return change(state, { ctx: { ...state.ctx, ...action.patch } })

    case 'SET_RULES':
      return { ...state, rules: { ...state.rules, ...action.patch } }

    case 'TOGGLE_CONCISE':
      return { ...state, concise: !state.concise }

    case 'CLEAR':
      return change(state, {
        concealed: [], melds: [], winningTile: null,
        winSource: 'ron', ctx: emptyContext(),
      })

    case 'LOAD':
      return change(state, action.snapshot)

    case 'UNDO': {
      const previous = state.history.at(-1)
      if (!previous) return state
      return { ...state, ...previous, history: state.history.slice(0, -1) }
    }
  }
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/ui/state/reducer.test.ts`
Expected: 21 passed.

- [ ] **Step 7: Prove the four-copy guard bites**

In `reducer.ts`, change `hasRoomFor` to `return true`. Re-run the tests.
Expected: FAIL on "refuses a fifth copy", "counts a red five against its rank", and "counts the winning tile toward the four-copy limit".
Restore the guard. Record the failure list in your report.

- [ ] **Step 8: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the calculator reducer, state types and selectors"
```

---

## Task 5: The draft-to-engine adapter

**Files:**
- Create: `src/ui/state/toEngineInput.ts`
- Create: `src/ui/state/toEngineInput.test.ts`

**Interfaces:**
- Consumes: `CalculatorState` (Task 4), engine types `Hand`, `WinContext`.
- Produces: `toEngineInput(state: CalculatorState): EngineInput` where

```ts
export type EngineInput =
  | { ok: true; hand: Hand; ctx: WinContext }
  | { ok: false }
```

**Design note — spec §4.2, read this before implementing:** an incomplete draft gets **no diagnosis**. This function returns a bare `{ ok: false }`. Do not add a reason code, a list of what is missing, or guidance copy. That was explicitly cut from scope. Everything explanatory happens *after* `ok: true`, driven by the engine's own `CalculationStatus`.

The bar for `ok: true` is only "the engine can be called without a type error or a nonsense hand": a winning tile exists, and the slot count is exactly 14. Whether the hand is *legal* or *scorable* is the engine's judgement, not this function's — `validate()` and `decompose()` already answer that, and duplicating their logic here would create two sources of truth.

- [ ] **Step 1: Write the failing test**

Create `src/ui/state/toEngineInput.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toEngineInput } from './toEngineInput'
import { reducer, initialState } from './reducer'
import type { CalculatorState } from './types'
import { parseTiles, tilesToNotation } from '../../engine/tiles'

const t = (notation: string) => parseTiles(notation)[0]

const build = (concealed: string, winning?: string): CalculatorState => {
  let s = parseTiles(concealed).reduce(
    (acc, tile) => reducer(acc, { type: 'ADD_TILE', tile }),
    initialState(),
  )
  if (winning) s = reducer(s, { type: 'SET_WINNING_TILE', tile: t(winning) })
  return s
}

describe('toEngineInput', () => {
  it('refuses an empty draft', () => {
    expect(toEngineInput(initialState())).toEqual({ ok: false })
  })

  it('refuses a draft with no winning tile', () => {
    expect(toEngineInput(build('1112345678999m'))).toEqual({ ok: false })
  })

  it('refuses a draft with too few tiles', () => {
    expect(toEngineInput(build('123m', '4m'))).toEqual({ ok: false })
  })

  it('accepts a complete 14-slot hand', () => {
    const result = toEngineInput(build('1112345678999m', '9m'))
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(tilesToNotation(result.hand.concealed)).toBe('1112345678999m')
    expect(result.hand.winningTile).toEqual(t('9m'))
  })

  it('counts a meld as three of the fourteen slots', () => {
    let s = build('1234567m11p')
    s = reducer(s, {
      type: 'ADD_MELD',
      meld: { kind: 'pon', tiles: parseTiles('222s'), calledTile: t('2s') },
    })
    s = reducer(s, { type: 'SET_WINNING_TILE', tile: t('8m') })
    const result = toEngineInput(s)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.hand.melds).toHaveLength(1)
    expect(result.hand.concealed).toHaveLength(10)
  })

  it('carries the win source and context through unchanged', () => {
    let s = build('1112345678999m', '9m')
    s = reducer(s, { type: 'SET_WIN_SOURCE', source: 'tsumo' })
    s = reducer(s, { type: 'SET_CTX', patch: { seatWind: 'S', riichi: 'riichi', honba: 3 } })
    const result = toEngineInput(s)
    if (!result.ok) throw new Error('expected ok')
    expect(result.hand.winSource).toBe('tsumo')
    expect(result.ctx.seatWind).toBe('S')
    expect(result.ctx.riichi).toBe('riichi')
    expect(result.ctx.honba).toBe(3)
  })

  it('does not judge legality — that is the engine’s job', () => {
    // Fourteen slots of nonsense: five distinct honors, no possible structure.
    const result = toEngineInput(build('1122334455667z', '7z'))
    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/ui/state/toEngineInput.test.ts`
Expected: FAIL — cannot resolve `./toEngineInput`.

- [ ] **Step 3: Write the adapter**

Create `src/ui/state/toEngineInput.ts`:

```ts
import type { Hand, WinContext } from '../../engine/types'
import type { CalculatorState } from './types'

export type EngineInput =
  | { ok: true; hand: Hand; ctx: WinContext }
  | { ok: false }

/** The engine scores exactly fourteen slots; a meld occupies three of them. */
const SLOTS = 14

/**
 * The single seam between a hand under construction and the engine.
 *
 * Returns a bare { ok: false } for anything incomplete — deliberately no
 * diagnosis, per spec §4.2. Legality is not decided here: validate() and
 * decompose() own that, and a second opinion would be a second source of truth.
 */
export function toEngineInput(state: CalculatorState): EngineInput {
  if (!state.winningTile) return { ok: false }

  const slots = state.concealed.length + state.melds.length * 3 + 1
  if (slots !== SLOTS) return { ok: false }

  return {
    ok: true,
    hand: {
      concealed: state.concealed,
      melds: state.melds,
      winningTile: state.winningTile,
      winSource: state.winSource,
    },
    ctx: state.ctx,
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/ui/state/toEngineInput.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Prove the slot check bites**

Delete the `if (slots !== SLOTS) return { ok: false }` line. Re-run.
Expected: FAIL on "refuses a draft with too few tiles".
Restore it.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the draft-to-engine adapter"
```

---

## Task 6: URL hash codec and text entry parsing

**Files:**
- Create: `src/ui/state/hashCodec.ts`
- Create: `src/ui/state/hashCodec.test.ts`

**Interfaces:**
- Consumes: `HandSnapshot` (Task 4), `parseTiles` / `tilesToNotation` / `sortTiles` from `src/engine/tiles`.
- Produces:
  - `encodeHash(snapshot: HandSnapshot): string` — the fragment **without** the leading `#`
  - `decodeHash(hash: string): HandSnapshot | null` — `null` on anything malformed
  - `parseHandNotation(text: string): { concealed: Tile[] } | null` — for text entry mode

**Format (spec §6), version 1:**

```
v=1&h=234m456p789s55z&win=4p&w=tsumo&seat=S&round=E&riichi=1&ippatsu=1&dora=7p&ura=3s&honba=2&sticks=1
```

- `h` — concealed tiles in engine notation. `win` — the winning tile.
- `w` — `ron` or `tsumo`. `seat` / `round` — `E`/`S`/`W`/`N`.
- `riichi` — `0` none, `1` riichi, `2` double riichi.
- Boolean flags (`ippatsu`, `haitei`, `houtei`, `rinshan`, `chankan`, `tenhou`, `chiihou`) appear as `=1` and are **omitted entirely** when false, keeping the common URL short.
- `dora` / `ura` — indicator tiles in notation. Omitted when empty.
- `honba` / `sticks` — non-negative integers, omitted when zero.
- **Melds are omitted from v1 of the format.** A hand with melds encodes its concealed portion only; the meld round-trip is deliberately out of scope for v1 and the version marker exists so `v=2` can add it. State this limitation in the code comment.

**Robustness requirement:** `parseTiles` **throws** on unknown suits, trailing digits, and invalid honor ranks. Every call inside `decodeHash` and `parseHandNotation` must be inside a `try`, returning `null` rather than propagating. A hand-crafted or truncated URL must never crash the app.

- [ ] **Step 1: Write the failing test**

Create `src/ui/state/hashCodec.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encodeHash, decodeHash, parseHandNotation } from './hashCodec'
import type { HandSnapshot } from './types'
import { parseTiles, tilesToNotation } from '../../engine/tiles'

const t = (notation: string) => parseTiles(notation)[0]

const base: HandSnapshot = {
  concealed: parseTiles('234m456p789s55z'),
  melds: [],
  winningTile: t('4p'),
  winSource: 'ron',
  ctx: {
    seatWind: 'E', roundWind: 'E', riichi: 'none', ippatsu: false,
    haitei: false, houtei: false, rinshan: false, chankan: false,
    tenhou: false, chiihou: false,
    doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
  },
}

describe('encodeHash', () => {
  it('encodes the hand, winning tile and win source', () => {
    const hash = encodeHash(base)
    expect(hash).toContain('v=1')
    expect(hash).toContain('h=234m456p789s55z')
    expect(hash).toContain('win=4p')
    expect(hash).toContain('w=ron')
  })

  it('omits false flags and zero counters', () => {
    const hash = encodeHash(base)
    expect(hash).not.toContain('ippatsu')
    expect(hash).not.toContain('honba')
    expect(hash).not.toContain('sticks')
    expect(hash).not.toContain('dora')
  })

  it('includes flags that are set', () => {
    const hash = encodeHash({
      ...base,
      ctx: { ...base.ctx, riichi: 'riichi', ippatsu: true, honba: 2, riichiSticks: 1 },
    })
    expect(hash).toContain('riichi=1')
    expect(hash).toContain('ippatsu=1')
    expect(hash).toContain('honba=2')
    expect(hash).toContain('sticks=1')
  })

  it('encodes red fives as rank zero', () => {
    const hash = encodeHash({ ...base, concealed: parseTiles('0m') })
    expect(hash).toContain('h=0m')
  })
})

describe('decodeHash', () => {
  it('round-trips a plain hand', () => {
    const decoded = decodeHash(encodeHash(base))
    expect(decoded).not.toBeNull()
    expect(tilesToNotation(decoded!.concealed)).toBe('234m456p789s55z')
    expect(decoded!.winningTile).toEqual(t('4p'))
    expect(decoded!.winSource).toBe('ron')
  })

  it('round-trips a fully specified context', () => {
    const rich: HandSnapshot = {
      ...base,
      winSource: 'tsumo',
      ctx: {
        ...base.ctx,
        seatWind: 'W', roundWind: 'S', riichi: 'double', ippatsu: true,
        haitei: true, rinshan: true,
        doraIndicators: parseTiles('7p'), uraIndicators: parseTiles('3s'),
        honba: 3, riichiSticks: 2,
      },
    }
    const decoded = decodeHash(encodeHash(rich))!
    expect(decoded.winSource).toBe('tsumo')
    expect(decoded.ctx.seatWind).toBe('W')
    expect(decoded.ctx.roundWind).toBe('S')
    expect(decoded.ctx.riichi).toBe('double')
    expect(decoded.ctx.ippatsu).toBe(true)
    expect(decoded.ctx.haitei).toBe(true)
    expect(decoded.ctx.rinshan).toBe(true)
    expect(decoded.ctx.houtei).toBe(false)
    expect(tilesToNotation(decoded.ctx.doraIndicators)).toBe('7p')
    expect(tilesToNotation(decoded.ctx.uraIndicators)).toBe('3s')
    expect(decoded.ctx.honba).toBe(3)
    expect(decoded.ctx.riichiSticks).toBe(2)
  })

  it('tolerates a leading hash character', () => {
    expect(decodeHash('#' + encodeHash(base))).not.toBeNull()
  })

  it('rejects an unknown version', () => {
    expect(decodeHash('v=99&h=123m&win=4m')).toBeNull()
  })

  it('rejects a missing version', () => {
    expect(decodeHash('h=123m&win=4m')).toBeNull()
  })

  it('returns null rather than throwing on an unknown suit', () => {
    expect(decodeHash('v=1&h=123x&win=4m')).toBeNull()
  })

  it('returns null rather than throwing on trailing digits', () => {
    expect(decodeHash('v=1&h=123m4&win=4m')).toBeNull()
  })

  it('returns null rather than throwing on an invalid honor rank', () => {
    expect(decodeHash('v=1&h=9z&win=4m')).toBeNull()
  })

  it('returns null on a truncated hash with no winning tile', () => {
    expect(decodeHash('v=1&h=234m456p789s55z')).toBeNull()
  })

  it('returns null on an empty string', () => {
    expect(decodeHash('')).toBeNull()
  })

  it('clamps a negative honba rather than accepting it', () => {
    expect(decodeHash('v=1&h=123m&win=4m&honba=-5')).toBeNull()
  })
})

describe('parseHandNotation', () => {
  it('parses pasted notation', () => {
    const parsed = parseHandNotation('234m456p789s55z')
    expect(parsed).not.toBeNull()
    expect(tilesToNotation(parsed!.concealed)).toBe('234m456p789s55z')
  })

  it('ignores surrounding whitespace', () => {
    expect(parseHandNotation('  123m  ')).not.toBeNull()
  })

  it('preserves input order so the winning tile can be written last', () => {
    const parsed = parseHandNotation('99m1m')
    expect(parsed!.concealed.map((tile) => tile.rank)).toEqual([9, 9, 1])
  })

  it('returns null on nonsense rather than throwing', () => {
    expect(parseHandNotation('hello')).toBeNull()
    expect(parseHandNotation('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/ui/state/hashCodec.test.ts`
Expected: FAIL — cannot resolve `./hashCodec`.

- [ ] **Step 3: Write the codec**

Create `src/ui/state/hashCodec.ts`:

```ts
import type { RiichiState, Tile, Wind, WinContext, WinSource } from '../../engine/types'
import type { HandSnapshot } from './types'
import { parseTiles, sortTiles, tilesToNotation } from '../../engine/tiles'

const VERSION = '1'

const FLAGS = [
  'ippatsu', 'haitei', 'houtei', 'rinshan', 'chankan', 'tenhou', 'chiihou',
] as const

const RIICHI_TO_CODE: Record<RiichiState, string> = { none: '0', riichi: '1', double: '2' }
const CODE_TO_RIICHI: Record<string, RiichiState> = { '0': 'none', '1': 'riichi', '2': 'double' }

const WINDS: readonly Wind[] = ['E', 'S', 'W', 'N']

const isWind = (value: string): value is Wind => (WINDS as readonly string[]).includes(value)

/**
 * Serialises a hand to a URL fragment in standard mahjong notation.
 *
 * Melds are NOT represented in v1. A hand with called sets encodes its
 * concealed portion only; the version marker exists so a v2 can add them
 * without breaking links already in the wild.
 */
export function encodeHash(snapshot: HandSnapshot): string {
  const parts: string[] = [`v=${VERSION}`]
  const { ctx } = snapshot

  parts.push(`h=${tilesToNotation(sortTiles(snapshot.concealed))}`)
  if (snapshot.winningTile) parts.push(`win=${tilesToNotation([snapshot.winningTile])}`)
  parts.push(`w=${snapshot.winSource}`)
  parts.push(`seat=${ctx.seatWind}`)
  parts.push(`round=${ctx.roundWind}`)

  if (ctx.riichi !== 'none') parts.push(`riichi=${RIICHI_TO_CODE[ctx.riichi]}`)
  for (const flag of FLAGS) if (ctx[flag]) parts.push(`${flag}=1`)

  if (ctx.doraIndicators.length > 0) parts.push(`dora=${tilesToNotation(ctx.doraIndicators)}`)
  if (ctx.uraIndicators.length > 0) parts.push(`ura=${tilesToNotation(ctx.uraIndicators)}`)
  if (ctx.honba > 0) parts.push(`honba=${ctx.honba}`)
  if (ctx.riichiSticks > 0) parts.push(`sticks=${ctx.riichiSticks}`)

  return parts.join('&')
}

/** parseTiles throws on malformed notation; a bad URL must never crash the app. */
function safeParse(notation: string): Tile[] | null {
  try {
    return parseTiles(notation)
  } catch {
    return null
  }
}

function readCount(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key)
  if (raw === null) return 0
  if (!/^\d+$/.test(raw)) return null
  return Number(raw)
}

export function decodeHash(hash: string): HandSnapshot | null {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  if (trimmed.length === 0) return null

  const params = new URLSearchParams(trimmed)
  if (params.get('v') !== VERSION) return null

  const concealed = safeParse(params.get('h') ?? '')
  if (concealed === null) return null

  const winRaw = params.get('win')
  if (!winRaw) return null
  const winTiles = safeParse(winRaw)
  if (winTiles === null || winTiles.length !== 1) return null

  const winSource = params.get('w')
  if (winSource !== 'ron' && winSource !== 'tsumo') return null

  const seat = params.get('seat') ?? 'E'
  const round = params.get('round') ?? 'E'
  if (!isWind(seat) || !isWind(round)) return null

  const riichiRaw = params.get('riichi')
  const riichi = riichiRaw === null ? 'none' : CODE_TO_RIICHI[riichiRaw]
  if (!riichi) return null

  const dora = safeParse(params.get('dora') ?? '')
  const ura = safeParse(params.get('ura') ?? '')
  if (dora === null || ura === null) return null

  const honba = readCount(params, 'honba')
  const riichiSticks = readCount(params, 'sticks')
  if (honba === null || riichiSticks === null) return null

  const ctx: WinContext = {
    seatWind: seat,
    roundWind: round,
    riichi,
    ippatsu: params.get('ippatsu') === '1',
    haitei: params.get('haitei') === '1',
    houtei: params.get('houtei') === '1',
    rinshan: params.get('rinshan') === '1',
    chankan: params.get('chankan') === '1',
    tenhou: params.get('tenhou') === '1',
    chiihou: params.get('chiihou') === '1',
    doraIndicators: dora,
    uraIndicators: ura,
    honba,
    riichiSticks,
  }

  return {
    concealed: sortTiles(concealed),
    melds: [],
    winningTile: winTiles[0],
    winSource: winSource as WinSource,
    ctx,
  }
}

/** Text entry mode: accept pasted notation instead of fourteen clicks. */
export function parseHandNotation(text: string): { concealed: Tile[] } | null {
  const trimmed = text.trim()
  if (trimmed.length === 0) return null
  const tiles = safeParse(trimmed)
  if (tiles === null || tiles.length === 0) return null
  // Input order is preserved deliberately. By convention the winning tile is
  // written last, and App relies on that to split a fourteen-tile paste into
  // thirteen concealed tiles plus the tile that completed the hand.
  return { concealed: tiles }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/ui/state/hashCodec.test.ts`
Expected: 20 passed.

- [ ] **Step 5: Prove the try/catch is load-bearing**

In `safeParse`, replace the body with `return parseTiles(notation)` (no try/catch). Re-run.
Expected: the three "returns null rather than throwing" tests FAIL with a thrown error rather than a null.
Restore the try/catch. Record this in your report — defensive decoding is the whole point of the test group.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the URL hash codec and text-entry notation parser"
```

---

## Task 7: The useCalculator hook

**Files:**
- Create: `src/ui/state/useCalculator.ts`
- Create: `src/ui/state/useCalculator.test.tsx`

**Interfaces:**
- Consumes: `reducer` / `initialState` (Task 4), `toEngineInput` (Task 5), `encodeHash` / `decodeHash` (Task 6), `calculate` and `WRC_2025` from the engine.
- Produces:

```ts
export interface Calculator {
  state: CalculatorState
  dispatch: (action: Action) => void
  /** null while the draft is incomplete. */
  result: CalculationResult | null
}
export function useCalculator(): Calculator
```

**Behaviour:**
- On first mount, read `window.location.hash`; if it decodes, `LOAD` it. A hash that fails to decode is ignored silently — no crash, no notice needed at this layer.
- On every state change, write `encodeHash` back to `window.location.hash` using `history.replaceState`, so building a hand does not fill the browser's back stack with fourteen entries.
- Read the `concise` preference from `localStorage` on mount and write it on change. **Both must be wrapped in try/catch** — a browser blocking site data throws on access, and the app must render correctly anyway (spec §6.4).
- `result` is `calculate(hand, ctx, rules)` when `toEngineInput` returns `ok`, otherwise `null`. Memoise on the inputs.

- [ ] **Step 1: Write the failing test**

Create `src/ui/state/useCalculator.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useCalculator } from './useCalculator'
import { parseTiles, tilesToNotation } from '../../engine/tiles'

const t = (notation: string) => parseTiles(notation)[0]

const CONCISE_KEY = 'riichi.concise'

afterEach(() => vi.restoreAllMocks())

describe('useCalculator', () => {
  it('returns no result while the draft is incomplete', () => {
    const { result } = renderHook(() => useCalculator())
    expect(result.current.result).toBeNull()
  })

  it('scores a complete hand', () => {
    const { result } = renderHook(() => useCalculator())
    act(() => {
      for (const tile of parseTiles('234m456p789s55z')) {
        result.current.dispatch({ type: 'ADD_TILE', tile })
      }
      result.current.dispatch({ type: 'SET_WINNING_TILE', tile: t('4p') })
    })
    expect(result.current.result).not.toBeNull()
    expect(result.current.result!.status).toBeDefined()
  })

  it('writes the hand to the URL hash', () => {
    const { result } = renderHook(() => useCalculator())
    act(() => {
      result.current.dispatch({ type: 'ADD_TILE', tile: t('1m') })
    })
    expect(window.location.hash).toContain('h=1m')
    expect(window.location.hash).toContain('v=1')
  })

  it('does not push a history entry per tile', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const pushState = vi.spyOn(window.history, 'pushState')
    const { result } = renderHook(() => useCalculator())
    act(() => {
      result.current.dispatch({ type: 'ADD_TILE', tile: t('1m') })
    })
    expect(replaceState).toHaveBeenCalled()
    expect(pushState).not.toHaveBeenCalled()
  })

  it('loads a hand from the hash on mount', () => {
    window.location.hash = 'v=1&h=234m456p789s55z&win=4p&w=ron&seat=E&round=E'
    const { result } = renderHook(() => useCalculator())
    expect(tilesToNotation(result.current.state.concealed)).toBe('234m456p789s55z')
    expect(result.current.state.winningTile).toEqual(t('4p'))
  })

  it('ignores a malformed hash instead of crashing', () => {
    window.location.hash = 'v=1&h=@@@garbage'
    const { result } = renderHook(() => useCalculator())
    expect(result.current.state.concealed).toHaveLength(0)
  })

  it('restores the concise preference from localStorage', () => {
    window.localStorage.setItem(CONCISE_KEY, 'true')
    const { result } = renderHook(() => useCalculator())
    expect(result.current.state.concise).toBe(true)
  })

  it('persists the concise preference when toggled', () => {
    const { result } = renderHook(() => useCalculator())
    act(() => result.current.dispatch({ type: 'TOGGLE_CONCISE' }))
    expect(window.localStorage.getItem(CONCISE_KEY)).toBe('true')
  })

  it('renders normally when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('site data blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('site data blocked')
    })
    const { result } = renderHook(() => useCalculator())
    expect(result.current.state.concise).toBe(false)
    act(() => result.current.dispatch({ type: 'TOGGLE_CONCISE' }))
    expect(result.current.state.concise).toBe(true)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/ui/state/useCalculator.test.tsx`
Expected: FAIL — cannot resolve `./useCalculator`.

- [ ] **Step 3: Write the hook**

Create `src/ui/state/useCalculator.ts`:

```ts
import { useEffect, useMemo, useReducer } from 'react'
import type { Action, CalculatorState } from './types'
import type { CalculationResult } from '../../engine/calculate'
import { calculate } from '../../engine/calculate'
import { initialState, reducer } from './reducer'
import { toEngineInput } from './toEngineInput'
import { decodeHash, encodeHash } from './hashCodec'

const CONCISE_KEY = 'riichi.concise'

/** localStorage throws outright in some privacy modes; never let that reach render. */
function readConcise(): boolean {
  try {
    return window.localStorage.getItem(CONCISE_KEY) === 'true'
  } catch {
    return false
  }
}

function writeConcise(value: boolean): void {
  try {
    window.localStorage.setItem(CONCISE_KEY, String(value))
  } catch {
    // Preference is a convenience; losing it must not break the app.
  }
}

function bootstrap(): CalculatorState {
  const base = { ...initialState(), concise: readConcise() }
  const fromHash = decodeHash(window.location.hash)
  if (!fromHash) return base
  return { ...base, ...fromHash }
}

export interface Calculator {
  state: CalculatorState
  dispatch: (action: Action) => void
  result: CalculationResult | null
}

export function useCalculator(): Calculator {
  const [state, dispatch] = useReducer(reducer, undefined, bootstrap)

  const result = useMemo(() => {
    const input = toEngineInput(state)
    if (!input.ok) return null
    return calculate(input.hand, input.ctx, state.rules)
  }, [state])

  useEffect(() => {
    // replaceState, not a hash assignment: fourteen tiles must not become
    // fourteen back-button steps.
    const hash = encodeHash(state)
    window.history.replaceState(null, '', `${window.location.pathname}#${hash}`)
  }, [state])

  useEffect(() => {
    writeConcise(state.concise)
  }, [state.concise])

  return { state, dispatch, result }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/ui/state/useCalculator.test.tsx`
Expected: 9 passed.

- [ ] **Step 5: Prove the localStorage guard bites**

Remove the `try`/`catch` from `readConcise` and re-run.
Expected: FAIL on "renders normally when localStorage throws".
Restore it.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add useCalculator tying state, engine, hash and preferences"
```

---

## Task 8: Tile palette

**Files:**
- Create: `src/ui/calculator/TilePalette.tsx`
- Create: `src/ui/calculator/TilePalette.test.tsx`
- Create: `src/ui/calculator/calculator.css`
- Create: `src/content/tiles.ts`
- Create: `src/content/tiles.test.ts`

**Interfaces:**
- Consumes: `<Tile>` (Task 3), `tileUsage` / `concealedCapacity` (Task 4).
- Produces:
  - `tileName(tile): string` in `src/content/tiles.ts` — accessible names, e.g. `'Two of characters'`, `'Red five of circles'`, `'East wind'`, `'White dragon'`
  - `<TilePalette usage={number[]} onSelect={(tile) => void} disabled?: boolean />`

**Remember the boundary:** tile names are copy. They live in `src/content/tiles.ts`, which must not import from the engine. Type its parameter structurally.

- [ ] **Step 1: Write the content module and its test**

Create `src/content/tiles.ts`:

```ts
/**
 * Accessible names for tiles, used as button labels and image alt text.
 * Structural parameter type — content must not import from the engine.
 */
export interface TileLike { suit: string; rank: number; red: boolean }

const SUIT_NAMES: Record<string, string> = {
  m: 'characters',
  p: 'circles',
  s: 'bamboo',
}

const NUMBER_NAMES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
]

const HONOR_NAMES: Record<number, string> = {
  1: 'East wind', 2: 'South wind', 3: 'West wind', 4: 'North wind',
  5: 'White dragon', 6: 'Green dragon', 7: 'Red dragon',
}

export function tileName(tile: TileLike): string {
  if (tile.suit === 'z') return HONOR_NAMES[tile.rank] ?? 'Unknown tile'
  const suit = SUIT_NAMES[tile.suit]
  if (!suit) return 'Unknown tile'
  const number = NUMBER_NAMES[tile.rank] ?? 'Unknown'
  return tile.red ? `Red ${number.toLowerCase()} of ${suit}` : `${number} of ${suit}`
}
```

Create `src/content/tiles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tileName } from './tiles'

describe('tileName', () => {
  it('names numbered tiles', () => {
    expect(tileName({ suit: 'm', rank: 2, red: false })).toBe('Two of characters')
    expect(tileName({ suit: 'p', rank: 9, red: false })).toBe('Nine of circles')
    expect(tileName({ suit: 's', rank: 1, red: false })).toBe('One of bamboo')
  })

  it('names red fives distinctly', () => {
    expect(tileName({ suit: 'm', rank: 5, red: true })).toBe('Red five of characters')
    expect(tileName({ suit: 'm', rank: 5, red: false })).toBe('Five of characters')
  })

  it('names the winds and dragons', () => {
    expect(tileName({ suit: 'z', rank: 1, red: false })).toBe('East wind')
    expect(tileName({ suit: 'z', rank: 4, red: false })).toBe('North wind')
    expect(tileName({ suit: 'z', rank: 5, red: false })).toBe('White dragon')
    expect(tileName({ suit: 'z', rank: 7, red: false })).toBe('Red dragon')
  })

  it('never returns an empty string for any real tile', () => {
    for (const suit of ['m', 'p', 's']) {
      for (let rank = 1; rank <= 9; rank++) {
        expect(tileName({ suit, rank, red: false }).length).toBeGreaterThan(0)
      }
    }
    for (let rank = 1; rank <= 7; rank++) {
      expect(tileName({ suit: 'z', rank, red: false }).length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run the content test**

Run: `npx vitest run src/content/tiles.test.ts`
Expected: 4 passed.

- [ ] **Step 3: Write the failing palette test**

Create `src/ui/calculator/TilePalette.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TilePalette } from './TilePalette'
import { tileId, parseTiles } from '../../engine/tiles'

const emptyUsage = () => new Array<number>(34).fill(0)

describe('TilePalette', () => {
  it('offers all 34 tiles plus the three red fives', () => {
    render(<TilePalette usage={emptyUsage()} onSelect={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(37)
  })

  it('passes the selected tile to onSelect', async () => {
    const onSelect = vi.fn()
    render(<TilePalette usage={emptyUsage()} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Two of circles/ }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ suit: 'p', rank: 2, red: false }),
    )
  })

  it('passes a red five with red set', async () => {
    const onSelect = vi.fn()
    render(<TilePalette usage={emptyUsage()} onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /Red five of bamboo/ }))
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ suit: 's', rank: 5, red: true }),
    )
  })

  it('shows how many copies are used', () => {
    const usage = emptyUsage()
    usage[tileId(parseTiles('3m')[0])] = 2
    render(<TilePalette usage={usage} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Three of characters/ })).toHaveTextContent('2')
  })

  it('disables a tile at four copies', async () => {
    const usage = emptyUsage()
    usage[tileId(parseTiles('3m')[0])] = 4
    const onSelect = vi.fn()
    render(<TilePalette usage={usage} onSelect={onSelect} />)
    const button = screen.getByRole('button', { name: /Three of characters/ })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('disables the red five when its rank is exhausted', () => {
    const usage = emptyUsage()
    usage[tileId(parseTiles('5s')[0])] = 4
    render(<TilePalette usage={usage} onSelect={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Red five of bamboo/ })).toBeDisabled()
  })

  it('disables everything when the hand is full', () => {
    render(<TilePalette usage={emptyUsage()} onSelect={vi.fn()} disabled />)
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })
})
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run src/ui/calculator/TilePalette.test.tsx`
Expected: FAIL — cannot resolve `./TilePalette`.

- [ ] **Step 5: Write the palette**

Create `src/ui/calculator/TilePalette.tsx`:

```tsx
import type { Suit, Tile as TileModel } from '../../engine/types'
import { tileId } from '../../engine/tiles'
import { tileName } from '../../content/tiles'
import { Tile } from '../tiles/Tile'
import './calculator.css'

interface PaletteGroup {
  suit: Suit
  tiles: TileModel[]
}

function buildGroups(): PaletteGroup[] {
  const numbered = (suit: Suit): TileModel[] => {
    const tiles: TileModel[] = []
    for (let rank = 1; rank <= 9; rank++) tiles.push({ suit, rank, red: false })
    // The red five sits immediately after its ordinary counterpart.
    tiles.splice(5, 0, { suit, rank: 5, red: true })
    return tiles
  }
  const honors: TileModel[] = []
  for (let rank = 1; rank <= 7; rank++) honors.push({ suit: 'z', rank, red: false })

  return [
    { suit: 'm', tiles: numbered('m') },
    { suit: 'p', tiles: numbered('p') },
    { suit: 's', tiles: numbered('s') },
    { suit: 'z', tiles: honors },
  ]
}

const GROUPS = buildGroups()

export interface TilePaletteProps {
  /** 34 counts, indexed by engine tileId. */
  usage: number[]
  onSelect: (tile: TileModel) => void
  /** Set when the hand has no room left, regardless of individual counts. */
  disabled?: boolean
}

export function TilePalette({ usage, onSelect, disabled = false }: TilePaletteProps) {
  return (
    <div className="palette">
      {GROUPS.map((group) => (
        <div className="palette__group" key={group.suit}>
          {group.tiles.map((tile) => {
            const used = usage[tileId(tile)]
            const exhausted = used >= 4
            const isDisabled = disabled || exhausted
            return (
              <span className="palette__slot" key={`${tile.rank}${tile.suit}${tile.red}`}>
                <button
                  type="button"
                  className="palette__button"
                  disabled={isDisabled}
                  aria-label={tileName(tile)}
                  onClick={() => onSelect(tile)}
                >
                  <Tile tile={tile} size="md" state={exhausted ? 'dimmed' : 'normal'} />
                  <span className="palette__count" aria-hidden="true">{used}</span>
                </button>
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

Note the palette renders its own `<button>` wrapping a non-clickable `<Tile>`, rather than passing `onClick` to `Tile`. That keeps the count badge inside the button's accessible name and avoids nesting a button in a button.

- [ ] **Step 6: Add the stylesheet**

Create `src/ui/calculator/calculator.css`:

```css
.palette { display: flex; flex-direction: column; gap: 10px; }
.palette__group { display: flex; flex-wrap: wrap; gap: 4px; }
.palette__slot { position: relative; }

.palette__button {
  position: relative;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  line-height: 0;
}
.palette__button:disabled { cursor: not-allowed; }
.palette__button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }

.palette__count {
  position: absolute;
  right: 1px;
  bottom: 1px;
  min-width: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: rgba(17, 24, 39, 0.78);
  color: #fff;
  font-size: 10px;
  line-height: 14px;
  text-align: center;
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/ui/calculator/TilePalette.test.tsx`
Expected: 7 passed.

- [ ] **Step 8: Prove the exhaustion guard bites**

Change `const exhausted = used >= 4` to `const exhausted = false`. Re-run.
Expected: FAIL on "disables a tile at four copies" and "disables the red five when its rank is exhausted".
Restore it.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the tile palette and tile name copy"
```

---

## Task 9: Hand workspace

**Files:**
- Create: `src/ui/calculator/HandWorkspace.tsx`
- Create: `src/ui/calculator/HandWorkspace.test.tsx`
- Modify: `src/ui/calculator/calculator.css`
- Modify: `src/content/status.ts` (create in this task)

**Interfaces:**
- Consumes: `<Tile>` / `<TileRow>` (Task 3), `tileName` (Task 8), `CalculatorState` and `Action` (Task 4).
- Produces: `<HandWorkspace state={CalculatorState} dispatch={(a: Action) => void} />`

**Behaviour (spec §7.3):**
- Three regions: **concealed tiles**, the **winning tile** (visually separated), and **called sets**.
- Clicking a concealed tile removes it. Clicking the winning tile clears it.
- A tile clicked in the concealed row can instead be *designated* as the winning tile — provide an explicit "Set as winning tile" affordance rather than overloading the click. Overloading click with a modifier is not discoverable on touch.
- Persistent **Undo** and **Clear hand** buttons. Undo is disabled when history is empty.
- The winning tile slot carries an inline explanation of why it is required (PLD §10) — copy lives in `src/content/status.ts`.

- [ ] **Step 1: Write the status copy module**

Create `src/content/status.ts`:

```ts
/**
 * Copy for hand-entry affordances and engine status. Content layer: no engine
 * imports, no React.
 */
export const HAND_COPY = {
  concealedHeading: 'Your hand',
  winningTileHeading: 'Winning tile',
  meldsHeading: 'Called sets',
  emptyHand: 'Pick tiles below to build your hand.',
  noWinningTile: 'Choose the tile you won on.',
  whyWinningTile:
    'The winning tile is scored separately because how you completed the hand changes its value — ' +
    'a closed triplet finished by a discard counts as an open one, and the shape you were waiting on is worth fu.',
  setAsWinning: 'Set as winning tile',
  clearWinningTile: 'Clear winning tile',
  undo: 'Undo',
  clearHand: 'Clear hand',
} as const

export const MELD_COPY = {
  addCalledSet: 'Add called set',
  chi: 'Chi (run)',
  pon: 'Pon (triplet)',
  minkan: 'Open kan',
  ankan: 'Closed kan',
  shouminkan: 'Added kan',
  remove: 'Remove called set',
  cancel: 'Cancel',
  confirm: 'Add',
} as const
```

- [ ] **Step 2: Write the failing test**

Create `src/ui/calculator/HandWorkspace.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { HandWorkspace } from './HandWorkspace'
import { reducer, initialState } from '../state/reducer'
import type { CalculatorState } from '../state/types'
import { parseTiles } from '../../engine/tiles'

const t = (notation: string) => parseTiles(notation)[0]

const build = (concealed: string, winning?: string): CalculatorState => {
  let s = parseTiles(concealed).reduce(
    (acc, tile) => reducer(acc, { type: 'ADD_TILE', tile }),
    initialState(),
  )
  if (winning) s = reducer(s, { type: 'SET_WINNING_TILE', tile: t(winning) })
  return s
}

describe('HandWorkspace', () => {
  it('prompts when the hand is empty', () => {
    render(<HandWorkspace state={initialState()} dispatch={vi.fn()} />)
    expect(screen.getByText(/Pick tiles below/)).toBeInTheDocument()
  })

  it('renders the concealed tiles', () => {
    const { container } = render(<HandWorkspace state={build('123m')} dispatch={vi.fn()} />)
    const concealed = container.querySelector('.workspace__concealed')!
    expect(concealed.querySelectorAll('use')).toHaveLength(3)
  })

  it('removes a concealed tile when clicked', async () => {
    const dispatch = vi.fn()
    render(<HandWorkspace state={build('123m')} dispatch={dispatch} />)
    const region = screen.getByRole('group', { name: 'Your hand' })
    await userEvent.click(within(region).getAllByRole('button')[0])
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_TILE', index: 0 })
  })

  it('shows the winning-tile prompt and explanation when none is set', () => {
    render(<HandWorkspace state={build('123m')} dispatch={vi.fn()} />)
    expect(screen.getByText(/Choose the tile you won on/)).toBeInTheDocument()
    expect(screen.getByText(/scored separately/)).toBeInTheDocument()
  })

  it('renders the winning tile separately from the concealed hand', () => {
    const { container } = render(
      <HandWorkspace state={build('123m', '4m')} dispatch={vi.fn()} />,
    )
    expect(container.querySelector('.workspace__concealed')!.querySelectorAll('use'))
      .toHaveLength(3)
    expect(container.querySelector('.workspace__winning')!.querySelectorAll('use'))
      .toHaveLength(1)
  })

  it('clears the winning tile when it is clicked', async () => {
    const dispatch = vi.fn()
    render(<HandWorkspace state={build('123m', '4m')} dispatch={dispatch} />)
    await userEvent.click(screen.getByRole('button', { name: /Clear winning tile/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'CLEAR_WINNING_TILE' })
  })

  it('designates a concealed tile as the winning tile', async () => {
    const dispatch = vi.fn()
    render(<HandWorkspace state={build('123m')} dispatch={dispatch} />)
    await userEvent.click(screen.getAllByRole('button', { name: /Set as winning tile/ })[0])
    expect(dispatch).toHaveBeenCalledWith({ type: 'DESIGNATE_WINNING', index: 0 })
  })

  it('disables undo when there is no history', () => {
    render(<HandWorkspace state={initialState()} dispatch={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
  })

  it('enables undo once the hand has changed', () => {
    render(<HandWorkspace state={build('1m')} dispatch={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  it('dispatches undo and clear', async () => {
    const dispatch = vi.fn()
    render(<HandWorkspace state={build('1m')} dispatch={dispatch} />)
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNDO' })
    await userEvent.click(screen.getByRole('button', { name: 'Clear hand' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'CLEAR' })
  })

  it('renders called sets and removes them', async () => {
    const dispatch = vi.fn()
    const state = reducer(build('123m'), {
      type: 'ADD_MELD',
      meld: { kind: 'pon', tiles: parseTiles('222p'), calledTile: t('2p') },
    })
    render(<HandWorkspace state={state} dispatch={dispatch} />)
    await userEvent.click(screen.getByRole('button', { name: /Remove called set/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_MELD', index: 0 })
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/ui/calculator/HandWorkspace.test.tsx`
Expected: FAIL — cannot resolve `./HandWorkspace`.

- [ ] **Step 4: Write the component**

Create `src/ui/calculator/HandWorkspace.tsx`:

```tsx
import type { Action, CalculatorState } from '../state/types'
import { tileName } from '../../content/tiles'
import { HAND_COPY, MELD_COPY } from '../../content/status'
import { Tile } from '../tiles/Tile'
import './calculator.css'

export interface HandWorkspaceProps {
  state: CalculatorState
  dispatch: (action: Action) => void
}

export function HandWorkspace({ state, dispatch }: HandWorkspaceProps) {
  const { concealed, melds, winningTile, history } = state

  return (
    <div className="workspace">
      <section
        className="workspace__section"
        role="group"
        aria-label={HAND_COPY.concealedHeading}
      >
        <h2 className="workspace__heading">{HAND_COPY.concealedHeading}</h2>
        {concealed.length === 0 ? (
          <p className="workspace__hint">{HAND_COPY.emptyHand}</p>
        ) : (
          <div className="workspace__concealed">
            {concealed.map((tile, index) => (
              <span className="workspace__slot" key={`${index}-${tile.suit}${tile.rank}`}>
                <Tile
                  tile={tile}
                  label={tileName(tile)}
                  onClick={() => dispatch({ type: 'REMOVE_TILE', index })}
                />
                <button
                  type="button"
                  className="workspace__designate"
                  aria-label={`${HAND_COPY.setAsWinning}: ${tileName(tile)}`}
                  onClick={() => dispatch({ type: 'DESIGNATE_WINNING', index })}
                >
                  ★
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section
        className="workspace__section"
        role="group"
        aria-label={HAND_COPY.winningTileHeading}
      >
        <h2 className="workspace__heading">{HAND_COPY.winningTileHeading}</h2>
        <div className="workspace__winning">
          {winningTile ? (
            <Tile
              tile={winningTile}
              size="lg"
              label={`${HAND_COPY.clearWinningTile}: ${tileName(winningTile)}`}
              onClick={() => dispatch({ type: 'CLEAR_WINNING_TILE' })}
            />
          ) : (
            <p className="workspace__hint">{HAND_COPY.noWinningTile}</p>
          )}
        </div>
        <p className="workspace__why">{HAND_COPY.whyWinningTile}</p>
      </section>

      {melds.length > 0 && (
        <section
          className="workspace__section"
          role="group"
          aria-label={HAND_COPY.meldsHeading}
        >
          <h2 className="workspace__heading">{HAND_COPY.meldsHeading}</h2>
          <div className="workspace__melds">
            {melds.map((meld, index) => (
              <span className="workspace__meld" key={index}>
                {meld.tiles.map((tile, i) => (
                  <Tile key={i} tile={tile} size="sm" label={tileName(tile)} />
                ))}
                <button
                  type="button"
                  className="workspace__remove-meld"
                  aria-label={MELD_COPY.remove}
                  onClick={() => dispatch({ type: 'REMOVE_MELD', index })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      <div className="workspace__controls">
        <button
          type="button"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={history.length === 0}
        >
          {HAND_COPY.undo}
        </button>
        <button type="button" onClick={() => dispatch({ type: 'CLEAR' })}>
          {HAND_COPY.clearHand}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Extend the stylesheet**

Append to `src/ui/calculator/calculator.css`:

```css
.workspace { display: flex; flex-direction: column; gap: 16px; }
.workspace__section { display: flex; flex-direction: column; gap: 6px; }
.workspace__heading { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.65; }
.workspace__hint { margin: 0; opacity: 0.6; font-size: 14px; }
.workspace__why { margin: 0; font-size: 12px; line-height: 1.5; opacity: 0.6; max-width: 52ch; }

.workspace__concealed { display: flex; flex-wrap: wrap; gap: 3px; min-height: 60px; }
.workspace__slot { position: relative; display: inline-block; }

.workspace__designate {
  position: absolute; top: -6px; right: -6px;
  width: 18px; height: 18px; padding: 0;
  border: none; border-radius: 50%;
  background: rgba(17, 24, 39, 0.78); color: #fbbf24;
  font-size: 11px; line-height: 18px; cursor: pointer;
  opacity: 0; transition: opacity 120ms ease;
}
.workspace__slot:hover .workspace__designate,
.workspace__designate:focus-visible { opacity: 1; }

.workspace__winning {
  min-height: 76px; display: flex; align-items: center;
  padding: 8px 12px; border-left: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.07);
}

.workspace__melds { display: flex; flex-wrap: wrap; gap: 12px; }
.workspace__meld { display: inline-flex; align-items: center; gap: 1px; padding: 4px; background: rgba(0,0,0,0.04); border-radius: 4px; }
.workspace__remove-meld { margin-left: 4px; border: none; background: none; cursor: pointer; font-size: 14px; opacity: 0.6; }

.workspace__controls { display: flex; gap: 8px; }
.workspace__controls button { padding: 6px 14px; cursor: pointer; }
.workspace__controls button:disabled { opacity: 0.45; cursor: not-allowed; }
```

The designate button is hidden until hover **or keyboard focus** — `:focus-visible` in that selector is what keeps it reachable without a mouse. Do not drop it.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/ui/calculator/HandWorkspace.test.tsx`
Expected: 11 passed.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the hand workspace"
```

---

## Task 10: Meld editor

**Files:**
- Create: `src/ui/calculator/MeldEditor.tsx`
- Create: `src/ui/calculator/MeldEditor.test.tsx`
- Modify: `src/ui/calculator/calculator.css`

**Interfaces:**
- Consumes: `<TilePalette>` (Task 8), `MELD_COPY` (Task 9), engine `Meld` / `MeldKind`.
- Produces: `<MeldEditor usage={number[]} onAdd={(meld: Meld) => void} />`

**Behaviour:**
1. A closed **Add called set** button opens the editor.
2. Choose a kind: chi, pon, open kan, closed kan, added kan.
3. Pick the **base tile** from the palette. The editor derives the full set:
   - `pon` → three copies. `minkan` / `ankan` / `shouminkan` → four copies.
   - `chi` → the base tile plus the next two ranks (base must be rank 1–7 in a numbered suit).
4. `calledTile` is the base tile for every kind **except `ankan`**, which has none (engine `Meld.calledTile` is optional and absent for a closed kan).
5. Chi is only legal in a numbered suit at rank ≤ 7. Disable honors and ranks 8–9 in chi mode rather than allowing an invalid set.

- [ ] **Step 1: Write the failing test**

Create `src/ui/calculator/MeldEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { MeldEditor } from './MeldEditor'
import { tilesToNotation } from '../../engine/tiles'

const emptyUsage = () => new Array<number>(34).fill(0)

const open = async () => {
  await userEvent.click(screen.getByRole('button', { name: /Add called set/ }))
}

describe('MeldEditor', () => {
  it('is collapsed until opened', () => {
    render(<MeldEditor usage={emptyUsage()} onAdd={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Pon/ })).toBeNull()
  })

  it('builds a pon of three identical tiles', async () => {
    const onAdd = vi.fn()
    render(<MeldEditor usage={emptyUsage()} onAdd={onAdd} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Pon/ }))
    await userEvent.click(screen.getByRole('button', { name: /Two of circles/ }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    const meld = onAdd.mock.calls[0][0]
    expect(meld.kind).toBe('pon')
    expect(tilesToNotation(meld.tiles)).toBe('222p')
    expect(meld.calledTile).toEqual(expect.objectContaining({ suit: 'p', rank: 2 }))
  })

  it('builds a chi as three consecutive ranks', async () => {
    const onAdd = vi.fn()
    render(<MeldEditor usage={emptyUsage()} onAdd={onAdd} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Chi/ }))
    await userEvent.click(screen.getByRole('button', { name: /Three of bamboo/ }))
    expect(tilesToNotation(onAdd.mock.calls[0][0].tiles)).toBe('345s')
  })

  it('builds an open kan of four tiles with a called tile', async () => {
    const onAdd = vi.fn()
    render(<MeldEditor usage={emptyUsage()} onAdd={onAdd} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Open kan/ }))
    await userEvent.click(screen.getByRole('button', { name: /East wind/ }))
    const meld = onAdd.mock.calls[0][0]
    expect(meld.kind).toBe('minkan')
    expect(meld.tiles).toHaveLength(4)
    expect(meld.calledTile).toBeDefined()
  })

  it('builds a closed kan with no called tile', async () => {
    const onAdd = vi.fn()
    render(<MeldEditor usage={emptyUsage()} onAdd={onAdd} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Closed kan/ }))
    await userEvent.click(screen.getByRole('button', { name: /East wind/ }))
    const meld = onAdd.mock.calls[0][0]
    expect(meld.kind).toBe('ankan')
    expect(meld.tiles).toHaveLength(4)
    expect(meld.calledTile).toBeUndefined()
  })

  it('forbids a chi on honors', async () => {
    render(<MeldEditor usage={emptyUsage()} onAdd={vi.fn()} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Chi/ }))
    expect(screen.getByRole('button', { name: /East wind/ })).toBeDisabled()
  })

  it('forbids a chi starting at rank 8 or 9', async () => {
    render(<MeldEditor usage={emptyUsage()} onAdd={vi.fn()} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Chi/ }))
    expect(screen.getByRole('button', { name: /Eight of characters/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Seven of characters/ })).toBeEnabled()
  })

  it('respects tiles already used elsewhere in the hand', async () => {
    const usage = emptyUsage()
    usage[10] = 3 // 2p
    render(<MeldEditor usage={usage} onAdd={vi.fn()} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Pon/ }))
    expect(screen.getByRole('button', { name: /Two of circles/ })).toBeDisabled()
  })

  it('closes after adding a set', async () => {
    render(<MeldEditor usage={emptyUsage()} onAdd={vi.fn()} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Pon/ }))
    await userEvent.click(screen.getByRole('button', { name: /Two of circles/ }))
    expect(screen.queryByRole('button', { name: /^Pon/ })).toBeNull()
  })

  it('can be cancelled', async () => {
    render(<MeldEditor usage={emptyUsage()} onAdd={vi.fn()} />)
    await open()
    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(screen.queryByRole('button', { name: /^Pon/ })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/ui/calculator/MeldEditor.test.tsx`
Expected: FAIL — cannot resolve `./MeldEditor`.

- [ ] **Step 3: Write the component**

Create `src/ui/calculator/MeldEditor.tsx`:

```tsx
import { useState } from 'react'
import type { Meld, MeldKind, Tile as TileModel } from '../../engine/types'
import { tileId } from '../../engine/tiles'
import { MELD_COPY } from '../../content/status'
import { TilePalette } from './TilePalette'
import './calculator.css'

const KINDS: { kind: MeldKind; label: string }[] = [
  { kind: 'chi', label: MELD_COPY.chi },
  { kind: 'pon', label: MELD_COPY.pon },
  { kind: 'minkan', label: MELD_COPY.minkan },
  { kind: 'ankan', label: MELD_COPY.ankan },
  { kind: 'shouminkan', label: MELD_COPY.shouminkan },
]

const copies = (tile: TileModel, n: number): TileModel[] =>
  // Only the base tile may be red; the other copies are ordinary.
  Array.from({ length: n }, (_, i) => (i === 0 ? tile : { ...tile, red: false }))

function buildMeld(kind: MeldKind, base: TileModel): Meld {
  if (kind === 'chi') {
    const tiles: TileModel[] = [
      base,
      { suit: base.suit, rank: base.rank + 1, red: false },
      { suit: base.suit, rank: base.rank + 2, red: false },
    ]
    return { kind, tiles, calledTile: base }
  }
  const tiles = copies(base, kind === 'pon' ? 3 : 4)
  // A closed kan is never claimed from another player, so it has no called tile.
  return kind === 'ankan' ? { kind, tiles } : { kind, tiles, calledTile: base }
}

/** Copies of the base tile a meld consumes, for the four-per-wall check. */
const consumed = (kind: MeldKind): number => (kind === 'chi' ? 1 : kind === 'pon' ? 3 : 4)

export interface MeldEditorProps {
  /** 34 counts, indexed by engine tileId. */
  usage: number[]
  onAdd: (meld: Meld) => void
}

export function MeldEditor({ usage, onAdd }: MeldEditorProps) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<MeldKind | null>(null)

  if (!open) {
    return (
      <button type="button" className="meld-editor__open" onClick={() => setOpen(true)}>
        {MELD_COPY.addCalledSet}
      </button>
    )
  }

  const close = () => {
    setOpen(false)
    setKind(null)
  }

  /**
   * A chi needs its two successors free too, so the palette's own four-copy rule
   * is not sufficient — we inflate the usage it sees for tiles this meld cannot use.
   */
  const paletteUsage = (): number[] => {
    if (!kind) return usage
    const blocked = [...usage]
    for (let id = 0; id < 34; id++) {
      const suit = id < 9 ? 'm' : id < 18 ? 'p' : id < 27 ? 's' : 'z'
      const rank = suit === 'z' ? id - 26 : (id % 9) + 1
      if (kind === 'chi') {
        if (suit === 'z' || rank > 7) blocked[id] = 4
        else {
          const successors = [id + 1, id + 2]
          if (successors.some((s) => usage[s] >= 4)) blocked[id] = 4
        }
      } else if (usage[id] + consumed(kind) > 4) {
        blocked[id] = 4
      }
    }
    return blocked
  }

  const select = (tile: TileModel) => {
    if (!kind) return
    onAdd(buildMeld(kind, tile))
    close()
  }

  return (
    <div className="meld-editor">
      <div className="meld-editor__kinds">
        {KINDS.map((entry) => (
          <button
            key={entry.kind}
            type="button"
            aria-pressed={kind === entry.kind}
            onClick={() => setKind(entry.kind)}
          >
            {entry.label}
          </button>
        ))}
        <button type="button" onClick={close}>{MELD_COPY.cancel}</button>
      </div>
      {kind && <TilePalette usage={paletteUsage()} onSelect={select} />}
    </div>
  )
}
```

Note `tileId` is imported for type-parity with the palette but the blocked-usage loop derives suit and rank arithmetically; if the implementer finds `tileId` unused, remove the import rather than leaving it — lint will flag it.

- [ ] **Step 4: Extend the stylesheet**

Append to `src/ui/calculator/calculator.css`:

```css
.meld-editor { display: flex; flex-direction: column; gap: 10px; padding: 10px; border: 1px solid rgba(0,0,0,0.12); border-radius: 6px; }
.meld-editor__kinds { display: flex; flex-wrap: wrap; gap: 6px; }
.meld-editor__kinds button { padding: 5px 10px; cursor: pointer; }
.meld-editor__kinds button[aria-pressed='true'] { background: #2563eb; color: #fff; border-color: #2563eb; }
.meld-editor__open { padding: 6px 14px; cursor: pointer; }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/ui/calculator/MeldEditor.test.tsx`
Expected: 10 passed.

- [ ] **Step 6: Prove the chi restriction bites**

In `paletteUsage`, delete the `if (suit === 'z' || rank > 7) blocked[id] = 4` line. Re-run.
Expected: FAIL on "forbids a chi on honors" and "forbids a chi starting at rank 8 or 9".
Restore it.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the called-set editor"
```

---

## Task 11: Win context and ruleset controls

**Files:**
- Create: `src/ui/calculator/ContextControls.tsx`
- Create: `src/ui/calculator/ContextControls.test.tsx`
- Create: `src/ui/settings/RulesetPanel.tsx`
- Create: `src/ui/settings/RulesetPanel.test.tsx`
- Create: `src/content/controls.ts`
- Modify: `src/ui/calculator/calculator.css`

**Interfaces:**
- Consumes: `CalculatorState` / `Action` (Task 4), `<TilePalette>` (Task 8).
- Produces:
  - `<ContextControls state={CalculatorState} dispatch={…} />`
  - `<RulesetPanel rules={RuleSet} onChange={(patch: Partial<RuleSet>) => void} />`

**Exposed ruleset flags (spec §5 — exactly these five, no more):** `akaDoraCount`, `kuitan`, `kiriageMangan`, `kazoe`, `multipleYakuman`.

**WRC 2025 defaults**, confirmed against `src/engine/rulesets/wrc2025.ts`:

| Flag | Value | Note |
|---|---|---|
| `akaDoraCount` | `0` | WRC 2025 plays with **no red fives** |
| `kuitan` | `true` | open tanyao allowed |
| `kiriageMangan` | `true` | 4 han 30 fu and 3 han 60 fu round up |
| `kazoe` | `'yakuman'` | 13+ counted han scores a full yakuman |
| `multipleYakuman` | `true` | several yakuman in one hand stack |

Two consequences worth understanding before you write the tests:

- Red fives are still offered in the palette. Under WRC they simply score nothing, which is exactly why `akaDoraCount` is one of the five exposed flags — a player on a table that uses them raises it.
- The tests below read the values from `WRC_2025` rather than hardcoding them, so they keep passing if a flag is ever revised. Do not replace those reads with literals. If a value here disagrees with the ruleset file, **the ruleset file is authoritative** — report the discrepancy rather than editing the ruleset.

- [ ] **Step 1: Write the control copy**

Create `src/content/controls.ts`:

```ts
export const CONTEXT_COPY = {
  heading: 'How you won',
  seatWind: 'Your seat wind',
  roundWind: 'Round wind',
  winSource: 'How the hand finished',
  ron: 'Ron (won on a discard)',
  tsumo: 'Tsumo (self-drawn)',
  riichi: 'Riichi',
  riichiNone: 'No riichi',
  riichiDeclared: 'Riichi',
  riichiDouble: 'Double riichi',
  situational: 'Special circumstances',
  ippatsu: 'Ippatsu (won within one go-around of declaring riichi)',
  haitei: 'Haitei (won on the very last tile drawn)',
  houtei: 'Houtei (won on the very last discard)',
  rinshan: 'Rinshan (won on the replacement tile after a kan)',
  chankan: 'Chankan (robbed a kan)',
  tenhou: "Tenhou (dealer's opening hand was already complete)",
  chiihou: 'Chiihou (won on your first draw)',
  doraIndicators: 'Dora indicators',
  uraIndicators: 'Ura dora indicators',
  addIndicator: 'Add indicator',
  removeIndicator: 'Remove indicator',
  honba: 'Honba (repeat counters)',
  riichiSticks: 'Riichi sticks on the table',
  indicatorHint:
    'Add the tile shown as the indicator, not the dora itself — the calculator works out which tile it points to.',
} as const

export const WINDS = [
  { value: 'E', label: 'East' },
  { value: 'S', label: 'South' },
  { value: 'W', label: 'West' },
  { value: 'N', label: 'North' },
] as const

export const RULES_COPY = {
  heading: 'Rules',
  preset: 'WRC 2025',
  akaDoraCount: 'Red fives in the wall',
  kuitan: 'Open tanyao (kuitan)',
  kuitanHint: 'Allow all-simples to score with an open hand.',
  kiriageMangan: 'Round up to mangan (kiriage)',
  kiriageManganHint: 'Score 4 han 30 fu and 3 han 60 fu as a mangan.',
  kazoe: 'Counted yakuman (kazoe)',
  kazoeYakuman: 'Score as a yakuman',
  kazoeSanbaiman: 'Cap at sanbaiman',
  multipleYakuman: 'Stack multiple yakuman',
  multipleYakumanHint: 'A hand with two yakuman pays double rather than single.',
} as const
```

- [ ] **Step 2: Write the failing ContextControls test**

Create `src/ui/calculator/ContextControls.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ContextControls } from './ContextControls'
import { initialState } from '../state/reducer'
import { parseTiles } from '../../engine/tiles'

describe('ContextControls', () => {
  it('sets the seat wind', async () => {
    const dispatch = vi.fn()
    render(<ContextControls state={initialState()} dispatch={dispatch} />)
    await userEvent.selectOptions(screen.getByLabelText(/Your seat wind/), 'S')
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CTX', patch: { seatWind: 'S' } })
  })

  it('sets the round wind', async () => {
    const dispatch = vi.fn()
    render(<ContextControls state={initialState()} dispatch={dispatch} />)
    await userEvent.selectOptions(screen.getByLabelText(/Round wind/), 'W')
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CTX', patch: { roundWind: 'W' } })
  })

  it('switches to tsumo', async () => {
    const dispatch = vi.fn()
    render(<ContextControls state={initialState()} dispatch={dispatch} />)
    await userEvent.click(screen.getByRole('radio', { name: /Tsumo/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_WIN_SOURCE', source: 'tsumo' })
  })

  it('sets the riichi state', async () => {
    const dispatch = vi.fn()
    render(<ContextControls state={initialState()} dispatch={dispatch} />)
    await userEvent.selectOptions(screen.getByLabelText(/^Riichi/), 'double')
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CTX', patch: { riichi: 'double' } })
  })

  it('toggles a situational flag', async () => {
    const dispatch = vi.fn()
    render(<ContextControls state={initialState()} dispatch={dispatch} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /Ippatsu/ }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CTX', patch: { ippatsu: true } })
  })

  it('offers every situational flag the engine reads', () => {
    render(<ContextControls state={initialState()} dispatch={vi.fn()} />)
    for (const name of [/Ippatsu/, /Haitei/, /Houtei/, /Rinshan/, /Chankan/, /Tenhou/, /Chiihou/]) {
      expect(screen.getByRole('checkbox', { name })).toBeInTheDocument()
    }
  })

  it('sets honba and riichi sticks', async () => {
    const dispatch = vi.fn()
    render(<ContextControls state={initialState()} dispatch={dispatch} />)
    await userEvent.clear(screen.getByLabelText(/Honba/))
    await userEvent.type(screen.getByLabelText(/Honba/), '2')
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_CTX', patch: { honba: 2 } })
  })

  it('rejects a negative honba', async () => {
    const dispatch = vi.fn()
    render(<ContextControls state={initialState()} dispatch={dispatch} />)
    const input = screen.getByLabelText(/Honba/)
    await userEvent.clear(input)
    await userEvent.type(input, '-3')
    expect(dispatch).not.toHaveBeenCalledWith(
      expect.objectContaining({ patch: expect.objectContaining({ honba: -3 }) }),
    )
  })

  it('renders existing dora indicators', () => {
    const state = {
      ...initialState(),
      ctx: { ...initialState().ctx, doraIndicators: parseTiles('7p') },
    }
    const { container } = render(<ContextControls state={state} dispatch={vi.fn()} />)
    expect(container.querySelector('.controls__indicators')!.querySelectorAll('use').length)
      .toBeGreaterThan(0)
  })

  it('explains that the indicator is not the dora', () => {
    render(<ContextControls state={initialState()} dispatch={vi.fn()} />)
    expect(screen.getByText(/not the dora itself/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/ui/calculator/ContextControls.test.tsx`
Expected: FAIL — cannot resolve `./ContextControls`.

- [ ] **Step 4: Write ContextControls**

Create `src/ui/calculator/ContextControls.tsx`:

```tsx
import { useState } from 'react'
import type { RiichiState, Tile as TileModel, Wind, WinContext } from '../../engine/types'
import type { Action, CalculatorState } from '../state/types'
import { tileUsage } from '../state/selectors'
import { tileName } from '../../content/tiles'
import { CONTEXT_COPY, WINDS } from '../../content/controls'
import { Tile } from '../tiles/Tile'
import { TilePalette } from './TilePalette'
import './calculator.css'

type FlagKey = 'ippatsu' | 'haitei' | 'houtei' | 'rinshan' | 'chankan' | 'tenhou' | 'chiihou'

const FLAGS: { key: FlagKey; label: string }[] = [
  { key: 'ippatsu', label: CONTEXT_COPY.ippatsu },
  { key: 'haitei', label: CONTEXT_COPY.haitei },
  { key: 'houtei', label: CONTEXT_COPY.houtei },
  { key: 'rinshan', label: CONTEXT_COPY.rinshan },
  { key: 'chankan', label: CONTEXT_COPY.chankan },
  { key: 'tenhou', label: CONTEXT_COPY.tenhou },
  { key: 'chiihou', label: CONTEXT_COPY.chiihou },
]

type IndicatorKind = 'doraIndicators' | 'uraIndicators'

export interface ContextControlsProps {
  state: CalculatorState
  dispatch: (action: Action) => void
}

export function ContextControls({ state, dispatch }: ContextControlsProps) {
  const { ctx } = state
  const [picking, setPicking] = useState<IndicatorKind | null>(null)

  const patch = (next: Partial<WinContext>) => dispatch({ type: 'SET_CTX', patch: next })

  const readCount = (raw: string): number | null => {
    if (!/^\d+$/.test(raw)) return null
    return Number(raw)
  }

  const addIndicator = (kind: IndicatorKind) => (tile: TileModel) => {
    patch({ [kind]: [...ctx[kind], tile] } as Partial<WinContext>)
    setPicking(null)
  }

  const removeIndicator = (kind: IndicatorKind, index: number) => {
    patch({ [kind]: ctx[kind].filter((_, i) => i !== index) } as Partial<WinContext>)
  }

  const indicatorSection = (kind: IndicatorKind, label: string) => (
    <div className="controls__field">
      <span className="controls__label">{label}</span>
      <div className="controls__indicators">
        {ctx[kind].map((tile, index) => (
          <Tile
            key={index}
            tile={tile}
            size="sm"
            label={`${CONTEXT_COPY.removeIndicator}: ${tileName(tile)}`}
            onClick={() => removeIndicator(kind, index)}
          />
        ))}
        <button type="button" onClick={() => setPicking(picking === kind ? null : kind)}>
          {CONTEXT_COPY.addIndicator}
        </button>
      </div>
      {picking === kind && (
        <TilePalette usage={tileUsage(state)} onSelect={addIndicator(kind)} />
      )}
    </div>
  )

  return (
    <section className="controls">
      <h2 className="controls__heading">{CONTEXT_COPY.heading}</h2>

      <div className="controls__field">
        <label className="controls__label" htmlFor="seat-wind">{CONTEXT_COPY.seatWind}</label>
        <select
          id="seat-wind"
          value={ctx.seatWind}
          onChange={(e) => patch({ seatWind: e.target.value as Wind })}
        >
          {WINDS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </div>

      <div className="controls__field">
        <label className="controls__label" htmlFor="round-wind">{CONTEXT_COPY.roundWind}</label>
        <select
          id="round-wind"
          value={ctx.roundWind}
          onChange={(e) => patch({ roundWind: e.target.value as Wind })}
        >
          {WINDS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </div>

      <fieldset className="controls__field">
        <legend className="controls__label">{CONTEXT_COPY.winSource}</legend>
        {(['ron', 'tsumo'] as const).map((source) => (
          <label key={source}>
            <input
              type="radio"
              name="win-source"
              checked={state.winSource === source}
              onChange={() => dispatch({ type: 'SET_WIN_SOURCE', source })}
            />
            {source === 'ron' ? CONTEXT_COPY.ron : CONTEXT_COPY.tsumo}
          </label>
        ))}
      </fieldset>

      <div className="controls__field">
        <label className="controls__label" htmlFor="riichi">{CONTEXT_COPY.riichi}</label>
        <select
          id="riichi"
          value={ctx.riichi}
          onChange={(e) => patch({ riichi: e.target.value as RiichiState })}
        >
          <option value="none">{CONTEXT_COPY.riichiNone}</option>
          <option value="riichi">{CONTEXT_COPY.riichiDeclared}</option>
          <option value="double">{CONTEXT_COPY.riichiDouble}</option>
        </select>
      </div>

      <fieldset className="controls__field">
        <legend className="controls__label">{CONTEXT_COPY.situational}</legend>
        {FLAGS.map((flag) => (
          <label key={flag.key}>
            <input
              type="checkbox"
              checked={ctx[flag.key]}
              onChange={(e) => patch({ [flag.key]: e.target.checked } as Partial<WinContext>)}
            />
            {flag.label}
          </label>
        ))}
      </fieldset>

      {indicatorSection('doraIndicators', CONTEXT_COPY.doraIndicators)}
      {indicatorSection('uraIndicators', CONTEXT_COPY.uraIndicators)}
      <p className="controls__hint">{CONTEXT_COPY.indicatorHint}</p>

      <div className="controls__field">
        <label className="controls__label" htmlFor="honba">{CONTEXT_COPY.honba}</label>
        <input
          id="honba"
          type="number"
          min={0}
          value={ctx.honba}
          onChange={(e) => {
            const value = readCount(e.target.value)
            if (value !== null) patch({ honba: value })
          }}
        />
      </div>

      <div className="controls__field">
        <label className="controls__label" htmlFor="sticks">{CONTEXT_COPY.riichiSticks}</label>
        <input
          id="sticks"
          type="number"
          min={0}
          value={ctx.riichiSticks}
          onChange={(e) => {
            const value = readCount(e.target.value)
            if (value !== null) patch({ riichiSticks: value })
          }}
        />
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Run the ContextControls tests**

Run: `npx vitest run src/ui/calculator/ContextControls.test.tsx`
Expected: 10 passed.

- [ ] **Step 6: Write the failing RulesetPanel test**

Create `src/ui/settings/RulesetPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { RulesetPanel } from './RulesetPanel'
import { WRC_2025 } from '../../engine/rulesets/wrc2025'

describe('RulesetPanel', () => {
  it('names the active preset', () => {
    render(<RulesetPanel rules={WRC_2025} onChange={vi.fn()} />)
    expect(screen.getByText(/WRC 2025/)).toBeInTheDocument()
  })

  it('exposes exactly the five agreed flags', () => {
    render(<RulesetPanel rules={WRC_2025} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Red fives in the wall/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Open tanyao/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Round up to mangan/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Counted yakuman/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Stack multiple yakuman/)).toBeInTheDocument()
    // Nothing else — atozuke, pao, renhou and nagashi are represented but not exposed.
    expect(screen.queryByLabelText(/Atozuke/i)).toBeNull()
    expect(screen.queryByLabelText(/Pao/i)).toBeNull()
    expect(screen.queryByLabelText(/Renhou/i)).toBeNull()
    expect(screen.queryByLabelText(/Nagashi/i)).toBeNull()
  })

  it('reflects the current values', () => {
    render(<RulesetPanel rules={WRC_2025} onChange={vi.fn()} />)
    expect(screen.getByLabelText(/Open tanyao/)).toBeChecked()
    expect(screen.getByLabelText(/Red fives in the wall/)).toHaveValue(WRC_2025.akaDoraCount)
  })

  it('emits a patch when a toggle changes', async () => {
    const onChange = vi.fn()
    render(<RulesetPanel rules={WRC_2025} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText(/Open tanyao/))
    expect(onChange).toHaveBeenCalledWith({ kuitan: !WRC_2025.kuitan })
  })

  it('emits a patch when the kazoe treatment changes', async () => {
    const onChange = vi.fn()
    render(<RulesetPanel rules={WRC_2025} onChange={onChange} />)
    const target = WRC_2025.kazoe === 'yakuman' ? 'sanbaiman' : 'yakuman'
    await userEvent.selectOptions(screen.getByLabelText(/Counted yakuman/), target)
    expect(onChange).toHaveBeenCalledWith({ kazoe: target })
  })

  it('emits a patch when the red-five count changes', async () => {
    const onChange = vi.fn()
    render(<RulesetPanel rules={WRC_2025} onChange={onChange} />)
    const input = screen.getByLabelText(/Red fives in the wall/)
    await userEvent.clear(input)
    await userEvent.type(input, '3')
    expect(onChange).toHaveBeenCalledWith({ akaDoraCount: 3 })
  })
})
```

- [ ] **Step 7: Write RulesetPanel**

Create `src/ui/settings/RulesetPanel.tsx`:

```tsx
import type { KazoeTreatment, RuleSet } from '../../engine/rulesets/types'
import { RULES_COPY } from '../../content/controls'

export interface RulesetPanelProps {
  rules: RuleSet
  onChange: (patch: Partial<RuleSet>) => void
}

/**
 * Exposes the five flags agreed in spec §5. The remaining flags are represented
 * in the RuleSet but deliberately not offered here.
 */
export function RulesetPanel({ rules, onChange }: RulesetPanelProps) {
  return (
    <section className="rules-panel">
      <h2>{RULES_COPY.heading}: {rules.name}</h2>

      <div className="rules-panel__field">
        <label htmlFor="aka-count">{RULES_COPY.akaDoraCount}</label>
        <input
          id="aka-count"
          type="number"
          min={0}
          max={4}
          value={rules.akaDoraCount}
          onChange={(e) => {
            if (/^\d+$/.test(e.target.value)) {
              onChange({ akaDoraCount: Number(e.target.value) })
            }
          }}
        />
      </div>

      <div className="rules-panel__field">
        <label htmlFor="kuitan">{RULES_COPY.kuitan}</label>
        <input
          id="kuitan"
          type="checkbox"
          checked={rules.kuitan}
          onChange={(e) => onChange({ kuitan: e.target.checked })}
        />
        <p className="rules-panel__hint">{RULES_COPY.kuitanHint}</p>
      </div>

      <div className="rules-panel__field">
        <label htmlFor="kiriage">{RULES_COPY.kiriageMangan}</label>
        <input
          id="kiriage"
          type="checkbox"
          checked={rules.kiriageMangan}
          onChange={(e) => onChange({ kiriageMangan: e.target.checked })}
        />
        <p className="rules-panel__hint">{RULES_COPY.kiriageManganHint}</p>
      </div>

      <div className="rules-panel__field">
        <label htmlFor="kazoe">{RULES_COPY.kazoe}</label>
        <select
          id="kazoe"
          value={rules.kazoe}
          onChange={(e) => onChange({ kazoe: e.target.value as KazoeTreatment })}
        >
          <option value="yakuman">{RULES_COPY.kazoeYakuman}</option>
          <option value="sanbaiman">{RULES_COPY.kazoeSanbaiman}</option>
        </select>
      </div>

      <div className="rules-panel__field">
        <label htmlFor="multi-yakuman">{RULES_COPY.multipleYakuman}</label>
        <input
          id="multi-yakuman"
          type="checkbox"
          checked={rules.multipleYakuman}
          onChange={(e) => onChange({ multipleYakuman: e.target.checked })}
        />
        <p className="rules-panel__hint">{RULES_COPY.multipleYakumanHint}</p>
      </div>
    </section>
  )
}
```

- [ ] **Step 8: Extend the stylesheet**

Append to `src/ui/calculator/calculator.css`:

```css
.controls { display: flex; flex-direction: column; gap: 12px; }
.controls__heading { margin: 0; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.65; }
.controls__field { display: flex; flex-direction: column; gap: 4px; border: none; padding: 0; margin: 0; }
.controls__label { font-size: 13px; font-weight: 600; }
.controls__field label { display: flex; align-items: center; gap: 6px; font-size: 13px; }
.controls__indicators { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.controls__hint { margin: 0; font-size: 12px; opacity: 0.6; max-width: 52ch; }

.rules-panel { display: flex; flex-direction: column; gap: 12px; }
.rules-panel__field { display: flex; flex-direction: column; gap: 4px; }
.rules-panel__hint { margin: 0; font-size: 12px; opacity: 0.6; }
```

- [ ] **Step 9: Run all the tests**

Run: `npx vitest run src/ui/settings src/ui/calculator`
Expected: all pass, including 6 RulesetPanel tests.

- [ ] **Step 10: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add win-context controls and the ruleset settings panel"
```

---

## Task 12: Yaku copy — the one-han and two-han yaku

**Files:**
- Create: `src/content/yaku/types.ts`
- Create: `src/content/yaku/oneHan.ts`
- Create: `src/content/yaku/twoHan.ts`
- Create: `src/content/yaku/index.ts`
- Create: `src/content/yaku/render.test.ts`
- Delete: `src/content/yaku.ts`, `src/content/yaku.test.ts`

**Interfaces:**
- Consumes: nothing (content layer — **no engine imports**).
- Produces:
  - `YakuParams = Record<string, string | number>`
  - `YakuCopy { name: string; short: string; explain(params: YakuParams): string }`
  - `YAKU_COPY: Record<string, YakuCopy>` — assembled in `index.ts`, completed in Task 13.

**Migration note:** the existing `src/content/yaku.ts` holds a flat `YAKU_NAMES` map. This task replaces it with the richer `YAKU_COPY`. Delete the old module and its test in this task — nothing imports them yet, so there is no consumer to update.

**Voice for the copy.** Write for someone who has played a handful of games. Say what the shape *is* first, then why it is worth what it is worth if that is not obvious. No jargon that is not immediately unpacked. Two sentences is usually right; three is the maximum. `short` is one clause for the collapsed view.

- [ ] **Step 1: Write the types**

Create `src/content/yaku/types.ts`:

```ts
/**
 * Display copy for yaku, keyed by the engine's stable rule id. Joined to engine
 * output by id — this module must not import from src/engine/**.
 *
 * `params` carries the evidence the rule produced, e.g. { source: 'seat-wind',
 * wind: 'S' } for a seat-wind yakuhai.
 */
export type YakuParams = Record<string, string | number>

export interface YakuCopy {
  /** Display name, e.g. 'Riichi'. */
  name: string
  /** One clause, shown when explanations are collapsed. */
  short: string
  /** Beginner explanation, with evidence interpolated. */
  explain(params: YakuParams): string
}

export const WIND_NAMES: Record<string, string> = {
  E: 'East', S: 'South', W: 'West', N: 'North',
}

export const DRAGON_NAMES: Record<string, string> = {
  haku: 'White', hatsu: 'Green', chun: 'Red',
}
```

- [ ] **Step 2: Write the one-han copy**

Create `src/content/yaku/oneHan.ts`:

```ts
import type { YakuCopy } from './types'
import { DRAGON_NAMES, WIND_NAMES } from './types'

export const ONE_HAN_COPY: Record<string, YakuCopy> = {
  riichi: {
    name: 'Riichi',
    short: 'Declared a closed, ready hand',
    explain: () =>
      'You declared riichi: your hand was closed and one tile from complete, so you bet a 1,000-point stick and locked your discards. ' +
      'It pays one han, and it is also what makes ippatsu and ura dora available to you.',
  },
  'double-riichi': {
    name: 'Double riichi',
    short: 'Declared riichi on your very first discard',
    explain: () =>
      'You were already one tile from complete before anyone had called a tile, so your riichi came on your first discard. ' +
      'That rarity is worth two han instead of the usual one.',
  },
  ippatsu: {
    name: 'Ippatsu',
    short: 'Won within one go-around of declaring riichi',
    explain: () =>
      'You won within one full go-around of declaring riichi, with no call interrupting play. ' +
      'It is pure timing rather than shape, which is why it only applies to a riichi hand.',
  },
  'menzen-tsumo': {
    name: 'Menzen tsumo',
    short: 'Self-drew the winning tile with a closed hand',
    explain: () =>
      'You drew the winning tile yourself, and your hand was entirely closed — no chi, pon, or open kan. ' +
      'Calling a tile at any point would have removed this yaku.',
  },
  pinfu: {
    name: 'Pinfu',
    short: 'The flattest possible hand: all runs, no fu anywhere',
    explain: () =>
      'Every set is a run, the pair is worth nothing on its own, and you were waiting on a two-sided shape. ' +
      'Nothing in the hand earns fu, and the reward for that flatness is one han.',
  },
  iipeikou: {
    name: 'Iipeikou',
    short: 'Two identical runs in the same suit',
    explain: () =>
      'You have the same run twice in the same suit — 234p and 234p, for instance. ' +
      'It requires a closed hand, because calling one of the runs makes it a different thing entirely.',
  },
  tanyao: {
    name: 'Tanyao',
    short: 'No terminals and no honours',
    explain: () =>
      'Every tile in the hand is between 2 and 8 — no ones, no nines, and no winds or dragons. ' +
      'It is the most common yaku in the game because those middle tiles are the easiest to draw and combine.',
  },
  'yakuhai-haku': {
    name: 'Yakuhai — White dragon',
    short: 'A triplet of White dragons',
    explain: () => 'You hold three or more White dragons. Each dragon triplet is worth one han on its own.',
  },
  'yakuhai-hatsu': {
    name: 'Yakuhai — Green dragon',
    short: 'A triplet of Green dragons',
    explain: () => 'You hold three or more Green dragons. Each dragon triplet is worth one han on its own.',
  },
  'yakuhai-chun': {
    name: 'Yakuhai — Red dragon',
    short: 'A triplet of Red dragons',
    explain: () => 'You hold three or more Red dragons. Each dragon triplet is worth one han on its own.',
  },
  'yakuhai-seat': {
    name: 'Yakuhai — Seat wind',
    short: 'A triplet of your own seat wind',
    explain: (params) => {
      const wind = WIND_NAMES[String(params.wind)] ?? 'your seat'
      return `You hold three or more ${wind} tiles, and ${wind} is your seat this hand. ` +
        'A wind triplet only scores for the player sitting in that seat — the same tiles are worth nothing to anyone else.'
    },
  },
  'yakuhai-round': {
    name: 'Yakuhai — Round wind',
    short: 'A triplet of the prevailing round wind',
    explain: (params) => {
      const wind = WIND_NAMES[String(params.wind)] ?? 'the round'
      return `You hold three or more ${wind} tiles, and this is the ${wind} round. ` +
        'If it is also your seat wind, the triplet scores twice — once for the seat and once for the round.'
    },
  },
  haitei: {
    name: 'Haitei raoyue',
    short: 'Won on the very last tile in the wall',
    explain: () =>
      'You drew the final tile of the wall and it completed your hand. ' +
      'It is worth one han purely for the timing — the shape of the hand has nothing to do with it.',
  },
  houtei: {
    name: 'Houtei raoyui',
    short: 'Won on the very last discard of the hand',
    explain: () =>
      'The last tile of the wall was drawn and discarded, and that discard completed your hand. ' +
      'Like haitei, this is entirely about when you won rather than what you won with.',
  },
  rinshan: {
    name: 'Rinshan kaihou',
    short: 'Won on the replacement tile after declaring a kan',
    explain: () =>
      'You declared a kan, drew the replacement tile from the dead wall, and it completed your hand. ' +
      'It counts as a self-draw, so it stacks with menzen tsumo if your hand is otherwise closed.',
  },
  chankan: {
    name: 'Chankan',
    short: 'Robbed the tile someone added to a kan',
    explain: () =>
      'Another player added a fourth tile to their existing triplet, and that tile was exactly the one you needed. ' +
      'You are allowed to take it — the hand counts as a win on a discard.',
  },
}
```

- [ ] **Step 3: Write the two-han copy**

Create `src/content/yaku/twoHan.ts`:

```ts
import type { YakuCopy } from './types'

export const TWO_HAN_COPY: Record<string, YakuCopy> = {
  chiitoitsu: {
    name: 'Chiitoitsu',
    short: 'Seven distinct pairs instead of four sets and a pair',
    explain: () =>
      'Your hand is seven different pairs rather than the usual four sets plus a pair. ' +
      'The seven pairs must all be distinct — four of the same tile counts as two pairs elsewhere, but not here. ' +
      'It always scores a flat 25 fu.',
  },
  ittsu: {
    name: 'Ittsu',
    short: '1-2-3, 4-5-6 and 7-8-9 all in one suit',
    explain: () =>
      'You have the full run of one suit split into three sets: 123, 456, and 789. ' +
      'They must all be the same suit — spreading them across suits is a different yaku entirely. ' +
      'Worth two han closed, one if you called any of it.',
  },
  'sanshoku-doujun': {
    name: 'Sanshoku doujun',
    short: 'The same run in all three suits',
    explain: () =>
      'The same three consecutive numbers appear as a run in characters, circles, and bamboo — 456m, 456p, and 456s. ' +
      'Worth two han closed, one if you called any of it.',
  },
  'sanshoku-doukou': {
    name: 'Sanshoku doukou',
    short: 'The same triplet in all three suits',
    explain: () =>
      'The same number appears as a triplet in all three suits — 333m, 333p, and 333s. ' +
      'Much rarer than the run version, and unlike it, this one is worth two han whether your hand is open or closed.',
  },
  toitoi: {
    name: 'Toitoi',
    short: 'Every set is a triplet — no runs at all',
    explain: () =>
      'All four of your sets are triplets or kans, with a pair to finish. There is not a single run in the hand. ' +
      'It pairs naturally with sanankou and honitsu, and open hands score it just as well as closed ones.',
  },
  sanankou: {
    name: 'Sanankou',
    short: 'Three triplets completed without calling',
    explain: () =>
      'Three of your triplets were formed entirely from tiles you drew yourself — none of them were completed by calling pon. ' +
      'Note the subtlety: a triplet finished by winning on a discard counts as open for this purpose, so the win must have come from elsewhere.',
  },
  sankantsu: {
    name: 'Sankantsu',
    short: 'Three kans in one hand',
    explain: () =>
      'You declared three kans. Each kan also adds a dora indicator, so hands with this yaku often end up far larger than the two han suggests.',
  },
  chanta: {
    name: 'Chanta',
    short: 'Every set contains a terminal or an honour',
    explain: () =>
      'Every set and the pair contains at least one 1, 9, wind, or dragon. Runs qualify by touching the edge — 123 or 789. ' +
      'Worth two han closed and one open. If you manage it with no honours at all, it becomes junchan instead.',
  },
  honroutou: {
    name: 'Honroutou',
    short: 'Nothing but terminals and honours',
    explain: () =>
      'Every tile is a 1, a 9, a wind, or a dragon — no middle numbers anywhere. ' +
      'Since no run can be built from those tiles alone, this always arrives alongside toitoi or chiitoitsu.',
  },
  shousangen: {
    name: 'Shousangen',
    short: 'Two dragon triplets and a pair of the third',
    explain: () =>
      'You have triplets of two dragons and a pair of the remaining one. ' +
      'The two dragon triplets each score yakuhai on top, so this is effectively worth four han rather than two.',
  },
}
```

- [ ] **Step 4: Write the registry**

Create `src/content/yaku/index.ts`:

```ts
import type { YakuCopy, YakuParams } from './types'
import { ONE_HAN_COPY } from './oneHan'
import { TWO_HAN_COPY } from './twoHan'

export type { YakuCopy, YakuParams } from './types'

/** Display copy for every yaku, keyed by the engine's rule id. */
export const YAKU_COPY: Record<string, YakuCopy> = {
  ...ONE_HAN_COPY,
  ...TWO_HAN_COPY,
}

/** Name for a yaku id, falling back to the raw id so the UI never renders blank. */
export function yakuName(id: string): string {
  return YAKU_COPY[id]?.name ?? id
}

export function yakuShort(id: string): string {
  return YAKU_COPY[id]?.short ?? ''
}

export function yakuExplanation(id: string, params: YakuParams = {}): string {
  return YAKU_COPY[id]?.explain(params) ?? ''
}
```

- [ ] **Step 5: Write the render test**

Create `src/content/yaku/render.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { YAKU_COPY, yakuName, yakuExplanation, yakuShort } from './index'

describe('yaku copy', () => {
  it('renders a static explanation', () => {
    expect(yakuExplanation('tanyao')).toContain('between 2 and 8')
  })

  it('interpolates the seat wind', () => {
    const text = yakuExplanation('yakuhai-seat', { source: 'seat-wind', wind: 'S' })
    expect(text).toContain('South')
    expect(text).not.toContain('undefined')
  })

  it('interpolates the round wind', () => {
    const text = yakuExplanation('yakuhai-round', { source: 'round-wind', wind: 'E' })
    expect(text).toContain('East')
  })

  it('survives a missing wind param without printing undefined', () => {
    const text = yakuExplanation('yakuhai-seat', {})
    expect(text).not.toContain('undefined')
    expect(text.length).toBeGreaterThan(0)
  })

  it('returns the id rather than blank for an unknown yaku', () => {
    expect(yakuName('not-a-yaku')).toBe('not-a-yaku')
    expect(yakuShort('not-a-yaku')).toBe('')
    expect(yakuExplanation('not-a-yaku')).toBe('')
  })

  it('gives every entry a non-empty name, short form and explanation', () => {
    for (const [id, copy] of Object.entries(YAKU_COPY)) {
      expect(copy.name, `${id} name`).not.toBe('')
      expect(copy.short, `${id} short`).not.toBe('')
      expect(copy.explain({}).length, `${id} explain`).toBeGreaterThan(40)
    }
  })

  it('covers all 26 one-han and two-han yaku', () => {
    expect(Object.keys(YAKU_COPY)).toHaveLength(26)
  })
})
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/content/yaku/render.test.ts`
Expected: 7 passed.

- [ ] **Step 7: Delete the superseded module**

```bash
git rm src/content/yaku.ts src/content/yaku.test.ts
```

Run: `npm test`
Expected: all green. If anything imported `YAKU_NAMES`, that is a surprise — report BLOCKED rather than reinstating the file.

- [ ] **Step 8: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(content): add beginner copy for the one-han and two-han yaku"
```

---

## Task 13: Yaku copy — three-han, yakuman, and the coverage gate

**Files:**
- Create: `src/content/yaku/threeHan.ts`
- Create: `src/content/yaku/yakuman.ts`
- Modify: `src/content/yaku/index.ts`
- Create: `src/content/yaku/coverage.test.ts`

**Interfaces:**
- Consumes: `YakuCopy` (Task 12).
- Produces: the completed `YAKU_COPY` with all 45 ids, and a gate test that fails if the registry and the copy ever diverge.

**The coverage gate is the point of this task.** It lives in `src/content/` but must read `YAKU_RULES` from the engine — and content may not import the engine. Resolve this by putting the gate in a **test** file: the ESLint boundary rule applies to `src/content/**/*.ts`, which includes tests, so the gate must instead live at `src/ui/contentCoverage.test.ts`. Put it there. The UI layer may import both, and that is exactly what the gate needs to compare.

- [ ] **Step 1: Write the three-han copy**

Create `src/content/yaku/threeHan.ts`:

```ts
import type { YakuCopy } from './types'

export const THREE_HAN_COPY: Record<string, YakuCopy> = {
  honitsu: {
    name: 'Honitsu',
    short: 'One suit plus honours',
    explain: () =>
      'Every tile is from a single suit, plus any winds and dragons. ' +
      'Worth three han closed and two open — a big score for a hand that is often easier to reach than it looks, ' +
      'because honours combine freely with whichever suit you commit to.',
  },
  chinitsu: {
    name: 'Chinitsu',
    short: 'A single suit and nothing else',
    explain: () =>
      'Every tile is from one suit, with no honours at all. ' +
      'Six han closed and five open makes it the highest-scoring hand short of a yakuman, ' +
      'and it frequently arrives with ittsu or pinfu attached.',
  },
  junchan: {
    name: 'Junchan',
    short: 'Every set contains a terminal, and no honours',
    explain: () =>
      'Every set and the pair contains a 1 or a 9, and there are no winds or dragons anywhere. ' +
      'It is the stricter version of chanta, and worth one han more: three closed, two open.',
  },
  ryanpeikou: {
    name: 'Ryanpeikou',
    short: 'Two separate pairs of identical runs',
    explain: () =>
      'You have iipeikou twice — two different pairs of identical runs, four runs in total, plus a pair. ' +
      'It requires a closed hand, and it replaces iipeikou rather than stacking with it.',
  },
}
```

- [ ] **Step 2: Write the yakuman copy**

Create `src/content/yaku/yakuman.ts`:

```ts
import type { YakuCopy } from './types'

export const YAKUMAN_COPY: Record<string, YakuCopy> = {
  kokushi: {
    name: 'Kokushi musou',
    short: 'One of each terminal and honour, plus a duplicate',
    explain: () =>
      'You hold all thirteen terminals and honours — 1 and 9 of each suit, all four winds, all three dragons — with one of them doubled. ' +
      'It is the only standard hand that is not built from sets at all.',
  },
  'kokushi-13': {
    name: 'Kokushi musou juusan menmachi',
    short: 'Kokushi held as all thirteen tiles, waiting on any of them',
    explain: () =>
      'You had all thirteen distinct terminals and honours in hand, so literally any one of them completed it. ' +
      'That thirteen-sided wait is scored as a double yakuman under rules that recognise it.',
  },
  suuankou: {
    name: 'Suuankou',
    short: 'Four triplets, none of them called',
    explain: () =>
      'All four sets are triplets you formed yourself, without calling pon on any of them. ' +
      'Because a triplet completed by ron counts as open, this normally requires winning by self-draw.',
  },
  'suuankou-tanki': {
    name: 'Suuankou tanki',
    short: 'Four concealed triplets, waiting on the pair',
    explain: () =>
      'You had the four concealed triplets already and were waiting for the pair to complete. ' +
      'Since the wait was on the pair rather than a triplet, winning on a discard is fine — and it scores double yakuman where that is recognised.',
  },
  daisangen: {
    name: 'Daisangen',
    short: 'Triplets of all three dragons',
    explain: () =>
      'You hold triplets of White, Green, and Red dragons, with any two other sets to finish the hand.',
  },
  shousuushii: {
    name: 'Shousuushii',
    short: 'Three wind triplets and a pair of the fourth',
    explain: () =>
      'Three of the four winds appear as triplets, and the fourth is your pair. ' +
      'The "small" four winds — the version where all four are triplets is a separate, larger hand.',
  },
  daisuushii: {
    name: 'Daisuushii',
    short: 'Triplets of all four winds',
    explain: () =>
      'All four winds appear as triplets, with any pair to finish. ' +
      'It is one of the hardest hands in the game and is commonly scored as a double yakuman.',
  },
  tsuuiisou: {
    name: 'Tsuuiisou',
    short: 'Nothing but winds and dragons',
    explain: () =>
      'Every tile is a wind or a dragon — no numbered tiles at all. ' +
      'With only seven distinct tiles available it usually arrives as either toitoi or seven pairs.',
  },
  chinroutou: {
    name: 'Chinroutou',
    short: 'Nothing but terminals',
    explain: () =>
      'Every tile is a 1 or a 9, with no honours and no middle numbers. ' +
      'Since no run can be made from terminals alone, the hand is always four triplets and a pair.',
  },
  ryuuiisou: {
    name: 'Ryuuiisou',
    short: 'Only the all-green tiles',
    explain: () =>
      'Every tile is one of the six that are printed entirely in green: 2, 3, 4, 6, and 8 of bamboo, and the Green dragon. ' +
      'It is defined by the artwork rather than by structure, which makes it unlike every other yaku.',
  },
  chuuren: {
    name: 'Chuuren poutou',
    short: '1112345678999 in one suit, plus a duplicate',
    explain: () =>
      'A closed hand of one suit shaped 1112345678999, plus one more tile from that suit. ' +
      'It is famously difficult, and it must be entirely concealed.',
  },
  'chuuren-9': {
    name: 'Junsei chuuren poutou',
    short: 'The pure nine-sided chuuren wait',
    explain: () =>
      'You held exactly 1112345678999 in a single suit, so any of the nine tiles in that suit completed the hand. ' +
      'That nine-sided wait is the pure form, scored as a double yakuman where that is recognised.',
  },
  suukantsu: {
    name: 'Suukantsu',
    short: 'Four kans in one hand',
    explain: () =>
      'You declared all four kans yourself. Only one player can ever hold four kans in a hand, and each one added a dora indicator.',
  },
  tenhou: {
    name: 'Tenhou',
    short: "The dealer's opening hand was already complete",
    explain: () =>
      'You were the dealer and your fourteen starting tiles already formed a winning hand, before a single discard. ' +
      'Nothing you did earned it — it is pure luck of the deal.',
  },
  chiihou: {
    name: 'Chiihou',
    short: 'A non-dealer won on their first draw',
    explain: () =>
      'You were not the dealer, and your very first draw completed your hand, with no tile called beforehand. ' +
      'The dealer equivalent is tenhou.',
  },
}
```

- [ ] **Step 3: Complete the registry**

Replace the imports and the `YAKU_COPY` object in `src/content/yaku/index.ts`:

```ts
import type { YakuCopy, YakuParams } from './types'
import { ONE_HAN_COPY } from './oneHan'
import { TWO_HAN_COPY } from './twoHan'
import { THREE_HAN_COPY } from './threeHan'
import { YAKUMAN_COPY } from './yakuman'

export type { YakuCopy, YakuParams } from './types'

/** Display copy for every yaku, keyed by the engine's rule id. */
export const YAKU_COPY: Record<string, YakuCopy> = {
  ...ONE_HAN_COPY,
  ...TWO_HAN_COPY,
  ...THREE_HAN_COPY,
  ...YAKUMAN_COPY,
}
```

Leave `yakuName`, `yakuShort` and `yakuExplanation` unchanged.

- [ ] **Step 4: Update the count assertion**

In `src/content/yaku/render.test.ts`, replace the last test:

```ts
  it('covers all 45 yaku', () => {
    expect(Object.keys(YAKU_COPY)).toHaveLength(45)
  })
```

- [ ] **Step 5: Write the coverage gate**

Create `src/ui/contentCoverage.test.ts` — note the location, in `src/ui/` rather than `src/content/`, because it must import from both layers:

```ts
import { describe, it, expect } from 'vitest'
import { YAKU_RULES } from '../engine/yaku/registry'
import { YAKU_COPY } from '../content/yaku'

/**
 * The forcing function for the long tail: a yaku cannot enter the calculator
 * without documentation, and copy cannot drift from the registry.
 */
describe('yaku content coverage', () => {
  it('has copy for every registered yaku', () => {
    const missing = YAKU_RULES.map((rule) => rule.id).filter((id) => !YAKU_COPY[id])
    expect(missing, `yaku with no copy: ${missing.join(', ')}`).toEqual([])
  })

  it('has no copy for a yaku that does not exist', () => {
    const ids = new Set(YAKU_RULES.map((rule) => rule.id))
    const orphans = Object.keys(YAKU_COPY).filter((id) => !ids.has(id))
    expect(orphans, `copy with no rule: ${orphans.join(', ')}`).toEqual([])
  })

  it('gives every registered yaku a usable name, short form and explanation', () => {
    for (const rule of YAKU_RULES) {
      const copy = YAKU_COPY[rule.id]
      if (!copy) continue // reported by the first test
      expect(copy.name.length, `${rule.id} name`).toBeGreaterThan(0)
      expect(copy.short.length, `${rule.id} short`).toBeGreaterThan(0)
      expect(copy.explain({}).length, `${rule.id} explanation`).toBeGreaterThan(40)
    }
  })

  it('never renders undefined for a yaku that carries evidence params', () => {
    for (const rule of YAKU_RULES) {
      const copy = YAKU_COPY[rule.id]
      if (!copy) continue
      expect(copy.explain({}), `${rule.id} with no params`).not.toContain('undefined')
    }
  })
})
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/content src/ui/contentCoverage.test.ts`
Expected: all pass. The gate compares 45 ids against 45 copy entries.

- [ ] **Step 7: Prove the gate bites in both directions**

First, comment out the `chuuren` entry in `src/content/yaku/yakuman.ts`. Re-run the gate.
Expected: FAIL on "has copy for every registered yaku", naming `chuuren`. Restore it.

Now add a bogus entry to `THREE_HAN_COPY`:

```ts
  'not-a-real-yaku': { name: 'X', short: 'x', explain: () => 'x'.repeat(50) },
```

Re-run the gate.
Expected: FAIL on "has no copy for a yaku that does not exist". Remove it.

Record both failures in your report. A one-directional gate would let dead copy accumulate silently.

- [ ] **Step 8: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(content): complete the yaku copy and add the coverage gate"
```

---

## Task 14: Fu, wait and status copy

**Files:**
- Create: `src/content/fu.ts`
- Create: `src/content/fu.test.ts`
- Create: `src/content/wait.ts`
- Modify: `src/content/status.ts`
- Modify: `src/content/score.ts`

**Interfaces:**
- Consumes: nothing (content layer).
- Produces:
  - `fuLineCopy(line: FuLineLike): { label: string; detail: string }`
  - `WAIT_COPY: Record<string, { name: string; detail: string }>`
  - `STATUS_COPY` for the engine's four `CalculationStatus` values
  - `VALIDATION_COPY` for the four `ValidationIssue` codes

**Why fu copy is a function (spec §6.2).** The engine emits generic ids with the specifics alongside — `{ id: 'ankou', fu: 8, tile: {suit:'m',rank:9,red:false} }`. The same id covers a concealed triplet of simples (4 fu) and of terminals or honours (8 fu). The wording must therefore be derived from `fu` and `tile`, not looked up by a compound key.

**The fu ids the engine emits, and what each means** — confirmed against `src/engine/fu.ts`:

| id | fu | meaning |
|---|---|---|
| `base` | 20 | the base every standard hand starts from |
| `chiitoitsu` | 25 | seven pairs, a flat replacement for the whole calculation |
| `menzen-ron` | 10 | closed hand completed on a discard |
| `tsumo` | 2 | self-draw |
| `minko` | 2 or 4 | open triplet — 2 simples, 4 terminals/honours |
| `ankou` | 4 or 8 | concealed triplet — 4 simples, 8 terminals/honours |
| `minkan` | 8 or 16 | open kan — 8 simples, 16 terminals/honours |
| `ankan` | 16 or 32 | closed kan — 16 simples, 32 terminals/honours |
| `value-pair` | 2 or 4 | a pair of dragons, seat wind, or round wind |
| `wait` | 2 | a closed wait: kanchan, penchan, or tanki |

- [ ] **Step 1: Write the wait copy**

Create `src/content/wait.ts`:

```ts
/** Copy for the five wait shapes. Keyed by the engine's WaitType. */
export const WAIT_COPY: Record<string, { name: string; detail: string }> = {
  ryanmen: {
    name: 'Two-sided wait',
    detail: 'You were waiting on either end of a run, such as 34 waiting on 2 or 5. Two ways to win, so it earns no fu.',
  },
  kanchan: {
    name: 'Closed wait',
    detail: 'You were waiting on the middle of a run, such as 35 waiting on 4. Only one tile completes it, which is worth 2 fu.',
  },
  penchan: {
    name: 'Edge wait',
    detail: 'You were waiting on the end of the number range — 12 waiting on 3, or 89 waiting on 7. One tile only, worth 2 fu.',
  },
  tanki: {
    name: 'Pair wait',
    detail: 'You were waiting to complete the pair. One tile only, worth 2 fu.',
  },
  shanpon: {
    name: 'Dual pair wait',
    detail: 'You held two pairs and needed either one to become a triplet. It earns no fu on its own, though the resulting triplet does.',
  },
}

export function waitName(wait: string | null): string {
  return wait ? (WAIT_COPY[wait]?.name ?? wait) : ''
}

export function waitDetail(wait: string | null): string {
  return wait ? (WAIT_COPY[wait]?.detail ?? '') : ''
}
```

- [ ] **Step 2: Write the failing fu test**

Create `src/content/fu.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fuLineCopy } from './fu'

describe('fuLineCopy', () => {
  it('describes the base fu', () => {
    const { label, detail } = fuLineCopy({ id: 'base', fu: 20 })
    expect(label).toBe('Base')
    expect(detail).toContain('20')
  })

  it('describes the seven-pairs flat value', () => {
    expect(fuLineCopy({ id: 'chiitoitsu', fu: 25 }).detail).toContain('25')
  })

  it('describes a closed ron', () => {
    const { label, detail } = fuLineCopy({ id: 'menzen-ron', fu: 10 })
    expect(label).toContain('Closed hand')
    expect(detail).toContain('discard')
  })

  it('describes a self-draw', () => {
    expect(fuLineCopy({ id: 'tsumo', fu: 2 }).detail).toContain('drew')
  })

  it('distinguishes a simple concealed triplet from a terminal one', () => {
    const simple = fuLineCopy({ id: 'ankou', fu: 4, tile: { suit: 'p', rank: 3, red: false } })
    const terminal = fuLineCopy({ id: 'ankou', fu: 8, tile: { suit: 'm', rank: 9, red: false } })
    expect(simple.label).toContain('Concealed triplet')
    expect(simple.detail).toContain('Three of circles')
    expect(terminal.detail).toContain('Nine of characters')
    expect(terminal.detail).toContain('terminal')
    expect(simple.detail).not.toContain('terminal')
  })

  it('distinguishes an open triplet from a concealed one', () => {
    const open = fuLineCopy({ id: 'minko', fu: 2, tile: { suit: 'p', rank: 3, red: false } })
    expect(open.label).toContain('Open triplet')
    expect(open.detail).toContain('worth half')
  })

  it('describes closed and open kans', () => {
    expect(fuLineCopy({ id: 'ankan', fu: 16 }).label).toContain('Closed kan')
    expect(fuLineCopy({ id: 'minkan', fu: 8 }).label).toContain('Open kan')
  })

  it('describes an honour pair', () => {
    const { label, detail } = fuLineCopy({
      id: 'value-pair', fu: 2, tile: { suit: 'z', rank: 5, red: false },
    })
    expect(label).toContain('Pair')
    expect(detail).toContain('White dragon')
  })

  it('describes a double-wind pair by its fu value', () => {
    const detail = fuLineCopy({
      id: 'value-pair', fu: 4, tile: { suit: 'z', rank: 1, red: false },
    }).detail
    expect(detail).toContain('both')
  })

  it('describes a closed wait', () => {
    expect(fuLineCopy({ id: 'wait', fu: 2 }).label).toContain('Wait')
  })

  it('falls back to the id rather than rendering blank', () => {
    const { label, detail } = fuLineCopy({ id: 'unknown-line', fu: 6 })
    expect(label).toBe('unknown-line')
    expect(detail).toBe('')
  })

  it('never renders undefined when the tile is missing', () => {
    for (const id of ['ankou', 'minko', 'ankan', 'minkan', 'value-pair']) {
      const { label, detail } = fuLineCopy({ id, fu: 4 })
      expect(`${label} ${detail}`, id).not.toContain('undefined')
    }
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/content/fu.test.ts`
Expected: FAIL — cannot resolve `./fu`.

- [ ] **Step 4: Write the fu copy**

Create `src/content/fu.ts`:

```ts
import { tileName, type TileLike } from './tiles'

/** Structural mirror of the engine's FuLine — content must not import the engine. */
export interface FuLineLike {
  id: string
  fu: number
  tile?: TileLike
}

const isTerminalOrHonour = (tile: TileLike): boolean =>
  tile.suit === 'z' || tile.rank === 1 || tile.rank === 9

/** "of Nine of characters" — or nothing at all when the engine gave us no tile. */
const named = (tile: TileLike | undefined): string => (tile ? ` of ${tileName(tile)}` : '')

function tripletCopy(
  line: FuLineLike, kindLabel: string, concealed: boolean,
): { label: string; detail: string } {
  const { tile } = line
  const terminal = tile ? isTerminalOrHonour(tile) : line.fu >= 8
  const worth = terminal
    ? 'Terminals, winds and dragons are worth double what simples are.'
    : ''
  const openness = concealed
    ? 'You formed it yourself rather than calling for it, which doubles its value.'
    : 'An open set is worth half what the same set would be concealed.'
  return {
    label: `${kindLabel}${named(tile)}`,
    detail: `${line.fu} fu. ${openness} ${worth}`.trim(),
  }
}

export function fuLineCopy(line: FuLineLike): { label: string; detail: string } {
  switch (line.id) {
    case 'base':
      return {
        label: 'Base',
        detail: 'Every standard hand starts from 20 fu before anything else is counted.',
      }

    case 'chiitoitsu':
      return {
        label: 'Seven pairs',
        detail: 'Seven pairs is always scored as a flat 25 fu — none of the usual fu rules apply to it.',
      }

    case 'menzen-ron':
      return {
        label: 'Closed hand, won on a discard',
        detail: '10 fu. A closed hand completed by someone else’s discard earns a bonus that an open hand does not.',
      }

    case 'tsumo':
      return {
        label: 'Self-draw',
        detail: '2 fu, because you drew the winning tile yourself.',
      }

    case 'ankou':
      return tripletCopy(line, 'Concealed triplet', true)

    case 'minko':
      return tripletCopy(line, 'Open triplet', false)

    case 'ankan':
      return tripletCopy(line, 'Closed kan', true)

    case 'minkan':
      return tripletCopy(line, 'Open kan', false)

    case 'value-pair': {
      const both = line.fu >= 4
      return {
        label: `Pair${named(line.tile)}`,
        detail: both
          ? `${line.fu} fu. This wind is both your seat wind and the round wind, so the pair counts twice.`
          : `${line.fu} fu. A pair of dragons, your seat wind, or the round wind is worth fu; any other pair is not.`,
      }
    }

    case 'wait':
      return {
        label: 'Wait',
        detail: `${line.fu} fu. You were waiting on a single tile rather than a two-sided shape.`,
      }

    default:
      return { label: line.id, detail: '' }
  }
}
```

- [ ] **Step 5: Run the fu tests**

Run: `npx vitest run src/content/fu.test.ts`
Expected: 12 passed.

- [ ] **Step 6: Extend the status copy**

Append to `src/content/status.ts`:

```ts
/** Copy for the engine's CalculationStatus values. */
export const STATUS_COPY: Record<string, { headline: string; detail: string }> = {
  invalid: {
    headline: 'This hand is not legal',
    detail: 'Something about the tiles or the circumstances does not add up. The details are below.',
  },
  'not-a-winning-hand': {
    headline: 'These tiles do not form a winning hand',
    detail:
      'A winning hand is four sets and a pair, or one of the two exceptions: seven pairs, or thirteen orphans. ' +
      'These tiles cannot be arranged into any of those.',
  },
  'no-yaku': {
    headline: 'Complete, but you cannot win with it',
    detail:
      'The tiles form a valid hand, but nothing in it counts as a yaku — and a hand with no yaku cannot be declared a win, ' +
      'however many dora it holds. Dora add value to a hand that already has a yaku; they can never provide one.',
  },
}

/** Suggestions offered alongside the no-yaku status. */
export const NO_YAKU_SUGGESTIONS = [
  'Declaring riichi with a closed hand is a yaku on its own.',
  'Winning by self-draw with a fully closed hand scores menzen tsumo.',
  'A hand with no terminals or honours anywhere scores tanyao.',
  'A triplet of dragons, your seat wind, or the round wind is a yaku.',
] as const

/** Copy for the engine's ValidationIssue codes. */
export const VALIDATION_COPY: Record<string, (issue: Record<string, unknown>) => string> = {
  incomplete: (issue) =>
    `The hand is ${issue.tilesNeeded} tile${issue.tilesNeeded === 1 ? '' : 's'} short of fourteen.`,
  'too-many-tiles': (issue) =>
    `The hand has ${issue.excess} tile${issue.excess === 1 ? '' : 's'} too many.`,
  'impossible-duplicates': () =>
    'There are more than four copies of a tile, which cannot happen — a set has only four of each.',
  'context-conflict': (issue) => String(issue.message ?? 'These circumstances cannot occur together.'),
}
```

- [ ] **Step 7: Extend the score step labels**

Replace the contents of `src/content/score.ts` with:

```ts
/**
 * Display copy for score() arithmetic steps, keyed by the step's stable id
 * (see ScoreStep in src/engine/score.ts), plus labels for the payment shapes.
 *
 * This module must not import anything from src/engine/**.
 */
export const SCORE_STEP_LABELS: Record<string, string> = {
  'base-points': 'Base points',
  honba: 'Honba',
  'riichi-sticks': 'Riichi sticks',
}

export const PAYMENT_COPY = {
  discarderPays: 'The player who discarded pays',
  eachPlayerPays: 'Each other player pays',
  dealerPays: 'The dealer pays',
  eachNonDealerPays: 'Each non-dealer pays',
  total: 'You receive',
  handValue: 'Hand value',
} as const

export const LIMIT_COPY: Record<string, string> = {
  mangan: 'Mangan',
  haneman: 'Haneman',
  baiman: 'Baiman',
  sanbaiman: 'Sanbaiman',
  'kazoe-yakuman': 'Counted yakuman',
  yakuman: 'Yakuman',
}
```

Note this **removes** four unused keys (`discarder-pays`, `each-player-pays`, `dealer-pays`, `each-non-dealer-pays`) that never matched a step id the engine emits. Confirm with `grep -o "id: '[a-z-]*'" src/engine/score.ts` that the engine emits exactly `base-points`, `honba` and `riichi-sticks` before deleting them. If the engine emits more, keep those and report the discrepancy.

- [ ] **Step 8: Update the score copy test**

Replace `src/content/score.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { SCORE_STEP_LABELS, PAYMENT_COPY, LIMIT_COPY } from './score'

describe('score copy', () => {
  it('labels every step the engine emits', () => {
    for (const id of ['base-points', 'honba', 'riichi-sticks']) {
      expect(SCORE_STEP_LABELS[id]).toBeTruthy()
    }
  })

  it('carries no labels for steps that do not exist', () => {
    expect(Object.keys(SCORE_STEP_LABELS)).toHaveLength(3)
  })

  it('names every limit class', () => {
    for (const id of ['mangan', 'haneman', 'baiman', 'sanbaiman', 'kazoe-yakuman', 'yakuman']) {
      expect(LIMIT_COPY[id]).toBeTruthy()
    }
  })

  it('provides payment labels', () => {
    expect(PAYMENT_COPY.discarderPays).toBeTruthy()
    expect(PAYMENT_COPY.total).toBeTruthy()
  })
})
```

- [ ] **Step 9: Run everything**

Run: `npm test`
Expected: all green.

- [ ] **Step 10: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(content): add fu, wait, status and score display copy"
```

---

## Task 15: Score headline and yaku list

**Files:**
- Create: `src/ui/results/ScoreHeadline.tsx`
- Create: `src/ui/results/YakuList.tsx`
- Create: `src/ui/results/results.css`
- Create: `src/ui/results/ScoreHeadline.test.tsx`
- Create: `src/ui/results/YakuList.test.tsx`

**Interfaces:**
- Consumes: engine `Candidate` (from `src/engine/select`), `ScoreResult`, `YakuResult`; copy from `src/content/yaku` and `src/content/score`.
- Produces:
  - `<ScoreHeadline candidate={Candidate} />`
  - `<YakuList yaku={YakuResult[]} concise={boolean} onHover?: (index: number | null) => void />`

**Formatting rules:**
- Points use thousands separators: `7,700`, not `7700`.
- Han and fu read `3 han 40 fu`. A yakuman hand shows the limit name instead of a fu count.
- `limitClass` is `null` for an ordinary hand; render nothing rather than an empty badge.

- [ ] **Step 1: Write the failing headline test**

Create `src/ui/results/ScoreHeadline.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ScoreHeadline } from './ScoreHeadline'
import { calculate } from '../../engine/calculate'
import { WRC_2025 } from '../../engine/rulesets/wrc2025'
import { parseTiles } from '../../engine/tiles'
import type { Hand, WinContext } from '../../engine/types'

const ctx: WinContext = {
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
}

const score = (concealed: string, winning: string, overrides: Partial<WinContext> = {}) => {
  const hand: Hand = {
    concealed: parseTiles(concealed),
    melds: [],
    winningTile: parseTiles(winning)[0],
    winSource: 'ron',
  }
  const result = calculate(hand, { ...ctx, ...overrides }, WRC_2025)
  if (!result.best) throw new Error(`expected a scored hand, got ${result.status}`)
  return result.best
}

describe('ScoreHeadline', () => {
  it('shows the total with thousands separators', () => {
    const candidate = score('234m456p22s678s55z', '5z')
    render(<ScoreHeadline candidate={candidate} />)
    const total = candidate.score.total
    expect(screen.getByText(total.toLocaleString('en-US'))).toBeInTheDocument()
  })

  it('shows han and fu', () => {
    const candidate = score('234m456p22s678s55z', '5z')
    render(<ScoreHeadline candidate={candidate} />)
    expect(screen.getByText(new RegExp(`${candidate.han} han`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${candidate.fu.total} fu`))).toBeInTheDocument()
  })

  it('shows no limit badge for an ordinary hand', () => {
    const candidate = score('234m456p22s678s55z', '5z')
    expect(candidate.score.limitClass).toBeNull()
    const { container } = render(<ScoreHeadline candidate={candidate} />)
    expect(container.querySelector('.headline__limit')).toBeNull()
  })

  it('names the limit class when the hand reaches one', () => {
    // Kokushi musou — a yakuman.
    const candidate = score('19m19p19s1234567z', '1m')
    render(<ScoreHeadline candidate={candidate} />)
    expect(screen.getByText(/Yakuman/i)).toBeInTheDocument()
  })

  it('shows no fu count for a yakuman', () => {
    const candidate = score('19m19p19s1234567z', '1m')
    const { container } = render(<ScoreHeadline candidate={candidate} />)
    expect(container.querySelector('.headline__hanfu')!.textContent).not.toContain('fu')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/ui/results/ScoreHeadline.test.tsx`
Expected: FAIL — cannot resolve `./ScoreHeadline`.

- [ ] **Step 3: Write ScoreHeadline**

Create `src/ui/results/ScoreHeadline.tsx`:

```tsx
import type { Candidate } from '../../engine/select'
import { LIMIT_COPY } from '../../content/score'
import './results.css'

export interface ScoreHeadlineProps {
  candidate: Candidate
}

export function ScoreHeadline({ candidate }: ScoreHeadlineProps) {
  const { score, han, fu, yakumanMultiplier } = candidate
  const isYakuman = yakumanMultiplier > 0

  return (
    <header className="headline">
      <div className="headline__total">{score.total.toLocaleString('en-US')}</div>
      <div className="headline__hanfu">
        {isYakuman ? `${han} han` : `${han} han ${fu.total} fu`}
      </div>
      {score.limitClass && (
        <div className="headline__limit">{LIMIT_COPY[score.limitClass] ?? score.limitClass}</div>
      )}
    </header>
  )
}
```

- [ ] **Step 4: Write the failing yaku list test**

Create `src/ui/results/YakuList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { YakuList } from './YakuList'
import type { YakuResult } from '../../engine/yaku/types'

const yaku = (id: string, han: number, params = {}): YakuResult => ({
  id, han, yakuman: 0, evidence: { params },
})

describe('YakuList', () => {
  it('names each yaku and its han', () => {
    render(<YakuList yaku={[yaku('tanyao', 1), yaku('pinfu', 1)]} concise={false} />)
    expect(screen.getByText('Tanyao')).toBeInTheDocument()
    expect(screen.getByText('Pinfu')).toBeInTheDocument()
    expect(screen.getAllByText('1 han')).toHaveLength(2)
  })

  it('shows the full explanation in beginner mode', () => {
    render(<YakuList yaku={[yaku('tanyao', 1)]} concise={false} />)
    expect(screen.getByText(/between 2 and 8/)).toBeInTheDocument()
  })

  it('shows only the short form in concise mode', () => {
    render(<YakuList yaku={[yaku('tanyao', 1)]} concise />)
    expect(screen.queryByText(/between 2 and 8/)).toBeNull()
    expect(screen.getByText(/No terminals and no honours/)).toBeInTheDocument()
  })

  it('interpolates evidence into the explanation', () => {
    render(
      <YakuList
        yaku={[yaku('yakuhai-seat', 1, { source: 'seat-wind', wind: 'W' })]}
        concise={false}
      />,
    )
    expect(screen.getByText(/West/)).toBeInTheDocument()
  })

  it('labels a yakuman by multiplier rather than han', () => {
    render(
      <YakuList
        yaku={[{ id: 'daisangen', han: 0, yakuman: 1, evidence: {} }]}
        concise={false}
      />,
    )
    expect(screen.getByText(/Yakuman/i)).toBeInTheDocument()
    expect(screen.queryByText('0 han')).toBeNull()
  })

  it('labels a double yakuman', () => {
    render(
      <YakuList
        yaku={[{ id: 'suuankou-tanki', han: 0, yakuman: 2, evidence: {} }]}
        concise={false}
      />,
    )
    expect(screen.getByText(/Double yakuman/i)).toBeInTheDocument()
  })

  it('reports the hovered index for evidence highlighting', async () => {
    const onHover = vi.fn()
    render(
      <YakuList yaku={[yaku('tanyao', 1), yaku('pinfu', 1)]} concise={false} onHover={onHover} />,
    )
    await userEvent.hover(screen.getByText('Pinfu'))
    expect(onHover).toHaveBeenCalledWith(1)
    await userEvent.unhover(screen.getByText('Pinfu'))
    expect(onHover).toHaveBeenCalledWith(null)
  })

  it('renders nothing when there are no yaku', () => {
    const { container } = render(<YakuList yaku={[]} concise={false} />)
    expect(container.querySelector('.yaku-list')).toBeNull()
  })
})
```

- [ ] **Step 5: Write YakuList**

Create `src/ui/results/YakuList.tsx`:

```tsx
import type { YakuResult } from '../../engine/yaku/types'
import { YAKU_COPY } from '../../content/yaku'
import './results.css'

/** A yakuman is labelled by its multiplier, not by a han count. */
function valueLabel(entry: YakuResult): string {
  if (entry.yakuman <= 0) return `${entry.han} han`
  if (entry.yakuman === 1) return 'Yakuman'
  if (entry.yakuman === 2) return 'Double yakuman'
  return `${entry.yakuman}× yakuman`
}

export interface YakuListProps {
  yaku: YakuResult[]
  concise: boolean
  /** Index of the hovered entry, or null. Drives evidence highlighting. */
  onHover?: (index: number | null) => void
}

export function YakuList({ yaku, concise, onHover }: YakuListProps) {
  if (yaku.length === 0) return null

  return (
    <ul className="yaku-list">
      {yaku.map((entry, index) => {
        const copy = YAKU_COPY[entry.id]
        return (
          <li
            className="yaku-list__item"
            key={entry.id}
            onMouseEnter={() => onHover?.(index)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(index)}
            onBlur={() => onHover?.(null)}
            tabIndex={0}
          >
            <div className="yaku-list__row">
              <span className="yaku-list__name">{copy?.name ?? entry.id}</span>
              <span className="yaku-list__value">{valueLabel(entry)}</span>
            </div>
            <p className="yaku-list__detail">
              {concise
                ? (copy?.short ?? '')
                : (copy?.explain(entry.evidence.params ?? {}) ?? '')}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 6: Write the stylesheet**

Create `src/ui/results/results.css`:

```css
.headline { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.headline__total { font-size: 40px; font-weight: 700; line-height: 1.1; }
.headline__hanfu { font-size: 16px; opacity: 0.75; }
.headline__limit {
  padding: 2px 10px; border-radius: 999px;
  background: #f59e0b; color: #111827;
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
}

.yaku-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.yaku-list__item { padding: 6px 8px; border-radius: 4px; }
.yaku-list__item:hover, .yaku-list__item:focus-visible { background: rgba(37, 99, 235, 0.07); outline: none; }
.yaku-list__row { display: flex; justify-content: space-between; gap: 12px; }
.yaku-list__name { font-weight: 600; }
.yaku-list__value { opacity: 0.7; white-space: nowrap; }
.yaku-list__detail { margin: 4px 0 0; font-size: 13px; line-height: 1.55; opacity: 0.78; max-width: 60ch; }
.yaku-list__detail:empty { display: none; }

.results__section { display: flex; flex-direction: column; gap: 8px; }
.results__heading { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/ui/results`
Expected: 13 passed (5 headline + 8 yaku list).

- [ ] **Step 8: Prove the concise branch bites**

In `YakuList`, change the ternary to always render `copy?.explain(...)`. Re-run.
Expected: FAIL on "shows only the short form in concise mode".
Restore it.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the score headline and yaku list"
```

---

## Task 16: Fu breakdown, dora and payment arithmetic

**Files:**
- Create: `src/ui/results/FuBreakdown.tsx`
- Create: `src/ui/results/DoraList.tsx`
- Create: `src/ui/results/PaymentSteps.tsx`
- Create: `src/ui/results/FuBreakdown.test.tsx`
- Create: `src/ui/results/DoraList.test.tsx`
- Create: `src/ui/results/PaymentSteps.test.tsx`
- Modify: `src/ui/results/results.css`

**Interfaces:**
- Consumes: engine `FuResult`, `DoraResult`, `ScoreResult`; `fuLineCopy`, `waitName`/`waitDetail`, `SCORE_STEP_LABELS`, `PAYMENT_COPY`.
- Produces:
  - `<FuBreakdown fu={FuResult} concise={boolean} />`
  - `<DoraList dora={DoraResult} />`
  - `<PaymentSteps score={ScoreResult} />`

**Key behaviours:**
- `FuBreakdown` shows each line, then the rounding step: `raw` → `total`. When `raw === total` (chiitoitsu, or an exact multiple of ten) say so rather than showing a pointless rounding line.
- `DoraList` shows dora, aka and ura **separately** — a player needs to see which came from where. Render nothing when `total === 0`.
- `PaymentSteps` renders the engine's `steps` array in order, then the payment shape from the `payments` discriminated union.

- [ ] **Step 1: Write the failing FuBreakdown test**

Create `src/ui/results/FuBreakdown.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { FuBreakdown } from './FuBreakdown'
import type { FuResult } from '../../engine/fu'

const fu = (over: Partial<FuResult> = {}): FuResult => ({
  lines: [{ id: 'base', fu: 20 }],
  raw: 20, total: 20, wait: null, ...over,
})

describe('FuBreakdown', () => {
  it('lists each fu line with its value', () => {
    render(<FuBreakdown fu={fu({
      lines: [{ id: 'base', fu: 20 }, { id: 'menzen-ron', fu: 10 }],
      raw: 30, total: 30,
    })} concise={false} />)
    expect(screen.getByText('Base')).toBeInTheDocument()
    expect(screen.getByText(/Closed hand/)).toBeInTheDocument()
  })

  it('names the tile on a triplet line', () => {
    render(<FuBreakdown fu={fu({
      lines: [{ id: 'base', fu: 20 }, { id: 'ankou', fu: 8, tile: { suit: 'm', rank: 9, red: false } }],
      raw: 28, total: 30,
    })} concise={false} />)
    expect(screen.getByText(/Nine of characters/)).toBeInTheDocument()
  })

  it('shows the rounding when the raw total is not a multiple of ten', () => {
    render(<FuBreakdown fu={fu({ raw: 28, total: 30 })} concise={false} />)
    expect(screen.getByText(/28/)).toBeInTheDocument()
    expect(screen.getByText(/rounded up/i)).toBeInTheDocument()
  })

  it('does not show a rounding line when nothing was rounded', () => {
    render(<FuBreakdown fu={fu({ raw: 30, total: 30 })} concise={false} />)
    expect(screen.queryByText(/rounded up/i)).toBeNull()
  })

  it('describes the wait', () => {
    render(<FuBreakdown fu={fu({ wait: 'kanchan' })} concise={false} />)
    expect(screen.getByText(/Closed wait/)).toBeInTheDocument()
    expect(screen.getByText(/middle of a run/)).toBeInTheDocument()
  })

  it('hides the wait detail in concise mode but keeps its name', () => {
    render(<FuBreakdown fu={fu({ wait: 'kanchan' })} concise />)
    expect(screen.getByText(/Closed wait/)).toBeInTheDocument()
    expect(screen.queryByText(/middle of a run/)).toBeNull()
  })

  it('hides the per-line detail in concise mode', () => {
    render(<FuBreakdown fu={fu()} concise />)
    expect(screen.queryByText(/Every standard hand starts/)).toBeNull()
  })
})
```

- [ ] **Step 2: Write FuBreakdown**

Create `src/ui/results/FuBreakdown.tsx`:

```tsx
import type { FuResult } from '../../engine/fu'
import { fuLineCopy } from '../../content/fu'
import { waitDetail, waitName } from '../../content/wait'
import './results.css'

export interface FuBreakdownProps {
  fu: FuResult
  concise: boolean
}

export function FuBreakdown({ fu, concise }: FuBreakdownProps) {
  return (
    <div className="fu">
      <ul className="fu__lines">
        {fu.lines.map((line, index) => {
          const copy = fuLineCopy(line)
          return (
            <li className="fu__line" key={`${line.id}-${index}`}>
              <div className="fu__row">
                <span>{copy.label}</span>
                <span className="fu__value">{line.fu} fu</span>
              </div>
              {!concise && copy.detail && <p className="fu__detail">{copy.detail}</p>}
            </li>
          )
        })}
      </ul>

      {fu.wait && (
        <div className="fu__wait">
          <span className="fu__wait-name">{waitName(fu.wait)}</span>
          {!concise && <p className="fu__detail">{waitDetail(fu.wait)}</p>}
        </div>
      )}

      <div className="fu__total">
        {fu.raw === fu.total ? (
          <span>{fu.total} fu</span>
        ) : (
          <span>{fu.raw} fu, rounded up to {fu.total} fu</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write the failing DoraList test**

Create `src/ui/results/DoraList.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DoraList } from './DoraList'
import type { DoraResult } from '../../engine/dora'
import { parseTiles } from '../../engine/tiles'

const empty: DoraResult = { dora: 0, aka: 0, ura: 0, total: 0, details: [], uraDetails: [] }

describe('DoraList', () => {
  it('renders nothing when there is no dora', () => {
    const { container } = render(<DoraList dora={empty} />)
    expect(container.querySelector('.dora')).toBeNull()
  })

  it('shows dora, aka and ura separately', () => {
    render(<DoraList dora={{
      ...empty,
      dora: 2, aka: 1, ura: 3, total: 6,
      details: [{
        indicator: parseTiles('6p')[0], doraTile: parseTiles('7p')[0], count: 2,
      }],
      uraDetails: [{
        indicator: parseTiles('2s')[0], doraTile: parseTiles('3s')[0], count: 3,
      }],
    }} />)
    expect(screen.getByText(/Dora/)).toBeInTheDocument()
    expect(screen.getByText(/Red fives/)).toBeInTheDocument()
    expect(screen.getByText(/Ura dora/)).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('omits the aka row when there are no red fives', () => {
    render(<DoraList dora={{ ...empty, dora: 1, total: 1 }} />)
    expect(screen.queryByText(/Red fives/)).toBeNull()
  })

  it('omits the ura row when riichi was not declared', () => {
    render(<DoraList dora={{ ...empty, dora: 1, total: 1 }} />)
    expect(screen.queryByText(/Ura dora/)).toBeNull()
  })

  it('shows which indicator produced the dora', () => {
    const { container } = render(<DoraList dora={{
      ...empty, dora: 2, total: 2,
      details: [{
        indicator: parseTiles('6p')[0], doraTile: parseTiles('7p')[0], count: 2,
      }],
    }} />)
    // Indicator and the tile it points at are both rendered.
    expect(container.querySelectorAll('use').length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 4: Write DoraList**

Create `src/ui/results/DoraList.tsx`:

```tsx
import type { DoraDetail, DoraResult } from '../../engine/dora'
import { tileName } from '../../content/tiles'
import { Tile } from '../tiles/Tile'
import './results.css'

const DORA_COPY = {
  dora: 'Dora',
  aka: 'Red fives',
  ura: 'Ura dora',
  points: 'from',
} as const

function DetailRow({ detail }: { detail: DoraDetail }) {
  return (
    <span className="dora__detail">
      <Tile tile={detail.indicator} size="sm" label={tileName(detail.indicator)} />
      <span aria-hidden="true">→</span>
      <Tile tile={detail.doraTile} size="sm" label={tileName(detail.doraTile)} />
      <span className="dora__count">×{detail.count}</span>
    </span>
  )
}

export interface DoraListProps {
  dora: DoraResult
}

export function DoraList({ dora }: DoraListProps) {
  if (dora.total === 0) return null

  return (
    <div className="dora">
      {dora.dora > 0 && (
        <div className="dora__row">
          <span className="dora__label">{DORA_COPY.dora}</span>
          <span className="dora__details">
            {dora.details.map((detail, i) => <DetailRow key={i} detail={detail} />)}
          </span>
          <span className="dora__value">{dora.dora}</span>
        </div>
      )}

      {dora.aka > 0 && (
        <div className="dora__row">
          <span className="dora__label">{DORA_COPY.aka}</span>
          <span className="dora__details" />
          <span className="dora__value">{dora.aka}</span>
        </div>
      )}

      {dora.ura > 0 && (
        <div className="dora__row">
          <span className="dora__label">{DORA_COPY.ura}</span>
          <span className="dora__details">
            {dora.uraDetails.map((detail, i) => <DetailRow key={i} detail={detail} />)}
          </span>
          <span className="dora__value">{dora.ura}</span>
        </div>
      )}

      <div className="dora__row dora__row--total">
        <span className="dora__label">Total</span>
        <span className="dora__details" />
        <span className="dora__value">{dora.total}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write the failing PaymentSteps test**

Create `src/ui/results/PaymentSteps.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PaymentSteps } from './PaymentSteps'
import type { ScoreResult } from '../../engine/score'

const base: ScoreResult = {
  limitClass: null,
  basePoints: 240,
  payments: { kind: 'ron', discarderPays: 3900 },
  handTotal: 3900,
  total: 3900,
  steps: [{ id: 'base-points', expression: '30 × 2^(3+2) = 960', value: 960 }],
}

describe('PaymentSteps', () => {
  it('renders each arithmetic step with its label and expression', () => {
    render(<PaymentSteps score={base} />)
    expect(screen.getByText('Base points')).toBeInTheDocument()
    expect(screen.getByText('30 × 2^(3+2) = 960')).toBeInTheDocument()
  })

  it('describes a ron payment', () => {
    render(<PaymentSteps score={base} />)
    expect(screen.getByText(/player who discarded pays/i)).toBeInTheDocument()
    // 3,900 appears twice — as the discarder's payment and as the total.
    expect(screen.getAllByText('3,900')).toHaveLength(2)
  })

  it('describes a non-dealer tsumo as two different payments', () => {
    render(<PaymentSteps score={{
      ...base,
      payments: { kind: 'tsumo', dealerPays: 2000, nonDealerPays: 1000 },
      handTotal: 4000, total: 4000,
    }} />)
    expect(screen.getByText(/dealer pays/i)).toBeInTheDocument()
    expect(screen.getByText(/non-dealer pays/i)).toBeInTheDocument()
    expect(screen.getByText('2,000')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument()
  })

  it('describes a dealer tsumo as one payment from everyone', () => {
    render(<PaymentSteps score={{
      ...base,
      payments: { kind: 'tsumo-all', eachPays: 2000 },
      handTotal: 6000, total: 6000,
    }} />)
    expect(screen.getByText(/each other player pays/i)).toBeInTheDocument()
    expect(screen.getByText('2,000')).toBeInTheDocument()
  })

  it('separates the hand value from the total when sticks and honba apply', () => {
    render(<PaymentSteps score={{ ...base, handTotal: 3900, total: 5200 }} />)
    expect(screen.getAllByText('3,900').length).toBeGreaterThan(0)
    expect(screen.getByText('5,200')).toBeInTheDocument()
  })

  it('shows only one figure when nothing was added', () => {
    render(<PaymentSteps score={base} />)
    expect(screen.queryByText(/Hand value/i)).toBeNull()
  })
})
```

- [ ] **Step 6: Write PaymentSteps**

Create `src/ui/results/PaymentSteps.tsx`:

```tsx
import type { Payments, ScoreResult } from '../../engine/score'
import { PAYMENT_COPY, SCORE_STEP_LABELS } from '../../content/score'
import './results.css'

const fmt = (n: number): string => n.toLocaleString('en-US')

function PaymentRows({ payments }: { payments: Payments }) {
  switch (payments.kind) {
    case 'ron':
      return (
        <div className="payments__row">
          <span>{PAYMENT_COPY.discarderPays}</span>
          <span className="payments__value">{fmt(payments.discarderPays)}</span>
        </div>
      )
    case 'tsumo':
      return (
        <>
          <div className="payments__row">
            <span>{PAYMENT_COPY.dealerPays}</span>
            <span className="payments__value">{fmt(payments.dealerPays)}</span>
          </div>
          <div className="payments__row">
            <span>{PAYMENT_COPY.eachNonDealerPays}</span>
            <span className="payments__value">{fmt(payments.nonDealerPays)}</span>
          </div>
        </>
      )
    case 'tsumo-all':
      return (
        <div className="payments__row">
          <span>{PAYMENT_COPY.eachPlayerPays}</span>
          <span className="payments__value">{fmt(payments.eachPays)}</span>
        </div>
      )
  }
}

export interface PaymentStepsProps {
  score: ScoreResult
}

export function PaymentSteps({ score }: PaymentStepsProps) {
  return (
    <div className="payments">
      <ul className="payments__steps">
        {score.steps.map((step, index) => (
          <li className="payments__step" key={`${step.id}-${index}`}>
            <span className="payments__step-label">
              {SCORE_STEP_LABELS[step.id] ?? step.id}
            </span>
            <code className="payments__expression">{step.expression}</code>
          </li>
        ))}
      </ul>

      <PaymentRows payments={score.payments} />

      {score.total !== score.handTotal && (
        <div className="payments__row">
          <span>{PAYMENT_COPY.handValue}</span>
          <span className="payments__value">{fmt(score.handTotal)}</span>
        </div>
      )}

      <div className="payments__row payments__row--total">
        <span>{PAYMENT_COPY.total}</span>
        <span className="payments__value">{fmt(score.total)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Extend the stylesheet**

Append to `src/ui/results/results.css`:

```css
.fu__lines { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.fu__row, .payments__row, .dora__row { display: flex; justify-content: space-between; gap: 12px; }
.fu__value, .payments__value, .dora__value { opacity: 0.75; white-space: nowrap; font-variant-numeric: tabular-nums; }
.fu__detail { margin: 2px 0 0; font-size: 12px; line-height: 1.5; opacity: 0.65; max-width: 58ch; }
.fu__wait { margin-top: 6px; }
.fu__wait-name { font-weight: 600; font-size: 13px; }
.fu__total { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,0.12); font-weight: 600; }

.dora { display: flex; flex-direction: column; gap: 6px; }
.dora__label { font-weight: 600; font-size: 13px; }
.dora__details { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dora__detail { display: inline-flex; align-items: center; gap: 3px; }
.dora__count { font-size: 12px; opacity: 0.7; }
.dora__row--total { border-top: 1px solid rgba(0,0,0,0.12); padding-top: 6px; font-weight: 600; }

.payments { display: flex; flex-direction: column; gap: 6px; }
.payments__steps { list-style: none; margin: 0 0 6px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.payments__step { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.payments__step-label { opacity: 0.7; }
.payments__expression { font-size: 12px; font-variant-numeric: tabular-nums; }
.payments__row--total { border-top: 1px solid rgba(0,0,0,0.12); padding-top: 6px; font-weight: 700; }
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/ui/results`
Expected: 31 passed (13 from Task 15, plus 7 fu, 5 dora, 6 payments).

- [ ] **Step 9: Prove the dora separation bites**

In `DoraList`, change the `dora.aka > 0` guard to `false`. Re-run.
Expected: FAIL on "shows dora, aka and ura separately".
Restore it. This is the seam a previous review found survivable in the engine — do not let it become survivable in the UI too.

- [ ] **Step 10: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add the fu breakdown, dora list and payment arithmetic"
```

---

## Task 17: Status notices and other interpretations

**Files:**
- Create: `src/ui/results/StatusNotice.tsx`
- Create: `src/ui/results/OtherInterpretations.tsx`
- Create: `src/ui/results/StatusNotice.test.tsx`
- Create: `src/ui/results/OtherInterpretations.test.tsx`
- Modify: `src/ui/results/results.css`

**Interfaces:**
- Consumes: engine `CalculationResult`, `ValidationIssue`, `Candidate`; `STATUS_COPY`, `NO_YAKU_SUGGESTIONS`, `VALIDATION_COPY`.
- Produces:
  - `<StatusNotice result={CalculationResult} />` — renders nothing when `status === 'scored'`
  - `<OtherInterpretations best={Candidate} alternatives={Candidate[]} />` — renders nothing when there are none

**This is where the app teaches most (spec §4.2).** The `no-yaku` case is the confusing one: a hand that looks finished but cannot be declared. Give it the headline, the explanation, and the suggestions.

**Other interpretations (PLD §15):** when a hand can be read more than one way, show the losing readings and *why* each scores less — different han, different fu, or both. Compare against `best`, and describe the difference in points.

- [ ] **Step 1: Write the failing StatusNotice test**

Create `src/ui/results/StatusNotice.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusNotice } from './StatusNotice'
import type { CalculationResult } from '../../engine/calculate'

const result = (over: Partial<CalculationResult>): CalculationResult => ({
  status: 'scored',
  validation: { ok: true, issues: [] },
  dora: { dora: 0, aka: 0, ura: 0, total: 0, details: [], uraDetails: [] },
  best: null,
  alternatives: [],
  ...over,
})

describe('StatusNotice', () => {
  it('renders nothing for a scored hand', () => {
    const { container } = render(<StatusNotice result={result({ status: 'scored' })} />)
    expect(container.querySelector('.status')).toBeNull()
  })

  it('explains that a hand with no yaku cannot be won', () => {
    render(<StatusNotice result={result({ status: 'no-yaku' })} />)
    expect(screen.getByText(/cannot win with it/i)).toBeInTheDocument()
    expect(screen.getByText(/Dora add value to a hand that already has a yaku/)).toBeInTheDocument()
  })

  it('offers suggestions for a hand with no yaku', () => {
    render(<StatusNotice result={result({ status: 'no-yaku' })} />)
    expect(screen.getByText(/Declaring riichi with a closed hand/)).toBeInTheDocument()
  })

  it('offers no suggestions for other statuses', () => {
    render(<StatusNotice result={result({ status: 'not-a-winning-hand' })} />)
    expect(screen.queryByText(/Declaring riichi with a closed hand/)).toBeNull()
  })

  it('explains a hand that forms no valid structure', () => {
    render(<StatusNotice result={result({ status: 'not-a-winning-hand' })} />)
    expect(screen.getByText(/four sets and a pair/)).toBeInTheDocument()
  })

  it('lists validation issues for an invalid hand', () => {
    render(<StatusNotice result={result({
      status: 'invalid',
      validation: { ok: false, issues: [{ code: 'incomplete', tilesNeeded: 3 }] },
    })} />)
    expect(screen.getByText(/3 tiles short/)).toBeInTheDocument()
  })

  it('uses the singular for a single missing tile', () => {
    render(<StatusNotice result={result({
      status: 'invalid',
      validation: { ok: false, issues: [{ code: 'incomplete', tilesNeeded: 1 }] },
    })} />)
    expect(screen.getByText(/1 tile short/)).toBeInTheDocument()
    expect(screen.queryByText(/1 tiles short/)).toBeNull()
  })

  it('renders a context conflict message from the engine', () => {
    render(<StatusNotice result={result({
      status: 'invalid',
      validation: {
        ok: false,
        issues: [{
          code: 'context-conflict', rule: 'ippatsu-requires-riichi',
          message: 'Ippatsu requires a riichi declaration.',
        }],
      },
    })} />)
    expect(screen.getByText(/Ippatsu requires a riichi declaration/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Write StatusNotice**

Create `src/ui/results/StatusNotice.tsx`:

```tsx
import type { CalculationResult } from '../../engine/calculate'
import type { ValidationIssue } from '../../engine/validate'
import { NO_YAKU_SUGGESTIONS, STATUS_COPY, VALIDATION_COPY } from '../../content/status'
import './results.css'

function issueText(issue: ValidationIssue): string {
  const render = VALIDATION_COPY[issue.code]
  return render ? render(issue as unknown as Record<string, unknown>) : issue.code
}

export interface StatusNoticeProps {
  result: CalculationResult
}

export function StatusNotice({ result }: StatusNoticeProps) {
  if (result.status === 'scored') return null

  const copy = STATUS_COPY[result.status]
  const issues = result.validation.issues

  return (
    <div className="status" role="status">
      <h2 className="status__headline">{copy?.headline ?? result.status}</h2>
      {copy?.detail && <p className="status__detail">{copy.detail}</p>}

      {issues.length > 0 && (
        <ul className="status__issues">
          {issues.map((issue, index) => <li key={index}>{issueText(issue)}</li>)}
        </ul>
      )}

      {result.status === 'no-yaku' && (
        <ul className="status__suggestions">
          {NO_YAKU_SUGGESTIONS.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run the StatusNotice tests**

Run: `npx vitest run src/ui/results/StatusNotice.test.tsx`
Expected: 8 passed.

- [ ] **Step 4: Write the failing OtherInterpretations test**

Create `src/ui/results/OtherInterpretations.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { OtherInterpretations } from './OtherInterpretations'
import type { Candidate } from '../../engine/select'

const candidate = (han: number, fu: number, total: number, yaku: string[]): Candidate => ({
  interp: { structure: 'standard', groups: [] },
  yaku: yaku.map((id) => ({ id, han: 1, yakuman: 0, evidence: {} })),
  fu: { lines: [], raw: fu, total: fu, wait: null },
  han,
  yakumanMultiplier: 0,
  score: {
    limitClass: null, basePoints: 0,
    payments: { kind: 'ron', discarderPays: total },
    handTotal: total, total, steps: [],
  },
})

describe('OtherInterpretations', () => {
  it('renders nothing when there is only one reading', () => {
    const { container } = render(
      <OtherInterpretations best={candidate(3, 40, 5200, ['pinfu'])} alternatives={[]} />,
    )
    expect(container.querySelector('.alternatives')).toBeNull()
  })

  it('is collapsed by default', () => {
    render(
      <OtherInterpretations
        best={candidate(3, 40, 5200, ['pinfu'])}
        alternatives={[candidate(2, 40, 2600, ['tanyao'])]}
      />,
    )
    expect(screen.queryByText(/2 han/)).toBeNull()
  })

  it('reveals the alternatives when expanded', async () => {
    render(
      <OtherInterpretations
        best={candidate(3, 40, 5200, ['pinfu'])}
        alternatives={[candidate(2, 40, 2600, ['tanyao'])]}
      />,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/2 han 40 fu/)).toBeInTheDocument()
  })

  it('names the yaku of each alternative', async () => {
    render(
      <OtherInterpretations
        best={candidate(3, 40, 5200, ['pinfu'])}
        alternatives={[candidate(2, 40, 2600, ['tanyao'])]}
      />,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/Tanyao/)).toBeInTheDocument()
  })

  it('says how much less each alternative is worth', async () => {
    render(
      <OtherInterpretations
        best={candidate(3, 40, 5200, ['pinfu'])}
        alternatives={[candidate(2, 40, 2600, ['tanyao'])]}
      />,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/2,600 less/)).toBeInTheDocument()
  })

  it('describes an equal-payout tie as equal rather than as a loss', async () => {
    render(
      <OtherInterpretations
        best={candidate(3, 40, 5200, ['pinfu'])}
        alternatives={[candidate(4, 25, 5200, ['chiitoitsu'])]}
      />,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByText(/same/i)).toBeInTheDocument()
    expect(screen.queryByText(/less/)).toBeNull()
  })
})
```

The equal-payout case is not hypothetical — the differential sweep in Plan 1 found six real hands where two readings pay identically. Saying "0 less" there would read as a bug.

- [ ] **Step 5: Write OtherInterpretations**

Create `src/ui/results/OtherInterpretations.tsx`:

```tsx
import { useState } from 'react'
import type { Candidate } from '../../engine/select'
import { yakuName } from '../../content/yaku'
import './results.css'

const COPY = {
  toggle: 'Other ways to read this hand',
  same: 'Scores the same, but this reading was chosen first.',
  less: (difference: number) => `${difference.toLocaleString('en-US')} less`,
} as const

function describe(candidate: Candidate, best: Candidate): string {
  const difference = best.score.handTotal - candidate.score.handTotal
  return difference === 0 ? COPY.same : COPY.less(difference)
}

export interface OtherInterpretationsProps {
  best: Candidate
  alternatives: Candidate[]
}

export function OtherInterpretations({ best, alternatives }: OtherInterpretationsProps) {
  const [open, setOpen] = useState(false)
  if (alternatives.length === 0) return null

  return (
    <div className="alternatives">
      <button type="button" className="alternatives__toggle" onClick={() => setOpen(!open)}>
        {COPY.toggle} ({alternatives.length})
      </button>

      {open && (
        <ul className="alternatives__list">
          {alternatives.map((candidate, index) => (
            <li className="alternatives__item" key={index}>
              <div className="alternatives__row">
                <span>{candidate.han} han {candidate.fu.total} fu</span>
                <span className="alternatives__delta">{describe(candidate, best)}</span>
              </div>
              <p className="alternatives__yaku">
                {candidate.yaku.map((entry) => yakuName(entry.id)).join(', ')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Extend the stylesheet**

Append to `src/ui/results/results.css`:

```css
.status { padding: 12px 14px; border-left: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.08); }
.status__headline { margin: 0 0 6px; font-size: 16px; }
.status__detail { margin: 0; font-size: 13px; line-height: 1.55; max-width: 60ch; }
.status__issues, .status__suggestions { margin: 8px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
.status__suggestions { opacity: 0.8; }

.alternatives { margin-top: 8px; }
.alternatives__toggle { padding: 4px 0; border: none; background: none; cursor: pointer; font-size: 13px; text-decoration: underline; }
.alternatives__list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.alternatives__item { padding: 6px 8px; background: rgba(0,0,0,0.03); border-radius: 4px; }
.alternatives__row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
.alternatives__delta { opacity: 0.7; white-space: nowrap; }
.alternatives__yaku { margin: 3px 0 0; font-size: 12px; opacity: 0.7; }
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/ui/results`
Expected: 45 passed (31 from Tasks 15–16, plus 8 status and 6 alternatives).

- [ ] **Step 8: Prove the tie branch bites**

In `describe`, change `difference === 0` to `difference < 0`. Re-run.
Expected: FAIL on "describes an equal-payout tie as equal rather than as a loss".
Restore it.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): add status notices and the other-interpretations disclosure"
```

---

## Task 18: Results panel with evidence highlighting

**Files:**
- Create: `src/ui/results/ResultsPanel.tsx`
- Create: `src/ui/results/evidence.ts`
- Create: `src/ui/results/evidence.test.ts`
- Create: `src/ui/results/ResultsPanel.test.tsx`
- Modify: `src/ui/results/results.css`

**Interfaces:**
- Consumes: everything from Tasks 15–17, plus engine `Evidence`, `Group`, `Tile`.
- Produces:
  - `evidenceTileIndices(evidence: Evidence, tiles: Tile[]): number[]` — which positions in a rendered tile row a yaku's evidence covers
  - `<ResultsPanel result={CalculationResult | null} concise={boolean} onToggleConcise={() => void} handTiles={Tile[]} />`

**Section order is fixed by spec §7.4** and must not be rearranged: score headline → han/fu → yaku list → fu breakdown → dora → payment arithmetic → other interpretations.

**How highlighting works.** A `YakuResult` carries `evidence.tiles` and/or `evidence.groups`. `evidenceTileIndices` maps those back to positions in the hand as rendered, so hovering a yaku lights up exactly the tiles that earned it. Matching is by tile identity (suit + rank + red), consuming each position at most once — otherwise a yaku citing one `5m` would light all three of them.

- [ ] **Step 1: Write the failing evidence test**

Create `src/ui/results/evidence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { evidenceTileIndices } from './evidence'
import { parseTiles } from '../../engine/tiles'
import type { Group } from '../../engine/decompose'

const group = (notation: string): Group => ({
  kind: 'sequence',
  tiles: parseTiles(notation),
  open: false,
  containsWinningTile: false,
})

describe('evidenceTileIndices', () => {
  const hand = parseTiles('123m456m789m11p')

  it('returns nothing for empty evidence', () => {
    expect(evidenceTileIndices({}, hand)).toEqual([])
  })

  it('finds the positions of evidence tiles', () => {
    expect(evidenceTileIndices({ tiles: parseTiles('1m') }, hand)).toEqual([0])
  })

  it('finds the positions of a group', () => {
    expect(evidenceTileIndices({ groups: [group('456m')] }, hand)).toEqual([3, 4, 5])
  })

  it('combines tiles and groups', () => {
    const indices = evidenceTileIndices(
      { tiles: parseTiles('1p'), groups: [group('123m')] },
      hand,
    )
    expect(indices).toEqual([0, 1, 2, 9])
  })

  it('consumes each position at most once', () => {
    const threeFives = parseTiles('555m')
    // Evidence cites two 5m; exactly two positions should light, not all three.
    expect(evidenceTileIndices({ tiles: parseTiles('55m') }, threeFives)).toEqual([0, 1])
  })

  it('distinguishes a red five from an ordinary one', () => {
    const tiles = parseTiles('55m0m')
    const indices = evidenceTileIndices({ tiles: parseTiles('0m') }, tiles)
    expect(indices).toHaveLength(1)
    expect(tiles[indices[0]].red).toBe(true)
  })

  it('ignores evidence tiles that are not in the row', () => {
    expect(evidenceTileIndices({ tiles: parseTiles('9s') }, hand)).toEqual([])
  })

  it('returns the indices sorted', () => {
    const indices = evidenceTileIndices({ groups: [group('789m'), group('123m')] }, hand)
    expect(indices).toEqual([0, 1, 2, 6, 7, 8])
  })
})
```

- [ ] **Step 2: Write the evidence mapper**

Create `src/ui/results/evidence.ts`:

```ts
import type { Tile } from '../../engine/types'
import type { Evidence } from '../../engine/yaku/types'

const sameTile = (a: Tile, b: Tile): boolean =>
  a.suit === b.suit && a.rank === b.rank && a.red === b.red

/**
 * Maps a yaku's evidence back to positions in a rendered tile row, so hovering
 * the yaku highlights exactly the tiles that earned it.
 *
 * Each position is consumed at most once: a yaku citing a single 5m must not
 * light up all three copies in the hand.
 */
export function evidenceTileIndices(evidence: Evidence, tiles: Tile[]): number[] {
  const wanted: Tile[] = [
    ...(evidence.tiles ?? []),
    ...(evidence.groups ?? []).flatMap((group) => group.tiles),
  ]

  const taken = new Set<number>()
  for (const target of wanted) {
    const index = tiles.findIndex((tile, i) => !taken.has(i) && sameTile(tile, target))
    if (index !== -1) taken.add(index)
  }

  return [...taken].sort((a, b) => a - b)
}
```

- [ ] **Step 3: Run the evidence tests**

Run: `npx vitest run src/ui/results/evidence.test.ts`
Expected: 8 passed.

- [ ] **Step 4: Prove the once-only rule bites**

Replace the loop body with a version that collects every match:

```ts
    tiles.forEach((tile, i) => { if (sameTile(tile, target)) taken.add(i) })
```

Re-run.
Expected: FAIL on "consumes each position at most once".
Restore the original.

- [ ] **Step 5: Write the failing ResultsPanel test**

Create `src/ui/results/ResultsPanel.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ResultsPanel } from './ResultsPanel'
import { calculate } from '../../engine/calculate'
import { WRC_2025 } from '../../engine/rulesets/wrc2025'
import { parseTiles } from '../../engine/tiles'
import type { Hand, WinContext } from '../../engine/types'

const ctx: WinContext = {
  seatWind: 'S', roundWind: 'E', riichi: 'none', ippatsu: false,
  haitei: false, houtei: false, rinshan: false, chankan: false,
  tenhou: false, chiihou: false,
  doraIndicators: [], uraIndicators: [], honba: 0, riichiSticks: 0,
}

/** 234m 456p 678s + a White dragon triplet + a 2s pair. Scores yakuhai. */
const scored = () => {
  const hand: Hand = {
    concealed: parseTiles('234m456p22s678s55z'),
    melds: [],
    winningTile: parseTiles('5z')[0],
    winSource: 'ron',
  }
  return { result: calculate(hand, ctx, WRC_2025), tiles: hand.concealed }
}

/**
 * Closed, won on a discard, and deliberately yaku-less: the 1m and 9p rule out
 * tanyao, the dragon pair rules out pinfu, and no three-suit or straight
 * pattern is present.
 */
const noYaku = () => {
  const hand: Hand = {
    concealed: parseTiles('123m456m789p23s55z'),
    melds: [],
    winningTile: parseTiles('4s')[0],
    winSource: 'ron',
  }
  return calculate(hand, ctx, WRC_2025)
}

describe('ResultsPanel', () => {
  it('renders nothing when there is no result', () => {
    const { container } = render(
      <ResultsPanel result={null} concise={false} onToggleConcise={vi.fn()} handTiles={[]} />,
    )
    expect(container.querySelector('.results__scored')).toBeNull()
    expect(container.querySelector('.status')).toBeNull()
  })

  it('renders the sections in the order the spec fixes', () => {
    const { result, tiles } = scored()
    const { container } = render(
      <ResultsPanel result={result} concise={false} onToggleConcise={vi.fn()} handTiles={tiles} />,
    )
    const sections = [...container.querySelectorAll('[data-section]')]
      .map((el) => el.getAttribute('data-section'))
    expect(sections).toEqual([
      'headline', 'yaku', 'fu', 'dora', 'payments', 'alternatives',
    ])
  })

  it('shows a status notice instead of a score when the hand cannot be won', () => {
    const result = noYaku()
    expect(result.status).toBe('no-yaku')
    const { container } = render(
      <ResultsPanel result={result} concise={false} onToggleConcise={vi.fn()} handTiles={[]} />,
    )
    expect(container.querySelector('.status')).not.toBeNull()
    expect(container.querySelector('[data-section="headline"]')).toBeNull()
  })

  it('offers a concise toggle and reports it', async () => {
    const onToggleConcise = vi.fn()
    const { result, tiles } = scored()
    render(
      <ResultsPanel
        result={result} concise={false} onToggleConcise={onToggleConcise} handTiles={tiles}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /concise/i }))
    expect(onToggleConcise).toHaveBeenCalledTimes(1)
  })

  it('highlights the evidence tiles when a yaku is hovered', async () => {
    const { result, tiles } = scored()
    if (!result.best || result.best.yaku.length === 0) throw new Error('fixture has no yaku')
    const { container } = render(
      <ResultsPanel result={result} concise={false} onToggleConcise={vi.fn()} handTiles={tiles} />,
    )
    expect(container.querySelectorAll('.tile--highlighted')).toHaveLength(0)
    await userEvent.hover(container.querySelector('.yaku-list__item')!)
    expect(container.querySelectorAll('.tile--highlighted').length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 6: Write ResultsPanel**

Create `src/ui/results/ResultsPanel.tsx`:

```tsx
import { useState } from 'react'
import type { CalculationResult } from '../../engine/calculate'
import type { Tile } from '../../engine/types'
import { TileRow } from '../tiles/TileRow'
import { tileName } from '../../content/tiles'
import { DoraList } from './DoraList'
import { FuBreakdown } from './FuBreakdown'
import { OtherInterpretations } from './OtherInterpretations'
import { PaymentSteps } from './PaymentSteps'
import { ScoreHeadline } from './ScoreHeadline'
import { StatusNotice } from './StatusNotice'
import { YakuList } from './YakuList'
import { evidenceTileIndices } from './evidence'
import './results.css'

const COPY = {
  concise: 'Concise',
  beginner: 'Explain everything',
  yaku: 'Yaku',
  fu: 'Fu',
  dora: 'Dora',
  payments: 'Payment',
} as const

export interface ResultsPanelProps {
  result: CalculationResult | null
  concise: boolean
  onToggleConcise: () => void
  /** The hand as rendered, so evidence can be mapped to positions. */
  handTiles: Tile[]
}

export function ResultsPanel({
  result, concise, onToggleConcise, handTiles,
}: ResultsPanelProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (!result) return null
  if (result.status !== 'scored' || !result.best) {
    return <StatusNotice result={result} />
  }

  const best = result.best
  const highlight = hovered === null
    ? []
    : evidenceTileIndices(best.yaku[hovered].evidence, handTiles)

  return (
    <div className="results results__scored">
      <div className="results__toolbar">
        <button type="button" onClick={onToggleConcise}>
          {concise ? COPY.beginner : COPY.concise}
        </button>
      </div>

      <div data-section="headline">
        <ScoreHeadline candidate={best} />
      </div>

      {highlight.length > 0 && (
        <div className="results__evidence">
          <TileRow
            tiles={handTiles}
            highlight={highlight}
            size="sm"
            labelFor={tileName}
          />
        </div>
      )}

      <section className="results__section" data-section="yaku">
        <h3 className="results__heading">{COPY.yaku}</h3>
        <YakuList yaku={best.yaku} concise={concise} onHover={setHovered} />
      </section>

      <section className="results__section" data-section="fu">
        <h3 className="results__heading">{COPY.fu}</h3>
        <FuBreakdown fu={best.fu} concise={concise} />
      </section>

      <section className="results__section" data-section="dora">
        <h3 className="results__heading">{COPY.dora}</h3>
        <DoraList dora={result.dora} />
      </section>

      <section className="results__section" data-section="payments">
        <h3 className="results__heading">{COPY.payments}</h3>
        <PaymentSteps score={best.score} />
      </section>

      <div data-section="alternatives">
        <OtherInterpretations best={best} alternatives={result.alternatives} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Extend the stylesheet**

Append to `src/ui/results/results.css`:

```css
.results { display: flex; flex-direction: column; gap: 18px; }
.results__toolbar { display: flex; justify-content: flex-end; }
.results__toolbar button { padding: 4px 10px; font-size: 12px; cursor: pointer; }
.results__evidence { padding: 6px 0; }
```

- [ ] **Step 8: Run the tests**

Run: `npx vitest run src/ui/results`
Expected: all pass, including the 5 ResultsPanel tests.

If the `noYaku` fixture does not actually produce `no-yaku`, the third test fails loudly — that is intended. Find a hand that does, verify it by hand against the yaku list, and report which one you used. Do **not** weaken the assertion to whatever the engine happens to return.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): assemble the results panel with evidence highlighting"
```

---

## Task 19: App shell, text entry and responsive layout

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/App.css`
- Create: `src/ui/calculator/TextEntry.tsx`
- Create: `src/ui/calculator/TextEntry.test.tsx`
- Create: `src/ui/App.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: everything built so far.
- Produces: `<App />` — the whole calculator, and `<TextEntry onLoad={(tiles: Tile[]) => void} />`.

**Layout (spec §7.1):**
- **Desktop** (≥ 900px): two columns. Left is the hand workspace above the palette and controls; right is the results panel, `position: sticky`.
- **Mobile**: single column, results as a sticky bottom sheet collapsed to one summary line, expandable.
- The mobile collapse is CSS plus a small `open` state — no media-query JavaScript, no resize listeners.

- [ ] **Step 1: Write the failing TextEntry test**

Create `src/ui/calculator/TextEntry.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TextEntry } from './TextEntry'
import { tilesToNotation } from '../../engine/tiles'

describe('TextEntry', () => {
  it('loads a pasted hand', async () => {
    const onLoad = vi.fn()
    render(<TextEntry onLoad={onLoad} />)
    await userEvent.type(screen.getByRole('textbox'), '234m456p789s55z')
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(tilesToNotation(onLoad.mock.calls[0][0])).toBe('234m456p789s55z')
  })

  it('reports an error on nonsense instead of throwing', async () => {
    const onLoad = vi.fn()
    render(<TextEntry onLoad={onLoad} />)
    await userEvent.type(screen.getByRole('textbox'), 'hello')
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(onLoad).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('clears the error once the input is valid', async () => {
    render(<TextEntry onLoad={vi.fn()} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'hello')
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, '123m')
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('accepts red fives written as zero', async () => {
    const onLoad = vi.fn()
    render(<TextEntry onLoad={onLoad} />)
    await userEvent.type(screen.getByRole('textbox'), '0m')
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(onLoad.mock.calls[0][0][0]).toMatchObject({ suit: 'm', rank: 5, red: true })
  })
})
```

- [ ] **Step 2: Write TextEntry**

Create `src/ui/calculator/TextEntry.tsx`:

```tsx
import { useState } from 'react'
import type { Tile } from '../../engine/types'
import { parseHandNotation } from '../state/hashCodec'
import './calculator.css'

const COPY = {
  label: 'Or type the hand',
  placeholder: '234m456p789s55z',
  load: 'Load',
  error: 'That is not valid tile notation. Use 1-9 with m, p or s, 1-7 with z, and 0 for a red five.',
  hint: 'Faster than clicking fourteen tiles if you already know the notation.',
} as const

export interface TextEntryProps {
  onLoad: (tiles: Tile[]) => void
}

export function TextEntry({ onLoad }: TextEntryProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState(false)

  const submit = () => {
    const parsed = parseHandNotation(text)
    if (!parsed) {
      setError(true)
      return
    }
    setError(false)
    onLoad(parsed.concealed)
  }

  return (
    <div className="text-entry">
      <label className="text-entry__label" htmlFor="hand-notation">{COPY.label}</label>
      <div className="text-entry__row">
        <input
          id="hand-notation"
          type="text"
          value={text}
          placeholder={COPY.placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        />
        <button type="button" onClick={submit}>{COPY.load}</button>
      </div>
      {error && <p className="text-entry__error" role="alert">{COPY.error}</p>}
      <p className="text-entry__hint">{COPY.hint}</p>
    </div>
  )
}
```

- [ ] **Step 3: Write the failing App test**

Create `src/ui/App.test.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the calculator', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: /Riichi/i, level: 1 })).toBeInTheDocument()
  })

  it('shows no result before a hand is entered', () => {
    const { container } = render(<App />)
    expect(container.querySelector('.results__scored')).toBeNull()
  })

  it('scores a fourteen-tile hand typed as notation', async () => {
    const { container } = render(<App />)
    // Fourteen tiles, winning tile last: 234m 456p 22s 678s and a White triplet.
    await userEvent.type(
      screen.getByRole('textbox', { name: /type the hand/i }),
      '234m456p22s678s555z',
    )
    await userEvent.click(screen.getByRole('button', { name: /load/i }))
    expect(container.querySelector('.results__scored')).not.toBeNull()
  })

  it('designates a winning tile from the workspace', async () => {
    render(<App />)
    await userEvent.type(screen.getByRole('textbox', { name: /type the hand/i }), '123m')
    await userEvent.click(screen.getByRole('button', { name: /load/i }))

    const workspace = screen.getByRole('group', { name: 'Your hand' })
    const before = within(workspace).getAllByRole('button', { name: /Set as winning tile/ })
    expect(before).toHaveLength(3)
    await userEvent.click(before[0])

    // The tile moved out of the hand rather than being copied into both places.
    const after = within(workspace).getAllByRole('button', { name: /Set as winning tile/ })
    expect(after).toHaveLength(2)
  })

  it('builds a hand by clicking palette tiles', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: /^One of characters/ }))
    const workspace = screen.getByRole('group', { name: 'Your hand' })
    expect(within(workspace).getAllByRole('button').length).toBeGreaterThan(0)
  })

  it('exposes the ruleset settings', () => {
    render(<App />)
    expect(screen.getByText(/WRC 2025/)).toBeInTheDocument()
  })

  it('credits the tile artwork', () => {
    render(<App />)
    expect(screen.getByText(/public domain/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Write the App shell**

Replace `src/ui/App.tsx`:

```tsx
import { useState } from 'react'
import type { Tile } from '../engine/types'
import { useCalculator } from './state/useCalculator'
import { tileUsage, concealedCapacity } from './state/selectors'
import { ContextControls } from './calculator/ContextControls'
import { HandWorkspace } from './calculator/HandWorkspace'
import { MeldEditor } from './calculator/MeldEditor'
import { TextEntry } from './calculator/TextEntry'
import { TilePalette } from './calculator/TilePalette'
import { ResultsPanel } from './results/ResultsPanel'
import { RulesetPanel } from './settings/RulesetPanel'
import { Sprite } from './tiles/Sprite'
import './App.css'

const COPY = {
  title: 'Riichi Calculator',
  tagline: 'Score a hand, and see exactly where every point came from.',
  settings: 'Settings',
  results: 'Result',
  credit:
    'Tile artwork by FluffyStuff, released into the public domain under CC0.',
} as const

export default function App() {
  const { state, dispatch, result } = useCalculator()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const usage = tileUsage(state)
  const handFull = state.concealed.length >= concealedCapacity(state)

  const loadTiles = (tiles: Tile[]) => {
    dispatch({ type: 'CLEAR' })
    // By convention the winning tile is written last. A full fourteen-tile
    // paste is split into thirteen concealed tiles plus the one that completed
    // the hand; anything shorter goes into the hand and awaits a designation.
    const complete = tiles.length === 14
    for (const tile of complete ? tiles.slice(0, 13) : tiles) {
      dispatch({ type: 'ADD_TILE', tile })
    }
    if (complete) dispatch({ type: 'SET_WINNING_TILE', tile: tiles[13] })
  }

  const summary = result?.best
    ? `${result.best.score.total.toLocaleString('en-US')} — ${result.best.han} han ${result.best.fu.total} fu`
    : ''

  return (
    <div className="app">
      <Sprite />

      <header className="app__header">
        <h1>{COPY.title}</h1>
        <p className="app__tagline">{COPY.tagline}</p>
        <button type="button" onClick={() => setSettingsOpen(!settingsOpen)}>
          {COPY.settings}
        </button>
      </header>

      {settingsOpen && (
        <RulesetPanel
          rules={state.rules}
          onChange={(patch) => dispatch({ type: 'SET_RULES', patch })}
        />
      )}

      <main className="app__main">
        <div className="app__build">
          <HandWorkspace state={state} dispatch={dispatch} />
          <TilePalette
            usage={usage}
            disabled={handFull}
            onSelect={(tile) => dispatch({ type: 'ADD_TILE', tile })}
          />
          <MeldEditor usage={usage} onAdd={(meld) => dispatch({ type: 'ADD_MELD', meld })} />
          <TextEntry onLoad={loadTiles} />
          <ContextControls state={state} dispatch={dispatch} />
        </div>

        <aside className="app__results" aria-label={COPY.results}>
          <div className="app__results-summary">{summary}</div>
          <ResultsPanel
            result={result}
            concise={state.concise}
            onToggleConcise={() => dispatch({ type: 'TOGGLE_CONCISE' })}
            handTiles={state.concealed}
          />
        </aside>
      </main>

      <footer className="app__footer">
        <p>{COPY.credit}</p>
      </footer>
    </div>
  )
}
```

- [ ] **Step 5: Write the layout stylesheet**

Replace `src/ui/App.css`:

```css
:root { color-scheme: light dark; }

.app {
  max-width: 1180px;
  margin: 0 auto;
  padding: 20px 16px 120px;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.app__header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; margin-bottom: 20px; }
.app__header h1 { margin: 0; font-size: 24px; }
.app__tagline { margin: 0; flex: 1 1 320px; font-size: 14px; opacity: 0.7; }

.app__main { display: flex; flex-direction: column; gap: 24px; }
.app__build { display: flex; flex-direction: column; gap: 20px; min-width: 0; }

.app__footer { margin-top: 40px; font-size: 12px; opacity: 0.55; }
.app__footer p { margin: 0; }

/* Mobile: results become a sticky bottom sheet showing one summary line. */
.app__results {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  max-height: 62vh;
  overflow-y: auto;
  padding: 12px 16px 16px;
  background: Canvas;
  border-top: 1px solid rgba(128, 128, 128, 0.35);
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.12);
}
.app__results-summary { font-weight: 700; font-size: 15px; margin-bottom: 8px; }
.app__results-summary:empty { display: none; }

@media (min-width: 900px) {
  .app__main {
    flex-direction: row;
    align-items: flex-start;
    gap: 32px;
  }
  .app__build { flex: 1 1 auto; }

  .app__results {
    position: sticky;
    top: 20px;
    flex: 0 0 380px;
    max-height: calc(100vh - 40px);
    border-top: none;
    border-left: 1px solid rgba(128, 128, 128, 0.28);
    box-shadow: none;
    padding: 0 0 0 24px;
  }
  .app__results-summary { display: none; }
}
```

- [ ] **Step 6: Check main.tsx mounts the app**

`src/main.tsx` should already render `<App />`. Confirm it imports from `./ui/App`; if the scaffold left it pointing elsewhere, fix the import. Do not add a router — routing arrives in Plan 3.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/ui`
Expected: all pass, including 4 TextEntry and 7 App tests.

- [ ] **Step 8: Look at it**

Run: `npm run dev`

Open the URL and check by hand:
- Clicking palette tiles builds the hand and the counts increment.
- The winning-tile star appears on hover and is reachable by Tab.
- A complete hand produces a score on the right.
- Narrowing the window below 900px moves the results to the bottom sheet.

Stop the server. Note anything visually broken in your report — do not fix layout issues by weakening a test.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint && npm test
git add -A
git commit -m "feat(ui): assemble the app shell, text entry and responsive layout"
```

---

## Task 20: Playwright smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json` (devDependency, script)
- Modify: `vitest.config.ts` (exclude `e2e/`)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the running app.
- Produces: `npm run test:e2e`.

**One test only, per spec §9.** The engine has 391 tests and the components have their own; this exists to catch the integration failures unit tests cannot see — a broken sprite path, a bundler misconfiguration, a crash on load.

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test@^1.56
npx playwright install chromium
```

- [ ] **Step 2: Write the config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

It runs against the **production build**, not the dev server. That is deliberate: this test's job is to catch problems the dev server hides, such as an asset that fails to bundle.

- [ ] **Step 3: Keep Vitest out of e2e**

In `vitest.config.ts`, the `include` already restricts to `src/**`, so Playwright specs are excluded. Confirm by running `npm test` after creating the spec — if a Playwright test is picked up, add `exclude: ['e2e/**']` to the Vitest config.

- [ ] **Step 4: Write the smoke test**

Create `e2e/smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

/** Fourteen tiles, winning tile last: 234m 456p 22s 678s and a White triplet. */
const HAND = '234m456p22s678s555z'

test('scores a hand end to end', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Riichi Calculator/i })).toBeVisible()

  // The sprite must actually be in the DOM, or every tile renders empty.
  await expect(page.locator('symbol#tile-1m')).toHaveCount(1)

  await page.getByRole('textbox', { name: /type the hand/i }).fill(HAND)
  await page.getByRole('button', { name: /load/i }).click()

  // A real score, not merely an explained status.
  await expect(page.locator('.results__scored')).toBeVisible()

  // The hand must survive a reload, which proves the hash round-trips.
  const url = page.url()
  expect(url).toContain('#')
  await page.reload()
  await expect(page.locator('.results__scored')).toBeVisible()

  expect(errors, `page errors: ${errors.join('; ')}`).toEqual([])
})
```

- [ ] **Step 5: Add the script and ignore artefacts**

In `package.json` `scripts`:

```json
"test:e2e": "playwright test"
```

Append to `.gitignore`:

```
test-results/
playwright-report/
```

- [ ] **Step 6: Run it**

Run: `npm run test:e2e`
Expected: 1 passed.

If it fails on the sprite assertion, the `?raw` import is not reaching the production bundle — that is exactly the class of bug this test exists to catch. Report it rather than deleting the assertion.

- [ ] **Step 7: Commit**

```bash
npm run lint && npm test
git add -A
git commit -m "test: add a Playwright smoke test over the production build"
```

---

## Task 21: Cloudflare Pages deployment

**Files:**
- Create: `public/_redirects`
- Create: `docs/deployment.md`
- Modify: `README.md`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: a working production build.
- Produces: a repository that Cloudflare Pages can build without further configuration, and written steps for the dashboard connection the user must perform.

**The dashboard connection cannot be automated from here** — it needs the user's Cloudflare account. This task prepares everything else and writes down exactly what the user clicks.

- [ ] **Step 1: Add the SPA fallback**

Create `public/_redirects`:

```
/*    /index.html   200
```

Vite copies `public/` verbatim into `dist/`, so this reaches Cloudflare unchanged. It is added now, ahead of need: Plan 3's `/learn/*` routes would otherwise 404 on direct load and on refresh, and discovering that during Plan 3 means revisiting deployment.

- [ ] **Step 2: Verify the build output**

Run:

```bash
npm run build
ls dist
```

Expected: `dist/index.html`, `dist/assets/`, and `dist/_redirects`.

Confirm the redirects file made it:

```bash
cat dist/_redirects
```

Expected: the rule above. If it is missing, `public/` is misconfigured — fix that rather than copying the file manually in a build step.

- [ ] **Step 3: Check the bundle size**

Run: `npm run build` and read the reported sizes.

Record the JS and CSS gzip sizes in your report. There is no hard budget, but a JS bundle over 300KB gzipped for a static calculator would indicate something is wrong — most likely the tile sprite being bundled into JS rather than served as an asset. Flag it if you see it.

- [ ] **Step 4: Write the deployment guide**

Create `docs/deployment.md`:

```markdown
# Deployment

The site is a static build hosted on Cloudflare Pages. Hosting is $0/month; the
only recurring cost is the domain, if one is registered.

## One-time setup (requires the Cloudflare dashboard)

1. Sign in at <https://dash.cloudflare.com>.
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorise GitHub and pick `standw7/riichi-calculator`.
4. Configure the build:

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None (or Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | `24` — set an environment variable `NODE_VERSION` = `24` |

5. **Save and Deploy.**

The first build takes a few minutes. The site then lives at
`https://<project-name>.pages.dev`.

## After setup

- Every push to `main` triggers a production deploy.
- Every pull request gets its own preview URL.
- No GitHub Actions workflow is required, and none is configured.

## Attaching a domain

Once a domain is registered (Cloudflare Registrar, or transferred in):

1. Open the Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter the domain. If it is on Cloudflare DNS, records are created automatically.
3. TLS is provisioned automatically; no certificate handling is needed.

No rebuild is required — the existing deployment is served at the new domain.

## SPA routing

`public/_redirects` contains:

```
/*    /index.html   200
```

This makes every path serve `index.html` with a 200, so client-side routes
resolve on direct load and on refresh. It is required for the `/learn/*` routes
added in Plan 3.

## Local verification of a production build

```bash
npm run build
npm run preview
```

This is what the Playwright smoke test runs against.
```

- [ ] **Step 5: Write the README**

Replace `README.md`:

```markdown
# Riichi Calculator

A riichi mahjong hand calculator that scores a hand correctly **and** shows you
where every point came from.

## Quick start

```bash
npm install
npm run dev
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:e2e` | Playwright smoke test against the production build |
| `npm run lint` | ESLint |
| `npm run fuzz:differential` | Cross-check the engine against a third-party scorer |
| `npm run vendor:tiles` | Re-generate the tile sprite from the upstream CC0 set |

## Documentation

- `CLAUDE.md` — project overview and setup
- `CODEBASE_GUIDE.md` — how to navigate the code
- `docs/deployment.md` — Cloudflare Pages setup
- `docs/superpowers/specs/` — design specs
- `docs/superpowers/plans/` — implementation plans

## Licence

Tile artwork is CC0 — see `LICENSES.md`.
```

- [ ] **Step 6: Commit**

```bash
npm run lint && npm test && npm run build
git add -A
git commit -m "chore: add the SPA fallback, deployment guide and README"
```

- [ ] **Step 7: Report the handoff**

Your task report must end with the exact steps from `docs/deployment.md` §"One-time setup", so the user can act on them without opening the file. State plainly that the dashboard connection is theirs to perform and that everything else is ready.

---

## Task 22: Project documentation

**Files:**
- Create: `CLAUDE.md`
- Create: `CODEBASE_GUIDE.md`

**Interfaces:**
- Consumes: the finished repository.
- Produces: the two documents the user's global conventions require of every repository.

**These are required by the user's global `CLAUDE.md`** and the repository currently has neither. `CLAUDE.md` covers identity and setup; `CODEBASE_GUIDE.md` covers navigation. Keep the guide concise — it exists to save tokens, not spend them.

- [ ] **Step 1: Write CLAUDE.md**

Create `CLAUDE.md`:

```markdown
# Riichi Calculator

A web-based riichi mahjong hand calculator. It scores a hand under the WRC 2025
ruleset and explains every yaku, every fu line, and the payment arithmetic in
plain language. Static site, no backend, no accounts, no analytics.

## Setup

```bash
git clone https://github.com/standw7/riichi-calculator.git
cd riichi-calculator
npm install
npm run dev
```

Requires Node >= 24 and npm >= 11.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b` then `vite build` → `dist/` |
| `npm run preview` | Serve the production build |
| `npm test` | Vitest — engine, content and component tests |
| `npm run test:e2e` | Playwright smoke test against the production build |
| `npm run lint` | ESLint |
| `npm run fuzz:differential` | Compare the engine against `riichi-score` over random hands |
| `npm run vendor:tiles` | Re-generate `src/assets/tiles.sprite.svg` from upstream |

## Architecture

Three layers, with the dependency direction enforced by ESLint:

- **`src/engine/`** — pure scoring. No React, no DOM, no display strings. Takes a
  `Hand`, a `WinContext` and a `RuleSet`; returns a `CalculationResult`. Frozen
  and heavily tested; do not modify without a very good reason.
- **`src/content/`** — every user-visible string, keyed by the engine's stable ids.
  Must not import from the engine.
- **`src/ui/`** — React. May import from both.

State is one `useReducer` over a draft hand. `toEngineInput` is the only seam
between the draft and the engine. Scoring runs synchronously on every action.

## Rules

- The engine is the source of truth for scoring. If the UI and the engine
  disagree, the engine is right.
- Never put a display string in `src/engine/` or `src/ui/`. It belongs in
  `src/content/`.
- Never change a test expectation to make a test pass. Fix the code, or report
  that the expectation is wrong and why.
- Every yaku needs copy — `src/ui/contentCoverage.test.ts` enforces it.

## Deployment

Cloudflare Pages, building `main` on push. See `docs/deployment.md`.

## Design documents

- `docs/superpowers/specs/2026-08-24-riichi-calculator-design.md` — the base design
- `docs/superpowers/specs/2026-08-26-calculator-ui-design.md` — the UI design
- `PLD.md` — the original product requirements
```

- [ ] **Step 2: Write CODEBASE_GUIDE.md**

Create `CODEBASE_GUIDE.md`:

```markdown
# Codebase Guide

## Project Structure

```
src/engine/        scoring — pure TypeScript, no React, no display strings
  types.ts         Tile, Meld, Hand, WinContext, WinSource, RiichiState
  tiles.ts         notation parsing, tile ids, sorting
  hand.ts          isClosed, allTiles, isDealer
  validate.ts      legality of tile counts and context combinations
  decompose.ts     hand → every valid Interpretation (Group[])
  fu.ts            fu lines, wait classification, rounding
  dora.ts          dora, aka and ura counting
  score.ts         han/fu → base points → payments, with arithmetic steps
  select.ts        picks the highest-paying interpretation
  calculate.ts     the seven-stage pipeline; the engine's entry point
  yaku/            45 yaku rules, split by han value, plus the registry
  rulesets/        RuleSet type and the WRC_2025 preset
  fuzz/            seeded generators and property tests

src/content/       every user-visible string, keyed by engine ids
  yaku/            45 yaku: name, short form, beginner explanation
  fu.ts            fu-line copy as a render function over (id, fu, tile)
  wait.ts          the five wait shapes
  score.ts         arithmetic step labels, payment and limit copy
  status.ts        engine status, validation issues, hand-entry copy
  tiles.ts         accessible tile names
  controls.ts      form labels for context and ruleset controls

src/ui/            React
  state/           reducer, selectors, toEngineInput, hashCodec, useCalculator
  tiles/           Tile, TileRow, Sprite
  calculator/      palette, workspace, meld editor, context controls, text entry
  results/         headline, yaku list, fu, dora, payments, status, alternatives
  settings/        the ruleset panel

src/assets/        generated tile sprite and symbol map — do not hand-edit
scripts/           vendor-tiles.ts, differential.ts
e2e/               one Playwright smoke test
```

## Key Files

| File | Responsibility |
|---|---|
| `src/engine/calculate.ts` | The engine's entry point. Read this first. |
| `src/engine/yaku/registry.ts` | The list of all 45 yaku rules. |
| `src/engine/rulesets/wrc2025.ts` | The authoritative default ruleset. |
| `src/ui/state/useCalculator.ts` | Ties reducer, engine, URL hash and preferences. |
| `src/ui/state/toEngineInput.ts` | The only seam between a draft hand and the engine. |
| `src/ui/App.tsx` | Layout and wiring. |
| `src/ui/contentCoverage.test.ts` | Fails if any yaku lacks copy, or copy lacks a yaku. |

## Architecture & Data Flow

```
palette / text entry
        ↓ Action
    reducer  ──→  CalculatorState (draft; winningTile may be null)
        ↓
  toEngineInput  ──→  { ok: false }  → neutral resting state
        ↓ { ok: true, hand, ctx }
    calculate()
        ↓
  validate → decompose → detectYaku → computeFu → countDora → score → selectBest
        ↓
  CalculationResult { status, validation, dora, best, alternatives }
        ↓
   ResultsPanel  ──→  copy joined from src/content by id
```

Scoring is synchronous on every action — there is no debouncing, no worker, and
no loading state anywhere in the app.

## If You Need to Change X, Look at Y

- A yaku scores wrong → `src/engine/yaku/{oneHan,twoHan,threeHan,yakuman}.ts`
- Fu is wrong → `src/engine/fu.ts`
- Payments are wrong → `src/engine/score.ts`
- The wrong interpretation wins → `src/engine/select.ts`
- A rule flag → `src/engine/rulesets/wrc2025.ts` and `src/engine/rulesets/types.ts`
- Any user-visible wording → `src/content/` (never a component)
- A yaku's explanation → `src/content/yaku/<hanTier>.ts`
- Tile entry behaviour → `src/ui/calculator/` and `src/ui/state/reducer.ts`
- What counts as a complete hand → `src/ui/state/toEngineInput.ts`
- Share URLs / pasted notation → `src/ui/state/hashCodec.ts`
- Results layout or section order → `src/ui/results/ResultsPanel.tsx`
- Which tiles highlight for a yaku → `src/ui/results/evidence.ts`
- Tile artwork → `scripts/vendor-tiles.ts`, then `npm run vendor:tiles`
- Layer boundaries → `eslint.config.js`
- Deployment → `public/_redirects` and `docs/deployment.md`

## Dependencies & External Services

- **React 19**, **Vite 8**, **TypeScript 6** — app and build.
- **Vitest 4** + React Testing Library — unit and component tests. Engine tests run
  in `node`; component tests opt into jsdom with a `// @vitest-environment jsdom`
  docblock on line 1.
- **Playwright** — one smoke test against the production build.
- **svgo** — used only by the tile vendoring script.
- **riichi-score** (MIT, dev-only) — the differential harness's oracle. Never shipped.
- **Cloudflare Pages** — hosting. No other external service; no API, no database,
  no analytics.

## Patterns & Conventions

- **Ids are the join key.** The engine emits stable ids (`tanyao`, `ankou`,
  `base-points`); `src/content/` maps them to English. Never render an id directly.
- **Fu copy is a function, not a table.** The engine emits `{ id: 'ankou', fu: 8,
  tile }`, so wording is derived from the value and the tile.
- **Evidence drives highlighting.** Yaku rules return the tiles and groups that
  matched; `evidenceTileIndices` maps them to positions in the rendered row.
- **Coverage gates over registries.** Both the engine's yaku coverage test and the
  content coverage test iterate live `YAKU_RULES` rather than a hardcoded list, so
  adding a yaku forces both a test and copy.
- **Tests must bite.** Where a guard matters, there is a test that fails when the
  guard is removed. If you add a guard, add that test.
```

- [ ] **Step 3: Verify the guide is accurate**

Walk the "If You Need to Change X" table and confirm each path exists:

```bash
for path in src/engine/fu.ts src/engine/score.ts src/engine/select.ts \
  src/engine/rulesets/wrc2025.ts src/ui/state/toEngineInput.ts \
  src/ui/state/hashCodec.ts src/ui/results/ResultsPanel.tsx \
  src/ui/results/evidence.ts scripts/vendor-tiles.ts eslint.config.js \
  public/_redirects docs/deployment.md; do
  [ -e "$path" ] || echo "MISSING: $path"
done
```

Expected: no output. An inaccurate guide is worse than none — fix any path that is wrong.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add CLAUDE.md and CODEBASE_GUIDE.md"
```

---

## Final verification

After Task 22, run the full suite once more and confirm everything is clean:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

All four must pass. Report the final test count.
