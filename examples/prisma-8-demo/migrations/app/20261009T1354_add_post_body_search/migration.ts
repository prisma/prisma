#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/0ce1b6cf3e03ac1498f39eb8ef08d36d73ee2f0bc7fe368b97f1497ba050501a/contract';
import endContract from '../../snapshots/0ce1b6cf3e03ac1498f39eb8ef08d36d73ee2f0bc7fe368b97f1497ba050501a/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/6e6fbbc22d1d4904fbc8668644c5cabe694d946e550a2f0cdd07aaab308b953f/contract';
import startContract from '../../snapshots/6e6fbbc22d1d4904fbc8668644c5cabe694d946e550a2f0cdd07aaab308b953f/contract.json' with {
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
