import { describe, expect, it } from 'vitest';
import * as root from '../src/exports/index';
import * as onValidatedContract from '../src/exports/internal-on-validated-contract';

describe('the query builder entries', () => {
  it('keep the builder that trusts its contract off the root entry', () => {
    expect(Object.keys(root)).not.toContain('mongoQuery');
    expect(Object.keys(root)).not.toContain('mongoQueryOnValidatedContract');
  });

  it('offer it on the internal on-validated-contract entry only', () => {
    expect(Object.keys(onValidatedContract)).toEqual(['mongoQueryOnValidatedContract']);
  });
});
