# Design — Composer programmatic API (`@prisma/composer/control`)

Status: DRAFT — ambiguities 1–6 (end of file) pending operator ruling. Implementer executes this design exactly; deviations require orchestrator sign-off.

All paths relative to the composer repo root (working clone: `wip/repos/composer`).

## 1. Current behavior — exhaustive map

### 1.1 Process entry & crash-safety preflight (TML-3158)

`packages/0-framework/3-tooling/cli/src/bin.ts`:

- L13–21: calls `checkEffectResolution(process.cwd())` **before any other import resolves the alchemy-touching graph**; a `CliError` prints `Error: <message>` and exits 1.
- L23–24: only then `await import('./cli.ts')` — the dynamic import keeps clipanion/c12/`@internal/core` (→ effect/alchemy provider tree) out of `bin.ts`'s static graph. The comment (L5–12) records that a mismatched `effect` crashes *at import time*, and that even `--help` would crash — the check must run first, always.

`check-effect-resolution.ts` imports only `node:fs`, `node:module`, `node:path`, and `cli-error.ts` (L11–14) — importable from anywhere with zero risk. Pieces: `findAlchemyPackageDir` (L17–26), `resolveEffectVersionFrom` (L34–52), `requiredEffectVersion` (L64–82), pure `effectMismatchError` (L85–98), and the composed `checkEffectResolution(cwd)` (L101–109) which is a no-op when either side is unresolvable — safe to run twice.

`cli.ts` (L8–20): `cli(argv)` = `run(argv)` → `process.exitCode`; catches `UsageError` (print message, exit 1) and any other error (`Error: <message>`, exit 1).

### 1.2 `deploy` / `destroy` — `main.ts` `run()` step by step

1. **Parse** — `parseArgs(argv)` (L151–214), clipanion `Cli.from([DeployCommand, DestroyCommand, DevCommand, LogCommand])` (L117–122); command classes are parse-only shells (`execute()` returns 0, L41–43). Produces `ParsedArgs` (L134–145). `--help` → `HelpRequested` → printed, exit 0 (L266–271).
2. **Flag semantics** — `effectiveStage(args)` (L226–245): deploy + `--production` → `CliError`; destroy with both `--stage` and `--production` → `CliError`; destroy with neither → `CliError`; result: deploy → `args.stage` (undefined = production), destroy → `undefined` for `--production`, else the stage.
3. **Stage validation** — `validateStageName(stage)` when defined (L291); `validate-stage.ts` L5–19: `git check-ref-format refs/heads/<stage>` via `spawnSync`; `CliError` on git-missing or invalid.
4. `cwd = process.cwd()` (L292).
5. **Destroy warning** (step 0, L298–300): `warnIfNoLocalDeployState(cwd)` (L250–259) — `console.warn` when `<cwd>/.alchemy` missing/empty; runs *before* the pipeline.
6. **Steps 1–6, shared pipeline** — `runPipeline(entry, name, cwd, {runAssembler, config}, onAssembleError)` (L304–319; `pipeline.ts` L77–125): config discovery walk-up (`load-config.ts` `findConfigPathForEntry` L27–36) → c12 load + field-by-field validation (`loadAppConfig` L119–141, `validateConfigShape` L61–112) → entry import (`load-entry.ts` L21–50) → `Load(root)` + root-must-be-module check (pipeline L96–102) → `validateRegistryCoverage` (L105) → name resolution (L108–111) → `assembleServices(graph, config, cwd, runAssembler)` (pipeline L114–121). Destroy decorates assemble failures with "build first" guidance (main.ts L305–312).
7. **Step 7, containers** (L326–345): per extension with a `container` descriptor — deploy `ensure({appName, stage})`, destroy `locate(...)` (undefined → `CliError` "Nothing deployed for …"); non-CliErrors wrapped into `CliError`.
8. **Step 7.3, alchemy stage pinning** (L351–364): `containers.get(config.state.extension)?.alchemyStage ?? stage`; undefined → `CliError` (command-specific remedy text).
9. **Step 7.5, deploy-only extension preflight** (L370–381): `extension.preflight({graph, container, stage})`; failure before any side effect.
10. **Step 8, stack file** (L384–390): `writeStackFile(...)` → `.prisma-composer/alchemy.run.ts` (`generate-stack.ts` L59–91); the generated module wires `report: deploymentReport` imported from `@prisma/composer/report` (L64–78) — **the report hook runs in the alchemy child process, not in `run()`'s process**.
11. **Step 9, spawn alchemy** (L392–410): `(deps.alchemy ?? runAlchemy)({command, stackFileRelativePath, cwd, stage: alchemyStage, containerEnv})`; `run-alchemy.ts` L46–61 `spawnSync`s the walked-up `node_modules/.bin/alchemy` with `--yes --stage <stage>`, `stdio: 'inherit'`, env = `(input.env ?? process.env) + containerEnv`. Nonzero status → two `console.error` hints (stack file path + exact repro command, L402–408); `run()` returns that status. A thrown spawn error → stack-file hint printed (L448), error rethrown (L449).
12. **Steps 9.5/9.75, destroy-only teardown then container removal** (L416–443): all `extension.teardown(...)` first, then all `container.remove(...)` — the two-loop order is ADR-0034's DB-before-Branch guarantee.

