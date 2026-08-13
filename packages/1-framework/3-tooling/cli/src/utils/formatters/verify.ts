import type {
  CoreSchemaView,
  ExpectationFailureReason,
  IntrospectSchemaResult,
  SchemaDiffIssue,
  SchemaTreeNode,
  SignDatabaseResult,
  VerifyDatabaseResult,
  VerifyDatabaseSchemaResult,
} from '@internal/framework-components/control';
import { issueOutcome } from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import { bold, cyan, dim, green, magenta, red, yellow } from 'colorette';
import type { GlobalFlags } from '../global-flags';
import { createColorFormatter, formatDim, isVerbose } from './helpers';

/** Human-readable label for each outcome, prefixed onto an issue's message for display. */
const OUTCOME_LABEL: Record<ExpectationFailureReason, string> = {
  'not-found': 'missing',
  'not-expected': 'extra',
  'not-equal': 'mismatch',
};

/**
 * The issue's display text: its own path, prefixed with a human label for
 * why it's flagged. Turning the presence-derived outcome (and the path) into
 * prose is this formatter's job, not the differ's — the differ's issue is
 * data (`path` + nodes), not prose.
 */
function formatIssueMessage(issue: SchemaDiffIssue): string {
  return `${OUTCOME_LABEL[issueOutcome(issue)]}: ${issue.path.join('/')}`;
}

// ============================================================================
// Verify Output Formatters
// ============================================================================

/**
 * What a verify run reports, minus the verdict flag. Consumers compose their
 * own envelope around it: the commander shell wraps it as
 * {@link DbVerifyCommandSuccessResult}, the engine bin as a document whose
 * `ok` carries the verdict either way.
 */
export interface DbVerifyReport {
  readonly mode: 'full' | 'marker-only';
  readonly summary: string;
  readonly contract: VerifyDatabaseResult['contract'];
  readonly marker?: VerifyDatabaseResult['marker'];
  readonly target: VerifyDatabaseResult['target'];
  readonly missingCodecs?: VerifyDatabaseResult['missingCodecs'];
  readonly codecCoverageSkipped?: VerifyDatabaseResult['codecCoverageSkipped'];
  readonly schema?: {
    readonly summary: string;
    readonly strict: boolean;
    /**
     * Warn-graded finding messages (observed-policy drift). Informational —
     * present on a passing verify; the full-mode result summarizes them as a
     * flat message list.
     */
    readonly warnings?: readonly string[];
  };
  /**
   * Live element names no contract space declares. In full success this is
   * only ever non-empty in lenient mode — strict mode fails on it — and is
   * rendered informationally.
   */
  readonly unclaimed?: readonly string[];
  readonly warning?: string;
  readonly meta?:
    | (NonNullable<VerifyDatabaseResult['meta']> & {
        readonly schemaVerification: 'performed' | 'skipped';
      })
    | {
        readonly schemaVerification: 'performed' | 'skipped';
      };
  readonly timings: {
    readonly total: number;
  };
}

export interface DbVerifyCommandSuccessResult extends DbVerifyReport {
  readonly ok: true;
}

/**
 * Formats human-readable output for database verify.
 */
