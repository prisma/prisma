import { loadConfigForSections } from '@internal/config-loader';
import type { LedgerEntryRecord } from '@internal/contract/types';
import type {
  AggregateContractSpace,
  ContractMarkerRecordLike,
} from '@internal/migration-tools/aggregate';
import type { RefEntry } from '@internal/migration-tools/refs';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { dim, yellow } from 'colorette';
import { Command } from 'commander';
import { createControlClient } from '../control-api/client';
import {
  buildReadAggregate,
  loadContractRawSafely,
  refusePackageCorruptionOnAggregate,
} from '../control-api/operations/contract-space-aggregate-loader';
import { hasMigrationPath } from '../control-api/operations/graph-queries';
import {
  refuseMissingInvariantPath,
  refuseUnknownInvariants,
} from '../control-api/operations/invariants';
import {
  listRefsByContractHash,
  migrationSpaceListEntriesFromAggregate,
  runMigrationList,
} from '../control-api/operations/migration-list';
import {
  appliedHashesFromLedger,
  deriveStatusEdgeAnnotations,
  originHashForStatus,
  statusForMigrationHash,
} from '../control-api/operations/migration-status-overlay';
import { resolveContractRef } from '../control-api/operations/ref-resolution';
import { readMigrationRefs } from '../control-api/operations/refs';
import { CliStructuredError, errorUnexpected, requireLiveDatabase } from '../utils/cli-errors';
import {
  addGlobalOptions,
  maskConnectionUrl,
  readContractEnvelope,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
  setCommandSeeAlso,
} from '../utils/command-helpers';
import {
  type MigrationEdgeAnnotation,
  renderMigrationGraphLegend,
} from '../utils/formatters/migration-graph-labels';
import {
  computeGlobalMaxDirNameWidth,
  computeGlobalMaxEdgeTreePrefixWidth,
  indentMigrationGraphTreeBlock,
  renderMigrationGraphSpaceTree,
} from '../utils/formatters/migration-graph-space-render';
import type { MigrationListEntry } from '../utils/formatters/migration-list-types';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { shouldShowLegend, validateLegendOptions } from '../utils/legend';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';
import type {
  MigrationStatusEntry,
  MigrationStatusResult,
  MigrationStatusSpace,
  StatusDiagnosticJson,
} from './json/schemas';
import { migrationStatusJsonResultSchema } from './json/schemas';

export type { StatusRef } from '../utils/migration-types';
export type {
  MigrationStatusEntry,
  MigrationStatusResult,
  MigrationStatusSpace,
  StatusDiagnosticJson,
};
export { migrationStatusJsonResultSchema };

export interface MigrationStatusOptions extends CommonCommandOptions {
  readonly db?: string;
  readonly config?: string;
  readonly to?: string;
  readonly from?: string;
  readonly space?: string;
  readonly legend?: boolean;
  readonly ascii?: boolean;
}

export interface MigrationStatusTreeSection {
  readonly space: string;
  readonly tree: string;
  readonly showHeading: boolean;
}

interface MigrationStatusCommandResult {
  readonly ok: true;
  readonly spaces: readonly MigrationStatusSpace[];
  readonly summary: string;
  readonly diagnostics: readonly StatusDiagnosticJson[];
  readonly treeSections: readonly MigrationStatusTreeSection[];
}

function shortDisplayHash(hash: string): string {
  return hash.slice(0, 12);
}

function resolveTarget(contractHash: string, activeRefHash: string | undefined): string {
  return activeRefHash ?? contractHash;
}

function buildStatusMigrations(
  listMigrations: readonly MigrationListEntry[],
  annotations: ReadonlyMap<string, MigrationEdgeAnnotation>,
): readonly MigrationStatusEntry[] {
  return listMigrations.map((migration) => ({
    ...migration,
    status: statusForMigrationHash(migration.hash, annotations),
  }));
}

