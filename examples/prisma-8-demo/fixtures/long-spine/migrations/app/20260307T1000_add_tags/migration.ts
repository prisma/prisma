#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/99de8c2642999fd9b4c99ea77e53e8e31cb65d66575027eb287e8b0d849e8b84/contract';
import endContract from '../../snapshots/99de8c2642999fd9b4c99ea77e53e8e31cb65d66575027eb287e8b0d849e8b84/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/b34dc9149b6856eacb47e3e6f2157860d8690f5fb382e71ae6b27f943007b778/contract';
import startContract from '../../snapshots/b34dc9149b6856eacb47e3e6f2157860d8690f5fb382e71ae6b27f943007b778/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.addColumn({ schema: '__unbound__', table: 'user', column: col('tags', 'text') })];
  }
}

MigrationCLI.run(import.meta.url, M);
