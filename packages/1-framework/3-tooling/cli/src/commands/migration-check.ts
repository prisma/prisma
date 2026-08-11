import { loadConfigForSections } from '@internal/config-loader';
import { Command } from 'commander';
import { buildReadAggregate } from '../control-api/operations/contract-space-aggregate-loader';
import {
  checkSingleTarget,
  enumerateCheckSpaces,
  loadAggregateIntegrityViolations,
  type MigrationCheckOutcome,
  runMigrationCheck,
} from '../control-api/operations/migration-check';
import {
  addGlobalOptions,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
  setCommandSeeAlso,
} from '../utils/command-helpers';
import { formatErrorJson, formatErrorOutput } from '../utils/formatters/errors';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { integrityViolationToCheckFailure } from '../utils/integrity-violation-to-check-failure';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';
import type { CheckFailure } from './json/schemas';
import { INTEGRITY_FAILED, OK, PRECONDITION } from './migration-check/exit-codes';

interface MigrationCheckOptions extends CommonCommandOptions {
  readonly config?: string;
  readonly space?: string;
}

export type { CheckFailure, MigrationCheckResult } from './json/schemas';
export { migrationCheckResultSchema } from './json/schemas';

async function executeMigrationCheckCommand(
  target: string | undefined,
  options: MigrationCheckOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<MigrationCheckOutcome> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'extensions',
    'migrations',
  ]);
  if (!configResult.ok) {
    return { error: configResult.failure, exitCode: PRECONDITION };
  }
  const config = configResult.value;
  const { configPath, migrationsDir, appMigrationsDir, appMigrationsRelative } =
    resolveMigrationPaths(options.config, config, process.cwd());

  if (!flags.json && !flags.quiet) {
    const details: Array<{ label: string; value: string }> = [
      { label: 'config', value: configPath },
      { label: 'migrations', value: appMigrationsRelative },
    ];
    if (target) {
      details.push({ label: 'target', value: target });
    }
    const header = formatStyledHeader({
      command: 'migration check',
      description: 'Verify artifact and graph integrity',
      details,
      flags,
    });
    ui.stderr(header);
  }

  const loadedAggregate = await buildReadAggregate(config, { migrationsDir });
  if (!loadedAggregate.ok) {
    return { error: loadedAggregate.failure, exitCode: PRECONDITION };
  }

  const spaces = await enumerateCheckSpaces(
    loadedAggregate.value.aggregate,
    migrationsDir,
    process.cwd(),
  );

  if (target) {
    return await checkSingleTarget(target, {
      spaces,
      ...(options.space !== undefined ? { spaceFilter: options.space } : {}),
      appMigrationsDir,
      appMigrationsRelative,
      cwd: process.cwd(),
    });
  }

  const checkResult = await runMigrationCheck({
    spaces,
    ...(options.space !== undefined ? { spaceFilter: options.space } : {}),
  });
  if (!checkResult.ok) {
    return { error: checkResult.failure, exitCode: PRECONDITION };
  }

  const failures: CheckFailure[] = [...checkResult.value.failures];
  const allViolations = await loadAggregateIntegrityViolations(config, migrationsDir);
  const scopedViolations =
    options.space === undefined
      ? allViolations
      : allViolations.filter((v) => v.kind !== 'disjointness' && v.spaceId === options.space);
  for (const violation of scopedViolations) {
    failures.push(integrityViolationToCheckFailure(violation, migrationsDir));
  }

  if (failures.length === 0) {
    return {
      result: { ok: true, failures: [], summary: 'All checks passed' },
      exitCode: OK,
    };
  }

  return {
    result: { ok: false, failures, summary: `${failures.length} integrity failure(s)` },
    exitCode: INTEGRITY_FAILED,
  };
}

export function createMigrationCheckCommand(): Command {
  const command = new Command('check');
  setCommandDescriptions(
    command,
    'Verify artifact and graph integrity',
    'Validates that on-disk migration packages are internally consistent\n' +
      '(hashes match, manifests are complete) and that the graph is well-formed\n' +
      '(edges connect, refs point at valid nodes). The whole-graph check spans\n' +
      'every contract space by default; pass --space <id> to narrow to one. A\n' +
      'migration reference checks a single package, resolved across all contract\n' +
      'spaces (narrow with --space; an ambiguous reference is a precondition failure).\n' +
      'Offline — does not consult the database.\n' +
      'Exit codes: 0 = all checks passed, 2 = precondition failed\n' +
      '(unresolved target or unknown --space), 4 = integrity failure(s) found.',
  );
  setCommandExamples(command, [
    'prisma-next migration check',
    'prisma-next migration check --space app',
    'prisma-next migration check 20260101-add-users',
    'prisma-next migration check 20260101-add-users --space app',
    'prisma-next migration check --json',
  ]);
  setCommandSeeAlso(command, [
    { verb: 'migration status', oneLiner: 'Show migration path and pending status' },
    { verb: 'migration list', oneLiner: 'List on-disk migrations' },
    { verb: 'migration graph', oneLiner: 'Show the migration graph topology' },
    { verb: 'migration show', oneLiner: 'Display migration package contents' },
  ]);
  command.exitOverride();
  addGlobalOptions(command)
    .argument('[target]', 'Migration reference: directory name, hash/prefix, ref, or path')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--space <id>', 'Narrow output to a single contract space')
    .action(async (target: string | undefined, options: MigrationCheckOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);

      let outcome: MigrationCheckOutcome;
      try {
        outcome = await executeMigrationCheckCommand(target, options, flags, ui);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        outcome = {
          result: { ok: false, failures: [], summary: msg },
          exitCode: PRECONDITION,
        };
      }

      if (outcome.error) {
        const envelope = outcome.error.toEnvelope();
        if (flags.json) {
          ui.output(formatErrorJson(envelope));
        } else if (!flags.quiet) {
          ui.error(formatErrorOutput(envelope, flags));
        }
        process.exit(outcome.exitCode);
      }

      const result = outcome.result ?? {
        ok: false,
        failures: [],
        summary: 'No check result produced',
      };

      if (flags.json) {
        ui.output(JSON.stringify(result, null, 2));
      } else if (!flags.quiet) {
        if (result.ok) {
          const spaceSuffix =
            outcome.resolvedSpaceId !== undefined ? `  (space: ${outcome.resolvedSpaceId})` : '';
          ui.log(`✔ ${result.summary}${spaceSuffix}`);
        } else {
          for (const f of result.failures) {
            ui.log(`✗ [${f.code}] ${f.where}: ${f.why}`);
            for (const action of f.nextActions) {
              const command = action.command === undefined ? '' : `: ${action.command}`;
              ui.log(`  next: ${action.label}${command}`);
            }
          }
          ui.log(`\n${result.summary}`);
        }
      }

      process.exit(outcome.exitCode);
    });

  return command;
}
