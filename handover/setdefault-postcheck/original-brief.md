<system-reminder>
You are operating in an isolated workspace created by the user's WorktreeCreate hook.
Workspace path: /Users/will/Projects/prisma/orm/.claude/worktrees/setdefault-operationclass-skip-cd188c
Workspace name: setdefault-operationclass-skip-cd188c
</system-reminder>


Update to origin/main then verify the following brief. Treat it as unvalidated, it was summarized by another agent. DO NOT IMPLEMENT. Discuss with me first. Use Opus for implementer agents. Follow /drive-process. In your responses to me, assume I haven't read the brief.

<pasted_content id="1941">
# A `setDefault` written by hand without `operationClass` is skipped on a column that already has a default, and `db migrate` fails

## At a glance

A migration changes the default of an existing column from `'open'` to `'closed'`. The author writes the operation by hand in `migration.ts`, as the migration authoring API allows, and leaves out `operationClass`:

```ts
this.setDefault({
  schema: 'public',
  table: 'Item',
  column: col('state', 'text', {
    default: lit('closed'),
    codecRef: { codecId: 'pg/text@1' },
  }),
}),
```

`prisma db migrate` never runs the `ALTER TABLE ... SET DEFAULT 'closed'`, and then fails. In short (the full JSON is in Output 1 below):

```
MIGRATION.RUNNER_FAILED  Database schema does not satisfy contract (1 failure)
issue: database.public.Item.column:state.default  expected "closed", actual 'open'::text
```

The column keeps `'open'::text`. The error names the default but not the reason it was not changed.

The reason: when `operationClass` is left out it is `'additive'`, and an additive `setDefault` gets the postcheck "the column has a default". The column already has one (`'open'`), so the runner finds the postcheck true before the operation runs, treats the operation as already applied, and skips it. Only the final schema verification notices.

## Who it hurts, and on which versions

| Version | `setDefault` written by `prisma migration plan` | `setDefault` written by hand without `operationClass` |
|---|---|---|
| `@prisma/orm-postgres` 8.0.0-rc.14 (npm `latest`, published 2026-09-30) | fails | fails (at this version the postcheck does not depend on the class at all) |
| `@prisma/orm-postgres` 8.0.0-rc.14-dev.43 (npm `dev`, published 2026-10-07) | applies | **fails** |
| `prisma/orm` `main` at `095af7a5db` (2026-10-06) | same code as dev.43 | same code as dev.43 |

Both runs used the `prisma` CLI 8.0.0-rc.20 (npm `latest`).

- **On the current `latest` release, everyone who changes a default.** The planner's own `setDefault` fails the same way for every changed default. PR #30451 (merged 2026-10-01, item 8 in its description: "A changed default on an existing Postgres column is now applied") fixed the planned case on `main`. It is in the `dev` builds and not yet in a `latest` release. This ticket does not ask for that fix again; it ships with the next release.
- **After that fix, anyone who writes `setDefault` by hand.** That is people and coding agents who write or edit `migration.ts`, for example to put a `dataTransform` between planned operations, or who write a migration from `prisma migration new`. The fix made the operation correct only when it is labelled `'widening'`. `operationClass` reads as a policy label (which classes of change a command may apply), so an author has no reason to think that leaving it out changes what runs. The docs list `setDefault` with its `column` option only (`skills/prisma-8/references/migrations.md`, line 362).

The bug was first found on 2026-10-06 in an application's migration, with `prisma` 8.0.0-rc.19 and `@prisma/orm-postgres` 8.0.0-rc.13. The workaround there was a `this.dropDefault(...)` on the column just before the `this.setDefault(...)`: the drop's postcheck "the column has no default" is false while the old default is there, so the drop runs, and then the set's postcheck is false too, so the set runs.

## How the planner, the operations and the runner are meant to work

- **The planner** compares the start contract with the end contract and turns each difference into an operation call. For a column default, `mapColumnDefaultNodeIssue` in `issue-planner.ts` makes a `SetDefaultCall` with `operationClass` `'additive'` when the column had no default (`not-found`), `'widening'` when it had a different one (`not-equal`), and a `DropDefaultCall` when the end contract has none (`not-expected`). `prisma migration plan` writes the calls to `migration.ts` as `this.setDefault(...)` and so on, and running `migration.ts` writes `ops.json`. An author can edit `migration.ts` or write one by hand; `this.setDefault` in `postgres-migration.ts` builds the same `SetDefaultCall`, with `operationClass` optional.
- **An operation** is a list of SQL steps in three phases, `precheck`, `execute` and `postcheck`, plus an `operationClass` (`additive`, `widening`, `data`, `destructive`) that the migration policy uses to allow or refuse it.
- **The runner** (`PostgresMigrationRunner.applyPlan` in `runner.ts`) takes each operation in turn. If every postcheck step already answers true, it records a skip with `reason: 'postcheck_pre_satisfied'` and does not run the operation. This is the idempotency rule of ADR 038: an operation whose effect is already in place is not run again. Otherwise it runs the prechecks, the execute steps and the postchecks. After the last operation of the app space, it introspects the database and verifies it against the end contract. The whole run is one transaction, so a failure applies nothing.
- **What the design says a default change should check.** ADR 038 puts "alter column default" in its class 2, "effect-idempotent with equivalence check": already applied means "current metadata equals desired spec". ADR 044 names the check for it: `defaultIs(table, column, normalizedExpr)`, listed under "Idempotency mapping" as the check "for setDefault ops". The code has no `defaultIs`. It uses `defaultPresent`, which only asks whether `column_default IS NOT NULL`.

So the skip is only safe when an operation's postcheck is as specific as its effect. For `setDefault` it is not: "has a default" holds for any default, including the old one.

## Reproduction

