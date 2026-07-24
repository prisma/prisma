# remove-db-attributes — Plan

**Spec:** `projects/remove-db-attributes/spec.md`
**Linear Project:** [Remove @db.* attributes from PSL](https://linear.app/prisma-company/project/remove-db-attributes-from-psl-7f387115b0fc)

## At a glance

Four slices in a single stack — substrate unification → new surface → consumer migration → hard cut. This is a migration-shaped project, and migration-shaped slices always serialise (per `drive/calibration/sizing.md` § Parallelisation heuristics); there is no parallelisable work at slice altitude.

## Composition

### Stack (deliver in order)

1. **Slice `unify-type-channel`** — Linear: [TML-2985](https://linear.app/prisma-company/issue/TML-2985) — `projects/remove-db-attributes/slices/unify-type-channel/`
   - **Outcome:** One unified type-contribution channel exists. The `scalarTypeDescriptors` map channel (`ComponentMetadata` → `assembleScalarTypeDescriptors` → `ContractSourceContext`) is retired; postgres, sqlite, and mongo contribute their base scalars as zero-arg `AuthoringTypeConstructorDescriptor` entries in `AuthoringContributions.type`; bare `T` resolves as `T()`; `output.nativeType` keeps its codec-derived default; LSP `scalarTypes`, the SQL symbol table's scalar list, and codec-id validation re-derive from the namespace. Contract emission byte-identical on all three targets.
   - **Builds on:** None.
   - **Hands to:** The unified namespace as the sole resolution channel for scalar types — the substrate slice 2 registers native types into.
   - **Focus:** Pure substrate unification across framework-components, config, both family providers, three adapters, and the LSP wiring. No authoring-syntax or semantic change; native types deliberately deferred to slice 2.

2. **Slice `native-types-as-scalars`** — Linear: [TML-2986](https://linear.app/prisma-company/issue/TML-2986) — `projects/remove-db-attributes/slices/native-types-as-scalars/`
   - **Outcome:** The twelve non-JSON former `@db.*` native types, including `Inet`, are authorable as bare types in both named-type and field position (`Uuid`, `Inet`, `VarChar(191)`, `Numeric(10,2)`, …), contributed by the postgres target as top-level constructor descriptors; `Date` pins `{ codecId: 'pg/date@1', nativeType: 'date' }`; `Json` re-binds to `pg/json@1` and new `Jsonb` carries `pg/jsonb@1`. Contract-emission parity vs the `@db.*` equivalents proven by tests.
   - **Builds on:** Slice 1's unified namespace.
   - **Hands to:** The new syntax fully available and parity-proven, with `@db.*` still recognized — the coexistence window slice 3 migrates consumers inside.
   - **Focus:** Postgres target contributions + parity tests only. No consumer migration, no printing changes, no `@db.*` removal.
   - **Operator gate (added 2026-07-11, operator-mandated):** when bare `T` becomes sugar for `T()`, evaluate retiring `scalarTypes` from `buildSymbolTable` — its sole use is the `isScalarBinding` ScalarSymbol/TypeAliasSymbol split in `types {}` blocks, which the interpreter's `resolveNamedTypeDeclarations` re-classifies anyway. The slice spec and the relevant dispatch brief MUST carry this as an explicit decision point with a **halt condition**: if the implementer or slice author concludes the simplification should NOT be done (the split turns out load-bearing, or the cost is disproportionate), they HALT and escalate to the operator with the rationale — silently keeping the `scalarTypes` parameter is forbidden. Only the operator may waive the simplification.

3. **Slice `repo-speaks-new-syntax`** — Linear: [TML-2987](https://linear.app/prisma-company/issue/TML-2987) — `projects/remove-db-attributes/slices/repo-speaks-new-syntax/`
   - **Outcome:** Zero live `@db.*` usage in the repo and inference produces the new syntax: psl-infer prints bare types in type position (`postgres-type-map.ts` reshaped, `PslNativeTypeAttribute` printer contract retired/reshaped, jsonb prints `Jsonb`); demo + supabase examples rewritten with regenerated migration chains; supabase extension contract, parser format fixtures, LSP tests, and interpreter tests migrated; demos run end-to-end.
   - **Builds on:** Slice 2's coexistence window.
   - **Hands to:** A repo with no `@db.*` consumers — the precondition for slice 4's hard cut.
   - **Focus:** Printing + mechanical consumer migration. The interpreter's `@db.*` recognition stays alive until slice 4; parser grammar tests using dotted attributes as generic examples may be re-pointed at a neutral namespace rather than deleted.

4. **Slice `remove-db-channel`** — Linear: [TML-2988](https://linear.app/prisma-company/issue/TML-2988) — `projects/remove-db-attributes/slices/remove-db-channel/`
   - **Outcome:** `NATIVE_TYPE_SPECS`, `resolveDbNativeTypeAttribute`, and the `allowDbNativeType` gate are deleted; any remaining `@db.X` usage yields an actionable migration diagnostic naming the bare-type replacement; ADR 231's out-of-scope section amended and the unified-channel ADR authored; stale `@db.X` comment wording in `sql-context.ts` and live doc references cleaned.
   - **Builds on:** Slice 3's `@db.*`-free repo.
   - **Hands to:** Project close-out (`drive-close-project`): docs migrated, `projects/remove-db-attributes/` deleted.
   - **Focus:** Subtractive hard cut + diagnostic + ADRs. No new authoring surface.

## Dependencies (external)

None — the project is self-contained within this repo. No sibling projects touch the type-resolution channel at time of planning.

## Sequencing rationale

The stack order is forced by the spec's transitional-shape constraints, in matching order: (1) channel unification lands before native-type contribution so the new types are registered once into their final home, never into the doomed map; (2) bare-type support lands before consumers migrate; (3) the removal slice lands only after every in-repo consumer is migrated. A pure 4-slice stack with no parallel group is the expected shape for a migration-shaped project (`drive/calibration/sizing.md`: "Migration-shaped slices always serialise").

Slice-INVEST note: slice 1 and slice 3 both carry wide mechanical fan-outs, but each has a single one-sentence outcome and a grep-gate verification, matching this repo's "mechanical fan-out that passes INVEST cleanly" pattern. Slice 3 deliberately bundles printing with consumer migration because both are expressions of one outcome ("the repo speaks the new syntax") and the migrated fixtures are what prove the printer's round-trip.
