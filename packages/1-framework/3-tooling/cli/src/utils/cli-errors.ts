/**
 * Re-export all domain error factories from @internal/errors for convenience.
 * CLI-specific errors (e.g., Commander argument validation in the main CLI, or
 * clipanion parse errors in the migration-file CLI) can be added here if needed.
 */
export type { CliErrorConflict, CliErrorEnvelope } from '@internal/errors/control';

import {
  CliStructuredError,
  errorConfigFileNotFound,
  errorConfigValidation,
  errorContractConfigMissing,
  errorContractMissingExtensions,
  errorContractValidationFailed,
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorFamilyReadMarkerSqlRequired,
  errorFileNotFound,
  errorInvalidOutputFormat,
  errorMigrationCliInvalidConfigArg,
  errorMigrationCliUnknownFlag,
  errorMigrationPlanningFailed,
  errorOutputFormatMutex,
  errorQueryRunnerFactoryRequired,
  errorTargetMigrationNotSupported,
  errorUnexpected,
} from '@internal/errors/control';
import { errorRuntime } from '@internal/errors/execution';
import type { MigrationToolsError } from '@internal/migration-tools/errors';
import type { RefResolutionError } from '@internal/migration-tools/ref-resolution';
import { ifDefined } from '@internal/utils/defined';
import type { MigrateFailure } from '../control-api/types';

export {
  ERROR_CODE_DESTRUCTIVE_CHANGES,
  errorDestructiveChanges,
  errorHashMismatch,
  errorMarkerMissing,
  errorMarkerRequired,
  errorRunnerFailed,
  errorRuntime,
  errorSchemaVerificationFailed,
  errorTargetMismatch,
} from '@internal/errors/execution';
export {
  errorMigrationFileMissing,
  errorMigrationInvalidDefaultExport,
  errorMigrationPlanNotArray,
  errorUnfilledPlaceholder,
  placeholder,
} from '@internal/errors/migration';
export {
  CliStructuredError,
  errorConfigFileNotFound,
  errorConfigValidation,
  errorContractConfigMissing,
  errorContractMissingExtensions,
  errorContractValidationFailed,
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorFamilyReadMarkerSqlRequired,
  errorFileNotFound,
  errorInvalidOutputFormat,
  errorMigrationCliInvalidConfigArg,
  errorMigrationCliUnknownFlag,
  errorMigrationPlanningFailed,
  errorOutputFormatMutex,
  errorQueryRunnerFactoryRequired,
  errorTargetMigrationNotSupported,
  errorUnexpected,
};

export function errorRefSetHashNotInGraph(
  resolvedHash: string,
  reachableHashes: readonly string[],
  graphTipHash: string | null,
): CliStructuredError {
  const reachableList =
    reachableHashes.length > 0 ? reachableHashes.join(', ') : '(none — migration graph is empty)';
  const fix =
    reachableHashes.length > 0
      ? graphTipHash !== null
        ? `Set the ref to a graph-node hash such as ${graphTipHash}, or run \`prisma-next migration plan\` to extend the graph.`
        : 'Set the ref to a hash that appears in the migration graph.'
      : 'Run `prisma-next migration plan` first.';
  return errorRuntime(`Resolved contract hash is not in the migration graph: ${resolvedHash}`, {
    why:
      reachableHashes.length > 0
        ? `The migration graph reaches ${reachableList}; resolved ${resolvedHash} isn't a graph node.`
        : 'The migration graph is empty — no hashes reachable.',
    fix,
    meta: {
      code: 'MIGRATION.HASH_NOT_IN_GRAPH',
      resolvedHash,
      reachableHashes: [...reachableHashes],
      ...(graphTipHash !== null ? { graphTipHash } : {}),
    },
  });
}

export function errorRefSetEmptySentinel(hash: string): CliStructuredError {
  return errorRuntime(`Cannot set ref to the empty-database sentinel: ${hash}`, {
    why: 'The empty-database sentinel is a planner internal; it is not a valid ref target.',
    fix: 'Set the ref to a contract hash from the migration graph, or use another ref name.',
    meta: {
      code: 'MIGRATION.REF_SET_EMPTY_SENTINEL',
      hash,
    },
  });
}

/**
 * `--legend` was combined with a machine-readable or silent output flag.
 * The legend is human-only decoration on stderr.
 */
export function errorLegendHumanOnly(
  conflictingFlag: '--json' | '--dot' | '--quiet',
): CliStructuredError {
  return errorRuntime('`--legend` is only available for human-readable output', {
    why: `\`--legend\` prints a glyph key to stderr and cannot be combined with ${conflictingFlag}.`,
    fix: `Omit ${conflictingFlag} to print the legend alongside the tree, or omit --legend when using ${conflictingFlag}.`,
    meta: {
      code: 'MIGRATION.LEGEND_HUMAN_ONLY',
      conflictingFlag,
    },
  });
}

