# Plan: Prisma 7 contract source, remaining work

> Refreshed 2026-10-15. Linear project: [Prisma 7 contract source: gaps and defects](https://linear.app/prisma-company/project/prisma-7-contract-source-gaps-and-defects-b1952f4c6133).

## Summary

The core of the project is finished. A Prisma 7 user can point Prisma 8 at their `schema.prisma`, sign the database, let Prisma 8 take over migrations while Prisma 7 still serves queries, and convert the schema to Prisma 8 when they drop Prisma 7.

The GA plan sets the bar for what remains: every urgent and high upgrade issue is closed before GA, and medium and low issues may stay open (`planning/decisions.md` on the `planning/prisma-8-ga` branch). This project has three high issues left. One is already decided against, so two need building:

| | Work | Size |
|---|---|---|
| Before GA | 2 pull requests: generated values (TML-3267, TML-3268), and changing a foreign key's actions (TML-3457) | 2 medium |
| Small, worth doing now | 3 pull requests: "now" generators, four very small fixes | 1 small, 2 very small |
| After GA | 8 tickets, including views | Not scheduled |
| Moved out | 4 tickets to a new project, 1 closed as already decided, 1 to another repository | |

## Before GA, in priority order

| # | What the user gets | Tickets | Size | Blocked on you? |
|---|---|---|---|---|
| 1 | Prisma 8 accepts `updatedAt DateTime @default(now()) @updatedAt`, and `uuid()` or `@updatedAt` on an optional field. Today Prisma 8 refuses the whole schema. The first is very common: Prisma's own documentation uses it. | TML-3267, TML-3268 (both high) | Medium: new Prisma 8 schema syntax, ORM behaviour for `null`, and the Prisma 7 reader | No |
| 2 | After Prisma 8 takes over migrations, changing a relation's `onDelete` or `onUpdate` plans a migration. Today Prisma 8 refuses it and tells the user to write the migration by hand; Prisma 7 handled it. Changing a table's primary key columns (TML-3458, medium) uses the same planner change and can come with it. | TML-3457 (high), TML-3458 (medium) | Medium: one change to the Postgres migration planner, tested on a real database | Yes, see below |

How I will build them:

- **Item 1.** A value the client leaves out is generated, and an explicit `null` is stored as `null`, as in Prisma 7. Prisma 8's schema language accepts `@default(now())` together with `@updatedAt`. Agreed 2026-10-13.
- **Item 2.** The migration drops the foreign key and adds it again with the new actions, as Prisma 7 did. Postgres checks every row again when the key is added. Changing a primary key also drops and adds back the foreign keys that point at it.

## Small, worth doing now

None of these is required for GA. Each is small and fixes something a user can hit today.

| # | What the user gets | Tickets | Size |
|---|---|---|---|
| 3 | `@updatedAt` works on `@db.Date`, `@db.Time` and `@db.Timetz` columns. This also fixes a bug: two string timestamp presets write a JavaScript `Date` to a text column. The presets get a generator that writes text; removing their `now` option instead would break existing schemas. | TML-3275, TML-3255 | Small |
| 4 | Typing `prisma migrate dev` out of habit prints the Prisma 8 commands to use. Today it fails with an unknown-command error. | TML-3461 | Very small |
| 5 | `contract format` stops deleting a comment written between a block's name and `{`; the advice for `CONFIG.VERSION_MARKER_MISSING` shows the config that works; a test assertion that can never fail is replaced with one that can. | TML-3258, TML-3259, TML-3262 | Very small each |

## After GA

Each stays in this Linear project. Each needs a product decision before code. In priority order:

1. **TML-3270, the `citext` column type and five rare Postgres types.** `citext` is common for case-insensitive emails, and should come first, as a text codec.
2. **TML-3274, index options.** `sort: Desc` on a timestamp index is common, so it should come first.
3. **TML-3460, Postgres extensions listed in the Prisma 7 datasource.** A database Prisma 8 builds from scratch does not get them. Until then, the user creates them by hand before `db migrate`.
4. **TML-3455, storing `Bytes` and `DateTime` defaults as values instead of SQL text.** Every affected project would have to sign its database again. Not worth that cost on its own.
5. **TML-3277, a JSON `null` default,** and **TML-3276, `dbgenerated()` with no expression.** Both are rare.
6. **TML-3269, database views.** Not built before GA (Will, 2026-10-15).

## Moved out

- **[Type references across namespaces](https://linear.app/prisma-company/project/type-references-across-namespaces-4a1c2964cde6) (P-TML-1158), created 2026-10-15:** TML-3272, TML-3273, TML-3341 and TML-3280. A field cannot use an enum or a composite type from another namespace. ADR 221 says every reference to another namespace names the namespace; enum references do, and composite type references carry only a name, which is the bug in TML-3341. One ADR, then one implementation. All four are medium or low, so none is required before GA.
- **TML-3456, closed as already decided.** Prisma 8 does not remove or reorder a Postgres enum's values: Postgres can only do it by building a new type and rewriting every table that uses it. `docs/reference/postgres-native-enums.md` tells the user to write that migration, and the native enums project made it a permanent non-goal (`projects/native-postgres-enums/spec.md`, requirement R9). The planner's refusal already links that page. A rename is different, because Postgres renames a value in place; the migration statements project plans `--rename` for enum values.
- **TML-3261, to the `prisma-cli` repository.** The CLI renders finding locations there.

## When the project closes

When items 1 to 5 have merged. The tickets left for after GA move to a backlog project or stay with a closed note, long-lived docs move to `docs/`, and `projects/prisma7-contract-source/` is deleted, as `projects/README.md` describes.
