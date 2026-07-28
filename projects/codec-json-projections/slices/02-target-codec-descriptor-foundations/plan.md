# Plan: Target codec descriptor foundations

## At a glance

Nine sequential dispatches establish PostgreSQL and SQLite target descriptor protocols, migrate built-ins and extensions, wire composition-time validated registries into both adapter planes, record the extension-author migration, and prove that the entire change remains behavior- and fixture-preserving. The split keeps target protocol judgments separate from mechanical adoption and adapter wiring.

## Dispatches

### Dispatch 1: PostgreSQL descriptor protocol

- **Outcome:** `@prisma-next/target-postgres` exports a type-safe `PostgresCodecDescriptor` protocol, explicit generic-descriptor adapter, narrow tuple helper, structural validator/typed registry, and default scalar-array lift, all covered by runtime and negative/positive type tests.
- **Builds on:** TML-3062's projection expression/source AST and the slice spec's settled PostgreSQL template-method boundary.
- **Hands to:** A public PostgreSQL descriptor API that validates erased `CodecRef` parameters, preserves wrapped descriptor typing/delegation, and can structurally validate heterogeneous contributions without `instanceof`.
- **Focus:** Tests first for discriminant/method validation, mandatory scalar projection, trusted native type, default array semantics/single binding, wrapper literal/factory/meta preservation, and raw-descriptor rejection. Do not migrate built-ins, adapters, extensions, or renderer behavior.

### Dispatch 2: SQLite descriptor protocol

- **Outcome:** `@prisma-next/target-sqlite` exports the analogous scalar-only `SqliteCodecDescriptor` protocol, generic-descriptor adapter, narrow tuple helper, and structural validator/typed registry with complete type/runtime coverage.
- **Builds on:** Dispatch 1's settled authoring/erasure conventions while retaining SQLite's intentionally different no-stored-array contract.
- **Hands to:** A public SQLite descriptor API that validates erased `CodecRef` parameters and can structurally validate target contributions while preserving generic descriptor behavior.
- **Focus:** Tests first for literal/factory/meta delegation, mandatory scalar projection, no speculative `many` machinery, structural validation, and raw-descriptor rejection. Do not migrate built-ins or make runtime construction stack-aware yet.

### Dispatch 3: PostgreSQL built-in adoption

- **Outcome:** Every PostgreSQL built-in descriptor and generic SQL descriptor in the canonical PostgreSQL arrays uses the new target protocol, while registry order, codec/type maps, factory types, metadata, codec JSON, and emitted types remain unchanged.
- **Builds on:** Dispatch 1's PostgreSQL authoring and typed-registry surface.
- **Hands to:** A complete built-ins-only typed PostgreSQL registry plus unchanged generic registry/type-map views ready for adapter composition.
- **Focus:** Tests first for canonical descriptor coverage, wrapper/subclass typing, metadata/native-type parity, enum parameter validation, factory/column-helper result types, and existing codec JSON. Preserve intentional differences between registry arrays and emitted codec maps; do not wire adapters or extensions.

### Dispatch 4: SQLite built-in adoption

- **Outcome:** Every SQLite built-in descriptor and generic SQL descriptor in the canonical SQLite arrays uses the SQLite protocol, while registry order, codec/type maps, factory types, codec JSON, and generated output remain unchanged.
- **Builds on:** Dispatch 2's SQLite authoring and typed-registry surface.
- **Hands to:** A complete built-ins-only typed SQLite registry plus unchanged generic registry/type-map views ready for adapter composition.
- **Focus:** Tests first for canonical descriptor coverage, generic adapter typing, current BLOB/bigint/JSON behavior, char/varchar presence despite control-metadata filtering, and column-helper result types. Do not make adapters stack-aware or change SQL rendering.

### Dispatch 5: PostgreSQL extension adoption

- **Outcome:** pgvector, PostGIS, and arktype-json contribute PostgreSQL descriptors through the target authoring API with correct runtime dependencies and unchanged public codec/column behavior.
- **Builds on:** Dispatch 1's public protocol and Dispatch 3's complete target-typed PostgreSQL built-in set.
- **Hands to:** A complete first-party PostgreSQL descriptor ecosystem that the adapter can validate atomically without an intermediate state that rejects existing extensions.
- **Focus:** Tests first for descriptor-array typing, factory/generic preservation, runtime/control contribution parity, and current vector-text/HEXEWKB/structured JSON behavior. Add lean target-package dependencies and lockfile changes; resolve PostGIS parameter optionality only in the behavior-preserving shape pinned by the spec. Do not add future projection formats or conformance packages.

### Dispatch 6: PostgreSQL adapter composition

