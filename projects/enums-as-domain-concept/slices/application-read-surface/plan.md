# Dispatch plan — application-read-surface (TML-2852)

Slice spec: [`./spec.md`](./spec.md). Three dispatches, one per surface — typed I/O, the
`db.enums` runtime surface, and Postgres declaration-order `ORDER BY`. They share **no
hand-off**: each builds independently on slice 1 (merged), so order is for review
coherence, not dependency. Executed D1 → D3; **D3 carries the slice-wide additivity
gate**. The slice-DoD is the union of all three (type-tests in both lanes + `db.enums`
runtime tests + the ORDER-BY integration test). All additive/dark — no fixture is
authored with `enumType`, so `fixtures:check` stays zero-diff. Implementer tier:
sonnet-mid; reviewer: opus.

### Dispatch 1: value-union typing — narrow enum I/O (R4, R5)

- **Outcome:** An `enumType`-authored field's read **output** and write **input** are
  statically the enum's value union (e.g. `'user' | 'admin'`), not `string`, in **both**
  the ORM and query-builder lanes. Type-tests assert the literal tuple survives each hop
  (`enumType` const-generics → authored `Definition` → `FieldOutputType` → query I/O) and
  that an out-of-union write literal is a compile error.
- **Builds on:** Slice 1 (merged) — the domain `enum` entity, the field/column `valueSet`
  ref, and `enumType`'s literal-preserving handle; the spec's chosen design. Independent
  of D2/D3.
- **Hands to:** A typed-contract surface where enum fields carry their value union — the
  narrowing both lanes inherit through the emitted `FieldOutputTypes` TypeMap.
- **Focus:** `FieldOutputType` and its write-input counterpart in
  `contract-ts/src/contract-types.ts` — resolve the field/column `valueSet` to the
  referenced enum's value tuple **in the authored `Definition`** (literals preserved; not
  emitted JSON, which widens to `string[]` — spec open question 2) and narrow the codec
  `string` to that union; nullable stays `… | null`. Type-tests (`*.test-d.ts`) in
  contract-ts and in the ORM + query-builder lanes; fall back to per-lane
  `ComputeColumnJsType` / `ExtractOutputType` only if a lane bypasses `FieldOutputTypes`.
  The literal-propagation lookup is the design-risk — an `expectTypeOf` per hop localizes
  any widening. **Out:** runtime `db.enums` (D2), ORDER BY (D3).

### Dispatch 2: `db.enums.<Name>` runtime surface (R6)

- **Outcome:** `db.enums.<Name>` resolves at runtime and the type level, exposing
  `.values` (ordered literal tuple), `.members.<Name>` → the member **value**, `.names`,
  `.has`, `.nameOf`, `.ordinalOf`, built from the contract's domain `enum` entity. Runtime
  tests cover the accessors; a type-test asserts the literal `values` tuple does not widen.
- **Builds on:** Slice 1 — the domain `enum` entity (ordered `{ name, value }` members)
  and `enumType`'s handle deriving these accessors; the spec's chosen design. Independent
  of D1/D3.
- **Hands to:** A client-side enum introspection surface — the first IR-entity accessor
  map on `db` (the `table.columns.x` precedent), shaped for non-breaking generalization.
- **Focus:** the ORM-client Proxy (`sql-orm-client/src/orm.ts`, ~line 56) — add an `enums`
  branch resolving `db.enums.<Name>` against `contract.domain.namespaces[ns].enum`; a new
  enum-accessor module wrapping a `ContractEnum` into the handle shape (reuse slice-1's
  derivation if exposed, else mirror it). Runtime tests + the literal-tuple type-test.
  **Out:** field-I/O typing (D1), ORDER BY (D3).

### Dispatch 3: declaration-order `ORDER BY` — Postgres (R8) + slice additivity gate

- **Outcome:** `ORDER BY` on an enum column emits
  `array_position(ARRAY[v1, v2, …]::text[], <col>)` from the storage value-set's ordered
  `values` in the Postgres renderer; a PGlite integration test confirms rows sort by
  declaration order (not lexically), including a nullable-column case. **Slice additivity
  gate:** `build → pnpm i → fixtures:check` is byte-identical zero-diff; full
  `pnpm typecheck` clean; `lint:casts` ≤ 0.