### 1.3 `dev` — `dev/run-dev.ts` `runDev()`

L86–292: win32 guard (L87–89) → shared pipeline (L96–102) → `resolveLocalTargets(config)` (L109–114) → local containers `ensure` (L117–124) → `--fresh` teardown (L127–136) → local preflight (L139–146) → emulator daemons (L149–156; detached children live *inside the extensions' `emulators` hooks*) → `converge()` writes `.prisma-composer/dev/...` stack (`generate-dev-stack.ts`, no `report` hook) and runs `alchemy deploy … --stage dev` (L158–185) → attach + `startServices()` with rollback on partial failure (L190–206) → front door print via `renderFrontDoor` (L41–57, exported for tests) + `[dev] logs:` hint (L207–211) → watch loop (L215–256: rebuild → re-pipeline → re-converge; failures print `[dev] rebuild failed:` / `[dev] converge failed…` and keep running) → **signal ownership** (L258–289): `process.removeAllListeners('SIGINT'/'SIGTERM')` (evicting alchemy's own import-time listeners — comment L279–284) then a single `finish()` (stop watch, `stopServices()` per attachment, `[dev] stopping…`/`[dev] stopped.`, return 0).

### 1.4 `log` — `log/run-log.ts` `runLog()`

L40–115: win32 guard → `resolveAppIdentity` (config + name only; `pipeline.ts` L50–68) → `resolveLocalTargets` → per target `container.ensure` + `attach` (L59–67) → endpoints merge; zero services → `console.error('[log] no running services …')`, exit 0 (L69–75); unknown `address` → `CliError` listing running services (L76–81) → `AbortController` + SIGINT/SIGTERM handlers (L84–87) → per attachment `for await` over `attachment.logs(signal, {tail})` printing `[<service>] <line>`, per-stream failures printed as `[log] stream failed: …` (L89–108) → handlers removed, exit 0.

### 1.5 Existing seams to reuse

- `RunDeps` injection: `{runAssembler?, alchemy?, config?}` (main.ts L217–223), mirrored by `DevRunDeps` (run-dev.ts L28–32) and `LogRunDeps` (run-log.ts L26–31, plus `identity`).
- Result/render split (ADR-0033 §S3): `DeploymentResult`/`DeployedNode`/`DeployedEntity` in `packages/0-framework/1-core/core/src/control/deploy.ts` L157–193; pure `renderDeployment(result): string` in `cli/src/render-deployment.ts` L76–115; `deploymentReport` (L121–124) is the console adapter wired into the generated stack file. `DeployedNode` is explicitly "**in-process only** (it holds the node itself, so it never crosses the stack boundary)" (deploy.ts L181) — this drives the serializable-summary design in §3.4.
- `@internal/assemble` is already CLI-free (`docs/design/10-domains/deploy-cli.md` L193–201; its package.json names "the future programmatic deploy API" as its second consumer).

## 2. Placement, entrypoint, and layering

### 2.1 Where the API lives: inside `@internal/cli`, published as `@prisma/composer/control`

- **No new workspace package.** ADR-0027/ADR-0028 + `scripts/lint-publishable-location.mjs` make `packages/9-public/` the only publishable location. The operations need `pipeline.ts`, `run-alchemy.ts`, `generate-stack.ts`, `check-effect-resolution.ts`, `dev/*`, `log/*` — all already in `@internal/cli`.
- **Entrypoint name `./control`** (pending Ambiguity 1): matches `architecture.config.json`'s `plane: "control"` classification of the CLI sources, the existing `/control` subpaths (`@prisma/composer/node/control`, `/nextjs/control`, `@prisma/composer-prisma-cloud/control`), the slice spec's suggestion, and prisma-next's `cli/control-api` precedent.
- **Wiring pattern copied from `/report`**: `@internal/cli` implementation modules outside `exports/`, shim at `src/exports/control.ts` (ADR-0035 / `.agents/rules/exports-entrypoints.mdc`: shim holds only re-exports; the generated `@internal/cli` `package.json#exports` map is committed, not hand-edited). 9-public: `packages/9-public/composer/src/exports/control.ts` → `export * from '@internal/cli/control';`, a `control:` object entry in the first pass of `packages/9-public/composer/tsdown.config.ts`, and a hand-added `"./control": "./dist/control.mjs"` line in `packages/9-public/composer/package.json` (the documented hand-maintained exception).
- `tsconfig.depcruise.json`: add `"@internal/cli/control"` → `./packages/0-framework/3-tooling/cli/src/exports/control.ts` (before the bare `"@internal/cli"` key, following the `/report`/`/bin` ordering at L39–43) and `"@prisma/composer/control"` → `./packages/9-public/composer/src/exports/control.ts` (before the bare key, L156). Required by `scripts/lint-architecture-coverage.mjs`.
- `architecture.config.json`: add one per-file entry for the new 9-public shim, cloned from the `report.ts` entry (L687–692): `{ "glob": "packages/9-public/composer/src/exports/control.ts", "domain": "public", "layer": "public", "plane": "control" }`.

