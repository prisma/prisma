import type { LedgerEntryRecord } from '@internal/contract/types';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { isGraphNode } from '@internal/migration-tools/migration-graph';
import { ifDefined } from '@internal/utils/defined';
import { join } from 'pathe';
import { ActionableCliError } from './cli-errors';
import { chooseAction, runCommandAction } from './next-actions';
import { type CliInvocation, cliCommand, printedPath } from './printed-command';

/** A space whose marker names a contract that is not a node of the space's migration graph. */
export interface MarkerOffGraph {
  readonly spaceId: string;
  readonly markerHash: string;
  readonly targetHash: string;
  readonly graph: MigrationGraph;
  readonly migrationsDir: string;
  /** The space's ledger in apply order, or undefined when it could not be read. */
  readonly ledger: readonly LedgerEntryRecord[] | undefined;
  readonly invocation: CliInvocation;
}

/** The ledger as `read` gives it, or undefined when the read fails: the error it explains must not fail with it. */
export async function readLedgerQuietly(
  read: () => Promise<readonly LedgerEntryRecord[]>,
): Promise<readonly LedgerEntryRecord[] | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

interface HistoryOffGraph {
  readonly lastGraphHash: string;
  readonly missingMigrations: readonly string[];
}

function historyOffGraph(
  ledger: readonly LedgerEntryRecord[],
  graph: MigrationGraph,
): HistoryOffGraph | undefined {
  const lastOnGraph = ledger.findLastIndex((applied) => isGraphNode(applied.to, graph));
  const last = ledger[lastOnGraph];
  if (last === undefined) {
    return undefined;
  }
  return {
    lastGraphHash: last.to,
    missingMigrations: ledger.slice(lastOnGraph + 1).map((applied) => applied.migrationName),
  };
}

function historySentence(history: HistoryOffGraph): string {
  const { lastGraphHash, missingMigrations } = history;
  if (missingMigrations.length === 0) {
    return `The database last applied ${lastGraphHash}.`;
  }
  const verb = missingMigrations.length === 1 ? 'is' : 'are';
  return `The database last applied ${lastGraphHash}, then ${missingMigrations.join(', ')}, which ${verb} no longer on disk.`;
}

const KEEP_HISTORY_CHOICE =
  "If this database's migration history does not need to be kept (a local, development, staging or preview database), reconcile it to the target:";
const DEPLOY_AGAIN = 'Then deploy again.';

/**
 * `MIGRATION.MARKER_MISMATCH`: the database's marker names a contract no migration of the space
 * starts or ends at. It explains the cause from the ledger and gives both ways back onto the graph,
 * neither of which resets the database.
 */
export function errorMarkerMismatch(found: MarkerOffGraph): ActionableCliError {
  const { spaceId, markerHash, targetHash, invocation } = found;
  const history =
    found.ledger === undefined ? undefined : historyOffGraph(found.ledger, found.graph);
  const directory = printedPath(invocation, join(found.migrationsDir, spaceId));
  const why = [
    `The database's marker names contract ${markerHash}, and no migration in ${directory} starts or ends there.`,
    'This usually means a migration this database applied was later planned again or deleted, for example a branch that was deployed and then rebased.',
    ...(history === undefined ? [] : [historySentence(history)]),
    'The database does not need to be reset or dropped.',
  ].join(' ');
  const dryRun = cliCommand(invocation, 'db update', ['--to', targetHash, '--dry-run']);
  const reconcile = cliCommand(invocation, 'db update', ['--to', targetHash]);
  const migrationsOnly = `If this database changes only through migrations, as production should: author a migration from ${history?.lastGraphHash ?? 'the nearest contract in the migration graph'} to the database's current contract, then one from there to ${targetHash}, commit them, and deploy again.`;
  return new ActionableCliError(
    'MIGRATION.MARKER_MISMATCH',
    'The database is at a contract that is not in the migration graph',
    {
      why,
      fix: [
        KEEP_HISTORY_CHOICE,
        `  ${dryRun}`,
        `  ${reconcile}`,
        `  ${DEPLOY_AGAIN}`,
        migrationsOnly,
      ].join('\n'),
      nextActions: [
        chooseAction(KEEP_HISTORY_CHOICE),
        runCommandAction('Preview the changes', dryRun),
        runCommandAction('Reconcile the database', reconcile),
        chooseAction(DEPLOY_AGAIN),
        chooseAction(migrationsOnly),
      ],
      meta: {
        spaceId,
        markerHash,
        targetHash,
        ...ifDefined('lastGraphHash', history?.lastGraphHash),
        missingMigrations: [...(history?.missingMigrations ?? [])],
      },
    },
  );
}
