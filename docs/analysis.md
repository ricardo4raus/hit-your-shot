# Hit Your Shot: Idea Analysis

Written 2026-11-15 against Part 1 of `docs/game-design.md`. Three lenses: a game designer, a game-loop and economy specialist, and a casual player who finds the game in the store. The last section says what the idea can realistically become and what has to be true for that.

Short version: the idea is sound and cheap to build, the genre is proven and crowded, and the one thing that can make this game stand out is already in the design (the extra arms). The biggest design risk is that aiming becomes meaningless after the first round. The biggest business risk is that nobody sees the game. Both are fixable, and the fixes are listed at the end.

---

## 1. Where this game sits

The design describes an **idle arcade upgrade shooter**, the subgenre that the first reference screenshot comes from: a character on the left, a target on the right, three upgrade cards at the bottom (damage, fire rate, income), money per hit, drag to aim. Players call these "idle shooters" even though there is nothing idle about them: you play actively, and "idle" only signals "numbers go up, no skill ceiling, no losing".

Comparable games that exist today (store searches, November 2026): Idle Dunk Masters (balls at a hoop, boosters, locations), All Star Basketball Challenge (idle clicker basketball), Idle Golf Tycoon (driving range tycoon), Hyper Idle Golf (timing shots), Idle Dot Shooter (defence, drone and economy upgrade groups, rewarded ads for cash), Weapon Idle and Gun Idle (upgrade a gun, shoot forever). None of them is a sports multi-shooter with one aiming line, and none has the arms. That is a real gap, but a narrow one: the genre is defined by its template, and the template is what gets copied. What is not copied is the joke.

What the genre proves:

- Players understand the loop in under five seconds without words. That is the whole reason the template exists.
- Three upgrades are enough for the first hour. The first screenshot has exactly three.
- Rewarded video ("double your money this round") is the main revenue; a remove-ads purchase is the second.
- Retention is front-loaded: strong day 1, weak day 7, near zero day 30, unless a second layer (new worlds, new characters, prestige) arrives in time.

What the genre punishes:

- Progress that stalls without a visible next thing to buy.
- Upgrades that do not feel different (level 7 to level 8 with no visible change).
- Ads before the player loves the game.
- Any tutorial text longer than two words.

## 2. Game designer's view

### What already works

**The loop is complete and legible.** Play, earn, spend, play better. Every element in Part 1 maps to one of those verbs. No part of it needs explaining.

**Rounds are the right container.** Many idle shooters run continuously, so there is never a clean moment to spend. A ten-second round gives the player a natural pause, a result ("$340, best round!") and a reason to look at the upgrade cards. It is also the natural place for a rewarded ad offer and for the daily reset later. Keep the rounds.

**Three upgrades with distinct feel.** Accuracy changes where balls go, fire rate changes how many, income changes the number on the coin. A player can see each one work. That is better than "damage", which only changes a number.

**Ball weight is a real decision.** Light balls shoot often and hit often for little. Heavy balls pay more and miss more. That is a trade-off the player can reason about in one sentence, and it changes the right answer as the upgrades grow. Most games in this genre have zero decisions. One is plenty.

**The arms are the game's identity.** A sudden second arm, shooting in parallel, is a visual gag, a doubling of output, and a story beat ("what comes next?") in one feature. It is also exactly the kind of moment players record and send to friends. It is the strongest thing in the design and it costs almost nothing to build.

### What will break if left as written

**Aiming has no reason to exist after round one.** If the target stands still, the player finds the right line in the first round, never touches it again, and the accuracy upgrade becomes a tax on randomness: "I aimed right, the game decided to miss." That feels unfair, and unfair is the one feeling this genre cannot survive. The fix is cheap: something has to move. A basket that slides on a rail, a golf hole on a slope that shifts each round, a goalkeeper who drifts. Then the aiming line is a choice every round, accuracy becomes "how much slack I have", and heavy balls (slower, bigger arc) become a trade-off against motion too. This is listed as a proposal in `docs/open-decisions.md`; it is the single most important open item.

