# Manual QA: generator attributes (slice 1)

This script checks ADR 275 through the real CLI, the way a user would. Client generators are written `@onCreate(fn())` and `@onUpdate(fn())`, `@default` sets a database default only, and the TypeScript builder has `.onCreate(gen.*)` and `.onUpdate(gen.*)`.

## Setup

- Run every command through `mise exec --`. Work from the repository root unless a step says otherwise.
- Run `pnpm build` first.
- Keep all scratch files under `wip/qa/`. Never use `/tmp`.
- Use an in-process Postgres from `@prisma/dev` (through `createDevDatabase` in `@repo/test-utils`), never a user database. A scratch project gets packages by a `node_modules` symlink to an example's `node_modules`, for example `examples/prisma7-adoption/node_modules`.
- A small `start-db.ts` starts the database and writes `DATABASE_URL` to `.env`. Run it in the background and stop it when you finish:

```ts
import { writeFileSync } from 'node:fs';
import { createDevDatabase } from '@repo/test-utils';
const database = await createDevDatabase({ databaseIdleTimeoutMillis: 24 * 60 * 60 * 1000 });
writeFileSync(process.argv[2] ?? '.env', `DATABASE_URL=${database.connectionString}\n`);
console.log(`up ${database.connectionString}`);
process.on('SIGTERM', async () => { await database.close(); process.exit(0); });
setInterval(() => {}, 1 << 30);
```

- Never run the full integration or e2e suites. Run only the test files named below.

## 1. A new Prisma 8 Postgres project

In `wip/qa/p8-new/`, write a `prisma.config.ts` that reads `./src/contract.prisma` and writes to `src/generated`, and this schema:

```prisma
// use prisma-8

model Event {
  id        String      @id @onCreate(uuid(7))
  ref       String      @onCreate(uuid())
  code      VarChar(32) @onCreate(nanoid())
  seenAt    Time(3)     @onUpdate(now())
  createdAt DateTime    @default(now()) @onCreate(now())
  touchedAt Timestamptz @default(now()) @onCreate(now()) @onUpdate(now())
  label     String
}
```

1. Run `prisma contract emit`. Check `execution.mutations.defaults` in `contract.json`: `id` is `uuidv7`, `ref` is `uuidv4`, `code` is `nanoid` with no params, `seenAt` is `onUpdate` `plainTimeNow` with `params.precision` 3, `createdAt` is `onCreate` `instantNow` with the storage default `now()`, and `touchedAt` has `instantNow` for both phases with the storage default `now()`.
2. Start the database, then run `prisma db init`. It must apply one operation and sign the database.
3. Run a small script that creates one row through `db.orm.public.Event.create(...)` and updates it with `.where({ id }).update(...)`. Log the insert and update parameters by wrapping `pg.Client.prototype.query`. Check:
   - character 15 of `id` is `7` and of `ref` is `4`;
   - `code` has 21 characters from the nanoid alphabet `[A-Za-z0-9_-]`;
   - the update sends `seenAt` and `touchedAt`, and `seenAt` has 3 fractional digits;
   - `createdAt` does not change on update;
   - a raw SQL insert that leaves out `createdAt` and `touchedAt` gets the database default.
4. Run `prisma contract print --format human > printed/contract.prisma`. The output must use `@onCreate(...)` and `@onUpdate(...)`, with no `temporal.*` or `id.*` preset calls. Emit the printed file with a second config. The storage, execution and profile hashes, and the whole `contract.json`, must equal step 1.

## 2. Refusals

Emit one small schema per case with `prisma contract emit --format human`, from a config that reads the schema path from an environment variable. Record each message exactly.

| Field | Expected |
| --- | --- |
| `v String @default(uuid())` | `PSL_GENERATOR_IN_DEFAULT`, names `@onCreate(uuid())` |
| `v String @default(uuid(7))` | `PSL_GENERATOR_IN_DEFAULT`, names `@onCreate(uuid(7))` |
| `id Uuid @id @default(uuid())` | `PSL_GENERATOR_IN_DEFAULT` |
| `v String @onCreate(now())` | `PSL_GENERATOR_NOT_APPLICABLE` |
| `v Char(10) @onCreate(nanoid(40))` | `PSL_GENERATOR_NOT_APPLICABLE`, says 40 does not fit 10 |
| `v String @onCreate(uuid()) @onCreate(nanoid())` | refused as a duplicate attribute |
| `v String[] @onCreate(uuid())` | `PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED`, names `@onCreate` |
| `v DateTime[] @onUpdate(now())` | `PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED`, names `@onUpdate` |
| `v String @onCreate(slugid())` | `PSL_UNKNOWN_GENERATOR_FUNCTION` |