function renderSpaceTree(args: {
  readonly space: AggregateContractSpace;
  readonly liveContractHash: string;
  readonly migrations: readonly MigrationListEntry[];
  readonly markerHash: string | undefined;
  readonly showDbMarker: boolean;
  readonly statusOverlay: ReadonlyMap<string, MigrationEdgeAnnotation>;
  readonly colorize: boolean;
  readonly glyphMode: 'unicode' | 'ascii';
  readonly isAppSpace: boolean;
  readonly globalMaxEdgeTreePrefixWidth?: number;
  readonly globalMaxDirNameWidth?: number;
}): string {
  const graph = args.space.graph();
  if (graph.nodes.size === 0) {
    return '';
  }
  return renderMigrationGraphSpaceTree({
    graph,
    migrations: args.migrations,
    liveContractHash: args.liveContractHash,
    refsByHash: listRefsByContractHash(args.space),
    statusOverlayByHash: args.statusOverlay,
    colorize: args.colorize,
    glyphMode: args.glyphMode,
    isAppSpace: args.isAppSpace,
    ...(args.showDbMarker && args.markerHash !== undefined ? { dbHash: args.markerHash } : {}),
    ...(args.globalMaxEdgeTreePrefixWidth !== undefined
      ? { globalMaxEdgeTreePrefixWidth: args.globalMaxEdgeTreePrefixWidth }
      : {}),
    ...(args.globalMaxDirNameWidth !== undefined
      ? { globalMaxDirNameWidth: args.globalMaxDirNameWidth }
      : {}),
  });
}

function countPending(migrations: readonly MigrationStatusEntry[]): number {
  return migrations.filter((m) => m.status === 'pending').length;
}

export function buildNoPathSummary(args: {
  readonly markerHash: string | undefined;
  readonly targetHash: string;
  readonly explicitTarget: boolean;
  readonly refName: string | undefined;
}): string {
  const markerPart =
    args.markerHash !== undefined
      ? `the database state (${shortDisplayHash(args.markerHash)})`
      : 'the database state';
  const targetShort = shortDisplayHash(args.targetHash);
  if (!args.explicitTarget) {
    return `No migration path from ${markerPart} to the application's contract (${targetShort}). Run \`prisma-next migration plan --name <name>\` to author one.`;
  }
  const targetLabel =
    args.refName !== undefined
      ? `the target (${targetShort} via \`${args.refName}\`)`
      : `the target (${targetShort})`;
  return `No migration path from ${markerPart} to ${targetLabel}. Run \`prisma-next migration plan --name <name>\` to author one, or pass \`--to <contract>\` to pick a reachable target.`;
}

export function buildStatusHeadline(args: {
  readonly pendingCount: number;
  readonly targetHash: string;
  readonly markerDiverged: boolean;
  readonly markerHash: string | undefined;
}): string {
  if (args.markerDiverged && args.markerHash !== undefined) {
    return `Database marker ${shortDisplayHash(args.markerHash)} is not in the on-disk migration graph`;
  }
  if (args.pendingCount === 0) {
    return 'Up to date';
  }
  return `${args.pendingCount} pending — run \`prisma-next migrate --to ${shortDisplayHash(args.targetHash)}\``;
}

export function formatStatusSummary(
  result: MigrationStatusCommandResult,
  colorize: boolean,
): string {
  const c = (fn: (s: string) => string, s: string) => (colorize ? fn(s) : s);
  const lines: string[] = [];
  const pendingTotal = result.spaces.reduce(
    (sum, space) => sum + countPending(space.migrations),
    0,
  );
  const hasDivergence = result.diagnostics.some(
    (d) => d.code === 'MIGRATION.MARKER_NOT_IN_HISTORY',
  );
  if (hasDivergence || pendingTotal > 0) {
    lines.push(c(yellow, result.summary));
  } else {
    lines.push(result.summary);
  }
  const missingInvariantsDiagnostic = result.diagnostics.find(
    (d) => d.code === 'MIGRATION.MISSING_INVARIANTS',
  );
  if (missingInvariantsDiagnostic !== undefined) {
    lines.push(c(dim, missingInvariantsDiagnostic.message));
  }
  return lines.join('\n');
}