- **Outcome:** Bare, runtime-stack, and control-stack PostgreSQL adapter construction build one immutable structurally validated target registry before lowering; parameter native-type rendering uses it with byte-identical SQL and no query-time target cast.
- **Builds on:** Dispatch 5's complete first-party PostgreSQL descriptor ecosystem plus Dispatch 1's registry validator.
- **Hands to:** Both PostgreSQL planes accept built-ins plus valid extension target descriptors, reject malformed/wrong-target contributions during composition, and retain existing generic materialization/DDL behavior.
- **Focus:** Tests first for early validation, duplicate IDs, runtime/control parity, built-ins-only bare factories, extension visibility, enum/custom/array cast SQL parity, and unchanged JSON projection SQL. Retain `meta`/`metaFor`; do not invoke JSON descriptor hooks from renderers.

### Dispatch 7: SQLite adapter composition

- **Outcome:** Bare, runtime-stack, and control-stack SQLite adapter construction build the same immutable extension-inclusive target registry before lowering, while existing codec materialization and byte-identical SQL rendering remain unchanged.
- **Builds on:** Dispatch 4's complete target-typed SQLite built-in set and Dispatch 2's registry validator.
- **Hands to:** Both SQLite planes accept valid extension target descriptors, reject malformed/wrong-target contributions during composition, and preserve built-ins-only bare construction.
- **Focus:** Tests first for runtime stack awareness, runtime/control descriptor-set parity, full char/varchar inclusion despite filtered control metadata, early malformed contribution failure, existing extension parameter encoding, and unchanged JSON object/array SQL. Do not add BLOB/bigint/document transforms.

### Dispatch 8: Authoring docs and upgrade instructions

- **Outcome:** Target/extension authors can migrate generic PostgreSQL/SQLite codec contributions to explicit target descriptors using committed documentation and an extension-author `0.16-to-0.17` upgrade entry validated against the in-repo extension substrate.
- **Builds on:** Dispatches 1–7's final public APIs and migrated substrate.
- **Hands to:** Reviewable migration guidance whose instructions reproduce the committed extension state without network access or runtime-package test dependencies.
- **Focus:** Document current target descriptor authoring and transitional identity projections without claiming canonical lossless JSON yet. Follow `record-upgrade-instructions`, use a script only if deterministic transformation is justified, validate in an isolated worktree, and keep the PR body entry path ready for PR creation.

### Dispatch 9: Preservation audit and slice gate

- **Outcome:** The complete slice is review-ready with all target/adapter/extension/workspace gates green and explicit proof that metadata, codec JSON, rendered JSON SQL, generated contracts, fixtures, and later-slice behavior did not drift.
- **Builds on:** Dispatches 1–8's final implementation and migration record.
- **Hands to:** TML-3063 receives fully migrated target descriptors/registries, extension adoption, and behavior-preserving compatibility evidence on a synchronized stacked base.
- **Focus:** Audit every descriptor contribution/registry source with bounded `rg`; prove no raw generic descriptor remains in PostgreSQL/SQLite target arrays or migrated extension arrays; run exact parity regressions and broad gates; treat fixture/contract or codec JSON drift, generic metadata removal, ORM projection changes, aggregate work, codec-ID branches, and prototype hunks as stop conditions.

## Dispatch-INVEST check

| Dispatch | Independent handoff | One coherent outcome | Binary verification |
|---|---|---|---|
| 1 | Public PostgreSQL protocol is usable before adoption. | One target authoring/registry substrate. | Runtime/type tests prove validation, delegation, and array-lift semantics. |
| 2 | Public SQLite protocol is usable before adoption. | One target authoring/registry substrate. | Runtime/type tests prove validation, delegation, and scalar-only semantics. |
| 3 | PostgreSQL built-ins fully adopt a settled API. | One mechanical target migration. | Descriptor-set/type-map/metadata/codec tests pass with zero behavior drift. |
| 4 | SQLite built-ins fully adopt a settled API. | One mechanical target migration. | Descriptor-set/type-map/codec tests pass with zero behavior drift. |
| 5 | PostgreSQL extensions uniformly adopt the settled API. | One mechanical extension migration with a pinned compatibility rule. | Three extension packages pass type/runtime tests and dependency gates. |
| 6 | PostgreSQL composition consumes the complete migrated set. | One adapter boundary. | All construction paths validate early and exact SQL parity tests pass. |
| 7 | SQLite composition consumes the migrated set. | One adapter boundary. | All construction paths validate early and exact SQL parity tests pass. |
| 8 | Published migration guidance matches the final API. | One extension-author migration record. | Validation-by-execution reproduces the committed substrate and coverage passes. |
| 9 | The whole behavior-preserving slice is proven. | One final audit/gate outcome. | All declared gates and no-drift searches pass on the synchronized head. |

The dispatches are sequential because built-in and adapter migrations consume target APIs, extension composition consumes the adapter boundary, and migration guidance must describe the final public shape. PostgreSQL and SQLite protocol work is conceptually parallel but remains sequential within this slice to keep the persistent implementer/reviewer context and cross-target conventions aligned without racing shared dependency/export surfaces.

## Validation gates

### Per-dispatch baseline

