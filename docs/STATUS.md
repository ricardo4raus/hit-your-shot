# Status

Where the project stands and what comes next. Updated 2026-11-22.

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
- Character rig (`src/features/play/rig.ts`, 24 tests): skeleton with two-bone IK for legs and any number of arms, the shot cycle
  (dip, rise, flick, follow-through, return) per arm on its own fire schedule, squeezed at high fire rates, knees following the deepest
  dip, breath when idle, the ball in the hands until the release.
- Screenshot tool (`npm run screenshot`): exports the web build, opens it in headless Chrome at phone size and writes PNGs of idle,
  aiming, the first shots, mid-round and the result. The lead now sees the game before the owner does. The web build runs the real app
  (CanvasKit for Skia, localStorage for the save).
- Hit feedback (2026-11-19): net swish, rim ring and the money pill's pop. Money everywhere as the green coin plus digits.
- **Visual overhaul (2026-11-22, `docs/decisions.md`):** "polished arcade" art direction. The play field is split into layer files
  (`src/features/play/layers/`), one owner each. Full arena, stadium and course; hoop, goal and hole redrawn; character in a shaded
  basketball kit with squash and stretch; balls with tones, seams, trails and fire on streaks; flowing-dot aim guide; hit flash,
  sparks, confetti, popup words, streak shake (no rising coin); 3D UI with Lilita labels, navy tray, new card icons; telephoto camera.
- **Ad offers (2026-11-22, `docs/decisions.md`):** offer cards pop in on the left between rounds and stack from the top; each ad adds
  10 minutes of ×2 income up to 2 hours, with a countdown pill; the offline double waits there too. The ×2 button by the play button is
  gone, and the play button grows with "PLAY AGAIN". Save version 2.
- **Sound (2026-11-22):** 10 synthesized effects (`npm run sfx` writes `assets/sfx/`), expo-audio service with player pools and rate
  limits, sounds timed to the balls on screen (`src/features/play/useShotSounds.ts`), crowd cheer on streaks.
- Phone tests: 2026-11-15 (aiming and shooting work; balls were invisible, fixed), 2026-11-16 morning (balls visible; the owner asked
  for the third-person view and the new round flow, both built the same day), 2026-11-16 afternoon (third-person works; basket too hard
  to hit, aim line wanted as the flight arc; both done).

## Not yet done

- **Phone test of the visual overhaul**: frame rate in Expo Go with the arena, the crowd and the hit effects; how the synthesized
  sounds sound; whether the first sound lags while the players load.
- Balance: tuned with the simulator's greedy bot, not with people. The bot's quiet stretches (17 min without a purchase while it
  saves for a trainer) overstate a player's. Known from a probe on the new engine: in football the keeper blocks about a third of
  everything and accuracy barely matters (the goal is wide); in golf a flat shot rolls past the hole below accuracy 20. Football and
  golf are not in version 1. Tune again after real play.
- Sound: synthesized placeholders; golf and football have no surface sounds of their own (walls and ceiling use the floor sound).
  Audio cheers (landing order) and popup streak words (firing order) count streaks separately.
- Icon, splash and store assets: template placeholders.
- Character: rig with knees, elbows, wrists and the shot cycle is in (2026-11-16); still missing: the face (shows when the character
  looks over its shoulder), the strain face and longer dip for heavy balls, limb fold-in on arrival, the new-ball roll-in, the football
  kick cycle (feet use the arm cycle for now) (design rules sections 8 and 9).
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
