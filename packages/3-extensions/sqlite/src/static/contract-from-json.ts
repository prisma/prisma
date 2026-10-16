import type { Contract } from '@internal/contract/types';
import { validateContractOnce } from '@internal/contract/validate-once';
import type { SqlStorage } from '@internal/sql-contract/types';
import sqliteTarget, { SqliteContractSerializer } from '@internal/target-sqlite/runtime';

const serializer = new SqliteContractSerializer();

/**
 * Validates an emitted SQLite `contract.json` and returns it as the contract type the application
 * names, ready to pass to `sqlite({ contract })` and `sqliteStatic({ contract })`. Clients built
 * from the result do not validate it again.
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
  return validateContractOnce(json, sqliteTarget.targetId, (input) =>
    serializer.deserializeContract<TContract>(input),
  );
}

export function validateSqliteContract<TContract extends Contract<SqlStorage>>(
  contract: TContract,
): TContract {
  return validateContractOnce(contract, sqliteTarget.targetId, () =>
    serializer.deserializeContract<TContract>(serializer.serializeContract(contract)),
  );
}
