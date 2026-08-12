# Slice: Target codec descriptor foundations

_Parent project: `projects/codec-json-projections/`. This slice establishes type-safe target ownership and composition-time descriptor validation without beginning the lossless JSON behavior hard cut._

## At a glance

PostgreSQL and SQLite gain public target-specific codec descriptor classes, explicit adapters for generic SQL codecs, narrow descriptor-array helpers, and structurally validated target registries. Every built-in and affected in-repo extension adopts those foundations while current metadata, codec JSON, generated contracts, and rendered JSON SQL remain unchanged.

## Chosen design

### Public target descriptor protocols

`PostgresCodecDescriptor<P>` and `SqliteCodecDescriptor<P>` extend the ordinary codec descriptor implementation and add a stable structural discriminant plus target-owned behavior. The discriminant and required public methods are the runtime contract; adapter validation does not rely on `instanceof`, because separately loaded extension packages may carry duplicate class identities.

Both descriptors expose public template methods that accept an erased `CodecRef`, validate `typeParams` through the descriptor's existing Standard Schema, and invoke protected strongly typed hooks with `P`. No adapter or renderer casts arbitrary JSON into a descriptor's parameter type.

The PostgreSQL protocol owns:

- Trusted-string native-type resolution compatible with current cast rendering.
- A mandatory scalar AST-to-AST JSON projection hook.
- A concrete overridable scalar-array projection that binds the array expression once, unnests with ordinality, applies the scalar hook per element, and preserves null array, empty array, null elements, and element order.

The SQLite protocol owns a mandatory scalar AST-to-AST JSON projection hook. It does not introduce a stored scalar-array protocol; SQLite `CodecRef.many` storage remains out of scope until a concrete target representation exists.

The target renderers do not begin the JSON hard cut in this slice. Direct descriptor tests exercise the new projection hooks, while existing `CodecJsonValueProjection`, `NativeJsonValueProjection`, and `JsonDocumentProjection` renderer arms remain structural pass-throughs. PostgreSQL parameter casting moves from generic metadata lookup to the validated target registry's native-type method only when exact SQL parity is proven.

### Generic codec adaptation and narrow authoring helpers

Generic SQL-family descriptors remain target-independent. Each target adapts them explicitly:

```ts
postgresCodec(sqlIntDescriptor, {
  nativeType: () => 'integer',
  jsonProjection: nativeJsonProjection,
});

sqliteCodec(sqlIntDescriptor, {
  jsonProjection: nativeJsonProjection,
});
```

`postgresCodec(...)` returns a real PostgreSQL descriptor adapter and requires an explicit native-type resolver plus scalar projection. `sqliteCodec(...)` returns the analogous SQLite descriptor adapter and requires an explicit scalar projection. The PostgreSQL adapter inherits the default array lift unless an equivalent optimized override is supplied.

Adapters delegate the complete ordinary descriptor contract: codec ID and trait literals, target types, parameter schema, factory, renderers, and transitional `meta`/`metaFor`. Materialization preserves the wrapped descriptor's established factory and codec-instance behavior; target behavior is resolved through the target registry by `CodecRef`, not by requiring a materialized codec to be rebound to the adapter descriptor.

`definePostgresCodecs(...)` and `defineSqliteCodecs(...)` are identity-style tuple helpers. They preserve concrete/literal descriptor types while rejecting an unadapted generic descriptor at TypeScript authoring time. Only descriptor arrays are target-narrowed; `SqlControlExtensionDescriptor`, `ComponentMetadata`, `SqlStaticContributions`, `ControlStack`, contract spaces, operations, and hooks remain target-neutral.

### Validated registries behind generic erasure

Generic framework and SQL composition continue storing heterogeneous descriptors through their existing erased surfaces. At PostgreSQL or SQLite adapter construction, the target:

1. Collects the descriptors contributed by the target, adapter, and ordered extension packs for that construction plane.
2. Validates the target discriminant and required methods structurally once.
3. Rejects wrong-target, raw generic, malformed, or duplicate descriptors before any query is lowered.
4. Builds an immutable typed registry used by target-specific rendering without query-time casts or repeated validation.

