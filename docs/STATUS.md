# Status

Where the project stands and what comes next. Updated 2026-11-15.

## Done

- Design: game design (all items decided), design rules, analysis, decision log, shared-code plan.
- Repository: CI (private data scan, markdown lint, typecheck, tests), ruleset on `main`, PR template, noreply identity.
- Engine (pure TypeScript, 230 tests): ballistics with a moving target and bounces, procedural limbs, upgrades, balls, characters, trophies and mastery, live round scheduling with a per-tick cap, income estimate, offline earnings, versioned save, ads rules.
- App shell: zustand store with the 30 Hz round clock, services with Expo Go fakes, UI kit from the design rules, Skia play field with UI-thread ball playback, upgrade cards, result panel, shop sheet, offline panel, settings.
- Simulator: bot on the real engine, pacing report, pacing test in CI. First balance pass: first upgrade after round 1, ball swap at 4 min, second limb at 12 min, third at 23 min.

## Not yet done

- **Never run on a phone.** The next step is `npx expo start` and Expo Go on the owner's iPhone. Expect first-run bugs in the play field and the panels.
- Sound: `services.audio` is silent. Needs CC0 sounds per design rules section 11.
- Icon, splash and store assets: template placeholders.
- Character face expressions, limb fold-in on arrival, new-ball roll-in: not animated yet (design rules section 8 and 9).
- Football and golf: data and target branches exist; no world art, untested on the phone, not in version 1.
- Hard mode, Trophies spending UI (sport selector), mastery display: not built.
- Phase 2 services: AdMob, RevenueCat, crash reporting (needs a development build and the Apple account).
- Balance: a first pass only; the third-limb and second-sport timings miss their targets slightly, and the greedy bot overstates quiet stretches. Tune after real play.
- Follow-ups from the module agents: rolling decay for balls on the floor; Trophies for a new character; `formatUsd` for the remove-ads price; a `GameEvent` for the claimed offline double.

## How to test on the iPhone

```sh
npm install
npx expo start            # add --tunnel if the phone cannot reach the PC
```

Scan the QR code with the iPhone camera; Expo Go opens the app. Drag on the field to aim and start a round. Report what feels wrong in `docs/decisions.md` or as an issue; screenshots go into the PR that fixes them.
