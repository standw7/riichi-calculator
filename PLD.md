Riichi Mahjong Scoring & Learning App

1. Product summary

1.1 Working concept

Build a modern, web-based riichi mahjong hand calculator and scoring tutor.

The application allows a user to construct a mahjong hand visually by clicking tiles, specify relevant circumstances surrounding the hand, and receive:

* Whether the hand is complete and legally winnable.
* The yaku present in the hand.
* The han contributed by each yaku.
* Dora, red dora, and ura-dora.
* A complete fu calculation.
* Total han and fu.
* Limit-hand classification, where applicable.
* Final ron or tsumo payments.
* Dealer/non-dealer payment differences.
* Honba and riichi-stick adjustments where relevant.
* A plain-language explanation of why every component scored.
* Educational explanations of concepts such as yaku, han, fu, waits, dora, mangan, and yakuman.

The visual interaction should take inspiration from the archived riichi.tools calculator: the user sees a complete tile palette and clicks tiles to construct a hand rather than having to understand mahjong notation.

The product should, however, be substantially more explanatory and beginner-friendly than a conventional scoring calculator.

1.2 Core product proposition

Build a riichi hand visually. Get the correct score. Understand exactly where every point came from.

The application has two equally important jobs:

1. Calculate correctly.
2. Teach the calculation.

A user who repeatedly uses the application should gradually become less dependent on it.

⸻

2. Problem statement

Riichi mahjong scoring has a steep learning curve.

A beginner must simultaneously understand:

* hand structure;
* open versus closed hands;
* yaku;
* conditional yaku;
* han;
* fu;
* dora;
* waits;
* dealer status;
* seat and round winds;
* ron versus tsumo;
* limit hands;
* yakuman;
* honba;
* riichi sticks; and
* several rules that vary among rulesets.

A conventional calculator solves only part of this problem. It can tell the player the answer without teaching them how the answer was produced.

The application should instead expose the scoring process.

For example, rather than:

3 han, 40 fu
5,200 points

the application should produce something conceptually similar to:

5,200 points — 3 han, 40 fu

Yaku:

* Riichi: 1 han
* Tanyao: 1 han
* Pinfu: 1 han

Fu:

* Base: 20 fu
* Closed ron: +10 fu
* Total: 30 fu

Base points:
30 × 2^(3 + 2) = 960

You are not the dealer and won by ron, so the discarding player pays:

960 × 4 = 3,840 → rounded up to 3,900.

[The exact example displayed by the product must of course always be generated from the actual hand rather than hard-coded.]

The interface therefore makes the otherwise opaque scoring system inspectable.

⸻

3. Product goals

3.1 Primary goals

G1 — Accurate scoring

Given sufficient information about a winning hand, the application must calculate the correct score under its selected ruleset.

Accuracy takes precedence over convenience.

G2 — Beginner accessibility

Someone who has recently learned riichi mahjong should be able to enter a hand without knowing:

* tile notation;
* yaku names;
* fu values;
* scoring tables; or
* the scoring formula.

G3 — Explainability

Every result must be decomposable into its constituent scoring decisions.

The application should never present an unexplained number where a useful explanation can reasonably be provided.

G4 — Fast hand entry

An experienced user should be able to enter and calculate a hand in approximately 10–20 seconds.

G5 — Shareability

The application should be usable by anyone receiving its URL without:

* creating an account;
* downloading software;
* installing a browser extension; or
* configuring anything.

G6 — Mobile usability

The calculator must work well on a phone because a major use case is calculating a hand while sitting at a physical mahjong table.

⸻

4. Non-goals for v1

The initial release is not intended to be:

* a complete playable four-player mahjong client;
* an AI mahjong opponent;
* an online matchmaking service;
* a tournament-management system;
* a general Chinese mahjong calculator;
* a Mahjong Soul clone;
* a Tenhou client;
* a complete riichi strategy trainer;
* a full game-state simulator.

The architecture should not unnecessarily preclude later educational features, but these capabilities should not delay the scoring calculator.

⸻

5. Target users

5.1 Primary persona — beginner

A player who understands basic tile types and the objective of forming a hand but does not reliably understand scoring.

Typical question:

“I won with this hand. How many points is it worth, and why?”

Needs:

* visual hand entry;
* automatic yaku detection;
* explanations;
* clear terminology;
* forgiving error messages.

5.2 Secondary persona — intermediate player

Understands common yaku and basic scoring but cannot reliably calculate fu or less-common hands.

Typical question:

“Is this 30 or 40 fu?”

Needs:

* fast input;
* exact decomposition;
* edge-case reliability.

5.3 Tertiary persona — experienced player

Primarily wants a fast scoring verification tool.

Needs:

* minimal clicks;
* keyboard shortcuts;
* concise results;
* advanced details available without beginner explanations getting in the way.

⸻

6. Canonical ruleset

6.1 Default

