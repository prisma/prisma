# Codec JSON projections — Plan

**Spec:** [`projects/codec-json-projections/spec.md`](./spec.md)
**Linear Project:** [Codec JSON projections](https://linear.app/prisma-company/project/codec-json-projections-a10fba2e9cd5) (planning record: [TML-3060](https://linear.app/prisma-company/issue/TML-3060/plan-codec-json-projections))

## At a glance

This is a strict five-PR stack: target-neutral AST foundations → target descriptor foundations → target projection implementations → lossless JSON projection hard cut → aggregate typing/testkit hard cut. There is no honest parallel group because every slice consumes a type or runtime boundary established by the preceding slice, while separating the stack keeps each conceptual change reviewable and every merge state coherent.

## Composition

### Stack (deliver in order)

1. **Slice `01-sql-json-projection-ast-foundations`** — Linear: [TML-3062](https://linear.app/prisma-company/issue/TML-3062/sql-json-projection-ast-foundations)
   - **Outcome:** The relational SQL AST can represent codec/native/document JSON-boundary semantics and the function/cast/case/function-source/ordinality compositions required by target projections; `ProjectionItem.codec` is preserved as projected-value metadata, while rendered SQL and codec behavior remain unchanged.
   - **Builds on:** Existing frozen relational AST classes/visitors and the existing optional `ProjectionItem.codec` slot; no earlier project slice.
   - **Hands to:** A target-neutral `JsonValueProjection` class/visitor union consumed by JSON object and array aggregation nodes, complete rewrite/fold/visitor support, typed projection-building vocabulary, and regression tests proving metadata preservation without a behavior change.
   - **Focus:** AST semantics, invariants, exports, exhaustive consumers, and behavior-preserving tests. It does not introduce target descriptor types, choose PostgreSQL/SQLite SQL, alter codec JSON, or touch aggregate resolution.

2. **Slice `02-target-codec-descriptor-foundations`** — Linear: [TML-3061](https://linear.app/prisma-company/issue/TML-3061/target-codec-descriptor-foundations)
   - **Outcome:** PostgreSQL and SQLite codecs are authored through target-specific descriptor classes or explicit adapters, and each target adapter constructs one structurally validated typed descriptor registry; existing metadata and observable JSON behavior remain temporarily intact.
   - **Builds on:** Slice 1's projection AST contract, which gives descriptor hooks a target-neutral AST-to-AST input/output surface.
   - **Hands to:** `PostgresCodecDescriptor`/`SqliteCodecDescriptor`, generic-codec wrapping factories, narrow codec-array helpers, descriptor-owned type-parameter validation, typed target registries, and migrated built-in/extension descriptor definitions ready for an atomic behavior switch.
   - **Focus:** Public authoring type safety, structural discriminants, delegation/literal preservation, composition-time validation, and registry wiring. It deliberately retains `CodecMeta`/`metaFor` and the old projection behavior until slice 3 has migrated every consumer.

3. **Slice `03-target-json-projection-implementations`** — Linear: [TML-3100](https://linear.app/prisma-company/issue/TML-3100/target-json-projection-implementations-and-conformance-harness)
   - **Outcome:** Every PostgreSQL, SQLite, and in-repo extension descriptor implements its real canonical `jsonProjection`, with each affected codec's `encodeJson` / `decodeJson` moving to the same canonical form; the SQLite JSON-document retagging mechanism exists and is unit-tested; a database-backed conformance harness proves each projection round-trips losslessly. Production JSON renderers still do not invoke `projectJson()`, so no database-produced JSON path changes — though contract-serialized defaults and fixtures do.
   - **Builds on:** Slice 2's target descriptor protocols and validated registries, which give every projection a typed home, and slice 1's projection AST vocabulary, which gives the array lift its nodes.
   - **Hands to:** A complete, database-verified set of canonical projections and array/document machinery that slice 4 switches on in one atomic flip.
   - **Focus:** Canonical format authorship and its evidence — per-descriptor projection SQL, reference array semantics, SQLite retagging, and the conformance harness including the arbitrary-precision numeric regression. It does not wire renderers, touch ORM planning, remove generic metadata, or regenerate contracts.

4. **Slice `04-lossless-json-projection-hard-cut`** — Linear: [TML-3063](https://linear.app/prisma-company/issue/TML-3063/lossless-json-projection-hard-cut)
   - **Outcome:** Codec JSON is canonical and lossless in every codec-aware database-produced JSON path: ORM planning emits codec/native/document projection nodes, PostgreSQL and SQLite render descriptor-owned scalar/document projections, PostgreSQL arrays use the reference lift or a conformant optimization, and generic target metadata/lineage inference disappear.
   - **Builds on:** Slice 3's implemented and database-verified canonical projections, slice 2's migrated target descriptors/registries, and slice 1's projection/relational AST.
   - **Hands to:** A lossless codec/projection substrate for direct, nested, computed, and future aggregate outputs; restored canonical formats for PostgreSQL, SQLite, pgvector, PostGIS, and other affected extensions; finite-only generic floats; target conformance matrices; no generic `meta` plumbing or hardcoded codec IDs.
   - **Focus:** The switch itself — wiring `projectJson()` through ORM planning and both renderers, removing generic metadata, and regenerating contracts and fixtures, as one atomic flip. The projections it switches on are authored in slice 3. Aggregate operation-to-output-codec resolution remains slice 5's separate concern; this slice projects every value whose output `CodecRef` is already known.

5. **Slice `05-aggregate-codec-typing-and-extension-testkits`** — Linear: [TML-3064](https://linear.app/prisma-company/issue/TML-3064/aggregate-codec-typing-and-extension-testkits)
   - **Outcome:** Existing aggregate APIs are available, typed, projected, and decoded from target/extension `SqlAggregateDescriptor`s, with runtime and emitted `aggregateTypes` in lockstep; public dev-only target testkits let extensions prove the same codec/projection invariant without adding test code to production dependencies.
   - **Builds on:** Slice 4's canonical codec JSON, target projection registries, authoritative `ProjectionItem.codec`, and database conformance primitives.
   - **Hands to:** Project close-out: exact-over-trait aggregate resolution, target-accurate bigint/decimal results across top-level and include aggregate paths, public PostgreSQL/SQLite codec testkits exercised by extension suites, regenerated contracts/fixtures, durable docs/ADR, and upgrade instructions.
   - **Focus:** Separate aggregate descriptor contributions/registry, complete database-verified PostgreSQL/SQLite aggregate matrices, `aggregateTypes` emission and type-level resolution, ORM aggregate decoding, package/dependency boundaries for testkits, extension adoption, documentation, fixtures, and migration guidance.

## Stacked PR contract

| Stack position | Issue | Branch base at creation | PR target until predecessor merges |
|---:|---|---|---|
| 1 | TML-3062 | Synchronized project/main base | `main` |
| 2 | TML-3061 | TML-3062 branch | TML-3062 branch |
| 3 | TML-3100 | TML-3061 branch | TML-3061 branch |
| 4 | TML-3063 | TML-3100 branch | TML-3100 branch |
| 5 | TML-3064 | TML-3063 branch | TML-3063 branch |

After a predecessor merges, downstream branches are synchronized and PR targets advance without changing the slice's outcome. Every PR title carries its Linear identifier, every slice receives its own spec and dispatch plan at pickup, and no downstream slice is merged around an unmerged predecessor.

## Prototype preservation and pickup

The exact pre-project prototype from PostgreSQL codec, renderer, adapter-test, and integration-test surfaces is preserved as a compressed patch under [`assets/`](./assets/) with a verified SHA-256, and the original live edits are parked in a named local stash. It proves the precision failure and the effectiveness of pre-JSON text projection, but its `PG_NUMERIC_CODEC_ID` branch and derived-table lineage reconstruction are rejected.

At slice pickup:

1. Use the preserved patch and design checkpoint as evidence; never transplant the rejected renderer implementation wholesale.
2. Port regression assertions into the first slice that owns each behavior: AST metadata preservation in slice 1, descriptor behavior in slice 2, and numeric database round trips in slice 3.
3. Keep the hardcoded codec ID and lineage reconstruction out of every project PR.

The planning branch was synchronized with current `origin/main` after preservation. No product implementation or prototype rewrite is part of the planning PR.

## Dependencies (external)

- [x] [PR #942](https://github.com/prisma/prisma-next/pull/942) is merged and its behavior/evidence is understood; merge commit `bd2bcd1914` is the regression baseline.
- [x] PostgreSQL integration and SQLite executable test infrastructure already exist; the project does not depend on a new external database service or another team delivering infrastructure.
- [x] The repository already has frozen AST visitors, codec descriptor registries, component contributions, contract type maps, and target/extension package boundaries to extend rather than replace.
- [x] The project working branch was rebased onto current `origin/main` after the prototype was durably captured and verified; each slice repeats the final sync gate before its PR opens.

## Sequencing rationale

Slice 1 must land first because target descriptors need a stable target-neutral projection type and renderers need exhaustive AST consumers before executable hooks can exist. Slice 2 then establishes type-safe target ownership while deliberately preserving old metadata and behavior, avoiding a PR that mixes descriptor architecture with every codec-format change.

Slice 3 separates authoring the canonical projections from switching them on. The transition already specifies that production renderers do not invoke `projectJson()`, so every per-descriptor projection, the PostgreSQL array reference lift, the SQLite retagging mechanism, and the database-backed conformance harness can land — and be proven against a real database — without changing observable output. Slice 4 then makes the JSON hard cut atomically, because every projection it switches on is already written and verified; what remains is one coherent flip of renderer wiring, ORM planning, metadata removal, and fixture regeneration.

That split exists because the combined slice failed slice-INVEST *Small*: the metadata removal alone spans 19 packages, and bundling it with 76 built-in descriptor format changes, extension migrations, renderer wiring, a new conformance harness, and fixture regeneration produced a diff no reviewer could hold in one sitting. The transitional-shape constraint is preserved exactly — no merged state advertises canonical lossless JSON while a database-produced path still emits the old representation, because slice 3 advertises nothing.

Aggregate output codecs remain a distinct operation/target problem rather than being smuggled onto codec descriptors, so slice 5 builds on the proven projection substrate and changes runtime, emitted types, public results, testkits, fixtures, and upgrade guidance together.

The stack is serial by data dependency, not by convention. Running descriptor, projection, or aggregate slices in parallel would either duplicate temporary APIs or require sibling PRs to merge together, violating slice independence and making intermediate `main` states contradictory.
