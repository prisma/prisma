#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract';
import startContract from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/f5aa17d46d7be94ca3ddf4d14d90e0444291d9c063c52d0e05455726e52e0026/contract';
import endContract from '../../snapshots/f5aa17d46d7be94ca3ddf4d14d90e0444291d9c063c52d0e05455726e52e0026/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'account', column: col('phone', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
