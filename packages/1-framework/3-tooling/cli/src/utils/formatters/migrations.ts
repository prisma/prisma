import type {
  MigrationPlannerConflict,
  OperationPreview,
} from '@internal/framework-components/control';
import { cyan, green, yellow } from 'colorette';

import type { PerSpaceExecutionEntry } from '../../control-api/types';
import type { GlobalFlags } from '../global-flags';
import { createColorFormatter, formatDim, isVerbose } from './helpers';

/**
 * Render a single statement of an `OperationPreview` for the human-readable
 * preview block. SQL statements get a trailing `;` if missing so the rendered
 * preview is byte-identical to the legacy `string[]`-based renderer for SQL
 * targets. Other languages (`'mongodb-shell'`) render verbatim.
 */
export function renderPreviewStatement(text: string, language: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (language === 'sql') {
    return trimmed.endsWith(';') ? trimmed : `${trimmed};`;
  }
  return trimmed;
}

/**
 * Choose the header label for a preview block. SQL-only previews keep the
 * legacy `DDL preview` label so the rendered output is byte-identical to the
 * pre-aggregate SQL CLI; previews from any other family — or a mix that
 * includes any non-SQL language — use the family-agnostic `Operation preview`
 * label.
 *
 * An empty `statements` array deliberately renders as `Operation preview`
 * rather than `DDL preview`: `Array.prototype.every` is vacuously true for
 * empty arrays, but we have no evidence the preview is SQL-only when no
 * statements are present, so the family-agnostic label is the safer default.
 */
export function previewBlockHeader(preview: OperationPreview): string {
  const allSql =
    preview.statements.length > 0 && preview.statements.every((s) => s.language === 'sql');
  return allSql ? 'DDL preview' : 'Operation preview';
}

// ============================================================================
// Migration Command Output Formatters (shared by db init and db update)
// ============================================================================

/**
 * Shared CLI output type for migration commands (db init, db update).
 */
export interface MigrationCommandResult {
  readonly ok: true;
  readonly mode: 'plan' | 'apply';
  readonly plan: {
    readonly targetId: string;
    readonly destination: {
      readonly storageHash: string;
      readonly profileHash?: string;
    };
    readonly operations: readonly {
      readonly id: string;
      readonly label: string;
      readonly operationClass: string;
    }[];
    /**
     * Family-agnostic textual preview of the planned operations. Replaces the
     * previous `sql?: readonly string[]`. Consumers should read
     * `plan.preview?.statements`.
     */
    readonly preview?: OperationPreview;
  };
  readonly execution?: {
    readonly operationsPlanned: number;
    readonly operationsExecuted: number;
  };
  readonly marker?: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  /**
   * Per-space execution breakdown in canonical schedule order
   * (extensions alphabetically, then app). Surfaces per-space markers
   * and the ops grouped by space, so the CLI summary can name which
   * space each op and marker belongs to instead of flattening them
   * into a single ambiguous list. See {@link PerSpaceExecutionEntry}.
   */
  readonly perSpace?: ReadonlyArray<PerSpaceExecutionEntry>;
  readonly advancedRef?: { readonly name: string; readonly hash: string } | null;
  readonly plannedAdvanceRef?: { readonly name: string; readonly hash: string } | null;
  readonly summary: string;
  readonly warnings?: readonly MigrationPlannerConflict[];
  readonly timings: {
    readonly total: number;
  };
}

export function formatPlannerWarningsBlock(
  warnings: readonly MigrationPlannerConflict[],
  useColor: boolean,
): readonly string[] {
  const formatDimText = (text: string) => formatDim(useColor, text);
  const lines: string[] = ['', 'Warnings:'];
  for (const warning of warnings) {
    lines.push(`  ${formatDimText(`- ${warning.summary}`)}`);
  }
  return lines;
}

/**
 * Render the shared per-space execution block consumed by the `db init`
 * / `db update` / `migrate` summaries. Always shows: space
 * label (`Extension space: <id>` or `App space`) → per-op lines under
 * each space → per-space marker hash (when known).
 *
 * `mode` controls the marker label phrasing — `'apply'` shows
 * `marker → <hash>` (post-apply), `'plan'` omits the marker line
 * entirely (no marker has been written yet).
 */
