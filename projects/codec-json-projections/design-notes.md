# Design notes: Codec JSON projections

> Synthesized design document for `codec-json-projections`. Read this to understand what the project's design is, which principles it serves, and why the alternatives were rejected. This is the settled model rather than a chronological discussion log; the full evidence and reasoning checkpoint is preserved in [`assets/codec-json-projection-design-checkpoint.md`](./assets/codec-json-projection-design-checkpoint.md).
>
> Owned by the Orchestrator. Updated as design settles, not as implementation details churn. Cross-linked from the project spec and removed or migrated at project close-out.

## Principles this design serves

- **Losslessness before convenience** — no driver, JSON constructor, or JavaScript-number conversion may silently narrow a value before its codec can decode it.
- **Codec-owned canonical form** — `encodeJson` and `decodeJson` describe the application-facing JSON representation selected by the codec, not an incidental target-native JSON scalar.
- **Target ownership without a closed target map** — database-specific projection behavior belongs to target descriptor specializations so first-party and user-defined targets remain open-world.
- **Explicit semantic claims** — a codec author must state scalar projection behavior; silently defaulting to native conversion would make omissions look correct until data is corrupted.
- **Type safety at public boundaries, erasure behind validation** — target-facing authoring APIs stay statically narrow while generic control-stack storage may erase subtype information after a single composition-time validation.
- **Authoritative metadata, never lineage reconstruction** — the planner carries output codec identity through `ProjectionItem`; adapters do not reverse-engineer it from tables or columns.
- **One runtime/type-system source of truth** — aggregate availability, result codecs, nullability, lowering, and emitted aggregate type maps derive from the same aggregate descriptors.
- **Conformance over assertion** — TypeScript proves projection hooks exist; database-backed testkits prove those hooks actually produce each codec's canonical JSON.
- **Coherent intermediate states** — each stacked PR leaves `main` behaviorally consistent and reviewable, even across a deliberate pre-1.0 hard cut.

## The model

### Canonical codec JSON

A codec chooses an arbitrary stable JSON representation that is lossless for its application value. Database-produced JSON must be projected into exactly that representation before a driver parses the containing JSON document.

The core invariant is:

```text
codec.encodeJson(applicationValue)
  ===
JSON value emitted by the database for the corresponding projected stored expression
```

The value on the right is then valid input to `codec.decodeJson`. A decoder must not accept an already-lossy representation merely to tolerate target behavior. In particular, PostgreSQL `numeric` JSON numbers are rounded when the driver turns them into JavaScript numbers, so the projection must make PostgreSQL emit decimal text and `PgNumericCodec.decodeJson` must expect a string.

Canonical representations after the migration are:

| Codec or type | Canonical JSON | Database projection |
|---|---|---|
| PostgreSQL numeric/decimal | Decimal string | Text before JSON construction |
| PostgreSQL int8 | Decimal string | Text before JSON construction |
| PostgreSQL bytea | Base64 string | `encode(expression, 'base64')` |
| PostgreSQL timestamp/timestamptz | Canonical UTC ISO string | Explicit target formatting independent of session timezone |
| pgvector vector | JSON numeric array | Extension-owned PostgreSQL projection |
| PostGIS geometry | GeoJSON document | Extension-owned GeoJSON projection |
| PostgreSQL JSON/JSONB | Structured JSON | JSON-document projection |
| SQLite bigint | Decimal string | `CAST(expression AS TEXT)` |
| SQLite BLOB | Pinned hexadecimal string | `hex(expression)` |
| SQLite JSON stored as text | Structured JSON | `json(expression)` |
| Finite SQL floats | JSON number | Native projection only where conformance proves equivalence |

Generic SQL floats become finite-only at codec boundaries. A target-specific codec may support non-finite values only if its storage, canonical JSON representation, and projection preserve them losslessly.

### Target-neutral JSON projection AST

The relational SQL AST gains a frozen class/visitor union describing the semantic treatment of any scalar crossing a database-produced JSON boundary:

- `CodecJsonValueProjection(value, codec)` asks the active target descriptor registry to transform the stored expression into that codec's canonical JSON representation.
- `NativeJsonValueProjection(value)` explicitly states that ordinary target-native JSON scalar conversion is correct.
- `JsonDocumentProjection(value)` states that the expression is already a JSON document and must be embedded as a document rather than quoted as text.

