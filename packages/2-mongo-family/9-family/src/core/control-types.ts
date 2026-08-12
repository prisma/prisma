import type {
  ContractSpace,
  ControlExtensionDescriptor,
} from '@internal/framework-components/control';
import type { MongoContract, MongoStorageShape } from '@internal/mongo-contract';

/**
 * Mongo-family extension descriptor.
 *
 * Extensions that contribute schema opt into the per-space planner /
 * runner / verifier by setting `contractSpace`. Extensions without it
 * are codec-only or query-ops-only — today's behaviour preserved.
 *
 * The shape comes from `@internal/framework-components/control`
 * (`ContractSpace`) — contract-space identity is a framework concept,
 * not a Mongo-specific one. The Mongo family specialises the generic
 * to `MongoContract<MongoStorageShape>` so descriptor authors see a
 * typed contract value over the raw-JSON envelope shape; the runtime
 * in-memory class `MongoStorage` structurally satisfies the shape.
 * Mirrors `SqlControlExtensionDescriptor`.
 */
export interface MongoControlExtensionDescriptor
  extends ControlExtensionDescriptor<'mongo', 'mongo'> {
  readonly contractSpace?: ContractSpace<MongoContract<MongoStorageShape>>;
}
