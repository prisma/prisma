# Commander.js friction points in `@internal/cli`

Snapshot: 2026-04-30. This is a durable artifact intended to guide a later
replacement of CommanderJS in `@internal/cli`. It catalogues the concrete
places where the current code fights Commander's defaults, with citations
into the codebase as it stands today, and explains *why* each workaround
exists. It is not an opinion piece — every claim is grounded in a code
location you can read.

It was written as part of TML-2318 (replacing the hand-rolled arg parser
in `MigrationCLI`), where the question of "should we keep using Commander
elsewhere?" came up. Use this as input when scoping that broader work.

## TL;DR

Commander costs us more than it gives us. The friction points cluster
into four families:

1. **Process-ownership leakage**: Commander wants to call `process.exit`
   on `--help`, on validation errors, on unknown commands, and on
   `Command#parse` failure. We override every one of those exits and
   replace them with our own classification, because exit codes carry
   semantic meaning (CLI Style Guide §Exit Codes).
2. **Stream-ownership leakage**: Commander writes errors to its own
   `writeErr` and help to its own `writeOut`. The Style Guide requires
   help on stderr, errors with PN-coded structure, and a stdout that's
   reserved for data. We suppress both of Commander's writers and
   replace them with our own formatters.
3. **Help is a per-command monkey-patch**: Commander's `formatHelp` is
   a method on a help object, configured per-command via
   `command.configureHelp({...})`. Every Command we register has the
   same configureHelp call; we have a 379-line custom formatter
   (`utils/formatters/help.ts`) that takes a Commander `Command` and
   re-renders it from scratch using almost none of Commander's
   formatting primitives.
4. **Error model mismatch**: Commander surfaces unknown
   commands/arguments/missing-options as `CommanderError` instances
   whose only reliable discriminator (across Commander minor versions
   and option vs positional cases) is **string-matching the message**.
   We've ended up doing exactly that to recover semantic exit codes,
   which is brittle by construction.

Plus several smaller papercuts: no enum validation at parse time, no
hook for "unknown command" suggestions, custom output suppression
mechanics that have to be reset per-command, and a class hierarchy
that resists composition.

The migration-file CLI (`MigrationCLI.run`, the subject of TML-2318)
sidesteps all of this with a 30-line hand-rolled parser, which is
itself a data point: when the surface is small, Commander's friction
exceeds its value, and contributors reach for a custom loop instead.

---

## The cost ledger

### 1. Process-ownership leakage — `exitOverride` is a permanent fixture

**Location**: `packages/1-framework/3-tooling/cli/src/cli.ts:71-144`.

Commander's default behaviour is to call `process.exit` on a wide set
of conditions. We never want it to:

- **Help**: pressing `--help` exits 0 from inside Commander.
- **Unknown command**: Commander calls `process.exit(1)` (we want exit
  2 per Style Guide §Exit Codes — usage errors are PRECONDITION).
- **Unknown argument**: same, exit 1 by default; we want 2.
- **Missing required option**: same; we want 2.
- **Validation failure**: same; we want 2.

To recover control we install `program.exitOverride(...)` at startup.
That callback has to *manually re-classify* the failure into the
correct exit code by inspecting the `CommanderError` instance:

```typescript
// packages/1-framework/3-tooling/cli/src/cli.ts:71-144 (excerpt)
program.exitOverride((err) => {
  if (err) {
    const errorCode = (err as { code?: string }).code;
    const errorMessage = String(err.message ?? '');
    const errorName = err.name ?? '';

    const isUnknownCommandError =
      errorCode === 'commander.unknownCommand' ||
      errorCode === 'commander.unknownArgument' ||
      (errorName === 'CommanderError' &&
        (errorMessage.includes('unknown command') ||
         errorMessage.includes('unknown argument')));
    if (isUnknownCommandError) { /* ... exit 2 ... */ }

    const isHelpError =
      errorCode === 'commander.help' ||
      errorCode === 'commander.helpDisplayed' ||
      errorCode === 'outputHelp' ||
      errorMessage === '(outputHelp)' ||
      errorMessage.includes('outputHelp') ||
      (errorName === 'CommanderError' && errorMessage.includes('outputHelp'));
    if (isHelpError) { /* ... exit 0 ... */ }

    const isMissingArgumentError =
      errorCode === 'commander.missingArgument' ||
      errorCode === 'commander.missingMandatoryOptionValue' ||
      (errorName === 'CommanderError' &&
        (errorMessage.includes('missing') || errorMessage.includes('required')));
    if (isMissingArgumentError) { /* ... exit 2 ... */ }
    /* ... */
  }
});
```