`JsonObjectExpr` stores keyed instances of this projection union. `JsonArrayAggExpr` stores the same union for its element, because scalar array aggregation crosses the same boundary as an object property. The union is implemented as classes with `kind`, constructor invariants, defensive freezing, and `accept(visitor)`; rewrites reconstruct classes rather than spreading nodes into plain objects.

The union is target-neutral: it says what semantic result is required, not how PostgreSQL, SQLite, or a custom target spells the SQL. There is no raw JavaScript `JsonValue` variant in this project. Typed SQL AST nodes are added where needed for function calls, casts, cases, function-source returned-column aliases, and `WITH ORDINALITY`; raw SQL remains an extension escape hatch rather than built-in infrastructure.

### Target codec descriptors

`PostgresCodecDescriptor<P>` and `SqliteCodecDescriptor<P>` specialize the generic codec authoring model for their respective targets. Each has a stable structural discriminant so extension packages remain valid even when module duplication would make `instanceof` unreliable.

A PostgreSQL descriptor owns:

- Typed native-type resolution for parameter casts and schema behavior.
- A mandatory scalar AST-to-AST JSON projection hook.
- A default overridable SQL-level array projection that lifts the scalar hook over elements.
- Public template methods that accept an erased `CodecRef`, validate its `typeParams` through the descriptor's schema, and call protected strongly typed hooks using `P`.

The public adapter boundary never casts arbitrary JSON parameters to `P`. Descriptor-owned validation is the only transition from an erased `CodecRef` to typed hook parameters.

Generic SQL descriptors remain target-independent. Targets wrap them with factories such as:

```ts
postgresCodec(sqlIntDescriptor, {
  nativeType: () => 'integer',
  jsonProjection: nativeJsonProjection,
});
```

The factory returns a real target descriptor adapter that delegates the ordinary `CodecDescriptor` contract to the wrapped descriptor and owns target-specific behavior. `sqliteCodec(...)` is analogous. `definePostgresCodecs([...])` and `defineSqliteCodecs([...])` are narrow identity-style helpers for descriptor arrays; they preserve tuple/concrete types and reject a target-independent descriptor that was not explicitly adapted. The whole `SqlControlExtensionDescriptor` does not become target-specific because only its contributed descriptor array needs this constraint.

Generic `CodecMeta`, `CodecDescriptor.meta`, `CodecDescriptor.metaFor`, and `CodecLookup.metaFor` are removed after migration. PostgreSQL's current `meta.db.sql.postgres.nativeType` use is replaced by the descriptor's typed native-type method. No compatibility metadata layer remains.

### Validated registries behind generic control-stack storage

User-facing PostgreSQL and SQLite authoring APIs accept only their target descriptor subtype. Generic component/control-stack storage may erase those values to `AnyCodecDescriptor`, because propagating the subtype through every unrelated generic would add complexity without improving user safety.

At target adapter construction, the target validates each contributed descriptor's structural discriminant and required methods once, then builds a typed target registry. Malformed JavaScript or manually assembled components fail during adapter composition. Query rendering reads only from the typed registry, with no query-time narrowing, no bare casts, and no repeated validation.

This is deliberately not a central map from target ID to projection strategy. A custom database target defines its own descriptor specialization, adaptation factory, registry, and rendering semantics without modifying framework-owned unions.

### Planner-owned output codec identity

`ProjectionItem.codec` changes meaning from “codec for a direct column” to “codec of this projected value whenever known.” It therefore applies to direct columns, aggregates, and computed expressions.

When an ORM value enters a JSON envelope, planning chooses:

```ts
item.codec
  ? new CodecJsonValueProjection(item.expr, item.codec)
  : new NativeJsonValueProjection(item.expr)
```

Expressions already representing JSON envelopes use `JsonDocumentProjection`. Every wrapper and rewrite, including row-number deduplication, preserves `ProjectionItem.codec`.

Adapters never recursively inspect derived tables to rediscover a source column's codec. The preserved prototype's lineage resolver and hardcoded `PG_NUMERIC_CODEC_ID` are retained only as evidence of the bug and are not part of the selected target-projection implementation.

### PostgreSQL scalar-array lifting

`CodecRef.many` means a SQL scalar-array value whose elements use the referenced scalar codec. Projecting the whole array through a scalar transform is generally invalid: for example, `numeric[]::text` produces PostgreSQL array-literal text, not a JSON array of decimal strings.

