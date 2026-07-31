/**
 * `migration new` — scaffolds a migration package with a `migration.ts` file
 * for manual authoring.
 *
 * The planner's `emptyMigration(context)` returns a
 * `MigrationPlanWithAuthoringSurface`, whose `renderTypeScript()` produces
 * the target-appropriate empty stub. The CLI writes the returned source
 * verbatim.
 */

import { readFile } from 'node:fs/promises';
import { loadConfig } from '@prisma-next/config-loader';
import type { Contract } from '@prisma-next/contract/types';
import { getEmittedArtifactPaths } from '@prisma-next/emitter';
import { APP_SPACE_ID, createControlStack } from '@prisma-next/framework-components/control';
import { loadContractSpaceAggregate } from '@prisma-next/migration-tools/aggregate';
import {
  contractSnapshotDir,
  snapshotsImportPathFrom,
  writeContractSnapshot,
} from '@prisma-next/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@prisma-next/migration-tools/hash';
import { formatMigrationDirName, writeMigrationPackage } from '@prisma-next/migration-tools/io';
import type { MigrationMetadata } from '@prisma-next/migration-tools/metadata';
import { findLatestMigration } from '@prisma-next/migration-tools/migration-graph';
import { writeMigrationTs } from '@prisma-next/migration-tools/migration-ts';
import { notOk, ok, type Result } from '@prisma-next/utils/result';
import { Command } from 'commander';
import { join, relative } from 'pathe';
import {
  CliStructuredError,
  errorRuntime,
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
import { refusePackageCorruptionOnAggregate } from '../utils/contract-space-aggregate-loader';
import { formatStyledHeader } from '../utils/formatters/styled';
import { assertFrameworkComponentsCompatible } from '../utils/framework-components';
import type { CommonCommandOptions } from '../utils/global-flags';
import { parseGlobalFlagsOrExit } from '../utils/global-flags';
import { createProjectSpecifierResolver } from '../utils/project-import-root';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI } from '../utils/terminal-ui';

interface MigrationNewOptions extends CommonCommandOptions {
  readonly name?: string;
  readonly from?: string;
  readonly config?: string;
}

interface MigrationNewResult {
  readonly ok: true;
  readonly dir: string;
  readonly from: string | null;
  readonly to: string;
  readonly summary: string;
}

