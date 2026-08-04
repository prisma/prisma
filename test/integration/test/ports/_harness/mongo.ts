import mongoRuntimeAdapter from '@internal/adapter-mongo/runtime';
import { createMongoDriver } from '@internal/driver-mongo';
import { MongoContractSerializer } from '@internal/family-mongo/ir';
import type {
  AnyMongoTypeMaps,
  MongoContract,
  MongoContractWithTypeMaps,
} from '@internal/mongo-contract';
import type { MongoOrmClient } from '@internal/mongo-orm';
import { mongoOrm } from '@internal/mongo-orm';
import {
  createMongoExecutionContext,
  createMongoExecutionStack,
  createMongoRuntime,
} from '@internal/mongo-runtime';
import mongoRuntimeTarget from '@internal/target-mongo/runtime';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

export interface MongoPortContext<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
> {
  /** mongoOrm handle: `db.<root>...` */
  readonly db: MongoOrmClient<TContract>;
  /** Raw MongoClient for seeding / inspection. */
  readonly client: MongoClient;
  /** The `dbName` database, obtained from `client`. */
  readonly mongoDb: Db;
  readonly contract: TContract;
}

export interface WithMongoPortOptions {
  /** The emitted `contract.json` (imported with `{ type: 'json' }`). */
  readonly contractJson: unknown;
  /** Database name to use (defaults to `'test'`). */
  readonly dbName?: string;
}

/**
 * Generic MongoDB harness for ported tests.
 *
 * Each ported suite authors its schema as PSL (`_fixtures/<suite>/contract.prisma`)
 * and emits a `contract.json` / `contract.d.ts`. The harness:
 *   1. starts a `MongoMemoryReplSet` (wiredTiger, single-node),
 *   2. connects a `MongoClient` (raw) + a prisma-next `MongoRuntime`,
 *   3. deserialises the emitted `contract.json` and builds a `mongoOrm` handle,
 *   4. yields `{ db, client, mongoDb, contract }`,
 *   5. drops the database + tears down in a `finally` block.
 */
export async function withMongoPort<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
>(
  options: WithMongoPortOptions,
  fn: (ctx: MongoPortContext<TContract>) => Promise<void>,
): Promise<void> {
  const dbName = options.dbName ?? 'test';
  const contract = new MongoContractSerializer().deserializeContract(
    JSON.parse(JSON.stringify(options.contractJson)),
  ) as TContract;

  let replSet: MongoMemoryReplSet | undefined;
  let client: MongoClient | undefined;

  try {
    replSet = await MongoMemoryReplSet.create({
      instanceOpts: [
        { launchTimeout: timeouts.spinUpMongoMemoryServer, storageEngine: 'wiredTiger' },
      ],
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    const connectionUri = replSet.getUri();
    client = new MongoClient(connectionUri);
    await client.connect();

    const stack = createMongoExecutionStack({
      target: mongoRuntimeTarget,
      adapter: mongoRuntimeAdapter,
    });
    const context = createMongoExecutionContext({ contract, stack });
    const driver = await createMongoDriver(connectionUri, dbName);
    const runtime = createMongoRuntime({ context, driver });

    try {
      const db = mongoOrm<TContract>({ contract, executor: runtime });
      const mongoDb = client.db(dbName);
      await fn({ db, client, mongoDb, contract });
    } finally {
      await runtime.close();
    }
  } finally {
    await client?.close();
    await replSet?.stop();
  }
}

export { timeouts };
