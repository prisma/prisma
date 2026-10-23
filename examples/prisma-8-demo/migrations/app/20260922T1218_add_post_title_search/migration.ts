#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/1c819419d4357de21d9aa9404a0b1d3639e3bd33c3fe6176207c53b51365fa1f/contract';
import startContract from '../../snapshots/1c819419d4357de21d9aa9404a0b1d3639e3bd33c3fe6176207c53b51365fa1f/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/9301c8a3b2ec83c89b4eb12568ccb0c9e916ba199d8743ab38ed468483d6921f/contract';
import endContract from '../../snapshots/9301c8a3b2ec83c89b4eb12568ccb0c9e916ba199d8743ab38ed468483d6921f/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_title_search_e0dd1131',
        expression: 'to_tsvector(\'english\', "title")',
        extras: { type: 'gin' },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
