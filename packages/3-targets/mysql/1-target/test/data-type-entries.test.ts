import { describe, expect, it } from 'vitest';
import { mysqlDataTypeEntries } from '../src/core/data-type-entries';

const entries = mysqlDataTypeEntries();

describe('how PSL writes MySQL values', () => {
  it('reads a quoted string as mysql/text', () => {
    const entry = entries['mysql/text'];
    expect(
      entry?.written.kind === 'plain' && 'parse' in entry.written
        ? entry.written.parse('hi')
        : undefined,
    ).toBe('hi');
    expect(entry?.print('hi')).toBe('hi');
  });

  it('reads a whole number as the narrowest MySQL integer type that holds it', () => {
    const written = entries['mysql/bigint']?.written;
    const classify =
      written?.kind === 'plain' && 'classify' in written ? written.classify : undefined;
    expect([
      classify?.('42'),
      classify?.('3000000000'),
      classify?.('1.5'),
      classify?.('NaN'),
    ]).toEqual([
      { type: 'mysql/int', value: 42 },
      { type: 'mysql/bigint', value: '3000000000' },
      undefined,
      undefined,
    ]);
  });

  it('prints a number back as its numeral', () => {
    const print = entries['mysql/bigint']?.print;
    expect([print?.(42), print?.('3000000000')]).toEqual(['42', '3000000000']);
  });
});
