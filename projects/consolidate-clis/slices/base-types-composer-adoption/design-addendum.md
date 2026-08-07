# Design ADDENDUM — TML-3181: base-type rules 6–7 applied to composer

Status: DRAFT — ambiguities 1–6 (end) pending operator ruling. Applies ON TOP of [design.md](./design.md); sections not named stand. Normative parents: [cli-base-types.md](../../cli-base-types.md) rules 6–7. Repo paths relative to the composer clone.

## A0. Supersession map

DELETED: base §3 row 41 fallback maps (+paragraph). PURGED codes: `COMPOSE.PIPELINE_FAILED`, `DEPLOY.INPUT_INVALID`, `DEV.INPUT_INVALID`, `LOG.INPUT_INVALID`, `LOG.PIPELINE_FAILED`, `LOG.TARGET_UNSUPPORTED`. REPLACED: base rows 30/38 (origin structuring in core), `executorLoadFailure` (§A2.7), base §5 in full (Result reshape, §A7–A10). AMENDED: §4 run.test L470 row, §7 sequence. Verified: every former `invalid-input` origin is already structured (stage/address/flag codes); the purged codes existed only in the deleted maps — nothing orphans.

## A1. Rule-6 origin inventory (dispositions normative)

| # | Origin | Disposition | Code |
| --- | --- | --- | --- |
| N1 | `LoadError` (`core/src/graph-types.ts:67`; 42 raise sites) | class becomes structured, one type-level code | `COMPOSE.GRAPH_INVALID` |
| N2 | `AssembleError` (4 sites in `assemble-services.ts`) | class becomes structured, per-site codes | `ASSEMBLE.*` |
| N3 | foreign build failure (RunAssembler/descriptor `assemble` rejects) | wrap in the `assembleServices` loop, `meta.address`, summary = cause's message (preserves every message pin) | `ASSEMBLE.BUILD_FAILED` |
| N4 | `noLocalTargetSupportError` (`core/src/control/local-target.ts:11`) | returns `CliStructuredError` at origin, summary byte-identical; `LowerError` class untouched (all other sites run in the alchemy child — passthrough exception; execution-plane slice later) | `DEV.TARGET_UNSUPPORTED` (Amb 2) |
| N5 | c12 config-module evaluation throw (`load-config.ts:120` only) | wrap around the `c12.loadConfig` call alone; `where.path` = config path; cause | `CONFIG.EVALUATION_FAILED` |
| N6 | entry import failure not JSX-explained (`load-entry.ts:29`) | wrap at same catch; summary `Failed to import entry module "<path>": <msg>`; `where.path`; cause | `COMPOSE.ENTRY_UNLOADABLE` (reuse) |
| N7 | stack-file write I/O (deploy catch; dev `converge()` write) | wrap at the catch that knows | `DEPLOY.STACK_WRITE_FAILED` / `DEV.STACK_WRITE_FAILED` |
| N8 | alchemy spawn THREW in dev converge | split converge into write-wrap + spawn-wrap; diagnostics with `exitCode: undefined` | `DEV.CONVERGE_FAILED` |
| N9 | executor dynamic-import failure not diagnosed by effect check | wrap (else it renders as a bug — wrong signal) | `DEPS.EXECUTOR_UNLOADABLE` (Amb 3) |
| N10 | attach/endpoints merges (dev L199-201/210; log L173-175) | explicit wraps (outer catches stop coding foreign errors) | `DEV.ATTACH_FAILED` (new) / `LOG.ATTACH_FAILED` |
| N11 | extension hook throws (base rows 22/24/27/28/31–35/39) | UNCHANGED — legal rule-6(ii) site-specific wraps of foreign causes; `toStructured` stays, doc comment: "site-specific wrap for foreign extension/environment causes — passthrough when already structured; never a boundary fallback" | as base |
| N12 | `toposort.ts:58` cycle assertion | reclassified bug → `InternalError`, message unchanged (no test pins it) | none (Amb 6) |
| N13 | `readDeploymentSummary` | never throws — no action | — |
| N14 | clipanion UsageError/`--tail` | unchanged (banner, exit 2) | — |

## A2. Key mechanics (normative)

