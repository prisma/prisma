# Shared CLI base types — design

Status: core design agreed (Will, 2026-08-07). Per-repo implementation designs follow as slice artifacts. Evidence: the base-types investigation summarized in this project's discussion; sources cited inline.

## Decision

All Prisma CLIs (prisma/prisma, composer, the consolidated `prisma` host, and future surfaces) share one set of base types for command results and structured errors:

- **The error foundation comes from prisma/prisma**: the `StructuredError` interface + structural predicate, the `Result` type, `InternalError`, and the `CliStructuredError` class with its `CliErrorEnvelope`.
- **The success envelope comes from the Compute CLI's conventions**: `{ ok, command, result, warnings, nextSteps, nextActions }` with the typed `NextAction` union.
- **Adoption is by duplication now**: each repo carries a verbatim copy of the foundation files. A follow-up slice extracts a new repo and publishes a shared package; until then, copies are safe *by design* because recognition is structural (`isStructuredError`, `CliStructuredError.is()` duck-type — ADR 239 rejected `instanceof` precisely so duplicate copies interoperate).

## The foundation (donated by prisma/prisma, ~580 dependency-free lines)

From `packages/1-framework/0-foundation/utils/`:

- `structured-error.ts` — `StructuredError` (`{ code: 'NAMESPACE.SUBCODE', why?, fix?, where?, severity?, meta?, docsUrl? }` on `Error`), `isStructuredError`, `structuredError` factory, `docsUrlFor`.
- `result.ts` — `Result<T, F> = Ok<T> | NotOk<F>` with throwing accessors, `ok`/`notOk`/`okVoid`; no default failure type.
- `internal-error.ts` — `InternalError`, `isInternalError`, `assertNever`: bugs are not structured failures; they carry no code and exit 1.
- Supporting: `ifDefined`, `blindCast` (compile-time only).

From `packages/1-framework/1-core/errors/src/control.ts` (lines 9–111 only — the concrete Prisma-Next error factories do NOT travel):

- `CliStructuredError` implements `StructuredError`; `toEnvelope(): CliErrorEnvelope`; duck-typed `static is()`.
- `CliErrorEnvelope` — `{ ok: false, code, severity, summary, why?, fix?, where?, meta?, docsUrl? }`.

**One change to the class before duplication: `cause` support.** The constructor accepts `cause?: unknown` and forwards it to `Error`; `toEnvelope()` does not serialize it (a cause is for in-process consumers and logs, not the wire).

## Rules that ride with the types

1. **Codes are dotted `NAMESPACE.SUBCODE`** (ADR 239): namespaces are closed per repo, concern-shaped, each with one owning module; subcodes UPPER_SNAKE, noun-first state suffixes. No `domain` field — the namespace is the domain. Compute's resource-shaped domains convert mechanically (`app` + `BUILD_FAILED` → `APP.BUILD_FAILED`).
2. **Exit codes** (prisma/prisma CLI Style Guide wins): `0` OK, `1` internal error/bug ONLY, `2` expected failure, `3` user abort, `130`/`143` signals, `4`–`99` command-specific. Compute's "1 = command failure" renumbers to 2.
3. **The same value is throwable and a valid `Result` failure** — no wrapper, no conversion at boundaries.
4. **Recognition is structural, never nominal.** Copies of the class in different packages/processes interoperate through the predicates.
5. **`envelope.code` is the machine-branching surface.** Nothing may smuggle a truer code into `meta` (see the prisma/prisma repair below).

## The success envelope (donated by Compute's conventions; adopted by the grammar doc Layer 6)

```jsonc
{ "ok": true, "command": "app.deploy", "result": { /* command-specific, schema-defined */ },
  "warnings": [], "nextSteps": [], "nextActions": [] }
```

- `nextActions` is the structured agent surface: `{ kind: 'run-command' | 'user-choice' | 'edit-file' | 'done', journey, label, command?, commands?, reason? }`. `nextSteps` is the human-compatible string form.
- **Error nesting ruling**: in the shared envelope, the error payload nests under `error` — `{ ok: false, command, error: <CliErrorEnvelope minus its ok field>, warnings, nextSteps, nextActions }`. `CliErrorEnvelope.ok` becomes redundant once nested; it stays on the type for the transition (prisma/prisma emits the bare envelope today) and drops when the shared package is extracted.
- **Implementation timing**: the success envelope is *specified* now and *implemented* with the consolidated host CLI (grammar doc Layer 6). Neither adoption slice below changes today's `--json` success output; this section exists so the error work doesn't foreclose it.

## Per-repo adoption (this round, by duplication)

### prisma/prisma (already the source; repairs only)

1. `CliStructuredError` gains `cause` support.
2. **The `errorRuntime` leak is fixed**: it hardcodes `CONTRACT.VERIFY_FAILED` while ~12 CLI call sites carry their real code in `meta.code`. The generic construction path takes an explicit code; the 12 sites pass the codes they already name; `meta.code` smuggling is deleted. Local repair — external consumers never import `errorRuntime`, so no cross-repo effect.
3. Namespace-list drift reconciled: `SQL`, `SQLITE`, `ADAPTER`, `POSTGRES`, `EXT` are in live use but outside ADR 239's closed list — either admitted to the list (ADR amendment) or remapped.
4. (Recorded, not this slice: the control-api's bespoke bare-word failure codes — `PLANNING_FAILED` etc. — collapse into the dotted taxonomy with the command→result reshape slice.)

### composer (adopter)

1. Foundation files duplicated verbatim into composer's foundation layer (placement per composer's layering rules; exact paths in the slice design).
2. `CliError` is replaced by `CliStructuredError`: every throw site gains a dotted code and a why/fix split; `bin.ts`/`cli.ts` render the envelope (human form per the shared layout: `✖ summary (CODE)` + Why/Fix/Where). Composer's namespace list is defined in the slice design (closed, concern-shaped — expected shape: `CONFIG`, `COMPOSE`, `DEPLOY`, `DEV`, `LOG`; final list settled there). The code-structure convention itself (prisma/prisma's ADR 239: dotted codes, closed namespaces, noun-first subcodes, structural recognition, bugs carry no code) is recorded as a composer ADR in the same slice — the convention travels with the types.
3. The `@prisma/composer/control` `OperationFailure` members gain the structured error as their payload where one exists (exact mapping in the slice design; the `kind` discriminants stay — they are the operation-level taxonomy, the `code` is the failure-level one).
4. Composer's exit codes align with the shared rule (bug=1 vs expected=2 split replaces "everything nonzero").

## Follow-up slice (separate, later)

Extract a new repo, publish the foundation as a shared package; both repos replace their copies with the dependency; `CliErrorEnvelope.ok` drops as the envelope nests under the shared success/error wrapper. Compute's NDJSON streaming event shape (`{ type, command, timestamp, data }`) is specified in that round.

## Alternatives considered

- **Publish the shared package first, adopt second** — rejected: creates a versioned public surface before the repairs land and before real-world adoption shakes the shape; structural recognition makes the interim copies safe, so duplication costs nothing but a later mechanical swap.
- **Share the class via a single package immediately with `instanceof` semantics** — rejected long ago by ADR 239; recognition must survive plane splits, JSON boundaries, and duplicate copies.
- **Keep Compute's separate `domain` field** — rejected: ADR 239 deleted it deliberately; one field fewer, and the namespace carries the same information.
- **Adopt Compute's exit-code mapping** — rejected: it collides `1` (bug) with ordinary failure, destroying the bug-vs-precondition signal agents and CI branch on.
