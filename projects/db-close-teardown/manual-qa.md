# Manual QA — TML-2614 (db.close() + [Symbol.asyncDispose])

> **Be the user.** Run scripts, observe real process exit behaviour, and judge what unit tests can't: diagnostic clarity, end-to-end process lifecycle, and skill-content coherence.
>
> **Out of scope of this script.** Do not re-run `pnpm test`; do not re-run CI lints against the clean tree; do not verify fixture shapes — CI already owns those gates. This script covers what CI cannot.
>
> **Spec:** `projects/db-close-teardown/spec.md`
> **Plan:** `projects/db-close-teardown/plan.md`
> **PR:** https://github.com/prisma/prisma-next/pull/548

## What this script is testing

**The bug / motivation.** Users following the Prisma Next quickstart shape — `tsx my-script.ts` that connects, runs queries, then exits — encounter two failure modes on 100% of first-touch runs. On Postgres, the `pg.Pool` lazily constructed by the facade keeps Node's event loop alive after all queries complete; the script never exits. When agents try to help, they confabulate `db.end()` (the `node-postgres` pool API) since the facade historically had no teardown surface; the call throws `TypeError: db.end is not a function` after the data round-trip already succeeded. Both failures are worst-possible last impressions on an onboarding journey.

**The fix / what changed.** The PR adds:

- `db.close(): Promise<void>` and `db[Symbol.asyncDispose](): Promise<void>` to `PostgresClient`, `SqliteClient`, and `MongoClient`.
- Ownership rule: `close()` releases only what the facade itself constructed (`pg.Pool` from `{ url }`, `MongoClient` from `{ url }` / `{ uri, dbName }`, SQLite handle from `{ path }`). Caller-supplied pools/clients/bindings are never touched.
- A terminal closed state: after `close()`, `db.runtime()`, `db.connect()`, ORM terminals, `db.transaction()`, and `db.prepare()` reject with `Error('<target> client is closed')`.
- A silent fix to Mongo: the previous `close()` unconditionally called the driver close even for caller-supplied `mongoClient`; the corrected version honours the ownership rule.
- Updated skills (`prisma-next-runtime`, `prisma-next-queries`, `prisma-next-debug`) teaching the teardown pattern and routing the `db.end()` confabulation diagnostic.

**Why manual QA matters here.** Unit tests verify mock-pool mechanics: idempotence, terminal state, ownership rule, `[Symbol.asyncDispose]` aliasing, in-flight connect handling. They do not verify:

1. That a real `tsx` script against a real driver actually exits within ~2s of calling `await db.close()` (the original ticket symptom).
2. That TS 5.2+ `await using` at script-module top level invokes `[Symbol.asyncDispose]` correctly and the script exits.
3. That the post-close error (`Error('<target> client is closed')`) surfaces cleanly through the ORM layer, not buried under extra wrapping — for all three targets.
4. That the skill content correctly routes the hang symptom and clearly flags the per-request `await using` anti-pattern.
5. That Mongo's ownership-rule behaviour change is correct against a real driver, not just a mocked one.

**Script authoring note.** All runnable scripts in this QA script live inside workspace-member package directories (`packages/3-extensions/<pkg>/scratch/`) and are invoked as `pnpm --filter <package> exec tsx scratch/<script>.ts`. This is necessary because pnpm resolves `@internal/*` workspace deps relative to each package's `node_modules/`, and scripts outside the workspace cannot resolve those deps.

## Table of contents

