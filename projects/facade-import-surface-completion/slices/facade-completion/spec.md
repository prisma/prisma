# Slice: facade-completion

Parent project: [`projects/facade-import-surface-completion/`](../../). This slice delivers every FR + NFR from the project spec in a single PR.

## At a glance

Add the missing façade subpaths (postgres `/migration`; mongo `/control` + `/bson` + `/config` extensions; sqlite `/config`, `/contract-builder`, `/control`, `/migration`), wrap `defineContract` in each facade's `contract-builder` subpath to pre-bind family + target (postgres, mongo, sqlite), flip the two `render-typescript.ts` files **and the two `op-factory-call.ts` `TARGET_MIGRATION_MODULE` constants** to emit the façade specifier, regenerate every in-workspace test that string-pins the old specifier (target tests, adapter tests, cli-journey e2e tests), migrate every verbose `examples/*/prisma-next.config.ts` AND every `examples/*/prisma/contract.ts` to façade form, drop the Mongo `"."` barrel, update the migrations agent-skill + `skills/DEVELOPING.md` + ts-render README + cli README + ADR 208 example, and update `architecture.config.json` + the three façade READMEs.

## Scope

### In scope

**Façade package source** (`packages/3-extensions/`):

- `postgres/src/exports/migration.ts` — new; `export * from '@internal/target-postgres/migration'`.
- `postgres/package.json` `exports` — add `./migration` entry.
- `postgres/src/contract/define-contract.ts` — new; wrapped `defineContract` pre-binding `sqlFamily` + `postgresPack`. Drops `family` and `target` from the input scaffold type.
- `postgres/src/exports/contract-builder.ts` — replace the re-exported `defineContract` with the wrapped local version (keep all other re-exports as-is: `field`, `model`, `rel`, the type exports).
- `mongo/src/contract/define-contract.ts` — new; wrapped `defineContract` pre-binding the mongo family + target packs.
- `mongo/src/exports/contract-builder.ts` — replace the re-exported `defineContract` with the wrapped version.
- `mongo/src/config/define-config.ts` — extend `MongoConfigOptions` with `extensions?: readonly ControlExtensionDescriptor<'mongo', 'mongo'>[]` and `migrations?: { dir?: string }`; thread both through to `coreDefineConfig`.
- `mongo/src/exports/control.ts` — new; `createMongoControlClient(options)` mirroring the Postgres implementation.
- `mongo/src/exports/bson.ts` — new; re-exports `Binary, Decimal128, Long, MongoClient, ObjectId, Timestamp` from `mongodb` (preserves what the deleted `"."` barrel exposed).
- `mongo/package.json` `exports` — add `./control`, `./bson`; remove `"."` entry.
- `mongo/src/exports/index.ts` — delete (barrel is going away; BSON moves to `/bson`).
- `sqlite/src/config/define-config.ts` — new; `defineConfig` + `SqliteConfigOptions` mirroring Postgres's shape.
- `sqlite/src/exports/config.ts` — new; re-exports.
- `sqlite/src/contract/define-contract.ts` — new; wrapped `defineContract` pre-binding `sqlFamily` + `sqlitePack`.
- `sqlite/src/exports/contract-builder.ts` — new; exports the wrapped `defineContract` + re-exports `field`, `model`, `rel`, types from `@internal/sql-contract-ts/contract-builder`.
- `sqlite/src/exports/control.ts` — new; `createSqliteControlClient` mirroring Postgres's `control.ts`.
- `sqlite/src/exports/migration.ts` — new; `export * from '@internal/target-sqlite/migration'`.
- `sqlite/package.json` — add `/config`, `/contract-builder`, `/control`, `/migration` to `exports`; add `@internal/cli`, `@internal/config`, `@internal/sql-contract-psl`, `@internal/sql-contract-ts`, `pathe`, `pg`-equivalent deps as needed by the new files.

**Façade package tests** (`packages/3-extensions/`):

