#!/usr/bin/env -S node
import { col, fn, Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import type { Contract as End } from '../../snapshots/0ce16e4140d056a3abddbe18bd7ee5198d392370f0aeb23236216c51505944de/contract';
import endContract from '../../snapshots/0ce16e4140d056a3abddbe18bd7ee5198d392370f0aeb23236216c51505944de/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/d44ab6f7caddcc384332c669737008aec7ec8c9f5b013cb502a03c2eb04be9c0/contract';
import startContract from '../../snapshots/d44ab6f7caddcc384332c669737008aec7ec8c9f5b013cb502a03c2eb04be9c0/contract.json' with {
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
        column: col('expiresAt', 'timestamptz', {
          notNull: true,
          default: fn("(now() + '7 days'::interval)"),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