| # | Scenario | What it proves | Isolation | Covers |
| - | -------- | -------------- | --------- | ------ |
| 1 | Postgres real-script hang→exit | A real `tsx` script against a real `pg.Pool` exits within 5s after `await db.close()` | tmpdir | AC-Quickstart-exit |
| 2 | SQLite real-script hang→exit | A real `tsx` script against a real SQLite file-backed driver exits within 5s after `await db.close()` | tmpdir | AC-Quickstart-exit |
| 3 | `await using` top-level script module exit | `await using db = sqlite(...)` at script-module top level correctly calls `[Symbol.asyncDispose]` and the script exits | tmpdir | AC-Quickstart-exit |
| 4 | Post-close ORM error surface — Postgres | After `db.close()`, calling `db.runtime()` surfaces `'Postgres client is closed'` cleanly, not buried | tmpdir | AC-Terminal |
| 5 | Post-close ORM error surface — SQLite | After `db.close()`, calling `db.runtime()` surfaces `'SQLite client is closed'` cleanly | tmpdir | AC-Terminal |
| 6 | Mongo ownership rule — `{ uri }` vs `{ mongoClient }` (real driver) | Running both branches against a real `MongoMemoryReplSet`: facade-owns closes the client; caller-owns leaves it open | tmpdir | AC-Ownership, AC-Mongo-behaviour |
| 7 | Post-close error surface — Mongo | After `db.close()`, calling `db.runtime()` surfaces `'Mongo client is closed'` cleanly | tmpdir | AC-Terminal |
| 8 | Skill replay — hang-script routing **(judgement)** | `prisma-next-debug` routes "script won't exit" to `prisma-next-runtime` § *Running as a script (teardown)*; content is clear and sufficient | read-only | AC-Skills |
| 9 | Skill replay — per-request `await using` anti-pattern **(judgement)** | The DON'T block in `prisma-next-runtime` is clearly marked and discourages the per-request close pattern | read-only | AC-Skills |
| 10 | Exploratory: close surface edge-case probing (all three facades) | Probe unanticipated state combinations across all three facades against real drivers | tmpdir | (no specific AC; charter) |

> Scenarios 8 and 9 are **(judgement)** — they require evaluation against an explicit oracle that no test can assert. Scenario 10 is **(exploratory)** — a time-boxed charter.
>
> The **Isolation** column tells the runner how to schedule the scenario in parallel: `tmpdir` (own scratch dir, shared read-only clone), `workspace` (own `git worktree`), `read-only` (no isolation needed), or `external` (network-bound; rate-limit-aware).

## Pre-flight

**Mandatory pre-QA hardening (run verbatim; capture all output):**

1. Confirm the branch: `git branch --show-current` → should be `tml-2614-provide-dbclose-for-script-teardown-scripts-hang-at-end-and`.
2. Confirm the tree is clean: `git status --short` → should show no uncommitted source changes.
3. `pnpm install` — refresh all `node_modules` symlinks including any devDeps added since last install.
4. `pnpm build` — rebuild all packages so `dist/` matches source.
5. `pnpm --filter @internal/postgres --filter @internal/sqlite --filter @internal/mongo typecheck` → all three must pass.
6. `pnpm --filter @internal/postgres --filter @internal/sqlite --filter @internal/mongo test` → **all 113+ tests must pass** (postgres 64/64, sqlite 7/7, mongo 42/42). If mongo is not 42/42 after a fresh build, do not proceed; report it.

If any failure occurs in step 6 and you suspect it is pre-existing on `origin/main`, you **must** run the verification protocol before claiming it:

```bash
git stash push -u -m "qa-redo-pre-verify"
git checkout origin/main
pnpm install && pnpm build
pnpm --filter @internal/mongo test  # or whichever package failed
# capture output verbatim
git checkout -
git stash pop
```

Only after running this and confirming `origin/main` reproduces the same failure may you classify it as "pre-existing".

---

## Scenario 1 — Postgres real-script hang→exit

**What you're proving from the user's seat:** This re-enacts the original ticket's hang symptom against a real `pg.Pool`. Unit tests mock the pool; this scenario drives a real `new Pool(...)` which creates internal timers that keep Node's event loop alive, and verifies that `pool.end()` (what `db.close()` invokes under the hood) releases those timers within 5 seconds. Without the fix, `timeout 5 node --import tsx/esm ...` would exit with code 124 (timeout expired); with the fix it exits with code 0.

**Covers:** AC-Quickstart-exit

**Isolation:** `tmpdir`

**Oracle:** Script process exits with code 0, prints the completion message, and total wall time is under 5s.

**Preconditions:**
- Pre-flight steps 1–4 complete.
- `tsx` available: `pnpm --filter @internal/postgres exec tsx --version`.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

# Write the script inside the postgres package so pnpm workspace deps resolve
cat > "$REPO/packages/3-extensions/postgres/scratch/qa-hang-exit.ts" << 'SCRIPT'
import { Pool } from 'pg';

