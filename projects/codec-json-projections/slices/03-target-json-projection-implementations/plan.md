# Dispatch plan — 03-target-json-projection-implementations

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3100](https://linear.app/prisma-company/issue/TML-3100/target-json-projection-implementations-and-conformance-harness)

## Validation gate

Every dispatch in this slice runs this gate; all commands must pass before the dispatch is done. Operator-confirmed 2026-07-27.

```bash
pnpm typecheck
pnpm lint:deps
pnpm test --filter @prisma-next/target-postgres \
          --filter @prisma-next/target-sqlite \
          --filter @prisma-next/adapter-postgres \
          --filter @prisma-next/adapter-sqlite
pnpm fixtures:check
# AC-9 invariant: no production render path reaches projectJson()
grep -rn 'projectJson' packages/*/*/*/src/ | grep -v codec-descriptor
```

The `projectJson` grep is the gate's load-bearing half: it protects the slice boundary that no database-produced JSON path changes here. `fixtures:check` is **not** a no-op in this slice — moving a codec's `encodeJson` changes contract-serialized defaults, so a dispatch that changes a canonical form must regenerate and commit the affected fixtures, then re-run until clean. Any fixture movement not attributable to a codec whose canonical form changed in that dispatch is incidental drift and halts.

The workspace-wide suite is deliberately excluded — its PostgreSQL integration tests fail under parallel contention and would put false red in front of every dispatch; the slice-DoD gate at PR-open runs it once, with failures re-checked in isolation before being believed.

## Shape

Test-first, then judgment-before-fan-out. Dispatch 1 builds the oracle that every later dispatch is measured against. Dispatches 2, 3 and 6 make the format judgments in one canonical location each; dispatches 4, 5 and 7 fan the resolved idioms out mechanically. This ordering is the calibration's remedy for "mechanical fan-out + design judgment in one dispatch" — the judgment sites stay small enough for a reviewer to actually see.

Three facts shape the plan:

- `PostgresCodecDescriptor.jsonArrayProjection()` **already implements** the reference array lift (derived-table single binding, null-array and null-element `CASE`s, `unnest … WITH ORDINALITY`, ordered `json_agg` with `emptyArray`). No dispatch rebuilds it; dispatch 8 proves its guarantees hold once element projections are real.
- The surface is **33 PostgreSQL and 11 SQLite** descriptors, established by dispatch 1's registry-completeness test — larger than the codec-id constant count, because `codec-ids.ts` re-exports the shared `sql/*` base ids. A registered descriptor without a conformance case turns the suite red, so the set cannot drift.
- **`encodeJson` moves with the projection** (operator decision, 2026-07-27, after dispatch 1 falsified the original seam). `pg/numeric@1.encodeJson` is `Number(value)` and loses precision identically to the database path, so a projection cannot be canonical while `encodeJson` is not. Each dispatch below that changes a canonical form changes both sides for that codec and regenerates the fixtures that move.

### Dispatch 1: Conformance harness and baseline cases

- **Outcome:** A database-backed harness takes a descriptor, representative application values, and a live connection; for each value it stores, projects via `projectJson()`, executes, parses the driver's JSON, and asserts equality with `codec.encodeJson`. Every built-in PostgreSQL and SQLite descriptor has representative values registered. Codecs whose identity projection is already canonical pass; those that are not yet canonical are registered as expected failures, including the arbitrary-precision numeric regression (`1234567890.12345678901234567890`, `9007199254740993`). CI is green.
- **Builds on:** The spec's chosen design; the existing `projectJson()` template methods from slice 2.
- **Hands to:** An executable oracle that names, per codec, whether its projection is canonical — and a failing-by-design list that later dispatches convert to passes.
- **Focus:** Harness mechanics, case registration, and expected-failure bookkeeping. It changes no descriptor.

### Dispatch 2: PostgreSQL numeric and int8 canonical text projection

- **Outcome:** `pg/numeric@1` and `pg/int8@1` are canonical as decimal strings on both sides — `encodeJson` / `decodeJson` emit and accept decimal text, and the projection casts to `text` before the JSON constructor can coerce to a number. Their harness cases move from expected-failure to passing, including both arbitrary-precision regression values. Fixtures that move are regenerated and committed.
- **Builds on:** Dispatch 1's oracle.
- **Hands to:** The established both-sides-together idiom — cast-before-JSON in SQL, decimal text in `encodeJson` — and proof that the project's originating defect is fixed.
- **Focus:** The two codecs at the heart of the regression. It resolves the idiom every later canonical-format dispatch reuses, including how fixture movement is attributed and reviewed. It does not touch temporal, binary, or SQLite codecs.

### Dispatch 3: PostgreSQL binary and temporal projections

- **Outcome:** `pg/bytea@1` is canonical as base64 on both sides. `pg/date@1`, `pg/time@1`, `pg/timetz@1`, `pg/timestamp@1`, `pg/timestamptz@1`, and `pg/interval@1` are canonical ISO under session-independent UTC, with precision and timezone behavior pinned so a server's `TimeZone` setting cannot change the result — proven by a conformance case that runs under a non-UTC session, since dispatch 1 established these pass today only because the session happens to be UTC. `encodeJson` / `decodeJson` move with each projection; fixtures that move are regenerated. Note that `pg/bytea@1` and the temporals **conform today** and will transit through a failing state — that is expected, and the dispatch is not done until they conform again in their new canonical form.
- **Builds on:** Dispatch 1's oracle; dispatch 2's both-sides-together idiom.
- **Hands to:** Settled temporal and binary rendering, resolving the slice spec's open question 1.
- **Focus:** The two families that carry genuine rendering judgment. Temporal is the highest-judgment work in the slice; keeping it away from the mechanical fan-out is the point of this boundary.

### Dispatch 4: PostgreSQL remaining scalar and document projections

- **Outcome:** Every remaining PostgreSQL descriptor states its projection as a deliberate, tested claim — identity where native conversion is already canonical (`text`, `char`, `varchar`, `bool`, `int`, `int2`, `int4`, `float`, `float4`, `float8`, `uuid`, `inet`, `bit`, `varbit`, `enum`, and the shared `sql/*` descriptors), and document semantics for `pg/json@1` and `pg/jsonb@1`. `sql/timestamp@1`, which dispatch 1 registered as an expected failure over the trailing `Z`, is resolved here or explicitly reassigned to dispatch 3 if it turns out to be a temporal decision. No PostgreSQL descriptor retains an untested identity hook, and no expected-failure entries remain for this target.
- **Builds on:** Dispatch 2's and dispatch 3's resolved idioms.
- **Hands to:** A complete, uniformly asserted PostgreSQL projection set.
- **Focus:** Mechanical fan-out over the remaining codecs plus the json/jsonb document classification. The judgments it applies were made in dispatches 2 and 3.

### Dispatch 5: SQLite scalar projections

- **Outcome:** `sqlite/bigint@1` is canonical as decimal text on both sides — its `encodeJson` currently rejects unsafe integers outright, so this is a real behavior change, not a format tweak — and `sqlite/blob@1` is canonical as pinned-case hexadecimal. `sqlite/text@1`, `sqlite/integer@1`, `sqlite/real@1`, `sqlite/datetime@1`, and the shared `sql/*` descriptors on this target state their projections as tested claims. Finite-only float behavior is asserted. No SQLite descriptor retains an untested identity hook; fixtures that move are regenerated.
- **Builds on:** Dispatch 1's oracle; dispatch 2's both-sides-together idiom.
- **Hands to:** A complete SQLite scalar projection set, leaving only the document-retagging mechanism for this target.
- **Focus:** SQLite scalars. Document retagging is dispatch 6; stored scalar arrays remain out of scope per the project's non-goals.

### Dispatch 6: SQLite JSON-document retagging mechanism

- **Outcome:** A retagging mechanism re-applies the JSON subtype at the document boundary so a document-valued projection survives a derived table, with unit tests asserting the AST and rendered SQL. `sqlite/json@1` uses it. It is not wired into any production render path.
- **Builds on:** Dispatch 1's oracle; dispatch 5's SQLite projection set.
- **Hands to:** The document mechanism slice 4 wires in, with its shape already reviewed.
- **Focus:** The retagging mechanism alone — a design-judgment dispatch deliberately isolated from the SQLite scalar fan-out.

### Dispatch 7: In-repo extension descriptor projections

- **Outcome:** pgvector, PostGIS, and arktype-json descriptors are canonical on both sides — PostGIS GeoJSON as a document, pgvector arrays through the inherited array lift, arktype-json per its canonical form — each with conformance cases against a real database, and with each extension's committed contract space regenerated where its serialized representation moved.
- **Builds on:** Dispatches 2–4's PostgreSQL idioms; the inherited `jsonArrayProjection`.
- **Hands to:** Extension parity with built-ins, resolving the slice spec's open question 2.
- **Focus:** The three in-repo extension codec surfaces. It changes no built-in descriptor and adds no extension dependency beyond what slice 2 established.

### Dispatch 8: Array-lift conformance across element codecs

- **Outcome:** The inherited PostgreSQL array lift is proven against real element projections: null array, empty array, null elements, element order, and single evaluation of the source each hold for a representative spread of element codecs, including a canonical-text element (numeric) and a document element.
- **Builds on:** Dispatch 4's complete PostgreSQL projection set and dispatch 7's pgvector projection.
- **Hands to:** The slice-DoD's completeness claim — every projection, scalar and array, is database-proven.
- **Focus:** Conformance evidence for the lift. It does not modify `jsonArrayProjection`; if a guarantee fails, that is a finding for discussion, not a silent fix here.

## Open items

Routed from D1 review; not findings, and not the implementer's to chase unprompted.

- **D2 must add a beyond-2^53 `pg/int8@1` case.** The oracle currently has only a conforming `int8` case at `9007199254740991`; nothing exhibits the loss. `pg/int8@1`'s declared application type is `number`, so the failing value is not expressible at the case level until D2 moves the application type. Without that case AC-2's `int8` half has no evidence.
- **D3 must settle a write-side timezone question.** The PostgreSQL harness pre-stringifies a `Date` wire value to UTC ISO before binding, which is *not* what `pg` does in production — it serializes a `Date` at the local offset, so for `pg/timestamp@1` the stored wall clock differs. D3's non-UTC-session case should establish whether that normalization is correct or whether it conceals a write-side timezone dependency.
- **Harness duplication is a slice-5 decision, not a slice-3 one.** The two harnesses are ~85% identical and both reach `renderLoweredSql` through a relative `../../src/core/...` import that is in neither adapter's public exports. Defensible if they become two packages; worth deciding when slice 5 promotes them. Not to be refactored here.

## Hand-off linearity

Dispatch 1 is the root: every later dispatch builds on its oracle, not merely on its immediate predecessor. The non-linear edges worth flagging to brief assembly:

- Dispatch 4 needs dispatch **2 and 3**'s idioms, not just dispatch 3's.
- Dispatch 7 needs dispatches **2–4**'s idioms plus the pre-existing array lift.
- Dispatch 8 needs dispatch **4 and 7**, skipping 5 and 6 entirely (SQLite has no array projection in scope).

## Completeness against slice-DoD

- _"Every descriptor's projection exercised by a real database case asserting both conformance conditions; no untested identity hook remains"_ — dispatches 4, 5 and 7 close the descriptor set; dispatch 1 supplies the assertion mechanism and the registry-completeness test that keeps it closed; dispatch 8 extends it to arrays.
- _"No production render path calls `projectJson()`; rendered SQL byte-identical to the predecessor branch"_ — held by every dispatch's focus statement and verified by the `projectJson` grep gate.
- _"Fixtures that move are regenerated, attributable, and a second `fixtures:check` is clean"_ — owned per-dispatch by whichever dispatch changes a canonical form (2, 3, 5, 7), with dispatch 2 establishing how attribution is evidenced for the reviewer.
