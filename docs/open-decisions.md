# Hit Your Shot: Open Decisions, with Proposals

One entry per open item in Part 2 of `docs/game-design.md`. Each entry has a proposal, the reason, what it costs, and what happens if the owner says no. **Nothing here is built until the owner decides.** When an item is decided, the decision moves into Part 1 of the game design with the date, and the entry here is marked "Decided".

Written 2026-11-15. Background and benchmarks are in `docs/analysis.md`. Decisions are logged in `docs/decisions.md`.

**Status after the owner's decisions of 2026-11-15:** decided: 3, 4, 9, 11 (offline part), 12 (version 1 placements), 13, 14, 15 (name), 17, 18, and the mode in 6. Still open: 1, 2 (order after basketball), 5, 6 (details), 7, 8, 10, 12 (prices and caps), 16 (video ads), and the domain choice.

---

## 1. Round length

**Proposal:** 10 seconds, fixed, as a number in `balance.json`. Measure, then test 8 and 12 with the simulator and on the phone.

**Why:** 10 seconds gives about 8 to 15 shots at starting fire rate, enough for a result that is not pure luck, short enough that the upgrade cards come back before attention drifts. A "stamina" upgrade that lengthens rounds was considered and rejected for version 1: it is a fourth card and it makes the simulator's job harder for little feel.

**Cost:** none; it is one number. **If no:** any value between 8 and 15 works with the same code.

## 2. Sport list and order

**Proposal:** basketball first, football second, golf third.

**Why:** target width sets difficulty. A basket is medium and reacts well to a hit (the net). A goal is wide, which is where several parallel shots feel strongest, so it is the right second sport once the player has arms. A golf hole is tiny and the hardest to read, so it comes last, when accuracy is high and the player knows the game. Basketball also has the best first-screenshot: ball, hoop, net, nothing to explain.

**Cost:** three worlds, three targets, three ball families. Version 1 builds only basketball. **If no:** the engine does not care; order is content.

## 3. How a new sport is paid for

**Decided 2026-11-15: Trophies, as proposed.**

**Proposal:** a small global currency, **Trophies**, earned in every sport at fixed milestones: each time an upgrade card reaches a new tier (every 5 levels), each new ball, each new best round above a threshold. A new sport costs Trophies. Trophies buy nothing else in version 1.

**Why:** per-sport money is approved, so there must be a bridge to the next sport, and it should reward *doing well in the current sport*, not grinding money. Trophies also give old sports a job later (item 5). Keeping Trophies to one use prevents the "four currencies" feeling the casual player hates.

**Cost:** one counter, one price per sport, one icon. **If no:** a new sport could cost the current sport's money at a very high price; this works but turns the unlock into a wait rather than an achievement.

## 4. Global or per sport

**Decided 2026-11-15: characters are per sport** (the owner overruled the proposal below). Each sport has its own limb line, arms or feet, so a character cannot carry over anyway. Consequence to design around: every new sport starts at one limb; the Trophy unlock and the first rounds in a new sport should feel like a new joke, not a demotion. The proposal is kept for the record.

**Proposal (not taken):** **characters are global**, money, upgrades and balls are **per sport**.

**Why:** the fresh start of a new sport is good (new upgrades to buy, new ball to meet) as long as the player does not feel demoted. Arriving in football with the 3-arm character makes the new sport start fast and shows the arms in a new context (a wide goal). Balls stay per sport because a golf ball is not a basketball; the weight tiers are the same idea, but the objects are different and that is part of the fun.

**Cost:** a character table outside the per-sport state. **If no (everything per sport):** expect a drop-off at the first sport switch; plan a generous starter bonus in the new sport.

## 5. A reason to replay finished sports

**Proposal:** a **mastery bonus**: each sport that has every upgrade card maxed gives +10% income in every sport, permanently. Plus Trophies (item 3) keep accruing from best-round records in old sports.

**Why:** cheap to build, easy to understand, and it makes the old sport a tool rather than a graveyard. It also gives the end of a sport a definition ("maxed"), which the design currently lacks.

**Cost:** one modifier, one line in the sport selector. **If no:** nothing breaks; sports simply end when the player leaves them.

## 6. Hard mode with obstacles

**Decided 2026-11-15: hard mode exists as a separate mode and obstacles live only there. Not in version 1.** Still open: unlock condition and reward multiple.

**Proposal:** **not in version 1.** Note it for the second version as a "Pro" variant per sport: moving defenders or wind, ×3 income, unlocked at mastery.

