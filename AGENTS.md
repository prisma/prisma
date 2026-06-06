# Prisma Repository – Agent Field Notes

> **Meta note**: This is the primary agent knowledge base file. `CLAUDE.md` and `GEMINI.md` are symlinks to this file—always edit `AGENTS.md` directly. When learning something new about the codebase that would help with future tasks, update this file immediately.

- **Repository scope**: Monorepo for Prisma ORM, CLI, client, tests, etc. Many packages use TypeScript, Rust and WebAssembly (via engines), TSX, and Jest; automation relies on `pnpm`. Expect large fixture directories and generated files.
- **Workspace layout**: Managed via pnpm workspaces and Turborepo (`turbo.json`). Node ^20.19 || ^22.12 || >=24.0 and pnpm >=10.15 <11 are required (see root `package.json`). Top-level scripts (`pnpm build`, `pnpm dev`, `pnpm test`) delegate into `scripts/ci/publish.ts`; package-specific commands run with `pnpm --filter @prisma/<pkg> <script>`. Turborepo caches builds; run `pnpm build` from root to build all packages in dependency order.
- **Key packages**: `packages/cli` (Prisma CLI entry point), `packages/migrate` (migrate/db namespace + fixtures), `packages/client` (client runtime), `packages/client-generator-ts` (new `prisma-client` generator), `packages/client-generator-js` (traditional `prisma-client-js` generator), `packages/client-generator-registry` (generator registry for managing generators), `packages/client-engine-runtime` (the core part of the new Rust binary free client based on Wasm query compiler, used by `ClientEngine` class in `packages/client`), `packages/client-common` (shared client utilities), `packages/client-runtime-utils` (utility types and singletons for Prisma Client), `packages/config` (`PrismaConfigInternal` + loader), `packages/internals` (shared CLI + engine glue), `packages/engines` (Rust binaries download wrapper), `packages/integration-tests` (matrix suites), `packages/query-plan-executor` (standalone query plan executor service for Prisma Accelerate), `packages/credentials-store` (credential storage utilities), sqlcommenter packages under `packages/sqlcommenter*`, and numerous driver adapters under `packages/adapter-*`.
- **Driver adapters & runtimes**: `packages/bundled-js-drivers` plus the `adapter-*` packages ship JS driver adapters: `adapter-pg`, `adapter-neon`, `adapter-libsql`, `adapter-planetscale`, `adapter-d1`, `adapter-better-sqlite3`, `adapter-mssql`, `adapter-mariadb`, `adapter-ppg` (Prisma Postgres Serverless). These are built on helpers in `driver-adapter-utils`; migrate/client fixtures exercise them, so adapter changes typically require fixture/test updates. CI tests driver adapters with flavors: `js_pg`, `js_neon`, `js_libsql`, `js_planetscale`, `js_d1`, `js_better_sqlite3`, `js_mssql`, `js_mariadb`, `js_pg_cockroachdb`.
- **Build & tooling**: Typescript-first repo with WASM/Rust assets (downloaded by `@prisma/engines`). Multiple `tsconfig.*` drive bundle vs runtime builds. Lint via `pnpm lint`, format via `pnpm format`. Maintenance scripts live in `scripts/` (e.g. `bump-engines.ts`, `bench.ts`, `ci/publish.ts` orchestrates build/test/publish flows). Build configuration uses esbuild via `helpers/compile/build.ts` with configs in `helpers/compile/configs.ts`. Most packages use `bundledConfig` which bundles to both CJS and ESM with type declarations.
- **Benchmarking**: Comprehensive performance benchmarks using Benchmark.js with CodSpeed integration. See `docs/benchmarking.md` for full documentation. Key commands:
  - `pnpm bench` - Run all benchmarks (outputs to `output.txt`)
  - `pnpm bench <pattern>` - Run benchmarks matching pattern
  - Benchmark locations:
    - End-to-end query performance: `packages/client/src/__tests__/benchmarks/query-performance/query-performance.bench.ts`
    - Query compilation/cache behavior: `packages/client/src/__tests__/benchmarks/query-performance/caching.bench.ts`
    - Query interpreter/data mapper: `packages/client-engine-runtime/bench/interpreter.bench.ts`
    - Query plan cache memory probe: `pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts`
    - Local `ClientEngine` cache-hit timing probe with empty SQLite adapter: `pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/client-engine-cache-timing.ts`
    - Miniflare/workerd query compiler memory probe: `pnpm exec node --expose-gc --import tsx packages/client/src/__tests__/benchmarks/query-performance/workerd-query-compiler-memory.ts`
    - Client generation: `packages/client/src/__tests__/benchmarks/huge-schema/`, `packages/client/src/__tests__/benchmarks/lots-of-relations/`
  - Benchmarks run automatically on CI via `.github/workflows/benchmark.yml`; CodSpeed tracks performance over time and alerts on >100% regression.
  - The ongoing Prisma Client performance investigation journal is `wip/client-performance-journal.md`; update it after each accepted change, rejected experiment, measurement, and new lead so work survives context compactions and harness restarts.
  - For Cloudflare/workerd probes, instantiate query compiler Wasm through a static module import / Miniflare `CompiledWasm` module. Dynamic `new WebAssembly.Module(bytes)` inside the worker fails with `Wasm code generation disallowed by embedder`.
