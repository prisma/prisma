import { describe, expect, it } from 'vitest';
import { defaultContractOutputPath } from '../src/default-contract-output-path';

describe('defaultContractOutputPath', () => {
  it('names the JSON after the contract file, beside it', () => {
    expect(defaultContractOutputPath('./prisma/contract.prisma')).toBe('./prisma/contract.json');
    expect(defaultContractOutputPath('src/schema.ts')).toBe('src/schema.json');
  });

  it('appends .json to a path with no extension', () => {
    expect(defaultContractOutputPath('./prisma/contract')).toBe('./prisma/contract.json');
  });

  it('uses contract.json in the static prefix directory of a glob', () => {
    expect(defaultContractOutputPath('./prisma/**/*.prisma')).toBe('./prisma/contract.json');
    expect(defaultContractOutputPath('.\\prisma\\**\\*.prisma')).toBe('./prisma/contract.json');
  });

  it.each([
    ['./schemas/{one/nested,two}/**/*.prisma', './schemas/contract.json'],
    ['./schemas/[[]id[]]/*.prisma', './schemas/contract.json'],
    ['./schemas/@(one|two)/*.prisma', './schemas/contract.json'],
    ['/**/*.prisma', '/contract.json'],
    ['./schemas/{literal}/schema.prisma', './schemas/{literal}/schema.json'],
    ['./schemas/[unfinished/schema.prisma', './schemas/[unfinished/schema.json'],
  ])('resolves %s to %s', (input, output) => {
    expect(defaultContractOutputPath(input)).toBe(output);
  });

  it('uses contract.json when a glob has no static prefix', () => {
    expect(defaultContractOutputPath('*.prisma')).toBe('contract.json');
  });
});
