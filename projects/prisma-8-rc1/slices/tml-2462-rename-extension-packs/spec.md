# TML-2462 — Rename `extensionPacks` → `extensions`, plus the freeze-window config sweep

RC1 roadmap item ([plan.md](../../plan.md)): config keys freeze at RC, so this rename happens now or never. Linear: [TML-2462](https://linear.app/prisma-company/issue/TML-2462/rename-extensionpacks-extensions).

## At a glance

Before / after, core config (`prisma-next.config.ts`):

```ts
// before
export default defineConfig({
  family: sqlFamily,
  target: postgresTarget,
  adapter: postgresAdapter,
  extensionPacks: [pgvector],
  contract: { source: { sourceFormat: 'psl', inputs: ['schema.prisma'], load }, output: './src/prisma/contract.json' },
})

// after
export default defineConfig({
  family: sqlFamily,
  target: postgresTarget,
  adapter: postgresAdapter,
  extensions: [pgvector],
  contract: { source: { format: 'psl', inputs: ['schema.prisma'], load }, output: './src/prisma/contract.json' },
})
```

Sugar config (`@internal/postgres/config` et al.) already says `extensions`; its `outputPath` becomes `output`:

```ts
// before
export default defineConfig({ contract: './contract.prisma', outputPath: './src/prisma', extensions: [paradedb] })
// after
export default defineConfig({ contract: './contract.prisma', output: './src/prisma', extensions: [paradedb] })
```

`contract.json` top level: `"extensionPacks": { … }` → `"extensions": { … }`. Same in `contract.d.ts`.

## Chosen design

Three renames, all landing in one breaking PR, no compatibility aliases (per the no-backward-compatibility rule):

1. **`extensionPacks` → `extensions`** — the config key (core layer), the `contract.json` top-level key, the `contract.d.ts` field, and every schema/type/builder/interpreter/emitter surface that carries the literal key. This converges the implementation onto the name ADR 105 and most of the Data Contract subsystem doc already specify, and onto the sugar `defineConfig` layer, which has used `extensions` all along. The validator guard at `packages/1-framework/1-core/config/src/config-validation.ts:162` — which today throws "Config.extensions is not supported; use Config.extensionPacks" — inverts: `extensions` is accepted; `extensionPacks` is rejected with an error pointing to the new name.
2. **`contract.source.sourceFormat` → `contract.source.format`** — removes the stutter before it freezes.
3. **Sugar `outputPath` → `output`** — one word for the concept across layers (sugar `output` is a directory; core `contract.output` remains a file path, unchanged).

**Hashes churn, by design.** The literal key sits in the hashed bytes of all three digests (`hashContract` includes `extensionPacks: {}` even when empty; `canonicalization.ts` `TOP_LEVEL_ORDER` pins its position). Every contract's `storageHash`/`executionHash`/`profileHash` changes, which relocates every content-addressed snapshot under `migrations/snapshots/<hex>/` and rewrites every migration's recorded from/to hashes. All of that is regenerated mechanically via `pnpm fixtures:emit` (requires a local Postgres `DATABASE_URL`); nothing is hand-edited.

**`schemaVersion` stays "1"** (operator decision). The contract schema freezes at RC; pre-RC contracts are regenerated via the upgrade skill, not migrated in place.

**No new ADR.** This is convergence to the already-ratified ADR 105 design, not an architectural shift. Two existing docs get corrected: ADR 004 falsely states both hashes exclude `extensionPacks` (the implementation includes the key, and after this slice the key is `extensions`); ADR 112 mixes both spellings (`extensions.<namespace>` in the SPI section, `contract.extensionPacks` in the runtime section).

## Coherence rationale (slice-INVEST / Small)

~480 non-generated files mention the key, but review attention concentrates on ~107 non-test source files in `packages/` — schemas, canonicalization, hashing, builders, interpreters, emitter, config validation. The remaining bulk is (a) mechanical test/example config edits and (b) regenerated artifacts produced by one command. One reviewer can hold the design (three renames + guard inversion) in one sitting; the diff rolls back as one unit. Splitting would strand the tree in a mixed-vocabulary state between PRs.

## Scope

**In:**

- Core config key, arktype schema, validation (guard inversion + error strings that name the key, e.g. `contract-psl` interpreter's "Add … to extensionPacks in prisma-next.config.ts").
- Contract document key: framework `Contract` type, SQL + Mongo family arktype validators, canonicalization `TOP_LEVEL_ORDER`, `hashContract`, emitter `generate-contract-dts.ts`, CLI control-API enrichment/emit, contract-space aggregate loader.
- TS builders (SQL + Mongo `contract-ts`), PSL interpreters (SQL + Mongo `contract-psl`), sugar `define-config.ts` mapping (postgres/sqlite/mongo).
- User-facing provider-API fields that literally carry the key (e.g. `ContractSourceContext.composedExtensionPacks`) — renamed to match.
- `sourceFormat` → `format` (~26 files); sugar `outputPath` → `output` (~7 files).
- All example/app/test configs (`examples/`, `apps/`, `test/integration/`, `test/e2e/`), including raw-form fixture configs.
- Regeneration of all contract artifacts, migrations, and snapshots via `pnpm fixtures:emit`.
- Docs: ADR 004 + ADR 112 corrections, subsystem docs (Data Contract; Ecosystem Extensions & Packs), `docs/glossary.md`, `skills/prisma-next-contract`, `skills/prisma-next-debug`, `skills/DEVELOPING.md`.
- Upgrade instructions for both consumers (`skills/upgrade/prisma-next-upgrade`) and extension authors (`skills/extension-author/prisma-8-extension-upgrade`), via the record-upgrade-instructions skill.

**Deliberately out:**

- Dropping the `sha256:` hash prefix — a separate RC1 roadmap item.
- Concept/type identifiers: `ExtensionPackRef`, `ControlExtensionDescriptor`, `extension-pack-inputs.ts`, "pack" vocabulary (ADR 153 governs it). The freeze set is config keys, not TS type names.
- `db: { connection }` (adding `db: string` later is additive), `migrations.dir`, `formatter.indent` — audited, freeze-safe as-is.
- `family`/`target`/`adapter`/`driver` wiring keys — surface-documentation question, not a rename.
- Historical records keep the old spelling: `CHANGELOG.md`, `docs/releases/*`, past upgrade instructions, `projects/` archives.
- Replay fixture chains (`examples/prisma-8-demo/fixtures/**`) and `apps/telemetry-backend` snapshot files keep old-key contracts: they have no regen mechanism, are hash-keyed so old snapshots are only reachable by old hashes, and are never deserialized by green suites (reviewer-verified). Re-anchoring is TML-3082 (replay regen tool) and TML-3083 (telemetry hash-advance). Ratified deviation from the "no literal remains" DoD line, 2026-07-23.

## Contract impact

Top-level `contract.json` key renamed; all three hashes change for every contract; every `contract.d.ts`, `{start,end}-contract.*` bookend, and content-addressed snapshot directory regenerates. Downstream consumers re-emit via the upgrade skill; no in-place migration of old contracts.

## Adapter impact

Postgres, SQLite, Mongo sugar configs all change (`outputPath` → `output`; `extensions` passthrough now 1:1 instead of mapping to `extensionPacks`). No adapter behavior changes.

## Pre-investigated edge cases

| Edge case | Guidance |
| --- | --- |
| Guard inversion direction | Old key must fail loudly with the new name in the message, not be silently ignored — silent ignoring would drop users' extension packs from emitted contracts. |
| Hash-anchored artifacts | Never hand-edit generated files; a partial regen leaves old hashes beside new canonical bytes, which `fixtures:check` and the migration verifier both flag. Order: source rename first, then `pnpm fixtures:emit`, then `pnpm fixtures:check`. |
| Renames break assertions outside `packages/` | Sweep `test/integration/` + `test/e2e/` and run those suites before declaring green (has bitten twice before). |
| config-loader macOS tmpdir flake | `load.test.ts` fails locally on macOS (`/var` vs `/private/var`); green on Linux CI — not a regression from this slice. |
| PSL `extensions { }` block | The PSL block keyword is already `extensions`; no PSL grammar change is in scope. |

## Slice DoD

- `pnpm fixtures:check` green; no `extensionPacks`, `sourceFormat`, or sugar `outputPath` literal remains outside historical records (releases, CHANGELOG, past upgrade instructions, `projects/` archives).
- Upgrade instructions recorded for consumers and extension authors.
- ADR 004 / ADR 112 corrected to the new key.

## References

- Surface map + config audit: conversation record (2026-07-22); key anchors: `config-validation.ts:162`, `canonicalization.ts:77,264`, `hashing.ts:50-98`, `generate-contract-dts.ts:209`, `validators.ts:347` (sql-contract), `contract-schema.ts:434` (mongo-contract), `define-config.ts:59` (postgres sugar).
- ADR 004 (hash split), ADR 105 (extension encoding — the target design), ADR 106 (canonicalization for extensions), ADR 112 (extension packs), ADR 199 (migration identity).
