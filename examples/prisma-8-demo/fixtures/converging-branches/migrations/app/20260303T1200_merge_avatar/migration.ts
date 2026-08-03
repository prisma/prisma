#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/7e3fa7fbe98974385451444c229337c87ec90c547a9214f81700f86b5af3563d/contract';
import startContract from '../../snapshots/7e3fa7fbe98974385451444c229337c87ec90c547a9214f81700f86b5af3563d/contract.json' with {
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
      this.addColumn({ schema: '__unbound__', table: 'user', column: col('phone', 'text') }),
      this.addColumn({ schema: '__unbound__', table: 'user', column: col('posts', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
