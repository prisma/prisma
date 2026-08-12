# Project Plan: customize-generated-asset-output-path

**Spec:** [`./spec.md`](./spec.md)
**Design notes:** [`./design-notes.md`](./design-notes.md)
**Linear ticket:** [TML-2664](https://linear.app/prisma-company/issue/TML-2664/mongo-feature-request-customize-generated-asset-output-path) (no separate Linear Project — per operator direction, the existing ticket in `[PN] EA Release` is the surface)

**Purpose** _(from spec)_: Give Prisma Next users control over where the contract emitter writes its two generated artifacts (`contract.json`, `contract.d.ts`), through a config-file option and a matching CLI flag, applied consistently across every first-party target.

## At a glance

Single slice covering both Mongo + Postgres `defineConfig` wrappers, the CLI flag, and tests. No stack; nothing to parallelise. Design ceremony was substantial; implementation is contained — per the [`Design depth ≠ slice count`](../../drive/triage/README.md#design-depth--slice-count) heuristic.

## Composition

### Single slice

**Slice `output-path-override`** — expose `outputPath?: string` (directory) on both Mongo + Postgres `defineConfig` wrappers and add `--output-path <dir>` to `prisma-next contract emit`, with CLI > config > default precedence. Land both wrappers + CLI + tests + docs in one PR. (The slice initially shipped with file-path semantics and the field name `output`; PR review reshaped the design — see [`./slices/output-path-override/plan.md § PR-review-response round`](./slices/output-path-override/plan.md#pr-review-response-round-file-path--directory-path).)

- **Purpose**: deliver every PDoD condition in one cohesive change so the user-facing surface ships consistent across Mongo + Postgres in a single rollout step.
- **Scope**:
  - `packages/3-extensions/mongo/src/config/define-config.ts` — add `outputPath?: string` (directory) to `MongoConfigOptions`; convert internally to `join(outputPath, 'contract.json')`; default-path derivation unchanged when absent.
  - `packages/3-extensions/postgres/src/config/define-config.ts` — same change to `PostgresConfigOptions`, identical surface.
  - `packages/1-framework/3-tooling/cli/src/commands/contract-emit.ts` — add `--output-path <dir>` flag.
  - `packages/1-framework/3-tooling/cli/src/control-api/operations/contract-emit.ts` — accept the CLI directory value; join to `contract.json`; CLI > config > default precedence at the entry point.
  - Test additions: unit tests for each wrapper (`outputPath` converted to `<dir>/contract.json`); CLI test for the flag + precedence + canonical-filename invariant; integration / e2e test confirming `--output-path <dir>` produces `<dir>/contract.json` + `<dir>/contract.d.ts`.
  - Docs: a short section in the CLI Style Guide (no architecture-doc subsection — see § PR-review-response round in the slice plan for the operator's pushback).
- **Depends on**: nothing internal; nothing external.
- **Linear**: [TML-2664](https://linear.app/prisma-company/issue/TML-2664/mongo-feature-request-customize-generated-asset-output-path) — the ticket *is* the slice's Linear surface; no separate slice issue.

### Out of project (tracked separately)

- **TML-2677** — Add `@internal/sqlite/config` `defineConfig` wrapper at ergonomic parity with Mongo + Postgres. Surfaced during this project's slice spec authoring; deliberately deferred (not a config-knob extension; needs its own design pass + demo migration).

## Dependencies (external)

None.

## Project-DoD coverage map

| Project-DoD | Delivered by |
|---|---|
| **PDoD1.** Single slice merged | `output-path-override` |
| **PDoD2.** `outputPath` (directory) on both Mongo + Postgres `defineConfig` wrappers | `output-path-override` |
| **PDoD3.** `--output-path <dir>` flag with CLI > config > default precedence | `output-path-override` |
| **PDoD4.** Default behaviour byte-identical for Mongo + Postgres fixtures | `output-path-override` (test invariant) |
| **PDoD5.** Tests covering wrappers, CLI flag, precedence, default-unchanged, canonical-filenames | `output-path-override` |
| **PDoD6.** Docs updated (CLI Style Guide) | `output-path-override` |
| **PDoD7.** Repo green: build, test:packages, test:integration, test:e2e, lint:deps, fixtures:check | `output-path-override` (slice DoD gates) |
| **PDoD8.** Final retro complete; output landed | close-out |
| **PDoD9.** Long-lived docs migrated into `docs/` | close-out |
| **PDoD10.** Repo-wide references to `projects/...` removed | close-out |
| **PDoD11.** `projects/customize-generated-asset-output-path/` deleted | close-out |
| **PDoD12.** TML-2664 auto-closed by PR merge | `output-path-override` PR merge |

## Risks + open questions

_All resolved during slice execution + PR-review-response round. No remaining open items._

## Close-out (required)

- [ ] Verify all acceptance criteria in [`./spec.md`](./spec.md)
- [ ] Mandatory final retro complete; output landed in canonical / `drive/calibration/` / ADR
- [ ] Migrate long-lived docs into `docs/` (likely small additions to the Contract Emitter subsystem doc; possibly a one-line clarification to the `contract-space-package-layout` rule)
- [ ] Strip repo-wide references to `projects/customize-generated-asset-output-path/**` (replace with canonical `docs/` / `.cursor/rules/` links or remove)
- [ ] Delete `projects/customize-generated-asset-output-path/`
- [ ] Linear ticket [TML-2664](https://linear.app/prisma-company/issue/TML-2664/mongo-feature-request-customize-generated-asset-output-path) auto-closed by PR merge integration
