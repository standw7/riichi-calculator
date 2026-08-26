# Calculator UI — Design Spec (Plan 2)

**Date:** 2026-08-26
**Extends:** `2026-08-24-riichi-calculator-design.md` (§4, §6, §7, §10)
**Status:** Approved for implementation planning

---

## 1. Scope

The scoring engine is complete and merged: 391 tests, 45 yaku, the WRC 2025 ruleset, and a
`calculate()` entry point that turns a `Hand` plus a `WinContext` into a `CalculationResult`.
Nothing yet lets a person enter a hand.

Plan 2 builds the calculator: tile rendering, hand entry, the results panel, the explanation
copy that makes the results teach rather than merely report, share URLs, the settings panel,
and deployment to Cloudflare Pages.

Out of scope, deferred to Plan 3: the Learn pages (`/learn/*`) and the yaku reference generated
from the registry.

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tile artwork | FluffyStuff `riichi-mahjong-tiles`, CC0 | Public domain, no attribution required, authentic faces, consistent 300×400 viewBox |
| Tile delivery | Build-time optimised `<symbol>` sprite | One cached asset; highlighting becomes a CSS class rather than an overlay hack |
| Explanation copy | Full beginner prose in Plan 2 | Beginner-first is the product's stated purpose; deferring it ships a calculator that doesn't teach |
| Deployment | Cloudflare Pages at the end of Plan 2 | A live `*.pages.dev` URL without waiting on a domain purchase |
| Draft/engine boundary | A pure `toEngineInput` adapter | The engine's `Hand` demands a winning tile; a hand under construction has none |

## 3. Tile assets

### 3.1 Source

`https://github.com/FluffyStuff/riichi-mahjong-tiles`, CC0 1.0 Universal. `LICENSE.md` in that
repository reads: *"This work is in the public domain."* Attribution is therefore **not
required**, but the dedication is recorded in `LICENSES.md` at our repository root and in the
site footer as a courtesy.

The `Regular` set supplies 40 files: 34 tile faces, three red-five variants
(`Man5-Dora`, `Pin5-Dora`, `Sou5-Dora`), plus `Front`, `Back`, and `Blank`. All share a
`0 0 300 400` viewBox.

### 3.2 Vendoring

`scripts/vendor-tiles.ts` is run manually, not on every build:

1. Fetch the upstream set at a pinned commit.
2. Optimise each file with `svgo` (strip Inkscape metadata, editor namespaces, and comments).
3. Emit `src/assets/tiles.sprite.svg` — one `<svg>` containing one `<symbol id="tile-…">` per
   face.
4. Emit `src/assets/tileSymbols.ts` — the generated `Tile` → symbol id mapping.

Both outputs are **committed**. Builds never touch the network, and the diff of a re-vendor is
reviewable. The raw set is 860KB; the optimised sprite is expected under 100KB.

Symbol ids follow engine notation: `tile-1m`, `tile-9s`, `tile-5z`, `tile-0p` for a red five.

### 3.3 The `Tile` component

```tsx
<Tile tile={t} size="md" state="normal" | "highlighted" | "dimmed" onClick={…} />
```

Renders `<svg><use href="#tile-0m" /></svg>`. Visual state is a class on the wrapper, so
highlighting a set of tiles costs one class change and no re-render of the artwork. This is
what makes §4's evidence highlighting cheap.

## 4. State

### 4.1 Draft model

A single `useReducer`. No state library. The reducer owns a **draft**, which may be incomplete:

```ts
interface CalculatorState {
  concealed: Tile[]          // auto-sorted, winning tile excluded
  melds: Meld[]
  winningTile: Tile | null   // null until designated
  winSource: WinSource
  ctx: WinContextDraft       // winds, riichi state, situational flags, indicators, honba, sticks
  rules: RuleSet             // WRC_2025 with the five exposed flags overridable
  ui: { concise: boolean }   // persisted to localStorage
}
```

### 4.2 The engine boundary

```ts
type EngineInput =
  | { ok: true; hand: Hand; ctx: WinContext }
  | { ok: false; reason: IncompleteReason }

function toEngineInput(state: CalculatorState): EngineInput
```

A pure function in its own file with its own tests. It is the only place that decides whether a
draft is scorable, and the only source of "you still need to…" messaging. The UI therefore
never invents an engine status, and every incomplete-hand message is unit-testable without
rendering a component.

`calculate()` runs synchronously on every action. Fourteen tiles yield well under a hundred
decompositions, so there is no debouncing, no worker, and no loading state anywhere.

### 4.3 Share URLs

Per §6 of the base spec, state serialises to the URL hash in standard notation, versioned
`v=1`. The codec is a pure `encode` / `decode` pair tested by round-trip. The same parser backs
**text entry mode**, so an experienced player can paste `234m456p789s55z` instead of clicking
fourteen tiles.

