## Prisma Repository – Agent Field Notes

- **Repository scope**: Monorepo for Prisma ORM, CLI, client, tests, etc. Many packages use TypeScript, Rust and WebAssembly (via engines), TSX, and Jest; automation relies on `pnpm`. Expect large fixture directories and generated files.
- **Workspace layout**: Managed via pnpm workspaces and Turborepo (`turbo.json`). Node 20+/22+/24+ and pnpm ≥10.15 are required (see root `package.json`). Top-level scripts (`pnpm build`, `pnpm dev`, `pnpm test`) delegate into `scripts/ci/publish.ts`; package-specific commands run with `pnpm --filter @prisma/<pkg> <script>`.
- **Key packages**: `packages/cli` (Prisma CLI entry point), `packages/migrate` (migrate/db namespace + fixtures), `packages/client` (client runtime), `packages/client-generator-ts` (new `prisma-client` generator), `packages/client-generator-js` (traditional `prisma-client-js` generator), `packages/client-engine-runtime` (the core part of the new Rust binary free client based on Wasm query compiler, used by `ClientEngine` class in `packages/client`), `packages/config` (`PrismaConfigInternal` + loader), `packages/internals` (shared CLI + engine glue), `packages/engines` (Rust binaries download wrapper), `packages/integration-tests` (matrix suites), and numerous driver adapters under `packages/adapter-*`.
- **Driver adapters & runtimes**: `packages/bundled-js-drivers` plus the `adapter-*` packages ship experimental JS driver adapters (Planetscale, Neon, libsql, D1, etc.) built on helpers in `driver-adapter-utils`; migrate/client fixtures exercise them, so adapter changes typically require fixture/test updates.
- **Build & tooling**: Typescript-first repo with WASM/Rust assets (downloaded by `@prisma/engines`). Multiple `tsconfig.*` drive bundle vs runtime builds. Lint via `pnpm lint`, format via `pnpm format`. Maintenance scripts live in `scripts/` (e.g. `bump-engines.ts`, `bench.ts`, `ci/publish.ts` orchestrates build/test/publish flows).
- **Testing & databases**: `TESTING.md` covers Jest/Vitest usage. Most suites run as `pnpm --filter @prisma/<pkg> test <pattern>`. DB-backed tests expect `.db.env` and Docker services from `docker/docker-compose.yml` (`docker compose up -d`). Client functional tests sit in `packages/client/tests/functional`—run them via `pnpm --filter @prisma/client test:functional` (with typechecking) or `pnpm --filter @prisma/client test:functional:code` (code only); `helpers/functional-test/run-tests.ts` documents CLI flags to target providers, drivers, etc. Client e2e suites require a fresh `pnpm build` at repo root, then `pnpm --filter @prisma/client test:e2e --verbose --runInBand`. The legacy `pnpm --filter @prisma/client test` command primarily runs the older Jest unit tests plus `tsd` type checks. Migrate CLI suites live in `packages/migrate/src/__tests__`, the CLI runs both Jest (legacy suites) and Vitest (new subcommand coverage) via `pnpm --filter prisma test`, and end-to-end coverage lives in `packages/integration-tests`.
- **Docs & references**: `ARCHITECTURE.md` contains dependency graphs (requires GraphViz to regenerate), `docker/README.md` explains local DB setup, `examples/` provides sample apps, and `sandbox/` hosts debugging helpers like the DMMF explorer.

- **Prisma 7 direction**: Active migration from `schema.prisma` datasource URLs / `env()` to `prisma.config.ts`. Commands, tests, and fixtures should read connection settings from `PrismaConfigInternal.datasource` (or driver adapters) rather than CLI flags or environment loading. When schema variants exist (e.g. `prisma/custom.prisma`), create companion config files (`custom.config.ts`) that set `schema: '<relative path>'`, move datasource URL(s) into the config (prefer `directUrl` when present, retain `shadowDatabaseUrl`), and strip `directUrl`/`shadowDatabaseUrl` from the `.prisma` file afterwards. For SQLite, the paths should eventually be relative to the config file (`file:dev.db`), but today they still resolve relative to the schema file that contains the PSL datasource block. In practice we now standardise on `const basePath = process.cwd()` and `path.join(basePath, ...)` inside every fixture config (tests chdir into the fixture root), so schema/datasource references stay stable.
- **Test helpers**: `ctx.setConfigFile('<name>')` (from `__helpers__/prismaConfig.ts`) overrides the config used for the next CLI invocation and is automatically reset after each test, so no explicit cleanup is needed. Many migrate fixtures now provide one config per schema variant (e.g. `invalid-url.config.ts` next to `prisma/invalid-url.prisma`) and tests swap them via `ctx.setConfigFile(...)`. `ctx.setDatasource`/`ctx.resetDatasource` continue to override connection URLs when needed.

- **CLI commands**: Most commands already accept `--config` for custom config paths. Upcoming work removes `--schema` / `--url` in favour of config-based resolution. When editing CLI help text, keep examples aligned with new config-first workflow.

- **Driver adapters vs classic engine**:
  - `engine: 'classic'` requires `config.datasource.url`.
  - `engine: 'js'` (driver adapters) still experimental; commands need explicit support and should throw when not implemented.
  - Helper `ctx.setDatasource()` in tests overrides config.datasource for connection-specific scenarios.

- **Testing patterns**:
  - Tests rely on fixtures under `packages/**/src/__tests__/fixtures`; many now contain `prisma.config.ts`.
  - Default Jest/Vitest runner is invoked via `pnpm --filter @prisma/<pkg> test <pattern>`; it wraps `dotenv` and expects `.db.env`.
    - Some packages already use Vitest, `packages/cli` uses both for different tests as it's in the process of transition, older packages still use Jest.
  - Inline snapshots can be sensitive to formatting; prefer concise expectations unless the exact message matters.

- **Environment loading**: Prisma 7 removes automatic `.env` loading.

- **Codebase helpers to know**:
  - `@prisma/internals` exports CLI utilities: `arg`, `checkUnsupportedDataProxy`, `loadSchemaContext` (less used now).
  - `packages/migrate/src/__tests__/__helpers__/context.ts` sets up Jest helpers including config contributors.
  - `packages/config` defines `PrismaConfigInternal`; inspect when validating config assumptions.

- **Workflow reminders**:
  - Respect existing structure: modifications often require updating both command implementation and tests/fixtures.
  - Keep changes ASCII unless a file already uses Unicode (docs sometimes include emojis).
  - For new fixtures, prefer minimal config mirroring existing ones to ensure cross-platform compatibility.
