# Created/Updated Timestamp Authoring Plan

## Summary

Add Prisma-style timestamp defaults across Postgres and SQLite via a **PSL field-preset registry path** that mirrors the existing TypeScript field-preset path. Success means PSL `temporal.createdAt()` / `temporal.updatedAt()` and TS `field.temporal.createdAt()` / `field.temporal.updatedAt()` lower to the existing SQL storage-default and execution-mutation-default IR with target-owned timestamp generators — and the `@updatedAt` attribute that landed earlier on this branch is removed in favor of the preset path.

**Spec:** `projects/created-updated-at-authoring/spec.md`

## What Changed (and Why)

The first three milestones (now consolidated into "Inherited Foundation" below) delivered `@updatedAt` as a Prisma-flavored PSL **attribute** with codec-applicability validation (`packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts:222`). wmadden flagged that the right shape — already used in PSL for `pgvector.Vector(1536)` — is a **namespaced field-position call** where the codec is implicit in the preset. That eliminates the need to validate where attributes belong on a per-codec basis.

The contract IR, the `timestampNow` generator, the runtime application path, and the ORM-client cross-rows stability work all carry through unchanged. **What changes is the user-facing PSL surface and the TS preset namespace.**

## Collaborators

| Role         | Person/Team                         | Context                                                                  |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------ |
| Maker        | jkomyno                             | Implements the PSL field-preset dispatch path and the registry move      |
| Reviewer     | wmadden                             | Originator of the field-preset feedback; signs off on PSL surface shape  |
| Reviewer     | SQL authoring/runtime reviewer      | Reviews PSL lowering parity, TS namespace move, runtime non-regression   |
| Collaborator | Target adapters owner               | Confirms Postgres + SQLite preset re-registration and codec assignments  |

## Inherited Foundation

Branch `feat/created-updated-at-authoring` already contains the IR plumbing, runtime, adapters, ORM-client wiring, and cross-rows stability work that this pivot builds on. None of it changes. The relevant pre-pivot commits and the load-bearing pieces:

- **IR & runtime.** `ExecutionMutationDefault` with `onCreate`/`onUpdate` phases; `MutationDefaultGeneratorDescriptor` with `applicableCodecIds` and `buildPhases`; runtime `applyMutationDefaults` with empty-update skip and explicit-value-skip; per-target Postgres + SQLite mutation-default generator descriptors.
- **Family-shared timestamp generator.** `timestampNowControlDescriptor` and `timestampNowRuntimeGenerator` (`packages/2-sql/9-family/src/core/timestamp-now-generator.ts`), with `stableAcrossRows: true` for cross-row stability in bulk inserts.
- **ORM-client wiring.** `Collection.update*`, `Collection.upsert`, and `updateFirstGraph` nested update branch all invoke `applyMutationDefaults({ op: 'update' })`. `Collection.createAll` allocates one `acrossRowsCache` per bulk insert. Bulk-update path also uses `acrossRowsCache` for `op: 'update'`.
- **Pre-pivot commits.** `9b27e0847` (migration ref routing), `4310a6a70` (initial spec/plan), `682714eee` (initial `@updatedAt` attribute), `ece4e185c` (review fixes), `40462aa91` (executionDefault → executionDefaults rename), `0d45548da` (validation consolidation), `89e15f591` (mutation-default validation at context creation), `40d67af63` (timestampNow centralization), `146242c1a` (ORM update wiring + acrossRowsCache), `14ff4548d` (Milestone 4 docs).

The pivot supersedes the user-facing PSL/TS surface from `682714eee`+ (the attribute-based `@updatedAt`, flat `field.createdAt()` / `field.updatedAt()`); everything else carries through untouched.

## Test Design

