#!/usr/bin/env -S node
import { Migration, MigrationCLI } from '@internal/postgres/migration';
import type { Contract as Start } from '../../snapshots/64fadf0275676e0a4d94b3a50f4aed0615e379ea87b87b9bb04865dcd6e82c7f/contract';
import startContract from '../../snapshots/64fadf0275676e0a4d94b3a50f4aed0615e379ea87b87b9bb04865dcd6e82c7f/contract.json' with {
  type: 'json',
};
import type { Contract as End } from '../../snapshots/b780ffea90053c47ccc4c522fb690a6f7742e5be20c396b2801e4e9604110369/contract';
import endContract from '../../snapshots/b780ffea90053c47ccc4c522fb690a6f7742e5be20c396b2801e4e9604110369/contract.json' with {
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
