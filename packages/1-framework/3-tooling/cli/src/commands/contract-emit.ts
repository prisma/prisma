import { loadConfigForSections } from '@internal/config-loader';
import { getEmittedArtifactPaths } from '@internal/emitter';
import { errorContractConfigMissing } from '@internal/errors/control';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { dirname, join, relative, resolve } from 'pathe';
import { executeContractEmit } from '../control-api/operations/contract-emit';
import type { ContractEmitResult } from '../control-api/types';
import { CliStructuredError, errorUnexpected } from '../utils/cli-errors';
import {
  addGlobalOptions,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import {
  type EmitContractResult,
  formatEmitJson,
  formatEmitOutput,
} from '../utils/formatters/emit';
import { formatStyledHeader, formatSuccessMessage } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { createProgressAdapter } from '../utils/progress-adapter';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';

interface ContractEmitOptions extends CommonCommandOptions {
  readonly config?: string;
  readonly outputPath?: string;
}

interface HeaderPaths {
  readonly displayConfigPath: string;
  readonly outputJsonPath: string;
  readonly outputDtsPath: string;
}

/**
 * Pre-load the config just to compute display paths for the styled header. The
 * actual emit work goes through `executeContractEmit`, which loads the config
 * itself; the redundant load here is bounded and lets the header render before
 * the emit spans start.
 */
async function resolveHeaderPaths(
  configOption: string | undefined,
  outputPath: string | undefined,
): Promise<Result<HeaderPaths, CliStructuredError>> {
  const displayConfigPath = configOption
    ? relative(process.cwd(), resolve(configOption))
    : 'prisma-next.config.ts';

  const configResult = await loadConfigForSections(configOption, ['contract']);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;

  const effectiveJsonPath =
    outputPath !== undefined ? join(outputPath, 'contract.json') : config.contract?.output;

  if (!effectiveJsonPath) {
    return notOk(
      errorContractConfigMissing({
        why: 'Config.contract.output is required for emit. Define it in your config: contract: { source: ..., output: ... }',
      }),
    );
  }

  try {
    const { jsonPath: outputJsonPath, dtsPath: outputDtsPath } =
      getEmittedArtifactPaths(effectiveJsonPath);
    return ok({ displayConfigPath, outputJsonPath, outputDtsPath });
  } catch (error) {
    return notOk(
      errorContractConfigMissing({
        why: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

async function executeContractEmitCommand(
  options: ContractEmitOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  startTime: number,
): Promise<Result<EmitContractResult, CliStructuredError>> {
  const outputPath = options.outputPath !== undefined ? resolve(options.outputPath) : undefined;

  const headerPathsResult = await resolveHeaderPaths(options.config, outputPath);
  if (!headerPathsResult.ok) {
    return headerPathsResult;
  }
  const { displayConfigPath, outputJsonPath, outputDtsPath } = headerPathsResult.value;

  if (!flags.json && !flags.quiet) {
    ui.stderr(
      formatStyledHeader({
        command: 'contract emit',
        description: 'Emit your contract artifacts',
        url: 'https://pris.ly/contract-emit',
        details: [
          { label: 'config', value: displayConfigPath },
          { label: 'contract', value: relative(process.cwd(), outputJsonPath) },
          { label: 'types', value: relative(process.cwd(), outputDtsPath) },
        ],
        flags,
      }),
    );
  }

  const onProgress = createProgressAdapter({ ui, flags });
  const configPath = options.config ? resolve(options.config) : 'prisma-next.config.ts';

  let result: ContractEmitResult;
  try {
    result = await executeContractEmit({
      configPath,
      onProgress,
      ...ifDefined('outputPath', outputPath),
    });
  } catch (error) {
    if (CliStructuredError.is(error)) {
      return notOk(error);
    }
    return notOk(
      errorUnexpected('Unexpected error during contract emit', {
        why: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  if (result.validationWarning) {
    ui.warn(result.validationWarning);
  }

  return ok({
    storageHash: result.storageHash,
    ...ifDefined('executionHash', result.executionHash),
    profileHash: result.profileHash,
    outDir: dirname(result.files.json),
    files: result.files,
    timings: { total: Date.now() - startTime },
  });
}

export function createContractEmitCommand(): Command {
  const command = new Command('emit');
  setCommandDescriptions(
    command,
    'Emit your contract artifacts',
    'Reads your contract source (TypeScript or Prisma schema) and emits contract.json and\n' +
      'contract.d.ts. The contract.json contains the canonical contract structure, and\n' +
      'contract.d.ts provides TypeScript types for type-safe query building.',
  );
  setCommandExamples(command, [
    'prisma-next contract emit',
    'prisma-next contract emit --config ./custom-config.ts',
    'prisma-next contract emit --output-path ./generated',
  ]);
  addGlobalOptions(command)
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--output-path <dir>', 'Directory to write contract.json and contract.d.ts into')
    .action(async (options: ContractEmitOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);
      const startTime = Date.now();

      const result = await executeContractEmitCommand(options, flags, ui, startTime);

      const exitCode = handleResult(result, flags, ui, (emitResult) => {
        if (flags.json) {
          ui.output(formatEmitJson(emitResult));
        } else {
          const output = formatEmitOutput(emitResult, flags);
          if (output) {
            ui.log(output);
          }
          if (!flags.quiet) {
            ui.success(formatSuccessMessage(flags));
          }
        }
      });
      process.exit(exitCode);
    });

  return command;
}
