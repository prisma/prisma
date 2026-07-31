# ADR 196 — In-process emit for class-flow targets

## At a glance

A Mongo migration file on disk looks like this:

```ts
import { Migration } from '@internal/family-mongo/migration';
import { createIndex } from '@internal/target-mongo/migration';

class BackfillStatus extends Migration {
  override plan() {
    return [createIndex('users', [{ field: 'email', direction: 1 }], { unique: true })];
  }
  override describe() {
    return { from: 'v1', to: 'v2' };
  }
}
export default BackfillStatus;
Migration.run(import.meta.url, BackfillStatus);
```

There are two ways this file's authored intent ends up on disk as `ops.json` + an attested `migration.json`:

1. **Direct execution (canonical).** The developer runs `./migration.ts` (shebang) or `node migration.ts`. `Migration.run(...)` detects it is the main module, instantiates the class, calls `plan()`, computes the content-addressed `migrationId`, and writes `ops.json` + a fully attested `migration.json` — no draft, no later "verify" step required.

2. **CLI import (transitional).** `migration plan` and the descriptor-flow bridge (`migration emit`) load `migration.ts` via `await import(pathToFileURL(filePath).href)` and dispatch on the default export's shape: if it is a `Migration` subclass, instantiate it and call `plan()`; if it is a factory function, call it, validate the result has a `plan()` method, then call `plan()`. In both cases the resulting operations are written to `ops.json` and the package is attested via `attestMigration(dir)`. `Migration.run(...)` is still in the file, but the entrypoint guard doesn't fire because the file isn't the main module.

Both paths produce **byte-identical** `ops.json` and an attested `migration.json` carrying the same `migrationId`. They are two ways of driving the same self-contained authoring surface.

## Decision

`Migration.run(...)` is the **canonical self-emitting path** for class-flow migration files. When invoked as the main module, it produces the complete on-disk artifact set deterministically:

- `ops.json` — serialized `instance.operations`
- `migration.json` — manifest with content-addressed `migrationId` computed in-process via `computeMigrationId(manifest, ops)` ([ADR 192](ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md), [ADR 199](ADR%20199%20-%20Storage-only%20migration%20identity.md))

A `migration.ts` run via shebang yields the same artifacts the CLI would produce. There is no draft state, no `migrationId: null` left for someone else to fill in, and no two-step "emit then verify" handshake. The file is a self-contained authoring surface; running it produces the contract ([ADR 192](ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md)).

When a `migration.json` is already present in the directory (the common case after `migration plan` scaffolding), `Migration.run` preserves the contract bookends, hints, labels, and `createdAt` set there — those fields are owned by the CLI scaffolder, not the authored class. The author's `describe()` and `operations` drive what may legitimately change between runs; everything else is read back from disk and re-attested.

The CLI's `migration plan` and `migration emit` commands implement the same emit contract via dynamic import. Two authoring shapes are accepted — a `Migration` subclass (canonical) or a factory function returning an object with a `plan()` method:

```ts
const fileUrl = pathToFileURL(filePath).href;
const mod = (await import(fileUrl)) as { default?: unknown };

const MigrationExport = mod.default;

// Shape 1: class subclass
//   export default class M extends Migration { override plan() { ... } }
// Shape 2: factory function returning { plan() }
//   export default () => ({ plan() { return [...] } })

let migration: { plan(): unknown };
if (MigrationExport.prototype instanceof Migration) {
  migration = new (MigrationExport as new () => Migration)();
} else {
  const factoryResult = await (MigrationExport as () => unknown)();
  // validate factoryResult has plan()...
  migration = factoryResult as { plan(): unknown };
}
const operations = migration.plan();

const migrationId = computeMigrationId(manifest, operations);
await writeMigrationPackage(dir, { ...manifest, migrationId }, operations);
```

Both shapes funnel through `plan()` — the class path instantiates and calls `plan()`, the factory path calls the function, validates the result has `plan()`, then calls it. The guards in this pipeline throw structured errors: `PN-MIG-2002` if `migration.ts` is missing, `PN-MIG-2003` if the default export is not a valid migration shape, and `PN-MIG-2004` if `plan()` returns a non-array (see [ADR 027](ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md)).

This is transitional infrastructure: it bridges the CLI to the descriptor flow (where evaluating `migration.ts` produces a descriptor list rather than a self-emitting class) and gives `migration plan` a single in-process dispatch path it can use against either flow. Once the descriptor flow is removed, `migration emit` disappears entirely ([ADR 193](ADR%20193%20-%20Class-flow%20as%20the%20canonical%20migration%20authoring%20strategy.md)) and shebang execution becomes the only emit path that matters for class-flow targets.

### The `Migration.run(...)` guard

Every class-flow migration file ends with:

```ts
Migration.run(import.meta.url, BackfillStatus);
```

`Migration.run` compares `import.meta.url` against `process.argv[1]` (via `realpathSync` on both). When the file is run directly, they match — the guard fires and writes attested artifacts. When the CLI imports the file, they don't match — the guard is a no-op, and the CLI drives emit via the dynamic-import path above. The same file is safe for both modes without any conditional logic at the call site.

### Dispatch: `emit` on `TargetMigrationsCapability`