### 2.2 Bundle-graph constraint (crash safety)

The published `dist/control.mjs` is built with `noExternal: [/^@internal\//]` — whatever the shim's static graph reaches gets inlined and executes at import time in the host process. Therefore the operations entry module (§3.1) may statically import **only**: type-only imports (erased), `check-effect-resolution.ts`, `cli-error.ts`, and the results module — never `main.ts`, `pipeline.ts`, `@internal/core` value imports, or anything else that transitively reaches effect/alchemy. Heavy executors are reached by dynamic `import()` (rolldown code-splits these into lazy chunks). Same structure as `bin.ts`, moved inside the operation functions.

## 3. The API — complete specification

All new implementation files under `packages/0-framework/3-tooling/cli/src/operations/`.

### 3.1 `src/operations/operations.ts` — the four entry functions (light module)

```ts
/**
 * The programmatic control surface over the deploy pipeline — @internal/assemble's
 * second consumer (deploy-cli.md § Contracts). Typed inputs, structured results,
 * no argv, no console, no process.exit. The prisma-composer CLI (main.ts) is a
 * thin renderer over these operations.
 *
 * Crash safety (TML-3158, mirrors bin.ts): this module's STATIC graph must stay
 * free of the alchemy-touching tree — a mismatched `effect` crashes that tree at
 * import time. Each operation runs checkEffectResolution() first and only then
 * dynamically imports its executor.
 */
import { checkEffectResolution } from '../check-effect-resolution.ts';
import { CliError } from '../cli-error.ts';
import type { DeployInput, DeployResult, DestroyInput, DestroyResult,
  DevInput, DevStartResult, LogInput, LogResult } from './results.ts';

export async function deploy(input: DeployInput): Promise<DeployResult>;
export async function destroy(input: DestroyInput): Promise<DestroyResult>;
export async function dev(input: DevInput): Promise<DevStartResult>;
export async function log(input: LogInput): Promise<LogResult>;
```

Each body is the same five lines, e.g. for `deploy`:

```ts
export async function deploy(input: DeployInput): Promise<DeployResult> {
  const cwd = input.cwd ?? process.cwd();
  const preflight = runEffectPreflight(cwd);
  if (preflight !== undefined) return { outcome: 'failed', failure: preflight };
  const { executeDeploy } = await import('./execute-deploy-destroy.ts');
  return executeDeploy(input, cwd);
}
```

with the shared helper:

```ts
/** Structured form of bin.ts's preflight: a mismatched tree is a result, not a crash. */
function runEffectPreflight(cwd: string): OperationFailure | undefined {
  try {
    checkEffectResolution(cwd);
    return undefined;
  } catch (error) {
    if (error instanceof CliError) {
      return { kind: 'effect-resolution', message: error.message, cause: error };
    }
    throw error; // a bug in the check itself, not a user-tree condition
  }
}
```

`dev` and `log` also run the preflight — their executors import the same crashy tree.

### 3.2 `src/operations/results.ts` — types (zero runtime imports from the heavy tree)

Only `import type` from `@internal/assemble` (`RunAssembler`), `@internal/core/config` (`PrismaAppConfig`), `@internal/core/deploy` (`DeployedEntity`), `../run-alchemy.ts` (`RunAlchemyInput`), `../pipeline.ts` (`AppIdentity`), `../render-deployment.ts` (`DeploymentSummary`). All erased in the build.

