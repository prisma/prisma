# Slice — `generic-namespace-entries-serialization`

**Project:** [`../../spec.md`](../../spec.md) · **Plan:** [`../../plan.md`](../../plan.md) · **Ticket:** [TML-2981](https://linear.app/prisma-company/issue/TML-2981)
**Origin:** review point O1 on [PR #906](https://github.com/prisma/prisma-next/pull/906) — "Why isn't this just serializing the whole `entries` dict? How is an extension supposed to extend this further?"

## At a glance

The SQL contract serializer round-trips a namespace's entity kinds asymmetrically: **hydration** (deserialize) already iterates generically over the registered entity kinds (`SqlContractSerializerBase` calls `hydrateNamespaceEntities(entriesInput, this.entryKinds, …)`), but **serialization** hardcodes one branch per kind — the Postgres and SQLite targets each name `table` / `valueSet` / `role` / `policy` explicitly when building `entries`. So an extension that contributes a new entity kind hydrates for free but is silently dropped on the way out, unless someone edits the target serializer. This slice makes serialization iterate the whole `entries` dict generically, symmetric with hydration, so a contributed kind round-trips with no serializer edit.

## Chosen design

**Serialize the namespace's `entries` dict by iteration, in the shared base, mirroring hydration.**

- **Lift generic entries serialization into `SqlContractSerializerBase`** (`packages/2-sql/9-family/src/core/ir/sql-contract-serializer-base.ts`). Add a `protected` helper that takes a namespace's `entries` object and returns the serialized `Record<kind, Record<name, JsonObject>>` by walking `Object.entries(ns.entries)` — no kind named in code. Move the JSON round-trip helpers (`serializeJsonObject` / `serializeJsonValue`) down into the base alongside it, since both SQL targets need them.
- **Both targets call it.** `PostgresContractSerializer.serializePostgresNamespace` and `SqliteContractSerializer.serializeContract` stop naming kinds and delegate the entries block to the base helper. Each target keeps only its own **namespace-wrapper** concerns (the `id`, the `postgres-schema` / `postgres-unbound-schema` `kind` tag, and the unbound-slot special case), which are genuinely target-specific, not per-entity-kind.
- **`native_enum` stays excluded for free.** It is carried non-enumerable on `ns.entries` (authoring-time-only; its values live on via the derived `valueSet`), so `Object.entries` skips it with no special case — the existing behavior, now load-bearing rather than incidental.
- **Emitted output is byte-identical.** The iteration reproduces the current shape exactly: `table` is always emitted (even when empty); every other kind is emitted only when its record is non-empty. That is the same rule the hardcoded branches applied (`table` unconditional; `...(Object.keys(x).length > 0 ? { x } : {})` for the rest), so no fixture drifts.

This answers O1 directly: the serializer no longer enumerates kinds, so a pack that registers an entity kind (it already appears as an enumerable `entries` key, already hydrates via `entryKinds`) now also serializes with zero serializer edits.

## Coherence rationale (slice-INVEST · _Small_)

One reviewer holds a single claim: **"the SQL serializer emits every namespace entity kind by iterating `entries`, symmetric with hydration, with byte-identical output and no per-kind code."** The base helper, the two target call sites, and the moved JSON helpers are one interdependent change — splitting them leaves a half-generic serializer or a target still naming kinds. One rollback unit; a contained diff across three serializer files.

## Scope

**In:** the generic entries-serialization helper on `SqlContractSerializerBase`; moving `serializeJsonObject` / `serializeJsonValue` into the base; rewiring `PostgresContractSerializer` and `SqliteContractSerializer` to delegate; a test proving a non-`table` and an extension-shaped kind round-trip through the generic path; `fixtures:check` clean.

**Deliberately out:**

- The **hydration** side — already generic; untouched.
- The `native_enum` **non-enumerability** mechanism — relied upon, not changed.
- The per-target **namespace wrapper** (`id` / `kind` tag / unbound-slot handling) — stays per-target; this slice only generalizes the entries block.
- Mongo — a separate family with its own serializer; not in the SQL base.
- Any change to what an entity kind *is* or how it is registered (`composeSqlEntityKinds`, `AnyEntityKindDescriptor`).

## Pre-investigated edge cases

- **`table` always present; others when non-empty.** The generic walk must keep emitting an empty `table: {}` while omitting an empty `valueSet` / `role` / `policy`, or RLS/enum fixtures drift. Reproduce the exact rule (`table` unconditional, other kinds gated on non-empty) rather than emitting every enumerable key verbatim.
- **`native_enum` must not reappear.** It is non-enumerable on `ns.entries`; the walk must use `Object.entries` / `Object.keys` (which honor enumerability), never `Reflect.ownKeys` or a hardcoded kind list, or the authoring-time entity leaks back into `contract.json`.
- **Unbound-slot namespace.** The Postgres unbound slot emits only `entries: { table }`; keep that wrapper behavior at the target, feeding the base helper the unbound namespace's (table-only) entries.

## Slice-specific done conditions

- A test asserts a namespace carrying a non-`table` kind (e.g. `role`/`policy`) **and** a novel/extension-shaped entity kind serializes through the generic path, and that `native_enum` is still excluded.
- Neither `PostgresContractSerializer` nor `SqliteContractSerializer` names an entity kind in its serialization path (grep-verifiable: no `ns.role` / `ns.policy` / `ns.valueSet` / `'native_enum'` literals in the serialize branch).
- `pnpm fixtures:check` clean — byte-identical emitted contracts.

(CI-green, reviewer-accept, project-DoD floor inherited — not restated.)

## Open questions

- **Helper boundary** — whether the base exposes "serialize just the `entries` block" (targets keep their namespace wrapper) or a fuller "serialize a namespace given `(entries, id, kindTag)`". Lean: the narrower entries-block helper, since the unbound-slot wrapper differs per target. Settle in the plan against the two call sites.

## Dispatch plan

**D1 — `generic-entries-serialization`** (single dispatch; test-first). A surgical substrate change — one outcome the executor holds.

- **Outcome:** `SqlContractSerializerBase` exposes a `protected` helper that serializes a namespace's `entries` object by iterating `Object.entries` (JSON round-trip helpers moved down beside it); `PostgresContractSerializer` and `SqliteContractSerializer` delegate their entries block to it and name no entity kind; emitted contracts are byte-identical; a test proves a non-`table` kind and an extension-shaped kind round-trip while `native_enum` stays excluded.
- **Builds on:** — (main; post-#906).
- **Hands to:** the shipped slice capability.
- **Focus:** base helper + moved JSON helpers; rewire both target serializers (keep each target's namespace wrapper / unbound-slot); test (base-level unit test for the generic walk incl. an extension-shaped kind + `native_enum` exclusion). Gates: build, typecheck, `test:packages` (family-sql, target-postgres, target-sqlite), `fixtures:check`, `lint:deps`, `lint:casts`.
- **Not split** because a base helper with no consumer fails _Valuable_, and moving the JSON helpers while a target still owns copies would break the build — the substrate move and both rewires are one stable state.

## References

- Base serializer: [`packages/2-sql/9-family/src/core/ir/sql-contract-serializer-base.ts`](../../../../packages/2-sql/9-family/src/core/ir/sql-contract-serializer-base.ts) (`entryKinds`, `hydrateNamespaceEntities` — the generic hydrate path this mirrors).
- Postgres serializer: [`packages/3-targets/3-targets/postgres/src/core/postgres-contract-serializer.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/postgres-contract-serializer.ts) (`serializePostgresNamespace`, `serializeEntries`).
- SQLite serializer: [`packages/3-targets/3-targets/sqlite/src/core/sqlite-contract-serializer.ts`](../../../../packages/3-targets/3-targets/sqlite/src/core/sqlite-contract-serializer.ts).
- `native_enum` non-enumerability: [`packages/3-targets/3-targets/postgres/src/core/postgres-schema.ts`](../../../../packages/3-targets/3-targets/postgres/src/core/postgres-schema.ts) (`Object.defineProperty(… enumerable: false)`).
