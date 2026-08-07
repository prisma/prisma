# Design — TML-3180: base-type repairs in prisma/prisma

Status: DRAFT — ambiguities 1–10 (end of file) pending operator ruling. Normative parent: [cli-base-types.md](../../cli-base-types.md) § prisma/prisma. Implementer executes exactly; deviations require orchestrator sign-off.

## A.0 Ordering and repo rules

Tests first; no bare casts (the one tempting cast is avoided by narrowing `MigrationToolsError.code` at its declaration, §A.2.4); re-export surfaces keep their shape; rebuild `@internal/errors` and `@internal/migration-tools` dist before downstream validation. Commit sequence: (1) cause support + tests; (2) errorRuntime signature + all call sites + test updates + error-reference; (3) namespace remaps + tests; (4) docs/ADR touch-ups.

## A.1 Repair 1 — `cause` on `CliStructuredError`

`packages/1-framework/1-core/errors/src/control.ts` (self-contained in lines 9–111 — this is the text composer duplicates):

- Constructor options gain `readonly cause?: unknown`; `super(summary, options?.cause !== undefined ? { cause: options.cause } : undefined)` — the foundation's own exactOptionalPropertyTypes pattern (`structured-error.ts` L42–45). No `declare readonly cause` on the class (ES2022 `Error` already declares it). `toEnvelope()`, `CliErrorEnvelope`, `static is()` unchanged. No change to foundation `StructuredError`.

Factory audit — **gain `cause` and forward it**: `errorUnexpected` (control.ts L460), `errorMarkerRowCorrupt` (execution.ts L66), `errorMarkerReadFailed` (L85), `errorLegacyMarkerShape`→`errorRunnerFailed` (L117/L220), `errorRuntime` (as part of §A.2.1). `rethrowMarkerReadError` (L133) passes `cause: err` on its three branches. **Explicitly no `cause`** (input validators with nothing to forward): all remaining control.ts factories, execution.ts's `errorMarkerMissing`/`errorHashMismatch`/`errorTargetMismatch`/`errorMarkerRequired`/`errorSchemaVerificationFailed`/`errorDestructiveChanges`, and all of migration.ts. Forwarding uses `ifDefined('cause', options?.cause)`.

Tests first: errors/test/control.test.ts (cause lands on `error.cause`; omitted → no own property; envelope has no `cause` key); errors/test/execution.test.ts (rethrow paths preserve cause; errorUnexpected/errorRunnerFailed forward).

## A.2 Repair 2 — the `errorRuntime` code leak

### A.2.1 New signature (execution.ts, replaces L259–272)

```ts
export function errorRuntime(
  code: `${string}.${string}`,
  summary: string,
  options?: { readonly why?: string; readonly fix?: string;
              readonly meta?: Record<string, unknown>; readonly cause?: unknown },
): CliStructuredError
```

Verify-specific defaults deleted; the one legitimate verify site restates them. Exit-code behavior untouched (result-handler keys only on `CLI.INIT_USER_ABORTED`).

### A.2.2 Complete call-site census (43 sites; [V] legitimate, [S] smuggled meta.code, [C] codeless)

**Drivers (all [C], gain `cause`)**: sqlite control-driver L41, postgres exports/control L67, mongo exports/control L46 → `DRIVER.CONNECTION_FAILED` (new). Postgres's `meta.code` (a SQLSTATE) renames to `meta.sqlState` (Amb 2).

**cli-errors.ts — the 12 [S] factories**: errorRefSetHashNotInGraph→`MIGRATION.HASH_NOT_IN_GRAPH`; errorRefSetEmptySentinel→`MIGRATION.REF_SET_EMPTY_SENTINEL`; errorLegendHumanOnly→`MIGRATION.LEGEND_HUMAN_ONLY`; errorInvalidSpaceId→`MIGRATION.INVALID_SPACE_ID`; errorSpaceNotFound→`MIGRATION.SPACE_NOT_FOUND`; errorRefSetBundleNotFound→`MIGRATION.REF_SET_BUNDLE_NOT_FOUND`; errorPlanForgotTheFlag→`MIGRATION.HASH_NOT_IN_GRAPH`; errorSnapshotMissing→`MIGRATION.SNAPSHOT_MISSING`; errorMarkerMismatch→`MIGRATION.MARKER_MISMATCH`; errorPathUnreachable→`MIGRATION.PATH_UNREACHABLE`; mapMigrationToolsError→`error.code` (typed via §A.2.4, `cause: error`, meta = `error.details` minus nothing — `code` key deleted); errorAmbiguousMigrationRef→`MIGRATION.AMBIGUOUS_MIGRATION_REF`. In every case the `code:` key is deleted from meta; structural meta fields stay.

