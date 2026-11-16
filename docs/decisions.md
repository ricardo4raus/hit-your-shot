# Decision Log

Owner decisions and the reasons, newest first. When an item is decided it also moves from Part 2 to Part 1 of `docs/game-design.md`.

## 2026-11-15

| Decision | Reason / note |
|---|---|
| Name is final: **Hit Your Shot: Idle Sports**. Domain `.app` or `.io`. | Web search found no exact App Store match; `.com` is taken. Registrar, App Store Connect, trademark and handle checks still to do before the first TestFlight build. |
| **The target moves** in every sport. **Obstacles only in hard mode**, never in the normal loop. | Keeps aiming meaningful every round; keeps the casual loop clean. |
| **Characters are per sport**, not global. | Each sport has its own limb line (arms or feet), so a global character made no sense. New sport starts at one limb. |
| **Trophies** are the sport-unlock currency. | A small global currency earned at milestones in every sport; buys nothing else in version 1. |
| **Small, capped offline earnings** in version 1. | The name says Idle; players expect a welcome-back screen. |
| **Tech: Expo, Skia, Reanimated, Zustand, pure TypeScript engine, Jest, simulator. No physics library in version 1.** | Reasoning in `docs/open-decisions.md` item 14. The owner asked why no physics library; answered there. |
| **Version 1 scope** as proposed in `docs/open-decisions.md` item 13. | Basketball only, 3 balls, 1 and 2 arms, 3 upgrades, spread cone, sliding basket, result panel, offline earnings, two rewarded placements, remove-ads purchase, no interstitials. |
| **Every sport starts with one limb of the kind the sport uses**: one arm in basketball and golf, one foot in football. More characters add more of that limb. | Owner addition. The feet make football its own gag. |

## 2026-11-15, round 2

| Decision | Reason / note |
|---|---|
| All remaining proposals accepted: round 10 s; football then golf; mastery bonus +10% per maxed sport; hard mode at mastery, ×3; limb spacing 0.35 × target width; "about $X per round" ball line; remove-ads around $2.99 and ×2 every third round; video ads may show the reveal; domain `hityourshot.app`. | Owner: "go with all your proposals". |
| **No cap on limbs. Limbs are procedural.** An algorithm attaches each new limb so it looks roughly natural; no new art per limb. | Owner wants to scale the count without designing more limbs. Soft performance cap in `balance.json`, raised as devices prove it. |
| **Extreme ball volume is supported.** Many limbs × high fire rate × light ball = hundreds of balls in flight, spreading, bouncing off rim, board, floor and walls. | Owner: must work even when it is not the best way to play. Drives the renderer (one Skia atlas draw, pooled balls) and the engine (cheap per-shot resolution, trajectory as segments). |
| **Code starts.** | All items decided. |

### Why a mobile app needs a domain

- **App Store and Google Play require a privacy policy URL** on the listing, and Apple also wants a support URL. Both must be hosted somewhere. A GitHub Pages address works, but it carries the GitHub handle and the repository name; a domain reads as a product.
- **Support contact.** App Store Connect asks for a support e-mail that is shown to users. With a domain it is `support@` the domain, not a personal mailbox. That is also the owner's privacy rule in practice.
- **Ads and consent.** AdMob's consent form and the Play Store "Data safety" section link to the same privacy policy page.
- **Name protection.** Once the game is in the stores, the domain is the first thing a copycat registers.
- **Later:** universal links (open the app from a shared link), a one-page site for videos, and a press page. All need the domain to exist first.
- Cost: roughly $15 to $20 a year for `.app` (always HTTPS, enforced by the registry, which the stores like).

## 2026-11-15, lead decisions while building (owner may overrule)

