#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/789dd79ab5ab725be1b6ced088109b803a4d62f9874f932eb384a868d94360a4/contract';
import endContract from '../../snapshots/789dd79ab5ab725be1b6ced088109b803a4d62f9874f932eb384a868d94360a4/contract.json' with {
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
    return [
      this.dropColumn({ schema: '__unbound__', table: 'user', column: 'bio' }),
      this.dropColumn({ schema: '__unbound__', table: 'user', column: 'phone' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
