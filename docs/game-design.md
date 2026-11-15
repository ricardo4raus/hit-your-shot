# Hit Your Shot: Idle Sports — Game Design

Status: **approved, version 1 scope decided, not yet in development**
Created: 2026-11-15. Last owner decisions: 2026-11-15 (see `docs/decisions.md`).

This document has two parts:

1. **Approved** — decided by the owner. Build on these.
2. **Open** — not decided yet. Do not build these until the owner decides. Proposals for each are in `docs/open-decisions.md`.

---

## Part 1: Approved

### Name

- **Hit Your Shot: Idle Sports** (final, 2026-11-15).
- The name must **not** mention the arms. The multi-limb characters are a surprise for the player.
- Domain: `.app` or `.io` (owner, 2026-11-15). Not registered yet.

### Genre and pitch

A mobile sports shooter with idle/upgrade progression. A character shoots balls at a target (hole, basket or goal) during short timed rounds. Every hit earns money. The money buys upgrades, so each round goes better than the last.

### Core loop

1. The player plays a short timed round (around 10 seconds).
2. The character shoots balls at the target.
3. Every goal / hit on the target earns money.
4. Between rounds the player spends money on upgrades.
5. Repeat. Every round gets better.

### Aiming

- The player aims a **shooting line**.
- The character shoots along that line. How close the balls follow the line depends on the **accuracy** upgrade.
- Accuracy is shown as a **spread cone** around the line that narrows with each level and widens with heavier balls (decided with the version 1 scope, 2026-11-15).

### The target moves (2026-11-15)

- Every sport has a slow, visible motion in the target: the basket slides on a rail, the golf hole sits on a slope that changes each round, the goalkeeper drifts.
- The motion is gentle and readable. It exists so that aiming is a small decision every round and accuracy means "slack against the motion".
- **Obstacles are never part of the normal loop.** They belong to hard mode only (see below).

### Round result (2026-11-15)

- When a round ends, a result panel slides up over the play field, not over the upgrade cards: money this round, hits of shots, best-round marker, one commentator line, "Play again".
- The upgrade cards stay visible and pressable under it. Tapping outside the panel, "Play again", or dragging on the play field starts the next round.

### Upgrades

| Upgrade | Effect |
|---|---|
| Accuracy | Balls follow the aiming line more closely; the spread cone narrows |
| Fire rate | Balls are shot faster, with shorter breaks between shots |
| Income | Multiplier on money per hit (x1, x1.5, ...) |

### Sports

- Sport-type examples: golf (hole), basketball (basket), football (goal).
- At the start the player **chooses one sport** and plays it. Version 1 ships **basketball only** (2026-11-15).
- Other sports are **unlocked later** with **Trophies** (2026-11-15), a small global currency earned in every sport at fixed milestones (upgrade tiers, new balls, best-round records). Trophies buy nothing else in version 1.
- **Each sport has its own money and its own upgrades.** They are separate.

### Ball types

- Different balls, from **very light** (worth almost nothing per hit) to **heavy** (worth much more per hit).
- Heavier balls **lower accuracy and fire rate**.
- So heavy balls only pay off once the player has upgraded accuracy and fire rate.

### Characters (multi-limb) (updated 2026-11-15)

- **Characters are per sport** (owner, 2026-11-15). Each sport has its own character line, bought with that sport's money.
- The character uses **the body part the sport uses**: arms in basketball and golf, **feet in football**. Every sport starts with **one** of that limb: one arm shooting, or one foot kicking.
- Unlockable characters add **more of that limb**: 1, then 2 at the same time, then 3, then 4, and so on. Extra arms shoot; extra feet kick.
- Each limb can be given a **different ball type**, or all limbs can use the same ball.
- All limbs shoot **parallel to the aiming line**, side by side.
- A new character works like a big fire-rate boost. This is intended: it is a **progression spike** that speeds the game up again when progress feels slow (dopamine moment).
- The limbs should be **funny when the player first sees them**, not expected. They are never announced in text; see `docs/design-rules.md` section 8.

### Offline earnings (2026-11-15)

- A **small, capped** income while the app is closed: a fraction of the last round's income per minute away, capped (proposal: 2 hours). Shown on return, with an optional rewarded "double".
- Clock changes never pay the same time twice (high-water mark, as in `neural-tycoon`).

### Hard mode (2026-11-15)

- A separate mode per sport with **obstacles** and a higher reward. Obstacles exist **only** here.
- **Not in version 1.** Details (unlock condition, reward multiple) are open.

### Technology (2026-11-15)

- Expo (same SDK line as `neural-tycoon`), React Native Skia for the scene, Reanimated for interface motion, Zustand store, a pure TypeScript engine for ballistics and economy, Jest tests, a pacing simulator over the real engine.
- No physics library in version 1; see `docs/open-decisions.md` item 14 for the reasoning and the escape hatch.

### Version 1 scope (2026-11-15)

| In | Out |
|---|---|
| Basketball, one gym, sliding basket | other sports, Trophies spending, mastery bonus |
| 3 balls: foam, regulation, medicine | special balls |
| Characters with 1 and 2 arms; 3 and 4 in the first update if time allows | arms 5 and up |
| The 3 upgrades with pips and a spread cone | hard mode, obstacles, combos, prestige |
| Round result panel with commentator line | leaderboards, accounts |
| Small offline earnings | daily rewards, notifications |
| One rewarded "×2 this round" placement, one rewarded "double" on the offline screen, one remove-ads purchase | interstitials, other purchases |
| Settings: sound, haptics, restore purchases, privacy | everything else |

---

## Part 2: Open — still to decide

Proposals for every row are in `docs/open-decisions.md` (same numbering).

| # | Topic | Question | Notes / options discussed |
|---|---|---|---|
| 1 | Round length | Exactly how long is a round? | "For example 10 seconds" was an example, not a fixed number. Proposal: 10 s in `balance.json`, test 8 and 12 |
| 2 | Sport order after basketball | Football second and golf third, or the other way? | Basketball first is decided (version 1). Proposal: football, then golf |
| 5 | Reason to replay old sports | Why go back to a sport the player already finished? | Trophies keep accruing there (decided). Open: an extra mastery bonus (e.g. +10% income everywhere per maxed sport) |
| 6 | Hard mode details | Unlock condition and reward multiple? | Mode itself is decided. Proposal: unlocked at mastery, ×3 income |
| 7 | Max number of limbs | How many at most? | Proposal: design for 8, build 1 to 4 in version 1 |
| 8 | Limb spacing | How far apart are the parallel shots? | Proposal: 0.35 × target width, per sport, in `balance.json` |
| 10 | Ball comparison | How does the player compare balls? | Proposal: "about $X per round" under each ball |
| 12 | Monetization details | Prices, frequency caps, interstitials later? | Version 1 placements are decided (see scope). Open: the remove-ads price, the ×2 cooldown, whether interstitials ever come |
| 16 | Store marketing | May video ads show the limb reveal? | Store listing never shows it (decided). Ads: open |
| 19 | Domain | `.app` or `.io`? | Owner allows either. `hityourshot.app` and `.io` did not resolve on 2026-11-15 (likely free; confirm with a registrar). `.com` is taken |