`PostgresCodecDescriptor` therefore supplies a default `jsonArrayProjection` that binds the input expression once, unnests it with ordinality, applies the scalar projection per element, aggregates in ordinal order, and explicitly preserves these semantics:

- SQL null array becomes JSON null.
- Empty array becomes an empty JSON array.
- Null elements remain null elements.
- Element order is preserved.
- A volatile input expression or subquery is evaluated once.

The relational AST may grow the nodes needed to express this compositionally. A descriptor may override the default with a more efficient target expression, such as a compatible array cast, but every override runs against the same shared conformance cases as the reference lift.

SQLite currently has no built-in scalar-array storage codec, so its descriptor protocol does not imitate PostgreSQL array machinery speculatively. SQLite still needs element projection for `JsonArrayAggExpr` over rows.

### SQLite document and scalar behavior

SQLite requires its own target projections rather than inheriting an SQL-wide identity rule:

- `json_object` rejects BLOB values, so BLOB uses `hex(expression)`.
- Arbitrary-size integers must become text before entering JSON or JavaScript parsing rounds them.
- JSON stored as text must use `json(expression)` to embed as a document instead of a quoted string.
- SQLite loses its transient JSON subtype across derived tables, so `JsonDocumentProjection` retags at the outer boundary.
- NaN is observed as null and cannot satisfy a lossless generic float contract.

PostgreSQL can render `JsonDocumentProjection` as the underlying expression because JSON/JSONB typing survives derived tables; SQLite renders `json(expression)`. This target difference is exactly why document semantics live in the target-neutral AST but SQL spelling lives in target adapters.

### Aggregate descriptors and emitted aggregate types

Aggregate result typing is operation-specific and target-specific, so it is separate from codec descriptors. Targets and extensions contribute `SqlAggregateDescriptor`s through the component system.

Runtime resolution is conceptually:

```text
(aggregate name, optional input CodecRef)
  -> output CodecRef + nullability + lowered expression
```

Input matching supports no-input operations such as `count(*)`, exact codec IDs, and codec traits. Exact codec matches win over trait matches. Output codec identity is declarative: either `self` or a concrete codec ID, with a function allowed to resolve only output type parameters. Lowering functions may construct AST but may not secretly select a different output codec from the descriptor's declared result.

SQL `TypeMaps` gains `aggregateTypes`, emitted from the same descriptors. ORM aggregate availability and result types resolve against this map with the same exact-over-trait precedence used at runtime. Both scalar include reducers and top-level aggregate builders carry the resolved output `CodecRef` into `ProjectionItem` and decode through that codec.

The accepted breaking baseline includes:

- PostgreSQL `pg/int8` application values become `bigint`, with decimal-string canonical JSON.
- PostgreSQL `count(*)` resolves to `pg/int8` and therefore returns `bigint`.
- PostgreSQL `sum(int2|int4)` resolves to `pg/int8` and returns `bigint`.
- PostgreSQL `sum(int8)` and integer `avg` resolve to `pg/numeric` and return decimal strings.
- SQLite `count(*)` resolves to `sqlite/bigint` and returns `bigint`.

The complete PostgreSQL and SQLite aggregate matrices are verified against the actual databases during the aggregate slice rather than inferred from generic numeric traits.

### Conformance testkits

Compile-time constraints prove descriptor shape but not semantic equivalence. Database-backed conformance suites materialize codecs, encode parameters, build projections through the real AST and adapter, execute against the target, compare database JSON with `codec.encodeJson`, and round-trip through `codec.decodeJson`.

PostgreSQL cases also cover null arrays, empty arrays, null elements, order, single evaluation where observable, and equivalence between the default array lift and optimized overrides. Built-in suites cover every built-in and wrapped generic codec. Extension packages run the same harness in extension-owned database setup for codecs such as pgvector and PostGIS.

The public harnesses live in separate dev-only packages, `@internal/postgres-codec-testkit` and `@internal/sqlite-codec-testkit`. Production target adapters do not depend on them. Third-party targets may publish analogous testkits without joining a framework registry.

### Hard-cut and migration policy

Affected codecs keep their existing IDs. This pre-1.0 project deliberately makes a hard cut rather than adding `@2` IDs or compatibility decoders that could conceal corruption.

Consumers must regenerate contracts. Stored contract defaults or value sets encoded in PR #942's representations may require regeneration, and generated TypeScript changes for `pg/int8`, `count`, and several aggregates. Documentation and upgrade instructions are part of the final stack, not follow-up work.