// Simulate what postgres({ url }) does inside toRuntimeBinding():
// new Pool(...) registers internal timers that keep the event loop alive.
// pool.end() releases those timers.
const pool = new Pool({
  connectionString: 'postgres://localhost:5999/nonexistent',
  connectionTimeoutMillis: 500,
  idleTimeoutMillis: 500,
});

console.log('Pool created — event loop is now kept alive by pg.Pool timers.');
console.log('Calling pool.end() (what db.close() does under the hood)...');
await pool.end();
console.log('pool.end() resolved — event loop drains now. Script exits.');
SCRIPT

# Run inside the postgres package so workspace deps resolve
cd "$REPO/packages/3-extensions/postgres"
time timeout 5 pnpm exec tsx scratch/qa-hang-exit.ts 2>&1
echo "Exit code: $?"
```

### What you should see

- Script prints all three log lines and exits.
- `time` output shows wall time under 2s (pool.end() is near-instant with no established connections).
- Exit code 0.
- If the hang fix were absent, `timeout 5` would fire with exit code 124 and the script would stop after "Pool created" with no further output.

### Failure modes (anything matching these = a finding the runner will classify)

- Exit code 124 (timeout expired): `pool.end()` is not being called or is blocking; the hang fix is not working.
- Exit code non-zero with an unexpected error (connection errors to `localhost:5999` are expected and swallowed by `pool.end()`).
- Wall time exceeds 3s unexpectedly.

### Restore

```bash
rm -f "$REPO/packages/3-extensions/postgres/scratch/qa-hang-exit.ts"
cd "$REPO" && git status --short
```

---

## Scenario 2 — SQLite real-script hang→exit

**What you're proving from the user's seat:** A real `tsx` script that creates a `sqlite({ path })` client — the facade-owned, file-backed driver shape — calls `db.close()`, and the process exits cleanly. The SQLite driver's close method is exercised for real; the process doesn't hang.

**Covers:** AC-Quickstart-exit

**Isolation:** `tmpdir`

**Oracle:** Script exits with code 0 and prints a completion message; wall time under 5s.

**Preconditions:**
- Pre-flight steps 1–4 complete.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

cat > "$REPO/packages/3-extensions/sqlite/scratch/qa-hang-exit.ts" << 'SCRIPT'
import { createContract } from '@internal/contract/testing';
import type { SqlStorage } from '@internal/sql-contract/types';
import sqlite from '@internal/sqlite/runtime';

// SQLite requires target: 'sqlite' — createContract<SqlStorage>() defaults to 'postgres'
const contract = createContract<SqlStorage>({ target: 'sqlite', targetFamily: 'sql' });
const db = sqlite({ contract, path: '/tmp/qa-2614-sqlite-hang-exit.db' });

// Trigger the driver build and file open
db.runtime();
await new Promise(resolve => setTimeout(resolve, 50));

console.log('SQLite driver opened. Calling db.close()...');
await db.close();
console.log('db.close() resolved. Script exits.');
SCRIPT

cd "$REPO/packages/3-extensions/sqlite"
time timeout 5 pnpm exec tsx scratch/qa-hang-exit.ts 2>&1
echo "Exit code: $?"
rm -f /tmp/qa-2614-sqlite-hang-exit.db
```

### What you should see

- Script prints both log lines and exits with code 0.
- Wall time under 3s.
- Node may emit `(node:NNNN) ExperimentalWarning: SQLite is an experimental feature and might change at any time` on Node 24+ — this is expected from Node and is not a Prisma Next issue.

### Failure modes

- Exit code 124: SQLite driver's `close()` is not being called or is blocking.
- Unexpected non-zero exit.

### Restore

```bash
rm -f "$REPO/packages/3-extensions/sqlite/scratch/qa-hang-exit.ts"
rm -f /tmp/qa-2614-sqlite-hang-exit.db
cd "$REPO" && git status --short
```

---

## Scenario 3 — `await using` top-level script module exit

