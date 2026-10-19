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

## Path C: keeping documents whose `_id` is not an ObjectId

**Date:** 2026-10-19. The note's section "Keeping documents whose `_id` is not an ObjectId" was followed on a TypeScript project, against mongodb-memory-server on port 27932. It now works as printed, after three changes to the note, which are listed after the table.

**How the `mongosh` steps were run.** I did not run `mongosh` myself: downloading it needs Will's approval given to me directly, and the approval came to me only through the coordinator. Each `mongosh` snippet was copied from the note unchanged and run through the Node driver with a small shim (`wip/pr2-id-qa/mongosh-shim.mjs`). The shim does three things mongosh does on its own:
- it waits for every database call before the script ends;
- it gives `db.<collection>` and `db.getCollection(name)`;
- it maps mongosh's `renameCollection(target, dropTarget)` to the driver's `rename(target, { dropTarget })`.

The step-2 query used the same shim as in paths A and B. Running the section's three snippets once in real `mongosh` would close this gap.

**Before.** The builder from `main` was checked out and built temporarily, then restored:
- `Event`, in collection `events`, has `_id: field.string()` and `name`.
- `Ticket`, in collection `tickets`, has an objectId `_id`, `seat`, `eventId: field.string()`, and `event: rel.belongsTo(Event, { from: 'eventId', to: Event.ref('_id') })`.
- `prisma contract emit` and `prisma db update` ran on that contract; neither collection has a validator.
- Inserted: events `launch` and `party`, and tickets `A1` and `B2` referring to them.
- Through the ORM, `tickets.include('event')` returns `A1 → Launch` and `B2 → Party`.

| Step | Command | Output |
| --- | --- | --- |
| Upgrade | `prisma contract emit` (new builder, old contract) | exit 2: `Model "Event" field "_id" holds the document id as BSON type string, but an _id must be stored as BSON type objectId: …` |
| Keeping 1, as first printed | `_id: field.objectId()`, add `legacyId: field.string()` | contract changed |
| Keeping 2 | the note's copy snippet | `events_copy` holds both events, each with a new ObjectId `_id` and `legacyId` `launch` or `party` |
| Keeping 3 | the note had no command; ran `db.events_copy.find().forEach(…updateMany({ eventId: event.legacyId }, { $set: { eventId: event._id } }))` | both tickets now hold the new ObjectIds |
| Keeping 4 | `db.events_copy.renameCollection('events', true)` | `events` holds the copied documents; `events_copy` is gone |
| Steps 1 | `prisma contract emit` | exit 0 |
| Steps 2 | the note's query | `events 0`, `tickets 2`: `eventId` is now an ObjectId, but the contract still says string. **The note misled here.** |
| Fix | `eventId: field.objectId()`; `prisma contract emit`; the query again | `events 0`, `tickets 0` |
| Steps 4 | `prisma db update --no-interactive` | `validator.events.add` and `validator.tickets.add`, class `widening`; "Applied 2 operation(s)" |
| Steps 5 | `prisma db verify` | exit 0, "Database marker and schema match contract", "Schema matches contract" |
| ORM | `tickets.include('event')` | `A1 → Launch`, `B2 → Party` |
| New data | made `legacyId` optional, emitted, `db update` (`validator.events.update`, class `widening`); then `events.create({ name: 'Closing' })` and a ticket for it | `A1 → Launch`, `B2 → Party`, `C3 → Closing`; `db verify` clean |

**Changes to the note:**
1. Step 1 now says to change every field that refers to the model by its id to `field.objectId()`, with the `belongsTo` example.
2. Step 1 now adds `legacyId` as `.optional()`. A required `legacyId` would make every new document, which has no old id, fail the validator.
3. Step 3 now gives the `updateMany` snippet.

Not covered: the claim that `db update` creates the contract's indexes again after the rename. This contract declared no indexes on `events`.

Logs: `wip/pr2-id-qa/`.