- **LoadError**: `export class LoadError extends CliStructuredError { constructor(message: string) { super('COMPOSE.GRAPH_INVALID', message); } }` — 42 raise sites untouched; DO NOT set `this.name` (duck-typing depends on `CliStructuredError`); `error.name` change breaks no test (verified — 30 core + 1 cli assertions are class-identity). `toposort.ts` → `InternalError` from foundation. core→foundation dep already exists.
- **AssembleError**: `class AssembleError extends CliStructuredError { constructor(code: AssembleCode, summary, options?) }` with `AssembleCode = 'ASSEMBLE.EXTENSION_MISSING' | 'ASSEMBLE.DESCRIPTOR_MISSING' | 'ASSEMBLE.DESCRIPTOR_KIND_MISMATCH' | 'ASSEMBLE.SERVICE_MISSING' | 'ASSEMBLE.BUILD_FAILED'`. Four sites' summary/why/fix/meta splits per the addendum table (L30 fix→extensions; L37 known-types→why; L43 needs-build-descriptor→why; L67 byte-identical). N3 loop wrap: structured passthrough, else `ASSEMBLE.BUILD_FAILED` with cause + `meta.address`. `assemble/package.json` gains `"@internal/foundation": "workspace:0.6.0"`; exports gain `type AssembleCode`. Destroy's `onAssembleError` keeps re-coding to `DEPLOY.BUILD_REQUIRED` with the structured cause riding as `cause` (Amb 5).
- **Executor catch discipline**: every remaining broad catch becomes `if (CliStructuredError.is(error)) return notOk(error); throw error;` — non-structured past every wrap is a bug and throws. Sites: exec-d-d pipeline prefix + teardown suffix + stage catch (structured → notOk directly); exec-dev L121-126 and L292-299 (keeps its watcher/services cleanup before returning); exec-log L176-181.
- **`executorLoadFailure`**: diagnosed branch re-mints the diagnostic with the import error as `cause` (marker preserved byte-for-byte); else `DEPS.EXECUTOR_UNLOADABLE` with the addendum's normative summary/why/fix.
- **Boundary**: adapters lose all error construction — `main.ts`/`run-dev.ts`/`run-log.ts` rethrow `result.failure` (structured) and nothing else; `cli.ts` = UsageError→2, structured→render+2, else→bug (1 + report hint). `CliError` imports deleted everywhere.

## A4. Final code registry [supersedes base §3 registry]

CONFIG {FILE_MISSING, EXPORT_INVALID, FIELD_INVALID, EXTENSION_DUPLICATE, PATH_MISMATCH, EXTENSION_MISSING, DESCRIPTOR_MISSING, DESCRIPTOR_KIND_MISMATCH, **EVALUATION_FAILED**}; COMPOSE {ENTRY_UNLOADABLE, ENTRY_EXPORT_INVALID, ROOT_NOT_MODULE, NAME_MISSING, **GRAPH_INVALID**}; **ASSEMBLE** {EXTENSION_MISSING, DESCRIPTOR_MISSING, DESCRIPTOR_KIND_MISMATCH, SERVICE_MISSING, BUILD_FAILED} (new namespace, owner `@internal/assemble/assemble-services.ts`); DEPLOY {…base…, **STACK_WRITE_FAILED**, −INPUT_INVALID}; DEV {…base…, **ATTACH_FAILED**, **STACK_WRITE_FAILED**, −INPUT_INVALID}; LOG {PLATFORM_UNSUPPORTED, ATTACH_FAILED, ADDRESS_UNKNOWN}; DEPS {EFFECT_VERSION_CONFLICT, **EXECUTOR_UNLOADABLE**}. ADR-0044 owner-table deltas: ASSEMBLE row; COMPOSE delegates gain core's graph modules; DEV delegates gain `core/control/local-target.ts`; DEPS delegates gain `operations/shared.ts`; note that namespaces raised below the CLI layer are legal — codes are vocabulary, not import edges.

## A7–A8. Rule 7 — OperationFailure collapses (Amb 1 rec)

**Decision (pending ruling): Option (a)** — `export type OperationFailure = CliStructuredError;` The four-member union in `operations/shared.ts` is deleted. Kind becomes DERIVED, never stored:

```ts
export type OperationFailureKind = 'invalid-input' | 'unsupported-platform' | 'pipeline' | 'execution';
export function operationFailureKind(f: OperationFailure): OperationFailureKind {
  switch (f.code) {
    case 'DEPLOY.STAGE_INVALID': case 'DEPLOY.STAGE_UNVALIDATABLE': case 'LOG.ADDRESS_UNKNOWN':
      return 'invalid-input';
    case 'DEV.PLATFORM_UNSUPPORTED': case 'LOG.PLATFORM_UNSUPPORTED':
      return 'unsupported-platform';
    case 'DEPLOY.ENGINE_FAILED': case 'DEV.CONVERGE_FAILED':
      return 'execution';
    default: return 'pipeline';
  }
}
export function executionDiagnostics(f: OperationFailure): ExecutionDiagnostics | undefined; // structural field-checked read of f.meta.diagnostics (blindCast reason = the checks)
```

Engine failures carry `meta: { exitCode, diagnostics: { exitCode, stackFilePath, reproduceCommand, cwd } }` so envelope and helper agree.

## A9. Result-shaped API [supersedes base §5]

