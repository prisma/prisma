# ADR 239 — Errors are structural envelopes with dotted namespace codes

Status: **Accepted**.

Supersedes: [ADR 027 — Error Envelope & Stable Codes](ADR%20027%20-%20Error%20Envelope%20Stable%20Codes.md), [ADR 068 — Error mapping to RuntimeError](ADR%20068%20-%20Error%20mapping%20to%20RuntimeError.md).

Related: [Error Handling: Failures, Operational Errors, and Bugs](../../Error%20Handling.md).

## Decision

Every user-facing error in Prisma Next is a **structural envelope** identified by a dotted `NAMESPACE.SUBCODE` code. It is recognized by a **structural type predicate** — a field-shape check, never `instanceof` and never a shared prototype — so the same value is recognizable when thrown, when carried as a `Result` failure, and after it has crossed a network boundary or been imported through two copies of the library in a monorepo.

The shared surface is a **convenience, not an enforcement mechanism**. Foundation provides one interface (`StructuredError`), one predicate (`isStructuredError`), one factory (`structuredError`), and one docs-URL helper. It standardizes structure and behavior; it does **not** enumerate the codes. Each namespace's codes are declared as a typed union in the single module that owns that namespace, and that module's factories brand their envelopes. A code the owning module hasn't declared is a compile error *there*; nothing polices codes globally at runtime, deliberately.

Bugs are not this scheme. An invariant break throws an `InternalError`, which is never meant to be caught except at the outermost boundary for crash reporting. The distinction is the one already drawn in [Error Handling.md](../../Error%20Handling.md): **failures and operational errors are structured envelopes; bugs are `InternalError`.**

The `PN-DOMAIN-NNNN` numeric codes are retired. A published-code crosswalk (below) maps every one to its dotted name. **Error codes freeze at RC**; the crosswalk is the compatibility contract for the rename.

## A grounding example

```ts
// foundation: the shared, code-agnostic surface
export interface StructuredError extends Error {
  readonly code: `${string}.${string}`; // NAMESPACE.SUBCODE
  readonly why?: string;
  readonly fix?: string;
  readonly where?: { readonly path?: string; readonly line?: number };
  readonly severity?: 'error' | 'warn' | 'info';
  readonly meta?: Record<string, unknown>;
  readonly cause?: unknown;
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
    fix: 'Run `prisma-next migration create` or check the path.',
    meta: { dir },
  });
}
```

The same envelope is throwable and is a valid `Result` failure value — no wrapper, no conversion:

```ts
throw errorMigrationFileMissing(dir);                 // internal fast-abort
return notOk(errorMigrationFileMissing(dir));         // boundary Result failure
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

**SCHEMA** (a reserved `CliErrorDomain` with no producers) is dropped.

## The foundation surface

One module owns the shared shape. It exports:

- `StructuredError` — the interface above. `code` is the only required field beyond `Error`; `why` / `fix` / `where` / `severity` / `meta` / `cause` / `docsUrl` are optional.
- `isStructuredError(e): e is StructuredError` — structural predicate.
- `structuredError(code, message, options?)` — the convenience factory. Brands a plain `Error` with the fields (via `Object.assign` + a non-enumerable `name`), returning `Error & StructuredError`. Usable as a throw target or a `Result` failure value.
- `docsUrlFor(code)` — returns `` `${DOCS_BASE}#${code}` ``, where `DOCS_BASE` is `https://docs.prisma.io/docs/orm/next/reference/error-reference` — one errors page, the dotted code as the fragment (e.g. `…/error-reference#CONTRACT.MARKER_MISSING`). The version segment is a single token (`next`) that flips to `v8` when the RC ships; a factory may override `docsUrl` for a code with its own page. Centralizing it makes the version cut and the package rename one-line edits, not 46 string changes. `scripts/list-error-codes.mjs` enumerates every published code from source (JSON or a markdown skeleton) and has a `--verify <page>` mode the docs site uses to prove the reference page lists all of them.

**Fields carried forward from ADR 027.** `severity` (`error` | `warn` | `info`, default `error`) and `cause` (provenance chain — driver `sqlState`, origin, wrapped error) are kept: `cause` is what the driver-error mapping (below) populates. ADR 027's **redaction is a policy, not a field** — there was never a `redaction` field; `meta`/`details` must be redaction-safe and secrets are excluded. That policy is retained; no field is added.

## User-facing versus internal

[Error Handling.md](../../Error%20Handling.md) already draws the line this ADR mechanizes:

- **Failure** (expected: bad input, builder misuse, capability gating, policy block) → `StructuredError`.
- **Operational error** (expected external fault: connection refused, driver error) → `StructuredError`, populated from the driver via `cause`.
- **Bug** (invariant break, impossible branch, post-validation type break) → `InternalError`.

`InternalError extends Error` lives in foundation with a doc comment stating the contract: *never catch this except at the outermost boundary; it is a bug in Prisma Next, not a user error.* It carries a structural marker (`isInternalError(e)` predicate) so the CLI top-level handler recognizes it — again structurally, not by `instanceof` — and prints "internal error, please report" with the stack, distinct from both a structured envelope and a bare uncaught throw.

