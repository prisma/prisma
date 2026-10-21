#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@internal/postgres/migration';
import type { Contract as End } from '../../snapshots/78fe911ddbf330f3fe4e309069941c5349c28ddb45c6f31a08d4b344c72a84e7/contract';
import endContract from '../../snapshots/78fe911ddbf330f3fe4e309069941c5349c28ddb45c6f31a08d4b344c72a84e7/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/eac9a16cf3aae00acba34eeb8f738ba0dab4bc5cf1ed4bc76822727c30fb937f/contract';
import startContract from '../../snapshots/eac9a16cf3aae00acba34eeb8f738ba0dab4bc5cf1ed4bc76822727c30fb937f/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
