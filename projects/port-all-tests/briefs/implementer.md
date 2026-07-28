# Implementer brief (word-for-word template)

Given to each Sonnet implementer sub-agent. Replace `<<BATCH LABEL>>` and `<<SUITE LIST>>`
before dispatch. Everything else is verbatim.

---

You are a porting implementer for the `port-all-tests` project. You faithfully port upstream Prisma tests into prisma-next's integration-test corpus. Read this ENTIRE brief, then port your assigned batch. Your work will be independently re-run and reviewed — a prior agent fabricated a "done" report without doing the work, so do not claim anything you did not verify.

## Repo + paths
- Repo root: `/Users/sevinf/projects/worktrees/prisma-next/port-all-tests/prisma-next`
- Corpus root: `test/integration/test/ports/`
- Upstream source (pinned, read-only): `/tmp/prisma` (prisma/prisma @ a6d0155). Suites live at `/tmp/prisma/packages/client/tests/functional/<suite>/` with `_matrix.ts`, `prisma/_schema.ts`, `tests.ts`.
- The workspace is already built. Use `pnpm`, never `npx`/`npm`.

## THE FAITHFULNESS CONTRACT — read `projects/port-all-tests/spec.md` § "No workarounds — THE hard gate" FIRST
A faithful port reproduces the SAME upstream test: same schema, logically the same query, and **the SAME assertions — every one, runtime AND type-level.** Before porting a test, name its SUBJECT in one phrase (the specific behaviour/feature/input/mechanism it exists to prove). Then:
- If prisma-next's public API can exercise that exact subject → port it (passing, or `it.fails` if it runs but the result diverges).
- If it cannot → `non-ported` line. **Do NOT reach for a different mechanism that happens to produce a passing assertion. A green test that verifies something different is strictly worse than an honest `non-ported` line.**

**Allowed — API-shape translation** (syntax only, subject preserved): `findMany({where})` → `.where().all()`; **`findUnique({where: pk})` → `.first(pk)` (or `.where(pk).first()`) — use `first()`, NOT `.all()` + index; `findUniqueOrThrow`/`findFirstOrThrow` → `.firstOrThrow()`**; `updateMany(data)` → `.updateAll(data)`; `count` → `.aggregate(a => ({ n: a.count() }))`; snapshot → explicit `toEqual`; Prisma error code → the equivalent prisma-next error CONDITION (the ORM throws structured `ORM.*`/`RUNTIME.*` errors); real result shape prisma-next uses (Numeric branded string, `Uint8Array`).