| AC | TC | Test Case | Type | Expected Outcome |
| --- | --- | --- | --- | --- |
| AC1 | TC1 | PSL `createdAt temporal.createdAt()` lowers to storage default `now()` | Unit | Storage column has `default: { kind: 'function', expression: 'now()' }`; no execution mutation default emitted |
| AC1 | TC2 | PSL `createdAt DateTime @default(now())` continues to lower identically | Unit | Same contract shape as TC1 |
| AC2 | TC3 | PSL `updatedAt temporal.updatedAt()` lowers to mutation default with `onCreate` + `onUpdate` | Unit | Execution defaults entry references `timestampNow` for both phases; storage column is non-null timestamp |
| AC3 | TC4 | TS `field.temporal.createdAt()` / `field.temporal.updatedAt()` produce contracts byte-equivalent to their PSL counterparts | Unit | After deterministic sorting by a single shared comparator helper, storage tables and execution defaults are identical for Postgres and SQLite |
| AC4 | TC5a | PSL `@updatedAt` produces `PSL_UNKNOWN_ATTRIBUTE` with a targeted hint pointing at `temporal.updatedAt()` | Unit | Stable diagnostic code, span on the offending attribute, message includes literal `temporal.updatedAt()` suggestion, no mention of "timestamp-compatible" |
| AC4 | TC5b | PSL `f temporal.updatedAt() @updatedAt` (already-migrated field with stale attribute) | Unit | Hint is suppressed; only the bare `PSL_UNKNOWN_ATTRIBUTE` diagnostic fires |
| AC5a | TC6a | PSL `temporal.updatedAt(123)` | Unit | `PSL_INVALID_ATTRIBUTE_ARGUMENT` with span on the offending argument (shared code with type-constructor arg errors; honest rename deferred — see RD11) |
| AC5b | TC6b | PSL `temporal.foo()` | Unit | `PSL_UNKNOWN_FIELD_PRESET` with span on the preset name |
| AC5c | TC6c | PSL `weather.updatedAt()` (unknown namespace) | Unit | `PSL_EXTENSION_NAMESPACE_NOT_COMPOSED` |
| AC5d | TC6d | PSL `updatedAt temporal.updatedAt() @default(now())` | Unit | `PSL_PRESET_AND_DEFAULT_CONFLICT` (new code, distinct from `PSL_INVALID_DEFAULT_APPLICABILITY`) |
| AC5e | TC6e | PSL `updatedAt temporal.updatedAt()?` | Unit | `PSL_PRESET_NOT_OPTIONAL` (new code) |
| AC5f | TC6f | PSL `updatedAt temporal.updatedAt()[]` | Unit | `PSL_PRESET_NOT_LIST` (new code) |
| AC5g | TC6g | PSL `f DateTime @default(temporal.updatedAt())` | Unit | `PSL_INVALID_DEFAULT_EXPRESSION` (or closest existing stable code) |
| AC5h | TC6h | PSL `id temporal.updatedAt() @id` | Unit | Hard error, stable code; preset's id semantics conflict with bare `@id` |
| AC5i | TC6i | PSL `f temporal.updatedAt() temporal.createdAt()` | Unit | Parse-time or resolution-time error (regression test for double preset on one field) |
| AC6 | TC7 | PSL field-preset dispatch is generic: a synthetic `testns.exampleField()` registered in test fixtures resolves through the same path | Unit | Synthetic preset emits the descriptor's contract contributions; no `temporal`-specific code path is required |
| AC6a | TC7a | Compose-time collision check across registries: same path registered in both `authoringContributions.field` and `authoringContributions.type` | Unit | Composition throws a deterministic error naming the colliding path; PSL resolution is never reached |
| AC6a | TC7b | Compose-time within-registry duplicate-name guard regression: same path registered twice within the field registry | Unit | Existing `composeFieldNamespace` duplicate-name guard fires |
| AC7 | TC8 | SQLite PSL `temporal.updatedAt()` + TS `field.temporal.updatedAt()` parity | Unit | SQLite-native codecs/defaults, byte-equivalent contracts |
| AC8 | TC9 | Examples and templates use the preset surface | Manual | `examples/**/contract.{ts,prisma}` and the CLI init template emit the preset surface, build cleanly |
| AC9 | TC10 | Docs reference the new vocabulary in one canonical location | Manual | `docs/products/psl/README.md` is the canonical reference; package READMEs link to it with short summaries |

**CI gates (not ACs).**

- `pnpm -F @internal/sql-runtime test` — inherited runtime tests (cross-rows stability, empty-update skip, explicit-value-skip, validation at context creation) continue to pass.
- `pnpm -F @internal/sql-orm-client test` — inherited ORM-client tests (`create` / `createAll` / `updateAll` / `updateAndCount` / `upsert` / nested `updateFirstGraph`) continue to pass, including bulk-update cross-row-stability for `op: 'update'`.

## Milestone: Pivot to Field-Preset PSL Surface

Add a generic field-preset dispatch path to PSL, re-namespace the existing `createdAt`/`updatedAt` presets under `temporal.*`, delete the `@updatedAt` attribute path, update fixtures/examples/docs, and close out the project. Single milestone because the dispatch mechanism, the registry move, and the attribute deletion are tightly coupled — the dispatch is dead code without the registry move; the attribute deletion can't safely land before the preset surface exists.

