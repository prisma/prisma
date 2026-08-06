# Dispatch plan — 1b control-client seam (TML-3173)

Design is fully decided ([design.md](./design.md), ACCEPTED); dispatches carry zero design freedom.

| # | Dispatch | Outcome | Builds on | Hands to |
| --- | --- | --- | --- | --- |
| 1 | Implement | The design executed exactly, tests-first per design §5.4, on branch `tml-3173-cli-control-client-seam`; all gates green (`@internal/cli` build+test, integration suites, `lint:deps` with the new rule, `lint:casts`); commits per repo commit conventions. | design.md | committed branch |
| 2 | Review | Independent review of the diff against design.md — faithfulness (byte-identical behavior pins, no design deviations), repo-rule compliance, test adequacy. Findings list or clean bill. | dispatch 1's branch | rework (dispatch 1 re-entry) or PR-open |
| 3 | PR open | PR against `main` titled per repo convention with `(TML-3173)`, decision-led body, branch pushed via bot remote. | clean review | merge (operator) |

Single implement dispatch: the work is one outcome ("no runtime migration-tools import under src/commands, enforced by lint, behavior byte-identical") — large but mechanical, with the design enumerating every file. Failure-mode dispositions: destructive git operations forbidden; any design-vs-reality contradiction stops the dispatch and returns to the orchestrator instead of improvising.
