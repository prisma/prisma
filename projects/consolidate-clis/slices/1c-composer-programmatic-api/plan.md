# Dispatch plan — 1c composer programmatic API (TML-3174)

Design is fully decided ([design.md](./design.md), ACCEPTED); dispatches carry zero design freedom. Repo: prisma/composer (working clone `wip/repos/composer`). PR targets composer `main`.

| # | Dispatch | Outcome | Builds on | Hands to |
| --- | --- | --- | --- | --- |
| 1 | Implement | The design executed exactly in sequence §8, tests-first, on branch `tml-3174-composer-programmatic-deploy-api`; all gates green (package tests, `run.test.ts` unmodified and green, `lint:deps`, cast ratchet, both exports maps committed); includes the ADR (ruled in-scope) and the guide/SKILL updates. | design.md | committed branch |
| 2 | Review | Independent review of the diff against design.md — faithfulness (run.test.ts untouched, console strings relocated verbatim, static-graph import-safety of `./control`), repo-rule compliance, test adequacy. | dispatch 1's branch | rework or PR-open |
| 3 | PR open | PR against composer `main` titled per composer convention with `(TML-3174)`, branch pushed via bot remote. | clean review | merge (operator + Terminal reviewer) |

Single implement dispatch: one outcome ("typed deploy/destroy/dev/log operations exist and the CLI consumes them, e2e green"). Failure-mode dispositions: destructive git operations forbidden; design-vs-reality contradictions stop and return to the orchestrator; the e2e-deploy workflow (real cloud) is NOT run by the dispatch — CI covers it at PR time.