- **Testing & databases**: `TESTING.md` covers Jest/Vitest usage. Most suites run as `pnpm --filter @prisma/<pkg> test <pattern>`. DB-backed tests expect `.db.env` and Docker services from `docker/docker-compose.yml` (`docker compose up -d`). Client functional tests sit in `packages/client/tests/functional`—run them via `pnpm --filter @prisma/client test:functional` (with typechecking) or `pnpm --filter @prisma/client test:functional:code` (code only); `helpers/functional-test/run-tests.ts` documents CLI flags to target providers, drivers, etc. Client e2e suites require a fresh `pnpm build` at repo root, then `pnpm --filter @prisma/client test:e2e --verbose --runInBand`. The legacy `pnpm --filter @prisma/client test` command primarily runs the older Jest unit tests plus `tsd` type checks. Migrate CLI suites live in `packages/migrate/src/__tests__`, the CLI runs both Jest (legacy suites) and Vitest (new subcommand coverage) via `pnpm --filter prisma test`, and end-to-end coverage lives in `packages/integration-tests`.

- **Client functional tests structure**:
  - Each test lives in its own folder under `packages/client/tests/functional/` (or `issues/` for regression tests).
  - Required files: `_matrix.ts` (test configurations), `test.ts` or `tests.ts` (test code), `prisma/_schema.ts` (schema template).
  - `_matrix.ts` defines provider/adapter combinations using `defineMatrix(() => [[{provider: Providers.POSTGRESQL}, ...]])`.
  - `prisma/_schema.ts` exports `testMatrix.setupSchema(({ provider }) => ...)` returning a Prisma schema string.
  - Test file uses `testMatrix.setupTestSuite(() => { test(...) }, { optOut: { from: [...], reason: '...' } })`.
  - Run specific adapter: `pnpm --filter @prisma/client test:functional:code --adapter js_pg <pattern>` (adapters: `js_pg`, `js_neon`, `js_libsql`, `js_planetscale`, `js_d1`, `js_better_sqlite3`, `js_mssql`, `js_mariadb`, `js_pg_cockroachdb`).
  - For error assertions, use `result.name === 'PrismaClientKnownRequestError'` and `result.code` (not `instanceof`).
  - Use `idForProvider(provider)` from `_utils/idForProvider` for portable ID field definitions.

- **Docs & references**: `ARCHITECTURE.md` contains dependency graphs (requires GraphViz to regenerate), `docker/README.md` explains local DB setup, `docs/benchmarking.md` covers performance benchmarking, `examples/` provides sample apps, and `sandbox/` hosts debugging helpers like the DMMF explorer.

