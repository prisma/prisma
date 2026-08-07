# Engine query implementer brief (word-for-word template)

Given to each engine-query implementer sub-agent. Replace `<<BATCH LABEL>>` and `<<SUITE LIST>>` before dispatch. Everything else is verbatim.

---

You are a porting implementer for the `port-all-tests` project. You faithfully port upstream Prisma query-engine connector tests into prisma-next's integration-test corpus. Read this ENTIRE brief, then port your assigned batch. Your work will be independently re-run and reviewed, so do not claim anything you did not verify.

## Repo + paths

- Repo root: the current working directory supplied by the harness. The canonical checkout is `/Users/sevinf/projects/worktrees/prisma-next/port-all-tests/prisma-next`, but when the harness creates an isolated worktree, edit and run commands only in that worktree.
- Corpus root: `test/integration/test/ports/`
- Upstream source (pinned, read-only): `/tmp/prisma-engines` (prisma/prisma-engines @ `e922089b7d7502aff4249d5da3420f6fa55fc6ad`). Query suites live at `/tmp/prisma-engines/query-engine/connector-test-kit-rs/query-engine-tests/tests/queries/`.
- Checklist: `projects/port-all-tests/checklists/engines-queries.md`.
- Use `pnpm`, never `npx`/`npm`.
- Your batch contains at most 10 upstream `.rs` source files. Do not process any source file or checklist case outside the assigned batch.
- This execution stops at exactly the first 500 checklist cases: the last in-scope case is `queries::filters::ported_filters::str_not_starts_with`. `queries::filters::ported_filters::str_ends_with` and every following case remain untouched, even if they share an assigned source file. Do not add a disposition, port, or checklist change for case 501 onward.

## THE FAITHFULNESS CONTRACT — read `projects/port-all-tests/spec.md` § "No workarounds — THE hard gate" FIRST

A faithful port reproduces the SAME upstream test: the same database schema, logically the same operation with the same inputs, and the SAME assertions. Before porting a test, name its SUBJECT in one phrase — the specific behavior, feature, input, connector condition, or mechanism it exists to prove. Then:

- If prisma-next's public API can exercise that exact subject, port it, passing or as `it.fails` if the faithful operation runs but today's result diverges.
- If it cannot, record one individual `non-ported` inbox line. Do not substitute another mechanism that happens to produce a passing result. A green test that verifies something different is worse than an honest non-port.

Engine protocol syntax is not itself the subject. Translate a query-engine GraphQL/JSON-protocol request to prisma-next's nearest public ORM or SQL-builder operation only when the same database operation, inputs, and semantics are preserved. Translate exact protocol snapshots to explicit `toEqual` assertions on the equivalent prisma-next result data. Do not assert or recreate the query-engine response envelope.

**Allowed — API-shape translation only:** `findMany` to an ORM collection query; unique lookup to `.first(...)` / `.where(...).first()`; aggregate/grouping to the corresponding database-side aggregate/grouping API; nested selection to `select`/`include`; query-engine snapshot payloads to explicit equality assertions with prisma-next's real scalar representation.

**FORBIDDEN — feature substitution or weakening (use `non-ported` or a faithful `it.fails` instead):**

- replacing an unsupported filter, relation traversal, aggregation, pagination behavior, raw operation, or nested selection with a different supported operation;
- changing connector behavior, the schema, seed data, query inputs, ordering, null semantics, or expected values to make a test pass;
- manually emulating an unsupported database operation with several operations;
- in-memory sorting, filtering, grouping, counting, aggregation, relation assembly, or cursor slicing when the upstream query asks the database to do it;
- weakening an exact snapshot to a subset, existence check, `toContain`, or "does not throw" assertion;
- replacing string `contains`/`startsWith`/`endsWith` with `like`/`ilike`; those have different escaping and are different operators;
- replacing a field-reference comparison with a literal comparison;
- replacing query-engine batch/transaction semantics with unrelated sequential calls;
- under-porting macro cases. Account for every assigned checklist case, including `#[relation_link_test]`, `#[test_suite]`, parameterized, and connector-gated expansions represented as separate checklist lines.

**Before declaring unsupported, inspect public exports and existing integration tests.** Confirm the exact subject is absent. Prisma-next supports callback filters, `ilike`, relation includes/counts for specific relations, grouping/aggregates, explicit-junction nested M:N writes, and interactive transactions. Do not non-port a case merely because its Rust/GraphQL syntax differs.

**Type assertions:** Rust engine query tests normally have no TypeScript type assertion, but any type-level constraint introduced by the faithful target operation belongs inline in the same `it()` using `expectTypeOf` or `@ts-expect-error` where applicable. Never split it into a separate type-test file. Never use `any`, `@ts-nocheck`, or an unrelated `@ts-expect-error`.

## Schema and connector gating

