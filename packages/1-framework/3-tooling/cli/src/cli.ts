import { Command } from 'commander';
import packageJson from '../package.json' with { type: 'json' };
import { createContractEmitCommand } from './commands/contract-emit';
import { createContractInferCommand } from './commands/contract-infer';
import { createInitCommand } from './commands/init';
import { installShutdownHandlers } from './utils/shutdown';

// Install SIGINT/SIGTERM handlers before anything else
installShutdownHandlers();

import { createDbInitCommand } from './commands/db-init';
import { createDbSchemaCommand } from './commands/db-schema';
import { createDbSignCommand } from './commands/db-sign';
import { createDbUpdateCommand } from './commands/db-update';
import { createDbVerifyCommand } from './commands/db-verify';
import { createFormatCommand } from './commands/format';
import { createLspCommand } from './commands/lsp';
import { createMigrateCommand } from './commands/migrate';
import { createMigrationCheckCommand } from './commands/migration-check';
import { createMigrationGraphCommand } from './commands/migration-graph';
import { createMigrationListCommand } from './commands/migration-list';
import { createMigrationLogCommand } from './commands/migration-log';
import { createMigrationNewCommand } from './commands/migration-new';
import { createMigrationPlanCommand } from './commands/migration-plan';
import { createMigrationShowCommand } from './commands/migration-show';
import { createMigrationStatusCommand } from './commands/migration-status';
import { createRefCommand } from './commands/ref';
import { createTelemetryCommand } from './commands/telemetry';
import { BIN_NAME } from './utils/bin-name';
import { setCommandDescriptions } from './utils/command-helpers';
import { formatCommandHelp, formatRootHelp } from './utils/formatters/help';
import { parseGlobalFlags } from './utils/global-flags';
import { suggestCommands } from './utils/suggest-command';
import { fireTelemetryFromPreAction } from './utils/telemetry';

/**
 * Lookup table mapping removed subcommands to their replacement verbs.
 * Keyed by `<parent>:<subcommand>` (e.g. `migration:apply`).
 * The handler consults this before falling back to the fuzzy suggest engine.
 */
const removedVerbRedirects: Record<string, string> = {
  'migration:apply': 'Use `prisma-next migrate --to <contract>` instead.',
  'migration:ref': 'Use `prisma-next ref set|list|delete` instead.',
};

/**
 * Removed flags on specific subcommands. Keyed by `<parent>:<sub>:<flag>`.
 * Checked during the pre-parse argv scan before commander sees the flags.
 */
const removedFlagRedirects: Record<string, string> = {
  'migration:status:graph': 'Use `prisma-next migration graph` to view the migration graph.',
  'migration:status:all':
    'Use `prisma-next migration log --db <url>` to view the full execution history.',
  'migration:status:limit':
    'Use `prisma-next migration log --db <url>` to view the full execution history.',
  'migration:status:ref': 'Use `--to <contract>` instead of `--ref`.',
};

/**
 * Formats the "Did you mean ...?" hint for an unknown command.
 */
function formatSuggestion(input: string, candidates: readonly string[]): string {
  const suggestions = suggestCommands(
    input,
    candidates.map((c) => c),
  );
  if (suggestions.length === 0) return '';
  if (suggestions.length === 1) return `\nDid you mean ${suggestions[0]}?\n`;
  return `\nDid you mean one of these?\n${suggestions.map((s) => `  ${s}`).join('\n')}\n`;
}

const program = new Command();

program.name(BIN_NAME).description('Prisma Next CLI').version(packageJson.version);

// Telemetry hook — fires at command start, before the action body
// runs. Synchronous by construction: `fireTelemetryFromPreAction`
// resolves gates (cheap), then `fork()`s the detached sender. The
// fork is enqueued before the action body runs at all, so the child
// survives even when the action throws synchronously. The try/catch
// is defence-in-depth — `runTelemetry` already swallows every failure
// mode internally and returns an outcome instead of throwing.
program.hook('preAction', (_thisCommand, actionCommand) => {
  try {
    fireTelemetryFromPreAction(actionCommand);
  } catch {
    // defence-in-depth — runTelemetry already swallows internally.
  }
});

// Override version option description to match capitalization style
const versionOption = program.options.find((opt) => opt.flags.includes('--version'));
if (versionOption) {
  versionOption.description = 'Output the version number';
}

