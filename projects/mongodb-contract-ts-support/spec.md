# Summary

Add first-class MongoDB support to `contract.ts` by introducing a typed TypeScript authoring surface for Mongo contracts. The work should reuse the redesigned SQL authoring direction where it helps, but it must model Mongo-native contract concepts directly instead of stretching the SQL DSL to fit a different family.

# Description

Prisma Next already supports Mongo contracts in several important places:

- `@internal/mongo-contract` defines the Mongo contract types and validation rules.
- `@internal/mongo-emitter` emits `contract.json` and `contract.d.ts` from a canonical Mongo contract.
- `@internal/mongo-contract-psl` interprets Mongo PSL into a contract.
- The CLI can already load a hand-authored `contract.ts` object because `loadContractFromTs()` is family-agnostic and config `contract.source` can return any `Contract`.

What is missing is an ergonomic, typed Mongo authoring surface for `contract.ts`. Today, SQL has a redesigned DSL centered on `defineContract(...)`, pack-composed `field.*` helpers, typed model tokens, and a no-emit friendly result type. Mongo does not. Mongo users either author PSL or hand-construct plain contract objects.

The existing SQL package is not a thin shell that can be widened trivially:

- `defineContract` is hard-bound to `TargetPackRef<'sql', ...>` and `ExtensionPackRef<'sql', ...>`.
- The callback helper composition returns SQL storage types and field presets.
- The DSL exposes SQL-only concepts such as `.sql(...)`, tables, columns, indexes, foreign keys, inline `.id()`, and `.unique()`.
- Lowering and type inference are built around `StorageTypeInstance`, SQL `ContractDefinition`, and `SqlContractResult`.

Mongo also needs domain features that are not represented by the current user-facing SQL DSL surface:

- `owner` for embedded entities
- `storage.relations` for physical embed locations
- `discriminator` / `variants` / `base` for polymorphism
- `valueObjects`
- collection-root authoring instead of table-first mapping
- field shapes using `many` / `dict` / union-like document semantics rather than SQL column semantics

**Assumption:** the correct first slice is a dedicated Mongo authoring package, likely `@internal/mongo-contract-ts`, plus only the shared extractions that materially reduce duplication. The goal is not a one-shot family-agnostic rewrite of `@internal/sql-contract-ts`.

# Requirements

## Functional Requirements

1. Provide a dedicated Mongo `contract.ts` authoring package with a `defineContract(...)` entrypoint suitable for no-emit and emit workflows.

2. The new authoring surface must build canonical Mongo contracts accepted by `validateMongoContract()` without post-processing or hand-written normalization steps outside the builder.

3. The builder must support authoring aggregate roots and collection mappings.
   - Root accessors must lower to `roots`.
   - Root models must lower to `model.storage.collection`.
   - `storage.collections` must be derived consistently from the models authored as roots.

4. The builder must support Mongo scalar fields through typed helpers aligned with framework composition.
   - Scalar fields must lower to `{ type: { kind: 'scalar', codecId, typeParams? }, nullable }`.
   - The surface must support optional/nullability.
   - The surface must support document-style multiplicity where the canonical contract uses `many` and, if included in scope, `dict`.

5. The builder must support typed reference relations.
   - Relations must express `to`, `cardinality`, and `on`.
   - The API should preserve the redesigned SQL surface’s preference for typed model tokens and typed field refs where practical.
   - String fallbacks are acceptable only where necessary for circular or forward references.

6. The builder must support embedded/owned models.
   - Owned models must lower to `owner`.
   - Parent models must be able to declare the matching embed relation.
   - Parent storage must be able to declare `storage.relations.<name>.field` for the physical embedded field path.

7. The builder must support Mongo polymorphism.
   - Base models must be able to declare `discriminator` and `variants`.
   - Variant models must be able to declare `base`.
   - The lowering must preserve Mongo’s single-collection inheritance constraint by producing contracts that pass existing storage validation.

