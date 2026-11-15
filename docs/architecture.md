# Hit Your Shot: Architecture

How the code is split, how the parts talk, and how several agents build it in parallel. Same shape as `neural-tycoon`; differences are called out.

## Layers

```text
┌──────────────────────────────────────────────────────┐
│ UI (src/app, src/features, src/ui)                   │  React Native + Skia. Reads state, sends actions,
│                                                      │  plays back shot paths. No game math here.
├──────────────────────────────────────────────────────┤
│ Store (src/store)                                    │  Zustand. Holds GameState and the live RoundState,
│                                                      │  runs the round clock, calls engine functions,
│                                                      │  calls services, saves.
├────────────────────────────┬─────────────────────────┤
│ Engine (src/engine)        │ Services (src/services) │
│ Pure TypeScript. No React, │ Save storage, ads,      │
│ no clock, no randomness    │ purchases, audio.       │
│ inside. Fully unit-tested. │ Behind interfaces, with │
│                            │ fake versions.          │
└────────────────────────────┴─────────────────────────┘
          ▲ reads
   balance/balance.json  (every number)
```

Dependency rule: UI → Store → Engine and Services. The engine depends on nothing but `zod` and `balance.json`. Services never import the UI.

## The engine in one paragraph

A **round** is 10 seconds of a **sport**. The character has `n` **limbs** (arms, or feet in football). Each limb fires on its own schedule from its own **fire rate** (upgrade level × ball). Every **shot** is resolved at the moment it fires by `resolveShot`: the aim angle plus a **spread** roll (accuracy level × ball) gives a direction; the ball flies a parabola, bounces off the floor, walls, backboard and rim, and either passes the **target sensor** (a hit) or comes to rest. The result is a list of **trajectory segments** (each a parabola with a start time) and a hit flag. The UI only plays segments back; the economy only counts hits. The **target moves** on a deterministic path, so aiming matters every round. Between rounds, money buys **upgrades**, **balls** and **characters** (more limbs). **Trophies** (earned at milestones) unlock sports; a maxed sport gives a **mastery bonus**. A small **offline** income accrues while away.

### Rules every engine function follows

1. **Pure.** Same input, same output. No `Date.now()`, no `Math.random()`, no module state.
2. **Time is passed in.** Wall time as `now` (ms since epoch) for saves and offline; round time as `t` (seconds since the round started) for shots.
3. **Randomness is passed in** as `rng: () => number` in `[0, 1)`. The store wraps calls in `runWithStateRng`, so rolls are part of the save.
4. **Never mutate input.** Return new objects. Exception for speed: `resolveShot` may fill a caller-provided `Float64Array` scratch buffer; it never touches state.
5. **Actions return `ActionResult`:** `{ ok: true, state, events }` or `{ ok: false, state, events: [], error }`.
6. **Events tell the UI what happened** (`roundEnded`, `newBest`, `trophy`, `characterBought`, ...). The UI animates from events. The engine never knows about the UI.
7. **Numbers come from `balance`.** Nothing numeric is literal in engine code except 0, 1, 2 and geometry identities.
8. **Determinism across threads.** The shot resolver uses a fixed step (`balance.physics.stepSec`), plain `number` math and no `Math.random`, so Jest, the simulator and the phone agree bit for bit on the same inputs.

## Contract files (owned by the lead)

Module agents never edit these. If a change is needed, say so in the report.

| File | Contents |
|---|---|
| `src/engine/types.ts` | `GameState`, `SportState`, `RoundState`, `ShotInput`, `ShotResult`, `Segment`, `GameEvent`, `ActionResult`, `Rng`, ids |
| `src/engine/balance.ts` | Zod schema for `balance.json`, the `Balance` type, `defaultBalance`, `parseBalance` |
| `src/engine/state.ts` | `createInitialState`, `createSportState` |
| `src/engine/rng.ts` | `createRng`, `runWithStateRng`, `gaussianish` |
| `src/engine/num.ts` | `formatNumber`, `formatMoney` (from `neural-tycoon`, to be shared) |
| `src/engine/testing.ts` | `T0`, `makeState`, `rng`, `fixedRng`, `balance` |
| `src/engine/index.ts` | the public surface of the engine |
| `src/store/*`, `src/services/*`, `src/app/_layout.tsx`, `app.json`, `package.json`, `balance/balance.json` | lead only |

## Engine modules

Each module is one file plus its tests in `src/engine/__tests__/<module>.test.ts`. The header comment of each stub states the rules; the agent implements the stub without changing exported signatures.

| Module | File | Owner | Depends on | Does |
|---|---|---|---|---|
| ballistics | `ballistics.ts` | agent "ballistics" | contracts | `targetPose`, `resolveShot`, `positionAt`, geometry helpers. The heart of the game. |
| limbs | `limbs.ts` | agent "limbs" | contracts | `limbAnchors(n, kind)` (procedural body placement), `muzzleOffsets(n, sportDef)` (parallel shot offsets with span cap) |
| upgrades | `upgrades.ts` | agent "economy" | contracts | costs and effects of the three cards: `upgradeCost`, `spreadDeg`, `shotsPerSec`, `incomeMult`, `buyUpgrade`, `isMastered` |
| balls | `balls.ts` | agent "economy" | contracts | `ballDef`, `buyBall`, `assignLimbBall` |
| characters | `characters.ts` | agent "economy" | contracts | `characterCost`, `characterName`, `buyCharacter` |
| round | `round.ts` | agent "round" | ballistics, limbs, upgrades, balls | `createRound`, `dueShots`, `shotInputFor`, `recordShot`, `settleRound` (money, best, stats, trophy milestones, events) |
| estimate | `estimate.ts` | agent "round" | round, ballistics | `incomePerRoundEstimate(state, ballId)` for "about $X per round", deterministic Monte Carlo with a fixed seed |
| trophies | `trophies.ts` | agent "economy" | contracts | milestone ids, `trophyMilestones`, `unlockSport`, `masteryBonus` |
| offline | `offline.ts` | agent "meta" | contracts | `offlineSeconds`, `computeOfflineEarnings`, `applyOfflineEarnings`, `claimOfflineDouble` |
| save | `save.ts` | agent "meta" | contracts | `serialize`, `deserialize`, migrations, Zod schema of `GameState` |
| ads | `ads.ts` | agent "meta" | contracts | `canWatchX2`, `applyX2`, `buyRemoveAds` |

