import type { FailedPrecheckReport } from '../control-api/types';
import { type CliInvocation, cliCommand } from './printed-command';

/** The way out of a failed check before an operation of `db migrate`. */
export function migrateFailedPrecheckFix(
  report: FailedPrecheckReport,
  invocation: CliInvocation,
): string {
  const migrate = `\`${cliCommand(invocation, 'db migrate')}\``;
  return report.planStartsFromMarker
    ? `The database has drifted from its migration history: it is not in the state the migrations before this one leave. See how it differs from the contract with \`${cliCommand(invocation, 'db verify')}\`, change the database or the migration so they agree, and run ${migrate} again.`
    : `The database has no migration marker, so ${migrate} applies every migration from the first, and the database may already be ahead of this one. If its schema already matches the contract, adopt it with \`${cliCommand(invocation, 'db sign')}\` instead.`;
}

/** The way out of a failed check before an operation of `db init`, which runs only on a database with no marker. */
export function dbInitFailedPrecheckFix(invocation: CliInvocation): string {
  return `The database already holds part of the schema \`${cliCommand(invocation, 'db init')}\` would create. If its schema already matches the contract, adopt it with \`${cliCommand(invocation, 'db sign')}\` instead.`;
}
