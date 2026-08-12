# ADR 114 — Extension codecs & branded types

## Context

Targets like PostGIS and pgvector introduce storage types that lack lossless or unambiguous mappings to plain JavaScript primitives. We need a way to:

- Represent these values with strong TypeScript types so apps and agents can reason about them
- Encode parameters and decode results deterministically across drivers and environments
- Gate usage on adapter capabilities and extension presence
- Keep core small while letting community packs supply high-quality codecs

ADR 030 defined a generic "codecs registry" concept. This ADR specifies how extension codecs are modeled, composed at runtime, and surfaced as branded types in generated `.d.ts` to preserve type information end-to-end.

## Problem

- Without explicit codecs, round-trips for geometry, vector, range, hstore, and custom domains are inconsistent and bug-prone
- Using plain `any` or JSON blobs erases semantics needed for policies, agents, and type inference
- Driver defaults vary by dialect and version, creating non-determinism
- We must avoid baking target specifics into core DSLs and keep the system pack-extensible

## Decision

Introduce a first-class Extension Codec model that packs register for specific contract types and profiles. Generated types expose branded TypeScript types for these values. The runtime resolves and composes codecs deterministically at connect time, with stable error codes on mismatch.

### Goals

- Lossless, deterministic encode/decode for target extension types where feasible
- Strong TS surface via branded types that survive across layers
- Runtime composition that is explicit, capability-aware, and overrideable
- Zero network or IO in codecs and no hidden magic in drivers

### Non-goals

- Automatic discovery of codecs from the database at runtime
- Support for arbitrary user-defined procedural transforms inside codecs

## Model

### Contract type ids

Extension types are named in the contract under a pack namespace:

- `pgvector/vector(length=1536)`
- `postgis/geometry(srid=4326)`
- `pg/range(int4)`
- `pg/hstore`

Canonicalization rules are defined in ADR 106 so the same logical type gets the same id for hashing and comparison.

### Codec interface

```typescript
interface CodecDescriptor {
  id: string                    // e.g. 'pgvector/vector'
  version: string               // semver for the codec itself
  profiles: string[]            // adapter profiles supported, e.g. ['postgres@>=15']
  contractMatcher: (typeId: string, attrs: Record<string, unknown>) => boolean
  priority?: number             // tie-breaker within the same id
}

type EncodeResult = { bytes?: Uint8Array, text?: string, json?: unknown }
type DecodeInput = { bytes?: Uint8Array, text?: string, json?: unknown }

interface Codec<TJs> extends CodecDescriptor {
  jsTypeName: string            // used for branded type generation, e.g. 'Vector<1536>'
  encode: (value: TJs) => EncodeResult
  decode: (wire: DecodeInput) => TJs
  validate?: (value: unknown) => asserts value is TJs
  losslessness: 'lossless' | 'warn-lossy' | 'reject-lossy'
  nullability: 'permit-null' | 'non-null'
}
```

- `contractMatcher` binds the codec to contract types and attributes
- `profiles` ensures we only use codecs on compatible adapters
- `losslessness` controls policy behavior on potential lossy conversions

### Branded TypeScript types

Generated `.d.ts` expose nominal brands for extension values:

```typescript
type Brand<T, B extends string> = T & { readonly __brand: B }

export type Vector<N extends number> = Brand<readonly number[], `vector:${N}`>
export type Geography = Brand<GeoJSON.Geometry, 'postgis:geography'>
export type Geometry = Brand<GeoJSON.Geometry, 'postgis:geometry'>
export type Int4Range = Brand<{ lower: number|null, upper: number|null, bounds: '[)' | '()' | '[]' | '(]' }, 'pg:range:int4'>
```

- Column types using extensions in the contract map to these branded types
- `select()` inference produces result projections using the brands
- Param helpers in the DSL surface factories for these types where appropriate

### Resolution and precedence

At `connect()` time we assemble the active codec set with a strict precedence:

1. App-provided codecs
2. Pack codecs from installed Target Extension Packs
3. Adapter built-ins for core SQL types
4. Driver decoding hints as the ultimate fallback

The runtime builds a lookup keyed by contract type id plus adapter profile

## Lane integration