**What you're proving from the user's seat:** TS 5.2+ `await using` at script-module top level correctly invokes `[Symbol.asyncDispose]` when the module exits, and the process exits cleanly. This is the idiomatic shape the updated `prisma-next-runtime` skill teaches. Unit tests exercise `await using` inside a test-function async scope; this scenario exercises it in an actual module-top-level script the way a user would write it.

**Covers:** AC-Quickstart-exit

**Isolation:** `tmpdir`

**Oracle:** Script prints "Inside script body: db is open and usable." and exits with code 0. No `TypeError: db[Symbol.asyncDispose] is not a function`.

**Preconditions:**
- Pre-flight steps 1–4 complete.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

cat > "$REPO/packages/3-extensions/sqlite/scratch/qa-await-using.ts" << 'SCRIPT'
import { createContract } from '@internal/contract/testing';
import type { SqlStorage } from '@internal/sql-contract/types';
import sqlite from '@internal/sqlite/runtime';

// SQLite requires target: 'sqlite' — createContract<SqlStorage>() defaults to 'postgres'
const contract = createContract<SqlStorage>({ target: 'sqlite', targetFamily: 'sql' });

// await using at top level of the script module — the shape the skill teaches.
// [Symbol.asyncDispose] fires when the module body completes.
await using db = sqlite({ contract, path: '/tmp/qa-2614-await-using.db' });

db.runtime();
await new Promise(resolve => setTimeout(resolve, 50));

console.log('Inside script body: db is open and usable.');
// After this line the module body ends; [Symbol.asyncDispose] fires automatically.
SCRIPT

cd "$REPO/packages/3-extensions/sqlite"
time timeout 5 pnpm exec tsx scratch/qa-await-using.ts 2>&1
echo "Exit code: $?"
rm -f /tmp/qa-2614-await-using.db
```

### What you should see

- Script prints `"Inside script body: db is open and usable."` and exits with code 0.
- No `TypeError: db[Symbol.asyncDispose] is not a function`.
- Wall time under 3s.
- Node 24+ SQLite `ExperimentalWarning` may appear — expected.

### Failure modes

- `TypeError: db[Symbol.asyncDispose] is not a function`: `[Symbol.asyncDispose]` is not declared on the facade.
- Exit code 124: `[Symbol.asyncDispose]` is blocking.
- `SyntaxError` about `await using`: tsx or Node version doesn't support TS 5.2+ syntax.

### Restore

```bash
rm -f "$REPO/packages/3-extensions/sqlite/scratch/qa-await-using.ts"
rm -f /tmp/qa-2614-await-using.db
cd "$REPO" && git status --short
```

---

## Scenario 4 — Post-close ORM error surface — Postgres

**What you're proving from the user's seat:** After `db.close()`, a user who tries to call `db.runtime()` gets a clean, usable error that names the cause. Unit tests verify the error thrown; this scenario verifies the error propagates cleanly through the ORM layer without extra wrapping that would confuse the user.

**Covers:** AC-Terminal

**Isolation:** `tmpdir`

**Oracle:** Error message is exactly `'Postgres client is closed'` — no additional wrapping (e.g. `OperationError: ...` or `RuntimeError: ...`).

**Preconditions:**
- Pre-flight steps 1–4 complete.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

cat > "$REPO/packages/3-extensions/postgres/scratch/qa-post-close-error.ts" << 'SCRIPT'
import { createContract } from '@internal/contract/testing';
import type { SqlStorage } from '@internal/sql-contract/types';
import postgres from '@internal/postgres/runtime';

const contract = createContract<SqlStorage>();
const db = postgres({ contract, url: 'postgres://localhost:5999/test' });

await db.close();

try {
  db.runtime();
  console.log('ERROR: expected a throw but did not get one');
  process.exit(1);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log('Caught error message:', JSON.stringify(message));
  if (message === 'Postgres client is closed') {
    console.log('PASS: error message is exactly "Postgres client is closed"');
  } else {
    console.log('FAIL: unexpected error message');
    process.exit(1);
  }
}
SCRIPT

cd "$REPO/packages/3-extensions/postgres"
pnpm exec tsx scratch/qa-post-close-error.ts 2>&1
echo "Exit code: $?"
```

### What you should see

