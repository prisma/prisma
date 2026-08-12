# Slice: mongo-enums-end-to-end

Parent project: `projects/enums-as-domain-concept/`. Realizes the domain enum for the
**Mongo family** as one **complete vertical** (R10): author → enforce via a `$jsonSchema`
collection validator → typed read + `db.enums`, proven end-to-end against
`mongodb-memory-server`. Independent of the entire SQL track and the cutover — Mongo has
no native enum and no prior PSL `enum`, so its `enum` is the domain concept from day one
(no transitional keyword, no cutover).

## At a glance

Today the Mongo family has no enum surface at all: no `enumType`/`member` binding, no PSL
`enum`, no `valueSet` enforcement in the `$jsonSchema` validator, no value-union narrowing
on reads, and no `db.enums` on the facade. The framework-level domain enum
(`ContractEnum`), the `valueSet` reference, the runtime `EnumAccessor`, and the emitter's
field-narrowing are all already merged (SQL track) and **target-agnostic** — this slice
wires the Mongo family onto them.

The realization difference from SQL: SQL stores a named value-set entity plus a CHECK
constraint; Mongo has neither. Mongo realizes the restriction as an `enum` keyword inside
the collection's `$jsonSchema` validator (`validationLevel: 'strict'`, already hardcoded
in the deriver), so the database rejects out-of-set writes. There is **no storage
value-set entity and no migration-ops parallel** — the restriction is a field property in
the validator the Mongo family already applies.

## Chosen design

One vertical, four surfaces, all reading framework shapes already in place.

**1. Author — Mongo-bound `enumType`/`member` + builder accumulation + PSL `enum`.**

- *TS DSL binding.* Mirror the Postgres binding exactly. New
  `packages/3-extensions/mongo/src/contract/enum-type.ts` calls
  `bindEnumType<MongoCodecTypes>()` (the generic `enumType`/`bindEnumType` live in
  `packages/2-sql/2-authoring/contract-ts/src/enum-type.ts` and are target-agnostic; the
  binding only re-types member values against the Mongo codec map). Export `enumType` and
  re-export `member` from `packages/3-extensions/mongo/src/exports/contract-builder.ts`.
- *Builder accumulation.* `packages/2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts`
  gains an `enums` input slot on the definition and a `field.namedType(handle)` (or
  equivalent) so a field references an enum. `buildContractFromDefinition` accumulates the
  enums into `domain.namespaces[UNBOUND_NAMESPACE_ID].enum` (mirroring SQL's accumulation
  loop) and stamps the field's `valueSet` ref
  (`{ plane:'domain', entityKind:'enum', namespaceId: UNBOUND_NAMESPACE_ID, entityName }`).
  Mongo uses only `UNBOUND_NAMESPACE_ID` — no explicit namespaces.
- *PSL `enum`.* Net-new for Mongo (no prior PSL `enum`, no cutover). Add a
  `mongoFamilyEnumEntityDescriptor` + PSL block descriptor (parallel to
  `sqlFamilyEnumEntityDescriptor` in `packages/2-sql/9-family/src/core/authoring-entity-types.ts`),
  register them on the Mongo family pack (`packages/2-mongo-family/9-family/src/exports/pack.ts`)
  and `MongoFamilyDescriptor` (`.../core/control-descriptor.ts`), and add a
  `processEnumDeclarations` path to the Mongo PSL interpreter
  (`packages/2-mongo-family/2-authoring/contract-psl/src/interpreter.ts`) that lowers the
  block into the domain `enum` slot and attaches the field `valueSet` — reusing the same
  `@@type("codecId")` + member-value grammar the SQL descriptor uses.

```prisma
enum Role {
  @@type("mongo/string@1")
  User  = "user"
  Admin = "admin"
}
model Account { id String @id @map("_id"); role Role }
```

**2. Enforce — `$jsonSchema` field `enum` keyword.**
In `packages/2-mongo-family/2-authoring/contract-psl/src/derive-json-schema.ts`,
`fieldToBsonSchema()` derives `{ bsonType }` per field. When `field.valueSet?.entityKind
=== 'enum'`, resolve the referenced `ContractEnum`'s ordered member values and add
`enum: [...values]` to that field's property schema. `validationLevel: 'strict'` is
already set (line 91), so the validator rejects out-of-set writes. The deriver needs the
domain enum members threaded in (an `enumResolver`/domain-namespace lookup, analogous to
the existing `codecLookup`). `contractToMongoSchemaIR` is a pass-through, so the injected
`enum` array flows to the migration runner's `createCollection`/`collMod` untouched.

