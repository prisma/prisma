# ADR 112 — Target Extension Packs

## Context

We want a first-class way to add target-specific capabilities like PostGIS, pgvector, Trigram, or future vendor features without changing the core. These capabilities must be expressible in the data contract, validated deterministically, participate in type and lowering pipelines where applicable, and remain safe and auditable. Community contributions should be possible with minimal friction while preserving our guarantees.

## Problem

- Core cannot and should not embed every target feature
- Ad-hoc metadata leads to non-determinism and hash churn if not canonicalized
- Lanes and runtimes need a stable way to discover what features are present and how to handle them
- CI and hosted preflight must not execute arbitrary code or resolve package dependencies

## Decision

Introduce Target Extension Packs as versioned, installable modules that declare a namespace, provide schemas and deterministic logic for their contract decorations and constructs, and integrate with adapters, lanes, and runtime through narrow SPIs. Packs are optional at authoring time and runtime, but when a contract references a pack namespace, consumers must either load a compatible pack or fail with a clear error.

### What a Pack is

- An npm package with a manifest declaring its namespace (e.g. `pgvector`), version, and supported target profiles
- Pure ESM, side-effect free at import, no network I/O, deterministic behavior
- Exposes structured entry points for:
  - Contract schema and validators for its namespace
  - PSL authoring bindings for PSL-first authoring
  - TS helpers for TS-first authoring
  - Optional adapter hints and lowerer fragments where relevant
  - Codecs for result decoding if the pack introduces new logical types
  - Optional lint rules or advisors scoped to its features

### What a Pack is not

- Not a remote registry or marketplace
- Not a vehicle for arbitrary execution in CI or hosted services
- Not required to ship migration operations or node tasks (those live in the migration ops ecosystem and may be packaged separately)

## Pack Descriptor Metadata

Each pack exports ESM descriptors (target, adapter, driver, extensions) that include:

- `id`, `familyId`, `targetId`, `version`
- Declarative metadata (`capabilities`, `types`, `operations`)
- Plane-specific factories (`create()`, `migrations`, runtime hooks)

These descriptors are the single source of truth for pack metadata. The CLI and emitter import descriptor modules directly rather than parsing JSON manifests. Contract authoring surfaces use pack refs (JSON-safe snapshots) derived from these descriptors when wiring targets, adapters, and extensions.

## SPIs

### Contract SPI

- Provides JSON Schemas for `extensions.<namespace>` per ADR 105
- Marks arrays as set or sequence for canonicalization per ADR 106
- Validates decorations against core references and adapter capability gates
- Optionally supplies canonical defaulting logic that is applied before hashing

```typescript
export interface ContractSPI {
  namespace: string
  jsonSchema: object
  validateDecorations(ctx: { contract: Contract; adapterCaps: AdapterCaps }): ValidationIssue[]
  canonicalizePayload(payload: any): any
}
```

### PSL SPI (optional)

- Maps supported PSL extension syntax like `pgvector.Vector(length: 1536)` to contract decorations
- Validates supported syntax usage and emits deterministic errors

```typescript
export interface PslSPI {
  attributes: Record<string, (args: AttrArgs) => Decoration[]>
}
```

### TS Authoring SPI (optional)

- Exposes helpers for TS-first authoring without side effects

```typescript
export interface TsSPI {
  decorate: {
    column: (ref: ColumnRef, payload: any) => Decoration
    index:  (ref: IndexRef, payload: any) => Decoration
  }
  types?: Record<string, unknown> // TS ambient typings via .d.ts shipped by the pack
}
```

### Adapter SPI (optional, target-specific)

- Advertises how a pack's constructs map to adapter capabilities
- May contribute lowering hints but not perform lowering itself

```typescript
export interface AdapterSPI {
  profile: string // e.g., postgres@15
  requiresCaps(): CapabilityCheck[] // e.g., { key: 'jsonAgg', level: 'required' }
  loweringHints?(contract: Contract): LoweringHint[] // purely advisory
}
```

### Codecs SPI (optional)

- Registers result codecs for pack-defined logical types

