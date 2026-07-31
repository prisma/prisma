#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/3705eb1cd04a52180d1206181446bb87e18bb32afcc3d1dacbec685ca2d449d1/contract';
import startContract from '../../snapshots/3705eb1cd04a52180d1206181446bb87e18bb32afcc3d1dacbec685ca2d449d1/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/bf158ef32daace0a629bfdac5d569b0d43cd81e257e2463aef2545638e2c7585/contract';
import endContract from '../../snapshots/bf158ef32daace0a629bfdac5d569b0d43cd81e257e2463aef2545638e2c7585/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'account', column: col('locale', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
