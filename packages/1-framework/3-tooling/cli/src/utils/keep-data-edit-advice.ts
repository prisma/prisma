import type { KeepDataEdit } from '@internal/framework-components/control';
import type { KeepDataEditAdvice } from '../control-api/statements/plan-questions';
import { statementFlag } from '../control-api/statements/statement-flag';
import { type CliInvocation, cliCommand, printedPlanCommand } from './printed-command';
import { RUN_PLANNED_FILE } from './runner-failure-advice';

function swaps(edits: readonly KeepDataEdit[]): string {
  return edits
    .map(({ remove, replaceWith }) => `replace ${remove} with ${replaceWith}`)
    .join(', and ');
}

function dbMigrate(invocation: CliInvocation): string {
  return `\`${cliCommand(invocation, 'db migrate')}\``;
}

/** How `migration plan` says to keep the data of a subject: answer with a delete, then make the edits in the file it writes. */
export function migrationPlanKeepDataEditAdvice(invocation: CliInvocation): KeepDataEditAdvice {
  return (subject, edits) =>
    `To keep that data, answer with ${statementFlag({ verb: 'delete', text: subject })}, then in the migration.ts this command writes ${swaps(edits)}, ${RUN_PLANNED_FILE}, and apply it with ${dbMigrate(invocation)}.`;
}

/**
 * How `db update` says to keep the data of a subject: it cannot itself, so it plans the change
 * with `migration plan` from the contract the database is at, when a migration ends there.
 */
export function dbUpdateKeepDataEditAdvice(
  invocation: CliInvocation,
  databaseStorageHash: string | undefined,
): KeepDataEditAdvice {
  return (subject, edits) => {
    if (databaseStorageHash === undefined) {
      return `db update cannot keep that data, and no migration ends at the contract the database is at, so \`${cliCommand(invocation, 'migration plan')}\` cannot plan the change from it.`;
    }
    const plan = printedPlanCommand(invocation, databaseStorageHash, [
      statementFlag({ verb: 'delete', text: subject }),
    ]);
    return `db update cannot keep that data. To keep it, plan the change with \`${plan}\`, in the migration.ts it writes ${swaps(edits)}, ${RUN_PLANNED_FILE}, and apply it with ${dbMigrate(invocation)}.`;
  };
}
