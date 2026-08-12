# ADR 105 — Contract extension encoding

## Context

We need a precise, deterministic way to encode third-party and target-specific features in the canonical data contract JSON. Examples include pgvector dimensions and distance metrics, PostGIS geometry metadata and index strategies, custom operator families, and pack-defined codecs.

This encoding must be safe to parse without executing code, round-trip from both PSL-first and TS-first authoring, and be consumable by adapters, lowerers, runtime guardrails, and external services like PPg preflight.

## Problem

- Without a standardized encoding, extension data becomes ad-hoc meta blobs that are hard for tools and agents to analyze
- Extensions sometimes need to both decorate core nodes (columns, indexes) and introduce new constructs (e.g., operator class), with clear references between them
- Capability gating must be visible in the contract so downstream components can refuse unsupported features deterministically
- Canonicalization must keep hashes stable while allowing extension growth and versioning

## Decision

Define a canonical extension section in the contract under `extensions.<namespace>` with a fixed internal structure. Allow two forms of contribution by a pack:
- **Decorations** that attach structured metadata to core nodes via stable references
- **Constructs** that introduce extension-owned entities referenced from decorations or used by adapters during lowering

All references use a common, structured addressing scheme, not free-form strings. Capability claims are encoded explicitly and are validated during connect-time negotiation per ADR 065. No code is embedded in the contract and all content is JSON-schema validated by the emitter.

## Details

### Top-level contract layout

```json
{
  "target": "postgres",
  "coreHash": "…",
  "profileHash": "…",
  "tables": { /* core storage */ },
  "capabilities": { /* adapter and pack surfaced features */ },
  "extensions": {
    "<ns>": {
      "version": "x.y.z",
      "capabilities": { /* pack specific claims */ },
      "decorations": { /* attachments to core nodes */ },
      "constructs": { /* pack owned entities */ }
    }
  }
}
```

### Reserved keys under extensions.<ns>

- **`version`**: semver string pinned by the `extensions { ns = "x.y.z" }` block in PSL or the TS builder
- **`capabilities`**: feature flags the pack asserts are in use by this contract
- **`decorations`**: structured attachments to core nodes
- **`constructs`**: extension entities that can be referenced by decorations or the adapter

### Addressing scheme for core nodes

All references to core nodes use a structured shape to avoid ambiguity:

```json
{ "kind": "table",  "table": "document" }
{ "kind": "column", "table": "document", "column": "embedding" }
{ "kind": "index",  "table": "place",    "index": "place_geom_gist" }
{ "kind": "fk",     "table": "post",     "fk": "post_author_id_fkey" }
{ "kind": "unique", "table": "user",     "unique": ["email"] }
```

- Identifiers must match names after deterministic naming rules per ADR 009
- Arrays used for composite keys are ordered as declared in the core node
- These ref objects are canonicalized by stable key order during hashing per ADR 010

### Decorations

Decorations attach metadata to existing core nodes. Each decoration array contains entries with a ref and a payload:

```json
"decorations": {
  "columns": [
    {
      "ref": { "kind": "column", "table": "document", "column": "embedding" },
      "payload": { "length": 1536, "distance": "cosine" }
    }
  ],
  "indexes": [
    {
      "ref": { "kind": "index", "table": "place", "index": "place_geom_gist" },
      "payload": { "method": "gist", "geometryType": "POINT", "srid": 4326 }
    }
  ]
}
```

#### Rules

- The payload shape is defined by the pack's JSON Schema and must be pure data
- A given ref may appear at most once per decoration array for a namespace
- Decorations must not mutate core node keys; they are advisory and interpretable by adapters and tools

### Constructs

Constructs are extension-owned entities referenced by name within the namespace. Examples: operator classes, vector index parameters, custom codecs.

```json
"constructs": {
  "operatorClasses": [
    {
      "name": "pgvector_ivfflat_cosine",
      "family": "ivfflat",
      "distance": "cosine",
      "default": true
    }
  ],
  "codecs": [
    {
      "name": "pgvector_bytes_codec",
      "appliesTo": { "kinds": ["column"], "types": ["bytea"] },
      "encode": { "hint": "float32-array-as-bytea" },
      "decode": { "hint": "bytea-as-float32-array" }
    }
  ]
}
```

#### Rules

- Construct kinds are namespace-specific and validated by the pack schema
- Constructs are referenced by name within the same namespace, never by global identifiers
- Adapters and lanes may consult constructs to drive lowering or result decoding per ADR 030

