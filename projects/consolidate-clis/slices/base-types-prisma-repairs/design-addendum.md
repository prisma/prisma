# Design ADDENDUM — TML-3180: MigrationToolsError joins the common base type

Status: rulings adopted provisionally (operator directive 2026-08-07: "I expect common error base type and result type on 29919"); items i–iii below proceed on their recommendations and a contrary ruling reworks them. Applies ON TOP of [design.md](./design.md). Lands on the PR #29919 branch (`tml-3180-base-type-repairs`).

## Context

After the base repairs, `packages/1-framework/3-tooling/migration/src/errors.ts` still declares `MigrationToolsError extends Error` with its own `why`/`fix`/`details` fields, and the CLI wraps it at the boundary via `mapMigrationToolsError` → `errorRuntime`. That leaves two error vocabularies in prisma/prisma. The `Result<T, F>` single-`ok` type (foundation `utils/src/result.ts`) is already the uniform command currency and needs no change.

## Normative changes

1. **Dependency**: `@internal/migration-tools` gains `"@internal/errors": "workspace:0.17.0"` (3-tooling depending on 1-core is the legal direction; `lint:deps` must stay green).
2. **Class**: `MigrationToolsError extends CliStructuredError`:

   ```ts
   export class MigrationToolsError extends CliStructuredError {
     readonly category = 'MIGRATION' as const;
     declare readonly code: `MIGRATION.${string}`;
     declare readonly why: string;
     declare readonly fix: string;

     constructor(
       code: `MIGRATION.${string}`,
       summary: string,
       options: { readonly why: string; readonly fix: string; readonly meta?: Record<string, unknown> },
     ) {
       super(code, summary, options);
     }
   }
   ```

   - Do NOT set `this.name` — it stays `'CliStructuredError'` so boundary duck-typing (`CliStructuredError.is`) recognizes these errors (same rule as composer's `LoadError`, TML-3181 §A2).
   - The `declare` narrows of `why`/`fix` assume the parent's fix-equals-why normalization never fires for these factories; pin that with one unit test (no factory passes identical `why` and `fix`).
3. **`details` is renamed to `meta` everywhere** (ruling i, adopted): the constructor option, the property reads (16 source sites + tests), and every factory literal in `errors.ts`. One vocabulary; no alias getter.
4. **Predicate** (ruling ii, adopted): rewrite duck-typing without the name check:

   ```ts
   static is(error: unknown): error is MigrationToolsError {
     return (
       CliStructuredError.is(error) &&
       (error as MigrationToolsError).category === 'MIGRATION' &&
       error.code.startsWith('MIGRATION.')
     );
   }
   ```
5. **`mapMigrationToolsError` is deleted** (ruling iii, adopted): callers pass the error straight through (`notOk(error)`, rethrow, or render). Sites that deliberately re-code into a command-specific envelope keep doing so, attaching the original as `cause` (mirrors TML-3181 ambiguity-5 ruling). The defensive-copy behavior the mapper had is obsolete: factories build a fresh `meta` object literal per call and `CliStructuredError` exposes it readonly.
6. **Envelope neutrality**: `--json` envelopes for migration-tools failures must be byte-identical before/after (code, summary, why, fix, meta); the only behavioral delta is the disappearance of the mapper's self-referential `cause`. Assert at least one command-level envelope pin per consuming command group (migrate, migration-plan/-check/-status/-log, ref, db-sign/-update/-init).
7. **Tests**: update `migration/test/errors.test.ts` shape assertions (`name` is now `'CliStructuredError'`, `.meta` not `.details`, `toEnvelope()` available); CLI tests that exercised `mapMigrationToolsError` re-target the direct passthrough.
8. **Docs**: `docs/reference/error-reference.md` code entries are unchanged (codes and meta shapes survive). The errors chapter of the migration package README/doc comment updates from `details` to `meta`.

## Out of scope

`DriverMissingError` and `TsConfigParseError` (init-command internals, never cross a boundary) stay plain `Error`. The `LowerError`-equivalent execution-plane errors are untouched, as in the composer slice.
