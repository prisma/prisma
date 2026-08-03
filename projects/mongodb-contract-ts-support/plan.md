# MongoDB `contract.ts` Support Plan

## Summary

Add a Mongo-specific TypeScript authoring surface that produces canonical Mongo contracts for emit and no-emit workflows. The plan is intentionally scoped around a new `@internal/mongo-contract-ts` package plus minimal shared extractions, because the current SQL package embeds SQL semantics too deeply to serve as a drop-in cross-family core.

**Spec:** `projects/mongodb-contract-ts-support/spec.md`

## Collaborators

| Role | Person/Team | Context |
|---|---|---|
| Maker | jkomyno | Owns the redesigned `contract.ts` API direction and final package shape |
| Reviewer | Will Madden | Owns recent Mongo contract/runtime work and should verify semantic alignment |
| Collaborator | CLI / emitter consumers | Need emit/no-emit Mongo contracts to remain compatible with current tooling |

## Milestones

### Milestone 1: Lock The Mongo Authoring Shape

Define the package boundary, the user-facing API, and the minimal shared seams required before implementation starts. This milestone is complete when the intended package/export layout and the supported first-slice feature set are settled in code-facing terms rather than prose only.

**Tasks:**

- [ ] Decide package strategy: new `@internal/mongo-contract-ts` package with targeted shared extraction, not a broad `sql-contract-ts` genericization.
- [ ] Define the Mongo `defineContract(...)` shell and callback overload shape.
- [ ] Define which builder primitives exist in the first slice: roots, models, fields, relations, owned models, polymorphism, value objects.
- [ ] Add or plan the Mongo family pack export required for authoring-time composition if the builder depends on `family`.
- [ ] Extend Mongo target pack metadata with authoring contributions for Mongo field helpers.
- [ ] Identify any SQL helper-runtime code that should move into a shared location before Mongo implementation begins.
- [ ] Write failing tests for entrypoint guards, helper composition, and expected package exports.

### Milestone 2: Implement Mongo Builder And Lowering

Implement the actual Mongo authoring package and make it lower to the canonical Mongo contract shape already consumed by validation, emit, and runtime code. This milestone is complete when builder-authored contracts match the intended canonical structure and pass Mongo validation.

**Tasks:**

- [ ] Create the Mongo authoring package and public exports.
- [ ] Implement Mongo field builders for scalar fields and nullability, plus first-slice multiplicity support.
- [ ] Implement Mongo model builders and typed model-token references.
- [ ] Implement relation builders for Mongo reference relations.
- [ ] Implement authoring for owned models and parent `storage.relations`.
- [ ] Implement authoring for `discriminator`, `variants`, and `base`.
- [ ] Implement authoring for named `valueObjects` and fields that reference them.
- [ ] Implement Mongo lowering from builder state to canonical `Contract<MongoStorage>`.
- [ ] Implement the Mongo no-emit result type so builder-authored contracts preserve useful type inference.
- [ ] Add a Mongo TS config helper or shared helper re-export for authored contracts.
- [ ] Add unit tests covering canonical lowering and validation success/failure paths.
- [ ] Add type tests covering roots, embedded models, polymorphism, and value-object inference.

### Milestone 3: Prove Tooling Compatibility

Verify that Mongo `contract.ts` works through the real repo workflows instead of only through isolated unit tests. This milestone is complete when a builder-authored Mongo contract passes emit and consumer integration tests and the authoring docs are sufficient for contributors to use the surface.

**Tasks:**

- [ ] Add a CLI emit integration fixture for Mongo `contract.ts`.
- [ ] Add integration coverage proving emitted artifacts are accepted by `validateMongoContract()`.
- [ ] Add integration coverage for no-emit usage with `mongoOrm()` and pipeline-builder generics.
- [ ] Add regression coverage showing SQL `contract.ts` behavior remains unchanged.
- [ ] Document the Mongo authoring surface, feature support, and differences from SQL `contract.ts` and Mongo PSL.
- [ ] If approved, add or update a focused example fixture that uses Mongo `contract.ts`; otherwise keep example changes out of scope.

## Test Coverage

| Acceptance Criterion | Test Type | Task/Milestone | Notes |
|---|---|---|---|
| Mongo-specific TypeScript authoring package exists and builds a contract | Unit | Milestone 2: create package + builder tests | Covers public exports and basic authoring flow |
| Built contract passes `validateMongoContract()` | Unit / Integration | Milestone 2: lowering tests; Milestone 3: validator integration | Must use real validator, not structural snapshots only |
| Authoring surface covers PSL-overlap subset | Unit / Integration | Milestone 2: canonical lowering tests | Compare builder output to current PSL-emitted semantics for overlap areas |
| Authoring surface covers `owner`, `storage.relations`, polymorphism, and value objects | Unit / Type / Integration | Milestone 2: dedicated lowering tests; Milestone 3: consumer integration | These are the critical Mongo-only gaps |
| CLI emit works from Mongo `contract.ts` | Integration / E2E | Milestone 3: CLI emit fixture | Must validate both `contract.json` and `contract.d.ts` generation |
| No-emit typing works with Mongo consumers | Type / Integration | Milestone 2: result-type tests; Milestone 3: ORM/pipeline tests | Use existing Mongo consumer packages as proof |
| SQL authoring remains green | Unit / Integration | Milestone 3: regression validation | Reuse existing SQL authoring test suites |
| Package/export story is discoverable | Unit | Milestone 1: export tests; Milestone 3: docs | Includes pack/config helper/export path checks |
| Documentation explains support and differences | Manual / Doc review | Milestone 3: docs task | Manual verification is acceptable here |

## Open Items

- The largest architectural choice is whether to extract a new family-neutral DSL core before Mongo lands. The plan assumes “extract only what Mongo immediately reuses.”
- The callback helper namespace still needs a concrete decision. The plan assumes Mongo gets a SQL-adjacent callback shape without inheriting SQL-only helper concepts.
- MongoDB collection validator authoring is intentionally deferred. Validators are a standard MongoDB feature and would be useful future contract metadata for DB-level guardrails, emit/setup flows, drift verification, and introspection, but they are not part of the current index and collection-options slice.
- Union-field and `dict` authoring are intentionally deferred unless implementation reveals they are required for first-slice consumer compatibility.
- Example/demo adoption should wait for explicit approval because the repo instructions call out example and CI changes as ask-first work.

## Close-out (required)

- [ ] Verify all acceptance criteria in `projects/mongodb-contract-ts-support/spec.md`
- [ ] Finalize long-lived docs and migrate them into `docs/`
- [ ] Strip repo-wide references to `projects/mongodb-contract-ts-support/**` (replace with canonical `docs/` links or remove)
- [ ] Delete `projects/mongodb-contract-ts-support/`
