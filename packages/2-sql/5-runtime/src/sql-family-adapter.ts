import type { Contract } from '@internal/contract/types';
import type { ExecutionPlan } from '@internal/framework-components/runtime';
import { runtimeError } from '@internal/framework-components/runtime';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { AdapterProfile } from '@internal/sql-relational-core/ast';
import type { MarkerReader, RuntimeFamilyAdapter } from './runtime-spi';

export class SqlFamilyAdapter<TContract extends Contract<SqlStorage>>
  implements RuntimeFamilyAdapter<TContract>
{
  readonly contract: TContract;
  readonly markerReader: MarkerReader;

  constructor(contract: TContract, adapterProfile: AdapterProfile) {
    this.contract = contract;
    this.markerReader = adapterProfile;
  }

  validatePlan(plan: ExecutionPlan, contract: TContract): void {
    if (plan.meta.target !== contract.target) {
      throw runtimeError('PLAN.TARGET_MISMATCH', 'Plan target does not match runtime target', {
        planTarget: plan.meta.target,
        runtimeTarget: contract.target,
      });
    }

    if (plan.meta.storageHash !== contract.storage.storageHash) {
      throw runtimeError(
        'PLAN.HASH_MISMATCH',
        'Plan storage hash does not match runtime contract',
        {
          planStorageHash: plan.meta.storageHash,
          runtimeStorageHash: contract.storage.storageHash,
        },
      );
    }
  }
}
