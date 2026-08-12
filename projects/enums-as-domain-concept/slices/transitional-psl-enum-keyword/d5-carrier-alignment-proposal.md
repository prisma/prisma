# D5 proposal — align the `ValueSetRef` carrier with the entity-coordinate model before #805 persists it

Status: **SETTLED** (substrate planner + operator response, 2026-06-10) with four
deltas absorbed below — see § Settlement deltas. Author: TML-2882 orchestrator.

## Settlement deltas (planner response, authoritative)

1. **Decisions 1–4 confirmed** as written (kind strings; plane stays; EntityCoordinate
   field-identity with the standalone-mirror as the expected path given foundation→
   framework-components layering — run `pnpm lint:deps` early; spaceId unchanged).
2. **Directional invariant INVERTED from this document's original text:** the real
   invariant is **domain may reference storage; storage may never reference domain**
   (storage must be plannable in isolation — the migration plane consumes storage
   alone; every persisted domain model already carries a domain→storage mapping
   block). ADR 221 §115's parenthetical is the transposed sentence (erratum goes in
   the deferred ADR batch). **The `EntityCoordinate` doc comment in
   framework-components/src/ir/storage.ts is CORRECT — do not touch it.** The
   ride-along fix in the table below is cancelled.
3. **Decision 5 (enumMember alignment) is REJECTED and replaced:** the `enumMember`
   `ColumnDefault` carrier itself violates the invariant (storage → domain ref) and
   will be removed/redesigned **in TML-2855** (respecced: resolved literal default in
   storage; member intent domain-side). D5 does **not** align or freeze it — only the
   minimal mechanical type-following needed to keep the build green if the variant's
   coordinate field shares the renamed type. Spec §9 + Alternatives + design-notes +
   plan TML-2855 entry amended accordingly (done).
4. **Added to D5 scope (settled): rename the `StorageValueSet` node tag**
   `kind: 'value-set'` → `'valueSet'` — the class literal + `StorageValueSetInput` in
   `packages/2-sql/1-core/contract/src/ir/storage-value-set.ts`, the `kind:
   "'value-set'"` literal in `validators.ts`, and the ~40 test occurrences. Node
   self-tags are the self-qualification under the one-vocabulary north star;
   `valueSet` is the surviving mechanism and #805 writes its first persisted
   instances, so this is the only remaining free window. (The grandfathered tags —
   `'postgres-enum'`, `'mongo-collection'` — stay byte-identical; no substrate-side
   node renames are coming, so the original Q1 premise dissolves.) The verification
   grep strengthens to **zero `'value-set'` occurrences repo-wide**.
5. Optional hardening endorsed: a validator assertion that `ref.plane` equals the
   carrying plane.

## Context and the problem

`ValueSetRef` is the reference carrier an enum-restricted field/column and its check
constraint use to point at the domain `enum` entity and the storage `valueSet`
entity. It landed on `main` with TML-2850 in
`packages/1-framework/0-foundation/contract/src/value-set-ref.ts`:

```ts
export interface ValueSetRef {
  readonly plane: 'domain' | 'storage';
  readonly namespaceId: string;
  readonly entityKind: 'enum' | 'value-set';   // ← the problem
  readonly name: string;
  readonly spaceId?: string;
}
```

ADR 224 mandates structural resolution: a coordinate resolves as
`contract[plane].namespaces[namespaceId].entries[entityKind][entityName]` with **no
consumer-side translation between the kind string and the slot key**. The persisted
storage slot key is `valueSet` (singular camelCase — confirmed in the wire:
`entries.table` / `entries.type` / `entries.valueSet`). The implemented ref string
`'value-set'` matches neither the slot key nor the project spec, so resolving it
through `entries` requires exactly the translation ADR 224 forbids. The in-flight
substrate slice's registry, keyed on the entries key, will not resolve it.

It also now diverges from the operator's settled north star (stated 2026-06-10,
supersedes the dual-vocabulary reading of ADR 221/225): **one kind vocabulary** — a
contract IR node is addressed unambiguously by its entity coordinate
`(plane, namespace, kind, id)` AND is deserializable from its own JSON alone. The
node-discriminator-as-separate-vocabulary is being deleted in the substrate
workstream; references must therefore carry the coordinate's kind string, full stop.

**Timing.** `main` has zero persisted `ValueSetRef` instances. PR #805 (TML-2882,
unmerged branch) writes the first ones into `storageHash`-covered wire:
`examples/prisma-8-demo/src/prisma/contract.json` (the `priority` column ref, the
`post_priority_check` ref, the domain field ref) and the migration's frozen
`end-contract.json`. Fixing the shape before #805 merges is a branch-internal
regenerate; after, it is a wire-format break.

## Settled decisions (operator + orchestrator, 2026-06-10)

