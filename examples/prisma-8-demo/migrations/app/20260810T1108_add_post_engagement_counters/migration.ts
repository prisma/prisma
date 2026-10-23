#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/3c2324f6061012e9d50f869b3e6ae6aa41159acd559b1cc5459bc64e2ccb0f4e/contract';
import endContract from '../../snapshots/3c2324f6061012e9d50f869b3e6ae6aa41159acd559b1cc5459bc64e2ccb0f4e/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/11d8695d1b8ea9c748834093ac4111ce68145827709363b7c748c2892be84146/contract';
import startContract from '../../snapshots/11d8695d1b8ea9c748834093ac4111ce68145827709363b7c748c2892be84146/contract.json' with {
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
