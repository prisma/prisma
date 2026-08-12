# Summary

Expose the existing contract-output plumbing on the user-facing `defineConfig` wrappers for the two first-party targets that currently hide it (Mongo, Postgres) and add a matching `--output-path` flag to `prisma-next contract emit`. The user-facing knob is a **directory path** (`outputPath`); the emitter writes `contract.json` and `contract.d.ts` (canonical filenames) inside that directory. SQLite users already control the output path through the framework-level `defineConfig` and are out of scope for this project — see [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-defineconfig-wrapper-at-parity-with-mongo) for the follow-up that closes the ergonomic gap.

# Purpose

Give Prisma Next users control over where the contract emitter writes its two generated artifacts (`contract.json`, `contract.d.ts`), through a config-file option and a matching CLI flag. The feature exists because users (originating from a MongoDB customer request and applying equally to Postgres) need to integrate contract emission with project layouts that don't match the default schema-co-located convention.

# At a glance

The new surface is one optional field on `defineConfig` and one optional flag on the CLI. Both take a **directory** value; the emitter writes `contract.json` and `contract.d.ts` inside it (the filenames are canonical — users pick the directory, not the filename).

```ts
// prisma-next.config.ts
import { defineConfig } from '@internal/mongo/config'; // or /postgres/config

export default defineConfig({
  contract: './src/contract.prisma',
  outputPath: './generated',   // ← new, optional; identical surface across Mongo + Postgres wrappers
  db: { connection: process.env['MONGODB_URL']! },
});
```

```bash
prisma-next contract emit --output-path ./generated
```

In both cases the emitter writes `./generated/contract.json` and `./generated/contract.d.ts`.

The framework-level plumbing (`ContractConfig.output` → `normalizeContractConfig` → `executeContractEmit` → `getEmittedArtifactPaths`) still operates on file paths internally and is unchanged. The wrappers and the CLI operation convert `<dir>` to `<dir>/contract.json` before handing off — the framework boundary is unmoved.

SQLite users today wire `coreDefineConfig` from `@internal/cli/config-types` directly and already pass the output path explicitly as the second argument to `typescriptContract(contract, 'src/prisma/contract.json')`. The ergonomic wrapper at parity with Mongo + Postgres is tracked separately at [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-defineconfig-wrapper-at-parity-with-mongo).

```mermaid
flowchart LR
  Config[prisma-next.config.ts<br/>outputPath?: string<br/>directory] --> Define[defineConfig wrapper]
  CLI[--output-path dir flag] -.precedence.-> Emit
  Define -- join dir, contract.json --> Provider[ContractConfig.output<br/>file path]
  Provider --> Norm[normalizeContractConfig]
  Norm --> Emit[executeContractEmit]
  Emit --> Paths[getEmittedArtifactPaths]
  Paths --> JSON[contract.json]
  Paths --> DTS[contract.d.ts]
```

# Scope

## In scope

- A new optional `outputPath?: string` field on the two target `defineConfig` wrappers that currently hard-wire the path: `@internal/mongo/config` and `@internal/postgres/config`. **Directory semantics** — value is the directory the emitter writes into; the emitted filenames are canonical (`contract.json`, `contract.d.ts`). Identical surface across both wrappers.
- A new `--output-path <dir>` flag on `prisma-next contract emit`, with the same directory semantics, taking precedence over the config value.
- A short documentation update covering the new knob, its default, and CLI/config precedence.
- Test coverage for both wrappers, the CLI flag, the precedence rule, and the "no override → unchanged default behaviour" invariant.

## Non-goals

- Adding a `@internal/sqlite/config` `defineConfig` wrapper at ergonomic parity. SQLite already supports a custom output path through the framework-level `defineConfig` + `typescriptContract(contract, output)` plumbing; the ergonomic wrapper is tracked at [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-defineconfig-wrapper-at-parity-with-mongo).
- Independent control over `.json` and `.d.ts` paths. The two stay co-located inside the chosen directory, derived by the existing `getEmittedArtifactPaths`.
- Letting users pick the filename. `contract.json` and `contract.d.ts` are canonical; user-supplied filenames are not supported. The wrapper / CLI surface accepts a directory only.
- Changes to the contract surface, contract schema, or emitter algorithm. Output *location* only.
- Changes to the framework-level `ContractConfig.output` shape. It remains a file path internally; the wrappers / CLI convert directory → file path before the framework boundary.
- Changes to migration manifest output. `migrations.dir` continues to govern that surface unchanged.
- Post-emit transformation hooks, formatters, or codegen plugins.
- Rewriting the [`contract-space-package-layout`](../../.cursor/rules/contract-space-package-layout.mdc) rule. It remains the recommended default for application/extension authors. A one-line clarification ("convention, not mandate; overridable via `outputPath`") may land at close-out but isn't load-bearing for this project.
- Soft warnings on unusual paths (non-`.json` extension, directory-shaped path, collision with contract source). The earlier file-path design treated these as edge cases worth surfacing; under directory semantics they either don't apply or are simpler concerns left to filesystem-level errors.
- Hard validation of the supplied path (escape-traversal blocking, `node_modules` blocking, overwrite protection).