export function formatVerifyOutput(
  result: DbVerifyCommandSuccessResult,
  flags: GlobalFlags,
): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];

  const useColor = flags.color !== false;
  const formatGreen = createColorFormatter(useColor, green);
  const formatYellow = createColorFormatter(useColor, yellow);
  const formatDimText = (text: string) => formatDim(useColor, text);
  const verificationMode =
    result.mode === 'full'
      ? `marker + schema${result.schema?.strict ? ' (strict)' : ' (tolerant)'}`
      : 'marker only (--marker-only)';

  lines.push(`${formatGreen('✔')} ${result.summary}`);
  lines.push(`${formatDimText(`  verification: ${verificationMode}`)}`);
  lines.push(`${formatDimText(`  storageHash: ${result.contract.storageHash}`)}`);
  if (result.contract.profileHash) {
    lines.push(`${formatDimText(`  profileHash: ${result.contract.profileHash}`)}`);
  }
  if (result.schema?.warnings && result.schema.warnings.length > 0) {
    lines.push('');
    lines.push(formatYellow('Schema warnings:'));
    for (const message of result.schema.warnings) {
      lines.push(`  ${formatYellow('⚠')} ${message}`);
    }
  }

  if (result.unclaimed && result.unclaimed.length > 0) {
    lines.push('');
    lines.push(formatYellow('Unclaimed elements (declared by no contract):'));
    for (const name of result.unclaimed) {
      lines.push(`  ${formatYellow('⚠')} ${name}`);
    }
  }

  if (result.warning) {
    lines.push('');
    lines.push(`${formatYellow('⚠')} ${result.warning}`);
  }

  if (isVerbose(flags, 1)) {
    if (result.codecCoverageSkipped) {
      lines.push(
        `${formatDimText('  Codec coverage check skipped (helper returned no supported types)')}`,
      );
    }
    lines.push(`${formatDimText(`  Total time: ${result.timings.total}ms`)}`);
  }

  return lines.join('\n');
}

/**
 * Formats JSON output for database verify.
 */
