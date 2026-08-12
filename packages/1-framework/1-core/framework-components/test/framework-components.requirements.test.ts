import { describe, expect, it } from 'vitest';
import { checkContractComponentRequirements } from '../src/shared/framework-components';

describe('checkContractComponentRequirements', () => {
  it('returns empty result when requirements are satisfied', () => {
    const result = checkContractComponentRequirements({
      contract: {
        targetFamily: 'sql',
        target: 'postgres',
        extensions: { pgvector: {} },
      },
      expectedTargetFamily: 'sql',
      expectedTargetId: 'postgres',
      providedComponentIds: ['postgres', 'postgres-adapter', 'pgvector'],
    });

    expect(result).toEqual({
      missingExtensionPackIds: [],
    });
  });

  it('returns familyMismatch when expectedTargetFamily mismatches', () => {
    const result = checkContractComponentRequirements({
      contract: {
        targetFamily: 'document',
        target: 'postgres',
        extensions: {},
      },
      expectedTargetFamily: 'sql',
      expectedTargetId: 'postgres',
      providedComponentIds: ['postgres', 'postgres-adapter'],
    });

    expect(result).toEqual({
      familyMismatch: { expected: 'sql', actual: 'document' },
      missingExtensionPackIds: [],
    });
  });

  it('returns targetMismatch when expectedTargetId mismatches', () => {
    const result = checkContractComponentRequirements({
      contract: {
        targetFamily: 'sql',
        target: 'mysql',
        extensions: {},
      },
      expectedTargetFamily: 'sql',
      expectedTargetId: 'postgres',
      providedComponentIds: ['postgres', 'postgres-adapter'],
    });

    expect(result).toEqual({
      targetMismatch: { expected: 'postgres', actual: 'mysql' },
      missingExtensionPackIds: [],
    });
  });

  it('returns missingExtensionPackIds when required packs are not provided', () => {
    const result = checkContractComponentRequirements({
      contract: {
        target: 'postgres',
        extensions: { pgvector: {} },
      },
      expectedTargetId: 'postgres',
      providedComponentIds: ['postgres', 'postgres-adapter'],
    });

    expect(result).toEqual({
      missingExtensionPackIds: ['pgvector'],
    });
  });
});