Use World Riichi Championship 2025 rules (WRC 2025) as the canonical v1 scoring rules unless an implementation constraint makes this impractical.

The UI should identify the ruleset explicitly:

Rules: WRC 2025

This is preferable to labeling the calculator simply “standard rules,” because there is no completely universal implementation of riichi scoring.

6.2 Ruleset abstraction

Scoring rules must be represented separately from the hand-scoring engine wherever practical.

Conceptually:

hand + win context + ruleset → scoring result

rather than:

hand → hard-coded WRC score

This allows future support for:

* WRC;
* EMA;
* Tenhou-style rules;
* Mahjong Soul-style rules;
* custom house rules.

6.3 Configurable rule flags

The architecture should be capable of representing variations including:

* kuitan/open tanyao;
* atozuke;
* aka dora;
* number of red fives;
* kiriage mangan;
* kazoe yakuman treatment;
* double-yakuman treatment;
* multiple-yakuman stacking;
* double-wind pair fu;
* pao/sekinin barai;
* renhou treatment;
* nagashi mangan treatment.

Not every setting requires a v1 UI.

For v1, the WRC configuration should be the authoritative preset.

⸻

7. Core user experience

7.1 Default screen

The calculator should ideally fit most of its primary interaction onto a single screen.

Desktop structure:

Header

Application name | Learn | Rules | Settings

Hand workspace

Current hand

[tiles selected by user]

Winning tile: [tile]

Open/called sets: [melds]

Tile selector

Characters / Manzu
1 2 3 4 5 6 7 8 9

Circles / Pinzu
1 2 3 4 5 6 7 8 9

Bamboo / Souzu
1 2 3 4 5 6 7 8 9

Honors
East South West North White Green Red

Win information

Ron / Tsumo

Seat wind

Round wind

Riichi state

Special circumstances

Dora indicators

Results

Score

Han / fu

Yaku

Fu

Calculation

Explanation

⸻

8. Hand-entry system

8.1 Tile palette

Display all 34 unique tile types.

Manzu

1m–9m

Pinzu

1p–9p

Souzu

1s–9s

Honors

East
South
West
North
White dragon
Green dragon
Red dragon

Tile artwork should be immediately recognizable as mahjong tiles rather than primarily textual notation.

Optional small notation labels may appear beneath tiles.

8.2 Adding tiles

Clicking/tapping a tile adds one copy to the concealed hand.

The palette should visually indicate how many copies have already been used.

Example:

* unused: normal;
* one used: subtle count indicator;
* four used: disabled.

The system must prevent more than four physical copies of a tile, accounting for:

* concealed tiles;
* called sets;
* kans;
* dora indicators where appropriate to validation;
* red-five substitutions.

8.3 Removing tiles

Clicking a tile in the constructed hand removes it.

Desktop may additionally support:

* right-click removal;
* keyboard undo.

Always provide:

Undo

and

Clear hand

8.4 Tile sorting

Default behavior should automatically sort the concealed hand:

1. manzu;
2. pinzu;
3. souzu;
4. winds;
5. dragons.

Provide an option to disable auto-sort later if useful.

8.5 Red fives

Support aka dora.

Represent red fives distinctly:

* 0m;
* 0p;
* 0s internally.

The visual palette should make the red five easy to distinguish.

A red five replaces one ordinary five in the physical tile count rather than creating a fifth copy.

⸻

9. Meld entry

The application must distinguish concealed tiles from called/open sets.

A user should be able to create:

* chi;
* pon;
* open kan;
* closed kan;
* added kan.

Recommended interaction

User selects:

Add called set

Then chooses:

* Chi
* Pon
* Kan

and selects the relevant tile(s).

Alternative:

Select tiles in the hand and choose:

Make meld

The rendered meld should visually resemble a real exposed mahjong meld.

For advanced fidelity, a sideways tile can eventually represent the called tile.

The scoring engine must retain the semantic distinction even if the visual representation is simplified.

⸻

10. Winning tile

The scoring engine must know which tile completed the hand because wait shape and concealed-triplet treatment can depend on it.

Therefore the winning tile must be explicitly represented.

Recommended interaction:

Winning tile

[select from hand or add tile]

Visually separate it slightly from the rest of the concealed hand.

The app should teach the reason:

Why do I need to specify this?
The tile you won on can change your wait type, fu, and sometimes which yaku your hand qualifies for.

⸻

11. Win context

The following inputs must be supported.

11.1 Win method

Required:

* Ron
* Tsumo

Use a prominent segmented control.

11.2 Dealer status / seat wind

Select:

* East
* South
* West
* North

East automatically means the player is dealer.

The UI may show:

Seat: East — Dealer

11.3 Round wind

Select:

* East
* South

Advanced support should permit West/North for unusual game states.

11.4 Riichi

Options:

* None
* Riichi
* Double riichi

Do not allow incompatible states simultaneously.

11.5 Ippatsu

Checkbox/toggle:

Ippatsu

Only available when riichi/double riichi is selected.

