# Dispatch e: journeys and docs

Read `common-rules.md` first.

## Build

1. PGlite round trip in `test/integration` (extend `packages/3-targets/3-targets/postgres/test/psl-infer/inferred-psl.round-trip.test.ts` or the integration equivalent, whichever already runs migrations against PGlite): for every Postgres data type with a marked constructor, as a single column and as a list, create the column through a planned migration, infer, and emit the inferred schema; the emitted column has the same codec and `dataTypeParams`. A `tsquery` column makes infer fail with `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED`.
2. A CLI journey with pgvector in PGlite (find how existing journeys load pgvector into PGlite): with `pgvector` in `extensionPacks`, `contract infer` prints `pgvector.Vector(3)`; without it, the command fails, exits non-zero and names the column.
3. Docs: the Postgres target README's infer description (no `Unsupported`; unclaimed types fail); `packages/2-sql/9-family/README.md`'s `./psl-build` line (no `PslTypeMap`); "Declaring a data type" in `docs/reference/codec-authoring-guide.md`, and the doc comment of `AuthoringTypeConstructorDescriptor.inferred` in `packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts`: the `inferred` mark is the constructor written for a column of this data type when no schema names one; `contract infer` and `contract print` write it, and the Prisma 7 reader will. Any CLI docs or skills under `skills/` that describe `contract infer` output with `Unsupported` (leave released upgrade instructions alone).
4. In `projects/data-types-completion/`: nothing. The orchestrator updates `design.md` and `plan.md`.
5. Run and report: `pnpm lint:deps`, `pnpm lint:docs`, `pnpm check:error-reference`, `pnpm lint:framework-vocabulary`, `pnpm fixtures:check`, root `typecheck:agent`, `mise exec -- pnpm test --coverage` in every package the slice touched (list them from `git diff --stat main`), and the integration files touched.