**Why:** the normal loop needs to prove itself first, and obstacles are a second physics problem and a second balancing problem. As a post-mastery mode it also solves item 5 more strongly than a flat bonus.

**Cost now:** zero. **If yes now:** version 1 grows by roughly a third.

## 7. Maximum number of limbs (arms, or feet in football)

**Proposal:** **design for 8, build 1 to 4 in version 1**, add 5 and 6 in the first update if testers ask what comes next.

**Why:** the gag is strongest at 2, 3 and 4. Beyond 4, each arm is less of a surprise and more of a stat, which is why the design rules give arms 5 and up a one-off gesture before they start shooting. Eight is where the drawing stops reading on a phone. Also performance: 8 arms at high fire rate with 3 sports' worth of effects is the upper bound for a plain Skia scene.

**Cost:** four character drawings for version 1. **If no cap:** fine, but each arm past 8 needs art and the character silhouette breaks.

## 8. Limb spacing

**Proposal:** spacing is a **fraction of the target width**, per sport, in `balance.json`: 0.35 × target width. All arms shoot parallel to the aim line (approved); the group is centered on the line.

**Why:** with 0.35 and two arms, both balls land inside a centered target. With four arms the outer two land at the edges, so higher accuracy is still worth buying with more arms. The same fraction gives the right feel in a wide goal and a tiny hole. If spacing were a fixed pixel value, golf would be impossible or football trivial.

**Cost:** one number per sport. **If no:** a fixed spacing needs a per-sport exception anyway.

## 9. Accuracy visual

**Decided 2026-11-15 with the version 1 scope: spread cone.**

**Proposal:** a **spread cone** drawn around the aiming line: two faint lines fanning out from the hand, the angle set by the accuracy level and the ball weight. Each level visibly narrows it. The pips under the card show the level; the cone shows the effect.

**Why:** this is the only way to make the accuracy upgrade honest (see analysis). It also explains heavy balls without words: pick a heavy ball and the cone widens.

**Cost:** two lines in the scene and one function. **If no:** players will buy accuracy on faith and eventually feel cheated by misses.

## 10. Ball comparison

**Proposal:** under each ball in the shop, one line: **"about $X per round"**, computed from the player's current fire rate, accuracy, arms, the ball's weight penalties and value, over a round of the current length. Deterministic (no randomness), rounded, refreshed when anything changes.

**Why:** players compare numbers, not descriptions. One number per ball turns "heavy balls pay off once you have upgraded" from a sentence in a design doc into something the player discovers.

**Cost:** one pure function in the engine, which the simulator uses anyway. **If no:** show weight and value as two numbers and let the player guess.

## 11. Extra features (combos, special balls, prestige, offline earnings)

**Decided 2026-11-15: small capped offline earnings in version 1.** Combos, special balls and prestige stay out of version 1 as proposed.

**Proposal:**

- **Offline earnings: yes, small, in version 1.** A trickle equal to a fraction of the last round's income per minute away, capped at 2 hours, shown on return with an optional rewarded "double". Because the name says idle.
- **Combos and streaks: no.** Rounds are too short for a streak to mean anything and it adds text to the play field.
- **Special balls (fire, split, magnet): not in version 1.** They are the right content for update 2, after the plain balls have proven the weight trade-off.
- **Prestige reset: not in version 1.** Prestige is for players who have maxed everything; version 1 will not have enough players at that point to learn from.

**Why:** version 1 has to measure the plain loop. Offline earnings are the one exception because the name promises it and the casual player expects it.

**Cost:** offline earnings are a small module; `neural-tycoon` has a tested version of exactly this (`src/engine/offline.ts`) that can be shared. **If no offline earnings:** consider dropping "Idle" from the subtitle.

## 12. Monetization

**Decided 2026-11-15 with the version 1 scope: the placements below, no interstitials.** Still open: the remove-ads price, the ×2 cooldown, and whether interstitials ever come.

**Proposal for version 1:**

- One rewarded video placement: **"×2 this round"** on the result panel, available every third round at most.
- One rewarded video placement on the offline-earnings screen: **"double"**.
- One purchase: **remove ads, one-time, around $2.99**, which also makes the ×2 offer free and always available.
- **No interstitial ads in version 1.** Revisit after day-7 retention is known.
- No paid random items, no energy, no timers that money skips.

**Why:** rewarded video is the genre's main revenue and players accept it when it is a choice. Interstitials are the first thing the casual player names as a reason to delete. A single remove-ads purchase is simple, honest and the most common purchase in this genre. The two placements use the same code path.

