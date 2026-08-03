#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/47f4a4f58e99a479aaa3ba2ff9d00d1728b1c240359e03aa564ae163d63ba8d7/contract';
import startContract from '../../snapshots/47f4a4f58e99a479aaa3ba2ff9d00d1728b1c240359e03aa564ae163d63ba8d7/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/b34dc9149b6856eacb47e3e6f2157860d8690f5fb382e71ae6b27f943007b778/contract';
import endContract from '../../snapshots/b34dc9149b6856eacb47e3e6f2157860d8690f5fb382e71ae6b27f943007b778/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'user', column: col('comments', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
