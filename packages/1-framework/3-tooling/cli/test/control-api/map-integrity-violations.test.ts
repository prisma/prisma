import { describe, expect, it } from 'vitest';
import { mapIntegrityViolations } from '../../src/control-api/operations/contract-space-aggregate-loader';

describe('mapIntegrityViolations', () => {
  it('emits union kinds in meta.violations for contractUnreadable', () => {
    const error = mapIntegrityViolations([
      {
        kind: 'contractUnreadable',
        spaceId: 'ext',
        detail: 'invalid json',
      },
    ]);
    expect(error?.meta?.['violations']).toEqual([
      { kind: 'contractUnreadable', spaceId: 'ext', detail: 'invalid json' },
    ]);
  });

  it('emits union kinds in meta.violations for structural hashMismatch', () => {
    const error = mapIntegrityViolations([
      {
        kind: 'hashMismatch',
        spaceId: 'app',
        dirName: '20260101T0000_init',
        stored: 'old',
        computed: 'new',
      },
    ]);
    expect(error?.meta?.['violations']).toEqual([
      {
        kind: 'hashMismatch',
        spaceId: 'app',
        dirName: '20260101T0000_init',
        stored: 'old',
        computed: 'new',
      },
    ]);
  });
});
