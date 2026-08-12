import type {
  AnyMongoTypeMaps,
  MongoContract,
  MongoContractWithTypeMaps,
  RootModelName,
} from '@internal/mongo-contract';
import { blindCast } from '@internal/utils/casts';
import type { MongoCollection } from './collection';
import { createMongoCollection } from './collection';
import type { MongoQueryExecutor } from './executor';

export interface MongoOrmOptions<TContract extends MongoContract> {
  readonly contract: TContract;
  readonly executor: MongoQueryExecutor;
}

export type MongoOrmClient<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
> = {
  readonly [K in keyof TContract['roots'] & string]: MongoCollection<
    TContract,
    RootModelName<TContract, K>
  >;
};

export function mongoOrm<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
>(options: MongoOrmOptions<TContract>): MongoOrmClient<TContract> {
  const { contract, executor } = options;
  const client: Record<string, unknown> = {};

  for (const [rootName, rootRef] of Object.entries(contract.roots)) {
    client[rootName] = createMongoCollection(
      contract,
      blindCast<
        RootModelName<TContract, typeof rootName & keyof TContract['roots'] & string>,
        'roots entries are CrossReferences; rootRef.model is a valid RootModelName for this contract'
      >(rootRef.model),
      executor,
    );
  }

  return client as MongoOrmClient<TContract>;
}