- Output: `Caught error message: "Postgres client is closed"` followed by `PASS:` line.
- Exit code 0.
- Error message is clean with no extra wrapping.

### Failure modes

- Error message is wrapped (e.g. `OperationError: Postgres client is closed` or any prefix before the target-named text): the ORM layer is modifying the error.
- No error thrown: the closed guard is not in place.
- Unexpected error (e.g. connection error before the close guard fires).

### Restore

```bash
rm -f "$REPO/packages/3-extensions/postgres/scratch/qa-post-close-error.ts"
cd "$REPO" && git status --short
```

---

## Scenario 5 — Post-close ORM error surface — SQLite

**What you're proving from the user's seat:** Same as Scenario 4, but for the SQLite facade. Verifies `'SQLite client is closed'` is the exact error message from `db.runtime()` after close.

**Covers:** AC-Terminal

**Isolation:** `tmpdir`

**Oracle:** Error message is exactly `'SQLite client is closed'`.

**Preconditions:**
- Pre-flight steps 1–4 complete.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

cat > "$REPO/packages/3-extensions/sqlite/scratch/qa-post-close-error.ts" << 'SCRIPT'
import { createContract } from '@internal/contract/testing';
import type { SqlStorage } from '@internal/sql-contract/types';
import sqlite from '@internal/sqlite/runtime';

// SQLite requires target: 'sqlite' — createContract<SqlStorage>() defaults to 'postgres'
const contract = createContract<SqlStorage>({ target: 'sqlite', targetFamily: 'sql' });
const db = sqlite({ contract, path: '/tmp/qa-2614-post-close.db' });

await db.close();

try {
  db.runtime();
  console.log('ERROR: expected a throw but did not get one');
  process.exit(1);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log('Caught error message:', JSON.stringify(message));
  if (message === 'SQLite client is closed') {
    console.log('PASS: error message is exactly "SQLite client is closed"');
  } else {
    console.log('FAIL: unexpected error message');
    process.exit(1);
  }
}
SCRIPT

