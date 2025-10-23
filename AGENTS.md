## Prisma Repository – Agent Field Notes

- **Repository scope**: Monorepo for Prisma ORM, CLI, client, engines, tests, etc. Many packages use TypeScript, Rust (via engines), TSX, and Jest; automation relies on `pnpm`. Expect large fixture directories and generated files.

- **Prisma 7 direction**: Active migration from `schema.prisma` datasource URLs / `env()` to `prisma.config.ts`. Commands, tests, and fixtures should read connection settings from `PrismaConfigInternal.datasource` (or driver adapters) rather than CLI flags or environment loading.

- **CLI commands**: Most commands already accept `--config` for custom config paths. Upcoming work removes `--schema` / `--url` in favour of config-based resolution. When editing CLI help text, keep examples aligned with new config-first workflow.

- **Driver adapters vs classic engine**:
  - `engine: 'classic'` requires `config.datasource.url`.
  - `engine: 'js'` (driver adapters) still experimental; commands need explicit support and should throw when not implemented.
  - Helper `ctx.setDatasource()` in tests overrides config.datasource for connection-specific scenarios.

- **Testing patterns**:
  - Tests rely on fixtures under `packages/**/src/__tests__/fixtures`; many now contain `prisma.config.ts`.
  - Default Jest runner is invoked via `pnpm --filter @prisma/<pkg> test <pattern>`; it wraps `dotenv` and expects `.db.env`.
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