1. **The kind string becomes `'valueSet'`** (and `'enum'` stays `'enum'`, which
   already equals the domain plane's flat `enum` slot key). One vocabulary: ref kind
   = coordinate entityKind = entries slot key.
2. **`plane` stays.** The canonical coordinate is the four-tuple
   `(plane, namespaceId, entityKind, entityName)` (ADR 221 § decision 3, restated in
   ADR 224). Deriving plane from kind would itself be a consumer-side kind→plane
   mapping table — the lookup-table pattern ADR 224 exists to eliminate — and
   nothing guarantees kind names are unique across planes under pack-contributed
   kinds. (This reverses an earlier orchestrator position; the spec's "the kind
   names the plane" prose was the divergent artifact and is amended, see § Spec
   amendments.)
3. **The carrier aligns to the framework's `EntityCoordinate` type**
   (`framework-components/src/ir/storage.ts`): field `name` renames to
   `entityName`, and the type is expressed as the coordinate plus the cross-space
   discriminator:

   ```ts
   export interface ValueSetRef extends EntityCoordinate {
     readonly entityKind: 'enum' | 'valueSet';   // narrowed from string
     readonly spaceId?: string;                  // presence ⇒ cross-space (PR #745 convention)
   }
   ```

   (Exact TS mechanics — `extends` vs intersection vs standalone-with-same-fields —
   implementer's choice; the requirement is field-name and semantics identity with
   `EntityCoordinate`, no translation layer. Note `EntityCoordinate` lives in
   framework-components while `value-set-ref.ts` lives in the foundation `contract`
   package — if the layering forbids that import direction, declare the same shape
   standalone and note the mirror in the doc comment.)
4. **`spaceId?` semantics unchanged** (absent ⇒ local; present ⇒ cross-space; no tag
   field).
5. **The `enumMember` `ColumnDefault` variant's `enum` coordinate is aligned in the
   same pass.** It is the same shape family (storage → domain reference, landed with
   TML-2851), has zero persisted instances anywhere (the demo has no enum default),
   and skipping it now recreates this exact discussion when TML-2855 persists the
   first member default. Same rules: coordinate field names, kind string equal to
   the slot key, plane carried.

## Exact change scope (PR #805, dispatch D5)

### Production code

| File | Change |
| --- | --- |
| `packages/1-framework/0-foundation/contract/src/value-set-ref.ts` | New shape per decision 3; doc comment rewritten (drop the "entityKind names the source entity-kind / 'value-set'" prose; state coordinate identity + one-vocabulary rule). |
| `packages/1-framework/0-foundation/contract/src/domain-types.ts` | Field-level `valueSet` property type — follows the carrier (read site, likely type-only). |
| `packages/2-sql/2-authoring/contract-ts/src/build-contract.ts` | The two ref construction sites (~451, ~460): `entityKind: 'valueSet'` / `'enum'`, `entityName:` instead of `name:`. Also the `enumMember` default construction site if it builds the coordinate here (decision 5). |
| `packages/2-sql/1-core/contract/src/validators.ts` | `CheckConstraintSchema` + the storage-column `valueSet` validator + the domain-field `valueSet` validator + the `enumMember` default validator: literal `'value-set'` → `'valueSet'`, `name` → `entityName`. |
| `packages/2-sql/1-core/contract/src/ir/storage-column.ts`, `ir/check-constraint.ts` | Read/carry sites — field rename follow-through. |
| `packages/1-framework/3-tooling/emitter/src/domain-type-generation.ts` | `EnumValuesResolver` resolution path reads `ref.entityName` (and may key on `entityKind` — ensure it compares against `'valueSet'`/`'enum'`, no hyphen string survives). |
| `packages/2-sql/9-family/src/core/migrations/contract-to-schema-ir.ts` | Same mechanical rename at its read sites. |
| `packages/3-targets/6-adapters/postgres/src/core/sql-renderer.ts` | `resolveEnumOrderValues` reads the column ref (`name` → `entityName`). |
| `packages/1-framework/1-core/framework-components/src/ir/storage.ts` | **Doc-comment bug fix (rides along):** the `EntityCoordinate` comment states the directional reference invariant as "domain → storage allowed; storage → domain forbidden" — the inverse of ADR 221 ("a storage entity may reference a domain entity, but not the reverse"). ADR 221's direction is correct (the `enumMember` default depends on it). Fix the comment; no code change. |

No serializer change: refs are inline JSON on columns/checks/fields, hydrated as
data, not via the entity registries.

### Tests

Mechanical updates of every ref literal (`entityKind: 'value-set'`, `name:`):
`check-constraint.test.ts`, `enum-type.authoring.test.ts`,
`check-constraint.authoring.test.ts`, the schema-verify check-constraint tests,
`interpreter.enum2.test.ts` (the PSL/TS parity test re-proves equality through the
rename — it asserts strict `toEqual` plus `storageHash` equality between the two
authoring paths, so it is the proof the rename is complete and consistent). One new
assertion: a ref's `entityKind` equals the entries slot key it resolves in (cheap
guard that the one-vocabulary rule holds at the carrier).