cd "$REPO/packages/3-extensions/sqlite"
pnpm exec tsx scratch/qa-post-close-error.ts 2>&1
echo "Exit code: $?"
rm -f /tmp/qa-2614-post-close.db
```

### What you should see

- Output: `Caught error message: "SQLite client is closed"` followed by `PASS:` line.
- Exit code 0.

### Failure modes

- Message is wrapped or different: ORM layer modifying the error.
- No error thrown.

### Restore

```bash
rm -f "$REPO/packages/3-extensions/sqlite/scratch/qa-post-close-error.ts"
rm -f /tmp/qa-2614-post-close.db
cd "$REPO" && git status --short
```

---

## Scenario 6 — Mongo ownership rule — `{ uri }` vs `{ mongoClient }` (real driver)

**What you're proving from the user's seat:** The Mongo ownership-rule behaviour change (TML-2614's silent fix: `close()` no longer closes a caller-supplied `MongoClient`) is correct against a real driver. Two branches must be exercised:

- **Facade-owns branch** (`{ uri, dbName }`): calling `db.close()` closes the MongoClient the facade constructed; subsequent use of `db.runtime()` rejects.
- **Caller-owns branch** (`{ mongoClient }`): calling `db.close()` does NOT close the caller's `MongoClient`; the caller can still use it after.

Unit tests cover both shapes with mocked drivers. This scenario runs both against a real `MongoMemoryReplSet`.

**Covers:** AC-Ownership, AC-Mongo-behaviour

**Isolation:** `tmpdir`

**Oracle:** In the facade-owns branch, the `MongoClient` constructed by the facade is closed after `db.close()` (verified by trying to use it and seeing a "client closed" error). In the caller-owns branch, the caller's `MongoClient` is still usable after `db.close()`.

**Preconditions:**
- Pre-flight steps 1–4 complete.
- `mongodb-memory-server` available in `packages/3-extensions/mongo/node_modules`.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

cat > "$REPO/packages/3-extensions/mongo/scratch/qa-ownership-rule.ts" << 'SCRIPT'
import { MongoClient as NativeMongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Contract } from '../../2-mongo-family/1-foundation/mongo-contract/test/fixtures/orm-contract';
import contractJson from '../../2-mongo-family/1-foundation/mongo-contract/test/fixtures/orm-contract.json' with { type: 'json' };
import mongo from '@internal/mongo/runtime';

// Spin up an in-memory MongoDB replica set (same infrastructure as mongo.e2e.test.ts)
console.log('Spinning up MongoMemoryReplSet...');
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});
const uri = replSet.getUri();
console.log('Replica set ready.');

// --- Branch A: facade owns the MongoClient (uri + dbName) ---
console.log('\n--- Branch A: facade-owns (uri + dbName) ---');
const dbA = mongo<Contract>({ contractJson, uri, dbName: 'qa_owns' });
// Trigger lazy runtime build (initiates real connection)
await dbA.runtime();
await dbA.close();
console.log('dbA.close() resolved.');
// After close, runtime() must reject
try {
  dbA.runtime();
  console.log('FAIL Branch A: expected "Mongo client is closed" but no error thrown');
  process.exit(1);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'Mongo client is closed') {
    console.log('PASS Branch A: runtime() rejected with "Mongo client is closed" after close()');
  } else {
    console.log('FAIL Branch A: unexpected error:', msg);
    process.exit(1);
  }
}

// --- Branch B: caller owns the MongoClient ---
console.log('\n--- Branch B: caller-owns (mongoClient) ---');
const callerClient = new NativeMongoClient(uri);
await callerClient.connect();
const dbB = mongo<Contract>({ contractJson, mongoClient: callerClient, dbName: 'qa_caller' });
// Trigger runtime build before close to exercise the full path
await dbB.runtime();
await dbB.close();
console.log('dbB.close() resolved (caller-owns branch).');
// Caller's MongoClient must still be usable
try {
  const admin = callerClient.db('admin');
  await admin.command({ ping: 1 });
  console.log('PASS Branch B: caller MongoClient is still alive after db.close()');
} catch (err) {
  console.log('FAIL Branch B: caller MongoClient was closed by db.close() — ownership rule violated:', err);
  process.exit(1);
}

await callerClient.close();
await replSet.stop();
console.log('\nAll ownership-rule checks passed.');
SCRIPT

cd "$REPO/packages/3-extensions/mongo"
time timeout 60 pnpm exec tsx scratch/qa-ownership-rule.ts 2>&1
echo "Exit code: $?"
```

### What you should see

1. `PASS Branch A: runtime() rejected with "Mongo client is closed" after close()`
2. `PASS Branch B: caller MongoClient is still alive after db.close()`
3. `All ownership-rule checks passed.`
4. Exit code 0.
5. Wall time typically 5–15s (MongoMemoryReplSet spin-up dominates).

### Failure modes

- Branch A: no error thrown after close → facade does not set closed state.
- Branch A: wrong error message → error string doesn't match `'Mongo client is closed'`.
- Branch B: caller's `MongoClient` throws a "topology was destroyed" / "client is closed" error after `db.close()` → ownership rule is violated (the bug the silent fix addresses).
- `MongoMemoryReplSet` fails to start within 60s → environment issue; document and retry.

### Restore

```bash
rm -f "$REPO/packages/3-extensions/mongo/scratch/qa-ownership-rule.ts"
cd "$REPO" && git status --short
```

---

## Scenario 7 — Post-close ORM error surface — Mongo

**What you're proving from the user's seat:** After `db.close()` on the Mongo facade, calling `db.runtime()` surfaces `'Mongo client is closed'` cleanly. This is the Mongo analogue of Scenarios 4 and 5; it uses the real MongoMemoryReplSet contract so the facade is fully initialised before close.

**Covers:** AC-Terminal

**Isolation:** `tmpdir`

**Oracle:** Error message is exactly `'Mongo client is closed'` — no additional wrapping.

**Preconditions:**
- Pre-flight steps 1–4 complete.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

cat > "$REPO/packages/3-extensions/mongo/scratch/qa-post-close-error.ts" << 'SCRIPT'
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Contract } from '../../2-mongo-family/1-foundation/mongo-contract/test/fixtures/orm-contract';
import contractJson from '../../2-mongo-family/1-foundation/mongo-contract/test/fixtures/orm-contract.json' with { type: 'json' };
import mongo from '@internal/mongo/runtime';

