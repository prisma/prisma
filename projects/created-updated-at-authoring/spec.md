# Summary

Add first-class create/update timestamp defaults to the SQL authoring surfaces via a **field-preset registry path in PSL**, mirroring the existing TypeScript field-preset mechanism. SQL PSL exposes `temporal.createdAt()` and `temporal.updatedAt()` as namespaced field-type expressions (analogous to `pgvector.Vector(1536)`); SQL TypeScript exposes `field.temporal.createdAt()` and `field.temporal.updatedAt()` from the same registry. The Prisma-flavored `@updatedAt` attribute path that landed earlier on this branch is removed in favor of the preset path. The contract IR, runtime, and adapter wiring are unchanged.

# Context

## Vocabulary

Two registry concepts appear throughout this document:

- **Field preset.** A registered field-type call expression that contributes any combination of `default` (storage default), `executionDefaults` (mutation defaults — `onCreate`/`onUpdate`), `id` (id-flag), `unique` (unique-flag), and a codec/native-type pair. Today resolved by `instantiateAuthoringFieldPreset` in `framework-authoring.ts:382-409`.
- **Type constructor.** A registered field-type call expression that contributes only `codecId` / `nativeType` / `typeParams`. Used for things like `pgvector.Vector(1536)` and scalar aliases. Today resolved by `instantiatePslTypeConstructor` in `psl-column-resolution.ts:129`.

Field presets are strictly richer; type constructors are a subset of what a preset can express.

## At a glance

Prisma users expect timestamp fields to be declarative, not hand-written at every mutation call site. Prisma Next now expresses this via a typed preset call — the preset names its own codec, so there is no opportunity for the surface to combine the helper with a non-timestamp scalar.

```prisma
// schema.prisma
model User {
  id        Int                    @id @default(autoincrement())
  email     String
  createdAt temporal.createdAt()
  updatedAt temporal.updatedAt()
}
```

```ts
// schema.ts
const User = model('User', {
  fields: {
    email: field.text(),
    createdAt: field.temporal.createdAt(),
    updatedAt: field.temporal.updatedAt(),
  },
});
```

`temporal.createdAt()` lowers to the same storage column default as `@default(now())`, so the database owns the create-time value. `temporal.updatedAt()` lowers to `contract.execution.mutations.defaults` with both `onCreate` and `onUpdate`, so Prisma Next fills the timestamp on insert and on non-empty update payloads when the caller does not provide an explicit value. `@default(now())` continues to work as a back-compat alternative to `temporal.createdAt()`.

## Problem

The first three milestones of this project shipped `@updatedAt` as a Prisma-flavored PSL attribute, validated by a codec-applicability check (`packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts:222`):

```ts
if (!generatorDescriptor.applicableCodecIds.includes(input.descriptor.codecId)) {
  // emit "@updatedAt requires a timestamp-compatible field, received codecId X"
}
```

That check exists because `@updatedAt` is **type-blind**: it is syntactically legal on `String`, `Int`, or any other scalar, and only the codec-applicability lookup rejects it. Every PSL attribute that wraps a generator is condemned to invent a similar guard, and each such guard couples PSL to specific codec IDs from each target adapter.

wmadden flagged that the right shape — already used in PSL for `pgvector.Vector(1536)` — is a **namespaced field-position call**, where the call carries the codec inside its `output` descriptor. There is no opportunity for the user to pair the helper with the wrong scalar, because the preset *is* the scalar declaration. Validation of "is this codec a timestamp" downgrades from a user-error diagnostic to a registry-coherence assertion run once at composition time.

The TypeScript authoring surface already has the registry shape this pivot needs:

- `AuthoringFieldPresetDescriptor` carries `output` (codecId/nativeType), `executionDefaults`, `default`, etc. (`packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts:74-141`).
- Postgres and SQLite each register `createdAt` and `updatedAt` field presets at `target.authoring.field.{createdAt,updatedAt}` with executionDefaults wired to `timestampNow` (`packages/3-targets/3-targets/postgres/src/core/authoring.ts:92-119`, equivalent SQLite file).
- TS composition turns those into callable `field.createdAt()` / `field.updatedAt()` helpers (`packages/2-sql/2-authoring/contract-ts/src/composed-authoring-helpers.ts:187-198`).