A standalone project that installs the published packages. It needs Node 24 (it runs `migration.ts` directly with Node's type stripping), pnpm 10, `psql`, and a Postgres database the script may wipe. The runs below used Postgres 15.16. With Docker:

```sh
docker run --rm -d --name pg-setdefault -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:15
psql 'postgres://postgres@127.0.0.1:5432/postgres' -c 'CREATE DATABASE orm_setdefault_repro'
export DATABASE_URL='postgres://postgres@127.0.0.1:5432/orm_setdefault_repro?sslmode=disable'
```

Create a folder `orm-setdefault-repro/` with these five files. `pnpm-workspace.yaml` makes the folder its own workspace, so installing in it does not touch any workspace above it. Its `overrides` entry makes the `prisma` CLI use the same `@prisma/orm-toolchain` as `@prisma/orm-postgres`. Without it, CLI 8.0.0-rc.20, whose own toolchain is 8.0.0-rc.14, fails against a dev build with `CLI.UNEXPECTED` "Invalid authoring type constructor "sql.String" contributed by descriptor "sql"".

`package.json`:

```json
{
  "name": "orm-setdefault-repro",
  "private": true,
  "type": "module",
  "dependencies": {
    "@prisma/orm-postgres": "8.0.0-rc.14-dev.43",
    "temporal-polyfill": "^1.0.4"
  },
  "devDependencies": {
    "prisma": "8.0.0-rc.20",
    "typescript": "^6.0.3",
    "pg": "8.22.0"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - .

overrides:
  '@prisma/orm-toolchain': 8.0.0-rc.14-dev.43
```

`prisma.config.ts`:

```ts
import { defineConfig } from '@prisma/orm-postgres/config';
import { definePrismaConfig } from 'prisma/config';

export default definePrismaConfig({
  orm: defineConfig({
    contract: './contract.prisma',
    db: { connection: process.env['DATABASE_URL']! },
  }),
});
```

`check-postcheck.mjs` runs each postcheck step of the planned `change_default` migration, exactly as `ops.json` holds it, against the database before the migration runs. This is the query the runner uses to decide to skip the operation.

```js
import { readdirSync, readFileSync } from 'node:fs';
import pg from 'pg';

const dir = readdirSync('migrations/app').find((name) => name.endsWith('_change_default'));
const ops = JSON.parse(readFileSync(`migrations/app/${dir}/ops.json`, 'utf8'));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
for (const op of ops) {
  console.log(`operation ${op.id} (${op.operationClass})`);
  for (const step of op.postcheck) {
    const { rows } = await client.query(step.sql, step.params ?? []);
    console.log(`  postcheck "${step.description}" answers ${JSON.stringify(rows[0])}`);
  }
  if (op.postcheck.length === 0) console.log('  no postcheck');
}
await client.end();
```

`repro.sh` writes `contract.prisma` with one model, emits and applies it, changes the default from `"open"` to `"closed"`, plans, shows the operation and the database, runs the postcheck, and migrates. The `hand-written` mode deletes `operationClass: 'widening'` from the planned `migration.ts`, which gives the same `migration.ts` as an author who wrote the call by hand, and runs the file to write `ops.json` again.

```sh
#!/usr/bin/env bash
# Usage: DATABASE_URL=<a Postgres database this script may wipe> ./repro.sh [planned|hand-written]
#   planned       apply the setDefault exactly as `prisma migration plan` wrote it
#   hand-written  first delete `operationClass: 'widening'` from the planned migration.ts,
#                 as an author who writes `this.setDefault(...)` by hand would leave it out,
#                 and re-emit ops.json by running the migration file
set -u
: "${DATABASE_URL:?set DATABASE_URL to a Postgres database the script may wipe}"
MODE="${1:-planned}"
cd "$(dirname "$0")"

run() { printf '\n$ %s\n' "$*"; "$@"; printf '[exit %s]\n' "$?"; }
contract() {
  printf '// use prisma-8\n\nmodel Item {\n  id    String @id\n  state String @default("%s")\n}\n' "$1" > contract.prisma
  printf '\n$ cat contract.prisma\n'; cat contract.prisma
}

rm -rf migrations contract.json contract.d.ts
psql -q "$DATABASE_URL" -c 'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS prisma_contract CASCADE;' 2>/dev/null

run pnpm exec prisma --version --format human
run node -p "require('./node_modules/@prisma/orm-postgres/package.json').version"
contract open
run pnpm exec prisma contract emit --format human
run pnpm exec prisma migration plan --name init --from @empty --format human
run pnpm exec prisma db migrate --format human
FROM=$(node -p "require('./contract.json').storage.storageHash")

contract closed
run pnpm exec prisma contract emit --format human
run pnpm exec prisma migration plan --name change-default --from "$FROM" --format human
MIGRATION=$(ls -d migrations/app/*_change_default)

if [ "$MODE" = hand-written ]; then
  sed -i.bak "/operationClass: 'widening',/d" "$MIGRATION/migration.ts" && rm "$MIGRATION/migration.ts.bak"
  run node "$MIGRATION/migration.ts"
fi

run cat "$MIGRATION/migration.ts"
run cat "$MIGRATION/ops.json"
run psql "$DATABASE_URL" -c '\d "Item"'
run node check-postcheck.mjs
run pnpm exec prisma db migrate --json
run psql "$DATABASE_URL" -c '\d "Item"'
```

Run it:

```sh
cd orm-setdefault-repro
pnpm install
chmod +x repro.sh
./repro.sh hand-written    # fails on 8.0.0-rc.14-dev.43
./repro.sh planned         # applies on 8.0.0-rc.14-dev.43
```

To run the released version instead, set `"@prisma/orm-postgres": "8.0.0-rc.14"` in `package.json`, delete the `overrides:` block from `pnpm-workspace.yaml`, run `pnpm install`, and run `./repro.sh planned`. It fails.

The outputs below are complete. Absolute paths to the folder are shortened to `<repro>`. The database URL is the local one used for the runs.

### Output 1: `./repro.sh hand-written` on 8.0.0-rc.14-dev.43 (fails)

Read these lines: the `ops.json` with `"operationClass": "additive"` and the postcheck "verify column "state" has a default"; `check-postcheck.mjs` answering `{"result":true}` while the default is still `'open'::text`; `db migrate` failing with `MIGRATION.RUNNER_FAILED` and exit code 2; the default still `'open'::text` afterwards.

```

$ pnpm exec prisma --version --format human
8.0.0-rc.20
[exit 0]

$ node -p require('./node_modules/@prisma/orm-postgres/package.json').version
8.0.0-rc.14-dev.43
[exit 0]

$ cat contract.prisma
// use prisma-8

model Item {
  id    String @id
  state String @default("open")
}

$ pnpm exec prisma contract emit --format human
▸ Resolving contract source...
✔ Resolving contract source...
▸ Emitting contract...
✔ Emitting contract...
│  contract:  contract.json
│  types:     contract.d.ts

✔ Emitted contract.json and contract.d.ts

storageHash:  ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
profileHash:  3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2
<repro>/contract.json
<repro>/contract.d.ts
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma migration plan --name init --from @empty --format human
│  contract:    contract.json
│  migrations:  migrations/app
│  from:        @empty
│  name:        init

✔ Planned 2 operation(s)

migrations/app/20261007T0631_init
├─ Create schema "public"
└─ Create table "Item"

from:       (baseline)
to:         ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
app space:  migrations/app/20261007T0631_init

ℹ DDL preview

CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE "public"."Item" (
  "id" text NOT NULL,
  "state" text DEFAULT 'open' NOT NULL,
  PRIMARY KEY ("id")
);

→ Review migrations/app/20261007T0631_init
→ Apply the migration: prisma db migrate
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma db migrate --format human
▸ Running migration plan across spaces
✔ Running migration plan across spaces
│  migrations:  migrations
│  database:    postgres://****@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable

✔ Applied 1 migration(s) (2 operation(s)) across 1 contract space(s)

App space
├─ Create schema "public"
├─ Create table "Item"
└─ marker ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5

→ Check every space against the database: prisma migration status
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ cat contract.prisma
// use prisma-8

model Item {
  id    String @id
  state String @default("closed")
}

$ pnpm exec prisma contract emit --format human
▸ Resolving contract source...
✔ Resolving contract source...
▸ Emitting contract...
✔ Emitting contract...
│  contract:  contract.json
│  types:     contract.d.ts

✔ Emitted contract.json and contract.d.ts

storageHash:  9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462
profileHash:  3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2
<repro>/contract.json
<repro>/contract.d.ts
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma migration plan --name change-default --from ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5 --format human
│  contract:    contract.json
│  migrations:  migrations/app
│  from:        ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
│  name:        change-default

✔ Planned 1 operation(s)

migrations/app/20261007T0631_change_default
└─ Set default on "Item"."state"

from:       ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
to:         9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462
app space:  migrations/app/20261007T0631_change_default

ℹ DDL preview

ALTER TABLE "public"."Item" ALTER COLUMN "state" SET DEFAULT 'closed';

→ Review migrations/app/20261007T0631_change_default
→ Apply the migration: prisma db migrate
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ node migrations/app/20261007T0631_change_default/migration.ts
Wrote ops.json + migration.json to <repro>/migrations/app/20261007T0631_change_default
[exit 0]

$ cat migrations/app/20261007T0631_change_default/migration.ts
#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462/contract';
import endContract from '../../snapshots/9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5/contract';
import startContract from '../../snapshots/ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.setDefault({
        schema: 'public',
        table: 'Item',
        column: col('state', 'text', {
          default: lit('closed'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
[exit 0]

$ cat migrations/app/20261007T0631_change_default/ops.json
[
  {
    "id": "setDefault.Item.state",
    "label": "Set default on \"Item\".\"state\"",
    "operationClass": "additive",
    "target": {
      "id": "postgres",
      "details": {
        "schema": "public",
        "objectType": "column",
        "name": "state",
        "table": "Item"
      }
    },
    "precheck": [
      {
        "description": "ensure column \"state\" exists",
        "sql": "SELECT EXISTS (SELECT 1 AS \"one\" FROM \"information_schema\".\"columns\" WHERE (\"table_schema\" = $1 AND \"table_name\" = $2 AND \"column_name\" = $3)) AS \"result\"",
        "params": [
          "public",
          "Item",
          "state"
        ]
      }
    ],
    "execute": [
      {
        "description": "set default on \"state\"",
        "sql": "ALTER TABLE \"public\".\"Item\" ALTER COLUMN \"state\" SET DEFAULT 'closed'"
      }
    ],
    "postcheck": [
      {
        "description": "verify column \"state\" has a default",
        "sql": "SELECT EXISTS (SELECT 1 AS \"one\" FROM \"information_schema\".\"columns\" WHERE (\"table_schema\" = $1 AND \"table_name\" = $2 AND \"column_name\" = $3 AND \"column_default\" IS NOT NULL)) AS \"result\"",
        "params": [
          "public",
          "Item",
          "state"
        ]
      }
    ]
  }
][exit 0]

$ psql postgres://postgres@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable -c \d "Item"
                 Table "public.Item"
 Column | Type | Collation | Nullable |   Default    
--------+------+-----------+----------+--------------
 id     | text |           | not null | 
 state  | text |           | not null | 'open'::text
Indexes:
    "Item_pkey" PRIMARY KEY, btree (id)

[exit 0]

$ node check-postcheck.mjs
operation setDefault.Item.state (additive)
  postcheck "verify column "state" has a default" answers {"result":true}
[exit 0]

$ pnpm exec prisma db migrate --json
{"kind":"step-started","step":"Running migration plan across spaces","id":"apply","commandId":"db.migrate","timestamp":"2026-10-07T06:32:04.745Z"}
{"kind":"step-finished","step":"Running migration plan across spaces","id":"apply","outcome":"failed","commandId":"db.migrate","timestamp":"2026-10-07T06:32:04.953Z"}
{"kind":"result","envelope":{"ok":false,"commandId":"db.migrate","error":{"code":"MIGRATION.RUNNER_FAILED","severity":"error","summary":"Database schema does not satisfy contract (1 failure)","why":"The resulting database schema does not satisfy the destination contract.","nextActions":[{"kind":"user-choice","label":"Fix the issue and re-run `prisma db migrate --to <contract>` — previously applied migrations are preserved."}],"meta":{"issues":[{"path":["database","public","Item","column:state","default"],"expected":{"nodeKind":"sql-column-default","resolved":{"kind":"literal","value":"closed"},"nativeTypeContext":"text"},"actual":{"nodeKind":"sql-column-default","resolved":{"kind":"literal","value":"open"},"raw":"'open'::text","nativeTypeContext":"text"}}],"failingSpace":"app","runnerErrorCode":"MIGRATION.SCHEMA_VERIFY_FAILED"},"docsUrl":"https://docs.prisma.io/docs/orm/v8/reference/error-reference/MIGRATION.RUNNER_FAILED"},"diagnostics":[],"nextActions":[{"kind":"user-choice","label":"Fix the issue and re-run `prisma db migrate --to <contract>` — previously applied migrations are preserved."}]},"commandId":"db.migrate","timestamp":"2026-10-07T06:32:04.997Z"}
[exit 2]

$ psql postgres://postgres@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable -c \d "Item"
                 Table "public.Item"
 Column | Type | Collation | Nullable |   Default    
--------+------+-----------+----------+--------------
 id     | text |           | not null | 
 state  | text |           | not null | 'open'::text
Indexes:
    "Item_pkey" PRIMARY KEY, btree (id)

[exit 0]
```

### Output 2: `./repro.sh planned` on 8.0.0-rc.14-dev.43 (applies, for contrast)

The planned operation is `'widening'` and has `"postcheck": []`, so the runner cannot skip it. `db migrate` succeeds with `"operationsExecuted":1` and the default becomes `'closed'::text`.

```

$ pnpm exec prisma --version --format human
8.0.0-rc.20
[exit 0]

$ node -p require('./node_modules/@prisma/orm-postgres/package.json').version
8.0.0-rc.14-dev.43
[exit 0]

$ cat contract.prisma
// use prisma-8

model Item {
  id    String @id
  state String @default("open")
}

$ pnpm exec prisma contract emit --format human
▸ Resolving contract source...
✔ Resolving contract source...
▸ Emitting contract...
✔ Emitting contract...
│  contract:  contract.json
│  types:     contract.d.ts

✔ Emitted contract.json and contract.d.ts

storageHash:  ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
profileHash:  3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2
<repro>/contract.json
<repro>/contract.d.ts
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma migration plan --name init --from @empty --format human
│  contract:    contract.json
│  migrations:  migrations/app
│  from:        @empty
│  name:        init

✔ Planned 2 operation(s)

migrations/app/20261007T0631_init
├─ Create schema "public"
└─ Create table "Item"

from:       (baseline)
to:         ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
app space:  migrations/app/20261007T0631_init

ℹ DDL preview

CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE "public"."Item" (
  "id" text NOT NULL,
  "state" text DEFAULT 'open' NOT NULL,
  PRIMARY KEY ("id")
);

→ Review migrations/app/20261007T0631_init
→ Apply the migration: prisma db migrate
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma db migrate --format human
▸ Running migration plan across spaces
✔ Running migration plan across spaces
│  migrations:  migrations
│  database:    postgres://****@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable

✔ Applied 1 migration(s) (2 operation(s)) across 1 contract space(s)

App space
├─ Create schema "public"
├─ Create table "Item"
└─ marker ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5

→ Check every space against the database: prisma migration status
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ cat contract.prisma
// use prisma-8

model Item {
  id    String @id
  state String @default("closed")
}

$ pnpm exec prisma contract emit --format human
▸ Resolving contract source...
✔ Resolving contract source...
▸ Emitting contract...
✔ Emitting contract...
│  contract:  contract.json
│  types:     contract.d.ts

✔ Emitted contract.json and contract.d.ts

storageHash:  9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462
profileHash:  3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2
<repro>/contract.json
<repro>/contract.d.ts
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma migration plan --name change-default --from ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5 --format human
│  contract:    contract.json
│  migrations:  migrations/app
│  from:        ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
│  name:        change-default

✔ Planned 1 operation(s)

migrations/app/20261007T0631_change_default
└─ Set default on "Item"."state"

from:       ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5
to:         9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462
app space:  migrations/app/20261007T0631_change_default

ℹ DDL preview

ALTER TABLE "public"."Item" ALTER COLUMN "state" SET DEFAULT 'closed';

→ Review migrations/app/20261007T0631_change_default
→ Apply the migration: prisma db migrate
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14-dev.43, synced none). Run: prisma skills sync
[exit 0]

$ cat migrations/app/20261007T0631_change_default/migration.ts
#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462/contract';
import endContract from '../../snapshots/9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5/contract';
import startContract from '../../snapshots/ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.setDefault({
        schema: 'public',
        table: 'Item',
        column: col('state', 'text', {
          default: lit('closed'),
          codecRef: { codecId: 'pg/text@1' },
        }),
        operationClass: 'widening',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
[exit 0]

$ cat migrations/app/20261007T0631_change_default/ops.json
[
  {
    "id": "setDefault.Item.state",
    "label": "Set default on \"Item\".\"state\"",
    "operationClass": "widening",
    "target": {
      "id": "postgres",
      "details": {
        "schema": "public",
        "objectType": "column",
        "name": "state",
        "table": "Item"
      }
    },
    "precheck": [
      {
        "description": "ensure column \"state\" exists",
        "sql": "SELECT EXISTS (SELECT 1 AS \"one\" FROM \"information_schema\".\"columns\" WHERE (\"table_schema\" = $1 AND \"table_name\" = $2 AND \"column_name\" = $3)) AS \"result\"",
        "params": [
          "public",
          "Item",
          "state"
        ]
      }
    ],
    "execute": [
      {
        "description": "set default on \"state\"",
        "sql": "ALTER TABLE \"public\".\"Item\" ALTER COLUMN \"state\" SET DEFAULT 'closed'"
      }
    ],
    "postcheck": []
  }
][exit 0]

$ psql postgres://postgres@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable -c \d "Item"
                 Table "public.Item"
 Column | Type | Collation | Nullable |   Default    
--------+------+-----------+----------+--------------
 id     | text |           | not null | 
 state  | text |           | not null | 'open'::text
Indexes:
    "Item_pkey" PRIMARY KEY, btree (id)

[exit 0]

$ node check-postcheck.mjs
operation setDefault.Item.state (widening)
  no postcheck
[exit 0]

$ pnpm exec prisma db migrate --json
{"kind":"step-started","step":"Running migration plan across spaces","id":"apply","commandId":"db.migrate","timestamp":"2026-10-07T06:31:19.619Z"}
{"kind":"step-finished","step":"Running migration plan across spaces","id":"apply","outcome":"ok","commandId":"db.migrate","timestamp":"2026-10-07T06:31:19.818Z"}
{"kind":"result","envelope":{"ok":true,"commandId":"db.migrate","result":{"ok":true,"migrationsApplied":1,"migrationsTotal":1,"markerHash":"9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462","applied":[{"spaceId":"app","dirName":"20261007T0631_change_default","migrationHash":"0d2b226d11f63b725d771fd9a97842eb04d363fcf4600cd7a44241cd85cf6a4b","from":"ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5","to":"9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462","operationsExecuted":1}],"summary":"Applied 1 migration(s) (1 operation(s)) across 1 contract space(s)","perSpace":[{"spaceId":"app","kind":"app","operations":[{"id":"setDefault.Item.state","label":"Set default on \"Item\".\"state\"","operationClass":"widening"}],"marker":{"storageHash":"9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462"}}],"pathDecision":{"fromHash":"ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5","toHash":"9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462","alternativeCount":0,"tieBreakReasons":[],"requiredInvariants":[],"satisfiedInvariants":[],"selectedPath":[{"dirName":"20261007T0631_change_default","migrationHash":"0d2b226d11f63b725d771fd9a97842eb04d363fcf4600cd7a44241cd85cf6a4b","from":"ab2fd8a37966cb385a1cc41064603833573a9d87aff7800593e3d4f1d0f198c5","to":"9a03284d3bb3c2b1e9c037d32573bd56728eeb81bfc53a5198fe22703a4ab462","invariants":[]}]},"timings":{"total":493},"advancedRef":null},"exitCode":0,"diagnostics":[],"nextActions":[{"kind":"run-command","label":"Check every space against the database","command":"prisma migration status"}]},"commandId":"db.migrate","timestamp":"2026-10-07T06:31:19.823Z"}
[exit 0]

$ psql postgres://postgres@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable -c \d "Item"
                  Table "public.Item"
 Column | Type | Collation | Nullable |    Default     
--------+------+-----------+----------+----------------
 id     | text |           | not null | 
 state  | text |           | not null | 'closed'::text
Indexes:
    "Item_pkey" PRIMARY KEY, btree (id)

[exit 0]
```

### Output 3: `./repro.sh planned` on 8.0.0-rc.14, the current `latest` release (fails)

The planned operation is `'widening'`, but at this version it still has the "has a default" postcheck, which answers true before the run.

```

$ pnpm exec prisma --version --format human
8.0.0-rc.20
[exit 0]

$ node -p require('./node_modules/@prisma/orm-postgres/package.json').version
8.0.0-rc.14
[exit 0]

$ cat contract.prisma
// use prisma-8

model Item {
  id    String @id
  state String @default("open")
}

$ pnpm exec prisma contract emit --format human
▸ Resolving contract source...
✔ Resolving contract source...
▸ Emitting contract...
✔ Emitting contract...
│  contract:  contract.json
│  types:     contract.d.ts

✔ Emitted contract.json and contract.d.ts

storageHash:  d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55
profileHash:  3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2
<repro>/contract.json
<repro>/contract.d.ts
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma migration plan --name init --from @empty --format human
│  contract:    contract.json
│  migrations:  migrations/app
│  from:        @empty
│  name:        init

✔ Planned 2 operation(s)

migrations/app/20261007T0632_init
├─ Create schema "public"
└─ Create table "Item"

from:       (baseline)
to:         d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55
app space:  migrations/app/20261007T0632_init

ℹ DDL preview

CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE "public"."Item" (
  "id" text NOT NULL,
  "state" text DEFAULT 'open' NOT NULL,
  PRIMARY KEY ("id")
);

→ Review migrations/app/20261007T0632_init
→ Apply the migration: prisma db migrate
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma db migrate --format human
▸ Running migration plan across spaces
✔ Running migration plan across spaces
│  migrations:  migrations
│  database:    postgres://****@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable

✔ Applied 1 migration(s) (2 operation(s)) across 1 contract space(s)

App space
├─ Create schema "public"
├─ Create table "Item"
└─ marker d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55

→ Check every space against the database: prisma migration status
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14, synced none). Run: prisma skills sync
[exit 0]

$ cat contract.prisma
// use prisma-8

model Item {
  id    String @id
  state String @default("closed")
}

$ pnpm exec prisma contract emit --format human
▸ Resolving contract source...
✔ Resolving contract source...
▸ Emitting contract...
✔ Emitting contract...
│  contract:  contract.json
│  types:     contract.d.ts

✔ Emitted contract.json and contract.d.ts

storageHash:  b8ba0a246bdc87995bdd87a24154eb605577852bd1e61945f98e7326cafe9180
profileHash:  3916f444a8a17ad749191acf9e08dad97d1a327b88c2f1d45d12f240296aa8b2
<repro>/contract.json
<repro>/contract.d.ts
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14, synced none). Run: prisma skills sync
[exit 0]

$ pnpm exec prisma migration plan --name change-default --from d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55 --format human
│  contract:    contract.json
│  migrations:  migrations/app
│  from:        d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55
│  name:        change-default

✔ Planned 1 operation(s)

migrations/app/20261007T0632_change_default
└─ Set default on "Item"."state"

from:       d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55
to:         b8ba0a246bdc87995bdd87a24154eb605577852bd1e61945f98e7326cafe9180
app space:  migrations/app/20261007T0632_change_default

ℹ DDL preview

ALTER TABLE "public"."Item" ALTER COLUMN "state" SET DEFAULT 'closed';

→ Review migrations/app/20261007T0632_change_default
→ Apply the migration: prisma db migrate
Prisma agent skills are out of date (installed @prisma/orm-postgres 8.0.0-rc.14, synced none). Run: prisma skills sync
[exit 0]

$ cat migrations/app/20261007T0632_change_default/migration.ts
#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b8ba0a246bdc87995bdd87a24154eb605577852bd1e61945f98e7326cafe9180/contract';
import endContract from '../../snapshots/b8ba0a246bdc87995bdd87a24154eb605577852bd1e61945f98e7326cafe9180/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55/contract';
import startContract from '../../snapshots/d895014903d4916237123b20d356dce53f35714fdec7a3b0e1596c4f4588ef55/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.setDefault({
        schema: 'public',
        table: 'Item',
        column: 'state',
        defaultSql: "DEFAULT 'closed'",
        operationClass: 'widening',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
[exit 0]

$ cat migrations/app/20261007T0632_change_default/ops.json
[
  {
    "id": "setDefault.Item.state",
    "label": "Set default on \"Item\".\"state\"",
    "operationClass": "widening",
    "target": {
      "id": "postgres",
      "details": {
        "schema": "public",
        "objectType": "column",
        "name": "state",
        "table": "Item"
      }
    },
    "precheck": [
      {
        "description": "ensure column \"state\" exists",
        "sql": "SELECT EXISTS (SELECT 1 AS \"one\" FROM \"information_schema\".\"columns\" WHERE (\"table_schema\" = $1 AND \"table_name\" = $2 AND \"column_name\" = $3)) AS \"result\"",
        "params": [
          "public",
          "Item",
          "state"
        ]
      }
    ],
    "execute": [
      {
        "description": "set default on \"state\"",
        "sql": "ALTER TABLE \"public\".\"Item\" ALTER COLUMN \"state\" SET DEFAULT 'closed'"
      }
    ],
    "postcheck": [
      {
        "description": "verify column \"state\" has a default",
        "sql": "SELECT EXISTS (SELECT 1 AS \"one\" FROM \"information_schema\".\"columns\" WHERE (\"table_schema\" = $1 AND \"table_name\" = $2 AND \"column_name\" = $3 AND \"column_default\" IS NOT NULL)) AS \"result\"",
        "params": [
          "public",
          "Item",
          "state"
        ]
      }
    ]
  }
][exit 0]

$ psql postgres://postgres@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable -c \d "Item"
                 Table "public.Item"
 Column | Type | Collation | Nullable |   Default    
--------+------+-----------+----------+--------------
 id     | text |           | not null | 
 state  | text |           | not null | 'open'::text
Indexes:
    "Item_pkey" PRIMARY KEY, btree (id)

[exit 0]

$ node check-postcheck.mjs
operation setDefault.Item.state (widening)
  postcheck "verify column "state" has a default" answers {"result":true}
[exit 0]

$ pnpm exec prisma db migrate --json
{"kind":"step-started","step":"Running migration plan across spaces","id":"apply","commandId":"db.migrate","timestamp":"2026-10-07T06:32:39.556Z"}
{"kind":"step-finished","step":"Running migration plan across spaces","id":"apply","outcome":"failed","commandId":"db.migrate","timestamp":"2026-10-07T06:32:39.648Z"}
{"kind":"result","envelope":{"ok":false,"commandId":"db.migrate","error":{"code":"MIGRATION.RUNNER_FAILED","severity":"error","summary":"Database schema does not satisfy contract (1 failure)","why":"The resulting database schema does not satisfy the destination contract.","nextActions":[{"kind":"user-choice","label":"Fix the issue and re-run `prisma db migrate --to <contract>` — previously applied migrations are preserved."}],"meta":{"issues":[{"path":["database","public","Item","column:state","default"],"expected":{"nodeKind":"sql-column-default","resolved":{"kind":"literal","value":"closed"},"nativeTypeContext":"text"},"actual":{"nodeKind":"sql-column-default","resolved":{"kind":"literal","value":"open"},"raw":"'open'::text","nativeTypeContext":"text"}}],"failingSpace":"app","runnerErrorCode":"MIGRATION.SCHEMA_VERIFY_FAILED"},"docsUrl":"https://docs.prisma.io/docs/orm/v8/reference/error-reference/MIGRATION.RUNNER_FAILED"},"diagnostics":[],"nextActions":[{"kind":"user-choice","label":"Fix the issue and re-run `prisma db migrate --to <contract>` — previously applied migrations are preserved."}]},"commandId":"db.migrate","timestamp":"2026-10-07T06:32:39.655Z"}
[exit 2]

$ psql postgres://postgres@127.0.0.1:55471/orm_setdefault_repro?sslmode=disable -c \d "Item"
                 Table "public.Item"
 Column | Type | Collation | Nullable |   Default    
--------+------+-----------+----------+--------------
 id     | text |           | not null | 
 state  | text |           | not null | 'open'::text
Indexes:
    "Item_pkey" PRIMARY KEY, btree (id)

[exit 0]
```

## Expected behaviour

- `this.setDefault({ schema, table, column: col(name, type, { default }) })` on a column whose current default differs from `default` runs `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT ...`, whatever `operationClass` it has or lacks. `db migrate` succeeds and the column then has the new default.
- The runner may still skip a `setDefault` whose effect is already in place, as ADR 038 intends, but only when the column's current default equals the one the operation sets. A different default must never make the operation look applied.

## Cause

Three pieces of code combine. Paths are given on GitHub at `prisma/orm` `main` `095af7a5dbc7196aaf35ede857ab74a001a85f5f`, which matches the published 8.0.0-rc.14-dev.43, and in the published package `@prisma/orm-target-postgres` (a dependency of `@prisma/orm-postgres`). The published files are bundles; their source maps name the source files. All source is under `packages/3-targets/3-targets/postgres/src/`.

### 1. `setDefault` picks its postcheck from `operationClass`

`core/migrations/operations/columns.ts`, lines 199 to 254 on `main`. Published 8.0.0-rc.14-dev.43: `dist/op-factory-call-B-4nf1jC-DkRw5e1q.mjs`, lines 152 to 188.

```ts
 * `operationClass` defaults to `'additive'` (setting a default on a column
 * that currently has none). The reconciliation planner passes `'widening'`
 * when the column already has a different default — policy enforcement
 * treats that as a widening change rather than an additive one. A widening
 * change has no postcheck: the old default would pass a check for a default,
 * and the runner skips an operation whose postcheck already passes. Setting a
 * default again is harmless.
 */
export async function setDefault(
  schemaName: string,
  tableName: string,
  column: DdlColumn,
  lowerer: ExecuteRequestLowerer,
  operationClass: 'additive' | 'widening' = 'additive',
): Promise<Op> {
  // ...
  const hasDefault =
    operationClass === 'additive'
      ? await lowerer.lowerToExecuteRequest(
          columnDefaultAst({
            schema: schemaName,
            table: tableName,
            column: columnName,
          }).defaultPresent(),
        )
      : undefined;
  return {
    // ...
    postcheck:
      hasDefault === undefined
        ? []
        : [step(`verify column "${columnName}" has a default`, hasDefault.sql, hasDefault.params)],
  };
}
```

The doc comment states the problem for the widening case. The additive case keeps the same problem whenever the column already has a default, which "additive" is assumed to rule out but nothing checks.

At 8.0.0-rc.14 (`dist/op-factory-call-BBkvFvKK-7MkUHWJq.mjs`, lines 152 to 183), every `setDefault` had the postcheck, whatever its class:

```js
async function setDefault(schemaName, tableName, columnName, defaultSql, lowerer, operationClass = "additive") {
	// ...
	const hasDefault = await lowerer.lowerToExecuteRequest(columnDefaultAst({
		schema: schemaName,
		table: tableName,
		column: columnName
	}).defaultPresent());
	return {
		// ...
		postcheck: [step(`verify column "${columnName}" has a default`, hasDefault.sql, hasDefault.params)]
	};
}
```

### 2. "Has a default" is only `column_default IS NOT NULL`

`contract-free/checks.ts`, lines 177 to 204 on `main`. Published 8.0.0-rc.14-dev.43: `dist/ddl-BzsT_-qY-Cdzm0YIK.mjs`, lines 112 to 126.

```ts
/**
 * Typed default-presence checks over `information_schema.columns`.
 * `defaultPresent` / `defaultAbsent` assert the column row exists with a
 * non-null / null `column_default`; `noDefault` is the NOT EXISTS variant
 * (also true when the column row is missing entirely).
 */
export function columnDefaultAst(options: { /* schema, table, column */ }): ColumnDefaultCheckBuilder {
  const withDefault = () =>
    infoSchemaColumnQuery([
      ...infoSchemaColumnConditions(options),
      cfExpr.identifierRef('column_default').isNotNull(),
    ]);
  // ...
  return {
    defaultPresent: () => exprSelect().project('result', cfExpr.exists(withDefault())).build(),
    // ...
  };
}
```

It lowers to the SQL in the `ops.json` above: `SELECT EXISTS (SELECT 1 AS "one" FROM "information_schema"."columns" WHERE ("table_schema" = $1 AND "table_name" = $2 AND "column_name" = $3 AND "column_default" IS NOT NULL)) AS "result"`.

### 3. The runner skips an operation whose postcheck already holds

`core/migrations/runner.ts`, lines 212 to 236 and 419 to 432 on `main`. Published 8.0.0-rc.14-dev.43: `dist/control-CgOBPYS9.mjs`, lines 162 to 177 and 268 to 275. Published 8.0.0-rc.14: `dist/control-DUZ-NwiJ.mjs`, lines 164 to 179 and 270 to 277, the same code.

```ts
    const runPostchecks = checks?.postchecks !== false; // Default true
    const runIdempotency = checks?.idempotencyChecks !== false; // Default true
    // ...
    for (const operation of ops) {
      // ...
        // Idempotency probe: only run if both postchecks and idempotency checks are enabled
        if (runPostchecks && runIdempotency) {
          const postcheckAlreadySatisfied = await this.expectationsAreSatisfied(
            driver,
            operation.postcheck,
          );
          if (postcheckAlreadySatisfied) {
            executedOperations.push(this.createPostcheckPreSatisfiedSkipRecord(operation));
            continue;
          }
        }
```

```ts
  private async expectationsAreSatisfied(
    driver: SqlMigrationRunnerExecuteOptions<PostgresPlanTargetDetails>['driver'],
    steps: readonly SqlMigrationPlanOperationStep[],
  ): Promise<boolean> {
    if (steps.length === 0) {
      return false;
    }
    // ...
```

An empty postcheck is never "already satisfied", which is why the widening path now runs.

### Where `operationClass` comes from

The planner (`core/migrations/issue-planner.ts`, `mapColumnDefaultNodeIssue`, lines 706 to 732 on `main`) always sets it:

```ts
  return ok([
    new SetDefaultCall(
      schemaName,
      tableName,
      column,
      issueOutcome(issue) === 'not-equal' ? 'widening' : 'additive',
    ),
  ]);
```

The authoring method (`core/migrations/postgres-migration.ts`, lines 430 to 443 on `main`; published 8.0.0-rc.14-dev.43: `dist/postgres-migration-CmD95Eh_-DGLByWZD.mjs`, line 513) passes on whatever the author wrote, `undefined` included, so `setDefault` falls back to `'additive'`:

```ts
  protected setDefault(options: {
    readonly schema: string;
    readonly table: string;
    readonly column: DdlColumn;
    readonly operationClass?: 'additive' | 'widening';
  }): Promise<SqlMigrationPlanOperation<PostgresPlanTargetDetails>> {
    refuseEarlierSetDefaultOptions(options);
    return new SetDefaultCall(
      options.schema,
      options.table,
      options.column,
      options.operationClass,
    ).toOp(this.controlAdapterFor('setDefault'));
  }
```

## Recommended fix

**Give every `setDefault` an empty postcheck, whatever its `operationClass`.** In `setDefault` in `columns.ts`, delete the `hasDefault` branch and return `postcheck: []`, and rewrite the doc comment to say why: no SQL check the operation can carry tells the old default from the new one, so the operation always runs, and the runner's final schema verification compares the value. This is what `main` already does for the planner's `'widening'` case. It makes the operation correct for every caller and stops what runs from depending on a policy label.

What it costs: an additive `setDefault` loses its after-execution check "the column has a default". That check cannot fail after `ALTER TABLE ... SET DEFAULT` succeeds, and it never checked the value, so nothing it caught is lost. Running `SET DEFAULT` again on a replay is harmless.

**The design question this raises.** ADR 038 and ADR 044 call for a `defaultIs(table, column, normalizedExpr)` check, which would let a replay skip a `setDefault` that is already in place. The team should decide whether to build it or to amend the ADRs. Building it is not simple. Postgres reports a default in its own form (`'closed'::text` for the `'closed'` the ORM writes, and the form depends on the type and the Postgres version). The ORM reads that form back with a normalizer in JavaScript, which schema verification uses. A postcheck, though, is SQL stored in `ops.json`. The choices are:

1. Compute at plan time the exact text Postgres will report, and compare `column_default` with it. This breaks whenever the reported form differs from the prediction.
2. Let the runner run some checks through the schema verifier instead of SQL. This is a change to what an operation can carry, and to `ops.json`.
3. Keep no postcheck for `setDefault` (the recommendation above), and amend ADR 044's idempotency mapping to say so.

**A wider question for the runner, not part of this fix.** The skip treats every postcheck as proof that an operation's whole effect is in place. That is only true when the postcheck is as specific as the operation. `setDefault` is the case this ticket hits. Checks of the form "an object with this name exists" (constraints, indexes, policies) have the same shape when a hand-written operation reuses a name with a new definition. The team may want a rule that a postcheck used for the skip must match the definition, or a way for an operation to say that its postcheck does not prove it was applied.

**Alternatives considered.**

- *Make `operationClass` required on `this.setDefault`.* Every author would then have to choose, but correctness would still depend on choosing right, and an author who labels a changed default `'additive'` still gets the skip.
- *Infer `operationClass` in `this.setDefault` from the migration's start contract* (`'widening'` when the column has a default there). This fixes the label for hand-written calls and is worth doing on its own, because a mislabelled change can pass an additive-only policy. It does not help a caller that builds a `SetDefaultCall` directly, and it keeps the check tied to the label. Use it as an addition, not as the fix.

## Acceptance criteria

- `setDefault` in `packages/3-targets/3-targets/postgres/src/core/migrations/operations/columns.ts` no longer chooses its postcheck from `operationClass`, and no `setDefault` has a postcheck that a column with a different default satisfies.
- A new unit test in `packages/3-targets/3-targets/postgres/test/postgres-migration-op-builders.test.ts`, next to "setDefault refuses a column with no default": `this.setDefault(...)` without `operationClass`, with `'additive'` and with `'widening'` each produce an operation with an empty postcheck (or, if the team builds `defaultIs`, a postcheck that answers false on a column with a different default).
- A new integration test in `packages/3-targets/6-adapters/postgres/test/migrations/runner.idempotency.integration.test.ts`, in the `describe` "when the operation postcheck is already satisfied before execution (idempotency)": create a table whose text column has the default `'open'`; run through the runner a `setDefault` built without `operationClass` that sets `'closed'`; expect success, `operationsExecuted` 1, and a `column_default` that contains `closed`. Repeat with `operationClass: 'additive'`.
- The existing tests still pass, in particular "applies ALTER DEFAULT to change an existing column default" in `packages/3-targets/6-adapters/postgres/test/migrations/planner.reconciliation.integration.test.ts` and "on Postgres, a new column and a changed default apply, verify and plan no change" in `test/integration/test/authoring/defaults-on-existing-tables.integration.test.ts`.
- The reproduction above, `./repro.sh hand-written` against a build with the fix, prints `[exit 0]` after `db migrate` and then `'closed'::text` for the `state` column.
- The doc comment on `setDefault` describes the new rule. ADR 044's idempotency mapping either gets `defaultIs` built or is amended to say that `setDefault` carries no postcheck.

## Out of scope

- Releasing PR #30451's fix for planned default changes. It is on `main` and in the `dev` builds, and ships with the next release.
- The SQLite target. It has its own runner with the same `postcheck_pre_satisfied` skip (`packages/3-targets/3-targets/sqlite/src/core/migrations/runner.ts`), and SQLite changes a default by rebuilding the table. It was not examined.
- Other operations whose postcheck only checks that an object with a name exists (the wider question above).
- Migration packages planned with 8.0.0-rc.14 or earlier. Their `ops.json` holds the old postcheck. The dev builds refuse those packages in any case: running the dev build against an 8.0.0-rc.14 contract failed with `CONTRACT.VALIDATION_FAILED` ("contracts no longer store a column's database type name"), and `this.setDefault` now refuses the old `defaultSql` option and points to the upgrade entry `migration-ts-column-defaults`. So they are planned again on upgrade.
</pasted_content id="1941">