**Cost:** the ads and purchase services behind interfaces, with fakes for Expo Go (the `neural-tycoon` pattern). **If the owner wants interstitials:** not before round 10 of a session, never in the first session, with a frequency cap in `balance.json`.

## 13. Version 1 scope

**Decided 2026-11-15, as proposed, with one addition from the owner: every sport starts with one limb of the kind the sport uses (one arm in basketball and golf, one foot in football).** The table is now Part 1 of the game design.

**Proposal (confirming and extending the suggestion in Part 2):**

| In | Out |
|---|---|
| Basketball, one gym | other sports, Trophies, mastery bonus |
| 3 balls: foam, regulation, medicine | special balls |
| Characters with 1 and 2 arms, 3 and 4 as the first update if time allows | arms 5 and up |
| The 3 upgrades with pips and a spread cone | hard mode, combos, prestige |
| A moving basket (slow rail, see item 17) | obstacles |
| Round result panel with commentator line | leaderboards, accounts |
| Small offline earnings | daily rewards, notifications |
| ×2 rewarded placement, remove-ads purchase | interstitials, other purchases |
| Settings: sound, haptics, restore purchases, privacy | everything else |

**Why:** the smallest version that can answer "does a player keep playing the plain loop for a week" and that contains the arm reveal.

## 14. Technology

**Decided 2026-11-15: Expo, Skia, Reanimated, Zustand, pure TypeScript engine, Jest, simulator. No physics library in version 1.** The owner asked why no physics library and what is best for iOS and mobile overall; the answer is below.

**Proposal:** **Expo (same SDK line as `neural-tycoon`), React Native Skia for the scene, Reanimated for interface motion, Zustand store, a pure TypeScript engine for ballistics and economy, Jest tests, a pacing simulator.** No physics library.

### Why no physics library

A physics library (Matter.js, Planck.js, Box2D, Rapier) simulates a world step by step: every frame it moves every body a little, checks every pair for contact, and resolves it. That is the right tool when the outcome is *unknown until it happens*: stacks of crates, ragdolls, a ball pinballing through twenty obstacles. It is the wrong tool here, for four reasons.

1. **Our outcome is decided at the moment of the shot.** Aim angle, a spread roll, ball weight, limb offset and the target's position at impact time give a landing point and a hit or miss. That is one closed-form parabola and one rectangle test, about thirty lines, computed instantly. The animation afterwards only *shows* a result the engine already knows. This is what makes the game simulatable: the pacing simulator can run ten thousand rounds in under a second with no frames at all. A stepped physics world needs the frames, so simulating an hour of play takes an hour, or a fragile fast-forward.
2. **Determinism and tests.** The engine rule in this portfolio is: same input, same output, time and randomness passed in. A closed-form shot is trivially deterministic, so a save can replay its rolls and a Jest test can assert "accuracy 5, medicine ball, aim 42°: hits 61 of 100". Stepped engines are deterministic only if the step size, the order of bodies and the floating-point path never change; across a JS thread, a UI-thread worklet and a Node test runner they do change.
3. **Cost on the phone.** Matter.js runs on the JavaScript thread, next to React. With four limbs at a high fire rate there can be forty balls in flight plus particles; a broad-phase collision pass per frame for forty bodies is affordable, but it competes with everything else on that thread and it is the first thing to stutter on a mid-range Android. Our shots cost nothing per frame: each ball is `position(t)`, evaluated in a Skia draw callback on the UI thread.
4. **What we would use it for is cosmetic.** Rim bounces, a ball rolling off the green, a kick that hits the post: these are reflections of a velocity vector against a line, with damping. One helper function. Players will not notice the difference between that and a rigid-body solver, and the result still has to agree with the hit or miss the engine already decided, which is awkward when a real solver is in charge.

**The escape hatch.** Hard mode with obstacles (decided, later version) is where real collisions may be wanted. The plan is to add **Matter.js** then, confined to hard mode, because Expo documents exactly this combination (Matter.js + Skia + Reanimated) and it is pure JavaScript, so it runs under Hermes without native code. **Planck.js** (a Box2D port in pure JavaScript) is the alternative if Matter.js's accuracy proves too loose. Box2D-WASM and Rapier are out: Hermes has no WebAssembly, and they would need a native module.

### What is best for iOS and mobile overall

For rendering and feel on iOS, the stack that works best in Expo today is also the one chosen:

