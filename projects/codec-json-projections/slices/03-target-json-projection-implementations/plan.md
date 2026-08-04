# Dispatch plan — 03-target-json-projection-implementations

**Slice spec:** [`spec.md`](./spec.md)
**Linear:** [TML-3100](https://linear.app/prisma-company/issue/TML-3100/target-json-projection-implementations-and-conformance-harness)

## Validation gate

Every dispatch in this slice runs this gate; all commands must pass before the dispatch is done. Operator-confirmed 2026-07-27.

```bash
pnpm typecheck
pnpm lint:deps
pnpm test --filter @internal/target-postgres \
          --filter @internal/target-sqlite \
          --filter @internal/adapter-postgres \
          --filter @internal/adapter-sqlite
pnpm fixtures:check
pnpm check:upgrade-coverage
# AC-9 invariant: no production render path reaches projectJson()
grep -rn 'projectJson' packages/*/*/*/src/ | grep -v codec-descriptor
```

**`check:upgrade-coverage` was added late (2026-07-28), and its omission was an orchestrator error.** It was missing from the gate I authored, so eight dispatches ran green without it once being run — and it fails on this branch. That is not incidental: this slice makes real breaking changes (`pg/int8@1` `number → bigint`, `pg/interval@1`'s wire decode, `pg/vector@1`'s JSON methods string → array, plus JSON-form moves on `pg/numeric@1`, `pg/bytea@1`, `sqlite/bigint@1`, `sqlite/blob@1`), and downstream consumers face the same edits the slice made in-repo. A gate that is not run cannot fail, which is the whole lesson of this slice applied to its own process.

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

### Dispatch 2a: Contract literal defaults are typed by the codec's JSON channel

Inserted mid-slice (operator decision, 2026-07-28) after dispatch 2 halted on a stated halt condition. Runs **after** dispatch 2's codec work is committed and **before** dispatch 2 can close, because dispatch 2's commit leaves the branch red until this lands.

- **Outcome:** `DefaultLiteralValue` resolves a contract literal default to the codec's **JSON** type rather than its application type, via a JSON channel added to `CodecTypes` / `ExtractCodecTypes`. `@internal/extension-supabase` typechecks clean again, and an emitted `.d.ts` types an int8 literal default as the string the sibling `contract.json` actually holds.
- **Builds on:** Dispatch 2's canonical `pg/int8@1`, which is what exposed the divergence.
- **Hands to:** A seam that no longer breaks when a codec's application type differs from its JSON type — which unblocks dispatch 3's `pg/bytea@1` (`Uint8Array`) and dispatch 5's `sqlite/blob@1` before either is written.
- **Focus:** The emitter/IR typing seam only. It does not change any codec, projection, or canonical form. `ColumnDefaultLiteral.value`'s runtime arktype schema is deliberately **not** widened — contract.json never holds a `bigint`; that was the whole defect.

**Why the seam is wrong, in one line.** `contract.json` holds `"0"` for an int8 literal default; the emitted `contract.d.ts` typed the same value `bigint`. `pg/int8@1` is simply the first codec whose application type and JSON type diverge, so it is the first to expose a mistyping that was always latent.

**Open question this dispatch must answer, not assume.** `pg/timestamptz@1` types as `Date` — also absent from `ColumnDefaultLiteral.value`'s union — and carries a literal default in the e2e fixture, yet typechecks today. Either the constraint is not applied uniformly across paths, or `Date` is reached differently. Establish which before concluding the fix is complete; a fix that leaves the temporal path on a different mechanism is a partial fix, and dispatch 3 lands six temporal codecs.

### Dispatch 3: PostgreSQL binary and temporal projections

- **Outcome:** `pg/bytea@1` is canonical as base64 on both sides. `pg/date@1`, `pg/time@1`, `pg/timetz@1`, `pg/timestamp@1`, `pg/timestamptz@1`, and `pg/interval@1` are canonical ISO under session-independent UTC, with precision and timezone behavior pinned so a server's `TimeZone` setting cannot change the result — proven by a conformance case that runs under a non-UTC session, since dispatch 1 established these pass today only because the session happens to be UTC. `encodeJson` / `decodeJson` move with each projection; fixtures that move are regenerated. Note that `pg/bytea@1` and the temporals **conform today** and will transit through a failing state — that is expected, and the dispatch is not done until they conform again in their new canonical form.
- **Builds on:** Dispatch 1's oracle; dispatch 2's both-sides-together idiom.
- **Hands to:** Settled temporal and binary rendering, resolving the slice spec's open question 1.
- **Focus:** The two families that carry genuine rendering judgment. Temporal is the highest-judgment work in the slice; keeping it away from the mechanical fan-out is the point of this boundary.

### Dispatch 3a: `pg/interval@1` canonical ISO-8601 duration

Inserted mid-slice (operator decision, 2026-07-28) after dispatch 3 raised interval as a deferral request rather than skipping it. The project spec and design notes never mention `interval`, so its canonical form was genuinely unpinned — a decision, not a task.

- **Outcome:** `pg/interval@1` is canonical as an ISO-8601 duration (`P1M2DT3H`) on both sides. The projection constructs it in SQL from `EXTRACT` components, because `to_char` has no duration output and `IntervalStyle` cannot be bound per-projection. `encodeJson` / `decodeJson` gain a matching formatter and parser. Its marked expected-failure case flips to passing, including under a hostile session.
- **Builds on:** Dispatch 3's temporal work and its hostile-session case pattern.
- **Hands to:** A PostgreSQL temporal set with no exemptions, so slice 4's hard cut can advertise canonical JSON without a codec carve-out.
- **Focus:** Interval alone. It does not revisit the six codecs dispatch 3 settled.

**Why this needed deciding rather than doing.** An interval is not a duration — `1 month` has no fixed length in seconds — so a canonical form must preserve months, days and time components separately, which is exactly what ISO-8601 duration does. And `pg/interval@1`'s application value is currently an opaque string with no defined syntax (`encodeJson` is a bare passthrough), so making the projection canonical necessarily defines what an interval application value *is*. The alternatives considered and rejected: pinning `IntervalStyle` on connect (cheaper, but makes correctness depend on connection state rather than on the projection, and is a runtime/driver decision outside this slice), and accepting interval as a documented gap (which would ship a session-dependent-JSON hole of precisely the class this project exists to close).

**Amended at PR review (operator decision, 2026-07-29).** D3a defined the application value as the ISO string itself; review surfaced an option its list never carried — a **structured duration object** as the application value, with JSON staying the ISO string. That restores value/representation independence (as `bytea` and `int8` have), makes the wire decode near-identity since the driver already yields a component object, and leaves the projection and all JSON-side conformance untouched. Adopted pre-release; the upgrade entry is edited in place. The PR-review fix pass carries the change.

### Dispatch 4: PostgreSQL remaining scalar and document projections

- **Outcome:** Every remaining PostgreSQL descriptor states its projection as a deliberate, tested claim — identity where native conversion is already canonical (`text`, `char`, `varchar`, `bool`, `int`, `int2`, `int4`, `float`, `float4`, `float8`, `uuid`, `inet`, `bit`, `varbit`, `enum`, and the shared `sql/*` descriptors), and document semantics for `pg/json@1` and `pg/jsonb@1`. `sql/timestamp@1`, which dispatch 1 registered as an expected failure over the trailing `Z`, is resolved here or explicitly reassigned to dispatch 3 if it turns out to be a temporal decision. No PostgreSQL descriptor retains an untested identity hook, and no expected-failure entries remain for this target.
- **Builds on:** Dispatch 2's and dispatch 3's resolved idioms.
- **Inherits two F8-shaped boundary gaps.** Dispatch 3's sweep ranked the remaining cases by how closely each resembles the base64 defect — a format with an embedded delimiter or escape, where a small value is silent. The two closest are both here: **`pg/text-array@1` = `['a','b']`**, where PostgreSQL array literals escape `,` `{` `}` `"` and backslash and no element contains any of them, so the escaping path is wholly untested; and **`pg/text@1` / `varchar` / `char` = `'hello'`**, with no quote, backslash, newline or non-BMP character, so JSON string escaping is never exercised. Fix the values as part of this dispatch, and apply the negative check dispatch 3 established — revert the projection and confirm the *new* case fails while the old one would not.
- **Lower-risk gaps from the same sweep**, worth addressing if cheap: `pg/float4@1` at `1.5` is exactly representable, so `0.1` would test whether widening to a JS double survives; `pg/int2@1` at `7` never reaches ±32768; `pg/jsonb@1`'s input is already key-ordered, so jsonb's reordering and de-duplication normalisation is untested; `pg/date@1` has no BC date and no year past 9999.
- **Hands to:** A complete, uniformly asserted PostgreSQL projection set.
- **Focus:** Mechanical fan-out over the remaining codecs plus the json/jsonb document classification. The judgments it applies were made in dispatches 2 and 3.

### Dispatch 5: SQLite scalar projections

- **Outcome:** `sqlite/bigint@1` is canonical as decimal text on both sides — its `encodeJson` currently rejects unsafe integers outright, so this is a real behavior change, not a format tweak — and `sqlite/blob@1` is canonical as pinned-case hexadecimal. `sqlite/text@1`, `sqlite/integer@1`, `sqlite/real@1`, `sqlite/datetime@1`, and the shared `sql/*` descriptors on this target state their projections as tested claims. Finite-only float behavior is asserted. No SQLite descriptor retains an untested identity hook; fixtures that move are regenerated.
- **Builds on:** Dispatch 1's oracle; dispatch 2's both-sides-together idiom.
- **Carries a D1 debt (F5).** `sqlite/bigint@1`'s conformance case in `packages/3-targets/6-adapters/sqlite/test/codec-conformance/cases.ts` carries a `reason` string reading "the canonical JSON is a number, so a value outside the safe-integer range has no representation". Under the vocabulary D1 established, "canonical" means the form the codec ends up with — and this codec ends up as decimal text, here. The string must become "`encodeJson` emits a number" (or be rewritten wholesale as the case changes). Deferred from D1 R3 by orchestrator override; if D5 lands without it, it is a D5 finding.
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

### Dispatch 7a: Extension-loading in `createDevDatabase`

Split from dispatch 7 (operator decision, 2026-07-28) after its reconnaissance found no extension package has any live-database test at all — zero files under `pgvector/test`, `postgis/test` or `arktype-json/test` call `createDevDatabase`, and every `CREATE EXTENSION` reference is a migration definition or DDL-string assertion, never executed.

**Outcome: no change required. The capability already exists.** Probed rather than assumed: a `createDevDatabase()` database created with **no options at all** already has 32 extensions available, `vector` at 0.8.1 among them, and `CREATE EXTENSION IF NOT EXISTS vector` succeeds. So 7b and 7c were never blocked.

Two corrections this dispatch produced:

- **`ServerOptions` has no `extensions` field.** The `extensions: Record<string, URL>` reported in dispatch 7 is on `PGliteRuntimeAssets` — an internal runtime-assets shape consumed by `copyPrismaDevRuntimeAssets` — not a server option. Building the option would therefore have meant threading into a field that does not exist, on a shared surface four packages depend on, with no consumer needing it. Declined on the F10 asymmetry: speculative API on a shared surface is the `isJsonRetag` mistake with a wider blast radius.
- **`postgis` is confirmed absent from all 32**, which corroborates the TML-3105 deferral from the running database rather than from an inspection of shipped files.

Bonus evidence for 7c: `(('[1,2,3]'::vector)::text)::json` yields a genuine JSON numeric array — pgvector's canonical form per the design notes — so the projection shape has evidence behind it before the dispatch starts. And `citext`, `hstore`, `ltree`, `uuid-ossp` and `pg_trgm` are all available too, so any future extension codec over those types is similarly unblocked.

The no-op property was proved by construction: there is no diff, so every existing caller's startup path, timing and failure modes are unchanged by fact rather than by argument. The validation gate was deliberately not run — an empty diff gives it nothing to discriminate, and a full run under dev-server contention would produce noise attributable to nothing.

### Dispatch 7b: arktype-json canonical projection

- **Outcome:** `arktype/json@1` states its projection as a tested claim with real-database conformance. Reconnaissance suggests it conforms today — native type `jsonb`, identity projection, and a jsonb column already embeds as a document — so this is likely a tested claim plus boundary cases rather than a representation move.
- **Builds on:** Dispatch 7a's enablement, if `jsonb` being a core type does not make it unnecessary.
- **Focus:** One extension. It carries the parameter-schema history slice 2 recorded around unparameterized refs; worth not rushing.

### Dispatch 7c: pgvector canonical numeric array

- **Outcome:** `pg/vector@1` is canonical as a **JSON numeric array** on both sides. `encodeJson` currently returns the *string* `"[1,2,3]"`, so both sides move; the vector's text form is already valid JSON, so the projection is plausibly `col::text::json`. Real-database conformance via dispatch 7a's enablement.
- **Builds on:** Dispatch 7a.
- **Focus:** pgvector alone. The inherited `jsonArrayProjection` is **not** rebuilt — its guarantees are dispatch 8's.

### PostGIS — deferred to its own ticket, outside this project

Operator decision, 2026-07-28. Blocked on two independent things, neither of which this slice can resolve:

1. **An undecided format.** The application value is already GeoJSON-shaped, but `encodeJson` flattens it to a HEXEWKB string — so the JSON does not carry the shape the application has, which is the numeric-to-number defect in another guise. Document semantics is therefore correct. But GeoJSON has no SRID, the application type has `srid?` optional, and PostGIS stores `0` for unset — so a canonical GeoJSON document must decide whether `srid` is always present, omitted when zero, or omitted when absent, and `{type,coordinates}` versus `{type,coordinates,srid:0}` must then round-trip distinctly. `ST_AsGeoJSON` emits neither. A format decision, not a repair.
2. **No database that can host it.** PGlite ships no PostGIS bundle (`@prisma/dev` and PGlite both ship `vector.tar.gz` and no postgis), so `createDevDatabase` cannot host a `geometry` column at all. Conformance needs a real PostgreSQL with PostGIS installed.

**Consequence the operator accepted knowingly:** slice 4's hard cut will advertise canonical lossless JSON with `pg/geometry@1` exempt — the same shape of hole rejected for `pg/interval@1` in dispatch 3a, accepted here because the blockers are infrastructure and an open format question rather than effort. Slice 4 must state the exemption rather than inherit it silently.

### Dispatch 8: Array-lift conformance across element codecs

- **Outcome:** The inherited PostgreSQL array lift is proven against real element projections: null array, empty array, null elements, element order, and single evaluation of the source each hold for a representative spread of element codecs, including a canonical-text element (numeric) and a document element.
- **Builds on:** Dispatch 4's complete PostgreSQL projection set and dispatch 7's pgvector projection.
- **Carries a D6 breadth item (orchestrator routing, 2026-07-28).** D6's premise test proves SQLite subtype restoration across a derived table, but all five arms use `JsonObjectExpr` as the enclosing constructor; `json_group_array` is covered only by an uncommitted probe. The reviewer routed this to slice 4 as *structural* — the retag wraps the inner expression, so restoration is a property of the value rather than its consumer. I disagree: whether `json_group_array` preserves element subtypes as `json_object` preserves value subtypes is a contingent fact about SQLite, which is exactly why D6 probed it instead of reasoning about it. Same class as the premise, therefore, and the same standard applies — evidence in-tree rather than an argument. It lands **here** rather than in slice 4 or a reopened D6, because this dispatch is about array aggregation and is the natural home. Cost is one test arm.
- **Hands to:** The slice-DoD's completeness claim — every projection, scalar and array, is database-proven.
- **Focus:** Conformance evidence for the lift. It does not modify `jsonArrayProjection`; if a guarantee fails, that is a finding for discussion, not a silent fix here.

## Open items

Routed from D1 review; not findings, and not the implementer's to chase unprompted.

- ~~**D2 must add a beyond-2^53 `pg/int8@1` case.**~~ **Discharged** by `1e459fb753`, which added cases at 2^53+1 and the signed-64-bit lower bound. AC-2 traced end to end and marked PASS.
- **D3 must settle a write-side timezone question.** The PostgreSQL harness pre-stringifies a `Date` wire value to UTC ISO before binding, which is *not* what `pg` does in production — it serializes a `Date` at the local offset, so for `pg/timestamp@1` the stored wall clock differs. D3's non-UTC-session case should establish whether that normalization is correct or whether it conceals a write-side timezone dependency.
- **Consumer surfaces that move because `pg/int8@1` becomes `bigint`.** Mapped by the D2 implementer, none touched yet. Dispatch 2 owns them on resume, except where noted: `test/e2e/framework/test/fixtures/contract.ts:124` (`.default(9007199254740991)` authoring source); `test/e2e/framework/test/ddl.test.ts:43` (DDL default snapshot); `test/e2e/framework/test/dml.test.ts:192`, which asserts the string `'9007199254740991'` and therefore **encodes the old defect** — read it as a bug being fixed, not a regression; `test/integration/test/ports/prisma/functional/multiple-types/`; `packages/3-targets/6-adapters/postgres/test/scalar-list-codec-roundtrip.integration.test.ts` (declares `bigints: number[]`); and `packages/3-extensions/supabase/test/service-role-refresh-tokens.integration.test.ts:95`, a genuine consumer break.
- **`count()` becomes `bigint` with no edit.** `CountField` in `packages/2-sql/4-lanes/sql-builder/src/expression.ts:122` already carries `codecId: 'pg/int8@1'`, so the aggregate result type follows by type flow. No aggregate-resolution work was done or is needed here — the slice-5 seam held under the first real test of it.
- **ADR 155 goes stale.** `docs/architecture docs/adrs/ADR 155` §87-91 describes `pg/int8@1` as the `number → number` identity codec and names it as the failure mode to eliminate. Accurate until dispatch 2 lands, wrong afterwards. Not dispatch 2's to rewrite mid-flight; it belongs with the slice's documentation pass or the project's ADR audit at close-out, and is recorded here so it is not lost.
- **D3 precondition — `pg/bytea@1` has no coincidence to lean on.** `pg/int8@1` survives the authoring-input-versus-contract-value seam only by accident: a `number` input happens to `.toString()` into correct decimal text. A `Uint8Array` default is not `JsonValue` at all, and base64 text has no number to fall back on. **Before D3 ships a `pg/bytea@1` canonical form, either resolve the authoring-input type question or confirm no committed contract carries a bytea literal default.** Confirming absence is the cheaper discharge and is probably true; it must be checked, not assumed.
- **Latent `pg/numeric@1` conformance gap the oracle cannot exhibit.** `pg/numeric@1`'s conformance rests on its columns being declared bare `numeric`, because `nativeTypeFor` drops precision and scale — they feed only the emitted TypeScript. But committed contracts do carry `{ precision: 38, scale: 30 }` and similar alongside `nativeType: 'numeric'`. If any later work makes the DDL emit `numeric(p,s)`, PostgreSQL scale-pads and `col::text` yields `'1.50'` where `encodeJson('1.5')` yields `'1.5'` — a conformance failure the harness **structurally cannot surface**, because a parameterized case still gets a bare column. Not a defect today. It is a tripwire for slice 4 and for anyone touching numeric DDL emission, and it is recorded here because the test suite cannot record it.
- **Pre-existing defect found by D4's boundary sweep: `pg/date@1` cannot encode a BC date.** `pgDateEncode` mangles an extended or negative year — `new Date(Date.UTC(-44, 2, 15))` produces `"0-44-03-15"` and PostgreSQL rejects it with `invalid input syntax for type date`. It fails at **`encode`**, on the wire path, before any projection is reached, so it is not a projection defect and not this slice's to repair. Years past 9999 are the same question in the other direction. Fixing it is a decision rather than a repair: PostgreSQL renders BC dates as `0044-03-15 BC`, JavaScript's `toISOString()` renders `-000044-03-15`, and ISO-8601 extended years require an explicit sign and six digits — so admitting them changes the codec's declared JSON format, the `ISO_8601_DATE` pattern, **and** the projection, since PostgreSQL's native output is not ISO for these values. Pre-existing, not introduced here. Reproduction: a `pg/date@1` conformance case at `new Date(Date.UTC(-44, 2, 15))`. D4 removed the case rather than marking it `notYetCanonical`, correctly — that marker means "the projection disagrees with `encodeJson`", and this never reaches the projection. **Wants its own ticket outside this project.**
- **The "contention" is concurrent dev-server spin-up, not a degraded database.** Diagnosed 2026-07-28. These suites do not share a database: `createDevDatabase()` in `test/utils/src/exports/index.ts` calls `startPrismaDevServer`, so **each test file spins up its own `@prisma/dev` embedded PostgreSQL**. At 81-file concurrency that is dozens of simultaneous servers competing for ports and memory, which is why failures read as `Client has encountered a connection error` and why per-file runs are clean while per-package runs are not. The helper's own doc comment names the constraint: `@prisma/dev` assigns ports automatically and rejects a second connection while the first is active.
  Consequences: the docker `postgres` container on host 5432 belongs to an unrelated compose project and is **not** what these tests use (this repo's own compose maps 5433, which is not running) — so restarting or tuning it changes nothing. The failure trend across D3→D4 reflects accumulated machine load, not a sickening server. The meaningful signal is **per-file**, and the slice-DoD full-suite gate at PR-open should either run `adapter-postgres` with reduced worker concurrency or be read per-file rather than as a clean/dirty verdict.
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
