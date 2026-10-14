# Slice: enum-across-namespaces

Parent project: [`projects/lsp-rename/`](../../spec.md). A `pg.enum` column can name a `native_enum` declared in another namespace.

## At a glance

```prisma
namespace auth {
  native_enum OrderStatus { PENDING SHIPPED }
}

model Order {                         // table in public
  id     Int @id
  status pg.enum(auth.OrderStatus)
}
```

On `main` this is `PSL_UNKNOWN_ENTITY_REF`. After this slice the column is:

```json
"status": {
  "codecId": "pg/enum@1",
  "typeParams": { "typeName": "auth.OrderStatus" },
  "valueSet": { "namespaceId": "auth", "entityName": "OrderStatus" }
}
```

and the migration creates it with type `"auth"."OrderStatus"`. `prisma contract print` prints the field back as `pg.enum(auth.OrderStatus)`.

## Chosen design

Three changes, each where the namespace-of-the-column assumption sits today.

1. **SQL interpreter** (`contract-psl/src/psl-column-resolution.ts`). The PSL path takes the entity from the binder's resolution of the argument (recorded since #30659): a `block` resolution gives the block's name and `resolution.namespace.id` (#30700). The lowered entity and its derived value set are looked up under that namespace id instead of the field's, and the value-set reference carries that id.
   - `unresolved`: no diagnostic from the interpreter; the binder reported it.
   - any other resolution: the existing `PSL_UNKNOWN_ENTITY_REF`, text unchanged.
   - the Prisma 7 interpreter is not changed: it keeps passing its synthesized call, and its own refusal of an enum from another schema stays.
2. **Contract builder** (`contract-ts/src/target-authoring-hooks.ts`, `resolveColumnDescriptor`). The type name is qualified with the namespace of the column's value-set reference when it has one, and with the table's namespace otherwise. The descriptor type does not change.
3. **Postgres printer** (`postgres/src/core/psl-print/`). A column whose value-set reference points at another namespace than its table prints `pg.enum(<namespace>.<name>)`; the enum block prints in its own namespace as it does today.

## Scope

**In:** the three places above and their tests; one Postgres migration-plan test for the cross-namespace column.

**Out:** the Prisma 7 interpreter; the TypeScript builder (`defineContract`), which files a `pg.enum` handle's entity under the column's namespace; a named type over `pg.enum` (slice 4); the value-set entry keyed by block name after a rename.

## Slice-specific done conditions

- [ ] For every same-namespace fixture the emitted contract is unchanged; `pnpm fixtures:check` passes.
- [ ] Tests: a top-level table naming `auth.OrderStatus`; a table in `auth` naming a top-level enum unqualified; the migration plan creates the column with the schema-qualified type; `contract print` of that contract reads back to the same contract.
- [ ] An unknown name in `pg.enum(...)` produces exactly one diagnostic, the binder's.
- [ ] `git diff origin/main -- packages/2-sql/2-authoring/contract-prisma7` is empty.

## References

- #30659 (binder binds the argument), #30700 (one scope for top level and the default namespace; `NamespaceSymbol.id`)