**mapRefResolutionError — four [C] branches** (Amb 3): not-found→`MIGRATION.REF_NOT_FOUND`, ambiguous→`MIGRATION.REF_AMBIGUOUS`, wrong-grammar→`MIGRATION.REF_WRONG_GRAMMAR`, invalid-format→`MIGRATION.REF_INVALID_FORMAT` (all new).

**Other CLI sites**: format.ts L59→`CONTRACT.SOURCE_LOAD_FAILED`+cause; L77→`PSL.PARSE_FAILED`+cause (Amb 4); L91→`CLI.FILE_WRITE_FAILED` (new)+cause; contract-emit failedToResolveContractSource (5 uses)→`CONTRACT.SOURCE_LOAD_FAILED` (helper gains meta/cause params); command-helpers L98→`CONFIG.VALIDATION_FAILED`; project-import-root L57→`CLI.PROJECT_MANIFEST_UNREADABLE` (new), L72/L79→`CLI.PROJECT_MANIFEST_INVALID` (new); migration-path-target L24→`MIGRATION.TARGET_NOT_APP_SPACE` (new); migrate.ts L412→`MIGRATION.NO_INVARIANT_PATH` with `meta:{spaceId,missing}` (Amb 5); migrate.ts L583→use `errorRunnerFailed` factory (`MIGRATION.RUNNER_FAILED`); db-init L77 [S]→`MIGRATION.MARKER_ORIGIN_MISMATCH`; db-sign L131→`MIGRATION.SNAPSHOT_MISSING` (Amb 6); migration-show L178/L203→`MIGRATION.PACKAGE_NOT_FOUND` (new), L188→`MIGRATION.NO_MIGRATIONS` (new); ref.ts L69→`MIGRATION.INVALID_REF_NAME`; **db-verify L100 [V]→`CONTRACT.VERIFY_FAILED` with the old defaults restated explicitly**; contract-infer L60→`CONTRACT.INFER_UNSUPPORTED`; migration-new L95→`CLI.FILE_NOT_FOUND` (Amb 7), L110→`MIGRATION.CONTRACT_DESERIALIZATION_FAILED`+cause, L120→`CONTRACT.VALIDATION_FAILED`, L147→`MIGRATION.HASH_NOT_IN_GRAPH`, L164→`MIGRATION.NO_CHANGES` (new).

**Adjacent cleanup**: db-init RUNNER_FAILED branch (L93–108) deletes its bare-word `meta.code`. **Out of scope (recorded)**: `meta.runnerErrorCode` (runner-enum provenance; belongs to the command→result reshape slice; the legacy-init journey pins it).

### A.2.3 New codes

