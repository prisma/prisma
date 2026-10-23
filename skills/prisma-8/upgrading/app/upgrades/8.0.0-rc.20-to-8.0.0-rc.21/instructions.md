---
from: "8.0.0-rc.20"
to: "8.0.0-rc.21"
changes:
  - id: mongo-contract-target-option
    summary: |
      `mongoContract(schemaPath, options)` now requires `options.target`, the MongoDB target pack, which the contract records. Pass `{ target: mongoTargetPack }` with `mongoTargetPack` imported from `@prisma/orm-mongo/target/pack`, alongside any options you already pass. A config written with `defineConfig` from `@prisma/orm-mongo/config` needs no change.
    detection:
      glob: "**/*.{ts,mts,cts,js,mjs}"
      matches:
        - '(?<![\w$.])mongoContract\(\s*[^,()]*(?:\([^()]*\)[^,()]*)*,?\s*\)'
        - '(?<![\w$.])mongoContract\(\s*[^,()]*(?:\([^()]*\)[^,()]*)*,\s*\{(?![^{}]*\btarget\b)[^{}]*\}\s*\)'
  - id: mongo-contract-input
    summary: |
      The MongoDB type for the object you pass to `defineContract`, `ContractDefinition`, is renamed `ContractInput`. It is the same type under SQL's name for it. `ContractDefinition` now names the plain-data definition every MongoDB contract source builds from, which takes no type parameters, so the detection flags an import from `@prisma/orm-family-mongo/contract-ts` only where the file writes `ContractDefinition<...>`. Import `ContractInput` from `@prisma/orm-mongo/contract-builder` where you imported `ContractDefinition`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '(?:import|export)\s+(?:type\s+)?\{[^}]*\bContractDefinition\b[^}]*\}\s*from\s*[\x27"]@prisma/orm-mongo/contract-builder[\x27"]'
        - '(?:import|export)\s+(?:type\s+)?\{[^}]*\bContractDefinition\b[^}]*\}\s*from\s*[\x27"]@prisma/orm-family-mongo/contract-ts(?:/contract-builder)?[\x27"][\s\S]*\bContractDefinition<'
  - id: mongo-model-definition-removed
    summary: |
      `MongoModelDefinition` is removed. It was another name for `ContractModel<MongoModelStorage>`. Write `ContractModel<MongoModelStorage>` instead, with `ContractModel` from `@prisma/orm-mongo/contract/types` and `MongoModelStorage` from `@prisma/orm-mongo/family-contract`.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '(?<![\w$])MongoModelDefinition(?![\w$])'
  - id: mongo-ts-polymorphism-rules
    summary: |
      `defineContract` now applies the MongoDB polymorphism rules that PSL applied. It refuses a discriminator that is optional, a list or not text, such as an `Int32` field (`CONTRACT.ARGUMENT_INVALID`); a variant value the discriminator field cannot hold or that is not a member of its enum; a variant listed in `discriminator.variants` that no model declares with that base; a variant stored in another collection than its base (`CONTRACT.COLLECTION_INVALID`); and, in TypeScript and PSL, a variant field stored under a name a field of its base is stored under, such as the discriminator (`CONTRACT.NAME_DUPLICATE`, `PSL_DUPLICATE_STORED_NAME`), which would overwrite that field; and, in TypeScript and PSL, a variant field that restates a base field with a different stored name, type, nullability or list shape (`CONTRACT.ARGUMENT_INVALID`, `PSL_VARIANT_FIELD_DIFFERS_FROM_BASE`), whose documents the collection's validator, written from the base, would refuse. Make the discriminator a required `field.string()` or a string enum, list only declared variants, leave a variant's `collection` out or set it to its base's, give each variant field a stored name its base does not use, and restate a base field on a variant exactly as the base declares it, or not at all.
    detection:
      glob: "**/*.{ts,mts,cts,tsx}"
      matches:
        - '@prisma/orm-(?:mongo|family-mongo/contract-ts)/contract-builder[\x27"][\s\S]*\bdiscriminator\s*:\s*\{'
  - id: mongo-index-shape-rules
    summary: |
      Every MongoDB contract source now refuses an index MongoDB would refuse (`CONTRACT.INDEX_INVALID` in TypeScript, `PSL_INVALID_INDEX` in PSL): a unique wildcard index, a wildcard with a hashed, 2d or 2dsphere key, a hashed index on several fields, a TTL wildcard index, a wildcard projection without a wildcard key, a collation without a locale, and a second text index in one collection. PSL also refuses an index that another model on the same collection, or the same model, already declares, such as `@unique` and `@@unique` on one field. Remove the index or change it to a shape MongoDB accepts; remove a duplicate.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,prisma}"
      matches:
        - '@prisma/orm-(?:mongo|family-mongo/contract-ts)/contract-builder[\x27"][\s\S]*(?:\$\*\*|\bwildcardProjection\b|[\x27"]hashed[\x27"]|\bcollation\s*:)'
        - '\bwildcard\('
  - id: mongo-value-object-enum-check
    summary: |
      `defineContract` now refuses a value object field typed by an enum the contract does not declare (`CONTRACT.ENUM_UNKNOWN`), as it already did for a model field. Add the enum to `defineContract({ enums })`.
  - id: mongo-newly-accepted
    summary: |
      No action is needed. An optional field that a preset, a type alias, `@onCreate(...)`/`@onUpdate(...)` or `.onCreate(...)`/`.onUpdate(...)` fills is now accepted, as on SQL; a list that generates a value is still refused. A TypeScript variant may leave its `collection` out and is stored in its base's. The PSL preset-without-effect warning is no longer reported next to `@onCreate(...)` or `@onUpdate(...)`, which do fill the field, and is now reported even when the schema is refused. `defineContract` now reports the same case as the warning `PN_PRESET_WITHOUT_EFFECT`.
  - id: mongo-prisma6-merged-indexes
    summary: |
      A Prisma 6 schema read by `prisma6Schema()` in which one collection holds two identical indexes, such as `@unique` and `@@unique` on one field, or the same `@@index` on two models stored in one collection, now gives one index, as the database holds one. That contract's storage hash changes. Run `prisma contract emit`, then `prisma db sign` to record the new hash; the database itself needs no change.
  - id: removed-enum-value-questions
    summary: |
      On Postgres and SQLite, when the contract removes a member of an enum, or changes the value a member stores, `migration plan` and `db update` now rewrite the rows that hold the old stored value, and ask about it first. Before, Postgres failed at apply on the new check when a row held the old value, and SQLite planned nothing. If the member was renamed, say so with `--rename Status.ARCHIVED:Status.RETIRED`, which changes the stored value in every row and list that holds it. Answer with `--delete Status.ARCHIVED` to set it to NULL in optional columns and take it out of lists.
  - id: client-members-reject-instead-of-throwing
    summary: |
      A client member that returns a promise or a result no longer throws at the call when the client or the transaction is in a failed state. On `postgres()`, `sqlite()`, a `supabase()` role-bound client and a transaction, `query`, `execute`, `prepare`, `transaction`, ORM calls and a prepared statement's `query(target, params)` and `execute(target, params)` now report a closed client, a failed connection or an ended transaction through what they return: the promise rejects, and a result rejects when it is awaited or read. Error codes and messages do not change. Code that wraps such a call in `try`/`catch` without awaiting it no longer catches the error; add `await`, or handle it with `.catch(...)`. `db.runtime()` still throws at the call, and so does a mistake in the call itself, such as an ORM query the database's capabilities do not allow. The detection matches a file that imports an `@prisma/orm-*` package and has a `try` block, one line or many, nested or not, that calls one of these members or an ORM terminal (`all`, `first`, `create`, `update`, `delete`, `upsert`, …) without `await` directly before it, on a receiver shaped like a client: a name ending in `db`, `tx`, a name ending in `client`, `admin`, a prepared statement, or a chain through `.orm`; chains may span lines and take callbacks; leave a call whose result is awaited or returned to an awaiting caller as it is.
    detection:
      glob: "**/*.{ts,mts,cts,tsx,js,mjs,cjs}"
      matches:
        - '(?<![\s\S])(?=[\s\S]*[\x27\x22]@prisma/orm-)[\s\S]*\btry\s*\{(?:(?!\}\s*(?:catch|finally)\b)[\s\S])*?(?<![\w$.])(?<!\bawait\s+)(?:this\s*\.\s*)?(?:[\w$]*(?:db|Db|DB)|tx|trx|[\w$]*[Cc]lient|admin|[\w$]*[Pp]repared[\w$]*|[\w$]+\s*\.\s*orm)(?:\s*\.\s*[\w$]+(?:\s*\((?:[^()]|\([^()]*\))*\))?)*?\s*\.\s*(?:query|execute|prepare|transaction|all|first|firstOrThrow|create|createAll|createAndCount|update|updateAll|updateAndCount|delete|deleteAll|deleteAndCount|upsert|aggregate)\s*\('
  - id: close-ends-the-client-not-your-pool
    summary: |
      `close()` on a Postgres or Supabase client built on a pool or `pg.Client` you passed in now also closes its runtime, so a runtime you captured with `db.runtime()` before `close()` refuses new work. Your pool or `pg.Client` stays open, as before; end it yourself.
    detection:
      glob: "**/*.{ts,tsx,mts,cts}"
      matches:
        - '(?:postgres|supabase)\(\s*\{[\s\S]*?\b(?:pg|binding|pool|client)\s*[:,}]'
  - id: sqlite-open-failure-is-a-connection-error
    summary: |
      A SQLite database file that cannot be opened (a missing directory, or a file that is not a database) is now a connection error (`SqlConnectionError`), not a query error (`SqlQueryError`), in the driver. Code that caught the query error to handle a bad database path catches the connection error instead.
  - id: verify-contract-spaces-marker-location
    summary: |
      `verifyContractSpaces` (from the `spaces` subpath of the migration tools) takes a required `markerLocation`, the name of the target's marker table or collection, which the remediation of an orphan marker names.
    detection:
      glob: "**/*.{ts,tsx,mts,cts,js,mjs,cjs}"
      matches:
        - '(?<![\w$])verifyContractSpaces\s*\('
  - id: contract-artifacts-restamp
    summary: |
      An extension that writes its own package version into the contracts it emits, such as the Supabase extension, now writes 8.0.0-rc.21. Run `contract emit` once after upgrading so the emitted `contract.json` and `contract.d.ts` match the installed extension.
    detection:
      glob: "**/contract.json"
      contains:
        - '"version": "8.0.0-rc.20"'
