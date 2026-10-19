# Deferred work

Work found during the project and left for later, with why.

## Import cycle between the Postgres planner modules

`packages/3-targets/3-targets/postgres/src/core/migrations/issue-planner.ts` imports `planner-strategies.ts`, which imports `primary-key-change.ts`, which imports `issue-planner.ts` (for `emissionSchemaName`, `fkSpecFromNode` and the issue path helpers). `planner-strategies.ts` already imported `issue-planner.ts` before slice 8; slice 8 adds a third module to the cycle. It works because only functions cross it, and they are called after every module has loaded. Fix: move the shared helpers into a small module that `issue-planner.ts`, `planner-strategies.ts` and `primary-key-change.ts` all import.

## `StrategyContext.schema` could come from `startTree`

`StrategyContext.schema` is one namespace node of the start tree, picked by `relationalNamespaceNode` in `planner.ts`. Since slice 8 the context also carries the whole `startTree`, so `schema` could be derived from it instead of being passed separately.

## A primary key cannot move while an implicit many-to-many junction references it

Found in manual QA of slice 8. When a model takes part in an implicit many-to-many relation, moving its primary key to a composite key (for example `@@id([id, email])` with `id @unique`) makes `contract emit` refuse with `PSL_JUNCTION_TARGET_FK_NOT_ID`: the junction's foreign key to that model must reference the model's full `@id` columns. The diagnostic is raised in `packages/2-sql/2-authoring/contract-psl/src/psl-relation-resolution.ts`, and the Prisma 7 reader passes it through (`packages/2-sql/2-authoring/contract-prisma7/src/relations.ts`). Whether Prisma 7 allows this change was not checked. Supporting it needs a design decision about junctions whose target key is not the model's `@id`.
