# Deferred work

Work found during the project and left for later, with why.

## Import cycle between the Postgres planner modules

`packages/3-targets/3-targets/postgres/src/core/migrations/issue-planner.ts` imports `planner-strategies.ts`, which imports `primary-key-change.ts`, which imports `issue-planner.ts` (for `emissionSchemaName`, `fkSpecFromNode` and the issue path helpers). `planner-strategies.ts` already imported `issue-planner.ts` before slice 8; slice 8 adds a third module to the cycle. It works because only functions cross it, and they are called after every module has loaded. Fix: move the shared helpers into a small module that `issue-planner.ts`, `planner-strategies.ts` and `primary-key-change.ts` all import.

## `StrategyContext.schema` could come from `startTree`

`StrategyContext.schema` is one namespace node of the start tree, picked by `relationalNamespaceNode` in `planner.ts`. Since slice 8 the context also carries the whole `startTree`, so `schema` could be derived from it instead of being passed separately.