## Alternatives considered

- **Accept strings and numbers in `PgNumericCodec.decodeJson`** — attractive as a local compatibility fix. **Rejected because:** the driver has already rounded a JSON number before the codec receives it; accepting the number disguises corruption.
- **Hardcode affected codec IDs in the ORM or renderer** — attractive because it fixes numeric quickly. **Rejected because:** codec sets and targets are open to extensions; target-neutral layers cannot know all lossless transformations.
- **Recover codecs by following column lineage** — attractive because existing AST columns carry codec information indirectly. **Rejected because:** derived tables and new wrappers make inference fragile; output codec identity belongs explicitly on `ProjectionItem`.
- **Put a per-target projection map on generic `CodecDescriptor`** — attractive as one universal API. **Rejected because:** the target set is open-world and framework code cannot enumerate custom databases.
- **Store executable projection hooks in `meta.db.sql.postgres`** — attractive because native type metadata already exists there. **Rejected because:** the bag is weakly typed, hides executable behavior, and forces defensive lookup instead of authoring-time guarantees.
- **Keep generic metadata only for PostgreSQL native type** — attractive as a smaller migration. **Rejected because:** the renderer is its only production consumer and `PostgresCodecDescriptor.nativeTypeFor` replaces it directly.
- **Give scalar projection an implicit native default** — attractive for lower authoring friction. **Rejected because:** native equivalence is a semantic assertion; omission must be impossible in type-safe target APIs.
- **Make the entire SQL extension descriptor target-specific** — attractive as a broad type-safety boundary. **Rejected because:** only the codec descriptor array depends on target projection behavior; `contractSpace`, operations, and hooks should remain generic.
- **Thread target descriptor subtypes through the whole `ControlStack`** — attractive for end-to-end nominal typing. **Rejected because:** validated internal erasure preserves user-facing safety without infecting unrelated generics; dynamic JavaScript plugins need runtime validation regardless.
- **Use `instanceof` as the only target check** — attractive because descriptors are classes. **Rejected because:** extension packages may load duplicate module instances; a structural discriminant survives package boundaries.
- **Use plain-object JSON projection unions** — attractive because current object entries are records. **Rejected because:** this AST already relies on frozen classes and visitors; object spreading destroys prototypes and exhaustiveness guarantees.
- **Use only codec/native projection variants** — attractive as the smallest union. **Rejected because:** SQLite must distinguish JSON documents from JSON text and retag documents after derived tables.
- **Use raw SQL for built-in projection composition** — attractive because every target expression is immediately expressible. **Rejected because:** the relational AST can grow typed function/cast/case/ordinality nodes; raw SQL remains only an escape hatch for exceptional extensions.
- **Project a SQL array as a whole** — attractive for concise casts. **Rejected because:** many canonical element formats, including bytea base64, require element-wise transformation, and array-literal text is not canonical JSON.
- **Put aggregate behavior on codec descriptors** — attractive because aggregates consume codecs. **Rejected because:** result type depends on the operation, target, and sometimes input; a separate overload registry models this directly.
- **Preserve broad `number` aggregate APIs** — attractive as a non-breaking surface. **Rejected because:** `int8`, large counts, and arbitrary-precision aggregates are not losslessly representable as JavaScript numbers.
- **Ship conformance helpers from production adapter packages** — attractive for discoverability. **Rejected because:** applications would carry test-only code and dependencies; separate dev-only packages preserve a clean runtime graph.
- **Version affected codecs as `@2`** — attractive for compatibility. **Rejected because:** the repository's pre-1.0 policy favors a documented hard cut and regenerated contracts over parallel semantics.

## Open questions

These questions refine implementation but do not reopen the model above. If evidence falsifies a named assumption instead, stop and return to design discussion.

