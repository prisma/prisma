#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration {
  override describe() {
    return {
      from: '41700ef5fda97339b39ea345a56aae72a1ff4be11ddc3ffcab7130bfc71c109d',
      to: '50aadcf996213451cd2876e3caf50c2752b5b8c9ce1aa55dcae24918518b4ffb',
    };
  }

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
