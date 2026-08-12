import { blue, bold, cyan, dim, green, magenta } from 'colorette';
import type { Command } from 'commander';
import wrapAnsi from 'wrap-ansi';

import { getCommandExamples, getCommandSeeAlso, getLongDescription } from '../command-helpers';
import type { GlobalFlags } from '../global-flags';
import { formatDim } from './helpers';
import { padToFixedWidth, renderCommandTree } from './styled';

// ============================================================================
// Help Output Formatters
// ============================================================================

/**
 * Fixed width for left column in help output.
 * Must match the value in styled.ts.
 */
const LEFT_COLUMN_WIDTH = 20;

/**
 * Minimum width for right column wrapping in help output.
 */
const RIGHT_COLUMN_MIN_WIDTH = 40;

/**
 * Maximum width for right column wrapping in help output (when terminal is wide enough).
 */
const RIGHT_COLUMN_MAX_WIDTH = 90;

/**
 * Gets the terminal width, or returns a default if not available.
 */
function getTerminalWidth(): number {
  // Help text goes to stderr, so prefer stderr columns. Fall back to stdout, then CLI_WIDTH env.
  const terminalWidth = process.stderr.columns || process.stdout.columns;
  const envWidth = Number.parseInt(process.env['CLI_WIDTH'] || '', 10);
  return terminalWidth || (Number.isFinite(envWidth) ? envWidth : 80);
}

/**
 * Calculates the available width for the right column based on terminal width.
 */
function calculateRightColumnWidth(): number {
  const terminalWidth = getTerminalWidth();
  const availableWidth = terminalWidth - 2 - LEFT_COLUMN_WIDTH - 2;
  return Math.max(RIGHT_COLUMN_MIN_WIDTH, Math.min(availableWidth, RIGHT_COLUMN_MAX_WIDTH));
}

/**
 * Creates the CLI brand badge.
 */