- **Client architecture (Prisma 7)**:
  - `ClientEngine` in `packages/client/src/runtime/core/engines/client/` orchestrates query execution using Wasm query compiler.
  - `ClientEngine` query plan cache defaults are build-target specific: Node.js `client` builds keep up to 1000 entries, while `wasm-compiler-edge` builds keep up to 100 entries by default to reduce retained memory. `queryPlanCacheMaxSize: 0` disables the cache.
  - `ClientEngine.request()` and `requestBatch()` use a synchronous connected-engine fast path before falling back to async `#ensureStarted()`; keep that path when editing hot request flow because it avoids an avoidable async hop on warmed clients.
  - Keep disabled debug logging out of `ClientEngine` warmed request hot paths. `@prisma/debug` records call arguments in a global history even when the namespace is not enabled, so unguarded per-request `debug(...)` calls can retain query plans and add microseconds of overhead.
  - `QueryPlanCache` interns repeated string values only for join-shaped plans and only for strings with length >= 8. The interner is refcounted per cache entry so updates, evictions, and `clear()` release strings from old plans; avoid broad all-plan string interning because scalar-selection plans mostly have unique SQL strings and can regress from bookkeeping overhead.
  - `client-engine-cache-timing.ts` has cached request wrapper rows using real `QueryPlanCache` + `LocalExecutor`. After the disabled-debug guard, generic `ClientEngine` wrapper glue is a small part of warmed cache-hit cost; bigger remaining targets are cache-key/parameterization and cached-plan execution/rendering.
  - Non-compacted `multi` batch query plans can also populate the single-query plan cache when the individual plans fit within the configured cache size. This lets later matching single queries reuse plans compiled as part of a mixed batch. Compacted batches are intentionally not decomposed.
  - `packages/client/src/__tests__/benchmarks/query-performance/workerd-query-compiler-memory.ts` has raw compile-retention scenarios and `mode=client-cache` scenarios that manually parameterize benchmark value churn to approximate ClientEngine cache hit behavior inside Miniflare/workerd.
  - Two executor implementations: `LocalExecutor` (driver adapters, direct DB) and `RemoteExecutor` (Accelerate/Data Proxy).
  - `QueryInterpreter` class in `packages/client-engine-runtime/src/interpreter/query-interpreter.ts` executes query plans against `SqlQueryable` (driver adapter interface).
  - Query flow: `PrismaClient` → `ClientEngine.request()` → query compiler → `executor.execute()` → `QueryInterpreter.run()` → driver adapter.
  - Local `ClientEngine` execution opts `QueryInterpreter` into native JS result values and marks non-raw responses so `RequestHandler` skips JSON-protocol deserialization; `RemoteExecutor` and `packages/query-plan-executor` keep JSON-protocol-shaped values and must not skip normalization/deserialization.
  - Query-plan result field nodes inside object `fields` may omit `type: 'field'` and may omit `dbName` when it is identical to the result field key; `packages/client-engine-runtime/src/interpreter/data-mapper.ts` recognizes field nodes by `fieldType` and defaults missing `dbName` to that key. Explicit `dbName` is still required when SQL column names differ from the result field key.
  - Query-plan `templateSql.fragments` may contain raw string fragments for SQL chunks plus tagged objects for parameters/tuples; `packages/client-engine-runtime/src/interpreter/render-query.ts` intentionally accepts both raw strings and legacy `{ type: 'stringChunk', chunk }` objects.
  - Wasm query compilation currently crosses the JS/Wasm boundary with a JSON request string (`QueryCompiler.compile(request: string)` / `compileBatch(request: string)`). On the Rust side, `RequestBody::try_from_str` deserializes into `JsonBody`, whose arguments and selections use heap-allocated Rust maps/`serde_json::Value`, and then `JsonProtocolAdapter` walks that tree again into `ArgumentValue`/`Selection`. Replacing string deserialization with `serde_wasm_bindgen::from_value` would only remove JS-side request parsing unless the request parser itself is reworked to validate directly over `js_sys` values or another typed/lazy representation.
  - A temporary release-Wasm phase probe over query compiler fixture reads showed JSON request decoding around 4-7 microseconds (roughly 4-6% of internal compile+serialize time), `into_doc` around 5-7 microseconds for common reads, compiler work around 50-60%, and plan serialization often around 25-35% (up to ~39% for nested create). Treat `serde_wasm_bindgen::from_value` as a low-ceiling optimization unless it also removes the request stringify/cache-key path or the owned `JsonBody`/`serde_json::Value` tree; plan serialization and compiler-owned allocations are larger targets.
  - Many driver adapters construct fresh `SqlResultSet.columnNames` / `columnTypes` arrays for each query result (e.g. via driver field metadata maps). Runtime caches that need to survive repeated real DB calls should not rely only on result metadata array identity; cache by stable column shape when appropriate.
  - `ExecutePlanParams` interface in `packages/client/src/runtime/core/engines/client/Executor.ts` defines what's passed through the execution chain.
  - `TransactionManager` in `packages/client-engine-runtime/src/transaction-manager/transaction-manager.ts` owns interactive transaction IDs and implements nested transactions using savepoints. Savepoint SQL is provider-specific (e.g. PostgreSQL uses `ROLLBACK TO SAVEPOINT <name>`, MySQL/SQLite use `ROLLBACK TO <name>`, SQL Server uses `SAVE TRANSACTION <name>` / `ROLLBACK TRANSACTION <name>` and has no release statement).
  - `Transaction` in `packages/driver-adapter-utils` models savepoint behavior as async methods (`createSavepoint`, `rollbackToSavepoint`, optional `releaseSavepoint`) instead of returning SQL via `savepoint(action, name)`. `TransactionManager` expects adapter methods for savepoints and does not synthesize provider fallback SQL.
  - Fluent API `dataPath` is built in `packages/client/src/runtime/core/model/applyFluent.ts` by appending `['select', <relationName>]` on each hop; runtime unpacking in `packages/client/src/runtime/RequestHandler.ts` currently strips `'select'`/`'include'` segments before `deepGet`.
  - In extension context resolution, `dataPath` should be interpreted as selector/field pairs (`select|include`, relation field). Do not strip by raw string value or relation fields literally named `select`/`include` get dropped.
  - In `packages/client-engine-runtime/src/parameterization/parameterize.ts`, `Object.keys()` based copy-on-write traversal benchmarked faster than guarded `for...in` traversal despite the extra key-array allocation. Do not replace those loops with `for...in` for allocation reasons unless a new benchmark proves it.
  - Lazy caching of `ParamGraph.inputNode()` / `outputNode()` wrapper objects produced mixed/noisy `query-performance/caching.bench.ts` results and did not clearly improve nested parameterization; keep the current fresh `{ id }` wrappers unless a new benchmark proves otherwise.
  - In `packages/client-engine-runtime/src/interpreter/render-query.ts`, a primitive fast path inside `evaluateArgs()` benchmarked slower across interpreter scenarios; keep the straight `evaluateArg(args[i], ...)` loop unless new evidence changes.
  - In `packages/client-engine-runtime/src/interpreter/query-interpreter.ts`, single-column strict join attachment can avoid `JSON.stringify([key])` once parent+child rows are large enough. Keep the row-count threshold: applying the scalar-key path to tiny joins regressed the `interpreter: join (1:N)` benchmark even though it helped deep nested joins.