```ts
/** The injectable seams every operation shares — identical to main.ts's RunDeps
 * (which becomes a re-export alias of this type; see §5 main.ts). */
export interface OperationDeps {
  readonly runAssembler?: RunAssembler | undefined;
  readonly alchemy?: ((input: RunAlchemyInput) => number) | undefined;
  readonly config?: PrismaAppConfig | undefined;
}

/** Why an operation did not complete. `message` is the same fix-naming text the
 * CLI prints today; `cause` is the original thrown error. */
export type OperationFailure =
  /** TML-3158: alchemy would resolve a mismatched `effect`; nothing was imported, nothing ran. */
  | { readonly kind: 'effect-resolution'; readonly message: string; readonly cause?: unknown }
  /** A typed input was rejected (invalid --stage ref name, unknown log address). */
  | { readonly kind: 'invalid-input'; readonly message: string; readonly cause?: unknown }
  /** The host platform cannot run this operation (dev/log on win32). */
  | { readonly kind: 'unsupported'; readonly message: string; readonly cause?: unknown }
  /** Any failure between config discovery and the alchemy spawn: missing config,
   * bad entry export, LoadError, coverage miss, assemble, container, extension preflight.
   * (Finer-grained diagnostics are the next slice.) */
  | { readonly kind: 'pipeline'; readonly message: string; readonly cause?: unknown }
  /** The alchemy child ran and failed. `exitCode` undefined means the spawn itself threw. */
  | { readonly kind: 'execution'; readonly message: string; readonly exitCode: number | undefined;
      readonly stackFilePath: string; readonly reproduceCommand: string;
      readonly cwd: string; readonly cause?: unknown };

export interface DeployInput {
  /** Path to the entry module, resolved against `cwd` — same contract as `prisma-composer deploy <entry>`. */
  readonly entry: string;
  /** Override the root node's name (the `--name` flag's slot). */
  readonly name?: string | undefined;
  /** Target stage. ABSENT = production — bare deploy targets production (main.ts effectiveStage). */
  readonly stage?: string | undefined;
  /** Defaults to process.cwd(); the directory `.prisma-composer/` and `.alchemy` state live under. */
  readonly cwd?: string | undefined;
  readonly deps?: OperationDeps | undefined;
}

export type DeployResult =
  | { readonly outcome: 'deployed';
      /** Parsed from the alchemy child's result file (§3.4). Undefined when the child
       * did not write one (injected fake alchemy, or a report-less apply). */
      readonly summary: DeploymentSummary | undefined }
  | { readonly outcome: 'failed'; readonly failure: OperationFailure };

/** Destroy must name its target explicitly — no silent default to production. Encoded, not re-derived from flags. */
export type DestroyTarget =
  | { readonly kind: 'production' }
  | { readonly kind: 'stage'; readonly stage: string };

export type DestroyEvent =
  /** Emitted before the pipeline when `<cwd>/.alchemy` is missing/empty. */
  | { readonly kind: 'no-local-deploy-state'; readonly cwd: string };

export interface DestroyInput {
  readonly entry: string;
  readonly name?: string | undefined;
  readonly target: DestroyTarget;
  readonly cwd?: string | undefined;
  /** Mid-operation notifications, in real time. Rendering is the host's. */
  readonly onEvent?: ((event: DestroyEvent) => void) | undefined;
  readonly deps?: OperationDeps | undefined;
}

export type DestroyResult =
  | { readonly outcome: 'destroyed' }
  | { readonly outcome: 'failed'; readonly failure: OperationFailure };

// ---- dev ----

export interface DevEndpoint { readonly address: string; readonly url: string }

export type DevEvent =
  | { readonly kind: 'ready'; readonly endpoints: readonly DevEndpoint[] }   // initial + after each successful re-converge
  | { readonly kind: 'unwatchable'; readonly address: string }
  | { readonly kind: 'rebuild-failed'; readonly message: string }
  | { readonly kind: 'converge-failed'; readonly stackFilePath: string;
      readonly reproduceCommand: string; readonly cwd: string }              // app keeps running, still watching
  | { readonly kind: 'stopping' }
  | { readonly kind: 'stopped' };

export interface DevInput {
  readonly entry: string;
  readonly name?: string | undefined;
  readonly fresh?: boolean | undefined;
  readonly cwd?: string | undefined;
  readonly onEvent?: ((event: DevEvent) => void) | undefined;
  readonly deps?: OperationDeps | undefined;
}

/** A running dev session. The operation NEVER touches process signal handlers —
 * the host owns signals (and must evict alchemy's import-time SIGINT/SIGTERM
 * listeners before installing its own; see run-dev.ts). */
export interface DevSession {
  /** The initial front door, already merged across attachments. */
  readonly endpoints: readonly DevEndpoint[];
  /** Stop the watch loop and the app's services (emulators and data stay up).
   * Idempotent; emits 'stopping'/'stopped'; resolves `closed`. */
  stop(): Promise<void>;
  /** Settles when the session has fully stopped (via stop()). */
  readonly closed: Promise<void>;
}

export type DevStartResult =
  | { readonly outcome: 'started'; readonly session: DevSession }
  | { readonly outcome: 'failed'; readonly failure: OperationFailure };

// ---- log ----

export interface LogLine { readonly service: string; readonly line: string }

export type LogEvent =
  | { readonly kind: 'stream-failed'; readonly message: string };  // one attachment's stream died; others continue

export interface LogInput {
  readonly entry: string;
  readonly name?: string | undefined;
  /** Restrict to one service's dotted address; validated against running services. */
  readonly address?: string | undefined;
  /** Trailing history lines before live output. Defaults to 0 (live only) —
   * the attachment contract's default; the CLI's user-facing default of 20 stays in main.ts. */
  readonly tail?: number | undefined;
  readonly cwd?: string | undefined;
  /** Ends the stream when aborted. The host owns SIGINT/SIGTERM → abort. */
  readonly signal?: AbortSignal | undefined;
  readonly onEvent?: ((event: LogEvent) => void) | undefined;
  readonly deps?: { readonly config?: PrismaAppConfig | undefined;
                    readonly identity?: AppIdentity | undefined } | undefined;
}

export type LogResult =
  | { readonly outcome: 'attached';
      /** For the adapter's empty-services notice. */
      readonly appName: string;
      /** Every running service. EMPTY means nothing is running — a valid, non-failure state;
       * `lines` is then an already-finished iterable. */
      readonly services: readonly DevEndpoint[];
      /** Merged, address-filtered stream; ends on signal abort or when every source ends. */
      readonly lines: AsyncIterable<LogLine> }
  | { readonly outcome: 'failed'; readonly failure: OperationFailure };
```