function createPrismaNextBadge(useColor: boolean): string {
  return useColor ? bold('prisma-next') : 'prisma-next';
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
 * Wraps text to fit within a specified width using wrap-ansi.
 */
function wrapTextAnsi(text: string, width: number): string[] {
  const wrapped = wrapAnsi(text, width, { hard: false, trim: true });
  return wrapped.split('\n');
}

/**
 * Formats a default value as "default: <value>" with dimming.
 */
function formatDefaultValue(value: unknown, useColor: boolean): string {
  const valueStr = String(value);
  const defaultText = `default: ${valueStr}`;
  return useColor ? dim(defaultText) : defaultText;
}

/**
 * Formats a "Read more" URL line.
 */
function formatReadMoreLine(options: {
  readonly url: string;
  readonly maxLabelWidth: number;
  readonly useColor: boolean;
  readonly formatDimText: (text: string) => string;
}): string {
  const labelPadded = `Read more${' '.repeat(Math.max(0, options.maxLabelWidth - 'Read more'.length))}`;
  const valueColored = options.useColor ? blue(options.url) : options.url;
  return `${options.formatDimText('│')} ${labelPadded}  ${valueColored}`;
}

/**
 * Formats multiline description with "Prisma Next" in green.
 */
function formatMultilineDescription(options: {
  readonly descriptionLines: readonly string[];
  readonly useColor: boolean;
  readonly formatDimText: (text: string) => string;
}): string[] {
  const lines: string[] = [];
  const formatGreen = (text: string) => (options.useColor ? green(text) : text);

  const rightColumnWidth = calculateRightColumnWidth();
  const totalWidth = 2 + LEFT_COLUMN_WIDTH + 2 + rightColumnWidth;
  const wrapWidth = totalWidth - 2;

  for (const descLine of options.descriptionLines) {
    const formattedLine = descLine.replace(/Prisma Next/g, (match) => formatGreen(match));
    const wrappedLines = wrapTextAnsi(formattedLine, wrapWidth);
    for (const wrappedLine of wrappedLines) {
      lines.push(`${options.formatDimText('│')} ${wrappedLine}`);
    }
  }
  return lines;
}

/**
 * Maps command paths to their documentation URLs.
 */
function getCommandDocsUrl(commandPath: string): string | undefined {
  const docsMap: Record<string, string> = {
    'contract emit': 'https://pris.ly/contract-emit',
    'contract infer': 'https://pris.ly/contract-infer',
    'db schema': 'https://pris.ly/db-schema',
    'db verify': 'https://pris.ly/db-verify',
    'db update': 'https://pris.ly/db-update',
    'migration plan': 'https://pris.ly/migration-plan',
    migrate: 'https://pris.ly/migrate',
    'migration show': 'https://pris.ly/migration-show',
    'migration status': 'https://pris.ly/migration-status',
  };
  return docsMap[commandPath];
}

/**
 * Builds the full command path from a command and its parents.
 */
function buildCommandPath(command: Command): string {
  const parts: string[] = [];
  let current: Command | undefined = command;
  while (current && current.name() !== 'prisma-next') {
    parts.unshift(current.name());
    current = current.parent ?? undefined;
  }
  return parts.join(' ');
}

/**
 * Formats help output for a command using the styled format.
 */
export function formatCommandHelp(options: {
  readonly command: Command;
  readonly flags: GlobalFlags;
}): string {
  const { command, flags } = options;
  const lines: string[] = [];
  const useColor = flags.color !== false;
  const formatDimText = (text: string) => formatDim(useColor, text);

  // Build full command path (e.g., "db verify")
  const commandPath = buildCommandPath(command);
  const shortDescription = command.description() || '';
  const longDescription = getLongDescription(command);

  // Include positional arguments in the header line
  const argsSuffix = command.registeredArguments
    .map((arg) => (arg.required ? `<${arg.name()}>` : `[${arg.name()}]`))
    .join(' ');
  const brand = createPrismaNextBadge(useColor);
  const commandWithArgs = argsSuffix ? `${commandPath} ${argsSuffix}` : commandPath;
  const operation = useColor ? bold(commandWithArgs) : commandWithArgs;
  const intent = formatDimText(shortDescription);
  lines.push(formatHeaderLine({ brand, operation, intent }));
  lines.push(formatDimText('│'));

  // Extract options and format them
  const optionsList = command.options.map((opt) => {
    const description = opt.description || '';
    // Commander.js stores default value in defaultValue property
    const defaultValue = (opt as { defaultValue?: unknown }).defaultValue;
    return { flags: opt.flags, description, defaultValue };
  });

  // Extract subcommands if any
  const subcommands = command.commands.filter((cmd) => !cmd.name().startsWith('_'));

  // Format subcommands as a tree if present
  if (subcommands.length > 0) {
    const hasItemsAfter = optionsList.length > 0;
    const treeLines = renderCommandTree({
      commands: subcommands,
      useColor,
      formatDimText,
      hasItemsAfter,
    });
    lines.push(...treeLines);
  }

  // Add separator between subcommands and options if both exist
  if (subcommands.length > 0 && optionsList.length > 0) {
    lines.push(formatDimText('│'));
  }

  // Format options with fixed width, wrapping, and default values
  if (optionsList.length > 0) {
    for (const opt of optionsList) {
      // Format flag with fixed 30-char width
      const flagsPadded = padToFixedWidth(opt.flags, LEFT_COLUMN_WIDTH);
      let flagsColored = flagsPadded;
      if (useColor) {
        // Color placeholders in magenta, then wrap in cyan
        flagsColored = flagsPadded.replace(/(<[^>]+>)/g, (match: string) => magenta(match));
        flagsColored = cyan(flagsColored);
      }

      // Wrap description based on terminal width
      const rightColumnWidth = calculateRightColumnWidth();
      const wrappedDescription = wrapTextAnsi(opt.description, rightColumnWidth);

      // First line: flag + first line of description
      lines.push(`${formatDimText('│')} ${flagsColored}  ${wrappedDescription[0] || ''}`);

      // Continuation lines: empty label (30 spaces) + wrapped lines
      for (let i = 1; i < wrappedDescription.length; i++) {
        const emptyLabel = ' '.repeat(LEFT_COLUMN_WIDTH);
        lines.push(`${formatDimText('│')} ${emptyLabel}  ${wrappedDescription[i] || ''}`);
      }

      // Default value line (if present)
      if (opt.defaultValue !== undefined) {
        const emptyLabel = ' '.repeat(LEFT_COLUMN_WIDTH);
        const defaultText = formatDefaultValue(opt.defaultValue, useColor);
        lines.push(`${formatDimText('│')} ${emptyLabel}  ${defaultText}`);
      }
    }
  }

  // Add docs URL if available (with separator line before it)
  const docsUrl = getCommandDocsUrl(commandPath);
  if (docsUrl) {
    lines.push(formatDimText('│')); // Separator line between params and docs
    lines.push(
      formatReadMoreLine({
        url: docsUrl,
        maxLabelWidth: LEFT_COLUMN_WIDTH,
        useColor,
        formatDimText,
      }),
    );
  }

  // Examples (copy-pastable)
  const examples = getCommandExamples(command);
  if (examples && examples.length > 0) {
    lines.push(formatDimText('│'));
    lines.push(`${formatDimText('│')} ${formatDimText('Examples:')}`);
    for (const example of examples) {
      lines.push(`${formatDimText('│')}   ${useColor ? dim('$') : '$'} ${example}`);
    }
  }

  // See also (cross-references to related commands)
  const seeAlso = getCommandSeeAlso(command);
  if (seeAlso && seeAlso.length > 0) {
    lines.push(formatDimText('│'));
    lines.push(`${formatDimText('│')} ${formatDimText('See also:')}`);
    for (const ref of seeAlso) {
      lines.push(`${formatDimText('│')}   ${ref.verb}  ${formatDimText(ref.oneLiner)}`);
    }
  }

  // Multi-line description (if present) - shown after all other content
  if (longDescription) {
    lines.push(formatDimText('│'));
    const descriptionLines = longDescription.split('\n').filter((line) => line.trim().length > 0);
    lines.push(...formatMultilineDescription({ descriptionLines, useColor, formatDimText }));
  }

  lines.push(formatDimText('└'));

  return `${lines.join('\n')}\n`;
}

/**
 * Formats help output for the root program using the styled format.
 */
export function formatRootHelp(options: {
  readonly program: Command;
  readonly flags: GlobalFlags;
}): string {
  const { program, flags } = options;
  const lines: string[] = [];
  const useColor = flags.color !== false;
  const formatDimText = (text: string) => formatDim(useColor, text);

  // Header: "prisma-next -> Manage your data layer"
  const brand = createPrismaNextBadge(useColor);
  const shortDescription = 'Manage your data layer';
  const intent = formatDimText(shortDescription);
  lines.push(formatHeaderLine({ brand, operation: '', intent }));
  lines.push(formatDimText('│')); // Vertical line separator after header

  // Extract top-level commands (exclude hidden commands starting with '_' and the 'help' command)
  const topLevelCommands = program.commands.filter(
    (cmd) => !cmd.name().startsWith('_') && cmd.name() !== 'help',
  );

  // Extract global options (needed to determine if last command)
  const globalOptions = program.options.map((opt) => {
    const description = opt.description || '';
    // Commander.js stores default value in defaultValue property
    const defaultValue = (opt as { defaultValue?: unknown }).defaultValue;
    return { flags: opt.flags, description, defaultValue };
  });

  // Build command tree
  if (topLevelCommands.length > 0) {
    const hasItemsAfter = globalOptions.length > 0;
    const treeLines = renderCommandTree({
      commands: topLevelCommands,
      useColor,
      formatDimText,
      hasItemsAfter,
    });
    lines.push(...treeLines);
  }

  // Add separator between commands and options if both exist
  if (topLevelCommands.length > 0 && globalOptions.length > 0) {
    lines.push(formatDimText('│'));
  }

  // Format global options with fixed width, wrapping, and default values
  if (globalOptions.length > 0) {
    for (const opt of globalOptions) {
      // Format flag with fixed 30-char width
      const flagsPadded = padToFixedWidth(opt.flags, LEFT_COLUMN_WIDTH);
      let flagsColored = flagsPadded;
      if (useColor) {
        // Color placeholders in magenta, then wrap in cyan
        flagsColored = flagsPadded.replace(/(<[^>]+>)/g, (match: string) => magenta(match));
        flagsColored = cyan(flagsColored);
      }

      // Wrap description based on terminal width
      const rightColumnWidth = calculateRightColumnWidth();
      const wrappedDescription = wrapTextAnsi(opt.description, rightColumnWidth);

      // First line: flag + first line of description
      lines.push(`${formatDimText('│')} ${flagsColored}  ${wrappedDescription[0] || ''}`);

      // Continuation lines: empty label (30 spaces) + wrapped lines
      for (let i = 1; i < wrappedDescription.length; i++) {
        const emptyLabel = ' '.repeat(LEFT_COLUMN_WIDTH);
        lines.push(`${formatDimText('│')} ${emptyLabel}  ${wrappedDescription[i] || ''}`);
      }

      // Default value line (if present)
      if (opt.defaultValue !== undefined) {
        const emptyLabel = ' '.repeat(LEFT_COLUMN_WIDTH);
        const defaultText = formatDefaultValue(opt.defaultValue, useColor);
        lines.push(`${formatDimText('│')} ${emptyLabel}  ${defaultText}`);
      }
    }
  }

  // Multi-line description (white, not dimmed, with "Prisma Next" in green) - shown at bottom
  const formatGreen = (text: string) => (useColor ? green(text) : text);
  const descriptionLines = [
    `Use ${formatGreen('Prisma Next')} to define your data layer as a contract. Sign your database and application with the same contract to guarantee compatibility. Plan and apply migrations to safely evolve your schema.`,
  ];
  if (descriptionLines.length > 0) {
    lines.push(formatDimText('│')); // Separator line before description
    lines.push(...formatMultilineDescription({ descriptionLines, useColor, formatDimText }));
  }

  lines.push(formatDimText('└'));

  return `${lines.join('\n')}\n`;
}