### Phase A: PSL field-preset dispatch path (mechanism)

Add the dispatch *mechanism* as a generic, registry-driven walker. No user-visible surface change yet; existing `field.createdAt()` / `field.updatedAt()` flat-named registrations continue to work for TS via this same path.

- [ ] Add `getAuthoringFieldPreset(contributions, path)` symmetric with `getAuthoringTypeConstructor` in `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts:54-67`. Walk `contributions?.field` segment-by-segment; return the descriptor or `undefined`. Satisfies TC1, TC3.
- [ ] Add `resolvePslFieldPresetDescriptor` and `instantiatePslFieldPreset` analogous to the existing type-constructor pair (lines 129, 187 of the same file). Reuse `instantiateAuthoringFieldPreset` from `framework-components` for argument binding and contribution resolution. Satisfies TC1, TC3.
- [ ] **Design note: PSL → `instantiateAuthoringFieldPreset` argument coercion.** TS feeds the function typed args; PSL feeds it AST nodes. Add an arg-coercion step in `instantiatePslFieldPreset` that converts AST nodes to the descriptor's declared shape (`number`, `string`, `boolean`, `object`-with-typed-properties); mismatches produce `PSL_INVALID_NAMESPACED_CALL_ARGUMENT`. `instantiateAuthoringFieldPreset` itself stays typed-input-only — TS keeps its zero-runtime-validation cost. Today's `temporal.X()` are arity-zero so the coercion path is exercised only by AC6's synthetic preset; if/when arity-non-zero family presets land in PSL (RD10 follow-up), expand the synthetic to exercise typed args. Satisfies TC1, TC3, TC7.
- [ ] Wire the dispatch into the field-type resolution path in `psl-field-resolution.ts`: field-preset walker runs first; on miss, fall back to the existing type-constructor walker. Satisfies TC1, TC3, TC8.
- [ ] Add a compose-time collision check that rejects any path appearing in both `authoringContributions.field` and `authoringContributions.type` (extend the existing duplicate-name guard in `composeFieldNamespace`, `composed-authoring-helpers.ts:158`). The error message names the colliding path. Satisfies TC7a, TC7b.
- [ ] Extend the namespace gate (`checkUncomposedNamespace`, `psl-column-resolution.ts:84-103`) to exempt `temporal` alongside `db`, `familyId`, and `targetId`. Document the rationale inline (forward-compat with the JS/TS Temporal API). Satisfies TC1, TC3, TC6c, TC8.
- [x] **Diagnostic code work:**
  - **Rename `PSL_INVALID_TYPE_CONSTRUCTOR_ARITY` → `PSL_INVALID_NAMESPACED_CALL_ARITY`.** Discovered during Phase A: that code name doesn't exist. Type-constructor arity errors emit `PSL_INVALID_ATTRIBUTE_ARGUMENT`; field-preset arity errors do the same. Honest rename is a wider refactor (touches genuine attribute-arg uses too) and deferred — see RD11. Field-preset arity errors use `PSL_INVALID_ATTRIBUTE_ARGUMENT` for now.
  - **Added codes**: `PSL_UNKNOWN_FIELD_PRESET`, `PSL_PRESET_AND_DEFAULT_CONFLICT`, `PSL_PRESET_AND_ID_CONFLICT`, `PSL_PRESET_NOT_OPTIONAL`, `PSL_PRESET_NOT_LIST`. (`PSL_PRESET_AND_UPDATED_AT_CONFLICT` was added in Phase A and removed in Phase C alongside the `@updatedAt` attribute path.)
  - **Do not** reuse `PSL_INVALID_DEFAULT_APPLICABILITY` for the preset+`@default` collision — the actual error is "duplicate default," not "not applicable here." Added `PSL_PRESET_AND_DEFAULT_CONFLICT` and used it. Satisfies TC6a–TC6f.
- [ ] Add edge-case validation in the preset resolver:
  - Optional preset (`temporal.updatedAt()?`) → `PSL_PRESET_NOT_OPTIONAL`.
  - List preset (`temporal.updatedAt()[]`) → `PSL_PRESET_NOT_LIST`.
  - Preset + `@id` → hard error.
  - Preset + `@default(...)` → `PSL_PRESET_AND_DEFAULT_CONFLICT`.
  - Preset call inside `@default(...)` arg position → `PSL_INVALID_DEFAULT_EXPRESSION` (existing code).
  - Same field declaring two preset calls → parse-time or resolution-time error. Satisfies TC6d–TC6i.