Discriminant conventions: string-literal `kind`/`outcome` follow the repo idiom (`NodeDescriptor.kind`, `ContainerCall.op`); readonly-everything follows `core/src/control/deploy.ts` and `app-config.ts`.

### 3.3 `src/operations/execute-deploy-destroy.ts` — the extracted deploy/destroy executor

Exports `executeDeploy(input, cwd)` and `executeDestroy(input, cwd)`; both delegate to one internal `executeDeployOrDestroy(action, {entry, name, stage, cwd, onEvent, deps})` — main.ts L290–451 moved verbatim, with these mechanical substitutions:

| main.ts today | executor |
| --- | --- |
| `effectiveStage(args)` flag checks (L226–245) | gone — inputs are already discriminated. `stage` = `input.stage` (deploy) / `target.kind === 'stage' ? target.stage : undefined` (destroy) |
| `validateStageName(stage)` throw (L291) | caught → `{ kind: 'invalid-input', message, cause }` |
| `process.cwd()` (L292) | the `cwd` parameter |
| `warnIfNoLocalDeployState` `console.warn` (L250–259) | existence check stays; emission becomes `onEvent?.({ kind: 'no-local-deploy-state', cwd })` |
| every `throw CliError` / rethrown pipeline error (L313–381) | one enclosing `try/catch` around steps 1–7.5 → `{ kind: 'pipeline', message: error.message, cause: error }` |
| stack write + spawn (L384–410) | before spawning: `resultFilePath = join(cwd, '.prisma-composer', 'deployment-result.json')`, `fs.rmSync(resultFilePath, { force: true })` (stale-result guard), pass `env: { ...process.env, [DEPLOYMENT_RESULT_FILE_ENV]: resultFilePath }` through the existing `RunAlchemyInput.env` seam |
| nonzero status → console.error hints + return status (L401–409) | `{ kind: 'execution', message: 'alchemy <action> exited with status <n>.', exitCode: status, stackFilePath, reproduceCommand: 'alchemy <action> ' + GENERATED_STACK_RELATIVE_PATH + ' --yes --stage ' + alchemyStage, cwd }` |
| spawn threw → console.error stack path + rethrow (L447–450) | `{ kind: 'execution', exitCode: undefined, message: error.message, stackFilePath, reproduceCommand, cwd, cause: error }` |
| destroy teardown/remove loops (L416–443) | unchanged, inside the same try; failures → `pipeline` failure |
| success | deploy: read + validate the result file (§3.4) → `{ outcome: 'deployed', summary }`; destroy: `{ outcome: 'destroyed' }` |

