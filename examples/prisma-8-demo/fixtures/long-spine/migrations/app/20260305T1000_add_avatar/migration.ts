#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/7e951c7a95f42ca0420d9c4aae3602e32911606399982347621943fce34076d8/contract';
import startContract from '../../snapshots/7e951c7a95f42ca0420d9c4aae3602e32911606399982347621943fce34076d8/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/47f4a4f58e99a479aaa3ba2ff9d00d1728b1c240359e03aa564ae163d63ba8d7/contract';
import endContract from '../../snapshots/47f4a4f58e99a479aaa3ba2ff9d00d1728b1c240359e03aa564ae163d63ba8d7/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'user', column: col('avatar', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
