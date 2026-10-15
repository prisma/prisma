import type { StorageColumnInput } from '@internal/sql-contract/types';
import { describe, expect, it } from 'vitest';
import { emptyRoot, makeContract, planFor } from './node-issue-planner-fixtures';

function contractWithArea(area: StorageColumnInput) {
  return makeContract({
    shape: {
      columns: {
        id: { dataType: 'pg/int4', codecId: 'pg/int4@1', nullable: false },
        area,
      },
      primaryKey: { columns: ['id'] },
      foreignKeys: [],
      uniques: [],
      indexes: [],
    },
  });
}

const rawCircle = {
  dataType: 'sql/raw',
  codecId: 'sql/raw@1',
  typeParams: { sql: 'circle' },
  nullable: false,
} as const;

describe('the default of a raw column in a contract', () => {
  it('is planned when it is a sql expression', () => {
    const contract = contractWithArea({
      ...rawCircle,
      default: { kind: 'function', expression: "'<(0,0),1>'::circle" },
    });
    expect(planFor(contract, emptyRoot()).map((call) => call.factoryName)).toEqual(['createTable']);
  });

  it('is refused when it is a literal, which a hand-written contract.json can hold', () => {
    const contract = contractWithArea({
      ...rawCircle,
      default: { kind: 'literal', value: '<(0,0),1>' },
    });
    expect(() => planFor(contract, emptyRoot())).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        message:
          'Column "area": The contract holds this default in a form its data type does not store: A raw column has no literal values, so "<(0,0),1>" cannot be one. Re-emit the contract, then try again.',
      }),
    );
  });
});