8. The builder must support `valueObjects`.
   - Authors must be able to declare named value objects.
   - Model fields and nested value object fields must be able to reference those value objects.
   - The result must flow through existing emitter and no-emit type inference correctly.

9. The builder must integrate with the revamped authoring ergonomics where it fits.
   - A callback overload similar to the redesigned SQL surface should exist if it does not force SQL-specific concepts into the Mongo API.
   - Pack-composed helper vocabularies should remain composition-driven rather than hardcoded ad hoc helpers.

10. The work must include the pack/export wiring needed for Mongo `contract.ts` authoring.
    - A Mongo family pack export analogous to SQL’s pack export should exist if the builder requires `family`.
    - Mongo target pack metadata should expose authoring contributions needed by the DSL.

11. The work must include a config helper for TS-authored Mongo contracts, either as a Mongo-local helper or as a shared helper that Mongo re-exports.

12. The work must include verification across the existing consumer surfaces.
    - CLI `contract emit`
    - `validateMongoContract()`
    - `mongoOrm()`
    - pipeline-builder / runtime no-emit typing where contract generics are consumed

13. The work must document the supported Mongo `contract.ts` surface and its intentional differences from SQL `contract.ts` and Mongo PSL.

## Non-Functional Requirements

1. The implementation must avoid regressing the redesigned SQL authoring surface or entangling Mongo delivery with a large SQL refactor.

2. The built contract must remain pure data and JSON-serializable so the existing `loadContractFromTs()` and CLI purity checks continue to work.

3. The API must stay domain-first.
   - Mongo concepts should be explicit at the authoring layer.
   - SQL-specific overlays and constraint vocabulary should not leak into Mongo simply for surface symmetry.

4. The first slice must be sized to land with high-confidence tests rather than attempting every designed Mongo feature at once.

5. Type inference quality must match current manual-contract capabilities for supported features, especially roots, embedded models, polymorphic models, and value objects.

6. The implementation must follow repo constraints:
   - no `any`
   - no lint suppression
   - minimal casts
   - tests added before implementation changes

## Non-goals

1. Converting `@internal/sql-contract-ts` into a fully family-agnostic DSL in the same project.

2. Adding Mongo runtime features that are unrelated to authoring, such as change streams, vector search, or encryption support.

3. Expanding Mongo storage metadata beyond what the current canonical Mongo contract meaningfully supports.
   - Collection indexes
   - validators
   - collection options

4. Achieving full Mongo PSL parity in the same change.
   - PSL can remain narrower than `contract.ts` in the first slice.

5. Updating examples, demos, or CI defaults before the Mongo `contract.ts` API is stable and reviewed.

6. Solving every future document-family need for non-Mongo targets in this project.

# Acceptance Criteria

- [ ] A Mongo-specific TypeScript authoring package exists and can build a canonical Mongo contract from `contract.ts`.
- [ ] A contract authored with the new surface passes `validateMongoContract()` without manual fixups.
- [ ] The authoring surface can express a reference-only Mongo contract equivalent to the current PSL-supported subset.
- [ ] The authoring surface can express the current manual-contract-only features used by Mongo integration fixtures: `owner`, `storage.relations`, `discriminator` / `variants` / `base`, and `valueObjects`.
- [ ] CLI `contract emit` works from a Mongo `contract.ts` source and emits valid `contract.json` and `contract.d.ts`.
- [ ] No-emit typing works with existing Mongo consumers for supported features, including `mongoOrm()` row inference and pipeline-builder contract generics.
- [ ] SQL `contract.ts` behavior and test coverage remain green after the Mongo work lands.
- [ ] The package/export story is coherent enough that a user can discover and import the Mongo authoring surface without ad hoc object literals.
- [ ] Documentation explains when to use Mongo `contract.ts`, what it currently supports, and where it intentionally differs from SQL `contract.ts` and Mongo PSL.

