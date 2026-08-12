import type { MigrationPlannerConflict } from '@internal/framework-components/control';
import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import type { NextAction } from '@internal/utils/structured-error';
import { red } from 'colorette';

import { BIN_NAME } from '../bin-name';
import type { CliErrorConflict, CliErrorEnvelope } from '../cli-errors';
import type { GlobalFlags } from '../global-flags';
import { createColorFormatter, formatDim, isVerbose } from './helpers';
import { formatPlannerWarningsBlock } from './migrations';

const BIN_PLACEHOLDER = '{bin}';

/**
 * Rewrite the `{bin}` placeholder in every next-action command to `binName`.
 *
 * Library-layer error factories cannot know which binary the user invoked, so
 * they write `{bin} ref set <name> <hash>`. Every surface that renders or
 * serializes an envelope resolves the placeholder first, so a consumer only
 * ever sees a command that is runnable as written.
 */
export function resolveBinPlaceholder(
  envelope: CliErrorEnvelope,
  binName: string,
): CliErrorEnvelope {
  const substitute = (command: string) => command.replaceAll(BIN_PLACEHOLDER, binName);
  const resolved: readonly NextAction[] = envelope.nextActions.map((action) => ({
    ...action,
    ...ifDefined('command', action.command?.replaceAll(BIN_PLACEHOLDER, binName)),
    ...ifDefined('commands', action.commands?.map(substitute)),
  }));
  return { ...envelope, nextActions: resolved };
}

/**
 * The display label for a schema-diff issue in the shared error envelope,
 * derived from which sides are present: expected-only is a missing object,
 * actual-only an extra one, both a mismatch. `undefined` when the entry is not
 * a schema-diff issue (it carries neither side) so the caller can fall through
 * to its generic label.
 */
function schemaDiffIssueLabel(issue: {
  readonly expected?: unknown;
  readonly actual?: unknown;
}): 'missing' | 'extra' | 'mismatch' | undefined {
  const hasExpected = issue.expected !== undefined;
  const hasActual = issue.actual !== undefined;
  if (hasExpected && hasActual) return 'mismatch';
  if (hasExpected) return 'missing';
  if (hasActual) return 'extra';
  return undefined;
}

/**
 * Formats error output for human-readable display.
 */
export function formatErrorOutput(error: CliErrorEnvelope, flags: GlobalFlags): string {
  const lines: string[] = [];

  const useColor = flags.color !== false;
  const formatRed = createColorFormatter(useColor, red);
  const formatDimText = (text: string) => formatDim(useColor, text);

  lines.push(`${formatRed('✖')} ${error.summary} (${error.code})`);

  if (error.why) {
    lines.push(`${formatDimText(`  Why: ${error.why}`)}`);
  }
  if (error.fix) {
    lines.push(`${formatDimText(`  Fix: ${error.fix}`)}`);
  }
  if (error.where?.path) {
    const whereLine = error.where.line
      ? `${error.where.path}:${error.where.line}`
      : error.where.path;
    lines.push(`${formatDimText(`  Where: ${whereLine}`)}`);
  }
  // Show conflicts list if present (always show a short list; show full list when verbose)
  if (error.meta?.['conflicts']) {
    const conflicts = error.meta['conflicts'] as readonly CliErrorConflict[];
    if (conflicts.length > 0) {
      const maxToShow = isVerbose(flags, 1) ? conflicts.length : Math.min(3, conflicts.length);
      const header = isVerbose(flags, 1)
        ? '  Conflicts:'
        : `  Conflicts (showing ${maxToShow} of ${conflicts.length}):`;
      lines.push(`${formatDimText(header)}`);
      for (const conflict of conflicts.slice(0, maxToShow)) {
        lines.push(`${formatDimText(`    - [${conflict.kind}] ${conflict.summary}`)}`);
      }
      if (!isVerbose(flags, 1) && conflicts.length > maxToShow) {
        lines.push(`${formatDimText('  Re-run with -v/--verbose to see all conflicts')}`);
      }
    }
  }
  // Show issues list if present (always show a short list; show full list when verbose).
  // `issues` is a shared error-envelope field: PSL interpretation diagnostics stamp
  // `kind` and `message` (their diagnostic code and prose); schema-diff issues
  // (`SchemaDiffIssue`) carry no `message` and stamp `path` plus the
  // `expected`/`actual` presence a label is derived from.
  if (error.meta?.['issues']) {
    const issues = error.meta['issues'] as readonly {
      kind?: string;
      message?: string;
      path?: readonly string[];
      expected?: unknown;
      actual?: unknown;
    }[];
    if (issues.length > 0) {
      const maxToShow = isVerbose(flags, 1) ? issues.length : Math.min(3, issues.length);
      const header = isVerbose(flags, 1)
        ? '  Issues:'
        : `  Issues (showing ${maxToShow} of ${issues.length}):`;
      lines.push(`${formatDimText(header)}`);
      for (const issue of issues.slice(0, maxToShow)) {
        const label = issue.kind ?? schemaDiffIssueLabel(issue) ?? 'issue';
        const message = issue.message ?? issue.path?.join('/') ?? '';
        lines.push(`${formatDimText(`    - [${label}] ${message}`)}`);
      }
      if (!isVerbose(flags, 1) && issues.length > maxToShow) {
        lines.push(`${formatDimText('  Re-run with -v/--verbose to see all issues')}`);
      }
    }
  }
  if (error.docsUrl && isVerbose(flags, 1)) {
    lines.push(formatDimText(error.docsUrl));
  }
  const plannerWarnings = error.meta?.['plannerWarnings'];
  if (Array.isArray(plannerWarnings) && plannerWarnings.length > 0) {
    const typedWarnings = blindCast<
      readonly MigrationPlannerConflict[],
      'mapDbUpdateFailure (db-update.ts) writes meta.plannerWarnings as MigrationPlannerConflict[]; meta is typed Record<string, unknown> so the channel erases the element type'
    >(plannerWarnings);
    lines.push(...formatPlannerWarningsBlock(typedWarnings, useColor));
  }
  if (isVerbose(flags, 2) && error.meta) {
    lines.push(`${formatDimText(`  Meta: ${JSON.stringify(error.meta, null, 2)}`)}`);
  }

  return lines.join('\n');
}

/**
 * Formats error output as JSON.
 */
export function formatErrorJson(error: CliErrorEnvelope): string {
  return JSON.stringify(resolveBinPlaceholder(error, BIN_NAME), null, 2);
}