- **Adding PrismaClient constructor options**:
  - Runtime types: `PrismaClientOptions` in `packages/client/src/runtime/getPrismaClient.ts`.
  - Validation: `packages/client/src/runtime/utils/validatePrismaClientOptions.ts` (add to `knownProperties` array and `validators` object).
  - Engine config: `EngineConfig` interface in `packages/client/src/runtime/core/engines/common/Engine.ts`.
  - Generated types: Update both `packages/client-generator-js/src/TSClient/PrismaClient.ts` (`buildClientOptions` method) and `packages/client-generator-ts/src/TSClient/file-generators/PrismaNamespaceFile.ts` (`buildClientOptions` function).
  - Use `@prisma/ts-builders` for generating TypeScript type declarations.
  - Current known options: `errorFormat`, `adapter`, `accelerateUrl`, `log`, `transactionOptions`, `omit`, `comments`, `__internal`.

- **Creating new packages**:
  - Create directory under `packages/`, add `package.json`, `tsconfig.json`, `tsconfig.build.json`, and `helpers/build.ts`.
  - Package is auto-discovered via `pnpm-workspace.yaml` glob `packages/*`.
  - For type-only packages, use `bundledConfig` from `helpers/compile/configs.ts`.
  - Add as dependency to consuming packages using `"workspace:*"` version.
  - **Important**: Add resolution path to `tsconfig.build.bundle.json` under `compilerOptions.paths` for go-to-definition to work in editors.
  - **Important**: If the package has tests, add it to `.github/workflows/test-template.yml`. Utility packages typically go in:
    - `others` job (Linux, no Docker): includes `debug`, `generator-helper`, `get-platform`, `fetch-engine`, `engines`, `instrumentation`, `instrumentation-contract`, `schema-files-loader`, `config`, `dmmf`, `generator`, `credentials-store`, `sqlcommenter-*` packages.
    - `client-packages` job: includes `client-common`, `client-engine-runtime`, `ts-builders`, `client-generator-js`, `client-generator-ts`, `client-generator-registry`.
    - `driver-adapter-unit-tests` job: includes `adapter-libsql`, `adapter-mariadb`, `adapter-d1`, `adapter-pg`, `adapter-planetscale`, `adapter-mssql`, `adapter-neon`.
    - `no-docker` job (Windows/macOS): mirrors the `others` and `client-packages` jobs for cross-platform testing.

- **Prisma 7 direction**: Migration from `schema.prisma` datasource URLs / `env()` to `prisma.config.ts`. Commands, tests, and fixtures should read connection settings from `PrismaConfigInternal.datasource` (or driver adapters) rather than CLI flags or environment loading. SQLite datasource URLs now resolve relative to the config file and not to the schema.
- **Test helpers**: `ctx.setConfigFile('<name>')` (from `__helpers__/prismaConfig.ts`) overrides the config used for the next CLI invocation and is automatically reset after each test, so no explicit cleanup is needed. Many migrate fixtures now provide one config per schema variant (e.g. `invalid-url.config.ts` next to `prisma/invalid-url.prisma`) and tests swap them via `ctx.setConfigFile(...)`. `ctx.setDatasource`/`ctx.resetDatasource` continue to override connection URLs when needed.