- **Builds on:** Slice 1 — the storage value-set's ordered `values` + the column
  `valueSet`; the spec's chosen design. Independent of D1/D2.
- **Hands to:** The slice-DoD — enums sort by declaration order, and the whole slice
  (D1 + D2 + D3) regresses nothing. Closes the slice; hands to the cutover (TML-2853).
- **Focus:** the Postgres `sql-renderer` ORDER BY path
  (`postgres/src/core/sql-renderer.ts`, ~line 194) — intercept a column-ref order item
  whose column carries a `valueSet` and render `array_position(...)` from
  `contract.storage.namespaces[ns].entries.valueSet[name].values`; the bare-column path is
  unchanged otherwise. PGlite integration test (sort + nullable). This dispatch runs the
  final slice-wide additivity / typecheck sweep. **Out:** non-Postgres targets (MySQL
  `FIELD(...)`, SQLite `CASE`) — future.

### Dispatch 4: emit-path value-union narrowing — the emitter honors the `valueSet` ref (R4, R5)

- **Why this exists:** D1 narrowed enum I/O on the **in-memory `typeof contract`** path
  only — it reads the literal tuple off the live `EnumTypeHandle` generics, which are erased
  by emission. A real consumer imports the **emitted `contract.d.ts`**, where an
  `enumType`-authored field still resolved to the bare codec output (`pg/text@1 → string`).
  So the slice's headline feature (typed enum I/O) was **not delivered for the product path**.
  The IR was already correct — the domain field carries a `valueSet` ref and the domain `enum`
  carries literal members — but the emitter dropped both. This dispatch completes the slice;
  it is NOT a follow-up.
- **Outcome:** the emitter narrows a domain field that carries a `valueSet` ref to its
  referenced enum's **value union** on BOTH read output and write input, codec-agnostically
  (text → `'low' | 'high' | 'urgent'`, int → `1 | 10`). The emitted `contract.d.ts`'s field
  type IS the union, so a consumer of the emitted contract narrows — not just the no-emit path.
  The old `pg/enum@1` `typeRef → renderOutputType` path stays working (`User.kind`
  → `'admin' | 'user'` unchanged); unifying/retiring that special-case is out of scope here.
- **Done (`9060b1ced`, `8afe4a167`):** `resolveFieldType`
  (`packages/1-framework/3-tooling/emitter/src/domain-type-generation.ts`) now renders the
  member-value union from `field.valueSet` (resolved against `domain…enum[name].members`,
  each `JsonValue` → TS literal), threaded via an optional `EnumValuesResolver`. Proof: an
  emit-then-consume test drives the real `emit()` pipeline and asserts the emitted
  output/input typemaps carry the union (non-vacuous — fails to bare codec output when the
  branch is disabled). `contract.json`/`storageHash` unchanged; `fixtures:check` zero-diff
  (the committed demo fixture is PSL-mode where `priority` is plain `String` — the new enum
  is TS-authored only until PSL `enum` repoints at the cutover, TML-2853).

### Dispatch 5: enums move into the namespace facet — `db.<ns>.enums.<Name>` (R6 revision)

- **Why this exists:** D2 shipped `db.enums` as a flat root accessor, specced when the
  client root was flat. TML-2816 (merged from main) made the client root
  **namespace-keyed** (`db.<ns>.<Model>` via per-namespace facets), which left `db.enums`
  as the one root key that isn't a namespace, shadowing any namespace literally named
  `enums` — and the flat `buildEnumsMap` silently last-write-wins when two namespaces
  declare the same enum name. Decision (operator + query team, 2026-06-10): enums live
  **inside the namespace facet** — `db.orm.public.enums.Priority` on postgres;
  unbound-namespace targets (sqlite, mongo) get `db.orm.enums.Role` for free via the
  existing per-facade unbound projection. This matches the IR (`domain.namespaces[ns].enum`)
  and fixes the cross-namespace collision.
