# ADR 097 — Tooling runs on canonical JSON only


## Context

We now support two authoring modes for the data contract

- **PSL-first**, emitting a canonical contract.json and .d.ts types
- **TS-first**, where a typed builder creates a pure data contract object used directly in app code

Tooling such as the migration planner, preflight, ledger utilities, Studio, and PPg services must operate deterministically and securely across both modes. Evaluating application TypeScript in tooling pipelines introduces nondeterminism, security risk, and environment drift. Canonical JSON artifacts avoid these issues.

## Problem statement

- If tooling imports TS contracts, outcomes can differ by Node version, package graph, environment variables, or side effects
- Hosted and CI environments should not execute arbitrary application code
- We must guarantee that tools observe the exact same schema the runtime verifies via coreHash

## Goals

- All tools consume the canonical JSON contract and never require TS evaluation
- TS-first remains a no-emit developer workflow, while CI and hosted services are artifact driven
- Canonicalization produces the same coreHash for PSL-first and TS-first contracts
- Keep security boundaries crisp for PPg and CI

## Non-goals

- Deprecate PSL or TS authoring modes
- Require developers to run an explicit generate step during normal development
- Execute untrusted code within hosted services

## Decision

### Tooling runs exclusively on canonical JSON contracts

- The canonical JSON shape and coreHash are defined by ADR 010
- PSL-first projects produce the JSON via the existing emitter
- TS-first projects may operate no-emit in app code, but tools use either an auto-emitted JSON artifact or a CI step that materializes the JSON from TS before tool execution

## Scope of "tooling"

The following components must accept canonical JSON and must not evaluate TS

- Migration planner and migration graph utilities
- Migration runner and ledger management
- Preflight and CI integrations, including shadow DB and EXPLAIN-only modes
- PPg contract-aware services and visualizations
- Studio and CLI contract diff and inspectors
- Conformance kit and certification harnesses

## TS-first compatibility

- Provide a lightweight emit-if-missing step for CI that imports the TS contract in a sandboxed process and calls `canonicalize(contract)` to write `contracts/<coreHash>.json`
- Dev plugins for Vite/Next/esbuild may auto-emit the canonical JSON on import or watch for local tooling while keeping application dev no-emit

## Security and determinism requirements

- Hosted services and PPg must not import TS contracts
- CI emission step runs in a sandbox with
  - Pinned Node version and dependencies
  - Restricted import graph rooted at the contract module
  - No network by default
  - Stable locale and timezone
- The emitted JSON must embed canonicalVersion and the coreHash must equal sha256(json) or the build fails

## Alternatives considered

- **Allow tools to import TS contracts directly**
  Rejected due to security and nondeterminism risks
- **Treat canonical JSON as optional and permit tools to read from the running application**
  Rejected because tools must be able to execute offline in CI and hosted environments
- **Require explicit emit in all workflows**
  Rejected to preserve no-emit DX for developers

## Consequences

### Positive

- Deterministic, auditable tooling across environments
- Clear security boundary for PPg and CI
- Same behavior for PSL-first and TS-first teams

### Negative

- TS-first repos need a minimal emission in CI or a dev plugin to materialize the JSON for tools
- Dual authoring setups need CI to enforce one canonical artifact

## Implementation notes

- Extend @prisma/contract-core with `canonicalize(contract)` returning `{ json, coreHash, canonicalVersion }`
- Provide `prisma-next contract emit --contract src/contract.ts --out contracts` CLI for TS-first repos
- Update all tools to accept `--contract contracts/<coreHash>.json` and fail fast if missing
- Dev plugin emits JSON on import/watch with debounce and presents overlay errors on canonicalization failure

## Testing and conformance

- Golden tests ensuring PSL-first and TS-first yield identical canonical JSON and coreHash
- CI fixture that forbids tool execution if only TS exists and no canonical JSON is present
- Sandbox tests that validate restricted imports and no-network constraints during emission

## Migration strategy

- PSL-first users are unaffected
- TS-first users add either a dev plugin for local tools or a CI job to emit the canonical JSON
- Dual authoring follows ADR 035 to resolve conflicts, with CI enforcing a single canonical artifact

## Open questions

- Should PPg accept a signed canonical JSON upload for preflight to remove the need for any evaluation in PPg jobs
- Do we provide an optional remote artifact store for large repos to avoid committing contract blobs

## References

- ADR 010 — Canonicalization rules for contract.json
- ADR 021 — Contract marker storage & verification modes
- ADR 032 — Dev auto-emit integration
- ADR 035 — Dual authoring conflict resolution
- ADR 096 — TS-authored contract parity & purity rules