- **PostgreSQL native type representation** — working position: keep a descriptor-owned trusted renderer initially; introduce a structured type AST only if schema qualification or quoting cannot be made safe and compositional within the slice.
- **Exact public descriptor and registry names** — working position: use `PostgresCodecDescriptor`, `SqliteCodecDescriptor`, `postgresCodec`, `sqliteCodec`, `definePostgresCodecs`, and `defineSqliteCodecs` unless codebase conventions force a clearer name.
- **Exact typed AST APIs** — working position: add the smallest frozen class/visitor vocabulary that supports built-in projections and the reference array lift; do not pre-generalize a complete SQL grammar.
- **PostgreSQL array single-evaluation binding** — working position: represent the source once through a compositional derived/source node; add an AST node if existing `SubqueryExpr`, `DerivedTableSource`, and `FunctionSource` cannot express it safely.
- **Canonical PostgreSQL temporal SQL** — working position: pin a session-independent UTC ISO shape that matches codec output, including precision behavior, and prove it through database conformance rather than relying on native JSON formatting.
- **Complete target aggregate matrices** — working position: enumerate and executable-probe each built-in aggregate/input pair in the aggregate slice; exact codec overloads override trait fallbacks.
- **SQLite hexadecimal casing and validation** — working position: use SQLite's uppercase `hex()` output and make the codec's canonical validation explicitly match it unless conformance exposes a portability issue.
- **SQLite scalar arrays** — working position: do not add a speculative stored-array protocol; implement only JSON aggregate element projection until a real SQLite `many` storage representation exists.
- **Public testkit API shape** — working position: keep it test-framework-independent, caller-supplied for database execution/setup, and package it separately from production adapters.
- **ADR shape** — working position, now that the aggregate slice has shipped: **two ADRs at close-out**, the aggregate one citing the projection one. The aggregate decision proved independently statable — its own contribution channel keyed on `(operation, input)` rather than `codecId`, its own precedence rule, a lowering mechanism the projection design has no analogue for, its own emitted `TypeMaps` key, and its own consumers (ORM planning and decoding, the SQL builder lane). What links them is one citation: an include reducer's result enters the JSON envelope under the codec these descriptors resolve, so the canonical-JSON guarantee is what carries it. One ADR remains the better record only if close-out finds neither decision statable without restating most of the other. Fuller rationale in the project's learnings ledger.

## Assumptions that trigger redesign if falsified

1. Target descriptor adapters can preserve the current descriptor factory's literal/generic behavior while delegating the generic contract.
2. Adapter construction can see all target and extension descriptors and validate/build a target registry once.
3. `ProjectionItem.codec` can survive every relevant rewrite without forcing codec identity onto every expression class.
4. SQL `TypeMaps.aggregateTypes` can be emitted from the same contributions used by runtime aggregate resolution.
5. The typed relational AST can express built-in scalar and array projections without target branches in target-neutral planners.
6. Existing codec IDs may change semantics under pre-1.0 policy when upgrade instructions require contract regeneration.

## Integer representation and the aggregate operation split (2026-08-04)

Settled in design discussion after slice 5 merged its aggregate hard cut. The problem: the hard cut is correct but hostile to JS developers — `count()` returns `bigint` (which `JSON.stringify` rejects and users report as "weird numbers with n"), integer `sum()` returns `bigint`, and integer `avg()` returns a decimal string. Two orthogonal mechanisms resolve this: a per-column codec choice in the contract, and a per-call operation choice at the query surface. They are unrelated concerns that meet only at descriptor resolution.

### Decisions

