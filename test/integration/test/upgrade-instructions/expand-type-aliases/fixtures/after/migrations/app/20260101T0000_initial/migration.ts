#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@internal/postgres/migration';
import type { Contract as End } from '../../snapshots/64fadf0275676e0a4d94b3a50f4aed0615e379ea87b87b9bb04865dcd6e82c7f/contract';
import endContract from '../../snapshots/64fadf0275676e0a4d94b3a50f4aed0615e379ea87b87b9bb04865dcd6e82c7f/contract.json' with {
  type: 'json',
};

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [];
  }
}

MigrationCLI.run(import.meta.url, M);
