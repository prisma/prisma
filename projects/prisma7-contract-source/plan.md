# Plan: Prisma 7 contract source, remaining work

> Refreshed 2026-10-09 against `main` at 19bbe0e986. Linear project: [Prisma 7 contract source: gaps and defects](https://linear.app/prisma-company/project/prisma-7-contract-source-gaps-and-defects-b1952f4c6133).

## Where the project is

Slices 1 to 6 have merged. A Prisma 7 user can point Prisma 8 at `schema.prisma`, sign the database, hand migrations to Prisma 8 while Prisma 7 still serves queries (slice 5), and convert the schema with `contract print` (slice 3). Slice 6 (#30606) made autoincrement and constraint names survive the handover.

The Linear project still holds 25 open tickets. They are not one project. Most are Prisma 8 features that the reader refuses today, as ADR 252 intends, and several are projects of their own. This plan keeps three slices that finish the handover story, and moves or defers the rest.

## Slices

All three slices are independent and can run in parallel.

| # | Outcome | Tickets | Builds on | Hands to | Decision needed first |
|---|---|---|---|---|---|
| 7 | After the handover, `migration plan` changes a foreign key's `onDelete` or `onUpdate`, and a table's primary key columns, in place, as Prisma 7's `migrate dev` did. | TML-3457, TML-3458 | Slice 6 (constraint names are right) | Planner pairs a drop and an add of the same key into one change | No. Position below. |
| 8 | A Prisma 7 schema with `@updatedAt` and `@default(now())` on one field, or a generator on an optional field, reads into a contract, and Prisma 8 PSL can write both. | TML-3267, TML-3268 | Nothing | Two `PSL.PRISMA7_*` codes removed | Yes: what an explicit `null` means on an optional generated field. |
| 9 | Every temporal codec has a "now" generator that produces the value the codec encodes, so `@updatedAt` works on `date`, `time` and `timetz`, and the string timestamp presets stop handing a `Date` to a text codec. | TML-3275, TML-3255 | Nothing | `PSL.PRISMA7_UPDATED_AT_TYPE_UNSUPPORTED` removed | No. Position below. |

### Positions on the slices

- **Slice 7.** Drop and add the constraint in the same migration, as Prisma 7 did. Do not use `NOT VALID` plus `VALIDATE CONSTRAINT`: Prisma 7 never did, and it is an optimisation any foreign key add could use, not something this change needs. A primary key change drops the foreign keys that reference the old key first and adds them back afterwards. The planner code is `mapForeignKeyNodeIssue` and `mapPrimaryKeyNodeIssue` in `packages/3-targets/3-targets/postgres/src/core/migrations/issue-planner.ts`, which handle add and drop today and refuse the in-place change.
- **Slice 8.** Match Prisma 7. An omitted value is generated. An explicit `null` is kept. TML-3264 already settled that `@updatedAt` is an ORM-side generator. The contract keeps a column default and generators as separate fields, so the open question is whether Prisma 8 PSL accepts `@default(now())` beside the updated-at preset. I recommend it does.
- **Slice 9.** Give the two string timestamp codecs a generator that writes the text form Postgres reads back for `timestamp` and `timestamptz`, rather than withdrawing their `now` argument. Withdrawing it would be a breaking change to authoring.

## Moved out of this project

| Tickets | Where | Why |
|---|---|---|
| TML-3272, TML-3273, TML-3341, TML-3280 | A new project, "Type references across namespaces" | One design problem. ADR 221 says every reference across namespaces names the namespace. Enum references do; value object references carry only a name, which is the TML-3341 bug. One ADR covers enums and value objects, then the reader, builder and validator change together. TML-3280 (models keyed by bare name) belongs with it. |
| TML-3269 | A new project, "Database views" | Needs a view entity, introspection, verify, read-only ORM access and a migration decision. The ticket already says so. |
| TML-3456 | The migration statements project (TML-3474) for renames; the rest stays refused | The native enums project made removal and reorder a permanent non-goal: Prisma 8 never rewrites every column of an enum type on its own (`projects/native-postgres-enums/spec.md`, R9). A rename is a statement, which that project already plans for enum values. For removal and reorder, the refusal should print the SQL to put in `migration new`. Reversing R9 is your call. |
| TML-3462 | ADR 267, [prisma/orm#30641](https://github.com/prisma/orm/pull/30641) | That design decides how `@ignore` storage lives in the contract, which is what this ticket needs. |
| TML-3261 | The `prisma-cli` repository | The renderer lives there. |

## Direct changes, outside the slice plan

Each is a small diff with no dependency on a slice. I will open them as separate PRs without asking.

- TML-3258: `contract format` keeps a comment between a block's name and `{`.
- TML-3259: the `CONFIG.VERSION_MARKER_MISSING` advice shows `definePrismaConfig`.
- TML-3262: the infer round-trip journey test checks `db verify --json` instead of a pattern that never matches.
- TML-3461: Prisma 7's `migrate` commands answer with their Prisma 8 replacements. `migrate reset` and `migrate resolve` have no replacement, so they answer with what to do instead.

## Deferred

Each stays in the Linear project until someone schedules it. Each needs a decision before code.

- TML-3460, Postgres extensions. Recommendation: document now that a fresh database needs the extensions created before `db migrate`. Making the contract describe required extensions is a contract change with its own design.
- TML-3270, codecs for `citext` and five rare types. Do `citext` first, as a text codec.
- TML-3274, index column options. Do `sort` first.
- TML-3277, a JSON `null` default. TML-3276, `dbgenerated()` with no expression. Both are rare.
- TML-3455, storing `Bytes` and `DateTime` defaults as values. It changes the storage hash of every affected Prisma 7 contract, so every such project has to sign again. Not worth doing on its own.

## Tracker cleanup

- TML-3250 is fixed by #30520 and still shows In Progress. Set it to Done.
- The ranked defect list in the Linear project description is out of date. Replace it with a link to this plan.
- Slices 7 to 9 reuse their existing tickets, so they need no new Linear issues. The two new projects are created after this plan is agreed.

## Close-out

The project closes when slices 7 to 9 merge, the moved tickets are in their new homes, and the direct changes are open or merged. Close-out then follows `projects/README.md`: long-lived docs move to `docs/` and `projects/prisma7-contract-source/` is deleted.