export function formatVerifyJson(result: DbVerifyCommandSuccessResult): string {
  const output = {
    ok: result.ok,
    summary: result.summary,
    mode: result.mode,
    contract: result.contract,
    ...ifDefined('marker', result.marker),
    target: result.target,
    ...ifDefined('missingCodecs', result.missingCodecs),
    ...ifDefined('codecCoverageSkipped', result.codecCoverageSkipped),
    ...ifDefined('schema', result.schema),
    unclaimed: result.unclaimed ?? [],
    ...ifDefined('warning', result.warning),
    ...ifDefined('meta', result.meta),
    timings: result.timings,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Formats JSON output for database introspection.
 */
export function formatIntrospectJson(result: IntrospectSchemaResult<unknown>): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Renders a schema tree structure from CoreSchemaView.
 * Status-glyph tree styling shared with the retired verification-tree renderer.
 */
function renderSchemaTree(
  node: SchemaTreeNode,
  flags: GlobalFlags,
  options: {
    readonly isLast: boolean;
    readonly prefix: string;
    readonly useColor: boolean;
    readonly formatDimText: (text: string) => string;
    readonly isRoot?: boolean;
  },
): string[] {
  const { isLast, prefix, useColor, formatDimText, isRoot = false } = options;
  const lines: string[] = [];

  // Format node label with color based on kind (matching schema-verify style)
  let formattedLabel: string = node.label;

  if (useColor) {
    switch (node.kind) {
      case 'root':
        formattedLabel = bold(node.label);
        break;
      case 'entity': {
        // Parse "table tableName" format - color "table" dim, tableName cyan
        const tableMatch = node.label.match(/^table\s+(.+)$/);
        if (tableMatch?.[1]) {
          const tableName = tableMatch[1];
          formattedLabel = `${dim('table')} ${cyan(tableName)}`;
        } else {
          // Fallback: color entire label with cyan
          formattedLabel = cyan(node.label);
        }
        break;
      }
      case 'collection': {
        // "columns" grouping node - dim the label
        formattedLabel = dim(node.label);
        break;
      }
      case 'field': {
        // Parse column name format: "columnName: typeDisplay (nullability)"
        // Color code: column name (cyan), type (default), nullability (dim)
        const columnMatch = node.label.match(/^([^:]+):\s*(.+)$/);
        if (columnMatch?.[1] && columnMatch[2]) {
          const columnName = columnMatch[1];
          const rest = columnMatch[2];
          // Parse rest: "typeDisplay (nullability)"
          const typeMatch = rest.match(/^([^\s(]+)\s*(\([^)]+\))$/);
          if (typeMatch?.[1] && typeMatch[2]) {
            const typeDisplay = typeMatch[1];
            const nullability = typeMatch[2];
            formattedLabel = `${cyan(columnName)}: ${typeDisplay} ${dim(nullability)}`;
          } else {
            // Fallback if format doesn't match
            formattedLabel = `${cyan(columnName)}: ${rest}`;
          }
        } else {
          formattedLabel = node.label;
        }
        break;
      }
      case 'index': {
        // Parse index/unique constraint/primary key formats
        // "primary key: columnName" -> dim "primary key", cyan columnName
        const pkMatch = node.label.match(/^primary key:\s*(.+)$/);
        if (pkMatch?.[1]) {
          const columnNames = pkMatch[1];
          formattedLabel = `${dim('primary key')}: ${cyan(columnNames)}`;
        } else {
          // "unique name" -> dim "unique", cyan "name"
          const uniqueMatch = node.label.match(/^unique\s+(.+)$/);
          if (uniqueMatch?.[1]) {
            const name = uniqueMatch[1];
            formattedLabel = `${dim('unique')} ${cyan(name)}`;
          } else {
            // "index name" or "unique index name" -> dim label prefix, cyan name
            const indexMatch = node.label.match(/^(unique\s+)?index\s+(.+)$/);
            if (indexMatch?.[2]) {
              const indexPrefix = indexMatch[1] ? `${dim('unique')} ` : '';
              const name = indexMatch[2];
              formattedLabel = `${indexPrefix}${dim('index')} ${cyan(name)}`;
            } else {
              formattedLabel = dim(node.label);
            }
          }
        }
        break;
      }
      case 'dependency': {
        // Parse extension message formats similar to schema-verify
        // "extensionName extension is enabled" -> cyan extensionName, dim rest
        const extMatch = node.label.match(/^([^\s]+)\s+(extension is enabled)$/);
        if (extMatch?.[1] && extMatch[2]) {
          const extName = extMatch[1];
          const rest = extMatch[2];
          formattedLabel = `${cyan(extName)} ${dim(rest)}`;
        } else {
          // Fallback: color entire label with magenta
          formattedLabel = magenta(node.label);
        }
        break;
      }
      default:
        formattedLabel = node.label;
        break;
    }
  }

  // Root node renders without tree characters or prefix
  if (isRoot) {
    lines.push(formattedLabel);
  } else {
    const treeChar = isLast ? '└' : '├';
    const treePrefix = `${formatDimText(treeChar)}─ `;
    lines.push(`${prefix}${treePrefix}${formattedLabel}`);
  }

  // Render children if present
  if (node.children && node.children.length > 0) {
    const childPrefix = isRoot ? '' : `${prefix}${isLast ? '   ' : `${formatDimText('│')}  `}`;
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (!child) continue;
      const isLastChild = i === node.children.length - 1;
      const childLines = renderSchemaTree(child, flags, {
        isLast: isLastChild,
        prefix: childPrefix,
        useColor,
        formatDimText,
        isRoot: false,
      });
      lines.push(...childLines);
    }
  }

  return lines;
}

/**
 * Formats human-readable output for database introspection.
 */
export function formatIntrospectOutput(
  result: IntrospectSchemaResult<unknown>,
  schemaView: CoreSchemaView | undefined,
  flags: GlobalFlags,
): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];

  const useColor = flags.color !== false;
  const formatDimText = (text: string) => formatDim(useColor, text);

  if (schemaView) {
    // Render tree structure - root node is special (no tree characters)
    const treeLines = renderSchemaTree(schemaView.root, flags, {
      isLast: true,
      prefix: '',
      useColor,
      formatDimText,
      isRoot: true,
    });
    lines.push(...treeLines);
  } else {
    // Fallback: print summary when toSchemaView is not available
    lines.push(`✔ ${result.summary}`);
    if (isVerbose(flags, 1)) {
      lines.push(`  Target: ${result.target.familyId}/${result.target.id}`);
      if (result.meta?.dbUrl) {
        lines.push(`  Database: ${result.meta.dbUrl}`);
      }
    }
  }

  // Add timings in verbose mode
  if (isVerbose(flags, 1)) {
    lines.push(`${formatDimText(`  Total time: ${result.timings.total}ms`)}`);
  }

  return lines.join('\n');
}

