import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { errorRuntime } from '@internal/errors/execution';
import { printPsl } from '@internal/psl-printer';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { dirname, relative } from 'pathe';
import type { CliStructuredError } from '../utils/cli-errors';
import {
  addGlobalOptions,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';
import { resolveContractInferOutputPath } from './contract-infer-paths';
import {
  type InspectLiveSchemaOptions,
  type InspectLiveSchemaResult,
  inspectLiveSchema,
} from './inspect-live-schema';

interface ContractInferOptions extends InspectLiveSchemaOptions {
  readonly output?: string;
}

interface ContractInferSuccessResult {
  readonly ok: true;
  readonly summary: string;
  readonly target: InspectLiveSchemaResult['target'];
  readonly psl: {
    readonly path: string;
  };
  readonly meta: InspectLiveSchemaResult['meta'];
  readonly timings: {
    readonly total: number;
  };
}

async function executeContractInferCommand(
  options: ContractInferOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  startTime: number,
): Promise<Result<ContractInferSuccessResult, CliStructuredError>> {
  const inspectResult = await inspectLiveSchema(options, flags, ui, startTime, {
    commandName: 'contract infer',
    description: 'Infer a PSL contract from the live database schema',
    url: 'https://pris.ly/contract-infer',
  });

  if (!inspectResult.ok) {
    return inspectResult;
  }

  const { config, target, meta, pslContractAst, pslBlockDescriptors } = inspectResult.value;

  if (!pslContractAst) {
    return notOk(
      errorRuntime(
        'CONTRACT.INFER_UNSUPPORTED',
        'contract infer is not supported for this family',
        {
          why: 'The configured family does not implement the PslContractInferCapable capability, so an inferred PSL contract cannot be produced from the live database schema.',
          fix: 'Use a family that supports contract inference (e.g. SQL/Postgres).',
        },
      ),
    );
  }

  const outputPath = resolveContractInferOutputPath(options, config.contract?.output);
  const pslContent = printPsl(pslContractAst, { pslBlockDescriptors: pslBlockDescriptors });

  if (existsSync(outputPath) && !flags.json && !flags.quiet) {
    ui.stderr(`\u26A0 Overwriting existing file: ${relative(process.cwd(), outputPath)}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, pslContent, 'utf-8');

  const pslPath = relative(process.cwd(), outputPath);
  if (!flags.json && !flags.quiet) {
    ui.stderr(`\u2714 Contract written to ${pslPath}`);
  }

  return ok({
    ok: true,
    summary: 'Contract inferred successfully',
    target,
    psl: {
      path: pslPath,
    },
    meta,
    timings: {
      total: Date.now() - startTime,
    },
  });
}

export function createContractInferCommand(): Command {
  const command = new Command('infer');
  setCommandDescriptions(
    command,
    'Infer a PSL contract from the live database schema',
    'Reads the live database schema and writes an inferred PSL contract to disk.\n' +
      'This command stops at `contract.prisma`; follow it with `contract emit` and\n' +
      '`db sign` as separate steps.',
  );
  setCommandExamples(command, [
    'prisma-next contract infer --db $DATABASE_URL',
    'prisma-next contract infer --db $DATABASE_URL --output ./src/prisma/contract.prisma',
    'prisma-next contract infer --db $DATABASE_URL --json',
  ]);
  addGlobalOptions(command)
    .option('--db <url>', 'Database connection string')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--output <path>', 'Write the inferred PSL contract to the specified path')
    .action(async (options: ContractInferOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);
      const startTime = Date.now();

      const result = await executeContractInferCommand(options, flags, ui, startTime);
      const exitCode = handleResult(result, flags, ui, (value) => {
        if (flags.json) {
          ui.output(JSON.stringify(value, null, 2));
        }
      });

      process.exit(exitCode);
    });

  return command;
}
