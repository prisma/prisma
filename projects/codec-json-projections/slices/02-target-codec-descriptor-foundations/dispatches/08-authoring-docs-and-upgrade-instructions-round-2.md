# Brief: D8 authoring docs and upgrade instructions — round 2

## Task

Unblock the isolated extension replay by correcting the six pgvector test-created `CodecRef`s that omit the descriptor’s existing required `length` parameter, then complete D8 from the preserved documentation and upgrade-entry edits. The fixture correction is a prior-dispatch escapee discovered by a clean target build; it must be a separate signed-off test-only commit. The extension-author upgrade entry must explicitly instruct authors to update parameterized codec refs and test fixtures so every required descriptor parameter is present, then the replay must be rebuilt and pass from the pre-TML-3061 substrate.

## Scope

**In:** Exactly the failing pgvector test refs identified by the replay, using `typeParams: { length: 3 }` consistent with each test’s vector shape; one test-only signed-off correction commit; preserving and finishing the six existing D8 docs/upgrade files; actionable upgrade prose for required parameterized refs; isolated replay reconstruction and full D8 gates.

**Out:** Relaxing pgvector’s required parameter schema; inventing an unparameterized vector variant; production extension/runtime changes; unrelated test cleanup; adding the repository replay harness as a production dependency; changing codec JSON, SQL, or application types; user-facing upgrade entry; prototype/stash operations.

## Completed when

- [ ] The six previously failing pgvector test ref constructions provide `length: 3`, pgvector tests pass after a clean target build, and the correction is isolated in one signed-off test-only commit.
- [ ] The extension-author entry tells downstream authors to migrate parameterized `CodecRef` construction/tests with every required target descriptor parameter; prose remains actionable and accurately covers the D5 migration.
- [ ] A fresh isolated replay starts from commit `4557df26d9514ecb5afe8d9de4abe207df8c186b` for `packages/3-extensions/`, applies every production/source/manifest/test action in the entry, accounts explicitly for repository-specific adoption tests as the replay verification harness, matches the branch substrate, and passes `pnpm test --filter='./packages/3-extensions/*'` after clean target artifacts.
- [ ] All original D8 gates pass; the six D8 documentation/upgrade files are explicitly staged in a second signed-off commit with no amend/push/rebase/stash.

## Standing instruction

Preserve the existing unstaged D8 edits. Do not conflate the test-fixture correction with documentation in one commit. Required vector parameters are established behavior, so repair the invalid call sites rather than weakening validation. If any failure remains after these exact fixtures are corrected, stop and report the new evidence instead of broadening scope.

## Operational metadata

- **Model tier:** persistent implementer/thorough — isolated replay and upgrade semantics remain cross-surface work.
- **Time-box:** 60 minutes wall clock.
- **Halt conditions:** A production change becomes necessary; vector length semantics are ambiguous in an affected test; replay remains red for a different reason; actionable substrate cannot match without no-op consumer prose; any destructive Git or `git stash*` action.
- **Harness constraint:** Built-in search/grep/glob/find-path tools are forbidden. Use bounded terminal/bash `rg` and targeted `sed`/`cat` only.
