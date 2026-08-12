import { blue, bold, cyan, green } from 'colorette';
import type { Command } from 'commander';
import stringWidth from 'string-width';
import stripAnsi from 'strip-ansi';

import type { GlobalFlags } from '../global-flags';
import { createColorFormatter, formatDim } from './helpers';

// ============================================================================
// Styled Output Formatters
// ============================================================================

/**
 * Fixed width for left column in help output.
 */
const LEFT_COLUMN_WIDTH = 20;

/**
 * Creates an arrow segment badge with green background and white text.
 * Body: green background with white "prisma-next" text
 * Tip: dark grey arrow pointing right (Powerline separator)
 */
function createPrismaNextBadge(useColor: boolean): string {
  if (!useColor) {
    return 'prisma-next';
  }
  return bold('prisma-next');
}

/**
 * Creates a padding function.
 */
function createPadFunction(): (s: string, w: number) => string {
  return (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
}

/**
 * Formats a header line: brand + operation + intent
 */
function formatHeaderLine(options: {
  readonly brand: string;
  readonly operation: string;
  readonly intent: string;
}): string {
  if (options.operation) {
    return `${options.brand} ${options.operation} → ${options.intent}`;
  }
  return `${options.brand} ${options.intent}`;
}

/**
 * Formats a "Read more" URL line.
 * The "Read more" label is in default color (not cyan), and the URL is blue.
 */
function formatReadMoreLine(options: {
  readonly url: string;
  readonly maxLabelWidth: number;
  readonly useColor: boolean;
  readonly formatDimText: (text: string) => string;
}): string {
  const pad = createPadFunction();
  const labelPadded = pad('Read more', options.maxLabelWidth);
  // Label is default color (not cyan)
  const valueColored = options.useColor ? blue(options.url) : options.url;
  return `${options.formatDimText('│')} ${labelPadded}  ${valueColored}`;
}

/**
 * Pads text to a fixed width, accounting for ANSI escape codes.
 * Uses string-width to measure the actual display width.
 */
export function padToFixedWidth(text: string, width: number): string {
  const actualWidth = stringWidth(text);
  const padding = Math.max(0, width - actualWidth);
  return text + ' '.repeat(padding);
}

/**
 * Renders a command tree structure.
 * Handles both single-level (subcommands of a command) and multi-level (top-level commands with subcommands) trees.
 */
export function renderCommandTree(options: {
  readonly commands: readonly Command[];
  readonly useColor: boolean;
  readonly formatDimText: (text: string) => string;
  readonly hasItemsAfter: boolean;
  readonly continuationPrefix?: string;
}): string[] {
  const { commands, useColor, formatDimText, hasItemsAfter, continuationPrefix } = options;
  const lines: string[] = [];

  if (commands.length === 0) {
    return lines;
  }

  // Format each command
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    if (!cmd) continue;

    const subcommands = cmd.commands.filter((subcmd) => !subcmd.name().startsWith('_'));
    const isLastCommand = i === commands.length - 1;

    if (subcommands.length > 0) {
      // Command with subcommands - show command name, then tree-structured subcommands
      const treeChar = isLastCommand && !hasItemsAfter ? formatDimText('└') : formatDimText('├');
      // For top-level command, pad name to fixed width (accounting for "| |-- " = 5 chars)
      const treePrefix = `${treeChar}─ `;
      const treePrefixWidth = stringWidth(stripAnsi(treePrefix));
      const remainingWidth = LEFT_COLUMN_WIDTH - treePrefixWidth;
      const commandNamePadded = padToFixedWidth(cmd.name(), remainingWidth);
      const commandNameColored = useColor ? cyan(commandNamePadded) : commandNamePadded;
      lines.push(`${formatDimText('│')} ${treePrefix}${commandNameColored}`);

      for (let j = 0; j < subcommands.length; j++) {
        const subcmd = subcommands[j];
        if (!subcmd) continue;

        const isLastSubcommand = j === subcommands.length - 1;
        const shortDescription = subcmd.description() || '';

        // Use tree characters: -- for last subcommand, |-- for others
        const treeChar = isLastSubcommand ? '└' : '├';
        const continuation =
          continuationPrefix ??
          (isLastCommand && isLastSubcommand && !hasItemsAfter ? ' ' : formatDimText('│'));
        // For subcommands, account for "| |  -- " = 7 chars (or "|   -- " = 6 chars if continuation is space)
        const continuationStr = continuation === ' ' ? ' ' : continuation;
        const subTreePrefix = `${continuationStr}  ${formatDimText(treeChar)}─ `;
        const subTreePrefixWidth = stringWidth(stripAnsi(subTreePrefix));
        const subRemainingWidth = LEFT_COLUMN_WIDTH - subTreePrefixWidth;
        const subcommandNamePadded = padToFixedWidth(subcmd.name(), subRemainingWidth);
        const subcommandNameColored = useColor ? cyan(subcommandNamePadded) : subcommandNamePadded;
        lines.push(
          `${formatDimText('│')} ${subTreePrefix}${subcommandNameColored}  ${shortDescription}`,
        );
      }
    } else {
      // Standalone command - show command name and description on same line
      const treeChar = isLastCommand && !hasItemsAfter ? formatDimText('└') : formatDimText('├');
      const treePrefix = `${treeChar}─ `;
      const treePrefixWidth = stringWidth(stripAnsi(treePrefix));
      const remainingWidth = LEFT_COLUMN_WIDTH - treePrefixWidth;
      const commandNamePadded = padToFixedWidth(cmd.name(), remainingWidth);
      const commandNameColored = useColor ? cyan(commandNamePadded) : commandNamePadded;
      const shortDescription = cmd.description() || '';
      lines.push(`${formatDimText('│')} ${treePrefix}${commandNameColored}  ${shortDescription}`);
    }
  }

  return lines;
}

