# Dispatch 10: rebase and resolve conflicts

## Task

Fetch the latest `origin/main`, rebase `tml-3168-count-terminals` onto it, and resolve every conflict while preserving the approved affected-row-count and operation-specific middleware design.

## Required behavior

- Preserve row operations through `query` / `queryPrepared` and statistics operations through `execute`.
- Preserve query middleware: `beforeQuery` → `interceptQuery` → driver query → `onRow` → `afterQuery`.
- Preserve execute middleware: `beforeExecute` → `interceptExecute` → driver execute → `afterExecute`.
- Preserve shared SQL `beforeCompile`.
- Preserve exact query `{ rows }` interception and execute `{ stats }` interception.
- Do not reintroduce operation discriminators, mismatch errors, generic fallback hooks, compatibility aliases, or prepared statistics APIs.
- Preserve target count semantics: Postgres/SQLite affected rows, Mongo update `modifiedCount`, Mongo delete `deletedCount`.
- Preserve current-main changes that do not conflict with the approved slice design; integrate rather than blindly choosing either side.
- Preserve current-main Postgres transaction and cursor behavior.
- Resolve upgrade-instruction conflicts into the current `8.0.0-rc.1-to-8.0.0-rc.2` transition without duplicating or dropping unrelated mainline guidance.

## Process

1. Verify the worktree has no tracked unstaged or staged changes. Ignore the known unrelated untracked orchestration paths.
2. Fetch `origin` and record the fetched `origin/main` SHA.
3. Rebase the current branch onto `origin/main` without destructive history shortcuts.
4. Resolve conflicts semantically. Do not use blanket `ours` or `theirs` for mixed files.
5. Run conflict-marker, DCO, diff-check, and transient project-ID scans.
6. Build changed exported packages before downstream typechecks.
7. Run focused framework, SQL, Mongo, Supabase, cache, Postgres-driver, upgrade-coverage, and error-reference validation for conflicted/touched behavior, plus the smallest healthy workspace gates justified by the conflict set.
8. Do not amend, squash, add compatibility work, or make unrelated cleanup.
9. Do not push. Return the rebased HEAD and exact force-with-lease command for the orchestrator.

## Halt conditions

Stop and report if:

- tracked worktree changes exist before the rebase;
- a conflict exposes a design decision not settled by the project and slice specs;
- preserving current main requires changing the approved public API;
- validation indicates a semantic failure rather than a mechanical conflict-resolution issue;
- the expected remote branch moved after fetch in a way that invalidates the force-with-lease safety check.

## Operational metadata

- **Role variant:** `implementer/fast`
- **Model tier:** mid
- **Time-box:** 60 minutes
- **Commit:** rebase existing commits only; no amend, squash, or extra cleanup commit unless a mechanical post-rebase fix is required and separately DCO-signed
- **Push:** forbidden; orchestrator owns the authorized force-push with lease

## Return shape

Return:

1. old HEAD, fetched `origin/main`, and rebased HEAD;
2. conflicting files and semantic resolution for each;
3. any post-rebase fix commit;
4. validation commands and exact results;
5. residual risks and intentionally unrun gates;
6. no-staged/tracked-unstaged evidence;
7. expected remote branch SHA and the exact safe force-with-lease command.
