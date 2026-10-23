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

- `Ulid` is a type alias for `Char(26)`, the column a ULID is stored in.
- The id and the foreign key use the same alias, so the schema never states a length.
- The id field writes its generator, `@onCreate(ulid())`. The foreign key does not, because its value is copied from the user it points at.

A user who wants the id in one word writes a mixin:

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

## Decision

1. Each generated identifier format gets a contributed type alias for the column it is stored in. The alias carries no generator and no attribute.
2. A field that generates the identifier writes `@onCreate(fn())` itself. A field that holds a copy of one, such as a foreign key, uses the alias alone.
3. A one-word id is a mixin the user writes. Prisma ships the aliases; packs do not contribute mixins.
4. A native `uuid` column needs no alias, because the Postgres type constructor `Uuid` already names it.

| Alias | Stands for | Generator a generating field writes |
|---|---|---|
| `UuidString` | `Char(36)` | `@onCreate(uuid())` or `@onCreate(uuid(7))` |
| `Ulid` | `Char(26)` | `@onCreate(ulid())` |
| `Nanoid` | `Char(21)` | `@onCreate(nanoid())` |
| `Cuid2` | `Char(24)` | `@onCreate(cuid(2))` |
| `Ksuid` | `Char(27)` | `@onCreate(ksuid())` |

On Postgres the aliases are top-level names, like the Postgres column types `Char` and `Uuid`. On every SQL target they are also in the `sql` namespace, like `sql.Char`, and on SQLite and MySQL that is the only way to write them: `id sql.Ulid @id @onCreate(ulid())`.

A nanoid of another size, such as `nanoid(12)`, has no alias, because a contributed alias takes no arguments. Its column is written out: `Char(12) @id @onCreate(nanoid(12))`.

In TypeScript the aliases are `type.Ulid()` and the like, used through `field.column(...)`. The counterpart of the mixin is a constant:

```ts
const UlidId = field.column(type.Ulid()).id().onCreate(gen.ulid());
```

This replaces one sentence of ADR 275, which said the identifier formats have no alias form because an alias may not carry `@id`. ADR 275's rule that an alias may not carry `@id` or `@unique` stands.

## Why

Every identifier format needs a fixed column length: 36 characters for a UUID written as text, 26 for a ULID, 21 for a nanoid, 24 for a CUID2, 27 for a KSUID. A schema that writes these lengths by hand needs its author to know them. A length that is too short is refused, because each generator states how many characters it writes. A length that is too long is accepted, and the stored value is padded with spaces. The identifier column is in almost every model, so the length would be written, and could be wrong, in almost every model.

An alias that also carried the generator would hide the length for the id, but not for a foreign key. A foreign key holds a copy of the id it points at. It needs the id's column type and must not generate a new value. With the generator in the alias, a foreign key would either need a second alias for the bare column, or write the length by hand. An alias for the column alone serves both: the id adds the generator, and the foreign key does not.

Keeping the generator out of the alias also keeps the schema readable. A reader sees at the field that the client generates the id, in the same `@onCreate` attribute every other generated value uses.

A mixin is the right tool for the one-word id, because a mixin is a set of named fields and the id is a named field with its attributes. ADR 269 lets a user write one. A shipped mixin would fix the field's name and could not be overridden, so a model whose key is named `userId`, or whose key needs `@map`, could not use it. The user's own mixin has no such limit.

## Native UUIDs

On Postgres, a native `uuid` column is the better way to store a UUID. It takes 16 bytes, against about 37 for the same value as text, so it makes smaller indexes and foreign keys. Comparing two values is a fixed-size comparison, with no collation. Postgres also rejects a value that is not a UUID, which a text column does not. A version 7 UUID begins with a timestamp, so new rows are added at the end of a B-tree index, where random version 4 values are spread across it. Both generators fill a native column: `id Uuid @id @onCreate(uuid(7))`.

A UUID stored as text, `UuidString`, is for SQL targets with no native type, and for schemas that need the text form.

## Consequences

- **The same contracts.** Each alias stores exactly the column its identifier format was stored in before, so a schema that moves to the aliases keeps its storage and execution hashes.
- **A generating id has one more attribute** than a single call that set the column and the generator together would. In return, the generator is visible, and a foreign key gets the same alias with no generator.
- **No length check is lost.** The generator's fit check still applies to a field that uses an alias.
- **Upgrade guidance** shows each identifier with its alias, and the mixin for a one-word id.

## Alternatives considered

**An alias that carries the generator too.** Not chosen. It hides the length for the id but not for a foreign key, which must not generate a value. It would need a second alias per format for the bare column, two names for one column type.

**A mixin that Prisma ships.** Not chosen. A mixin fixes the field's name and its members cannot be overridden, so it fits only models whose key is named as the mixin names it. Packs would also need a new way to contribute mixins. A user's own mixin has neither problem.

**One namespace on every target, `sql.Ulid`.** Not chosen. On Postgres, the column types are top-level names, and `sql.Ulid` beside `Char` and `Uuid` would be the one exception users write there.

**A namespace for identifiers, such as `ids.Ulid`.** Not chosen. It groups the formats, but adds a namespace for five names, and `Ulid` reads as a column type, which it is.

**No aliases; write the column type and length.** Not chosen. It is the cost the aliases remove: every model would state, and could get wrong, the length of each identifier format.