Runtime and control construction may start from different existing contribution channels, but they must produce the same target descriptor set for the same stack. Bare `createPostgresAdapter()` and `createSqliteAdapter()` remain built-ins-only. SQLite's filtered control/emission descriptor metadata is not used as the authoritative target registry because it intentionally omits generic char/varchar descriptors.

### Built-in and extension adoption

Every PostgreSQL and SQLite built-in descriptor becomes target-specific. Generic SQL descriptors in each target's canonical descriptor arrays are explicitly adapted. Existing registry lists and emitted codec-type maps retain their current intentional differences, ordering, codec IDs, factories, literal types, and generated output.

The PostgreSQL-bound pgvector, PostGIS, and arktype-json extensions adopt `PostgresCodecDescriptor` or `postgresCodec(...)`, type their canonical arrays with `definePostgresCodecs(...)`, and add the target package as a runtime dependency through a lean public descriptor export. Their current vector-text, HEXEWKB, and structured JSON representations remain unchanged. Existing control hooks and contract-space contributions remain separate from descriptor target behavior.

### Behavior-preserving transition

`CodecMeta`, descriptor `meta`/`metaFor`, and lookup `metaFor` remain during this slice so every consumer can migrate coherently. New descriptor-native behavior must be parity-tested against existing metadata where both coexist. Generic metadata removal, renderer dispatch to scalar/document projections, canonical codec JSON changes, SQLite retagging, and PostgreSQL array execution all belong to TML-3063.

Current JSON and SQL assertions are compatibility gates, including PostgreSQL numeric/int8 numbers, bytea PostgreSQL text, pgvector strings, PostGIS HEXEWKB, SQLite BLOB base64, SQLite bigint safe JSON numbers, SQLite structured JSON, and byte-identical JSON object/array SQL.

## Coherence rationale

This is one reviewable authoring-and-composition migration: target descriptor protocols are only trustworthy once all first-party descriptors and extensions satisfy them and both adapter construction planes validate the complete set. Splitting the public protocols from adoption would either ship unused APIs or leave the registries permissive; changing codec JSON or ORM projection behavior at the same time would obscure the architecture under the later hard cut.

## Scope

**In:** PostgreSQL and SQLite target descriptor base classes; stable structural discriminants and validators; typed parameter-validation template methods; PostgreSQL native-type, scalar projection, and default array projection hooks; SQLite scalar projection hooks; generic codec adapter factories; narrow descriptor-array helpers; typed target registries; built-in descriptor migration; runtime/control adapter composition-time validation; PostgreSQL parameter-cast parity through the typed registry; pgvector/PostGIS/arktype-json descriptor migration and dependencies; target-authoring docs and extension-author upgrade instructions; no-drift regression coverage and final package/workspace gates.

**Out:** Canonical `encodeJson`/`decodeJson` changes; PostgreSQL numeric/int8 text projection, bytea base64 projection, temporal formatting, pgvector arrays, or PostGIS GeoJSON; SQLite BLOB hex, bigint text, finite-real enforcement, or JSON document retagging; ORM selection of codec/native/document projections; invoking descriptor JSON hooks from existing renderers; generic metadata removal; codec-ID branches or lineage inference; aggregate descriptors/types/decoding; scalar-array storage semantics for SQLite; public conformance testkits; new codec IDs; generated contract/fixture changes beyond proving zero drift; the preserved prototype implementation.

## Contract impact

No emitted contract entity, codec ID, `CodecTypes` result, contract JSON, or generated declaration changes in this slice. Target descriptor types are public framework/extension-author SPI, but they erase into existing generic contribution surfaces before contract emission. Any generated contract or fixture drift is a stop condition rather than permission to regenerate.

## Adapter impact

