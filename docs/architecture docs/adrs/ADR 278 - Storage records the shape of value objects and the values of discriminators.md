# ADR 278 — Storage records the shape of value objects and the values of discriminators

## Decision

On SQL, the storage plane records two facts that until now only the domain plane held:

- **The shape of the value objects a JSON column holds.** Storage gets a `documentShape` entry per value object, and the column names it.
- **The values a discriminator column holds.** The discriminator column names a value set listing the discriminator value of each variant.

Both are part of `storage`, so a change to either changes `storageHash`. Both are recorded, not enforced: the build derives no check from them, and the database does not see them.

```prisma
type Address {
  street String
  city   String
  zip    String?
}

model User {
  id      Int      @id
  address Address?
}

model Task {
  id    Int    @id
  type  String
  @@discriminator(type)
}

model Bug {
  severity String
  @@base(Task, "bug")
}
```

```json
{
  "storage": {
    "namespaces": {
      "public": {
        "entries": {
          "documentShape": {
            "Address": {
              "kind": "documentShape",
              "fields": {
                "city": { "codecId": "pg/text@1", "nullable": false },
                "street": { "codecId": "pg/text@1", "nullable": false },
                "zip": { "codecId": "pg/text@1", "nullable": true }
              }
            }
          },
          "table": {
            "User": {
              "columns": {
                "address": {
                  "codecId": "pg/jsonb@1",
                  "dataType": "pg/jsonb",
                  "nullable": true,
                  "document": {
                    "shape": { "entityKind": "documentShape", "entityName": "Address", "namespaceId": "public", "plane": "storage" }
                  }
                }
              }
            },
            "Task": {
              "columns": {
                "type": {
                  "codecId": "pg/text@1",
                  "dataType": "pg/text",
                  "nullable": false,
                  "valueSet": { "entityKind": "valueSet", "entityName": "Task.type", "namespaceId": "public", "plane": "storage" }
                }
              }
            }
          },
          "valueSet": {
            "Task.type": { "kind": "valueSet", "values": ["bug"] }
          }
        }
      }
    }
  }
}
```

Renaming `Address.street` to `line1`, or changing `Bug`'s discriminator value to `"defect"`, now changes `storageHash`. The migration planner sees the change by comparing the two contracts' storage, as it sees a renamed column.

## Why

The storage hash identifies the stored state a database must be in. The migration system works in storage hashes throughout: a migration is an edge from one storage hash to another, the database marker records one, and contract snapshots are stored by one. A change the storage hash does not cover is invisible to all of them.

The keys inside a value object's JSON and the discriminator values in a table are stored data. Every row of `User` holds `{"street": …}`, and every `Bug` row holds `"bug"` in `type`. When only the domain plane records them, renaming `street` to `line1` gives a contract with the same storage hash as before:

- `migration plan` reports no changes, so it can neither plan the rewrite nor refuse the data loss.
- A migration whose start and end hash are equal is rejected unless it contains a `data` operation.
- The snapshot for that hash is the first contract written with it, so any comparison with "the previous contract" can read one several changes old.

The rows still say `street`, and the application reads `line1` as missing. Nothing asks and nothing warns. A schema change that silently loses data is what the migration system's refusal exists to stop, and it cannot refuse a change it cannot see.

Storage already records stored facts the database does not enforce. SQLite derives no check for an enum, yet the enum's value set is in storage, and changing it changes `storageHash`. So the rule this ADR follows is that storage describes what is stored, not only what the database enforces. MongoDB already meets it: the collection validator lists the fields of embedded value objects ([MongoDB Family](../subsystems/10.%20MongoDB%20Family.md)).

## How

**Document shapes.** A `documentShape` entry is the storage projection of one value object, as a value set is the storage projection of one enum ([ADR 157](ADR%20157%20-%20Execution%20enums.md)). Its `fields` are keyed by the key the JSON holds, which is the value object field's name, since a value object field takes no `@map`. Each field is one of:

- a scalar: `{ codecId, nullable }`, plus `valueSet` when an enum types it;
- a nested value object: `{ shape: <documentShape reference>, nullable }`;
- either of these as a list: the same, plus `many: { elementNullable }`, as on the domain field ([ADR 258](ADR%20258%20-%20List%20cardinality%20has%20independent%20container%20and%20element%20nullability.md)).

A column that holds a value object carries `document: { shape }`, and a column that holds a list of them carries `document: { shape, many: { elementNullable } }`. Shapes refer to each other by name, so a value object that contains itself, such as `NavItem.children`, is one entry that names itself.

**Discriminator value sets.** The build writes one value set per base model with variants, keyed `<Base>.<discriminator field>`, holding each variant's discriminator value in the form the column stores it. A dot cannot appear in an enum's name, so the key cannot collide with an enum's value set. The base table's discriminator column names it. A variant stored in its own table changes nothing here: its rows are still told apart by the base table's column.

**What reads them.** The migration planner compares them between the origin and destination contracts to find renamed and removed value object keys and changed discriminator values. Schema verification has nothing to compare them with in the database and skips them, as it skips a SQLite enum's value set. The build derives no check from either. A check on the discriminator column would reject rows of the base model whose value no variant claims.

**Scope.** This covers SQL. A polymorphic value object, a dictionary of value objects and a union are not covered: no SQL authoring surface produces them.

## Consequences

- Every contract with value objects or variants gets a new storage hash once, when it is next emitted. The database is unchanged, so the first plan after the upgrade has a changed hash and no operations. The upgrade instructions say how to record it.
- A change inside a value object, a changed discriminator value, and a removed variant that has no columns of its own each change the storage hash. The planner asks about them, and a migration can carry the rewrite, as for any other storage change.
- The storage plane repeats what the domain plane says about value objects. Both are written from one declaration, as an enum and its value set are.
- Rewriting the rows is a separate question from seeing the change. This ADR only makes the change visible.

## Alternatives considered

- **Keep these facts in the domain plane only, since the database schema does not change.** The database's DDL is the same after a value object field rename, so one could hold that the storage hash should not change and the migration system should ignore it. Then the system can never detect the change, even to refuse it, and the old keys stay in every row without a word. It would also make SQL behave differently from MongoDB, whose validator does record the fields.
- **Leave the storage hash alone, and record domain-only changes as migrations from a hash to itself.** The integrity check already allows such a migration when it contains a `data` operation. But snapshots are stored by storage hash and the first one written is kept, so the planner's "previous contract" can be several changes old. Fixing that means storing snapshots by a different key, a larger change to the on-disk format than this one, and `db update`, which runs no `data` operation, still could not apply them.
- **Include the domain value object definitions in the storage hash's input, without recording them in storage.** This makes the hash change but keeps the fact outside the plane the hash describes, so the planner, which compares storage, still cannot see what changed. It also makes the hash depend on part of the domain plane, which every other reader of the hash would have to know.
- **Record discriminator values with a derived check, as an enum does.** The database would then reject a discriminator value no variant names, which includes rows of the base model itself.

## Related

- [ADR 172 — Contract domain-storage separation](ADR%20172%20-%20Contract%20domain-storage%20separation.md)
- [ADR 173 — Polymorphism via discriminator and variants](ADR%20173%20-%20Polymorphism%20via%20discriminator%20and%20variants.md)
- [ADR 178 — Value objects in the contract](ADR%20178%20-%20Value%20objects%20in%20the%20contract.md), whose section "Value objects need no special storage mapping" this ADR replaces for SQL
- [ADR 157 — Execution enums](ADR%20157%20-%20Execution%20enums.md), for value sets
- [Migration System § Statements](../subsystems/7.%20Migration%20System.md#statements)
