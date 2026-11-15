# Hit Your Shot: Idle Sports — Game Design

Status: **idea approved, not yet in development**
Created: 2026-11-15

This document has two parts:

1. **Approved** — decided by the owner. Build on these.
2. **Open** — not decided yet. Do not build these until the owner decides.

---

## Part 1: Approved

### Name

- **Hit Your Shot: Idle Sports**
- The name must **not** mention the arms. The multi-arm characters are a surprise for the player.

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

### Upgrades

| Upgrade | Effect |
|---|---|
| Accuracy | Balls follow the aiming line more closely |
| Fire rate | Balls are shot faster, with shorter breaks between shots |
| Income | Multiplier on money per hit (x1, x1.5, ...) |

### Sports

- Sport-type examples: golf (hole), basketball (basket), football (goal).
- At the start the player **chooses one sport** and plays it.
- Other sports are **unlocked later with enough money**.
- **Each sport has its own money and its own upgrades.** They are separate.

### Ball types

- Different balls, from **very light** (worth almost nothing per hit) to **heavy** (worth much more per hit).
- Heavier balls **lower accuracy and fire rate**.
- So heavy balls only pay off once the player has upgraded accuracy and fire rate.

### Characters (multi-arm)

- **Unlockable characters** that shoot with more arms: 1 arm, then 2 arms at the same time, then 3, then 4, and so on.
- Each arm can be given a **different ball type**, or all arms can use the same ball.
- All arms shoot **parallel to the aiming line**, side by side.
- A new character works like a big fire-rate boost. This is intended: it is a **progression spike** that speeds the game up again when progress feels slow (dopamine moment).
- The arms should be **funny when the player first sees them**, not expected.

---

## Part 2: Open — still to decide

| Topic | Question | Notes / options discussed |
|---|---|---|
| Round length | Exactly how long is a round? | "For example 10 seconds" was an example, not a fixed number |
| Sport list | Which sports at launch, and in what order? | Golf, basketball and football were examples |
| Sport unlock payment | Separate money per sport is approved. With which money is a new sport bought? | Option: a small global currency (trophies/stars) earned in every sport |
| Global or per sport | Are characters and ball types shared across all sports, or bought per sport? | Option: characters and balls global, so the fresh start in a new sport is not from zero |
| Reason to replay old sports | Why go back to a sport the player already finished? | Option: bonus for maxed sports (e.g. +10% income everywhere) |
| Hard mode | A separate hard mode with obstacles? | Owner said "maybe". Obstacles should not be in the normal casual loop. Option: higher reward (e.g. x3 income) |
| Max number of arms | How many arms at most? | Open-ended ("and so on") |
| Arm spacing | How far apart are the parallel shots? | Wide spacing helps in football (wide goal), hurts in golf (tiny hole) |
| Accuracy visual | How is accuracy shown? | Option: a spread cone around the aiming line that narrows with upgrades |
| Ball comparison | How does the player compare balls? | Option: show "estimated income per round" for each ball |
| Extra features | Combos/streaks, special balls (fire, split, magnet), prestige reset, offline earnings | Suggested, not approved |
| Monetization | Rewarded ads, in-app purchases, prices | Option: "watch an ad for x2 income this round". Nothing decided |
| MVP scope | What is in version 1? | Suggestion: 1 sport (basketball), 3 balls, 2 characters (1 and 2 arms), aim line and the 3 upgrades |
| Tech | Expo (like neural-tycoon) or a game engine? | Aiming and ball physics may need more than plain Expo. Compare options before coding |
| Name check | Is "Hit Your Shot" free in the App Store and Google Play? | Not checked yet. Also check TikTok/Instagram handles and a domain |
| Store marketing | When are the multi-arm characters shown? | Suggestion: not in the first screenshot, so the surprise stays |