- [ ] Add a synthetic test fixture (`testns.exampleField()`) in `packages/2-sql/2-authoring/contract-psl/test/fixtures.ts` to prove the dispatch path is generic, not `temporal`-specific. Satisfies TC7.

### Phase B: Re-namespace presets under `temporal.*`

Move the registrations from flat names to the `temporal.*` namespace. Both PSL and TS now consume the same namespaced registry entries.

- [ ] Re-register presets in Postgres at `target.authoring.field.temporal.createdAt` and `target.authoring.field.temporal.updatedAt` (`packages/3-targets/3-targets/postgres/src/core/authoring.ts:92-119`). Delete the flat-named registrations. Satisfies TC1, TC3, TC4.
- [ ] Same for SQLite (`packages/3-targets/3-targets/sqlite/src/core/authoring.ts`). Satisfies TC8.
- [ ] **Consolidation:** the `temporal.{createdAt,updatedAt}` registrations are produced by a single shared helper `temporalAuthoringPresets({ codecId, nativeType })` exported from `@internal/family-sql/control` (`packages/2-sql/9-family/src/core/timestamp-now-generator.ts`). Postgres and SQLite each pass their own `codecId` / `nativeType` pair; the helper owns the rest of the descriptor. This makes byte-equivalence between targets structural and prevents per-target drift if a third SQL target lands.

### Phase C: Remove the `@updatedAt` attribute path

Delete the attribute-based path that's now superseded by the preset surface, plus add the targeted migration hint.

- [ ] Delete the `@updatedAt` attribute path:
  - Remove `'updatedAt'` from `BUILTIN_FIELD_ATTRIBUTE_NAMES` (`psl-field-resolution.ts:64-71`).
  - Delete `reportInvalidUpdatedAt` (lines 143–157), `rejectUpdatedAtOnNonScalar` (lines 159–170), and `lowerUpdatedAtAttribute` (lines 172–241).
  - Delete the `getAttribute(field.attributes, 'updatedAt')` branch in `collectResolvedFields` (lines 265–305).
  - Delete the `@updatedAt` lowering merge in lines 364–376 and 418–428.
