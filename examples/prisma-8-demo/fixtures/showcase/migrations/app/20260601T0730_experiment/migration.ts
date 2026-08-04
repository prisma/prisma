#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/34dd5176d953c101467355b72fd2adf3e49c97bf13d8198dcc0dafec4d6341ce/contract';
import startContract from '../../snapshots/34dd5176d953c101467355b72fd2adf3e49c97bf13d8198dcc0dafec4d6341ce/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/f1e8cde6ed1bd4ed5851d1308cd58431169236230778c42382189cdc0557a7fb/contract';
import endContract from '../../snapshots/f1e8cde6ed1bd4ed5851d1308cd58431169236230778c42382189cdc0557a7fb/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'widget', column: col('count', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