export function formatPerSpaceBlock(
  perSpace: ReadonlyArray<PerSpaceExecutionEntry>,
  mode: 'plan' | 'apply',
  useColor: boolean,
): readonly string[] {
  const formatYellow = createColorFormatter(useColor, yellow);
  const formatCyan = createColorFormatter(useColor, cyan);
  const formatDimText = (text: string) => formatDim(useColor, text);

  const lines: string[] = [];
  for (let s = 0; s < perSpace.length; s++) {
    const space = perSpace[s]!;
    if (s > 0) lines.push('');
    const header =
      space.kind === 'app'
        ? formatCyan('App space')
        : formatCyan(`Extension space: ${space.spaceId}`);
    lines.push(header);
    if (space.operations.length === 0) {
      lines.push(`  ${formatDimText('(no operations)')}`);
    } else {
      for (let i = 0; i < space.operations.length; i++) {
        const op = space.operations[i]!;
        const isLast = i === space.operations.length - 1;
        const treeChar = isLast ? '└' : '├';
        const destructiveMarker =
          op.operationClass === 'destructive' ? ` ${formatYellow('(destructive)')}` : '';
        lines.push(`  ${formatDimText(treeChar)}─ ${op.label}${destructiveMarker}`);
      }
    }
    if (mode === 'apply' && space.marker) {
      lines.push(`  ${formatDimText(`marker: ${space.marker.storageHash}`)}`);
    }
  }
  return lines;
}

/**
 * Formats human-readable output for migration commands (db init, db update) in plan mode.
 */
export function formatMigrationPlanOutput(
  result: MigrationCommandResult,
  flags: GlobalFlags,
): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];

  const useColor = flags.color !== false;
  const formatGreen = createColorFormatter(useColor, green);
  const formatDimText = (text: string) => formatDim(useColor, text);

  // Plan summary
  const operationCount = result.plan?.operations.length ?? 0;
  const spaceCount = result.perSpace?.length ?? 0;
  if (spaceCount > 0) {
    lines.push(
      `${formatGreen('✔')} Planned ${operationCount} operation(s) across ${spaceCount} contract space${spaceCount === 1 ? '' : 's'}`,
    );
  } else {
    lines.push(`${formatGreen('✔')} Planned ${operationCount} operation(s)`);
  }

  if (result.warnings && result.warnings.length > 0) {
    lines.push(...formatPlannerWarningsBlock(result.warnings, useColor));
  }

  const formatYellow = createColorFormatter(useColor, yellow);

  // Per-space breakdown takes precedence over the flat ops tree when
  // the aggregate flow surfaced one.
  if (result.perSpace && result.perSpace.length > 0) {
    lines.push('');
    lines.push(...formatPerSpaceBlock(result.perSpace, 'plan', useColor));
    const hasDestructive = result.perSpace.some((s) =>
      s.operations.some((op) => op.operationClass === 'destructive'),
    );
    if (hasDestructive) {
      lines.push('');
      lines.push(
        `${formatYellow('⚠')} This migration contains destructive operations that may cause data loss.`,
      );
    }
  } else if (result.plan?.operations && result.plan.operations.length > 0) {
    // App-only / no-aggregate-breakdown fallback. Same flat tree
    // we've always rendered.
    lines.push(`${formatDimText('│')}`);
    for (let i = 0; i < result.plan.operations.length; i++) {
      const op = result.plan.operations[i];
      if (!op) continue;
      const isLast = i === result.plan.operations.length - 1;
      const treeChar = isLast ? '└' : '├';
      const destructiveMarker =
        op.operationClass === 'destructive' ? ` ${formatYellow('(destructive)')}` : '';
      lines.push(`${formatDimText(treeChar)}─ ${op.label}${destructiveMarker}`);
    }

    const hasDestructive = result.plan.operations.some((op) => op.operationClass === 'destructive');
    if (hasDestructive) {
      lines.push('');
      lines.push(
        `${formatYellow('⚠')} This migration contains destructive operations that may cause data loss.`,
      );
    }
  }

  // Destination hash
  if (result.plan?.destination) {
    lines.push('');
    lines.push(`${formatDimText(`Destination hash: ${result.plan.destination.storageHash}`)}`);
  }

  if (result.plannedAdvanceRef) {
    lines.push('');
    lines.push(
      formatDimText(
        `Would advance ref "${result.plannedAdvanceRef.name}" → ${result.plannedAdvanceRef.hash}`,
      ),
    );
  }

  // Statement preview (any family that implements OperationPreviewCapable)
  const preview = result.plan?.preview;
  if (preview) {
    lines.push('');
    lines.push(`${formatDimText(previewBlockHeader(preview))}`);
    if (preview.statements.length === 0) {
      lines.push(`${formatDimText('No operations.')}`);
    } else {
      lines.push('');
      for (const statement of preview.statements) {
        const rendered = renderPreviewStatement(statement.text, statement.language);
        if (rendered) {
          lines.push(rendered);
        }
      }
    }
  }

  // Timings in verbose mode
  if (isVerbose(flags, 1)) {
    lines.push(`${formatDimText(`Total time: ${result.timings.total}ms`)}`);
  }

  // Note about dry run
  lines.push('');
  lines.push(`${formatDimText('This is a dry run. No changes were applied.')}`);
  lines.push(`${formatDimText('Run without --dry-run to apply changes.')}`);

  return lines.join('\n');
}

