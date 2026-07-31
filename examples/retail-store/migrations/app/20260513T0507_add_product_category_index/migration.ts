#!/usr/bin/env -S node
import { createIndex, Migration, MigrationCLI } from '@prisma/orm-mongo/target/migration';
import type { Contract as End } from '../../snapshots/977a060afe52c4a56f93f2f33d65b8b6b4cc4ded04d16fe6b4f8e7e9e61192d3/contract';
import endContract from '../../snapshots/977a060afe52c4a56f93f2f33d65b8b6b4cc4ded04d16fe6b4f8e7e9e61192d3/contract.json' with {
  type: 'json',
};
import type { Contract as Start } from '../../snapshots/6969147309c36a2e1cef69c2077abfa7ddb568d171ad99f03506d9f428b0a595/contract';
import startContract from '../../snapshots/6969147309c36a2e1cef69c2077abfa7ddb568d171ad99f03506d9f428b0a595/contract.json' with {
  type: 'json',
};

class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      createIndex(
        'products',
        [
          { direction: 1, field: 'primaryCategory' },
          { direction: 1, field: 'articleType' },
        ],
        {},
      ),
    ];
  }
}

export default M;
MigrationCLI.run(import.meta.url, M);