The framework's `emitMigration` helper doesn't know whether a target uses descriptor flow or class flow. It dispatches on the capability surface:

- **Descriptor flow** (e.g. Postgres, transitional): `resolveDescriptors` is present. The framework evaluates `migration.ts` to obtain operation descriptors, passes them to the target's resolver, writes `ops.json`, and attests.
- **Class flow** (e.g. Mongo, canonical): `emit` is present. The target owns the load → instantiate → serialize pipeline; the framework attests after.

The two are mutually exclusive in practice — a target implements one or the other. If a target registers a migrations capability but provides neither method, the dispatch throws `PN-MIG-2011` (see [ADR 027](ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md)). The capability dispatch and the CLI's class-flow `emit` path both exist to support the descriptor-flow bridge during the migration to class-flow as canonical ([ADR 193](ADR%20193%20-%20Class-flow%20as%20the%20canonical%20migration%20authoring%20strategy.md)).

## Why not subprocess

The straightforward alternative is to fork a child process, run `node migration.ts`, and capture the output. We chose in-process import because:

**Structured errors propagate as real exceptions.** A migration with unfilled placeholders throws `errorUnfilledPlaceholder` with error code `PN-MIG-2001`. In-process, that exception reaches the CLI's error envelope directly — full error code, structured metadata, stack trace. In a subprocess, the error would have to be serialized to stderr (JSON envelope or plain text), re-parsed by the parent, and reconstructed into a structured error. Any error that doesn't follow the serialization protocol is lost or degraded to a generic "subprocess failed" message.

**No exit-code translation.** The CLI's error codes are string discriminants (`PN-MIG-2001`, `PN-MIG-1003`). A subprocess collapses them to a numeric exit code. The parent would need a mapping table or a side-channel to recover the original code.

**No fork overhead.** Each emit would pay the cost of spawning a Node process, loading the TypeScript toolchain, and importing the migration's dependencies — on every `migration plan` and `migration emit` invocation. In-process, the module is loaded once into the existing process.

**Testability.** In-process emit is a function call. Tests can mock the file system, assert on the returned operations, and catch structured errors directly. Subprocess emit requires test infrastructure for spawning child processes, capturing stdout/stderr, and parsing the output format.

## Consequences

### `migration plan` always runs emit inline

`migration plan` scaffolds `migration.ts` and immediately emits `ops.json` in the same process. There is no separate "emit later" step and no `needsDataMigration` flag gating whether emit runs. If the scaffolded file contains unfilled placeholders, `placeholder(slot)` throws at evaluation time — the developer sees the error immediately, not on a later command.

### Shebang execution and CLI emit produce identical artifacts

Because both paths share the same `computeMigrationId` and write the same on-disk shape, an author who edits `migration.ts` and runs `./migration.ts` to test a change gets exactly the artifacts a fresh `migration plan` would produce. No "draft" intermediate state exists — `migrationId: null` never reaches disk through either path. This is what makes apply-time verification ([ADR 192](ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md)) trustworthy: re-emitting in-memory and comparing against on-disk `ops.json` is meaningful precisely because both paths converge on the same bytes.

### `migration emit` is a vestigial command

`migration emit` exists today to give the descriptor flow a CLI-driven emit step. In the canonical class-flow world, the author runs `./migration.ts` directly (or relies on `migration plan`'s inline emit), and there is no separate emit phase. `migration emit` disappears once descriptor flow is removed ([ADR 193](ADR%20193%20-%20Class-flow%20as%20the%20canonical%20migration%20authoring%20strategy.md)).

## Alternatives considered

### Subprocess execution

Fork `node migration.ts` as a child process, capture `ops.json` from the file system (or stdout), and parse the result. Rejected for the reasons above: structured error loss, exit-code flattening, fork cost, and testing complexity. The only benefit — process isolation — is not needed because `migration.ts` is user-authored code that runs in a development context, not in production at apply time ([ADR 192](ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md)).

### Worker threads

`worker_threads` would give isolation without the full fork cost. But structured errors still can't cross the thread boundary as live exceptions — they'd need `postMessage` serialization, which has the same reconstruction problem as subprocess stderr. And `worker_threads` don't share the module cache, so the TypeScript toolchain loads twice.

### Framework owns the class-flow emit pipeline

Instead of delegating to the target's `emit` capability, the framework could directly import `migration.ts`, instantiate the class, and serialize operations — the same steps Mongo's `emit` does today (and the same steps the CLI's class-flow import path performs in the pseudocode above). We keep the `emit` capability seam open during the descriptor-flow bridge so the framework doesn't have to special-case class-flow vs descriptor-flow targets, even though the seam carries no substantive logic today. Once descriptor flow is removed ([ADR 193](ADR%20193%20-%20Class-flow%20as%20the%20canonical%20migration%20authoring%20strategy.md)), the `emit` capability disappears with it; this is a bridge artifact, not a future-extensibility hook.

## References

- [ADR 192 — ops.json is the migration contract](ADR%20192%20-%20ops.json%20is%20the%20migration%20contract.md)
- [ADR 194 — Plans carry their own authoring surface](ADR%20194%20-%20Plans%20carry%20their%20own%20authoring%20surface.md)
