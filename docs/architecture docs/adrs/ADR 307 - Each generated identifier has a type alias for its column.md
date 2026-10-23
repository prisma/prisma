# ADR 307 — Each generated identifier has a type alias for its column

**Status:** Proposed
**Date:** 2026-10-23
**Amends:** [ADR 275 — Client generators are field attributes, and a type alias is expanded into each column](ADR%20275%20-%20Client%20generators%20are%20field%20attributes%2C%20and%20a%20type%20alias%20is%20expanded%20into%20each%20column.md)
**Builds on:** [ADR 269 — PSL mixins](ADR%20269%20-%20PSL%20mixins.md)

---

## At a glance

```prisma
model User {
  id    Ulid @id @onCreate(ulid())
  posts Post[]
}

model Post {
  id       Ulid @id @onCreate(ulid())
  authorId Ulid
  author   User @relation(fields: [authorId], references: [id])
}
```

`Ulid` is a type alias for `Char(26)`, the column a ULID is stored in. Three things follow from it:

- The id and the foreign key use the same alias, so nobody writes the length 26.
- The id field generates its value with `@onCreate(ulid())`, written on the field.
- The foreign key `authorId` uses the alias alone. Its value is copied from the user it points at, so it must not generate one.

## Decision

Prisma provides one type alias for the column of each identifier format that the client generates. The alias names the column type and nothing else. A field that generates the identifier adds `@id` and `@onCreate(...)` itself. A field that holds a copy of the identifier, such as a foreign key, uses the alias alone.

These aliases are contributed aliases. The SQL family and the Postgres target provide them, as the temporal aliases such as `temporal.CreatedAt` are provided. They are not aliases the user declares in a schema's `types {}` block.

## The problem: every identifier needs a fixed column length

Each identifier format has a fixed length when it is stored as text:

| Format | Characters |
|---|---|
| UUID as text | 36 |
| ULID | 26 |
| nanoid (default size) | 21 |
| CUID2 | 24 |
| KSUID | 27 |

Without an alias, each schema writes these lengths by hand, such as `Char(26)`, and its author has to know them. A mistake has a cost:

- **A column that is too short is refused.** Each generator states how many characters it writes, and a shorter column fails with a message such as `uuid() writes 36 characters, which does not fit a column of 5 characters.` (ADR 275). SQLite is the exception: it stores a longer value in any column, so it refuses no column for its length.
- **A column that is too long is accepted, and it is wrong.** On Postgres, a `char` column pads a shorter value with spaces, so the stored identifier is not the one the client generated.

Identifier columns appear in almost every model, as primary keys and as foreign keys. So without aliases, the length is written, and can be wrong, in almost every model.

## An alias names the column, and the field names the generator

| Alias | Stands for | A field that generates the value writes |
|---|---|---|
| `UuidString` | `Char(36)` | `@onCreate(uuid())` or `@onCreate(uuid(7))` |
| `Ulid` | `Char(26)` | `@onCreate(ulid())` |
| `Nanoid` | `Char(21)` | `@onCreate(nanoid())` |
| `Cuid2` | `Char(24)` | `@onCreate(cuid(2))` |
| `Ksuid` | `Char(27)` | `@onCreate(ksuid())` |

The UUID alias is named `UuidString`, not `Uuid`, because `Uuid` already names the native Postgres `uuid` column. The same name is used on every SQL target, so a schema reads the same on each.

The alias does not carry the generator, because two kinds of field use the same column:

- The primary key generates a new value.
- A foreign key holds a copy of a primary key, so it needs the same column and must not generate a value.

One alias for the column serves both. An alias that also carried the generator would serve only the primary key. Every foreign key would then need a second alias, or would write the length by hand again.

Writing the generator on the field also keeps the schema readable. A reader sees at the field that the client generates the id, in the same `@onCreate` attribute that every other generated value uses.

The alias also cannot carry `@id`. ADR 275 forbids an alias to carry `@id` or `@unique`, because the alias is used on fields that are not keys, such as the foreign key above. This ADR keeps that rule.

## Where the names live on each target

The aliases are written the way each target already writes its column types:

