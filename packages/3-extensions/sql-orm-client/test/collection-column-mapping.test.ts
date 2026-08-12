import { describe, expect, it } from 'vitest';
import { mapCursorValuesToColumns, mapFieldsToColumns } from '../src/collection-column-mapping';
import { resolveFieldToColumn } from '../src/collection-contract';
import { getTestContract } from './helpers';

describe('collection-column-mapping', () => {
  const contract = getTestContract();

  it('resolveFieldToColumn() resolves known fields and falls back for unknown fields', () => {
    expect(resolveFieldToColumn(contract, 'public', 'Post', 'userId')).toBe('user_id');
    expect(resolveFieldToColumn(contract, 'public', 'Post', 'customField')).toBe('customField');
  });

  it('mapFieldsToColumns() maps arrays by model mapping when available', () => {
    expect(mapFieldsToColumns(contract, 'public', 'Post', ['id', 'userId', 'views'])).toEqual([
      'id',
      'user_id',
      'views',
    ]);
    expect(mapFieldsToColumns(contract, 'public', 'UnknownModel', ['id', 'customField'])).toEqual([
      'id',
      'customField',
    ]);
  });

  it('mapCursorValuesToColumns() skips undefined values and maps field names to columns', () => {
    expect(
      mapCursorValuesToColumns(contract, 'public', 'Post', {
        id: 1,
        userId: 2,
        views: undefined,
      }),
    ).toEqual({
      id: 1,
      user_id: 2,
    });
  });

  it('mapCursorValuesToColumns() falls back when model or field mapping is missing', () => {
    expect(
      mapCursorValuesToColumns(contract, 'public', 'UnknownModel', {
        custom: 1,
      }),
    ).toEqual({
      custom: 1,
    });

    expect(
      mapCursorValuesToColumns(contract, 'public', 'Post', {
        unknownField: 2,
      }),
    ).toEqual({
      unknownField: 2,
    });
  });
});
