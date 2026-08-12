# ADR 106 — Canonicalization for extensions

## Context

Extensions let targets and community packs attach structured metadata to the data contract without changing core storage nodes. ADR 105 defined where extension data lives and how it references core nodes. To keep hashes stable, diffs readable, and tool behavior deterministic, we need explicit canonicalization rules for the extensions section that build on ADR 010.

## Problem

- JSON object key order is unstable across emitters
- Decorations may reference the same core node in different orders
- Some arrays are sets where order must not affect the hash, others are sequences where order is meaningful
- Capability flags and construct lists can churn hash values if defaults or falsy entries are serialized inconsistently
- Unicode and numeric representations can differ between toolchains

## Decision

Adopt a strict canonicalization procedure for extensions that is applied by the emitter for both PSL-first and TS-first authoring. The same procedure is used to compute `coreHash` and to normalize contracts in CI. Consumers must not rely on non-canonical forms.

## Canonicalization procedure

### 1) Namespaces

- Under `extensions`, namespace keys are sorted lexicographically
- Each namespace object must appear with keys in this order: `version`, `capabilities`, `constructs`, `decorations`
- Unknown keys under a namespace are rejected at emit time

### 2) Capabilities

- `capabilities` is a JSON object with lexicographically sorted keys
- Only asserted or required features are serialized
- Omit `false` feature toggles to avoid hash churn
- Include parameterized capabilities as objects, with their own keys sorted
- Empty capabilities objects are omitted

### 3) Constructs

- `constructs` contains one or more arrays owned by the namespace schema
- Each construct kind array is sorted by name lexicographically unless the schema marks it as sequence
- Each construct object's keys are sorted lexicographically
- Duplicate name entries within the same construct kind are rejected

### 4) Decorations

- `decorations` groups arrays by target core node kind, e.g. `columns`, `indexes`, `unique`, `fk`, `tables`
- Entries are sorted by a stable reference comparator defined below
- Each entry is an object with keys sorted lexicographically and must contain:
  - `ref`: the canonical reference object
  - `payload`: the pack-defined data with keys sorted lexicographically
- A given ref may appear at most once per decoration array for a namespace

#### 4.1) Reference objects

References are canonicalized as compact objects with sorted keys and no derived fields.

**Allowed shapes:**

```json
{ "kind": "table",  "table": "t" }
{ "kind": "column", "table": "t", "column": "c" }
{ "kind": "index",  "table": "t", "index": "name" }
{ "kind": "fk",     "table": "t", "fk": "name" }
{ "kind": "unique", "table": "t", "columns": ["a","b"] }
```

**Rules:**
- `columns` arrays reflect the core node's declared order and must not be re-sorted
- Names must match deterministic naming from ADR 009
- Unknown `kind` values are rejected

#### 4.2) Reference sort order

Decorations are sorted by the following comparator:
1. by `kind` in the order: `table < column < index < unique < fk`
2. then by table name
3. then by the secondary identifier:
   - `column` by column
   - `index` by index
   - `fk` by fk
   - `unique` by joined columns with `,` as separator

### 5) Numbers, strings, booleans

- Numbers must be finite JSON numbers in canonical form without leading `+`, no trailing zeros after decimal unless necessary, no scientific notation unless required
- Strings are normalized to Unicode NFC. No control characters other than standard JSON escapes
- Booleans are serialized as `true` or `false`
- `null` is allowed only where the extension schema explicitly permits it

### 6) Arrays

- Arrays marked by the extension schema as `set` are sorted lexicographically by their canonical JSON string representation
- Arrays marked as `sequence` preserve author order and participate in the hash in that order
- The default for arrays without an explicit schema annotation is `set`

### 7) Omission of defaults

- Omit fields equal to schema defaults to reduce churn
- Omit empty objects and empty arrays unless their presence changes semantics per schema
- Do not serialize derived or redundant values

### 8) Whitespace and formatting

- Canonicalization produces a stable byte representation for hashing using the ADR 010 serializer
- Pretty printing is for humans only and must not be used to compute `coreHash`

## Examples

### pgvector decoration canonical form

**Input (TS builder or PSL):**

```json
{
  "extensions": {
    "pgvector": {
      "decorations": {
        "columns": [
          { "payload": { "distance": "cosine", "length": 1536 }, "ref": { "table": "document", "kind": "column", "column": "embedding" } }
        ]
      },
      "version": "1.2.0",
      "capabilities": { "ivfflat": true, "hnsw": false }
    }
  }
}
```

**Canonical output:**

```json
{
  "extensions": {
    "pgvector": {
      "version": "1.2.0",
      "capabilities": { "ivfflat": true },
      "constructs": {},
      "decorations": {
        "columns": [
          {
            "payload": { "length": 1536, "distance": "cosine" },
            "ref": { "column": "embedding", "kind": "column", "table": "document" }
          }
        ]
      }
    }
  }
}
```

### PostGIS index decoration canonical form

```json
{
  "extensions": {
    "postgis": {
      "version": "3.4.1",
      "decorations": {
        "indexes": [
          {
            "ref": { "kind": "index", "table": "place", "index": "place_geom_gist" },
            "payload": { "method": "gist" }
          }
        ],
        "columns": [
          {
            "ref": { "kind": "column", "table": "place", "column": "geom" },
            "payload": { "geometryType": "POINT", "srid": 4326 }
          }
        ]
      }
    }
  }
}
```

## Backward and forward compatibility

- Adding new optional fields to payload or new construct kinds is backward compatible
- Changing sort classification of an array from `sequence` to `set` or vice versa is a breaking change and requires a new namespace major version
- Changing reference shapes or the comparator order is a breaking change and requires a new namespace major version and ADR update

## Enforcement

- The emitter applies canonicalization before writing `contract.json` and before computing `coreHash`
- CI checks may run `canonicalize(contract)` and fail if the input differs from canonical output
- Runtimes must reject non-canonical contracts if `enforceCanonical` is enabled in strict modes

## Error taxonomy

- `EMIT_EXT_NON_CANONICAL`: contract input differs from canonical output in strict mode
- `EMIT_EXT_SCHEMA_VIOLATION`: extension data fails JSON Schema
- `EMIT_EXT_REF_NOT_FOUND`: a decoration references a missing core node
- `EMIT_EXT_DUP_ENTRY`: duplicate construct name or duplicate decoration ref
- `EMIT_EXT_UNSUPPORTED_NUMERIC`: non-finite or non-canonical number encountered

Errors map to the common envelope per ADR 027 and to adapter-specific contexts per ADR 068.

## Test strategy

- Golden canonicalization snapshots for representative packs (pgvector, postgis) including mixed input ordering
- Round-trip tests: author → emit → canonicalize → hash stability
- Negative tests for duplicate refs, unknown keys, and schema violations
- Fuzzing of string normalization to ensure NFC canonicalization is stable across platforms

## Consequences

### Positive
- Stable hashes and clean diffs even as extension usage grows
- Deterministic behavior across emitters and platforms
- Clear guardrails for pack authors and adapter implementors

### Negative
- Slight verbosity and discipline required from pack schemas to classify arrays as set or sequence
- Canonicalization adds a small CPU cost during emit and CI checks

## Open questions

- Do we need a shared library for canonical serialization across tooling and runtimes to avoid subtle drift?
- Should we allow opt-in preservation of false capability flags for auditability, guarded by an emitter option that does not affect hashing?

## References

- ADR 010 — Canonicalization rules for contract.json
- ADR 104 — PSL extension namespacing & syntax
- ADR 105 — Contract extension encoding
- ADR 065 — Adapter capability schema & negotiation v1
