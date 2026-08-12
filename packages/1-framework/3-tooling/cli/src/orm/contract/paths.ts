import type { PrismaNextConfig } from '@internal/config/config-types';
import { dirname, join, resolve } from 'pathe';

/** The file `contract infer` writes when nothing names another. */
const INFERRED_CONTRACT_FILENAME = 'contract.prisma';

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
