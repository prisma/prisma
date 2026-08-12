import { describe, expect, it } from 'vitest';
import { requireLiveDatabase } from '../../src/utils/cli-errors';

describe('requireLiveDatabase', () => {
  it('returns null when both connection and driver are present', () => {
    expect(
      requireLiveDatabase({
        dbConnection: 'postgres://localhost/test',
        hasDriver: true,
        why: 'needs db',
      }),
    ).toBeNull();
  });

  it('flags --db when the connection is missing', () => {
    const error = requireLiveDatabase({
      dbConnection: undefined,
      hasDriver: true,
      why: 'needs db',
    });
    expect(error?.code).toBe('CONFIG.DB_CONNECTION_REQUIRED');
    expect(error?.meta?.['missingFlags']).toEqual(['--db']);
  });

  it('reports an empty missingFlags list when only the driver is missing', () => {
    const error = requireLiveDatabase({
      dbConnection: 'postgres://localhost/test',
      hasDriver: false,
      why: 'needs driver',
    });
    expect(error?.code).toBe('CONFIG.DB_CONNECTION_REQUIRED');
    expect(error?.meta?.['missingFlags']).toEqual([]);
  });

  it('flags --db when both are missing', () => {
    const error = requireLiveDatabase({
      dbConnection: undefined,
      hasDriver: false,
      why: 'needs both',
    });
    expect(error?.code).toBe('CONFIG.DB_CONNECTION_REQUIRED');
    expect(error?.meta?.['missingFlags']).toEqual(['--db']);
  });
});
