import { describe, expect, it } from 'vitest';
import { MARKER_LEDGER_COLLECTION } from '../src/core/marker-ledger-collection';

describe('marker-ledger-collection — shape constants', () => {
  it('MARKER_LEDGER_COLLECTION is the migrations collection name', () => {
    expect(MARKER_LEDGER_COLLECTION).toBe('_prisma_migrations');
  });
});
