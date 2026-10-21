# Slice 3b — The remaining renames and deletes on Postgres and SQLite

**Linear:** [TML-3537](https://linear.app/prisma-company/issue/TML-3537) · **Builds on:** slices 1, 2 and 3a (merged) · **Project:** [`../../spec.md`](../../spec.md)

## In one example

A Postgres schema moves `Invoice` into a `billing` namespace, renames the enum value `Status.ARCHIVED` to `Status.RETIRED`, and renames `Address.street` to `Address.line1` inside a value object.

```text
$ prisma migration plan --name tidy --rename Invoice:billing.Invoice --rename Status.ARCHIVED:Status.RETIRED --rename Address.street:Address.line1
✔ Planned 4 operation(s)
  Move table "public"."Invoice" to schema "billing"                       widening
  Update "Order"."status" from 'ARCHIVED' to 'RETIRED'                    widening
  Rename key "street" to "line1" in "User"."address"                      widening
  ...
```

Without the statements, both commands refuse and print them, as they do today for models and fields.

## What changes for users

| Change in the schema | Today | After this slice |
| --- | --- | --- |
| Model moved to another namespace | Refused, even with `--rename` | `--rename Invoice:billing.Invoice` moves the table (`SET SCHEMA`) |
| Namespace renamed | Old schema and its tables kept silently; new ones created empty | Asked. `--rename billing:finance` renames the schema |
| Namespace removed | Its tables kept silently | Asked. `--delete billing` drops its tables and the schema |
| Enum value renamed (stored value changes) | Postgres: the new CHECK fails at apply on rows with the old value. SQLite: planning fails with "no operations" | Asked. `--rename Status.A:Status.B` updates the rows |
| Enum value removed | Same as above | Asked. `--delete Status.A` sets it to NULL where the field is optional; refused where it is required |
| Enum value renamed, stored value unchanged (`@map`) | Nothing planned | Same. A `--rename` is accepted and reported with no operations |
| Field inside a value object renamed | Nothing planned; old keys stay in the JSON | Asked. `--rename Address.street:Address.line1` rewrites the key in every column that holds an `Address` |
| Field inside a value object removed | Nothing planned; old keys stay | Asked. `--delete Address.street` removes the key |
| Variant's discriminator value changed | Nothing planned; its rows stop being that variant | Asked. `--convert Bug` updates the rows to the new value |
| Variant removed | Its own columns or table are dropped; its base rows stay, claimed by no model | Asked as one model. `--delete Bug` deletes its rows, then drops its columns or table |
| `--allow` question | "would widen who can read and write its rows" | "would widen who can read and write its data". `accessWidening` becomes `accessChanges` |

Namespace items are Postgres only: SQLite has no namespaces. Everything else works on both targets.

## Decisions to check

1. **Storage records what value objects and variants store, so the planner can see changes to them** (agreed with Will, 2026-10-21). Today a value object field rename, a discriminator value change and a variant removal with no own columns change only the domain. The storage hash covers only storage, so it stays the same, and the migration system cannot see the change at all:
   - `migration plan` reports "No changes detected".
   - A migration whose start and end hash are equal fails the integrity check, unless it has a `data` operation.
   - Snapshots are keyed by storage hash, and the first write wins. So the origin contract a plan reads can be several changes old.

   Storage therefore describes what is stored, not only what the database enforces, as it already does for SQLite enum value sets:
   - **Discriminator values** are a value set. The base table's discriminator column names it with a `valueSet` reference, the existing primitive (ADR 156, ADR 157). No check is derived, so rows of the base model itself are never rejected. No new storage format.
   - **Value object shapes** are described in the storage block: each JSON column that holds value objects records their keys, nesting and lists. This is new in the storage format and reverses ADR 178's "value objects need no special storage mapping". A new ADR records the decision and the exact shape: [ADR 278](../../../../docs/architecture%20docs/adrs/ADR%20278%20-%20Storage%20records%20the%20shape%20of%20value%20objects%20and%20the%20values%20of%20discriminators.md), which lands with PR 3. It is recorded, not enforced.

   **Cost:** every contract with value objects or variants gets a new storage hash once and is re-emitted, with an upgrade fragment. Their next plan has a changed hash and possibly no operations.

   **Not in this slice: efficient rewrites.** Once the planner sees a change, it plans the rewrite as one plain operation (an `UPDATE` or `DELETE` over the matching rows), as the rest of this spec describes. On a large production table that operation holds row locks for its whole run, and nothing batches it or runs it in the background. Making these rewrites cheap is a later optimization, recorded in `deferred.md`. Seeing the change comes first, because without it no later optimization is possible.
2. **Native Postgres enums stay hand-written.** You ruled on 2026-10-13 that Prisma 8 does not rename, remove or reorder native enum values itself. A native enum also has no member names in the contract, so a statement has nothing to name. Enum value statements therefore cover enums that the contract declares, which are stored as a column with a CHECK on Postgres and a plain column on SQLite. The native enum refusal stays as it is, pointing to a hand-written migration. The project spec and design notes say "native Postgres enums rename the value". I'll correct them.
3. **A removed namespace becomes a question.** Today the Postgres planner ignores every schema the destination contract does not declare. That protects schemas Prisma does not manage, such as Supabase's `auth`. After this slice, a schema that the origin contract declared and the destination does not is a removal: its tables are asked about, and `--delete billing` answers all of them. A schema the origin contract never declared is still ignored. Without an origin contract (`db update` with no snapshot), nothing changes.
4. **`--convert` on a variant works on `db update` too.** Both values are known, so there is no placeholder and no file to fill. The row updates, like MongoDB's document rewrites, are classed by their effect: renames and conversions are `widening`, and deleting rows or setting values to NULL is `destructive`. So `db update` can run them.
5. **A value object that can contain itself is refused.** A rename inside a value object that is reachable from itself (`NavItem.children`) would have to rewrite to any depth. The refusal points to a hand-written data transform. Slice 4p made the same choice for the MongoDB validator. No SQL authoring surface produces such a value object today, but nothing refuses one either.
6. **Four pull requests, in order.** See [Pull requests](#pull-requests). The first two do not depend on decision 1.

## Statement grammar

Each side of a statement is still one to three names separated by dots. New things a name can refer to:

| Statement | Reads as |
| --- | --- |
| `--rename billing:finance` | A namespace. One name is now read as a namespace or a model |
| `--rename Invoice:billing.Invoice` | A model whose namespace changes (a move) |
| `--rename Status.A:Status.B` | An enum value |
| `--rename Address.street:Address.line1` | A field of a value object |
| `--convert Bug` | A variant. `--convert` now accepts a model name, for a variant only |
| `--delete billing`, `--delete Status.A`, `--delete Address.street`, `--delete Bug` | The same subjects |

- The rule from slice 1 stays: when exactly one reading resolves, it is used. When several resolve, the statement is refused and the message lists the readings.
- A model, value object and enum cannot share a name in one namespace, so two-name statements are rarely ambiguous. A namespace that shares its name with a model is the common case. The message then asks for the qualified form.
- A field inside a nested value object is named through its own value object (`GeoPoint.lat`), never through a path (`Address.location.lat`). The statement then applies everywhere that value object is used.
- Both sides must refer to the same kind of thing: an enum value cannot be renamed into another enum, and a value object field cannot move to another value object.

## What each statement does

**Namespaces (Postgres)**
- Model move: `ALTER TABLE … SET SCHEMA`. Constraints and indexes keep their names. A foreign key from another table follows the table.
- Namespace rename: `ALTER SCHEMA … RENAME TO`. Refused for a schema another contract space also declares, such as `public` when an extension installed its types there.
- Namespace delete: drops each table, then `DROP SCHEMA`. `--delete billing` is expanded by the CLI into an answer for each of the namespace's questions before the questions are asked. The CLI engine matches a flag only to its own subject.

**Enum values (Postgres and SQLite)**
- The storage effect is worked out from stored values, not member names.
- A rename updates every column typed by the enum: scalar columns with `UPDATE … SET col = new WHERE col = old`, list columns with `array_replace`. Enum values inside value object JSON are rewritten in the last PR, with the other JSON rewrites.
- On Postgres the update runs between dropping the old CHECK and adding the new one.
- A delete sets the value to NULL in optional columns and removes it from list columns. Where a required column holds it, the statement is refused, naming the column, and the message points to `--rename` or a hand-written migration.

**Value object fields (Postgres and SQLite)**
- The planner finds every column whose type reaches the value object, through nesting and lists. It rewrites the key in each one: `jsonb` operators on Postgres, `json_` functions on SQLite. Only documents that hold the old key are touched.
- A delete removes the key the same way.

**Variants (Postgres and SQLite)**
- `--convert Bug` updates the base table's discriminator column from the old value to the new one.
- `--delete Bug` deletes the base table's rows that hold its value. For a variant stored in its own table, the foreign key's cascade deletes those rows too, and the planner then drops the table. For a variant stored in its base's table, the planner then drops the columns only it used. The refusal says that rows are deleted.
- A variant field statement on a variant with its own table acts on that table, as you asked on 2026-10-09 for when SQL stored variants in their own tables. It now does.

**The access question.** The question says "would widen (or change) who can read and write its data". The framework doc comments lose their row-level-security examples, and those examples move to the Postgres target. `accessWidening` becomes `accessChanges` in the framework, the CLI, the targets, the `--json` output and the `acceptAccessWidening` option, which becomes `acceptAccessChanges`. That is a breaking change, so it gets an upgrade fragment.

Every operation the planner writes is also something a user could write in `migration.ts`. Re-running the file reproduces `ops.json`, as for every statement so far.

## Pull requests

| PR | Contents | Needs |
| --- | --- | --- |
| 1 | Namespaces: move, rename, delete, and a removed namespace becomes a question. The access question wording and rename | — |
| 2 | Enum values: rename and delete in scalar and list columns, on Postgres and SQLite | 1 merged |
| 3 | Storage records value object shapes and discriminator values (decision 1), with the new ADR. A storage change that needs no database operation, such as a new optional value object field or a new SQLite enum value, plans a migration with no operations; today `migration plan` fails with "no operations". Contracts re-emitted, with an upgrade fragment. No statements yet | 2 merged |
| 4 | Value object field rename and delete, including enum values inside JSON. Variant convert and delete | 3 merged |

PR 3 is separate because it changes every contract with value objects or variants and needs its own review, as slice 4p's first PR did. Slice 4b reuses PR 4's value object statement support for MongoDB.

## Scope

**In:** everything in the table above; error reference, Migration System § Statements and its "Rename limits", the CLI README, `skills/prisma-8/references/migrations.md`; upgrade fragments for the access rename (PR 1) and the storage change (PR 3); the new ADR, with update notes on ADR 172 and ADR 178 (PR 3); correcting ADR 223's statement that emission rejects several namespaces.

**Out:**
- Native Postgres enum values (decision 2).
- A storage name change with no domain change (`@@map` alone). This is the separate syntax question still open with you.
- Moving a variant between its base's table and its own table, and making a model a variant. These stay hand-written.
- Dictionaries and unions of value objects. No SQL authoring surface produces them. The rewrite refuses a column that holds one, naming it.
- MongoDB: slice 4b.

## Edge cases already known

| Case | Handling |
| --- | --- |
| An enum member keeps its name but its stored value changes | No statement can say this. Asked with `--delete` only; the advice says to write the update by hand, as for `@@map` today |
| A removed variant with no columns of its own | Now asked as a model, so its rows are not left behind silently |
| Renaming `public` | Allowed when no other contract space declares it. Models outside any `namespace` block then live in the new schema |
| `--delete billing` and `--rename billing.Invoice:Invoice` in one run | The rename runs first, so that model is kept, and the delete covers the rest |

## Done when

- The project's done conditions for namespaces, enum values, value objects and variants pass on Postgres, and on SQLite where the item applies.
- Every journey runs through both `migration plan` and `db update`, and a later plan is empty.

## Implementation notes

- Grounding report (local, gitignored): `wip/3b-grounding.md` in this worktree.
- New subject kinds: `namespace`, `enumValue`, `valueObjectField`. Every exhaustive switch over `MigrationSubject` gets the new kinds (`migration-statements.ts`, `plan-questions.ts`).
- New SQL operations need the full set: call class, op builder with checks, `renderTypeScript`, a facade method with the same arguments, a subjects mapping, and a working-schema step.
- The variant lookup that MongoDB uses (`variantFilter`, `discriminatorValueChange` in `mongo-statement-planning.ts`) is pure domain logic. Move it to the framework so SQL and MongoDB share it. `deferred.md` asks for the selection to be carried as a typed value, not read back from a filter.
- The removed-namespace filter is in `diff-database-schema.ts` (`ownedSchemaNames`). The owned set becomes the destination's namespaces plus the origin contract's, when an origin contract is known.