/**
 * `--space <id>` was given a value that doesn't satisfy the contract-space
 * naming rule (`[a-z][a-z0-9_-]{0,63}` per `isValidSpaceId`). Fires before
 * any fs work — the input is syntactically rejected the same way an on-disk
 * directory with that name would be skipped by the enumerator.
 */
export function errorInvalidSpaceId(spaceId: string): CliStructuredError {
  return errorRuntime(`Invalid contract space id: ${spaceId}`, {
    why: 'Contract space ids must match [a-z][a-z0-9_-]{0,63} (lowercase, starts with a letter, max 64 characters — the rule applied to every on-disk space directory).',
    fix: 'Pass a space id that matches the directory naming rule, or omit --space to list every space.',
    meta: {
      code: 'MIGRATION.INVALID_SPACE_ID',
      spaceId,
    },
  });
}

/**
 * `migration list --space <id>` was given a contract-space id that has no
 * directory under `migrations/`. Distinct from "the space exists but is
 * empty" — that path renders the empty-state line and exits 0 per the
 * slice spec § Empty-state. This error fires only when `<projectMigrationsDir>/<spaceId>`
 * does not exist on disk.
 *
 * `availableSpaces` lists the contract-space directory names actually
 * present, sorted lex-asc, so the diagnostic can suggest a near match
 * without making the user reach for `ls`.
 */
export function errorSpaceNotFound(
  spaceId: string,
  availableSpaces: readonly string[],
): CliStructuredError {
  const availableList =
    availableSpaces.length > 0
      ? availableSpaces.join(', ')
      : '(none — no contract spaces on disk yet)';
  const fix =
    availableSpaces.length > 0
      ? `Pick one of: ${availableList}. Run \`prisma-next migration list\` (no --space) to see every space's migrations.`
      : 'Author a migration with `prisma-next migration new` to create the first contract-space directory.';
  return errorRuntime(`Unknown contract space: ${spaceId}`, {
    why: `No directory named "${spaceId}" exists under the migrations root.`,
    fix,
    meta: {
      code: 'MIGRATION.SPACE_NOT_FOUND',
      spaceId,
      availableSpaces: [...availableSpaces],
    },
  });
}

export function errorRefSetBundleNotFound(hash: string): CliStructuredError {
  return errorRuntime(`No migration bundle matches graph-node hash ${hash}`, {
    why: `The hash is a graph node but no on-disk bundle has metadata.to = ${hash}.`,
    fix: 'Run `pnpm fixtures:check`, or re-emit the migration that produces this hash so its bundle is restored.',
    meta: {
      code: 'MIGRATION.REF_SET_BUNDLE_NOT_FOUND',
      hash,
    },
  });
}

export function errorPlanForgotTheFlag(
  resolvedHash: string,
  reachableRefs: ReadonlyArray<{ readonly name: string; readonly hash: string }>,
  graphTipHash: string | null,
): CliStructuredError {
  const reachableList =
    reachableRefs.length > 0
      ? reachableRefs.map((r) => `${r.name} (${r.hash})`).join(', ')
      : '(none)';
  const refFix =
    reachableRefs.length > 0
      ? `Run migration plan with ${reachableRefs.map((r) => `--from ${r.name}`).join(' or ')}.`
      : graphTipHash !== null
        ? `Run migration plan --from ${graphTipHash}.`
        : 'Commit pending migrations first, then run migration plan.';
  return errorRuntime(`Resolved from-hash is not in the migration graph: ${resolvedHash}`, {
    why: `The migration graph reaches ${reachableList}; resolved ${resolvedHash} isn't a graph node.`,
    fix: refFix,
    meta: {
      code: 'MIGRATION.HASH_NOT_IN_GRAPH',
      resolvedHash,
      reachableRefs: reachableRefs.map((r) => r.name),
      ...(graphTipHash !== null ? { graphTipHash } : {}),
    },
  });
}

/**
 * `viaRef: true` (the default) mirrors migration-tools' `errorRefNotResolvable`:
 * a ref name with no pointer file, where the fallback hash isn't a graph
 * node either — there's nothing to materialize a contract from.
 * `viaRef: false` is a distinct, ref-independent case: an explicit `--from
 * <hash>` that doesn't name a ref, on an empty migration graph, so there is
 * no graph node and no ref to resolve a contract through.
 */