## 3. The upgrade script

1. Copy `examples/prisma-8-demo` into `wip/qa/upgrade-demo/` without `node_modules`, and link its `node_modules`. Replace `src/prisma/contract.prisma`, `contract.json` and `contract.d.ts` with their versions from the merge base with `main` (`git show da82c8c864:examples/prisma-8-demo/src/prisma/...`), since the branch has already rewritten the example. Commit a baseline in a local git repository there.
2. Add a second Prisma 8 file with harder cases: `@default( uuid(7) )`, `@default(cuid(2))`, `@default(ulid())`, `@default(nanoid(12)) // comment`, `@default(nanoid(/* size */ 12))`, `@default("uuid()")`, `@default(now())`, and a line comment that contains `@default(uuid())`.
3. Run `node upgrade-instructions/pending/default-generators-to-on-create/app/scripts/rewrite-default-generators.mjs <files>`. Inspect `git diff` and the second file. Every client generator call must become `@onCreate(...)` with the same arguments. The string literal and `now()` must not change.
4. Remove the second file and run `prisma contract emit`. The storage, execution and profile hashes must equal the old `contract.json`, and `git diff` must show no change to `contract.json` or `contract.d.ts`.
5. Run the script on Prisma 7 files: a copy of `examples/prisma7-adoption/prisma/schema.prisma`, a file with only a model and `@default(uuid())` and no directive, and a file with the older `// use prisma-next` directive. The first two must be left unchanged (compare checksums). The third must be rewritten.

## 4. A Prisma 7 project through `prisma7Schema`

1. Copy `examples/prisma7-adoption` into `wip/qa/p7/` without `node_modules` or `.env`, and link its `node_modules`. Save the `main` copy of `generated/prisma8/contract.json` as `main-contract.json`.
2. Start the database. Run `prisma7 migrate deploy --config prisma7.config.ts`.
3. Run `prisma contract emit`. The new `generated/prisma8/contract.json` must equal `main-contract.json`.
4. Run `prisma db sign`, then `prisma db verify --strict`. Both must succeed.
5. Extra: emit a Prisma 7 schema with `@default(uuid())`, `@default(uuid(7))`, `@default(cuid())`, `@default(nanoid())`, `@default(uuid()) @db.VarChar(36)` and `@updatedAt`. Check the generator ids (`uuidv4`, `uuidv7`, `cuid2`, `nanoid`, `uuidv4`, and the same `now` generator `main` gives for `@updatedAt`). Then emit `@default(nanoid()) @db.Char(10)`. It must be refused with `PSL.PRISMA7_GENERATOR_REFUSED`.

## 5. The TypeScript builder

1. In `wip/qa/ts-builder/`, write a `contract.ts` with the same `Event` model, using `@prisma/orm-postgres/contract-builder` (`defineContract`, `field`, `gen`, `model`, `now`) and `@prisma/orm-postgres/adapter/column-types`. Use `.onCreate(gen.uuid(7))`, `.onCreate(gen.uuid())`, `.onCreate(gen.nanoid())`, `.onUpdate(gen.now())`, and `.default(now()).onCreate(gen.now()).onUpdate(gen.now())`, with `.sql({ table: 'Event' })`.
2. Run `prisma contract emit` with a config that reads `./contract.ts`. The `contract.json` and `contract.d.ts` must equal those from section 1.
3. Run `tsc` on the good file. It must pass.
4. Run `tsc` on a file with wrong calls: `gen.uuid(5)`, `gen.nanoid('long')`, `gen.slugid()`, `.onCreate('uuid')`, `gen.now(3)`. Each must be a type error.
5. Emit a file with `field.column(textColumn).onCreate(gen.now())`. Types allow it. Emit must refuse it as not applicable to `pg/text@1`.

## 6. MongoDB

In `wip/qa/mongo/`, link `examples/mongo-demo/node_modules` and use a config from `@prisma/orm-mongo/config`.

1. Emit `stamp DateTime @onCreate(now()) @onUpdate(now())`. It must succeed with one generator for both phases.
2. Emit `ref String @onCreate(uuid())`. It must be refused.
3. Emit `DateTime? @onCreate(now())`, `@default(now())` and `@updatedAt`. Each must be refused with a hint that names the attribute form.
4. With `mongodb-memory-server`, create a document through the ORM and update it. `stamp` must be set on create and move forward on update.

## 7. The language server

There is no editor to drive here. Run the tests that complete `@onCreate(`:

```sh
cd packages/1-framework/3-tooling/language-server && pnpm test test/generator-attributes.test.ts
cd test/integration && pnpm test test/authoring/attribute-specs.lsp-consumability.test.ts
```

Both must pass. State in the report that completion was not checked by hand in an editor.
