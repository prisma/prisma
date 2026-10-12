import { DatabaseSync } from 'node:sqlite';
import { SqlColumnIR } from '@internal/sql-schema-ir/types';
import { describe, expect, it } from 'vitest';
import { codecDescriptors } from '../../src/core/codecs';
import { sqliteFillValue } from '../../src/core/migrations/planner-fill-values';
import { sqliteTestTypes } from '../sqlite-test-types';

function readBack(fill: string): unknown {
  const db = new DatabaseSync(':memory:');
  try {
    return db.prepare(`SELECT ${fill} AS v`).get()?.['v'];
  } finally {
    db.close();
  }
}

describe('the temporary value a new required SQLite column takes', () => {
  it('reads back through each codec as a value of its type', async () => {
    const read = await Promise.all(
      codecDescriptors.map(async (descriptor) => {
        const column = new SqlColumnIR({
          name: 'v',
          nativeType: 'TEXT',
          nullable: false,
          codecRef: { codecId: descriptor.codecId },
        });
        const fill = sqliteFillValue(column, new Map(), sqliteTestTypes);
        const codec = descriptor.factory(undefined)({ name: 'v' });
        return [
          descriptor.codecId,
          fill === undefined ? undefined : await codec.decode(readBack(fill), {}),
        ];
      }),
    );
    expect(Object.fromEntries(read)).toEqual({
      'sql/char@1': '',
      'sql/varchar@1': '',
      'sql/int@1': 0,
      'sql/float@1': 0,
      'sqlite/text@1': '',
      'sqlite/integer@1': 0,
      'sqlite/real@1': 0,
      'sqlite/blob@1': new Uint8Array(),
      'sqlite/datetime@1': new Date(0),
      'sqlite/json@1': {},
      'sqlite/bigint@1': 0n,
      'sqlite/bigintnumber@1': 0,
    });
  });
});
