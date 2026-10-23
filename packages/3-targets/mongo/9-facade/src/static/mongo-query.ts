import type {
  AnyMongoTypeMaps,
  MongoContract,
  MongoContractWithTypeMaps,
} from '@internal/mongo-contract';
import type { QueryRoot } from '@internal/mongo-query-builder';
import { mongoQueryOnValidatedContract } from '@internal/mongo-query-builder/internal/on-validated-contract';
import { validateMongoContract } from './contract-from-json';

/**
 * The typed query builder for `contract`. The contract is validated as `mongo({ contract })` validates it, once per contract value.
 */
export function mongoQuery<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
>(options: { readonly contract: TContract }): QueryRoot<TContract> {
  return mongoQueryOnValidatedContract({ contract: validateMongoContract(options.contract) });
}
