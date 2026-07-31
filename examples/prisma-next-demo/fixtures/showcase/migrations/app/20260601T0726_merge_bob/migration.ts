#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/83a1ded0b0045642794c268ef48d21d54bb65a481c13c8b243a7f5821b78d9a0/contract';
import endContract from '../../snapshots/83a1ded0b0045642794c268ef48d21d54bb65a481c13c8b243a7f5821b78d9a0/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/935a02360e01dda00d62f98429f4347bf765abf9118bca03941383cef87591c5/contract';
import startContract from '../../snapshots/935a02360e01dda00d62f98429f4347bf765abf9118bca03941383cef87591c5/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({ schema: '__unbound__', table: 'account', column: col('phone', 'text') }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
