# Riichi Calculator — Design Spec

**Date:** 2026-08-24
**Source requirements:** `PLD.md` (§1–17; the source document is truncated mid-§17, so §18+ of this spec are proposals authored here)
**Status:** Approved for implementation planning

---

## 1. Summary

A web-based riichi mahjong hand calculator that scores a hand correctly **and** shows the
player exactly where every point came from. The user builds a hand by clicking tiles, states
the circumstances of the win, and receives the score decomposed into yaku, fu, dora, and the
payment arithmetic — each step accompanied by a plain-language explanation.

Two jobs of equal weight: calculate correctly, and teach the calculation.

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope (v1) | Calculator + static Learn pages | Matches PLD header nav without building a strategy trainer (a stated non-goal) |
| Engine strategy | Own engine, independent test oracle | Explainability is the product; correctness needs evidence we do not author |
| Stack | Vite + React + TypeScript, client-only | No backend needed; keeps hosting free |
| Hosting | Cloudflare Pages | Free tier, unlimited bandwidth, builds on push, free PR previews |
| Domain | Cloudflare Registrar (to be registered) | Sold at wholesale, no markup; only recurring cost |
| Tile art | Vendored open-licensed SVG set | Authentic tiles without design effort; license to be verified before vendoring |
| Ruleset | WRC 2025 preset + small settings panel | Engine fully config-driven; UI exposes only commonly-varying flags |
| Explanations | Beginner-first, collapsible to concise | Preference persisted in `localStorage` |
| Honba / riichi sticks | Included as optional inputs | Cheap to add; matters at a real table |
| Repo | Public, `standw7/riichi-calculator` | Per user's standing workflow |

**Non-goals** (from PLD §4, unchanged): playable client, AI opponent, matchmaking, tournament
management, general Chinese mahjong, Mahjong Soul/Tenhou clone, strategy trainer, game-state
simulator.

## 3. Architecture

### 3.1 Repository layout

```
src/
  engine/       pure TypeScript — no React, no DOM
    tiles.ts            tile model, parsing, notation
    validate.ts         hand + context validation
    decompose.ts        all legal interpretations
    yaku/               one module per yaku rule
    fu.ts               itemized fu computation
    dora.ts             dora / aka / ura counting
    score.ts            han+fu → payments, with arithmetic steps
    select.ts           best-interpretation selection
    rulesets/           WRC_2025 and future presets
    types.ts
  ui/           React components
  content/      explanation copy, Learn page content
  assets/tiles/ vendored SVG tile set
docs/
  superpowers/specs/
```

The engine/UI boundary is enforced by an ESLint `no-restricted-imports` rule: nothing under
`src/engine/**` may import from `src/ui/**` or from `react`. This keeps the engine
node-testable and fuzzable, and allows later extraction into its own package without code
changes. Workspaces are deliberately not used — one consumer does not justify the overhead.

### 3.2 Data model

```ts
type Suit = 'm' | 'p' | 's' | 'z'          // z: 1-4 = E,S,W,N; 5-7 = White,Green,Red

interface Tile { suit: Suit; rank: number; red: boolean }

type MeldKind = 'chi' | 'pon' | 'minkan' | 'ankan' | 'shouminkan'

interface Meld {
  kind: MeldKind
  tiles: Tile[]
  calledTile?: Tile          // which tile was claimed; drives fu and display
}

interface Hand {
  concealed: Tile[]
  melds: Meld[]
  winningTile: Tile
  winSource: 'ron' | 'tsumo'
}

interface WinContext {
  seatWind: Wind
  roundWind: Wind
  riichi: 'none' | 'riichi' | 'double'
  ippatsu: boolean
  haitei: boolean; houtei: boolean; rinshan: boolean; chankan: boolean
  tenhou: boolean; chiihou: boolean
  doraIndicators: Tile[]
  uraIndicators: Tile[]
  honba: number
  riichiSticks: number
}
```

A **red five is a flag on an ordinary five**, never a 35th tile type. The four-copy physical
limit therefore falls out of a single count over the 34 tile types, satisfying PLD §8.2 and
§8.5 without special-casing.

Internally, hands are worked on as a 34-slot count array; the `Tile[]` form is the boundary
representation.

### 3.3 Pipeline

Seven pure functions, no shared mutable state, each independently testable:

1. **`validate(hand, ctx, rules)`** → `ValidationResult`
   - tile arithmetic: `concealed.length + 3 × melds.length + 1 === 14` (a kan counts as 3 here)
   - no more than four physical copies of any tile, counting concealed tiles, melds, kans, and
     dora indicators
   - context contradictions: haitei requires tsumo; houtei requires ron; rinshan requires
     tsumo; chankan requires ron; tenhou requires dealer + tsumo; chiihou requires non-dealer +
     tsumo; ippatsu requires riichi
   - returns structured states matching PLD §13: incomplete (with tiles-needed count), too
     many tiles, physically impossible duplicates, complete-but-no-yaku

2. **`decompose(hand)`** → `Interpretation[]`
   - every legal partition into 4 groups + pair, plus chiitoitsu and kokushi structures
   - returns **all** interpretations; never short-circuits on the first valid one

3. **`detectYaku(interp, ctx, rules)`** → `YakuResult[]`
   - one self-contained rule object per yaku, registered in a single registry
   - each result carries `evidence` (see §4)

4. **`computeFu(interp, ctx, rules)`** → `FuResult`
   - itemized lines, not a total; rounding recorded as its own step

5. **`countDora(hand, ctx, rules)`** → `DoraResult`
   - dora, aka dora, and ura dora tracked separately; ura only counted when riichi is active

6. **`score(han, fu, ctx, rules)`** → `ScoreResult`
   - limit-hand classification, base points, payments split by dealer status and win method
   - honba and riichi-stick adjustments
   - emits the arithmetic as ordered steps, not just the answer

7. **`selectBest(scored[])`** → `{ best, alternatives }`
   - maximum by final payment; losing interpretations retained for PLD §15's "Other
     interpretations" panel

Every stage returns data describing **what it decided and why**. No stage returns a bare number.

## 4. Explanation model

Yaku rules never return prose. They return structured results:

```ts
interface YakuResult {
  id: string                 // 'tanyao'
  han: number
  evidence: {
    tiles?: TileRef[]        // indices into the hand
    groups?: GroupRef[]
    params?: Record<string, unknown>   // e.g. { source: 'seat-wind', wind: 'S' }
  }
}
```

Copy lives in `src/content/yaku/<id>.ts` and is rendered with the evidence interpolated. This
yields three properties:

- copy can be rewritten without touching scoring logic;
- the engine is translation-ready;
- **evidence doubles as highlighting** — hovering a yaku in the results panel highlights the
  exact tiles or groups that earned it.

Yakuhai results carry their source in `params`, so the UI renders
`Yakuhai — White dragon — 1 han` or `Yakuhai — Seat wind (South) — 1 han` rather than a bare
label (PLD §16.1).

Fu follows the same shape — `{ id: 'closed-ron', fu: 10 }`,
`{ id: 'ankou-terminal', fu: 8, tile: '9m' }` — so PLD §7's worked example renders directly
from data. `score()` emits steps such as `30 × 2^(3+2) = 960` and `960 × 4 = 3,840 → 3,900`,
each with an attached note.

## 5. Ruleset configuration

One frozen plain object per preset. Every engine function receives it as a parameter; no flag
is read from a module global.

`WRC_2025` is the v1 preset and the authoritative default. The settings panel mutates a copy.

Flags represented (per PLD §6.3), whether or not v1's UI exposes them: kuitan, atozuke, aka
dora count, kiriage mangan, kazoe yakuman treatment, double-yakuman treatment, multiple-yakuman
stacking, double-wind pair fu, pao / sekinin barai, renhou treatment, nagashi mangan treatment.

**Exposed in the v1 settings panel:** aka dora count, kuitan, kiriage mangan, kazoe treatment,
multiple yakuman. The header displays `Rules: WRC 2025`.

## 6. Share URLs and text entry

Hand state serialises to standard mahjong notation in the URL hash:

```
#v=1&h=234m456p789s55z&win=4p&w=tsumo&seat=S&round=E&riichi=1&ippatsu&dora=7p
```

Readable, debuggable, and diff-friendly in bug reports. The same parser accepts pasted
notation as a **text entry mode**, serving the experienced persona who can type a hand faster
than they can click fourteen tiles (PLD §5.3, G4). Versioned so the format can change without
breaking existing links.

Red fives use `0` in place of the rank: `0m`, `0p`, `0s` (PLD §8.5).

## 7. User interface

### 7.1 Layout

**Desktop** — two columns. Left: hand workspace (concealed tiles, winning tile, melds) above
the tile palette. Right: results panel, sticky, so the score updates in place while the hand is
built.