- [ ] Add a targeted migration hint to the unknown-attribute diagnostic: a hardcoded `if (name === 'updatedAt')` branch in the diagnostic emitter that appends "Use `temporal.updatedAt()` instead." to the message. The diagnostic code stays `PSL_UNKNOWN_ATTRIBUTE`; only the message text changes. **Suppression:** if the field already declares any `temporal.*` preset, the hint is omitted (don't tell users to do what they already did). Tests cover both presence (TC5a) and suppression (TC5b).
- [ ] Diagnostic-code inventory: for each diagnostic code emitted from the deleted attribute path (`PSL_INVALID_ATTRIBUTE_ARGUMENT`, `PSL_INVALID_DEFAULT_APPLICABILITY`, plus any branch-local codes introduced for `@updatedAt`), run `grep -rn 'CODE_NAME' --include="*.ts" | grep -v node_modules | grep -v dist`. Zero references after deletion → delete the code's constant; non-zero → leave it alone. Paper analysis expects no orphans; the inventory verifies rather than assumes. Mechanical: no judgment calls.

### Phase D: Update fixtures, examples, templates, and docs

- [ ] Update PSL test fixtures and tests:
  - `packages/2-sql/2-authoring/contract-psl/test/interpreter.defaults.test.ts` — replace the attribute-based `@updatedAt` cases (lines 228–377) with preset-based `temporal.updatedAt()` cases. Keep at least one negative test for `@updatedAt` producing `PSL_UNKNOWN_ATTRIBUTE` with the targeted hint, plus one for hint suppression.
  - `packages/2-sql/2-authoring/contract-psl/test/ts-psl-parity.test.ts` (lines 156–207, 246–251, 432–467) — port to `temporal.updatedAt()` ↔ `field.temporal.updatedAt()`. Use a single shared deterministic-sort comparator helper for both targets. Satisfies TC3, TC4, TC5a, TC5b, TC8.
- [ ] Update TS test fixtures:
  - `packages/2-sql/2-authoring/contract-ts/test/contract-builder.dsl.helpers.test.ts:32-47, 230-231, 289-332, 602` — switch to `field.temporal.createdAt()` / `field.temporal.updatedAt()`.
  - `packages/2-sql/2-authoring/contract-ts/test/contract-builder.contract-definition.test.ts:242-369` — same. Satisfies TC4.
- [ ] Update examples and templates:
  - `examples/react-router-demo/prisma/contract.ts` lines 24, 33 (TS) and `contract.prisma` line 4 (PSL).
  - `examples/prisma-8-demo/prisma/contract.ts` lines 32, 43.
  - `packages/1-framework/3-tooling/cli/src/commands/init/templates/code-templates.ts` lines 116, 125, 164, 177. Satisfies TC9.
- [ ] Update documentation in **one canonical location**:
  - `docs/products/psl/README.md` becomes the canonical reference. Lists `temporal.createdAt()`, `temporal.updatedAt()`, `@default(now())`. Documents the namespace exemption, the field-preset dispatch path, and the `@updatedAt` removal with migration hint.
  - `packages/2-sql/2-authoring/contract-psl/README.md` lines 18, 69–70 — replace attribute documentation with a short summary linking to the canonical doc.
  - `packages/2-sql/2-authoring/contract-ts/README.md` lines 19, 112, 139–140, 197–198 and `API.md` lines 20–21 — short summary linking to the canonical doc; reference `field.temporal.*`. Satisfies TC10.

### Phase E: Close-out

- [ ] Verify all 9 acceptance criteria with focused commands listed in the validation gate.
- [ ] Strip repo-wide references to `projects/created-updated-at-authoring/**` (search + remove from any committed READMEs, contributor docs, or PR templates that reference this transient path) and delete the project directory.

### Validation gate

- `pnpm -F @internal/sql-contract-psl test`
- `pnpm -F @internal/sql-contract-ts test`
- `pnpm -F @internal/framework-components test`
- `pnpm -F @internal/sql-runtime test`
- `pnpm -F @internal/sql-orm-client test`
- `pnpm -F @internal/adapter-postgres test`
- `pnpm -F @internal/adapter-sqlite test`
- `pnpm test:packages`
- `pnpm lint:deps`
- `pnpm build`

## Resolved Decisions

- The internal timestamp generator ID is `timestampNow`. (Inherited.)
- Empty update payloads skip all `onUpdate` execution defaults. (Inherited.)
- Cross-row stability uses `RuntimeMutationDefaultGenerator.stableAcrossRows` + `MutationDefaultsOptions.acrossRowsCache`. (Inherited.)
- The PSL `@updatedAt` attribute is **removed**, not retained for back-compat. The unknown-attribute diagnostic gains a targeted hint pointing at `temporal.updatedAt()` whenever it fires for `@updatedAt`. The hint is a **hardcoded `if`-branch** in the diagnostic emitter — no extensible map. The hint is suppressed when the field already declares any `temporal.*` preset.
- The TS surface re-namespaces from `field.{createdAt,updatedAt}` to `field.temporal.{createdAt,updatedAt}`. PSL and TS share **leaf names**, not full paths — this is parallel-leaf-naming, not symmetric path-naming. The cost (one extra TS nesting level) is paid for registry-path parity (single shared comparator helper, eliminated drift class).
- `@default(now())` is **kept** as a parallel, equivalent way to express create-time timestamps. `temporal.createdAt()` is added for symmetry only.
- A `temporal` namespace exemption is added to the PSL namespace gate (alongside `db`, `familyId`, `targetId`) to mark it as a curated SQL-family-shared namespace. The name is chosen for forward-compatibility with the JS/TS Temporal API.
- The PSL field-preset dispatch path is built **generic from day one** (a `getAuthoringFieldPreset` walker), with AC6 explicitly testing genericness via a synthetic test-only preset.
- Field presets resolve **before** type constructors at runtime; presets carry richer semantics (storage + execution defaults + id/unique flags + native type) so the more complete answer wins on ambiguity. Backed by a compose-time collision check that rejects any path appearing in both registries — runtime collisions are made structurally impossible.
- Family-level ID presets (`id.uuidv7`, etc.) are **not** exposed in PSL during this project. The dispatch path supports them, but PSL exposure is a focused follow-up project (~1 day after the dispatch path lands) that can address its own design questions (namespace exemption for `id`, flat-name PSL syntax for bare `uuidv7()`).
- Diagnostic codes touched by the attribute path get a mechanical inventory at the end of Phase C, not aggressive cleanup. Codes used solely by the deleted code path are removed; codes still referenced by the preset path or other attributes stay. Expected outcome: no orphans (`PSL_INVALID_ATTRIBUTE_ARGUMENT` and `PSL_INVALID_DEFAULT_APPLICABILITY` both remain in use), but the inventory verifies rather than assumes.
- Diagnostic codes for namespaced-call arg errors: the planned rename `PSL_INVALID_TYPE_CONSTRUCTOR_ARITY` → `PSL_INVALID_NAMESPACED_CALL_ARITY` was based on a wrong assumption (that code doesn't exist). Reality: type-constructor and field-preset arg errors both emit `PSL_INVALID_ATTRIBUTE_ARGUMENT`. The honest rename to a `PSL_INVALID_NAMESPACED_CALL_ARGUMENT` code would also touch genuine attribute-arg errors and is deferred to a follow-up. New codes that *were* added in this project: `PSL_UNKNOWN_FIELD_PRESET`, `PSL_PRESET_AND_DEFAULT_CONFLICT`, `PSL_PRESET_AND_ID_CONFLICT`, `PSL_PRESET_AND_UPDATED_AT_CONFLICT` (transient — removed in Phase C), `PSL_PRESET_NOT_OPTIONAL`, `PSL_PRESET_NOT_LIST`. Reusing the misleading `PSL_INVALID_DEFAULT_APPLICABILITY` for the preset+`@default` collision is rejected — it's exactly the accumulated-debt pattern the original `@updatedAt`-applicability check exemplified.
- PSL → `instantiateAuthoringFieldPreset` argument coercion runs in the PSL-side `instantiatePslFieldPreset`, not inside the framework-components function. TS keeps its zero-runtime-validation cost; PSL pays the coercion cost only for namespaced-call args.
- Edge cases for preset usage (optional, list, preset+`@id`, preset+`@default`, preset-in-default-arg, double preset on one field) all produce hard errors with stable codes. The preset is a complete field-type declaration; combinations that contradict that are rejected at PSL resolution time.
- **`temporal.updatedAt()` semantics: "last modified time", not "last update time".** The preset registers **both** `onCreate` and `onUpdate` to `timestampNow` and the column is **non-null**. On insert, `updatedAt` equals `createdAt`; on update, it advances. PSL rejects `temporal.updatedAt()?` with `PSL_PRESET_NOT_OPTIONAL`; TS rejects nullable + any `executionDefaults` at contract-build time (`build-contract.ts`). **Rationale:** mirrors Prisma 6 / Rails / Django conventions and preserves the `updatedAt >= createdAt` invariant so `ORDER BY updated_at DESC` works for fresh records too. **Trade-off considered and rejected:** an alternative semantic ("`updatedAt` = last *update*, NULL until first update, nullable column") is more semantically pure but diverges from Prisma 6 and forces query-side `COALESCE(updated_at, created_at)` for activity-sort use cases. The contract IR + runtime can support this alternative shape if a future preset (e.g. `temporal.lastModifiedAt()` with `onUpdate`-only and nullable column) is added, but the corresponding `nullable + onUpdate-only` allowance is **not** speculatively built into `build-contract.ts` — that PR will introduce it alongside a real production user, not as a hook.
- **YAGNI cuts at PR-close.** Forward-compat hooks for hypothetical future generators were removed from the runtime and contract-builder before merge: (1) the `applyOnEmptyUpdate` opt-in on `RuntimeMutationDefaultGenerator` (only ever exercised by a test of itself; empty-update skip is now unconditional in `applyMutationDefaults`), and (2) the `nullable + onUpdate-only` allowance in `build-contract.ts` (dead code w.r.t. `temporal.updatedAt()`; the check is now "nullable + any executionDefaults = error"). Both can be re-added when a real generator/preset needs them, with a test exercising real production code instead of test-only code.
- **AC9 / FR10 canonical-doc clause overtaken by upstream deletion.** Spec FR10 + AC9 named `docs/products/psl/README.md` as the canonical PSL doc carrying the temporal-preset writeup. After this branch was opened, that file was deleted on `main` in commit `b5c3381da` ("docs(planning): elevate PSL authoring to a top-level May workstream") as "significantly stale, unreferenced, and actively misleading." On merge from main, the deletion is accepted: `docs/products/psl/README.md` is gone. The temporal-preset writeup survives in the package READMEs (`packages/2-sql/2-authoring/contract-psl/README.md`, `packages/2-sql/2-authoring/contract-ts/{README.md,API.md}`), which no longer link to the deleted canonical doc. A fresh canonical PSL doc is owned by the May WS5 (PSL authoring) workstream and is out of scope here.

## Open Questions

_All questions raised during planning have been resolved. Future questions discovered during implementation should be tracked here and reviewed at milestone gates._
