# TML-2462 — Dispatch plan

Slice spec: [spec.md](./spec.md). One PR, sequential dispatches, single worktree (implementers serialized). Implementers run on Fable; the review pass runs on Opus-4.8-mid. All slow commands via `:agent` wrappers (`build:agent`, `test:packages:agent`, `fixtures:check:agent`, …), foreground-blocking.

## D1 — Substrate rename in `packages/`

**Outcome:** every `packages/` surface carries the new keys; the old key is rejected with a pointed error; unit tests in `packages/` pass.

- `extensionPacks` → `extensions`: framework `Contract` type, canonicalization (`TOP_LEVEL_ORDER`, `canonicalizeContractToObject`, `isRequiredExtensionPacks` helpers), `hashContract`, SQL + Mongo arktype validators, SQL + Mongo TS builders and PSL interpreters (including user-facing error strings naming the key), emitter `generate-contract-dts.ts`, CLI control-API (enrichment, emit, aggregate loader), config types/schema/validation with the `config-validation.ts:162` guard inverted (accept `extensions`; reject `extensionPacks` with "use extensions"), provider-API fields that literally carry the key (`composedExtensionPacks`), sugar `define-config.ts` passthrough.
- `sourceFormat` → `format` and sugar `outputPath` → `output` within `packages/`.
- Concept identifiers (`ExtensionPackRef`, `ControlExtensionDescriptor`, file names) stay; flag borderline cases in the return rather than deciding unilaterally.
- Update `packages/` tests alongside (tests-first where a behavior changes: the guard inversion gets a red test first).

**Builds on:** —. **Hands to:** D2 a tree where `packages/` compiles (`pnpm build:agent`) and `pnpm test:packages:agent` is green except for failures caused by not-yet-updated fixtures/configs outside `packages/`, which D1 enumerates in its return.

## D2 — Repo-wide config and test-tree fan-out

**Outcome:** every config literal outside `packages/` uses the new keys; integration/e2e assertions that name the old keys or old error strings are updated.

- `examples/*/prisma-next.config.ts`, `apps/*` (telemetry-backend, lsp-playground `default-config.ts`), `test/integration/**`, `test/e2e/**` raw-form fixture configs, extension `prisma-next.config.ts` files.
- Sweep for assertion strings: old error messages, snapshot text, key-name expectations in the integration/e2e trees (known failure mode: renames break assertions outside `packages/`).
- Do not touch generated `contract.json` / `contract.d.ts` / migrations — D3 regenerates them.

**Builds on:** D1's compiled substrate. **Hands to:** D3 a tree where the only remaining red is stale generated artifacts.

## D3 — Regenerate artifacts and validate

**Outcome:** all generated artifacts re-anchored; the full CI gate set green.

- `pnpm fixtures:emit` (needs local Postgres `DATABASE_URL`, default `postgres://postgres:postgres@localhost:5432/postgres`), which also runs `migrations:regen` + `migrations:regen:examples`; then `pnpm fixtures:check:agent`.
- Verify snapshot dirs relocated (content-addressed by the new hashes) and no orphan old-hash directories remain staged.
- Full gate set: `build:agent`, `typecheck:agent` (--force), the 13-step Lint job including `lint:casts` + `check:upgrade-coverage`, `test:packages:agent`, `test:integration:agent`, `test:e2e:agent`.
- Stage generated churn explicitly (no `git add -A`).

**Builds on:** D2's clean source tree. **Hands to:** D4 a green tree with the diff complete except docs.

## D4 — Docs and upgrade instructions

**Outcome:** durable docs match the shipped behavior; upgrade paths recorded.

- Correct ADR 004 (hashes include the key; name it `extensions`) and ADR 112 (unify on `extensions.<namespace>` / config `extensions`).
- Sweep `docs/architecture docs/subsystems/` (Data Contract; Ecosystem Extensions & Packs), `docs/glossary.md`, `skills/prisma-next-contract`, `skills/prisma-next-debug`, `skills/DEVELOPING.md`, onboarding docs if they name the key.
- Run record-upgrade-instructions: consumer entry in `skills/upgrade/prisma-next-upgrade/upgrades/`, extension-author entry in `skills/extension-author/prisma-8-extension-upgrade` — covering all three renames and the re-emit requirement.
- `check:upgrade-coverage` green.

**Builds on:** D3's green tree. **Hands to:** review — the slice DoD is met: fixtures:check green, no stray old-key literals outside historical records, ADRs corrected, upgrade instructions recorded.

## Review pass

drive-code-review persona flow on the full branch diff (reviewer tier: Opus-4.8-mid), then intent validation against this spec, then PR open via create-pr (title `TML-2462: rename extensionPacks → extensions; config-format freeze sweep`), pushed via the `bot` remote.
