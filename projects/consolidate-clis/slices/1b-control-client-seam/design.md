# Design — Prisma 8: route all migration/db commands through the control client

Status: DRAFT — ambiguities 1–5 (end of file) pending operator ruling. Implementer executes this design exactly; deviations require orchestrator sign-off.

Paths relative to `packages/1-framework/3-tooling/cli/` unless noted.

## 0. Approach, invariants, conventions

**Goal restated mechanically.** After this slice, no file under `src/commands/` has a *runtime* import from `@internal/migration-tools/*`. `import type` of published types remains allowed. Everything a command needs at runtime from migration-tools flows through modules under `src/control-api/` (commands import via relative paths — precedent: `src/commands/migrate.ts` already imports `planSpacePath` from `../control-api/operations/migrate`).

**Three mechanisms, each with in-repo precedent:**

1. **Core relocation** — a command's non-rendering "policy core" moves verbatim into a new file under `src/control-api/operations/`. Precedent: `planSpacePath` and the exported policy-core pattern documented in `commands/migration-list.ts` (`runMigrationList`). Applied to: `ref`, `migration-new`, `migration-plan`, `migration-check`, `migrate --show`, `migration-status-overlay`, `migration-list` cores.
2. **Shared resolution/refusal operations** — small client-free functions wrapping a migration-tools call plus its existing CLI error mapping, returning `Result<T, CliStructuredError>` or `CliStructuredError | null`. Precedent: `ExecuteDbVerifyResult = Result<ExecuteDbVerifySuccess, CliStructuredError>` (`src/control-api/operations/db-verify.ts:87`), `buildReadAggregate` / `loadContractSpaceAggregateForCli`. `CliStructuredError` lives in `@internal/errors/control`, not the CLI package, so this does not undermine the host-port goal. (Conflicts with the spec sketch's "no CliError" line — Ambiguity 1.)
3. **Callback-based mid-flow reporting** — where a moved core interleaved `ui.stderr`/`ui.step` between migration-tools calls, the operation takes an optional callback so the command renders at the same point, keeping journey-suite output byte-identical. Precedent: the `onProgress: OnControlProgress` convention (`src/control-api/types.ts:78–111`).

**Error-flow invariant.** `MigrationToolsError` never crosses from control-api to a command. Every new operation catches it internally and maps via `mapMigrationToolsError` (`src/utils/cli-errors.ts:359`). For errors thrown across the seam today, commands use the new `mapCaughtMigrationError` (§2.4) instead of importing the class.

**No `ControlClient` interface changes.** Everything is additive operations plus file moves.

**File moves keep exported names** (incl. `…Command` suffixes) so the diff is mechanical; renaming is slice-2 material. Tests change import paths only.

**Export surface.** All new/moved public operations are appended to `src/exports/control-api.ts` (the sanctioned re-export location). No new package.json subpaths, no tsdown entry changes (`exports: { enabled: false }` per `.agents/rules/cli-package-exports.mdc`).

## 1. Per-command inventory and routing

Notation: **[R]** runtime import, **[T]** type-only (stays).

### 1.1 `commands/db-init.ts`
- `MigrationToolsError` [R] (L186–189 catch around `readContractIR` + `buildRefAdvancementFields`): delete the whole ref-advancement try/catch block (L164–191); replace with one call to `resolveRefAdvancementFields` (§2.9), which internalizes the null-name short-circuit, `readContractIR`, `buildRefAdvancementFields`, and the error mapping. Drop the now-unused `mapMigrationToolsError` and `ref-advancement` imports; import `resolveRefAdvancementFields` + `type RefAdvancementFields` from `../control-api/operations/ref-advancement`. Exact call site:

```ts
const advancement = await resolveRefAdvancementFields({
  ...ifDefined('advanceRef', options.advanceRef),
  ...ifDefined('db', options.db),
  refsDir, migrationsDir, contractJson,
  contractJsonPath: contractPathAbsolute,
  mode: result.value.mode,
  hash: advancementHash,
});
if (!advancement.ok) return notOk(advancement.failure);
const refAdvancementFields = advancement.value;
```

### 1.2 `commands/db-sign.ts`
- `readContractSnapshotJson` [R], `MigrationToolsError` [R], `parseContractRef` [R]: the whole `if (effectiveContractArg) { … }` block (L100–146) is replaced by `resolveContractRefToSnapshot` (§2.5) with `fallbackToEmitted: true`, wrapped in the command's existing try/catch (`errorUnexpected('Failed to resolve contract reference: …')`) minus the two arms the op now handles. Drop `mapMigrationToolsError`, `mapRefResolutionError`, `buildReadAggregate` imports.

### 1.3 `commands/db-update.ts`
- `contractSnapshotDir`/`readContractSnapshotJson` [R], `MigrationToolsError` [R] (two sites), `parseContractRef` [R]: the `if (options.to)` block (L122–165) becomes `resolveContractRefToSnapshot` with `fallbackToEmitted: false, missingBundleFlag: '--to'` (result carries `contractJsonPath` for the snapshot); the ref-advancement block (L188–215) becomes `resolveRefAdvancementFields` exactly as db-init. Drop unused imports (`mapMigrationToolsError`, `mapRefResolutionError`, `buildReadAggregate`, `join` where unused).

### 1.4 `commands/migrate.ts`
- `requireHeadRef` [R], `EMPTY_CONTRACT_HASH` [R], `readRefs` [R], `parseContractRef` [R] in the `--show` flow: absorbed by moving `executeMigrateShowCommand`'s compute to `operations/migrate-show.ts` (§2.13); header block (L234–255) and graph-render block (L435–513) stay in the command.
- `errorUnknownInvariant` + `MigrationToolsError` [R] (L759–775, 837–841, 860–862): refusal → `refuseUnknownInvariants` (§2.3); both catch-arm pairs collapse to `const mapped = mapCaughtMigrationError(error); if (mapped) return notOk(mapped);` (§2.4).
- `findLatestMigration`, `isGraphNode` [R] (L749–757): → `refuseMarkerOutsideGraph` (§2.2), invoked only when `appMarker !== null` as today.
- `parseContractRef` [R] (apply path L696): → `resolveContractRef` (§2.1).
- `readContractIR`/`executeRefAdvancement` (L823–842): → `advanceRefSafely` (§2.9).
- `mapContractAtError` import path → `../control-api/operations/contract-at-errors` (§3).
- `MigrateShowMigration` moves to the op file; `MigrateShowResult` (with render-only fields) stays in the command.
- Type-only imports (`RefEntry`, `Refs`) stay; `AggregateContractSpace` type import deleted (unused after the move).

### 1.5 `commands/migration-check.ts`
**Moves verbatim to `operations/migration-check.ts`:** `migrationPathRelative`, `migrationFileRelative`, `checkFileExists`, `checkSnapshotConsistency`, `CheckSpace`, `enumerateCheckSpaces`, `checkManifestFilesPresent`, `checkReachability`, `checkDanglingRefs`, `checkSpace`, `RunMigrationCheckInputs`, `runMigrationCheck`, `loadAggregateIntegrityViolations`, `refFailureSpecificity`, `SingleTargetInputs`, `checkSingleTarget`, `MigrationCheckOutcome`. The op file imports exit codes from `../../commands/migration-check/exit-codes` and `CheckFailure`/`MigrationCheckResult` from `../../commands/json/schemas` (precedent: `integrity-violation-to-check-failure.ts` imports `../commands/json/schemas`). **Stays in the command:** `executeMigrationCheckCommand` (loadConfig, path resolution, header, `buildReadAggregate` via the moved loader, the `integrityViolationToCheckFailure` fold, exit-code selection), `createMigrationCheckCommand`, the existing re-exports from `./json/schemas`, rendering. The journey helper named `runMigrationCheck` is a test helper driving the command factory — no import change there.

### 1.6 `commands/migration-graph.ts`
- `EMPTY_CONTRACT_HASH` [R] (L194, JSON `spaces` projection): the JSON half of the per-space loop (L156–198) moves into `buildMigrationSpaceGraphEntries` (§2.11); the command keeps tree rendering (`renderMigrationGraphSpaceTree`, `indentMigrationGraphTreeBlock`) and iterates `scopedSpaces` as before. `MigrationGraph` [T] stays (used for `--dot`). List imports repath to `../control-api/operations/migration-list`.

### 1.7 `commands/migration-list.ts`
**Moves verbatim to `operations/migration-list.ts`:** `compareSpaceIds`, `compareDirNamesDescending`, `listRefsByContractHash`, `orderedOnDiskSpaceIds`, `migrationSpaceListEntriesFromAggregate`, `RunMigrationListInputs`, `computeSummary`, `runMigrationList`. **Stays:** `MigrationListExecuteResult`, `MigrationListHumanRenderOptions`, `renderMigrationListHumanOutput`, `executeMigrationListCommand`, `createMigrationListCommand`. Importers to update: `migration-graph.ts`, `migration-status.ts`, `migrate.ts`, `test/commands/migration-list.test.ts`, `test/commands/migration-read-commands-parity.test.ts`.

### 1.8 `commands/migration-log.ts`
- `MigrationToolsError` [R] (L96 catch-arm): the two catch arms collapse to `mapCaughtMigrationError` (§2.4); drop `mapMigrationToolsError` import.

### 1.9 `commands/migration-new.ts`
All seven runtime imports live inside `executeMigrationNewCommand` (L71–253). **The whole function moves verbatim** to `operations/migration-new.ts` (name kept). Command keeps `createMigrationNewCommand` (header + call + render); imports `executeMigrationNewCommand` and `type MigrationNewOptions`/`MigrationNewResult` from the op file. Header already prints before the core runs — no behavioral change.

### 1.10 `commands/migration-plan.ts`
**Moves verbatim to `operations/migration-plan.ts`:** `PlannerSuccess`, `TargetMigrationsApi`, `runPlannerLeg`, `writePlannedMigrationPackage`, `MigrationPlanResult`, `executeMigrationPlanCommand`, `buildPlanSummary`, `buildAutoBaselinePlanSummary`. **Stays:** `createMigrationPlanCommand`, `formatMigrationPlanOutput`, `PrefixResolutionFailure`, `resolveBundleByPrefix`. Two UI touchpoints become callbacks on the moved core:

```ts
export async function executeMigrationPlanCommand(
  options: MigrationPlanOptions,
  startTime: number,
  callbacks?: {
    readonly onContextResolved?: (ctx: {
      readonly configPath: string;
      readonly contractPath: string;
      readonly appMigrationsRelative: string;
    }) => void;
    readonly onSeeded?: (record: ContractSpaceSeedPhaseRecord) => void;
  },
): Promise<Result<MigrationPlanResult, CliStructuredError>>
```

`onContextResolved` fires exactly where the header renders today (after `resolveMigrationPaths`/`resolveContractPath`, before the contract read); `onSeeded` once per record immediately after `runContractSpaceSeedPhase` returns, in order. The command's action does the rendering (same `!flags.json && !flags.quiet` conditions, same `details` construction, `ui.step('Updated … to …')` for `action === 'updated'`).

### 1.11 `commands/migration-show.ts`
- `loadContractSpaceAggregate` [R] (L161): → `loadContractSpaceAggregateForCli({ targetId: config.target.targetId, migrationsDir, appContract, extensions: [], deserializeContract: (json) => familyInstance.deserializeContract(json) })` — behaviorally identical (with `extensions: []` the target-mismatch precheck is vacuous; no integrity check, same as `loadContractSpaceAggregate`).
- `parseMigrationRef` [R] (L194): → `resolveMigrationRef` (§2.1); drop `mapRefResolutionError` import. `OnDiskMigrationPackage` [T] stays; `castAs` usage unchanged.

### 1.12 `commands/migration-status.ts`
- `EMPTY_CONTRACT_HASH` [R]: L311 — restructure: move `buildReadAggregate` up and set `let contractHash = loaded.value.contractHash;` (identical value — the loader computes the same fallback, `contract-space-aggregate-loader.ts:347–353`); keep the `try { await readContractEnvelope(config) } catch { diagnostics.push(CONTRACT.UNREADABLE …) }` purely for the diagnostic. L510 → `originHashForStatus(markerHash)` (§2.12). L593 → absorbed into `refuseMissingInvariantPath`.
- `errorNoInvariantPath`/`errorUnknownInvariant`/`MigrationToolsError` [R]: unknown-invariant block (L448–465) → `refuseUnknownInvariants`; MISSING_INVARIANTS block (L585–610) → `refuseMissingInvariantPath`; `readRefs` catch (L304) → `readMigrationRefs` (§2.6).
- `findPath`/`findPathWithDecision` [R]: L519 → `!hasMigrationPath(graph, originHash, targetHash)` (§2.2); L594 absorbed.
- `parseContractRef` [R] (L345, 357): → `resolveContractRef`, twice.
- Overlay + list import paths repath to the operations files. The DB-read catch at L434–445 (checks `CliStructuredError` only) is untouched.

### 1.13 `commands/migration-status-overlay.ts`
Not a registered command, but in scope. **Entire file moves** to `operations/migration-status-overlay.ts` unchanged; `MigrationEdgeAnnotation` type import becomes `../../utils/formatters/migration-graph-labels` (type-only). Gains `originHashForStatus` (§2.12).

### 1.14 `commands/ref.ts`
**Moves verbatim to `operations/ref.ts`:** `RefSetResult`, `RefDeleteResult`, `RefListResult`, `mapError`, `cliErrorInvalidRefName`, `executeRefSetCommand`, `executeRefDeleteCommand`, `executeRefListCommand` (they already load config themselves — precedent: `executeContractEmit`). `buildReadAggregate` import becomes a sibling `./contract-space-aggregate-loader`. **Stays:** the four `create*Command` factories and rendering. `test/commands/ref.test.ts` updates the executor import path.

## 2. New control-api operations — exact specifications

All under `src/control-api/operations/`; one-paragraph header JSDoc in the style of `operations/migrate.ts:1`; all exported from `src/exports/control-api.ts` (§2.16).

### 2.1 `ref-resolution.ts`

```ts
import type { ContractRef, MigrationRef } from '@internal/migration-tools/ref-resolution';
import { parseContractRef, parseMigrationRef } from '@internal/migration-tools/ref-resolution';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import type { Refs } from '@internal/migration-tools/refs';
import { notOk, ok, type Result } from '@internal/utils/result';
import { type CliStructuredError, mapRefResolutionError } from '../../utils/cli-errors';

export interface RefResolutionContext {
  readonly graph: MigrationGraph;
  readonly refs: Refs;
  readonly contractHash?: string;
}

export function resolveContractRef(input: string, context: RefResolutionContext): Result<ContractRef, CliStructuredError>;
// impl: const r = parseContractRef(input, context); return r.ok ? ok(r.value) : notOk(mapRefResolutionError(r.failure));

export function resolveMigrationRef(
  input: string,
  context: { readonly graph: MigrationGraph; readonly refs: Refs },
): Result<MigrationRef, CliStructuredError>;
```

(`MigrationRef` = the exact exported ok-value type name in `@internal/migration-tools/ref-resolution` — import the named type, no `ReturnType` derivation.) Consumers: migrate (apply `--to`), migration-status, migration-show. The moved cores call `parseContractRef`/`parseMigrationRef` directly (they are inside control-api); `checkSingleTarget` keeps raw `parseMigrationRef` (it ranks raw `RefResolutionError`s before mapping).

### 2.2 `graph-queries.ts`

```ts
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { findLatestMigration, findPath, isGraphNode } from '@internal/migration-tools/migration-graph';
import { type CliStructuredError, errorMarkerMismatch } from '../../utils/cli-errors';

/** True when the on-disk graph contains a path fromHash → toHash. */
export function hasMigrationPath(graph: MigrationGraph, fromHash: string, toHash: string): boolean;
// impl: return findPath(graph, fromHash, toHash) !== null;

/** Refusal for a live marker hash that is not a node of the on-disk app graph.
 * Same errorMarkerMismatch envelope migrate raises today, or null when the marker is a node. */
export function refuseMarkerOutsideGraph(args: {
  readonly markerHash: string;
  readonly graph: MigrationGraph;
}): CliStructuredError | null;
// impl: if (isGraphNode(args.markerHash, args.graph)) return null;
//       return errorMarkerMismatch(args.markerHash, [...args.graph.nodes].sort(),
//                                  findLatestMigration(args.graph)?.to ?? null);
```

### 2.3 `invariants.ts`

```ts
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { findPathWithDecision } from '@internal/migration-tools/migration-graph';
import { errorNoInvariantPath, errorUnknownInvariant } from '@internal/migration-tools/errors';
import { ifDefined } from '@internal/utils/defined';
import { type CliStructuredError, mapMigrationToolsError } from '../../utils/cli-errors';
import { collectDeclaredInvariants, toStructuralEdge } from '../../utils/command-helpers';

/** Refuses ref invariants neither declared on any graph edge nor present on the live marker. */
export function refuseUnknownInvariants(args: {
  readonly graph: MigrationGraph;
  readonly markerInvariants: readonly string[];
  readonly refInvariants: readonly string[];
  readonly refName?: string;
}): CliStructuredError | null;
// impl mirrors migrate.ts 760–774 (declared ∪ marker; unknown → mapMigrationToolsError(errorUnknownInvariant(...)))

/** Refuses a --to target whose missing invariants no path from originHash satisfies. */
export function refuseMissingInvariantPath(args: {
  readonly graph: MigrationGraph;
  readonly originHash: string;
  readonly targetHash: string;
  readonly missing: readonly string[];
  readonly refName?: string;
}): CliStructuredError | null;
// impl mirrors migration-status.ts 594–609 (findPathWithDecision → 'unsatisfiable' → errorNoInvariantPath envelope)
```

Status callers pass `originHash: originHashForStatus(markersBySpace.get(...)?.storageHash)` so the sentinel never appears in the command.

### 2.4 `caught-errors.ts`

```ts
import { MigrationToolsError } from '@internal/migration-tools/errors';
import { CliStructuredError, mapMigrationToolsError } from '../../utils/cli-errors';

/** CliStructuredError → identity; MigrationToolsError → mapped; anything else → null (caller rethrows/wraps). */
export function mapCaughtMigrationError(error: unknown): CliStructuredError | null;
```

Consumers: migrate (2 catch sites), migration-log.

### 2.5 `contract-snapshot-resolution.ts`

Replaces the near-duplicate blocks in db-sign (L100–146) and db-update (L122–165).

```ts
export interface ResolveContractRefToSnapshotOptions {
  readonly config: PrismaNextConfig;
  readonly migrationsDir: string;
  /** User-supplied contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path). */
  readonly refInput: string;
  /** Absolute path of the emitted contract.json (fallback source + snapshot-path derivation). */
  readonly contractPathAbsolute: string;
  /** true (db sign): fall back to the emitted contract when no bundle matches and its
   * storage.storageHash matches; else the 'No contract file found for hash "<hash>"' errorRuntime.
   * false (db update --to): missing bundle = the errorUnexpected 'No migration bundle found for
   * <flag> "<input>" (resolved hash: <hash>)' envelope. */
  readonly fallbackToEmitted: boolean;
  /** Flag label for the missing-bundle message. Required when fallbackToEmitted is false. */
  readonly missingBundleFlag?: '--to';
}

export interface ResolveContractRefToSnapshotSuccess {
  readonly hash: string;
  readonly contractJson: Record<string, unknown>;
  /** snapshot → join(contractSnapshotDir(migrationsDir, hash), 'contract.json'); emitted → contractPathAbsolute. */
  readonly contractJsonPath: string;
  readonly source: 'snapshot' | 'emitted';
}

export async function resolveContractRefToSnapshot(
  options: ResolveContractRefToSnapshotOptions,
): Promise<Result<ResolveContractRefToSnapshotSuccess, CliStructuredError>>;
```

Implementation is the union of the two current blocks, byte-preserving every error message: (1) `buildReadAggregate`; (2) `parseContractRef` → failure ⇒ `mapRefResolutionError`; (3) bundle lookup by `metadata.to === targetHash`; (4) hit ⇒ `readContractSnapshotJson` — the moved bare `as Record<string, unknown>` casts (db-sign:117, db-update:148) become `castAs<Record<string, unknown>>` per no-bare-casts (moved lines are new code); (5) no bundle + fallback ⇒ emitted-contract compare or the exact db-sign errorRuntime strings; (6) no bundle + no fallback ⇒ the exact db-update errorUnexpected strings with `missingBundleFlag`; (7) catch: `MigrationToolsError` ⇒ mapped, `CliStructuredError` ⇒ passthrough, else rethrow.

### 2.6 `refs.ts`

```ts
/** Reads migrations/<app>/refs, mapping MigrationToolsError; other errors rethrow. */
export async function readMigrationRefs(refsDir: string): Promise<Result<Refs, CliStructuredError>>;
```

Consumer: migration-status. Moved cores keep calling `readRefs` directly.

### 2.7 `ref.ts` — moved executors (§1.14), names/signatures unchanged.

### 2.8 `migration-check.ts` — moved check core (§1.5), names/signatures unchanged.

### 2.9 `ref-advancement.ts` — moved util + two safe wrappers

Moved verbatim: `ContractIR`, `RefAdvancementFields`, `computeRefAdvancementName`, `readContractIR`, `executeRefAdvancement`, `buildRefAdvancementFields`. Added:

```ts
export interface ResolveRefAdvancementFieldsOptions {
  readonly advanceRef?: string;
  readonly db?: string;
  readonly refsDir: string;
  readonly migrationsDir: string;
  readonly contractJson: Record<string, unknown>;
  /** Path whose sibling .d.ts readContractIR derives (contract.json path). */
  readonly contractJsonPath: string;
  readonly mode: 'plan' | 'apply';
  readonly hash: string;
}

/** Full ref-advancement phase for db init/update: ok({advancedRef:null, plannedAdvanceRef:null})
 * when computeRefAdvancementName is null; else readContractIR + buildRefAdvancementFields with
 * MigrationToolsError mapped, other errors rethrown. Reproduces db-init 164–191 exactly. */
export async function resolveRefAdvancementFields(
  options: ResolveRefAdvancementFieldsOptions,
): Promise<Result<RefAdvancementFields, CliStructuredError>>;

/** migrate's --advance-ref tail: executeRefAdvancement with MigrationToolsError mapped, others rethrown. */
export async function advanceRefSafely(args: {
  readonly refsDir: string;
  readonly migrationsDir: string;
  readonly name: string;
  readonly hash: string;
  readonly contractIR: ContractIR;
}): Promise<Result<{ readonly name: string; readonly hash: string }, CliStructuredError>>;
```

### 2.10 `migration-list.ts` — moved list cores (§1.7), names unchanged.

### 2.11 `migration-graph.ts`

```ts
/** Project scoped list entries into the per-space contracts+migrations rows the migration
 * graph --json output serializes (EMPTY_CONTRACT_HASH from-hash → null). Skips space ids
 * the aggregate no longer resolves, mirroring the command loop. */
export function buildMigrationSpaceGraphEntries(args: {
  readonly aggregate: ContractSpaceAggregate;
  readonly scopedSpaces: readonly MigrationSpaceListEntry[];
}): readonly MigrationSpaceGraphEntry[];
```

Lifts exactly the `spaces.push({...})` half of the loop at `commands/migration-graph.ts:156–198`.

### 2.12 `migration-status-overlay.ts` — moved overlay + sentinel helper

Moved unchanged: `DeriveStatusEdgeAnnotationsInput`, `deriveStatusEdgeAnnotations`, `appliedHashesFromLedger`, `statusForMigrationHash`. Added:

```ts
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
/** Origin hash for status path computation: the live/override marker, or the empty-contract sentinel. */
export function originHashForStatus(markerHash: string | undefined): string;
// impl: return markerHash ?? EMPTY_CONTRACT_HASH;
```

### 2.13 `migrate-show.ts` — read-only migrate preview core

Moves the compute of `executeMigrateShowCommand` (`commands/migrate.ts:159–433` minus the header block 234–255) — wraps `readRefs`, `parseContractRef`, `requireHeadRef`, `EMPTY_CONTRACT_HASH`, `planSpacePath` (sibling `./migrate`), `buildReadAggregate` (sibling), `createControlClient` (`../client`), error mapping.

```ts
export interface MigrateShowMigration {  // moved verbatim
  readonly spaceId: string; readonly dirName: string; readonly migrationHash: string;
  readonly from: string; readonly to: string;
}

export interface ExecuteMigrateShowPlanOptions {
  readonly config?: string;
  readonly db?: string;
  readonly to?: string;
  readonly from?: string;
  /** Invoked once, after refs/aggregate/--to resolution succeeds and before any DB connection —
   * exactly where the CLI renders its styled header today. */
  readonly onPreflightComplete?: (ctx: {
    readonly configPath: string;
    readonly migrationsRelative: string;
    readonly dbConnection: unknown | undefined;
    readonly hasExplicitFrom: boolean;
  }) => void;
}

export interface MigrateShowPlanSuccess {
  readonly aggregate: ContractSpaceAggregate;
  readonly contractHash: string;
  readonly migrations: readonly MigrateShowMigration[];
  readonly summary: string;
  /** Per-space render hash: live/override marker storageHash, pre-defaulted to the empty sentinel. */
  readonly renderMarkerHashBySpace: ReadonlyMap<string, string>;
  /** True when the live DB marker was read — gates the ★ db marker in the tree. */
  readonly usedLiveMarker: boolean;
}

export async function executeMigrateShowPlan(
  options: ExecuteMigrateShowPlanOptions,
): Promise<Result<MigrateShowPlanSuccess, CliStructuredError>>;
```

`renderMarkerHashBySpace` = `new Map(allSpaces.map((s) => [s.spaceId, markerBySpace.get(s.spaceId)?.storageHash ?? EMPTY_CONTRACT_HASH]))`. The command's `executeMigrateShowCommand` shrinks to: call the op with a header-rendering `onPreflightComplete`, run the untouched graph-render block (substituting `plan.renderMarkerHashBySpace.get(space.spaceId)!` and `plan.usedLiveMarker`; `allSpaces` derived as `[plan.aggregate.app, ...plan.aggregate.extensions]`), assemble `MigrateShowResult`. `formatMigrateShowOutput` untouched.

### 2.14 `migration-plan.ts` / `migration-new.ts` — moved authoring cores (§1.10/§1.9). `migration-plan.ts` sibling-imports `./plan-resolution`, `./contract-space-seed-phase`, `./contract-space-aggregate-loader`.

### 2.15 Moved files (no new API): `plan-resolution.ts`, `contract-space-aggregate-loader.ts`, `contract-space-seed-phase.ts`, `contract-at-errors.ts` — see §3. Import updates: `operations/db-run.ts`, `operations/db-verify.ts`, `operations/migrate.ts` change `'../../utils/contract-space-aggregate-loader'` → `'./contract-space-aggregate-loader'`; commands change `'../utils/…'` → `'../control-api/operations/…'`.

### 2.16 `src/exports/control-api.ts` additions

Append explicit exports (alphabetical within the existing grouping style):

```ts
export { mapCaughtMigrationError } from '../control-api/operations/caught-errors';
export { mapContractAtError } from '../control-api/operations/contract-at-errors';
export {
  type BuildAggregateInputs, appContractStandInFromIdentity, buildContractSpaceAggregate,
  buildReadAggregate, loadContractRawSafely, loadContractSpaceAggregateForCli,
  mapIntegrityViolations, refuseContractSpaceIntegrity, refuseDeclaredExtensionTargetMismatch,
  refusePackageCorruptionOnAggregate,
} from '../control-api/operations/contract-space-aggregate-loader';
export {
  type ResolveContractRefToSnapshotOptions, type ResolveContractRefToSnapshotSuccess,
  resolveContractRefToSnapshot,
} from '../control-api/operations/contract-snapshot-resolution';
export {
  type ContractSpaceSeedPhaseInputs, type ContractSpaceSeedPhaseRecord,
  type ContractSpaceSeedPhaseResult, runContractSpaceSeedPhase,
} from '../control-api/operations/contract-space-seed-phase';
export { hasMigrationPath, refuseMarkerOutsideGraph } from '../control-api/operations/graph-queries';
export { refuseMissingInvariantPath, refuseUnknownInvariants } from '../control-api/operations/invariants';
export {
  type CheckSpace, type MigrationCheckOutcome, type RunMigrationCheckInputs,
  checkSingleTarget, enumerateCheckSpaces, loadAggregateIntegrityViolations, runMigrationCheck,
} from '../control-api/operations/migration-check';
export { buildMigrationSpaceGraphEntries } from '../control-api/operations/migration-graph';
export {
  type RunMigrationListInputs, listRefsByContractHash,
  migrationSpaceListEntriesFromAggregate, runMigrationList,
} from '../control-api/operations/migration-list';
export { executeMigrationNewCommand } from '../control-api/operations/migration-new';
export { type MigrationPlanResult, executeMigrationPlanCommand } from '../control-api/operations/migration-plan';
export {
  appliedHashesFromLedger, deriveStatusEdgeAnnotations, originHashForStatus, statusForMigrationHash,
} from '../control-api/operations/migration-status-overlay';
export {
  type ExecuteMigrateShowPlanOptions, type MigrateShowMigration, type MigrateShowPlanSuccess,
  executeMigrateShowPlan,
} from '../control-api/operations/migrate-show';
export {
  type FromResolution, type ResolvedContractRef, resolveFromForPlan, resolveToForPlan,
} from '../control-api/operations/plan-resolution';
export {
  type ContractIR, type RefAdvancementFields, advanceRefSafely, buildRefAdvancementFields,
  computeRefAdvancementName, executeRefAdvancement, readContractIR, resolveRefAdvancementFields,
} from '../control-api/operations/ref-advancement';
export { resolveContractRef, resolveMigrationRef } from '../control-api/operations/ref-resolution';
export { readMigrationRefs } from '../control-api/operations/refs';
export {
  executeRefDeleteCommand, executeRefListCommand, executeRefSetCommand,
} from '../control-api/operations/ref';
```

## 3. Shared-utils classification (verified by reading import statements)

| File (`src/utils/`) | migration-tools imports | Class | Disposition |
| --- | --- | --- | --- |
| `plan-resolution.ts` | Runtime: `MigrationToolsError`, `parseContractRef`, `assertHashIsGraphNode`, `findLatestMigration`, `isGraphNode` | (a) | **Move whole file** → `operations/plan-resolution.ts`. Consumers: migration-plan core (also moving) + its test. |
| `ref-advancement.ts` | Runtime: `writeContractSnapshot`, `errorInvalidRefName`, `validateRefName`, `writeRef` | (a) | **Move** → `operations/ref-advancement.ts` + new wrappers (§2.9). |
| `migration-path-target.ts` | Type-only: `OnDiskMigrationPackage` | (c) | Untouched (pure path arithmetic). |
| `contract-space-aggregate-loader.ts` | Runtime: `loadContractSpaceAggregate`, `EMPTY_CONTRACT_HASH`, `MigrationToolsError` | (a) | **Move whole file** → `operations/contract-space-aggregate-loader.ts`, names kept. Already imported by three operations. |
| `contract-space-seed-phase.ts` | Runtime: `materialiseExtensionMigrationPackageIfMissing`, `emitContractSpaceArtifacts`, `planAllSpaces`, `readContractSpaceHeadRef`, `spaceMigrationDirectory` | (a) | **Move** → `operations/contract-space-seed-phase.ts`. |
| `command-helpers.ts` | Runtime: `APP_SPACE_ID`, `spaceMigrationDirectory`; type-only: path/graph types | (c) | Untouched — command scaffolding, outside the lint scope (`src/commands/**` only). Note recorded for slice 2. |
| `extension-pack-inputs.ts` | Type-only (verified L16–18) | (c) | Untouched. |
| `integrity-violation-to-check-failure.ts` | Type-only: `IntegrityViolation` | (b) | Stays (pure violation→row catalogue). |
| `cli-errors.ts` | Type-only: `MigrationToolsError`, `RefResolutionError` (L29–30) | (c) | Untouched — the runtime `.is` narrowing lives in `caught-errors.ts`. |
| `contract-at-errors.ts` | **Runtime**: `MigrationToolsError` (value import — `.is`/`.code`) | (a) | **Move** → `operations/contract-at-errors.ts`. Consumers after move: `operations/plan-resolution.ts` (sibling) + the migrate command (via control-api path — allowed). |
| `emit-queue.ts`, `migration-command-scaffold.ts`, `combine-verify-results.ts` | none | (c) | Untouched. |
| `formatters/migration-graph-labels.ts` (+ sibling formatters) | Runtime: `EMPTY_CONTRACT_HASH`; types otherwise | (b) | Stay — formatters are rendering, outside the `src/commands/**` lint scope. |

## 4. Lint enforcement

**Mechanism**: dependency-cruiser (`dependency-cruiser.config.mjs`, run by `pnpm lint:deps`). Precedent for a bespoke rule: `createTestImportRules()` (L283–291).

**Change 1**: `tsPreCompilationDeps: true` → `'specify'` (labels pure `import type` edges `type-only` so rules can exempt them; behavior-preserving for all existing rules — none reference `dependencyTypes`).

**Change 2**: add after `createTestImportRules` and invoke alongside it:

```js
const createCliControlSeamRules = () => {
  forbidden.push({
    name: 'cli-commands-no-runtime-migration-tools',
    comment:
      'CLI command modules must reach @internal/migration-tools through src/control-api ' +
      '(TML-3173, consolidate-clis slice 1b). Type-only imports of published migration-tools ' +
      'types are allowed; runtime imports are not.',
    severity: 'error',
    from: { path: '^packages/1-framework/3-tooling/cli/src/commands/' },
    to: {
      path: '^packages/1-framework/3-tooling/migration/',
      dependencyTypesNot: ['type-only'],
    },
  });
};
```

`to.path` targets the resolved package directory of `@internal/migration-tools` (`packages/1-framework/3-tooling/migration/`). A mixed import (`import { X, type Y }`) is not `type-only` and correctly fails. Scope is `src/commands/**` only.

**Verification**: `grep -rn "^import {\|^import [a-zA-Z*]" packages/1-framework/3-tooling/cli/src/commands/ | grep "@internal/migration-tools"` returns nothing (all remaining lines start `import type`), plus the dep-cruiser rule green.

## 5. Test impact

Tests are written/updated **before** implementation (Golden Rule).

**5.1 Behavior pins (must not churn — any diff is a defect in the slice):** all `test/integration/test/cli-journeys/*.e2e.test.ts` (~50 files), `cli.db-init.*`, `cli.db-update.*`, `cli.db-sign.e2e`, `cli.db-verify.*`, `cli.migrate-*`, `cli.control-policy.*`; CLI package goldens (`read-commands-json-golden`, `migration-list-json-golden`, `db-update-read-aggregate-json-golden`, `output.db-update`, `formatters/*`).

**5.2 Import-path updates (mechanical, same assertions):** `migration-check-multi-space`, `migration-check-snapshot-consistency`, `migration-status-overlay`, `migration-list`, `migration-read-commands-parity`, `migration-plan-command`, `ref` — policy-core imports repath to `src/control-api/operations/*`; files exercising moved cores relocate `test/commands/` or `test/utils/` → `test/control-api/` (pending Ambiguity 4): `plan-resolution`, `ref-advancement`, `build-read-aggregate`, `aggregate-loader-preflight`, `contract-space-aggregate-loader.ac15`, `map-integrity-violations`, `contract-space-seed-phase{,.mongo}`. `migration-plan.test.ts` (`resolveBundleByPrefix`) unchanged; `migrate-show.test.ts` mocks unchanged.

**5.3 New direct tests (written first), under `test/control-api/`:**

| File | Asserts |
| --- | --- |
| `ref-resolution.test.ts` | ok passthrough; each `RefResolutionError` kind maps to the same envelope `mapRefResolutionError` produces today (compare `toEnvelope()`). |
| `graph-queries.test.ts` | `hasMigrationPath` true/false; `refuseMarkerOutsideGraph` null for a node; foreign hash → `errorMarkerMismatch` envelope with sorted nodes + latest tip (+ null tip on empty graph). |
| `invariants.test.ts` | `refuseUnknownInvariants` null/envelope cases; `refuseMissingInvariantPath` null when a path satisfies; `MIGRATION.NO_INVARIANT_PATH` envelope when unsatisfiable. |
| `caught-errors.test.ts` | identity / mapped / null. |
| `contract-snapshot-resolution.test.ts` | bundle-hit → snapshot JSON + path + `source: 'snapshot'`; fallback-hit → `source: 'emitted'`; non-matching → exact 'No contract file found' envelope; no-fallback → exact 'No migration bundle found for --to' envelope; unresolvable ref → mapped. |
| `refs.test.ts` | ok on empty/populated; corrupt → mapped; non-MigrationToolsError rethrows. |
| `ref-advancement.test.ts` (extends moved suite) | null-name no-op; plan vs apply modes; invalid name → mapped envelope, nothing written; `advanceRefSafely` same. |
| `migration-graph-entries.test.ts` | EMPTY-from → null; refs decoration; skips absent space ids. |
| `migrate-show-plan.test.ts` | offline path ordered migrations; `renderMarkerHashBySpace` sentinel default; `onPreflightComplete` fires once before client construction (existing `vi.mock('../../src/control-api/client')` pattern). |

**5.4 Verification sequence:** (1) update/relocate + add tests — red where ops don't exist; (2) implement; (3) `pnpm --filter @internal/cli build && pnpm --filter @internal/cli test && pnpm test:integration && pnpm lint:deps && pnpm lint:casts`.

## 6. Repo-rule compliance

No bare `as` (two moved snapshot-JSON casts become `castAs`); arktype untouched; no barrel files (re-exports only in `src/exports/control-api.ts`); tests before implementation; no new subpaths/tsdown changes; `use-pathe-for-paths`, `no-inline-imports`, `use-if-defined` preserved by verbatim moves; out-of-scope honored (no `migration-cli.ts` edits, no `process.exit` removal, no renderer changes, no `ControlClient` interface change).

## Ambiguities — pending operator ruling

1. **Failure type: `Result<T, CliStructuredError>` vs the spec's "no CliError" line.** Every relevant precedent (db-verify, aggregate loader, plan-resolution, contract-emit) uses `CliStructuredError`, which lives in `@internal/errors/control` — not the CLI package — so the host-port goal is unaffected. Recommendation: `Result<T, CliStructuredError>` as designed; a stricter per-op failure-code reshape belongs to slice 2/3.
2. **Depth of routing for `migration-status` (and migrate's apply path): touchpoint extraction vs full core move.** Designed as touchpoint extraction — full status reshape belongs to the command→result→renderer slice. Needs explicit ack: "commands keep parsing and rendering only" is only approximately true for status/migrate after this slice.
3. **`tsPreCompilationDeps: true → 'specify'` is a global dep-cruiser option change** (label-adding, no existing rule references `dependencyTypes`). Alternative: a bespoke scanner script. Recommendation: the dep-cruiser change, validated by a full before/after `pnpm lint:deps` run.
4. **Relocated test files: move to `test/control-api/` (consistency) vs path-only updates in place (smaller diff).** Recommendation: move.
5. **Moved executors keep their `…Command` suffixes** (`executeRefSetCommand` etc.) on the public control-api surface for a mechanical diff; rename in slice 2 when signatures change anyway. Recommendation: keep.