The missing piece is **PSL never reads `authoringContributions.field`**. The PSL interpreter walks `authoringContributions.type` for type-constructor calls (`getAuthoringTypeConstructor`, `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts:54-67`) but has no symmetric `getAuthoringFieldPreset` walker. As a result, the only authoring surface available in PSL today for execution-default fields is the attribute path, with all the codec-validation costs that implies.

## Approach

Make PSL learn the field-preset registry the same way it already learns the type-constructor registry, then re-route timestamp authoring through it.

1. **Add a PSL field-preset dispatch path.** When the parser encounters a namespaced call expression in field-type position (`temporal.updatedAt()`), the interpreter resolves it against `authoringContributions.field` first; if no field preset matches, fall back to the existing type-constructor resolution. Resolution returns the same `default` / `executionDefaults` / `id` / `unique` contributions that TS already produces via `instantiateAuthoringFieldPreset`.

2. **Re-namespace the existing presets under `temporal`.** Move `createdAt` / `updatedAt` from `target.authoring.field.{createdAt,updatedAt}` to `target.authoring.field.temporal.{createdAt,updatedAt}`. PSL invokes them as `temporal.updatedAt()`; TS invokes them as `field.temporal.updatedAt()`. Both consume the same registry entry, so byte-equivalence between PSL and TS is preserved by construction. The name `temporal` is chosen for forward-compatibility with the JS/TS [Temporal API](https://tc39.es/proposal-temporal/docs/), which Prisma Next's date codecs are expected to migrate toward; `temporal.*` is therefore the natural namespace for any future date/time helpers (`temporal.now()`, `temporal.duration()`, etc.).

3. **Add a `temporal` namespace exemption** to PSL's namespace gate (`checkUncomposedNamespace`, `psl-column-resolution.ts:84-103`), alongside the existing `db` / `familyId` / `targetId` exemptions. `temporal` is a curated SQL-family-shared namespace; it does not require explicit composition by the user.

4. **Remove the `@updatedAt` attribute path.** Drop `'updatedAt'` from `BUILTIN_FIELD_ATTRIBUTE_NAMES`; delete `lowerUpdatedAtAttribute`, `reportInvalidUpdatedAt`, `rejectUpdatedAtOnNonScalar`, and the relation-field updatedAt rejection branch in `collectResolvedFields`. With the attribute name removed, `@updatedAt` produces a `PSL_UNKNOWN_ATTRIBUTE` diagnostic enhanced with a targeted migration hint pointing at `temporal.updatedAt()`. This is non-breaking because the attribute was added on this same branch and has never shipped.

5. **Keep `@default(now())` as the create-time storage-default path.** `temporal.createdAt()` is added for symmetry, but the project does not deprecate `@default(now())` — it remains the spelling that mirrors Prisma 6 PSL.

6. **Do not change the contract IR, the runtime, the adapter mutation-default generators, or the ORM-client cross-row stability work.** `ExecutionMutationDefault`, `MutationDefaultGeneratorDescriptor`, `RuntimeMutationDefaultGenerator.stableAcrossRows`, and `MutationDefaultsOptions.acrossRowsCache` survive unchanged from the prior milestones.

The net effect: the PSL parser already tolerates `temporal.updatedAt()` (the type-constructor regex matches dotted identifiers and paren-call arguments — `packages/1-framework/2-authoring/psl-parser/src/parser.ts:482-552`). The pivot adds a second consumer of the AST node it produces, plus the namespace exemption and registry move, plus deletion of the attribute path. No PSL grammar or AST changes are required.

# Requirements

## Functional Requirements

- **FR1.** PSL accepts `temporal.createdAt()` and `temporal.updatedAt()` as field-type expressions on `model` field declarations for SQL targets (Postgres and SQLite).
- **FR2.** `temporal.createdAt()` lowers to a storage column default equivalent to `@default(now())` (`{ kind: 'function', expression: 'now()' }`) and emits no execution mutation default.
- **FR3.** `temporal.updatedAt()` lowers to an execution mutation default with both `onCreate` and `onUpdate` set to the target-provided `timestampNow` generator, and to a non-null timestamp storage column.
- **FR4.** SQL TypeScript authoring exposes `field.temporal.createdAt()` and `field.temporal.updatedAt()` from the same registry entries the PSL surface consumes; equivalent PSL and TS models emit byte-equivalent contracts after deterministic sorting (verified via a single shared comparator helper used by both Postgres and SQLite parity tests).
- **FR5.** PSL no longer recognizes `@updatedAt` as a known attribute. References to it produce the standard `PSL_UNSUPPORTED_FIELD_ATTRIBUTE` diagnostic, enhanced with a targeted migration hint ("Use `temporal.updatedAt()` as a field-preset call instead."). The hint is implemented as a hardcoded branch in `getRemovedAttributeHint()` — not an extensible map. The hint is suppressed when the field already declares any `temporal.*` preset, to avoid telling users to do what they already did. *(Note: an earlier draft of this requirement called for `PSL_UNKNOWN_ATTRIBUTE`; that code name doesn't exist — the actual code is `PSL_UNSUPPORTED_FIELD_ATTRIBUTE`. Phase C uses the existing code with the targeted hint appended to its message.)*
- **FR6.** PSL gains a generic field-preset dispatch path that walks `authoringContributions.field` symmetrically with the existing `authoringContributions.type` walker. The path is registry-driven, not hardcoded to `temporal.*`. At runtime, field-preset resolution runs first; if no field preset matches the path, resolution falls back to the type-constructor walker.
- **FR6a.** Composition-time collision check: when authoring contributions are composed, the framework rejects any path that appears in both `authoringContributions.field` and `authoringContributions.type` with a clear "ambiguous registry path" error. This makes runtime collisions structurally impossible and surfaces registry-author mistakes at registration time, not at field-resolution time.
- **FR7.** PSL invalid-usage diagnostics for `temporal.*` calls (and any field-preset call) derive from preset-instantiation rules and PSL surface rules only; there is no codec-applicability diagnostic on the authoring path. The complete set, with implemented diagnostic codes:
  - **Wrong arity / wrong-typed arg** (`temporal.updatedAt(123)`) → `PSL_INVALID_ATTRIBUTE_ARGUMENT`. This is the same code type-constructor arity errors use today; the name is historically misleading (it names the attribute case, but covers any namespaced-call arg failure). Renaming to a `PSL_INVALID_NAMESPACED_CALL_ARGUMENT` code would also touch genuine attribute-arg errors and is deferred to a follow-up so this project's scope stays focused.
  - **Unknown preset name within a known curated namespace** (`temporal.foo()`) → `PSL_UNKNOWN_FIELD_PRESET` (new code). Curated namespaces are reserved for field presets, so a miss is a typo, not a request to look elsewhere.
  - **Unknown namespace, not extension-composed** (`weather.updatedAt()`) → existing `PSL_EXTENSION_NAMESPACE_NOT_COMPOSED`.
  - **Preset call combined with `@default(...)` on the same field** (`updatedAt temporal.updatedAt() @default(now())`) → `PSL_PRESET_AND_DEFAULT_CONFLICT` (new code, separate from `PSL_INVALID_DEFAULT_APPLICABILITY` because the actual error is duplicate-default, not applicability).
  - **Preset call on an optional field** (`updatedAt temporal.updatedAt()?`) → `PSL_PRESET_NOT_OPTIONAL` (new code). The preset's whole point is that the system owns the value; optional contradicts that.
  - **Preset call on a list field** (`updatedAt temporal.updatedAt()[]`) → `PSL_PRESET_NOT_LIST` (new code).
  - **Preset call combined with `@id` when the preset doesn't itself contribute id semantics** (`id temporal.updatedAt() @id`) → `PSL_PRESET_AND_ID_CONFLICT` (new code). Presets express id semantics via the descriptor's `id` flag.
  - **Preset call combined with `@updatedAt`** → after Phase C, `@updatedAt` is no longer a known attribute, so this case produces `PSL_UNSUPPORTED_FIELD_ATTRIBUTE` (the standard unknown-attribute diagnostic). The migration hint is *suppressed* when the field already declares a `temporal.*` preset, so the user isn't told to do what they just did.
  - **Preset call inside `@default(...)` argument position** (`f DateTime @default(temporal.updatedAt())`) → existing `PSL_INVALID_DEFAULT_EXPRESSION` or equivalent. Not yet covered by a focused test; either parser-rejected or default-function-registry-rejected today.
  - **Same field declaring two preset calls** (`f temporal.updatedAt() temporal.createdAt()`) → likely already a parse error; covered by an existing parser regression test.
- **FR8.** `@default(now())` continues to work as a create-time storage default on `DateTime` columns, with semantics unchanged.
- **FR9.** Runtime mutation default generators continue to fill omitted `updatedAt` on create and non-empty update; explicit user values still win; empty update payloads still skip all `onUpdate` execution defaults; bulk inserts share one timestamp across rows via `acrossRowsCache`. (Inherited from the prior milestones; see "Inherited Foundation" in `plan.md`.)
- **FR10.** Documentation reflects the new preset-based PSL vocabulary in **one canonical location** (`docs/products/psl/README.md`), with package READMEs (`contract-psl/README.md`, `contract-ts/{README.md,API.md}`) carrying short summaries and links to the canonical doc.

## Non-Functional Requirements

- **NFR1.** No new contract IR concept. `ExecutionMutationDefault`, `MutationDefaultGeneratorDescriptor` (with `applicableCodecIds`), and the runtime application code from the inherited foundation survive unchanged.
- **NFR2.** PSL and TS authoring for the same model and target emit byte-equivalent storage and execution sections after deterministic sorting.
- **NFR3.** No codec-type-aware validation on the authoring path. `applicableCodecIds` continues to exist on `MutationDefaultGeneratorDescriptor` but is enforced as a registry-coherence assertion at composition time, not as a user-facing diagnostic.
- **NFR4.** Existing generated ID helpers (`uuidv4`, `uuidv7`, `nanoid`, `cuid2`, `ulid`, `ksuid`) keep their current TS behavior. Once PSL gains the field-preset dispatch path, these become invokable in PSL too (e.g. `id.uuidv7()`), but exposing them is out of scope for this project — the dispatch path must support them without exposing them by default.
- **NFR5.** The `temporal` namespace exemption is the only new exemption; the existing namespace gate continues to require explicit extension composition for non-curated namespaces (`pgvector.*`, etc.).

## Non-goals

- Validating which attributes belong to a given codec type — eliminated by construction with the field-preset path.
- Maintaining `@updatedAt` attribute back-compat. The attribute was added on this branch and has never been released; removal is a clean deletion.
- Adding triggers, database-side `updatedAt` magic, or any non-application-side timestamp source.
- Changing the runtime, the ORM-client, the adapter mutation-default generators, or any IR shape (`ExecutionMutationDefault`, `applicableCodecIds`, `stableAcrossRows`, `acrossRowsCache`).
- Inferring timestamp semantics from field names during introspection.
- Exposing the family-level ID helpers (`id.uuidv7`, etc.) as PSL syntax. The dispatch path supports it; the registry does not enable it in this project.
- Changing Prisma 6 ORM compatibility beyond the explicit authoring surfaces described here. `@default(now())` remains the spelling that mirrors Prisma 6.

# Acceptance Criteria

- [ ] **AC1.** A PSL model with `createdAt temporal.createdAt()` emits a non-null timestamp column with `default: { kind: 'function', expression: 'now()' }` and no execution mutation default. The equivalent `createdAt DateTime @default(now())` PSL emits the same contract shape. Covers FR2, FR8, NFR2.
- [ ] **AC2.** A PSL model with `updatedAt temporal.updatedAt()` emits a non-null timestamp column and one execution mutation default entry with both `onCreate` and `onUpdate` referencing the `timestampNow` generator. Covers FR1, FR3, NFR1.
- [ ] **AC3.** The equivalent SQL TypeScript model using `field.temporal.createdAt()` and `field.temporal.updatedAt()` emits the same contract shape as the PSL model for Postgres and SQLite. The comparison uses one shared deterministic-sort comparator helper used by both targets' parity tests. Covers FR4, NFR2.
- [x] **AC4.** PSL `@updatedAt` produces `PSL_UNSUPPORTED_FIELD_ATTRIBUTE` enhanced with a targeted migration hint pointing at `temporal.updatedAt()`. The diagnostic message includes the literal preset spelling so users can copy-paste the fix. The diagnostic carries no codec-applicability messaging. The `BUILTIN_FIELD_ATTRIBUTE_NAMES` set no longer contains `'updatedAt'`. **The hint is suppressed when the field already declares any `temporal.*` preset.** Covers FR5.
- [x] **AC5a.** `temporal.updatedAt(123)` produces `PSL_INVALID_ATTRIBUTE_ARGUMENT` with a span on the offending argument. (Code name is historically misleading but matches what type-constructor arity errors emit today; honest rename deferred — see FR7.) Covers FR7 (arity).
- [x] **AC5b.** `temporal.foo()` produces `PSL_UNKNOWN_FIELD_PRESET` with a span on the preset name and a message including the namespace and full path. Covers FR7 (unknown preset).
- [ ] **AC5c.** `weather.updatedAt()` (unknown namespace, not extension-composed) produces `PSL_EXTENSION_NAMESPACE_NOT_COMPOSED`. (Already worked via the existing namespace gate; no focused test added in Phase A.) Covers FR7 (unknown namespace).
- [x] **AC5d.** `updatedAt temporal.updatedAt() @default(now())` produces `PSL_PRESET_AND_DEFAULT_CONFLICT` (new code, distinct from `PSL_INVALID_DEFAULT_APPLICABILITY`). Covers FR7 (double default).
- [x] **AC5e.** `updatedAt temporal.updatedAt()?` produces `PSL_PRESET_NOT_OPTIONAL`. Covers FR7 (optional).
- [ ] **AC5f.** `updatedAt temporal.updatedAt()[]` produces `PSL_PRESET_NOT_LIST`. (Code emits the diagnostic when the parser reaches that branch; verify in Phase B once real `temporal.*` presets are registered. Likely a parser-level reject in practice.) Covers FR7 (list).
- [ ] **AC5g.** `f DateTime @default(temporal.updatedAt())` produces `PSL_INVALID_DEFAULT_EXPRESSION` (or the existing closest stable code). (Untested — exercises the default-function-registry path, not the field-preset dispatch path.) Covers FR7 (preset in default-arg position).
- [x] **AC5h.** `id temporal.updatedAt() @id` produces `PSL_PRESET_AND_ID_CONFLICT` (new code). Covers FR7 (preset + `@id`).
- [ ] **AC5i.** `f temporal.updatedAt() temporal.createdAt()` produces a parse-time or resolution-time error. (Likely already a parse error; verify in Phase B.) Covers FR7 (double preset on one field).
- [x] **AC5j.** ~~`f temporal.updatedAt() @updatedAt` produces `PSL_PRESET_AND_UPDATED_AT_CONFLICT`.~~ **Superseded.** Phase C removed the `@updatedAt` attribute path; the half-migrated case now produces `PSL_UNSUPPORTED_FIELD_ATTRIBUTE` with the migration hint *suppressed* (see AC4) so users who already migrated aren't told to do what they just did.
- [ ] **AC6.** The PSL field-preset dispatch path is generic. A test fixture registers a synthetic field preset under a custom namespace (e.g. `testns.exampleField()`) and confirms PSL resolves it through the same path used by `temporal.*`. Covers FR6.
- [ ] **AC6a.** Composition rejects collisions across registries: a test fixture that registers the same path in both `authoringContributions.field` and `authoringContributions.type` triggers a deterministic error at composition time, not at PSL resolution. The error names the colliding path. A second test fixture registers the same path twice within the field registry and confirms the existing duplicate-name guard still fires (regression). Covers FR6a.
- [ ] **AC7.** SQLite PSL and TypeScript authoring accept the same `temporal.createdAt()` / `temporal.updatedAt()` model as Postgres, emit SQLite-native timestamp codecs/defaults, and the SQL PSL provider remains target-generic. Covers FR1, FR3, FR4, NFR2.
- [ ] **AC8.** Examples and templates updated:
  - `examples/react-router-demo/prisma/contract.{ts,prisma}` uses the preset surface.
  - `examples/prisma-8-demo/prisma/contract.ts` uses `field.temporal.*`.
  - `packages/1-framework/3-tooling/cli/src/commands/init/templates/code-templates.ts` PSL/TS templates use the new preset surface for `updatedAt`.
- [ ] **AC9.** Documentation reflects the preset surface in one canonical location:
  - `docs/products/psl/README.md` — canonical reference; lists `temporal.createdAt()`, `temporal.updatedAt()`, and `@default(now())`. Documents the namespace exemption and the field-preset dispatch path.
  - `packages/2-sql/2-authoring/contract-psl/README.md` — short summary linking to the canonical doc.
  - `packages/2-sql/2-authoring/contract-ts/{README.md,API.md}` — short summary linking to the canonical doc; references `field.temporal.createdAt()` / `field.temporal.updatedAt()` and notes the `@updatedAt` attribute removal. Covers FR10.

**CI gates (not ACs).** The inherited runtime/ORM-client tests in `packages/2-sql/5-runtime/test/sql-context.test.ts` and `packages/3-extensions/sql-orm-client/test/collection-mutation-defaults.test.ts` continue to pass without behavior changes, including bulk-update cross-row-stability behavior (`acrossRowsCache` for `op: 'update'`). These are CI gates because the pivot does not modify runtime semantics; verifying non-regression is a continuous condition, not a single milestone deliverable.

# Other Considerations

## Security

This feature does not introduce a new data access path. The timestamp generator (unchanged from the inherited foundation) uses local process time and does not read environment variables or database credentials.

## Cost

No meaningful runtime cost. The runtime change in the inherited foundation already scans mutation defaults per table; this project leaves the runtime untouched.

PSL parse cost is negligibly higher: each namespaced field-type call now consults two registries (field presets first, type constructors second). Both are in-memory map lookups.

## Observability

No new telemetry. Existing runtime errors for missing mutation default generators continue to fire if a contract references the timestamp generator without a runtime component that provides it.

The deletion of `@updatedAt` produces a `PSL_UNKNOWN_ATTRIBUTE` diagnostic with a targeted "Use `temporal.updatedAt()` instead" hint — clear, actionable, and self-documenting for users porting Prisma 6 schemas.

## Data Protection

Created and updated timestamps are metadata and may still be user-associated data in application contexts. This project does not change retention, masking, or export behavior.

## Analytics

No product analytics required.

## Migration / Compatibility

- The `@updatedAt` PSL attribute landed on this branch (commit `682714ee`) and is not yet released. Removing it is a clean deletion with no external consumers. Users copying `@updatedAt` from Prisma 6 docs/schemas will see a targeted `PSL_UNKNOWN_ATTRIBUTE` diagnostic suggesting the `temporal.updatedAt()` preset spelling.
- The TS surface `field.createdAt()` / `field.updatedAt()` also landed on this branch and is removed in favor of `field.temporal.createdAt()` / `field.temporal.updatedAt()`. No external consumers.
- Existing test fixtures and example apps on `feat/created-updated-at-authoring` need to be updated to the preset surface (covered by AC8).
- `@default(now())` is unchanged and continues to be supported indefinitely.

# References

## Implementation touchpoints

- PSL parser (already supports namespaced calls): `packages/1-framework/2-authoring/psl-parser/src/parser.ts:482-552`.
- PSL type-constructor walker (model for the new field-preset walker): `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts:54-67` (`getAuthoringTypeConstructor`).
- PSL namespace gate (where the `temporal` exemption goes): `packages/2-sql/2-authoring/contract-psl/src/psl-column-resolution.ts:84-103` (`checkUncomposedNamespace`).
- PSL `@updatedAt` attribute path to delete: `packages/2-sql/2-authoring/contract-psl/src/psl-field-resolution.ts` lines 64–71 (BUILTIN_FIELD_ATTRIBUTE_NAMES), 143–241 (`reportInvalidUpdatedAt`, `rejectUpdatedAtOnNonScalar`, `lowerUpdatedAtAttribute`), 265–305 (relation-field rejection), 364–376, 418–428 (lowering merge).
- TS composition (already walks `field` namespace): `packages/2-sql/2-authoring/contract-ts/src/composed-authoring-helpers.ts:187-198`.
- TS field-preset descriptor: `packages/1-framework/1-core/framework-components/src/shared/framework-authoring.ts:74-141`, `382-409` (`instantiateAuthoringFieldPreset`).
- Postgres preset registration to re-namespace: `packages/3-targets/3-targets/postgres/src/core/authoring.ts:92-119`.
- SQLite preset registration to re-namespace: `packages/3-targets/3-targets/sqlite/src/core/authoring.ts`.
- Family-level shared timestamp generator (unchanged): `packages/2-sql/9-family/src/core/timestamp-now-generator.ts`.

## Reference patterns

- `pgvector.Vector(N)` namespaced field-type call: `packages/1-framework/2-authoring/psl-parser/test/parser.test.ts:118-119, 156, 192-193`.
- pgvector authoring registration: `packages/3-extensions/pgvector/src/core/authoring.ts`.
- Family-level nested field presets (already register `id.uuidv7`, `id.uuidv4`, etc.): `packages/2-sql/9-family/src/core/authoring-field-presets.ts:36-210`.

## Spec / plan history

- Original spec milestones (attribute-based `@updatedAt`): commits `4310a6a7`, `682714ee`, `ece4e185`.
- ORM client wiring + cross-rows stability: commits `146242c1`, `14ff4548`.
- Plan: `projects/created-updated-at-authoring/plan.md`.

# Resolved Decisions

- **RD1.** The internal timestamp generator ID remains `timestampNow`. (Inherited.)
- **RD2.** Empty update payloads skip all `onUpdate` execution defaults. (Inherited.)
- **RD3.** Bulk-insert timestamp stability is encoded as `RuntimeMutationDefaultGenerator.stableAcrossRows` + `MutationDefaultsOptions.acrossRowsCache`. (Inherited.)
- **RD4.** The PSL `@updatedAt` attribute is **removed**, not retained for back-compat. The pivot is the whole point of this project; keeping the attribute would re-introduce the codec-validation problem the project exists to solve. To soften the migration, `PSL_UNKNOWN_ATTRIBUTE` is enhanced with a targeted hint suggesting `temporal.updatedAt()` whenever the unknown attribute is `@updatedAt`. The hint is implemented as a hardcoded `if`-branch in the diagnostic emitter — no extensible map. The hint is suppressed when the field already declares any `temporal.*` preset, so users who already migrated do not get told to do what they already did.
- **RD5.** The TS surface re-namespaces from `field.{createdAt,updatedAt}` to `field.temporal.{createdAt,updatedAt}`. PSL and TS share **leaf names** (`createdAt`, `updatedAt`) — they do not share full paths. PSL invokes them in field-type position (`temporal.updatedAt()`); TS invokes them under the `field` root (`field.temporal.updatedAt()`). This is parallel-leaf-naming, not symmetric path-naming. The cost: TS gains one nesting level (`field.createdAt()` → `field.temporal.createdAt()`). The benefit: registry-path parity makes fixture-comparator helpers trivial to write — both surfaces consume the exact same `target.authoring.field.temporal.{createdAt,updatedAt}` registry entry, eliminating an entire class of drift bugs between PSL and TS authoring.
- **RD6.** `@default(now())` is **kept** as a parallel, equivalent way to express create-time timestamps. `temporal.createdAt()` is added for symmetry, not as a replacement. Users who want Prisma-6-shaped PSL keep `@default(now())`; users who want full preset symmetry use `temporal.createdAt()`.
- **RD7.** PSL adds a `temporal` exemption to the namespace gate, alongside `db` / `familyId` / `targetId`. The exemption marks `temporal` as a curated SQL-family-shared namespace, not an opt-in extension. The name is chosen for forward-compatibility with the JS/TS Temporal API (date codecs are expected to migrate to Temporal-backed representations).
- **RD8.** The PSL field-preset dispatch path is built **generic from day one**: a `getAuthoringFieldPreset` walker symmetric with the existing `getAuthoringTypeConstructor` walker. AC6 explicitly tests genericness via a synthetic test-only preset, so the path doesn't decay into a `temporal`-specific shortcut.
- **RD9.** Field presets resolve **before** type constructors at runtime: `getAuthoringFieldPreset` runs first, with a fallback to `getAuthoringTypeConstructor` on miss. Rationale: presets carry richer semantics (storage default + execution defaults + id/unique flags + native type) than type constructors (`codecId`/`nativeType`/`typeParams` only), so when ambiguous, the more complete answer wins. Belt-and-suspenders: a compose-time collision check (FR6a, AC6a) makes runtime collisions structurally impossible by rejecting any path registered in both `authoringContributions.field` and `authoringContributions.type` — same pattern `composeFieldNamespace` already uses for within-registry duplicates (`composed-authoring-helpers.ts:158`).
- **RD10.** Family-level ID presets (`id.uuidv7`, `id.uuidv4`, `id.ulid`, `id.nanoid`, `id.cuid2`, `id.ksuid`, plus their flat aliases `field.uuid`, `field.ulid`, etc.) are **not** exposed in PSL during this project, even though M5's dispatch path will technically support them. Rationale: project-scoping discipline (this project is timestamp authoring, not generic PSL preset exposure); the flat-name PSL syntax question deserves its own focused discussion (bare `uuidv7()` collides with the namespace gate's no-dot assumption); and the follow-up cost after the dispatch path lands is small (~1 day: add `id` to the namespace exemption, write PSL tests, update docs). A follow-up issue should be filed once the pivot lands.
- **RD11.** Diagnostic codes for namespaced-call arg errors. The original draft of this RD called for renaming `PSL_INVALID_TYPE_CONSTRUCTOR_ARITY` → `PSL_INVALID_NAMESPACED_CALL_ARITY`. **Reality discovered during Phase A**: that code name doesn't exist. Type-constructor arity errors today emit `PSL_INVALID_ATTRIBUTE_ARGUMENT` (a code shared with genuine attribute-arg errors like `@id(badarg)`). A faithful rename to `PSL_INVALID_NAMESPACED_CALL_ARGUMENT` would also need to disambiguate from attribute uses, which is a wider refactor than this project warrants. **Decision**: field-preset arity/arg errors emit the same `PSL_INVALID_ATTRIBUTE_ARGUMENT` as type-constructor arity errors do today, accepting the historical name. The honest rename is deferred to a follow-up project. New codes that *were* added in this project: `PSL_UNKNOWN_FIELD_PRESET`, `PSL_PRESET_AND_DEFAULT_CONFLICT`, `PSL_PRESET_AND_ID_CONFLICT`, `PSL_PRESET_AND_UPDATED_AT_CONFLICT` (transient — disappears in Phase C with the `@updatedAt` attribute path), `PSL_PRESET_NOT_OPTIONAL`, `PSL_PRESET_NOT_LIST`. The double-default conflict for preset + `@default` deliberately uses `PSL_PRESET_AND_DEFAULT_CONFLICT` rather than reusing `PSL_INVALID_DEFAULT_APPLICABILITY` — the actual error is "duplicate default," not "not applicable here." Reusing the misleading code is exactly the accumulated-debt pattern the original `@updatedAt`-applicability check exemplified; we don't repeat it.
- **RD12.** PSL → `instantiateAuthoringFieldPreset` argument coercion. The TS authoring surface feeds `instantiateAuthoringFieldPreset` arguments that have already passed through TypeScript's static typing. PSL feeds it arguments produced by the parser as untyped AST nodes. To reconcile, the PSL field-preset resolver runs an **arg-coercion step** before invoking `instantiateAuthoringFieldPreset`: each AST argument is coerced to the descriptor's declared shape (`number`, `string`, `boolean`, `object`-with-typed-properties), with mismatches producing a stable `PSL_INVALID_NAMESPACED_CALL_ARGUMENT` diagnostic. The function itself remains typed-input-only — TS keeps its zero-runtime-validation cost. The synthetic preset in AC6 uses arity-zero, so today's tests don't bite this path; a follow-up arity-non-zero synthetic preset should be added once the pattern stabilizes (tracked as an in-implementation discovery, not a project AC).

# Open Questions

_All questions raised during planning have been resolved. Future questions discovered during implementation will be tracked in `plan.md` and reviewed at milestone gates._