export function errorSnapshotMissing(
  identifier: string,
  options?: { readonly viaRef?: boolean },
): CliStructuredError {
  const viaRef = options?.viaRef !== false;
  const fix = viaRef
    ? `Create the ref with "prisma-next ref set ${identifier} <hash>" (or advance it via "prisma-next db update --advance-ref ${identifier}"), or pass a hash that is a node in the migration graph.`
    : `No contract source exists for hash "${identifier}" on an empty migration graph. Use --from with a ref name (its contract resolves through the snapshot store), or run db update first.`;
  return errorRuntime(
    viaRef
      ? `Ref "${identifier}" is not resolvable`
      : `No contract source for from-hash "${identifier}"`,
    {
      why: viaRef
        ? `Ref "${identifier}" has no pointer file, and the hash being resolved is not a node in the migration graph either.`
        : `Hash "${identifier}" is not a node in the migration graph (the graph is empty), and it does not name a ref either.`,
      fix,
      meta: {
        code: 'MIGRATION.SNAPSHOT_MISSING',
        identifier,
        viaRef,
      },
    },
  );
}

export function errorMarkerMismatch(
  markerHash: string,
  reachableHashes: readonly string[],
  graphTip: string | null,
): CliStructuredError {
  const reachableList =
    reachableHashes.length > 0 ? reachableHashes.join(', ') : '(none — migration graph is empty)';
  const planFromFix =
    graphTip !== null
      ? `Run \`prisma-next migration plan --from ${graphTip}\` if the live marker is canonical and the on-disk graph needs catching up.`
      : 'Run `prisma-next migration plan` if the live marker is canonical and the on-disk graph needs catching up.';
  return errorRuntime('Database marker is not reachable in the on-disk migration graph', {
    why: `DB marker is ${markerHash}, but the on-disk migration graph reaches: ${reachableList}.`,
    fix: [
      planFromFix,
      `Run \`prisma-next ref set db ${markerHash}\` if the on-disk graph is canonical and the local \`db\` ref drifted.`,
      'Investigate whether the database was migrated by an out-of-band process.',
    ].join('\n'),
    meta: {
      code: 'MIGRATION.MARKER_MISMATCH',
      markerHash,
      reachableHashes: [...reachableHashes],
      ...(graphTip !== null ? { graphTip } : {}),
    },
  });
}

export function errorPathUnreachable(failure: MigrateFailure): CliStructuredError {
  const meta = failure.meta ?? {};
  const fromHashMeta = typeof meta['fromHash'] === 'string' ? meta['fromHash'] : null;
  // `buildPathNotFoundFailure` uses this sentinel in meta when the live marker is null.
  const planFromHash = fromHashMeta === '<empty>' ? null : fromHashMeta;
  const targetHash =
    typeof meta['targetHash'] === 'string'
      ? meta['targetHash']
      : typeof meta['target'] === 'string'
        ? meta['target']
        : null;
  const deadEnds = meta['deadEnds'];
  const deadEndsSuffix =
    Array.isArray(deadEnds) && deadEnds.length > 0
      ? ` Dead-ends: ${deadEnds.map(String).join(', ')}.`
      : '';
  // Plan-then-apply recovery. The planner destination is the missing edge's
  // target; `migration plan --to` (built for arbitrary targets) makes this a
  // real command, so the diagnostic that sends you here is now honest.
  //
  // Never-planned spaces have an EMPTY migration graph, and contract-ref
  // resolution only resolves full hashes against graph nodes — a
  // `--to <hash>` remediation would reject its own input. `migration plan`
  // without `--to` targets the working contract (the same contract the app
  // space's synthesized head ref carries), so the bare form is the one that
  // runs verbatim.
  const neverPlanned = meta['kind'] === 'neverPlanned';
  const planCommand = (() => {
    if (neverPlanned) {
      return 'prisma-next migration plan --name <slug>';
    }
    if (planFromHash !== null && targetHash !== null) {
      return `prisma-next migration plan --from ${planFromHash} --to ${targetHash} --name <slug>`;
    }
    if (targetHash !== null) {
      return `prisma-next migration plan --to ${targetHash} --name <slug>`;
    }
    if (planFromHash !== null) {
      return `prisma-next migration plan --from ${planFromHash} --name <slug>`;
    }
    return 'prisma-next migration plan';
  })();
  const applyCommand =
    targetHash !== null && !neverPlanned
      ? `prisma-next migrate --to ${targetHash}`
      : 'prisma-next migrate';
  return errorRuntime(failure.summary, {
    why:
      failure.why ??
      `Cannot reach target "${targetHash ?? '<unknown>'}" from current marker "${fromHashMeta ?? '<unknown>'}".${deadEndsSuffix}`,
    fix: [
      'Plan the missing edge, then apply it:',
      `  1. ${planCommand}`,
      `  2. ${applyCommand}`,
      'A rollback (reverse) plan is expected to contain destructive (DROP) operations — review them before applying.',
      'Narrower cases (rename inference, re-adding a NOT NULL column without a safe default, or a type change that needs data) may additionally need a hint in the planned migration.',
      'Inspect the on-disk graph with `prisma-next migration list`, or `prisma-next migration show <bundle>` for any bundle in the path you expected.',
    ].join('\n'),
    meta: {
      ...meta,
      code: 'MIGRATION.PATH_UNREACHABLE',
    },
  });
}

