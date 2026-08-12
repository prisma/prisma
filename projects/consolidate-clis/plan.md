# Consolidate the Prisma CLIs — plan

Direction and grammar agreed 2026-08-05. Owned by Will; working clones of the three repos live under `wip/repos/` (gitignored): this repo, `composer`, `prisma-cli`. Spec: [spec.md](./spec.md); grammar: [cli-consolidation-plan.md](./cli-consolidation-plan.md); evidence: [current-state.md](./current-state.md).

## External dependencies

- **Terminal: Composer replaces the Compute config path** (independent effort). Blocks final deprecation of `@prisma/cli`'s app workflow and `prisma.compute.ts`, not our build.
- **`@prisma/dev`**: confirm what package the emulator actually ships as (composer's `@internal/dev-emulators` published standalone, or an existing package).

## Phase 1 — Seams and contracts (parallel, per repo)

### 1a. Host/product contract (prisma-cli repo)
- Write the contract: config-section schema registration, structured-error/`--json` conventions (merge this repo's CLI Style Guide with prisma-cli's ADR-0003 and the grammar doc's Layer 6), test-double contract, and the config rules (no import-time side effects; factories and `defineConfig` never throw; validation as per-section diagnostics).
- Build the conformance suite that checks a product package against the contract.

### 1b. This repo (Prisma 8)
- Close the control-client leaks: route the 14 command modules importing `@internal/migration-tools` directly through `ControlClient`; extend it where operations are missing.
- Thin the commands: orchestration moves into control-api operations; commands become parse → call → render; return exit codes instead of calling `process.exit`.
- Flip the config loader from throw-on-invalid to return-with-diagnostics; add the versioned `defineConfig` marker.
- Export a fixture-backed `ControlClient` test double from a published entrypoint.

### 1c. Composer (long pole — start first)
- Build the programmatic API over `@internal/assemble` (deploy/destroy/dev/log as typed operations returning structured results), wrapping the alchemy invocation.
- Config contract compliance, minimal: the per-field throwing validator becomes diagnostics, and the effect-resolution preflight surfaces as a diagnostic instead of an import crash. Config imports of `/control` stay as they are.
- Carve the emulator out as `@prisma/dev` (or wire to the existing package) behind a dynamic import with the install-remediation error.
- Export a test double.

## Phase 2 — The host (prisma-cli repo)

1. Repurpose the repo: package renames to `prisma`, keeping the shell layer (runtime/help/output/prompt/global flags, `--json`, error mapping). The `@prisma/cli` build/deploy controllers are dropped, not ported.
2. Take pinned dependencies on `@prisma/orm-toolchain` and `@prisma/composer`; stand up the dependency-bump release automation.
3. Unified config loader: c12 discovery of `prisma.config.ts`, versioned-marker detection (v7 file → recognizable classic-config error), envelope schema, per-product section registration, evaluation-never-errors semantics, settled traversal rules (anchor, stopping condition, monorepo stance).
4. Port the command surfaces onto the grammar doc's tree:
   - **Prisma 8** (from `@internal/cli`): `contract *`, `migration *` (incl. `ref`), `db migrate | update | init | verify | sign | schema`, `init`, `telemetry`, `lsp`; `format` → `contract format`; clipanion `migration-cli` retires with the port.
   - **Platform** (salvaged from `@prisma/cli`): `auth *`, `project` records/env, `postgres *` (from today's `database`, with `remove`→`delete`, `restore`→`backup restore`), `app *` (`list-deploys`/`show-deploy` → `deployment list|show`), `bucket *`, `git`, `agent`.
   - **Orchestration** (new wiring on Composer's API): `project dev | deploy | plan(stub) | status(stub)`; stub the control client where 1c hasn't landed, replace as it does.
5. Adopt this repo's `cli-telemetry` host-wide (one consent, per-product enrichment).
6. Host test suite against the doubles + real-package smoke suite; conformance suite from 1a wired into CI.

## Phase 3 — Ecosystem and cutover

1. Codemods/upgrade recipes for **our** surfaces only: `prisma-next.config.ts` → `prisma.config.ts` (894 occurrences across 333 files in this repo alone) and `prisma-composer.config.ts` → composer section. `prisma.compute.ts` migration is Terminal's.
2. create-prisma: templates generate the unified config; deploy path invokes `prisma`.
3. Name sweep per ROADMAP §6 (templates, skills, error-message links, env-var prefixes, per-user config path, telemetry identifiers).
4. Publish `prisma` per the takeover-sequencing decision; deprecate the `prisma-next`, `prisma-cli`, `prisma-composer` binaries per the window decision (side doors, if kept, become thin wrappers over the host).
5. Docs: ignite (`product/surfaces/cli.md`, glossary, terminal ADR-0006 correction), repo READMEs, prisma.io. Close out this project folder into `docs/`.

## Risks

- **Composer's restructuring is the long pole** — programmatic API + config-entrypoint inversion + emulator carve-out, all in one repo while Terminal leans on it for Compute adoption. Start 1c first; the host-side stub keeps Phase 2 unblocked.
- **Grammar-prior mismatch at launch**: classic users and LLM priors will type `prisma migrate ...` and `prisma database ...`. The structured unknown-command guidance ("did you mean `prisma db migrate`") is launch-critical polish, not a fast-follow.
- **Prisma 7 config collision**: the versioned-marker detector must land before the host ever claims `prisma.config.ts`; a silently misparsed v7 file is the worst launch bug available.
- **Composer import fragility**: only composer users' configs import composer code, so the exposure matches today's — but for them, an effect-resolution mismatch must surface as a config diagnostic, not an import crash that takes out every command. The conformance suite checks the no-throw-at-import rule.
- **Two owners, one repo**: prisma-cli hosts both the dying `@prisma/cli` and the new host during transition; agree branch/release separation with Terminal before Phase 2 starts.

## Sequencing

```
Phase 1c (Composer)  ── longest, start first ─┐
Phase 1a (contract)  ─────────────────────────┼─→ Phase 2 (host; stubs cover 1c until it lands)
Phase 1b (Prisma 8)  ─────────────────────────┘         → Phase 3 (ecosystem, cutover before GA)
```