`invariant()` and `assertDefined()` are rebuilt to throw `InternalError` instead of a plain `Error`. A new `assertNever(value: never): never` throws `InternalError` and doubles as a compile-time exhaustiveness check, replacing the hand-rolled `throw new Error('unreachable')` guards scattered through the code (no such helper exists today).

## Exit codes

Exit codes follow the reserved table in [CLI Style Guide § Exit Codes](../../CLI%20Style%20Guide.md#exit-codes) — they key off the *kind* of error, not a namespace whitelist:

- `InternalError` and uncaught throws → **1** (`INTERNAL_ERROR` — "this should not have happened").
- Expected `StructuredError` failures (usage, config, precondition, verify, runner) → **2** (`PRECONDITION` — "your invocation or state was wrong; fix and retry"). Commands may still return a command-specific code for finer classification.
- User-declined prompt → **3** (`USER_ABORTED`).

This corrects the current mapping, which sends every non-CLI structured error to `1` — colliding with `1`'s reserved meaning of *internal error*. Under this ADR, `1` means a bug; an expected failure never exits `1`.

## Banning bare throws

A `throw new Error(...)` is neither a structured failure nor a labeled bug — it is an unrecognizable string. A Biome GritQL plugin `no-bare-throw.grit` flags `throw new Error(` at severity `info`, and a CI ratchet (`scripts/lint-throws.mjs`, modeled on the existing cast ratchet) counts the diagnostics at HEAD versus the merge base and fails if the count rises. The count only falls; each per-plane sweep converts a cluster to `StructuredError` (user-facing) or `InternalError` (bug) and ratchets down.

Scope of the ban:

- **Banned:** `throw new Error(`. Test files are excluded (as the cast plugin excludes them).
- **Not banned:** `throw new TypeError` / `throw new RangeError` (17 + 13 sites, legitimate JS semantics for genuine type/range violations — codified into `StructuredError` later if a code is warranted, not forced by the ratchet).

## Adoption and freeze scope

The **taxonomy** — namespace list, naming conventions, and the crosswalk of every already-published code — is finalized and ratified here, at RC. It is validated against the entire throw surface so there are no namespace gaps. What grows after RC is the **sweep**: the ~250 currently-codeless user-facing throws and the internal tail are converted plane by plane, each adding codes under the fixed conventions (additive, non-breaking) and ratcheting the ban down. Only *renames of already-published codes* break consumers, and those are all in the crosswalk and freeze now; adding a code to a previously-codeless site is non-breaking and may trail.

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

The `migration check` failure catalogue (`PN-MIG-CHECK-NNN`) converts to self-describing `MIGRATION.CHECK_*` codes. `PN-MIG-CHECK-002` covered two unrelated violation kinds; the dotted split separates them.

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
- Codes live with the code that raises them; a new namespace is a new owning module, not an edit to a central registry.
- The ratchet lets the taxonomy freeze at RC while the mechanical sweep of 700+ throw sites trails safely.

### Negative

- No global compile-time guarantee that every code is unique across namespaces — uniqueness is a convention checked by the crosswalk + review, not the type system. (A namespace's own union is enforced locally.)
- The structural predicate accepts any object of the right shape, including a hand-rolled look-alike; this is the deliberate cost of prototype-independence.
- `severity` is retained though nearly every error is `error` today; the `warn`/`info` values earn their place only for advisory lint/budget surfaces.

## Alternatives considered

**A single `StructuredError` base class, recognized by `instanceof`.** Rejected: a shared prototype does not survive the control/execution plane split, JSON round-trips across the network, or duplicate library copies in a monorepo — the exact conditions where errors must still be recognized. The existing code already works around this with duck-typing; a base class would reintroduce the failure it works around. A class is fine as an *implementation convenience* for throwing (as `InternalError` is), but recognition must be structural.

**Two envelopes (CLI presentation vs runtime) sharing only a code format.** Rejected: the split is historical, not principled — four of five systems already carry the same fields. Two shapes means two crosswalks, two docs pipelines, and a conversion type at every boundary between them, for no capability the one shape lacks.

**Keep numeric `PN-DOMAIN-NNNN` codes.** Rejected per the settled scheme decision: dotted names are self-describing, already have 2:1 adoption in the code, and fix the over-broad `RUN` domain. Numeric codes force a lookup table to read any log line.

**One physical union module listing every code.** Rejected: it would have to sit in a low foundation package yet name codes owned by high packages (sql, targets, extensions), inverting the layering that `pnpm lint:deps` enforces. The per-namespace union keeps each code with its owner; the "central registry" is this ADR's crosswalk (documentation), not a type.

**Convert all 700+ throw sites before RC.** Rejected: it is not one coherent review, and it collides with the RC freeze. Only the *codes* must freeze at RC; the conversion is ratcheted down afterward, plane by plane.