**A round needs a result, not only a timer.** Ten seconds that just end are a loading bar. Ten seconds that end with a number, a comparison to the best round and a one-line reaction are a game. The round result screen is where the player decides to keep going. It needs: money earned, hits out of shots, best round marker, and the upgrade cards right there (no navigation).

**Separate money per sport is a soft reset.** Approved and reasonable (each sport feels fresh), but understand what it does: the day the player unlocks golf, their income drops to zero in the new sport. Players who have grown used to earning thousands per round do not enjoy earning three. Something must carry over, or the unlock becomes the moment they quit. The proposal: characters carry over globally (so the player arrives in golf with their arms), money and upgrades stay per sport. That keeps the fresh start and removes the humiliation.

**Multiplicative stacking will run away.** Income per round is roughly: shots per second × hit chance × ball value × income multiplier × arms. Five multipliers. If each one doubles over the first hour, income grows 32×, and upgrade costs must grow at least as fast, or the player buys everything and the game is empty. This is not a design flaw; it is the normal shape of an upgrade game. It only means the numbers cannot be guessed. They have to be simulated, exactly the way `neural-tycoon` does it (a pure engine, a simulator over many seeds, a pacing test in CI). Plan for that from the first line of engine code.

**The accuracy upgrade must never feel like it does nothing.** At accuracy level 1 the player sees a wide spread; at level 10 the spread is tight. Between any two levels the difference must be visible. A spread cone drawn around the aiming line, narrowing with each level, makes the upgrade honest. Without it, the player buys accuracy on faith.

**The name promises idle.** "Idle Sports" tells a store browser two things: numbers go up, and something happens while I am away. Part 1 has nothing that happens while away. That is fine for the active loop, but a first-session player who closes the app and reopens it an hour later will expect a "welcome back, you earned $X" screen, because every game with "Idle" in the name has one. Either plan a small offline income or accept that the name over-promises slightly. Proposal in the open decisions: a small offline trickle, capped, from the first version.

**The surprise versus the hook.** The owner wants the arms to be a surprise: not in the name, icon or first screenshot. Correct for people who already downloaded the game. But the arms are also the best thing to put in an ad or a short video, because they are the only thing in the game that nobody has seen before. This is a real tension, and it is a marketing decision rather than a design one: keep the surprise in the store listing, and decide later whether short-form video ads may show the reveal. Players who come from such a video will still enjoy the moment; they just know it is coming.

### Things the design does not need

Combos, streaks, special balls, prestige, obstacles, hard mode. All listed as open items; none belongs in the first version. The first version has to prove one thing: that a player keeps playing the plain loop for a week. Every extra system before that proof is weight. Special balls and prestige are the right second layer once day 7 retention is known.

## 3. Game-loop and economy view

### The three clocks

A game like this runs on three clocks, and each needs something to happen.

| Clock | Length | What the player must get |
|---|---|---|
| Round | about 10 seconds | a result and one spend decision |
| Session | 3 to 6 minutes, 15 to 30 rounds | at least one visible step: a new pip on an upgrade card, a new ball affordable, a character closer |
| Day | 1 to 4 sessions | a reason to open the app again: offline earnings, a daily something, or simply "I was close to the 3-arm guy" |

The round clock is designed. The session clock needs numbers (how fast do pips fill?). The day clock is empty in Part 1 and is the reason the open decisions include offline earnings.

### Pacing targets to tune toward

These are proposals, to be hit by the balance simulator, not promises. They follow what works in this genre and in `neural-tycoon`'s own pacing work.

