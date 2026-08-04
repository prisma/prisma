#!/usr/bin/env -S node
import { col, lit, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/935a02360e01dda00d62f98429f4347bf765abf9118bca03941383cef87591c5/contract';
import startContract from '../../snapshots/935a02360e01dda00d62f98429f4347bf765abf9118bca03941383cef87591c5/contract.json' with {
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
      this.addColumn({ schema: '__unbound__', table: 'account', column: col('bio', 'text') }),
      this.addColumn({ schema: '__unbound__', table: 'account', column: col('locale', 'text') }),
      this.addColumn({ schema: '__unbound__', table: 'account', column: col('phone', 'text') }),
      this.addColumn({
        schema: '__unbound__',
        table: 'account',
        column: col('verified', 'bool', { notNull: true, default: lit(true) }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
