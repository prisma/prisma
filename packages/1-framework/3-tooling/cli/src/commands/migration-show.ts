import { readFile } from 'node:fs/promises';
import { loadConfigForSections } from '@internal/config-loader';
import type { Contract } from '@internal/contract/types';
import {
  APP_SPACE_ID,
  createControlStack,
  type MigrationPlanOperation,
} from '@internal/framework-components/control';
import type { OnDiskMigrationPackage } from '@internal/migration-tools/package';
import { castAs } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { relative } from 'pathe';
import { createControlClient } from '../control-api/client';
import { loadContractSpaceAggregateForCli } from '../control-api/operations/contract-space-aggregate-loader';
import { resolveMigrationRef } from '../control-api/operations/ref-resolution';
import {
  type CliStructuredError,
  errorContractValidationFailed,
  errorFileNotFound,
  errorRuntime,
  errorUnexpected,
} from '../utils/cli-errors';
import {
  addGlobalOptions,
  resolveContractPath,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
  setCommandSeeAlso,
} from '../utils/command-helpers';
import { formatMigrationShowOutput } from '../utils/formatters/migrations';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import {
  findPackageByDirPath,
  looksLikePath,
  resolveAppTargetPath,
} from '../utils/migration-path-target';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';
import type { MigrationShowResult } from './json/schemas';

interface MigrationShowOptions extends CommonCommandOptions {
  readonly config?: string;
}

export interface MigrationShowPresent {
  readonly space: string;
  readonly name: string;
  readonly fromContract: string | null;
  readonly toContract: string;
  readonly hash: string;
  readonly createdAt: string;
  readonly operations: { id: string; label: string; operationClass: string }[];
  readonly preview: {
    statements: { text: string; language: string }[];
  };
}

export type { MigrationShowResult };

function pkgToPresent(
  spaceId: string,
  pkg: OnDiskMigrationPackage,
  client: ReturnType<typeof createControlClient>,
): MigrationShowPresent {
  const ops = castAs<readonly MigrationPlanOperation[]>(pkg.ops);
  const rawPreview = client.toOperationPreview(ops) ?? { statements: [] };
  return {
    space: spaceId,
    name: pkg.dirName,
    fromContract: pkg.metadata.from,
    toContract: pkg.metadata.to,
    hash: pkg.metadata.migrationHash,
    createdAt: pkg.metadata.createdAt,
    operations: ops.map((op) => ({
      id: op.id,
      label: op.label,
      operationClass: op.operationClass,
    })),
    preview: { statements: [...rawPreview.statements] },
  };
}

