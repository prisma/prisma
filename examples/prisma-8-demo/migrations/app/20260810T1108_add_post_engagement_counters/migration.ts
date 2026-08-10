#!/usr/bin/env -S node
import { col, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/0b4bec62f3ba6e3e85b4ca8601cfb71fdf8bba01baaf491f93ea7a7d96ce96d2/contract';
import startContract from '../../snapshots/0b4bec62f3ba6e3e85b4ca8601cfb71fdf8bba01baaf491f93ea7a7d96ce96d2/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/b18b261eb36b0a9960b7d1f5bc0176e9f189ca2620525c31cdf79b5b14de47cb/contract';
import endContract from '../../snapshots/b18b261eb36b0a9960b7d1f5bc0176e9f189ca2620525c31cdf79b5b14de47cb/contract.json' with {
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
        column: col('impressionCount', 'int8', { codecRef: { codecId: 'pg/int8@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('reachScore', 'numeric', { codecRef: { codecId: 'pg/unboundedint@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'post',
        column: col('viewCount', 'int8', { codecRef: { codecId: 'pg/int8number@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
