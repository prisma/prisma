import type { FailedPrecheckReport } from '../control-api/types';
import { type CliInvocation, cliCommand } from './printed-command';
import { adviceOf, commandAlternative, type RunnerAdvice } from './runner-advice';

/** The way out of a failed check before an operation of `db migrate`. */
export function migrateFailedPrecheckAdvice(
  report: FailedPrecheckReport,
  invocation: CliInvocation,
): RunnerAdvice {
  const migrate = `\`${cliCommand(invocation, 'db migrate')}\``;
  if (report.planStartsFromMarker) {
    const verify = cliCommand(invocation, 'db verify');
    return adviceOf(
      [
        'The database has drifted from its migration history: it is not in the state the migrations before this one leave.',
      ],
      [
        commandAlternative(
          `See how it differs from the contract with \`${verify}\`, change the database or the migration so they agree, and run ${migrate} again`,
          verify,
        ),
      ],
    );
  }
  const sign = cliCommand(invocation, 'db sign');
  return adviceOf(
    [
      `The database has no migration marker, so ${migrate} applies every migration from the first, and the database may already be ahead of this one.`,
    ],
    [
      commandAlternative(
        `If its schema already matches the contract, adopt it with \`${sign}\` instead`,
        sign,
      ),
    ],
  );
}

/** The way out of a failed check before an operation of `db init`, which runs only on a database with no marker. */
export function dbInitFailedPrecheckAdvice(invocation: CliInvocation): RunnerAdvice {
  const sign = cliCommand(invocation, 'db sign');
  return adviceOf(
    [
      `The database already holds part of the schema \`${cliCommand(invocation, 'db init')}\` would create.`,
    ],
    [
      commandAlternative(
        `If its schema already matches the contract, adopt it with \`${sign}\` instead`,
        sign,
      ),
    ],
  );
}