export interface MigrationApplyCommandOutputResult {
  readonly migrationsApplied: number;
  readonly markerHash: string;
  readonly applied: readonly {
    readonly spaceId: string;
    readonly dirName?: string;
    readonly migrationHash?: string;
    readonly from?: string;
    readonly to?: string;
    readonly operationsExecuted: number;
  }[];
  readonly summary: string;
  /**
   * Per-space breakdown in canonical schedule order (extensions
   * alphabetically, then app). Always present for the aggregate-walking
   * `migrate` command.
   */
  readonly perSpace: readonly PerSpaceExecutionEntry[];
  readonly timings?: {
    readonly total: number;
  };
  readonly advancedRef?: { readonly name: string; readonly hash: string } | null;
}

export function formatMigrationApplyCommandOutput(
  result: MigrationApplyCommandOutputResult,
  flags: GlobalFlags,
): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];
  const useColor = flags.color !== false;
  const formatGreen = createColorFormatter(useColor, green);
  const formatDimText = (text: string) => formatDim(useColor, text);

  lines.push(`${formatGreen('✔')} ${result.summary}`);

  if (result.perSpace.length > 0) {
    lines.push('');
    for (const line of formatPerSpaceBlock(result.perSpace, 'apply', useColor)) {
      lines.push(line);
    }
  }

  if (result.advancedRef) {
    lines.push('');
    lines.push(
      formatDimText(`Advanced ref "${result.advancedRef.name}" → ${result.advancedRef.hash}`),
    );
  }

  lines.push('');
  lines.push(formatDimText('Next: prisma-next migration status'));

  if (isVerbose(flags, 1) && result.timings) {
    lines.push('');
    lines.push(formatDimText(`Total time: ${result.timings.total}ms`));
  }

  return lines.join('\n');
}

export interface MigrationShowPresent {
  readonly name: string;
  readonly fromContract: string | null;
  readonly toContract: string;
  readonly hash: string;
  readonly createdAt: string;
  readonly operations: readonly {
    readonly id: string;
    readonly label: string;
    readonly operationClass: string;
  }[];
  readonly preview: OperationPreview;
}

interface MigrationShowResult {
  readonly migration: MigrationShowPresent;
}

/**
 * The lines `migration show` puts on stdout: metadata, the operation tree, and
 * the statement preview.
 */
export function renderMigrationShowLines(
  space: MigrationShowPresent,
  options: { readonly colorize: boolean },
): readonly string[] {
  return formatSpaceShowBlock(space, options.colorize);
}

