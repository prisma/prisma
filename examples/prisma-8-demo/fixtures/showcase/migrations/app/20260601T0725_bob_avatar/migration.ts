#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract';
import startContract from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/935a02360e01dda00d62f98429f4347bf765abf9118bca03941383cef87591c5/contract';
import endContract from '../../snapshots/935a02360e01dda00d62f98429f4347bf765abf9118bca03941383cef87591c5/contract.json' with {
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