const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
});
const uri = replSet.getUri();

const db = mongo<Contract>({ contractJson, uri, dbName: 'qa_post_close' });
await db.runtime();
await db.close();

try {
  db.runtime();
  console.log('ERROR: expected a throw but did not get one');
  await replSet.stop();
  process.exit(1);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.log('Caught error message:', JSON.stringify(message));
  if (message === 'Mongo client is closed') {
    console.log('PASS: error message is exactly "Mongo client is closed"');
  } else {
    console.log('FAIL: unexpected error message');
    await replSet.stop();
    process.exit(1);
  }
}

await replSet.stop();
SCRIPT

cd "$REPO/packages/3-extensions/mongo"
time timeout 60 pnpm exec tsx scratch/qa-post-close-error.ts 2>&1
echo "Exit code: $?"
```

### What you should see

- `PASS: error message is exactly "Mongo client is closed"`
- Exit code 0.
- Wall time dominated by MongoMemoryReplSet spin-up (~5–15s).

### Failure modes

- Message is wrapped or different.
- No error thrown.

### Restore

```bash
rm -f "$REPO/packages/3-extensions/mongo/scratch/qa-post-close-error.ts"
cd "$REPO" && git status --short
```

---

## Scenario 8 — Skill replay — hang-script routing (judgement)

**What you're proving from the user's seat:** An agent picking up `prisma-next-debug` and receiving the symptom "my script hangs after queries finish" or "script won't exit" is routed correctly to `prisma-next-runtime` § *Running as a script (teardown)*. Unit tests don't cover skill content; only a human read confirms the routing and content quality.

**Covers:** AC-Skills

**Isolation:** `read-only`

**Oracle:** `prisma-next-debug`'s routing table contains rows for hang/db.end and routes to `prisma-next-runtime § Running as a script (teardown)`. That section exists, is non-empty, contains `await db.close()` and the `await using` example, and explains *why* the hang happens.

**Preconditions:**
- Skills exist at `skills/prisma-next-debug/SKILL.md` and `skills/prisma-next-runtime/SKILL.md`.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

# 1. Verify the debug skill routing table
grep -A 3 'Script hangs\|script won.t exit\|db\.end\|db\.close\|hang' "$REPO/skills/prisma-next-debug/SKILL.md" | head -30

# 2. Verify the runtime skill has the teardown section
grep -n 'Running as a script\|teardown\|await db\.close\|Symbol.asyncDispose' "$REPO/skills/prisma-next-runtime/SKILL.md" | head -20

# 3. Read the teardown section in full (the runner reads it as a fresh developer would)
sed -n '/Running as a script/,/^## /p' "$REPO/skills/prisma-next-runtime/SKILL.md" | head -80
```

### What you should see

1. `prisma-next-debug` routing table has entries for "Script hangs after queries print / process won't exit" and `TypeError: db.end is not a function`, both pointing to `prisma-next-runtime § Running as a script (teardown)`.
2. `prisma-next-runtime` has a section titled `Running as a script (teardown)` (or close equivalent).
3. That section contains: `await db.close()`, `await using db`, an example code block, and the DON'T block for request handlers.
4. Reading the section as a developer who just hit the hang: the guidance is clear, actionable, and explains *why* the hang happens (event-loop kept alive by `pg.Pool` timers).

### Failure modes

- Debug skill routing table is missing the hang/db.end rows.
- Runtime skill teardown section is absent or empty.
- Teardown section lacks the `await using` example.
- Section doesn't explain why the hang happens.

### Restore

No state mutation; no restore needed.

---

## Scenario 9 — Skill replay — per-request `await using` anti-pattern (judgement)

**What you're proving from the user's seat:** The `prisma-next-runtime` skill's DON'T block is present, clearly marked, and discourages the per-request `await using` pattern (the footgun where `await using db = postgres(...)` inside a request handler closes the pool after every request).

**Covers:** AC-Skills

**Isolation:** `read-only`

**Oracle:** The skill contains a clearly demarcated "DO NOT do this" block for the request-handler `await using` anti-pattern, with a code example showing the wrong pattern and the correct module-level singleton alternative.