### Capability claims

Packs must declare features consumed by the contract explicitly. These are merged into `contract.capabilities.<ns>`:

```json
"capabilities": {
  "pgvector": { "ivfflat": true, "hnsw": false }
}
```

During connect, adapter negotiation per ADR 065 ensures the target profile satisfies all true claims or connection fails with `CAPABILITY_UNSUPPORTED`.

### Canonicalization rules

- Keys in maps are sorted lexicographically
- Arrays are kept in authoring order unless the pack schema marks them as sets, in which case they are sorted deterministically
- Numbers use JSON canonical form, no trailing zeros, no NaN/Infinity
- Booleans and strings are emitted as-is, no comments
- The emitter rejects any additional or unknown keys under `extensions.<ns>` to preserve schema clarity

### Validation and error taxonomy

Emitter validates three layers:
- Namespace presence and version pinning per ADR 104
- JSON Schema for each decoration and construct kind
- Reference resolution to existing core nodes

New error codes (map to `RuntimeError` per ADR 027 and ADR 068):
- `EMIT_EXT_REF_NOT_FOUND` when a ref does not resolve
- `EMIT_EXT_DUP_REF` when the same ref appears twice in a decoration array
- `EMIT_EXT_CONSTRUCT_DUP_NAME` duplicate construct name within a namespace
- `EMIT_EXT_SCHEMA_VIOLATION` payload fails schema
- `EMIT_EXT_CAPABILITY_CONFLICT` pack claims contradict adapter profile

### Backward and forward compatibility

- Adding new optional fields to a payload or new arrays under decorations or constructs is backward compatible
- Removing fields or changing their meaning is a breaking change and must be signaled by a major version bump in `extensions { ns = "…" }`
- Packs must provide migration guidance between versions at the PSL and TS-builder level

## Examples

### pgvector column decoration

```json
"extensions": {
  "pgvector": {
    "version": "1.2.0",
    "capabilities": { "ivfflat": true },
    "decorations": {
      "columns": [
        {
          "ref": { "kind": "column", "table": "document", "column": "embedding" },
          "payload": { "length": 1536, "distance": "cosine", "index": "ivfflat", "lists": 100 }
        }
      ]
    }
  }
}
```

### PostGIS geometry and index

```json
"extensions": {
  "postgis": {
    "version": "3.4.1",
    "decorations": {
      "columns": [
        {
          "ref": { "kind": "column", "table": "place", "column": "geom" },
          "payload": { "geometryType": "POINT", "srid": 4326 }
        }
      ],
      "indexes": [
        {
          "ref": { "kind": "index", "table": "place", "index": "place_geom_gist" },
          "payload": { "method": "gist" }
        }
      ]
    }
  }
}
```

## Alternatives considered

- **Embedding extension data directly in core nodes under `meta.ext.<ns>` only**: Harder to discover and validate across the contract and conflates decoration with construct ownership
- **Free-form string references like `"document.embedding"`**: Fragile and ambiguous, especially with composite keys and deterministic naming rules
- **Allowing extensions to override core types**: Leads to non-portable contracts and complexity for core tooling

## Consequences

### Positive
- Clear, analyzable, and deterministic extension encoding that tools and agents can rely on
- Separation of decorations vs constructs makes ownership and responsibilities explicit
- Capability claims surface contract requirements early and prevent misconfiguration at connect time

### Negative
- Slight verbosity in JSON for complex packs
- Packs must maintain JSON Schemas and validation logic for their attributes
- Requires coordination between pack schemas and adapter capability surfaces

## Open questions

- Do we need a standard way to express extension-driven storage overlays, or should adapters infer storage types from decorations?
- How do we represent pack-driven migrations that alter storage without leaking imperative logic into the contract?
- Should we allow cross-namespace references under controlled conditions?

## Test strategy

- Golden contract snapshots for representative packs covering decorations, constructs, and capabilities
- Negative tests for reference resolution and schema violations
- Canonicalization tests ensuring stable hash across authoring modes
- Connect-time negotiation tests that fail when capabilities are missing per ADR 065

## References

- ADR 010 — Canonicalization rules for contract.json
- ADR 016 — Adapter SPI for lowering relational AST
- ADR 030 — Result decoding & codecs registry
- ADR 041 — Custom operation loading via local packages + preflight bundles
- ADR 065 — Adapter capability schema & negotiation v1
- ADR 104 — PSL extension namespacing & syntax
- Doc 11 — Extensions & Packs
