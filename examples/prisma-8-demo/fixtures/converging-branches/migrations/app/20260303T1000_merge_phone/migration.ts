#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/93be6c200743261baf55f0586b1380a1c0ade3c48730c09a8fec71ba419c2464/contract';
import startContract from '../../snapshots/93be6c200743261baf55f0586b1380a1c0ade3c48730c09a8fec71ba419c2464/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/042e80cecce8271bb96dedcc7986dadb4c72b098ad5b5b43d8f3bf2d5d61806b/contract';
import endContract from '../../snapshots/042e80cecce8271bb96dedcc7986dadb4c72b098ad5b5b43d8f3bf2d5d61806b/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'user', column: col('avatar', 'text') }),
      this.addColumn({ schema: '__unbound__', table: 'user', column: col('posts', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
