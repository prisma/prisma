import type { PrismaNextConfig } from '@internal/config/config-types';
import { getEmittedArtifactPaths } from '@internal/emitter';
import { notOk, ok, type Result } from '@internal/utils/result';
import { dirname, join, resolve } from 'pathe';
import { type CliStructuredError, errorContractConfigMissing } from '../../utils/cli-errors';

/** The file `contract infer` writes when nothing names another. */
const INFERRED_CONTRACT_FILENAME = 'contract.prisma';

export interface EmittedArtifactPaths {
  readonly jsonPath: string;
  readonly dtsPath: string;
}

/**
 * Where `contract emit` publishes. `--output-path` wins; otherwise the config's
 * `contract.output`, which the loader has already resolved against the config
 * file's directory — so `resolve` here only has an effect for a config handed
 * in raw, as tests do.
 */
export function emittedArtifactPathsFor(inputs: {
  readonly config: PrismaNextConfig;
  readonly cwd: string;
  readonly outputPath: string | undefined;
}): Result<EmittedArtifactPaths, CliStructuredError> {
  const output =
    inputs.outputPath === undefined
      ? inputs.config.contract?.output
      : join(inputs.outputPath, 'contract.json');

  if (output === undefined) {
    return notOk(
      errorContractConfigMissing({
        why: 'Config.contract.output is required for emit. Define it in your config: contract: { source: ..., output: ... }',
      }),
    );
  }

  try {
    return ok(getEmittedArtifactPaths(resolve(inputs.cwd, output)));
  } catch (error) {
    return notOk(
      errorContractConfigMissing({
        why: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

/**
 * Where `contract infer` writes the PSL it inferred: `--output`, else
 * `contract.prisma` beside the emitted contract, else `contract.prisma` in the
 * invocation directory.
 */
export function inferredContractPathFor(inputs: {
  readonly config: PrismaNextConfig;
  readonly cwd: string;
  readonly output: string | undefined;
}): string {
  if (inputs.output !== undefined) {
    return resolve(inputs.cwd, inputs.output);
  }
  const contractOutput = inputs.config.contract?.output;
  if (contractOutput !== undefined) {
    return join(dirname(resolve(inputs.cwd, contractOutput)), INFERRED_CONTRACT_FILENAME);
  }
  return join(inputs.cwd, INFERRED_CONTRACT_FILENAME);
}
