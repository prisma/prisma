import { ContractValidationError } from '@internal/contract/contract-validation-error';
import { structuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { contractValidationMeta } from '../../src/utils/contract-validation-meta';

describe('contractValidationMeta', () => {
  it('gives the meta of a contract the family refused to load', () => {
    const meta = { refusedDefaults: [{ namespace: 'public', table: 'Token', column: 'value' }] };
    expect(contractValidationMeta(new ContractValidationError('refused', 'storage', meta))).toEqual(
      meta,
    );
  });

  it('gives nothing for another error', () => {
    expect({
      other: contractValidationMeta(structuredError('CONTRACT.DEFAULT_INVALID', 'x', { meta: {} })),
      plain: contractValidationMeta(new Error('x')),
    }).toEqual({ other: undefined, plain: undefined });
  });
});
