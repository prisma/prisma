# ADR 041 — Custom operation loading via local packages + preflight bundles


## Context

Migration edges can include custom operations for data moves, backfills, or target-specific DDL not covered by core ops. We want a safe, simple way to author and run these ops locally and in PPg's hosted preflight without introducing a remote registry or resolving monorepos in PPg

## Problem

- Arbitrary scripts are unsafe and unverifiable
- Hosted preflight cannot evaluate users' package managers, workspaces, or monorepos
- We need deterministic execution with clear privilege and resource limits

## Decision

Adopt a local-only ops model plus a deterministic migration bundle for hosted preflight

- Ops are loaded only from the project's filesystem
- Installed packages in the repo (e.g. node_modules) or repo-local files under a configured ops/ directory
- No WASM engines and no network egress from ops
- Ops are shipped as self-contained ESM JavaScript with all runtime deps inlined
- For PPg preflight and CI cloud workers, users submit a migration bundle artifact that contains the contract, the migration graph edges, and the compiled ops
- PPg never resolves your repo or package manager

## Scope

- Applies to migration operations used by the planner/runner
- Does not change query lanes or runtime Plan execution

## Op identity and packaging

- Canonical op ref: packageName/exportName@semver
- Example: @acme/migrate-ops/backfillColumn@2.1.0
- Repo-local ops: file:./ops/reindex.ts#reindex@1.0.0
- Version is declared in the op manifest
- Each op file or package export must co-locate a manifest with:
  - name, version, target (postgres | mysql | mongo | multi)
  - inputsSchema (JSON Schema)
  - preChecks, postChecks using per-family check vocabulary ([ADR 028](ADR%20028%20-%20Migration%20Structure%20&%20Operations.md) / [ADR 188](ADR%20188%20-%20MongoDB%20migration%20operation%20model.md))
  - privilege (read | write | admin)
  - safety (idempotent | bestEffort | nonIdempotent)
  - requiresTx optional
  - compat minimal core version
- Implementation must export execute(ctx, args)
- Optional plan, estimate, dryRun

## Local resolution

- Project config declares where ops live and their refs
- Planner resolves refs against the local filesystem or packages, validates manifests, and pins exact versions in edges
- Runner loads ops by file path or package entry in-process
- A byte-level content digest of the compiled op is recorded in the migration ledger

## Migration bundle for hosted preflight

Produced by prisma-next migrate bundle in the user's CI or dev machine

### Contents

- bundle.json index with coreHash, profile, and edge list
- contract.json canonical data contract
- migrations/*/migration.json migration definitions with pinned op refs and arguments
- ops/*.js self-contained ESM files for each op used by edges
- ops/*.manifest.json corresponding manifests
- fixtures/* optional seed or fixtures for shadow DB

### Constraints

- ESM JavaScript only, deps inlined by esbuild/rollup
- No network operations from ops
- No WASM engines
- Node target version pinned by the bundle to match PPg runtime

## PPg runner behavior

- Verifies bundle digests and coreHash alignment
- Uses bundle ops under sandbox limits from ADR 040
- Never resolves the user repo or node_modules

## Validation and safety

- Inputs validated against inputsSchema before IO
- Pre/post checks must pass for applicability and success
- Idempotency and retry strategy per ADR 038
- Transaction semantics per ADR 037
- Privilege limits and resource caps per ADR 040
- No network egress from ops, enforced by sandbox

## Ledger and audit

For each executed op, record:

- opRef including version
- source package or file
- digest of the compiled op bytes
- manifest summary (target, privilege, safety)
- attempt count, timings, and result

## Policy controls

- Allowlist of package names and repo-local globs
- Optional ban on admin ops outside controlled environments
- Max time and memory caps per task
- PPg rejects bundles that declare forbidden capabilities

## Alternatives considered

- **Hosted registry with signatures**
  Rejected for complexity and operational overhead
- **Evaluating users' monorepos in PPg**
  Rejected due to non-determinism and security
- **Allowing network egress or WASM**
  Rejected to keep the sandbox tight and predictable

## Consequences

### Positive

- Deterministic, reviewable custom ops with no registry
- Straightforward hosted preflight via a single bundle
- Works offline and in air-gapped CI

### Negative

- Authors must bundle ops for PPg
- No dynamic fetching of op updates

### Mitigations

- Provide a simple bundler CLI with clear errors for dynamic imports
- Offer templates and an authoring SDK for manifests

## Implementation notes

- CLI bundler uses esbuild to inline deps and generate digests
- Compile-time check forbids dynamic require and import()
- Bundle can be signed by CI for PPg acceptance
- Local runner can consume the same bundle for parity

## References

- ADR 028 — Migration structure & operations
- ADR 037 — Transactional DDL fallback & compensation
- ADR 038 — Operation idempotency classification & enforcement
- ADR 040 — Node task execution environment & sandboxing
- ADR 029 — Shadow DB preflight semantics
- ADR 051 — PPg preflight-as-a-service contract

