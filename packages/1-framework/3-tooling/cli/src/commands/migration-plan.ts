import { loadConfigForSections } from '@internal/config-loader';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import {
  executeMigrationPlanCommand,
  type MigrationPlanResult,
} from '../control-api/operations/migration-plan';
import type { CliStructuredError } from '../utils/cli-errors';
import {
  addGlobalOptions,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI } from '../utils/terminal-ui';

interface MigrationPlanCommandOptions extends CommonCommandOptions {
  readonly config?: string;
  readonly name?: string;
  readonly from?: string;
  readonly to?: string;
}

async function runMigrationPlan(
  options: MigrationPlanCommandOptions,
  startTime: number,
  callbacks: Parameters<typeof executeMigrationPlanCommand>[2],
): Promise<Result<MigrationPlanResult, CliStructuredError>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'extensions',
    'migrations',
    'contract',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  return executeMigrationPlanCommand(
    {
      ...options,
      config: configResult.value,
      cwd: process.cwd(),
      ...ifDefined('configPath', options.config),
    },
    startTime,
    callbacks,
  );
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
    .action(async (options: MigrationPlanCommandOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const startTime = Date.now();

      const ui = createTerminalUI(flags);
      const result = await runMigrationPlan(options, startTime, {
        onContextResolved: ({ configPath, contractPath, appMigrationsRelative }) => {
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
        },
        onSeeded: (record) => {
          if (!flags.json && !flags.quiet && record.action === 'updated') {
            const pkgSuffix =
              record.newMigrationDirs.length > 0
                ? `; ${record.newMigrationDirs.length} new migration package(s) materialised`
                : '';
            ui.step(`Updated ${record.spaceId} to ${record.newHash}${pkgSuffix}`);
          }
        },
      });

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