| Moment | Target | Why |
|---|---|---|
| First shot fired | under 3 seconds after launch | no menu, no logo screen, the round starts on first touch |
| First upgrade bought | after round 1 | the player must press an upgrade button before they can get bored |
| Every upgrade card visibly changes | at most every 3 rounds for the first 10 minutes | the "numbers go up" promise |
| First ball swap pays off | 3 to 5 minutes | the first real decision; should feel clever |
| Second arm | 12 to 18 minutes of play | the first session needs the reveal; it is the reason to come back |
| Third arm | day 2 | the second session needs its own spike |
| Second sport affordable | 60 to 90 minutes of total play | after the first sport has shown everything once |
| Session ends by choice, not by wall | always | no hard waits, no "come back in 4 hours" in the first week |

### Income shape

Income per round should grow in steps, not smoothly. Smooth exponential growth feels like nothing is happening. Steps come from: a new ball (×2 to ×3), a new arm (×2 per arm at first, less later), an income tier (×1.5). Accuracy and fire rate are the smooth part between steps. The simulator should check that no stretch longer than about four minutes passes without a step in the first hour.

### Cost shape

Each upgrade card: cost grows by a fixed factor per level (typically 1.12 to 1.18 in this genre), with the three cards slightly different so the "best buy" rotates. Balls and characters: one-time prices placed so they arrive at the pacing targets above. Everything in `balance/balance.json`, nothing in code.

### What to measure once it runs on a phone

- Rounds per session and sessions per day.
- Time to second arm (should match the target; if players quit before it, move it earlier).
- The upgrade the player buys most (if one card is always the right answer, the costs are wrong).
- Where sessions end: after a round result (healthy) or mid-round (a problem).

## 4. Casual player's view

Imagine the player: on a train, phone in one hand, thumb only, sound off, four minutes. They typed "sports" or saw a short video.

### What they expect before downloading

- An icon with one big readable object (a ball, a target), not a scene.
- Screenshots that show the game in one glance: character, line, target, money.
- A download under 60 MB, no account, no "allow tracking" before they have played.
- "Free" with ads they can opt into, not ads that interrupt.

### What they expect in the first two minutes

- To be playing within one touch. The game should start the first round when they drag.
- No words. The first screenshot's "DRAG TO AIM" and the hand are the complete tutorial.
- Every hit makes a sound, a number and a coin. Every miss is visibly their fault or visibly bad luck, never a mystery.
- An upgrade they can afford after the first round. Pressing it must look like it did something.
- Something to laugh at. Not a joke in text: a thing on screen that is slightly wrong in a good way. The character's face when a heavy ball barely leaves their hand. The ball bouncing off the rim and hitting the character.

### What they feel at the end of a session

Good session: "one more round, I am 40 short of the next arm". Bad session: "I have bought everything I can afford and the next thing costs ten rounds of waiting."

### What makes them come back tomorrow

Honest answer for this genre: curiosity. "What does the four-arm guy look like?" is a better retention mechanic than any daily reward. That means the next character must always be visible (silhouette, price, "?" card) and never more than one session away in the first days.

### What makes them delete

- An interstitial ad in the first session.
- A round where they aimed right and every ball missed.
- A new sport that starts them at zero with no carry-over.
- A screen full of currencies, badges and timers in a game that was about throwing a ball.

### What they would tell a friend

"It's a dumb basketball game and then the guy grows another arm." That sentence is the marketing plan. Everything in the game should protect it.

## 5. Potential, honestly

### The good news

- **Cheap to build.** One scene, three cards, simple physics (a ball on a parabola, a target region). A first playable version is weeks, not months, and most of the engineering pattern already exists in `neural-tycoon` (pure engine, balance file, simulator, Zustand store, Skia and Reanimated for effects).
- **Instantly understood.** No genre has a shorter time-to-fun.
- **One true original element** that is visual, funny and progression-relevant at once. Most games in this bracket have none.
- **A natural content treadmill** for later: sports, balls, characters, arenas. Each is a small asset, not a system.

### The bad news

