# Drop inlined `fromContract` / `toContract` from `migration.json`

Linear: [TML-2512](https://linear.app/prisma-company/issue/TML-2512). Supersedes [TML-2274](https://linear.app/prisma-company/issue/TML-2274) (closed as duplicate).

## Summary

Every emitted app-space migration directory carries the full destination contract JSON in three places at once: inlined as `migration.json.toContract`, inlined as `migration.json.fromContract`, and the same payload again in the sibling `end-contract.json` / `start-contract.json` files. The redundancy roughly doubles the migration directory on disk for non-trivial schemas and dominates the diff on every regenerated migration.

This spec removes the inlined fields from the manifest, keeps the sibling contract files as the canonical on-disk snapshot, and codifies the structural property that the **runner** is independent of those snapshot files — `migration apply` only needs `migration.json` + `ops.json` + the project-root `contract.json`.

## Context

### What's redundant today

For each app-space migration directory the emitter writes:

```
20260513T0507_add_product_category_index/
  start-contract.json    ← source-side contract snapshot
  end-contract.json      ← destination-side contract snapshot
  migration.json         ← manifest, BUT inlines fromContract + toContract
  ops.json
  migration.ts
  start-contract.d.ts
  end-contract.d.ts
```

`migration.json` carries the destination contract twice (its own `toContract` field + the sibling `end-contract.json`) and the source contract twice (`fromContract` + `start-contract.json`). On retail-store, `migration.json` is ~2800 lines because of this; the same payload sits next door in two ~1400-line files.

### Why the change is structurally safe

- `computeMigrationHash` already excludes `fromContract`, `toContract`, `hints`, and `signature` from the hash (`packages/1-framework/3-tooling/migration/src/hash.ts`). Removing the fields does not change `migrationHash` for any existing or future migration. Storage-only identity (ADR 199) made this guarantee explicit.
- No code on the **apply** path reads `metadata.fromContract` or `metadata.toContract`. The aggregate loader (`packages/1-framework/3-tooling/migration/src/aggregate/loader.ts`) sources contracts from the project-root `contract.json` (app space) and from `migrations/<space-id>/contract.json` (extension space's pinned head, written by the seed phase). Per-package contract snapshots are not consumed by any reader on the apply path.
- The only producers of the inlined fields are `migration-plan.ts`, `migration-new.ts`, and `migration-base.ts:buildAttestedMetadata`.
- The only consumers (today) are:
  - `migration-plan.ts` and `migration-new.ts` — read `predecessor.metadata.toContract` to feed the planner's `fromContract` parameter.
  - `migration-base.ts:assertBookendsMatchMeta` — a staleness check whose own comment marks it for deletion once this work lands.
  - `materialiseMigrationPackage` — writes a per-package `contract.json` for extension-space migrations using `pkg.metadata.toContract`. No reader consumes that per-package file.

### Runner-independence property

After this change, the **migration runner** has zero dependency on `start-contract.json`, `end-contract.json`, or per-package `contract.json`. A user who keeps only `migration.json` + `ops.json` per migration package (plus the project-root `contract.json`) can still run `prisma-next migration apply` end-to-end. This is a property we lock in with a test, not a future aspiration.

The **planning** commands (`migration plan` / `migration new`) still need predecessor contract content to feed the planner. They will read it from the predecessor's sibling `end-contract.json`. This keeps the planner itself file-I/O-free — the CLI remains the I/O boundary, matching the established pattern (`MigrationPlanner.plan({ fromContract: Contract | null, ... })` takes a value, not a path).

### Backwards compatibility

Clean break, no shim. Existing manifests in this repository (retail-store example, pgvector / postgis seed migrations, any test fixtures) are regenerated as part of the implementation PR. The single known external consumer (Cipherstash extension) is communicated with directly.

The broader question of an explicit back-compat policy is tracked under [TML-2515](https://linear.app/prisma-company/issue/TML-2515) in `[PN] EA Release` and is out of scope for this work.

## Changes

### Type and schema

- Remove `fromContract` and `toContract` from `MigrationMetadata` in `packages/1-framework/1-core/framework-components/src/control/control-migration-types.ts`.
- Remove the same fields from `MigrationMetadataSchema` in `packages/1-framework/3-tooling/migration/src/io.ts`. `'+': 'reject'` stays — the schema rejects every unknown key including the now-removed ones, so old manifests fail to load with a clear arktype error pointing at the field. This is intentional under the clean-break decision.
- Remove the contract-stripping lines from `computeMigrationHash` (`fromContract: _fromContract, toContract: _toContract`) since the fields no longer exist on the input type. Behavior is unchanged.

### Producer side (emitters)

- `packages/1-framework/3-tooling/cli/src/commands/migration-plan.ts` — drop `fromContract` and `toContract` from `baseMetadata`.
- `packages/1-framework/3-tooling/cli/src/commands/migration-new.ts` — same.
- `packages/1-framework/3-tooling/migration/src/migration-base.ts`:
  - `buildAttestedMetadata`: drop `fromContract` and `toContract` from the assembled metadata (no more synthesis stub, no more existing-preservation).
  - Delete `assertBookendsMatchMeta` and its call site.
  - Delete `errorStaleContractBookends` from `errors.ts` and the corresponding error code.

### Consumer side (authoring lookups)

- `migration-plan.ts` and `migration-new.ts` — where the code currently reads `predecessor.metadata.toContract` to populate `fromContract`, read the predecessor's `end-contract.json` instead:

  ```ts
  const fromContractRaw = await readFile(
    join(predecessorPackage.dirPath, 'end-contract.json'),
    'utf-8',
  );
  fromContract = JSON.parse(fromContractRaw) as Contract;
  ```

  The planner interface (`MigrationPlanner.plan({ fromContract: Contract | null, ... })`) is unchanged; the planner stays file-I/O-free.
- Wrap the read in a structured CLI error if `end-contract.json` is missing from the predecessor directory, naming the file and pointing the user at re-emitting from the source.

### `materialiseMigrationPackage`

- Drop the per-package `contract.json` write. Migration packages produced by `materialiseMigrationPackage` will contain `migration.json` + `ops.json` only. No reader consumes the per-package `contract.json`; this removes another piece of duplicated state.

### On-disk manifests in this repo

Regenerate the committed manifests by running each migration's `migration.ts` (self-emit) after the type change lands:

- `examples/retail-store/migrations/app/*/migration.json`
- `packages/3-extensions/pgvector/migrations/*/migration.json`
- `packages/3-extensions/postgis/migrations/*/migration.json`
- Any test fixtures that hand-construct manifests with the inlined fields (see `packages/1-framework/3-tooling/migration/test/fixtures.ts` and similar).

### Documentation

- Update `docs/architecture docs/subsystems/7. Migration System.md`:
  - The "File Layout" section currently lists `fromContract` / `toContract` as fields of `migration.json`. Remove that.
  - Add a short paragraph documenting the runner-independence property: the runner reads only `migration.json` + `ops.json` per package, plus the project-root / per-space `contract.json` for head state.
- The corresponding ADR-level documentation already exists at ADR 199 (storage-only migration identity) and ADR 197 (migration packages snapshot their own contract). No new ADR is required — these decisions already cover the design space.

## Acceptance criteria

1. `MigrationMetadata` no longer contains `fromContract` or `toContract` fields anywhere in the framework, family, or CLI surfaces.
2. Newly emitted `migration.json` files for app-space and extension-space migrations do not contain `fromContract` or `toContract`. Verified by running `prisma-next migration plan` (or `migration new`) and inspecting the output.
3. `migrationHash` for every existing migration in the repository is byte-identical before and after the type change. (The hash already excludes the removed fields; this is a regression guard, not a recomputation.)
4. `prisma-next migration apply` runs to completion against a migration directory containing only `migration.json` + `ops.json` per package (every `*-contract.json` deleted). New regression test pins this.
5. `prisma-next migration plan` runs against a project where the latest migration has its sibling `end-contract.json` present, and surfaces a clear structured CLI error when that file is missing.
6. All committed migration manifests in the repository are regenerated to the new shape. `examples/retail-store/migrations/app/*/migration.json`, both extension seeds, and every fixture are clean.
7. `pnpm test:packages`, `pnpm test:integration`, and `pnpm test:e2e` all pass.
8. The Migration System subsystem doc reflects the new file layout and explicitly names the runner-independence property.

## Out of scope

- Redesigning predecessor-contract storage (e.g. a content-addressed `contracts/` directory). The current sibling-file convention stays.
- Defining a general backwards-compatibility policy. Tracked under [TML-2515](https://linear.app/prisma-company/issue/TML-2515).
- Changes to `start-contract.json` / `end-contract.json` / `*.d.ts` emission. Those continue to be written exactly as today; they remain a convenience for typed access inside `migration.ts` and the predecessor-contract source for `migration plan`.
- Changes to the per-space root `migrations/<space-id>/contract.json` (the head contract written by `emitContractSpaceArtifacts`). Unaffected.
- Any change to the hash function or its inputs. Already storage-only; nothing to alter.

## Open questions

None at spec time.