1. **`BigInt` keeps the lossless `bigint` codec as its default.** No second representation flip a week after the first. Classic Prisma is the prior art: `BigInt` columns have been JS `bigint` since 2.17.
2. **`BigIntNumber` is a new opt-in target-contributed type** (PostgreSQL + SQLite): 64-bit integer storage decoded as JS `number`, throwing a structured error outside ±(2^53 − 1). Strictly sounder than classic Prisma's engine-side downcast, which fails at 2^31. Names rejected: `SafeInt` (misleading — the lossless codec is the safer one against overflow), `Int54` (the safe-range width is spec-pinned — ECMAScript mandates IEEE 754 binary64 — but the figure 54 is unrecognizable where 2^53 is familiar).
3. **`BigIntNumber`'s canonical JSON is a JSON number** — the one deliberate exception to "64-bit integers travel as decimal text". Sound because double rounding is monotone and 2^53 is exactly representable: no true value outside the safe range can parse into it and slip past the post-parse guard.
4. **`UnboundedInt` is a new PostgreSQL-only target-contributed type**: unconstrained `numeric` storage, integrality-checked decode to JS `bigint`, decimal-text canonical JSON. Born as the output codec `sumBigInt` needs over `int8` inputs, promoted to a column type because genuinely unbounded integers are a real authoring need (uint256 token amounts). Its codec claims no target-type name, so it cannot compete with the canonical Numeric codec during reverse native-type resolution; introspection never infers it.
5. **The aggregate operation set becomes a target/extension contribution.** Descriptor `operation` opens to `string`; the ORM and sql-builder method surfaces derive from emitted `aggregateTypes` (call shape from row presence: `withoutInput` ⇒ zero-arg, `byCodec`/`anyInput` ⇒ field-taking); dispatch is generic and name-keyed. Method names *are* the contracted operation names — one flat namespace, nothing framework-blessed. The AST `AggregateFn` union stays closed: it is SQL's alphabet, not the operation namespace; novel operations lower through slice-1 function nodes.
6. **Defaults policy: bare operations favour JS-native `number`, throwing where silence would lose precision; suffixed variants are lossless.** `count`/`countBigInt`, `sum`/`sumBigInt`, `avg`/`avgDecimal`; `min`/`max` output `self` and need no split. Bare operations over Float and Decimal columns stay in the column's own family — those users already chose their representation. Classic Prisma prior art: `count` is `number`, integer `_avg` is a float, while columns stay honest.
7. **`sumBigInt` over `int8` decodes the database's `numeric` result to an unbounded `bigint`** (integrality-checked, via `pg/unboundedint@1`) rather than casting to `int8`. On PostgreSQL it therefore never overflows; on SQLite the database's own `SUM` raises past 2^63 — the target's declared bound. Naming the codec in the descriptor row makes the decode approach a contract fact no implementer can silently substitute.
8. **`avg` lowers by casting the result** (`avg(x)::float8`), not the input: the exact numeric mean is computed first and rounded once.
9. **Three slices:** 06 (codecs/types) ∥ 07 (behaviour-preserving de-hardcoding) → 08 (the breaking operation split with upgrade instructions). 06 and 07 stack on the slice-5 branch; separating 07 from 08 keeps the pure refactor and the behaviour change in different reviews.

### Alternatives rejected

- **`sumDecimal`.** Proposed, then dropped: with `sumBigInt` unbounded on PostgreSQL and bare `sum` staying in-family over Decimal columns, it has no non-redundant domain — and SQLite could not contribute it anyway. This rejection is contingent on decision 7; an `int8`-cast `sumBigInt` would resurrect the need.
- **Field-preset authoring for `BigIntNumber` and `UnboundedInt`.** These names select storage plus application representation and carry no field-template semantics. Modeling them as presets would impose preset-only optional/default/list restrictions and retain machinery the Prisma 8 roadmap already plans to retire; target-contributed type constructors express the actual concept and share one registry across PSL and TS.
- **Decimal-text canonical JSON for `BigIntNumber`** (uniformity with `pg/int8@1`). Number-ness is the codec's entire purpose, and the guard makes JSON-number safe here.
- **Opening the AST `AggregateFn` union to `string`.** Unnecessary — lowering hooks and the slice-1 function nodes cover contributed operations; the closed union keeps renderers exhaustive.
- **Framework-blessed method names with contributed semantics only.** Rejected for full contribution: portability across targets rests on targets agreeing on names, the same social contract codecs already use.

### Assumptions

- `pg/numeric@1` keeps decoding to a string (no Decimal application type). If a Decimal class ever lands, `avgDecimal` and Decimal-column `sum` return types change with it.
- Type-constructor availability remains target-scoped because authoring contributions are assembled only from the active family, target, adapter, and extensions; adding `BigIntNumber` to PostgreSQL and SQLite does not expose it on other targets.
- Reverse introspection remains independent from authored type constructors: the new codecs keep `targetTypes: []`, PostgreSQL continues to infer `int8` as `BigInt` and `numeric` as `Numeric`, and SQLite retains its canonical integer mapping.
- The safe-range guard's soundness rests on ECMAScript-mandated binary64 — spec-pinned, not VM-dependent.
- Slice 8's operation names assume slice 7's flat namespace ships as designed; a partial de-hardcoding would force per-surface special cases back in.

## References

- Project spec: [`./spec.md`](./spec.md)
- Project plan: [`./plan.md`](./plan.md)
- Full discussion checkpoint and executable evidence: [`assets/codec-json-projection-design-checkpoint.md`](./assets/codec-json-projection-design-checkpoint.md)
- Regression source: [PR #942](https://github.com/prisma/prisma-next/pull/942), merge commit `bd2bcd1914`
- Linear project: [Codec JSON projections](https://linear.app/prisma-company/project/codec-json-projections-a10fba2e9cd5)
- Planning issue: [TML-3060](https://linear.app/prisma-company/issue/TML-3060/plan-codec-json-projections)