Note the **dual matching**: each branch matches both the documented
error `code` *and* a substring of the error `message`. The message
fallbacks exist because Commander has historically emitted error codes
inconsistently across minor versions and across cases (positional vs
option-style), and the substring matches are how we shipped a version
that didn't break when Commander's internal error codes shifted.

**Why this hurts**: every new command we add inherits this maze of
re-classification. Any contributor who introduces a new error path in
Commander has to either find the exit-override wiring or accept that
their failure will be misclassified. The workaround is the size of a
small file and is purely about saying "no" to Commander.

**What a clipanion equivalent looks like**: `await cli.run(args, ctx)`
returns the exit code as a promise. If a command throws, clipanion
writes the error to `ctx.stderr` and returns a non-zero exit code; the
caller sets `process.exitCode` explicitly. There is no override to
configure because there is no exit to override.

### 2. Stream-ownership leakage — suppress + reroute

**Location**: `packages/1-framework/3-tooling/cli/src/cli.ts:49-56`.

```typescript
program.configureOutput({
  writeErr: () => {
    // Suppress all default error output - we handle errors in exitOverride
  },
  writeOut: () => {
    // Suppress all default output - our custom formatters handle everything
  },
});
```

We disable both of Commander's output writers entirely, and rebuild
output ourselves. This is because:

- Commander writes errors to stdout in some cases and stderr in
  others, depending on the error class. The Style Guide requires
  errors on stderr.
- Commander prints help to stdout. The Style Guide requires
  decoration (including help) on stderr.
- Commander's "did you mean" messages are intermixed with its own
  formatting. We have a structured "Unknown command" + suggestion
  block in `cli.ts:96-107` that has to be rendered by hand.

Once you've suppressed Commander's output, *every* output path becomes
your responsibility. That's why the help formatter
(`utils/formatters/help.ts`, 379 lines) exists at all — it would
otherwise be unnecessary, because Commander has built-in help
rendering. We turned it off to gain control.

### 3. Per-command help-formatter monkey-patching

**Location**: every Commander `Command` we instantiate.

Commander's help is configured via `command.configureHelp({ formatHelp: ... })`.
Because our help is global (every command must use the styled
formatter), we have to register the formatter on every Command:

- `cli.ts:64-67` — root program
- `cli.ts:154-160` — `contract` parent command
- `cli.ts:181-187` — `db` parent command
- `cli.ts:220-226` — `migration` parent command
- `cli.ts:255-260` — `help` command
- `commands/init/index.ts:65` — via `addGlobalOptions(command)`
- `utils/command-helpers.ts:291-298` — `addGlobalOptions` itself
  registers configureHelp on every command that uses it

Every command in the codebase must remember to call `addGlobalOptions`
*and* `setCommandDescriptions`/`setCommandExamples`, because Commander
doesn't have a notion of "global help renderer for the whole CLI".
Forgetting either silently produces unstyled help.

The **same formatter** is registered N times because Commander makes
this a per-command concern, not a per-CLI concern. The configureHelp
calls compile to dead-identical code at every site.

### 4. Description/examples shimmed via WeakMap

**Location**: `packages/1-framework/3-tooling/cli/src/utils/command-helpers.ts:16-56`.

```typescript
const longDescriptions = new WeakMap<Command, string>();
const commandExamples  = new WeakMap<Command, readonly string[]>();
```

Commander's `Command` class supports a single `description()` field.
The Style Guide wants short *and* long descriptions, plus copy-pastable
examples. Because we can't extend Commander's `Command` (it's used
directly throughout) and can't inject custom fields without subclassing
the whole hierarchy, we shim it with two WeakMaps keyed by the
Commander `Command` object.

Every command call site has to remember the order:
`setCommandDescriptions(...)` → `setCommandExamples(...)` →
`addGlobalOptions(...)` → `.option(...)` → `.action(...)`. Forgetting
the descriptions/examples step silently produces help with no examples
and no long description. There is no compile-time check.

