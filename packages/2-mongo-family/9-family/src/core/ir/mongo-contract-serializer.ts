import type { MongoContract } from '@internal/mongo-contract';
import { MongoContractSerializerBase } from './mongo-contract-serializer-base';

/**
 * Default Mongo family `ContractSerializer` concretion. Inherits the
 * Mongo-shared deserialization pipeline (structural validation +
 * collection-level hydration) and falls through `constructTargetContract`
 * with the validated `MongoContract` shape. Family-level call sites
 * (family-instance methods, family-layer tests that don't reach into
 * a target descriptor) instantiate this directly; targets with their
 * own storage concretion (`target-mongo`'s `MongoTargetContractSerializer`)
 * override `constructTargetContract` to wrap the storage shape.
 */
export class MongoContractSerializer extends MongoContractSerializerBase<MongoContract> {
  protected constructTargetContract(validated: MongoContract): MongoContract {
    return validated;
  }
}