**3. Read — value-union narrowing (R4/R5 parity).**
The framework emitter (`packages/1-framework/3-tooling/emitter/src/generate-contract-dts.ts`)
**already** wires a family-agnostic `resolveEnumValues` into `FieldOutputTypes` generation:
a field with a `valueSet` ref narrows to its enum's literal value union in `contract.d.ts`
once `domain.namespaces[ns].enum[name]` is present. So the emit-path read narrowing comes
largely for free once surface 1 populates the slot and the contract schema accepts it (see
contract-impact). The no-emit `InferFieldType` path
(`packages/2-mongo-family/1-foundation/mongo-contract/src/contract-types.ts`,
`InferFieldBaseType`) has **no** `valueSet` branch — add one mirroring SQL's
`FieldChannelType` (check the enum value union first, fall back to the codec output).

**4. Read — `db.enums.<ns>.<Name>` on the Mongo facade (R6 parity).**
Mirror Postgres exactly. Add `readonly enums: NamespacedEnums<TContract>` to the
`MongoClient` interface and `enums: Object.freeze(buildNamespacedEnums(contract.domain))`
to the facade return literal in
`packages/3-extensions/mongo/src/runtime/mongo.ts`. `buildNamespacedEnums` /
`createEnumAccessor` / `NamespacedEnums` are reused **unchanged** from the framework
foundation. On the unbound-namespace Mongo facade this surfaces as `db.enums.Role`.

**5. Prove — `mongodb-memory-server` integration test.**
Mirror `packages/3-extensions/mongo/test/mongo.e2e.test.ts` (`MongoMemoryReplSet`,
`timeouts.spinUpMongoMemoryServer`). One test exercises the whole loop: author a model
with an enum field → an out-of-set write is **rejected by the validator** → an in-set
write round-trips and the read is typed as the value union → `db.enums.Role.values`
returns the ordered tuple.

## Coherence rationale

One outcome a reviewer holds in one sitting: *"a Mongo enum now works end-to-end — declared
in PSL/TS, enforced by the collection validator, typed as its value union on read, and
introspectable via `db.enums`."* Authoring without reading proves nothing, and a vertical
that can't be exercised end-to-end can't be shown to work — so author → enforce → read ship
together, demonstrated against `mongodb-memory-server`. The slice touches only Mongo-family
surfaces plus a per-family wiring of already-merged framework machinery; it is disjoint from
every SQL slice and the cutover. The integration test is the decisive evidence and pins the
whole vertical.

## Scope

**In:** Mongo `enumType`/`member` binding + exports; builder `enums` slot + `namedType`
field reference + `domain…enum` accumulation + field `valueSet` stamping; Mongo PSL `enum`
entity-type contribution + interpreter lowering; `$jsonSchema` field `enum` injection in
the deriver; `InferFieldType` value-union narrowing (no-emit path) **plus** an
emit-then-consume type-test proving the emit path narrows; contract-schema acceptance of
`enum?`/`valueSet?` for Mongo; `db.enums` on the `MongoClient` facade; the
`mongodb-memory-server` end-to-end integration test; supporting unit/round-trip and
type-tests.

**Out:**
- **Declaration-order sort (R8).** No Mongo schema-level enum-ordinal sort; the ordinal
  stays runtime metadata via `db.enums.Role.ordinalOf`. R8 does not apply to Mongo.
- **Mongo `@default(member)`.** A small follow-up if wanted; not this slice.
- **The SQL cutover and every SQL slice** — independent.
- **Cross-space enum references** — local refs only (`spaceId` absent), per the project spec.

## Contract-impact

Reuses the framework `domain…enum` entity and the field `valueSet` ref — no new contract
entity kinds, and **no storage value-set entity** (Mongo has no storage plane analogue).
The required change is **contract-schema acceptance**: the Mongo contract schema currently
rejects the new shape — its domain-namespace schema lacks `enum?`, and `RawFieldSchema`
(with `{ '+': 'reject' }`) lacks `valueSet?`. Both must be added (mirror SQL's
`ContractEnumSchema` / `valueSet?` entries) or emitted enum contracts fail arktype
validation. Additive: no Mongo contract authored with an enum exists yet, so
`fixtures:check` stays zero-diff and non-enum Mongo field shapes are unchanged.

## Adapter-impact