- **React Native Skia** draws on the GPU through the same engine Chrome and Flutter use, and it draws from the UI thread when its values come from Reanimated shared values, so the scene stays smooth while React is busy. It supports 120 Hz on ProMotion iPhones.
- **Reanimated 4 worklets** run per-frame logic (ball positions, cone angle) off the JavaScript thread. Rule: React renders the interface, never the balls.
- **Expo Haptics, Expo Audio, Expo Router** are the native-feeling versions of feedback, sound and navigation, and they work in Expo Go for phase 1.
- **No WebView, no game-in-a-browser.** A Phaser or PixiJS game inside a WebView is the quickest way to get an engine, and the quickest way to feel like a web page on iOS (input lag, no native haptics, memory pressure).
- **A native game engine (Unity, Godot)** is the best choice for games that *are* physics or 3D. For a 2D upgrade game with one scene, it costs a second language, breaks code sharing with the portfolio, and needs a Mac or a paid cloud service for iOS builds, which the owner does not have.

Performance plan: the scene is one Skia canvas; ball positions live in shared values updated by one frame callback; React renders only the interface. Pooled ball objects, capped particle counts. Target devices: iPhone 11 and a mid-range Android from 2021. Measure on the owner's iPhone with the performance monitor before adding any effect.

**Cost:** zero new learning. **If a game engine instead:** expect two to three times the setup time and a Mac requirement for iOS.

## 15. Name check

**Decided 2026-11-15: the name is final, "Hit Your Shot: Idle Sports". Domain `.app` or `.io`; both did not resolve on 2026-11-15 and look free, to be confirmed at a registrar.** The checks below remain to do before the first TestFlight build.

**Findings (2026-11-15, web search and DNS only, not exhaustive):**

- No App Store listing titled exactly "Hit Your Shot" was found. Similar names exist: "Hit perfect 3D", "Shoot and Win!", "Hit the target-aim", "In the target!".
- Google Play was not searched directly; the App Store Connect and Play Console name checks happen at app creation and are the authoritative test.
- `hityourshot.com` resolves to a live server (taken). `hityourshot.app` does not resolve (likely free; confirm with a registrar).
- TikTok and Instagram handles were not checked.

**Proposal:** keep the name as the working title. Before the first TestFlight build: check the exact name in App Store Connect, search the USPTO and EUIPO trademark databases for "Hit Your Shot" in class 9 and 41, check the two handles, and register `hityourshot.app` if free. Have one fallback name ready; the subtitle "Idle Sports" can stay with any main name.

## 16. Store marketing and the arm surprise

**Proposal:** the icon, the name, the subtitle and the first three screenshots never show more than one arm. Screenshot four or five may show a silhouette with a "?" if the owner likes. Short-form video ads are a separate decision for after launch; they may show the reveal, because an ad has to show the one thing nobody has seen.

**Why:** the store listing is for people deciding to install; the surprise is worth more than the hook there. An ad is for people scrolling past; the hook is worth more than the surprise there. Both can be true at once because they reach different people.

**Cost:** none now. **If no videos ever show the arms:** marketing relies entirely on word of mouth.

## 17. New proposal: the target moves

**Decided 2026-11-15: yes. Obstacles only in hard mode.**

Not in Part 2, raised by the analysis. **Proposal:** every sport has a slow, visible motion in the target, in `balance.json`: the basket slides on a rail (period about 4 seconds, amplitude a third of the field), the golf hole sits on a slope that changes each round, the football goalkeeper (a cone on a stick) drifts. Version 1: the sliding basket only.

**Why:** without motion the player finds the line once and never aims again, and the accuracy upgrade becomes a tax on randomness. With motion, aiming is a small decision every round, accuracy is slack against the motion, and heavy balls (slower arc) have a second cost. It is the single change with the largest effect on whether the core verb survives the first session.

**Cost:** one moving rectangle and its parameters. **If no:** the game still works, but accuracy must then be shown as pure spread, and the aim line can be hidden after the first round because it does nothing.

## 18. New proposal: the round result moment

**Decided 2026-11-15 with the version 1 scope.**

Not in Part 2, raised by the analysis. **Proposal:** when a round ends, a panel slides up over the play field (not over the cards) with: money this round, hits of shots, a best-round marker, the commentator line, and a "Play again" button. The upgrade cards stay visible and pressable under it. A tap anywhere outside the panel or on "Play again" starts the next round; the first drag on the play field also starts it.

**Why:** the round needs to end with a result the player reads in two seconds and a spend decision with no navigation. This panel is also the only place where the game speaks (design rules section 10) and where the rewarded ×2 lives.

**Cost:** one panel. **If no:** the round timer simply resets, and the player misses the one moment of reflection that makes the loop feel like a game.
