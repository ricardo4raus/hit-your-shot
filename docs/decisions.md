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