- **Relational DSL**: column expressions carry the branded TS types, and param helpers know how to build correct values or accept branded values supplied by the app
- **Raw SQL lane**: authors can attach annotations specifying contract types for parameters and projected columns, enabling the runtime to pick the right codecs
- **TypedSQL**: the CLI resolves projected types via describe and maps to branded types using the active codec set, embedding type identities in the emitted Plan factory metadata

## Adapter negotiation

Per ADR 065, adapters declare decoding capability flags and negotiated wire formats:

- Example: `postgres@15` + pgvector may prefer binary protocol for vectors
- If a codec requires a capability the adapter lacks, connect fails with `E_CODEC_CAPABILITY_MISSING`

## Hashing and plan identity

Plan hashing (ADR 013) must not include the implementation identity of a codec. It may include the logical type id used in refs for stability and policy evaluation.

## Examples

### pgvector

**Contract**:

```json
{
  "tables": {
    "item": {
      "columns": {
        "embedding": { "type": "pgvector/vector", "attrs": { "length": 1536 }, "nullable": false }
      }
    }
  }
}
```

**Types**:

```typescript
export type Embedding = Vector<1536>
```

**Codec behavior**:
- `encode(Vector<1536>)` → binary `float4[1536]` or text literal depending on profile
- `decode(bytes)` → `readonly number[]` with brand
- `validate` enforces length 1536 and finite numbers

### PostGIS geography

- Encoded as EWKB or WKT depending on negotiated profile
- Decoded as GeoJSON geometry branded type
- `losslessness: 'warn-lossy'` if SRID conversion is required

## Error semantics

Stable error codes extend ADR 027 and ADR 068:

- **E_CODEC_NOT_FOUND**: no codec matches contract type for current profile
- **E_CODEC_CAPABILITY_MISSING**: adapter cannot support required wire format
- **E_CODEC_DECODE_FAILED**: wire payload does not decode to expected JS type
- **E_CODEC_ENCODE_FAILED**: provided JS value cannot be encoded
- **E_CODEC_LOSSY_REJECTED**: operation would be lossy under current policy
- **E_PARAM_TYPE_MISMATCH**: param annotated type incompatible with codec

Configurable policy determines whether to warn or error on lossy conversions.

## Security and purity

- Codecs are pure, synchronous functions with no IO or side effects
- No dynamic imports, eval, or network access
- In hosted preflight bundles, codecs must be included explicitly by packs

## Performance

- Encoding and decoding are on the hot path, so codecs must be O(n) in payload size with no excessive copies
- Adapters may signal preferred wire representations to avoid text conversions
- The runtime may cache small immutable decoded structures when safe, but by default decoding is per row

## Testing and conformance

Conformance kit adds fixtures validating:

- `contractMatcher` and canonicalization
- encode/decode round-trips for sample values
- nullability and lossiness behavior
- profile gating and error codes
- Golden tests verify stable `toString` for brands only where used in diagnostics, not at runtime

## Versioning

- Changing `jsTypeName`, `encode`, or `decode` semantics is breaking
- Adding profiles or improving performance without changing behavior is minor
- Deprecating a codec requires an alternative and migration guidance

## Alternatives considered

- **Treat all extension values as unknown and leave to app code**
  - Rejected as it defeats type safety and determinism goals
- **Push all decoding to drivers**
  - Rejected because drivers differ and cannot express domain-level branding or policy
- **JSON-only representation for all extensions**
  - Rejected due to performance and loss of fidelity for binary formats

## Consequences

### Positive

- Strong, explicit types for extension values with deterministic behavior
- Clear composition story with packs and adapter negotiation
- Consistent experience across lanes and environments

### Negative

- Pack authors must supply and maintain codecs for each supported profile
- Branded types surface in user code and may require helper utilities for ergonomics
- Additional testing burden to ensure round-trip stability

## Open questions

- Do we want optional runtime validation hooks to sample and assert value shapes in development
- Should codecs declare estimated payload sizes to inform budgets and telemetry a priori
- How do we best expose ergonomic builders for branded values without leaking pack details

## References

- ADR 030 Result decoding & codecs registry
- ADR 065 Adapter capability schema & negotiation v1
- ADR 112 Target Extension Packs
- ADR 113 Extension function & operator registry
- ADR 020 Result typing and projection inference rules
- ADR 010, 105, 106 Extension encoding and canonicalization