`effectiveStage` and `warnIfNoLocalDeployState` are deleted from main.ts (flag-combination errors move into main.ts's command mapping — §5; the state-dir check moves here).

### 3.4 Deployment summary round-trip (result/render split across the process boundary)

The `DeploymentResult` is only materialized inside the **alchemy child** (the generated stack file's `report:` hook), and `DeployedNode.node` never crosses the stack boundary. The API's structured result is therefore a *serializable projection*, written by the child and read by the operation.

In `src/render-deployment.ts` (already the one module that runs in the child; stays dependency-light):

```ts
/** Env var the deploy operation sets on the alchemy child: when present,
 * deploymentReport also writes the JSON DeploymentSummary there. */
export const DEPLOYMENT_RESULT_FILE_ENV = 'PRISMA_COMPOSER_DEPLOYMENT_RESULT_FILE';

/** The serializable projection of DeploymentResult — what CAN cross the process
 * boundary. Writer (report hook) and reader (deploy operation) share this shape. */
export interface DeployedNodeSummary {
  readonly address: string;
  readonly entities: readonly DeployedEntity[];
}
export interface DeploymentSummary {
  readonly app: string;
  readonly nodes: readonly DeployedNodeSummary[];
}

export function toDeploymentSummary(result: DeploymentResult): DeploymentSummary; // pure projection

// deploymentReport(result) gains, after the existing two console.log calls:
//   const file = process.env[DEPLOYMENT_RESULT_FILE_ENV];
//   if (file !== undefined && file.length > 0)
//     fs.writeFileSync(file, JSON.stringify(toDeploymentSummary(result)));
```

The **generated stack file stays byte-identical** (generate-stack.test.ts and run.test.ts pin its content) — the new behavior rides entirely on the env var. The result file is tool state under the already-tool-owned `.prisma-composer/` dir (ADR-0004).

Reader side: after exit 0, `readDeploymentSummary(resultFilePath): DeploymentSummary | undefined` — absent file → `undefined`; otherwise `JSON.parse` + field-by-field checks then `blindCast<DeploymentSummary, '…field checks above…'>` — the exact validation idiom of `load-config.ts` `validateConfigShape` under the no-bare-casts rule. A malformed file is treated as absent, never a deploy failure.

### 3.5 `src/operations/execute-dev.ts` — dev executor

`executeDev(input, cwd): Promise<DevStartResult>` — run-dev.ts L86–292 moved, with:

- win32 guard → `{ kind: 'unsupported', message: 'local dev is not supported on Windows yet.' }`.
- Steps 1–8: thrown errors → `pipeline` failure (same messages).
- First `converge()` nonzero → `execution` failure with the dev stack path and `reproduceCommand: 'alchemy deploy ' + DEV_STACK_RELATIVE_PATH + ' --yes --stage dev'`.
- `startServices` rollback unchanged; failure → `pipeline` failure.
- `printFrontDoor` calls → `onEvent({ kind: 'ready', endpoints })`; unwatchable loop → `unwatchable` events; watch-loop catches → `converge-failed` / `rebuild-failed` events. The `[dev] logs: …` hint is **not** an event — it names the CLI's own `log` command; it stays in the CLI adapter.
- The terminal wait (L258–289) is **replaced by the session object**: `stop()` = today's `finish()` body minus signal registration (emit `stopping` → `watch.stop()` → `stopServices()` per attachment, swallowing per-attachment errors → emit `stopped` → resolve `closed`); idempotent via the same `stopping` boolean. No `process.on`/`removeAllListeners` anywhere in the executor.
- Returns `{ outcome: 'started', session }` after `await watch.ready`.

`withEmulatorRetry` and `mergedEndpoints` move here.

### 3.6 `src/operations/execute-log.ts` — log executor

`executeLog(input, cwd): Promise<LogResult>` — run-log.ts L40–115 moved:

- win32 → `unsupported`; identity/localTargets/attach failures → `pipeline` (same messages).
- Zero services → `{ outcome: 'attached', appName, services: [], lines: emptyAsyncIterable() }`.
- Unknown `address` → `{ kind: 'invalid-input', message: 'no service "<address>" in "<name>" — running services: …' }` (exact current text).
- Otherwise `{ outcome: 'attached', appName, services, lines: mergeLogStreams(attachments, input) }` — `mergeLogStreams` is a small async-generator merge (one pump per attachment pushing into a shared queue; a pump's throw becomes `onEvent({kind:'stream-failed', message})` and ends that pump only; the merged iterable ends when `input.signal` aborts or all pumps end; address filtering and `tail` applied exactly as today). No signal registration in the executor.

### 3.7 Export shims

`packages/0-framework/3-tooling/cli/src/exports/control.ts` (new):

```ts
/** Public surface (the `./control` subpath): the programmatic deploy/destroy/dev/log
 * operations. Implementation lives in ../operations/. Import-safe in a broken effect
 * tree — the heavy pipeline loads only behind each operation's own preflight. */
export type { /* every type from ../operations/results.ts */ } from '../operations/results.ts';
export { deploy, destroy, dev, log } from '../operations/operations.ts';
export type { DeployedNodeSummary, DeploymentSummary } from '../render-deployment.ts';
export { DEPLOYMENT_RESULT_FILE_ENV } from '../render-deployment.ts';
```

(`render-deployment.ts` value re-exports are safe here: it imports only core types + `node:fs`.) `packages/9-public/composer/src/exports/control.ts` (new): `export * from '@internal/cli/control';`.

## 4. Effect-resolution preflight — exact ordering for in-process hosts

1. **The `./control` entry's static graph must be import-safe in a broken tree.** Enforced structurally by §2.2/§3.1 and pinned by a built-artifact test (§7, extension of `scripts/check-npm-effect-resolution.mjs`).
2. **Each operation re-runs `checkEffectResolution(cwd)` before its dynamic import**, returning `{ kind: 'effect-resolution' }` instead of throwing. The check is pure fs reads, idempotent, and skip-safe, so double execution on the CLI path (bin.ts once, operation again) is free.
3. **`bin.ts` is unchanged** — its check still guards clipanion/help paths, and exits with the plain `Error:` line the adversarial CI shape asserts.
4. The preflight is keyed on the **operation's `cwd`** (the app dir whose tree alchemy will load from), not the host's own cwd.

## 5. File-by-file change plan

### Created

| File | Contents |
| --- | --- |
| `packages/0-framework/3-tooling/cli/src/operations/results.ts` | §3.2 |
| `packages/0-framework/3-tooling/cli/src/operations/operations.ts` | §3.1 |
| `packages/0-framework/3-tooling/cli/src/operations/execute-deploy-destroy.ts` | §3.3 (bodies moved from main.ts L247–259, L290–451) |
| `packages/0-framework/3-tooling/cli/src/operations/execute-dev.ts` | §3.5 (bodies from run-dev.ts L59–292 except renderers/signals) |
| `packages/0-framework/3-tooling/cli/src/operations/execute-log.ts` | §3.6 (bodies from run-log.ts L40–115 except console/signals) |
| `packages/0-framework/3-tooling/cli/src/exports/control.ts` | §3.7 shim |
| `packages/9-public/composer/src/exports/control.ts` | `export * from '@internal/cli/control';` |
| `packages/0-framework/3-tooling/cli/src/operations/__tests__/operations.test.ts` | §7 |
| `test/integration/test/control.deploy.test.ts` | §7 |

### Modified

| File | Change |
| --- | --- |
| `cli/src/main.ts` | Keep: command classes, `parseArgs`, `ParsedArgs`, `HelpRequested`, `DEFAULT_LOG_TAIL`. Delete: `effectiveStage`, `warnIfNoLocalDeployState`, imports of fs/path/pipeline/run-alchemy/generate-stack/validate-stage/containerEnv. `RunDeps` becomes a type alias re-export of `OperationDeps`. `run()`: parse (unchanged) → dev→`runDev(args, deps)`, log→`runLog(...)` (unchanged dispatch) → deploy/destroy: flag mapping with today's exact CliError texts (three messages from old L228–243, verbatim) → build `DeployInput`/`DestroyInput` (destroy target: `production ? {kind:'production'} : {kind:'stage', stage}`), destroy `onEvent` renders the old console.warn text verbatim → `await deploy(...)`/`destroy(...)` → success: return 0. Failure rendering: `execution` with `exitCode !== undefined` → two console.error hint lines (old L402–409), return `exitCode`; `execution` with `exitCode === undefined` → stack-file line then `throw failure.cause`; every other failure → `throw failure.cause instanceof Error ? failure.cause : new CliError(failure.message)` — preserves error classes for run.test.ts and `cli.ts`'s formatting. |
| `cli/src/dev/run-dev.ts` | Becomes the CLI adapter: keep `DevArgs`, `DevRunDeps`, `renderFrontDoor`, `printFrontDoor`. `runDev(args, deps)`: call `dev({...})` with `onEvent` → render mapping (ready→front door; unwatchable/rebuild-failed/converge-failed/stopping/stopped → today's exact console lines). On `failed`: `execution` → hint lines, return `exitCode ?? 1`; else rethrow. On `started`: print `[dev] logs:` hint; signal block moved from old L258–289 verbatim (`removeAllListeners` + `finish` = `session.stop()`), `await session.closed`, return 0. |
| `cli/src/log/run-log.ts` | Adapter: keep `LogArgs`, `LogRunDeps`. `runLog`: `AbortController` + SIGINT/SIGTERM (off in finally) → `log({...})` → `failed` → rethrow; `attached` empty → `[log] no running services …` (uses `appName`), return 0; else `for await` print `[<service>] <line>`, return 0. |
| `cli/src/render-deployment.ts` | §3.4 additions. |
| `cli/tsdown.config.ts` | Add `control: 'src/exports/control.ts'` entry. |
| `cli/package.json` | Commit regenerated exports map (gains `"./control"`). |
| `packages/9-public/composer/tsdown.config.ts` | Add `control:` entry to first pass. |
| `packages/9-public/composer/package.json` | Hand-add `"./control": "./dist/control.mjs"`. |
| `tsconfig.depcruise.json` | Two new aliases (§2.1). |
| `architecture.config.json` | Per-file entry for the 9-public shim (§2.1). |
| `scripts/check-npm-effect-resolution.mjs` | Adversarial shape gains: `node -e` importing `@prisma/composer/control` and calling `deploy({entry:'service.ts'})`, asserting exit 0 and `failure.kind === 'effect-resolution'`. |
| `docs/guides/*` + `skills/prisma-composer/SKILL.md` | New public export ⇒ both updated in the same PR (`.agents/rules/user-facing-surface-changes.mdc`): a "Programmatic control API" guide section + skill mirror. |
| `docs/design/10-domains/deploy-cli.md` | Amend §Contracts: the programmatic deploy API now exists, and where. |

### Deleted

None (relocations only).

## 6. What each clipanion command body becomes

Command classes stay parse-only (unchanged). Per `run()` branch: **deploy** — flag guard → `deploy(...)` → render; **destroy** — flag guards → `destroy(...)` with warn-rendering `onEvent` → render; **dev** — `runDev` adapter; **log** — `runLog` adapter. `cli.ts` and `bin.ts` unchanged.

## 7. Test plan

Runner: **bun test everywhere** (`@internal/cli` and `test/integration` both). Within-package tests import source paths; cross-package tests import package identifiers.

**Existing suites that pin behavior (stay green, unmodified):** `cli/src/__tests__/main.test.ts`; `cli/src/__tests__/run.test.ts` (1,089 lines — the load-bearing pin: exit codes, CliError classes/messages, destroy-state warn texts, alchemy-failure hints + passthrough status, stack-file content, container call order, *no stack file written on preflight failure*); `run-alchemy/generate-stack/load-config/load-entry/validate-stage/check-effect-resolution/jsx-load-error/validate-coverage` tests; `dev/__tests__/*`; `log/__tests__/run-log.test.ts`; `node-compat.test.ts`; `test/integration/test/cli.extension-config.test.ts` (spawns the real bin, stderr texts unchanged); `local-dev*.integration.ts`; the e2e-deploy workflow.

**New tests:**

1. `cli/src/operations/__tests__/operations.test.ts` — deploy happy path with fake alchemy (env carries `DEPLOYMENT_RESULT_FILE_ENV`; valid summary file → populated `summary`; malformed/absent → `undefined`, still `'deployed'`; stale file removed pre-spawn); `stage: 'bad..ref'` → `invalid-input`; missing config → `pipeline` naming `prisma-composer.config.ts`; extension-preflight throw → `pipeline`, alchemy never called, no stack file written; destroy target discrimination → correct `LocateContainerInput.stage`; locate-miss → `pipeline` "Nothing deployed for…"; teardown-then-remove order; `no-local-deploy-state` event fires before the pipeline; fake alchemy status 42 → `execution` with `exitCode: 42` + hint fields; **no console output from any operation** (spy-assert); log operation with scripted attachments (merge, filter, unknown-address, empty-services, abort ends iterable, `stream-failed` event); static-graph guard via a seeded effect-mismatch fixture → `effect-resolution` failure.
2. `render-deployment.test.ts` additions — `toDeploymentSummary` drops `node`; `deploymentReport` writes the file iff env var set; printed output unchanged.
3. `test/integration/test/control.deploy.test.ts` — **the slice's done-condition**: `import { deploy } from '@prisma/composer/control'`; run against `test/fixtures/extension-config/`; real config discovery, real `/control` extension resolution, real assemble; expect `{outcome:'failed', failure:{kind:'pipeline'}}` with the "no built entry at / run your build first" message (the same terminal point the binary test pins); zero argv/console/exit-code handling; 30s timeout.
4. `scripts/check-npm-effect-resolution.mjs` extension — in-process import + structured preflight failure in the adversarial npm tree (existing CI job).

**Repo checks the PR must pass:** `pnpm lint:deps` (dependency-cruiser + architecture-coverage + publishable-location), framework-vocabulary lint, no-bare-cast plugin + cast ratchet (the one new cast is a reasoned `blindCast`), turbo typecheck/test/build, both exports maps committed.

## 8. Implementation sequence

1. `render-deployment.ts` additions + tests (self-contained).
2. `operations/results.ts`, `execute-deploy-destroy.ts` (move code), `operations.ts`, re-point `main.ts` — run.test.ts green here proves the extraction.
3. `execute-dev.ts` + run-dev adapter; `execute-log.ts` + run-log adapter — dev/log suites green.
4. Shims, tsdown entries, exports maps, depcruise aliases, architecture.config entry — `pnpm lint:deps` green.
5. New operation tests + integration consumer test + npm-effect-resolution extension.
6. Guides + SKILL.md + deploy-cli.md amendment.

## Ambiguities — pending operator ruling

1. **Entrypoint name.** `/control` currently means "an extension's heavy control-plane descriptor entry, importable only from `prisma-composer.config.ts`" (ADR-0017). A top-level `@prisma/composer/control` reuses the word for a different consumer class. Options: (a) `./control`; (b) `./operations`; (c) `./pilot`. Recommendation: (a) with a distinguishing doc-comment.
2. **Deployment summary reliability.** Whether alchemy re-runs the report Action on a no-op converge is unverified. Options: (a) `summary` optional, missing file never fails a deploy (as designed); (b) missing file after exit 0 = `execution` failure; (c) verify empirically first. Recommendation: (a).
3. **Alchemy child stdio.** `stdio: 'inherit'` means an embedding host gets alchemy's raw output un-capturable. Options: (a) keep `inherit`, document; (b) add a `stdio`/output-sink option now. Recommendation: (a) — pure extraction now.
4. **Failure granularity.** One coarse `pipeline` kind now vs full sub-kind taxonomy. Recommendation: coarse now, refine in the diagnostics slice — but confirm the Phase 2 host doesn't need machine-distinguishable failure classes before the test double freezes the shape.
5. **Dev-session surface.** Minimal `endpoints/stop/closed + onEvent` vs richer per-rebuild awaitables for the future `@prisma/dev` carve-out. Recommendation: minimal now.
6. **ADR.** The `./control` surface + the `DEPLOYMENT_RESULT_FILE_ENV` cross-process contract: ADR or not. Recommendation: yes, a short ADR.
