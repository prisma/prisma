# Plan: Prisma 7 contract source, remaining work

> Refreshed 2026-10-09 against `main` at 19bbe0e986. Linear project: [Prisma 7 contract source: gaps and defects](https://linear.app/prisma-company/project/prisma-7-contract-source-gaps-and-defects-b1952f4c6133).

## Summary

The core of the project is finished. A Prisma 7 user can point Prisma 8 at their `schema.prisma`, sign the database, let Prisma 8 take over migrations while Prisma 7 still serves queries, and convert the schema to Prisma 8 when they drop Prisma 7.

What remains is 25 open Linear tickets. Most are Prisma 8 features that are missing, so Prisma 8 refuses a Prisma 7 schema that uses them. This plan keeps the work that matters most to Prisma 7 users in this project and moves or defers the rest:

| | Work | Size |
|---|---|---|
| Do in this project | 2 pull requests that add features, and 3 small fixes | 1 medium, 1 small, 3 very small |
| Moved to other projects | 2 new projects, and 7 tickets that other work already covers | Not estimated here |
| Deferred | 5 tickets, each waiting on a product decision | Not scheduled |

## Work in this project, in priority order

Priority follows how many Prisma 7 users hit the problem and how badly.

| # | What the user gets | Tickets | Size | Blocked on you? |
|---|---|---|---|---|
| 1 | Prisma 8 accepts `updatedAt DateTime @default(now()) @updatedAt`, and `uuid()` or `@updatedAt` on an optional field. Today Prisma 8 refuses the whole schema. The first is very common: Prisma's own documentation uses it. | TML-3267, TML-3268 | Medium: new Prisma 8 schema syntax, ORM behaviour for `null`, and the Prisma 7 reader | No: agreed 2026-10-13 |
| 2 | `@updatedAt` works on `@db.Date`, `@db.Time` and `@db.Timetz` columns. This also fixes a bug: two string timestamp presets write a JavaScript `Date` to a text column. | TML-3275, TML-3255 | Small | No |
| 3 | Three fixes: `contract format` stops deleting a comment written between a block's name and `{`; the advice for `CONFIG.VERSION_MARKER_MISSING` shows the config that works; a test assertion that can never fail is replaced with one that can. | TML-3258, TML-3259, TML-3262 | Very small each | No |

All three can start now and run in parallel.

### How I will build them

- **Item 1.** A value the client leaves out is generated, and an explicit `null` is stored as `null`, as in Prisma 7. Prisma 8's schema language accepts `@default(now())` together with `@updatedAt`. Agreed 2026-10-13.
- **Item 2.** The string timestamp presets get a generator that writes text. Removing their `now` option instead would break existing schemas.

## Decisions for you

**Agree the moves below.** They change the project's scope.

**Settled: Prisma 8 does not remove or reorder a Postgres enum's values (TML-3456).** This was decided before this project. `docs/reference/postgres-native-enums.md` says the user writes that migration, because Postgres can only do it by building a new type and rewriting every table that uses it. The native enums project lists it as a permanent non-goal (`projects/native-postgres-enums/spec.md`, requirement R9). The planner's refusal already links that page and points at `migration new`. A rename is different: Postgres renames a value in place, and the migration statements project plans `--rename` for enum values (`projects/migration-statements/plan.md`).

## Moved to other projects

- **New project, "Type references across namespaces":** TML-3272, TML-3273, TML-3341, TML-3280. Today a field can use an enum or a composite type only from its own namespace. Prisma 7 projects with several Postgres schemas, and Supabase projects that use `auth` enums, need this. ADR 221 already says every reference to another namespace must name the namespace. Enum references follow that rule. References to composite types carry only a name, which is the bug in TML-3341. One ADR should cover both, then one implementation.
- **New project, "Database views":** TML-3269. It needs a view in the contract, introspection, `db verify`, read-only ORM access, and a decision on whether Prisma 8 migrations create views.
- **The migration takeover work owned by anansi-36 (planning stream 2):** TML-3456, TML-3457, TML-3458, TML-3460 and TML-3461. You gave that session the migration side of the Prisma 7 handover on 2026-10-08, and these tickets are on its list. Planning them here as well would put two sessions on the same code.
- **ADR 267, [prisma/orm#30641](https://github.com/prisma/orm/pull/30641):** TML-3462, removing `@ignore` after Prisma 8 takes over. That design decides how a column without a field lives in the contract.
- **The `prisma-cli` repository:** TML-3261. The CLI renders finding locations there.

## Deferred

Each needs a product decision before code. In priority order:

1. **TML-3270, the `citext` column type and five rare Postgres types.** `citext` is common for case-insensitive emails. It should come first, as a text codec.
2. **TML-3274, index options.** `sort: Desc` on a timestamp index is common, so it should come first.
3. **TML-3455, storing `Bytes` and `DateTime` defaults as values instead of SQL text.** Every affected project would have to sign its database again. It is not worth that cost on its own.
4. **TML-3277, a JSON `null` default,** and **TML-3276, `dbgenerated()` with no expression.** Both are rare.

## Housekeeping

- TML-3250 is fixed by #30520 but still shows In Progress in Linear. It should be set to Done.
- The ranked list in the Linear project description is out of date. It should be replaced with a link to this plan.

## When the project closes

When items 1 to 5 have merged and the moved tickets are in their new projects. Long-lived docs then move to `docs/`, and `projects/prisma7-contract-source/` is deleted, as `projects/README.md` describes.
