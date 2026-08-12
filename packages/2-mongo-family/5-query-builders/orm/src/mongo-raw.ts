import { domainModelsAtDefaultNamespace, type PlanMeta } from '@internal/contract/types';
import type { MongoContract, MongoModelDefinition } from '@internal/mongo-contract';
import { ormError } from './orm-errors';
import { createRawMongoCollection, type RawMongoCollection } from './raw-collection';

export interface MongoRawClient<TContract extends MongoContract> {
  collection<K extends keyof TContract['roots'] & string>(rootName: K): RawMongoCollection;
}

export function mongoRaw<TContract extends MongoContract>(options: {
  contract: TContract;
}): MongoRawClient<TContract> {
  const { contract } = options;

  return {
    collection<K extends keyof TContract['roots'] & string>(rootName: K): RawMongoCollection {
      const modelName = contract.roots[rootName]?.model;
      const models = domainModelsAtDefaultNamespace(contract.domain);
      if (!modelName || !Object.hasOwn(models, modelName)) {
        throw ormError(
          'ORM.MODEL_UNKNOWN',
          `Unknown model "${modelName ?? ''}" for root "${rootName}"`,
          { meta: { model: modelName ?? '', root: rootName } },
        );
      }
      const model = models[modelName] as MongoModelDefinition;
      const collectionName = model.storage.collection ?? modelName;

      const meta: PlanMeta = {
        target: 'mongo',
        storageHash: contract.storage.storageHash,
        lane: 'mongo-raw',
      };

      return createRawMongoCollection(collectionName, meta);
    },
  };
}
