# Decision records

This folder lists requests the maintainers have already answered, usually with a no. Each record names the request, the decision, what to use instead, and what would reopen it. Read the list before you propose a feature or a solution, and before you judge a feature request or a pull request. If a record covers it, cite the record.

These records are about product scope: what Prisma 8 does and does not offer users. How the system is built is recorded in the [ADRs](../../architecture%20docs/adrs/). Most records here point to the ADR, scoreboard row or reference page they come from; the record is the short answer, and the source has the reasoning.

Where the project is going is on the [direction](../00-purpose/direction.md) page, and who it is for is on the [project intent](../00-purpose/project-intent.md) page.

## Status

Every record has one of these statuses:

- **`not-yet`**: not in Prisma 8 today, and not ruled out. A request for it is evidence a maintainer weighs, not a mistake.
- **`never`**: ruled out. A request for it does not fit unless a maintainer supersedes the record with a new one.
- **`superseded by NNNN`**: replaced. Judge by record NNNN instead.
- **`proposed`**: drafted from the sources it cites, and not yet accepted by a maintainer. It does not count as a decision. Its "intended status" says what it would become.

Each record also says what reopens it. Many records answer "the source records no condition"; a maintainer can add one.

A maintainer accepts a proposed record by setting its status to the intended status and deleting its `Draft — unconfirmed` line, and rejects it by deleting the record.

## Records

| Record | Request | Status |
| --- | --- | --- |
| [0001](./0001-no-generated-client.md) | No generated client code | `proposed` (intended `never`) |
| [0002](./0002-no-automatic-query-batching.md) | No automatic batching or data loader | `proposed` (intended `never`) |
| [0003](./0003-no-queryraw-method-or-prisma-sql-helpers.md) | No `$queryRaw` method or `Prisma.sql` helpers | `proposed` (intended `never`) |
| [0004](./0004-typedsql-not-in-8-0.md) | TypedSQL is not in 8.0 | `proposed` (intended `not-yet`) |
| [0005](./0005-default-does-not-call-client-generators.md) | `@default` does not call client-side generators | `proposed` (intended `never`) |
| [0006](./0006-no-dbgenerated.md) | No `dbgenerated(...)` | `proposed` (intended `never`) |
| [0007](./0007-no-unsupported-field-type.md) | No `Unsupported("...")` field type | `proposed` (intended `never`) |
| [0008](./0008-native-postgres-enums-are-not-fully-managed.md) | Prisma 8 does not fully manage native Postgres enums | `proposed` (intended `never`) |
| [0009](./0009-no-db-push-to-production.md) | No `db push` to production | `proposed` (intended `never`) |
| [0010](./0010-no-implicit-many-to-many.md) | No implicit many-to-many relations | `proposed` (intended `not-yet`) |
| [0011](./0011-no-prisma-7-extends.md) | No Prisma 7 `$extends` client extensions | `proposed` (intended `not-yet`) |
| [0012](./0012-no-numeric-p-codes.md) | No numeric `P` error codes | `proposed` (intended `never`) |
| [0013](./0013-no-on-events-or-built-in-query-log.md) | No `$on` events, built-in query log or tracing spans | `proposed` (intended `not-yet`) |
| [0014](./0014-no-studio.md) | No Prisma Studio | `proposed` (intended `not-yet`) |
| [0015](./0015-no-db-seed.md) | No `db seed` command | `proposed` (intended `not-yet`) |
| [0016](./0016-no-model-validations-callbacks-soft-delete-scopes.md) | No model validations, lifecycle callbacks, soft delete or scopes | `proposed` (intended `not-yet`) |
| [0017](./0017-no-commonjs.md) | No CommonJS | `proposed` (intended `never`) |
| [0018](./0018-no-features-on-prisma-7.md) | No new features on Prisma 7 | `proposed` (intended `never`) |

## Adding a record

Write a record when the maintainers have said no to something that users or agents will keep asking for. Do not write one for every pull request, and do not write one for a decision nobody has made: a record cites the ADR, scoreboard row, reference page or maintainer comment it comes from.

- Number records in order: `NNNN-short-name.md`.
- Use the sections the existing records use: the request, the decision, what to use instead, revisit if, and sources. Half a page is enough.
- To change a decision, write a new record and mark the old one "Superseded by NNNN". Do not rewrite the old record.
- An agent drafting a record sets its status to `proposed`, with the intended status beside it, and starts it with a `Draft — unconfirmed` line. Only a maintainer accepts it.
- Add the record to the table above.
