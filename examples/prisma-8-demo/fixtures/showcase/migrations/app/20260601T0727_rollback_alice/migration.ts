#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/3bfce91c81146b347dc05f423a71907a82d8b2e78ab5714b2bfab673f673d021/contract';
import endContract from '../../snapshots/3bfce91c81146b347dc05f423a71907a82d8b2e78ab5714b2bfab673f673d021/contract.json' with {
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
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'name' }),
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'phone' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