- `postgres/test/migration/re-export.test.ts` — assert the façade re-exports the expected named symbols of `@internal/target-postgres/migration` (catches drift if the target adds an export and the façade doesn't pick it up via `export *`).
- `mongo/test/config/define-config.test.ts` — extend with cases for `extensions`, `migrations.dir`.
- `mongo/test/control/create-mongo-control-client.test.ts` — new; mirror of `postgres/test/control/...` if it exists, else build from `createPostgresControlClient`'s shape.
- `sqlite/test/config/define-config.test.ts` — new; mirror of `mongo/test/config/define-config.test.ts`.
- `sqlite/test/control/create-sqlite-control-client.test.ts` — new; mirror.
- `sqlite/test/contract-builder/re-export.test.ts` — new; assert named-export parity.
- `sqlite/test/migration/re-export.test.ts` — new; assert named-export parity.

**Renderer + IR-constant flip** (`packages/3-targets/3-targets/`):

- `postgres/src/core/migrations/render-typescript.ts` — `BASE_IMPORTS` switches to `@internal/postgres/migration`.
- `sqlite/src/core/migrations/render-typescript.ts` — `BASE_IMPORTS` switches to `@internal/sqlite/migration`.
- `postgres/src/core/migrations/op-factory-call.ts` — `TARGET_MIGRATION_MODULE` constant switches to `@internal/postgres/migration` (fed into per-call `importRequirements()`; without this the renderer's `BASE_IMPORTS` flip is silently overridden for op symbols).
- `sqlite/src/core/migrations/op-factory-call.ts` — same flip for SQLite.

**String-pinned tests that must update in lockstep with the renderer flip** (single dispatch):

- `packages/3-targets/3-targets/postgres/test/migrations/issue-planner.test.ts` — `expect(ts).toContain("from '@internal/target-postgres/migration'")` → façade.
- `packages/3-targets/3-targets/sqlite/test/migrations/op-factory-call.test.ts` — 3 occurrences (assertion + `importRequirements()` test cases).
- `packages/3-targets/3-targets/sqlite/test/migrations/planner.authoring-surface.test.ts` — 3 occurrences.
- `packages/3-targets/6-adapters/postgres/test/migrations/op-factory-call.rendering.test.ts` — 6 occurrences.
- `packages/3-targets/6-adapters/postgres/test/migrations/op-factory-call.lowering.test.ts` — 1 occurrence.
- `packages/3-targets/6-adapters/postgres/test/migrations/planner.authoring-surface.test.ts` — 2 occurrences.
- `packages/3-targets/6-adapters/postgres/test/migrations/render-typescript.roundtrip.test.ts` — 1 occurrence.
- `packages/3-targets/6-adapters/sqlite/test/migrations/render-typescript.roundtrip.test.ts` — 1 occurrence (review for shape vs string pinning).
- `test/integration/test/cli-journeys/invariant-routing.e2e.test.ts` — 2 inline migration source strings.
- `test/integration/test/cli-journeys/migration-round-trip.e2e.test.ts` — 1 inline migration source string.
- `test/integration/test/cli-journeys/init-journey/harness.ts` — 1 comment + harness reference.

**Example apps + extension-pack contract sources** (`examples/`, `packages/3-extensions/`):

Every `examples/<app>/prisma/contract.ts` AND every `packages/3-extensions/{pgvector,postgis}/src/contract.ts` migrates to the wrapped `defineContract` (drops `import sqlFamily from '@internal/family-sql/pack'` + `import postgresPack from '@internal/target-postgres/pack'`; passes only the extension-specific scaffold). Extension packs that bundle a contract are user-authored TS the same way example apps are.

All 13 `prisma-next.config.ts` files migrate to façade form (verified by repo-wide grep during D0 — only `react-router-demo` and `prisma-8-demo-sqlite` carry verbose-form imports as of research; `paradedb-demo` and `prisma-8-postgis-demo` also need spot-checks):

- `prisma-8-demo-sqlite/prisma-next.config.ts` — verbose → `@internal/sqlite/config`.
- `react-router-demo/prisma-next.config.ts` — verbose → `@internal/postgres/config`.
- `paradedb-demo/prisma-next.config.ts` — verify; migrate if verbose (with `extensions: [paradedb]`).
- `prisma-8-postgis-demo/prisma-next.config.ts` — verify; migrate if verbose.
- `prisma-8-demo/prisma-next.config.ts` — already façade-form; verify clean.
- `prisma-8-cloudflare-worker/prisma-next.config.ts` — verify clean.
- `cipherstash-integration/prisma-next.config.ts` — already façade-form; verify.
- `mongo-demo/prisma-next.config.ts` — already façade-form; verify; add `extensions`/`migrations` if it has any (likely none).
- `mongo-blog-leaderboard/prisma-next.config.ts` — verify.
- `retail-store/prisma-next.config.ts` — verify; migrate if verbose.
- `multi-extension-monorepo/app/prisma-next.config.ts` — already façade-form per D0 research.
- `multi-extension-monorepo/packages/audit/prisma-next.config.ts` — already façade-form (`@internal/postgres/config`).
- `multi-extension-monorepo/packages/feature-flags/prisma-next.config.ts` — verify (likely façade-form).

Out of scope: `examples/**/contract.d.ts`, `examples/**/end-contract.d.ts`, `examples/**/migrations/**/migration.ts` — these are framework-emitted/-rendered artifacts, not user-written imports; covered by OQ6 in the project spec.

**Cleanups + docs**:

- `architecture.config.json` — add entries for sqlite `/config`, `/contract-builder`, `/control`, `/migration`; postgres `/migration`; mongo `/control`, `/bson`. Remove the mongo `"."` entry.
- [`skills/prisma-next-migrations/SKILL.md`](../../../../skills/prisma-next-migrations/SKILL.md) — update L52-62 ("`migration.ts` is framework-rendered") to point at `@internal/{postgres,sqlite}/migration`; remove TML-2526 reference; remove the "until then" framing.
- [`skills/DEVELOPING.md`](../../../../skills/DEVELOPING.md) L86 — same flip (TML-2526 reference + specifier in prose).
- [`packages/1-framework/1-core/ts-render/README.md`](../../../../packages/1-framework/1-core/ts-render/README.md) L45 — example code uses façade specifier.
- [`packages/1-framework/3-tooling/cli/README.md`](../../../../packages/1-framework/3-tooling/cli/README.md) L1063 — paragraph describing the scaffolded migration's import line.
- [`docs/architecture docs/adrs/ADR 208 - Invariant-aware migration routing.md`](<../../../../docs/architecture docs/adrs/ADR 208 - Invariant-aware migration routing.md>) L9 — illustrative code (the ADR's decision text stays as-is; only the example flips).
- [`packages/3-extensions/postgres/README.md`](../../../../packages/3-extensions/postgres/README.md) — add `### @internal/postgres/migration` section.
- [`packages/3-extensions/mongo/README.md`](../../../../packages/3-extensions/mongo/README.md) — rewrite to mirror Postgres's structure; add `### @internal/mongo/control`, `### @internal/mongo/bson`; note the dropped barrel and the migration from `import { ObjectId } from '@internal/mongo'` → `from '@internal/mongo/bson'`.
- [`packages/3-extensions/sqlite/README.md`](../../../../packages/3-extensions/sqlite/README.md) — full rewrite to mirror Postgres's README shape; document all five subpaths.

### Out of scope (this slice)

- Re-rendering existing user migrations.
- Removing or renaming any `@internal/target-*`, `@internal/family-*`, `@internal/sql-*`, `@internal/cli/*` packages or subpaths.
- A `/serverless` subpath for SQLite or Mongo (Postgres's serverless façade is the only environment-asymmetric one today; nothing to add).
- A `@internal/sqlite/<something>` for cross-target shared logic (each target façade stays self-contained).
- Façades for non-shipping targets (cockroach, mysql, etc.).
- Touching any package outside `packages/3-extensions/` and `packages/3-targets/3-targets/{postgres,sqlite}/src/core/migrations/render-typescript.ts`. (Adapter-level round-trip tests at `packages/3-targets/6-adapters/{postgres,sqlite}/test/` may need their snapshots regenerated; that's fixture regen, not surface change.)
- Re-architecting the agent-skill cluster's other guidance about façade imports beyond the one TML-2526-referencing paragraph.

## Approach

The slice is composition + tree-shake-preserving subpath wiring. The work splits cleanly into "façade subpaths land" → "renderer switches to use them" → "example apps migrate" → "fixtures + docs catch up." The hard ordering constraint is that the renderer change is a single-commit step (renderer + regenerated in-workspace fixtures must land together to keep `pnpm fixtures:check` green), and the façade `/migration` re-exports must land first (else the new specifier resolves to nothing).

Dispatches are sequenced to land each surface incrementally with its own validation gate — façade subpaths first (with their own tests), then renderer + fixtures (one commit), then example apps (with `pnpm typecheck` per migrated example), then the agent-skill and README sweep. The slice fits one PR because each dispatch's diff is small + bounded and the overall change is composition-only — no new behaviour, only re-exposing existing surface through a different name.

Snippets that pin the shape:

```ts
// packages/3-extensions/postgres/src/exports/migration.ts
export * from '@internal/target-postgres/migration';
```

```ts
// packages/3-extensions/sqlite/src/config/define-config.ts (sketch)
export interface SqliteConfigOptions {
  readonly contract: string;
  readonly db?: { readonly connection?: string };
  readonly extensions?: readonly ControlExtensionDescriptor<'sql', 'sqlite'>[];
  readonly migrations?: { readonly dir?: string };
}

export function defineConfig(options: SqliteConfigOptions): PrismaNextConfig<'sql', 'sqlite'> {
  // mirror packages/3-extensions/postgres/src/config/define-config.ts
}
```

```ts
// packages/3-targets/3-targets/postgres/src/core/migrations/render-typescript.ts (diff)
const BASE_IMPORTS: readonly ImportRequirement[] = [
- { moduleSpecifier: '@internal/target-postgres/migration', symbol: 'Migration' },
- { moduleSpecifier: '@internal/target-postgres/migration', symbol: 'MigrationCLI' },
+ { moduleSpecifier: '@internal/postgres/migration', symbol: 'Migration' },
+ { moduleSpecifier: '@internal/postgres/migration', symbol: 'MigrationCLI' },
];
```

## Edge cases (Example-Mapping)

| Edge case | Disposition | Notes |
|---|---|---|
| Existing user-authored `migration.ts` files in user repos still import `@internal/target-postgres/migration` | Handle | `@internal/target-postgres/migration` export stays in place forever; this is NFR2. Test: `packages/3-extensions/postgres/test/migration/re-export.test.ts` asserts named-export parity so removing a target export by accident is caught. |
| In-workspace render fixtures pinned to the old specifier | Handle | Renderer + fixture regen land in one dispatch / one commit so `pnpm fixtures:check` stays green. Per [`drive/calibration/dod.md`](../../../../drive/calibration/dod.md), fixture regen is a named "Done when" gate. |
| `migrationHash` recomputes differently because the file body changed | Handle | The migration body is regenerated by the renderer; the hash is content-addressed over `ops.json`, not over `migration.ts`. Renderer changes don't shift hashes. Verified by reading `migration.json` generation in the planner. |
| Hash-pinned fixtures outside the rendered migration directory | Handle | Grep gate: `rg 'target-postgres/migration\|target-sqlite/migration' -g '!packages/**/migrations/**' -g '!**/node_modules/**'` reveals any unexpected pins. Surface and triage during research dispatch. |
| `pnpm lint:deps` fails because new façade subpaths cross plane boundaries incorrectly | Handle | New entries to `architecture.config.json` annotate each new subpath with the correct domain/layer/plane (mirror existing Postgres entries). `pnpm lint:deps` is a "Done when" gate on every dispatch that adds an export. |
| Mongo façade barrel removal breaks an internal consumer that imports `@internal/mongo` (no subpath) | Handle | Grep gate during the barrel-removal dispatch: `rg "from '@internal/mongo'" packages/ examples/` must return zero hits (or only the deleted barrel file itself). If hits exist, migrate them in the same dispatch. |
| SQLite façade gains 4 new deps; install footprint visible to SQLite-only users | Explicitly out | Per A2 in spec; SQLite catches up to Postgres/Mongo footprint. If the operator surfaces install-size concerns, defer to follow-up. |
| Cloudflare Worker example needs serverless-side façade APIs that don't exist yet | Explicitly out | Only Postgres has `/serverless` today; the worker example already uses it. If the worker example breaks during migration, that's surfaced as a Blocker for triage, not silently handled. |
| Mongo `/control` SPI shape doesn't match Postgres's `createPostgresControlClient` pattern | Handle | Research dispatch (D0) verifies A4 by reading `@internal/{adapter-mongo,driver-mongo,family-mongo,target-mongo}/control` exports. If the shape diverges, the slice spec is amended via design discussion before D2 fires. |
| `extensions` field in `MongoConfigOptions` has no current consumer (no Mongo extensions exist) | Explicitly out | Per Open Question 2 in the spec; the type plumbing is correct and the option is silently a no-op. Documented in the mongo README. |
| A new example app gets added between this slice's start and PR-open | Handle | The dispatch that does the example sweep grep-checks `examples/*/prisma-next.config.ts` at run time, not from a static list; new examples are caught. |
| Façade-form import in an example breaks the example's own typecheck because of a tighter type constraint | Handle | Each migrated example runs `pnpm typecheck` as a "Done when" gate in its dispatch. Type drift surfaces immediately. |
| `architecture.config.json` entry for sqlite `/config` is wrong plane (`shared` vs `runtime`) | Handle | Mirror Postgres's `/config` entry (`plane: shared`). `pnpm lint:deps` verifies. |
| User-facing manual-QA: a fresh checkout's `pnpm prisma-next migration plan` renders the new specifier | Handle | Manual-QA script covers this (PDoD6). |
| `MIGRATION.HASH_MISMATCH` triggered in some user's repo because their `prisma-next` updates and re-runs `migration plan` on an existing package | Handle | `migration plan` doesn't re-render existing packages (only new ones); already-applied migrations keep their old specifier. Verify by reading the planner's "skip if package exists" branch. |

## Slice Definition of Done

- [ ] **SDoD1.** All "Done when" gates from the slice plan pass (CI green; lint clean; typecheck clean; fixtures regenerated; intent-validation confirms diff matches brief intent for every dispatch).
- [ ] **SDoD2.** Every pre-named edge case handled per its disposition.
- [ ] **SDoD3.** Reviewer verdict: accept (on `projects/facade-import-surface-completion/reviews/code-review.md`).
- [ ] **SDoD4.** Manual-QA script in [`projects/facade-import-surface-completion/manual-qa.md`](../../manual-qa.md); ≥ 1 run report; no unresolved 🛑 Blocker findings.
- [ ] **SDoD5.** Slice doesn't touch surfaces listed as out-of-scope (anti-corruption grep: `rg --files-with-matches 'packages/0-shared|packages/1-framework|packages/2-(sql|mongo)|packages/3-(targets/6-adapters|targets/7-drivers|mongo-target)' -- <diff range>` shows only the `render-typescript.ts` entries + (if any) adapter-level snapshot regen).
- [ ] **SDoD6.** No `projects/` references left in long-lived files added by the slice.
- [ ] **SDoD7.** `pnpm lint:deps` clean against the updated `architecture.config.json`.
- [ ] **SDoD8.** `pnpm fixtures:check` clean.
- [ ] **SDoD9.** PR title carries `tml-2526:` prefix; PR description follows `drive-pr-description` shape; PR linked to TML-2526 via GitHub integration.

## Open Questions (resolved by D0)

1. **Does any in-workspace test outside `packages/3-targets/3-targets/{postgres,sqlite}` assert the rendered specifier string?** **Yes — see the "String-pinned tests" list above.** Adapter-level tests in `packages/3-targets/6-adapters/{postgres,sqlite}/test/migrations/` and three cli-journey e2e tests under `test/integration/test/cli-journeys/` carry inline string pins. All flip together in the renderer dispatch.
2. **Are the adapter-level round-trip tests shape-pinned or string-pinned?** **String-pinned in Postgres; SQLite needs spot-check.** `packages/3-targets/6-adapters/postgres/test/migrations/render-typescript.roundtrip.test.ts` L89 carries an explicit `'@internal/target-postgres/migration'` string. The SQLite counterpart needs the same gate. Both update in the renderer dispatch.
3. **Does the `multi-extension-monorepo` example's `audit` / `feature-flags` packages need a `@internal/postgres/config`-shaped façade entry?** **They already use it.** `examples/multi-extension-monorepo/packages/{audit,feature-flags}/prisma-next.config.ts` already import `defineConfig` from `@internal/postgres/config`. No migration work needed for those two files.

## References

- Parent project: [`projects/facade-import-surface-completion/spec.md`](../../spec.md)
- Linear issue: [TML-2526](https://linear.app/prisma-company/issue/TML-2526/facades-must-re-export-everything-users-import-in-their-app)
- Reference façade: [`packages/3-extensions/postgres/`](../../../../packages/3-extensions/postgres/)
- Renderer files: [`packages/3-targets/3-targets/postgres/src/core/migrations/render-typescript.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/migrations/render-typescript.ts), [`packages/3-targets/3-targets/sqlite/src/core/migrations/render-typescript.ts`](../../../../packages/3-targets/3-targets/sqlite/src/core/migrations/render-typescript.ts)
- Agent-skill paragraph to update: [`skills/prisma-next-migrations/SKILL.md`](../../../../skills/prisma-next-migrations/SKILL.md) L52-62
- Calibration: [`drive/calibration/sizing.md`](../../../../drive/calibration/sizing.md), [`drive/calibration/dod.md`](../../../../drive/calibration/dod.md), [`drive/calibration/failure-modes.md`](../../../../drive/calibration/failure-modes.md)
