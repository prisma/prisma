# ADR 245 — Errors are structured at origin; results carry one ok discriminator

Status: **Accepted**

Related: [ADR 239 — Errors are structural envelopes with dotted namespace codes](<./ADR 239 - Errors are structural envelopes with dotted namespace codes.md>) (the envelope this ADR governs the construction and carriage of). Composer records the same rules for its own tree as its ADR-0043/ADR-0044; the convention travels with the duplicated foundation types, and structural recognition (ADR 239) is what makes the copies interoperate.

## Decision

Three rules, plus the class collapse they forced.

**1. Errors are structured at their origin — there are no catch-all codes.** Any failure meant to surface to a user becomes a `CliStructuredError` (or a subclass) at the site that raises it, carrying its own dotted code and its own why/fix. Site-specific wraps of foreign causes (a driver error, a config module that threw, an I/O failure the tool can name) are legal and attach the original as `cause`. Boundary fallbacks are banned: a generic construction path may not supply a default code, and codes like "pipeline failed" do not exist. A non-structured error reaching a process boundary is by definition a bug — it exits 1 with a report hint and no code, per ADR 239's exit-code rule.

**2. `envelope.code` is the machine-branching surface — nothing smuggles a truer code into `meta`.** Consumers branch on `code`; `meta` carries structural data, never an alternative identity. The generic factory takes the code as its first argument (`errorRuntime(code, summary, options)`); `meta.code` is deleted everywhere.

**3. Operation and command results ride one discriminator: `ok`.** Everything returns the shared `Result<T, F>` — `{ ok: true, value } | { ok: false, failure }` — with a `CliStructuredError` failure, end to end. Bespoke per-operation outcome enums (`outcome: 'deployed' | 'failed' | …`) are banned; the success payload's *type* carries the operation-specific shape, the discriminator does not. The same error value is throwable and is a valid `Result` failure — no wrapper, no conversion at boundaries (ADR 239).

**The collapse:** one error base type. `MigrationToolsError` extends `CliStructuredError` (structured data in `meta`, not a parallel `details` field; the subclass must not set `this.name`, so ADR 239's structural predicate keeps recognizing it). The CLI boundary mapper that used to re-wrap migration-tools errors is deleted — the error passes through as itself. Rule 1's wraps and rule 3's failures therefore always carry the same class, and `cause` chains survive from origin to renderer.

## Why

The `code` field is only a branching surface if exactly one code space exists and every failure is in it. Fallback codes launder unnamed failures into something that renders politely but cannot be acted on; smuggled `meta.code`s split the code space in two; parallel error classes (the old `MigrationToolsError extends Error`) force boundary mappers, and every mapper is a place where `cause`, fields, or fidelity get dropped. Making the origin responsible for the code makes every raise site honest — the site that knows the context writes the why/fix — and makes an unnamed failure loud (a bug, exit 1) instead of quiet.

One `ok` discriminator exists for the same reason: agents and hosts branch on `result.ok` then `failure.code`, uniformly, without learning a per-operation vocabulary first.

## Consequences

- `errorRuntime(code, summary, options)` requires an explicit dotted code; the type is `` `${string}.${string}` ``. All former default-code call sites name their real code.
- `CliStructuredError` accepts `cause` and forwards it to `Error`; `toEnvelope()` never serializes it (a cause is for in-process consumers and logs, not the wire).
- `MigrationToolsError.is()` narrows structurally (`CliStructuredError.is` + `category === 'MIGRATION'` + code prefix), so it survives duplication and plane splits like its parent.
- The error reference (`docs/reference/error-reference.md`, enforced by `check:error-reference`) is the closed registry rule 1 writes into: a new surfaced failure adds its code and its producing site there, in the same change.
- Adding a producing site to an existing code updates that code's reference entry (site + meta shape) in the same change — an entry that describes only some of its sites misleads the consumer the registry exists for.

## Alternatives considered

- **A default code on the generic path** (the old `errorRuntime` hardcoding `CONTRACT.VERIFY_FAILED`) — rejected: it produced envelopes whose code contradicted the `meta.code` twelve call sites smuggled, which is the code-space split this ADR bans.
- **Keeping `MigrationToolsError` as a parallel hierarchy with a boundary mapper** — rejected: the mapper existed only to translate shapes, dropped the cause chain, and had to be re-derived at every new boundary.
- **Per-operation outcome enums** — rejected: they made every caller learn a second, operation-local discriminator vocabulary that duplicated what `ok` + the success payload type already state.