/**
 * Maps a `MigrationToolsError` raised by the migration-tools loader/graph
 * surface (`readMigrationPackage`, `readMigrationsDir`, `readRefs`,
 * `resolveRef`, `reconstructGraph`, ...) into a CLI `errorRuntime` envelope.
 *
 * The full `error.details` payload is forwarded into `meta` so machine
 * consumers (`--json`) see structural fields like `dir`, `storedHash`,
 * `computedHash` (for `MIGRATION.HASH_MISMATCH`) alongside the stable
 * `code`. The user-visible `summary`/`why`/`fix` text is unchanged.
 *
 * Callers are expected to gate on `MigrationToolsError.is(error)` first
 * (mirroring the original inline pattern); non-`MigrationToolsError`
 * values are caller-classified (rethrow, wrap with command-specific
 * `errorUnexpected`, etc.).
 */
export function mapMigrationToolsError(error: MigrationToolsError): CliStructuredError {
  return errorRuntime(error.message, {
    why: error.why,
    fix: error.fix,
    meta: { code: error.code, ...(error.details ?? {}) },
  });
}

/**
 * Shared "needs a live database" precondition for read verbs that consult the
 * marker/ledger (`migration log`, `migration status`). A command needs both a
 * connection string and a control-plane driver; either missing yields the same
 * `CONFIG.DB_CONNECTION_REQUIRED` envelope with `meta.missingFlags` (canonical long-form flags
 * per CLI Style Guide §Errors) so callers can react programmatically. Returns
 * `null` when both are present.
 */
export function requireLiveDatabase(args: {
  readonly dbConnection: unknown;
  readonly hasDriver: boolean;
  readonly why: string;
  readonly commandName?: string;
  readonly retryCommand?: string;
}): CliStructuredError | null {
  if (args.dbConnection && args.hasDriver) {
    return null;
  }
  const missingFlags = args.dbConnection ? [] : ['--db'];
  return errorDatabaseConnectionRequired({
    why: args.why,
    missingFlags,
    ...ifDefined('commandName', args.commandName),
    ...ifDefined('retryCommand', args.retryCommand),
  });
}

/**
 * Maps a `RefResolutionError` from the contract/migration reference
 * resolver into a CLI structured error envelope.
 */
/**
 * A migration ref (dirName or hash-prefix) resolves in more than one contract
 * space. The user must qualify with `--space <id>` to disambiguate.
 */
export function errorAmbiguousMigrationRef(
  ref: string,
  spaceIds: readonly string[],
): CliStructuredError {
  const spaceList = spaceIds.join(', ');
  return errorRuntime(
    `Ambiguous migration reference: "${ref}" resolves in multiple spaces — qualify with --space <id>`,
    {
      why: `"${ref}" matches migrations in spaces: ${spaceList}.`,
      fix: `Qualify with --space <id> to select one space. Available matching spaces: ${spaceList}.`,
      meta: {
        code: 'MIGRATION.AMBIGUOUS_MIGRATION_REF',
        ref,
        spaceIds: [...spaceIds],
      },
    },
  );
}

export function mapRefResolutionError(error: RefResolutionError): CliStructuredError {
  switch (error.kind) {
    case 'not-found':
      return errorRuntime(`Not a known ${error.grammar} reference: "${error.input}"`, {
        why: `No ${error.grammar} matching "${error.input}" exists in the migration graph or refs index.`,
        fix:
          error.grammar === 'contract'
            ? 'Provide a valid contract hash, ref name, or migration directory name.'
            : 'Provide a valid migration directory name or migration hash.',
        meta: { input: error.input, grammar: error.grammar },
      });
    case 'ambiguous':
      return errorRuntime(`Ambiguous ${error.grammar} reference: "${error.input}"`, {
        why: `"${error.input}" matches multiple ${error.grammar}s: ${error.candidates.join(', ')}`,
        fix: 'Provide a longer prefix or use the full hash to disambiguate.',
        meta: { input: error.input, candidates: error.candidates, grammar: error.grammar },
      });
    case 'wrong-grammar':
      return errorRuntime(error.message, {
        why: error.message,
        fix: error.fix,
        meta: { input: error.input, expectedGrammar: error.expectedGrammar },
      });
    case 'invalid-format':
      return errorRuntime(`Invalid reference format: "${error.input}"`, {
        why: error.reason,
        fix: 'Provide a valid contract hash, ref name, or migration directory name.',
        meta: { input: error.input },
      });
  }
}
