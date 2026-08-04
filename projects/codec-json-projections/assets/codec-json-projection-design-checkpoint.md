# Codec JSON projection design — discussion checkpoint

## Status

This document is the complete working record of the design discussion triggered by the PostgreSQL numeric precision regression introduced by PR [#942](https://github.com/prisma/prisma-next/pull/942), merge commit `bd2bcd1914`. It is intentionally a working design checkpoint under `wip/`, not yet a settled project spec or ADR.

Discussion mode was explicitly exited so this record could be written before context compaction. Future discussion should treat this file as the source of truth and amend it when decisions change.

The work has outgrown the original direct codec fix. It is now project-shaped: it changes codec semantics, target-specific descriptor APIs, SQL AST representation, ORM JSON planning, aggregate typing, extension authoring, test infrastructure, documentation, and upgrade behavior.

## Refined problem

`Codec.encodeJson` and `Codec.decodeJson` must define a codec-chosen, canonical, lossless JSON representation of the application value. They must not be constrained to imitate whatever scalar shape a database happens to emit inside its native JSON constructor.

PR #942 changed that contract so SQL codecs matched database-native JSON values. That assumption is false for values whose native database JSON representation is lossy or differs from the codec’s desired application-oriented representation.

The concrete PostgreSQL failure is arbitrary-precision `numeric`:

- PostgreSQL stores `1234567890.12345678901234567890` exactly.
- `json_build_object` emits it as a JSON number.
- The PostgreSQL driver parses that JSON number into JavaScript `1234567890.1234567` before `PgNumericCodec.decodeJson` runs.
- `9007199254740993` similarly becomes `9007199254740992`.
- Accepting both strings and numbers in `decodeJson` would only convert already-rounded numbers into strings and disguise data corruption.

The ORM therefore needs database expressions to be transformed before they enter database-produced JSON. The transformation is codec-specific and target-specific, but the ORM must not hardcode codec IDs or target behavior.

## Evidence gathered

### PostgreSQL numeric integration evidence

The current working branch added real PostgreSQL integration coverage showing that raw `json_build_object` produces JavaScript numbers after driver parsing:

| Stored PostgreSQL value | Driver-visible JSON value | Runtime type |
|---|---:|---|
| `1234567890.12345678901234567890` | `1234567890.1234567` | `number` |
| `9007199254740993` | `9007199254740992` | `number` |

The current prototype makes `PgNumericCodec.decodeJson` string-only and adds `::text` in the PostgreSQL renderer. That proves the root cause, but the implementation hardcodes `PG_NUMERIC_CODEC_ID` and reconstructs codec identity through derived-table lineage. Those are explicitly rejected as the final architecture.

### SQLite executable probes

The following behaviors were verified with Node’s `node:sqlite` against an in-memory SQLite database:

```text
blob-native ERROR JSON cannot hold BLOB values
blob-hex {"raw":"{\"v\":\"00FF10\"}","parsed":{"v":"00FF10"}}
json-text {"raw":"{\"v\":\"{\\\"a\\\":1}\"}","parsed":{"v":"{\"a\":1}"}}
json-tagged {"raw":"{\"v\":{\"a\":1}}","parsed":{"v":{"a":1}}}
unsafe-bigint {"raw":"{\"v\":9007199254740993}","parsed":{"v":9007199254740992}}
unsafe-bigint-text {"raw":"{\"v\":\"9007199254740993\"}","parsed":{"v":"9007199254740993"}}
infinity {"raw":"{\"v\":9.0e+999}","parsed runtime type":"number"}
nan {"raw":"{\"v\":null}","parsed":{"v":null}}
```

SQLite also strips its internal JSON subtype across a derived table:

```text
direct nested json_object  → {"branch":{"value":1}}
through derived table      → {"branch":"{\"value\":1}"}
retagged with json(expr)    → {"branch":{"value":1}}
```

These probes confirm that SQLite needs target-specific JSON projection behavior too:

- BLOB values cannot enter `json_object` directly.
- JSON stored as text must be wrapped with `json(expression)` to embed as a document instead of a quoted string.
- Arbitrary-size integers must be projected as text.
- SQLite’s JSON behavior for non-finite reals is incompatible with lossless canonical JSON.
- Derived JSON documents need explicit retagging at the outer JSON boundary.

### PR #942 codec changes

PR #942 changed the following codec JSON formats to match database-native JSON:

- `pg/numeric`: decimal string → JSON number.
- `pg/bytea`: base64 → PostgreSQL `\x…` text.
- `pg/timestamp` and `pg/timestamptz`: canonical UTC ISO strings → PostgreSQL-native JSON timestamp formatting.
- `pg/vector`: numeric JSON array → PostgreSQL vector text.
- PostGIS geometry: GeoJSON object → HEXEWKB string.
- `sqlite/bigint`: decimal string → safe JSON number.
- Documentation: arbitrary stable codec JSON → exact database-native JSON scalar shape.

The project will restore the pre-942 application-oriented representations, except for one deliberate new decision: SQLite BLOB will use canonical hexadecimal text rather than base64 because SQLite provides a built-in `hex(expression)` function but no built-in base64 function.

## Settled decisions

### 1. Codec JSON is canonical and codec-defined

`encodeJson` and `decodeJson` define an arbitrary, canonical, lossless JSON representation chosen by the codec. The representation is used for contract serialization and for values crossing database-produced JSON boundaries.

The documentation must no longer say that codec JSON matches the database’s native JSON format.

The intended invariant is:

```text
codec.encodeJson(applicationValue)
  ===
JSON value produced by projecting the corresponding stored database expression
```

The database projection mechanism is responsible for making the database emit the codec’s expected JSON format.

### 2. Projection behavior is target-specific, not ORM-specific or generic-codec-specific

Executable JSON projection behavior does not belong in the target-independent ORM or generic `CodecDescriptor`.

Each target that needs database-produced JSON defines its own descriptor specialization and projection protocol:

- PostgreSQL: `PostgresCodecDescriptor`.
- SQLite: `SqliteCodecDescriptor`.
- A user-defined custom target may define its own descriptor specialization and projection semantics without being added to any framework-owned target map.

Only target-neutral JSON-boundary semantics belong in the SQL AST.

### 3. PostgreSQL descriptor contract

`PostgresCodecDescriptor<P>` will extend the ordinary codec descriptor implementation and add PostgreSQL-specific behavior.

The descriptor has a stable structural discriminant, not an `instanceof`-only identity check, so separately loaded extension packages do not fail due to duplicated module/class identity.

Conceptually:

```ts
abstract class PostgresCodecDescriptor<P> extends CodecDescriptorImpl<P> {
  readonly descriptorKind = 'postgres-codec' as const;

  protected abstract nativeType(params: P): string;

  protected abstract jsonProjection(
    expression: ProjectionExpr,
    params: P,
  ): ProjectionExpr;

  protected jsonArrayProjection(
    expression: ProjectionExpr,
    params: P,
  ): ProjectionExpr {
    return liftArrayProjection(expression, (element) =>
      this.jsonProjection(element, params),
    );
  }

  nativeTypeFor(ref: CodecRef): string {
    const params = this.validateParams(ref.typeParams);
    return this.nativeType(params);
  }

  projectJson(expression: ProjectionExpr, ref: CodecRef): ProjectionExpr {
    const params = this.validateParams(ref.typeParams);
    return ref.many
      ? this.jsonArrayProjection(expression, params)
      : this.jsonProjection(expression, params);
  }
}
```

The exact names remain open, but the template-method boundary is settled:

- Subclasses implement strongly typed hooks using `P`.
- The adapter calls only public, erased methods accepting `CodecRef`.
- The descriptor validates `typeParams` itself.
- The adapter does not cast erased JSON parameters into `P`.

Scalar `jsonProjection` is abstract and mandatory. There is no implicit native/identity default because native compatibility is a semantic claim that must be made explicitly.

`jsonArrayProjection` has a concrete default implementation and may be overridden for a more efficient equivalent projection.

### 4. Generic SQL codecs are adapted into target descriptors

Generic SQL-family descriptors cannot depend on PostgreSQL. They are adapted at the PostgreSQL target boundary through a factory:

```ts
postgresCodec(sqlIntDescriptor, {
  nativeType: () => 'integer',
  jsonProjection: nativeJsonProjection,
  // optional jsonArrayProjection override
});
```

The factory returns a real `PostgresCodecDescriptorAdapter` instance that:

- Extends `PostgresCodecDescriptor`.
- Delegates the ordinary `CodecDescriptor` contract to the wrapped generic descriptor.
- Requires an explicit PostgreSQL native-type resolver.
- Requires an explicit scalar JSON projection.
- Inherits the default array projection unless an override is supplied.

There is no universal identity projection for wrapped generic SQL codecs. For example, `sql/timestamp` may require PostgreSQL-specific formatting to match its canonical ISO codec JSON.

SQLite will have the analogous `sqliteCodec(baseDescriptor, configuration)` factory for generic SQL codecs used by SQLite.

### 5. Narrow codec-array authoring helpers

Target-specific authoring helpers validate only codec descriptor arrays; they do not wrap the whole extension descriptor:

```ts
const codecs = definePostgresCodecs([
  postgresCodec(sqlIntDescriptor, {
    nativeType: () => 'integer',
    jsonProjection: nativeJsonProjection,
  }),
  myPostgresDescriptor,
]);
```

`definePostgresCodecs` is an identity-style helper that preserves tuple and concrete descriptor types while requiring every entry to be a `PostgresCodecDescriptor`.

`defineSqliteCodecs` is the analogous helper.

`SqlControlExtensionDescriptor` remains generic because almost none of its shape depends on codec descriptors. `contractSpace`, query operations, and control-plane hooks may reference codec IDs, but they do not require a target descriptor subtype. Requiring every PostgreSQL extension to use a whole-extension factory would be overreach.

### 6. Internal type erasure is acceptable behind validated boundaries

The target-specific descriptor subtype does not need to be threaded through every generic `ControlStack` type.

The intended flow is:

1. User-facing PostgreSQL APIs accept only `PostgresCodecDescriptor`s.
2. Generic component metadata erases them internally to ordinary codec descriptors.
3. PostgreSQL adapter construction performs one structural discriminant/method validation.
4. Adapter construction builds a typed `PostgresCodecDescriptorRegistry`.
5. Query rendering uses that typed registry with no casts and no repeated runtime checks.
6. A malformed or untyped JavaScript component fails during adapter composition, never when executing an individual query.

The generic descriptor registry may become generic over descriptor subtype, but the subtype does not need to infect the entire control stack.

### 7. Remove generic codec metadata

`meta.db.sql.postgres.nativeType` will be hard-cut.

Current production use is limited to PostgreSQL parameter rendering in `renderTypedParam`, where it determines:

- Casts for non-inferrable scalar parameter types such as JSON, JSONB, vectors, enums, and custom extension types.
- Casts for all array parameters.
- Parameterized native enum type names.

`PostgresCodecDescriptor.nativeTypeFor(ref)` replaces that lookup directly.

After the migration, no production source needs `CodecMeta`, `CodecDescriptor.meta`, `CodecDescriptor.metaFor`, or `CodecLookup.metaFor`. Those generic metadata APIs will be removed entirely, not retained as a compatibility layer.

### 8. Target-neutral JSON value projection AST

The codec/native distinction must apply to every scalar crossing a database-produced JSON boundary, not only object properties. `JsonArrayAggExpr` can aggregate scalar expressions directly and needs the same projection semantics as `JsonObjectExpr`.

The SQL AST will therefore gain a reusable frozen class union conceptually shaped as:

```ts
abstract class JsonValueProjection {
  abstract readonly kind: string;

  protected constructor(readonly value: ProjectionExpr) {}

  abstract accept<R>(visitor: JsonValueProjectionVisitor<R>): R;
}

export class CodecJsonValueProjection extends JsonValueProjection {
  readonly kind = 'codec' as const;

  constructor(value: ProjectionExpr, readonly codec: CodecRef) {
    super(value);
    // defensively freeze codec and node
  }
}

export class NativeJsonValueProjection extends JsonValueProjection {
  readonly kind = 'native' as const;
}

export class JsonDocumentProjection extends JsonValueProjection {
  readonly kind = 'document' as const;
}

export type AnyJsonValueProjection =
  | CodecJsonValueProjection
  | NativeJsonValueProjection
  | JsonDocumentProjection;
```

Semantics:

- `CodecJsonValueProjection`: transform the stored expression through the target codec descriptor’s JSON projection.
- `NativeJsonValueProjection`: let the database JSON constructor perform its normal scalar conversion.
- `JsonDocumentProjection`: the expression already represents a JSON document and must embed as JSON rather than as a quoted string.

`JsonDocumentProjection` is not a raw JavaScript `JsonValue` variant; it still wraps a `ProjectionExpr`.

Target behavior for JSON documents:

- PostgreSQL: render the document expression unchanged because JSON/JSONB SQL typing survives derived tables.
- SQLite: wrap with `json(expression)` because SQLite strips its transient JSON subtype across derived tables.

`JsonObjectExpr` entries contain a key plus `AnyJsonValueProjection`.

`JsonArrayAggExpr` contains `AnyJsonValueProjection` as its element.

There are three variants and multiple dispatch sites, so the repository’s frozen-class/visitor pattern applies. Renderers and rewrite paths use `JsonValueProjectionVisitor`; adding a future variant becomes a compiler error at every consumer.

All constructors and rewrites preserve class identity. No `{ ...node }` shallow-copying is allowed because it strips prototypes, `accept()`, and constructor invariants.

### 9. Projection metadata belongs on `ProjectionItem`

`ProjectionItem.codec` expands from “column-bound decode metadata” to “the codec of this projected value.” It applies to direct columns, aggregates, and computed expressions whenever the output codec is known.

The ORM converts projected values into JSON projections as follows:

```ts
item.codec
  ? new CodecJsonValueProjection(value, item.codec)
  : new NativeJsonValueProjection(value)
```

Expressions that already produce JSON envelopes use `JsonDocumentProjection` instead.

Projection wrappers must preserve codec metadata. The current `wrapWithRowNumberDedup` implementation drops `ProjectionItem.codec`; that must be fixed.

The adapter must never reconstruct codec identity by walking table/column lineage. The recursive lineage resolver in the current uncommitted prototype is evidence of the wrong boundary and will be removed.

### 10. Add missing typed SQL AST vocabulary

The relational AST may be expanded as needed rather than making built-in projection infrastructure depend on raw SQL.

The likely additions are:

- `FunctionCallExpr` for functions such as PostgreSQL `encode`, SQLite `hex`, SQLite `json`, and PostgreSQL JSON conversion helpers.
- `CastExpr`.
- `CaseExpr`.
- `FunctionSource` support for returned column aliases and `WITH ORDINALITY`.

Existing `SubqueryExpr`, `DerivedTableSource`, and `JsonArrayAggExpr` can compose the default PostgreSQL array lift.

Raw SQL remains an extension escape hatch for projections that genuinely cannot be represented by typed AST nodes. It is not the default implementation mechanism for built-in codecs.

### 11. PostgreSQL array projection semantics

`CodecRef.many` represents an array/list of scalar codec values. Applying a scalar projection to the whole SQL array is generally wrong. For example, `numeric_array::text` produces a PostgreSQL array literal, not the canonical JSON array `['1.2', '3.4']` represented as JSON strings.

The default PostgreSQL `jsonArrayProjection` lifts the scalar projection over SQL array elements. Conceptually:

```sql
CASE WHEN input_array IS NULL THEN NULL
ELSE (
  SELECT coalesce(
    json_agg(projected_element ORDER BY ord),
    json_build_array()
  )
  FROM unnest(input_array) WITH ORDINALITY AS u(element, ord)
)
END
```

The real implementation must bind the input expression once so a volatile expression or subquery is not evaluated multiple times.

Reference semantics are settled:

- Null SQL array remains JSON null.
- Empty SQL array becomes an empty JSON array.
- Null elements remain null elements.
- Element order is preserved explicitly through ordinality.

Optimized overrides must be observationally equivalent to this default and pass the same conformance suite.

Examples:

- Numeric arrays may optimize to a text-array cast followed by JSON conversion.
- Bytea arrays likely use the generic element-wise base64 projection.

SQLite currently has no built-in scalar-array storage codec, so its descriptor protocol need not copy PostgreSQL array machinery until SQLite gains a meaningful `many` representation. `JsonArrayAggExpr` element projection remains necessary independently for row/value aggregation.

### 12. Separate aggregate descriptor system

Aggregate result typing is target-specific and operation-specific. It does not belong on codec descriptors.

The project introduces a separate `SqlAggregateDescriptor` registry contributed by targets and extensions through the existing component system, analogous to `queryOperations()` but separate from it.

Runtime resolution key:

```text
(target aggregate name, optional input CodecRef) → output CodecRef + nullability + lowered expression
```

Conceptual input matching:

```ts
type AggregateInputSpec =
  | { readonly kind: 'none' } // count(*)
  | { readonly kind: 'codec'; readonly codecId: string }
  | { readonly kind: 'traits'; readonly traits: readonly CodecTrait[] };
```

Resolution precedence is settled:

1. Exact codec-ID overload.
2. Trait overload.
3. Unsupported when no descriptor matches.

This supports generic `min`/`max → self` for ordered codecs while keeping `sum` and `avg` target-accurate.

Output codec identity is declarative so runtime and emitted types cannot disagree:

```ts
type AggregateOutputSpec =
  | { readonly kind: 'self' }
  | {
      readonly kind: 'codec';
      readonly codecId: string;
      readonly resolveTypeParams?: (input: CodecRef) => JsonValue | undefined;
    };
```

Functions may compute output `typeParams` and lower AST, but they may not secretly select a different output codec ID.

Descriptors also declare nullability. `count` is non-null; `sum`, `avg`, `min`, and `max` are normally nullable on empty input.

Targets contribute built-in aggregate overloads. Extensions contribute overloads for extension codecs. Aggregate descriptors are a distinct contribution surface, not methods on `PostgresCodecDescriptor` or `SqliteCodecDescriptor`.

### 13. Aggregate types in emitted contracts

SQL `TypeMaps` gains a distinct `aggregateTypes` surface populated from the same `SqlAggregateDescriptor`s used at runtime.

The ORM replaces broad trait-only availability such as `NumericFieldNames` with aggregate-aware type resolution:

```ts
AggregateFieldNames<TContract, 'sum'>
AggregateResult<TContract, 'sum', InputCodecId>
```

Compile-time resolution mirrors runtime exact-over-trait precedence.

A field is offered to `.sum()`, `.avg()`, `.min()`, or `.max()` only if the active target/extensions provide a matching aggregate overload.

The output codec ID indexes `CodecTypes` to obtain the application result type. Descriptor nullability determines whether `null` is included.

`IncludeScalar` carries the resolved runtime output `CodecRef`. Its planner stamps that codec onto the aggregate `ProjectionItem` and `CodecJsonValueProjection`. Its decoder invokes that output codec’s `decodeJson` instead of returning the raw JSON value unchanged.

This migration applies to both scalar include reducers and the separate top-level aggregate-builder APIs; leaving either path on hardcoded `number` results would violate the project’s invariant.

### 14. Lossless integer hard cut

`PgInt8Codec` currently uses `number` for wire, application, and JSON values. This cannot represent the PostgreSQL `int8` domain losslessly.

The project changes:

- `pg/int8`: application type becomes `bigint`.
- Wire input accepts the actual driver forms needed for PostgreSQL `int8`, expected to include string/number/bigint as appropriate.
- Canonical JSON becomes a decimal string.
- PostgreSQL JSON projection produces text.
- `sqlite/bigint`: canonical JSON becomes a decimal string.
- SQLite JSON projection uses `CAST(expression AS TEXT)`.

Target-accurate aggregate mappings include:

- PostgreSQL `count(*)` → `pg/int8` → application `bigint`.
- PostgreSQL `sum(int2|int4)` → `pg/int8` → application `bigint`.
- PostgreSQL `sum(int8)` → `pg/numeric` → application decimal string.
- PostgreSQL integer `avg` → `pg/numeric` → application decimal string.
- SQLite `count(*)` → `sqlite/bigint` → application `bigint`.

The operator explicitly accepted the breaking API change: `count()` and some integer aggregates return `bigint`; arbitrary-precision numeric aggregates return strings.

The complete target aggregate matrix still needs to be enumerated and verified against each database’s actual result types.

### 15. Finite-only generic SQL floats

Generic and target float codecs currently allow `NaN` and `±Infinity` to escape through `encodeJson`, even though these are not lossless JSON values.

SQLite makes NaN unrecoverable because it collapses to SQL null in the observed binding path.

The project makes generic SQL float codecs finite-only at codec boundaries. A future target-specific codec may deliberately support non-finite values if its storage, canonical JSON format, and projection can preserve them losslessly.

This finite-only restriction was accepted as a fair trade-off.

### 16. Canonical codec formats after the migration

The canonical baseline restores pre-942 formats unless explicitly noted:

| Codec/type | Canonical JSON | Target projection direction |
|---|---|---|
| PostgreSQL numeric/decimal | Decimal string | Text projection before JSON construction |
| PostgreSQL int8 | Decimal string | Text projection |
| PostgreSQL bytea | Base64 string | PostgreSQL `encode(expression, 'base64')` |
| PostgreSQL timestamp/timestamptz | Canonical UTC ISO string | Explicit target formatting independent of native JSON/session formatting |
| pgvector vector | JSON numeric array | Extension-provided PostgreSQL AST projection |
| PostGIS geometry | GeoJSON document | Extension-provided `ST_AsGeoJSON`-style document projection |
| PostgreSQL JSON/JSONB | Structured JSON | Identity/document-aware projection |
| SQLite bigint | Decimal string | `CAST(expression AS TEXT)` |
| SQLite BLOB | Uppercase or otherwise explicitly pinned hexadecimal string | SQLite `hex(expression)`; exact casing pinned by conformance |
| SQLite JSON stored as text | Structured JSON | SQLite `json(expression)` |
| SQLite datetime | Canonical ISO string | Identity if stored canonical ISO; conformance decides |
| Finite SQL floats | JSON number | Native projection when conformance proves equivalence |

The exact formatting SQL for PostgreSQL temporal values remains an implementation design item. It must reproduce codec canonical ISO output and not depend on session timezone.

### 17. Conformance testing

TypeScript can prove that a projection hook exists; it cannot prove that the hook’s database output matches `encodeJson`/`decodeJson`.

Each target therefore gets a database-backed conformance harness.

The harness verifies representative application values by:

1. Materializing the codec.
2. Encoding database parameters through `codec.encode`.
3. Building codec-backed scalar and array JSON projections through the real AST and adapter.
4. Executing against the target database.
5. Comparing the produced JSON value with `codec.encodeJson(applicationValue)`.
6. Passing that value through `codec.decodeJson` and checking the application round trip.
7. Exercising null, empty-array, null-element, and order semantics where relevant.
8. Running optimized array overrides against the same reference cases as the default lift.

Built-in target suites cover all built-in and wrapped generic codecs.

Extension packages run the same harness inside their own database setup so PostGIS, pgvector, and other extension installation remains owned by those packages.

The conformance harness is a supported public extension-author API, but it must not ship in production adapter dependencies.

Separate dev-only packages are settled:

- `@internal/postgres-codec-testkit`
- `@internal/sqlite-codec-testkit`

They are test-framework-independent and installed as development dependencies. A third-party target may publish its own testkit without being added to a central framework package or target map.

Exact testkit function names and case shapes remain open.

### 18. Codec IDs and upgrade behavior

Affected codecs keep their existing codec IDs, including `@1` suffixes.

The repository is pre-1.0 and intentionally makes frequent breaking changes. The project will not introduce parallel `@2` codecs or backwards-compatibility shims.

This is a documented hard cut:

- Existing generated contracts must be regenerated.
- Stored contract defaults/value sets encoded in PR #942’s representations may no longer decode under the restored canonical formats.
- Generated TypeScript types change for `pg/int8`, `count`, and several aggregates.
- Upgrade instructions are mandatory.
- Documentation and examples must be updated with the new codec JSON/projection contract.

## Rejected alternatives

### Accept both strings and numbers in `PgNumericCodec.decodeJson`

Rejected because numbers are already rounded before the codec sees them. Accepting them would conceal corruption rather than preserve data.

### Convert rounded numbers back to strings

Rejected for the same reason: precision cannot be reconstructed after JavaScript number parsing.

### Hardcode numeric, money, bytea, or other codec IDs in the ORM or adapter renderer

Rejected because codec sets are open to extensions and custom targets. The ORM must carry opaque `CodecRef` values; target descriptors own executable projection behavior.

### Infer codecs by recursively following column lineage in the adapter

Rejected because every new derived-table/projection wrapper can silently break inference. Codec metadata must be propagated explicitly through `ProjectionItem` and JSON projection nodes.

### Put per-target projection strategies into a map on generic `CodecDescriptor`

Rejected because targets are open-world. The framework does not know every target, and custom targets must not require changes to a central union/map.

### Put executable projection functions in `meta.db.sql.postgres`

Rejected because the metadata bag is untyped, hides executable behavior, weakens extension authoring checks, and forces defensive navigation in the renderer.

### Keep `meta` only for native types

Rejected after verifying that PostgreSQL parameter rendering is the sole production consumer. `PostgresCodecDescriptor.nativeTypeFor` is a direct typed replacement, so generic metadata will be removed.

### Give `jsonProjection` an implicit native/identity default

Rejected because identity compatibility is a semantic claim. A new extension codec could silently lose information if the author forgot to declare projection behavior.

### Make the whole PostgreSQL extension descriptor target-specific

Rejected as overreach. Only codec descriptor arrays require target-specific typing; most extension fields are unrelated to codec implementation classes.

### Thread the target descriptor subtype through the entire generic control stack

Not selected. User-facing APIs remain type-safe, type erasure is hidden internally, and adapter construction performs a single validated narrowing. Dynamic plugins require runtime validation regardless.

### Rely only on `instanceof` for internal narrowing

Rejected because external extension packages may load a separate copy of the target package. A stable structural discriminant is used instead.

### Restrict projection metadata to JSON object entries

Rejected because direct scalar `JsonArrayAggExpr` values cross the same database-produced JSON boundary.

### Use only codec/native JSON variants

Rejected because SQLite distinguishes native scalars from JSON documents and strips JSON subtype information across derived tables. `JsonDocumentProjection` is required.

### Use plain-object discriminated unions for AST nodes

Rejected in favor of the repository’s frozen class/visitor pattern. Plain-object copying strips prototypes and bypasses constructor invariants.

### Make built-in projection infrastructure use raw SQL by default

Rejected. Missing relational AST vocabulary may be added. Raw SQL remains an extension escape hatch.

### Ship public conformance helpers inside production adapter packages

Rejected because applications would install testing code and dependencies. Separate dev-only target testkit packages are used instead.

### Preserve current `number` aggregate APIs

Rejected because `int8`, large counts, and arbitrary-precision aggregate results cannot be represented losslessly as JavaScript numbers.

### Version affected codecs to `@2`

Rejected for this pre-1.0 repository. Keep IDs, make a hard cut, regenerate contracts, and publish upgrade instructions.

## Assumptions

These decisions currently rely on the following assumptions. If any proves false, re-enter discussion mode rather than silently changing the design.

1. A target descriptor specialization can extend/delegate the current codec descriptor contract without breaking required literal/generic preservation.
2. Generic SQL descriptors can be wrapped through `postgresCodec`/`sqliteCodec` while preserving their codec factories and type extraction.
3. Target adapter construction has access to every contributed codec descriptor and can build a typed target registry once.
4. A structural discriminant plus method validation is sufficient for internal narrowing across extension package boundaries.
5. `ProjectionItem.codec` can be propagated through query-plan rewrites without forcing codec identity onto every expression class.
6. Aggregate descriptor type information can be emitted into SQL `TypeMaps` from the same target/extension contributions used at runtime.
7. The relational AST can be extended with the required function, cast, case, and function-source vocabulary without introducing target branching into target-neutral planners.
8. PostgreSQL’s default scalar-array projection can be expressed compositionally and can bind the source expression once.
9. Target codec testkits can exercise real adapter projection paths through a caller-supplied database execution surface without depending on a particular test framework.
10. Existing codec IDs may change semantics under the repository’s pre-1.0 hard-cut policy as long as upgrade instructions require regeneration.

## Open questions and implementation-design items

These remain unresolved and should be handled in continued discussion or project specification:

1. Exact public names and package exports for `PostgresCodecDescriptor`, `SqliteCodecDescriptor`, wrapping factories, codec-array helpers, and typed target registries.
2. Exact structural discriminant shape and validation helper.
3. Whether native type resolution returns a trusted SQL string or a structured PostgreSQL type AST, including quoting/schema-qualified custom types.
4. Exact relational AST node APIs for function calls, casts, cases, function-source column aliases, and ordinality.
5. Exact default PostgreSQL array-lift AST and single-evaluation binding shape.
6. Complete PostgreSQL aggregate overload matrix, verified against actual database result types.
7. Complete SQLite aggregate overload matrix, including overflow and dynamic type behavior.
8. Type-level encoding of exact-over-trait aggregate resolution in `aggregateTypes`.
9. Runtime shape and contribution API of `SqlAggregateDescriptor` and its registry.
10. Exact `IncludeScalar`/aggregate-builder migration and how output `CodecRef` is persisted through state.
11. Full codec audit beyond PR #942’s affected set, especially temporal, interval, bit strings, JSON/JSONB, enums, and finite floating-point behavior.
12. Exact PostgreSQL temporal projection that reproduces canonical codec ISO strings independent of session timezone and database precision.
13. pgvector projection from database vector storage to canonical numeric JSON array.
14. PostGIS projection from geometry storage to canonical GeoJSON document.
15. Exact SQLite hexadecimal casing and strict validation rules.
16. Whether SQLite needs any scalar-array support now or only the general JSON aggregate element projection.
17. Public testkit API shape and package placement in the repository.
18. Project slice decomposition, ordering, and branch strategy.
19. Required documentation, examples, generated fixtures, and upgrade-instruction changes.
20. Whether a dedicated ADR is warranted for target-specific codec descriptors and database JSON projection semantics.

## Current branch and prototype state

Current branch:

```text
fix/postgres-numeric-json-strings
```

The branch was originally created from then-current `origin/main` at `7adfdb54b7e3ecf82b1cf4677359ff7a232ca20e`. At the latest status check it was 18 commits behind `origin/main`.

Current uncommitted files:

```text
M packages/3-targets/3-targets/postgres/src/core/codecs.ts
M packages/3-targets/3-targets/postgres/test/codecs.test.ts
M packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts
M packages/3-targets/6-adapters/postgres/test/adapter.test.ts
M test/integration/test/sql-orm-client/include-codecs.test.ts
```

Current diff size:

```text
5 files changed, 143 insertions, 19 deletions
```

The prototype contains valuable evidence and tests:

- Numeric codec JSON strings.
- Numeric precision regression cases.
- Real PostgreSQL integration values.
- Renderer proof that pre-JSON text projection fixes precision.

The prototype implementation is not the chosen architecture:

- It hardcodes `PG_NUMERIC_CODEC_ID` in the PostgreSQL renderer.
- It reconstructs codec identity by recursively following source/projection lineage.
- It does not implement target descriptor projection hooks.
- It does not cover SQLite, extension codecs, scalar arrays, aggregate result codecs, or the canonical-format restoration.

Do not commit or extend the prototype as if it were the final implementation. Preserve its tests/evidence while replacing the renderer approach under a project plan. No commit, push, or PR has been created.

## Provisional project decomposition

This decomposition is not yet approved; it is included to preserve the emerging dependency structure for later planning.

### Slice A — Target descriptor and JSON AST foundations

- Restore canonical codec JSON documentation.
- Add target-specific descriptor classes/factories/helpers and typed adapter registries.
- Remove generic `CodecMeta`/`metaFor` plumbing.
- Add `JsonValueProjection` class union and visitor.
- Add required relational AST vocabulary.
- Preserve `ProjectionItem.codec` through rewrites.

### Slice B — Target projections and codec restoration

- Restore PostgreSQL and SQLite codec JSON formats.
- Implement PostgreSQL scalar/array projection hooks.
- Implement SQLite scalar projection hooks, including BLOB hex and JSON retagging.
- Migrate generic SQL descriptors through target wrapping factories.
- Add built-in target conformance matrices.
- Make generic SQL float codecs finite-only.
- Change PostgreSQL int8 and SQLite bigint JSON/application semantics losslessly.

### Slice C — ORM JSON planning and aggregate result codecs

- Build codec/native/document JSON projection nodes in all ORM JSON paths.
- Remove adapter lineage inference and codec-ID hardcoding.
- Introduce `SqlAggregateDescriptor`, runtime registry, and target/extension contributions.
- Add emitted `aggregateTypes`.
- Migrate include reducers and top-level aggregate builders to resolved output codecs.
- Apply target-accurate breaking aggregate result types.

### Slice D — Extensions, public testkits, and upgrade surfaces

- Migrate pgvector, PostGIS, arktype-json, and other in-repo PostgreSQL extension codecs.
- Publish separate PostgreSQL and SQLite codec testkit packages.
- Run extension conformance suites in extension-owned database setup.
- Update docs, examples, fixtures, and upgrade instructions.
- Add ADR if the final project spec determines the decision warrants one.

The slice boundaries must be pressure-tested: no intermediate slice may leave main with a contradictory codec contract or broken extension registration. A different sequencing or fewer slices may be required to keep every mergeable state coherent.

## Continuation instructions

When continuing after context compaction:

1. Read this file first.
2. Re-enter discussion mode if any open design item is still load-bearing.
3. Do not treat the current uncommitted renderer prototype as the selected implementation.
4. Keep the operator’s explicit decisions intact unless new evidence falsifies an assumption.
5. Before implementation, convert this checkpoint into a formal project spec and plan, including a coherent migration sequence and Definition of Done.