# Other Considerations

## Security

This is an authoring-layer feature with negligible direct security impact. The main security requirement is to preserve the existing `contract.ts` purity model so authored contracts remain inert data and do not widen the allowed execution surface in CLI loading.

## Cost

Runtime cost should be effectively zero. Build-time cost is limited to additional tests, emit fixtures, and type-level inference work. The main cost risk is engineering scope creep if the project tries to genericize the entire SQL DSL instead of adding a Mongo-specific slice.

## Observability

The primary observability surface is test coverage:

- unit tests for builder/lowering invariants
- type tests for no-emit inference
- CLI emit integration tests
- integration tests proving authored contracts work with Mongo validators and runtime consumers

If the builder keeps fallback modes analogous to the SQL surface, warnings should remain structured and actionable.

## Data Protection

No production data handling changes are required by this feature. The relevant data-protection concern is documentation accuracy so users understand this is an authoring capability, not schema enforcement on live Mongo collections.

## Analytics

No product analytics work is required. If adoption is measured later, package-level usage should be inferred from docs/examples rather than instrumenting the authoring surface itself.

# References

- `packages/2-sql/2-authoring/contract-ts/src/contract-builder.ts`
- `packages/2-sql/2-authoring/contract-ts/src/contract-dsl.ts`
- `packages/2-sql/2-authoring/contract-ts/src/contract-definition.ts`
- `packages/2-sql/2-authoring/contract-ts/src/contract-lowering.ts`
- `packages/2-sql/2-authoring/contract-ts/src/contract-types.ts`
- `packages/2-sql/2-authoring/contract-ts/src/composed-authoring-helpers.ts`
- `packages/1-framework/1-core/framework-components/src/framework-authoring.ts`
- `packages/2-mongo-family/1-foundation/mongo-contract/src/contract-types.ts`
- `packages/2-mongo-family/1-foundation/mongo-contract/src/contract-schema.ts`
- `packages/2-mongo-family/1-foundation/mongo-contract/src/validate-storage.ts`
- `packages/2-mongo-family/2-authoring/contract-psl/src/interpreter.ts`
- `packages/3-mongo-target/1-mongo-target/src/core/descriptor-meta.ts`
- `test/integration/test/mongo/fixtures/contract.ts`
- `test/integration/test/mongo/fixtures/prisma-next.config.ts`
- `examples/mongo-demo/prisma-next.config.ts`
- `docs/architecture docs/adrs/ADR 181 - Contract authoring DSL for SQL TS authoring.md`
- `docs/architecture docs/subsystems/10. MongoDB Family.md` (the promoted home of the former `docs/planning/mongo-target/` archive, now deleted)

# Open Questions

1. Should the first implementation create `@internal/mongo-contract-ts` directly, or is there enough immediate reuse value to extract a new family-neutral authoring core first?
   - **Default assumption:** create the Mongo package first and extract only the helper/runtime pieces that clearly serve both families.

2. How much surface symmetry with the redesigned SQL API is required?
   - **Default assumption:** keep `defineContract(...)`, typed model tokens, and the callback overload shape where useful, but do not force SQL concepts such as `.sql(...)`, `.id()`, or `.unique()` into Mongo.

3. What should the first Mongo callback helper namespace contain?
   - **Default assumption:** `field`, `model`, `rel`, and a Mongo-appropriate value-object/root vocabulary if needed. Do not force SQL-style `type.*` storage-type constructors unless there is a real Mongo use case.

4. Should union-field authoring and `dict` authoring be included in the first slice?
   - **Default assumption:** no. Land the features already proven by validation/runtime fixtures first, then add union/dict authoring as a follow-up if needed.

5. Should Mongo `contract.ts` become the preferred surface for advanced Mongo-only features before PSL reaches parity?
   - **Default assumption:** yes for advanced features, while PSL remains the simplest path for the current basic subset.
