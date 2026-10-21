# ADR 278 — Value objects are storage entities, and a discriminator column names a value set

**Status:** Accepted, implementation pending
**Date:** 2026-10-21
**Domain:** Contract, Migration System

The contract gains the storage entity for value objects and the discriminator value set in a later change of this work; the contract today still keeps value objects in the domain plane.

## At a glance

A model stores a value object in one column on SQL, and as a subdocument on MongoDB:

```prisma
type Address {
  street String
  city   String
}

model User {
  id      Int      @id
  address Address?
}
```

Every `User` row holds a document such as `{"street": "Main St", "city": "Oslo"}`. Suppose the schema renames `street` to `line1`. The rows still hold `street`, so the application reads `line1` as missing.

The contract has two planes ([ADR 221](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md)). `domain` describes what the application works with. `storage` describes what is stored, and its hash, `storageHash`, is how the migration system tells one database state from another. When `Address` lives in the domain plane, the rename changes nothing in storage, the hash stays the same, and the migration system sees no change.

So `Address` lives in the storage plane, and the domain field refers to it there by coordinate:

```json
{
  "domain": {
    "namespaces": {
      "public": {
        "models": {
          "User": {
            "fields": {
              "address": {
                "nullable": true,
                "type": { "kind": "valueObject", "entityKind": "valueObject", "entityName": "Address", "namespaceId": "public", "plane": "storage" }
              }
            }
          }
        }
      }
    }
  },
  "storage": {
    "namespaces": {
      "public": {
        "entries": {
          "valueObject": {
            "Address": {
              "fields": {
                "city": { "nullable": false, "type": { "codecId": "pg/text@1", "kind": "scalar" } },
                "street": { "nullable": false, "type": { "codecId": "pg/text@1", "kind": "scalar" } }
              }
            }
          }
        }
      }
    }
  }
}
```

Renaming `street` changes the storage entity, so it changes `storageHash`. The planner sees the change the same way it sees a renamed column.

## Decision

1. **A value object is a storage entity.** It lives at `storage.namespaces.<ns>.entries.valueObject.<Name>`, in both families, with the same definition it had in the domain plane: `fields`, each with `nullable`, `type` and, for a list, `many`. A domain field that holds one refers to it by entity coordinate, as a field typed by an enum refers to its value set. A value object field that holds another value object refers to it the same way.
2. **A discriminator column names a value set.** The build writes one value set per base model that has variants, holding each variant's discriminator value as the column stores it, and the base table's discriminator column refers to it, as an enum column refers to its value set ([ADR 157](ADR%20157%20-%20Execution%20enums.md)).

Both are enforced where the database can enforce them, as an enum's value set is: on a managed Postgres table the build derives a check for the discriminator column and for a column that holds a value object, and on MongoDB the collection validator lists the value object's fields and the discriminator's values.

## Why

Which plane an entity belongs to depends on what it is used for. The migration planner, the database marker and the saved contract snapshots all work in storage hashes, so a fact the planner must see belongs in storage. A value object's fields are such a fact: they are the keys every row holds in that column, or every subdocument holds in that collection. A discriminator's values are the same kind of fact for its column. The domain plane may refer to the storage plane, never the reverse, so the domain field keeps its reference and storage keeps the definition.

When these facts sit only in the domain plane, a change to them is invisible to the migration system:

- `migration plan` reports no changes.
- A migration from a hash to the same hash is rejected unless it carries a hand-written data operation.
- Snapshots are saved by storage hash, and the first one saved for a hash is kept, so a plan's "previous contract" may be several changes old.

The rows then hold keys and values the contract no longer names, without a word. Refusing a schema change that silently loses data is what the migration system's refusal exists for, and it cannot refuse a change it cannot see.

Storage already holds stored facts the database does not enforce. SQLite derives no check for an enum, yet its value set is in storage, and changing it changes the hash. The MongoDB collection validator lists the fields of embedded value objects. This decision applies the same rule to value objects on SQL and to discriminator values.

## How

**Value objects.** The storage entity keeps the field definition the domain plane used, so every reader of a value object's fields reads the same shape, from the storage plane. Scalar members carry their codec and, when an enum types them, a `valueSet` reference. A member that is a value object refers to its storage entity by coordinate, so a value object that contains itself, such as a `NavItem` whose `children` are `NavItem`s, is one entity that refers to itself. On SQL the column that holds a value object stays a JSON column; on MongoDB the validator is derived from the storage entity, as it is from the definition today.