### Regenerated artifacts (branch-internal hash churn, pre-merge)

- `examples/prisma-8-demo/src/prisma/contract.json` + `contract.d.ts` (re-emit).
- `examples/prisma-8-demo/migrations/app/20260610T0000_add_priority_enum/`
  frozen contracts (`end-contract.json` / `end-contract.d.ts`) via the migration
  flow — never hand-edited.
- Expected wire delta, exhaustively: every persisted ref object changes
  `"entityKind": "value-set"` → `"entityKind": "valueSet"` and `"name":` →
  `"entityName":` (3 ref sites in contract.json + the same in end-contract.json);
  `storageHash` / migration hashes recompute. Nothing else.

### Spec amendments (`projects/enums-as-domain-concept/spec.md`)

- §2 (reference shape): replace the `kind`-field examples with the settled carrier
  (`plane` + `entityKind: 'enum' | 'valueSet'` + `entityName` + `spaceId?`); delete
  the "`kind` names the entity-kind of the source (and thus the plane)" derivation
  sentence (plane is carried, not derived).
- §9 (`enumMember` default): the `enum` coordinate shown in the same carrier
  convention.
- § At a glance storage example: show the `entries` nesting
  (`entries.valueSet` / `entries.table`) instead of flat plural namespace
  properties, so nobody implements against the flat shape.

## Explicitly deferred — owned by the substrate/discriminator workstream, not #805

These came up in the same discussion and are deliberately **not** in this PR, to
avoid churn against in-flight work:

1. **Node-kind unification** (the discriminator deletion): persisted node `kind:
   'value-set'` → `'valueSet'`, `'postgres-enum'` → its slot kind, single
   kind-keyed hydration registry replacing the discriminator registry. Operator
   owns this.
2. **ADR rewrites** that the one-vocabulary north star implies: ADR 221
   § pack-contributed kinds ("the discriminator is the single key"), ADR 225 ("one
   discriminator ties three layers" — becomes one *kind*), ADR 126's discriminator
   field on block descriptors.
3. **enum2's ADR 225 conformance** (the `interpreterLowered` escape vs a real
   lowering factory). Withdrawn from #805 scope: conforming to a
   discriminator-keyed triple now would be churn against the deletion, and enum2
   produces no `enum2`-kind contract entity at all (it lowers to the domain enum;
   storage is projection), so whether authoring-only keywords need a factory is a
   question the rewrite should answer. The escape stays in #805, documented as
   pending.
4. **ADR 126 grammar amendments** for the two generic capabilities #805 already
   added to extension blocks (`@@attr(...)` block attributes;
   `allowAdditionalParameters` open member sets) — needed regardless of direction,
   belongs with the ADR rewrite batch.

## Open coordination questions for the substrate planner

1. **Landing order.** If the substrate slice (node-kind unification + kind-keyed
   registry) lands before #805 merges, #805 rebases and re-emits once and the demo
   wire is born fully clean (ref kind AND node kind in the one vocabulary). If #805
   merges first, its persisted node `kind: 'value-set'` takes one further hash break
   when the unification lands. The ref fix (this proposal) is correct under either
   order; the question is only whether the **node**-kind flip should pre-land in
   #805 to avoid the second break — at the risk of colliding with the in-flight
   registry changes. Recommendation: whoever lands second pays one regenerate;
   decide by which branch is closer to merge.
2. **Reference-carrier field naming.** This proposal aligns `ValueSetRef` to
   `EntityCoordinate` (`entityName`). If the substrate plan intends a different
   uniform reference-carrier convention (e.g. keeping site-specific pairs per ADR
   221 § cross-references, or a shared `EntityRef = EntityCoordinate & { spaceId? }`
   type for all reference sites including FKs), say so now — the rename is
   churn-free only this once.
3. **Resolution path.** Does the substrate registry expect *references* to resolve
   through the same `entries[entityKind]` walk (in which case the domain plane's
   flat `{ enum, models, valueObjects }` shape eventually gets the `entries`
   treatment too, and `'enum'` is already the right kind string), or is domain-plane
   resolution staying flat-property-named? Either is compatible with this carrier;
   flagging so the domain-side plan is explicit.

## Verification (D5 gate)

- The hardened parity test green (strict `toEqual` + `storageHash` equality, PSL vs
  TS authoring).
- `grep -r "value-set" packages --include="*.ts"` shows no ref-context survivors
  (node discriminators and their validators are out of scope and will still match —
  the check is that no *reference* site carries the hyphen string).
- `pnpm test:packages`, full `pnpm typecheck`, `pnpm fixtures:check` (only the
  demo's deliberate re-emission), `pnpm lint:deps`, cast ratchet unchanged.
