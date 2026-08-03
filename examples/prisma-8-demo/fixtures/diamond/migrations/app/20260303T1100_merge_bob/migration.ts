#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/7e3fa7fbe98974385451444c229337c87ec90c547a9214f81700f86b5af3563d/contract';
import startContract from '../../snapshots/7e3fa7fbe98974385451444c229337c87ec90c547a9214f81700f86b5af3563d/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/f9a41d77df6eae57bcd25ab25df31e6e905aad034a5b813f408bf8e78e9f384a/contract';
import endContract from '../../snapshots/f9a41d77df6eae57bcd25ab25df31e6e905aad034a5b813f408bf8e78e9f384a/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.addColumn({ schema: '__unbound__', table: 'user', column: col('phone', 'text') })];
  }
}

MigrationCLI.run(import.meta.url, M);