- **PostgreSQL:** runtime and control composition gain the validated typed registry; parameter native-type resolution moves to descriptor-owned typed behavior with byte-identical casts; JSON renderer arms remain pass-throughs.
- **SQLite:** runtime construction becomes stack-aware, runtime/control composition gain the same extension-inclusive typed registry, and existing SQL rendering remains byte-identical.
- **Mongo:** generic descriptor/control-stack compilation and behavior remain unchanged.
- **Custom targets:** no framework-owned target map or union is added; custom targets may define an equivalent descriptor subtype, adapter factory, validator, registry, and renderer independently.

## ADR pointer

The project will author or select the durable ADR at close-out for target-owned codec descriptors, validated internal erasure, and database JSON projection semantics. This slice records the implementation evidence but does not create a second temporary ADR.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
|---|---|---|
| Extension packages load a duplicate target module instance. | Validate a stable structural discriminant and required methods; never require `instanceof` for composition. | Preserves open-world extension loading. |
| Identity projection looks tempting as an implicit default. | Keep scalar projection mandatory; built-ins and adapters declare identity explicitly during this behavior-preserving slice. | An omission must not silently claim losslessness. |
| Generic control-stack erasure appears to lose target safety. | Erase only after target-narrow authoring, then validate once when constructing each target adapter. | Do not thread target subtypes through unrelated generics. |
| The preserved numeric prototype offers a quick renderer patch. | Use it only as evidence; no hardcoded codec ID, derived-table lineage resolver, or stash operation enters this slice. | The live named stash and hashed patch remain untouched. |

## Slice-specific done conditions

- [ ] Public target APIs preserve literal/factory typing, reject raw generic descriptors at authoring time, validate erased `CodecRef` parameters before typed hooks, and structurally reject malformed target descriptors during adapter composition.
- [ ] Every PostgreSQL/SQLite built-in and affected in-repo PostgreSQL extension contributes the correct target descriptor type through runtime and control paths, with no query-time target cast.
- [ ] PostgreSQL native-type results, generic metadata, codec JSON, JSON renderer SQL, generated contracts, and fixtures remain equivalent to the predecessor branch; SQLite runtime/control rendering and codec JSON remain equivalent.
- [ ] Extension-author upgrade instructions cover the new target descriptor requirement, and validation-by-execution reproduces the committed extension substrate.
- [ ] No generic target map, ORM codec-ID branch, metadata removal, aggregate behavior, or TML-3063 projection behavior enters the diff.

## Open Questions

1. **Which public export path should extensions import?** Working position: expose a lean target descriptor subpath that does not load built-in registries; reuse the broader codecs export only if package analysis proves its runtime closure is equivalent.
2. **How are PostgreSQL native type names represented?** Working position: retain the existing trusted SQL string semantics and exact schema-qualified/custom spellings; a structured type AST is out unless parity cannot be achieved safely.
3. **How should existing parameter-schema/call-site mismatches such as PostGIS geometry be handled?** Working position: preserve current public unparameterized call shapes by aligning the descriptor schema and typed hook with behavior that already works; do not invent hidden casts, defaults, or codec JSON changes. If parity requires a public semantic change, halt for discussion.
4. **What helper shape implements the default PostgreSQL array lift?** Working position: compose the slice-1 `CaseExpr`, subquery/derived source, `FunctionSource` aliases/ordinality, and JSON aggregation nodes with a single source binding; do not use raw SQL. Exact helper names remain negotiable.

## References

- Parent project: [`../../spec.md`](../../spec.md)
- Project design: [`../../design-notes.md`](../../design-notes.md)
- Project plan: [`../../plan.md`](../../plan.md)
- Linear issue: [TML-3061](https://linear.app/prisma-company/issue/TML-3061/target-codec-descriptor-foundations)
- Predecessor PR: [#1023](https://github.com/prisma/prisma-next/pull/1023)
- Interface/factory pattern: [`docs/architecture docs/patterns/interface-plus-factory.md`](../../../../docs/architecture%20docs/patterns/interface-plus-factory.md)
- No-bare-casts policy: `.agents/skills/no-bare-casts/SKILL.md`
- Upgrade workflow: `.agents/skills/record-upgrade-instructions/SKILL.md`