---

# 8.0.0-rc.20 → 8.0.0-rc.21 — User upgrade instructions

## Order of the steps

Do the steps in this order, and skip a step that does not apply to the project:

1. Upgrade the Prisma packages.
2. Change a MongoDB contract source as the MongoDB entries below say: pass the target pack to `mongoContract` (`mongo-contract-target-option`), rename the contract types (`mongo-contract-input`, `mongo-model-definition-removed`), and fix any discriminator, index or enum the contract now refuses (`mongo-ts-polymorphism-rules`, `mongo-index-shape-rules`, `mongo-value-object-enum-check`).
3. Run `prisma contract emit` (this also covers `contract-artifacts-restamp`).
4. Run `prisma db sign` against every database when the project reads a Prisma 6 MongoDB schema whose storage hash changed (`mongo-prisma6-merged-indexes`).
5. On Postgres and SQLite, answer the question about a removed enum value the next time you run `migration plan` or `db update` (`removed-enum-value-questions`).
6. Change the application code: await client calls inside `try` blocks (`client-members-reject-instead-of-throwing`), stop using a runtime captured before `close()` (`close-ends-the-client-not-your-pool`), catch the connection error for a bad SQLite path (`sqlite-open-failure-is-a-connection-error`), and pass `markerLocation` to `verifyContractSpaces` (`verify-contract-spaces-marker-location`).

