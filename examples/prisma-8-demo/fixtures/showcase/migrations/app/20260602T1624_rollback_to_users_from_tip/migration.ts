#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract';
import endContract from '../../snapshots/419c09911c25cf9b97e60ee157c61a126accfa5f26f5cdb7954667c704f53753/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/f66098408da51786d8c6701a2b10db2e90f4b7e138eb5e95f84dc61e156d242b/contract';
import startContract from '../../snapshots/f66098408da51786d8c6701a2b10db2e90f4b7e138eb5e95f84dc61e156d242b/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'avatar' }),
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'bio' }),
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'locale' }),
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'phone' }),
      this.dropColumn({ schema: '__unbound__', table: 'account', column: 'verified' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
