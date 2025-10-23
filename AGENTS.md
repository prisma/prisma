## Prisma Repository – Agent Field Notes

- **Repository scope**: Monorepo for Prisma ORM, CLI, client, tests, etc. Many packages use TypeScript, Rust and WebAssembly (via engines), TSX, and Jest; automation relies on `pnpm`. Expect large fixture directories and generated files.

- **Prisma 7 direction**: Active migration from `schema.prisma` datasource URLs / `env()` to `prisma.config.ts`. Commands, tests, and fixtures should read connection settings from `PrismaConfigInternal.datasource` (or driver adapters) rather than CLI flags or environment loading. When schema variants exist (e.g. `prisma/custom.prisma`), create companion config files (`custom.config.ts`) that set `schema: '<relative path>'`, move datasource URL(s) into the config (prefer `directUrl` when present, retain `shadowDatabaseUrl`), and strip `directUrl`/`shadowDatabaseUrl` from the `.prisma` file afterwards. For SQLite, the paths should eventually be relative to the config file (`file:dev.db`), but today they still resolve relative to the schema file that contains the PSL datasource block. To avoid surprising lookups, prefer building an absolute path with `const basePath = process.cwd()` and then `path.join(basePath, 'prisma', 'schema.prisma')` (or similar) inside the config—tests change `cwd` to the fixture root before invoking the CLI.
- **Test helpers**: `ctx.setConfigFile('<name>')` (from `__helpers__/prismaConfig.ts`) overrides the config used for the next CLI invocation and is automatically reset after each test, so no explicit cleanup is needed. `ctx.setDatasource`/`ctx.resetDatasource` continue to override connection URLs when needed.

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

- **Environment loading**: Prisma 7 removes automatic `.env` loading. Avoid calling `loadEnvFile` unless the command explicitly still depends on it; favour reading from `prisma.config.ts`.

- **Codebase helpers to know**:
  - `@prisma/internals` exports CLI utilities: `arg`, `checkUnsupportedDataProxy`, `loadSchemaContext` (less used now).
  - `packages/migrate/src/__tests__/__helpers__/context.ts` sets up Jest helpers including config contributors.
  - `packages/config` defines `PrismaConfigInternal`; inspect when validating config assumptions.

- **Workflow reminders**:
  - Respect existing Lerna-like structure: modifications often require updating both command implementation and tests/fixtures.
  - Keep changes ASCII unless a file already uses Unicode (docs sometimes include emojis).
  - For new fixtures, prefer minimal config mirroring existing ones to ensure cross-platform compatibility.
