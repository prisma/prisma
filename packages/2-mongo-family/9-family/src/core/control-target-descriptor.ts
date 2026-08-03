import type {
  ContractSerializer,
  MigratableTargetDescriptor,
  SchemaVerifier,
} from '@internal/framework-components/control';
import type { MongoContract } from '@internal/mongo-contract';
import type { MongoSchemaIR } from '@internal/mongo-schema-ir';
import type { MongoControlFamilyInstance } from './control-instance';

/**
 * Mongo target control descriptor type. Extends the framework's
 * `MigratableTargetDescriptor` with two named SPI properties next to
 * the existing `migrations` capability:
 *
 * - `contractSerializer` — JSON to class boundary for Mongo contracts.
 * - `schemaVerifier` — per-target verifier walking the family contract
 *   against `MongoSchemaIR`.
 *
 * The descriptor itself is the aggregator; no extra `Target<TContract,
 * TSchema>` interface is introduced.
 */
export interface MongoControlTargetDescriptor<TContract extends MongoContract = MongoContract>
  extends MigratableTargetDescriptor<'mongo', 'mongo', MongoControlFamilyInstance> {
  readonly contractSerializer: ContractSerializer<TContract>;
  readonly schemaVerifier: SchemaVerifier<TContract, MongoSchemaIR>;
}
