# PR title

TML-2462: rename `extensionPacks` → `extensions`; freeze-window config-key sweep

# PR body

## What changes for a user

```ts
// prisma-next.config.ts — before
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

Sugar configs (`@internal/postgres/config` et al.) already said `extensions`; their `outputPath` becomes `output`. In `contract.json` and `contract.d.ts`, the top-level `extensionPacks` key becomes `extensions`.

## The decision

Config keys freeze at Prisma 8 RC1, so this rename lands now or never. It is convergence, not invention: ADR 105 and most of the Data Contract docs always specified `extensions.<namespace>` as the canonical contract encoding, and the sugar `defineConfig` layer has used `extensions` since it shipped — the core config layer and the emitted contract had drifted to `extensionPacks`. One name remains, at every layer.

Two more freeze-regret keys ride along, per the RC1 roadmap's "sweep the config format" item: `contract.source.sourceFormat` → `contract.source.format` (stutter) and sugar `outputPath` → `output` (one word for one concept across layers).

There are no compatibility aliases. The old config key fails loudly — `Config.extensionPacks is no longer supported; rename it to Config.extensions` — instead of being silently ignored, because silent ignoring would drop extension packs from emitted contracts. (The guard previously pointed in the opposite direction, rejecting `extensions`.)

## Why the diff is large: the key sits in the hashed bytes

Contract canonicalization always emits the extensions key (empty object when unpopulated), so the literal key name is part of the bytes behind `storageHash`, `executionHash`, and `profileHash`. Renaming it changes every contract hash, which re-anchors every migration's recorded from/to hashes and relocates every content-addressed snapshot directory under `migrations/snapshots/`. All of that churn is regenerated, not hand-edited: `pnpm fixtures:emit` plus the per-package generators for fixtures whose basenames the `fixtures:check` glob doesn't cover.

ADR 004 claimed both hashes "intentionally exclude" this key; the implementation has always included it. The ADR is corrected rather than the code changed — excluding the key now would be a second, independent hash break for zero user value.

This branch is merged up to current main, so the emitted hashes here are the prefix-free digests from #1033 (drop the `sha256:` prefix) — the key-rename churn and the prefix drop are composed, not stacked as two format changes. The merge also carries #1022 (PSL scalar-type unification) through `interpreter.ts`, and applies the rename to the ported prisma test corpus (#1035): its 43 `_fixture` configs move off the sugar `outputPath`, and its generated contract fixtures are regenerated through the `extensions` emitter.

Regenerating with changed hashes exposed a latent bug in `scripts/regen-extension-migrations.mjs` (it threw on migrations that import their end contract from the snapshot store): fixed here, with an assertion that the re-emitted `migration.json.to` matches the new hash.

## What deliberately does not change

- Concept type names (`ExtensionPackRef`, `ControlExtensionDescriptor`, "pack" vocabulary per ADR 153) — the freeze set is config keys, not TS identifiers.
- `schemaVersion` stays "1": the schema freezes at RC; pre-RC contracts re-emit via the upgrade skill.
- The `sha256:` hash prefix (separate RC1 roadmap item).
- Historical records (CHANGELOG, docs/releases, past upgrade instructions) keep the old spelling.
- Replay fixture chains and telemetry-backend snapshots keep old-key contracts harmlessly (never deserialized; suites green) — follow-ups TML-3082 (regen mechanism) and TML-3083 (telemetry hash-advance migration before next deploy).

## Upgrade path

`skills/upgrade/prisma-next-upgrade/upgrades/0.16-to-0.17/` (consumers) and `skills/extension-author/prisma-8-extension-upgrade/upgrades/0.16-to-0.17/` (extension authors, including the `composedExtensionPacks` → `composedExtensions` provider-API field) record the mechanical translation: rename the keys, re-emit, re-anchor migrations. `check:upgrade-coverage` enforces the declaration.

## Verification

Full gate set green after the merge: build 68/68, typecheck 143/143, all lint steps, `fixtures:check` (idempotent re-emit), `check:upgrade-coverage`, test:packages (13,501), test:integration (1,172), test:e2e (20/20, 109 tests). Guard inversion is test-first (old key rejected with the pointed message; new key accepted and validated).

Refs TML-2462.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
