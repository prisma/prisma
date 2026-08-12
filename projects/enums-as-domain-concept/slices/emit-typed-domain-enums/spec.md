# Slice: emit-typed-domain-enums

Parent project: `projects/enums-as-domain-concept/`. Closes the **R6 emit-parity
gap** (spec R6, amended 2026-06-10): `db.enums` literal typing must hold through the
emitted contract, not only on the no-emit path. Cutover prerequisite.

## At a glance

Today the emitted `contract.d.ts` namespace type carries only `models` +
`valueObjects` — no `enum` block — so through emit:

```ts
db.enums.public.Priority.values        // JsonValue[]   — runtime is correct, the TYPE collapsed
db.enums.public.Priority.members.High  // JsonValue
```

After this slice the emitter renders the domain enum block with literal member
tuples:

```ts
// emitted contract.d.ts (public namespace)
readonly enum: {
  readonly Priority: {
    readonly codecId: 'pg/text@1';
    readonly members: readonly [
      { readonly name: 'Low'; readonly value: 'low' },
      { readonly name: 'High'; readonly value: 'high' },
      { readonly name: 'Urgent'; readonly value: 'urgent' }
    ];
  };
};
```

and the **existing** accessor type chain does the rest with zero changes —
`NamespaceEnumAccessors` / `NamespacedEnums` (`contract/src/enum-accessor.ts:106–173`)
already extract `values: readonly ['low','high','urgent']` and
`members: { Low: 'low'; High: 'high'; Urgent: 'urgent' }` from exactly this shape:

```ts
db.enums.public.Priority.members.High   // 'high'
db.enums.public.Priority.values         // readonly ['low', 'high', 'urgent']
```

The demo's `getPriorityEnumFromEmit()` + `priorityValue()` cast workarounds
(`get-posts-by-priority.ts:5–31`, reason strings documenting exactly this gap) become
deletable — **their deletion is the acceptance evidence** (per the TML-2885 ticket).

## Chosen design

One change site: **the emitter's namespace-type rendering**
(`emitter/src/generate-contract-dts.ts:109–137`, where `perNamespaceTypes` builds
`models` + `valueObjects`) additionally renders an `enum` block for namespaces whose
contract carries `domain.namespaces[ns].enum` — `codecId` as a string literal,
`members` as a readonly tuple of `{ name, value }` literal pairs, member order
preserved (order is semantic). Values render as TS literals from their JSON form
(strings quoted, numbers bare — the same JsonValue→literal rendering the TML-2852 D4
field narrowing already does in `domain-type-generation.ts`; reuse, don't duplicate).
Namespaces without enums emit no `enum` member (no empty-block noise; the accessor
type tolerates absence).

Nothing else changes: the accessor types (`enum-accessor.ts`) and runtime
(`buildNamespacedEnums`) are already correct; the field value-union narrowing
(TML-2852 D4) is untouched; `contract.json` and `storageHash` are byte-identical
(this is a `.d.ts`-only emission change — assert that).

## Coherence rationale

One sentence, one reviewer sitting: *"the emitted contract now types the domain enum
block, so `db.enums` is literal-typed through emit and the demo's casts die."*
Single emitter change + an emit-then-consume proof + the demo simplification.

## Scope

**In:** the `enum`-block rendering in `generate-contract-dts.ts`; an emit-then-consume
test (the TML-2852 D4 pattern, `domain-type-generation.test.ts:1130+` /
`emitter.integration.test.ts`) driving the real `emit()` and asserting at the type
level that `NamespacedEnums<Contract>` resolves literal `values`/`members` (and
`.not` `JsonValue` — non-vacuous); demo regeneration; deletion of
`getPriorityEnumFromEmit` + the `priorityValue` blindCast (consumers use
`db.enums.public.Priority` directly); a demo type test asserting the literal types
**through the emitted contract.d.ts**; slice sweep.

**Out:** any accessor-type or runtime change (`enum-accessor.ts` untouched); field
narrowing (done, TML-2852); multi-namespace enum emission beyond what the contract
shape already implies (the rendering is per-namespace generic — but no new demo
namespaces); Mongo (TML-2884).

## Contract-impact

`contract.d.ts` only — namespaces with enums gain the `enum` block (the demo's
`public`). `contract.json` byte-identical; `storageHash`/`profileHash` unchanged
(verify — a hash move is a red flag, halt). `fixtures:check`: only the demo's
`contract.d.ts` (and migration `end-contract.d.ts`) regenerate.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| Non-string member values (`Low = 1`) | Render as bare number literals | The emit-then-consume test covers one int-codec enum. |
| Member name that isn't a valid TS identifier key | Quote the key | Mirror however `models` field keys handle this today — follow the existing key-rendering helper. |
| `__unbound__` namespace enums | Same rendering, keyed under the unbound id | The accessor chain's unbound projection already handles it; cover in the emitter unit test, not the demo. |

## Slice-specific done conditions

- [ ] Emit-then-consume type test: through the real emitted `.d.ts` types,
  `db.enums`-shape resolution yields the literal tuple/record and `.not`
  `JsonValue` — fails if the enum block is dropped (state how non-vacuity was
  verified).
- [ ] `getPriorityEnumFromEmit` and the `priorityValue` blindCast are **gone**; the
  demo consumes `db.enums.public.Priority` directly with no casts.
- [ ] `contract.json` byte-identical (the change is types-only).

## Open Questions

None — the accessor chain fixed the target shape; the emitter renders to it.

## References

- Parent spec R6 (amended), `plan.md` (TML-2885 entry); Linear
  [TML-2885](https://linear.app/prisma-company/issue/TML-2885).
- Surfaces (grounded): `emitter/src/generate-contract-dts.ts:109–137` (namespace
  types; 149–154 `resolveEnumValues`); `emitter/src/domain-type-generation.ts:312–444`
  (the D4 literal rendering to reuse); `contract/src/enum-accessor.ts:106–173` (the
  target shape — untouched); demo `get-posts-by-priority.ts:5–31` (the casts to
  delete); `demo-dx.types.test.ts` (field-narrowing tests stay green);
  emitter test pattern `domain-type-generation.test.ts:1130–1245`.