export function formatStatusHumanOutput(
  result: MigrationStatusCommandResult,
  colorize: boolean,
): string {
  const sections: string[] = [];
  for (const section of result.treeSections) {
    if (section.showHeading) {
      sections.push(`${section.space}:`);
    }
    if (section.tree.length > 0) {
      sections.push(section.tree);
    } else {
      sections.push('(no migrations)');
    }
    sections.push('');
  }
  sections.push(formatStatusSummary(result, colorize));
  return sections.join('\n').trimEnd();
}

async function readMarkersAndLedgers(args: {
  readonly client: ReturnType<typeof createControlClient>;
  readonly spaceIds: readonly string[];
}): Promise<{
  readonly markersBySpace: ReadonlyMap<string, ContractMarkerRecordLike>;
  readonly ledgersBySpace: ReadonlyMap<string, readonly LedgerEntryRecord[]>;
}> {
  const markersBySpace = new Map<string, ContractMarkerRecordLike>();
  const all = await args.client.readAllMarkers();
  for (const [spaceId, marker] of all) {
    markersBySpace.set(spaceId, marker);
  }
  const ledgersBySpace = new Map<string, readonly LedgerEntryRecord[]>();
  for (const spaceId of args.spaceIds) {
    ledgersBySpace.set(spaceId, await args.client.readLedger(spaceId));
  }
  return { markersBySpace, ledgersBySpace };
}

