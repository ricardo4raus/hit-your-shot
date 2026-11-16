# Hit Your Shot: Idle Sports

Mobile sports shooter with idle/upgrade progression: aim a shooting line, shoot balls at a hole, basket or goal in short timed rounds, earn money per hit, upgrade accuracy, fire rate and income. Unlock more sports, heavier balls and characters with more arms. **iPhone first, then Android.** Built on Windows without a Mac: Expo Go on the phone, cloud builds with EAS.

Status: engine, store, play field and panels built and tested; two phone tests done (2026-11-15, 2026-11-16); the view is third person since 2026-11-16. See `docs/STATUS.md`.

## Key files

- `docs/game-design.md`: the game. Part 1 is approved by the owner. Part 2 lists open decisions.
- `docs/design-rules.md`: **art direction, interface, motion and writing voice. Read before any UI, asset or text work.** Ends with the checklist every UI PR runs.
- `docs/analysis.md`: the idea through a designer's, a loop expert's and a casual player's eyes; benchmarks and pacing targets.
- `docs/open-decisions.md`: one proposal per open item in Part 2, with reasons and cost. The owner decides; nothing there is built before that.
- `docs/shared-code.md`: what can be reused from `../neural-tycoon` and how shared code for all apps should work.
- `docs/decisions.md`: owner decisions with dates and reasons. Add a row for every new decision.
- `docs/STATUS.md`: where the project stands and what comes next. Update it when something lands.
- `docs/architecture.md`: layers, contracts, shot resolution, the live round, agent workflow. Read before writing code.
- `docs/pacing-report.md`: output of `npm run simulate`. Regenerate after any balance change.
- `docs/dev-notes.md`: branches, PRs, CI, commit identity, where files go.

## Rules

- Build only what is in Part 1 of `docs/game-design.md`. Ask the owner before building anything from Part 2. When the owner decides an open item, move it from Part 2 to Part 1 and note the date.
- Never mention the multi-arm characters in the game name, icon or first store screenshot. They are a surprise. In the game they are never announced; see `docs/design-rules.md` section 8.
- Every screen, asset and line of player-facing text follows `docs/design-rules.md`. A UI PR includes a screenshot and the section 12 checklist.
- No direct commits to `main`. Branch, pull request, green CI, merge commit. Small commits. Details in `docs/dev-notes.md`.
- No personal data in this repository: no real names, e-mail addresses, phone numbers or user-profile paths, in files or commit metadata. Commit with the GitHub `noreply` address. CI scans for this.
- Follow the portfolio layout in `../README.md` (docs/, balance/, tools/, src/). Shared code goes in `../_shared/` later; never change `../neural-tycoon` without the owner's permission.
- Every game number lives in `balance/balance.json` and is read through `src/engine/balance.ts`. The engine (`src/engine/`) is pure TypeScript: no React, no `Date.now()`, no `Math.random()`. After any balance change run `npm run simulate` and `npm test` (the pacing test judges the early targets).
- Contract files change only through the lead: `src/engine/types.ts`, `balance.ts`, `state.ts`, `rng.ts`, `num.ts`, `testing.ts`, `index.ts`; `src/store/*`, `src/services/*`, `src/app/_layout.tsx`, `app.json`, `package.json`, `balance/balance.json`.
- Research current docs before adding a library (Expo changes every SDK). Prefer the simplest standard thing.
