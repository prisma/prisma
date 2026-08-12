# Dispatch 9 round 2: correct middleware documentation

## Task

Address reviewer finding F1 from D9 round 1 without changing the approved implementation design.

## Finding

**F1 — must-fix:** `packages/3-extensions/middleware-cache/README.md` still documents removed generic middleware vocabulary, including `intercept`, row execution through `runtime.execute`, and completion through `afterExecute`. Public framework JSDoc in `runtime-middleware.ts` and `runtime-core.ts` also retains generic or execute-only lifecycle wording.

## Required resolution

- Update cache README references to `interceptQuery`, `query`, and `afterQuery` where they describe row caching.
- Correct framework middleware and runtime-core JSDoc so it accurately describes the operation-specific query and execute lifecycles.
- Search touched public documentation and JSDoc for equivalent stale generic hook or row-`execute` wording and correct only confirmed instances.
- Do not alter runtime behavior, public types, tests, upgrade semantics, or the approved hook design.
- Run focused Markdown/source lint or formatting checks plus the relevant documentation vocabulary scans.
- Commit with explicit staging and DCO sign-off. No amend and no push.

## Completed when

- F1's cited stale references are gone.
- Public documentation reads consistently with the amended spec.
- No implementation code behavior changes.
- Focused checks pass and no staged files remain.

## Operational metadata

- **Role variant:** `implementer/fast`
- **Model tier:** mid
- **Time-box:** 20 minutes
- **Commit:** required, DCO sign-off, explicit staging, no amend, no push
