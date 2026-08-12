# Design: collapse native enums onto generic components

Second review-driven refactor of the native-enum path (PR #906). The first pass (generic-value-set-column-binding.md) de-opaqued the resolver and moved native-type onto params-aware `metaFor`. Review then established that too much is still bespoke: a whole `entityRefTypeConstructor` framework kind, an interpreter resolver that knows the magic key `'typeName'`, per-kind serializer/getter hardcoding, and a generic emitter dump of raw IR nodes into `contract.d.ts`. This design removes all of it. The operator's decisions (both forks) are settled: **O3 — reuse the generic reference path + a codec-owned conversion hook; Option B — native-enum members are value-only.**

## What `pg.enum(AalLevel)` should be

A parameterized codec whose one argument is a *resolved reference to a schema entity*, converted to a column binding by the codec itself — structurally identical to `vector(1536)`, except the argument is a ref and the params come from the codec's hook rather than a literal. No bespoke framework concept.

## Decision

### 1. One type-constructor kind; the codec owns entity→column conversion

- **Delete the `entityRefTypeConstructor` framework kind** — its type, its `AuthoringContributions` slot, its predicate, its collision wiring. `pg.enum` registers as an ordinary type-constructor whose descriptor declares that argument 0 is an entity reference (its entity kind, e.g. `native_enum`).
- **The interpreter resolves the argument to the entity instance** using the mechanism that already exists: `namespaceExtensionEntities` already holds every lowered block instance (the `PostgresNativeEnum`), and field resolution is already threaded to it. Today `resolvePgEnumRef` reads `entities['native_enum'][ref]` out of it; that lookup stays, but generically (driven by the descriptor's declared entity kind), not in a Postgres-specific resolver.
- **The codec owns the conversion.** A new codec-descriptor authoring hook — `columnFromEntity(entity) → { typeParams, valueSet, nativeType }` — lives on the target-layer codec descriptor, which already knows `PostgresNativeEnum`. This is where the interpreter's `'typeName'` knowledge goes; the interpreter never names it again (kills the H1 layering leak).
- **Delete `resolvePgEnumRef`, `SqlColumnBinding` + its predicate + the mis-named `entity-ref-resolution` entry point.**

What does **not** move: the codec `paramsSchema` stays a pure JSON validator over the stored `{ typeName }`, and runtime `factory({ typeName })` is byte-identical to any parameterized codec — because at runtime (re-materialising from `contract.json`) there is no entity instance. Only the *authoring-time* conversion relocates.

**Parser work is deferrable.** The argument is already parsed (`ResolvedTypeConstructorCall.args[0]`, an expression string `'AalLevel'`); the "this arg is a ref" fact rides the type-constructor *descriptor* and is resolved in the interpreter as today. Grammar-level `refKind` on type-constructor arguments (parse-time scope validation + a nicer "no native_enum named X" diagnostic) is a **follow-up**, not required for this collapse. The interpreter keeps emitting the unknown-ref diagnostic it emits now.

### 2. Option B — native-enum members are value-only; delete the emission

- A native-enum member is a value, not a name→value pair (matching `CREATE TYPE … AS ENUM ('a','b')`, which has no separate member name). The PSL `memberName = "value"` distinction collapses to a value list; `db.nativeEnums.members`/`names`/`nameOf` become value-keyed.
- `db.nativeEnums` types off the recorded **value-set + codec maps** — the same generic surfaces `db.enums` uses — not a raw IR-node slot.
- **Delete `literalizeSerializedEntriesSlot` and the generic all-slots emission loop** (emitter/src/index.ts). The review showed three of its four slots (`valueSet`/`role`/`policy`) are unread dead weight that bloats every RLS contract's `.d.ts`, and the fourth (`native_enum`) is only needed because the accessor typed off the entity. Under Option B nothing reads the raw entity slot, so the whole emission goes.

### 3. Fold in the review findings while in the files

- **F02** — `db.nativeEnums` must tolerate a plain (`validateContract`'d) contract, not silently return empty via class getters. Read through the same plain-data path `db.enums` uses. (Correctness — a shipping bug on the feature's main surface.)
- **F01** — drop the `field.many` disjunct in the CHECK-emission gate (build-contract.ts): Postgres enforces enum-array element membership, so the CHECK is inert; it's also untested.
- **F06** — consolidate `'public'` default-schema literals (`namespace-ids.ts`, `resolve-ddl-schema.ts:17`, `verify-postgres-namespaces.ts:46`, `dependencies.ts:58`) onto one source.
- **F07** — break up the `metaFor` navigation comment (sql-renderer.ts) and attach it clearly.
- **Serializer/getters (O1/O2)** — out of scope for this refactor as a *generic* rework (it touches every entity kind, not just native_enum, and O2's typed getters are defensible). Native_enum simply stops needing its serializer line / getter once the entity is value-only and unread. Do NOT generalise the serializer here; that's its own slice.

## Emitted-output impact (NOT byte-identical)

Unlike the first pass, this **intentionally changes emitted contracts**: the raw entries-slot block leaves `contract.d.ts`, and native-enum members become value-only. So `fixtures:check` **will drift** — regenerate fixtures and verify the drift is *exactly* (a) the removed slot block and (b) value-only members, nothing else. The Supabase example (name == value) should show no behavioural change in the integration test beyond the accessor shape.

## Deletions enabled

`entityRefTypeConstructor` kind (+ slot + predicate + collision wiring), `resolvePgEnumRef`, `SqlColumnBinding` (+ predicate + entry point), the interpreter's `'typeName'` secret, `literalizeSerializedEntriesSlot` + the all-slots emission loop, the `native_enum` serializer line and `get nativeEnum()` special-casing that only existed to feed the emission/accessor.

## Risks to scope first

- **The interpreter's generic "resolve a type-constructor arg as an entity ref" path** must not regress the existing literal-arg type-constructors (`vector(1536)`). Prove `vector` and `pg.enum` both flow through the one kind.
- **`db.nativeEnums` typing off value-set + codec** must still yield the member value union and survive a plain validated contract (F02). Pin with the Supabase integration test + a plain-data test.
- **Fixture drift** must be only the two intended changes.
