# ADR 026 — Conformance Kit & Certification Levels

## Context

We want a healthy adapter ecosystem while preserving Prisma Next guarantees of determinism, safety, and portability across targets. Community adapters need a clear, objective way to prove compatibility without patching core. PPg features and runtime guardrails depend on predictable Plan formation, error semantics, and migration behavior. A standardized conformance kit and tiered certification levels let us gate features, publish badges, and build trust with users.

## Decision

Ship an official Conformance Kit and define Certification Levels L0, L1, L2 for adapters:
- The kit is a versioned test harness, fixture packs, golden outputs, and metrics checks
- Levels represent increasing breadth and depth of supported behavior
- Results are produced as machine-readable reports and human badges, and adapters publish a manifest with their certified level and capabilities

## Scope of conformance
- **Lane-agnostic Plan contract compliance and hashing rules** (References ADR 011 and ADR 013)
- **Lowering determinism and golden rendering policy** (References ADR 016 and ADR 067)
- **Driver execution semantics and error mapping to RuntimeError** (References ADR 027 and ADR 068)
- **Migration runner op executors and idempotency classes** (References ADR 037, ADR 038, ADR 041, ADR 028, ADR 188)
- **EXPLAIN normalization for budgets** (References ADR 023 and ADR 076)
- **Capability discovery and negotiation** (References ADR 031 and ADR 065)
- **Privacy and redaction for diagnostics and telemetry** (References ADR 024 and ADR 085)
- **Performance budgets on compile, lower, execute** (References ADR 089 and ADR 094)

## Definitions
- **Profile**: adapter identity and capability set for a target, versioned and hashed as profileHash
- **Contract**: canonical data contract artifact, hashed as coreHash
- **Plan**: immutable execution unit with lane-agnostic identity and annotations
- **Lowering**: transformation from AST to wire payload for the target

## Certification levels

### L0 — Execute
Minimum to run Plans safely:
- Deterministic lowering for SELECT with filters, order, limit, simple joins
- Plan immutability and hashing stable under repeated builds
- SQL targets return { sql, params } with normalized parameter ordering; Non-SQL targets return { kind: 'mongo', pipeline, collection } or equivalent
- Result decoding via adapter codecs and contract types
- Error mapping to RuntimeError envelope with stable codes
- Capability manifest exposes required flags for L0
- **Performance gates**:
  - Lowering p95 within budget for tiny and moderate profiles
  - Runtime overhead ≤ 5% vs raw driver for tiny CRUD

### L1 — Schema
Required for migrations and PPg preflight:
- Additive DDL ops executors: create table/collection, add nullable column/field, create index, add FK or equivalent relation construct
- Idempotency checks and pre/post verification vocabulary implemented
- Contract marker storage and verification modes supported (References ADR 021)
- Advisory lock strategy implemented (References ADR 043)
- EXPLAIN integration returns normalized shape or explicit not supported
- Transactional DDL or compensation plan declared per op family (References ADR 037)
- Migration ledger updates with stable op result classification
- Drift detection primitives implemented for the target

### L2 — Advanced
Enables full guardrails and platform features:
- Prepared statement management and invalidation (References ADR 084 and ADR 095)
- Partial indexes, deferrable constraints, savepoints if target supports them
- Advanced EXPLAIN normalization for budget policies with stable fields
- Multi-tenant contract enforcement primitives and marker scoping (References ADR 033)
- Backfill orchestration hints and safe long-running op boundaries
- Performance scaling under concurrent load within published budgets
- Extended error mapping for deadlocks, timeouts, serialization failures

## Fixture packs
- **Contract fixtures**: canonical contract.json sets per target with profile pins
- **Query fixtures**: ASTs and expected lowered payloads with goldens
- **Migration fixtures**: edges with op lists, pre/post expectations, and ledger snapshots
- **Error fixtures**: engine errors mapped to RuntimeError shapes
- **Explain fixtures**: raw adapter outputs and normalized forms for budgets

## Golden policy
- Normalization rules for whitespace, identifier quoting, aliasing, placeholder style
- For non-SQL, stage ordering and canonical JSON formatting rules
- Goldens are part of the kit version and change only in major releases

## Harness and outputs
- Node test runner loads adapter via manifest and runs level-scoped suites
- **Produces**:
  - conformance.json with per-test results, timings, kitVersion, adapterVersion, profileId, capability set
  - badge.svg and summary markdown for READMEs
  - Timing report for performance gates and notes for near-misses

## Adapter manifest
- adapter-manifest.json included in the package and published alongside releases (References ADR 072)
- profileId, adapterVersion, kitVersion
- capabilities map
- certifiedLevel and links to conformance.json
- Optional notes for known limitations or deviations

## Versioning
- The kit uses semantic versioning
- Major may change golden rules or required semantics
- Minor may add optional tests or new targets
- Patch fixes fixtures or harness quirks
- Adapters declare which kit versions they certify against
- Runtimes and PPg enforce minimum kit versions for features

## Acceptance thresholds
- L0 requires 100% pass of execute and determinism suites
- L1 additionally requires 100% pass of additive DDL and marker suites, plus EXPLAIN normalization if declared in capabilities
- L2 requires L1 plus advanced features supported by the target, with performance gates met on publish profiles
- Fail any required item and the level is not granted

## Policy and gating
- Runtime features check both capability flags and certifiedLevel
- Migrations require L1
- Budget and advanced lint policies may require L2
- PPg services require L1 for preflight-as-a-service and L2 for advanced advisors
- Strict mode in runtime can reject adapters below declared project policy

## Publishing guidance
- Include conformance results in release assets
- Link badges and report in README
- CI must run the kit against every release candidate and fail on regressions
- Declare supported targets and profiles clearly for users

## Security and privacy
- Fixtures contain synthetic data only
- No secrets in fixtures or outputs
- Conformance reports redact any raw SQL or params by default unless explicitly allowed

## Alternatives considered
- **Unstructured "compatibility list" curated manually**: Not measurable and does not scale to community adapters
- **Single monolithic level**: Does not allow products like PPg to gate advanced features cleanly

## Risks
- **Golden drift could create busywork for adapters**: Mitigated with strict versioning, deprecation windows, and clear changelogs
- **Over-specifying may slow innovation for new targets**: Mitigated by capability flags and optional suites that graduate into required over time

## Open questions
- Should there be a provisional L0-preview for new targets to encourage early experimentation
- Do we need a separate L2-platform for PPg-specific hooks and SLOs
- How to publish reproducible perf baselines across heterogeneous CI environments
