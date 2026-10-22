import { describe, expect, it } from 'vitest';
import { declaredUniqueIndexes } from '../src/core/migrations/declared-unique-indexes';

const contractWith = (indexes: readonly unknown[]) => ({
  storage: {
    namespaces: { __unbound__: { entries: { table: { T: { columns: {}, indexes } } } } },
  },
});

describe('declaredUniqueIndexes', () => {
  it('answers which unique indexes the contract declares on which table', () => {
    const declares = declaredUniqueIndexes(
      contractWith([
        { name: 'T_handle_idx', columns: ['handle'], unique: true },
        { name: 'T_name_idx', columns: ['name'], unique: false },
      ]),
    );
    expect({
      unique: declares('T', 'T_handle_idx'),
      plain: declares('T', 'T_name_idx'),
      otherTable: declares('U', 'T_handle_idx'),
    }).toEqual({ unique: true, plain: false, otherTable: false });
  });

  it('reads every contract of a stack of contract spaces', () => {
    const declares = declaredUniqueIndexes({
      contracts: [contractWith([]), contractWith([{ name: 'T_handle_idx', unique: true }])],
    });
    expect(declares('T', 'T_handle_idx')).toBe(true);
  });

  it('declares nothing without a contract', () => {
    expect(declaredUniqueIndexes(undefined)('T', 'T_handle_idx')).toBe(false);
  });
});
