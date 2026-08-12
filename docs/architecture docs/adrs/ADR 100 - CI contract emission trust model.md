# ADR 100 — CI contract emission trust model


## Context

TS-first projects author the data contract in TypeScript and enjoy a no-emit dev loop. Tooling and hosted services must operate on canonical JSON per ADR 047. CI therefore needs a safe, deterministic way to materialize canonical contract.json from TS without evaluating arbitrary application code in an unsafe environment.

## Problem

- Evaluating TS in CI can introduce nondeterminism and supply-chain risk
- Differences in Node version, locale, timezone, or import graph can change outputs
- CI must guarantee that emitted canonical JSON is reproducible and its coreHash is trustworthy

## Goals

- Define a hardened CI emission process that produces canonical JSON deterministically from TS contracts
- Ensure the emitted blob matches ADR 010 canonicalization and yields a stable coreHash
- Prevent untrusted code execution and side effects during emission
- Make results auditable and cacheable across runs

## Non-goals

- Running application build or test codepaths as part of emission
- Replacing PSL authoring or JSON-first workflows
- Allowing hosted services like PPg to evaluate project TS by default

## Decision

CI must follow a sandboxed emit protocol when a canonical contract blob is required and not already present

### Trust and threat model

- Treat repository TS as untrusted input for the purposes of emission
- The emission job runs in a hermetic container with pinned toolchain and no network by default
- The job may only import the declared contract module and approved contract helper packages
- Side effects, filesystem writes outside the workdir, and network calls are blocked

### Required controls

- **Pinned toolchain**
  - Fixed container image with Node, npm/pnpm, TypeScript versions pinned
  - Lockfile enforced in CI
- **Sandboxed evaluation**
  - Run emission in a subprocess with a restricted loader that:
    - Allows only a whitelisted import graph rooted at the contract module
    - Denies access to fs, net, child_process, worker_threads by default
    - Freezes intrinsics and globals, sets TZ=UTC and LANG=C
    - Forbids dynamic import() outside the allowlist
  - Optional VM isolation layer for additional defense in depth
- **Determinism guards**
  - Lint or runtime checks reject use of Date.now(), Math.random(), process.env
  - Object key ordering and number formatting handled by the canonicalizer, not user code
- Enforce ADR 096 purity rules at load time
- **No-network policy**
  - Disable outbound network during emission
  - If a team opts in to network access for specific modules, that decision must be explicit and audited

## Emission workflow in CI

1. **Discover**
   - Locate the TS contract entrypoint from config or default paths
   - If a canonical JSON blob exists at `contracts/<coreHash>.json` and matches the repo's expected hash, reuse it
2. **Evaluate**
   - Import the contract module under the sandboxed loader
   - Validate shape and purity per ADR 046
3. **Canonicalize**
   - Run ADR 010 canonicalization to produce canonicalJson, coreHash, canonicalVersion
4. **Validate**
   - Assert sha256(canonicalJson) === coreHash
   - If a preexisting JSON exists for the same coreHash, byte-compare to detect drift
   - If PSL also exists, ensure PSL-emit yields the same coreHash per ADR 035
5. **Persist**
   - Write to `contracts/<coreHash>.json` and `contracts/current.contract.json` symlink or pointer
   - Write an emission manifest with toolchain versions, canonicalizer version, and a fingerprint of the allowlist
6. **Sign and cache (optional)**
   - Sign the blob and manifest with CI-managed key
   - Store in build cache keyed by (repoSha, contractPath, canonicalizerVersion)

## Failure modes and actions

- Purity or shape violation → fail with ERR_CONTRACT_INVALID_TS and point to offending node
- Sandbox violation → fail with ERR_CONTRACT_SANDBOX_VIOLATION and list blocked API/module
- Hash mismatch → fail with ERR_CONTRACT_CANONICAL_HASH if sha256(json) !== coreHash
- Dual authoring mismatch → fail with ERR_CONTRACT_DUAL_AUTHORING_DIVERGED
- Non-determinism detected (two canonicalizations differ) → fail with ERR_CONTRACT_UNSTABLE

## Artifacts

- `contracts/<coreHash>.json` canonical blob
- `contracts/current.contract.json` pointer file
- `contracts/<coreHash>.manifest.json` including
  - canonicalVersion, coreHash, toolchain versions, canonicalizer version
  - import allowlist, sandbox flags, timestamps
  - optional signature

## PPg and hosted services

- PPg accepts canonical JSON only by default for preflight and visualization
- Optional enterprise mode may allow TS emission inside a PPg-managed sandbox, disabled by default

## Alternatives considered

- **Evaluate TS in every tool rather than emitting once**
  Rejected for security and determinism
- **Require explicit emit for all workflows**
  Rejected to keep no-emit DX in dev, while CI remains artifact-driven
- **Trust developer-committed JSON without CI verification**
  Rejected due to integrity risk

## Consequences

### Positive

- Deterministic, auditable artifacts with clear provenance
- Strong security posture for CI and hosted workflows
- Consistent behavior across PSL-first and TS-first teams

### Negative

- Slight CI complexity to set up sandbox and allowlist
- Teams with dynamic contract assembly must refactor to pure data

## Implementation notes

- Provide `prisma-next contract emit --contract <path> --out contracts --ci` that enables sandbox mode and writes manifest
- Ship a default allowlist limited to @prisma/contract-core and official target helpers
- Offer a reproducible container image for CI with pinned toolchain and canonicalizer
- Add a CI action to verify signatures and manifold integrity on reuse

## Testing

- Golden tests: TS-first and PSL-first yield identical canonical JSON and coreHash
- Sandbox tests: attempts to access blocked modules fail with stable errors
- Repro tests: canonicalization stability across repeated runs and containers
- Dual authoring tests: ensure CI fails on divergence

## Migration

- PSL-first users unchanged
- TS-first users add the CI emit step or rely on dev auto-emit to keep blobs up to date
- Document opt-in paths for signed artifact reuse and enterprise PPg TS emission

## References

- ADR 010 — Canonicalization rules for contract.json
- ADR 021 — Contract marker storage & verification modes
- ADR 032 — Dev auto-emit integration
- ADR 035 — Dual authoring conflict resolution
- ADR 096 — TS-authored contract parity & purity rules
- ADR 097 — Tooling runs on canonical JSON only
- ADR 098 — Runtime accepts contract object or JSON