This is the kind of thing a class hierarchy that supported composition
would handle natively — clipanion's `Command` subclass *is* the place
to put `usage = { description, details, examples }` because the
framework was designed around per-command schema metadata.

### 5. Init command flag enums must be validated by hand

**Location**: `packages/1-framework/3-tooling/cli/src/commands/init/index.ts:18-26` and `inputs.ts:21`.

> Commander.js does not enforce enums at parse time — the validation /
> normalisation happens in `inputs.ts::resolveInitInputs`, which can
> raise a structured `errorInitInvalidFlagValue` with the full set of
> allowed values.

This is a comment from a contributor — not snark, just the documented
state of the library. `--target postgres|mongodb` is declared as a
plain `string` option to Commander; the actual enum check happens
later in `inputs.ts` and emits `PN-CLI-4xxx`.

Commander does support `.choices(...)` on options, but `.choices` doesn't
produce a structured error compatible with our envelope — it throws a
`CommanderError` with a string message that we'd then have to
re-classify and translate, the same way we do unknown-command errors.

Building the validation outside Commander is genuinely cleaner *given
our envelope*, but the cost is that the Commander option declaration
no longer expresses the contract — flag validity has to be checked
twice in our heads (once when reading the `.option('--target <db>')`
call site, once when reading the validator).

### 6. The version option's default description fails our style guide

**Location**: `packages/1-framework/3-tooling/cli/src/cli.ts:43-47`.

```typescript
const versionOption = program.options.find((opt) => opt.flags.includes('--version'));
if (versionOption) {
  versionOption.description = 'Output the version number';
}
```

Commander auto-registers `--version` with description "output the
version number". Our Style Guide capitalises descriptions. We can't
configure that at registration time (Commander hardcodes the string),
so we mutate the Option object after the fact. Mutating Commander's
internal state is allowed but unsupported.

### 7. The `--version` and root-help flags require a manual short-circuit

**Location**: `packages/1-framework/3-tooling/cli/src/cli.ts:281-313`.

```typescript
const args = process.argv.slice(2);
if (args.length > 0) {
  const commandName = args[0];
  // Handle version option explicitly since we suppress default output
  if (commandName === '--version' || commandName === '-V') {
    process.stdout.write(`${program.version()}\n`);
    process.exit(0);
  }
  // ... rest of unknown-command-with-suggestion machinery ...
}
```

Because we suppressed Commander's `writeOut`, `--version` no longer
prints anything by default — Commander tries to write to its
no-op writer. The fix is a manual argv inspection before
`program.parse()` to short-circuit.

Same pattern for "did you mean" suggestions on unknown subcommands
(`cli.ts:282-313`): we re-walk argv ourselves, find the parent
command, list its subcommands, run our `suggestCommands` Levenshtein
helper, and print the result to stderr. Commander doesn't expose any
hook for "the user typed an unknown command — do something custom",
so we have to detect it twice (once before parse, once in
`exitOverride`).

### 8. Help formatter has to recover Commander's internal default-value field

**Location**: `packages/1-framework/3-tooling/cli/src/utils/formatters/help.ts:188-189`.

```typescript
// Commander.js stores default value in defaultValue property
const defaultValue = (opt as { defaultValue?: unknown }).defaultValue;
```

Commander's `Option` class has a `defaultValue` field but it isn't in
the public type. We cast to a structural type to read it. This is the
only way to render `default: <value>` lines in our help output, because
Commander's own help renderer (which we disabled in step 2) would have
read the same field internally.

This is a microcosm of the whole problem: we keep reaching into
Commander internals because we want a different output format than
Commander provides, but Commander is structured around its own
formatting being the only thing that consumes its parsed metadata.

### 9. Migration-file CLI bypassed Commander entirely

**Location**: `packages/1-framework/3-tooling/cli/src/migration-cli.ts:93-120` (pre-TML-2318).

The migration-file CLI surface has only three flags. The original PR
chose to hand-roll a 30-line `parseArgs` loop rather than register a
`new Command()`, configure help, register `addGlobalOptions`,
configure exit override locally, and so on. The author left a
TODO-comment pointing at TML-2318 acknowledging this is technical
debt.

This is the strongest signal: a contributor familiar with our
Commander integration looked at it and chose to write a parser by
hand for a three-flag CLI rather than pay the integration cost. The
TML-2318 work replaces it with clipanion specifically because
clipanion makes a three-flag CLI cheap, not because the hand-rolled
parser is inherently bad.

