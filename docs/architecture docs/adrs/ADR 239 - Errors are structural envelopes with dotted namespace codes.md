# ADR 239 — Errors are structural envelopes with dotted namespace codes

Status: **Accepted**.

Supersedes: [ADR 027 — Error Envelope & Stable Codes](ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md), [ADR 068 — Error mapping to RuntimeError](ADR%20068%20-%20Error%20mapping%20to%20RuntimeError.md).

Related: [Error Handling: Failures, Operational Errors, and Bugs](../../Error%20Handling.md).

> **Amended 2026-08-11.** Two changes, both folded into the text below rather than appended. **(1) Completed with findings.** A command that ran to its end and found problems — `migration check` finding integrity violations, `db verify` finding drift — reports those findings as **diagnostics inside a completed envelope** with a documented per-command exit code in the `4`–`99` band. Findings are data; they are never thrown and never travel the error path. The original text classified them as structured failures exiting `2`, which conflated "I could not do my job" with "doing my job turned up bad news". **(2) `fix` → `nextActions`.** The freeform `fix?: string` prose field is replaced by a typed `nextActions: readonly NextAction[]`. The severity scale is unchanged at `'error' | 'warn' | 'info'`; the evidence is recorded under [The severity scale](#the-severity-scale). The shape freezes here; the code sweep trails, exactly as the bare-throw ban does.

## Decision

Every user-facing error in Prisma Next is a **structural envelope** identified by a dotted `NAMESPACE.SUBCODE` code. It is recognized by a **structural type predicate** — a field-shape check, never `instanceof` and never a shared prototype — so the same value is recognizable when thrown, when carried as a `Result` failure, and after it has crossed a network boundary or been imported through two copies of the library in a monorepo.

The shared surface is a **convenience, not an enforcement mechanism**. Foundation provides one interface (`StructuredError`), one predicate (`isStructuredError`), one factory (`structuredError`), and one docs-URL helper. It standardizes structure and behavior; it does **not** enumerate the codes. Each namespace's codes are declared as a typed union in the single module that owns that namespace, and that module's factories brand their envelopes. A code the owning module hasn't declared is a compile error *there*; nothing polices codes globally at runtime, deliberately.

Bugs are not this scheme. An invariant break throws an `InternalError`, which is never meant to be caught except at the outermost boundary for crash reporting. The distinction is the one already drawn in [Error Handling.md](../../Error%20Handling.md): **failures and operational errors are structured envelopes; bugs are `InternalError`.**

Neither are **findings**. A command settles one of two ways. It **completes** — it ran to its end and has a result to report, and that result may be good news or bad news — or it **errors**, meaning it could not do its job at all. A command that completes reports what it found as `Diagnostic` values inside a completed envelope, each carrying the same dotted code an error would carry, alongside a documented per-command exit code. A command that errors produces a `StructuredError` on the error path. The test is one question: *was finding these problems the job?* If yes, they are diagnostics on a completed result. If no — the command could not reach a documented outcome — it is an error. `migration check` reporting eleven integrity violations completed successfully at its job; it did not fail.

A `Diagnostic` is a recorded finding: pure data, never thrown, no stack. It is field-for-field the error envelope minus `ok`, same severity scale included, so a consumer reads one shape on both settlement paths.

The `PN-DOMAIN-NNNN` numeric codes are retired. A published-code crosswalk (below) maps every one to its dotted name. **Error codes freeze at RC**; the crosswalk is the compatibility contract for the rename.

## A grounding example

```ts
// foundation: the shared, code-agnostic surface
export interface StructuredError extends Error {
  readonly code: `${string}.${string}`; // NAMESPACE.SUBCODE
  readonly why?: string;
  readonly nextActions: readonly NextAction[]; // always present; empty when there are none
  readonly where?: { readonly path?: string; readonly line?: number };
  readonly severity?: 'error' | 'warn' | 'info';
  readonly meta?: Record<string, unknown>;
  readonly cause?: unknown;
  readonly docsUrl?: string;
}

export interface NextAction {
  readonly kind: 'run-command' | 'user-choice' | 'edit-file' | 'done';
  readonly label: string;
  readonly command?: string;
  readonly commands?: readonly string[];
  readonly reason?: string;
}

// a finding: the same fields, no stack, never thrown
export interface Diagnostic {
  readonly code: `${string}.${string}`;
  readonly severity: 'error' | 'warn' | 'info';
  readonly summary: string;
  readonly why?: string;
  readonly nextActions: readonly NextAction[];
  readonly where?: { readonly path?: string; readonly line?: number };
  readonly meta?: Record<string, unknown>;
  readonly docsUrl?: string;
}

export function isStructuredError(e: unknown): e is StructuredError {
  return (
    e instanceof Error &&
    typeof (e as { code?: unknown }).code === 'string' &&
    /^[A-Z][A-Z0-9]*\.[A-Z][A-Z0-9_]*$/.test((e as { code: string }).code)
  );
}
```

```ts
// the migration system owns the MIGRATION namespace: it declares its codes
export type MigrationCode = `MIGRATION.${MigrationSubcode}`;
type MigrationSubcode = 'FILE_MISSING' | 'HASH_MISMATCH' | 'DESTRUCTIVE_CHANGES' /* … */;

export function errorMigrationFileMissing(dir: string): StructuredError {
  return structuredError('MIGRATION.FILE_MISSING', 'Migration file not found', {
    why: `No migration.ts under "${dir}".`,
    nextActions: [
      { kind: 'run-command', label: 'Create the migration', command: 'prisma-next migration new' },
      { kind: 'edit-file', label: 'Point the config at the right migrations directory', reason: `"${dir}" does not exist.` },
    ],
    meta: { dir },
  });
}
```

The same envelope is throwable and is a valid `Result` failure value — no wrapper, no conversion:

```ts
throw errorMigrationFileMissing(dir);                 // internal fast-abort
return notOk(errorMigrationFileMissing(dir));         // boundary Result failure
```

A finding is neither. It is returned as data on the completed path, with the exit code the command documents:

```ts
// `migration check` ran to its end; the integrity violations it found are its result
return {
  exitCode: INTEGRITY_FAILED, // 4, documented by this command
  diagnostics: danglingRefs.map((ref) => ({
    code: 'MIGRATION.CHECK_DANGLING_REF',
    severity: 'error',
    summary: `Ref "${ref.name}" points at a hash no migration produces`,
    where: { path: ref.path },
    nextActions: [
      { kind: 'run-command', label: 'Repoint the ref', command: `prisma-next ref set ${ref.name} <valid-hash>` },
      { kind: 'run-command', label: 'Or delete it', command: `prisma-next ref delete ${ref.name}` },
    ],
  })),
};
```

Bugs take the other path:

```ts
import { InternalError, assertNever } from '@internal/utils/internal-error';

switch (node.kind) {
  case 'a': return handleA(node);
  case 'b': return handleB(node);
  default:  return assertNever(node); // throws InternalError; also a compile-time exhaustiveness check
}
```

## Why one scheme, and why structural

Five parallel error systems exist today: a numeric `PN-DOMAIN-NNNN` class (`CliStructuredError`), a dotted `runtimeError()` envelope, a duplicate `RuntimeError` in relational-core, a dotted `MigrationToolsError`, and a bare-word runner enum returned via `Result`. They disagree on spelling (numeric vs dotted vs bare word), on carrier (thrown vs `Result` value), and on whether a code exists at all. The two governing ADRs even disagree with each other: 027 specifies `NAMESPACE.SUBCODE`, 068 specifies `E.NAMESPACE.SUBCODE`. Consumers cannot match errors by code because there is no one code space to match against.

The split between "CLI presentation error" and "runtime error" is historical, not principled. Four of the five systems are already `Error` subclasses carrying nearly the same fields; the fifth already carries `code + summary + why + meta` on its `Result` failure. Collapsing them to one envelope shape makes the crosswalk, the docs tooling, and consumer matching operate over one code space.

**Structural, not nominal**, because a Prisma Next error is recognized in places a prototype cannot survive:

- across the **control plane / execution plane** split, which do not share a runtime;
- across a **network boundary**, where an envelope is serialized to JSON and rehydrated with no prototype at all;
- in a **monorepo with duplicate library copies**, where `instanceof` against one copy's class fails for the other copy's instance.

`CliStructuredError.is()` already duck-types "to work across module boundaries where instanceof may fail," and `isRuntimeError` already checks shape. This ADR generalizes that lesson into the one recognition mechanism.

## The scheme

**Format.** `NAMESPACE.SUBCODE`. `NAMESPACE` is one of the closed list below. `SUBCODE` is `UPPER_SNAKE_CASE`. State suffixes are **noun-first** (`MARKER_MISSING`, `HASH_MISMATCH`, `RUNNER_FAILED`) so codes group by subject; the retired verb-first spellings (`MISSING_MUTATION_DEFAULT_GENERATOR`) are folded to noun-first (`MUTATION_DEFAULT_GENERATOR_MISSING`). A quoted exact-match search for a code still finds every occurrence.

**Namespaces are meaning-based and closed.** The list is governed by this ADR; each namespace has exactly one owning module that declares its code union. Ownership and meaning coincide: an error detected by the CLI but *about* the contract↔DB relationship is `CONTRACT`, not `CLI`; a runner apply failure surfaced through the CLI is `MIGRATION`, not `CLI`.

| Namespace | Meaning | Owning module |
|---|---|---|
| `CONFIG` | Config file load + validation, missing required config | `1-core/config` |
| `CLI` | Invocation: flag parsing, output format, `init`, command usage | `1-core/errors` + `cli` |
| `CONTRACT` | Contract authoring (TS builders), emit, validation, marker/sign/verify | `0-foundation/contract` + `1-core/errors` + sql runtime |
| `PSL` | PSL parse / format / interpret | `psl-parser` + `contract-psl` |
| `PLAN` | Query planning | `relational-core` + `1-core/errors` |
| `RUNTIME` | Query execution: codecs, transactions, prepare, streams, middleware wiring | `framework-components` + sql runtime |
| `ORM` | ORM client API misuse (new — splits the overloaded runtime plane) | `sql-orm-client` + mongo orm |
| `DRIVER` | Driver / adapter transport + error normalization (promoted from silent `RUNTIME`) | drivers + adapters |
| `BUDGET` | Budget middleware | sql runtime middleware |
| `LINT` | Lint middleware | sql runtime middleware |
| `MIGRATION` | Migration authoring, tooling, planning, runner apply | `3-tooling/migration` + sql family/targets |

**Extensions.** In-repo extensions are ordinary namespaces named by the extension, uppercased: `SUPABASE`, `POSTGIS`, `PGVECTOR`, `PARADEDB`, … Core namespaces are reserved. Third-party extensions get a documented convention only — namespace = extension name uppercased — and the public code type is widened to the template-literal shape `` `${Uppercase<string>}.${string}` ``. Nothing polices third-party codes at runtime; they are outside the stability promise.

**Targets and adapters.** Target and adapter packages do not get namespaces of their own — there is no `SQLITE.*`, `POSTGRES.*`, or `ADAPTER.*`. A target-specific failure is still a failure of a core concern, and it uses that concern's namespace: rendering or executing a query uses `RUNTIME` (with `meta.target`/`meta.feature` identifying the target-specific condition), transport uses `DRIVER`, migration apply uses `MIGRATION`. The target name is data, not taxonomy. This keeps the namespace an answer to "what went wrong" rather than "which package said so", and keeps codes stable if a check moves between a target pack and shared code.

**SCHEMA** (a reserved `CliErrorDomain` with no producers) is dropped.

## The foundation surface

One module owns the shared shape. It exports:

- `StructuredError` — the interface above. `code` and `nextActions` are the required fields beyond `Error`; `why` / `where` / `severity` / `meta` / `cause` / `docsUrl` are optional.
- `NextAction` and `Diagnostic` — the two shapes above. `Diagnostic` is the finding form: the envelope's fields minus `ok`, with `severity` and `summary` required and no stack.
- `isStructuredError(e): e is StructuredError` — structural predicate.
- `structuredError(code, message, options?)` — the convenience factory. Brands a plain `Error` with the fields (via `Object.assign` + a non-enumerable `name`), returning `Error & StructuredError`. Usable as a throw target or a `Result` failure value.
- `docsUrlFor(code)` — returns `` `${DOCS_BASE}#${code}` ``, where `DOCS_BASE` is `https://docs.prisma.io/docs/orm/next/reference/error-reference` — one errors page, the dotted code as the fragment (e.g. `…/error-reference#CONTRACT.MARKER_MISSING`). The version segment is a single token (`next`) that flips to `v8` when the RC ships; a factory may override `docsUrl` for a code with its own page. Centralizing it makes the version cut and the package rename one-line edits, not 46 string changes. `scripts/list-error-codes.mjs` enumerates every published code from source (JSON or a markdown skeleton) and has a `--verify <page>` mode the docs site uses to prove the reference page lists all of them.

**Fields carried forward from ADR 027.** `severity` (`error` | `warn` | `info`, default `error`) and `cause` (provenance chain — driver `sqlState`, origin, wrapped error) are kept: `cause` is what the driver-error mapping (below) populates. ADR 027's **redaction is a policy, not a field** — there was never a `redaction` field; `meta`/`details` must be redaction-safe and secrets are excluded. That policy is retained; no field is added.

## Remediation is typed, not prose

Remediation is a `nextActions` array, not a `fix` sentence. `nextActions` is always present and is empty when there is nothing to suggest, so a consumer never has to distinguish "no remediation" from "field absent".

The reason is the audience. A `fix` string like ``'Update the ref with `prisma-next ref set <name> <valid-hash>` or delete it.'`` is two actions, a command, and an argument placeholder, all fused into one sentence that only a human can take apart. An agent has to parse English to find out that there is a command to run and what it is. A `NextAction` states it directly: a `kind` the caller can branch on, a `label` for display, and a `command` (or `commands`) that is executable as written. Human presentation loses nothing: the CLI renders each action as a `→` line under the error, label then command.

The `kind` values are `run-command` (there is a command to run), `user-choice` (the user must decide between the listed options), `edit-file` (a file needs a human edit), and `done` (nothing further is required — used to close out a multi-step flow).

`Diagnostic` carries the same field for the same reason, and the two shapes stay identical field-for-field. That identity is the point: a consumer that can read a finding can read an error.

## The severity scale

`severity` stays at three values, `'error' | 'warn' | 'info'`, on both `StructuredError` and `Diagnostic`.

The narrower `'error' | 'warn'` scale was considered on the theory that `'info'` had no producers. It has. `errorInitUserAborted()` — the `CLI.INIT_USER_ABORTED` envelope raised when a user cancels an `init` prompt — is a shipped `CliStructuredError` constructed with `severity: 'info'`, and it is the right value: nothing went wrong, the user changed their mind, and rendering that in red as an error would misreport it. The migration-status diagnostics (`CONTRACT.UNREADABLE`, `MIGRATION.MARKER_NOT_IN_HISTORY`, `MIGRATION.MISSING_INVARIANTS`) are typed `'warn' | 'info'` and publish that union in their JSON schema, so `'info'` is already part of the machine-readable surface a consumer matches on. Trimming the scale would be a breaking change to that surface with a live producer on the other side.

## User-facing versus internal

[Error Handling.md](../../Error%20Handling.md) already draws the line this ADR mechanizes:

- **Failure** (expected: bad input, builder misuse, capability gating, policy block) → `StructuredError`.
- **Operational error** (expected external fault: connection refused, driver error) → `StructuredError`, populated from the driver via `cause`.
- **Bug** (invariant break, impossible branch, post-validation type break) → `InternalError`.
- **Finding** (the command's own output: an integrity violation, schema drift, a lint hit) → `Diagnostic` on a completed result. Not thrown, not converted to a failure at any boundary.

`InternalError extends Error` lives in foundation with a doc comment stating the contract: *never catch this except at the outermost boundary; it is a bug in Prisma Next, not a user error.* It carries a structural marker (`isInternalError(e)` predicate) so the CLI top-level handler recognizes it — again structurally, not by `instanceof` — and prints "internal error, please report" with the stack, distinct from both a structured envelope and a bare uncaught throw.

`invariant()` and `assertDefined()` are rebuilt to throw `InternalError` instead of a plain `Error`. A new `assertNever(value: never): never` throws `InternalError` and doubles as a compile-time exhaustiveness check, replacing the hand-rolled `throw new Error('unreachable')` guards scattered through the code (no such helper exists today).

## Exit codes

Exit codes follow the reserved table in [CLI Style Guide § Exit Codes](../../CLI%20Style%20Guide.md#exit-codes). They key off how the command *settled* — completed or errored — and, within "completed", off what the command documents:

| Code | Settlement | Meaning |
|---|---|---|
| `0` | completed | The command ran to its end and found nothing to report. |
| `1` | errored | `InternalError` or an uncaught throw — a bug in Prisma Next. Nothing else ever exits `1`. |
| `2` | errored | An expected `StructuredError`: the command could not do its job. Usage, config, missing prerequisite. |
| `3` | errored | The user declined an interactive prompt (`USER_ABORTED`). |
| `4`–`99` | completed | A documented per-command outcome. The command ran to its end and its findings are diagnostics in the completed envelope. |
| `130`, `143` | — | Delivered signals: SIGINT and SIGTERM (POSIX `128 + N`). |

Two rules make the table unambiguous.

**Findings never exit `2`.** `2` means the command could not do its job. `migration check` finding integrity violations did its job; it exits its documented `4` (`INTEGRITY_FAILED`) and carries the violations as diagnostics. It exits `2` only when it could not run the check at all — an unresolvable migration reference, an unknown `--space`. `db verify` follows the same split: drift found is a documented completed code, an unreachable database is an error.

**A severity-`error` diagnostic requires a non-zero exit code.** A command that completed while recording something it calls an error must say so in its exit code; otherwise a shell pipeline would read success. The converse does not hold — a documented non-zero code may accompany warnings only.

Each command declares its `4`–`99` codes in a co-located exported module (`src/commands/<command>/exit-codes.ts`) and documents them in `--help`. The same number means different things in different commands; the dotted code on each diagnostic disambiguates within the class.

This corrects two mappings. Structured errors used to land on `1`, colliding with `1`'s reserved meaning of *internal error*; under this ADR `1` means a bug and nothing else. And completed-with-findings results used to be modeled as structured failures on the error path, which forced a command to throw in order to report the very thing it was asked to look for.

## Banning bare throws

A `throw new Error(...)` is neither a structured failure nor a labeled bug — it is an unrecognizable string. A Biome GritQL plugin `no-bare-throw.grit` flags `throw new Error(` at severity `info`, and a CI ratchet (`scripts/lint-throws.mjs`, modeled on the existing cast ratchet) counts the diagnostics at HEAD versus the merge base and fails if the count rises. The count only falls; each per-plane sweep converts a cluster to `StructuredError` (user-facing) or `InternalError` (bug) and ratchets down.

Scope of the ban:

- **Banned:** `throw new Error(`. Test files are excluded (as the cast plugin excludes them).
- **Not banned:** `throw new TypeError` / `throw new RangeError` (17 + 13 sites, legitimate JS semantics for genuine type/range violations — codified into `StructuredError` later if a code is warranted, not forced by the ratchet).

## Adoption and freeze scope

The **taxonomy** — namespace list, naming conventions, and the crosswalk of every already-published code — is finalized and ratified here, at RC. It is validated against the entire throw surface so there are no namespace gaps. What grows after RC is the **sweep**: the ~250 currently-codeless user-facing throws and the internal tail are converted plane by plane, each adding codes under the fixed conventions (additive, non-breaking) and ratcheting the ban down. Only *renames of already-published codes* break consumers, and those are all in the crosswalk and freeze now; adding a code to a previously-codeless site is non-breaking and may trail.

The `fix` → `nextActions` migration trails the same way. The target shape is frozen here; the several hundred call sites that pass a `fix` string convert cluster by cluster under a ratchet, exactly as the bare-throw ban converts. Freezing the shape before the sweep is what keeps `Diagnostic` and the error envelope field-for-field identical — the alternative, converting first and settling the shape afterwards, would let the two drift while half the tree used each spelling.

Relational-core's `PLAN.INVALID` / `PLAN.UNSUPPORTED` factories have no production callers and are deleted rather than migrated. System 5's runner enum values become `MIGRATION.*` codes on the `Result` failure (the failure already carries a summary and details; only the code string changes).

## Crosswalk (retired → dotted)

The 46 numeric codes. Grouped by destination namespace; a `↦ merges` note marks a code that folds into an existing dotted code.

### → CONFIG

| Retired | Factory | New |
|---|---|---|
| PN-CLI-4001 | `errorConfigFileNotFound` | `CONFIG.FILE_NOT_FOUND` |
| PN-CLI-4002 | `errorContractConfigMissing` | `CONFIG.CONTRACT_MISSING` |
| PN-CLI-4005 | `errorDatabaseConnectionRequired` | `CONFIG.DB_CONNECTION_REQUIRED` |
| PN-CLI-4006 | `errorQueryRunnerFactoryRequired` | `CONFIG.QUERY_RUNNER_FACTORY_REQUIRED` |
| PN-CLI-4007 | `errorFamilyReadMarkerSqlRequired` | `CONFIG.FAMILY_READ_MARKER_REQUIRED` |
| PN-CLI-4009 | `errorConfigValidation` | `CONFIG.VALIDATION_FAILED` |
| PN-CLI-4010 | `errorDriverRequired` | `CONFIG.DRIVER_REQUIRED` |
| PN-CLI-4011 | `errorContractMissingExtensions` | `CONFIG.MISSING_EXTENSION_PACKS` |

### → CLI

| Retired | Factory | New |
|---|---|---|
| PN-CLI-4004 | `errorFileNotFound` | `CLI.FILE_NOT_FOUND` |
| PN-CLI-4008 | `errorJsonFormatNotSupported` | `CLI.JSON_FORMAT_UNSUPPORTED` |
| PN-CLI-4012 | `errorMigrationCliInvalidConfigArg` | `CLI.CONFIG_ARG_MISSING_PATH` |
| PN-CLI-4013 | `errorMigrationCliUnknownFlag` | `CLI.UNKNOWN_FLAG` |
| PN-CLI-4014 | `errorInvalidOutputFormat` | `CLI.INVALID_OUTPUT_FORMAT` |
| PN-CLI-4015 | `errorOutputFormatMutex` | `CLI.OUTPUT_FORMAT_CONFLICT` |
| PN-CLI-4999 | `errorUnexpected` | `CLI.UNEXPECTED` |
| PN-CLI-5002 | `errorInitReinitNeedsForce` | `CLI.INIT_REINIT_NEEDS_FORCE` |
| PN-CLI-5003 | `errorInitMissingFlags` | `CLI.INIT_MISSING_FLAGS` |
| PN-CLI-5004 | `errorInitInvalidFlagValue` | `CLI.INIT_INVALID_FLAG_VALUE` |
| PN-CLI-5005 | `errorInitStrictProbeWithoutProbe` | `CLI.INIT_STRICT_PROBE_WITHOUT_PROBE` |
| PN-CLI-5006 | `errorInitUserAborted` | `CLI.INIT_USER_ABORTED` (exit 3) |
| PN-CLI-5007 | `errorInitInstallFailed` | `CLI.INIT_INSTALL_FAILED` |
| PN-CLI-5008 | `errorInitEmitFailed` | `CLI.INIT_EMIT_FAILED` |
| PN-CLI-5010 | `errorInitInvalidManifest` | `CLI.INIT_INVALID_MANIFEST` |
| PN-CLI-5011 | `errorInitInvalidTsconfig` | `CLI.INIT_INVALID_TSCONFIG` |
| PN-CLI-5012 | `errorInitProbeFailed` | `CLI.INIT_PROBE_FAILED` |
| PN-CLI-5013 | `errorInitSkillInstallFailed` | `CLI.INIT_SKILL_INSTALL_FAILED` |
| PN-CLI-5014 | `errorInitAuthoringSchemaPathMismatch` | `CLI.INIT_AUTHORING_SCHEMA_PATH_MISMATCH` |

### → CONTRACT

| Retired | Factory | New |
|---|---|---|
| PN-CLI-4003 | `errorContractValidationFailed` | `CONTRACT.VALIDATION_FAILED` |
| PN-CON-4016 | `errorEnumCodecNotInPackStack` | `CONTRACT.ENUM_CODEC_NOT_IN_PACK_STACK` |
| PN-RUN-3000 | `errorRuntime` | `CONTRACT.VERIFY_FAILED` |
| PN-RUN-3001 | `errorMarkerMissing` | `CONTRACT.MARKER_MISSING` ↦ merges with existing runtime code |
| PN-RUN-3002 | `errorHashMismatch` | `CONTRACT.MARKER_MISMATCH` ↦ merges with existing runtime code |
| PN-RUN-3003 | `errorTargetMismatch` | `CONTRACT.TARGET_MISMATCH` |
| PN-RUN-3004 | `errorSchemaVerificationFailed` | `CONTRACT.SCHEMA_VERIFICATION_FAILED` |
| PN-RUN-3005 | `errorMarkerRowCorrupt` | `CONTRACT.MARKER_ROW_CORRUPT` |
| PN-RUN-3006 | `errorMarkerReadFailed` | `CONTRACT.MARKER_READ_FAILED` |
| PN-RUN-3010 | `errorMarkerRequired` | `CONTRACT.MARKER_REQUIRED` |

### → MIGRATION

| Retired | Factory | New |
|---|---|---|
| PN-CLI-4020 | `errorMigrationPlanningFailed` | `MIGRATION.PLANNING_FAILED` |
| PN-CLI-4021 | `errorTargetMigrationNotSupported` | `MIGRATION.TARGET_UNSUPPORTED` |
| PN-RUN-3020 | `errorRunnerFailed` | `MIGRATION.RUNNER_FAILED` |
| PN-RUN-3030 | `errorDestructiveChanges` | `MIGRATION.DESTRUCTIVE_CHANGES` |
| PN-MIG-2001 | `errorUnfilledPlaceholder` / `placeholder` | `MIGRATION.UNFILLED_PLACEHOLDER` |
| PN-MIG-2002 | `errorMigrationFileMissing` | `MIGRATION.FILE_MISSING` ↦ merges with existing tooling code |
| PN-MIG-2003 | `errorMigrationInvalidDefaultExport` | `MIGRATION.INVALID_DEFAULT_EXPORT` |
| PN-MIG-2004 | `errorMigrationPlanNotArray` | `MIGRATION.PLAN_NOT_ARRAY` |
| PN-MIG-2005 | `errorDataTransformContractMismatch` | `MIGRATION.DATA_TRANSFORM_CONTRACT_MISMATCH` |
| PN-MIG-2006 | `errorMigrationTargetMismatch` | `MIGRATION.TARGET_MISMATCH` |

### Codes published outside the factory files

Direct `CliStructuredError` constructions and sibling numeric schemes, discovered in the conversion sweep. Same crosswalk contract.

| Retired | Where | New |
|---|---|---|
| PN-MIG-2007 | postgres target `errorPostgresMigrationStackMissing` | `MIGRATION.POSTGRES_CONTROL_STACK_MISSING` |
| PN-MIG-2008 | sqlite target `errorSqliteMigrationStackMissing` | `MIGRATION.SQLITE_CONTROL_STACK_MISSING` |
| PN-MIG-5001 | contract-space aggregate loader (layout violation) | `MIGRATION.CONTRACT_SPACE_LAYOUT_VIOLATION` |
| PN-MIG-5002 | contract-space integrity / orphan marker | `MIGRATION.CONTRACT_SPACE_VIOLATION` |
| PN-CLI-4012 (collision) | `db verify` invalid `--mode` — the same rendered code as the `--config` flag error, two unrelated meanings; the dotted split retires the collision | `CLI.INVALID_VERIFY_MODE` |
| PN-CLI-5009 | `init` invalid output document | `CLI.INIT_INVALID_OUTPUT_DOCUMENT` |
| PN-SCHEMA-0001 | SQL schema-verify failure (`SCHEMA` domain's only producer) | `CONTRACT.SCHEMA_VERIFICATION_FAILED` |

The `migration check` failure catalogue (`PN-MIG-CHECK-NNN`) converts to self-describing `MIGRATION.CHECK_*` codes. `PN-MIG-CHECK-002` covered two unrelated violation kinds; the dotted split separates them. These are **diagnostic** codes: they ride in the completed envelope alongside `migration check`'s documented exit code, not on the error path. The code space is the same one errors draw from — that is the point of one code space — but the carrier is a finding.

| Retired | New |
|---|---|
| PN-MIG-CHECK-001 | `MIGRATION.CHECK_HASH_MISMATCH` |
| PN-MIG-CHECK-002 (missing file) | `MIGRATION.CHECK_FILE_MISSING` |
| PN-MIG-CHECK-002 (provided-invariants disagree) | `MIGRATION.CHECK_PROVIDED_INVARIANTS_MISMATCH` |
| PN-MIG-CHECK-002 (package unloadable) | `MIGRATION.CHECK_PACKAGE_UNLOADABLE` |
| PN-MIG-CHECK-003 | `MIGRATION.CHECK_UNREACHABLE_MIGRATION` |
| PN-MIG-CHECK-004 | `MIGRATION.CHECK_DANGLING_REF` |
| PN-MIG-CHECK-005 | `MIGRATION.CHECK_SNAPSHOT_HASH_MISMATCH` |
| PN-MIG-CHECK-006 | `MIGRATION.CHECK_SNAPSHOT_UNPARSEABLE` |
| PN-MIG-CHECK-007 | `MIGRATION.CHECK_NOOP_SELF_EDGE` |
| PN-MIG-CHECK-008 | `MIGRATION.CHECK_ORPHAN_SPACE_DIR` |
| PN-MIG-CHECK-009 | `MIGRATION.CHECK_DECLARED_BUT_UNMIGRATED` |
| PN-MIG-CHECK-010 | `MIGRATION.CHECK_HEAD_REF_MISSING` |
| PN-MIG-CHECK-011 | `MIGRATION.CHECK_HEAD_REF_NOT_IN_GRAPH` |
| PN-MIG-CHECK-012 | `MIGRATION.CHECK_REF_UNREADABLE` |
| PN-MIG-CHECK-013 | `MIGRATION.CHECK_TARGET_MISMATCH` |
| PN-MIG-CHECK-014 | `MIGRATION.CHECK_SPACE_DISJOINTNESS_VIOLATION` |
| PN-MIG-CHECK-015 | `MIGRATION.CHECK_CONTRACT_UNREADABLE` |
| PN-MIG-CHECK-016 | `MIGRATION.CHECK_DUPLICATE_MIGRATION_HASH` |

### Dotted-code reconciliations (no rename except where noted)

- `DRIVER.*` — already dotted; `DRIVER` is promoted to a real namespace (today it silently resolves to category `RUNTIME`). No code strings change.
- `RUNTIME.MISSING_MUTATION_DEFAULT_GENERATOR` and `RUNTIME.MUTATION_DEFAULT_GENERATOR_MISSING` (near-duplicates) → single `RUNTIME.MUTATION_DEFAULT_GENERATOR_MISSING`.
- Runner enum (system 5) `EXECUTION_FAILED`, `SCHEMA_VERIFY_FAILED`, `PRECHECK_FAILED`, `POSTCHECK_FAILED`, `POLICY_VIOLATION`, `FOREIGN_KEY_VIOLATION`, `DESTINATION_CONTRACT_MISMATCH`, `LEGACY_MARKER_SHAPE`, `MARKER_ORIGIN_MISMATCH`, `MARKER_CAS_FAILURE` → `MIGRATION.<VALUE>`.
- `MIGRATION.*` (system 4) and the remaining `RUNTIME.*` / `PLAN.*` (kept) / `CONTRACT.*` / `LINT.*` / `BUDGET.*` codes already conform; no rename.

## Consequences

### Positive

- One code space: consumers, dashboards, and CI match errors by dotted code, not brittle strings; the crosswalk is the single rename record.
- Recognition survives the control/execution split, the wire, and duplicate imports, because it is structural.
- The same envelope serves a throw and a `Result` failure — no per-boundary conversion type.
- A command that reports problems does not have to throw to do it. `migration check` returns its violations; the exit code says how it went; nothing on the path is an exception.
- Remediation is executable. An agent reads `nextActions[0].command` instead of parsing a sentence, and the human rendering is the same `→` line it always was.
- Codes live with the code that raises them; a new namespace is a new owning module, not an edit to a central registry.
- The ratchet lets the taxonomy freeze at RC while the mechanical sweep of 700+ throw sites trails safely.

### Negative

- No global compile-time guarantee that every code is unique across namespaces — uniqueness is a convention checked by the crosswalk + review, not the type system. (A namespace's own union is enforced locally.)
- The structural predicate accepts any object of the right shape, including a hand-rolled look-alike; this is the deliberate cost of prototype-independence.
- `severity` is retained though nearly every error is `error` today; the `warn`/`info` values earn their place on advisory lint, budget, and status surfaces, and on the user-abort envelope.
- Two settlement paths mean a command author has a judgement call to make at every return site. The rule ("was finding these problems the job?") is a sentence, not a type, and the only mechanical check is the runtime one: a severity-`error` diagnostic must come with a non-zero exit code.
- `nextActions` is more work to write than a `fix` sentence — three fields instead of a clause. That cost is paid once per factory and recovered by every agent that would otherwise parse the prose.

## Alternatives considered

**A single `StructuredError` base class, recognized by `instanceof`.** Rejected: a shared prototype does not survive the control/execution plane split, JSON round-trips across the network, or duplicate library copies in a monorepo — the exact conditions where errors must still be recognized. The existing code already works around this with duck-typing; a base class would reintroduce the failure it works around. A class is fine as an *implementation convenience* for throwing (as `InternalError` is), but recognition must be structural.

**Two envelopes (CLI presentation vs runtime) sharing only a code format.** Rejected: the split is historical, not principled — four of five systems already carry the same fields. Two shapes means two crosswalks, two docs pipelines, and a conversion type at every boundary between them, for no capability the one shape lacks.

**Keep numeric `PN-DOMAIN-NNNN` codes.** Rejected per the settled scheme decision: dotted names are self-describing, already have 2:1 adoption in the code, and fix the over-broad `RUN` domain. Numeric codes force a lookup table to read any log line.

**One physical union module listing every code.** Rejected: it would have to sit in a low foundation package yet name codes owned by high packages (sql, targets, extensions), inverting the layering that `pnpm lint:deps` enforces. The per-namespace union keeps each code with its owner; the "central registry" is this ADR's crosswalk (documentation), not a type.

**Findings as structured failures exiting `2`.** Rejected: it makes a command throw in order to report what it was asked to find, and it puts "the check found eleven violations" in the same exit-code bucket as "you passed an unknown flag". A shell pipeline cannot tell those apart, and the command has to invent a wrapper failure whose only content is a list of findings. Exit `2` is reserved for a command that could not do its job.

**A separate `Finding` shape, unrelated to the error envelope.** Rejected: two shapes means two renderers, two JSON schemas, and two things for a consumer to learn, for a distinction that is about *carrier*, not content. A dangling ref is the same information whether the command aborted on it or listed it. `Diagnostic` is the envelope minus `ok` precisely so the two never drift.

**Keep `fix` alongside `nextActions`.** Rejected: it guarantees they disagree. Every factory would have to keep a sentence and a structured list in sync by hand, and consumers would have to decide which one wins when they differ. If prose is wanted around an action, it is that action's `reason`.

**Trim severity to `'error' | 'warn'`.** Rejected on evidence: `CLI.INIT_USER_ABORTED` ships with `severity: 'info'`, and the migration-status diagnostics publish `'warn' | 'info'` in their JSON schema. See [The severity scale](#the-severity-scale).

**Convert all 700+ throw sites before RC.** Rejected: it is not one coherent review, and it collides with the RC freeze. Only the *codes* must freeze at RC; the conversion is ratcheted down afterward, plane by plane.
