import { describe, expect, it } from 'vitest';
import { augmentSelectionForJoinColumns } from '../src/selection-shaping';

describe('selection-shaping', () => {
  it('augmentSelectionForJoinColumns() handles undefined and complete selections', () => {
    expect(augmentSelectionForJoinColumns(undefined, ['id'])).toEqual({
      selectedForQuery: undefined,
      hiddenColumns: [],
    });

    expect(augmentSelectionForJoinColumns(['id', 'name'], ['id'])).toEqual({
      selectedForQuery: ['id', 'name'],
      hiddenColumns: [],
    });
  });

  it('augmentSelectionForJoinColumns() appends missing required columns', () => {
    expect(augmentSelectionForJoinColumns(['name'], ['id', 'name'])).toEqual({
      selectedForQuery: ['name', 'id'],
      hiddenColumns: ['id'],
    });
  });
});
