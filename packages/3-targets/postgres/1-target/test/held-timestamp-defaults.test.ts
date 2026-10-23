import { describe, expect, it } from 'vitest';
import { heldTimestampDefault } from '../src/core/held-timestamp-defaults';

describe('heldTimestampDefault', () => {
  it('gives the value a timestamp column holds for each body, every digit kept', () => {
    expect([
      heldTimestampDefault('pg/timestamp', { kind: 'value', body: '2024-01-02 03:04:05.123456' }),
      heldTimestampDefault('pg/timestamptz', {
        kind: 'list',
        elements: ['2024-01-02 03:04:05.5+01', null],
      }),
    ]).toEqual([['2024-01-02T03:04:05.123456'], ['2024-01-02T02:04:05.5Z', null]]);
  });

  it('gives nothing for another data type or a body the type does not read', () => {
    expect([
      heldTimestampDefault('pg/date', { kind: 'value', body: '2024-01-02' }),
      heldTimestampDefault('pg/timestamp', { kind: 'value', body: 'soon' }),
    ]).toEqual([undefined, undefined]);
  });
});
