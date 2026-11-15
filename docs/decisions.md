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