- **CLI commands**: Most commands already accept `--config` for custom config paths. Upcoming work removes `--schema` / `--url` in favour of config-based resolution. When editing CLI help text, keep examples aligned with new config-first workflow.
  - For isolated Studio verification, you can run `packages/cli/src/Studio.ts` directly via `pnpm exec tsx` and pass a config object that preserves `loadedFromFile`; this keeps SQLite URLs resolving relative to the config file while avoiding unrelated `packages/cli/src/bin.ts` imports.
  - Studio is now pre-bundled into `packages/cli/build/studio.js` and `packages/cli/build/studio.css`, served only through explicit routes in `packages/cli/src/Studio.ts` via the runtime-specific `packages/cli/src/studio-server.ts` bindings, and should keep listener-level coverage in `packages/cli/src/__tests__/studio-server.vitest.ts` because a past Node regression dropped `GET` bodies by treating them like `HEAD`.
  - If Enter or click does not open a cell editor in Studio, verify that the current table and column are writable before assuming a keyboard regression; views/system tables and read-only columns legitimately stay non-editable.

- **Driver adapters datasource**:
  - Helper `ctx.setDatasource()` in tests overrides config.datasource for connection-specific scenarios.

- **Testing patterns**:
  - Tests rely on fixtures under `packages/**/src/__tests__/fixtures`; many now contain `prisma.config.ts`.
  - Default Jest/Vitest runner is invoked via `pnpm --filter @prisma/<pkg> test <pattern>`; it wraps `dotenv` and expects `.db.env`.
    - Some packages already use Vitest, `packages/cli` uses both for different tests as it's in the process of transition, older packages still use Jest.
  - Functional generated clients in `packages/client/tests/functional/**/.generated` import `packages/client/runtime/client.js` directly; runtime changes in `src/runtime` may need corresponding runtime bundle updates to be exercised by functional tests.
  - Client e2e `_steps.ts` files run inside `packages/client/tests/e2e/_utils/standard.dockerfile`; the startup script exports `NODE_PATH` for CommonJS and symlinks globally installed `zx` into `/test/node_modules` because ESM package resolution ignores `NODE_PATH`. Linux Docker runs may need SELinux-compatible bind mounts (`:z`) for mounted e2e files to be readable in the container.
  - Inline snapshots can be sensitive to formatting; prefer concise expectations unless the exact message matters.

- **Environment loading**: Prisma 7 removes automatic `.env` loading.

- **Driver adapter error handling**:
  - Database errors are mapped in each adapter's `errors.ts` (e.g., `packages/adapter-pg/src/errors.ts`).
  - `MappedError` type in `packages/driver-adapter-utils/src/types.ts` defines all known error kinds.
  - Known error kinds include: `GenericJs`, `UnsupportedNativeDataType`, `InvalidIsolationLevel`, `LengthMismatch`, `UniqueConstraintViolation`, `NullConstraintViolation`, `ForeignKeyConstraintViolation`, `DatabaseNotReachable`, `DatabaseDoesNotExist`, `DatabaseAlreadyExists`, `DatabaseAccessDenied`, `ConnectionClosed`, `TlsConnectionError`, `AuthenticationFailed`, `TransactionWriteConflict`, `TableDoesNotExist`, `ColumnNotFound`, `TooManyConnections`, `ValueOutOfRange`, `InvalidInputValue`, `MissingFullTextSearchIndex`, `SocketTimeout`, `InconsistentColumnData`, `TransactionAlreadyClosed`, and database-specific kinds (`postgres`, `mysql`, `sqlite`, `mssql`).
  - `convertDriverError()` in each adapter maps database-specific error codes to `MappedError` kinds.
  - `rethrowAsUserFacing()` in `packages/client-engine-runtime/src/user-facing-error.ts` maps `MappedError` kinds to Prisma error codes (P2xxx).
  - To add a new error mapping: (1) add kind to `MappedError` in driver-adapter-utils, (2) map database error code in relevant adapter(s), (3) add Prisma code mapping in `getErrorCode()` and message in `renderErrorMessage()`.
  - Raw queries (`$executeRaw`, `$queryRaw`) use `rethrowAsUserFacingRawError()` which always returns P2010; regular Prisma operations use `rethrowAsUserFacing()`.
  - When no specific mapping exists for a database-specific kind (`postgres`, `mysql`, `sqlite`, `mssql`) — i.e. the adapter didn't recognize the underlying DB error code — `rethrowAsUserFacing()` falls back to a P2039 `UserFacingError` with the message `Database error. Code: <originalCode>. Message: <originalMessage>` carrying the raw `originalCode` / `originalMessage`. This keeps the DB error surface as `PrismaClientKnownRequestError` locally and as an HTTP 400 from the query plan executor (instead of HTTP 500, which Accelerate strips), so that schema-drift-style failures (stale migrations, stale generated client, etc.) remain debuggable. Raw queries keep the historical P2010 (`Raw query failed. Code: <originalCode>. Message: <originalMessage>`) via `rethrowAsUserFacingRawError()`; P2039 is used for non-raw queries so the message doesn't claim a regular Prisma operation was a raw query. Truly unknown `kind` values still fall through to `assertNever` so new driver-adapter variants surface clearly during development.
  - Prisma error codes currently assigned outside the documented public Error Reference (P2000–P2037) are: **P2038** — used for the `PrismaClientInitializationError` raised by `ClientEngine` when no driver adapter is configured (see `CLIENT_ENGINE_ERROR` in `packages/client/src/runtime/core/engines/client/ClientEngine.ts`); **P2039** — used for unmapped database-specific driver-adapter errors as described above. Pick the next available code (P2040, …) for any new additions and document it here.