async function executeMigrationNewCommand(
  options: MigrationNewOptions,
): Promise<Result<MigrationNewResult, CliStructuredError>> {
  const config = await loadConfig(options.config);
  const { migrationsDir, appMigrationsDir, appMigrationsRelative } = resolveMigrationPaths(
    options.config,
    config,
  );

  // Construct the family instance up-front so the on-disk contract read
  // below crosses the serializer seam (`familyInstance.deserializeContract`)
  // at the read site, not somewhere downstream. See TML-2536.
  const stack = createControlStack(config);
  const familyInstance = config.family.create(stack);
  const controlAdapter = config.adapter.create(stack);

  const contractPathAbsolute = resolveContractPath(config);

  let contractJsonContent: string;
  try {
    contractJsonContent = await readFile(contractPathAbsolute, 'utf-8');
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'ENOENT') {
      return notOk(
        errorRuntime(`Contract file not found at ${contractPathAbsolute}`, {
          why: `Contract file not found at ${contractPathAbsolute}`,
          fix: 'Run `prisma-next contract emit` first to generate the contract',
        }),
      );
    }
    throw error;
  }

  let toContract: Contract;
  try {
    const parsedContract: unknown = JSON.parse(contractJsonContent);
    toContract = familyInstance.deserializeContract(parsedContract);
  } catch (error) {
    return notOk(
      errorRuntime('Contract JSON is invalid', {
        why: `Failed to deserialize ${contractPathAbsolute}: ${error instanceof Error ? error.message : String(error)}`,
        fix: 'Run `prisma-next contract emit` to regenerate the contract',
      }),
    );
  }

  const toStorageHash = toContract.storage?.storageHash;
  if (typeof toStorageHash !== 'string') {
    return notOk(
      errorRuntime('Contract is missing storageHash', {
        why: `Contract at ${contractPathAbsolute} has no storageHash`,
        fix: 'Run `prisma-next contract emit` to regenerate the contract',
      }),
    );
  }

  const aggregate = await loadContractSpaceAggregate({
    migrationsDir,
    deserializeContract: (json) => familyInstance.deserializeContract(json),
    appContract: toContract,
  });
  const packageCorruptionFailure = refusePackageCorruptionOnAggregate(aggregate);
  if (packageCorruptionFailure) {
    return notOk(packageCorruptionFailure);
  }

  const packages = aggregate.app.packages;
  const graph = aggregate.app.graph();

  let fromHash: string | null = null;

  if (packages.length > 0) {
    if (options.from) {
      const match = packages.find((p) => p.metadata.to.startsWith(options.from!));
      if (!match) {
        return notOk(
          errorRuntime('Starting contract not found', {
            why: `No migration with to hash matching "${options.from}" exists in ${appMigrationsRelative}`,
            fix: 'Check that the --from hash matches a known migration target hash.',
          }),
        );
      }
      fromHash = match.metadata.to;
    } else {
      const latestMigration = findLatestMigration(graph);
      if (latestMigration) {
        fromHash = latestMigration.to;
      }
    }
  }

  if (fromHash === toStorageHash && !options.from) {
    return notOk(
      errorRuntime('No changes detected', {
        why: 'The from and to contract hashes are identical — there is nothing to migrate.',
        fix: 'Change the contract and run `prisma-next contract emit` before creating a new migration. To author a data-only migration on the current contract hash, pass `--from <hash>` explicitly.',
      }),
    );
  }

  const timestamp = new Date();
  const slug = options.name ?? 'migration';
  const dirName = formatMigrationDirName(timestamp, slug);
  const packageDir = join(appMigrationsDir, dirName);

  // `migration new` scaffolds an empty `migration.ts` for the user to
  // fill, so we attest over `ops: []`. Re-running self-emit after the
  // user adds operations will produce a different `migrationHash` (over
  // the real ops). This is intentional — there is no on-disk draft.
  const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
    from: fromHash,
    to: toStorageHash,
    providedInvariants: [],
    createdAt: timestamp.toISOString(),
  };
  const metadata: MigrationMetadata = {
    ...baseMetadata,
    migrationHash: computeMigrationHash(baseMetadata, []),
  };

  const migrations = getTargetMigrations(config.target);
  if (!migrations) {
    return notOk(
      errorTargetMigrationNotSupported({
        why: `Target "${config.target.targetId}" does not support migrations`,
      }),
    );
  }

  try {
    assertFrameworkComponentsCompatible(config.family.familyId, config.target.targetId, [
      config.target,
      config.adapter,
      ...(config.extensions ?? []),
    ]);

    await writeMigrationPackage(packageDir, metadata, []);
    const destinationArtifacts = getEmittedArtifactPaths(contractPathAbsolute);
    const [contractJsonRaw, contractDts] = await Promise.all([
      readFile(destinationArtifacts.jsonPath, 'utf-8'),
      readFile(destinationArtifacts.dtsPath, 'utf-8'),
    ]);
    await writeContractSnapshot(migrationsDir, toStorageHash, {
      contractJson: JSON.parse(contractJsonRaw) as unknown,
      contractDts,
    });

    const planner = migrations.createPlanner(controlAdapter);
    const emptyPlan = planner.emptyMigration(
      {
        packageDir,
        contractJsonPath: join(contractSnapshotDir(migrationsDir, toStorageHash), 'contract.json'),
        fromHash,
        toHash: toStorageHash,
        snapshotsImportPath: snapshotsImportPathFrom(packageDir, migrationsDir),
      },
      APP_SPACE_ID,
    );
    await writeMigrationTs(
      packageDir,
      emptyPlan.renderTypeScript(createProjectSpecifierResolver(options.config)),
    );

    return ok({
      ok: true as const,
      dir: relative(process.cwd(), packageDir),
      from: fromHash,
      to: toStorageHash,
      summary: `Scaffolded migration at ${relative(process.cwd(), packageDir)}`,
    });
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }
    return notOk(
      errorUnexpected(error instanceof Error ? error.message : String(error), {
        why: `Failed to scaffold migration: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }
}

export function createMigrationNewCommand(): Command {
  const command = new Command('new');
  setCommandDescriptions(
    command,
    'Scaffold a new migration for manual authoring',
    'Creates a migration package with a migration.ts file for manual authoring.\n' +
      'Write the migration body in migration.ts, then run the file with Node\n' +
      '(`node migration.ts`) to self-emit ops.json and attest the package.',
  );
  setCommandExamples(command, [
    'prisma-next migration new --name split-name',
    'prisma-next migration new --name custom-fk --from abc123...',
  ]);
  addGlobalOptions(command)
    .option('--name <slug>', 'Migration name (used in directory name)')
    .option('--from <hash>', 'Starting contract hash (default: latest migration target)')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .action(async (options: MigrationNewOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);

      if (!flags.json && !flags.quiet) {
        const header = formatStyledHeader({
          command: 'migration new',
          description: 'Scaffold a new migration',
          details: [],
          flags,
        });
        ui.stderr(header);
      }

      const result = await executeMigrationNewCommand(options);

      const exitCode = handleResult(result, flags, ui, (value) => {
        if (flags.json) {
          ui.output(JSON.stringify(value, null, 2));
        } else if (!flags.quiet) {
          ui.output(`\nScaffolded migration at ${value.dir}`);
          ui.output(`  from: ${value.from}`);
          ui.output(`  to:   ${value.to}`);
          ui.output(
            `\nEdit migration.ts, then run it directly (\`node "${value.dir}/migration.ts"\`) to self-emit and attest.`,
          );
        }
      });

      process.exit(exitCode);
    });

  return command;
}
