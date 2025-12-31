## Prisma Repository – Agent Field Notes

> **Meta note**: This is the primary agent knowledge base file. `CLAUDE.md` and `GEMINI.md` are symlinks to this file—always edit `AGENTS.md` directly. When learning something new about the codebase that would help with future tasks, update this file immediately.

- **Repository scope**: Monorepo for Prisma ORM, CLI, client, tests, etc. Many packages use TypeScript, Rust and WebAssembly (via engines), TSX, and Jest; automation relies on `pnpm`. Expect large fixture directories and generated files.
- **Workspace layout**: Managed via pnpm workspaces and Turborepo (`turbo.json`). Node ^20.19 || ^22.12 || >=24.0 and pnpm >=10.15 <11 are required (see root `package.json`). Top-level scripts (`pnpm build`, `pnpm dev`, `pnpm test`) delegate into `scripts/ci/publish.ts`; package-specific commands run with `pnpm --filter @prisma/<pkg> <script>`. Turborepo caches builds; run `pnpm build` from root to build all packages in dependency order.
- **Key packages**: `packages/cli` (Prisma CLI entry point), `packages/migrate` (migrate/db namespace + fixtures), `packages/client` (client runtime), `packages/client-generator-ts` (new `prisma-client` generator), `packages/client-generator-js` (traditional `prisma-client-js` generator), `packages/client-generator-registry` (generator registry for managing generators), `packages/client-engine-runtime` (the core part of the new Rust binary free client based on Wasm query compiler, used by `ClientEngine` class in `packages/client`), `packages/client-common` (shared client utilities), `packages/client-runtime-utils` (utility types and singletons for Prisma Client), `packages/config` (`PrismaConfigInternal` + loader), `packages/internals` (shared CLI + engine glue), `packages/engines` (Rust binaries download wrapper), `packages/integration-tests` (matrix suites), `packages/query-plan-executor` (standalone query plan executor service for Prisma Accelerate), `packages/credentials-store` (credential storage utilities), sqlcommenter packages under `packages/sqlcommenter*`, and numerous driver adapters under `packages/adapter-*`.
- **Driver adapters & runtimes**: `packages/bundled-js-drivers` plus the `adapter-*` packages ship JS driver adapters: `adapter-pg`, `adapter-neon`, `adapter-libsql`, `adapter-planetscale`, `adapter-d1`, `adapter-better-sqlite3`, `adapter-mssql`, `adapter-mariadb`, `adapter-ppg` (Prisma Postgres Serverless). These are built on helpers in `driver-adapter-utils`; migrate/client fixtures exercise them, so adapter changes typically require fixture/test updates. CI tests driver adapters with flavors: `js_pg`, `js_neon`, `js_libsql`, `js_planetscale`, `js_d1`, `js_better_sqlite3`, `js_mssql`, `js_mariadb`, `js_pg_cockroachdb`.
- **Build & tooling**: Typescript-first repo with WASM/Rust assets (downloaded by `@prisma/engines`). Multiple `tsconfig.*` drive bundle vs runtime builds. Lint via `pnpm lint`, format via `pnpm format`. Maintenance scripts live in `scripts/` (e.g. `bump-engines.ts`, `bench.ts`, `ci/publish.ts` orchestrates build/test/publish flows). Build configuration uses esbuild via `helpers/compile/build.ts` with configs in `helpers/compile/configs.ts`. Most packages use `adapterConfig` which bundles to both CJS and ESM with type declarations.
- **Benchmarking**: Comprehensive performance benchmarks using Benchmark.js with CodSpeed integration. See `docs/benchmarking.md` for full documentation. Key commands:
  - `pnpm bench` - Run all benchmarks (outputs to `output.txt`)
  - `pnpm bench <pattern>` - Run benchmarks matching pattern
  - Benchmark locations:
    - End-to-end query performance: `packages/client/src/__tests__/benchmarks/query-performance/query-performance.bench.ts`
    - Query compilation: `packages/client/src/__tests__/benchmarks/query-performance/compilation.bench.ts`
    - Query interpreter/data mapper: `packages/client-engine-runtime/bench/interpreter.bench.ts`
    - Client generation: `packages/client/src/__tests__/benchmarks/huge-schema/`, `packages/client/src/__tests__/benchmarks/lots-of-relations/`
  - Benchmarks run automatically on CI via `.github/workflows/benchmark.yml`; CodSpeed tracks performance over time and alerts on >100% regression.
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
  - `ClientEngine` in `packages/client/src/runtime/core/engines/client/` orchestrates query execution using WASM query compiler.
  - Two executor implementations: `LocalExecutor` (driver adapters, direct DB) and `RemoteExecutor` (Accelerate/Data Proxy).
  - `QueryInterpreter` class in `packages/client-engine-runtime/src/interpreter/query-interpreter.ts` executes query plans against `SqlQueryable` (driver adapter interface).
  - Query flow: `PrismaClient` → `ClientEngine.request()` → query compiler → `executor.execute()` → `QueryInterpreter.run()` → driver adapter.
  - `ExecutePlanParams` interface in `packages/client/src/runtime/core/engines/client/Executor.ts` defines what's passed through the execution chain.

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
  - For type-only packages, use `adapterConfig` from `helpers/compile/configs.ts`.
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

