import {
  buildMongoContractView,
  type MongoContract,
  type MongoContractView as MongoContractViewType,
} from '@internal/mongo-contract';
import { MongoContractSerializer } from './mongo-contract-serializer';

/**
 * A Mongo contract view: the deserialized contract intersected with by-name
 * accessors. It is substitutable for `Contract` (carries `storage`, `domain`,
 * …) and also exposes the single default namespace unwrapped with the built-in
 * `collection` kind promoted:
 *
 * ```ts
 * const view = MongoContractView.fromJson<Contract>(contractJson);
 * view.collection.carts.validator // typed MongoCollection
 * view.entries.policy.X           // pack-contributed kind (singular key)
 * view.storage                    // the full contract is still present
 * ```
 */
export type MongoContractView<TContract extends MongoContract = MongoContract> =
  MongoContractViewType<TContract>;

export const MongoContractView = {
  /** Wrap an already-deserialized Mongo contract in a view. */
  from<TContract extends MongoContract>(contract: TContract): MongoContractView<TContract> {
    return buildMongoContractView(contract);
  },

  /** Deserialize a Mongo contract JSON envelope and wrap it in a view. */
  fromJson<TContract extends MongoContract = MongoContract>(
    json: unknown,
  ): MongoContractView<TContract> {
    const contract = new MongoContractSerializer().deserializeContract<TContract>(json);
    return buildMongoContractView(contract);
  },
};