**Mobile** — single column. Results become a sticky bottom sheet, collapsed by default to a
single summary line (`5,200 — 3 han 40 fu`), expandable to the full breakdown. This serves the
primary mobile case: scoring a hand while standing at a physical table.

### 7.2 State

A single `useReducer` is the source of truth. No state library. The URL hash is written from
state on change and read once on load.

The engine runs synchronously on every action — fourteen tiles produce well under a hundred
decompositions, so recalculation is sub-millisecond. No debouncing, no web worker, no loading
states anywhere in the application.

### 7.3 Hand entry

- Full 34-tile palette, grouped manzu / pinzu / souzu / honors, with red-five variants
  distinctly rendered.
- Palette tiles show a used-count indicator and disable at four copies.
- Clicking a tile in the hand removes it; right-click removal on desktop.
- Persistent **Undo** and **Clear hand** controls.
- Concealed hand auto-sorts: manzu, pinzu, souzu, winds, dragons.
- Melds are entered via **Add called set** → chi / pon / kan → tile selection, and render as
  exposed melds. The called tile is stored semantically even where the visual representation is
  simplified.
- The winning tile is explicitly designated and visually separated, with an inline explanation
  of why it is required (PLD §10).

### 7.4 Results panel

Order: score headline → han/fu → yaku list → fu breakdown → dora → payment arithmetic →
explanation. Beginner mode expands explanations by default; a **Concise** toggle collapses them
and persists the preference to `localStorage`.

An **Other interpretations** disclosure shows losing decompositions and why each scores less
(PLD §15).

Validation state is displayed continuously, including the "complete hand, but no yaku" case
with contextual suggestions. The engine never manufactures a yaku (PLD §13).

## 8. Learn pages

Static routes: `/learn/yaku`, `/learn/fu`, `/learn/scoring`, `/learn/glossary`.

`/learn/yaku` is **generated from the engine's yaku registry** — the same rule objects the
calculator uses supply each entry's name, han value, open/closed reduction, and explanation
copy. A yaku therefore cannot exist in the calculator while being absent from, or inconsistent
with, the documentation.

## 9. Testing strategy

Engine built test-first.

- **Unit tests per pipeline stage.**
- **Score table fixture** — the published han/fu → points table encoded verbatim and checked
  cell-by-cell against our formula for every (han, fu, dealer, ron/tsumo) combination. This is
  public, stable knowledge rather than a dependency.
- **Worked-example corpus** — curated hands from established references with expected yaku, fu
  lines, and payments.
- **Yaku coverage test** — fails if any yaku in the active ruleset lacks both a positive and a
  negative case. This is the forcing function for the long tail.
- **Property tests** — decompositions are always valid partitions of the input hand;
  `selectBest` always returns the maximum; scoring is deterministic.
- **Differential fuzzing** — random legal hands compared against a third-party scorer held as a
  dev-only dependency, never shipped. Mismatches are adjudicated by hand, not auto-trusted.

UI testing stays deliberately light: a handful of React Testing Library tests over the entry
flows, plus one Playwright smoke test.

## 10. Deployment

Cloudflare Pages connected directly to the GitHub repository. Build on push, free preview
deployment per pull request, no GitHub Actions required. Build command `npm run build`, output
directory `dist`.

A `_redirects` SPA fallback is required so the Learn routes resolve on direct load and refresh.

Static output means **$0/month hosting**; the Cloudflare Registrar domain is the only recurring
cost.

## 11. Open items

**Resolved during Plan 1 and Plan 2 design** (see `2026-08-26-calculator-ui-design.md` §10):

- ~~Tile asset licence~~ — resolved: FluffyStuff `riichi-mahjong-tiles` is CC0 / public domain,
  verified against the upstream `LICENSE.md`. No attribution required; recorded anyway.
- ~~Third-party scorer for differential fuzzing~~ — resolved: `riichi-score@3.0.0`, MIT,
  dev-only. 4,279 hands compared with zero payout disagreements.
- ~~WRC 2025 rule details~~ — resolved: confirmed against the published rulebook. Four flags in
  the original plan were wrong and were corrected (`kiriageMangan`, `doubleWindPairFu`,
  `renhou`, `nagashiMangan`).

**Remaining:**

- **Domain name** to be chosen and registered by the user in the Cloudflare dashboard.
- **Cloudflare Pages repository connection** requires the user's dashboard access.
