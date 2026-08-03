#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/7e951c7a95f42ca0420d9c4aae3602e32911606399982347621943fce34076d8/contract';
import startContract from '../../snapshots/7e951c7a95f42ca0420d9c4aae3602e32911606399982347621943fce34076d8/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/93be6c200743261baf55f0586b1380a1c0ade3c48730c09a8fec71ba419c2464/contract';
import endContract from '../../snapshots/93be6c200743261baf55f0586b1380a1c0ade3c48730c09a8fec71ba419c2464/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({ schema: '__unbound__', table: 'user', column: 'bio' }),
      this.dropColumn({ schema: '__unbound__', table: 'user', column: 'posts' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