- **SQL Commenter packages**:
  - `@prisma/sqlcommenter`: Core types (`SqlCommenterPlugin`, `SqlCommenterContext`, `SqlCommenterQueryInfo`, `SqlCommenterTags`) for building sqlcommenter plugins.
  - `@prisma/sqlcommenter-query-tags`: AsyncLocalStorage-based plugin for adding ad-hoc tags via `withQueryTags()` and `withMergedQueryTags()`.
  - `@prisma/sqlcommenter-trace-context`: Plugin for adding W3C Trace Context `traceparent` header to queries.
  - `@prisma/sqlcommenter-query-insights`: Plugin for adding parameterized query shapes to comments (format: `Model.action:base64Payload`).
  - Plugins are registered via `PrismaClient({ comments: [plugin1(), plugin2()] })`.
  - E2E tests for sqlcommenter plugins live in `packages/client/tests/e2e/sqlcommenter*` directories.
  - `SqlCommenterQueryInfo` distinguishes `type: 'single'` (single query) vs `type: 'compacted'` (batched queries merged into one SQL statement). For non-raw client-engine queries, the SQL commenter context should receive parameterized query payloads so plugins such as query-insights never see user data values.

- **Codebase helpers to know**:
  - `@prisma/internals` exports CLI utilities: `arg`, `loadSchemaContext` (less used now).
  - `packages/migrate/src/__tests__/__helpers__/context.ts` sets up Jest helpers including config contributors.
  - `packages/config` defines `PrismaConfigInternal`; inspect when validating config assumptions.
  - `@prisma/ts-builders` provides a fluent API for generating TypeScript code (interfaces, types, properties with doc comments).
  - `@prisma/driver-adapter-utils` defines core interfaces: `SqlQuery`, `SqlQueryable`, `SqlDriverAdapter`, `SqlDriverAdapterFactory`, `SqlMigrationAwareDriverAdapterFactory`, `MappedError` for error handling, `ConnectionInfo`, `Provider` type (`'mysql' | 'postgres' | 'sqlite' | 'sqlserver'`).
  - `@prisma/client-engine-runtime` exports query interpreter, transaction manager, and related utilities.
  - `@prisma/client-common` provides shared client utilities used by both generators and runtime.
  - `@prisma/client-runtime-utils` provides utility types and singletons for Prisma Client.
  - Query-plan SQL `argTypes` are forwarded to driver adapters; `dbType` is optional in `@prisma/driver-adapter-utils`, so absent native database types should be omitted from Wasm plan serialization rather than emitted as `dbType: null`.
  - Query-plan SQL `argTypes` may serialize scalar/no-native-DB parameter types as raw scalar strings (for example `"int"` or `"bigint"`) and scalar/native-DB parameter types as `[scalarType, dbType]` tuples (for example `["int", "INTEGER"]`). The client-engine-runtime renderer expands compact arg types back to adapter-facing `{ arity: 'scalar', scalarType, dbType? }` objects before calling driver adapters; tuple arg-type elements need the same normalization.
  - Query-plan SQL `templateSql` queries may serialize as a compact tuple `[fragments, [prefix, hasNumbering], args, argTypes, chunkable]`. Raw SQL remains object-shaped. The client-engine-runtime renderer accepts both the legacy object-shaped `templateSql` form and the compact tuple form.
  - Query-plan SQL `templateSql.fragments` may serialize scalar parameter placeholders as `null`, tuple placeholders as `["T", itemPrefix, itemSeparator, itemSuffix]`, and tuple-list placeholders as `["L", itemPrefix, itemSeparator, itemSuffix, groupSeparator]`; legacy `{ type: 'parameter' }`, `{ type: 'parameterTuple' }`, and `{ type: 'parameterTupleList' }` objects are still accepted. SQL string chunks are raw strings.
  - Query-plan `PrismaValue::Placeholder` values may serialize as `{ "$p": [name, type] }`; legacy `{ prisma__type: "param", prisma__value: { name, type } }` objects are still accepted. `PrismaValue::GeneratorCall` values may serialize as `{ "$g": [name, args] }`; legacy `{ prisma__type: "generatorCall", prisma__value: { name, args } }` objects are still accepted. Use the query-plan placeholder/generator helpers in `packages/client-engine-runtime/src/query-plan.ts` instead of reading either shape directly.
  - Query-plan expression nodes may serialize as compact tagged tuples in addition to the legacy `{ type, args }` objects. Current compact tags are `v` value, `s` seq, `g` get, `l` let, `e` get-first-non-empty, `q` query, `x` execute, `+` sum, `c` concat, `u` unique, `r` required, `j` join, `m` map-field, `t` transaction, `d` data-map, `V` validate, `?` if, `0` unit, `-` diff, `i` initialize-record, `M` map-record, and `p` process. The TS interpreter accepts both shapes.
  - Query-plan support structures may also be compact tuples: let-bindings as `[name, expr]` and join expressions as `[child, on, parentField, isRelationUnique]`. Legacy `{ name, expr }` bindings and `{ child, on, parentField, isRelationUnique }` join objects are still accepted; use the query-plan helpers instead of direct property reads.
  - Query-plan validation `DataRule`s may serialize compactly: `["=", count]` for `rowCountEq`, `["!", count]` for `rowCountNeq`, `["a", count]` for `affectedRowCountEq`, and `"n"` for `never`. Legacy `{ type, args }` rules are still accepted; use `getDataRuleType()` / `getDataRuleArgs()` instead of direct property reads.
  - Query-plan validation errors may serialize compact identifiers and contexts: `r` relation violation as `[relation, modelA, modelB]`, `m` missing related record as `[model, relation, relationType, operation, neededFor?]`, `M` missing record as the operation string, `i` incomplete connect input as `expectedRows`, `o` incomplete connect output as `[expectedRows, relation, relationType]`, and `n` records not connected as `[relation, parent, child]`. Legacy validation error objects are still accepted; use `getValidationError()` before calling `performValidation()`.
  - Query-plan process-node `InMemoryOps` may omit default fields. The TS interpreter treats missing `pagination` / `distinct` / `linkingFields` as `null`, missing `reverse` as `false`, missing `nested` as `{}`, and missing pagination `cursor` / `take` / `skip` as `null`.
  - Query-plan result `FieldType.arity` is only semantically needed for list fields in the TS data mapper. Omitted arity means non-list; do not reintroduce required/optional scalar arity into Wasm plan serialization.
  - Query-plan result object nodes may serialize as compact tuples `[serializedName, fields]` or `[serializedName, fields, true]` when `skipNulls` is true. The data mapper accepts both compact tuples and the legacy `{ type: 'object', serializedName, fields, skipNulls }` shape.
  - Query-plan result field nodes may omit `type: "field"` and default `dbName` metadata; field nodes are identified by `fieldType`, and missing `dbName` means the surrounding result-object key. Non-list primitive scalar default-`dbName` fields may serialize directly as raw strings in result object `fields` (for example `"int"` or `"string"`). Object-shaped `fieldType` remains for list, enum, bytes, extension, and explicit `dbName` metadata.
  - `packages/client/src/__tests__/benchmarks/query-performance/query-plan-cache-memory.ts` includes concrete and parameterized blog-page scenarios. The parameterized scenarios mirror `ClientEngine` cache-key semantics by running `parameterizeQuery()` before `JSON.stringify(parameterizedQuery.query)` and `compiler.compile()`.

