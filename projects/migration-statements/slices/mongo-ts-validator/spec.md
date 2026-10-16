# Slice 4p — TypeScript MongoDB contracts get the PSL validator

**Linear:** [TML-3553](https://linear.app/prisma-company/issue/TML-3553) · **Branch:** `tml-3553-ts-mongo-validator` · **Builds on:** slice 4a (merged, prisma/orm#30691) · **Grounding:** [`investigation.md`](./investigation.md)

## In one example

The same model, written both ways:

```prisma
model User {
  id    ObjectId @id @map("_id")
  email String
  @@map("users")
}
```

```ts
const User = model('User', {
  collection: 'users',
  fields: { _id: field.objectId(), email: field.string() },
});
```

Today the PSL contract's `users` collection has a closed `$jsonSchema` validator (`_id` and `email` required, no other fields). The TypeScript contract has none. After this slice both emit the same validator and the same storage hash.

## Why

Will, 2026-10-12: contracts written in either form must behave the same. Without a validator, a TypeScript contract's field names are not in its storage hash, so a MongoDB field rename or removal gives a migration whose start and end hashes are equal, which `db migrate` refuses. Slice 4a refuses that case for now; this slice removes the refusal.

## What changes for users

| Who | Today | After |
| --- | --- | --- |
| TypeScript MongoDB contract | No validator; any document shape accepted | The PSL validator: closed, `strict` / `error` |
| Its storage hash | Ignores field names | Changes once; includes the fields |
| `migration plan` / `db update` after upgrading | — | One `collMod` per collection adds the validator (`widening`), as PSL users got when validators were closed |
| `migration plan` renaming or removing a field on a TypeScript contract | Refused (temporary) | Planned, as on PSL |
| A TypeScript model without an `ObjectId` `_id` | Accepted | Refused when the contract is built, as PSL refuses it |
| A TypeScript enum whose codec stores a BSON type a validator cannot list | Accepted | Refused when the contract is built, as PSL refuses it |
| PSL contracts | — | Unchanged, byte for byte |

## Decisions to check

1. **No opt-out.** PSL has none; parity means TypeScript gets none. A user who needs an open collection uses a control policy other than `managed`, as today.
2. **Existing documents are the main risk.** MongoDB does not check existing documents when `collMod` adds a validator, but every later write to a document must produce a valid one. A stored document with an extra field or a wrong type can no longer be updated. The upgrade instructions say so, give a `$jsonSchema` query that lists the documents that would fail, and say to fix them before applying the migration.
3. **Models without `_id` are refused.** A closed validator without `_id` rejects every insert, because MongoDB adds `_id`. So the TypeScript builder refuses such a model, as PSL does, rather than writing a validator that cannot work.

4. **Embedded models are validated as nested objects.** The TypeScript builder can embed one model inside another through an embed relation; PSL MongoDB has no such models. A closed validator built from a model's own fields alone would reject every document that holds an embedded model, so the embedded model's fields are validated as a nested closed object, as a value object's are (decided by the orchestrator, 2026-10-15, from the PR 1 design review).
5. **Decided in PR 2:**
   - Two root models in one collection without a discriminator: today the second model's validator silently replaces the first.
   - An embedded model with variants: the validator describes only its base fields, as a closed object, so an embedded variant with its own fields is rejected. Either the builder refuses an embed of a model with variants, or the validator describes each variant with `oneOf` and the recursive groups gain an edge from a base to its variants.
   - An embed relation to a model with no owner: `rel.hasMany('Node')` on a root `Node` builds today, so a root model or a variant can embed itself. The validator handles it, but the builder may need to refuse it, because the model would be stored both in its collection and inside other documents.
6. **A type that contains itself opens below the point where it is entered.** A value object or an embedded model can contain itself, directly (a navigation item with child items) or through other types. Types that can reach each other form a recursive group. `$jsonSchema` has no references, so no validator can describe a group at every depth. Where a document enters a group, the validator describes the entry type in full. Below it, every field that refers back into the same group accepts any object, in the field's usual list or nullable form. Types outside the group are described in full. The levels above are checked in full and no valid document is refused. A recursive group is written out once for each place a document enters it, instead of once for each path through it: a rule that opened only where a type repeated on its own path grew factorially when several types referred to each other. Refusing recursion instead would stop users from modelling trees that the types file and the runtime already support. Before this change a PSL MongoDB contract with such a value object failed to emit with a stack overflow, on main too (decided by the orchestrator, 2026-10-15).

## How (two pull requests)

1. **Move the derivation; no output changes.** `deriveJsonSchema`, `derivePolymorphicJsonSchema`, the per-collection loop from the PSL interpreter, and the enum listability check from the family package move into `@internal/mongo-contract`. PSL calls them from there. Every PSL fixture and hash is unchanged (`pnpm fixtures:check`).
2. **The TypeScript builder calls it.**
   - Codec and data type lookups come from the target and every extension pack the contract lists, as PSL gets them from the control stack. A field whose codec has no MongoDB data type is refused, not silently dropped.
   - The `_id` and enum refusals, with the PSL wording adapted to the builder.
   - 4a's temporary refusal (`same-hash-field-changes.ts`) and its docs go.
   - The side-by-side test stops stripping `validator` and `storageHash`, so it checks parity from now on.
   - Fixtures re-emitted; tests that assert a collection without a validator updated.
   - Docs: the `prisma-8` skill line saying TypeScript contracts have no validator; the MongoDB Family doc; an app upgrade fragment (re-emit, find failing documents, apply with `db update` or `migration plan` + `db migrate`). Released upgrade notes that recommend a TypeScript contract to avoid the validator stay as they are; the new fragment says that route is gone.

## Scope

**In:** the two pull requests above. **Out:** the Prisma 6 reader, which has no validator on purpose; MongoDB `contract infer`, which does not exist.

## Done when

- The side-by-side MongoDB fixture emits the same `contract.json` and storage hash from PSL and TypeScript, with nothing stripped.
- A field rename and a field removal on a TypeScript contract plan and apply through `migration plan` + `db migrate`, and the temporary refusal is gone.
- Following the upgrade fragment as printed on a TypeScript project with documents ends with the validator applied and `db verify` clean.
