# Dispatch plan — 03-target-json-projection-implementations

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3100](https://linear.app/prisma-company/issue/TML-3100/target-json-projection-implementations-and-conformance-harness)

## Shape

Test-first, then judgment-before-fan-out. Dispatch 1 builds the oracle that every later dispatch is measured against. Dispatches 2, 3 and 6 make the format judgments in one canonical location each; dispatches 4, 5 and 7 fan the resolved idioms out mechanically. This ordering is the calibration's remedy for "mechanical fan-out + design judgment in one dispatch" — the judgment sites stay small enough for a reviewer to actually see.

Two facts from the grounding pass shape the plan:

- `PostgresCodecDescriptor.jsonArrayProjection()` **already implements** the reference array lift (derived-table single binding, null-array and null-element `CASE`s, `unnest … WITH ORDINALITY`, ordered `json_agg` with `emptyArray`). No dispatch rebuilds it; dispatch 8 proves its guarantees hold once element projections are real.
- The surface is 27 PostgreSQL codec ids (`codec-ids.ts`) and 7 SQLite ones, all currently carrying identity `jsonProjection` hooks from slice 2.

### Dispatch 1: Conformance harness and baseline cases

- **Outcome:** A database-backed harness takes a descriptor, representative application values, and a live connection; for each value it stores, projects via `projectJson()`, executes, parses the driver's JSON, and asserts equality with `codec.encodeJson`. Every built-in PostgreSQL and SQLite descriptor has representative values registered. Codecs whose identity projection is already canonical pass; those that are not yet canonical are registered as expected failures, including the arbitrary-precision numeric regression (`1234567890.12345678901234567890`, `9007199254740993`). CI is green.
- **Builds on:** The spec's chosen design; the existing `projectJson()` template methods from slice 2.
- **Hands to:** An executable oracle that names, per codec, whether its projection is canonical — and a failing-by-design list that later dispatches convert to passes.
- **Focus:** Harness mechanics, case registration, and expected-failure bookkeeping. It changes no descriptor.

### Dispatch 2: PostgreSQL numeric and int8 canonical text projection

- **Outcome:** `pg/numeric@1` and `pg/int8@1` project as decimal strings, with the cast applied before the JSON constructor can coerce to a number. Their harness cases move from expected-failure to passing, including both arbitrary-precision regression values.
- **Builds on:** Dispatch 1's oracle.
- **Hands to:** The established cast-before-JSON idiom, and proof that the project's originating defect is fixed at the projection layer.
- **Focus:** The two codecs at the heart of the regression. It resolves the idiom other numeric-adjacent codecs reuse; it does not touch temporal, binary, or SQLite codecs.

### Dispatch 3: PostgreSQL binary and temporal projections

- **Outcome:** `pg/bytea@1` projects as base64. `pg/date@1`, `pg/time@1`, `pg/timetz@1`, `pg/timestamp@1`, `pg/timestamptz@1`, and `pg/interval@1` project as canonical ISO under session-independent UTC, with precision and timezone behavior pinned so a server's `TimeZone` setting cannot change the result. Their harness cases pass.
- **Builds on:** Dispatch 1's oracle; dispatch 2's cast-before-JSON idiom.
- **Hands to:** Settled temporal and binary rendering, resolving the slice spec's open question 1.
- **Focus:** The two families that carry genuine rendering judgment. Temporal is the highest-judgment work in the slice; keeping it away from the mechanical fan-out is the point of this boundary.

### Dispatch 4: PostgreSQL remaining scalar and document projections

- **Outcome:** Every remaining PostgreSQL descriptor states its projection as a deliberate, tested claim — identity where native conversion is already canonical (`text`, `char`, `varchar`, `bool`, `int`, `int2`, `int4`, `float`, `float4`, `float8`, `uuid`, `inet`, `bit`, `varbit`, `enum`), and document semantics for `pg/json@1` and `pg/jsonb@1`. No PostgreSQL descriptor retains an untested identity hook, and no expected-failure entries remain for this target.
- **Builds on:** Dispatch 2's and dispatch 3's resolved idioms.
- **Hands to:** A complete, uniformly asserted PostgreSQL projection set.
- **Focus:** Mechanical fan-out over the remaining codecs plus the json/jsonb document classification. The judgments it applies were made in dispatches 2 and 3.

### Dispatch 5: SQLite scalar projections

- **Outcome:** `sqlite/bigint@1` projects as decimal text and `sqlite/blob@1` as hexadecimal with pinned case; `sqlite/text@1`, `sqlite/integer@1`, `sqlite/real@1`, and `sqlite/datetime@1` state their projections as tested claims. Finite-only float behavior is asserted. No SQLite descriptor retains an untested identity hook.
- **Builds on:** Dispatch 1's oracle; dispatch 2's cast idiom.
- **Hands to:** A complete SQLite scalar projection set, leaving only the document-retagging mechanism for this target.
- **Focus:** SQLite scalars. Document retagging is dispatch 6; stored scalar arrays remain out of scope per the project's non-goals.

### Dispatch 6: SQLite JSON-document retagging mechanism

- **Outcome:** A retagging mechanism re-applies the JSON subtype at the document boundary so a document-valued projection survives a derived table, with unit tests asserting the AST and rendered SQL. `sqlite/json@1` uses it. It is not wired into any production render path.
- **Builds on:** Dispatch 1's oracle; dispatch 5's SQLite projection set.
- **Hands to:** The document mechanism slice 4 wires in, with its shape already reviewed.
- **Focus:** The retagging mechanism alone — a design-judgment dispatch deliberately isolated from the SQLite scalar fan-out.

### Dispatch 7: In-repo extension descriptor projections

- **Outcome:** pgvector, PostGIS, and arktype-json descriptors implement their canonical projections — PostGIS GeoJSON as a document, pgvector arrays through the inherited array lift, arktype-json per its canonical `encodeJson` — each with conformance cases against a real database.
- **Builds on:** Dispatches 2–4's PostgreSQL idioms; the inherited `jsonArrayProjection`.
- **Hands to:** Extension parity with built-ins, resolving the slice spec's open question 2.
- **Focus:** The three in-repo extension codec surfaces. It changes no built-in descriptor and adds no extension dependency beyond what slice 2 established.

### Dispatch 8: Array-lift conformance across element codecs

- **Outcome:** The inherited PostgreSQL array lift is proven against real element projections: null array, empty array, null elements, element order, and single evaluation of the source each hold for a representative spread of element codecs, including a canonical-text element (numeric) and a document element.
- **Builds on:** Dispatch 4's complete PostgreSQL projection set and dispatch 7's pgvector projection.
- **Hands to:** The slice-DoD's completeness claim — every projection, scalar and array, is database-proven.
- **Focus:** Conformance evidence for the lift. It does not modify `jsonArrayProjection`; if a guarantee fails, that is a finding for discussion, not a silent fix here.

## Hand-off linearity

Dispatch 1 is the root: every later dispatch builds on its oracle, not merely on its immediate predecessor. The non-linear edges worth flagging to brief assembly:

- Dispatch 4 needs dispatch **2 and 3**'s idioms, not just dispatch 3's.
- Dispatch 7 needs dispatches **2–4**'s idioms plus the pre-existing array lift.
- Dispatch 8 needs dispatch **4 and 7**, skipping 5 and 6 entirely (SQLite has no array projection in scope).

## Completeness against slice-DoD

- _"Every descriptor's projection exercised by a real database case asserting parsed JSON equals `encodeJson`; no untested identity hook remains"_ — dispatches 4, 5 and 7 close the descriptor set; dispatch 1 supplies the assertion mechanism; dispatch 8 extends it to arrays.
- _"No production render path calls `projectJson()`; emitted SQL, contracts and fixtures byte-identical to the predecessor branch"_ — held by every dispatch's focus statement and verifiable by `pnpm fixtures:check` plus a grep for `projectJson` outside descriptor and test code.