- **Coding conventions**:
  - Use **kebab-case** for new file names (e.g., `query-utils.ts`, `filter-operators.test.ts`).
  - **Avoid creating barrel files** (`index.ts` that re-export from other modules). Import directly from the source file (e.g., `import { foo } from './utils/query-utils'` not `import { foo } from './utils'`), unless `./utils/index.ts` file already exists (in which case use it for consistency with surrounding code).
  - **Avoid adding useless code comments that do not add new information for the reader**.
    Inline code comments can be broadly categorized as answering one of the three questions:
    - _What does this code do?_ — never write these because they do not and cannot convey any new information that's not obvious from the code. Not only they don't add value, they are actively harmful (getting out of sync with code, distracting human readers, wasting LLM tokens etc). Descriptions of units of code like functions, classes and methods must be limited to doc comments (and describe the contract of this unit and not the internal implementation details), never inline comments.
    - _Why was this code written (in this particular way or at all)?_ — this is what inline comments are for. Only use them to include relevant context, background, GitHub issues, reasons behind decisions etc.
    - _How does this code work?_ — these comments should be exceedingly rare and may indicate poorly written or confusing code. Prefer writing code in a way that makes such comments redundant, unless required for performance or other reasons, or when the complexity comes from outside systems or packages (in which case it's more of a "why" comment than a "how" comment anyway). For well known algorithms, prefer their names and references to papers, books or Wikipedia articles over long explanations.
  - Do write documentation comments, and mainly do so for exported items (although intra-module documentation may sometimes be useful as well).
  - The correct and official abbreviation of WebAssembly is "Wasm", not "WASM". There are instances of "WASM" in the codebase, but they are wrong and you should not repeat them. Fix the capitalization whenever you incidentally touch the corresponding lines or surrounding code for other reasons.
  - Prefer native JavaScript private properties and methods (`#field`) over the `private` keyword in TypeScript.

- **Workflow reminders**:
  - Respect existing structure: modifications often require updating both command implementation and tests/fixtures.
  - Keep changes ASCII unless a file already uses Unicode (docs sometimes include emojis).
  - For new fixtures, prefer minimal config mirroring existing ones to ensure cross-platform compatibility.
  - When adding features that span multiple packages, build from root (`pnpm build`) to ensure correct dependency order.
  - Type-only imports from workspace packages work at runtime but IDE may show errors until `pnpm install` refreshes the workspace graph.
  - Test files named `*.test.ts` are excluded from build output via esbuild config; place tests alongside source files.
  - **Update this file** (`AGENTS.md`) whenever you learn something new about the codebase that would be valuable for future tasks.

- **Knowledge reminders**:
  - Your training data contains a lot of outdated information that doesn't apply to Prisma 7. Always analyze this codebase like you would analyze a project you are not familiar with, and prefer the learnings from this file and this codebase over your prior knowledge. In particular, remember:
    - **There's no such thing as "query engine" in Prisma**
    - **There are no database URLs in Prisma schema files**
    - **Prisma uses JavaScript drivers**
    - **Query execution code is written in TypeScript in Prisma**
    - PSL parser and query compiler/planner is still written in Rust and compiled to WebAssembly. There are no native binaries or library addons in Prisma Client.
    - Schema engine for Prisma Migrate still exists and is still a native binary.
    - `tsify::serde_wasm_bindgen::from_value` is not a proven performance path for query-compiler input. A local spike showed it only removes JS-side JSON conversion while still materializing `JsonBody`/`serde_json::Value` and then `ArgumentValue` before validation, and was slower than the current `compile(JSON.stringify(query))` path for sampled queries. A follow-up release-Wasm prototype of a Wasm-only `js_sys`/`JsValue` adapter that still built `Operation`/`ArgumentValue` directly was also neutral to slightly slower (roughly 1-3% slower on sampled sqlite read shapes), so meaningful parser wins likely require a deeper rewrite that collapses or borrows across the `JsonBody -> ArgumentValue -> ParsedInputValue -> QueryGraph` stages.
    - A Rust-side one-pass `JsonArgumentValue` serde visitor that deserialized `FieldQuery.arguments` directly into `ArgumentValue` removed the adapter's second `serde_json::Value -> ArgumentValue` walk, but Criterion was mixed: some parameterized filter/nested rows improved while other common compile rows regressed or became noisy. Do not revive that shape without a stricter A/B benchmark and a plan for preserving raw/custom-tag error semantics.

## Debugging and making changes to Rust/WebAssembly code

When you need to check the code or make some changes in Rust codebase, assume the repository is checked out in the `prisma-engines` directory above the root of this repo. Determine the absolute path to the current project on the filesystem (e.g. `/home/user/work/prisma`) and infer the directory of the `prisma-engines` repo (e.g. `/home/user/work/prisma-engines`, let's call it `$PRISMA_ENGINES_ROOT`).

After you make some changes there, use these commands in the prisma-engines repo to build the Wasm modules:

```sh
make build-schema-wasm
make build-qc-wasm
```

Then, back in `prisma` repo:

```sh
pnpm upgrade -r @prisma/prisma-schema-wasm@file:$PRISMA_ENGINES_ROOT/target/prisma-schema-wasm
pnpm upgrade -r @prisma/query-compiler-wasm@file:$PRISMA_ENGINES_ROOT/query-compiler/query-compiler-wasm/pkg
pnpm build
```

You may only need to build and update one of these modules if your changes are isolated in scope:

1. Build only `prisma-schema-wasm` if your changes are isolated to schema and DMMF, and you are only going to run the CLI and generator tests, not Client.
2. Build only `query-compiler-wasm` if your changes are related to query planning and execution but do not touch the schema or DMMF in any way.

When in doubt, build both to avoid unexpected behavior. Time and cost of compilation is always less than of debugging.

`make build-qc-wasm` runs `query-compiler/query-compiler-wasm/build.sh`, which expects `jq` on `PATH` for `cargo metadata` and package version rewriting. In minimal harnesses without `jq`, provide a temporary local shim or install `jq` before running the build.

`cargo test -p request-handlers protocols::json::protocol_adapter --lib` can fail in the default local engines checkout before exercising code because JSON protocol adapter fixtures use `provider = "mongodb"` while that provider is not enabled. Use `cargo check -p request-handlers` and Criterion/query-compiler benches for local verification unless the provider feature set is fixed.