async function executeMigrationShowCommand(
  target: string,
  options: MigrationShowOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<MigrationShowResult, CliStructuredError>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'driver',
    'extensions',
    'migrations',
    'contract',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;
  const { configPath, migrationsDir, appMigrationsDir, appMigrationsRelative } =
    resolveMigrationPaths(options.config, config);

  const contractPathAbsolute = resolveContractPath(config);
  const contractPath = relative(process.cwd(), contractPathAbsolute);

  if (!flags.json && !flags.quiet) {
    const header = formatStyledHeader({
      command: 'migration show',
      description: 'Display migration package contents',
      details: [
        { label: 'config', value: configPath },
        { label: 'contract', value: contractPath },
        { label: 'migrations', value: appMigrationsRelative },
        { label: 'target', value: target },
      ],
      flags,
    });
    ui.stderr(header);
  }

  const client = createControlClient({
    family: config.family,
    target: config.target,
    adapter: config.adapter,
    ...ifDefined('driver', config.driver),
    extensions: config.extensions ?? [],
  });

  let contractJsonContent: string;
  try {
    contractJsonContent = await readFile(contractPathAbsolute, 'utf-8');
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return notOk(
        errorFileNotFound(contractPathAbsolute, {
          why: `Contract file not found at ${contractPathAbsolute}`,
          fix: `Run \`prisma-next contract emit\` to generate ${contractPath}`,
        }),
      );
    }
    return notOk(
      errorUnexpected(error instanceof Error ? error.message : String(error), {
        why: 'Failed to read contract file',
      }),
    );
  }

  const stack = createControlStack(config);
  const familyInstance = config.family.create(stack);

  let appContract: Contract;
  try {
    appContract = familyInstance.deserializeContract(
      castAs<unknown>(JSON.parse(contractJsonContent)),
    );
  } catch (error) {
    return notOk(
      errorContractValidationFailed(
        `Contract at ${contractPathAbsolute} failed to deserialize: ${error instanceof Error ? error.message : String(error)}`,
        { where: { path: contractPathAbsolute } },
      ),
    );
  }

  const loadedAggregate = await loadContractSpaceAggregateForCli({
    targetId: config.target.targetId,
    migrationsDir,
    appContract,
    extensions: [],
    deserializeContract: (json) => familyInstance.deserializeContract(json),
  });
  if (!loadedAggregate.ok) {
    return notOk(loadedAggregate.failure);
  }
  const aggregate = loadedAggregate.value;

  const packages = aggregate.app.packages;
  const graph = aggregate.app.graph();
  const refs = aggregate.app.refs;

  let appPkg: OnDiskMigrationPackage;
  if (looksLikePath(target)) {
    const resolved = resolveAppTargetPath(target, appMigrationsDir, appMigrationsRelative);
    if (!resolved.ok) return resolved;
    const matched = findPackageByDirPath(packages, resolved.value);
    if (!matched) {
      return notOk(
        errorRuntime('MIGRATION.PACKAGE_NOT_FOUND', 'Migration package not found', {
          why: `No loaded migration package at ${relative(process.cwd(), resolved.value)}`,
          fix: 'Pass a directory name, hash prefix, or path to an on-disk app-space migration package.',
        }),
      );
    }
    appPkg = matched;
  } else {
    if (packages.length === 0) {
      return notOk(
        errorRuntime('MIGRATION.NO_MIGRATIONS', 'No migrations found', {
          why: `No migration packages found in ${appMigrationsRelative}`,
          fix: 'Run `prisma-next migration plan` to create a migration first.',
        }),
      );
    }
    const migResult = resolveMigrationRef(target, { graph, refs });
    if (!migResult.ok) {
      return notOk(migResult.failure);
    }
    const matchedPkg = packages.find(
      (p) => p.metadata.migrationHash === migResult.value.migrationHash,
    );
    if (!matchedPkg) {
      return notOk(
        errorRuntime('MIGRATION.PACKAGE_NOT_FOUND', 'Migration package not found', {
          why: `Resolved migration "${migResult.value.dirName}" but the package was not loaded`,
          fix: 'The migrations directory may be corrupted. Inspect the migration.json files.',
        }),
      );
    }
    appPkg = matchedPkg;
  }

  const migration = pkgToPresent(APP_SPACE_ID, appPkg, client);
  return ok({
    ok: true,
    summary: `Migration ${migration.name} in ${migration.space}: ${migration.operations.length} operation(s)`,
    migration,
  });
}

export function createMigrationShowCommand(): Command {
  const command = new Command('show');
  setCommandDescriptions(
    command,
    'Display migration package contents',
    'Shows the operations, statement preview, and metadata for one app-space migration.\n' +
      'Accepts a directory path, directory name, or hash prefix.\n' +
      'Offline — does not consult the database.',
  );
  setCommandExamples(command, [
    'prisma-next migration show 20260101_100000_add_user',
    'prisma-next migration show a1b2c3',
    'prisma-next migration show 20260101_100000_add_user --json',
  ]);
  setCommandSeeAlso(command, [
    { verb: 'migration status', oneLiner: 'Show migration path and pending status' },
    { verb: 'migration log', oneLiner: 'Show executed migration history' },
    { verb: 'migration list', oneLiner: 'List on-disk migrations' },
    { verb: 'migration graph', oneLiner: 'Show the migration graph topology' },
  ]);
  addGlobalOptions(command)
    .argument('<target>', 'Migration reference: directory name, hash/prefix, ref, or path')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .action(async (target: string, options: MigrationShowOptions) => {
      const flags = parseGlobalFlagsOrExit(options);

      const ui = createTerminalUI(flags);

      const result = await executeMigrationShowCommand(target, options, flags, ui);

      const exitCode = handleResult(result, flags, ui, (showResult) => {
        if (flags.json) {
          ui.output(JSON.stringify(showResult, null, 2));
        } else if (!flags.quiet) {
          ui.log(formatMigrationShowOutput(showResult, flags));
        }
      });

      process.exit(exitCode);
    });

  return command;
}
