#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/827997ce6f33b7193b0a9eda969affe757e0d54209fde344afcd4d41321c5078/contract';
import startContract from '../../snapshots/827997ce6f33b7193b0a9eda969affe757e0d54209fde344afcd4d41321c5078/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/d11106e57024ff51282c4a92f549538eb9b8c77b30c719d5e25e726e9cdb40de/contract';
import endContract from '../../snapshots/d11106e57024ff51282c4a92f549538eb9b8c77b30c719d5e25e726e9cdb40de/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'user', column: col('feature', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
