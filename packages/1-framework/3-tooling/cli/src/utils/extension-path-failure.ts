import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { NoInvariantPathStructuralEdge } from '@internal/migration-tools/errors';
import { ActionableCliError, type PathUnreachableMeta } from './cli-errors';
import { chooseAction, runCommandAction } from './next-actions';
import { type CliInvocation, cliCommand } from './printed-command';

/** An extension space `db init` or `db update` could not plan, and the command that tried. */
interface ExtensionSpacePlan {
  readonly spaceId: string;
  /** The contract the space's marker names, or the empty contract's hash when it has none. */
  readonly fromHash: string;
  readonly targetHash: string;
  readonly command: 'db init' | 'db update';
  readonly invocation: CliInvocation;
}

function startText(fromHash: string): string {
  return fromHash === EMPTY_CONTRACT_HASH
    ? 'the empty contract (the space has no marker)'
    : `the contract its marker names ("${fromHash}")`;
}

const INSTALL_MATCHING =
  'Install a version of the extension whose migrations start from the contract the database is at';

function extensionActions(plan: ExtensionSpacePlan) {
  return [
    chooseAction(INSTALL_MATCHING),
    runCommandAction(
      `List the migrations of extension space "${plan.spaceId}"`,
      cliCommand(plan.invocation, 'migration list', ['--space', plan.spaceId]),
    ),
    runCommandAction(`Run ${plan.command} again`, cliCommand(plan.invocation, plan.command)),
  ];
}

/**
 * `MIGRATION.PATH_UNREACHABLE` for an extension space: the migrations the extension ships do not lead
 * from where the database is to the extension's head, and only another version of the extension can
 * change that.
 */
export function errorExtensionPathUnreachable(plan: ExtensionSpacePlan): ActionableCliError {
  const meta: PathUnreachableMeta = {
    spaceId: plan.spaceId,
    fromHash: plan.fromHash,
    targetHash: plan.targetHash,
    kind: 'pathUnreachable',
  };
  return new ActionableCliError(
    'MIGRATION.PATH_UNREACHABLE',
    `Cannot resolve apply path for extension space "${plan.spaceId}"`,
    {
      why: `No path in the on-disk migration graph for extension space "${plan.spaceId}" leads from ${startText(plan.fromHash)} to the on-disk head ref hash "${plan.targetHash}".`,
      fix: `The migrations of extension space "${plan.spaceId}" come with the extension. ${INSTALL_MATCHING}, then run \`${cliCommand(plan.invocation, plan.command)}\` again. List the space's migrations with \`${cliCommand(plan.invocation, 'migration list', ['--space', plan.spaceId])}\`.`,
      nextActions: extensionActions(plan),
      meta: { ...meta },
    },
  );
}

/**
 * `MIGRATION.NO_INVARIANT_PATH` for an extension space: its migrations reach the extension's head
 * from where the database is, but not through the migrations that provide the invariants its head
 * requires.
 */
export function errorExtensionNoInvariantPath(
  plan: ExtensionSpacePlan & {
    readonly required: readonly string[];
    readonly missing: readonly string[];
    readonly structuralPath: readonly NoInvariantPathStructuralEdge[];
  },
): ActionableCliError {
  const missing = plan.missing.map((id) => JSON.stringify(id)).join(', ');
  return new ActionableCliError(
    'MIGRATION.NO_INVARIANT_PATH',
    `No path covers the required invariants of extension space "${plan.spaceId}"`,
    {
      why: `The head of extension space "${plan.spaceId}" requires invariants that no path of its migrations from ${startText(plan.fromHash)} provides: ${missing}.`,
      fix: `The migrations of extension space "${plan.spaceId}" come with the extension. ${INSTALL_MATCHING}, then run \`${cliCommand(plan.invocation, plan.command)}\` again. List the space's migrations with \`${cliCommand(plan.invocation, 'migration list', ['--space', plan.spaceId])}\`.`,
      nextActions: extensionActions(plan),
      meta: {
        spaceId: plan.spaceId,
        required: plan.required,
        missing: plan.missing,
        structuralPath: plan.structuralPath,
      },
    },
  );
}
