# Project plan: Raw columns

**Spec:** [`spec.md`](./spec.md) · **Linear:** [Raw columns](https://linear.app/prisma-company/project/raw-columns-f8b71d02e514)

| Slice | Delivers | Builds on | Linear |
| --- | --- | --- | --- |
| 1 | `sql/raw` data type and codec on Postgres and SQLite; `Raw("...")` in Prisma 8 schemas and the TypeScript builder; `sql` defaults only; verify by the catalog text; `contract print`; planning a change between raw types | main | TML-3585 (#30745, merged 2026-10-20) |
| 2 | The Prisma 7 reader reads `Unsupported("...")` as a raw column with no field | 1 | TML-3596 (#30788, merged 2026-10-20) |
| 0 | Every type-constructor argument that is a value is read as a value of a data type; `Raw` takes `` sql`...` `` (breaking, with upgrade instructions) ([spec](./slices/00-data-typed-constructor-arguments/spec.md)) | 1, 2, TML-3607 | TML-3615 |

Each slice is one pull request against `main`. Will decided on 2026-10-20 to merge slice 1 with `Raw("...")`, to stop repeated conflicts with main. Slice 2 starts after slice 1 merges. Slice 0 starts after the TML-3607 implementation (#30780) merges, and switches `Raw` to `` sql`...` `` with upgrade instructions. Its branch merges slice 2's approved tip, so it lands after slice 2, and the Prisma 7 reader gives `Unsupported("X")` the `sql/expression` value `Raw` takes.

## Close-out (required)

- [ ] Verify every project DoD item in [`spec.md`](./spec.md)
- [ ] Final retro
- [ ] ADR 273 matches the shipped code
- [ ] Delete `projects/raw-columns/`
