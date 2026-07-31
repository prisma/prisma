#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/83a1ded0b0045642794c268ef48d21d54bb65a481c13c8b243a7f5821b78d9a0/contract';
import endContract from '../../snapshots/83a1ded0b0045642794c268ef48d21d54bb65a481c13c8b243a7f5821b78d9a0/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/f5aa17d46d7be94ca3ddf4d14d90e0444291d9c063c52d0e05455726e52e0026/contract';
import startContract from '../../snapshots/f5aa17d46d7be94ca3ddf4d14d90e0444291d9c063c52d0e05455726e52e0026/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'account', column: col('avatar', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