**Mongo only.** The `$jsonSchema` validator gains a field `enum` keyword (enforcement) and
the `MongoClient` facade gains `db.enums`. No SQL adapter is touched.

## ADR pointer

No ADR authored here. The slice substitutes the Mongo realization (validator `enum`) for
SQL's (value-set + CHECK) within the project's already-settled domain-enum design; it
reuses the `db.enums` IR-entity-accessor pattern (project `design-notes.md` open question)
rather than introducing one. The project's end state — one enum concept on SQL and Mongo —
is captured at project close-out.

## Pre-investigated edge cases

| Edge case | Disposition | Notes |
| --- | --- | --- |
| Emit-path read type widens to `string` while runtime is correct | Decisive test goes **through emit** | Same verify-through-emit failure class as TML-2852 D4 / R6. A `typeof handle`/no-emit type-test gives false-green; assert the value union on the emitted-contract consumer. |
| Contract-schema rejects `enum?` / `valueSet?` for Mongo | Add both to the Mongo schema | `RawFieldSchema` uses `{ '+': 'reject' }`; without `valueSet?` the emitted contract fails validation before any read/enforce runs. |
| `validationLevel` not strict | None — already `'strict'` | Hardcoded in `derive-json-schema.ts`; the test still asserts an out-of-set write is rejected to pin it. |
| Nullable enum field | Union with `null` after narrowing | Mirror the existing nullable handling in `InferFieldType`. |
| Member value type vs codec input | `bindEnumType<MongoCodecTypes>` constrains it | `mongo/string@1` → string values; an int codec would take numeric values. |

## Slice-specific done conditions

- [ ] A `mongodb-memory-server` integration test proves the loop end-to-end: out-of-set
  write **rejected by the validator**, in-set write round-trips, read typed as the value
  union, `db.enums.Role.values` returns the ordered tuple.
- [ ] The read-type value union is asserted **through the emitted contract**, not only on
  the no-emit/`typeof` path.

## Open Questions

1. **Threading enum members into the deriver.** Working position: pass an
   `enumResolver`/domain-namespace lookup into `fieldToBsonSchema` analogous to
   `codecLookup`; confirm the exact call-chain plumbing at dispatch.
2. **Whether the no-emit `InferFieldType` branch is needed at all** if the emit path
   already narrows. Working position: add it for parity and no-emit consumers, but the
   emit-then-consume test is the acceptance evidence either way.
3. **Whether the Mongo `enumType` binding/exports belong in the `3-extensions/mongo`
   package or the `2-mongo-family/2-authoring` builder.** Working position: binding in
   `3-extensions/mongo` (mirrors Postgres); builder accumulation in
   `2-mongo-family/2-authoring`. Confirm against layering at dispatch.

## References

- Parent: `projects/enums-as-domain-concept/spec.md` (R10; § Mongo realization, components
  1–8); `plan.md` (parallel track — Mongo). Linear: [TML-2884](https://linear.app/prisma-company/issue/TML-2884).
- Reuse (framework, merged): `enum-type.ts` (`enumType`/`bindEnumType`/`member`);
  `value-set-ref.ts` (`ValueSetRef`); `domain-types.ts` (`ContractEnum`, `ContractField.valueSet?`);
  `enum-accessor.ts` (`buildNamespacedEnums`, `createEnumAccessor`, `NamespacedEnums`);
  `generate-contract-dts.ts` (family-agnostic `resolveEnumValues`).
- Mirror (Postgres): `3-extensions/postgres/src/contract/enum-type.ts` (binding);
  `2-sql/9-family/src/core/authoring-entity-types.ts` (PSL entity-type + block descriptor);
  `3-extensions/postgres/src/runtime/postgres.ts` (`db.enums` on the facade);
  `2-sql/.../contract-types.ts` `FieldChannelType` (value-union narrowing).
- Mongo surfaces (grounded): `2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts`
  (builder); `2-mongo-family/2-authoring/contract-psl/src/{interpreter.ts,derive-json-schema.ts}`
  (PSL lowering + `$jsonSchema`); `2-mongo-family/1-foundation/mongo-contract/src/contract-types.ts`
  (`InferFieldType`); `2-mongo-family/9-family/src/{exports/pack.ts,core/control-descriptor.ts}`
  (pack/descriptor); `3-extensions/mongo/src/runtime/mongo.ts` (`MongoClient` facade);
  `3-extensions/mongo/test/mongo.e2e.test.ts` (MMS harness);
  `3-mongo-target/1-mongo-target/src/core/codec-types.ts` (Mongo codecs).
