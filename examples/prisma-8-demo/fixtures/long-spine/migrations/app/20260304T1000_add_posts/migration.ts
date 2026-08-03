#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/7e951c7a95f42ca0420d9c4aae3602e32911606399982347621943fce34076d8/contract';
import endContract from '../../snapshots/7e951c7a95f42ca0420d9c4aae3602e32911606399982347621943fce34076d8/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/827997ce6f33b7193b0a9eda969affe757e0d54209fde344afcd4d41321c5078/contract';
import startContract from '../../snapshots/827997ce6f33b7193b0a9eda969affe757e0d54209fde344afcd4d41321c5078/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.addColumn({ schema: '__unbound__', table: 'user', column: col('posts', 'text') })];
  }
}

MigrationCLI.run(import.meta.url, M);
