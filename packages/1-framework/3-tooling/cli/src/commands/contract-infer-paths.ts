import { dirname, resolve } from 'pathe';

interface ContractInferPathOptions {
  readonly output?: string;
  readonly config?: string;
}

/**
 * Resolves the output path for the inferred PSL contract.
 *
 * Priority:
 * 1. --output <path> flag (resolved relative to cwd)
 * 2. contract.prisma next to config.contract.output
 * 3. Canonical default: contract.prisma in the config directory
 */
export function resolveContractInferOutputPath(
  options: ContractInferPathOptions,
  contractOutput: string | undefined,
): string {
  const configDir = options.config
    ? dirname(resolve(process.cwd(), options.config))
    : process.cwd();

  if (options.output) {
    return resolve(process.cwd(), options.output);
  }
  if (contractOutput) {
    const contractPath = resolve(configDir, contractOutput);
    return resolve(dirname(contractPath), 'contract.prisma');
  }
  return resolve(configDir, 'contract.prisma');
}
