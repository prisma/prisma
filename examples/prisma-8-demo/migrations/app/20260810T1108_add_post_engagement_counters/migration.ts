#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/58888a20cba5529ede90056ecd1318183f0e5cf280c88cd58aeadd94bbf52c1b/contract';
import startContract from '../../snapshots/58888a20cba5529ede90056ecd1318183f0e5cf280c88cd58aeadd94bbf52c1b/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/d44ab6f7caddcc384332c669737008aec7ec8c9f5b013cb502a03c2eb04be9c0/contract';
import endContract from '../../snapshots/d44ab6f7caddcc384332c669737008aec7ec8c9f5b013cb502a03c2eb04be9c0/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('impressionCount', 'int8', { codecRef: { codecId: 'pg/int8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('reachScore', 'numeric', { codecRef: { codecId: 'pg/unboundedint@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('viewCount', 'int8', { codecRef: { codecId: 'pg/int8number@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
