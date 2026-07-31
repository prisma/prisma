import { userConfigPath, writeUserConfig } from '@internal/cli-telemetry';
import { Command } from 'commander';
import {
  addGlobalOptions,
  setCommandDescriptions,
  setCommandExamples,
} from '../../utils/command-helpers';
import { formatCommandHelp } from '../../utils/formatters/help';
import {
  type CommonCommandOptions,
  parseGlobalFlags,
  parseGlobalFlagsOrExit,
} from '../../utils/global-flags';
import { isCI } from '../../utils/is-ci';
import { createTerminalUI } from '../../utils/terminal-ui';
import { formatTelemetryStatusLines, resolveTelemetryStatus } from './status';

function createTelemetryStatusCommand(): Command {
  const command = new Command('status');
  setCommandDescriptions(
    command,
    'Show whether anonymous CLI telemetry is enabled and why',
    'Reports whether telemetry is currently enabled or disabled and the reason\n' +
      '(default-on, stored opt-out, environment opt-out, or CI), the path to your\n' +
      'user-level config file, and whether an installation ID has been stored.\n' +
      'Read-only: never sends an event, never mints an ID, never writes anything.',
  );
  return addGlobalOptions(command).action((options: CommonCommandOptions) => {
    const flags = parseGlobalFlagsOrExit(options);
    const ui = createTerminalUI(flags);
    const status = resolveTelemetryStatus({ env: process.env, inCI: isCI() });
    if (flags.json) {
      ui.output(JSON.stringify(status));
    } else {
      for (const line of formatTelemetryStatusLines(status)) {
        ui.output(line);
      }
    }
    process.exit(0);
  });
}

function createTelemetryEnableCommand(): Command {
  const command = new Command('enable');
  setCommandDescriptions(
    command,
    'Enable anonymous CLI telemetry',
    'Stores "enableTelemetry": true in your user-level config and mints an\n' +
      'installation ID if one is not already stored.',
  );
  return addGlobalOptions(command).action((options: CommonCommandOptions) => {
    const flags = parseGlobalFlagsOrExit(options);
    writeUserConfig({ enableTelemetry: true });
    const ui = createTerminalUI(flags);
    if (flags.json) {
      ui.output(JSON.stringify({ enableTelemetry: true, configPath: userConfigPath() }));
    } else {
      ui.output(`Telemetry enabled. Preference stored in ${userConfigPath()}.`);
    }
    process.exit(0);
  });
}

function createTelemetryDisableCommand(): Command {
  const command = new Command('disable');
  setCommandDescriptions(
    command,
    'Disable anonymous CLI telemetry',
    'Stores "enableTelemetry": false in your user-level config. No installation\n' +
      'ID is minted and no event is sent.',
  );
  return addGlobalOptions(command).action((options: CommonCommandOptions) => {
    const flags = parseGlobalFlagsOrExit(options);
    writeUserConfig({ enableTelemetry: false });
    const ui = createTerminalUI(flags);
    if (flags.json) {
      ui.output(JSON.stringify({ enableTelemetry: false, configPath: userConfigPath() }));
    } else {
      ui.output(`Telemetry disabled. Preference stored in ${userConfigPath()}.`);
    }
    process.exit(0);
  });
}

export function createTelemetryCommand(): Command {
  const command = new Command('telemetry');
  setCommandDescriptions(
    command,
    'Inspect and change anonymous CLI telemetry',
    'Show telemetry status, or enable / disable anonymous CLI usage data.\n' +
      'Telemetry is on by default (opt-out); see https://prisma-next.dev/docs/cli/telemetry\n' +
      'for what is collected and why.',
  );
  setCommandExamples(command, [
    'prisma-next telemetry status',
    'prisma-next telemetry disable',
    'prisma-next telemetry enable',
  ]);
  command.configureHelp({
    formatHelp: (cmd) => formatCommandHelp({ command: cmd, flags: parseGlobalFlags({}) }),
    subcommandDescription: () => '',
  });
  command.addCommand(createTelemetryStatusCommand());
  command.addCommand(createTelemetryEnableCommand());
  command.addCommand(createTelemetryDisableCommand());
  return command;
}