Tooltip:

You won within the uninterrupted ippatsu window after declaring riichi.

11.6 Special win conditions

Support:

* Haitei raoyue — win by drawing the final tile.
* Houtei raoyui — win on the final discard.
* Rinshan kaihou — win on a replacement tile after a kan.
* Chankan — robbing a kan.
* Tenhou.
* Chiihou.

The UI should prevent obviously impossible combinations.

Example:

Haitei should require tsumo.

Houtei should require ron.

Rinshan should require tsumo.

Chankan should require ron.

Tenhou should require dealer + tsumo + appropriate opening-hand state.

Chiihou should require non-dealer + tsumo + appropriate opening-hand state.

⸻

12. Dora entry

12.1 Dora indicators

The user enters the indicator, not the resulting dora.

Label clearly:

Dora indicators

Tooltip:

Select the tiles showing in the dead wall. The calculator will determine which tiles are dora.

Automatically map:

1 → 2 → … → 9 → 1

for numbered suits.

Wind cycle:

East → South → West → North → East

Dragon cycle:

White → Green → Red → White

12.2 Ura-dora

If riichi is active, allow:

Ura-dora indicators

The app should explain that ura-dora only count for a riichi winner.

12.3 Aka dora

Automatically detect red fives.

Results should distinguish:

* Dora × N
* Aka dora × N
* Ura-dora × N

Important educational message:

Dora add han but are not themselves yaku. You still need a valid yaku to win.

⸻

13. Hand validation

Validation should occur continuously.

Possible states:

Incomplete hand

Add 3 more tiles.

Too many tiles

This hand contains too many tiles.

Duplicate physical impossibility

There are five copies of 7-pin in the hand. A mahjong set contains only four.

Complete shape but no yaku

This is particularly important for beginners.

Display:

Complete hand, but no yaku

The tiles form a valid mahjong hand, but riichi requires at least one yaku to win. Dora alone do not satisfy this requirement.

Then offer contextual suggestions such as:

If the hand was closed and you had declared riichi, Riichi would provide a yaku.

Do not silently manufacture a yaku.

⸻

14. Hand structures

The engine must recognize the three major winning structures.

14.1 Standard hand

Four groups + one pair.

Groups may be:

* sequence;
* triplet;
* kan.

14.2 Seven pairs

Chiitoitsu.

Seven distinct pairs.

Score using its special fu treatment.

14.3 Thirteen orphans

Kokushi musou.

Recognize the appropriate yakuman state.

⸻

15. Hand decomposition

A hand can sometimes be partitioned into valid groups in multiple ways.

The scoring engine must:

1. generate every legal interpretation;
2. evaluate the yaku and fu for each;
3. calculate the resulting score;
4. choose the highest-scoring legal interpretation.

This behavior is essential.

The first valid decomposition must not automatically be used.

For educational purposes, an advanced control may expose:

Other interpretations

and show why another decomposition scores less.

⸻

16. Yaku detection

The engine must automatically detect the complete yaku set supported by the selected ruleset.

At minimum, standard WRC-compatible yaku should include the following categories.

16.1 One-han yaku

Support as applicable:

* Riichi
* Ippatsu
* Menzen tsumo
* Pinfu
* Iipeikou
* Tanyao
* Yakuhai
* Chankan
* Rinshan kaihou
* Haitei
* Houtei

Yakuhai should identify its source.

Instead of:

Yakuhai — 1 han

prefer:

Yakuhai — White dragon — 1 han

or:

Yakuhai — Seat wind (South) — 1 han

If a triplet independently qualifies in more than one way under the ruleset, the engine must apply the appropriate scoring.

16.2 Two-han and variable-value yaku

Support:

* Double riichi
* Chiitoitsu
* Ittsu
* Sanshoku doujun
* Chanta
* Toitoi
* Sanshoku doukou
* Sanankou
* Sankantsu
* Honroutou
* Shousangen

and all other yaku included in the canonical ruleset.

Correctly apply closed/open value reductions.

16.3 Higher-value yaku

Support:

* Honitsu
* Junchan
* Ryanpeikou
* Chinitsu

and other applicable standard yaku.

16.4 Yakuman

Support the complete WRC yakuman set, including applicable combinations such as:

* Kokushi musou
* Suuankou
* Daisangen
* Shousuushii
* Daisuushii
* Tsuuiisou
* Chinroutou
* Ryuuiisou
* Chuuren poutou
* Suukantsu
* Tenhou
* Chiihou

Exact treatment of multiple and special yakuman must be determined by the selected ruleset configuration rather than assumptions embedded in UI code.

⸻

17. Yaku explanations

Every detected yaku should have an expandable explanation.

Example:

Tanyao — 1 han

Your hand contains only tiles numbered 2 through 8. There are no 1s, 9s, winds, or dragons.

Example:

Pinfu — 1 han

Your hand is closed, all four groups are sequences, your pair is not a value pair