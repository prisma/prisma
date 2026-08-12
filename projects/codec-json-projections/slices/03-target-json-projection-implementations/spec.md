# Slice: 03-target-json-projection-implementations

_Parent project: `projects/codec-json-projections/`. Outcome: every target-owned canonical JSON projection is implemented and proven against a real database, so the hard cut in slice 4 is a single switch rather than a switch plus every format decision._

## At a glance

The 33 PostgreSQL and 11 SQLite built-in descriptors that slice 2 gave behavior-preserving identity `jsonProjection` hooks get their real canonical projections — `numeric`/`int8` as decimal text, `bytea` as base64, temporals as session-independent ISO, SQLite bigint as decimal text, SQLite BLOB as hexadecimal — together with the in-repo extension descriptors, the SQLite JSON-document retagging mechanism, and a database-backed harness that proves each projection round-trips losslessly. Each affected codec's `encodeJson` / `decodeJson` moves to the same canonical form in the same dispatch, so contract-serialized defaults change and fixtures regenerate. **No database-produced JSON path changes**: production renderers still never call `projectJson()`.

## Chosen design

### The seam this slice exploits

`PostgresCodecDescriptor.projectJson()` and `SqliteCodecDescriptor.projectJson()` exist and are typed, but no production render path invokes them — the 0.17 transition states this explicitly, and slice 2 shipped every hook as `return expression`. That makes the canonical formats independently authorable and independently verifiable:

```text
slice 3 (this)                          slice 4 (hard cut)
──────────────                          ──────────────────
jsonProjection() returns real SQL       renderers call projectJson()
encodeJson / decodeJson go canonical    ORM planning emits projection nodes
harness proves the round trip           CodecMeta / meta / metaFor removed
contract defaults + fixtures move       database-produced JSON goes canonical
database-produced JSON: UNCHANGED
```

Each slice then carries one outcome. This slice answers "what *is* each codec's canonical JSON?" — on both the application and the SQL side. Slice 4 answers "when does the database start producing it?".

**Why `encodeJson` moves here.** Dispatch 1 established that `encodeJson` is not already canonical for the codecs that matter: `pg/numeric@1.encodeJson` is `Number(value)`, so `9007199254740993` becomes `…992` on the application side exactly as it does on the database side. `pg/bytea@1` emits PostgreSQL hex rather than base64; `sqlite/bigint@1` rejects unsafe integers outright. A projection cannot be canonical while the method defining canonical form is not, so the two move together, per codec, in one dispatch.

