# Dispatch plan — mongo-enums-end-to-end (TML-2884)

Slice spec: [`./spec.md`](./spec.md). Five dispatches. **D1 is the shared foundation**
(TS authoring substrate + contract-schema acceptance); **D2, D3, D4 each build on D1 and
are mutually independent** (order among them is review-coherence, not dependency); **D5
proves the whole vertical end-to-end** and carries the slice additivity gate. The slice-DoD
is reachable only from the full sequence: enforce (D3) + typed read & `db.enums` (D4) are
exercised together by D5's `mongodb-memory-server` test, and D5's read assertion goes
**through the emitted contract**, not the `typeof`/no-emit path.

All additive/dark: no Mongo contract is authored with an enum today, so `fixtures:check`
stays zero-diff and non-enum Mongo field shapes are unchanged. Mongo has no native enum and
no prior PSL `enum` — there is no cutover and nothing to delete.

Implementer tier: **sonnet**. Reviewer tier: **opus**.

### Dispatch 1: Author — Mongo `enumType`/`member` + builder accumulation + schema acceptance

- **Outcome:** A TS-authored Mongo contract can declare an enum and reference it from a
  field; building the contract produces `domain.namespaces[__unbound__].enum[Name]` (codecId
  + ordered `{name,value}` members) and stamps the field's domain `valueSet` ref
  (`plane:'domain'`, `entityKind:'enum'`, `namespaceId:'__unbound__'`, `entityName`). The
  emitted contract **passes Mongo arktype validation** — the Mongo contract schema accepts
  `enum?` in the domain namespace and `valueSet?` on the field. A round-trip test (author →
  build → validate → assert the enum entity + field `valueSet` present) is green.
- **Builds on:** Framework-merged shapes only — `enumType`/`bindEnumType`/`member`
  (target-agnostic), `ContractEnum`, `ValueSetRef`, `ContractField.valueSet?`. The slice
  spec's chosen design (surface 1). No prior dispatch.
- **Hands to:** A Mongo contract that carries the enum entity + field `valueSet` and
  validates — the substrate D2/D3/D4/D5 all read.