## `mongoContract` takes the target pack

The MongoDB PSL contract source now builds its contract through the same builder `defineContract` uses, and that builder records the stack's target and extension packs. The source reads them from its options.

### `mongo-contract-target-option`

Pass the MongoDB target pack as `target`:

```typescript
import { mongoContract } from '@prisma/orm-family-mongo/contract-psl/provider';
import mongoTargetPack from '@prisma/orm-mongo/target/pack';

const contract = mongoContract('./prisma/schema.prisma', { target: mongoTargetPack });
```

Keep any other options you pass, such as `output`, in the same object. A config that names its contract through `defineConfig({ contract: './prisma/schema.prisma' })` from `@prisma/orm-mongo/config` already passes the pack. An app that calls `mongoContract` itself imports it from `@prisma/orm-family-mongo/contract-psl/provider`, so it depends on `@prisma/orm-family-mongo` as well as `@prisma/orm-mongo`; `@prisma/orm-mongo` does not export `mongoContract`. A call without `target` is refused with `CONTRACT.ARGUMENT_INVALID` (`reason: 'target-pack-missing'`).

## MongoDB contract types take SQL's names

Two MongoDB type names change so that they match SQL's. The types themselves do not change.

### `mongo-contract-input`

The type of the object you pass to `defineContract` is now `ContractInput`, as it is in SQL. Rename the import and each use:

