# Dispatch plan — enum-contract-substrate (TML-2850)

Slice spec: [`./spec.md`](./spec.md). Four sequential dispatches: domain IR → storage IR → authoring API → serializer/validators/round-trip. All additive (the native path and every fixture stay unchanged). Implementer tier: sonnet-mid; reviewer: opus.

### Dispatch 1: domain enum IR + shared `ValueSetRef`

- **Outcome:** The contract IR can represent a domain enum and a field's restriction reference. `ValueSetRef` (the space-aware coordinate `{ kind, namespaceId, name, spaceId? }`, matching the `ForeignKeyReference` carrier and the `UNBOUND_NAMESPACE_ID` sentinel) is defined in the **foundation** package `@internal/contract` (`value-set-ref.ts`) — **not** framework-components: foundation is the inner layer and cannot import the outer core, and `sql-contract` (dispatch 2) depends on foundation, so foundation is the home reachable by both planes. Exported via `@internal/contract/types`. **[landed: commit 465f68679]** `ContractEnum { codecId, members: readonly {name,value}[] }` and an `enum?: Record<string, ContractEnum>` slot exist on `ApplicationDomainNamespace`. `ContractField` gains optional `valueSet?: ValueSetRef`. Constructs directly; `pnpm typecheck` passes for the foundation/framework packages; a unit test constructs a domain enum + a field with a `valueSet` and reads the members back in order.
- **Builds on:** The slice spec's chosen design.
- **Hands to:** `ValueSetRef` (exported, framework) + the domain `enum` slot + `ContractField.valueSet?` — the domain-side shapes dispatches 2–4 reference.
- **Focus:** `packages/1-framework/0-foundation/contract/src/{value-set-ref.ts,domain-types.ts,domain-envelope.ts,exports/types.ts}`. Direct-construction unit test only. Out: storage shapes (D2), authoring (D3), serialization (D4). Do **not** touch the native `PostgresEnumType` path or PSL.

### Dispatch 2: storage value-set IR

- **Outcome:** The SQL storage IR can represent a value-set and a column's restriction reference. `StorageValueSet { kind: 'value-set'; values: readonly string[] }` exists (frozen IR node) and a `valueSet?: Record<string, StorageValueSet>` slot sits under `SqlNamespace.entries` alongside `table`. `StorageColumn` gains `valueSet?: ValueSetRef`. Constructs directly; `pnpm typecheck` passes for `@internal/sql-contract`; a unit test constructs a namespace with a value-set + a column referencing it.
- **Builds on:** Dispatch 1's exported `ValueSetRef` — import it from `@internal/contract` (foundation), which `sql-contract` already depends on.
- **Hands to:** The storage `valueSet` slot + `StorageColumn.valueSet?` + `StorageValueSet` — the storage-side shapes dispatches 3–4 produce and serialize.
- **Focus:** `packages/2-sql/1-core/contract/src/ir/{sql-storage.ts,storage-column.ts}` + a new `storage-value-set.ts` IR node (mirror the `StorageTable`/`StorageColumn` frozen-node + `*Input` pattern). Direct-construction unit test. Out: authoring (D3), serialization (D4). Coexists with — does not modify — `PostgresEnumType` / the storage `type` slot.

### Dispatch 3: `enumType` / `member` authoring API + lowering

- **Outcome:** `enumType(name, codec, ...member(...))` authors the new shape end-to-end into the contract structure: it produces a domain `enum` entry + a storage `valueSet` entry, and `field.namedType(<enum handle>)` sets the field's (and its column's) `valueSet` reference. The literal value tuple is statically preserved (`expectTypeOf(Role.values).toEqualTypeOf<readonly ['user','admin']>()`); `member(name)` defaults value to name; `enumType` throws on empty / duplicate-name / duplicate-value. Tests assert authoring→structure for both planes + the type-level propagation.
- **Builds on:** Dispatches 1 + 2 (both planes' IR shapes).
- **Hands to:** A working TS authoring surface that emits the new representation — the input generator dispatch 4 round-trips, and the capability slices 2/3 build on.
- **Focus:** the authoring/contract-ts surface (`framework-authoring.ts` contribution wiring; `composed-authoring-helpers.ts`; `contract-dsl.ts`; `field.namedType`). Resolve open questions 1 & 4 from the spec at the head of this dispatch (where `enumType` is contributed; how `namedType` accepts the handle). `const` generics for literal preservation. Out: serialization (D4), PSL (`enum` keyword stays native — do not repoint), enforcement/typing (other slices).

### Dispatch 4: serializer hydration + validators + round-trip (slice wrap)

- **Outcome:** A contract carrying the new domain `enum` + storage `valueSet` serializes to JSON and hydrates back identically, and arktype validators accept the valid shape + reject malformed (missing `values`, bad member). The SQL-family serializer hydrates the `valueSet` slot via the entity registry; `StorageValueSet`/`ContractEnum` validator fragments are registered. **Slice-DoD gates:** the additivity check runs the full sequence **`pnpm build` → `pnpm i` → `pnpm fixtures:check`** (the example apps invoke the built, repo-local `prisma-next` CLI, which only reaches `PATH` after a post-build `pnpm i`) and must be clean with **zero** fixture changes (the dark path alters no emission); round-trip + validator + type-tests green; full `pnpm typecheck` clean; no new bare casts.
- **Builds on:** Dispatches 1 + 2 (the IR to hydrate) and dispatch 3 (to author round-trip inputs).
- **Hands to:** The slice-DoD — the new representation round-trips, validates, and regresses nothing. The project's hand-off to slices 2 and 3.
- **Focus:** `packages/2-sql/9-family/src/core/ir/sql-contract-serializer-base.ts` (`hydrateSqlNamespaceEntry` → walk the `valueSet` slot), `packages/2-sql/1-core/contract/src/validators.ts` (new fragments + register the `value-set` discriminator), the domain serializer for the `enum` slot. Round-trip + validator tests; the `fixtures:check`-clean gate is the regression guard for additive-ness. Out: anything that would change emitted fixtures (that's the slice-4 cutover, not here).