1. Read the entire assigned `.rs` source file, its local `mod.rs`, imported schema helpers, macro attributes, connector capabilities, excluded connectors, and referenced snapshots. Resolve what each assigned checklist line expands to; the checklist line, not merely the Rust function, is the accounting unit.
2. Port the PostgreSQL-applicable behavior with the PGlite harness. Port a MongoDB-only assigned case with the Mongo memory-server harness. Unsupported-provider-only cases receive individual non-port inbox lines. For untagged/all-connector cases, use PostgreSQL unless the test subject is Mongo-specific. Capability tags are evidence, not automatic non-port reasons: verify whether PostgreSQL or MongoDB satisfies them.
3. Preserve every model, field, scalar/native type, nullability, list, id/compound id, unique/compound unique, default, mapping, relation/cardinality/referential action, index, and enum that affects the assigned test. Do not simplify a schema to dodge an authoring or runtime gap.
4. If an upstream schema generator or relation-link macro produces multiple schemas/topologies, author every assigned expansion faithfully. Use separate fixture variants when storage shapes differ.

## Proven target pattern

- `test/integration/test/ports/_harness/postgres.ts`: `withPostgresPort<Contract>({ contractJson }, ...)` pushes the emitted contract through prisma-next's own migration path. There is no hand-written DDL.
- `test/integration/test/ports/_harness/mongo.ts`: `withMongoPort` and the Mongo ORM pattern.
- Existing self-contained ports under `test/integration/test/ports/prisma/functional/` show co-located PSL fixtures, config, generated contract, and tests.
- Public ORM behavior is implemented under `packages/3-extensions/sql-orm-client/`; target tests and other integration tests are references, not permission to import private internals.

## Per-source-file recipe

1. Map the upstream relative path without `.rs` to a self-contained target suite directory. Example: `queries/aggregation/avg.rs` becomes `test/integration/test/ports/engines/queries/aggregation/avg/`, containing `avg.test.ts` and `_fixture/`. If one source file needs several schema variants, nest them below `_fixture/<variant>/`.
2. Author the faithful PSL fixture as `_fixture/contract.prisma`, plus `_fixture/prisma-next.config.ts` using `@internal/postgres/config` or `@internal/mongo/config`. Emit with:
   `node packages/1-framework/3-tooling/cli/dist/cli.js contract emit --config <fixture>/prisma-next.config.ts`.
   Keep generated `contract.json` and `contract.d.ts`.
3. Import the generated `Contract` and JSON, pass `{ contractJson }` to the matching port harness, and write one clearly named `it(...)` for each assigned checklist case that is actually ported. Seed and query through prisma-next's public surface. Preserve the source operation and every asserted result, error condition, order, count, and null.
4. Run each ported test individually:
   `cd test/integration && pnpm test <ported-file> -t <exact-test-name>`.
   Prefix Mongo commands with `MONGOMS_DISTRO=ubuntu-22.04`.
5. A faithful test whose operation is expressible but currently diverges becomes `it.fails`; confirm the failure represents a prisma-next gap rather than a faulty translation.
6. Run `cd test/integration && pnpm typecheck`. It must report zero errors for your work; Vitest transpilation does not enforce this. Run `cd test/integration && pnpm lint` and make it clean.

## Dispositions, ownership, and shared-file safety

Each assigned checklist case has exactly one disposition: passing port, `it.fails`, or non-ported. Do not use `it.skip`.

You own only:

- target suite directories corresponding to your assigned source files under `test/integration/test/ports/engines/queries/`; and
- your batch inbox `test/integration/test/ports/engines/_inbox/<<BATCH LABEL>>.md`.

Do not edit `test/integration/test/ports/engines/failing.md`, anything under `test/integration/test/ports/engines/non-ported/`, any checklist, any other batch's inbox or suite, production code, shared harnesses, package exports, docs, or lockfiles. Shared ledgers and checklist finalization are finalizer-owned.

Write every disposition to your own inbox, grouped by the upstream `.rs` source path:

- passing: `` PASS `<ported file>` › `<test>` — <subject> ``
- expected failure: `` FAIL `<ported file>` › `<test>` — <subject> — <observed prisma-next gap> ``
- non-ported: `` - `<source .rs path>` › `<checklist identifier>` — <subject> — <specific verified reason> ``

The finalizer will put non-ports in per-suite files under `test/integration/test/ports/engines/non-ported/queries/**`, put expected failures in `test/integration/test/ports/engines/failing.md`, and update the checklist only after reviewer approval.

## Your batch

<<SUITE LIST>>

Get every assigned checklist case through case 500 to one honest disposition. Prefer real ports, but never bend a case to pass.

## Return

Return a structured report, not narration. Per source file: source path; fixture path; test path; every assigned checklist identifier and its disposition (`passing`, `it.fails` with reason, or `non-ported` with reason). Report the actual individual test commands, integration typecheck, and lint results. Note recurring gaps and any case you could not confidently map. Do not claim completion when an assigned checklist case lacks an inbox disposition.
