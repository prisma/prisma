import { describe, expect, it } from 'vitest';
import { ledgerOriginFromStored } from '../src/ledger-origin';

describe('ledgerOriginFromStored', () => {
  it('maps empty origin sentinels to null', () => {
    expect(ledgerOriginFromStored(null)).toBeNull();
    expect(ledgerOriginFromStored('')).toBeNull();
    expect(ledgerOriginFromStored('empty')).toBeNull();
  });

  it('preserves a non-empty origin hash', () => {
    expect(ledgerOriginFromStored('abc')).toBe('abc');
  });
});