**One codec's wire read moves too.** Pinning `pg/interval@1`'s canonical form necessarily defined what an interval *application value is* — before, the three paths disagreed (a query read yielded `JSON.stringify` of the driver's component object, a write accepted any session-dependent PostgreSQL spelling, and `encodeJson` passed through whatever was held), so there was no defined value to preserve. This is a query-path change, so the slice's invariant is more precisely: no database-produced **JSON** path changes, and no rendered SQL changes, but one codec's wire decode does.

**Amended at PR review (operator decision, 2026-07-29): the application value is a structured duration object, not the ISO string.** D3a collapsed application value, JSON, and wire read onto one ISO spelling; review surfaced that value and representation should be independent, as they are for `bytea` (`Uint8Array` / base64) and `int8` (`bigint` / decimal string). The application value is now a `{months, days, micros}`-shaped object; **canonical JSON stays the ISO-8601 duration string**, so the SQL projection and every conformance expectation over JSON are untouched. The wire decode becomes near-identity (the driver already produces a component object); `encodeJson` formats object → ISO; `decodeJson` parses ISO → object. The three interval fields stay independent because a month has no fixed length — the object form states that directly. Applied pre-release (0.17 unshipped), so the upgrade entry is edited in place rather than superseded.

**The intermediate state this accepts — corrected at PR review (2026-07-29).** The original claim here — that the inconsistency was "bounded to serialized defaults and value sets, never a query path" — was **false**, and CI falsified it. `decodeJson` sits on a query path today: PR #942 made the ORM include path delegate database-produced JSON directly to `codec.decodeJson`, which is the very contract this project dismantles. So the seven codecs whose `decodeJson` went strict-canonical (`pg/int8@1`, `pg/numeric@1`, `pg/bytea@1`, `pg/interval@1`, `pg/vector@1`, and the SQLite siblings) reject what the still-unwired native producers emit, and the include path breaks — observed as `RUNTIME.DECODE_FAILED` on `pg/bytea@1` in `test/sql-orm-client/include-codecs.test.ts`, the one covered instance of the class.

**Operator decision (2026-07-29): keep `decodeJson` strict; the slice's PR does not merge until slice 4 (TML-3063) wires the producers.** Transitional native-form fallbacks were considered and rejected — strictness is the honest end state, and a permissive interim decoder is the shape of hole the project's non-goals name. Consequences: PR #29830 stands as a draft with its Integration Tests check expectedly red (the failing test is #942's contract asserting itself, and it goes green exactly when slice 4 flips the producer); slice 4 stacks on this branch and the two merge together or in immediate sequence; and the project's one-slice-one-merge structure is knowingly relaxed for this pair.

### Per-descriptor projections

Each identity hook is replaced by the AST composition that yields the codec's canonical representation, and the codec's `encodeJson` / `decodeJson` move to that same representation in the same dispatch. Two conditions govern, and the harness asserts both: the projection's parsed JSON equals `codec.encodeJson(applicationValue)`, **and** `codec.decodeJson(parsed)` returns the original application value. The second condition is load-bearing — without it an oracle is blind to a format that loses precision identically on both sides, which is exactly how `pg/numeric@1` reads today.

| Codec family | Canonical JSON | Projection shape |
| --- | --- | --- |
| `pg/numeric`, `pg/int8` | decimal string | cast to `text` before the JSON constructor sees a number |
| `pg/bytea` | base64 string | `encode(…, 'base64')` |
| `pg/timestamp*`, `pg/date`, `pg/time*` | canonical ISO | session-independent UTC rendering with pinned precision |
| `pg/interval` | ISO-8601 duration (`P1M2DT3H`) | constructed from `EXTRACT` components; `to_char` has no duration output and `IntervalStyle` cannot be bound per-projection |
| `pg/json`, `pg/jsonb` | JSON document | document semantics, not scalar |
| SQLite bigint | decimal string | cast to text |
| SQLite BLOB | hexadecimal string | `hex(…)`, pinned case |
| identity-safe scalars (`text`, `bool`, small ints) | unchanged | the projection stays `expression`, now as a *claim* rather than a placeholder |

The last row matters: an identity projection remains correct for codecs whose native JSON conversion is already canonical. What changes is that it becomes a deliberate, tested assertion rather than a transitional stub — consistent with the project's non-goal of a universal identity default.

### Array projections

`PostgresCodecDescriptor.jsonArrayProjection()` already implements the reference lift — derived-table single binding of the source, `CASE` for the null array, `unnest … WITH ORDINALITY`, per-element `CASE` for null elements, and `json_agg` ordered by ordinality with an `emptyArray` empty case. This slice does not rebuild it; it inherits the lift and gains its guarantees for free once each element projection is real, and extends the conformance cases to cover null array / empty array / null element / order / single evaluation per element codec.

### SQLite document retagging

SQLite loses the JSON subtype across derived tables, so a document-valued projection that survives one level of nesting arrives as text. The retagging mechanism re-applies the subtype at the document boundary. It is built and unit-tested here against AST/SQL expectations; it is wired in slice 4.

**What D6's probe established, for slice 4's benefit** — measured, not assumed:

- **The loss is total at the first boundary and does not compound.** One derived table degrades the document to text; two are no worse. `json_group_array` behaves identically to `json_object`, so the mechanism does not depend on which constructor produced the document.
- **Retagging the outermost level alone is sufficient.** Retag-at-both and retag-at-last were tested against each other and yield the same document. The retag therefore belongs where the document is *consumed*, not at every level it passes through.
- **The retag collapses rather than nests.** `json(json(x))` renders as one application, because SQLite's `json()` is already idempotent. Slice 4 can apply it at a boundary without knowing what a subexpression already did.
- **It throws `malformed JSON` on text that is not JSON.** Safe on SQL `NULL` and on integers, and correct for every JSON top-level form — but a value that was never a document must not be handed to it. The only current caller is `sqlite/json@1`, whose column always holds JSON text; slice 4 must not apply it blindly.
- **The natural wiring seam is the SQLite renderer's `JsonDocumentProjection` visitor case**, which exists from slice 1 and currently renders as identity. D6 deliberately did *not* route through it, because changing a visitor case is renderer wiring and therefore slice 4's.

### Conformance harness

An internal, database-backed harness takes a descriptor, a set of representative application values, and a live connection; for each value it encodes through the codec, stores it, projects it via `projectJson()`, executes, parses the driver's JSON, and asserts equality with `codec.encodeJson`. It runs `projectJson()` directly rather than through the render path, which is exactly why it works before the hard cut. The arbitrary-precision numeric regression (`1234567890.12345678901234567890`, `9007199254740993`) is a first-class case.

The harness is internal to this slice. Slice 5 promotes its case-runner API into the public dev-only `@internal/postgres-codec-testkit` / `@internal/sqlite-codec-testkit` packages; shaping it here with that promotion in mind is deliberate, but the package boundary is not this slice's problem.

**What the harness's green does not prove.** Three limits, each structural rather than a gap to be closed by more cases:

1. **Nesting.** It exercises a projection inside a flat JSON object over a base table. Derived-table nesting — which slice 4 introduces when it wires renderers, and which is the whole reason SQLite needs retagging — is out of reach by construction. Slice 4 must bring its own evidence and must not read this slice's green as covering it.
2. **Boundaries it was not given.** The oracle is exactly as good as its case values. Dispatch 3 shipped a base64 projection that broke for any value over 57 bytes while the suite stayed green, because the only case was 3 bytes. Green means "the values we chose round-trip", never "the representation is sound". Case *values* deserve at least as much review attention as the mechanism.
3. **Anything only a database-written value can exhibit.** The harness is value-first: it encodes an application value, stores it, projects it back. A defect that appears only in values the database itself produces cannot arise — the clearest instance being microsecond-precision temporals, since PostgreSQL stores microseconds while a JavaScript `Date` holds milliseconds, so a microsecond-bearing value cannot be constructed application-side at all. This is the same blind spot as the recorded `toDriverParam` write-side finding, seen from the other end.

## Coherence rationale

One outcome: every target descriptor states its canonical JSON as SQL, and a database proves it. A reviewer holds one question throughout — "is this codec's projection equal to its `encodeJson`?" — and the harness answers it uniformly for every row of the table. The formats cannot be split from the harness that validates them without shipping unverified format claims, and they cannot be split target-by-target without leaving a reviewer to re-orient across two PRs asking the identical question.

## Scope

**In:** `jsonProjection` implementations for all PostgreSQL and SQLite built-in descriptors; the matching `encodeJson` / `decodeJson` canonical forms for each affected codec; in-repo extension descriptors (pgvector, PostGIS, arktype-json); the SQLite document retagging mechanism; the database-backed conformance harness including the numeric precision regression; conformance cases for the inherited array lift; regeneration of contracts and fixtures that move because a codec's serialized representation changed.

**Out:** renderer wiring and any `projectJson()` call from a production path; ORM projection planning; `CodecMeta` / `meta` / `metaFor` removal; public testkit packages; aggregate descriptors; any change to a database-produced JSON path. All belong to slice 4 or 5.

**Slice 4's statement of the guarantee is a reviewable artefact, not a footnote.** Two limits now ride entirely on prose reaching the user: `pg/geometry@1` is exempt, and the float codecs are canonical only at `extra_float_digits >= 1`. Both are the right disposition — neither is repairable within this slice — but **neither is enforced by anything executable**. Nothing in CI fails if slice 4 advertises canonical lossless JSON without qualification. So the wording of that claim is the only place a user learns it carries two stated limits, and it should be reviewed as carefully as the code that earns it.

**A stated bound on the float codecs, by operator decision (2026-07-28).** The canonical JSON of `pg/float4@1`, `pg/float8@1`, `pg/float@1` and `pg/vector@1` is shortest-round-trip float printing, which is PostgreSQL's behaviour at `extra_float_digits >= 1` — the default since PostgreSQL 12. At `<= 0`, a legacy-compatibility setting, the server reverts to fixed significant digits and **all four silently truncate**, so the round trip fails. Measured, not inferred: at `-5` a `float8` holding `1/3` projects as `0.3333333333`; at the default it projects the exact `0.3333333333333333` that `encodeJson` returns. `json_build_object` over a bare `float8` column is affected identically, so this is not pgvector-specific.

Accepted as a bound rather than repaired. The alternatives each redefined what canonical means for four codecs: requiring the GUC on connect makes correctness depend on connection state, which is the reasoning that rejected `IntervalStyle`-pinning in dispatch 3a; and pinning a fixed output format abandons shortest-round-trip. A conformance case pins the behaviour at and above the default. **Slice 4 must state this precondition when it advertises canonical lossless JSON**, in the same breath as the PostGIS exemption below — the shape is the same, a hole known and bounded rather than unnoticed.

**Also out, by operator decision (2026-07-28): `pg/geometry@1` (PostGIS).** It is blocked on an undecided canonical format — GeoJSON has no SRID, the application type has `srid?` optional, PostGIS stores `0` for unset, and `{type,coordinates}` versus `{type,coordinates,srid:0}` must round-trip distinctly — and on infrastructure, since PGlite ships no PostGIS bundle and so `createDevDatabase` cannot host a `geometry` column. It has its own ticket outside this project. **Slice 4 must state this exemption explicitly rather than inherit it silently:** its hard cut will advertise canonical lossless JSON while one in-repo extension codec remains non-canonical.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| PostgreSQL `numeric` reaching JSON as a number | Must not occur | The project's originating defect. `9007199254740993` silently becomes `…992` before any codec sees it; the cast must precede the JSON constructor, not follow it. Regression evidence preserved under `assets/`. |
| SQLite JSON subtype lost across derived tables | Retagging required | Known from the design checkpoint; native JSON also rejects BLOBs, which is why BLOB is projected as hex text rather than left native. |
| Prototype's hardcoded codec-ID branch and lineage reconstruction | Rejected | Preserved as evidence only. Must not enter this or any project PR. |

## Slice-specific done conditions

- [ ] Every built-in and in-repo extension descriptor's projection is exercised by a real database case asserting both conformance conditions, and no descriptor retains an untested identity `jsonProjection`. The harness fails if a registered descriptor has no case, so the set cannot drift.
- [ ] No production render path calls `projectJson()`, and rendered SQL for existing queries is byte-identical to the predecessor branch.
- [ ] Contracts and fixtures that move because a codec's serialized representation changed are regenerated and committed, and a second `pnpm fixtures:check` is clean. Every such move is attributable to a codec whose canonical form changed in this slice — no incidental drift.

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
