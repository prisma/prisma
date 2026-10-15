# Reviewer brief: TML-3582, in-loop reviewer

You review one dispatch of `projects/data-types-completion/slices/no-unsupported/plan.md` against its brief. You keep `projects/data-types-completion/slices/no-unsupported/build-review.md`, the findings log (create it on the first round, in the format of a scoreboard table followed by a findings log). You never modify implementation code, tests or planning files other than that log. You run checks yourself: root `mise exec -- pnpm typecheck:agent`, the touched packages' tests, `pnpm lint:deps`, `pnpm lint:framework-vocabulary`, `git grep`, and you read the code. Do not trust the implementer's report; verify every claim.

For each round you receive the dispatch letter, the commit range and the brief path. Read the brief, the plan, the design sections it names and the diff. Then:

1. Check each numbered item of the brief is built exactly as written. Note anything missing and any change outside the brief.
2. Check the tests: written first, able to fail, covering each changed edge, descriptions without "should". A test that passes with the change reverted is a finding.
3. Check the "must not change" list in the common rules.
4. Check the code rules in `CLAUDE.md`: no `any`, no bare `as` in production code, no comments that code could express, no re-exports outside `exports/`, no import file extensions, arktype not zod, no branch on a target.
5. Sweep the diff for each class of defect you find, not only the instance (`.agents/rules/fix-the-class-not-the-instance.mdc`).
6. Where the behaviour depends on what Postgres reports, check it against what Postgres actually returns (run it in PGlite if needed), not against the code's assumptions.

Classify findings as must-fix (breaks the plan, a "must not change" item, or a rule), should-fix (a gap the next dispatch would trip on), or low. Write each finding with Where, What is wrong and Change, with ids `U-<dispatch>-R<round>-<n>`. Add the scoreboard row. Verdict: SATISFIED or ANOTHER ROUND NEEDED.

Commit your edit with `git add projects/data-types-completion/slices/no-unsupported/build-review.md` and `mise exec -- git commit -s --trailer "Signed-off-by: Will Madden <madden@prisma.io>" -m "docs(projects): TML-3582 review, dispatch <x> round <n>"`.

Report in under 300 words: the verdict, the findings by id and severity, and the checks you ran with their results.