- Write or adapt focused tests before production implementation.
- Build a package after changing exported types before typechecking downstream consumers.
- Run each touched package's `test`, `typecheck`, and `lint` scripts; include test-project typechecking where the package script does not cover tests.
- Run `pnpm lint:casts` and `pnpm lint:throws` for every production TypeScript dispatch.
- Use bounded terminal/bash `rg` for discovery and closing symbol scans; do not use harness built-in search tools while the Zed issue remains unverified.
- Explicitly stage dispatch files and create signed-off commits; do not amend, push, or run any `git stash*` command.

### Dispatch-specific gates

- **D1/D3:** build/test/typecheck/lint `@prisma-next/target-postgres`; exact descriptor type tests; metadata/native-type and codec JSON regressions.
- **D2/D4:** build/test/typecheck/lint `@prisma-next/target-sqlite`; exact descriptor type tests; BLOB/bigint/JSON regressions.
- **D5:** test/typecheck/lint `@prisma-next/extension-pgvector`, `@prisma-next/extension-postgis`, and `@prisma-next/extension-arktype-json`; `pnpm lint:deps`; package manifest validation; lockfile consistency; `pnpm fixtures:check` as a zero-drift gate.
- **D6:** test/typecheck/lint `@prisma-next/adapter-postgres`; exact parameter-cast, runtime/control parity, malformed composition, extension visibility, and JSON pass-through tests.
- **D7:** test/typecheck/lint `@prisma-next/adapter-sqlite`; exact runtime/control parity, extension descriptor, metadata-filter, and JSON pass-through tests.
- **D8:** `pnpm check:upgrade-coverage --mode pr`; `pnpm lint:skills`; extension migration validation via `pnpm test --filter='./packages/3-extensions/*'` in the isolated replay worktree.

### Final slice gate

- `pnpm --filter @prisma-next/target-postgres build`
- `pnpm --filter @prisma-next/target-postgres test`
- `pnpm --filter @prisma-next/target-postgres typecheck`
- `pnpm --filter @prisma-next/target-postgres lint`
- `pnpm --filter @prisma-next/target-sqlite build`
- `pnpm --filter @prisma-next/target-sqlite test`
- `pnpm --filter @prisma-next/target-sqlite typecheck`
- `pnpm --filter @prisma-next/target-sqlite lint`
- `pnpm --filter @prisma-next/adapter-postgres test`
- `pnpm --filter @prisma-next/adapter-postgres typecheck`
- `pnpm --filter @prisma-next/adapter-postgres lint`
- `pnpm --filter @prisma-next/adapter-sqlite test`
- `pnpm --filter @prisma-next/adapter-sqlite typecheck`
- `pnpm --filter @prisma-next/adapter-sqlite lint`
- `pnpm --filter @prisma-next/extension-pgvector test`
- `pnpm --filter @prisma-next/extension-pgvector typecheck`
- `pnpm --filter @prisma-next/extension-pgvector lint`
- `pnpm --filter @prisma-next/extension-postgis test`
- `pnpm --filter @prisma-next/extension-postgis typecheck`
- `pnpm --filter @prisma-next/extension-postgis lint`
- `pnpm --filter @prisma-next/extension-arktype-json test`
- `pnpm --filter @prisma-next/extension-arktype-json typecheck`
- `pnpm --filter @prisma-next/extension-arktype-json lint`
- `pnpm lint:casts`
- `pnpm lint:throws`
- `pnpm lint:deps`
- `pnpm check:upgrade-coverage --mode pr`
- `pnpm lint:skills`
- `pnpm fixtures:check`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test:packages`
- `pnpm test:integration`
- `pnpm test:e2e`

Manual QA is N/A because this slice deliberately preserves user-visible codec and SQL behavior; compile-time authoring and composition-time failure semantics are fully covered by automated type/runtime tests. Any observation that requires changing database-produced JSON belongs to TML-3063 and halts this slice.

## Closing searches

- No unadapted generic descriptor remains in PostgreSQL/SQLite target arrays or migrated extension arrays.
- No target-specific descriptor subtype appears in generic `ControlStack`, `ComponentMetadata`, `SqlControlExtensionDescriptor`, or ORM planner types.
- No query-time structural validation, `instanceof`-only target check, new bare production cast, codec-ID branch, or lineage reconstruction exists.
- No generic metadata removal, `encodeJson`/`decodeJson` behavior change, JSON renderer transform, ORM projection-selection change, aggregate descriptor, fixture/contract drift, or preserved prototype implementation enters the diff.
- No long-lived file outside the transient project directory references `projects/codec-json-projections`.

## Open items

None at plan time. The spec's four working positions are dispatch halt boundaries: if trusted native-type strings cannot preserve exact SQL, the default array lift cannot bind once compositionally, PostGIS compatibility requires a public semantic change, or a lean public export violates package layering, stop and return to design discussion rather than silently broadening the slice.