- **Discovery.** Without paid user acquisition, a new game in this genre gets found by almost nobody. The publishers behind the reference screenshots spend money per install and live on margins between ad cost and ad revenue. A solo developer cannot play that game. The realistic path is organic: a store listing that reads instantly, a few short videos of the arm reveal, and luck.
- **Retention benchmarks are brutal.** Across mobile games the median day-1 retention is about 22% and day-7 about 3.5 to 4%; the top tenth of games reach about 40% day-1 and 12% day-7 (GameAnalytics 2025). Hyper-casual sits near 29% day-1 and 6% day-7 (Mistplay figures). Hybrid-casual games that make paid acquisition work are at or above 18% day-7. This game does not need those numbers to be worth making, but it needs to be built so they can be measured and improved.
- **Revenue per player is small.** In this genre most money comes from rewarded video at a few cents per view. A game with a few thousand daily players earns pocket money. It becomes a business only at scale, and scale comes from marketing, not from the game.

### What "success" should mean for version 1

Not revenue. Version 1 succeeds if:

1. It ships on the App Store (TestFlight first), on the owner's phone, through this repository's workflow, with no shortcuts.
2. Day-1 retention of real testers is above 35% and day-7 above 10%. That is top-quartile for the market and realistic for a game this immediate.
3. The arm reveal gets a reaction from people who did not know it was coming. If testers do not mention it, it is not landing and the staging needs work.
4. The pattern (engine, simulator, shared modules, design rules) is reusable for the next app in the portfolio.

If those four hold, the second version earns the right to the second layer: more sports, special balls, prestige, and a real look at marketing.

## 6. The recommendations in one place

Each of these is written up with reasoning and cost in `docs/open-decisions.md`. Nothing here is built until the owner decides.

1. **Make the target move** (per sport: sliding basket, shifting hole, drifting keeper). Highest priority. Without it the aiming line and the accuracy upgrade are decoration.
2. **Characters are global, money and upgrades per sport.** Keeps the fresh start, removes the zero-income cliff.
3. **A small, capped offline income** from version 1, because the name says idle.
4. **A round result moment** with money, hits, best round, and the upgrade cards on the same screen.
5. **A spread cone** around the aiming line as the accuracy visual, and an "about $ per round" line under each ball.
6. **First version: basketball only, 3 balls, characters with 1 and 2 arms, the 3 upgrades, one rewarded ad placement, no interstitials.** Measure. Then add.
7. **Build the simulator before balancing anything**, reusing the `neural-tycoon` approach.
8. **Expo with Skia and Reanimated, with a pure TypeScript ballistics engine.** No physics library needed for parabolas and a hit region; see the tech item in the open decisions.

## Sources

- GameAnalytics 2025 benchmarks (median and top-decile D1/D7), summarized in [Game Dev Reports: GameAnalytics mobile gaming benchmarks](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks) and [AppFollow: mobile game KPIs 2026](https://appfollow.io/blog/mobile-game-kpis)
- Hyper-casual D1/D7 figures and hybrid-casual D7 threshold: [Segwise: mobile game retention benchmarks by genre](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies.md), [Adjust Gaming App Insights Report 2026 summary](https://gamedevreports.substack.com/p/adjust-gaming-app-insights-report)
- Appodeal Mobile Casual Benchmarks Report 2025 (hybrid-casual outperforms hyper-casual on retention and revenue): [App Developer Magazine summary](https://appdevelopermagazine.com/mobile-casual-benchmarks-report-2025/)
- Comparable games: [Idle Dunk Masters](https://apps.apple.com/us/app/-/id1393830810), [All Star Basketball Challenge](https://apps.apple.com/us/app/-/id6471900802), [Idle Golf Tycoon](https://apps.apple.com/us/app/-/id1446359947), [Hyper Idle Golf](https://apps.apple.com/np/app/hyper-idle-golf/id1600884767), [Idle Dot Shooter listing](https://appgoblin.info/apps/com.infinitygames.dotcollect), [Weapon Idle](https://apps.apple.com/mt/app/weapon-idle/id6446091181)
- Expo on 2D game physics with Skia and Reanimated: [Expo blog, Matter.js and React Native Skia](https://expo.dev/blog/build-2d-game-style-physics-with-matter-js-and-react-native-skia)