| Decision | Reason / note |
|---|---|
| Hoop window widened: ball radius 0.09 m (foam 0.9×, regulation 1.0×, medicine 1.1×), hoop half width 0.26 m, muzzle spacing 0.08 × target width, group span at most 0.10 × field width. | With the first numbers only the center limbs could ever score at perfect aim, so accuracy was worthless and extra limbs added nothing. Found by the simulator. |
| The income estimate aims each sample where the target will be (tracking) and uses 64 samples. | With a fixed aim at the mean position, the estimate credited misses to the target motion instead of the spread; with 24 samples it was ±50% at low hit rates. |
| Upgrade effects per level: accuracy ×0.8 spread, fire rate +8%, income +15%; costs 12 × 1.25 to 1.3^level; characters 15000 × 5.5^(n−2); balls 0 / 500 / 6000; Trophies every 5 levels; football at 19 Trophies, golf at 45. | First simulator pass against the pacing targets in `docs/analysis.md`. See `docs/pacing-report.md`. |
| The greedy bot's quiet-stretch target is reported but not asserted in CI. | The bot saves every coin for the next limb; a player buys small things meanwhile. |

## 2026-11-15, first phone test (owner)

| Decision | Reason / note |
|---|---|
| **Buying only between rounds.** Upgrade, ball and character purchases are refused while a round plays; the buttons are disabled. | Owner: "each round it shoots the balls, and when the round ends I upgrade". |
| **No drop shadow on interface elements.** Every outline the same width on every side. Press feedback is a small scale. | Owner: the hard shadow under buttons read as a thicker bottom line. |
| Settings button in the top right corner, not centered. | Bug in the first top bar layout. |
| Art sources: code and hand SVG first, CC0 packs (Kenney) for props, AI tools (Recraft, Firefly) only for concepts and always redrawn. | Owner asked where models and ball designs come from. See `docs/design-rules.md` section 15. |

Bug found on the phone: balls were invisible. The ball layer used a Skia `Atlas` fed from an offscreen sprite surface, which did not render in Expo Go on iOS. Replaced by one path of circles rebuilt on the UI thread per frame (ink stroke under the fill), with plain arrays crossing to the UI thread.

## 2026-11-16, second phone test (owner)

| Decision | Reason / note |
|---|---|
| **Third-person view.** The field is seen from behind the character, like the first reference screenshot: character big in the lower middle, target ahead and small, balls fly into the picture. | Owner: "what I actually wanted is a character shooting the balls from third person view, similar to that picture". Replaces the side view of the first build. |
| **Cards disappear during a round.** They slide away when the round starts and come back when it ends. | Owner: "while in a round the upgrade buttons should disappear". |
| **No result card.** When the round ends the character stops shooting, the cards come back, and one play button appears centered above them. | Owner: "no card pops up, just the character doesn't shoot anymore and the upgrade buttons pop up. Then above the upgrade buttons, centered, ... a button that lets you play the round again". The round's money and the commentator line stand over the button without a panel. |

Verified on the owner's phone before this change: balls visible with outlines (fix of 2026-11-15 works).

## 2026-11-16, lead decisions for the third-person build (owner may overrule)

| Decision | Reason / note |
|---|---|
| The player aims **sideways only** (a yaw); the engine solves the launch power and height for the sport's arc. | From behind, up and down on the screen is depth, which a finger cannot judge. Tracking the sliding basket is the skill; power errors come from the spread. |
| The spread is a **cone**: the same accuracy number scatters shots left/right and short/long. | One number, one visible cone on the floor. The basketball launch speed sits just above the slowest speed that reaches the hoop, which makes the lob forgiving in power and keeps it on screen. |
| Limbs **converge on the aim point** instead of shooting parallel. | Seen from behind, parallel shots from a limb 0.2 m off the center line miss a 0.46 m basket almost always, so a second character would have been a second miss. Convergent, every limb is a full extra shooter, which is what the design wants ("a big fire-rate boost"). |
| The hoop stands at 6.5 m depth (4 m from the character) instead of 8 m; the hoop slides sideways ±1 m. | At 8 m the basket is a dot on a phone from behind. 4 m is a long mid-range shot and the basket reads. |
| Side walls at ±4 m (basketball), ±6 m (football, golf). Wild shots bounce back into the picture. | Owner (round 2): balls should go everywhere and bounce. |
| Camera: 2.4 m behind the character, 1.5 m high, horizon at 48% of the height, focal length 0.8 × height. | The character spans about 60% of the height, the lob's apex stays under the money pill, the backboard clears the top bar. Numbers in `src/features/play/camera.ts`. |
| The pacing simulator of PR 16 was never merged (the PR was closed on 2026-11-15); the balance numbers and pacing report it produced are not on `main`. | Found while preparing this change. It comes back in a separate PR, adapted to the yaw aim, and the balance is tuned again then. `docs/STATUS.md` says so. |

