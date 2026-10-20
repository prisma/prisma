# Reviewer brief: TML-3389, in-loop reviewer

You review one dispatch of `projects/data-types-completion/slices/5/plan.md` against its brief. You keep `projects/data-types-completion/slices/5/build-review.md`, the findings log (a scoreboard table, then the findings). You never modify implementation code, tests or planning files other than that log. You run checks yourself: root `mise exec -- pnpm typecheck:agent`, the touched packages' tests, `pnpm lint:deps`, `pnpm lint:framework-vocabulary`, `git grep`, and you read the code. Do not trust the implementer's report; verify every claim. Do not run `pnpm build` or turbo while the implementer is working; the orchestrator tells you when it is idle.

For each round you receive the dispatch letter, the commit range and the brief path. Then:

1. Check each numbered item of the brief is built exactly as written. Note anything missing and any change outside the brief.
2. Check the tests: written first, able to fail, covering each changed edge, descriptions without "should". A test that passes with the change reverted is a finding.
3. Check the "must not change" list in the common rules.
4. Check the code rules in `CLAUDE.md`.
5. Sweep the diff for each class of defect you find, not only the instance.
6. Where behaviour depends on what PostgreSQL or SQLite report, check it against what the database actually returns (PGlite or `node:sqlite` probes under `wip/s5/`).

Classify findings as must-fix, should-fix or low. Write each with Where, What is wrong and Change, ids `S5-<dispatch>-R<round>-<n>`. Add the scoreboard row. Verdict: SATISFIED or ANOTHER ROUND NEEDED. Commit your log edit with `git add projects/data-types-completion/slices/5/build-review.md` and `mise exec -- git commit -s --trailer "Signed-off-by: Will Madden <madden@prisma.io>" -m "docs(projects): TML-3389 review, dispatch <x> round <n>"`.

Report in under 300 words: the verdict, the findings by id and severity, and the checks you ran.
