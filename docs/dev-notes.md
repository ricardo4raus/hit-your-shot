# Hit Your Shot: Developer Notes

How work gets done in this repository. For people and AI agents.

## Ground rules (set by the owner)

1. **No direct commits to `main`.** Every change goes through a branch and a pull request. A ruleset on GitHub enforces this, including for the repository owner.
2. **No merge without green CI.** The `ci` check is required. It runs the private data scan, markdown lint, and, once the Expo project exists, `npm run typecheck` and `npm test`.
3. **Small commits.** One step per commit, with a message that says what and why. Several small PRs beat one big one.
4. **No personal data in the repository.** No real names, e-mail addresses, phone numbers or user-profile paths, in files or in commit metadata. Commit as the GitHub handle with the GitHub `noreply` e-mail (see below). CI fails on e-mail addresses and user paths.
5. **Build only Part 1 of `docs/game-design.md`.** Open items (Part 2) get a written proposal in `docs/open-decisions.md`, and the owner decides. Nothing from Part 2 is built before that.
6. **Multiple agents are welcome**, each on its own branch and its own files. The lead merges and resolves seams. Contract files (types, balance schema, store, services, app layout) change only through the lead.
7. **Research before inventing.** When a library, pattern or store rule is involved, check the current docs first (Expo changes every SDK). Prefer the simplest thing that is standard.

## Git identity (do this once per clone)

```sh
git config user.name "<github-handle>"
git config user.email "<github-id>+<github-handle>@users.noreply.github.com"
```

The numeric id is on `https://api.github.com/users/<github-handle>`. Commits made by an AI assistant end with its co-author trailer, which also uses a `noreply` address.

## Branch names

| Prefix | Use |
|---|---|
| `docs/` | design, analysis, decisions |
| `feat/` | a feature from Part 1 |
| `fix/` | a bug |
| `chore/` | tooling, CI, dependencies |
| `balance/` | number changes in `balance/` |

Delete branches after merging.

## Pull requests

- Fill in the template: what, why, checks.
- A PR that changes UI includes a screenshot (phone, portrait) and confirms the checklist at the end of `docs/design-rules.md`.
- A PR that changes a game number includes the simulator result (once the simulator exists).
- Merge with a merge commit (keeps the small steps), not squash.

## Commands

No code yet. When the Expo project lands, this section gets: install, start (Expo Go on the iPhone), test, typecheck, simulate. Until then:

```sh
bash tools/check-private-data.sh                       # the same scan CI runs
npx --yes markdownlint-cli2@0.17.2 "**/*.md" "#node_modules"   # the same lint CI runs
```

## Where things go

```
hit-your-shot/
  CLAUDE.md        rules and context for AI assistants (short; points at docs)
  docs/            game design, analysis, decisions, design rules, dev notes
  balance/         every game number, one JSON file (when code starts)
  tools/           scripts: private data scan, later the pacing simulator
  src/             the Expo project (when code starts)
  .github/         CI workflow and PR template
```

Shared code for all apps in the portfolio lives in `../_shared/` later; see `docs/shared-code.md` for the plan and the candidates.
