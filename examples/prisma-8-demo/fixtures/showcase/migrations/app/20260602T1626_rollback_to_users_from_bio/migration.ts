#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract';
import endContract from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/3705eb1cd04a52180d1206181446bb87e18bb32afcc3d1dacbec685ca2d449d1/contract';
import startContract from '../../snapshots/3705eb1cd04a52180d1206181446bb87e18bb32afcc3d1dacbec685ca2d449d1/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'avatar' }),
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'bio' }),
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'phone' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
