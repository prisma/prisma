import { validateContractOnce } from '@internal/contract/validate-once';
import { MongoContractSerializer } from '@internal/family-mongo/ir';
import type {
  AnyMongoTypeMaps,
  MongoContract,
  MongoContractWithTypeMaps,
} from '@internal/mongo-contract';
import mongoRuntimeTarget from '@internal/target-mongo/runtime';

const serializer = new MongoContractSerializer();

/**
 * Validates an emitted Mongo `contract.json` and returns it as the contract type the application
 * names, ready to pass to `mongo({ contract })` and `mongoStatic({ contract })`. Clients built from
 * the result do not validate it again.
 *
 * @example
 * ```ts
 * import type { Contract } from './contract.d';
 * import contractJson from './contract.json' with { type: 'json' };
 *
 * export const contract = contractFromJson<Contract>(contractJson);
 * ```
 */
export function contractFromJson<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
>(json: unknown): TContract {
  return validateContractOnce(json, mongoRuntimeTarget.targetId, (input) =>
    serializer.deserializeContract<TContract>(input),
  );
}

export function validateMongoContract<
  TContract extends MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>,
>(contract: TContract): TContract {
  return contractFromJson<TContract>(contract);
}
