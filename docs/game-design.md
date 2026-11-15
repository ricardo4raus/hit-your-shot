# Hit Your Shot: Idle Sports — Game Design

Status: **approved, all open items decided, development started 2026-11-15**
Created: 2026-11-15. Last owner decisions: 2026-11-15, round 2 (see `docs/decisions.md`).

This document has two parts:

1. **Approved** — decided by the owner. Build on these.
2. **Open** — not decided yet. Do not build these until the owner decides. Proposals for each are in `docs/open-decisions.md`.

---

## Part 1: Approved

### Name

- **Hit Your Shot: Idle Sports** (final, 2026-11-15).
- The name must **not** mention the arms. The multi-limb characters are a surprise for the player.
- Domain: **`hityourshot.app`** (decided 2026-11-15, round 2). Not registered yet. Why a mobile app needs one: `docs/decisions.md`.

### Genre and pitch

A mobile sports shooter with idle/upgrade progression. A character shoots balls at a target (hole, basket or goal) during short timed rounds. Every hit earns money. The money buys upgrades, so each round goes better than the last.

### Core loop

1. The player plays a short timed round of **10 seconds** (`roundSeconds` in `balance.json`; 8 and 12 to be tested, decided 2026-11-15).
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

- Sports and order (decided 2026-11-15): **basketball** (basket), then **football** (goal), then **golf** (hole). Order follows target width: medium, wide, tiny.
- At the start the player **chooses one sport** and plays it. Version 1 ships **basketball only** (2026-11-15).
- Other sports are **unlocked later** with **Trophies** (2026-11-15), a small global currency earned in every sport at fixed milestones (upgrade tiers, new balls, best-round records). Trophies buy nothing else in version 1.
- **Each sport has its own money and its own upgrades.** They are separate.
- **Mastery bonus** (decided 2026-11-15): a sport with every upgrade card maxed gives **+10% income in every sport**, permanently. Trophies keep accruing in old sports. These are the reasons to go back.

### Ball types

- Different balls, from **very light** (worth almost nothing per hit) to **heavy** (worth much more per hit).
- Heavier balls **lower accuracy and fire rate**.
- So heavy balls only pay off once the player has upgraded accuracy and fire rate.
- **Ball comparison** (decided 2026-11-15): under each ball in the shop, one line, **"about $X per round"**, computed deterministically from the player's current stats and the ball's numbers.
- **Extreme volume is supported** (owner, 2026-11-15): many limbs, a high fire-rate level and a very light ball may put hundreds of balls in flight at once. The game must handle that smoothly: balls spread because they do not fly perfectly in line, they bounce off the rim, the backboard, the floor and the walls, and they go everywhere. That chaos is a feature, even when it is not the best way to earn.

### Characters (multi-limb) (updated 2026-11-15)

- **Characters are per sport** (owner, 2026-11-15). Each sport has its own character line, bought with that sport's money.
- The character uses **the body part the sport uses**: arms in basketball and golf, **feet in football**. Every sport starts with **one** of that limb: one arm shooting, or one foot kicking.
- Unlockable characters add **more of that limb**: 1, then 2 at the same time, then 3, then 4, and so on. Extra arms shoot; extra feet kick.
- **No fixed maximum** (owner, 2026-11-15, round 2). Limbs are **procedural**: the character is drawn by code, and a limb-placement algorithm attaches each new limb so that it looks roughly natural (shoulders and hips first, then along the torso and back, alternating sides). New limbs never need new art, so the count can scale as far as the economy and the phone allow. A soft performance cap lives in `balance.json` and is raised when devices prove it.
- Each limb can be given a **different ball type**, or all limbs can use the same ball.
- All limbs shoot **parallel to the aiming line**, side by side. **Spacing** (decided 2026-11-15): 0.35 × target width per sport, with the whole group's span capped at a fraction of the field so that many limbs squeeze closer together instead of shooting off-screen.
- A new character works like a big fire-rate boost. This is intended: it is a **progression spike** that speeds the game up again when progress feels slow (dopamine moment).
- The limbs should be **funny when the player first sees them**, not expected. They are never announced in text; see `docs/design-rules.md` section 8.

### Offline earnings (2026-11-15)

- A **small, capped** income while the app is closed: a fraction of the last round's income per minute away, capped (proposal: 2 hours). Shown on return, with an optional rewarded "double".
- Clock changes never pay the same time twice (high-water mark, as in `neural-tycoon`).

### Hard mode (2026-11-15)

- A separate mode per sport with **obstacles** and a higher reward. Obstacles exist **only** here.
- Unlocked at **mastery** of the sport (all cards maxed); pays **×3 income** (decided 2026-11-15).
- **Not in version 1.**

### Technology (2026-11-15)

- Expo (same SDK line as `neural-tycoon`), React Native Skia for the scene, Reanimated for interface motion, Zustand store, a pure TypeScript engine for ballistics and economy, Jest tests, a pacing simulator over the real engine.
- No physics library in version 1; see `docs/open-decisions.md` item 14 for the reasoning and the escape hatch.

### Store and marketing (2026-11-15)

- Icon, name, subtitle and the first three screenshots never show more than one limb. Later screenshots may show a silhouette with a "?".
- Short-form video ads **may show the limb reveal** after launch (decided 2026-11-15).

### Version 1 scope (2026-11-15)

| In | Out |
|---|---|
| Basketball, one gym, sliding basket | other sports, Trophies spending, mastery bonus |
| 3 balls: foam, regulation, medicine | special balls |
| Characters with 1 and 2 arms; 3 and 4 in the first update if time allows | arms 5 and up |
| The 3 upgrades with pips and a spread cone | hard mode, obstacles, combos, prestige |
| Round result panel with commentator line | leaderboards, accounts |
| Small offline earnings | daily rewards, notifications |
| One rewarded "×2 this round" placement (available every third round at most), one rewarded "double" on the offline screen, one remove-ads purchase (around $2.99, also makes ×2 free and always available) | interstitials, other purchases |
| Settings: sound, haptics, restore purchases, privacy | everything else |

---

## Part 2: Open — still to decide

Nothing is open as of 2026-11-15 (round 2). New questions go here as a table row with a proposal in `docs/open-decisions.md`, and the owner decides.

| # | Topic | Question | Notes / options discussed |
|---|---|---|---|
| | | | |
