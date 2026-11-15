# Shared Code Across the Portfolio

What `hit-your-shot` can reuse from `neural-tycoon`, what should become shared code for every future app, and how the sharing should work. **This is a proposal.** Nothing has been moved: moving code changes `neural-tycoon`, which needs the owner's permission.

Written 2026-11-15 after reading `neural-tycoon` (no changes made there).

## 1. What can be reused as-is

These modules in `neural-tycoon` are generic already: no game-specific types, or only a thin dependency that is easy to cut.

| Module in `neural-tycoon` | What it does | Reuse in this game | Change needed to share |
|---|---|---|---|
| `src/engine/num.ts` | big-number formatting (K, M, B, T, ...), NaN and Infinity safe, tested | money, prices, "about $ per round" | none |
| `src/engine/rng.ts` | seeded deterministic random (mulberry32), `runWithStateRng` so reloads repeat rolls | shot spread, commentator line choice | `runWithStateRng` is typed on `GameState`; make it generic over any state with `rngState` |
| `src/engine/save.ts` pattern | versioned save file, migrations table, Zod validation, never throws | the save system | the schema is per game; share the wrapper (`serialize`, `deserialize`, migration runner), not the schema |
| `src/services/types.ts` + fakes | interfaces for save storage, rewarded ads, purchases, analytics; fake versions for Expo Go | identical needs | none for the interfaces; the fakes move with them |
| `src/engine/offline.ts` | offline earnings with a high-water mark against clock changes, caps, rewarded double | item 11 of the open decisions | depends on the game's balance shape; share the math, pass the numbers in |
| `src/ui/toast.tsx` | toast queue with a host component | error and info toasts | depends on the theme tokens; take tokens as a parameter or a context |
| `src/ui/feedback.ts` | haptics behind the player's setting | all haptics | reads the game store; take a `isEnabled` function instead |
| `src/ui/components.tsx` motion parts: `FlyingText`, `CoinBurst`, `usePop`, `PressScale`, `CountUp` | "+$10" floats, coin bursts, pop on change, press feedback, number count-up, all with built-in limits | every hit and every purchase | depend on theme tokens; same fix as toast |
| `tools/sim/` + `tools/simulate.ts` | pacing simulator over many seeds on the real engine, writes a report | required before balancing | the harness is generic; the strategy ("what would a player buy next") is per game |
| `src/engine/__tests__/pacing.test.ts` pattern | a CI test that fails when pacing targets drift | same | targets are per game |
| `.github/workflows/ci.yml`, `tools/check-private-data.sh`, PR template | repository hygiene | already copied into this repository | none |
| `docs/dev-notes.md` pitfalls table | Windows, worktree, Jest and Expo gotchas | same machine, same tools | copy the table once code starts |

Game-specific and **not** reusable: everything under `src/features/`, `src/content/`, the economy, products, hype, managers, the map, and the "Sticker Lab" theme values (this game has its own palette; only the *token structure* is reused).

## 2. What to reuse as a pattern, not as code

- **Architecture:** UI → store → pure engine and services, engine with no clock and no randomness inside, events from the engine to the UI, modifiers as the only cross-module influence. Copy the rules from `neural-tycoon/docs/architecture.md` into this repository's architecture doc when code starts, adapted to this game.
- **Balance file:** one JSON, Zod-validated, every number in it, remote-config override later.
- **Contract files owned by the lead, module files owned by agents in worktrees.** The same multi-agent workflow.
- **Phase plan:** Expo Go first with fake services, development build when native modules are needed, then TestFlight.

## 3. How sharing should work (proposal)

The portfolio README plans a `_shared/` folder. `_shared/` is not a git repository today and each app is its own repository, so "shared" needs a mechanism. Three options were weighed.

| Option | How | For | Against |
|---|---|---|---|
| **A. Separate repository, published as npm packages** (recommended) | `_shared/` becomes its own git repository (for example `mobileapps-shared`) with small packages: `@<scope>/game-num`, `@<scope>/game-rng`, `@<scope>/game-save`, `@<scope>/game-services`, `@<scope>/game-motion`, `@<scope>/game-sim`. Published to the npm registry (public, free) or GitHub Packages. Apps install pinned versions with `npx expo install`. | Versioned: an app upgrades when it wants to. CI per package. Works with EAS Build with no special setup. No symlinks, which Metro on Windows handles badly. Future apps get it with one install line. | A publish step. A scope name on npm (the GitHub handle works; it is public anyway). |
| B. Git submodule in each app | each app has `shared/` pointing at the shared repository | no publishing | submodules confuse every tool in the chain, EAS Build needs extra steps for them, and a change in one app silently breaks another |
| C. Monorepo | one repository for all apps and the shared code, npm workspaces | easiest sharing | contradicts "one repository per app", one CI for everything, and Metro with workspaces needs configuration on each app |

**Recommendation:** A. Start it when the second consumer exists, which is this game: that is exactly the rule in `_shared/README.md` ("code goes here when a second app needs it, not before").

**Order of work when the owner agrees:**

1. Create the shared repository with the same hygiene as this one (CI, private data scan, rulesets).
2. Move `num`, `rng`, the save wrapper, the service interfaces and fakes, and the motion parts out of `neural-tycoon` into packages, with their tests. Generalize the three thin dependencies named in the table (store, theme, `GameState`).
3. Publish version 0.1.0 of each.
4. `neural-tycoon` switches its imports to the packages in one PR (needs the owner's permission; it is the only change to that repository).
5. `hit-your-shot` installs the same versions from day one.

Until step 4 is approved, `hit-your-shot` can start by copying `num.ts` and `rng.ts` with a header comment naming the source, so nothing blocks. Copies are replaced by the packages later; the public functions keep their names.

## 4. What this game will contribute back

Once built here, these belong in the shared repository for the next apps: the aim-and-shoot input (drag line with spread cone), the ballistics functions (parabola, hit test, bounce), the round timer and result flow, the rewarded "×2" placement, and the commentator line pool mechanism (situation → pool → no repeats). Each should be written with that in mind: pure functions, numbers passed in, no imports from this game's store.