Decoding is defensive: a malformed or truncated hash yields an empty draft and a dismissable
notice, never a crash.

## 5. Components

```
src/ui/
  App.tsx                 shell, header, settings trigger
  tiles/                  Tile, TileRow, sprite mount
  calculator/             HandWorkspace, TilePalette, MeldEditor, ContextControls
  results/                ScoreHeadline, YakuList, FuBreakdown, DoraList,
                          PaymentSteps, OtherInterpretations, Explanation
  settings/               RulesetPanel — the five exposed flags
  state/                  reducer, toEngineInput, hashCodec, selectors
```

Layout follows §7.1 unchanged: two columns on desktop with a sticky results panel; a single
column on mobile with results as a bottom sheet collapsed to one summary line.

Hand entry follows §7.3 unchanged: full 34-tile palette with used-counts and a four-copy
disable, click-to-remove, undo and clear, auto-sort, `Add called set` for melds, and an
explicitly designated winning tile.

## 6. Explanation content

The largest body of new work, and the reason the app teaches rather than reports.

### 6.1 Shape

Copy lives in `src/content/` and joins engine output **by id**. Content must never import from
`src/engine/**`; the existing ESLint boundary rule is extended to cover the new modules.

- `src/content/yaku/<id>.ts` — per-yaku beginner prose, 45 entries, with evidence interpolated
  (`params.wind`, `params.source`, matched tiles and groups).
- `src/content/fu.ts` — fu-line copy.
- `src/content/wait.ts` — the five wait types.

### 6.2 Fu copy is a function, not a table

The engine emits **generic** fu ids with the specifics carried alongside — `{ id: 'ankou', fu: 8,
tile: '9m' }`, not the base spec's illustrative `ankou-terminal`. Fu copy is therefore a small
render function over `(id, fu, tile)` that decides terminal-versus-simple wording from the data,
not a flat lookup keyed on a compound id.

This is a deliberate divergence from §4 of the base spec, which described the compound form.
The implemented shape is the correct one: it keeps the engine's ids stable while the wording
varies.

### 6.3 Coverage gate

Mirroring what proved effective for the engine: a test driven off live `YAKU_RULES` fails if any
registered id lacks **either** a display name **or** prose. A yaku cannot enter the calculator
without documentation, and content cannot drift from the registry.

### 6.4 Beginner and concise modes

Beginner mode expands explanations by default. A **Concise** toggle collapses them and persists
to `localStorage`. Reading the stored preference is wrapped so a browser blocking site data
renders correctly rather than throwing.

## 7. Results panel

Order, per §7.4: score headline → han/fu → yaku list → fu breakdown → dora → payment
arithmetic → explanation.

- Hovering or focusing a yaku highlights the exact tiles or groups that earned it, driven by the
  `Evidence` the rule returned.
- **Other interpretations** is a disclosure listing losing decompositions and why each scores
  less.
- Validation state is shown continuously. The `no-yaku` status — a complete hand that cannot be
  won — gets contextual suggestions. The engine never manufactures a yaku, and neither does the
  UI.

## 8. Testing

Deliberately light, per §9. The heavy verification already sits in the engine's 391 tests;
re-testing scoring through the DOM would be slower and weaker.

- **Pure units, tested directly:** `toEngineInput`, the hash codec, fu and yaku copy rendering.
- **React Testing Library over the entry flows:** build a hand and score it, meld entry,
  incomplete-hand messaging, concise-mode persistence, hash round-trip on load.
- **One Playwright smoke test:** load the app, click a known hand, assert the headline score.

The coverage gate of §6.3 is a plain unit test and runs with the rest.

## 9. Deployment

Cloudflare Pages connected to the GitHub repository, building `main` on push.

- Build command `npm run build`, output directory `dist`, Node 24.
- `public/_redirects` containing `/* /index.html 200` is added **now**, so Plan 3's Learn routes
  resolve on direct load without revisiting deployment.
- Free preview deployment per pull request.

Connecting the repository is a dashboard click-through the user performs; the plan supplies
exact steps and every file the build needs.

Hosting cost remains $0/month. A Cloudflare Registrar domain, when the user registers one,
attaches to the same project without a rebuild.

## 10. Resolved and remaining open items

**Resolved from the base spec §11:**

- Tile asset licence — CC0, verified against the upstream `LICENSE.md`.
- Third-party scorer for differential fuzzing — `riichi-score@3.0.0`, MIT, dev-only.
- WRC 2025 rule details — confirmed against the published rulebook during Plan 1.

**Remaining:**

- Domain name to be chosen and registered by the user.
- Cloudflare Pages repository connection requires the user's dashboard access.
