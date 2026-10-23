#!/usr/bin/env -S node
import { col, fn, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/1c819419d4357de21d9aa9404a0b1d3639e3bd33c3fe6176207c53b51365fa1f/contract';
import endContract from '../../snapshots/1c819419d4357de21d9aa9404a0b1d3639e3bd33c3fe6176207c53b51365fa1f/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/3c2324f6061012e9d50f869b3e6ae6aa41159acd559b1cc5459bc64e2ccb0f4e/contract';
import startContract from '../../snapshots/3c2324f6061012e9d50f869b3e6ae6aa41159acd559b1cc5459bc64e2ccb0f4e/contract.json' with {
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
        column: col('expiresAt', 'timestamptz', {
          notNull: true,
          default: fn("(now() + '7 days'::interval)"),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