---

## What we'd lose if we replaced Commander

Honest accounting:

- **`commander` is widely known**: any contributor recognises it.
  Clipanion, citty, cac, etc. are less ubiquitous. New contributors
  would have a slight ramp-up.
- **`addGlobalOptions(command)` is a clean DSL** layered on top of a
  messy library. Re-implementing global options for a different
  library would be a one-time cost.
- **The custom formatter (`formatters/help.ts`, 379 lines) is decoupled
  from Commander already** — it walks `Command` objects but doesn't use
  Commander's own help machinery. Most of it could be kept by writing a
  thin adapter from clipanion's `Command` definitions to the same data
  model `formatCommandHelp` expects today.

---

## Concrete evaluation criteria for the replacement

When the broader Commander-replacement work is scoped, evaluate
candidates against these specific friction points:

1. **Does the library call `process.exit` from inside `parse()` /
   command dispatch?** If so, can it be configured *not* to, without
   substring-matching on error messages?
2. **Does the library accept an injected `{ stdout, stderr, env, stdin }`
   context per invocation, or does it write to globals?** This is the
   single biggest determinant of in-process testability.
3. **Are help, errors, and command output rendered to those injected
   streams?** Or only the user's `run` callback?
4. **Does `parse(argv, ctx)` return an exit code, or signal success/
   failure some other way?**
5. **Is help generated from the same option declaration the parser
   uses?** Or is it a parallel object you have to keep in sync?
6. **Does the library validate enums (and other constraints) at parse
   time and emit a structured error you can route through your
   envelope?**
7. **Is there a hook for "unknown command/option" that lets us inject
   a "did you mean" suggestion without intercepting an internal
   error?**
8. **Can a `Command` carry user-defined metadata (long description,
   examples, docs URL) without WeakMap shims?**
9. **Is the parser implementation runtime-agnostic** (no `node:*`
   imports, or platform-shim layer like clipanion's `platform/`)?
   This matters for Bun/Deno support.
10. **Is the library on a healthy maintenance trajectory?** Not just
    last release date, but: are issues being triaged and fixed; is the
    upstream responsive to community reports; is there an obvious
    successor or fork if the maintainer disengages? A "feature-complete
    but slow" library can be acceptable for a tiny stable API slice;
    it is risky for a large surface that needs to evolve.

A library that scores ≥8/10 on this is a clear win over Commander.
≤5/10 means we'd be trading one set of friction for another.

For the record: **clipanion scores ~7/10** on this rubric. It passes
criteria 1–9 cleanly and has the testability properties Commander
lacks. The weak axis is criterion 10:

- Last commit on the default branch was 2024-09-06 (~8 months at the
  time of writing), and the 4.x line has been in RC since
  2023-07-27 (~14 months as RC at last publish).
- Community-reported issues accumulate without being closed by upstream.
  Notable open issues include
  [#176 — Errors go to stdout instead of stderr](https://github.com/arcanis/clipanion/issues/176) (which the migration-CLI swap
  works around by using `cli.process` parse-only),
  [#178 — Invalid `lib/platform/node.mjs` due to require statement](https://github.com/arcanis/clipanion/issues/178), and
  [#177 — Help/usage describes first path only, duplicated](https://github.com/arcanis/clipanion/issues/177).
- The maintainer (Maël Nison) continues to ship clipanion in Yarn
  Berry, so the package is stable and production-tested at the version
  Yarn pins, but there is no signal of active feature development on
  the standalone library.

This makes clipanion's profile **"feature-complete with periodic bumps
when Yarn needs them"**, not "actively maintained" in the iterating-on-
community-issues sense. For our use case (a tiny, stable migration-file
CLI surface, single file, exact-version-pinned) the trade is
acceptable: blast radius is bounded, and ripping clipanion out and
replacing it is roughly a half-day's work if the maintenance situation
ever blocks us. For a larger surface (e.g. a future Commander
replacement in `@internal/cli`), the same trade is more
load-bearing — re-evaluate criterion 10 against the candidate set
before adopting clipanion at that scope.

The other (taste-call) weakness is class-based command syntax being
slightly more ceremonial than `defineCommand`-style.