- **Outcome:** the root `enums` accessor is gone; each namespace facet exposes `enums`
  (reserved name) resolving only that namespace's enums, typed per-namespace (literal
  tuples preserved on both the no-emit and emitted paths). A model named `enums` is
  rejected with a clear error rather than silently shadowed. The demo, facades, and all
  enum proofs are updated; the sqlite facade's `unboundNamespace` widening reverts if the
  removed root intersection was its only cause. Design notes record the decision and the
  reserved-name rule as the template for future client-side entity-accessor maps.

> **Superseded by Dispatch 6** — D5 placed enums *inside* the orm namespace facet
> (`db.orm.<ns>.enums`). On query-team review (2026-06-10) that's the wrong home: enums
> are lane-agnostic contract metadata, not an orm-query concern, and being adjacent to
> models forced a reserved-name guard. D6 relocates them to the facade.

### Dispatch 6: enums move to the facade — `db.enums.<ns>.<Name>` (R6 final placement)

- **Why this exists:** D5 put enums inside the orm namespace facet. The query team pointed
  out enums are **contract metadata, lane-agnostic** — the same values whether you use the
  sql lane or the orm lane — so they belong on the **`db` facade** alongside `transaction` /
  `prepare` / `raw` / `context`, not buried under one lane. This also removes D5's
  model-named-`enums` collision entirely (enums are no longer adjacent to models in a facet,
  so no reserved-name guard is needed inside the facet).
- **Outcome:** `db.enums` is a top-level facade member — a namespace-keyed map projected
  per-target exactly like `db.sql` / `db.orm`: `db.enums.public.Priority.values` on Postgres,
  `db.enums.Priority.values` on sqlite/mongo via the existing unbound projection. The orm
  facet's `enums` member and its reserved-name guard are removed; the per-namespace accessor
  types and `buildEnumsMapForNamespace` from D5 are reused, attached at the facade instead of
  the orm facet. Namespace scoping (the cross-namespace collision fix) is preserved. Demo,
  facades (postgres/sqlite + mongo if present), all enum proofs, the design notes, the slice
  spec, the PR description, and the upgrade-instruction comments update from
  `db.<ns>.enums` to `db.enums.<ns>`.

## Open items (orchestrator-routed; not D1/D2/D3 blockers)

- **Triplicated model/column type-level resolution.** `FindModelForTable` /
  `FindFieldForColumn` (query-builder `selection.ts`, added in D1) duplicate the pair in
  sql-builder `table-proxy.ts`, and relational-core has a third equivalent pair
  (`ExtractTableToModel` / `ExtractColumnToField`). Pre-existing duplication this slice
  extended by one copy; consolidation crosses shared lane layering. Follow-up, not in this
  PR. (Surfaced in the D1 review.)
- **D1 process note:** the implementer's first commit swept stale unrelated worktree files
  (a closed-out project's docs + ADR reverts) via a broad `git add`. The orchestrator
  re-committed D1's files only. Guardrail added to D2/D3 briefs: stage only named files,
  verify `git diff --staged --stat` before committing.
- **Cross-space enum ORDER BY (D3).** `resolveEnumOrderValues` ignores `ValueSetRef.spaceId`
  / `plane`, looking up the value-set locally. Correct for every authoring-reachable
  contract today (storage-column `valueSet` refs are always local `plane: 'storage'`, no
  `spaceId`), and degrades to safe fall-through otherwise. Revisit when cross-space enum
  refs become authoring-reachable. (Surfaced in the D3 review.)
- **Pre-existing main typecheck failures (blocks full-repo `pnpm typecheck`, NOT this slice).**
  Verified reproducing on `origin/main`, untouched by D1/D2/D3:
  `packages/3-extensions/postgres/test/postgres.test.ts:484` (TS2352 orm-mock cast) and
  `test/integration/test/contract-builder.{test.ts,types.test-d.ts}` (non-enum
  `field.column` `ResultType` → `string`). Need a standalone main-health fix before this
  PR's CI typecheck can go green.