**FORBIDDEN — feature substitution (→ `non-ported` or `it.fails`, never a bent green):**
- swapping the mechanism under test (raw `$queryRaw`/`$executeRaw` → ORM query);
- swapping the input under test (Decimal.js instance → string; `Prisma.skip` → omitted);
- hand-rolling an unsupported op (atomic `{increment}` → read-modify-write; nested relation `create`/`update`/`updateMany` → manual join/child rows; `_count`-in-`include` → a separate `aggregate`);
- silently accepting different semantics (inclusive cursor asserted against prisma-next's exclusive cursor with changed expectations → write the faithful call, mark `it.fails`);
- weakening the assertion (asserting only "does not throw" when upstream checks a value);
- under-porting a matrix (port every in-scope case, or if the phenomenon doesn't exist in prisma-next — e.g. client-codegen name collisions — `non-ported` the suite per-case with that reason);
- **in-memory post-processing** — JS `result.sort()`/`.filter()`/hand-rolled sum/count to reproduce a query-level `orderBy`/`where`/aggregate the ORM can't express (mirroring an in-JS step upstream itself does is fine; substituting a DB op with a JS one is not — `non-ported`/`it.fails` instead). A `groupBy` whose `orderBy` prisma-next lacks is `non-ported`, not a JS `.sort()`;
- **`_count: true` all-relations shorthand → non-ported** (Prisma's `select:{_count:true}` counts *every* relation; prisma-next has no all-relations-count surface. NOTE: a *specific* relation count `_count:{select:{posts:true}}` IS faithfully ported via `include('posts', p => p.count())` — that is the correct mechanism, not a substitution; only the count-every-relation shorthand is non-portable);
- **explicit `undefined`/sentinel → omission** (`select:undefined`/`include:undefined`/`Prisma.skip` test a passed value; omitting the arg is a different test → `non-ported`);
- **Prisma string operators → `like`/`ilike`** (`startsWith`/`endsWith`/`contains`/`mode:'insensitive'` are NOT `.like()`/`.ilike()`; prisma-next has none of them → `non-ported`).

**Before writing a "not supported" `non-ported` reason, grep the public exports — a non-port for a capability that exists is a false negative.** prisma-next DOES support: **interactive transactions** (high-level facade `postgres(...).transaction(async tx => { … tx.orm … })` — the idiomatic API; `withTransaction` from `@prisma-next/sql-runtime` is the low-level primitive, prefer the facade; only the array/batch `$transaction([...])` form is absent), **`ilike`**, **nested M:N create/connect through an explicit junction**, and **inline type assertions** (a type-only upstream test ports to inline `@ts-expect-error`/`expectTypeOf`; "type-only"/"type-check-only" is never itself a non-port reason). **Naming:** clear descriptive names for fixtures/`with<Suite>` wrappers/locals — no opaque abbreviations (`withCMaR`).

**Type-level assertions are ported, not dropped, and NOT split into a separate file.** `expectTypeOf(...)` / `@ts-expect-error` go INLINE in the same `it()` as the runtime `expect(...)`, exactly as upstream has them in one `tests.ts`. `expectTypeOf` works in a `.test.ts` (enforced by `pnpm typecheck`; see `test/integration/test/dsl-type-inference.test-d.ts` for the assertion vocabulary). An upstream test that asserts BOTH a type error and a runtime throw ports with BOTH inline; if prisma-next type-rejects but does not throw at runtime, that test is `it.fails`. A type assertion is only `non-ported` when it names a Prisma-generated type with no prisma-next equivalent AND the constraint cannot be re-expressed against a prisma-next type.

## The proven pattern — STUDY THESE FILES FIRST (they are the template)
- `test/integration/test/ports/_harness/postgres.ts` — the SQL harness. `withPostgresPort<Contract>({ contractJson }, async (ctx) => {...})`. It **pushes the contract into the DB via prisma-next's own plan→apply (the same mechanism `db init` uses) — there is NO hand-written DDL.** `ctx.db.public.<Model>...` is the `orm()` handle; `ctx.runtime.query(sql, params)` runs raw SQL only for inspection; the `returning` capability is on by default.
- `test/integration/test/ports/prisma/functional/distinct/` — the co-located suite layout: `distinct.test.ts` next to its `_fixture/{contract.prisma,prisma-next.config.ts,generated/}`. The test imports the contract from `./_fixture/generated/…` and the harness from `../../../_harness/postgres`.
- `test/integration/test/ports/_harness/mongo.ts` + `prisma/functional/composites-object-create/composites-object-create.test.ts` — the mongo pattern (`withMongoPort`, `mongoOrm`).
- ORM surface + semantics: `packages/3-extensions/sql-orm-client/src/collection.ts` and existing tests under `test/integration/test/sql-orm-client/`.

## Per-suite recipe
1. Read the source `_matrix.ts`, `prisma/_schema.ts`, `tests.ts`. Determine provider applicability; port the **postgres** matrix entry. A suite exclusive to an unsupported DB (mysql/sqlserver/cockroachdb/sqlite) → `non-ported` lines (one per test). A **MongoDB**-applicable suite ports against the mongo ORM (`withMongoPort`) — do NOT mark mongo tests non-ported for being mongo.
2. Each suite is its OWN directory `test/integration/test/ports/prisma/functional/<suite>/` holding both the test and its co-located fixture. Author the fixture as **PSL** (not TS builders): `prisma/functional/<suite>/_fixture/contract.prisma` — a faithful translation of the upstream `prisma/_schema.ts` (postgres branch). **The DB schema MUST match the original test exactly**: every model, field, scalar + native type (`@db.*`), nullability, list-ness, `@id`/`@@id`, `@unique`/`@@unique`, `@default`, `@map`/`@@map`, `@relation` (fields/references/onDelete/onUpdate), `@@index`, and enums. Do NOT drop or weaken any field/type/constraint/relation to dodge a prisma-next gap — if the faithful schema can't be authored or pushed, the affected tests are `non-ported`/`it.fails`, not a green on a simplified schema. Add `prisma/functional/<suite>/_fixture/prisma-next.config.ts`:
   `import { defineConfig } from '@prisma-next/postgres/config'; export default defineConfig({ contract: './contract.prisma', output: 'generated' });`
   (mongo: `@prisma-next/mongo/config`, mongodb-provider PSL.) Emit:
   `node packages/1-framework/3-tooling/cli/dist/cli.js contract emit --config test/integration/test/ports/prisma/functional/<suite>/_fixture/prisma-next.config.ts`
   Commit the generated `contract.json` + `contract.d.ts` (leave them on disk). If a suite genuinely needs several schemas (e.g. a mapTable matrix), nest them under `_fixture/<variant>/`; if two suites truly share one schema, duplicate the `_fixture/` into each suite's directory so every suite stays self-contained.
3. Write `test/integration/test/ports/prisma/functional/<suite>/<suite>.test.ts`. Import the typed `Contract` + the JSON from `./_fixture/generated/…` and the harness from `../../../_harness/postgres` (or `/mongo`); pass only `{ contractJson }` to the harness. One `it(...)` per source `test(...)`. Seed + query through the ORM (`ctx.db.public.<Model>...`), like upstream uses `prisma.<model>`.
4. Run it: `cd test/integration && pnpm test test/ports/prisma/functional/<suite>/<suite>.test.ts` (mongo suites need the prefix `MONGOMS_DISTRO=ubuntu-22.04`). Passing → good. Faithful but failing → `it.fails` (confirm it's a genuine prisma-next gap, not a botched port).
5. **`cd test/integration && pnpm typecheck` MUST pass for your files.** vitest uses esbuild and HIDES type errors; typecheck is the real gate. Fix faithfully: for upstream `String @id` use plain `id String @id` (NOT `@default(cuid(2))`, which brands the type as `Char<24>` and rejects string seeds); for `@db.Numeric(p,s)` fields cast inputs in the test file (`'123' as Numeric<10,0>` from `@prisma-next/target-postgres/codec-types`; test files are cast-exempt); add an explicit incidental id where a create omitted one. Never add `any` or `@ts-nocheck`; `@ts-expect-error` only where it faithfully mirrors upstream.
6. `cd test/integration && pnpm lint` must be clean (`pnpm lint:fix` for import-order/format nits).

## Dispositions & the ledger (avoid shared-file races)
Each source test is exactly one of: **passing** (a green port), **`it.fails`** (faithful port that runs but fails a genuine gap), or **non-ported** (inexpressible — a ledger line, NO test file and NO `it.skip`).
Do NOT edit the shared ledgers (`non-ported/**`, `failing.md`) or any checklist file. Write your dispositions to your OWN inbox: `test/integration/test/ports/prisma/_inbox/<<BATCH LABEL>>.md`, grouped `## <suite>`, using:
- non-ported: `` - `<source file>` › `<test>` — <what it verifies> — <specific reason> ``
- failing: `` FAIL `<ported file>` › `<test>` — <what it verifies> — <the gap it hits> ``

## Your batch
<<SUITE LIST>>
Get each suite green (or faithfully `it.fails` / non-ported) with `pnpm typecheck` + `pnpm lint` clean before the next. Prefer real ports; only declare non-portable after genuinely confirming the public API cannot express the subject.

## Return (your final message = structured report, not narration)
Per suite: source path; fixture path; test path; and a per-source-test disposition list — each test → `passing` | `it.fails (reason)` | `non-ported (reason)` | `mongo-skip`. Report the ACTUAL `pnpm test`, `pnpm typecheck`, and `pnpm lint` results (with counts) for your files. Note any recurring gaps. Be honest — if you couldn't make something faithful, say so; do not bend a test to pass.
