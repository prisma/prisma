#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as Start } from '../../snapshots/0ce16e4140d056a3abddbe18bd7ee5198d392370f0aeb23236216c51505944de/contract';
import startContract from '../../snapshots/0ce16e4140d056a3abddbe18bd7ee5198d392370f0aeb23236216c51505944de/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/6e6fbbc22d1d4904fbc8668644c5cabe694d946e550a2f0cdd07aaab308b953f/contract';
import endContract from '../../snapshots/6e6fbbc22d1d4904fbc8668644c5cabe694d946e550a2f0cdd07aaab308b953f/contract.json' with {
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
