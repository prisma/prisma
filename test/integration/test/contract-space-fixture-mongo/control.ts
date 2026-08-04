/**
 * Control-plane descriptor for the synthetic Mongo test extension.
 *
 * Exposes a `contractSpace` so the framework's per-space planner /
 * runner / verifier can be exercised end-to-end against a Mongo
 * fixture — without taking on the baggage of real Mongo extensions
 * (codec hooks, sharding setups, replica-set credentials).
 *
 * Hosted as a fixture under the integration-tests workspace rather
 * than as a top-level `@internal/extension-*` package: the package
 * shape is incidental, not load-bearing for the test surface, and the
 * `extension-` prefix is reserved for production extensions. Mirrors
 * the rationale documented in the SQL fixture's `control.ts`.
 */

import type { MongoControlExtensionDescriptor } from '@internal/family-mongo/control';
import type { ContractSpace } from '@internal/framework-components/control';
import type { MongoContract, MongoStorageShape } from '@internal/mongo-contract';
import { MONGO_TEST_SPACE_ID } from './constants';
import { mongoTestContractSpaceContract } from './contract';
import {
  mongoTestContractSpaceBaselineMigration,
  mongoTestContractSpaceHeadRef,
} from './migrations';

const mongoTestContractSpace: ContractSpace<MongoContract<MongoStorageShape>> = {
  contractJson: mongoTestContractSpaceContract,
  migrations: [mongoTestContractSpaceBaselineMigration],
  headRef: mongoTestContractSpaceHeadRef,
};

const mongoTestContractSpaceExtensionDescriptor: MongoControlExtensionDescriptor = {
  kind: 'extension' as const,
  id: MONGO_TEST_SPACE_ID,
  familyId: 'mongo' as const,
  targetId: 'mongo' as const,
  version: '0.0.1',
  contractSpace: mongoTestContractSpace,
  create: () => ({
    familyId: 'mongo' as const,
    targetId: 'mongo' as const,
  }),
};

export { mongoTestContractSpaceExtensionDescriptor };
export default mongoTestContractSpaceExtensionDescriptor;
