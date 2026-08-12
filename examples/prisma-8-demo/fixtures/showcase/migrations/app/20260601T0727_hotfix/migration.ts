#!/usr/bin/env -S node
import { col, lit, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/bf158ef32daace0a629bfdac5d569b0d43cd81e257e2463aef2545638e2c7585/contract';
import startContract from '../../snapshots/bf158ef32daace0a629bfdac5d569b0d43cd81e257e2463aef2545638e2c7585/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/f66098408da51786d8c6701a2b10db2e90f4b7e138eb5e95f84dc61e156d242b/contract';
import endContract from '../../snapshots/f66098408da51786d8c6701a2b10db2e90f4b7e138eb5e95f84dc61e156d242b/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: '__unbound__',
        table: 'account',
        column: col('verified', 'bool', { notNull: true, default: lit(true) }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