- `deploy: Promise<Result<DeploySuccess, OperationFailure>>` with `DeploySuccess { summary: DeploymentSummary | undefined }`.
- `destroy: Promise<Result<void, OperationFailure>>` — success via `okVoid()` (donor precedent; an empty interface invites accretion).
- `dev: Promise<Result<DevSession, OperationFailure>>` — the session IS the value.
- `log: Promise<Result<LogAttached, OperationFailure>>` with `LogAttached { appName, services, lines }`.
- `runStackPipeline` returns `Result<DeploymentSummary | undefined, OperationFailure>`; executeDeploy maps to `ok({summary})`, executeDestroy to `okVoid()`.
- Adapters: `if (result.ok) return 0;` else `renderDeployDestroyFailure(failure)` = read `executionDiagnostics`; exitCode defined → print two hint lines, return the child status (documented ADR-0044 exception); else `throw failure` (cli.ts renders, exit 2). Behavior delta (enumerated): spawn-threw engine failures move from raw-rethrow/exit-1 to rendered envelope/exit-2 — correct under the shared rule.
- `./control` shim exports `Result`/`Ok`/`NotOk` types, success types, `OperationFailure`/`OperationFailureKind`/`ExecutionDiagnostics` types + the two helpers; the `CliStructuredError` CLASS is deliberately not value-exported (hosts recognize via their own foundation copy's predicates — ADR 239 structural recognition). 9-public shim unchanged (`export *`).
- `Result` is in-process only (frozen, getter-backed; not JSON-serializable) — ADR-0043 gains a bullet; the effect-CI probe serializes `failure.toEnvelope()` + a `{name,message}` cause projection and asserts `code === 'DEPS.EFFECT_VERSION_CONFLICT'`, summary marker, cause `{ name: 'Error', message: 'Schedule.either is not a function' }`.

## A6/A10. Test deltas (beyond base §4 tables)

- run.test.ts deploy-assemble (L458-475): expect structured `AssembleError`, `code === 'ASSEMBLE.BUILD_FAILED'`, message pins unchanged. destroy-assemble (L438-456): code `DEPLOY.BUILD_REQUIRED`; why/fix re-targets; cause's code asserted `ASSEMBLE.BUILD_FAILED` (narrow via `.is`, no bare cast).
- assemble-services.test.ts: three regex re-targets (why/fix splits); new tests: rejecting RunAssembler → BUILD_FAILED with meta.address + cause; thrown structured error passes through unwrapped.
- load-config.test.ts: +1 test (throwing config module → `CONFIG.EVALUATION_FAILED`, where.path, cause). load-entry.test.ts: +1 test (non-JSX import failure → `COMPOSE.ENTRY_UNLOADABLE`); JSX cases gain `.where.path` (ruling-6 override). load-graph.test.ts: +`code === 'COMPOSE.GRAPH_INVALID'` on one case.
- operations.test.ts: 49 `outcome` occurrences → `ok` checks; `failure.kind` → `failure.code` (+ one `operationFailureKind` pin per kind); alchemy-42 literal → code/message/`executionDiagnostics()` toEqual; stage case drops its `cause instanceof` line (failure IS the origin). control.deploy.test.ts: `ok === false`, `code === 'ASSEMBLE.BUILD_FAILED'`, both message toContains.
- New cli.test.ts case: non-structured throw out of run() → exit 1 + report hint (pins "no fallback codes" behaviorally).
- Effect-CI script: asserts marker + nonzero (exit 2 qualifies) — no change needed; probe rewrite above.

## A11. Docs

ADR-0043: Result-form grounding snippet; "failures are CliStructuredErrors — code is the branching surface; non-structured escape is a bug and rejects"; Consequences bullets swapped (registry-as-taxonomy + derived kind view; meta.diagnostics; Result not JSON). ADR-0044: rule-6 section, registry/owner deltas, LowerError execution-plane note, extension-hook-wrap rationale. SKILL + deploy-cli.md per addendum. assemble-error.ts header covered by its replacement.

## A12. Sequence

copies+shims+tests → render-error → core/assemble origin structuring → CLI site replacement + new wraps + delete cli-error.ts → Result reshape → boundary/exit codes → test updates → docs. Gates: base §7 + `lint:deps` after the assemble dep + cast ratchet covers `executionDiagnostics`.

## Ambiguities — pending operator ruling

1. **OperationFailure shape**: (a) collapse to `CliStructuredError`, kind derived, diagnostics in `meta.diagnostics` — one error currency, rules 3/5 exact; (b) keep object union with required envelope. Rec: (a).
2. **`noLocalTargetSupportError` code**: (a) `DEV.TARGET_UNSUPPORTED` at origin (log surfaces the DEV code; LOG.TARGET_UNSUPPORTED purged); (b) target-neutral COMPOSE code; (c) per-command wraps. Rec: (a).
3. **Undiagnosed executor-load failure**: (a) `DEPS.EXECUTOR_UNLOADABLE` (environmental, exit 2); (b) bug path. Rec: (a).
4. **LoadError granularity**: (a) one type-level `COMPOSE.GRAPH_INVALID` now; per-site subcodes a future slice; (b) re-author 42 sites now. Rec: (a).
5. **Destroy re-codes a structured `ASSEMBLE.BUILD_FAILED` to `DEPLOY.BUILD_REQUIRED`**: (a) keep (command-specific reframing, origin in cause); (b) pass through + adapter-appended fix. Rec: (a).
6. **`toposort.ts:58` → `InternalError`**: (a) as designed (site's own comment declares it an invariant); (b) keep as LoadError. Rec: (a).
