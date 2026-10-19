# Manual QA — the 4p app upgrade note, followed as printed

**Date:** 2026-10-19 · **Branch:** `tml-3553-ts-validator-pr2` · **Note:** `upgrade-instructions/pending/mongo-typescript-contract-validator/app/instructions.md`

## Result

The note works as printed on both paths. Each path ends with `prisma db verify` clean: "Database marker and schema match contract", exit 0. A document with an undeclared field is then refused with code 121. Following the note led to one change in it: step 4 now says to plan from the migration the database is at.

## Setup

- MongoDB: a one-node replica set started with mongodb-memory-server on port 27931 (`wip/pr2-d3/mongod.mjs`).
- Project: `qa-4p`, inside the CLI e2e test app, so `@prisma/orm-mongo` and the `prisma` bin resolve to the workspace build. It was deleted afterwards. `prisma.config.ts` uses `@prisma/orm-mongo/config` with `contract: './contract.ts'` and `output: './generated'`. The contract has one model, `User`, in collection `users`: `_id: field.objectId()`, `email: field.string()`, `name: field.string().optional()`, and a unique index on `email`.
- The "before" state: the pre-change builder (`contract-builder.ts` at `c318b87524`) was checked out and built temporarily. With it, `prisma contract emit` wrote storage hash `6c6134e3…` and no validator. The source was then restored and rebuilt.
- Step 2 was run in real `mongosh` 2.13.0 (`pnpm dlx mongosh@2`, with Will's approval on 2026-10-19), against the same kind of replica set, with the TypeScript-emitted `test/integration/test/mongo/fixtures/generated/contract.json` in the current directory. The snippet was copied from the note unchanged and run both with `--file` and as pasted text (`--eval`). With one valid `users` document and one with an extra `nickname` field, it printed `tasks 0 []` and `users 1 [ { …, name: 'Bad User', nickname: 'extra' } ]`. `require('fs')`, the relative path and mongosh's implicit awaiting all work as the note assumes. The earlier Node driver run is kept below for the full upgrade path.

## Path A: `db update`

| Step | Command | Output |
| --- | --- | --- |
| Before | old builder: `prisma contract emit`, `prisma db update --no-interactive` | Applied 1 operation; the `users` options have no validator |
| Before | insert 4 documents: one valid, one with extra field `nickname`, one with `email: 42`, one without `email` | inserted |
| 1 | `prisma contract emit` (new builder) | hash `778f20d8…`; `users.validator` is closed, `required: ['_id', 'email']` |
| 2 | the note's snippet, from `generated/` | `users 3 [ {…nickname:"bobby"}, {…email:42}, {…name:"no email"} ]` |
| 3 | fix the three documents (`$unset` nickname, set the two emails), run step 2 again | `users 0 []` |
| 4 | `prisma db update --no-interactive` | `validator.users.add`, class `widening`; "Applied 1 operation(s) … signature updated" |
| 5 | `prisma db verify` | exit 0, "Database marker and schema match contract", "Schema matches contract" |

The collection options afterwards hold the derived `$jsonSchema` with `validationLevel: strict` and `validationAction: error`.

## Path B: `migration plan` and `db migrate`

| Step | Command | Output |
| --- | --- | --- |
| Before | old builder: `prisma contract emit`, `prisma migration plan --name initial`, `prisma db migrate` | `20261019T0752_initial`; no validator |
| Before | insert 2 documents, one with extra field `nickname` | inserted |
| 1 | `prisma contract emit` (new builder) | hash `778f20d8…` |
| 2 | the note's snippet | `users 1 [ {…nickname:"bobby"} ]` |
| 3 | `$unset` `nickname`, run step 2 again | `users 0 []` |
| 4 | `prisma migration plan` | exit 2, `MIGRATION.PLAN_ORIGIN_UNKNOWN`: the project has no `db` ref. This is the CLI's usual behaviour, not specific to this change. The note now says to plan from the migration the database is at. |
| 4 | `prisma migration plan --name validators --from 20261019T0752_initial` | `validator.users.add`, class `widening` |
| 4 | `prisma db migrate` | "Applied 1 migration(s) (1 operation(s))" |
| 5 | `prisma db verify` | exit 0, "Database marker and schema match contract" |
| After | insert `{ email, extra: 1 }` | refused, code 121 |

Logs: `wip/pr2-d3/qa-*.log`.