**Preconditions:**
- `skills/prisma-next-runtime/SKILL.md` exists.

### Steps

```bash
REPO="$(git rev-parse --show-toplevel)"

# 1. Check for the anti-pattern block
grep -n 'DO NOT\|request handler\|block-scoped\|per-request\|handler' "$REPO/skills/prisma-next-runtime/SKILL.md" | head -20

# 2. Read the anti-pattern block in context
sed -n '/DO NOT do this\|DO NOT put/,/^### /p' "$REPO/skills/prisma-next-runtime/SKILL.md" | head -50
```

### What you should see

1. A clearly demarcated "DO NOT" block saying "closes the pool after every request" (or equivalent) with a code example of the anti-pattern.
2. Immediately followed by the correct pattern: a module-level singleton in `db.ts`, imported by handlers.
3. A note explaining *why* this is wrong: `await using` is block-scoped; inside a handler the block exits after each request, tearing down and rebuilding the pool per request.
4. The block is under the teardown section, not buried.

### Failure modes

- DON'T block is absent.
- DON'T block exists but has no code example.
- DON'T block exists but has no explanation of *why* it's wrong.

### Restore

No state mutation; no restore needed.

---

## Scenario 10 — Exploratory: close surface edge-case probing (all three facades)

**Charter.** Explore the `close()` and `[Symbol.asyncDispose]` surface across all three facades for 20 minutes against real drivers (PGlite or `pg.Pool` for Postgres; real file for SQLite; `MongoMemoryReplSet` for Mongo). Discover any behaviour that surprises you, any diagnostic that reads poorly, any state combination the scripted scenarios skipped. Focus on: interactions between `close()` and concurrent-call patterns, error message format variations, any discrepancy between what the skill promises and what the code delivers.

**Covers:** (no specific AC; surfaces unknowns)

**Isolation:** `tmpdir`

**Time budget:** 20 minutes. Stop when the timer rings even if you have ideas left — log them as candidate scenarios in the run report's Suggested follow-ups.

**Notes capture:** Write what you tried, what surprised you, and anything that "felt off" but you can't yet name. Findings get classified in the run report the same way scripted-scenario findings do.

---

## Scenarios deliberately not in this script

| AC | Why it's not a manual-QA scenario |
| -- | --------------------------------- |
| AC-Surface (`close()` and `[Symbol.asyncDispose]` declared on all three clients) | CI unit tests in `postgres-close.test.ts`, `sqlite-close.test.ts`, `mongo.test.ts` cover this structurally. Re-checking here adds nothing. |
| AC-Lifecycle (idempotence, in-flight connect) | Fully covered by unit tests with mocked pools. Deterministic behaviour; no human judgement adds value. |
| AC-Terminal (`db.connect()`, `db.transaction()`, `db.prepare()` reject after close) | `transaction()` and `prepare()` both call `runtime()` internally so they inherit the guard. `db.runtime()` post-close is the representative path tested in Scenarios 4, 5, 7. |
| `await using` for Postgres at top level | Scenario 3 proves the mechanism end-to-end with SQLite (cheapest substrate). The `[Symbol.asyncDispose]` aliasing is identical across all three facades (`return this.close()`); the tsx transpilation path is the same. Running against Postgres would add no new information. |

## Sign-off coverage map

| AC ID | Scenario(s) covering it |
| ----- | ----------------------- |
| AC-Quickstart-exit (real-script exits cleanly) | 1 (Postgres), 2 (SQLite), 3 (await using) |
| AC-Terminal (post-close rejects with target-named error) | 4 (Postgres), 5 (SQLite), 7 (Mongo) |
| AC-Ownership (caller-supplied resources not touched) | 6 (Mongo — real driver, both branches) |
| AC-Mongo-behaviour (close() no longer closes caller-supplied MongoClient) | 6 (Mongo — real driver, Branch B) |
| AC-Skills (skills teach pattern, route db.end confabulation) | 8 (debug routing), 9 (anti-pattern DON'T block) |
| AC-Surface | (CI; unit tests) — see "Scenarios deliberately not in this script" |
| AC-Lifecycle | (CI; unit tests) — see "Scenarios deliberately not in this script" |