/**
 * Formats the header in the new experimental visual style.
 * This header appears at the start of command output, showing the operation,
 * intent, documentation link, and parameters.
 */
export function formatStyledHeader(options: {
  readonly command: string;
  readonly description: string;
  readonly url?: string;
  readonly details: ReadonlyArray<{ readonly label: string; readonly value: string }>;
  readonly flags: GlobalFlags;
}): string {
  const lines: string[] = [];
  const useColor = options.flags.color !== false;
  const formatDimText = (text: string) => formatDim(useColor, text);

  // Header: arrow + operation badge + intent
  const brand = createPrismaNextBadge(useColor);
  // Use full command path (e.g., "contract emit" not just "emit")
  const operation = useColor ? bold(options.command) : options.command;
  const intent = formatDimText(options.description);
  lines.push(formatHeaderLine({ brand, operation, intent }));
  lines.push(formatDimText('│')); // Vertical line separator between command and params

  // Format details using fixed left column width (same style as help text options)
  for (const detail of options.details) {
    // Add colon to label, then pad to fixed width using padToFixedWidth for ANSI-aware padding
    const labelWithColon = `${detail.label}:`;
    const labelPadded = padToFixedWidth(labelWithColon, LEFT_COLUMN_WIDTH);
    const labelColored = useColor ? cyan(labelPadded) : labelPadded;
    lines.push(`${formatDimText('│')} ${labelColored}  ${detail.value}`);
  }

  // Add "Read more" URL if present (same style as help text)
  if (options.url) {
    lines.push(formatDimText('│')); // Separator line before "Read more"
    lines.push(
      formatReadMoreLine({
        url: options.url,
        maxLabelWidth: LEFT_COLUMN_WIDTH,
        useColor,
        formatDimText,
      }),
    );
  }

  lines.push(formatDimText('└'));

  return `${lines.join('\n')}\n`;
}

/**
 * Formats a success message in the styled output format.
 */
export function formatSuccessMessage(flags: GlobalFlags): string {
  const useColor = flags.color !== false;
  const formatGreen = createColorFormatter(useColor, green);
  return `${formatGreen('✔')} Success`;
}
