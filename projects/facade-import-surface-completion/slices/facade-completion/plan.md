# Dispatch plan — facade-completion

Sequential. Seven dispatches, each M or smaller. Sequencing constraint: façade subpaths (D1–D3) land before the renderer switch (D4); renderer switch + in-workspace fixture regen is one commit; example + test-fixture sweep (D5a + D5b) lands after D4 so user-shaped TS doesn't briefly point at a not-yet-emitted specifier; docs sweep (D6) lands last.

**Mid-flight split.** D5 was originally one M-sized dispatch (~17 files) covering example apps + extension-pack contracts. While preparing the D5 brief the orchestrator grepped for `@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/pack` across the workspace and found ~60 additional user-shaped TS files (CLI-journey + parity test fixtures under `test/integration/test/fixtures/cli/cli-e2e-test-app/fixtures/**/contract*.ts` and `test/integration/test/authoring/parity/**/contract.ts`, plus a handful of `test/e2e/framework/` fixtures and a CLI-recording fixture pair). These weren't in the original D5 inventory but are structurally identical to user contracts (`import sqlFamily from '@internal/family-sql/pack'` + `defineContract({ family: sqlFamily, target: postgresPack, ... })`) and break under the D1/D2/D3 wraps' input-type drop. Folding ~80 files into one dispatch would have pushed D5 to L; per the M-cap, split into D5a (original inventory, ~19 files) + D5b (test fixtures, ~60 files). Each is M-sized and mechanical; D5a establishes the migration pattern on a small surface before D5b scales it. D6 unchanged.

## Pre-dispatch orchestrator context-gathering (complete; not a dispatch)

Before the dispatch loop opened, the orchestrator did inline research to firm up the spec + plan — reading files, grepping for pinned specifiers, sampling representative renderer/adapter call sites, and walking the Mongo control SPI. This was **orchestrator-scope work**, not a dispatch — no source changes, no subagent delegation, scope confined to project artifacts (`spec.md`, `plan.md`).

Findings folded into the project + slice specs:

- **A3 verified** — `migrationHash` is content-addressed over `ops.json`, not over `migration.ts`. Renderer flip doesn't shift hashes.
- **A4 verified** — Mongo `/control` SPI shape matches Postgres's pattern; `createMongoControlClient` is straight composition.
- **A5 verified** — no internal consumer imports `@internal/mongo` without a subpath; the existing `"."` barrel re-exports BSON value constructors from `mongodb`, which move to a new `/bson` subpath.
- **A6 verified** — TML-2526 referenced in `skills/prisma-next-migrations/SKILL.md` + `skills/DEVELOPING.md` only.
- **A7 added** — application-level rendered migrations stay on the target specifier (NFR2-protected); extension-pack migrations stay on the target specifier deliberately (extension authoring contract).

Newly surfaced scope items folded into D1/D2/D3/D4/D5/D6:

- D1 + D2 + D3 each absorb a `defineContract` pre-binding wrap (one per facade) so user `contract.ts` files don't reach into family/target packs.
- D2 grows to add a new `/bson` subpath alongside the barrel drop.
- D4 grows to also flip `TARGET_MIGRATION_MODULE` in both `op-factory-call.ts` files (necessary for the renderer flip to actually take effect), plus ~15 string-pinned tests (target tests, adapter tests, cli-journey e2e tests).
- D5 grows to also cover `examples/*/prisma/contract.ts` + two extension-pack contracts (`pgvector`, `postgis`).
- D6 grows to flip the ts-render README, the cli README, the ADR 208 example, and `skills/DEVELOPING.md`.

Pre-dispatch research that *is* dispatchable (would touch source or change diffs) would have been a true D0 spike dispatched to a subagent. None of the above qualified — every finding came from read-only inspection of existing files and the result lived only in `projects/` artifacts.

---

### Dispatch 1: Postgres `/migration` + contract-builder pre-binding + arch config

