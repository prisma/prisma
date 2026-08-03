#!/usr/bin/env -S node
import { col, Migration, MigrationCLI, primaryKey } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/789dd79ab5ab725be1b6ced088109b803a4d62f9874f932eb384a868d94360a4/contract';
import endContract from '../../snapshots/789dd79ab5ab725be1b6ced088109b803a4d62f9874f932eb384a868d94360a4/contract.json' with {
  type: 'json',
};

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        table: 'user',
        columns: [
          col('email', 'text', { notNull: true }),
          col('id', 'character(36)', { notNull: true }),
        ],
        constraints: [primaryKey(['id'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