program.configureOutput({
  writeErr: () => {
    // Suppress all default error output - we handle errors in exitOverride
  },
  writeOut: (str) => {
    // Commander routes explicitly-requested `--help` (success-path help)
    // through writeOut; per the Style Guide § Output Conventions rule 8,
    // user-requested help is data and goes to stdout. Error-path help
    // (e.g. usage shown after an unknown command) goes through writeErr,
    // which stays suppressed because we render that ourselves with the
    // matching error envelope.
    //
    // Explicit `--version` is short-circuited before `program.parse()`
    // (see the argv pre-scan at the bottom of this file), so it does not
    // reach this writer.
    process.stdout.write(str);
  },
});

// Customize root help output to use our styled format
const rootHelpFormatter = (cmd: Command) => {
  const flags = parseGlobalFlags({});
  return formatRootHelp({ program: cmd, flags });
};

program.configureHelp({
  formatHelp: rootHelpFormatter,
  subcommandDescription: () => '',
});

// Override exit to handle unhandled errors (fail fast cases)
// Commands handle structured errors themselves via process.exit()
program.exitOverride((err) => {
  if (err) {
    const errorCode = (err as { code?: string }).code;
    const errorMessage = String(err.message ?? '');
    const errorName = err.name ?? '';

    // Unknown command/argument → exit 2 (CLI usage error)
    const isUnknownCommandError =
      errorCode === 'commander.unknownCommand' ||
      errorCode === 'commander.unknownArgument' ||
      (errorName === 'CommanderError' &&
        (errorMessage.includes('unknown command') || errorMessage.includes('unknown argument')));
    if (isUnknownCommandError) {
      const flags = parseGlobalFlags({});
      const match = errorMessage.match(/unknown command ['"]([^'"]+)['"]/);
      const commandName = match ? match[1] : process.argv[3] || process.argv[2] || 'unknown';

      const firstArg = process.argv[2];
      const parentCommand = firstArg
        ? program.commands.find((cmd) => cmd.name() === firstArg)
        : undefined;

      if (parentCommand && commandName !== firstArg) {
        const subNames = parentCommand.commands.map((c) => c.name());
        process.stderr.write(
          `Unknown command: ${commandName}${formatSuggestion(commandName!, subNames)}\n`,
        );
        const helpText = formatCommandHelp({ command: parentCommand, flags });
        process.stderr.write(`${helpText}\n`);
      } else {
        const topNames = program.commands.map((c) => c.name());
        process.stderr.write(
          `Unknown command: ${commandName}${formatSuggestion(commandName!, topNames)}\n`,
        );
        const helpText = formatRootHelp({ program, flags });
        process.stderr.write(`${helpText}\n`);
      }
      process.exit(2);
      return;
    }

    // Help requests → exit 0
    const isHelpError =
      errorCode === 'commander.help' ||
      errorCode === 'commander.helpDisplayed' ||
      errorCode === 'outputHelp' ||
      errorMessage === '(outputHelp)' ||
      errorMessage.includes('outputHelp') ||
      (errorName === 'CommanderError' && errorMessage.includes('outputHelp'));
    if (isHelpError) {
      process.exit(0);
      return;
    }

    // Missing required arguments → exit 2 (CLI usage error)
    const isMissingArgumentError =
      errorCode === 'commander.missingArgument' ||
      errorCode === 'commander.missingMandatoryOptionValue' ||
      (errorName === 'CommanderError' &&
        (errorMessage.includes('missing') || errorMessage.includes('required')));
    if (isMissingArgumentError) {
      process.exit(2);
      return;
    }

    // Unhandled error → exit 1
    process.stderr.write(`Unhandled error: ${err.message}\n`);
    if (err.stack) {
      process.stderr.write(`${err.stack}\n`);
    }
    process.exit(1);
  }
  process.exit(0);
});

// Register contract subcommand
const contractCommand = new Command('contract');
setCommandDescriptions(
  contractCommand,
  'Contract management commands',
  'Define and emit your application data contract. The contract describes your schema as a\n' +
    'declarative data structure that can be signed and verified against your database.',
);
contractCommand.configureHelp({
  formatHelp: (cmd) => {
    const flags = parseGlobalFlags({});
    return formatCommandHelp({ command: cmd, flags });
  },
  subcommandDescription: () => '',
});

// Add emit subcommand to contract
const contractEmitCommand = createContractEmitCommand();
contractCommand.addCommand(contractEmitCommand);

// Add infer subcommand to contract
const contractInferCommand = createContractInferCommand();
contractCommand.addCommand(contractInferCommand);

