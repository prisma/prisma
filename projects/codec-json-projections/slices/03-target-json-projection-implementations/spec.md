# Slice: 03-target-json-projection-implementations

_Parent project: `projects/codec-json-projections/`. Outcome: every target-owned canonical JSON projection is implemented and proven against a real database, so the hard cut in slice 4 is a single switch rather than a switch plus every format decision._

## At a glance

The 27 PostgreSQL and 7 SQLite built-in descriptors that slice 2 gave behavior-preserving identity `jsonProjection` hooks get their real canonical projections — `numeric`/`int8` as decimal text, `bytea` as base64, temporals as session-independent ISO, SQLite bigint as decimal text, SQLite BLOB as hexadecimal — together with the in-repo extension descriptors, the SQLite JSON-document retagging mechanism, and a database-backed harness that proves each projection's parsed result equals `codec.encodeJson`. Production renderers still never call `projectJson()`, so nothing observable changes.

## Chosen design

### The seam this slice exploits

`PostgresCodecDescriptor.projectJson()` and `SqliteCodecDescriptor.projectJson()` exist and are typed, but no production render path invokes them — the 0.17 transition states this explicitly, and slice 2 shipped every hook as `return expression`. That makes the canonical formats independently authorable and independently verifiable:

```text
slice 3 (this)                          slice 4 (hard cut)
──────────────                          ──────────────────
jsonProjection() returns real SQL       renderers call projectJson()
harness proves it == encodeJson         ORM planning emits projection nodes
                                        CodecMeta / meta / metaFor removed
observable output: UNCHANGED            contracts + fixtures regenerated
```

Each slice then carries one outcome. This slice answers "what is each codec's canonical JSON, in SQL?"; slice 4 answers "when does the database start producing it?".

### Per-descriptor projections

Each identity hook is replaced by the AST composition that yields the codec's canonical representation. The governing rule is that the projection's parsed JSON must equal `codec.encodeJson(applicationValue)` exactly — `encodeJson` is the specification, the projection is its SQL realization.

| Codec family | Canonical JSON | Projection shape |
| --- | --- | --- |
| `pg/numeric`, `pg/int8` | decimal string | cast to `text` before the JSON constructor sees a number |
| `pg/bytea` | base64 string | `encode(…, 'base64')` |
| `pg/timestamp*`, `pg/date`, `pg/time*` | canonical ISO | session-independent UTC rendering with pinned precision |
| `pg/json`, `pg/jsonb` | JSON document | document semantics, not scalar |
| SQLite bigint | decimal string | cast to text |
| SQLite BLOB | hexadecimal string | `hex(…)`, pinned case |
| identity-safe scalars (`text`, `bool`, small ints) | unchanged | the projection stays `expression`, now as a *claim* rather than a placeholder |

The last row matters: an identity projection remains correct for codecs whose native JSON conversion is already canonical. What changes is that it becomes a deliberate, tested assertion rather than a transitional stub — consistent with the project's non-goal of a universal identity default.

### Array projections

`PostgresCodecDescriptor.jsonArrayProjection()` already implements the reference lift — derived-table single binding of the source, `CASE` for the null array, `unnest … WITH ORDINALITY`, per-element `CASE` for null elements, and `json_agg` ordered by ordinality with an `emptyArray` empty case. This slice does not rebuild it; it inherits the lift and gains its guarantees for free once each element projection is real, and extends the conformance cases to cover null array / empty array / null element / order / single evaluation per element codec.

### SQLite document retagging

SQLite loses the JSON subtype across derived tables, so a document-valued projection that survives one level of nesting arrives as text. The retagging mechanism re-applies the subtype at the document boundary. It is built and unit-tested here against AST/SQL expectations; it is wired in slice 4.

### Conformance harness

An internal, database-backed harness takes a descriptor, a set of representative application values, and a live connection; for each value it encodes through the codec, stores it, projects it via `projectJson()`, executes, parses the driver's JSON, and asserts equality with `codec.encodeJson`. It runs `projectJson()` directly rather than through the render path, which is exactly why it works before the hard cut. The arbitrary-precision numeric regression (`1234567890.12345678901234567890`, `9007199254740993`) is a first-class case.

