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
- Simulator (`npm run simulate`): a bot on the real engine with the yaw aim, pacing report, pacing test in CI. Balance tuned on the
  third-person engine (2026-11-16): first upgrade after round 1, ball swap at 4 min, second limb at 15 min, third at 26 min, second
  sport at 66 min. See `docs/pacing-report.md`.
- Phone tests: 2026-11-15 (aiming and shooting work; balls were invisible, fixed), 2026-11-16 (balls visible; the owner asked for the
  third-person view and the new round flow, both built the same day).

## Not yet done

- **Third phone test** of the third-person build: readability of the small basket, the aim line on the floor, the feel of the lob, the
  cards sliding away and back, the play button.
- Balance: tuned with the simulator's greedy bot, not with people. The bot's quiet stretches (17 min without a purchase while it
  saves for a trainer) overstate a player's. Known from a probe on the new engine: in football the keeper blocks about a third of
  everything and accuracy barely matters (the goal is wide); in golf a flat shot rolls past the hole below accuracy 20. Football and
  golf are not in version 1. Tune again after real play.
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
