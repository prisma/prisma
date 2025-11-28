## Prisma Repository – Agent Field Notes

> **Meta note**: This is the primary agent knowledge base file. `CLAUDE.md` and `GEMINI.md` are symlinks to this file—always edit `AGENTS.md` directly. When learning something new about the codebase that would help with future tasks, update this file immediately.

- **Repository scope**: Monorepo for Prisma ORM, CLI, client, tests, etc. Many packages use TypeScript, Rust and WebAssembly (via engines), TSX, and Jest; automation relies on `pnpm`. Expect large fixture directories and generated files.
- **Workspace layout**: Managed via pnpm workspaces and Turborepo (`turbo.json`). Node 20+/22+/24+ and pnpm ≥10.15 are required (see root `package.json`). Top-level scripts (`pnpm build`, `pnpm dev`, `pnpm test`) delegate into `scripts/ci/publish.ts`; package-specific commands run with `pnpm --filter @prisma/<pkg> <script>`. Turborepo caches builds; run `pnpm build` from root to build all packages in dependency order.
- **Key packages**: `packages/cli` (Prisma CLI entry point), `packages/migrate` (migrate/db namespace + fixtures), `packages/client` (client runtime), `packages/client-generator-ts` (new `prisma-client` generator), `packages/client-generator-js` (traditional `prisma-client-js` generator), `packages/client-engine-runtime` (the core part of the new Rust binary free client based on Wasm query compiler, used by `ClientEngine` class in `packages/client`), `packages/config` (`PrismaConfigInternal` + loader), `packages/internals` (shared CLI + engine glue), `packages/engines` (Rust binaries download wrapper), `packages/integration-tests` (matrix suites), `packages/query-plan-executor` (standalone query plan executor service for Prisma Accelerate), and numerous driver adapters under `packages/adapter-*`.
- **Driver adapters & runtimes**: `packages/bundled-js-drivers` plus the `adapter-*` packages ship experimental JS driver adapters (Planetscale, Neon, libsql, D1, etc.) built on helpers in `driver-adapter-utils`; migrate/client fixtures exercise them, so adapter changes typically require fixture/test updates.
- **Build & tooling**: Typescript-first repo with WASM/Rust assets (downloaded by `@prisma/engines`). Multiple `tsconfig.*` drive bundle vs runtime builds. Lint via `pnpm lint`, format via `pnpm format`. Maintenance scripts live in `scripts/` (e.g. `bump-engines.ts`, `bench.ts`, `ci/publish.ts` orchestrates build/test/publish flows). Build configuration uses esbuild via `helpers/compile/build.ts` with configs in `helpers/compile/configs.ts`. Most packages use `adapterConfig` which bundles to both CJS and ESM with type declarations.
- **Testing & databases**: `TESTING.md` covers Jest/Vitest usage. Most suites run as `pnpm --filter @prisma/<pkg> test <pattern>`. DB-backed tests expect `.db.env` and Docker services from `docker/docker-compose.yml` (`docker compose up -d`). Client functional tests sit in `packages/client/tests/functional`—run them via `pnpm --filter @prisma/client test:functional` (with typechecking) or `pnpm --filter @prisma/client test:functional:code` (code only); `helpers/functional-test/run-tests.ts` documents CLI flags to target providers, drivers, etc. Client e2e suites require a fresh `pnpm build` at repo root, then `pnpm --filter @prisma/client test:e2e --verbose --runInBand`. The legacy `pnpm --filter @prisma/client test` command primarily runs the older Jest unit tests plus `tsd` type checks. Migrate CLI suites live in `packages/migrate/src/__tests__`, the CLI runs both Jest (legacy suites) and Vitest (new subcommand coverage) via `pnpm --filter prisma test`, and end-to-end coverage lives in `packages/integration-tests`.
- **Docs & references**: `ARCHITECTURE.md` contains dependency graphs (requires GraphViz to regenerate), `docker/README.md` explains local DB setup, `examples/` provides sample apps, and `sandbox/` hosts debugging helpers like the DMMF explorer.

- **Client architecture (Prisma 7)**:
  - `ClientEngine` in `packages/client/src/runtime/core/engines/client/` orchestrates query execution using WASM query compiler.
  - Two executor implementations: `LocalExecutor` (driver adapters, direct DB) and `RemoteExecutor` (Accelerate/Data Proxy).
  - `QueryInterpreter` in `packages/client-engine-runtime/src/interpreter/` executes query plans against `SqlQueryable` (driver adapter interface).
  - Query flow: `PrismaClient` → `ClientEngine.request()` → query compiler → `executor.execute()` → `QueryInterpreter.run()` → driver adapter.
  - `ExecutePlanParams` interface defines what's passed through the execution chain.

- **Adding PrismaClient constructor options**:
  - Runtime types: `PrismaClientOptions` in `packages/client/src/runtime/getPrismaClient.ts`.
  - Validation: `packages/client/src/runtime/utils/validatePrismaClientOptions.ts` (add to `knownProperties` array and `validators` object).
  - Engine config: `EngineConfig` interface in `packages/client/src/runtime/core/engines/common/Engine.ts`.
  - Generated types: Update both `packages/client-generator-js/src/TSClient/PrismaClient.ts` (`buildClientOptions` method) and `packages/client-generator-ts/src/TSClient/file-generators/PrismaNamespaceFile.ts` (`buildClientOptions` function).
  - Use `@prisma/ts-builders` for generating TypeScript type declarations.

- **Creating new packages**:
  - Create directory under `packages/`, add `package.json`, `tsconfig.json`, `tsconfig.build.json`, and `helpers/build.ts`.
  - Package is auto-discovered via `pnpm-workspace.yaml` glob `packages/*`.
  - For type-only packages, use `adapterConfig` from `helpers/compile/configs.ts`.
  - Add as dependency to consuming packages using `"workspace:*"` version.
  - **Important**: Add resolution path to `tsconfig.build.bundle.json` under `compilerOptions.paths` for go-to-definition to work in editors.
  - **Important**: If the package has tests, add it to `.github/workflows/test-template.yml`. Most utility packages go in the `others` job (Linux, no Docker) and `no-docker` job (Windows/macOS). Look at existing packages for patterns.

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

- **Codebase helpers to know**:
  - `@prisma/internals` exports CLI utilities: `arg`, `loadSchemaContext` (less used now).
  - `packages/migrate/src/__tests__/__helpers__/context.ts` sets up Jest helpers including config contributors.
  - `packages/config` defines `PrismaConfigInternal`; inspect when validating config assumptions.
  - `@prisma/ts-builders` provides a fluent API for generating TypeScript code (interfaces, types, properties with doc comments).
  - `@prisma/driver-adapter-utils` defines core interfaces: `SqlQuery`, `SqlQueryable`, `SqlDriverAdapter`, `SqlDriverAdapterFactory`.
  - `@prisma/client-engine-runtime` exports query interpreter, transaction manager, and related utilities.

- **Workflow reminders**:
  - Respect existing structure: modifications often require updating both command implementation and tests/fixtures.
  - Keep changes ASCII unless a file already uses Unicode (docs sometimes include emojis).
  - For new fixtures, prefer minimal config mirroring existing ones to ensure cross-platform compatibility.
  - When adding features that span multiple packages, build from root (`pnpm build`) to ensure correct dependency order.
  - Type-only imports from workspace packages work at runtime but IDE may show errors until `pnpm install` refreshes the workspace graph.
  - Test files named `*.test.ts` are excluded from build output via esbuild config; place tests alongside source files.
  - **Update this file** (`AGENTS.md`) whenever you learn something new about the codebase that would be valuable for future tasks.
