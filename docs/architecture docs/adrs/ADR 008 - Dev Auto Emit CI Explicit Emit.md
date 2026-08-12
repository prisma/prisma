# ADR 008 — Dev Auto-Emit, CI Explicit Emit

## Context

- Prisma 7 forces an explicit generate step and ships native binaries, slowing inner loops
- Our contract-first design needs deterministic artifacts for hashing, migrations, and PPg preflight
- Developers want "it just works" in dev, while CI needs reproducible, auditable outputs

## Decision

- **Development**: auto-emit `contract.json` and `contract.d.ts` on import and file change via build-tool plugins
- **CI**: require an explicit `prisma-next contract emit` step that verifies determinism and fails on drift
- Auto-emit is non-authoritative and may be skipped in production builds where contracts are frozen
- CI is authoritative and publishes hashes used by downstream steps

## Details

### What auto-emit does in dev

- Watches the authoritative source declared in config (`authoring: 'psl' | 'ts'`)
- Re-emits on changes to the PSL file, TS builder, or config that affects naming, target, or capabilities
- Writes to a single `outDir` and updates both `contract.json` and `.d.ts`
- Surfaces errors inline in the terminal and as overlay where supported
- Debounces and caches parsed ASTs to keep feedback <200ms for small schemas

### What explicit emit does in CI

- Runs `prisma-next contract emit` once in a clean environment
- Canonicalizes and computes coreHash and profileHash
- Optionally re-emits and byte-compares to enforce determinism
- Produces a `contract.report.json` containing hashes, emitter version, target profile, and summary diagnostics
- Fails the pipeline on non-determinism, dual-source drift, or validation errors

### Frozen contract mode

- Production and release builds may run with `PRISMA_NEXT_FROZEN=1`
- The emitter is disabled and the runtime requires a present `contract.json` whose coreHash matches the DB marker
- Any attempt to re-emit or to compile without a contract fails fast

### Tooling integrations

- Official plugins for Vite, Next.js, and esbuild
- Auto-emit is triggered on the first import of `@prisma/sql` or `contract.d.ts` types, and on subsequent file changes
- Plugins respect the project's authoring mode from ADR 006
- Plugins never write outside `outDir` and never commit files

### Change detection and invalidation

- Re-emit triggers when any of the following change:
  - PSL file or TS builder entry
  - `prisma-next.config.ts` fields that affect naming, target, or capabilities
  - Adapter version that changes capability flags
- Derived artifacts are replaced atomically to avoid partial reads

### Provenance and guardrails

- `contract.json.meta` records authoring mode, source paths, emitter version, and adapter versions
- If both PSL and TS builder are present and modified, dev warns; CI fails
- Auto-emit never overwrites a newer `contract.json` whose coreHash differs without re-parsing the source

### Security notes for TS-first mode

- Dev executes the builder in the app's Node process
- CI can require `--sandbox` to evaluate the builder in a restricted VM
- PPg preflight never executes project code; it consumes `contract.json` only

## Alternatives considered

- **Always explicit emit**: Consistent but slows inner loop and regresses DX
- **Always auto-emit, including CI**: Hides determinism issues and weakens auditability
- **Ship a long-running emitter daemon**: Adds operational complexity with little benefit over build-tool plugins

## Consequences

### Positive

- Fast feedback in dev without manual steps
- Strong determinism in CI with clear provenance and reproducibility
- Reduced production risk via frozen contract mode
- Consistent artifacts for migrations, runtime verification, and PPg

### Trade-offs

- Slight plugin complexity across build tools
- Two mental models to document: auto-emit in dev, explicit emit in CI
- TS-first mode needs sandboxing considerations in CI

## Scope and non-goals

### In scope for MVP

- Vite and Next.js plugins for auto-emit
- `prisma-next contract emit` CLI with determinism checks
- Frozen contract mode and runtime enforcement

### Out of scope for MVP

- Watch mode in CI
- IDE extensions beyond standard TypeScript behavior

## Backwards compatibility and migration

- PSL-first projects adopt auto-emit without changing authoring flow
- TS-first projects add a builder entry and gain the same DX
- CI replaces `prisma generate` with `prisma-next contract emit` and updates downstream steps to read `contract.report.json`

## Open questions

- Whether to require `--verify` on CI emit by default to enforce byte-identical output across OSes
- Standardizing a precommit hook to block staged changes to `contract.json` that don't match the source
- How strict frozen mode should be in staging environments

## Decision record

- Use auto-emit in development for great DX and explicit emit in CI for determinism and auditability
- Support a frozen contract mode in production builds to prevent accidental re-emission and mismatches