export async function executeMigrationStatusCommand(
  options: MigrationStatusOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<MigrationStatusCommandResult, CliStructuredError>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'driver',
    'extensions',
    'db',
    'migrations',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;
  const { configPath, migrationsDir, migrationsRelative, refsDir } = resolveMigrationPaths(
    options.config,
    config,
    process.cwd(),
  );

  const dbConnection = options.db ?? config.db?.connection;
  const hasDriver = !!config.driver;
  const usingFromOverride = options.from !== undefined;

  if (!usingFromOverride) {
    const missingDb = requireLiveDatabase({
      dbConnection,
      hasDriver,
      why: 'migration status needs a database connection to read the marker and ledger (or pass --from for offline path preview)',
      retryCommand: 'prisma-next migration status --from <contract>',
    });
    if (missingDb) {
      return notOk(missingDb);
    }
  }

  const refsResult = await readMigrationRefs(refsDir);
  if (!refsResult.ok) {
    return notOk(refsResult.failure);
  }
  const allRefs = refsResult.value;

  const diagnostics: StatusDiagnosticJson[] = [];

  const loaded = await buildReadAggregate(config, { migrationsDir });
  if (!loaded.ok) {
    return notOk(loaded.failure);
  }
  const contractHash = loaded.value.contractHash;
  try {
    await readContractEnvelope(config);
  } catch (error) {
    diagnostics.push({
      code: 'CONTRACT.UNREADABLE',
      severity: 'warn',
      message: `Could not read contract: ${error instanceof Error ? error.message : 'unknown error'}`,
      hints: ["Run 'prisma-next contract emit' to generate a valid contract"],
    });
  }

  const { aggregate } = loaded.value;
  const contractRawForAggregate = await loadContractRawSafely(config);
  if (contractRawForAggregate !== null) {
    const corruptionFailure = refusePackageCorruptionOnAggregate(aggregate);
    if (corruptionFailure) {
      return notOk(corruptionFailure);
    }
  }
  const appGraph = aggregate.app.graph();

  let activeRefHash: string | undefined;
  let activeRefName: string | undefined;
  let activeRefEntry: RefEntry | undefined;
  let fromOverrideHash: string | undefined;

  if (options.to) {
    const refResult = resolveContractRef(options.to, { graph: appGraph, refs: allRefs });
    if (!refResult.ok) {
      return notOk(refResult.failure);
    }
    activeRefHash = refResult.value.hash;
    if (refResult.value.provenance.kind === 'ref') {
      activeRefName = refResult.value.provenance.refName;
      activeRefEntry = allRefs[activeRefName];
    }
  }

  if (options.from) {
    const fromResult = resolveContractRef(options.from, { graph: appGraph, refs: allRefs });
    if (!fromResult.ok) {
      return notOk(fromResult.failure);
    }
    fromOverrideHash = fromResult.value.hash;
  }

  const requiredInvariants: readonly string[] = [...(activeRefEntry?.invariants ?? [])].sort();

  if (!flags.json && !flags.quiet) {
    const details: Array<{ label: string; value: string }> = [
      { label: 'config', value: configPath },
      { label: 'migrations', value: migrationsRelative },
    ];
    if (dbConnection && hasDriver) {
      details.push({ label: 'database', value: maskConnectionUrl(String(dbConnection)) });
    }
    if (activeRefName) {
      details.push({ label: 'ref', value: activeRefName });
    }
    if (options.from) {
      details.push({ label: 'from', value: options.from });
    }
    if (options.space) {
      details.push({ label: 'space', value: options.space });
    }
    const header = formatStyledHeader({
      command: 'migration status',
      description: 'Show migration history and applied status',
      details,
      flags,
    });
    ui.stderr(header);
    if (shouldShowLegend(options, flags)) {
      ui.stderr(
        renderMigrationGraphLegend({
          colorize: flags.color !== false,
          glyphMode: ui.resolveGlyphMode(options.ascii === true),
        }),
      );
      ui.stderr('');
    }
  }

  const listSpaces = await migrationSpaceListEntriesFromAggregate(aggregate, migrationsDir);
  const listResult = runMigrationList({
    spaces: listSpaces,
    ...ifDefined('spaceFilter', options.space),
  });
  if (!listResult.ok) {
    return listResult;
  }

  const scopedSpaces = listResult.value.spaces;
  const showSpaceHeadings = scopedSpaces.length > 1;

  let markersBySpace = new Map<string, ContractMarkerRecordLike>();
  let ledgersBySpace = new Map<string, readonly LedgerEntryRecord[]>();
  let connected = false;

  if (dbConnection && hasDriver && !usingFromOverride) {
    const client = createControlClient({
      family: config.family,
      target: config.target,
      adapter: config.adapter,
      driver: config.driver,
      extensions: config.extensions ?? [],
    });
    try {
      await client.connect(dbConnection);
      connected = true;
      const read = await readMarkersAndLedgers({
        client,
        spaceIds: scopedSpaces.map((s) => s.space),
      });
      markersBySpace = new Map(read.markersBySpace);
      ledgersBySpace = new Map(read.ledgersBySpace);
    } catch (error) {
      if (CliStructuredError.is(error)) {
        return notOk(error);
      }
      return notOk(
        errorUnexpected(error instanceof Error ? error.message : String(error), {
          why: `Failed to read database state: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    } finally {
      await client.close();
    }
  }

  if (activeRefEntry && activeRefEntry.invariants.length > 0 && connected) {
    const invariantRefusal = refuseUnknownInvariants({
      graph: appGraph,
      markerInvariants: markersBySpace.get(aggregate.app.spaceId)?.invariants ?? [],
      refInvariants: activeRefEntry.invariants,
      ...ifDefined('refName', activeRefName),
    });
    if (invariantRefusal) {
      return notOk(invariantRefusal);
    }
  }

  const showAppliedOverlay = connected && !usingFromOverride;
  const showDbMarker = connected && !usingFromOverride;
  const glyphMode = ui.resolveGlyphMode(options.ascii === true);
  const colorize = flags.color !== false;

  const statusSpaces: MigrationStatusSpace[] = [];
  const treeSections: MigrationStatusTreeSection[] = [];
  let markerDiverged = false;
  let markerCannotReachTarget = false;
  let headlineTargetHash = activeRefHash ?? contractHash;
  let totalPending = 0;

  const globalLayoutInputs = showSpaceHeadings
    ? scopedSpaces
        .filter((spaceEntry) => spaceEntry.migrations.length > 0)
        .map((spaceEntry) => ({
          graph: aggregate.space(spaceEntry.space)!.graph(),
          liveContractHash: contractHash,
        }))
    : [];
  const globalMaxEdgeTreePrefixWidth =
    globalLayoutInputs.length > 0
      ? computeGlobalMaxEdgeTreePrefixWidth(globalLayoutInputs)
      : undefined;
  const globalMaxDirNameWidth =
    globalLayoutInputs.length > 0 ? computeGlobalMaxDirNameWidth(globalLayoutInputs) : undefined;

  for (const spaceEntry of scopedSpaces) {
    const space = aggregate.space(spaceEntry.space);
    if (space === undefined) {
      continue;
    }
    const graph = space.graph();
    const spaceContractHash = space.contract().storage.storageHash;
    const targetHash = resolveTarget(spaceContractHash, activeRefHash);
    if (spaceEntry.space === aggregate.app.spaceId) {
      headlineTargetHash = targetHash;
    }

    const markerRecord = markersBySpace.get(spaceEntry.space);
    const markerHash = usingFromOverride
      ? fromOverrideHash
      : (markerRecord?.storageHash ?? undefined);
    const originHash = originHashForStatus(markerHash);
    const markerInGraph =
      markerHash === undefined || graph.nodes.has(markerHash) || markerHash === spaceContractHash;
    if (
      connected &&
      !usingFromOverride &&
      markerInGraph &&
      originHash !== targetHash &&
      !hasMigrationPath(graph, originHash, targetHash)
    ) {
      markerCannotReachTarget = true;
    }

    if (connected && !usingFromOverride && markerHash !== undefined && !markerInGraph) {
      markerDiverged = true;
      diagnostics.push({
        code: 'MIGRATION.MARKER_NOT_IN_HISTORY',
        severity: 'warn',
        message:
          'Database was updated outside the migration system (marker does not match any migration)',
        hints: [
          "Run 'prisma-next db sign' to overwrite the marker if the database already matches the contract",
          "Run 'prisma-next db update' to push the current contract to the database",
        ],
      });
    }

    const ledger = ledgersBySpace.get(spaceEntry.space) ?? [];
    const appliedHashes = showAppliedOverlay ? appliedHashesFromLedger(ledger) : new Set<string>();

    const annotations = deriveStatusEdgeAnnotations({
      graph,
      targetHash,
      originHash,
      appliedMigrationHashes: appliedHashes,
      showAppliedOverlay,
    });
    const isAppSpace = spaceEntry.space === aggregate.app.spaceId;
    const tree = renderSpaceTree({
      space,
      liveContractHash: contractHash,
      migrations: spaceEntry.migrations,
      markerHash,
      showDbMarker,
      statusOverlay: annotations,
      colorize,
      glyphMode,
      isAppSpace,
      ...(globalMaxEdgeTreePrefixWidth !== undefined ? { globalMaxEdgeTreePrefixWidth } : {}),
      ...(globalMaxDirNameWidth !== undefined ? { globalMaxDirNameWidth } : {}),
    });
    const migrations = buildStatusMigrations(spaceEntry.migrations, annotations);
    const pending = countPending(migrations);
    totalPending += pending;

    statusSpaces.push({
      space: spaceEntry.space,
      currentContract: markerHash ?? null,
      targetContract: targetHash,
      migrations: [...migrations],
    });
    const displayTree =
      showSpaceHeadings && tree.length > 0 ? indentMigrationGraphTreeBlock(tree, '  ') : tree;
    treeSections.push({
      space: spaceEntry.space,
      tree: displayTree,
      showHeading: showSpaceHeadings,
    });
  }

  if (connected && requiredInvariants.length > 0) {
    const markerInvariants = markersBySpace.get(aggregate.app.spaceId)?.invariants ?? [];
    const markerSet = new Set(markerInvariants);
    const missing = requiredInvariants.filter((id) => !markerSet.has(id));
    if (missing.length > 0) {
      diagnostics.push({
        code: 'MIGRATION.MISSING_INVARIANTS',
        ...ifDefined('ref', activeRefName),
        invariants: missing,
        message: `missing invariant(s): ${missing.join(', ')}`,
      });
      if (activeRefHash !== undefined) {
        const pathRefusal = refuseMissingInvariantPath({
          graph: appGraph,
          originHash: originHashForStatus(markersBySpace.get(aggregate.app.spaceId)?.storageHash),
          targetHash: activeRefHash,
          missing,
          ...ifDefined('refName', activeRefName),
        });
        if (pathRefusal) {
          return notOk(pathRefusal);
        }
      }
    }
  }

  const appMarkerHash = markersBySpace.get(aggregate.app.spaceId)?.storageHash;
  const summary = markerCannotReachTarget
    ? buildNoPathSummary({
        markerHash: appMarkerHash,
        targetHash: headlineTargetHash,
        explicitTarget: options.to !== undefined,
        refName: activeRefName,
      })
    : buildStatusHeadline({
        pendingCount: totalPending,
        targetHash: headlineTargetHash,
        markerDiverged,
        markerHash: appMarkerHash,
      });

  if (scopedSpaces.every((s) => s.migrations.length === 0)) {
    return ok({
      ok: true,
      spaces: statusSpaces,
      summary: 'No migrations found',
      diagnostics,
      treeSections,
    });
  }

  return ok({
    ok: true,
    spaces: statusSpaces,
    summary,
    diagnostics,
    treeSections,
  });
}

export function createMigrationStatusCommand(): Command {
  const command = new Command('status');
  setCommandDescriptions(
    command,
    'Show migration path and pending status',
    'Shows which migrations are pending between the database marker and\n' +
      'the target contract. Requires a database connection.\n' +
      'Pass --from for an offline path preview without a database.\n' +
      'Use `migration graph` for topology, `migration log` for history,\n' +
      'and `migration list` for on-disk enumeration.',
  );
  setCommandExamples(command, [
    'prisma-next migration status --db $DATABASE_URL',
    'prisma-next migration status --to production --db $DATABASE_URL',
    'prisma-next migration status --from abc123 --to production',
    'prisma-next migration status --from abc123 --to production --json',
    'prisma-next migration status --ascii --from abc123 --to production',
    'prisma-next migration status --legend --from abc123 --to production',
  ]);
  setCommandSeeAlso(command, [
    { verb: 'migration log', oneLiner: 'Show executed migration history' },
    { verb: 'migration list', oneLiner: 'List on-disk migrations' },
    { verb: 'migration graph', oneLiner: 'Show the migration graph topology' },
    { verb: 'migration show', oneLiner: 'Display migration package contents' },
  ]);
  addGlobalOptions(command)
    .option('--db <url>', 'Database connection string')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--space <id>', 'Narrow output to a single contract space')
    .option(
      '--to <contract>',
      'Target contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path)',
    )
    .option(
      '--from <contract>',
      'Origin contract reference; same grammar as --to. Supplying --from switches to offline path computation.',
    )
    .option('--legend', 'Print a key for the tree glyphs and lane colors')
    .option('--ascii', 'Use ASCII glyphs (pipe-friendly)')
    .action(async (options: MigrationStatusOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);

      const legendValidation = validateLegendOptions(options, flags);
      if (!legendValidation.ok) {
        process.exit(handleResult(legendValidation, flags, ui));
      }

      const result = await executeMigrationStatusCommand(options, flags, ui);

      const exitCode = handleResult(result, flags, ui, (statusResult) => {
        if (flags.json) {
          const jsonResult: MigrationStatusResult = {
            ok: true,
            spaces: [...statusResult.spaces],
            summary: statusResult.summary,
            diagnostics: [...statusResult.diagnostics],
          };
          ui.output(JSON.stringify(jsonResult, null, 2));
        } else if (!flags.quiet) {
          ui.output(formatStatusHumanOutput(statusResult, flags.color !== false));
        }
      });

      process.exit(exitCode);
    });

  return command;
}