`DRIVER.CONNECTION_FAILED`, `CLI.FILE_WRITE_FAILED`, `CLI.PROJECT_MANIFEST_UNREADABLE`, `CLI.PROJECT_MANIFEST_INVALID`, `MIGRATION.TARGET_NOT_APP_SPACE`, `MIGRATION.PACKAGE_NOT_FOUND`, `MIGRATION.NO_MIGRATIONS`, `MIGRATION.NO_CHANGES`, `MIGRATION.REF_NOT_FOUND`, `MIGRATION.REF_AMBIGUOUS`, `MIGRATION.REF_WRONG_GRAMMAR`, `MIGRATION.REF_INVALID_FORMAT` (+ §A.3's `RUNTIME.CODEC_DESCRIPTOR_INVALID`, `RUNTIME.CODEC_DESCRIPTOR_ARRAY_UNSUPPORTED`). The previously-smuggled codes are already published (the scanner picked up the meta literals) — promoting them makes the reference truthful, no page additions for those.

### A.2.4 Type support

`packages/1-framework/3-tooling/migration/src/errors.ts` L38/L45: `code: string` → `` `MIGRATION.${string}` `` (all construction sites are literals; compiles cast-free; `is()` unchanged).

### A.2.5 Test updates (enumerated; behavior change is the point)

CONTRACT.VERIFY_FAILED assertions that change: errors/test/execution.test.ts L120–133 (new signature + cause cases); cli test/control-api/contract-emit.test.ts L198/204/210→`CONTRACT.SOURCE_LOAD_FAILED`; test/utils/aggregate-loader-preflight.test.ts L79–82→`MIGRATION.INVALID_JSON`, meta.code assertion deleted; test/commands/migration-check-ref-error.test.ts L136→`MIGRATION.REF_NOT_FOUND` (+ stale comment at migration-check.ts L559); test/integration cli.db-init.e2e.errors.test.ts L118→`DRIVER.CONNECTION_FAILED`; output.errors.test.ts L93/L111 fixtures→`CONTRACT.SOURCE_LOAD_FAILED`. control.test.ts L94 unchanged.

meta.code→envelope.code assertion moves: cli-errors.test.ts L54/L161/L178; utils/legend.test.ts L30/38/49; utils/plan-resolution.test.ts L119 (expectRefuse helper) + L395; commands/ref.test.ts L233/252/272/437; migration-list.test.ts L637/652/665/694; migration-read-commands-parity.test.ts L861; migration-check-multi-space*.test.ts (L277/299, L218, L228/248/264). Verified unaffected: contract-space-verifier suites, migration-check journey, legacy-init journey, migration-show-reachability journey.

### A.2.6 Docs

error-reference.md gains one section per new code (house style, Meta lines per site); the `CONTRACT.VERIFY_FAILED` entry is rewritten to its narrowed meaning; smuggled-site entries drop `code` from their Meta lists. `check:error-reference` is the gate; no scanner change needed for repair 2.

## A.3 Repair 3 — namespace drift

Census (verified): `SQL.AST_INVALID` (relational-core ast/types.ts L432/L972), `SQLITE.CODEC_DESCRIPTOR_{ARRAY_UNSUPPORTED,INVALID,DUPLICATE}` (target-sqlite codec-descriptor.ts), `POSTGRES.CODEC_DESCRIPTOR_{INVALID,DUPLICATE}` (target-postgres), `ADAPTER.CAPABILITY_MISSING` (adapter-sqlite L329/336), `EXT.CODEC_BROKEN` (tests only). None published (scanner namespace filter excluded them) → all remaps non-breaking.

Rulings: `SQL.AST_INVALID`→`RUNTIME.AST_INVALID` (Amb 8); `*.CODEC_DESCRIPTOR_DUPLICATE`→`RUNTIME.DUPLICATE_CODEC` with `meta.target`; `*_INVALID`→`RUNTIME.CODEC_DESCRIPTOR_INVALID` (new); `*_ARRAY_UNSUPPORTED`→`RUNTIME.CODEC_DESCRIPTOR_ARRAY_UNSUPPORTED` (new); `ADAPTER.CAPABILITY_MISSING`→`RUNTIME.AST_UNSUPPORTED` with meta target/feature (Amb 9); `EXT.CODEC_BROKEN` untouched (third-party stand-in fixture). ADR 239 gains a "Targets and adapters" clarifying paragraph after "Extensions." (Amb 10); scanner NAMESPACES unchanged. Tests: relational-core select/scalar-projection tests, adapter-sqlite adapter.test.ts L263, new code assertions in target codec tests.

## A.4 Gates

`pnpm --filter @internal/errors test`; `--filter @internal/cli test`; `--filter @internal/migration-tools test`; driver/target/adapter/relational-core package tests; `test/integration` (db-init errors suite + regression); `pnpm check:error-reference`; `lint:casts` (no increase); `lint:throws` (unaffected); `typecheck`; `build`; `lint`.

## Ambiguities — pending operator ruling

1. Keep name `errorRuntime(code, …)` (a), rename to `cliError` (b), or inline the constructor (c). Rec: (a).
2. Postgres driver SQLSTATE: rename `meta.code`→`meta.sqlState` (a) vs keep (b). Rec: (a) — after this slice `meta.code` must read as smuggling.
3. Ref-resolution codes: new `MIGRATION.REF_*` family (a) vs reuse `UNKNOWN_REF`/`AMBIGUOUS_MIGRATION_REF` (b). Rec: (a) — the published meanings differ.
4. format parse-refusal: `PSL.PARSE_FAILED` (a) vs new `CLI.FORMAT_BLOCKED` (b). Rec: (a).
5. migrate unsatisfiable: `MIGRATION.NO_INVARIANT_PATH` slim meta (a) vs `MISSING_INVARIANTS` (b) vs full `errorNoInvariantPath` plumbing (c). Rec: (a).
6. db-sign no-contract-for-hash: reuse `MIGRATION.SNAPSHOT_MISSING` (a) vs new code (b). Rec: (a).
7. migration-new ENOENT: `CLI.FILE_NOT_FOUND` keeping text (a) vs `errorFileNotFound` factory (b). Rec: (a).
8. `SQL.AST_INVALID` → `RUNTIME.AST_INVALID` (a) vs `PLAN.AST_INVALID` (b). Rec: (a).
9. `ADAPTER.CAPABILITY_MISSING` → `RUNTIME.AST_UNSUPPORTED` (a) vs `DRIVER.CAPABILITY_MISSING` (b). Rec: (a).
10. Amend ADR 239 with the targets/adapters paragraph (a) vs PR-only record (b). Rec: (a).
