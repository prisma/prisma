# Brief: D1 Round 2 — restore per-call abort context

## Task

Resolve reviewer finding F1 by threading each call's `options.signal` into both query and statistics middleware contexts, such that every middleware hook observes the identical signal supplied to the operation and in-flight `beforeExecute` work is cancelled through the existing abort race.

## Scope

**In:** `packages/1-framework/1-core/framework-components/src/execution/runtime-core.ts` and the smallest focused framework test surface needed to prove query and execute signal identity plus in-flight `beforeExecute` cancellation.

**Out:** Any other D1 cleanup, downstream family runtimes, public API reshaping, compatibility aliases, or changes to the review/spec/plan artifacts.

## Completed when

- [ ] Query and execute middleware contexts carry the exact caller-supplied signal while preserving exact-optional typing when no signal is supplied.
- [ ] Focused tests prove signal identity and `RUNTIME.ABORTED` during in-flight `beforeExecute` for both operations.
- [ ] Framework build, typecheck, test, and lint gates pass; the fix is committed with sign-off.

## Standing instruction

Stay focused on F1. If the fix requires changing the operation-result design accepted in Round 1 or touching downstream packages, halt and surface.

## Operational metadata

- **Model tier:** orchestrator — resume the existing D1 implementer context.
- **Time-box:** 30 minutes.
- **Halt conditions:** The existing context type cannot carry the signal without weakening optionality; a downstream package must change; a destructive git operation would be required.