## Coordinates and units

- World units are **meters**. The field is `balance.sports[sport].field` wide and high; origin bottom-left, `x` right, `y` up. Gravity is `balance.physics.gravity` (m/s², positive number, applied downward).
- The character's **shot origin** is `field.origin` (chest height). Limb `i` fires from `origin + perp(aim) × muzzleOffsets[i]`.
- The **aim** is an angle in radians, 0 = right, positive = up. The UI converts a drag to an angle; the engine never sees pixels.
- The **target** is a `TargetPose` at round time `t`: for basketball the hoop center, with the sensor segment between the two rim points and a backboard segment; for golf the hole as a floor sensor; for football the goal mouth with a keeper block. Version 1 implements basketball; the others are data plus small `targetPose` branches.
- **Hit** = the ball center crosses the sensor segment in the sensor's direction (downward for a hoop) with the center inside the segment.

## Shot resolution (ballistics)

`resolveShot(input: ShotInput, rng: Rng, physics, sportDef): ShotResult`

1. Direction = aim + spread roll. Spread is `gaussianish(rng) × spreadDeg` (sum of three uniforms, so the cone has a soft middle and rare edges).
2. Launch speed = ball `launchSpeed`. Start point = origin + perpendicular offset.
3. March time in fixed steps of `physics.stepSec` up to `physics.maxFlightSec`. At each step: new position by the parabola; test the **sensor** (hit → end after a short drop), the **floor**, the **walls**, the **ceiling**, the **backboard** segment, the **rim** circles. On contact: reflect the velocity with the surface's restitution, apply tangential friction, and **start a new segment** at that time. Below `physics.restSpeed` on the floor: rest. Rest → end.
4. Output: `{ hit, segments, endSec, restSec, value }`. `value` is the money the hit is worth (ball value × income mult × bonuses), 0 for a miss.

`positionAt(segments, t)` returns `(x, y)` for playback; it is a worklet-safe function (no closures, plain math).

## The round, live

The **store** owns the live round. `RoundState` is transient (never saved):

```text
startRound   → createRound(state, now, rng)           phase for the target, per-limb next-fire times
every 1/30 s → dueShots(round, t)                      limbs that should fire now
             → for each: shotInputFor(state, round, i, aim) → resolveShot → recordShot
             → UI thread gets the segments (shared value) and draws
t ≥ roundSec → settleRound(state, round) → new state + events; result panel
```

Fire rates can be extreme (hundreds of shots per second with many limbs and a light ball). Rules that keep it smooth:

- The store resolves at most `balance.physics.maxShotsPerTick` shots per tick and carries the rest over; income is never lost, only delayed within the round.
- Ball records live in a pooled `Float32Array` ring buffer on the UI thread (`maxBallsInFlight` from balance). When the pool is full, the oldest resting ball is recycled first.
- Drawing is one Skia `Atlas` call for all balls, one `Path` per limb, one `Picture` for the static world.

## Economy

- Money, upgrades, balls, limb assignment, character, best round, stats: **per sport** (`SportState`).
- Trophies, remove-ads, settings, offline, clock: **global**.
- Income per hit = ball value × `incomeMult(level)` × `masteryBonus(state)` × round boost (×2 ad).
- Costs: `base × growth^level`. Every base and growth is in `balance.json`.

## Save and time

- `serialize(state, now)` / `deserialize(raw)` with a version and a migrations table; invalid saves return `null` and never throw.
- `clockHighWater` and `lastSeenAt` on the state; offline time is `now − max(lastSeenAt, clockHighWater)`, capped.

## UI layer

- One screen (`src/app/index.tsx`) hosts the play field, the money pill, the three cards, the result panel and the shop sheet. Settings is a modal route.
- The play field is one Skia `Canvas`. Positions come from Reanimated shared values updated in `useFrameCallback`; React never re-renders per frame.
- Design tokens live in `src/ui/theme.ts` and come from `docs/design-rules.md` section 4 and 5. No literal colors or sizes in screens.
- Every player-facing string lives in `src/content/` so the voice rules (design rules section 10) can be reviewed in one place.

## Simulator

`tools/simulate.ts` plays rounds through the real engine with a bot that aims at the predicted target position with a configurable error, spends money greedily by estimated gain per cost, and reports time to: first upgrade, first ball swap, second limb, third limb, mastery, Trophies for the second sport. The pacing targets in `docs/analysis.md` become asserts in `src/engine/__tests__/pacing.test.ts` with a reduced seed count.

## Agent workflow

1. Lead writes or updates the spec and the contracts, commits on a branch.
2. Module agents work in git worktrees under `.claude/worktrees/`, each on its own module file and test file. They never run `git add -A`.
3. The lead merges, fixes seams, runs `npm test`, `npm run typecheck`, opens the PR, CI must pass, merge commit.
4. A reviewer agent reads the merged diff for bugs and exploits; the lead fixes.
5. The simulator agent tunes `balance.json` against the targets.
6. The owner tests on the iPhone; decisions go to `docs/decisions.md`.