// Register db subcommand
const dbCommand = new Command('db');
setCommandDescriptions(
  dbCommand,
  'Database management commands',
  'Verify and sign your database with your contract. Ensure your database schema matches\n' +
    'your contract, and sign it to record the contract hash for future verification.',
);
dbCommand.configureHelp({
  formatHelp: (cmd) => {
    const flags = parseGlobalFlags({});
    return formatCommandHelp({ command: cmd, flags });
  },
  subcommandDescription: () => '',
});

// Add verify subcommand to db
const dbVerifyCommand = createDbVerifyCommand();
dbCommand.addCommand(dbVerifyCommand);

// Add init subcommand to db
const dbInitCommand = createDbInitCommand();
dbCommand.addCommand(dbInitCommand);

// Add update subcommand to db
const dbUpdateCommand = createDbUpdateCommand();
dbCommand.addCommand(dbUpdateCommand);

// Add schema subcommand to db
const dbSchemaCommand = createDbSchemaCommand();
dbCommand.addCommand(dbSchemaCommand);

// Add sign subcommand to db
const dbSignCommand = createDbSignCommand();
dbCommand.addCommand(dbSignCommand);

// Register migration subcommand
const migrationCommand = new Command('migration');
setCommandDescriptions(
  migrationCommand,
  'On-disk migration management commands',
  'Plan, apply, and scaffold on-disk migration packages. Migrations are\n' +
    'contract-to-contract edges stored as versioned directories under migrations/.',
);
migrationCommand.configureHelp({
  formatHelp: (cmd) => {
    const flags = parseGlobalFlags({});
    return formatCommandHelp({ command: cmd, flags });
  },
  subcommandDescription: () => '',
});

const migrationPlanCommand = createMigrationPlanCommand();
migrationCommand.addCommand(migrationPlanCommand);

const migrationNewCommand = createMigrationNewCommand();
migrationCommand.addCommand(migrationNewCommand);

const migrationShowCommand = createMigrationShowCommand();
migrationCommand.addCommand(migrationShowCommand);

const migrationStatusCommand = createMigrationStatusCommand();
migrationCommand.addCommand(migrationStatusCommand);

const migrationLogCommand = createMigrationLogCommand();
migrationCommand.addCommand(migrationLogCommand);

const migrationListCommand = createMigrationListCommand();
migrationCommand.addCommand(migrationListCommand);

const migrationGraphCommand = createMigrationGraphCommand();
migrationCommand.addCommand(migrationGraphCommand);

const migrationCheckCommand = createMigrationCheckCommand();
migrationCommand.addCommand(migrationCheckCommand);

// Top-level migrate command
const migrateCommand = createMigrateCommand();

// Top-level ref command (replaces `migration ref`)
const refCommand = createRefCommand();

// Top-level telemetry command
const telemetryCommand = createTelemetryCommand();

// Top-level init command
const initCommand = createInitCommand();

const formatCommand = createFormatCommand();
const lspCommand = createLspCommand();

// Register top-level commands in the order the spec's intended-surface
// diagram lists them: verbs (init, migrate) first, then subject
// namespaces (contract, db, migration, ref). The order shows up in
// `prisma-next --help` and is the first thing a new user sees, so it
// matches the order spec.md uses to introduce the surface.
program.addCommand(initCommand);
program.addCommand(migrateCommand);
program.addCommand(formatCommand);
program.addCommand(lspCommand);
program.addCommand(contractCommand);
program.addCommand(dbCommand);
program.addCommand(migrationCommand);
program.addCommand(refCommand);
program.addCommand(telemetryCommand);

// Test-only hidden command used by `cli-telemetry`'s `cli-e2e.test.ts`
// to verify that telemetry still lands when a CLI command crashes
// mid-execution. The preAction hook is synchronous and `fork()`s the
// detached sender before this action body runs; the small sleep
// gives the IPC `child.send()` a tick to flush before the throw
// triggers commander's `exitOverride` and `process.exit(1)`. Hidden
// from help; underscore prefix marks it as internal. Doesn't depend
// on any project state, so it runs in any tempdir.
//
// Gated behind `PRISMA_NEXT_ENABLE_TEST_COMMANDS=1` so the command is
// not even registered (and therefore not invocable) in shipped
// binaries. `hidden: true` only filters the help output; without this
// env gate the command would still be callable from production. The
// e2e suite sets the env var when it spawns the CLI.
const TELEMETRY_CRASH_TEST_SLEEP_MS = 200;
if (process.env['PRISMA_NEXT_ENABLE_TEST_COMMANDS'] === '1') {
  const telemetryCrashTestCommand = new Command('__telemetry-crash-test')
    .description('Internal: deliberately throw for the telemetry e2e suite.')
    .action(async () => {
      await new Promise((settle) => setTimeout(settle, TELEMETRY_CRASH_TEST_SLEEP_MS));
      throw new Error('__telemetry-crash-test: intentional crash for e2e coverage');
    });
  telemetryCrashTestCommand.configureHelp({ visibleCommands: () => [] });
  program.addCommand(telemetryCrashTestCommand, { hidden: true });
}