The harness is internal to this slice. Slice 5 promotes its case-runner API into the public dev-only `@prisma-next/postgres-codec-testkit` / `@prisma-next/sqlite-codec-testkit` packages; shaping it here with that promotion in mind is deliberate, but the package boundary is not this slice's problem.

## Coherence rationale

One outcome: every target descriptor states its canonical JSON as SQL, and a database proves it. A reviewer holds one question throughout — "is this codec's projection equal to its `encodeJson`?" — and the harness answers it uniformly for every row of the table. The formats cannot be split from the harness that validates them without shipping unverified format claims, and they cannot be split target-by-target without leaving a reviewer to re-orient across two PRs asking the identical question.

## Scope

**In:** `jsonProjection` implementations for all PostgreSQL and SQLite built-in descriptors; in-repo extension descriptors (pgvector, PostGIS, arktype-json); the SQLite document retagging mechanism; the database-backed conformance harness including the numeric precision regression; conformance cases for the inherited array lift.

**Out:** renderer wiring and any `projectJson()` call from a production path; ORM projection planning; `CodecMeta` / `meta` / `metaFor` removal; contract or fixture regeneration; public testkit packages; aggregate descriptors; any observable output change. All belong to slice 4 or 5.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| PostgreSQL `numeric` reaching JSON as a number | Must not occur | The project's originating defect. `9007199254740993` silently becomes `…992` before any codec sees it; the cast must precede the JSON constructor, not follow it. Regression evidence preserved under `assets/`. |
| SQLite JSON subtype lost across derived tables | Retagging required | Known from the design checkpoint; native JSON also rejects BLOBs, which is why BLOB is projected as hex text rather than left native. |
| Prototype's hardcoded codec-ID branch and lineage reconstruction | Rejected | Preserved as evidence only. Must not enter this or any project PR. |

## Slice-specific done conditions

- [ ] Every built-in and in-repo extension descriptor's projection is exercised by a real database case asserting parsed JSON equals `codec.encodeJson`, and a grep confirms no descriptor retains an untested identity `jsonProjection`.
- [ ] No production render path calls `projectJson()`; emitted SQL, generated contracts, and fixtures are byte-identical to the predecessor branch.

## Open Questions

1. **How exactly is PostgreSQL temporal canonical ISO rendered?** Working position: session-independent UTC SQL with precision and timezone behavior pinned against `encodeJson` in the conformance matrix, so a server's `TimeZone` setting cannot change the result.
2. **Which extension codecs need document rather than scalar projection?** Working position: classify from canonical `encodeJson` — PostGIS GeoJSON is a document; pgvector arrays and text/number results are scalar.
3. **How far should the harness's API anticipate the slice-5 public testkit?** Working position: shape the case runner as test-framework-independent and caller-supplied-connection from the start, but keep it internal; promoting it is slice 5's work and its package boundary is not settled here.
4. **Does an identity projection need a distinct marker from an unimplemented one?** Working position: no new type — the conformance case is the evidence that an identity projection is a deliberate claim. Revisit only if a reviewer cannot tell the two apart.

## References

- Parent project: [`../../spec.md`](../../spec.md)
- Project design: [`../../design-notes.md`](../../design-notes.md)
- Project plan: [`../../plan.md`](../../plan.md)
- Linear issue: [TML-3100](https://linear.app/prisma-company/issue/TML-3100/target-json-projection-implementations-and-conformance-harness)
- Predecessor slice: [`../02-target-codec-descriptor-foundations/spec.md`](../02-target-codec-descriptor-foundations/spec.md) — PR [#1051](https://github.com/prisma/prisma-next/pull/1051)
- Successor slice: [TML-3063](https://linear.app/prisma-company/issue/TML-3063/lossless-json-projection-hard-cut)
- Regression source: [PR #942](https://github.com/prisma/prisma-next/pull/942), merge commit `bd2bcd1914`
- Codec authoring reference: [`docs/reference/codec-authoring-guide.md`](../../../../docs/reference/codec-authoring-guide.md)
- Sizing calibration: [`drive/calibration/sizing.md`](../../../../drive/calibration/sizing.md)
