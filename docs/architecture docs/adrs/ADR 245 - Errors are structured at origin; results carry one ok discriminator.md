# ADR 245 — Errors are structured at origin; results carry one ok discriminator

Status: **Accepted**

Related: [ADR 239 — Errors are structural envelopes with dotted namespace codes](<./ADR 239 - Errors are structural envelopes with dotted namespace codes.md>) defines the envelope itself — the `CliStructuredError` shape, dotted `NAMESPACE.SUBCODE` codes, structural recognition, exit codes, and (as amended) the typed `nextActions` remediation field this ADR's examples use. This ADR governs how envelopes are **constructed and carried**: who creates them, where, and what shape they travel in. Composer records the same rules for its tree as its ADR-0043/ADR-0044; the duplicated foundation types interoperate because recognition is structural.

## The shape of a failure, end to end

The site that detects a failure builds the complete envelope, because it is the only place that knows the context:

```ts
// packages/1-framework/3-tooling/cli — a raise site
if (!snapshot) {
  return notOk(
    errorRuntime('MIGRATION.SNAPSHOT_MISSING', `Ref "${refName}" is not resolvable`, {
      why: `Ref "${refName}" has no pointer file and its fallback hash is not a graph node.`,
      nextActions: [
        {
          kind: 'run-command',
          label: 'Create the ref',
          command: `prisma-next ref set ${refName} <hash>`,
        },
        { kind: 'user-choice', label: 'Or pass a graph-node hash instead of a ref name' },
      ],
      meta: { identifier: refName, viaRef: true },
    }),
  );
}
```

Every consumer — a command adapter, a host driving the control API, an agent parsing `--json` — branches on exactly two fields, for every operation:

```ts
const result = await client.migrationPlan(input);
if (!result.ok) {
  switch (result.failure.code) {
    case 'MIGRATION.SNAPSHOT_MISSING': /* actionable: create the ref */
    case 'CONFIG.DB_CONNECTION_REQUIRED': /* actionable: pass --db */
    default: /* render the envelope; exit 2 */
  }
}
```

Nothing between the two snippets transforms the error. Within a process, the value raised at the origin is the value the consumer holds — class, `meta`, `cause` chain and all. A consumer on the far side of a process boundary (`--json` output, the query-plan executor's HTTP surface) receives the serialized `toEnvelope()` form instead: the same `code`/`summary`/`why`/`nextActions`/`where`/`meta`, without `cause`.

## Decision

**1. Errors are structured at their origin — there are no catch-all codes.** Any failure meant to surface to a user is a `CliStructuredError` (or a subclass) at the site that raises it, carrying its own dotted code, its own `why`, and its own `nextActions`. Wrapping a foreign cause at the site that understands it — a driver error, a config module that threw, an I/O failure the tool can name — is legal, and the wrap attaches the original as `cause`. What is banned is the boundary fallback: no generic construction path supplies a default code, and no code exists whose meaning is "something in this phase failed". The generic factory's signature enforces this — `errorRuntime(code, summary, options)` — the code is the first, required argument.

A non-structured error reaching a process boundary is therefore, by definition, a bug: it exits `1` with a report hint and no code (ADR 239's exit-code rule). This is deliberate. An expected failure someone forgot to name should be loud, not laundered into a polite envelope nobody can act on.

**2. `code` is the error's only machine identity.** Consumers branch on `envelope.code` and nothing else. `meta` carries structural data for the code the envelope already has — never an alternative or "truer" identity. If a site wants consumers to distinguish its failure, it raises a distinct code; the closed registry in `docs/reference/error-reference.md` (enforced by `check:error-reference`) is where that code and its producing site are recorded, in the same change. When an existing code gains a new producing site, its reference entry gains that site and its meta shape too — an entry that describes only some of its sites misleads the consumers the registry exists for.

**3. Results carry one discriminator: `ok`.** Every operation and command returns the shared `Result` type — `{ ok: true, value } | { ok: false, failure }` — instantiated with a `CliStructuredError` failure. (The foundation type itself stays generic in its failure parameter; this rule is about how operations instantiate it, and a signature like `Result<MigrationPlanResult, CliStructuredError>` is the required form.) The success payload's *type* carries whatever is operation-specific; the discriminator never does. Per-operation outcome enums (`outcome: 'deployed' | 'failed' | …`) are banned: they force every caller to learn a second, operation-local vocabulary that restates what `ok` plus the payload type already say. And because the same envelope value is throwable *and* a valid `Result` failure (ADR 239), no boundary needs a conversion type in either direction.

**Error subclasses extend the one base class.** Domain subclasses are part of the contract, not an exception to it: a domain that wants richer construction (for example `MigrationToolsError`, whose constructor requires `why` and a non-empty `nextActions`, and narrows `code` to `` `MIGRATION.${string}` ``) subclasses `CliStructuredError`. The rules for a subclass:

- Structured data goes in `meta` — a subclass does not introduce a parallel field for it.
- The subclass must **not** set `this.name`: ADR 239's structural predicate keys on `name`, and a renamed subclass would stop being recognized as a structured error at boundaries.
- Its own predicate narrows structurally on top of the parent's (`CliStructuredError.is(e) && e.category === 'MIGRATION' && e.code.startsWith('MIGRATION.')`), so it survives duplicated copies and plane splits the same way the parent does.
- It passes through boundaries as itself. There are no mapper functions translating one error class into another; a subclass *is* the envelope.

`cause` rides along for in-process consumers and logs — the constructor forwards it to `Error`, and `toEnvelope()` never serializes it. A wrap under rule 1 therefore preserves the full provenance chain from origin to renderer without leaking internals onto the wire.

## Why

The `code` field is only a branching surface if exactly one code space exists and every surfaced failure is in it. Each rule closes one way that property can decay:

- A default code on a generic path produces envelopes whose code describes the factory, not the failure — consumers matching on it match nothing meaningful.
- A second identity channel (structured data claiming to be the "real" code) splits the space in two, and every consumer must know which channel each producer chose.
- A parallel error class with boundary mappers makes fidelity depend on the mapper: every field the mapper forgets — the cause chain, a meta key added later — is silently dropped at that boundary, and every new boundary needs the mapping re-derived.
- A per-operation discriminator moves failure identity out of the shared shape entirely, so generic tooling (renderers, agents, retry logic) cannot be written once.

Structuring at origin also puts the `why` and the `nextActions` where the knowledge is: the raise site knows what was being attempted and what the user can do about it; a boundary handler only knows that *something* failed. This is sharper for `nextActions` than it ever was for prose, because a next action names an executable command with real arguments in it — the raise site is the only place that holds those arguments.

## Alternatives considered

- **A default code on the generic construction path** — rejected. It guarantees envelopes whose code and content disagree, and it invites raise sites to defer naming their failure, which rule 1 exists to prevent.
- **Carrying a secondary code in structured data** — rejected: two identity channels, and consumers must learn which one each producer uses.
- **Parallel error hierarchies bridged by boundary mappers** — rejected: mappers drop fidelity by omission and multiply with boundaries; a subclass of the one base needs no mapping at all.
- **Per-operation outcome enums** — rejected: a second discriminator vocabulary per operation, duplicating what `ok` and the success payload type state, and opaque to shared tooling.
- **A structured "unknown failure" code for errors that escape unnamed** — rejected: it converts bugs into expected-looking failures, hiding exactly the defects the exit-1 path is meant to surface.