- **Postgres** writes column types as top-level names, such as `Char` and `Uuid`. So the aliases are top-level too: `id Ulid @id @onCreate(ulid())`.
- **Every SQL target** has the column types shared by SQL databases in the `sql` namespace, such as `sql.Char`. The aliases are there too: `sql.Ulid`.
- **SQLite and MySQL** have no top-level names for these columns, so `sql.Ulid` is the only way to write them there: `id sql.Ulid @id @onCreate(ulid())`.

## A one-word id is a mixin the user writes

`id Ulid @id @onCreate(ulid())` is the same in every model. A user who wants to write it once declares a mixin (ADR 269) and includes it with `+`:

```prisma
model mixin UlidId {
  id Ulid @id @onCreate(ulid())
}

model Post {
  +UlidId
  authorId Ulid
  author   User @relation(fields: [authorId], references: [id])
}
```

Prisma provides the aliases but not this mixin. A mixin fixes the names of its fields, and a model cannot override them. A mixin provided by Prisma would only fit models whose key is named `id` with no `@map`. A user's own mixin uses the user's own names.

## Native UUIDs need no alias

On Postgres, a UUID is best stored in the native `uuid` column, which the type constructor `Uuid` already names:

```prisma
model User {
  id Uuid @id @onCreate(uuid(7))
}
```

The native column is better than a text column in four ways:

- It takes 16 bytes, against about 37 for the same value as text, so indexes and foreign keys are smaller.
- Two values are compared as fixed-size binary values, with no text collation.
- Postgres rejects a value that is not a UUID.
- A version 7 UUID begins with a timestamp, so new rows are added at the end of a B-tree index. Random version 4 values are spread across the index.

`UuidString` is for SQL targets that have no native UUID type, and for schemas that need a UUID stored as text.

## Identifiers of another size

A contributed alias takes no arguments, so it has one fixed length. A nanoid of another size, such as `nanoid(12)`, has no alias, and its column is written out:

```prisma
model Invite {
  code Char(12) @id @onCreate(nanoid(12))
}
```

The length check still applies, so a column too short for the size is refused.

## TypeScript

In the TypeScript contract builder, a contributed alias is written `type.<Name>()` and used through `field.column(...)`:

```ts
id: field.column(type.Ulid()).id().onCreate(gen.ulid()),
authorId: field.column(type.Ulid()),
```

On SQLite and MySQL the alias is in the `sql` namespace, as in PSL: `field.column(type.sql.Ulid())`.

The TypeScript form of the mixin is a constant the user declares and reuses:

```ts
const UlidId = field.column(type.Ulid()).id().onCreate(gen.ulid());
```

## Consequences

- **An alias is only a name.** `Ulid` stores the same column as `Char(26)`, so the contract, its storage hash and its execution hash are the same whichever one a schema writes.
- **A generating id writes three parts:** the alias, `@id`, and the generator. That is longer than a single name, but each part says one thing, and the mixin gives a single name to a user who wants one.
- **The length check still applies.** A field that uses an alias is checked against its generator like any other field, on every target that checks lengths.
- **A schema's own name hides the top-level alias.** A model, composite type or type alias the schema declares with the name `Ulid` takes that name, so `Ulid` names the declaration, not the column. `sql.Ulid` still names the column.

## Alternatives considered

**An alias that carries the generator too.** Not chosen. It removes the length from the primary key but not from the foreign key, which must not generate a value. Each format would need a second alias for the bare column, so there would be two names for one column type.

**A mixin that Prisma provides.** Not chosen. A mixin fixes its field names, and a model cannot override them, so it fits only models whose key is named as the mixin names it. Targets and extensions would also need a new way to provide mixins. A user's own mixin has neither problem.

**`sql.Ulid` on every target.** Not chosen. On Postgres the column types are top-level names, and `sql.Ulid` beside `Char` and `Uuid` would be the only `sql.` name Postgres users write.

**A namespace for identifiers, such as `ids.Ulid`.** Not chosen. It groups the formats, but adds a namespace for five names. `Ulid` is a column type, and it reads best beside the other column types.

**No aliases.** Not chosen. Every model would write the length of each identifier by hand, which is the problem this ADR solves.