## 2026-11-16, lead balance decisions with the simulator (owner may overrule)

| Decision | Reason / note |
|---|---|
| The simulator of the closed PR 16 is back, with the bot aiming a yaw through `predictYaw`. `npm run simulate` writes `docs/pacing-report.md`; the pacing test asserts the early targets in CI. | Tuning by hand against the third-person engine would be guesswork. |
| Numbers from PR 16 kept: upgrades to level 60 from $12 (accuracy ×1.25, fire rate and income ×1.3 per level; accuracy ×0.8 spread, fire rate +8%, income +15% per level); trainers $15,000 × 5.5 per extra limb; balls $0 / $500 / $6,000 worth $3 / $10 / $40 with 0° / 2° / 5° penalties; Trophies every 5 levels, 1 per new ball, best-round decades from $1,000; football at 19 Trophies, golf at 45. | On the new engine they meet every pacing target of `docs/analysis.md` except the bot's quiet stretch: first upgrade 14 s, ball swap 4.1 min, second limb 14.8 min, third 26.1 min, second sport 65.9 min (medians over 6 seeds). |
| Ball radius 0.12 m and hoop radius 0.23 m stay (PR 16 had widened them for parallel limbs). | Limbs converge now, so the outer limbs do not need a wider hoop; real proportions read better from behind. |

## 2026-11-16, third phone test (owner)

| Decision | Reason / note |
|---|---|
| **Bigger basket.** Hoop radius 0.23 m → 0.32 m, ball radius 0.12 m → 0.10 m, rail swing 4.5 s → 5.5 s. | Owner: "too difficult to hit a shot". With a thumb's aim error of about ±8°, the foam ball now lands about half the time at accuracy 0 and three quarters at level 10 (was a fifth and 40%). |
| **The aim line is the flight arc**, not a line on the floor: the arc a perfect ball flies from the hand to the aim point, with the spread's two edges as thin arcs beside it. | Owner: "the aim line should show the fly line of the ball ... the perfect way a ball would go". |
| Costs re-tuned for the easier basket: balls $1,200 / $15,000, trainers from $50,000, best-round decades from $3,000, football at 22 Trophies and golf at 50. | The wider hoop doubled early income; the simulator put the second trainer at 7.5 min and the second sport at 16 min. After the re-tune every target but the bot's quiet stretch is met again; see `docs/pacing-report.md`. |
| Art tools: Higgsfield is for the store video and ads, not for in-game art; Recraft or Illustrator/Firefly for native SVG; Kenney for props; code for everything round. | Owner asked "Higgsfield or other tools". Section 15 of `docs/design-rules.md` updated. |

## 2026-11-16, lead decisions from the first screenshots (owner may overrule)

| Decision | Reason / note |
|---|---|
| A **screenshot tool** (`npm run screenshot`): web export, headless Chrome at 375 × 812, PNGs into `screenshots/`, the chosen ones committed to `docs/screenshots/` with each UI PR. | The owner agreed (2026-11-16) that the lead needs to see the game before shipping; so far every look came from the owner's phone. |
| Camera moved **behind the right shoulder** (0.9 m to the right, 3 m back, 1.5 m high, turned to look at the target). Character left of center, target on the center line. | From dead behind, the shooting hand was behind the head and the arc a vertical line. |
| **Release height 2.0 m** (was 1.6 m, chest). | The arc now starts above the head, where a set shot leaves the hands, instead of out of the back of the skull. Launch speeds follow. |
| The commentator's line sits in a paper **pill**, like the money counter. | Plain ink text over the character's shirt was unreadable. A pill is not a panel. |