- **Focus:** new `3-extensions/mongo/src/contract/enum-type.ts` calling
  `bindEnumType<MongoCodecTypes>()`; export `enumType` + re-export `member` from
  `3-extensions/mongo/src/exports/contract-builder.ts`; in
  `2-mongo-family/2-authoring/contract-ts/src/contract-builder.ts` add an `enums` definition
  slot, a `field.namedType(handle)` (or equivalent) field reference, the `domain…enum`
  accumulation loop (mirror SQL's), and the field `valueSet` stamp; add `enum?` /
  `valueSet?` to the Mongo contract schema (mirror SQL's `ContractEnumSchema` / `valueSet?`)
  so `{ '+': 'reject' }` no longer rejects the shape. Round-trip + a literal-tuple type-test
  on the handle. **Out:** PSL (D2), enforcement (D3), read surface (D4), the e2e test (D5).

### Dispatch 2: Author — Mongo PSL `enum` lowering

- **Outcome:** A Mongo PSL `enum Role { @@type("mongo/string@1") User = "user" … }` block
  lowers to the same domain `enum` entity + field `valueSet` ref that D1's TS DSL produces.
  A PSL → contract round-trip/interpreter test proves the lowering (members parsed via the
  `@@type` codec's `decodeJson`, field `valueSet` attached). Mongo has no prior PSL `enum`,
  so this is purely additive — no cutover, no transitional keyword.
- **Builds on:** D1 — the domain `enum` accumulation + field `valueSet` lowering path it
  reuses, and the schema acceptance. Independent of D3/D4.
- **Hands to:** PSL-authored Mongo enums, equivalent to the TS DSL path.
- **Focus:** new `2-mongo-family/9-family/src/core/authoring-entity-types.ts` with a
  `mongoFamilyEnumEntityDescriptor` + PSL block descriptor (mirror
  `sqlFamilyEnumEntityDescriptor`); add an `authoring` section to the Mongo family pack
  (`2-mongo-family/9-family/src/exports/pack.ts`) and `MongoFamilyDescriptor`
  (`.../core/control-descriptor.ts`); add a `processEnumDeclarations` path to the Mongo PSL
  interpreter (`2-mongo-family/2-authoring/contract-psl/src/interpreter.ts`) that routes the
  `enum` block through the D1 lowering. Reuse the SQL `@@type`/member-value grammar.
  **Out:** enforcement (D3), read (D4), e2e (D5).

### Dispatch 3: Enforce — `$jsonSchema` field `enum` keyword

- **Outcome:** When a field carries a domain `valueSet` (`entityKind:'enum'`), the Mongo
  JSON-Schema deriver emits `$jsonSchema.properties.<field>.enum = [...member values]`. With
  `validationLevel:'strict'` (already set), the collection validator rejects out-of-set
  writes. A unit test asserts the derived validator carries the `enum` array for an enum
  field and omits it for non-enum fields.
- **Builds on:** D1 — the field `valueSet` ref + the domain `enum` members it resolves.
  Independent of D2/D4.
- **Hands to:** Server-side enforcement of the value-set via the collection validator —
  consumed by D5's rejected-write assertion.
- **Focus:** `2-mongo-family/2-authoring/contract-psl/src/derive-json-schema.ts`,
  `fieldToBsonSchema()` — when `field.valueSet?.entityKind === 'enum'`, resolve the
  referenced `ContractEnum`'s ordered member values and add `enum: [...]` to the field's
  property schema; thread the domain enum members in (an `enumResolver`/domain lookup
  analogous to `codecLookup`). `contractToMongoSchemaIR` is pass-through, so the array
  flows to `createCollection`/`collMod` untouched. **Out:** authoring (D1/D2), read (D4),
  e2e (D5).

### Dispatch 4: Read — value-union narrowing + `db.enums` on the facade

- **Outcome:** (a) A Mongo enum field's read type narrows to the enum's value union (not
  `string`) — `InferFieldBaseType` gains a `valueSet` branch (mirror SQL's `FieldChannelType`:
  enum union first, codec output fallback; nullable stays `… | null`). (b)
  `db.enums.<Name>` is exposed on the `MongoClient` facade
  (`Object.freeze(buildNamespacedEnums(contract.domain))`, reusing the framework runtime
  unchanged), surfacing `.values`/`.members`/`.names`/`.has`/`.nameOf`/`.ordinalOf`. Runtime
  test for `db.enums`; type-test on the narrowed field + the literal `values` tuple.
- **Builds on:** D1 — the domain `enum` entity + field `valueSet` ref. Independent of D2/D3.
- **Hands to:** Typed Mongo reads + a runtime enum surface — consumed by D5's typed-read and
  `db.enums` assertions.
- **Focus:** `2-mongo-family/1-foundation/mongo-contract/src/contract-types.ts`
  (`InferFieldBaseType` valueSet branch); `3-extensions/mongo/src/runtime/mongo.ts` (add
  `readonly enums: NamespacedEnums<TContract>` to the interface + `enums:` to the facade
  return literal, mirroring `3-extensions/postgres/src/runtime/postgres.ts`). **Out:**
  authoring (D1/D2), enforcement (D3), the e2e proof + emit-path assertion (D5).

### Dispatch 5: Prove — `mongodb-memory-server` end-to-end + emit-then-consume + slice gate

- **Outcome:** One `mongodb-memory-server` integration test (mirror
  `3-extensions/mongo/test/mongo.e2e.test.ts`) drives the whole vertical: author a model with
  an enum field → an out-of-set write is **rejected by the collection validator** → an in-set
  write round-trips and its read is typed as the value union → `db.enums.Role.values` returns
  the ordered tuple. An **emit-then-consume** type-test proves the read narrowing holds
  **through the emitted `contract.d.ts`** (not the `typeof`/no-emit path) — non-vacuous
  (falls back to `string` when the narrowing is disabled). **Slice additivity gate:**
  `pnpm build` + `pnpm fixtures:check` zero-diff; `pnpm typecheck` clean for affected
  packages; `pnpm lint:casts` ≤ 0 (no new bare casts beyond the facade's
  `blindCast`, mirroring Postgres).
- **Builds on:** D1 (authoring), D3 (enforcement — the rejected write), D4 (typed read +
  `db.enums`). PSL (D2) is proven by its own test; D5 authors via the TS DSL to keep the
  harness simple.
- **Hands to:** The slice-DoD — Mongo enums work end-to-end and regress nothing. Closes the
  slice; with the merged SQL cutover, the project reaches its end state (one enum concept on
  SQL and Mongo).
- **Focus:** the MMS-backed e2e test (`MongoMemoryReplSet`, `timeouts.spinUpMongoMemoryServer`);
  the emit-then-consume type-test; the final slice-wide additivity / typecheck / cast sweep.
  **Out:** declaration-order sort (R8 N/A for Mongo); `@default(member)` (follow-up).

## Open items (orchestrator-routed; not dispatch blockers)

- **Read narrowing may come for free through the emitter.** The framework
  `generate-contract-dts.ts` already wires a family-agnostic `resolveEnumValues` into
  `FieldOutputTypes`. If D5's emit-then-consume test passes with only D1's slot populated,
  D4's no-emit `InferFieldType` branch is parity-only — keep it, but the emit test is the
  acceptance evidence (slice spec open question 2). Confirm during D4/D5.
- **`enumResolver` plumbing into the deriver (D3).** Exact call-chain for threading domain
  enum members into `fieldToBsonSchema` is implementer discovery; confirm at dispatch.
- **Coordinate with PR #816 (TML-2888, Mongo migration DDL adoption).** #816 is an open,
  internally-SHIP'd Mongo PR (60 files) that will likely merge before this slice. Checked
  2026-06-15: surfaces are mostly disjoint (it reworks DDL *execution*: runner/adapter/
  driver/wire/query-builder). Two touchpoints: (1) **`contract-psl/src/interpreter.ts`** —
  both edit it; #816's edits are confined to the `parseCollation` helper + one import, our
  D2 adds `processEnumDeclarations` elsewhere → at most a trivial import-block rebase
  conflict. (2) **`9-family/src/core/contract-to-schema.ts`** — #816 refactors it to
  `ifDefined` but **keeps the validator pass-through** (`convertValidator` unchanged), so
  our D3-injected `$jsonSchema.enum` still rides through to `db.createCollection({validator})`
  — we don't edit this file. **Action:** rebase onto main after #816 lands, before opening
  the PR; flag interpreter.ts co-editing in the D2 brief. #816 also adds `ifDefined`/
  `removeUndefined` in `utils/src/defined.ts` and `@internal/mongo-value/mongodb-types`,
  reusable once it lands.
- **Staging discipline.** Stage only named files; verify `git diff --staged --stat` before
  each commit (prior-slice guardrail — a broad `git add` once swept unrelated worktree files).
