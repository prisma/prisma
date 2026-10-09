# Plan: Prisma 7 contract source, remaining work

> Refreshed 2026-10-09 against `main` at 19bbe0e986. Linear project: [Prisma 7 contract source: gaps and defects](https://linear.app/prisma-company/project/prisma-7-contract-source-gaps-and-defects-b1952f4c6133).

## Summary

The core of the project is finished. A Prisma 7 user can point Prisma 8 at their `schema.prisma`, sign the database, let Prisma 8 take over migrations while Prisma 7 still serves queries, and convert the schema to Prisma 8 when they drop Prisma 7.

What remains is 25 open Linear tickets. Most are Prisma 8 features that are missing, so Prisma 8 refuses a Prisma 7 schema that uses them. This plan keeps the work that matters most to Prisma 7 users in this project and moves or defers the rest:

| | Work | Size |
|---|---|---|
| Do in this project | 3 pull requests that add features, and 4 small fixes | 2 medium, 1 small, 4 very small |
| Moved to other projects | 2 new projects, and 3 tickets that other work already covers | Not estimated here |
| Deferred | 6 tickets, each waiting on a product decision | Not scheduled |

## Work in this project, in priority order

Priority follows how many Prisma 7 users hit the problem and how badly.

| # | What the user gets | Tickets | Size | Blocked on you? |
|---|---|---|---|---|
| 1 | Prisma 8 accepts `updatedAt DateTime @default(now()) @updatedAt`, and `uuid()` or `@updatedAt` on an optional field. Today Prisma 8 refuses the whole schema. The first is very common: Prisma's own documentation uses it. | TML-3267, TML-3268 | Medium: new Prisma 8 schema syntax, ORM behaviour for `null`, and the Prisma 7 reader | Yes, decision A |
| 2 | Typing `prisma migrate dev` out of habit prints the Prisma 8 commands to use. Today it fails with an unknown-command error. | TML-3461 | Very small | No |
| 3 | After Prisma 8 takes over migrations, changing a relation's `onDelete` or `onUpdate`, or a table's primary key columns, plans a migration. Today Prisma 8 refuses both and tells the user to write the migration by hand; Prisma 7 handled them. | TML-3457, TML-3458 | Medium: one change to the Postgres migration planner, tested on a real database | No |
| 4 | `@updatedAt` works on `@db.Date`, `@db.Time` and `@db.Timetz` columns. This also fixes a bug: two string timestamp presets write a JavaScript `Date` to a text column. | TML-3275, TML-3255 | Small | No |
| 5 | Three fixes: `contract format` stops deleting a comment written between a block's name and `{`; the advice for `CONFIG.VERSION_MARKER_MISSING` shows the config that works; a test assertion that can never fail is replaced with one that can. | TML-3258, TML-3259, TML-3262 | Very small each | No |

Items 2 to 5 can start now and run in parallel. Item 1 starts when you answer decision A.

### How I will build them

- **Item 3.** The migration drops the constraint and adds it again, as Prisma 7 did. Changing a primary key also drops and adds back the foreign keys that point at it. I will not use Postgres's `NOT VALID` option to shorten the lock: Prisma 7 never did, and it would apply to every foreign key Prisma 8 adds, not just this case.
- **Item 4.** The string timestamp presets get a generator that writes text. Removing their `now` option instead would break existing schemas.

## Decisions for you

**A. On an optional field with a generated value, what does an explicit `null` mean?** I recommend matching Prisma 7: a value the client leaves out is generated, and an explicit `null` is stored as `null`. This also decides that Prisma 8's schema language accepts `@default(now())` together with `@updatedAt`.

**B. Should Prisma 8 remove, rename or reorder a Postgres enum's values automatically (TML-3456)?** Prisma 7 did it by recreating the type and rewriting every column that uses it. The native enums project ruled this out permanently (`projects/native-postgres-enums/spec.md`, requirement R9), because the rewrite locks and copies whole tables. I recommend keeping that ruling:
- A rename is written with `--rename`, which the migration statements project already plans for enum values.
- A removal or reorder stays refused, but the message prints the SQL to paste into `migration new`.

**C. Agree the moves below.** They change the project's scope.

## Moved to other projects

- **New project, "Type references across namespaces":** TML-3272, TML-3273, TML-3341, TML-3280. Today a field can use an enum or a composite type only from its own namespace. Prisma 7 projects with several Postgres schemas, and Supabase projects that use `auth` enums, need this. ADR 221 already says every reference to another namespace must name the namespace. Enum references follow that rule. References to composite types carry only a name, which is the bug in TML-3341. One ADR should cover both, then one implementation.
- **New project, "Database views":** TML-3269. It needs a view in the contract, introspection, `db verify`, read-only ORM access, and a decision on whether Prisma 8 migrations create views.
- **Migration statements project:** enum value renames from TML-3456, if you accept decision B.
- **ADR 267, [prisma/orm#30641](https://github.com/prisma/orm/pull/30641):** TML-3462, removing `@ignore` after Prisma 8 takes over. That design decides how a column without a field lives in the contract.
- **The `prisma-cli` repository:** TML-3261. The CLI renders finding locations there.

## Deferred

Each needs a product decision before code. In priority order:

1. **TML-3270, the `citext` column type and five rare Postgres types.** `citext` is common for case-insensitive emails. It should come first, as a text codec.
2. **TML-3274, index options.** `sort: Desc` on a timestamp index is common, so it should come first.
3. **TML-3460, Postgres extensions listed in the Prisma 7 datasource.** A database Prisma 8 builds from scratch does not get them. For now I recommend documenting that the user must create them first. Describing extensions in the contract is a design of its own.
4. **TML-3455, storing `Bytes` and `DateTime` defaults as values instead of SQL text.** Every affected project would have to sign its database again. It is not worth that cost on its own.
5. **TML-3277, a JSON `null` default,** and **TML-3276, `dbgenerated()` with no expression.** Both are rare.

## Housekeeping

- TML-3250 is fixed by #30520 but still shows In Progress in Linear. It should be set to Done.
- The ranked list in the Linear project description is out of date. It should be replaced with a link to this plan.

## When the project closes

When items 1 to 5 have merged and the moved tickets are in their new projects. Long-lived docs then move to `docs/`, and `projects/prisma7-contract-source/` is deleted, as `projects/README.md` describes.
