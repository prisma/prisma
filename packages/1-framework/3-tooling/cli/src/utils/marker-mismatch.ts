import type { LedgerEntryRecord } from '@internal/contract/types';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { isGraphNode } from '@internal/migration-tools/migration-graph';
import { ifDefined } from '@internal/utils/defined';
import type { NextAction } from '@prisma/cli-engine/protocol';
import { join } from 'pathe';
import { ActionableCliError } from './cli-errors';
import { chooseAction, runCommandAction } from './next-actions';
import { type CliInvocation, cliCommand, printedPath } from './printed-command';

/** Who ships a space's migrations: the project, or an extension package. */
export type SpaceOwner =
  | {
      readonly kind: 'application';
      /** The emitted contract, which `db update` reconciles to when it is given no `--to`. */
      readonly emittedContractHash: string;
    }
  | { readonly kind: 'extension' };

/** A space whose marker names a contract that is not a node of the space's migration graph. */
export interface MarkerOutsideGraph {
  readonly spaceId: string;
  readonly owner: SpaceOwner;
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

/** What the ledger recorded after the last contract of the graph the database reached. */
interface LedgerAfterGraph {
  readonly lastGraphHash: string;
  /** Migrations applied after it whose directory is not on disk, oldest first. */
  readonly missingMigrations: readonly string[];
  /** Migrations applied after it whose directory is on disk with different content, oldest first. */
  readonly replannedMigrations: readonly string[];
  /** Whether `db update` or `db init` moved the database after it; their rows name no migration. */
  readonly movedWithoutMigration: boolean;
}

function ledgerAfterGraph(
  ledger: readonly LedgerEntryRecord[],
  graph: MigrationGraph,
): LedgerAfterGraph | undefined {
  const lastOnGraph = ledger.findLastIndex((applied) => isGraphNode(applied.to, graph));
  const last = ledger[lastOnGraph];
  if (last === undefined) {
    return undefined;
  }
  const after = ledger.slice(lastOnGraph + 1);
  const named = after.flatMap((applied) =>
    applied.migrationName === '' ? [] : [applied.migrationName],
  );
  const onDisk = new Set([...graph.migrationByHash.values()].map((edge) => edge.dirName));
  return {
    lastGraphHash: last.to,
    missingMigrations: named.filter((name) => !onDisk.has(name)),
    replannedMigrations: named.filter((name) => onDisk.has(name)),
    movedWithoutMigration: after.some((applied) => applied.migrationName === ''),
  };
}

const NAMES_IN_WHY = 5;

function nameList(names: readonly string[]): string {
  const shown = names.slice(0, NAMES_IN_WHY).join(', ');
  const hidden = names.length - NAMES_IN_WHY;
  return hidden > 0 ? `${shown}, and ${hidden} more` : shown;
}

const MOVED_BY_DB_UPDATE = '`db update` or `db init` moved it outside the migration graph';

function historySentence(history: LedgerAfterGraph): string {
  const { lastGraphHash, missingMigrations, replannedMigrations, movedWithoutMigration } = history;
  const migrations = [
    ...(missingMigrations.length === 0
      ? []
      : [
          `${nameList(missingMigrations)}, which ${missingMigrations.length === 1 ? 'is' : 'are'} no longer on disk`,
        ]),
    ...(replannedMigrations.length === 0
      ? []
      : [
          `${nameList(replannedMigrations)}, which ${replannedMigrations.length === 1 ? 'has' : 'have'} since been planned again with different content`,
        ]),
  ];
  const opening = `The database last applied ${lastGraphHash}`;
  if (migrations.length === 0) {
    return movedWithoutMigration
      ? `${opening}, then ${MOVED_BY_DB_UPDATE}.`
      : `${opening}, then its marker was moved without a migration, for example by \`db sign\`.`;
  }
  const applied = `${opening}, then ${migrations.join(', and ')}.`;
  return movedWithoutMigration ? `${applied} After that, ${MOVED_BY_DB_UPDATE}.` : applied;
}

const PLANNED_AGAIN_OR_DELETED =
  'This usually means a migration this database applied was later planned again or deleted, for example a branch that was deployed and then rebased.';
const CAUSE_UNKNOWN =
  'This usually means a migration this database applied was later planned again or deleted, or `db update` moved the database to a contract no migration ends at.';
const NOT_RESET = 'The database does not need to be reset or dropped.';

function causeSentence(history: LedgerAfterGraph | undefined): readonly string[] {
  if (history === undefined) {
    return [CAUSE_UNKNOWN];
  }
  const namesMigrations =
    history.missingMigrations.length > 0 || history.replannedMigrations.length > 0;
  return namesMigrations
    ? [PLANNED_AGAIN_OR_DELETED, historySentence(history)]
    : [historySentence(history)];
}

function extensionCause(spaceId: string): string {
  return `The migrations of extension space "${spaceId}" come with the extension, so this usually means the extension was changed to a version whose migrations do not include that contract.`;
}

interface Advice {
  readonly fix: string;
  readonly nextActions: readonly NextAction[];
}

const KEEP_HISTORY_CHOICE =
  "If this database's migration history does not need to be kept (a local, development, staging or preview database), reconcile it to the target:";
const DEPLOY_AGAIN = 'Then deploy again.';

/** The `db update` arguments that name the target, or undefined when no `--to` names it. */
function reconcileArgs(
  found: MarkerOutsideGraph,
  owner: SpaceOwner & { readonly kind: 'application' },
) {
  if (found.graph.reverseChain.has(found.targetHash)) {
    return ['--to', found.targetHash];
  }
  return found.targetHash === owner.emittedContractHash ? [] : undefined;
}

function applicationAdvice(
  found: MarkerOutsideGraph,
  owner: SpaceOwner & { readonly kind: 'application' },
  history: LedgerAfterGraph | undefined,
): Advice {
  const from =
    history?.lastGraphHash ??
    (found.graph.nodes.size === 0
      ? 'the empty contract'
      : 'the nearest contract in the migration graph');
  if (found.markerHash === found.targetHash) {
    const authorOne = `The database is already at the target, but no migration ends there: author a migration from ${from} to ${found.targetHash}, commit it, and deploy again.`;
    return { fix: authorOne, nextActions: [chooseAction(authorOne)] };
  }
  const migrationsOnly = `If this database changes only through migrations, as production should: author a migration from ${from} to the database's current contract, then one from there to ${found.targetHash}, commit them, and deploy again.`;
  const toTarget = reconcileArgs(found, owner);
  if (toTarget === undefined) {
    return { fix: migrationsOnly, nextActions: [chooseAction(migrationsOnly)] };
  }
  const dryRun = cliCommand(found.invocation, 'db update', [...toTarget, '--dry-run']);
  const reconcile = cliCommand(found.invocation, 'db update', toTarget);
  return {
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
  };
}

function extensionAdvice(found: MarkerOutsideGraph): Advice {
  const install = `Install a version of the extension whose migrations include the contract the database is at (${found.markerHash}), or ask the extension's maintainers for one.`;
  const list = cliCommand(found.invocation, 'migration list', ['--space', found.spaceId]);
  return {
    fix: [install, `List the space's migrations with \`${list}\`.`, DEPLOY_AGAIN].join('\n'),
    nextActions: [
      chooseAction(install),
      runCommandAction(`List the migrations of extension space "${found.spaceId}"`, list),
      chooseAction(DEPLOY_AGAIN),
    ],
  };
}

/**
 * `MIGRATION.MARKER_MISMATCH`: the database's marker names a contract no migration of the space
 * starts or ends at. It explains the cause from the ledger and gives the ways back onto the graph,
 * none of which resets the database.
 */
export function errorMarkerMismatch(found: MarkerOutsideGraph): ActionableCliError {
  const { spaceId, markerHash, targetHash, invocation, owner } = found;
  const history =
    found.ledger === undefined ? undefined : ledgerAfterGraph(found.ledger, found.graph);
  const directory = printedPath(invocation, join(found.migrationsDir, spaceId));
  const why = [
    `The database's marker names contract ${markerHash}, and no migration in ${directory} starts or ends there.`,
    ...(owner.kind === 'extension'
      ? [extensionCause(spaceId), ...(history === undefined ? [] : [historySentence(history)])]
      : causeSentence(history)),
    NOT_RESET,
  ].join(' ');
  const advice =
    owner.kind === 'extension' ? extensionAdvice(found) : applicationAdvice(found, owner, history);
  return new ActionableCliError(
    'MIGRATION.MARKER_MISMATCH',
    'The database is at a contract that is not in the migration graph',
    {
      why,
      fix: advice.fix,
      nextActions: [...advice.nextActions],
      meta: {
        spaceId,
        markerHash,
        targetHash,
        ...ifDefined('lastGraphHash', history?.lastGraphHash),
        ...(found.ledger === undefined
          ? {}
          : { missingMigrations: [...(history?.missingMigrations ?? [])] }),
      },
    },
  );
}
