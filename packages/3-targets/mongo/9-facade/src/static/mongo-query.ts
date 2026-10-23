import type {
  AnyMongoTypeMaps,
  MongoContract,
  MongoContractWithTypeMaps,
} from '@internal/mongo-contract';
import {
  type QueryRoot,
  mongoQuery as queryOnValidatedContract,
} from '@internal/mongo-query-builder';
import { validateMongoContract } from './contract-from-json';

/**
 * The typed query builder for `contract`. The contract is validated as `mongo({ contract })` validates it, once per contract value.
 */
export function mongoQuery<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
>(options: { readonly contract: TContract }): QueryRoot<TContract> {
  return queryOnValidatedContract({ contract: validateMongoContract(options.contract) });
}