```typescript
import type { ContractInput } from '@prisma/orm-mongo/contract-builder';
```

### `mongo-model-definition-removed`

`MongoModelDefinition` was an alias for a model of a built contract. SQL has no such alias. Write the type it stood for:

```typescript
import type { ContractModel } from '@prisma/orm-mongo/contract/types';
import type { MongoModelStorage } from '@prisma/orm-mongo/family-contract';

function collectionOf(model: ContractModel<MongoModelStorage>): string | undefined {
  return model.storage.collection;
}
```

## MongoDB contract sources share one builder

Every MongoDB contract source, `defineContract`, Prisma 8 PSL and the Prisma 6 reader, now builds through one builder, so each MongoDB rule applies to every source in the same way. The entries below are where a source now refuses or accepts what it did not before. A contract that every source accepted before builds to the same `contract.json`.

### `mongo-ts-polymorphism-rules`

The detection matches a file that imports the MongoDB contract builder and declares a discriminator; an emitted `contract.d.ts` imports no builder, so it is not matched.

A discriminator must be a required text field, and each variant must be declared and stored in its base's collection:

```typescript
const Task = model('Task', {
  collection: 'tasks',
  fields: { _id: field.objectId(), type: field.string() },
  discriminator: { field: 'type', variants: { Bug: { value: 'bug' } } },
});
const Bug = model('Bug', { base: Task, fields: { severity: field.int32() } });
```

### `mongo-index-shape-rules`

MongoDB refuses these indexes when it creates them, so the contract now refuses them first. A matched file uses a wildcard, a hashed key, a wildcard projection or a collation; check each such index against the list in the summary.

### `mongo-value-object-enum-check`

Declare every enum a value object field uses in `defineContract({ enums })`.

### `mongo-newly-accepted`

Nothing to change.

### `mongo-prisma6-merged-indexes`

Emit the contract again and sign the database, so `db verify` compares against the new storage hash.

## A removed enum value is asked about

### `removed-enum-value-questions`

If your contract removes a member of an enum, for example `ARCHIVED` from `Status`, the next `migration plan` or `db update` asks about it, as it asks about a model or field you remove: once, however many columns hold it.

If you renamed the member, give the rename, and the rows that held the old stored value hold the new one:

```bash
prisma db update --rename Status.ARCHIVED:Status.RETIRED
```