**Intent.** Add `@internal/postgres/migration` as a re-export of `@internal/target-postgres/migration`. Wrap `defineContract` in `@internal/postgres/contract-builder` to pre-bind `sqlFamily` + `postgresPack` (drop both from the input scaffold's type). Register the new subpath in `architecture.config.json`. Add parity + wrap-shape tests. Do NOT yet flip the renderer; renderer change is D4.

**Files in play.**

- `packages/3-extensions/postgres/src/exports/migration.ts` (new; one-line `export *`).
- `packages/3-extensions/postgres/src/contract/define-contract.ts` (new; wrapped `defineContract` pre-binding `sqlFamily` + `postgresPack`).
- `packages/3-extensions/postgres/src/exports/contract-builder.ts` (replace re-exported `defineContract` with the wrapped version; keep `field`, `model`, `rel`, type re-exports as-is).
- `packages/3-extensions/postgres/package.json` (add `./migration` to `exports`).
- `packages/3-extensions/postgres/test/migration/re-export.test.ts` (new; named-export parity assertion against `@internal/target-postgres/migration`).
- `packages/3-extensions/postgres/test/contract-builder/define-contract.test.ts` (new; assert the wrapped `defineContract` (a) accepts a scaffold with no `family`/`target` keys, (b) produces a contract whose family/target IDs are `'sql'`/`'postgres'`, (c) still accepts an `extensionPacks` map, (d) type-check: `family`/`target` not in the input type).
- `packages/3-extensions/postgres/README.md` (add `### @internal/postgres/migration` section; update the `contract-builder` section to show the new no-family/target shape).
- `architecture.config.json` (add entry: `packages/3-extensions/postgres/src/exports/migration.ts` → `domain: extensions, layer: adapters, plane: migration`).

**"Done when":**

- [ ] `pnpm build --filter @internal/postgres` clean.
- [ ] `pnpm typecheck --filter @internal/postgres` clean.
- [ ] `pnpm test:packages --filter @internal/postgres` clean (parity + wrap-shape tests pass).
- [ ] `pnpm lint:deps` clean.
- [ ] Importing `Migration`, `MigrationCLI`, `placeholder`, `createTable`, `addColumn`, `dataTransform`, `rawSql` from `@internal/postgres/migration` in a smoke-test snippet typechecks against the same types `@internal/target-postgres/migration` exposes.
- [ ] The wrapped `defineContract` smoke-test: `defineContract({ extensionPacks: {} }, ({ field, model }) => ({ models: { Foo: model('Foo', { fields: { id: field.id.uuidv4() } }) } }))` typechecks and returns a `SqlContractResult<...>` whose family/target IDs are `'sql'`/`'postgres'`.
- [ ] Intent-validation: diff covers exactly the new `/migration` subpath + the contract-builder wrap + tests + README + arch config; no behaviour change to the underlying types.

**Size.** M (was S; grew with the contract-builder wrap, but the wrap is mechanical mirror-of-Postgres pattern).

**Tier.** Orchestrator-or-mid (the contract-builder wrap's generic signature needs careful mirroring of the base `defineContract`'s overloads to preserve inference; verify against `packages/2-sql/2-authoring/contract-ts/src/contract-builder.ts` before writing).

**DoR confirmed.** [ ]

---

### Dispatch 2: Mongo `/config` parity + `/control` + `/bson` + contract-builder pre-binding + drop barrel

**Intent.** Bring `MongoConfigOptions` to parity with `PostgresConfigOptions` (`extensions`, `migrations.dir`). Add `@internal/mongo/control` exporting `createMongoControlClient`. Add `@internal/mongo/bson` re-exporting the BSON value constructors currently behind the `"."` barrel. Drop the `"."` barrel and delete `src/exports/index.ts`. Wrap `defineContract` in `@internal/mongo/contract-builder` to pre-bind family + target (mirror of D1 for the mongo family). Add covering tests.

**Files in play.**

- `packages/3-extensions/mongo/src/config/define-config.ts` (extend `MongoConfigOptions`, thread through to `coreDefineConfig`).
- `packages/3-extensions/mongo/src/exports/config.ts` (re-export the new option type).
- `packages/3-extensions/mongo/src/exports/control.ts` (new; mirror of postgres `control.ts` against mongo descriptors).
- `packages/3-extensions/mongo/src/exports/bson.ts` (new; `export { Binary, Decimal128, Long, MongoClient, ObjectId, Timestamp } from 'mongodb';`).
- `packages/3-extensions/mongo/src/contract/define-contract.ts` (new; wrapped mongo `defineContract` pre-binding family + target).
- `packages/3-extensions/mongo/src/exports/contract-builder.ts` (replace re-exported `defineContract` with the wrapped version).
- `packages/3-extensions/mongo/test/contract-builder/define-contract.test.ts` (new; mirror D1's wrap-shape test for the mongo family).
- `packages/3-extensions/mongo/src/exports/index.ts` (delete).
- `packages/3-extensions/mongo/package.json` (add `./control`, `./bson`; remove `"."`).
- `packages/3-extensions/mongo/test/config/define-config.test.ts` (extend with `extensions` + `migrations.dir` cases).
- `packages/3-extensions/mongo/test/control/create-mongo-control-client.test.ts` (new; assert the client composes the expected descriptors).
- `packages/3-extensions/mongo/test/bson/re-export.test.ts` (new; named-export parity against the deleted barrel's surface).
- `packages/3-extensions/mongo/README.md` (rewrite to mirror Postgres's structure; document `/config`, `/contract-builder`, `/control`, `/bson`, `/family`, `/runtime`, `/target`; note barrel removal + the `import { ObjectId } from '@internal/mongo'` → `from '@internal/mongo/bson'` migration for users).
- `architecture.config.json` (add entries for `mongo/src/exports/control.ts` + `bson.ts`; remove entry for the deleted `index.ts` barrel if one exists).

**"Done when":**

- [ ] `pnpm build --filter @internal/mongo` clean.
- [ ] `pnpm typecheck --filter @internal/mongo` clean.
- [ ] `pnpm test:packages --filter @internal/mongo` clean.
- [ ] `pnpm lint:deps` clean.
- [ ] Mongo example apps' `pnpm typecheck` still clean (`mongo-demo`, `mongo-blog-leaderboard` — including any that imported BSON constructors from the barrel, which must now import from `/bson`).
- [ ] Grep gate: `rg "from '@internal/mongo'(?!/)"` returns zero hits across `packages/` + `examples/` + `test/` (or only the deleted barrel file).
- [ ] Intent-validation: diff matches "Mongo parity + control + bson + barrel removal"; nothing else.

**Size.** M.

**Tier.** Orchestrator-or-mid (one design judgment on `createMongoControlClient`'s options interface; verify against Postgres precedent before writing).

**DoR confirmed.** [ ]

---

### Dispatch 3: SQLite façade — `/config`, `/contract-builder`, `/control`, `/migration`

**Intent.** Add all four missing SQLite façade subpaths in one dispatch. Each is a thin composition / re-export file mirroring the Postgres precedent; the bundle stays M-sized because each individual file is small and follows the same pattern. Update `package.json` deps. Add tests covering each new subpath. Add `architecture.config.json` entries. Do NOT yet flip the SQLite renderer (that's D4).

**Files in play.**

- `packages/3-extensions/sqlite/src/config/define-config.ts` (new; mirror of postgres `define-config.ts`).
- `packages/3-extensions/sqlite/src/exports/config.ts` (new; re-exports).
- `packages/3-extensions/sqlite/src/contract/define-contract.ts` (new; wrapped `defineContract` pre-binding `sqlFamily` + `sqlitePack`).
- `packages/3-extensions/sqlite/src/exports/contract-builder.ts` (new; exports the wrapped `defineContract`, plus re-exports `field`, `model`, `rel`, types from `@internal/sql-contract-ts/contract-builder`).
- `packages/3-extensions/sqlite/src/exports/control.ts` (new; mirror of postgres `control.ts`).
- `packages/3-extensions/sqlite/src/exports/migration.ts` (new; `export * from '@internal/target-sqlite/migration'`).
- `packages/3-extensions/sqlite/package.json` (add `./config`, `./contract-builder`, `./control`, `./migration` to `exports`; add `@internal/cli`, `@internal/config`, `@internal/sql-contract-psl`, `@internal/sql-contract-ts`, `pathe` to `dependencies`).
- `packages/3-extensions/sqlite/test/config/define-config.test.ts` (new; mirror of mongo's).
- `packages/3-extensions/sqlite/test/contract-builder/re-export.test.ts` (new; named-export parity).
- `packages/3-extensions/sqlite/test/control/create-sqlite-control-client.test.ts` (new; mirror of postgres's).
- `packages/3-extensions/sqlite/test/contract-builder/define-contract.test.ts` (new; mirror D1's wrap-shape test for sqlite).
- `packages/3-extensions/sqlite/test/migration/re-export.test.ts` (new; named-export parity).
- `packages/3-extensions/sqlite/README.md` (full rewrite to mirror Postgres's README shape).
- `architecture.config.json` (add four new entries; mirror the Postgres planes — `/config` shared, `/contract-builder` shared, `/control` migration, `/migration` migration).

**"Done when":**

- [ ] D0 confirmed the SQLite façade's new deps don't cycle (`pnpm install` succeeds; `pnpm lint:deps` clean).
- [ ] `pnpm build --filter @internal/sqlite` clean.
- [ ] `pnpm typecheck --filter @internal/sqlite` clean.
- [ ] `pnpm test:packages --filter @internal/sqlite` clean.
- [ ] `pnpm lint:deps` clean.
- [ ] Importing from each new subpath in a smoke-test snippet typechecks against the expected surface.
- [ ] Intent-validation: diff covers exactly the four new subpaths + tests + README + arch config; no renderer change yet.

**Size.** M.

**Tier.** Orchestrator-or-mid (multiple files, mirror-pattern execution, low individual judgment).

**DoR confirmed.** [ ]

---

### Dispatch 4: Renderer switch + IR-constant flip + test-pin sweep

**Intent.** Flip the renderer end-to-end in one atomic commit. Two source changes (`BASE_IMPORTS` in `render-typescript.ts`, `TARGET_MIGRATION_MODULE` in `op-factory-call.ts`) for both Postgres and SQLite, plus ~15 string-pinned test files that assert on the rendered specifier. The constant + renderer must flip together because each op-factory call's `importRequirements()` overrides the renderer's `BASE_IMPORTS` for the same symbols; flipping only one yields mixed specifiers in rendered output.

**Files in play.**

- **Renderer sources (4 files):**
  - `packages/3-targets/3-targets/postgres/src/core/migrations/render-typescript.ts` (`BASE_IMPORTS` swap).
  - `packages/3-targets/3-targets/sqlite/src/core/migrations/render-typescript.ts` (`BASE_IMPORTS` swap).
  - `packages/3-targets/3-targets/postgres/src/core/migrations/op-factory-call.ts` (`TARGET_MIGRATION_MODULE` swap).
  - `packages/3-targets/3-targets/sqlite/src/core/migrations/op-factory-call.ts` (`TARGET_MIGRATION_MODULE` swap).
- **String-pinned tests (target + adapter):**
  - `packages/3-targets/3-targets/postgres/test/migrations/issue-planner.test.ts`.
  - `packages/3-targets/3-targets/sqlite/test/migrations/op-factory-call.test.ts`.
  - `packages/3-targets/3-targets/sqlite/test/migrations/planner.authoring-surface.test.ts`.
  - `packages/3-targets/6-adapters/postgres/test/migrations/op-factory-call.rendering.test.ts`.
  - `packages/3-targets/6-adapters/postgres/test/migrations/op-factory-call.lowering.test.ts`.
  - `packages/3-targets/6-adapters/postgres/test/migrations/planner.authoring-surface.test.ts`.
  - `packages/3-targets/6-adapters/postgres/test/migrations/render-typescript.roundtrip.test.ts`.
  - `packages/3-targets/6-adapters/sqlite/test/migrations/render-typescript.roundtrip.test.ts` (verify shape vs string pinning; update if string-pinned).
- **String-pinned e2e tests:**
  - `test/integration/test/cli-journeys/invariant-routing.e2e.test.ts` (2 occurrences).
  - `test/integration/test/cli-journeys/migration-round-trip.e2e.test.ts` (1 occurrence).
  - `test/integration/test/cli-journeys/init-journey/harness.ts` (1 occurrence — comment + harness).
- **Internal-source comments / docstrings that reference the specifier as the rendered output:**
  - `packages/3-targets/3-targets/postgres/src/core/migrations/postgres-migration.ts` (docstring at L22).
  - `packages/3-targets/3-targets/{postgres,sqlite}/src/exports/migration.ts` (file-header comments).
  - `packages/3-targets/3-targets/{postgres,sqlite}/src/core/migrations/render-typescript.ts` (file-header comments).

**"Done when":**

- [ ] D1 + D3 landed; `@internal/postgres/migration` and `@internal/sqlite/migration` resolve.
- [ ] `pnpm build --filter @internal/target-postgres --filter @internal/target-sqlite` clean.
- [ ] `pnpm test:packages` for both target packages and both adapters clean.
- [ ] `pnpm test:integration` clean (cli-journey e2e tests pass with the flipped specifier).
- [ ] `pnpm test:e2e` clean.
- [ ] `pnpm fixtures:check` clean.
- [ ] `pnpm lint:deps` clean.
- [ ] Intent-validation: diff covers exactly the 4 source files + the test-pin sweep + the docstring touch-ups; no façade source change in this dispatch.
- [ ] Grep gate: `rg "@internal/target-(postgres|sqlite)/migration" -g '!**/node_modules/**' -g '!**/migrations/**'` returns only:
  - the internal target packages' own `src/exports/migration.ts` (the source of `/migration`),
  - the cipherstash extension's `src/exports/migration.ts` docstring (deliberate; documents the extension authoring contract),
  - the parity tests added in D1 and D3 (which assert the façade re-exports byte-match the target),
  - `skills/` / `docs/` / `README.md` references that get flipped in D6.

**Size.** M (mechanical + well-bounded by D0 inventory; ~20 files touched but each edit is a single-line swap of one identifier string).

**Tier.** Cheap (mechanical, D0 inventory in hand).

**DoR confirmed.** [ ]

---

### Dispatch 5a: Example apps migrate to façade form (extension-pack contracts exempted, see A7)

**Intent.** Migrate every user-authored TS file in `examples/` (and the two extension-pack `src/contract.ts` files) to façade form. Two surfaces:

- **`examples/<app>/prisma-next.config.ts`** — verbose → façade (`@internal/{postgres,sqlite,mongo}/config`). Per D0's inventory: `react-router-demo` + `prisma-8-demo-sqlite` definitely verbose; spot-check `paradedb-demo`, `prisma-8-postgis-demo`, `retail-store`.
- **`examples/<app>/prisma/contract.ts`** + **`packages/3-extensions/{pgvector,postgis}/src/contract.ts`** — drop `import sqlFamily from '@internal/family-sql/pack'` + `import postgresPack from '@internal/target-postgres/pack'`; drop `family` / `target` from the `defineContract` call. Extension packs that ship a contract count as user-authored TS for this purpose.

For Mongo examples, opportunistically apply the now-available `extensions` / `migrations` fields only if the example needs them. Verify `pnpm typecheck` per example after migration.

**Files in play.**

- All `examples/*/prisma-next.config.ts` files (per D0 inventory, 13 files).
- All `examples/*/prisma/contract.ts` files (per D0 grep, 4 files: `paradedb-demo`, `prisma-8-demo-sqlite`, `prisma-8-demo`, `react-router-demo`).
- ~~`packages/3-extensions/pgvector/src/contract.ts`, `packages/3-extensions/postgis/src/contract.ts`~~ (**dropped post-D5a R1**: Turbo build cycle `postgres → sql-builder → extension-pgvector → would-be postgres` makes the migration impossible without architectural refactor. Folded into A7's extension-pack exemption; see spec § A7 for details and the `@internal/postgres-contract` extraction follow-up option).
- `packages/3-extensions/sql-orm-client/test/fixtures/contract.ts` (test fixture — only migrate if doing so doesn't break the test's intent; if the fixture deliberately exercises the verbose form, leave + add a comment).
- Any `examples/*/scripts/*.ts` or `examples/*/test/utils/*.ts` that imports from `@internal/cli/control-api`, `@internal/target-*/control`, etc. — verified by grep; in scope if the façade now exposes the equivalent surface (`createSqliteControlClient`, `createMongoControlClient`, `createPostgresControlClient`).

**"Done when":**

- [ ] D2 + D3 landed; mongo + sqlite façade subpaths + wrapped `defineContract` exist.
- [ ] Grep gate (config): `rg "@internal/(cli|family-(sql|mongo)|sql-(contract|contract-psl|contract-ts)|mongo-(contract|contract-psl|contract-ts)|target-(postgres|sqlite|mongo)|adapter-(postgres|sqlite|mongo)|driver-(postgres|sqlite|mongo))/" examples/*/prisma-next.config.ts` returns zero hits.
- [ ] Grep gate (contract): `rg "@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/(pack|control)" examples/*/prisma/contract.ts packages/3-extensions/{pgvector,postgis}/src/contract.ts` returns zero hits.
- [ ] `pnpm typecheck` clean for every example (filter per example or run the all-examples task).
- [ ] `pnpm build` clean across the workspace.
- [ ] Intent-validation: diff covers only `examples/**/{prisma-next.config.ts,prisma/contract.ts}` + (if applicable) a handful of control-side test helpers; no façade or framework source change. (Extension-pack contracts exempted post-discovery — see A7.)
- [ ] FR9 partially satisfied (examples sweep complete; D5b closes the test-fixture remainder).

**Size.** M.

**Tier.** Mid or cheap (mechanical mirror-of-pattern, bounded fan-out; one extension-pack contract has `extensionPacks` wiring that needs careful migration to ensure the wrapped `defineContract` accepts it).

**DoR confirmed.** [ ]

---

### Dispatch 5b: Test fixtures migrate to façade form

**Intent.** Sweep the remaining user-shaped TS files outside `examples/` — the CLI-journey + parity + e2e test fixtures + CLI-recording fixtures + the single mongo-runtime test that constructs a contract — to the wrapped `defineContract`. Mechanically identical to D5a's contract.ts pattern (drop two imports, drop two arguments from the `defineContract` call) but at higher fan-out (~60 files). Most are templated identically — establish the sed-pattern on the first 2-3 files, scale to the rest. Verify the integration suite goes green afterward (this dispatch is what closes the 17 `pnpm test:integration` failures D4's full-suite run surfaced).

**Files in play.**

Per the orchestrator's grep (run before D5a; re-grep to refresh before D5b dispatches):

- **CLI-journey fixtures** (`test/integration/test/fixtures/cli/cli-e2e-test-app/fixtures/cli-journeys/contract-*.ts`) — ~18 files matching `contract*.ts` with `/pack` imports.
- **CLI-journey + DB-init contracts** (`test/integration/test/fixtures/cli/cli-e2e-test-app/fixtures/{db-init,db-init-with-contract-space,db-update-preflight-gaps,db-update-scenarios,db-verify,db-sign,db-introspect,emit,migration-apply,migration-plan,vite-plugin,mongo-cli-journeys}/contract*.ts`) — ~15 files.
- **CLI-integration fixtures** (`test/integration/test/fixtures/cli/cli-integration-test-app/fixtures/{emit-command,emit-contract,verify-database}/contract*.ts`) — ~5 files.
- **Parity test fixtures** (`test/integration/test/authoring/parity/**/contract.ts`) — ~15 files.
- **Side-by-side test fixtures** (`test/integration/test/authoring/side-by-side/{postgres,mongo}/contract.ts`) — 2 files.
- **Top-level integration fixtures** (`test/integration/test/{fixtures,sql-builder/fixtures,mongo/fixtures}/contract.ts` + `.../prisma-next.config.ts` + `mongo-cli-journeys/prisma-next.config.with-db.ts`) — ~6 files.
- **Disallow-rule fixtures** (`test/integration/test/fixtures/cli/{disallowed-import,exact-prefix-import,custom-allowlist,valid-contract,valid-contract-default}.ts`) — VERIFY before migrating; these may deliberately exercise the verbose form to test the import-allowlist disallow rules. If a fixture's intent is "demonstrate a disallowed import" then leave it + add a comment; if it's just predates the facade then migrate.
- **E2E framework fixtures** (`test/e2e/framework/test/fixtures/contract.ts`, `test/e2e/framework/test/sqlite/fixtures/contract.ts`, `test/e2e/framework/test/sqlite/migrations/harness.ts`) — 3 files.
- **CLI recordings** (`packages/1-framework/3-tooling/cli/recordings/fixtures/contract-{base,additive}.ts`) — 2 files.
- **Mongo runtime test** (`packages/2-mongo-family/7-runtime/test/query-builder.test.ts`) — 1 file (constructs a contract inline; may be deliberately testing the verbose form, verify intent).
- **Test helpers** (`test/integration/test/utils/cli-test-helpers.ts`, `test/integration/test/family.schema-verify.helpers.ts`, `test/integration/utils/framework-components.ts`) — check usage; only migrate the parts that construct user-shaped contracts. Control-plane wiring stays on `/control` subpaths.
- **Test files that inline-construct contracts** (`test/integration/test/contract-builder.test.ts`, `test/integration/test/contract-builder.types.test-d.ts`, `test/integration/test/dsl-type-inference.test-d.ts`, `test/integration/test/control-api.test.ts`, `test/integration/test/family.{introspect,schema-verify.*,verify-database.*,sign-database}.{test,integration.test}.ts`, `test/integration/test/referential-actions.integration.test.ts`, `test/integration/test/authoring/{paradedb-bm25-narrowing,mongo-pack-composition,callback-mode-terseness}.test.ts`, `test/integration/test/authoring/psl-index-type-options.integration.test.ts`, `test/integration/test/authoring/parity/ts-psl-parity.real-packs.test.ts`) — these are tests, not fixtures; check each one's intent. Many are testing the wrap shape itself or the underlying `defineContract`; migrating them might invalidate the test. **Implementer judgment per file.**

**"Done when":**

- [ ] D5a landed.
- [ ] Grep gate: `rg "@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/(pack|control)" -g '!**/node_modules/**' -g '!**/dist/**' -g '!projects/**'` returns only:
  - the facade source files that re-export from packs (`packages/3-extensions/{postgres,sqlite,mongo}/src/{exports/{family,target}.ts,contract/define-contract.ts}`),
  - the facade test files that assert pack rejection via `@ts-expect-error` (`packages/3-extensions/{postgres,sqlite,mongo}/test/contract-builder/define-contract.test-d.ts`),
  - cipherstash migration files (A7 exemption),
  - extension-pack `src/contract.ts` files (`pgvector`, `postgis`) — A7 exemption (Turbo cycle blocks migration without architectural refactor),
  - disallow-rule fixtures left deliberately verbose (with explanatory comments),
  - any test file deliberately exercising the verbose form (with explanatory comments).
- [ ] `pnpm test:integration` clean (the 17 failures D4 surfaced are gone).
- [ ] `pnpm test:e2e` clean.
- [ ] `pnpm lint:deps` clean.
- [ ] `pnpm fixtures:check` clean (if not pre-existing-env-broken).
- [ ] Intent-validation: diff covers only test-fixture / test-file user-contract migration; no source change to packages.
- [ ] FR9 fully satisfied.

**Size.** M (mechanical, templated; if file fan-out genuinely exceeds 60 non-trivial diffs at dispatch time, escalate and re-split).

**Tier.** Mid (some judgment required on which test fixtures are deliberately verbose vs need migration).

**DoR confirmed.** [ ]

---

### Dispatch 5c: Fix architectural layering — remove extension-pack devDeps from sql-builder, sql-orm-client, mongo-runtime

**Intent.** D5a R1 surfaced and D5b R1 confirmed a recurring architectural pattern: in-monorepo packages have `devDependencies` on extension packs (or the mongo facade) for their test fixtures. Turbo treats devDeps as part of the build graph, which creates cycles preventing extension packs (and `mongo-runtime`'s test) from using the corresponding facade. Per operator direction, fix the actual layering violation: extension-pack composition tests live in `test/integration/`, not in package-level `test/` directories.

Three cycles to break:

- `@internal/postgres` → `sql-builder` → `extension-pgvector` (devDep) → would-be `postgres`.
- `@internal/postgres` → `sql-orm-client` → `extension-pgvector` (devDep) → would-be `postgres`.
- `@internal/mongo` → `mongo-runtime` → would-be `mongo` (test fixture).

**Files in play.**

- **sql-builder** (3 files moved out): `test/playground/resolved-field-types.test-d.ts` + `test/fixtures/generated/contract.{json,d.ts}` → `test/integration/test/sql-builder/`. Drop `@internal/extension-pgvector` from `packages/2-sql/4-lanes/sql-builder/package.json` devDeps.
- **sql-orm-client** (~8 files moved out): `test/collection-mutation-defaults.test.ts`, `test/integration/{codec-async.test.ts,runtime-helpers.ts}`, `test/helpers.ts` (verify whether pgvector-specific), `test/fixtures/{contract.ts,prisma-next.config.ts,generated/contract.{json,d.ts}}` → `test/integration/test/sql-orm-client/`. Drop `extension-pgvector` + likely several other now-unused devDeps from `packages/3-extensions/sql-orm-client/package.json`.
- **mongo-runtime** (1 file + maybe helpers): `packages/2-mongo-family/7-runtime/test/query-builder.test.ts` (the D5b verbose-with-comment file) → `test/integration/test/mongo-runtime/query-builder.test.ts`. Update mongo-runtime's package.json devDeps accordingly.
- `test/integration/package.json` already deps on every extension pack + facade; should typecheck without further changes.
- `pnpm-lock.yaml` refresh.

**"Done when":**

- [ ] D5b landed (✓ before dispatch).
- [ ] All three cycles broken — `pnpm typecheck --filter @internal/extension-pgvector` after experimentally adding `@internal/postgres` as a devDep succeeds (revert the experimental devDep after verifying; the real migration is D5d).
- [ ] All moved tests pass at their new location.
- [ ] All three packages still typecheck + pass their remaining tests.
- [ ] `pnpm lint:deps` clean.
- [ ] `pnpm install` ran; lockfile reflects dep changes.
- [ ] Intent-validation: diff covers `git mv`-ed files + package.json dep drops + lockfile refresh + minor import-path fixes inside moved files. NO contract.ts migrations (that's D5d), NO facade source changes.

**Size.** M (~15 files moved + 3 package.json updates + lockfile; mostly `git mv` + small surgical dep edits).

**Tier.** Mid (judgment needed on which sql-orm-client helpers are pgvector-specific vs generally useful; reasonable architectural reasoning required for destination paths).

**DoR confirmed.** ☑ (D5c R1 SATISFIED WITH FINDINGS [F4]; cycle independently verified broken by reviewer; F4 folded into D5d's first commit)

---

### Dispatch 5d: Migrate previously-blocked contracts to facade form (post-cycle-break)

**Intent.** With D5c's cycle break in place, complete the contract.ts migration that A7 had to temporarily exempt. Per the original D5 intent + operator direction (architectural fix over workaround), migrate the extension-pack contracts to the facade form. Revert the A7 extension I temporarily landed for extension-pack contracts.

**Files in play.**

- `packages/3-extensions/pgvector/src/contract.ts` — drop verbose imports, switch to `@internal/postgres/contract-builder`'s `defineContract`, drop `family`/`target` args.
- `packages/3-extensions/postgis/src/contract.ts` — same migration.
- `packages/2-mongo-family/7-runtime/test/query-builder.test.ts` (now under `test/integration/test/mongo-runtime/`) — drop the verbose-with-comment, switch to `@internal/mongo/contract-builder`.
- `packages/3-extensions/{pgvector,postgis}/package.json` — add `@internal/postgres` as dep (or devDep if contract.ts is only used at build/emit time, verify).
- `projects/facade-import-surface-completion/spec.md` § A7 — revert the extension-pack-contracts extension I made during D5a R1 (the migration files exemption stays; the contracts exemption no longer applies). Update the orchestrator-decision-log line in code-review.md to reflect.

**"Done when":**

- [ ] D5c landed (✓ before dispatch).
- [ ] `pnpm typecheck` clean for `pgvector`, `postgis`, `mongo-runtime`, `integration-tests`.
- [ ] `pnpm test:packages` clean for the three packages.
- [ ] `pnpm test:integration` for the moved mongo-runtime test passes.
- [ ] Grep gate: `rg "@internal/(family-(sql|mongo)|target-(postgres|sqlite|mongo))/(pack|control)" -g '!**/node_modules/**' -g '!**/dist/**' -g '!projects/**'` no longer matches `packages/3-extensions/{pgvector,postgis}/src/contract.ts` or the moved mongo-runtime test.
- [ ] Spec § A7 reverted to the pre-D5a form (migration-files exemption only).
- [ ] Intent-validation: 3 contract migrations + 2 package.json dep additions + spec revert; nothing else.

**Size.** S (3 contract files + 2 package.json + 1 spec section).

**Tier.** Cheap (mechanical now that cycle is broken).

**DoR confirmed.** ☑ (D5c landed; A7 extension reverted in spec.md; D5d brief written at `dispatches/d5d-brief.md`; first commit also resolves F4 carryover from D5c R1)

**Outcome.** PARTIAL. Commits `bf3c3a9c3` (F4 fix) + `4bdab857b` (pgvector + postgis contract migrations) landed cleanly. Mongo-runtime test migration BLOCKED on F5/F3 (mongo facade wrap collapses `Models` generic — surfaced when the planned-mechanical mongo migration hit a wrap-signature bug). D5e queued to fix the wrap + complete the two remaining mongo migrations.

---

### Dispatch 5e: ~~Fix mongo facade `defineContract` wrap + complete blocked mongo migrations (F3 + F5)~~ — DEFERRED to [TML-2633](https://linear.app/prisma-company/issue/TML-2633/mongo-facade-definecontract-wrap-collapses-inline-model-inference)

**Outcome.** Pre-dispatch orchestrator investigation (2026-05-21) determined D5e's work shape exceeds this slice's scope and the composer-2.5-fast tier the operator authorized for the slice's remaining work. Three structural findings drove the deferral:

1. Mongo's base `defineContract` does not expose `Models` as an explicit generic (sql does + sql exports `ModelLike`). Postgres's facade wrap pattern is NOT directly mirror-able — it would require changing the mongo authoring layer (1620-line `packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts`).
2. The "contravariance trap" hypothesis from D1 R1 may not actually apply to mongo (`ModelBuilder.ref` uses method syntax → TS bivariance default). The actual root cause requires TS trace-resolution debugging, not pattern-mirroring.
3. F5's symptom (inline-models `_id: never`) is broader than F3's discriminator+embedded edge case, suggesting whatever's collapsing inference is upstream of F3's specific pattern.

D5e's stated scope (cross-package type threading + authoring-layer changes + discriminated-union regression test design) is genuinely substantive type-system work, not mechanical. Filing as a dedicated ticket lets a future implementer run the typescript investigation properly, with the wrap-fix + authoring-layer changes + regression test all in one focused PR.

**In-tree workaround.** Two integration test files keep the verbose `@internal/mongo-contract-ts/contract-builder` import — `test/integration/test/mongo/fixtures/contract.ts` (left verbose by D5b, comment already in tree) and `test/integration/test/mongo-runtime/query-builder.test.ts` (left verbose by D5d's halt, comment to be added by D6). See spec § A8.

**F3 + F5 status.** Both findings transferred to TML-2633 as acceptance criteria. Closed in `code-review.md` with a "deferred to TML-2633" disposition rather than resolved.

---

### ~~Dispatch 5e (original brief, retained as historical reference)~~

**Intent.** D5d R1 closed F4 and migrated pgvector + postgis contracts but halted on the mongo-runtime test migration: `@internal/mongo/contract-builder`'s `defineContract` wrap collapses the `Models` generic, so `PlanRow<typeof contract>` resolves model fields to `never`. This is the same root cause as F3 (the integration mongo fixture's discriminated-union + embedded-relation precision regression), which D5b documented but couldn't address inside its mechanical-migration scope. D5e is the orchestrator-led wrap fix that unblocks both. Structurally mirrors D1 R1→R2's postgres wrap fix (explicit `const` generic threading with covariant `ModelLike` constraint).

**Files in play.**

- `packages/3-extensions/mongo/src/contract/define-contract.ts` — rewrite both overloads to thread `const Models`, `const ValueObjects`, `const ExtensionPacks` (etc.) explicitly. Mirror the postgres pattern at `packages/3-extensions/postgres/src/contract/define-contract.ts` L25–101.
- `packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts` (or wherever mongo authoring layer's model builder lives) — if `ContractModelBuilder` (or mongo equivalent) has a contravariant member (D1 R1 contravariance trap), export a covariant `MongoModelLike` interface and re-export it from the relevant `exports/contract-builder.ts`. Verify whether this is needed; if mongo's model builder is purely covariant, skip.
- `packages/3-extensions/mongo/test/contract-builder/define-contract.test-d.ts` — add three positive type assertions: (a) inline `models: { User, Post }` definition form keeps `result.models.User.not.toBeNever()`; (b) factory form ditto; (c) **F3 regression**: discriminated-union model with embedded relation resolves `tasks[0].comments[0].createdAt` to its concrete type (not `never`).
- `test/integration/test/mongo-runtime/query-builder.test.ts` — drop verbose imports + workaround comment, switch to `@internal/mongo/contract-builder`, drop `family`/`target` args, keep all existing `expectTypeOf` assertions.
- `test/integration/test/mongo/fixtures/contract.ts` — drop verbose-with-comment workaround, switch to `@internal/mongo/contract-builder`, drop `family`/`target` args. Remove the F3-workaround comment.

**"Done when":**

- [ ] D5d landed (✓ before dispatch — partial, but the two contract migrations are committed).
- [ ] `pnpm typecheck --filter @internal/mongo --filter @internal/mongo-contract-ts --filter integration-tests` all pass.
- [ ] `pnpm test --filter @internal/mongo` passes — including new positive + regression type assertions in `define-contract.test-d.ts`.
- [ ] `pnpm test:integration test/mongo-runtime/query-builder.test.ts` passes (the previously-blocked migration now typechecks AND `expectTypeOf<PlanRow>` resolves correctly).
- [ ] `pnpm test:integration test/mongo/` covers the F3 fixture using the facade form.
- [ ] `pnpm lint:deps` clean.
- [ ] Grep gate: `rg "@internal/(family-mongo|target-mongo)/(pack|control)" test/integration/test/mongo/ test/integration/test/mongo-runtime/` returns zero hits in the migrated files.
- [ ] F3 closed and F5 closed in `reviews/code-review.md`.
- [ ] No skips. No broad `as unknown as Record<string, unknown>` casts in test bodies. Narrow type-specific casts in the wrap implementation are acceptable when explained (mirror postgres's `as unknown as PostgresResult<...>` pattern — that's the single legitimate one).
- [ ] Intent-validation: diff covers only the mongo wrap + 1-3 mongo authoring exports + mongo wrap test additions + 2 mongo test/fixture migrations. NO postgres/sqlite changes, NO pgvector/postgis touches, NO unrelated cleanup.

**Size.** S–M (wrap rewrite is bounded — postgres pattern transposes line-for-line; the discriminated-union regression test is the riskiest novel piece because it's a type-level test that has to actually exercise the F3 symptom).

**Tier.** Opus-medium (`claude-opus-4-7-thinking-medium`). Cross-package type threading + contravariance assessment + discriminated-union type-level test design = exactly the substantive-work floor SKILL.md establishes for non-mechanical type work. NOT composer-2.5-fast.

**DoR confirmed.** ☑ (D5d's two committed contracts + F4 fix establish baseline; F3+F5 root cause analyzed; postgres pattern is the proven reference; D5e brief at `dispatches/d5e-brief.md`)

---

### Dispatch 6: Docs sweep + final lint/test/fixtures pass

**Intent.** Flip every prose / example-code reference to the old specifier across docs, skills, and READMEs that the renderer dispatch leaves behind. Remove all TML-2526 references outside `projects/`. Final repo-wide lint + test + fixtures pass.

**Files in play.**

- `skills/prisma-next-migrations/SKILL.md` (L52-62 paragraph rewrite; drop TML-2526 + "until then" framing).
- `skills/DEVELOPING.md` L86 (same flip; drop TML-2526).
- `packages/1-framework/1-core/ts-render/README.md` L45 (example code in the README uses façade specifier).
- `packages/1-framework/3-tooling/cli/README.md` L1063 (paragraph describing the scaffolded migration's import line).
- `docs/architecture docs/adrs/ADR 208 - Invariant-aware migration routing.md` L9 (illustrative-code example flips; the ADR's *decision* text stays as-is — it's historical).
- Verify the three façade READMEs reflect their final shape after D1/D2/D3; touch up if anything stale.
- **`test/integration/test/mongo-runtime/query-builder.test.ts`** — add an inline comment at the top of the file (above the imports) referencing TML-2633 and explaining why this file deliberately keeps the verbose `@internal/mongo-contract-ts/contract-builder` import. Mirror the style of the existing comment in `test/integration/test/mongo/fixtures/contract.ts` (also referencing TML-2633 — see next bullet).
- **`test/integration/test/mongo/fixtures/contract.ts`** — update its existing workaround comment to reference TML-2633 explicitly (the current comment describes the symptom but predates the ticket). Same minimal change pattern as `query-builder.test.ts`.

**"Done when":**

- [ ] D1–D5d all landed (D5e deferred to TML-2633; not a blocker for D6).
- [ ] `rg 'TML-2526' -- skills/ docs/ packages/ examples/ test/ projects/` returns hits only inside `projects/facade-import-surface-completion/`.
- [ ] `rg 'TML-2633' -- test/integration/test/mongo/fixtures/contract.ts test/integration/test/mongo-runtime/query-builder.test.ts` returns one hit in each file (the workaround comments).
- [ ] `rg '@internal/target-(postgres|sqlite)/migration' -g '!**/node_modules/**'` returns only:
  - internal target package source (`packages/3-targets/3-targets/{postgres,sqlite}/src/exports/migration.ts` and internal callers),
  - extension-pack hand-authored migrations (`packages/3-extensions/{cipherstash,pgvector,postgis,paradedb}/migrations/**/migration.ts`) — deliberate per A7,
  - extension-pack export docstrings that document the extension authoring contract (cipherstash),
  - pre-existing `examples/**/migrations/app/**/*.ts` files — deliberate per A7 (existing rendered output stays valid),
  - the parity tests in D1/D3 that explicitly bridge the two specifiers.
- [ ] `pnpm lint:deps` clean.
- [ ] `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e` clean (modulo any pre-existing environmental flakes — note unrelated TML-2631 mongo example contract.json validator drift is out of scope; if mongo tests fail with `storage.collections must be an object`, that's TML-2631, not D6).
- [ ] `pnpm fixtures:check` clean.
- [ ] Intent-validation: diff covers only docs / skills / READMEs + the two mongo test-file workaround comments; no source change.

**Size.** S.

**Tier.** Cheap (`composer-2.5-fast`). Purely mechanical prose + comment edits with explicit file:line targets.

**DoR confirmed.** ☑ (D5d's two committed contracts + F4 fix establish baseline; D5e formally deferred to TML-2633; spec § A8 + plan § D5e document the deferred state; D6 brief at `dispatches/d6-brief.md`)

---

## Sequencing summary

```text
D1 (postgres /migration + contract-builder wrap) ─┐
D2 (mongo parity + ctrl + bson + cb-wrap + drop barrel) ─┤
                                                  ├→ D4 (renderer + IR-constant flip + test sweep) → D5a (examples) → D5b (test fixtures) → D5c (break layering cycles) → D5d (migrate pgvector+postgis contracts + F4 fix) → ~~D5e~~ deferred to [TML-2633](https://linear.app/prisma-company/issue/TML-2633) → D6 (docs + mongo workaround comments)
D3 (sqlite façade + contract-builder wrap) ───────┘
```

D1, D2, D3 are independent — they can land in any order or in parallel commits within a single PR. D4 requires D1 + D3 (it switches both renderers; postgres + sqlite façade `/migration` must both resolve). D5a requires D1 + D2 + D3 (example apps + contract.ts files consume all three facades' new APIs and the wrapped `defineContract`). D5b requires D5a only to establish the migration pattern. D5e requires D5d (was unplanned at slice-spec time; surfaced by D5d R1 halting on a mongo facade wrap-signature gap that's structurally identical to D1 R1's postgres bug). D6 requires everything else; it's the closing dispatch.

Each merged commit must keep `pnpm test:packages`, `pnpm fixtures:check`, and `pnpm lint:deps` green. The renderer switch is the only dispatch where multiple files change atomically; everything else is independently revertable.