```typescript
export interface CodecsSPI {
  register(reg: CodecsRegistry): void
}
```

### Lint SPI (optional)

- Contributes rules keyed under a namespaced ID like `pgvector/index-uses-ivfflat`

```typescript
export interface LintSPI {
  rules: Record<string, LintRuleFactory>
}
```

## Lifecycle and Wiring

### Authoring

- **PSL-first**: emitter loads installed packs, translates supported extension constructor syntax to contract decorations, validates, canonicalizes, emits `contract.json`
- **TS-first**: app or tool uses pack TS helpers to add decorations, then canonicalizes and emits `contract.json`

### Runtime/Adapter

- On connect, adapter advertises capability flags per ADR 065
- Runtime inspects `contract.extensions` and ensures matching packs are present for namespaces that require runtime participation (e.g., codecs)
- If a required pack is missing or incompatible, runtime fails early with a stable error code

### CI/Preflight

- Tools operate on `contract.json` only, not packs
- Hosted services do not load user packs for preflight of queries or schema verification
- If migration node tasks depend on pack code, that is handled via separate migration bundles per ADR 051

## Error handling

New stable error codes mapped via ADR 027 and ADR 068:

- **E_PACK_NAMESPACE_UNKNOWN**: contract references an extension namespace for which no pack is installed in authoring context
- **E_PACK_INCOMPATIBLE_PROFILE**: pack does not support the active adapter profile
- **E_PACK_REQUIRED_AT_RUNTIME**: contract needs runtime participation from a pack that is not provided
- **E_PACK_SCHEMA_VIOLATION**: extension payload fails the pack's schema
- **E_PACK_NON_CANONICAL**: extension section not in canonical form under strict mode

## Security and determinism

- Packs must be side-effect free at import
- No network or filesystem access during contract emission, canonicalization, or runtime registration
- Codecs and lint logic must be pure and deterministic
- For hosted services, packs are not executed unless explicitly allowed via a separate, signed bundle pathway that is outside this ADR

## Performance

- Contract validation by packs should be O(n) in number of decorations
- Canonicalization adds sub-millisecond overhead per decoration object
- Runtime pack checks are performed once per connection and cached

## Conformance and testing

The Conformance Kit (ADR 026) will include pack tests:

- Schema validation fixtures
- Canonicalization golden files
- Adapter capability gating tests
- Optional codec round-trip tests
- Optional lint rule behavior tests
- Packs may self-certify as L0/L1/L2 depending on which SPIs they implement

## Backward and forward compatibility

- Namespace + major version defines compatibility surface
- Adding optional payload fields is backward compatible
- Changing canonicalization classification of arrays or reference shapes is a breaking change and must bump major version
- Packs should version their emitted `.d.ts` types independently but keep wire data stable

## Alternatives considered

- **Hard-coding common features directly into the core**
  - Rejected because it bloats core and slows community innovation
- **Free-form metadata without schemas**
  - Rejected due to non-determinism, hash churn, and poor tooling ergonomics
- **Executing pack code in CI or hosted services by default**
  - Rejected for security and determinism reasons

## Consequences

### Positive

- Clear, deterministic path for community and vendor features to participate in the contract and toolchain
- Minimal core surface area with strong guarantees
- Early and clean failure modes when capabilities or packs are missing

### Negative

- Authors must install packs in authoring contexts to use pack-owned PSL constructor syntax
- Some features require adapter participation and will hard-fail on unsupported profiles
- More moving parts to document and certify

## Open questions

- Do we need a minimal standard for publishing pack JSON Schemas in a public index for documentation and discovery
- Should we allow packs to supply DevTools UI hints for Studio without affecting hashing

## References

- ADR 010 Canonicalization rules for contract.json
- ADR 065 Adapter capability schema & negotiation v1
- ADR 104 PSL extension namespacing & syntax
- ADR 105 Contract extension encoding
- ADR 106 Canonicalization for extensions
- ADR 026 Conformance Kit & Certification Levels
- ADR 027 Error envelope & stable codes
- ADR 068 Error mapping to RuntimeError