Otherwise the value is removed. A script that runs without a terminal fails with `CLI.CONSENT_REQUIRED`, naming the value. To let it go, add `--delete Status.ARCHIVED`: optional columns that hold it are set to NULL, and lists lose it. A required column cannot take NULL, so while rows of a required column hold the value, the apply fails with `MIGRATION.PRECHECK_FAILED`, changes nothing, counts the rows, and says how to keep them: rename the value to a new member, or keep that data by hand.

A member renamed with its stored value kept, for example with `RETIRED = "archived"`, changes nothing in the rows, and is not asked about. A member that keeps its name but stores a new value is asked about with `--delete` only, and so are two members that swap stored values; to keep the rows, the question names, for every column the enum types, the `this.removeStoredValue(...)` call to replace with `this.replaceStoredValue(...)` calls in the `migration.ts` that `migration plan` writes, and the `node` command that runs it. A swap goes through a temporary value. `db update` cannot keep that data in one run: its question says to plan the change with `migration plan --from <hash>`, or to rename the member to a new member and back in two runs of `db update`. For a swap only the plan works, and without migrations `db update` says it cannot keep the data.

Renames that shift stored values along, such as `Higher = 3` to `A = 4` while `Max = 4` becomes `B = 5`, are planned in one run, the last value first. Renames that move stored values in a cycle are refused; the refusal prints the `migration plan` command to write those rewrites by hand in, through a value no member stores.

Native Postgres enums (`pg.enum(...)`) are unchanged.

## A client reports failures through what its members return

### `client-members-reject-instead-of-throwing`

```ts
await db.close();

// Before: throws at the call, so .catch never runs
db.query(plan).toArray().catch(handle);

// After: the result rejects, so handle runs
db.query(plan).toArray().catch(handle);

// A synchronous try/catch around an unawaited call stops catching
try {
  db.transaction(work);
} catch (error) {
  handle(error);
}

// Await it instead
try {
  await db.transaction(work);
} catch (error) {
  handle(error);
}
```

## Postgres and SQLite errors are classified by code

### `close-ends-the-client-not-your-pool`

When you pass your own `pg.Pool` or `pg.Client` to `postgres()` or `supabase()`, `close()` on the Prisma client now also closes its runtime. Calls on `db` already failed after `close()`; what changes is a runtime you captured with `db.runtime()` before `close()`, which used to keep working and now refuses new work. Your pool or client is still yours: Prisma never ends it. If you used a captured runtime after `close()`, create a new Prisma client on the same pool instead:

```ts
await db.close();
const db2 = postgres({ contract, pg: pool });
```

A `pg.Client` you pass in may be connected or not: Prisma connects it if it has not started connecting. If its connection is lost, create a new `pg.Client`; a pg client cannot reconnect.

### `sqlite-open-failure-is-a-connection-error`

When the SQLite database file cannot be opened, the driver now raises a connection error (`SqlConnectionError`) instead of a query error (`SqlQueryError`).

## `verifyContractSpaces` names the marker location

### `verify-contract-spaces-marker-location`

A project that checks its contract spaces itself passes the marker location of its target to `verifyContractSpaces`, so the advice for an orphan marker names the right table:

```ts
// Before
verifyContractSpaces({ loadedSpaces, spaceDirsOnDisk, headRefsBySpace, markerRowsBySpace });

// After
verifyContractSpaces({
  loadedSpaces,
  spaceDirsOnDisk,
  headRefsBySpace,
  markerRowsBySpace,
  markerLocation: 'prisma_contract.marker',
});
```

The marker location is `prisma_contract.marker` on Postgres, `_prisma_marker` on SQLite and MySQL, and `_prisma_migrations` on MongoDB.

## `contract-artifacts-restamp`

For every `contract.json` matched by `detection`, run the project's emit command (`prisma contract emit`, or the project's `contract:emit` script) once after upgrading. This entry accounts for the extension's embedded `version` moving to `8.0.0-rc.21`; any other difference in the emitted files comes from an earlier entry in this guide.
