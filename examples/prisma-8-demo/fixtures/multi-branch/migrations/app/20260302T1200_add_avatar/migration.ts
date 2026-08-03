#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/7e3fa7fbe98974385451444c229337c87ec90c547a9214f81700f86b5af3563d/contract';
import endContract from '../../snapshots/7e3fa7fbe98974385451444c229337c87ec90c547a9214f81700f86b5af3563d/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/789dd79ab5ab725be1b6ced088109b803a4d62f9874f932eb384a868d94360a4/contract';
import startContract from '../../snapshots/789dd79ab5ab725be1b6ced088109b803a4d62f9874f932eb384a868d94360a4/contract.json' with {
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
