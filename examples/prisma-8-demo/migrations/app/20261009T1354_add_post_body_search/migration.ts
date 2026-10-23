#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/99a4393ee9f877db228baee1164325543fa018be780fd1253250d7d81539f38e/contract';
import endContract from '../../snapshots/99a4393ee9f877db228baee1164325543fa018be780fd1253250d7d81539f38e/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/9301c8a3b2ec83c89b4eb12568ccb0c9e916ba199d8743ab38ed468483d6921f/contract';
import startContract from '../../snapshots/9301c8a3b2ec83c89b4eb12568ccb0c9e916ba199d8743ab38ed468483d6921f/contract.json' with {
  type: 'json',
};

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('body', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_search_f03270be',
        expression: `(setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("body", '')), 'B'))`,
        extras: { type: 'gin' },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