function formatSpaceShowBlock(space: MigrationShowPresent, useColor: boolean): readonly string[] {
  const formatGreen = createColorFormatter(useColor, green);
  const formatYellow = createColorFormatter(useColor, yellow);
  const formatDimText = (text: string) => formatDim(useColor, text);

  const lines: string[] = [];
  lines.push(`${formatGreen('✔')} ${space.name}`);
  lines.push(`${formatDimText(`  from: ${space.fromContract ?? '(baseline)'}`)}`);
  lines.push(`${formatDimText(`  to:   ${space.toContract}`)}`);
  lines.push(`${formatDimText(`  hash: ${space.hash}`)}`);
  lines.push(`${formatDimText(`  created: ${space.createdAt}`)}`);

  lines.push('');
  lines.push(`${space.operations.length} operation(s)`);

  if (space.operations.length > 0) {
    lines.push(`${formatDimText('│')}`);
    for (let i = 0; i < space.operations.length; i++) {
      const op = space.operations[i]!;
      const isLast = i === space.operations.length - 1;
      const treeChar = isLast ? '└' : '├';
      const destructiveMarker =
        op.operationClass === 'destructive' ? ` ${formatYellow('(destructive)')}` : '';
      lines.push(`${formatDimText(treeChar)}─ ${op.label}${destructiveMarker}`);
    }

    const hasDestructive = space.operations.some((op) => op.operationClass === 'destructive');
    if (hasDestructive) {
      lines.push('');
      lines.push(
        `${formatYellow('⚠')} This migration contains destructive operations that may cause data loss.`,
      );
    }
  }

  if (space.preview.statements.length > 0) {
    lines.push('');
    lines.push(`${formatDimText(previewBlockHeader(space.preview))}`);
    lines.push('');
    for (const statement of space.preview.statements) {
      const rendered = renderPreviewStatement(statement.text, statement.language);
      if (rendered) {
        lines.push(rendered);
      }
    }
  }

  return lines;
}

export function formatMigrationShowOutput(result: MigrationShowResult, flags: GlobalFlags): string {
  if (flags.quiet) {
    return '';
  }

  const useColor = flags.color !== false;
  return formatSpaceShowBlock(result.migration, useColor).join('\n');
}

/**
 * Formats human-readable output for migration commands (db init, db update) in apply mode.
 */
export function formatMigrationApplyOutput(
  result: MigrationCommandResult,
  flags: GlobalFlags,
): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];

  const useColor = flags.color !== false;
  const formatGreen = createColorFormatter(useColor, green);
  const formatDimText = (text: string) => formatDim(useColor, text);

  if (result.ok) {
    // Success summary
    const executed = result.execution?.operationsExecuted ?? 0;
    const spaceCount = result.perSpace?.length ?? 0;

    if (executed === 0) {
      const acrossClause =
        spaceCount > 0 ? ` across ${spaceCount} contract space${spaceCount === 1 ? '' : 's'}` : '';
      lines.push(`${formatGreen('✔')} Database already matches contract${acrossClause}`);
    } else if (spaceCount > 0) {
      lines.push(
        `${formatGreen('✔')} Applied ${executed} operation(s) across ${spaceCount} contract space${spaceCount === 1 ? '' : 's'}`,
      );
    } else {
      lines.push(`${formatGreen('✔')} Applied ${executed} operation(s)`);
    }

    if (result.warnings && result.warnings.length > 0) {
      lines.push(...formatPlannerWarningsBlock(result.warnings, useColor));
    }

    // Per-space breakdown — replaces the single ambiguous `Signature:`
    // line with a per-space marker + ops listing.
    if (result.perSpace && result.perSpace.length > 0) {
      lines.push('');
      lines.push(...formatPerSpaceBlock(result.perSpace, 'apply', useColor));
      lines.push('');
      lines.push(
        formatDimText(
          `Run 'prisma-next migration status' to confirm ${
            spaceCount === 1 ? 'the space is' : 'all spaces are'
          } up to date.`,
        ),
      );
    } else if (result.marker) {
      // App-only / no-aggregate-breakdown fallback (e.g. older callers
      // / non-aggregate code paths). The label is
      // `App-space marker` (not `Signature`) so that when only one
      // marker is observable we still name what it covers explicitly.
      lines.push(`${formatDimText(`  App-space marker: ${result.marker.storageHash}`)}`);
      if (result.marker.profileHash) {
        lines.push(`${formatDimText(`  Profile hash: ${result.marker.profileHash}`)}`);
      }
    }

    // Timings in verbose mode
    if (isVerbose(flags, 1)) {
      lines.push(`${formatDimText(`  Total time: ${result.timings.total}ms`)}`);
    }

    if (result.advancedRef) {
      lines.push(
        formatDimText(`Advanced ref "${result.advancedRef.name}" → ${result.advancedRef.hash}`),
      );
    }
  }

  return lines.join('\n');
}

/**
 * Formats JSON output for migration commands (db init, db update).
 */
export function formatMigrationJson(result: MigrationCommandResult): string {
  return JSON.stringify(result, null, 2);
}
