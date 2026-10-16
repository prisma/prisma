import type { Contract } from '@internal/contract/types';
import { validateContractOnce } from '@internal/contract/validate-once';
import type { SqlStorage } from '@internal/sql-contract/types';
import postgresTarget, { PostgresContractSerializer } from '@internal/target-postgres/runtime';

const serializer = new PostgresContractSerializer();

/**
 * Validates an emitted Postgres `contract.json` and returns it as the contract type the
 * application names, ready to pass to `postgres({ contract })` and the other Postgres clients.
 * Clients built from the result do not validate it again.
 *
 * @example
 * ```ts
 * import type { Contract } from './contract.d';
 * import contractJson from './contract.json' with { type: 'json' };
 *
 * export const contract = contractFromJson<Contract>(contractJson);
 * ```
 */
export function contractFromJson<TContract extends Contract<SqlStorage>>(json: unknown): TContract {
  return validateContractOnce(json, postgresTarget.targetId, (input) =>
    serializer.deserializeContract<TContract>(input),
  );
}

export function validatePostgresContract<TContract extends Contract<SqlStorage>>(
  contract: TContract,
): TContract {
  return validateContractOnce(contract, postgresTarget.targetId, () =>
    serializer.deserializeContract<TContract>(serializer.serializeContract(contract)),
  );
}
