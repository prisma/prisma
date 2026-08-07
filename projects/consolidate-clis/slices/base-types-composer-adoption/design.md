# Design — TML-3181: composer adopts the shared error foundation

Status: PARTIALLY RULED 2026-08-07 — 1–4 recommendations adopted; 5: canonical slug is **prisma/composer** — the bug-report URL uses it AND this slice fixes composer's `package.json#repository` field (currently `prisma/compose`, a mistake); 6: **OVERRIDDEN — populate `where`** on the sites with natural paths (config path: sites 1, 3, 5; entry path: sites 9, 10) since the rendered `Where:` line prints to the user/executing agent — the renderer already handles it, add the corresponding `.where` assertions to the §4 test updates; 7: PENDING operator ruling on the `COMPOSE.PIPELINE_FAILED` fallback name. Normative parent: [cli-base-types.md](../../cli-base-types.md) § composer. Target branch: `tml-3174-composer-programmatic-deploy-api` (merges first). Donor: prisma/prisma foundation files. Implementer executes exactly.

## 1. Placement

Foundation copies go in the existing private `@internal/foundation` (`packages/0-framework/0-foundation/foundation/`) — already classified by the architecture glob, nothing new publishes. New files: `src/{defined,structured-error,internal-error,result,cli-structured-error}.ts` (the last = donor `errors/src/control.ts` L1–111 only; factories do not travel). `casts.ts` does not travel (composer's is byte-identical, verified). Two new subpaths via exports shims: `@internal/foundation/errors` (StructuredError types+predicates+factory, docsUrlFor/DOCS_BASE, InternalError/isInternalError/assertNever, CliStructuredError, CliErrorEnvelope, CliErrorConflict) and `@internal/foundation/result` (Result/Ok/NotOk, ok/notOk/okVoid). `ifDefined` stays internal. Wiring: tsdown object entries `errors`/`result`; generated exports map committed via build; two `tsconfig.depcruise.json` aliases. No dependency edits (`@internal/cli` already depends on foundation). Depcruise: tooling→foundation is downward, legal.

## 2. The duplication

Byte-close to donor, exactly these deltas:
- One-line header on each copied file: `// Duplicated from the prisma/prisma error foundation pending extraction into a shared package — keep byte-close to the donor; recognition is structural, so the copies interoperate.`
- Import specifiers gain `.ts` extensions; `cli-structured-error.ts`'s `@internal/utils/*` imports collapse to local `./defined.ts`/`./structured-error.ts`; the ADR-239 relative link in its doc comment becomes plain text (`See ADR 239 in prisma/prisma and composer's ADR-0044`).
- Bare-cast repairs (composer's ratchet counts new bare `as`): `result.ts` private-constructor casts and `is()`'s probe cast become `blindCast` with the reasons recorded in the source design. Donor biome suppressions carried verbatim.
- The `cause` repair baked into the copied class from day one: options gain `readonly cause?: unknown`; `super(summary, options?.cause !== undefined ? { cause: options.cause } : undefined)`; `toEnvelope()` untouched. Everything else verbatim (incl. `DOCS_BASE` — Amb 3) so the extraction slice can diff mechanically.

## 3. CliError replacement

### Closed namespace list (ADR-0044)

| Namespace | Concern | Owning module (delegates) |
| --- | --- | --- |
| `CONFIG` | discovery/loading/shape/coverage of prisma-composer.config.ts | load-config.ts (validate-coverage.ts) |
| `COMPOSE` | topology loading: entry, root node, graph shape, naming | pipeline.ts (load-entry.ts) |
| `DEPLOY` | target selection, stage, containers, preflight, engine, teardown | operations/execute-deploy-destroy.ts (main.ts, validate-stage.ts, run-alchemy.ts) |
| `DEV` | local dev pipeline and session | operations/execute-dev.ts |
| `LOG` | log attach and tail | operations/execute-log.ts |
| `DEPS` | the consumer's installed dependency tree | check-effect-resolution.ts |

### Per-site code table (▲ = message text changes → §4 test updates)

Replacement is `new CliStructuredError(code, summary, { why?, fix?, meta?, cause? })`; `cli-error.ts` deleted; `exports/index.ts` re-exports `CliStructuredError` from foundation.

| # | Site | Code | Notes |
| --- | --- | --- | --- |
| 1▲ | load-config.ts:38 missingConfigError | `CONFIG.FILE_MISSING` | fix names defineConfig import |
| 2▲ | load-config.ts:46 fieldError | `CONFIG.FIELD_INVALID` | meta `{field}`; fix → "See defineConfig() …" |
| 3▲ | load-config.ts:63 empty export | `CONFIG.EXPORT_INVALID` | |
| 4 | load-config.ts:92 duplicate id | `CONFIG.EXTENSION_DUPLICATE` | |
| 5▲ | load-config.ts:134 c12 mismatch | `CONFIG.PATH_MISMATCH` | refusal rationale → why |
| 6▲ | validate-coverage.ts:23 | `CONFIG.EXTENSION_MISSING` | meta `{extension, type}` |
| 7▲ | validate-coverage.ts:30 | `CONFIG.DESCRIPTOR_MISSING` | known types → why |
| 8 | validate-coverage.ts:35 | `CONFIG.DESCRIPTOR_KIND_MISMATCH` | meta `{extension, type, kind}` |
| 9▲ | load-entry.ts:28 JSX | `COMPOSE.ENTRY_UNLOADABLE` | `explainJsxLoadError` returns `{summary, why, fix}`; cause = original |
| 10▲ | load-entry.ts:37 not a node | `COMPOSE.ENTRY_EXPORT_INVALID` | fix: "Construct it with service() or module() …" |
| 11▲ | pipeline.ts:98 root not module | `COMPOSE.ROOT_NOT_MODULE` | |
| 12▲ | pipeline.ts:65+110 empty name | `COMPOSE.NAME_MISSING` | fix: "Name it at authoring, or pass --name." |
| 13▲ | main.ts:267 deploy --production | `DEPLOY.FLAG_INVALID` | |
| 14▲ | main.ts:280 both flags | `DEPLOY.TARGET_CONFLICT` | |
| 15▲ | main.ts:283 bare destroy | `DEPLOY.TARGET_MISSING` | |
| 16 | validate-stage.ts:10 git missing | `DEPLOY.STAGE_UNVALIDATABLE` | cause |
| 17 | validate-stage.ts:15 invalid ref | `DEPLOY.STAGE_INVALID` | |
| 18▲ | run-alchemy.ts:23 no bin | `DEPLOY.ALCHEMY_BIN_MISSING` | fix: add alchemy dependency |
| 19▲ | check-effect-resolution.ts | `DEPS.EFFECT_VERSION_CONFLICT` | `effectMismatchError` returns parts; summary keeps `alchemy resolves effect@` (CI marker preserved); fix = overrides snippet; meta `{found, required}` |
| 20▲ | exec-d-d.ts:128 destroy assemble | `DEPLOY.BUILD_REQUIRED` | summary = original message; destroy rationale → why; "Run the build…" → fix; cause |
| 21▲ | exec-d-d.ts:152 locate miss | `DEPLOY.TARGET_NOT_FOUND` | summary "Nothing deployed for X." ; fix "Deploy it first." |
| 22 | exec-d-d.ts:161 container wrap | `DEPLOY.CONTAINER_FAILED` | via `toStructured` |
| 23 | exec-d-d.ts:174 no scope | `DEPLOY.SCOPE_MISSING` | per-command fix text as today |
| 24 | exec-d-d.ts:197 preflight wrap | `DEPLOY.PREFLIGHT_FAILED` | toStructured |
| 25 | exec-d-d.ts:255 spawn threw | `DEPLOY.ENGINE_FAILED` | cause |
| 26 | exec-d-d.ts:266 nonzero | `DEPLOY.ENGINE_FAILED` | summary byte-identical; meta `{exitCode}` |
| 27 | exec-d-d.ts:291 teardown wrap | `DEPLOY.TEARDOWN_FAILED` | toStructured |
| 28 | exec-d-d.ts:308 remove wrap | `DEPLOY.CONTAINER_REMOVE_FAILED` | toStructured |
| 29 | exec-dev.ts:50 win32 | `DEV.PLATFORM_UNSUPPORTED` | |
| 30–35 | exec-dev.ts wraps (localTargets, ensure, fresh, preflight, emulators, startServices) | `DEV.TARGET_UNSUPPORTED` / `DEV.CONTAINER_FAILED` / `DEV.TEARDOWN_FAILED` / `DEV.PREFLIGHT_FAILED` / `DEV.EMULATOR_FAILED` / `DEV.SERVICE_START_FAILED` | toStructured |
| 36 | exec-dev.ts converge nonzero | `DEV.CONVERGE_FAILED` | meta `{exitCode}` |
| 37 | exec-log.ts:140 win32 | `LOG.PLATFORM_UNSUPPORTED` | |
| 38–39 | exec-log.ts wraps | `LOG.TARGET_UNSUPPORTED` / `LOG.ATTACH_FAILED` | toStructured |
| 40 | exec-log.ts unknown address | `LOG.ADDRESS_UNKNOWN` | summary byte-identical (operations.test.ts:1049 pins) |
| 41 | adapter rethrow fallbacks | per-adapter maps below | |

Shared helper in `operations/shared.ts`: `toStructured(code, error)` — passthrough if `CliStructuredError.is`, else wrap with cause. `executorLoadFailure` guard switches to `CliStructuredError.is`; failure gains `error: diagnostic.toEnvelope()`.

Adapter fallback maps (row 41; replaces `cause instanceof Error ? throw cause : new CliError(...)`): main.ts — invalid-input→`DEPLOY.INPUT_INVALID`, pipeline→`COMPOSE.PIPELINE_FAILED`, execution→`DEPLOY.ENGINE_FAILED`, unsupported-platform→`COMPOSE.PIPELINE_FAILED` (unreachable); run-dev — `DEV.INPUT_INVALID` / `COMPOSE.PIPELINE_FAILED` / `DEV.PLATFORM_UNSUPPORTED` / `DEV.CONVERGE_FAILED`; run-log — `LOG.INPUT_INVALID` / `COMPOSE.PIPELINE_FAILED` / `LOG.PLATFORM_UNSUPPORTED` / `LOG.PIPELINE_FAILED` (unreachable). Structured causes rethrow as-is.

Closed subcode registry (ADR-0044 appendix): CONFIG {FILE_MISSING, EXPORT_INVALID, FIELD_INVALID, EXTENSION_DUPLICATE, PATH_MISMATCH, EXTENSION_MISSING, DESCRIPTOR_MISSING, DESCRIPTOR_KIND_MISMATCH}; COMPOSE {ENTRY_UNLOADABLE, ENTRY_EXPORT_INVALID, ROOT_NOT_MODULE, NAME_MISSING, PIPELINE_FAILED}; DEPLOY {FLAG_INVALID, TARGET_CONFLICT, TARGET_MISSING, TARGET_NOT_FOUND, STAGE_INVALID, STAGE_UNVALIDATABLE, SCOPE_MISSING, CONTAINER_FAILED, PREFLIGHT_FAILED, ENGINE_FAILED, TEARDOWN_FAILED, CONTAINER_REMOVE_FAILED, BUILD_REQUIRED, ALCHEMY_BIN_MISSING, INPUT_INVALID}; DEV {PLATFORM_UNSUPPORTED, TARGET_UNSUPPORTED, CONTAINER_FAILED, TEARDOWN_FAILED, PREFLIGHT_FAILED, EMULATOR_FAILED, SERVICE_START_FAILED, CONVERGE_FAILED, INPUT_INVALID}; LOG {PLATFORM_UNSUPPORTED, TARGET_UNSUPPORTED, ATTACH_FAILED, ADDRESS_UNKNOWN, PIPELINE_FAILED, INPUT_INVALID}; DEPS {EFFECT_VERSION_CONFLICT}.

## 4. Rendering and exit codes

New `cli/src/render-error.ts` — `renderErrorEnvelope(envelope)`: `✖ summary (CODE)` + indented Why/Fix/Where lines; no color; no conflicts/meta/docsUrl blocks (composer has no -v). `cli.ts`: UsageError → clipanion message, exit **2** (was 1); `CliStructuredError.is` → rendered envelope, exit **2**; anything else → `Error: message` + report hint (repo issues URL — Amb 5), exit **1**. `HelpRequested` stays 0. Alchemy child status passthrough unchanged (documented exception in ADR-0044). Signals unchanged. `bin.ts` renders structured errors, exits 2, otherwise rethrows; effect-CI marker assertions preserved.

Test-change enumeration (all expected-value updates; the 1c byte-identity invariant is deliberately superseded): `run.test.ts` — import swap CliError→CliStructuredError (15 instanceOf/`toThrow` sites); per-line table in the source design: config/coverage errors gain `.code` assertions and fix-clause re-targets (L287–348), preflight L405 + code, alchemy-42 block unchanged, destroy-needs-build L450 re-targets why/fix, deploy-assemble L470→`COMPOSE.PIPELINE_FAILED`, target flags L557–591 (fix re-targets), Nothing-deployed L660/676 summary/fix split, scope L829–859 fix re-targets, child-status L917/1053 unchanged, teardown L1016+code. `load-config.test.ts` (fix re-target L112; field regexes still match summaries; L103 unchanged), `validate-stage.test.ts` (import only), `check-effect-resolution.test.ts` (parts-object re-targets; `/Dependency conflict/` unchanged), `run-log.test.ts`/`operations.test.ts` (import swaps; all pinned failure.message strings unchanged by construction; add `failure.error?.code` assertions at L388/409/441/464/571/1049), `load-entry`/`jsx-load-error` (parts re-targets). node-compat and local-dev integration suites: unchanged (assert nonzero / preserved substrings).

## 5. OperationFailure integration

Every union member gains `readonly error?: CliErrorEnvelope | undefined`; kinds stay; message/cause primary. Helper `operationFailure(kind, cause)` populates `error: cause.toEnvelope()` when structured. Engine-failure sites construct the structured error first so `failure.error.meta.exitCode` agrees with `failure.diagnostics.exitCode`. `failure.message` becomes the envelope summary at ▲-origin sites. Published types: `@internal/cli`'s control shim adds `export type { CliErrorEnvelope } from '@internal/foundation/errors';` — flows to `@prisma/composer/control` with zero 9-public edits. Text updates: ADR-0043 failures paragraph + Consequences bullet (branch on `failure.error?.code`), SKILL § driving-deploys bullet, deploy-cli.md § Error surface intro, assemble-error.ts header comment (CliError mentions).

## 6. ADR-0044 — full text as drafted

Full proposed text (decision, six-namespace list with owners, structural recognition, bugs-carry-no-code, exit-code rule with the child-status exception, human layout, reasoning, consequences, alternatives incl. the rejected `domain` field and the rejected passthrough renumbering, related links) is in the design agent's output and travels verbatim into `docs/design/90-decisions/ADR-0044-errors-are-structural-envelopes-with-dotted-namespace-codes.md` + README index entry. Implementer takes the text from this repo's git history of this design (commit carrying this file) — it is normative.

## 7. Tests and gates

Donor foundation tests travel (vitest→bun:test, path deltas): structured-error/result/internal-error suites + the CliStructuredError blocks of donor control.test.ts (+ two new cause cases). New render-error.test.ts (four-line layout) and cli.test.ts (exit codes 2/2/1). Changed suites per §4. Gates: typecheck, bun tests, biome + cast ratchet (blindCast repairs keep delta 0), lint:deps (aliases added; downward edges only), publishable-location (nothing new publishes), framework-vocabulary (verified on copies), check-npm-effect-resolution (marker + nonzero preserved), control-import light-graph test (foundation dependency-free). Sequence: copies+shims+tests → render-error → site replacement + OperationFailure + delete cli-error.ts → cli/bin exit codes → test updates → ADR + doc edits.

## Ambiguities — pending operator ruling

1. Foundation subpath granularity: two subpaths `/errors` + `/result` (a) vs donor per-file mirroring (b). Rec: (a).
2. Inline `new CliStructuredError(...)` at sites (a) vs a central factory module like prisma/prisma's cli-errors.ts (b). Rec: (a) — context-heavy texts live beside their pipelines; revisit at extraction.
3. Copied `docsUrlFor`/`DOCS_BASE` point at prisma ORM docs; no composer site sets docsUrl. Copy verbatim (a) vs strip (b). Rec: (a) — byte-closeness wins.
4. Usage errors: clipanion banner at exit 2 (a) vs structured `CLI.USAGE_INVALID` envelope (b). Rec: (a); host CLI revisits.
5. Bug-report URL: manifest says repo `prisma/compose`, the repo is referred to as `prisma/composer`. Confirm the canonical slug (one string in cli.ts).
6. `where` fields: none populated (a) vs populate on config/entry sites (b). Rec: (a), defer until the Where line has a consumer.
7. Non-structured pipeline-cause fallback: single `COMPOSE.PIPELINE_FAILED` (a) vs per-command `*.PIPELINE_FAILED` (b). Rec: (a) — they are shared-pipeline concerns; finer taxonomy is its own future slice.
