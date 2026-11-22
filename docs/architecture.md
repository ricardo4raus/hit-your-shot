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
| limbs | `limbs.ts` | agent "limbs" | contracts | `limbAnchors(n, kind)` (procedural body placement), `muzzleOffsets(n, sportDef, balance)` (parallel shot offsets with span cap) |
| upgrades | `upgrades.ts` | agent "economy" | contracts | costs and effects of the three cards: `upgradeCost`, `spreadDeg`, `shotsPerSec`, `incomeMult`, `buyUpgrade`, `isMastered` |
| balls | `balls.ts` | agent "economy" | contracts | `ballDef`, `buyBall`, `assignLimbBall` |
| characters | `characters.ts` | agent "economy" | contracts | `characterCost`, `characterName`, `buyCharacter` |
| round | `round.ts` | agent "round" | ballistics, limbs, upgrades, balls | `createRound`, `dueShots`, `shotInputFor`, `recordShot`, `settleRound` (money, best, stats, trophy milestones, events) |
| estimate | `estimate.ts` | agent "round" | round, ballistics | `incomePerRoundEstimate(state, ballId)` for "about $X per round", deterministic Monte Carlo with a fixed seed |
| trophies | `trophies.ts` | agent "economy" | contracts | milestone ids, `trophyMilestones`, `unlockSport`, `masteryBonus` |
| offline | `offline.ts` | agent "meta" | contracts | `offlineSeconds`, `computeOfflineEarnings`, `applyOfflineEarnings`, `claimOfflineDouble` |
| save | `save.ts` | agent "meta" | contracts | `serialize`, `deserialize`, migrations, Zod schema of `GameState` |
| ads | `ads.ts` | agent "meta" | contracts | `boostLeftMs`, `canAddBoost`, `addBoost`, `buyRemoveAds` |

## Coordinates and units

- World units are **meters**, seen from behind the character (2026-11-16). `x` is depth from the back wall toward the target (`field.length` long), `y` is height (`field.height` to the ceiling), `z` is lateral with side walls at `±field.halfSpan`, positive = the player's right. Gravity is `balance.physics.gravity` (m/s², positive number, applied downward); nothing acts sideways between contacts.
- The character's **shot origin** is `field.origin` (depth and chest height) at `z = 0`. Limb `i` fires from `z = muzzleOffsets[i]`.
- The **aim** is a yaw in radians, 0 = straight at the target, positive = right. It defines an **aim point** on the target plane; every limb shoots at that point from its own offset (convergent). The engine solves the **pitch** (`launchPitch`) for the sport's arc so a perfect shot passes through the aim point. The UI converts a drag to a yaw; the engine never sees pixels.
- The **target** is a `TargetPose` at round time `t`: depth and height are fixed per sport, only `z` moves (the hoop slides sideways, the keeper drifts sideways, the hole sits at a different `z` each round). Basketball: a hoop ring with a backboard; golf: a hole in the floor; football: the goal mouth with a keeper box. Version 1 implements basketball; the others are data plus small `targetPose` branches.
- **Hit** = the ball center crosses the sensor in its direction: down through the hoop's circle, forward through the goal mouth, onto the floor inside the hole.

## Shot resolution (ballistics)

`resolveShot(input: ShotInput, rng: Rng, physics, sportDef): ShotResult`

1. Direction = the limb's line to the aim point, plus a cone of deviation: `gaussianish(rng) × spreadDeg` (sum of three uniforms, so the cone has a soft middle and rare edges) in a uniformly random direction, split into a yaw part and a pitch part.
2. Launch speed = ball `launchSpeed`. Start point = origin at the limb's lateral offset. Pitch from `launchPitch` for the distance to the aim point.
3. March time in fixed steps of `physics.stepSec` up to `physics.maxFlightSec`. At each step: new position by the parabola; test the **sensor** (hit → end after a short drop), the **floor**, the **back and far wall**, the **side walls**, the **ceiling**, the **backboard**, the **rim ring**, the **keeper box**. On contact: reflect the velocity with the surface's restitution, apply tangential friction, and **start a new segment** at that time. Below `physics.restSpeed` on the floor: rest. Rest → end.
4. Output: `{ hit, segments, endSec, eventSec, value }`. `value` is the money the hit is worth (ball value × income mult × bonuses), 0 for a miss.

`positionAt(segments, t, out)` writes `(x, y, z)` for playback; it is a worklet-safe function (no closures, plain math). `predictYaw` gives the yaw that meets the moving target; the estimate and the simulator bot aim with it.

## The round, live

The **store** owns the live round. `RoundState` is transient (never saved):

```text
startRound   → createRound(state, now, rng)           phase for the target, per-limb next-fire times
every 1/30 s → dueShots(round, t)                      limbs that should fire now
             → for each: shotInputFor(state, round, i, aim) → resolveShot → recordShot
             → UI thread gets the segments (shared value) and draws
t ≥ roundSec → settleRound(state, round) → new state + events; the cards and the play button come back
```

Fire rates can be extreme (hundreds of shots per second with many limbs and a light ball). Rules that keep it smooth:

- The store resolves at most `balance.physics.maxShotsPerTick` shots per tick and carries the rest over; income is never lost, only delayed within the round.
- Ball records live in one shared array on the UI thread (`maxBallsInFlight` from balance), each shot packed as flat numbers. When the array is full, the oldest balls are dropped first.
- Drawing is a handful of Skia paths rebuilt per frame on the UI thread: the balls as circles in three depth groups (behind the target, between, in front of the character) with an ink path under each fill path, one path of flat shadows, two paths for the limbs, two for the aim. The world, the body and the target are static paths built once per size. (An `Atlas` of sprites did not render in Expo Go on iOS.)

## Economy

- Money, upgrades, balls, limb assignment, character, best round, stats: **per sport** (`SportState`).
- Trophies, remove-ads, settings, offline, clock: **global**.
- Income per hit = ball value × `incomeMult(level)` × `masteryBonus(state)` × round boost (×2 while the ad boost runs at round start).
- Costs: `base × growth^level`. Every base and growth is in `balance.json`.

## Save and time

- `serialize(state, now)` / `deserialize(raw)` with a version and a migrations table; invalid saves return `null` and never throw.
- `clockHighWater` and `lastSeenAt` on the state; offline time is `now − max(lastSeenAt, clockHighWater)`, capped.

## UI layer

- One screen (`src/app/index.tsx`) hosts the full-screen play field, the money pill, the three cards (between rounds), the play button with the last result (`features/round/RoundControls.tsx`) and the shop sheet. Settings is a modal route.
- The play field is one Skia `Canvas` with a fixed pinhole camera behind the character (`features/play/camera.ts`). Positions come from Reanimated shared values read in `useDerivedValue` every frame; React never re-renders per frame.
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
