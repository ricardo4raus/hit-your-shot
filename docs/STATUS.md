# Status

Where the project stands and what comes next. Updated 2026-11-16.

## Done

- Design: game design (all items decided), design rules, analysis, decision log, shared-code plan.
- Repository: CI (private data scan, markdown lint, typecheck, tests), ruleset on `main`, PR template, noreply identity.
- Engine (pure TypeScript, 244 tests): third-person world (depth, height, lateral), yaw aim with a solved pitch, a cone spread, a sliding
  hoop as a ring with a backboard, side walls, convergent limbs, procedural limbs, upgrades, balls, characters, trophies and mastery, live
  round scheduling with a per-tick cap, income estimate that tracks the target, offline earnings, versioned save, ads rules.
- App shell: zustand store with the 30 Hz round clock, services with Expo Go fakes, UI kit from the design rules, full-screen Skia play
  field seen from behind the character with UI-thread ball playback in depth groups, upgrade cards that leave during a round, the play
  button with the last result above the cards, shop sheet, offline panel, settings.
- Phone tests: 2026-11-15 (aiming and shooting work; balls were invisible, fixed), 2026-11-16 (balls visible; the owner asked for the
  third-person view and the new round flow, both built the same day).

## Not yet done

- **Third phone test** of the third-person build: readability of the small basket, the aim line on the floor, the feel of the lob, the
  cards sliding away and back, the play button.
- **Pacing simulator and balance.** PR 16 (simulator, pacing test, first balance pass) was closed on 2026-11-15 and never merged; the
  numbers on `main` are the first guesses from the contract PR. The simulator comes back in a separate PR adapted to the yaw aim
  (`predictYaw`), then the balance is tuned against `docs/analysis.md`. Known from a quick probe on the new engine: the foam ball lands
  about 37% at accuracy 0 and 98% at level 20; the medicine ball tops out near 37% because of its 7° penalty; in football the keeper
  blocks about a third of everything and accuracy barely matters (the goal is wide); in golf a flat shot rolls past the hole below
  accuracy 20. Football and golf are not in version 1.
- Sound: `services.audio` is silent. Needs CC0 sounds per design rules section 11.
- Icon, splash and store assets: template placeholders.
- Character: no shooting animation yet (anticipation, release, settle), no breathing, no face (the face shows when the character looks
  over its shoulder; not built), no limb fold-in on arrival, no new-ball roll-in (design rules sections 8 and 9).
- Football and golf: data, target branches and simple drawings exist; untested on the phone, not in version 1.
- Hard mode, Trophies spending UI (sport selector), mastery display: not built.
- Phase 2 services: AdMob, RevenueCat, crash reporting (needs a development build and the Apple account).
- Follow-ups from the module agents: rolling decay for balls on the floor; Trophies for a new character; `formatUsd` for the remove-ads
  price; a `GameEvent` for the claimed offline double.

## How to test on the iPhone

```sh
npm install
npx expo start            # add --tunnel if the phone cannot reach the PC
```

Scan the QR code with the iPhone camera; Expo Go opens the app. Drag left or right on the field to aim; press Play to start a round.
Report what feels wrong in `docs/decisions.md` or as an issue; screenshots go into the PR that fixes them.