- **Driver adapters datasource**:
  - Helper `ctx.setDatasource()` in tests overrides config.datasource for connection-specific scenarios.

- **Testing patterns**:
  - Tests rely on fixtures under `packages/**/src/__tests__/fixtures`; many now contain `prisma.config.ts`.
  - Default Jest/Vitest runner is invoked via `pnpm --filter @prisma/<pkg> test <pattern>`; it wraps `dotenv` and expects `.db.env`.
    - Some packages already use Vitest, `packages/cli` uses both for different tests as it's in the process of transition, older packages still use Jest.
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

- **SQL Commenter packages**:
  - `@prisma/sqlcommenter`: Core types (`SqlCommenterPlugin`, `SqlCommenterContext`, `SqlCommenterQueryInfo`, `SqlCommenterTags`) for building sqlcommenter plugins.
  - `@prisma/sqlcommenter-query-tags`: AsyncLocalStorage-based plugin for adding ad-hoc tags via `withQueryTags()` and `withMergedQueryTags()`.
  - `@prisma/sqlcommenter-trace-context`: Plugin for adding W3C Trace Context `traceparent` header to queries.
  - `@prisma/sqlcommenter-query-insights`: Plugin for adding parameterized query shapes to comments (format: `Model.action:base64Payload`).
  - Plugins are registered via `PrismaClient({ comments: [plugin1(), plugin2()] })`.
  - E2E tests for sqlcommenter plugins live in `packages/client/tests/e2e/sqlcommenter*` directories.
  - `SqlCommenterQueryInfo` distinguishes `type: 'single'` (single query) vs `type: 'compacted'` (batched queries merged into one SQL statement).

- **Codebase helpers to know**:
  - `@prisma/internals` exports CLI utilities: `arg`, `loadSchemaContext` (less used now).
  - `packages/migrate/src/__tests__/__helpers__/context.ts` sets up Jest helpers including config contributors.
  - `packages/config` defines `PrismaConfigInternal`; inspect when validating config assumptions.
  - `@prisma/ts-builders` provides a fluent API for generating TypeScript code (interfaces, types, properties with doc comments).
  - `@prisma/driver-adapter-utils` defines core interfaces: `SqlQuery`, `SqlQueryable`, `SqlDriverAdapter`, `SqlDriverAdapterFactory`, `SqlMigrationAwareDriverAdapterFactory`, `MappedError` for error handling, `ConnectionInfo`, `Provider` type (`'mysql' | 'postgres' | 'sqlite' | 'sqlserver'`).
  - `@prisma/client-engine-runtime` exports query interpreter, transaction manager, and related utilities.
  - `@prisma/client-common` provides shared client utilities used by both generators and runtime.
  - `@prisma/client-runtime-utils` provides utility types and singletons for Prisma Client.

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