**Discriminators.** The value set is keyed `<Base>.<discriminator field>`, such as `Task.type`. An enum's name cannot contain a dot, so the key never collides with an enum's value set. A variant stored in its own table changes nothing here: its rows are still told apart by the base table's column. The ORM writes a row only through a variant, so every row's value names a variant, and the derived check (`"type" IN ('bug', 'feature')`) rejects only a value no variant names, as an enum's check does.

```json
"type": { "codecId": "pg/text@1", "dataType": "pg/text", "nullable": false, "valueSet": { "entityKind": "valueSet", "entityName": "Task.type", "namespaceId": "public", "plane": "storage" } }
```

**Enforcement on Postgres.** A column that holds a value object gets a derived check, as an enum column does, written with `jsonb` operators. It checks that the required keys are present (`"address" ?& array['street', 'city']`) and that no other key is (`"address" - array['street', 'city'] = '{}'`), with a nullable column allowed to be null. For each scalar member it checks the JSON type (`jsonb_typeof("address" -> 'street') = 'string'`) and, where the member is not nullable, that the value is not JSON `null`. A nested value object and a list are checked through `jsonpath`. The exact predicate for every shape SQL authoring produces is settled when the storage change is built; a shape the check cannot cover is raised as an open question, not worked around. The check is opaque and content-named ([ADR 244](ADR%20244%20-%20Check%20constraints%20are%20opaque%20wire-named%20expressions.md)), so any change to the value object changes the check's name, and the diff drops the old check and adds the new one.

**Why every change is an operation.** The storage hash identifies a database state. Two different hashes are two different database states, so the migration between them does something to the database. Because the value object and the discriminator values are enforced, a change to either is a change to a check or a validator, which is an operation. A plan that changes the storage hash and produces no operation is therefore unexpected: it means the database cannot tell the two states apart. Such cases will still arise, so the system handles them rather than refusing: `migration plan` writes the package with no operations and says so, naming what changed, and `db migrate` applies it by moving the marker to the new hash.

**Who reads them.** The migration planner compares them between the origin and destination contracts, to find renamed and removed value object fields and changed discriminator values, and to order the row rewrite between the old check's drop and the new check's creation, as for an enum value. Type emission and the ORM read value objects from the storage plane through the domain field's reference.

## Consequences

- Any change to a value object, and any change to a variant's discriminator value, changes `storageHash` and the enforcing check or validator. The planner asks about the ones that lose data and plans their rewrite, as for any other storage change.
- A removed variant that has no columns of its own is visible to the planner through the value set.
- Whether the rows are rewritten, and how efficiently, is a separate decision. This one only makes the change visible.
- `valueObjects` is no longer a domain namespace key.

## Alternatives considered

- **Keep value objects in the domain plane, because the database schema does not change.** The tables, columns and checks are the same after a value object field rename, so one could hold that the storage hash should not change and the migration system should ignore it. Then the system can never detect the change, even to refuse it, and the old keys stay in every row without a word.
- **Keep them in the domain plane and record such a change as a migration from a hash to itself.** A migration with a hand-written data operation can already do this. But snapshots are saved by storage hash, so a plan's "previous contract" can be several changes old. Fixing that means a different snapshot key, a larger change than this one, and `db update`, which runs no data operations, still could not apply it.
- **Copy the definition into the storage plane and keep the domain copy.** The hash would change, but two copies of one definition invite drift, and the domain plane can already refer to storage.
- **Feed the domain value objects into the storage hash without moving them.** The hash would change, but the planner compares storage, so it still could not tell what changed, and every reader of the hash would have to know that part of the domain plane feeds it.
- **Record the facts in storage without enforcing them.** The hash would change while the database stayed the same, so a change would need a migration with no operations. That contradicts what the hash means, and it leaves rows the contract no longer describes.

## Related

- [ADR 221 — Contract IR two planes with uniform entity coordinate and pack-contributed entity kinds](ADR%20221%20-%20Contract%20IR%20two%20planes%20with%20uniform%20entity%20coordinate%20and%20pack-contributed%20entity%20kinds.md): the planes, coordinates and the direction of references
- [ADR 172 — Contract domain-storage separation](ADR%20172%20-%20Contract%20domain-storage%20separation.md)
- [ADR 178 — Value objects in the contract](ADR%20178%20-%20Value%20objects%20in%20the%20contract.md): this decision replaces its sections "Value objects are a top-level contract section" and "Value objects need no special storage mapping"
- [ADR 173 — Polymorphism via discriminator and variants](ADR%20173%20-%20Polymorphism%20via%20discriminator%20and%20variants.md)
- [ADR 157 — Execution enums](ADR%20157%20-%20Execution%20enums.md): value sets
