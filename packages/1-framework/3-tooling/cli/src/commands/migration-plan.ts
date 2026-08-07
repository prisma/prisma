import { readFile } from 'node:fs/promises';
import { loadConfig } from '@internal/config-loader';
import type { Contract } from '@internal/contract/types';
import { getEmittedArtifactPaths } from '@internal/emitter';
import {
  createControlStack,
  hasOperationPreview,
  type MigrationPlanOperation,
  type OperationPreview,
  type SchemaOwnership,
} from '@internal/framework-components/control';
import {
  snapshotsImportPathFrom,
  writeContractSnapshot,
} from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { deriveProvidedInvariants } from '@internal/migration-tools/invariants';
import { formatMigrationDirName, writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeMigrationTs } from '@internal/migration-tools/migration-ts';
import type { ImportSpecifierResolver } from '@internal/publish-surface/import-roots';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { join, relative } from 'pathe';
import {
  type CliErrorConflict,
  CliStructuredError,
  errorContractValidationFailed,
  errorFileNotFound,
  errorMigrationPlanningFailed,
  errorTargetMigrationNotSupported,
  errorUnexpected,
} from '../utils/cli-errors';
import {
  addGlobalOptions,
  getTargetMigrations,
  resolveContractPath,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import {
  buildContractSpaceAggregate,
  loadContractSpaceAggregateForCli,
} from '../utils/contract-space-aggregate-loader';
import { runContractSpaceSeedPhase } from '../utils/contract-space-seed-phase';
import { toExtensionInputs } from '../utils/extension-pack-inputs';
import { formatStyledHeader } from '../utils/formatters/styled';
import { assertFrameworkComponentsCompatible } from '../utils/framework-components';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { resolveFromForPlan, resolveToForPlan } from '../utils/plan-resolution';
import { createProjectSpecifierResolver } from '../utils/project-import-root';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';

interface MigrationPlanOptions extends CommonCommandOptions {
  readonly config?: string;
  readonly name?: string;
  readonly from?: string;
  readonly to?: string;
}

type PlannerSuccess = {
  readonly plannedOps: readonly MigrationPlanOperation[];
  readonly migrationTsContent: string;
  readonly hasPlaceholders: boolean;
};

type TargetMigrationsApi = NonNullable<ReturnType<typeof getTargetMigrations>>;

async function runPlannerLeg(
  planner: ReturnType<TargetMigrationsApi['createPlanner']>,
  migrations: TargetMigrationsApi,
  frameworkComponents: ReturnType<typeof assertFrameworkComponentsCompatible>,
  contract: Contract,
  fromContract: Contract | null,
  spaceId: string,
  ownership: SchemaOwnership,
  snapshotsImportPath: string,
  resolveImportSpecifier: ImportSpecifierResolver,
): Promise<Result<PlannerSuccess, CliStructuredError>> {
  const fromSchema = migrations.contractToSchema(fromContract, frameworkComponents);
  const plannerResult = planner.plan({
    contract,
    schema: fromSchema,
    policy: { allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'] },
    fromContract,
    frameworkComponents,
    spaceId,
    // Offline `migration plan` is the aggregate-of-(possibly one) degenerate
    // case: the same ownership consultation the live aggregate flow uses. A
    // from→to extra (a table removed from the contract) is not declared by any
    // space in the aggregate, so it stays a genuine drop; a table another
    // space owns is never dropped.
    ownership,
    snapshotsImportPath,
  });
  if (plannerResult.kind === 'failure') {
    return notOk(
      errorMigrationPlanningFailed({
        conflicts: plannerResult.conflicts as readonly CliErrorConflict[],
      }),
    );
  }

  let plannedOps: readonly MigrationPlanOperation[] = [];
  let hasPlaceholders = false;
  try {
    plannedOps = await Promise.all(plannerResult.plan.operations);
    if (plannedOps.length === 0) {
      return notOk(
        errorMigrationPlanningFailed({
          conflicts: [
            {
              kind: 'unsupportedChange',
              summary:
                'Contract changed but planner produced no operations. ' +
                'This indicates unsupported or ignored changes.',
            },
          ],
        }),
      );
    }
  } catch (e) {
    if (CliStructuredError.is(e) && e.code === 'MIGRATION.UNFILLED_PLACEHOLDER') {
      hasPlaceholders = true;
    } else {
      throw e;
    }
  }

  return ok({
    plannedOps,
    migrationTsContent: plannerResult.plan.renderTypeScript(resolveImportSpecifier),
    hasPlaceholders,
  });
}

async function writePlannedMigrationPackage(
  packageDir: string,
  fromHash: string | null,
  toHash: string,
  createdAt: Date,
  leg: PlannerSuccess,
): Promise<void> {
  const opsForWrite = leg.hasPlaceholders ? [] : leg.plannedOps;
  const metadataWithInvariants: Omit<MigrationMetadata, 'migrationHash'> = {
    from: fromHash,
    to: toHash,
    providedInvariants: deriveProvidedInvariants(opsForWrite),
    createdAt: createdAt.toISOString(),
  };
  const metadata: MigrationMetadata = {
    ...metadataWithInvariants,
    migrationHash: computeMigrationHash(metadataWithInvariants, opsForWrite),
  };
  await writeMigrationPackage(packageDir, metadata, opsForWrite);
  await writeMigrationTs(packageDir, leg.migrationTsContent);
}

export interface MigrationPlanResult {
  readonly ok: boolean;
  readonly noOp: boolean;
  readonly from: string | null;
  readonly to: string;
  readonly dir?: string;
  readonly baselineDir?: string;
  /**
   * Extension-space migration packages materialised onto disk during this
   * `plan` run. Each entry names a `migrations/<spaceId>/<dirName>/`
   * tree the framework wrote alongside the app-space migration directory.
   * Empty when the project has no extension packs declaring a contract
   * space, or when every extension-space package is already on disk.
   *
   * Surfacing these in the result (rather than only via `ui.step` log
   * lines) makes the cross-space side effect explicit to JSON consumers
   * and the success-summary renderer — the same cross-space side effect
   * that `migrate` will replay.
   */
  readonly emittedExtensionDirs: readonly { readonly spaceId: string; readonly dirName: string }[];
  readonly operations: readonly {
    readonly id: string;
    readonly label: string;
    readonly operationClass: string;
  }[];
  /**
   * Family-agnostic textual preview of the migration plan operations.
   * Replaces the previous `sql?: readonly string[]` field; consumers should
   * read `result.preview?.statements`.
   */
  readonly preview?: OperationPreview;
  readonly summary: string;
  /**
   * When true, `migration.ts` was written but contains unfilled
   * `placeholder(...)` calls. The user must edit the file and then run
   * `node migration.ts` to self-emit `ops.json` / `migration.json`.
   */
  readonly pendingPlaceholders?: boolean;
  readonly timings: {
    readonly total: number;
  };
}

async function executeMigrationPlanCommand(
  options: MigrationPlanOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  startTime: number,
): Promise<Result<MigrationPlanResult, CliStructuredError>> {
  const config = await loadConfig(options.config);
  const { configPath, migrationsDir, appMigrationsDir, appMigrationsRelative } =
    resolveMigrationPaths(options.config, config);

  const contractPathAbsolute = resolveContractPath(config);
  const contractPath = relative(process.cwd(), contractPathAbsolute);

  if (!flags.json && !flags.quiet) {
    const details: Array<{ label: string; value: string }> = [
      { label: 'config', value: configPath },
      { label: 'contract', value: contractPath },
      { label: 'migrations', value: appMigrationsRelative },
    ];
    if (options.from) {
      details.push({ label: 'from', value: options.from });
    }
    if (options.to) {
      details.push({ label: 'to', value: options.to });
    }
    if (options.name) {
      details.push({ label: 'name', value: options.name });
    }
    const header = formatStyledHeader({
      command: 'migration plan',
      description: 'Plan a migration from contract changes',
      url: 'https://pris.ly/migration-plan',
      details,
      flags,
    });
    ui.stderr(header);
  }

  // Load contract file (the "to" contract)
  let contractJsonContent: string;
  try {
    contractJsonContent = await readFile(contractPathAbsolute, 'utf-8');
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'ENOENT') {
      return notOk(
        errorFileNotFound(contractPathAbsolute, {
          why: `Contract file not found at ${contractPathAbsolute}`,
          fix: `Run \`prisma-next contract emit\` to generate ${contractPath}, or update \`config.contract.output\` in ${configPath}`,
        }),
      );
    }
    return notOk(
      errorUnexpected(error instanceof Error ? error.message : String(error), {
        why: `Failed to read contract file: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }

  // Construct the family instance up-front so on-disk contract reads cross the
  // serializer seam at the read site, not after the planner has already
  // started dispatching on raw shapes. See TML-2536.
  const stack = createControlStack(config);
  const familyInstance = config.family.create(stack);
  const controlAdapter = config.adapter.create(stack);

  let toContract: Contract;
  try {
    toContract = familyInstance.deserializeContract(JSON.parse(contractJsonContent) as unknown);
  } catch (error) {
    return notOk(
      errorContractValidationFailed(
        `Contract at ${contractPathAbsolute} failed to deserialize: ${error instanceof Error ? error.message : String(error)}`,
        { where: { path: contractPathAbsolute } },
      ),
    );
  }

  const rawStorageHash = toContract.storage?.storageHash;
  if (typeof rawStorageHash !== 'string') {
    return notOk(
      errorContractValidationFailed('Contract is missing storageHash', {
        where: { path: contractPathAbsolute },
      }),
    );
  }
  let toStorageHash: string = rawStorageHash;

  // When `--to <ref>` resolves a non-default destination, these carry its raw
  // artifacts so the planned package's destination snapshot store entry is
  // written from the resolved target rather than copied from the emitted
  // `contract.json`.
  let toArtifacts: { contractJson: unknown; contractDts: string } | null = null;

  let fromContract: Contract | null = null;
  let fromHash: string | null = null;
  let snapshotStartContract: {
    readonly fromHash: string;
    readonly contractJson: unknown;
    readonly contractDts: string;
  } | null = null;
  let isAutoBaseline = false;

  const tolerantAggregateResult = await loadContractSpaceAggregateForCli({
    targetId: config.target.targetId,
    migrationsDir,
    appContract: toContract,
    extensions: config.extensions ?? [],
    deserializeContract: (json: unknown) => familyInstance.deserializeContract(json),
  });
  if (!tolerantAggregateResult.ok) {
    return notOk(tolerantAggregateResult.failure);
  }
  const resolutionSpace = tolerantAggregateResult.value.app;

  const resolutionResult = await resolveFromForPlan({
    optionsFrom: options.from,
    space: resolutionSpace,
  });

  if (!resolutionResult.ok) {
    return notOk(resolutionResult.failure);
  }

  switch (resolutionResult.value.kind) {
    case 'greenfield':
      break;
    case 'graph-node':
      fromHash = resolutionResult.value.fromHash;
      fromContract = resolutionResult.value.fromContract;
      break;
    case 'ref':
      fromHash = resolutionResult.value.fromHash;
      fromContract = resolutionResult.value.fromContract;
      snapshotStartContract = {
        fromHash: resolutionResult.value.fromHash,
        contractJson: resolutionResult.value.contractJson,
        contractDts: resolutionResult.value.contractDts,
      };
      break;
    case 'auto-baseline':
      fromHash = resolutionResult.value.fromHash;
      fromContract = resolutionResult.value.fromContract;
      snapshotStartContract = {
        fromHash: resolutionResult.value.fromHash,
        contractJson: resolutionResult.value.contractJson,
        contractDts: resolutionResult.value.contractDts,
      };
      isAutoBaseline = true;
      break;
  }

  // `--to <ref>` swaps the planner destination to an arbitrary resolved
  // contract (e.g. an ancestor / rollback target). The from-side resolution
  // above is untouched; only the destination + its snapshot store entry
  // change.
  if (options.to !== undefined) {
    const toResolution = await resolveToForPlan(options.to, {
      space: resolutionSpace,
    });
    if (!toResolution.ok) {
      return notOk(toResolution.failure);
    }
    toContract = toResolution.value.contract;
    toStorageHash = toResolution.value.hash;
    toArtifacts = {
      contractJson: toResolution.value.contractJson,
      contractDts: toResolution.value.contractDts,
    };
  }

  // Before the seed phase, which is the first thing here that writes: an
  // unreadable or contradictory project manifest fails the command outright
  // rather than after artifacts are already on disk.
  const resolveImportSpecifier = createProjectSpecifierResolver(options.config);

  // Phase 1 — seed: unconditionally re-emit per-space pinned artifacts
  // (contract.json / contract.d.ts / refs/head.json) and materialise any
  // descriptor-shipped migration packages not yet on disk. Runs before
  // the no-op check so that an extension bump alone (with no structural
  // app-space change) still re-pins extension artifacts on disk.
  const canonicalExtensionInputs = toExtensionInputs(config.extensions ?? []);
  const seedResult = await runContractSpaceSeedPhase({
    migrationsDir,
    extensions: canonicalExtensionInputs,
  });
  if (!flags.json && !flags.quiet) {
    for (const record of seedResult.seeded) {
      if (record.action === 'updated') {
        const pkgSuffix =
          record.newMigrationDirs.length > 0
            ? `; ${record.newMigrationDirs.length} new migration package(s) materialised`
            : '';
        ui.step(`Updated ${record.spaceId} to ${record.newHash}${pkgSuffix}`);
      }
    }
  }
  const emittedExtensionDirs = seedResult.seeded.flatMap((r) =>
    r.newMigrationDirs.map((dirName) => ({ spaceId: r.spaceId, dirName })),
  );

  // Check for no-op (same hash means no changes). Auto-baseline is exempt:
  // an empty graph with db ref at the current contract still needs a
  // null → fromHash baseline bundle so migrate can anchor the marker.
  if (fromHash === toStorageHash && !isAutoBaseline) {
    const result: MigrationPlanResult = {
      ok: true,
      noOp: true,
      from: fromHash,
      to: toStorageHash,
      operations: [],
      emittedExtensionDirs,
      summary: 'No changes detected between contracts',
      timings: { total: Date.now() - startTime },
    };
    return ok(result);
  }

  // Check target supports migrations
  const migrations = getTargetMigrations(config.target);
  if (!migrations) {
    return notOk(
      errorTargetMigrationNotSupported({
        why: `Target "${config.target.id}" does not support migrations`,
      }),
    );
  }

  // Phase 2 — load: build the aggregate against the now-consistent disk
  // state that phase 1 just seeded. The seed phase guarantees every
  // declared extension has its head ref pinned, so the loader's
  // declaredButUnmigrated precheck always passes here. The app contract
  // was already routed through `familyInstance.deserializeContract` at the
  // read site above (see TML-2536), so it's the hydrated `Contract`
  // here — no second validation pass needed.
  const aggregateResult = await buildContractSpaceAggregate({
    targetId: config.target.targetId,
    migrationsDir,
    appContract: toContract,
    extensions: config.extensions ?? [],
    deserializeContract: (json: unknown) => familyInstance.deserializeContract(json),
  });
  if (!aggregateResult.ok) {
    return notOk(aggregateResult.failure);
  }
  const aggregate = aggregateResult.value;

  const frameworkComponents = assertFrameworkComponentsCompatible(
    config.family.familyId,
    config.target.targetId,
    [config.target, config.adapter, ...(config.extensions ?? [])],
  );

  // Write the planned package's destination contract into the snapshot store.
  // With `--to`, the resolved target's raw artifacts are written; otherwise
  // the emitted `contract.json` / `contract.d.ts` are read from disk.
  async function writeDestinationSnapshot(destHash: string): Promise<void> {
    if (toArtifacts !== null) {
      await writeContractSnapshot(migrationsDir, destHash, {
        contractJson: toArtifacts.contractJson,
        contractDts: toArtifacts.contractDts,
      });
      return;
    }
    const destinationArtifacts = getEmittedArtifactPaths(contractPathAbsolute);
    const [contractJsonRaw, contractDts] = await Promise.all([
      readFile(destinationArtifacts.jsonPath, 'utf-8'),
      readFile(destinationArtifacts.dtsPath, 'utf-8'),
    ]);
    await writeContractSnapshot(migrationsDir, destHash, {
      contractJson: JSON.parse(contractJsonRaw) as unknown,
      contractDts,
    });
  }

  try {
    const planner = migrations.createPlanner(controlAdapter);

    if (
      isAutoBaseline &&
      fromHash !== null &&
      fromContract !== null &&
      snapshotStartContract !== null
    ) {
      const baselineTimestamp = new Date();
      const deltaTimestamp = new Date(baselineTimestamp.getTime() + 60_000);
      const baselineDirName = formatMigrationDirName(baselineTimestamp, 'baseline');
      const deltaDirName = formatMigrationDirName(deltaTimestamp, options.name ?? 'migration');
      const baselinePackageDir = join(appMigrationsDir, baselineDirName);
      const deltaPackageDir = join(appMigrationsDir, deltaDirName);

      const baselineLeg = await runPlannerLeg(
        planner,
        migrations,
        frameworkComponents,
        fromContract,
        null,
        aggregate.app.spaceId,
        aggregate,
        snapshotsImportPathFrom(baselinePackageDir, migrationsDir),
        resolveImportSpecifier,
      );
      if (!baselineLeg.ok) {
        return notOk(baselineLeg.failure);
      }

      await writePlannedMigrationPackage(
        baselinePackageDir,
        null,
        fromHash,
        baselineTimestamp,
        baselineLeg.value,
      );
      await writeContractSnapshot(migrationsDir, fromHash, {
        contractJson: snapshotStartContract.contractJson,
        contractDts: snapshotStartContract.contractDts,
      });

      if (fromHash === toStorageHash) {
        const baselineOps = baselineLeg.value.hasPlaceholders ? [] : baselineLeg.value.plannedOps;
        if (baselineLeg.value.hasPlaceholders) {
          const baselineDir = relative(process.cwd(), baselinePackageDir);
          const result: MigrationPlanResult = {
            ok: true,
            noOp: false,
            from: fromHash,
            to: toStorageHash,
            dir: baselineDir,
            baselineDir,
            operations: [],
            emittedExtensionDirs,
            pendingPlaceholders: true,
            summary:
              'Planned baseline with placeholder(s) — edit migration.ts then run `node migration.ts` to self-emit',
            timings: { total: Date.now() - startTime },
          };
          return ok(result);
        }

        const preview = hasOperationPreview(familyInstance)
          ? familyInstance.toOperationPreview(baselineOps)
          : undefined;
        const result: MigrationPlanResult = {
          ok: true,
          noOp: false,
          from: fromHash,
          to: toStorageHash,
          baselineDir: relative(process.cwd(), baselinePackageDir),
          operations: baselineOps.map((op) => ({
            id: op.id,
            label: op.label,
            operationClass: op.operationClass,
          })),
          emittedExtensionDirs,
          ...(preview !== undefined ? { preview } : {}),
          summary: buildAutoBaselinePlanSummary(0, emittedExtensionDirs.length),
          timings: { total: Date.now() - startTime },
        };
        return ok(result);
      }

      const deltaLeg = await runPlannerLeg(
        planner,
        migrations,
        frameworkComponents,
        aggregate.app.contract(),
        fromContract,
        aggregate.app.spaceId,
        aggregate,
        snapshotsImportPathFrom(deltaPackageDir, migrationsDir),
        resolveImportSpecifier,
      );
      if (!deltaLeg.ok) {
        return notOk(deltaLeg.failure);
      }

      await writePlannedMigrationPackage(
        deltaPackageDir,
        fromHash,
        toStorageHash,
        deltaTimestamp,
        deltaLeg.value,
      );
      await writeDestinationSnapshot(toStorageHash);
      await writeContractSnapshot(migrationsDir, fromHash, {
        contractJson: snapshotStartContract.contractJson,
        contractDts: snapshotStartContract.contractDts,
      });

      const deltaOps = deltaLeg.value.hasPlaceholders ? [] : deltaLeg.value.plannedOps;
      if (deltaLeg.value.hasPlaceholders) {
        const result: MigrationPlanResult = {
          ok: true,
          noOp: false,
          from: fromHash,
          to: toStorageHash,
          dir: relative(process.cwd(), deltaPackageDir),
          baselineDir: relative(process.cwd(), baselinePackageDir),
          operations: [],
          emittedExtensionDirs,
          pendingPlaceholders: true,
          summary:
            'Planned baseline + migration with placeholder(s) — edit migration.ts then run `node migration.ts` to self-emit',
          timings: { total: Date.now() - startTime },
        };
        return ok(result);
      }

      const preview = hasOperationPreview(familyInstance)
        ? familyInstance.toOperationPreview(deltaOps)
        : undefined;
      const result: MigrationPlanResult = {
        ok: true,
        noOp: false,
        from: fromHash,
        to: toStorageHash,
        dir: relative(process.cwd(), deltaPackageDir),
        baselineDir: relative(process.cwd(), baselinePackageDir),
        operations: deltaOps.map((op) => ({
          id: op.id,
          label: op.label,
          operationClass: op.operationClass,
        })),
        emittedExtensionDirs,
        ...(preview !== undefined ? { preview } : {}),
        summary: buildAutoBaselinePlanSummary(deltaOps.length, emittedExtensionDirs.length),
        timings: { total: Date.now() - startTime },
      };
      return ok(result);
    }

    const timestamp = new Date();
    const slug = options.name ?? 'migration';
    const dirName = formatMigrationDirName(timestamp, slug);
    const packageDir = join(appMigrationsDir, dirName);

    const deltaLeg = await runPlannerLeg(
      planner,
      migrations,
      frameworkComponents,
      aggregate.app.contract(),
      fromContract,
      aggregate.app.spaceId,
      aggregate,
      snapshotsImportPathFrom(packageDir, migrationsDir),
      resolveImportSpecifier,
    );
    if (!deltaLeg.ok) {
      return notOk(deltaLeg.failure);
    }

    await writePlannedMigrationPackage(
      packageDir,
      fromHash,
      toStorageHash,
      timestamp,
      deltaLeg.value,
    );
    await writeDestinationSnapshot(toStorageHash);
    if (snapshotStartContract !== null) {
      await writeContractSnapshot(migrationsDir, snapshotStartContract.fromHash, {
        contractJson: snapshotStartContract.contractJson,
        contractDts: snapshotStartContract.contractDts,
      });
    }

    if (deltaLeg.value.hasPlaceholders) {
      const result: MigrationPlanResult = {
        ok: true,
        noOp: false,
        from: fromHash,
        to: toStorageHash,
        dir: relative(process.cwd(), packageDir),
        operations: [],
        emittedExtensionDirs,
        pendingPlaceholders: true,
        summary:
          'Planned migration with placeholder(s) — edit migration.ts then run `node migration.ts` to self-emit',
        timings: { total: Date.now() - startTime },
      };
      return ok(result);
    }

    const plannedOps = deltaLeg.value.plannedOps;
    const preview = hasOperationPreview(familyInstance)
      ? familyInstance.toOperationPreview(plannedOps)
      : undefined;
    const result: MigrationPlanResult = {
      ok: true,
      noOp: false,
      from: fromHash,
      to: toStorageHash,
      dir: relative(process.cwd(), packageDir),
      operations: plannedOps.map((op) => ({
        id: op.id,
        label: op.label,
        operationClass: op.operationClass,
      })),
      emittedExtensionDirs,
      ...(preview !== undefined ? { preview } : {}),
      summary: buildPlanSummary(plannedOps.length, emittedExtensionDirs.length),
      timings: { total: Date.now() - startTime },
    };
    return ok(result);
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }
    const message = error instanceof Error ? error.message : String(error);
    return notOk(
      errorUnexpected(message, {
        why: `Unexpected error during migration plan: ${message}`,
      }),
    );
  }
}

export function createMigrationPlanCommand(): Command {
  const command = new Command('plan');
  setCommandDescriptions(
    command,
    'Plan a migration from contract changes',
    'Compares the emitted contract against the latest on-disk migration state and\n' +
      'produces a new migration package with the required operations. No database\n' +
      'connection is needed — this is a fully offline operation.',
  );
  setCommandExamples(command, [
    'prisma-next migration plan',
    'prisma-next migration plan --name add-users-table',
    'prisma-next migration plan --to <migration-dir>^ --name rollback',
  ]);
  addGlobalOptions(command)
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--name <slug>', 'Name slug for the migration directory', 'migration')
    .option(
      '--from <contract>',
      'Starting contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path)',
    )
    .option(
      '--to <contract>',
      'Destination contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path); defaults to the emitted contract',
    )
    .action(async (options: MigrationPlanOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const startTime = Date.now();

      const ui = createTerminalUI(flags);
      const result = await executeMigrationPlanCommand(options, flags, ui, startTime);

      const exitCode = handleResult(result, flags, ui, (planResult) => {
        if (flags.json) {
          ui.output(JSON.stringify(planResult, null, 2));
        } else if (!flags.quiet) {
          ui.log(formatMigrationPlanOutput(planResult, flags));
        }
      });

      process.exit(exitCode);
    });

  return command;
}

/**
 * Compose the success-line summary so the cross-space side effect
 * (extension-space migration packages materialised on disk during
 * this `plan` run) is visible in the top line — not just in the
 * step log above it.
 *
 * Example outputs:
 *   - `Planned 3 operation(s)` (app-space-only project)
 *   - `Planned 3 operation(s); materialised 1 extension-space migration` (one extension)
 *   - `Planned 3 operation(s); materialised 2 extension-space migrations` (two extensions)
 *
 * Locks AC3 at the summary-line level: a reader of the success line
 * can tell that something happened beyond the app space.
 */
function buildPlanSummary(plannedOpsCount: number, emittedExtensionDirsCount: number): string {
  const base = `Planned ${plannedOpsCount} operation(s)`;
  if (emittedExtensionDirsCount === 0) return base;
  const noun =
    emittedExtensionDirsCount === 1 ? 'extension-space migration' : 'extension-space migrations';
  return `${base}; materialised ${emittedExtensionDirsCount} ${noun}`;
}

function buildAutoBaselinePlanSummary(
  deltaOpsCount: number,
  emittedExtensionDirsCount: number,
): string {
  const base = `Planned baseline + ${deltaOpsCount} operation(s)`;
  if (emittedExtensionDirsCount === 0) return base;
  const noun =
    emittedExtensionDirsCount === 1 ? 'extension-space migration' : 'extension-space migrations';
  return `${base}; materialised ${emittedExtensionDirsCount} ${noun}`;
}

export function formatMigrationPlanOutput(result: MigrationPlanResult, flags: GlobalFlags): string {
  const lines: string[] = [];
  const useColor = flags.color !== false;

  const green_ = useColor ? (s: string) => `\x1b[32m${s}\x1b[0m` : (s: string) => s;
  const yellow_ = useColor ? (s: string) => `\x1b[33m${s}\x1b[0m` : (s: string) => s;
  const dim_ = useColor ? (s: string) => `\x1b[2m${s}\x1b[0m` : (s: string) => s;

  // Renders the extension-space materialisation block + canonical apply-step
  // hint shared by the no-op, placeholder, and full-plan branches. The app
  // space short-circuits do not skip it: an extension-only bump emits new
  // `migrations/<spaceId>/<dirName>/` directories on disk that the user
  // still has to apply, so the success line must surface them.
  function appendEmittedExtensions(): void {
    if (result.emittedExtensionDirs.length === 0) return;
    lines.push('');
    lines.push(dim_('Emitted extension migrations:'));
    for (const entry of result.emittedExtensionDirs) {
      lines.push(dim_(`  ${entry.spaceId} → migrations/${entry.spaceId}/${entry.dirName}`));
    }
    lines.push('');
    lines.push(
      `Next: review the extension migrations above, then run ${green_('prisma-next migrate')}.`,
    );
  }

  if (result.noOp) {
    lines.push(`${green_('✔')} No changes detected`);
    lines.push(dim_(`  from: ${result.from}`));
    lines.push(dim_(`  to:   ${result.to}`));
    appendEmittedExtensions();
    return lines.join('\n');
  }

  if (result.pendingPlaceholders) {
    lines.push(`${yellow_('⚠')} ${result.summary}`);
    lines.push('');
    lines.push(dim_(`from: ${result.from}`));
    lines.push(dim_(`to:   ${result.to}`));
    if (result.dir) {
      lines.push(dim_(`dir:  ${result.dir}`));
    }
    lines.push('');
    lines.push(
      'Open migration.ts and replace each `placeholder(...)` call with your actual query.',
    );
    lines.push(`Then run: ${green_(`node ${result.dir ?? '<dir>'}/migration.ts`)}`);
    appendEmittedExtensions();
    return lines.join('\n');
  }

  lines.push(`${green_('✔')} ${result.summary}`);
  lines.push('');

  if (result.operations.length > 0) {
    lines.push(dim_('│'));
    for (let i = 0; i < result.operations.length; i++) {
      const op = result.operations[i]!;
      const isLast = i === result.operations.length - 1;
      const treeChar = isLast ? '└' : '├';
      // operationClass tag is intentionally NOT inlined per spec:
      // a destructive footer warning still surfaces below this list.
      const destructiveMarker =
        op.operationClass === 'destructive' ? ` ${yellow_('(destructive)')}` : '';
      lines.push(`${dim_(treeChar)}─ ${op.label}${destructiveMarker}`);
    }

    const hasDestructive = result.operations.some((op) => op.operationClass === 'destructive');
    if (hasDestructive) {
      lines.push('');
      lines.push(
        `${yellow_('⚠')} This migration contains destructive operations that may cause data loss.`,
      );
    }
    lines.push('');
  }

  lines.push(dim_(`from:   ${result.from}`));
  lines.push(dim_(`to:     ${result.to}`));
  if (result.baselineDir) {
    lines.push(dim_(`Baseline → ${result.baselineDir}`));
  }
  if (result.dir) {
    lines.push(dim_(`App space → ${result.dir}`));
  }
  // Per-space block: surface the extension-space directories materialised
  // alongside the app-space migration. Without this block the cross-space
  // side effect is invisible in the success summary (e2e finding F1).
  for (const entry of result.emittedExtensionDirs) {
    lines.push(
      dim_(`Extension space ${entry.spaceId} → migrations/${entry.spaceId}/${entry.dirName}`),
    );
  }

  lines.push('');
  // The "Next:" hint always points at the canonical apply path
  // (`prisma-next migrate`) regardless of how many spaces were
  // materialised — `db update` is a dev-time convenience, not the
  // canonical replay step.
  const reviewTarget =
    result.baselineDir !== undefined && result.dir !== undefined
      ? `${result.baselineDir} and ${result.dir}`
      : (result.baselineDir ?? result.dir ?? '<dir>');
  lines.push(
    `Next: review ${green_(reviewTarget)} if needed, then run ${green_('prisma-next migrate')}.`,
  );

  if (result.preview && result.preview.statements.length > 0) {
    // The non-empty length is already guaranteed by the surrounding check, so
    // a plain `every` here is equivalent to the helper in formatters/migrations.ts.
    const allSql = result.preview.statements.every((s) => s.language === 'sql');
    lines.push('');
    lines.push(dim_(allSql ? 'DDL preview' : 'Operation preview'));
    lines.push('');
    for (const statement of result.preview.statements) {
      const trimmed = statement.text.trim();
      if (!trimmed) continue;
      const line = statement.language === 'sql' && !trimmed.endsWith(';') ? `${trimmed};` : trimmed;
      lines.push(line);
    }
  }

  if (flags.verbose && result.timings) {
    lines.push('');
    lines.push(dim_(`Total time: ${result.timings.total}ms`));
  }

  return lines.join('\n');
}

export type PrefixResolutionFailure =
  | { reason: 'ambiguous'; count: number }
  | { reason: 'not-found' };

/**
 * Resolve a migration package by **target contract hash** (`metadata.to`)
 * using exact match or prefix match.
 *
 * Note: matches `metadata.to` (the contract hash this migration produces),
 * not `metadata.migrationHash` (the package's content-addressed identity).
 * Tries exact match first, then prefix match. Returns the matched package on
 * success, or a discriminated failure indicating whether the prefix was
 * ambiguous or simply not found.
 *
 * @internal Exported for testing only.
 */
export function resolveBundleByPrefix<T extends { metadata: { to: string } }>(
  bundles: readonly T[],
  needle: string,
): Result<T, PrefixResolutionFailure> {
  const exact = bundles.find((p) => p.metadata.to === needle);
  if (exact) return ok(exact);

  const candidates = bundles.filter((p) => p.metadata.to.startsWith(needle));

  if (candidates.length === 1) return ok(candidates[0]!);
  if (candidates.length > 1) return notOk({ reason: 'ambiguous', count: candidates.length });
  return notOk({ reason: 'not-found' });
}
