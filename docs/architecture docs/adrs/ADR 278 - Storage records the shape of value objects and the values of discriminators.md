# ADR 278 — Storage records the shape of value objects and the values of discriminators

## At a glance

A SQL model stores a value object in one JSON column:

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

Every row of `User` holds a document such as `{"street": "Main St", "city": "Oslo"}` in its `address` column. Suppose the schema renames `street` to `line1`. The rows still hold `street`, so the application reads `line1` as missing.

The contract has two parts. The domain part describes what the application works with. The storage part describes what is stored, and its hash, `storageHash`, is what the migration system uses to tell one database state from another. Without this decision, storage describes the column like this:

```json
"address": { "codecId": "pg/jsonb@1", "dataType": "pg/jsonb", "nullable": true }
```

That line is the same before and after the rename. The storage hash does not change, so the migration system sees no change, and nothing warns that every row's data no longer matches.

With this decision, storage also records the keys the column's documents hold:

```json
"documentShape": {
  "Address": {
    "kind": "documentShape",
    "fields": {
      "city": { "codecId": "pg/text@1", "nullable": false },
      "street": { "codecId": "pg/text@1", "nullable": false }
    }
  }
}
```

Renaming `street` changes this entry, so it changes the storage hash. The migration planner sees the change the same way it sees a renamed column.

## Decision

On SQL, storage records two kinds of stored data that the domain part also describes:

1. **The shape of each value object stored in a JSON column**, as a `documentShape` entry that the column names.
2. **The values of each discriminator column**, as a value set that the column names. A value set is the existing storage entry that lists a column's allowed values ([ADR 157](ADR%20157%20-%20Execution%20enums.md)).

Both are recorded, not enforced. The build derives no database check from them, and the database never sees them. Their only effect is that a change to them changes `storageHash`.

A storage change that needs no database operation, such as adding an optional field to a value object, is planned as a migration with no operations. Applying it moves the database to the new storage hash.

## Why

The migration system works in storage hashes. A migration leads from one storage hash to another. The database records the hash it was last migrated to. Saved copies of past contracts are filed by storage hash. A change that leaves the storage hash alone is invisible to all of these, so the system can neither plan it nor refuse it.

The keys inside a value object's JSON are stored data, and so are the values in a discriminator column. Every `User` row holds `street`, and every row of a variant holds that variant's discriminator value. When only the domain part describes them, three things go wrong after a change:

- `migration plan` reports no changes.
- A migration from a hash to the same hash is rejected unless it contains a hand-written data operation.
- The saved contract for that hash is the first one ever saved with it, so a plan that compares against "the previous contract" may compare against one several changes old.

So the rule is that storage describes what is stored, not only what the database enforces. Storage already follows this rule elsewhere. SQLite has no check for an enum, yet the enum's value set is in storage, and changing it changes the hash. On MongoDB, the collection validator in storage lists the fields of embedded value objects ([MongoDB Family](../subsystems/10.%20MongoDB%20Family.md)). This decision brings SQL value objects and discriminators under the same rule.

## How

### Value object shapes

A `documentShape` entry describes one value object as stored, just as a value set describes one enum as stored. It lives beside the tables, at `storage.namespaces.<ns>.entries.documentShape.<Name>`. Its `fields` are keyed by the key the JSON holds, which is the value object field's name, because a value object field cannot be stored under another name. Each field is one of:

- a scalar: `{ codecId, nullable }`, plus `valueSet` when an enum types it;
- a nested value object: `{ shape, nullable }`, where `shape` names another `documentShape`;
- either of these as a list: the same, plus `many: { elementNullable }`, as on the domain field ([ADR 258](ADR%20258%20-%20List%20cardinality%20has%20independent%20container%20and%20element%20nullability.md)).

A column that holds a value object names its shape. A column that holds a list of them also says so:

```json
"address":  { "dataType": "pg/jsonb", "nullable": true,  "document": { "shape": { "entityKind": "documentShape", "entityName": "Address", "namespaceId": "public", "plane": "storage" } } },
"previous": { "dataType": "pg/jsonb", "nullable": false, "document": { "shape": { "entityKind": "documentShape", "entityName": "Address", "namespaceId": "public", "plane": "storage" }, "many": { "elementNullable": false } } }
```

Shapes name each other rather than nest copies, so a value object that contains itself, such as a `NavItem` whose `children` are `NavItem`s, is one entry that names itself.

### Discriminator values

```prisma
model Task {
  id   Int    @id
  type String
  @@discriminator(type)
}

model Bug {
  severity String
  @@base(Task, "bug")
}
```

The build writes one value set per base model that has variants, holding each variant's discriminator value as the column stores it. The base table's discriminator column names it:

```json
"type": { "dataType": "pg/text", "nullable": false, "valueSet": { "entityKind": "valueSet", "entityName": "Task.type", "namespaceId": "public", "plane": "storage" } }
```

```json
"valueSet": { "Task.type": { "kind": "valueSet", "values": ["bug"] } }
```

The value set is keyed `<Base>.<discriminator field>`. An enum's name cannot contain a dot, so this key never collides with an enum's value set. A variant stored in its own table changes nothing here, because its rows are still told apart by the base table's column. No check is derived, because a check would reject rows of the base model whose value no variant names.

### Who reads them

- **The migration planner** compares them between the old and new contract, to find renamed and removed value object keys and changed discriminator values.
- **Schema verification** has nothing in the database to compare them with, and skips them, as it does a SQLite enum's value set.
- **Nothing at runtime** reads them. The ORM keeps reading the domain part.

### Scope

This decision covers SQL. A polymorphic value object, a dictionary of value objects and a union of types are not covered, because no SQL schema can declare them.

## Consequences

- Any change inside a value object changes the storage hash, including changes that need no rewrite of the rows. Those plan as migrations with no operations.
- A renamed or removed value object field, a changed discriminator value, and a removed variant that has no columns of its own are all visible to the planner. It asks about them and can plan their rewrite, as for any other storage change.
- Storage repeats what the domain part says about value objects and discriminators. Both are written from one declaration in the schema, as an enum and its value set are, so they cannot disagree.
- Whether and how efficiently the rows get rewritten is a separate decision. This one only makes the change visible.

## Alternatives considered

- **Keep these facts in the domain part only, because the database schema does not change.** The database's tables, columns and checks are the same after a value object field rename, so one could argue that the storage hash should stay the same and the migration system should ignore the change. Then the system can never detect the change, even to refuse it, and the old keys stay in every row without a word. SQL would also behave differently from MongoDB, whose validator records the fields.
- **Leave the storage hash alone, and record each such change as a migration from a hash to itself.** A migration with a hand-written data operation can already do this. But saved contracts are filed by storage hash, so a plan's "previous contract" can be several changes old. Fixing that means filing saved contracts by a different key, a larger change than this one. `db update`, which runs no data operations, still could not apply such a change.
- **Feed the value object definitions into the storage hash without recording them in storage.** The hash would change, but the planner compares storage, so it still could not tell what changed. Every other reader of the hash would also have to know that part of the domain feeds into it.
- **Derive a check from the discriminator values, as from an enum's values.** The database would then reject rows of the base model itself, whose value no variant names.

## Related

- [ADR 172 — Contract domain-storage separation](ADR%20172%20-%20Contract%20domain-storage%20separation.md)
- [ADR 173 — Polymorphism via discriminator and variants](ADR%20173%20-%20Polymorphism%20via%20discriminator%20and%20variants.md)
- [ADR 178 — Value objects in the contract](ADR%20178%20-%20Value%20objects%20in%20the%20contract.md): this decision replaces its section "Value objects need no special storage mapping" for SQL
- [ADR 157 — Execution enums](ADR%20157%20-%20Execution%20enums.md): value sets
- [Migration System § Statements](../subsystems/7.%20Migration%20System.md#statements)
