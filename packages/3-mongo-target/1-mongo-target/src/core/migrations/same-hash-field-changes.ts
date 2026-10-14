import type { ContractWithDomain } from '@internal/contract/types';
import {
  describeMigrationStatement,
  type MigrationPlannerConflict,
  type PlanOrigin,
  type ResolvedMigrationStatement,
} from '@internal/framework-components/control';
import type { MongoContract } from '@internal/mongo-contract';
import type { FieldRemoval } from './mongo-statement-planning';
import { type OpFactoryCall, RenameFieldCall } from './op-factory-call';

const SAME_HASH = 'the migration would start and end at the same contract hash';

function why(collection: string): string {
  return `The contract gives collection ${JSON.stringify(collection)} no validator, so the names of its fields are not part of the contract's storage hash; a contract written in TypeScript has none yet. A migration that only renames or removes a field would start and end at the same hash, and db migrate refuses such a migration. Use prisma db update for this change instead: it carries the change out with the same --rename or --delete and writes no migration. Or write the migration by hand: run prisma migration new --from <hash of the migration the database is at>, and carry the change out in a dataTransform operation of its migration.ts, since db migrate accepts a migration that starts and ends at the same hash when it runs a dataTransform.`;
}

/**
 * Refuses, for a migration package, each field rename and field removal of a plan whose contract
 * storage hash does not change: the collection has no validator in the contract, so its field
 * names are not in the hash, and `db migrate` refuses a migration that starts and ends at the same
 * hash. `db update` writes no migration and plans without an origin, so it is not refused.
 */
export function sameHashFieldChangeRefusals(input: {
  readonly origin: PlanOrigin | null;
  readonly fromContract: ContractWithDomain;
  readonly contract: MongoContract;
  readonly statements: readonly ResolvedMigrationStatement[];
  readonly callOfStatement: readonly (OpFactoryCall | undefined)[];
  readonly removals: readonly FieldRemoval[];
}): readonly MigrationPlannerConflict[] {
  if (input.origin === null || input.origin.storageHash !== input.contract.storage.storageHash) {
    return [];
  }
  const renames = input.statements.flatMap((statement, index): MigrationPlannerConflict[] => {
    const call = input.callOfStatement[index];
    if (!(call instanceof RenameFieldCall)) return [];
    return [
      {
        kind: 'statementRefused',
        summary: `Cannot ${describeMigrationStatement(statement, input.fromContract, input.contract)}: ${SAME_HASH}`,
        why: why(call.collection),
        refusedStatement: statement,
      },
    ];
  });
  const removals = input.removals.map(
    ({ call }): MigrationPlannerConflict => ({
      kind: 'fieldRemovalRefused',
      summary: `Cannot remove field ${JSON.stringify(call.field)} from collection ${JSON.stringify(call.collection)}: ${SAME_HASH}`,
      why: why(call.collection),
    }),
  );
  return [...renames, ...removals];
}