# Approach

The change is a thin user-facing extension over plumbing that already exists. The framework-level `ContractConfig.output` (a file path) is already optional, already threaded through the entire emit pipeline, and already honoured by `getEmittedArtifactPaths`. The two affected layers are:

1. **The `defineConfig` wrappers in two target extension packages (Mongo + Postgres).** Today each hard-wires `output = deriveOutputPath(options.contract)`. The change is to accept an optional `outputPath` (directory) in the options type and convert it to a file path internally by `join(options.outputPath, 'contract.json')` before handing to the framework-level provider. When `outputPath` is absent, the existing `deriveOutputPath(options.contract)` fallback runs unchanged. Identical surface across Mongo + Postgres is an invariant (I-output-3). (SQLite has no `defineConfig` wrapper today; users go through `coreDefineConfig` directly and explicitly pass a file path. Closing the SQLite ergonomic gap is tracked at TML-2677.)

2. **The CLI `contract emit` command.** Add a `--output-path <dir>` flag at the command surface, thread the directory value into the control-API operation as `ContractEmitOptions.outputPath`, and have the operation convert it to a file path (`join(outputPath, 'contract.json')`) before passing to `getEmittedArtifactPaths`. The CLI value takes precedence over the value read from the config. When neither is supplied, the path comes from the normalized config (which falls back to the wrapper's derivation, which falls back to `DEFAULT_CONTRACT_OUTPUT`).

The `.d.ts` file's location stays a derivation of the `.json` location. The mental model is **"the user picks the directory; the emitter picks the filenames."** Lifting the co-location would require revisiting `getEmittedArtifactPaths` and downstream import expectations; no user need motivates it.

Validation is intentionally minimal: `mkdir -p` of the parent directory (existing behaviour, preserved). No soft warnings on the user's directory choice. The override is a config-file UX surface, not a security boundary.

# Project Definition of Done

- [ ] **PDoD1.** Single slice (per the project plan) merged.
- [ ] **PDoD2.** `outputPath` accepted on both Mongo + Postgres `defineConfig` wrappers with identical surface (option name, type, directory semantics, canonical filenames).
- [ ] **PDoD3.** `--output-path <dir>` flag accepted by `prisma-next contract emit`, with CLI > config > default precedence.
- [ ] **PDoD4.** Default behaviour (no `outputPath` set, no `--output-path` passed) is byte-identical to pre-change emit output for at least one Mongo and one Postgres fixture / example.
- [ ] **PDoD5.** Tests covering: (a) both wrappers' new option; (b) the CLI flag; (c) precedence; (d) the default-unchanged invariant; (e) canonical filenames are written regardless of the source filename.
- [ ] **PDoD6.** Docs updated: a short section in the relevant config / CLI reference describing the option, its default, and precedence. Examples (`examples/mongo-demo` et al.) **not** updated to use the override — keeping the default-path examples is the right baseline.
- [ ] **PDoD7.** `pnpm build`, `pnpm test:packages`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm lint:deps`, `pnpm fixtures:check` all green.
- [ ] **PDoD8.** Mandatory final retro complete; output landed (canonical findings / `drive/calibration/` / ADR — whichever fits).
- [ ] **PDoD9.** Long-lived docs migrated into `docs/` if any (likely a short addition to the Contract Emitter subsystem doc; possibly a one-line clarification to the `contract-space-package-layout` rule).
- [ ] **PDoD10.** Repo-wide references to `projects/customize-generated-asset-output-path/**` removed / replaced with canonical links.
- [ ] **PDoD11.** `projects/customize-generated-asset-output-path/` deleted.
- [ ] **PDoD12.** Linear ticket [TML-2664](https://linear.app/prisma-company/issue/TML-2664/mongo-feature-request-customize-generated-asset-output-path) auto-closed by PR merge integration.

# Functional Requirements

- **FR1.** `@internal/mongo/config`'s `defineConfig({ contract, outputPath?, db, ... })` accepts an optional `outputPath: string` (directory) and converts it internally to `join(outputPath, 'contract.json')` before passing to the framework-level provider. If absent, behaviour is identical to today.
- **FR2.** `@internal/postgres/config`'s `defineConfig` accepts the same optional `outputPath: string` with identical directory semantics.
- **FR3.** When `outputPath` is set, the emitter writes `<outputPath>/contract.json` and `<outputPath>/contract.d.ts`. The filenames are canonical; the user controls the directory only.
- **FR4.** `outputPath`, when relative, resolves against the directory containing `prisma-next.config.ts` for the config-file value, or against the current working directory for the CLI flag value (matching CLI convention for path args).
- **FR5.** `prisma-next contract emit --output-path <dir>` overrides the config-file value (and any default).
- **FR6.** When `outputPath` is absent from both config and CLI, the emitted paths are byte-identical to current behaviour for every existing fixture / example.
- **FR7.** The output directory is created if missing (existing `mkdir` behaviour, preserved).

# Non-Functional Requirements

- **NFR1.** No `any`. No `@ts-expect-error` outside negative type tests. No lint suppression. Minimal casts. (Per [`AGENTS.md § Typesafety rules`](../../AGENTS.md).)
- **NFR2.** Tests added before implementation changes (per [`AGENTS.md § Golden Rules`](../../AGENTS.md)).
- **NFR3.** No changes to `contract.json` / `contract.d.ts` payload shape; the artifacts at the new location are byte-identical to the artifacts at the default location.
- **NFR4.** Performance impact zero — the change is a pass-through option; no new I/O, no new computation.
- **NFR5.** Use `pathe`, not `node:path`, for any new path manipulation (per [`use-pathe-for-paths`](../../.cursor/rules/use-pathe-for-paths.mdc)).

# Contract-impact

This work does **not** change the contract surface (`packages/0-shared/contract/**`, `packages/1-framework-core/**`). The emitted artifacts (`contract.json`, `contract.d.ts`) and their schema, validation rules, and downstream consumers are untouched. Only the *destination paths* of those artifacts are configurable.

# Adapter-impact

Affects the two first-party target config wrappers that hard-wire the output path today:

- `@internal/mongo` (`packages/3-extensions/mongo/src/config/define-config.ts`)
- `@internal/postgres` (`packages/3-extensions/postgres/src/config/define-config.ts`)

The framework-level `ContractConfig.output` and the emitter / CLI plumbing are unchanged; only the two existing `defineConfig` wrappers gain the new option, plus the CLI command surface gains the new flag.

`@internal/sqlite` is **not** affected — it has no `defineConfig` wrapper today. SQLite users go through the framework-level `defineConfig` from `@internal/cli/config-types` and already pass an explicit output path. Adding a SQLite wrapper at parity is tracked separately at [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-defineconfig-wrapper-at-parity-with-mongo).

# ADR pointer

Likely no new ADR required — this is a config-surface extension, not an architectural shift. If the slice surfaces a non-obvious convention worth pinning (e.g. validation policy, future symmetric option treatment), it'll land in `drive/calibration/` or as a one-line clarification to [`contract-space-package-layout`](../../.cursor/rules/contract-space-package-layout.mdc) at close-out. Decision deferred to the retro.

# Constraints + Assumptions

- **A1.** `ContractConfig.output` semantics (file path to `contract.json`, with `.d.ts` derived by `getEmittedArtifactPaths`) are the right shape to expose user-side. This is load-bearing — if the underlying semantics change, this project's surface changes too. The plumbing has been stable through several emitter refactors and there is no signal it's about to move.
- **A2.** Mongo + Postgres `defineConfig` wrappers can accept the same option type without target-specific divergence. Confirmed by inspection — both wrappers already share an identical `deriveOutputPath` helper and identical `output` threading. SQLite has no wrapper to update and is out of scope (see TML-2677).
- **A3.** The CLI command's existing argument-parsing infrastructure supports adding a new optional flag without architectural changes. Confirmed by inspection.
- **A4.** Existing fixtures / examples that don't use `output` will continue to work unchanged (FR7). Verified by FR7 being part of PDoD4.
- **A5.** The `[`contract-space-package-layout`](../../.cursor/rules/contract-space-package-layout.mdc)` rule is correctly understood as a recommended default for application/extension authors, not a hard mandate. Operator-confirmed at design time (Q7).

# Open Questions

_All design-level questions resolved. See [`design-notes.md`](./design-notes.md) for the settled model, including the file-path → directory-path pivot during PR review._

# References

- Linear ticket: [TML-2664](https://linear.app/prisma-company/issue/TML-2664/mongo-feature-request-customize-generated-asset-output-path) (in `[PN] EA Release`)
- Project design notes: [`./design-notes.md`](./design-notes.md)
- ADR 007 — Types-Only Emission (`docs/architecture docs/adrs/ADR 007 - Types Only Emission.md`)
- Subsystem doc — Contract Emitter & Types (`docs/architecture docs/subsystems/2. Contract Emitter & Types.md`)
- Rule — `contract-space-package-layout` (`.cursor/rules/contract-space-package-layout.mdc`)
- Follow-up ticket (SQLite parity): [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-defineconfig-wrapper-at-parity-with-mongo)
- Existing call sites (verified during slice spec authoring):
  - `packages/3-extensions/mongo/src/config/define-config.ts` — Mongo wrapper (gap)
  - `packages/3-extensions/postgres/src/config/define-config.ts` — Postgres wrapper (gap)
  - `packages/1-framework/3-tooling/cli/src/commands/contract-emit.ts` — CLI command (flag wiring)
  - `packages/1-framework/3-tooling/cli/src/control-api/operations/contract-emit.ts` — CLI op (precedence)
- Existing plumbing (unchanged):
  - `packages/1-framework/1-core/config/src/config-types.ts` — `ContractConfig.output`, `normalizeContractConfig`, `DEFAULT_CONTRACT_OUTPUT`
  - `packages/1-framework/3-tooling/emitter/src/artifact-paths.ts` — `getEmittedArtifactPaths`