// Create help command
const helpCommand = new Command('help')
  .description('Show usage instructions')
  .configureHelp({
    formatHelp: (cmd) => {
      const flags = parseGlobalFlags({});
      return formatCommandHelp({ command: cmd, flags });
    },
  })
  .action(() => {
    const flags = parseGlobalFlags({});
    const helpText = formatRootHelp({ program, flags });
    // The `help` command was invoked explicitly: help is the data the
    // caller asked for. Per Style Guide § Output Conventions rule 8,
    // explicit help goes to stdout with exit code 0.
    process.stdout.write(`${helpText}\n`);
    process.exit(0);
  });

program.addCommand(helpCommand);

// Set help as the default action when no command is provided. The user
// did not invoke `--help`; we are voluntarily showing usage to help them
// recover from an underspecified invocation, so the help text is
// decoration around an implicit "what did you want me to do?" and goes
// to stderr (Style Guide § Output Conventions rule 8).
//
// FOLLOW-UP: the exit code here is 0 today, but a no-arg invocation is
// arguably a usage error (PRECONDITION → exit 2) for consistency with
// the unknown-command path. Out of scope for the explicit-help routing
// work; revisit when tightening exit-code semantics across the CLI.
program.action(() => {
  const flags = parseGlobalFlags({});
  const helpText = formatRootHelp({ program, flags });
  process.stderr.write(`${helpText}\n`);
  process.exit(0);
});

// Check if a command was invoked with no arguments (just the command name)
// or if an unrecognized command was provided
const args = process.argv.slice(2);
if (args.length > 0) {
  const commandName = args[0];
  // Handle version option explicitly since we suppress default output
  if (commandName === '--version' || commandName === '-V') {
    // Version is data → stdout
    process.stdout.write(`${program.version()}\n`);
    process.exit(0);
  }
  // Skip command check for global options like --help, -h
  const isGlobalOption = commandName === '--help' || commandName === '-h';
  if (!isGlobalOption) {
    // Check if this is a recognized command
    const command = program.commands.find((cmd) => cmd.name() === commandName);

    if (!command) {
      // Unrecognized command → exit 2 (CLI usage error)
      const flags = parseGlobalFlags({});
      const topNames = program.commands.map((c) => c.name());
      process.stderr.write(
        `Unknown command: ${commandName}${formatSuggestion(commandName!, topNames)}\n`,
      );
      const helpText = formatRootHelp({ program, flags });
      process.stderr.write(`${helpText}\n`);
      process.exit(2);
    } else if (command.commands.length > 0 && args.length >= 2) {
      const subcommandName = args[1];
      const redirectKey = `${commandName}:${subcommandName}`;
      const redirect = removedVerbRedirects[redirectKey];
      if (redirect) {
        process.stderr.write(`Unknown command: ${subcommandName}\n${redirect}\n`);
        process.exit(2);
      }
      for (let i = 2; i < args.length; i++) {
        const arg = args[i]!;
        if (!arg.startsWith('--')) continue;
        const flagName = arg.slice(2);
        const flagKey = `${commandName}:${subcommandName}:${flagName}`;
        const flagRedirect = removedFlagRedirects[flagKey];
        if (flagRedirect) {
          process.stderr.write(`Unknown option: ${arg}\n${flagRedirect}\n`);
          process.exit(2);
        }
      }
    }

    if (command.commands.length > 0 && args.length === 1) {
      // Parent command called with no subcommand. Same shape as the
      // no-args case above: the user did not request help, we are
      // voluntarily rendering it as decoration around an underspecified
      // invocation, so it goes to stderr per Style Guide § Output
      // Conventions rule 8. Exit code 0 today; the FOLLOW-UP note on
      // `program.action` applies here too (arguably should be 2).
      const flags = parseGlobalFlags({});
      const helpText = formatCommandHelp({ command, flags });
      process.stderr.write(`${helpText}\n`);
      process.exit(0);
    }
  }
}

program.parse();
