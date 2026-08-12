import type { SqlControlExtensionDescriptor } from '@internal/family-sql/control';
import { blindCast } from '@internal/utils/casts';
import packageJson from '../../package.json' with { type: 'json' };
import type { Contract } from '../contract/contract.d';
import contractJson from '../contract/contract.json' with { type: 'json' };

const SUPABASE_SPACE_ID = 'supabase' as const;

function buildContractSpace(contractOverride?: unknown) {
  const contract = blindCast<
    Contract,
    'JSON import narrowed to emitted Contract type; assertDescriptorSelfConsistency verifies the storageHash at load time'
  >(contractOverride ?? contractJson);
  return {
    contractJson: contract,
    migrations: [] as const,
    headRef: { hash: contract.storage.storageHash, invariants: [] as const },
  };
}

const supabaseContractSpace = buildContractSpace();

const supabasePackBase = {
  kind: 'extension' as const,
  id: SUPABASE_SPACE_ID,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  version: packageJson.version,
  contractSpace: supabaseContractSpace,
  create: () => ({
    familyId: 'sql' as const,
    targetId: 'postgres' as const,
  }),
} satisfies SqlControlExtensionDescriptor<'postgres'>;

export const supabasePack: SqlControlExtensionDescriptor<'postgres'> = supabasePackBase;

/**
 * Returns a pack using `contractOverride` in place of the shipped
 * `contract.json` when provided, otherwise returns the default pack.
 *
 * Intended for tests that need to drive the framework with a synthetic
 * contract while still exercising the full descriptor wiring.
 */
export function supabasePackWith(options?: {
  contractOverride?: unknown;
}): SqlControlExtensionDescriptor<'postgres'> {
  if (options?.contractOverride === undefined) return supabasePack;
  return {
    ...supabasePackBase,
    contractSpace: buildContractSpace(options.contractOverride),
  };
}

export default supabasePack;
