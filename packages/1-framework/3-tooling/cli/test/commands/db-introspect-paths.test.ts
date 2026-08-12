import { resolve } from 'pathe';
import { describe, expect, it } from 'vitest';
import { resolveContractInferOutputPath } from '../../src/commands/contract-infer-paths';

describe('resolveContractInferOutputPath', () => {
  it('uses explicit output when provided', () => {
    expect(
      resolveContractInferOutputPath(
        { output: './prisma/custom-contract.prisma', config: 'apps/api/prisma-next.config.ts' },
        './output/contract.json',
      ),
    ).toBe(resolve(process.cwd(), './prisma/custom-contract.prisma'));
  });

  it('writes contract.prisma alongside the configured contract output relative to the config file', () => {
    expect(
      resolveContractInferOutputPath(
        { config: 'apps/api/prisma-next.config.ts' },
        './output/contract.json',
      ),
    ).toBe(resolve(process.cwd(), './apps/api/output/contract.prisma'));
  });

  it('falls back to contract.prisma next to the config file when no contract output is configured', () => {
    expect(
      resolveContractInferOutputPath({ config: 'apps/api/prisma-next.config.ts' }, undefined),
    ).toBe(resolve(process.cwd(), 'apps/api/contract.prisma'));
  });

  it('falls back to contract.prisma in cwd when no config path is provided', () => {
    expect(resolveContractInferOutputPath({}, undefined)).toBe(
      resolve(process.cwd(), 'contract.prisma'),
    );
  });
});