/**
 * Formats human-readable output for database schema verification.
 */
export function formatSchemaVerifyOutput(
  result: VerifyDatabaseSchemaResult,
  flags: GlobalFlags,
  unclaimed: readonly string[] = [],
): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];

  const useColor = flags.color !== false;
  const formatGreen = createColorFormatter(useColor, green);
  const formatRed = createColorFormatter(useColor, red);
  const formatYellow = createColorFormatter(useColor, yellow);
  const formatDimText = (text: string) => formatDim(useColor, text);

  const issueMessages = result.schema.issues.map(formatIssueMessage);
  if (issueMessages.length > 0) {
    lines.push(formatRed('Schema issues:'));
    for (const message of issueMessages) {
      lines.push(`  ${formatRed('✖')} ${message}`);
    }
  }

  const warningMessages = (result.schema.warnings?.issues ?? []).map(formatIssueMessage);
  if (warningMessages.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(formatYellow('Schema warnings:'));
    for (const message of warningMessages) {
      lines.push(`  ${formatYellow('⚠')} ${message}`);
    }
  }

  if (unclaimed.length > 0) {
    const strict = result.meta?.strict ?? false;
    if (lines.length > 0) lines.push('');
    lines.push(
      (strict ? formatRed : formatYellow)('Unclaimed elements (declared by no contract):'),
    );
    for (const name of unclaimed) {
      lines.push(`  ${(strict ? formatRed : formatYellow)(strict ? '✖' : '⚠')} ${name}`);
    }
  }

  if (isVerbose(flags, 1)) {
    lines.push(`${formatDimText(`  Total time: ${result.timings.total}ms`)}`);
  }

  // Blank line before summary
  if (lines.length > 0) lines.push('');

  // Summary line at the end: verdict with status glyph
  if (result.ok) {
    lines.push(`${formatGreen('✔')} ${result.summary}`);
  } else {
    const codeText = result.code ? ` (${result.code})` : '';
    lines.push(`${formatRed('✖')} ${result.summary}${codeText}`);
  }

  return lines.join('\n');
}

/**
 * Formats JSON output for database schema verification. The unclaimed-elements
 * list is a top-level field alongside the combined result, reported once for
 * the whole database.
 */
export function formatSchemaVerifyJson(
  result: VerifyDatabaseSchemaResult,
  unclaimed: readonly string[] = [],
): string {
  return JSON.stringify({ ...result, unclaimed }, null, 2);
}

// ============================================================================
// Sign Output Formatters
// ============================================================================

/**
 * Formats human-readable output for database sign.
 */
export function formatSignOutput(result: SignDatabaseResult, flags: GlobalFlags): string {
  if (flags.quiet) {
    return '';
  }

  const lines: string[] = [];

  const useColor = flags.color !== false;
  const formatGreen = createColorFormatter(useColor, green);
  const formatDimText = (text: string) => formatDim(useColor, text);

  if (result.ok) {
    // Main success message in white (not dimmed)
    lines.push(`${formatGreen('✔')} Database signed`);

    // Show from -> to hashes with clear labels
    const previousHash = result.marker.previous?.storageHash ?? 'none';
    const currentHash = result.contract.storageHash;

    lines.push(`${formatDimText(`  from: ${previousHash}`)}`);
    lines.push(`${formatDimText(`  to:   ${currentHash}`)}`);

    if (isVerbose(flags, 1)) {
      if (result.contract.profileHash) {
        lines.push(`${formatDimText(`  profileHash: ${result.contract.profileHash}`)}`);
      }
      if (result.marker.previous?.profileHash) {
        lines.push(
          `${formatDimText(`  previous profileHash: ${result.marker.previous.profileHash}`)}`,
        );
      }
      lines.push(`${formatDimText(`  Total time: ${result.timings.total}ms`)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats JSON output for database sign.
 */
export function formatSignJson(result: SignDatabaseResult): string {
  return JSON.stringify(result, null, 2);
}
