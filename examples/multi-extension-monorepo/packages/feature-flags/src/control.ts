/**
 * Control-plane descriptor for the internal `feature-flags`
 * contract-space package. Same shape as the `audit` descriptor — the
 * point of this example is that the framework treats the two uniformly.
 *
 * Follows the contract-space package layout convention. See
 * `../../audit/src/control.ts` for the canonical wiring.
 */

import type {
  ContractSpace,
  MigrationMetadata,
  MigrationPackage,
  MigrationPlanOperation,
} from '@prisma/orm-postgres/components/control';
import type { Contract } from '@prisma/orm-postgres/contract/types';
import type { SqlControlExtensionDescriptor } from '@prisma/orm-postgres/family/control';
import type { SqlStorage } from '@prisma/orm-postgres/family-contract/types';
import baselineMetadata from '../migrations/20260601T0000_create_feature_flag/migration.json' with {
  type: 'json',
};
import baselineOps from '../migrations/20260601T0000_create_feature_flag/ops.json' with {
  type: 'json',
};
import headRef from '../migrations/refs/head.json' with { type: 'json' };
import { FEATURE_FLAGS_BASELINE_MIGRATION_NAME, FEATURE_FLAGS_SPACE_ID } from './constants';
import contractJson from './contract.json' with { type: 'json' };

const baselinePackage: MigrationPackage = {
  dirName: FEATURE_FLAGS_BASELINE_MIGRATION_NAME,
  metadata: baselineMetadata as unknown as MigrationMetadata,
  ops: baselineOps as unknown as readonly MigrationPlanOperation[],
};

const featureFlagsContractSpace: ContractSpace<Contract<SqlStorage>> = {
  contractJson: contractJson as unknown as Contract<SqlStorage>,
  migrations: [baselinePackage],
  headRef,
};

const featureFlagsExtensionDescriptor: SqlControlExtensionDescriptor<'postgres'> = {
  kind: 'extension' as const,
  id: FEATURE_FLAGS_SPACE_ID,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  version: '0.0.1',
  contractSpace: featureFlagsContractSpace,
  create: () => ({
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
  }),
};

export { featureFlagsExtensionDescriptor };
export default featureFlagsExtensionDescriptor;
