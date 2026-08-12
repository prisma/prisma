import { readFile } from 'node:fs/promises';
import { loadConfigForSections } from '@internal/config-loader';
import type { Contract } from '@internal/contract/types';
import { createControlStack } from '@internal/framework-components/control';
import type { RefEntry } from '@internal/migration-tools/refs';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { Command } from 'commander';
import { createControlClient } from '../control-api/client';
import { mapCaughtMigrationError } from '../control-api/operations/caught-errors';
import { mapContractAtError } from '../control-api/operations/contract-at-errors';
import {
  loadContractSpaceAggregateForCli,
  refuseContractSpaceIntegrity,
} from '../control-api/operations/contract-space-aggregate-loader';
import { refuseMarkerOutsideGraph } from '../control-api/operations/graph-queries';
import { refuseUnknownInvariants } from '../control-api/operations/invariants';
import {
  executeMigrateShowPlan,
  type MigrateShowMigration,
} from '../control-api/operations/migrate-show';
import { listRefsByContractHash } from '../control-api/operations/migration-list';
import { advanceRefSafely, readContractIR } from '../control-api/operations/ref-advancement';
import { resolveContractRef } from '../control-api/operations/ref-resolution';
import type {
  MigrateFailure,
  MigratePathDecision,
  PerSpaceExecutionEntry,
} from '../control-api/types';
import {
  type CliStructuredError as CliStructuredErrorType,
  errorContractValidationFailed,
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorFileNotFound,
  errorPathUnreachable,
  errorRunnerFailed,
  errorTargetMigrationNotSupported,
  errorUnexpected,
} from '../utils/cli-errors';
import {
  addGlobalOptions,
  closeQuietly,
  maskConnectionUrl,
  resolveContractPath,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
  targetSupportsMigrations,
} from '../utils/command-helpers';
import { toDeclaredExtensionsFromRaw } from '../utils/extension-pack-inputs';
import {
  computeLabelColumn,
  computeMaxDirNameWidth,
  renderMigrationGraphCommand,
} from '../utils/formatters/migration-graph-command-render';
import { buildGrid } from '../utils/formatters/migration-graph-grid-layout';
import {
  formatOnPathMigrationRow,
  type MigrationEdgeAnnotation,
} from '../utils/formatters/migration-graph-labels';
import { buildMigrationGraphRows } from '../utils/formatters/migration-graph-rows';
import {
  highlightFromEdgeAnnotations,
  indentMigrationGraphTreeBlock,
} from '../utils/formatters/migration-graph-space-render';
import { formatMigrationApplyCommandOutput } from '../utils/formatters/migrations';
import { formatStyledHeader } from '../utils/formatters/styled';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';

interface MigrateCommandOptions extends CommonCommandOptions {
  readonly db?: string;
  readonly config?: string;
  readonly to?: string;
  readonly advanceRef?: string;
  readonly show?: boolean;
  readonly from?: string;
}

/** Result returned by `migrate --show`. Read-only; no writes performed. */
export interface MigrateShowResult {
  readonly ok: true;
  readonly migrations: readonly MigrateShowMigration[];
  readonly summary: string;
  /**
   * Pre-rendered Tier-3 graph tree for human output. Off-path migrations render
   * dim; on-path migrations render in ordinary colours. Only present in human
   * (non-JSON) mode.
   */
  readonly graphOutput?: string;
  /**
   * Name column width for the "Will run, in order:" list — globally aligned with
   * every graph-tree section. Only present in human (non-JSON) mode.
   */
  readonly runListDirNameWidth?: number;
  /**
   * Left-pad offset (number of blank spaces) matching the graph's data-column
   * offset (`globalMaxEdgeTreePrefixWidth`). Used to align list rows with graph
   * rows so every `→` in the output (graph + list) lands at the same column.
   * Only present in human (non-JSON) mode when multiple spaces are rendered.
   */
  readonly runListLeftPad?: number;
}

export interface MigrateResult {
  readonly ok: boolean;
  readonly migrationsApplied: number;
  readonly migrationsTotal: number;
  readonly markerHash: string;
  readonly applied: readonly {
    readonly spaceId: string;
    readonly dirName: string;
    readonly migrationHash: string;
    readonly from: string;
    readonly to: string;
    readonly operationsExecuted: number;
  }[];
  readonly summary: string;
  readonly perSpace: readonly PerSpaceExecutionEntry[];
  readonly pathDecision?: MigratePathDecision;
  readonly timings: {
    readonly total: number;
  };
  readonly advancedRef?: { readonly name: string; readonly hash: string } | null;
}

/**
 * Read-only preview of the migration path `migrate` will take. Delegates the
 * path computation to {@link executeMigrateShowPlan} (the control-api core)
 * and keeps only the styled header plus the Tier-3 graph rendering here.
 */
async function executeMigrateShowCommand(
  options: MigrateCommandOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<MigrateShowResult, CliStructuredErrorType>> {
  // `--from <ref>` plans offline and never touches config.driver, so a broken
  // driver section must not fail the command. `--from @db` still resolves
  // against the live marker, so it does need one.
  const readsLiveMarker = options.from === undefined || options.from === '@db';
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    ...(readsLiveMarker ? (['driver'] as const) : []),
    'extensions',
    'db',
    'migrations',
    'contract',
  ]);
  if (!configResult.ok) {
    return configResult;
  }

  const planResult = await executeMigrateShowPlan({
    config: configResult.value,
    cwd: process.cwd(),
    ...ifDefined('configPath', options.config),
    ...ifDefined('db', options.db),
    ...ifDefined('to', options.to),
    ...ifDefined('from', options.from),
    onPreflightComplete: ({ configPath, migrationsRelative, dbConnection, hasExplicitFrom }) => {
      if (!flags.json && !flags.quiet) {
        const details: Array<{ label: string; value: string }> = [
          { label: 'config', value: configPath },
          { label: 'migrations', value: migrationsRelative },
        ];
        if (dbConnection && !hasExplicitFrom) {
          details.push({ label: 'database', value: maskConnectionUrl(String(dbConnection)) });
        }
        if (options.from) {
          details.push({ label: 'from', value: options.from });
        }
        if (options.to) {
          details.push({ label: 'to', value: options.to });
        }
        const header = formatStyledHeader({
          command: 'migrate --show',
          description: 'Preview the migration path migrate will take (read-only)',
          details,
          flags,
        });
        ui.stderr(header);
      }
    },
  });
  if (!planResult.ok) {
    return notOk(planResult.failure);
  }
  const plan = planResult.value;
  const { aggregate, contractHash } = plan;
  const orderedMigrations = plan.migrations;
  const allSpaces = [aggregate.app, ...aggregate.extensions];

  // Build the Tier-3 graph visualization (human mode only; skipped for --json).
  // Reuses the existing annotation hook — no parallel renderer.
  let graphOutput: string | undefined;
  let runListDirNameWidth: number | undefined;
  let runListLeftPad: number | undefined;
  if (!flags.json) {
    const onPathHashes = new Set(orderedMigrations.map((m) => m.migrationHash));
    const colorize = flags.color !== false;

    // Build layouts for all spaces first so we can compute global column widths
    // before rendering. This ensures the name column, hash column, and ops column
    // start at the same horizontal offset across every space section AND the
    // "Will run, in order:" list below.
    const spaceLayouts = allSpaces.map((space) => {
      const isApp = space.spaceId === aggregate.app.spaceId;
      const spaceGraph = space.graph();
      const rowModel = buildMigrationGraphRows(spaceGraph, isApp ? { contractHash } : {});
      const edgeAnnotations = new Map<string, MigrationEdgeAnnotation>();
      for (const edge of spaceGraph.migrationByHash.values()) {
        edgeAnnotations.set(edge.migrationHash, {
          pathHighlight: onPathHashes.has(edge.migrationHash) ? 'on-path' : 'off-path',
        });
      }
      // The on-path migration set lifts to focus mode so the chosen route draws
      // green/continuous; off-path lanes dim. Rows, gutter, and labels all come
      // from this one grid.
      const grid = buildGrid(rowModel, {}, highlightFromEdgeAnnotations(edgeAnnotations));
      return { space, isApp, spaceGraph, rowModel, grid, edgeAnnotations };
    });

    // Global max across all space grids so every section's labels share columns.
    const globalLabelColumn =
      spaceLayouts.length > 1
        ? Math.max(...spaceLayouts.map(({ grid }) => computeLabelColumn(grid, 'unicode')))
        : undefined;
    const globalMaxDirNameWidthFromLayouts =
      spaceLayouts.length > 1
        ? Math.max(...spaceLayouts.map(({ rowModel }) => computeMaxDirNameWidth(rowModel)))
        : undefined;
    // The run-list name column width must be at least as wide as the global tree dirName
    // width so that tree sections and the list align at the hash column.
    const runListMaxFromMigrations =
      orderedMigrations.length > 0
        ? Math.max(...orderedMigrations.map((m) => m.dirName.length))
        : 0;
    const globalMaxDirNameWidth =
      globalMaxDirNameWidthFromLayouts !== undefined
        ? Math.max(globalMaxDirNameWidthFromLayouts, runListMaxFromMigrations)
        : undefined;
    runListDirNameWidth = globalMaxDirNameWidth ?? runListMaxFromMigrations;
    runListLeftPad = globalLabelColumn;

    // Render each space section with globally computed widths.
    const showSpaceHeadings = allSpaces.length > 1;
    const sections: string[] = [];
    for (const { space, isApp, rowModel, grid, edgeAnnotations } of spaceLayouts) {
      const liveMarkerHash = plan.renderMarkerHashBySpace.get(space.spaceId)!;
      const tree = renderMigrationGraphCommand({
        grid,
        rowModel,
        contractHash,
        isAppSpace: isApp,
        ...(plan.usedLiveMarker ? { dbHash: liveMarkerHash } : {}),
        refsByHash: listRefsByContractHash(space),
        edgeAnnotationsByHash: edgeAnnotations,
        colorize,
        glyphMode: 'unicode',
        ...(globalLabelColumn !== undefined ? { globalLabelColumn } : {}),
        ...(globalMaxDirNameWidth !== undefined ? { globalMaxDirNameWidth } : {}),
      });
      if (tree.length === 0) continue;
      if (showSpaceHeadings) {
        sections.push(`${space.spaceId}:\n${indentMigrationGraphTreeBlock(tree, '  ')}`);
      } else {
        sections.push(tree);
      }
    }
    graphOutput = sections.join('\n\n');
  }

  return ok({
    ok: true,
    migrations: orderedMigrations,
    summary: plan.summary,
    ...(graphOutput !== undefined ? { graphOutput } : {}),
    ...(runListDirNameWidth !== undefined ? { runListDirNameWidth } : {}),
    ...(runListLeftPad !== undefined ? { runListLeftPad } : {}),
  });
}

function formatMigrateShowOutput(result: MigrateShowResult, flags: GlobalFlags): string {
  if (flags.quiet) return '';
  const colorize = flags.color !== false;
  const lines: string[] = [];
  // Graph tree first (shows the full topology with on-path highlighted).
  if (result.graphOutput !== undefined && result.graphOutput.length > 0) {
    lines.push(result.graphOutput);
    lines.push('');
  }
  const n = result.migrations.length;
  if (n > 0) {
    // Consolidated header: one line replaces the old separate summary + blank +
    // "Will run, in order:" header.
    lines.push(`The following ${n} migration${n === 1 ? '' : 's'} will run:`);
    // Ordered list rendered through the SAME on-path row renderer as the tree.
    // `formatOnPathMigrationRow` uses PATH_HIGHLIGHT_STYLES.onPath so the list and
    // graph-tree rows are styled identically — changing the on-path colour in future
    // is a one-line edit in PATH_HIGHLIGHT_STYLES.
    //
    // Alignment anchor: the `→` arrow (source-hash onward) must land at the SAME
    // absolute column as in graph edge rows, across every graph section and this list.
    //
    // Multi-space output layout (space headings + 2-space indented tree sections):
    //   Graph edge row:  [2 heading][G gutter][D dirName][7 source] [→] [dest]
    //   List row:        [2 spaces][L dirName][  ][7 source] [→] [dest]
    //   Alignment:  2 + G + D + 9 = 2 + L + 2 + 9   =>   L = G + D - 2
    //
    // Single-space output layout (flat tree, no heading indent):
    //   Graph edge row:  [G gutter][D dirName][7 source] [→] [dest]
    //   List row:        [2 spaces][L dirName][  ][7 source] [→] [dest]
    //   Alignment:  G + D + 9 = 2 + L + 2 + 9   =>   L = G + D - 4
    //
    // D (edgeDirNameWidth) = max(rawDirNameWidth + LABEL_GAP, MIN_HASH_DATA_COLUMN - G)
    // where LABEL_GAP = 2 and MIN_HASH_DATA_COLUMN = 25 (same constants as the renderer).
    //
    // runListLeftPad is set only for multi-space; undefined means single-space.
    const isMultiSpace = result.runListLeftPad !== undefined;
    const gutter = result.runListLeftPad ?? 0;
    const rawDirNameWidth =
      result.runListDirNameWidth ?? Math.max(...result.migrations.map((m) => m.dirName.length));
    const edgeDirNameWidth = Math.max(rawDirNameWidth + 2, 25 - gutter);
    const listDirNameWidth = gutter + edgeDirNameWidth - (isMultiSpace ? 2 : 4);
    for (const m of result.migrations) {
      lines.push(
        `  ${formatOnPathMigrationRow(m.dirName, m.from, m.to, listDirNameWidth, colorize, 'unicode')}`,
      );
    }
  } else {
    lines.push(result.summary);
  }
  return lines.join('\n');
}

function mapApplyFailure(failure: MigrateFailure): CliStructuredErrorType {
  if (failure.code === 'MIGRATION_PATH_NOT_FOUND') {
    return errorPathUnreachable(failure);
  }
  return errorRunnerFailed(failure.summary, {
    why: failure.why ?? 'Migration runner failed',
    fix: 'Fix the issue and re-run `prisma-next migrate --to <contract>` — previously applied migrations are preserved.',
    meta: failure.meta ?? {},
    ...ifDefined('cause', failure.cause),
  });
}

async function executeMigrateCommand(
  options: MigrateCommandOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  startTime: number,
): Promise<Result<MigrateResult, CliStructuredErrorType>> {
  const configResult = await loadConfigForSections(options.config, [
    'family',
    'target',
    'adapter',
    'driver',
    'extensions',
    'db',
    'migrations',
    'contract',
  ]);
  if (!configResult.ok) {
    return configResult;
  }
  const config = configResult.value;
  const { configPath, migrationsDir, appMigrationsRelative, refsDir } = resolveMigrationPaths(
    options.config,
    config,
    process.cwd(),
  );

  const dbConnection = options.db ?? config.db?.connection;
  if (!dbConnection) {
    return notOk(
      errorDatabaseConnectionRequired({
        why: `Database connection is required for migrate (set db.connection in ${configPath}, or pass --db <url>)`,
        commandName: 'migrate',
      }),
    );
  }

  if (!config.driver) {
    return notOk(
      errorDriverRequired({
        why: 'Config.driver is required for migrate',
      }),
    );
  }

  if (!targetSupportsMigrations(config.target)) {
    return notOk(
      errorTargetMigrationNotSupported({
        why: `Target "${config.target.id}" does not support migrations`,
      }),
    );
  }

  const toArg = options.to;

  // Construct the family instance up-front so the on-disk contract read
  // crosses the serializer seam (`familyInstance.deserializeContract`) at
  // the read site. The downstream `client.migrate({ contract })`
  // re-validates internally (no harm — validation is idempotent), but
  // closing the gap at the read site is what makes the cast-pattern
  // lint enforceable and matches the other CLI commands. See TML-2536.
  const stack = createControlStack(config);
  const familyInstance = config.family.create(stack);

  const contractPathAbsolute = resolveContractPath(config);
  let contractRaw: Contract;
  let contractContent: string;
  try {
    contractContent = await readFile(contractPathAbsolute, 'utf-8');
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'ENOENT') {
      return notOk(
        errorFileNotFound(contractPathAbsolute, {
          why: `Contract file not found at ${contractPathAbsolute}`,
          fix: 'Run `prisma-next contract emit` to generate a valid contract.json, then retry.',
        }),
      );
    }
    return notOk(
      errorContractValidationFailed(
        `Failed to read contract file: ${error instanceof Error ? error.message : String(error)}`,
        { where: { path: contractPathAbsolute } },
      ),
    );
  }
  try {
    contractRaw = familyInstance.deserializeContract(JSON.parse(contractContent) as unknown);
  } catch (error) {
    return notOk(
      errorContractValidationFailed(
        `Contract at ${contractPathAbsolute} failed to deserialize: ${error instanceof Error ? error.message : String(error)}`,
        { where: { path: contractPathAbsolute } },
      ),
    );
  }

  const loadedAggregate = await loadContractSpaceAggregateForCli({
    targetId: config.target.targetId,
    migrationsDir,
    appContract: contractRaw,
    extensions: config.extensions ?? [],
    deserializeContract: (json) => familyInstance.deserializeContract(json),
  });
  if (!loadedAggregate.ok) {
    return notOk(loadedAggregate.failure);
  }
  const aggregate = loadedAggregate.value;
  const integrityFailure = refuseContractSpaceIntegrity(aggregate, {
    declaredExtensions: toDeclaredExtensionsFromRaw(
      (config.extensions ?? []) as ReadonlyArray<unknown>,
    ),
    checkContracts: true,
  });
  if (integrityFailure) {
    return notOk(integrityFailure);
  }

  let refEntry: RefEntry | undefined;
  let refName: string | undefined;
  if (toArg) {
    const refs = aggregate.app.refs;
    const refResult = resolveContractRef(toArg, { graph: aggregate.app.graph(), refs });
    if (!refResult.ok) {
      return notOk(refResult.failure);
    }
    if (refResult.value.provenance.kind === 'ref') {
      refName = refResult.value.provenance.refName;
      const resolved = refs[refName];
      if (resolved) refEntry = resolved;
    } else {
      refEntry = { hash: refResult.value.hash, invariants: [] };
    }
  }

  if (!flags.json && !flags.quiet) {
    const details: Array<{ label: string; value: string }> = [
      { label: 'config', value: configPath },
      { label: 'migrations', value: appMigrationsRelative },
    ];
    if (typeof dbConnection === 'string') {
      details.push({
        label: 'database',
        value: maskConnectionUrl(dbConnection),
      });
    }
    if (toArg) {
      details.push({ label: 'to', value: toArg });
    }
    const header = formatStyledHeader({
      command: 'migrate',
      description: 'Apply planned migrations to advance the database',
      url: 'https://pris.ly/migrate',
      details,
      flags,
    });
    ui.stderr(header);
  }

  const appGraph = aggregate.app.graph();

  const client = createControlClient({
    family: config.family,
    target: config.target,
    adapter: config.adapter,
    driver: config.driver,
    extensions: config.extensions ?? [],
  });

  try {
    await client.connect(dbConnection);

    const allMarkers = await client.readAllMarkers();
    const appMarker = allMarkers.get('app') ?? null;

    if (appMarker !== null) {
      const markerRefusal = refuseMarkerOutsideGraph({
        markerHash: appMarker.storageHash,
        graph: appGraph,
      });
      if (markerRefusal) {
        return notOk(markerRefusal);
      }
    }

    if (refEntry && refEntry.invariants.length > 0) {
      const invariantRefusal = refuseUnknownInvariants({
        graph: appGraph,
        markerInvariants: appMarker?.invariants ?? [],
        refInvariants: refEntry.invariants,
        ...ifDefined('refName', toArg),
      });
      if (invariantRefusal) {
        return notOk(invariantRefusal);
      }
    }

    if (!flags.quiet && !flags.json) {
      ui.step('Loading contract spaces…');
    }

    // When `--to` resolves to an on-disk graph node with a matching bundle,
    // verify and apply against THAT bundle's destination contract via
    // `contractAt` — not the emitted `contract.json`. With `--to` omitted,
    // or a target with no matching bundle, the emitted contract stays the
    // apply contract (the only migrate-specific default). The same
    // `contractAt` artifacts feed the optional ref-advancement snapshot.
    let applyContract: Contract = contractRaw;
    let snapshotContractJson: Record<string, unknown> = JSON.parse(contractContent);
    let snapshotContractDts: string | undefined;
    if (toArg && refEntry) {
      const targetHash = refEntry.hash;
      const matchingBundle = aggregate.app.packages.find((p) => p.metadata.to === targetHash);
      if (matchingBundle) {
        try {
          const at = await aggregate.app.contractAt(
            targetHash,
            refName !== undefined ? { refName } : undefined,
          );
          applyContract = at.contract;
          snapshotContractJson = at.contractJson as Record<string, unknown>;
          snapshotContractDts = at.contractDts;
        } catch (error) {
          return mapContractAtError(error, { artifactRole: 'to' });
        }
      }
    }

    const applyResult = await client.migrate({
      contract: applyContract,
      migrationsDir,
      ...ifDefined('refHash', refEntry?.hash),
      ...(refEntry?.invariants ? { refInvariants: refEntry.invariants } : {}),
      ...(refEntry !== undefined ? ifDefined('refName', toArg) : {}),
    });

    if (!applyResult.ok) {
      return notOk(mapApplyFailure(applyResult.failure));
    }

    const { value } = applyResult;

    let advancedRef: { name: string; hash: string } | null = null;
    if (options.advanceRef !== undefined) {
      const contractIR =
        snapshotContractDts !== undefined
          ? { contract: snapshotContractJson, contractDts: snapshotContractDts }
          : await readContractIR(snapshotContractJson, contractPathAbsolute);
      const advanced = await advanceRefSafely({
        refsDir,
        migrationsDir,
        name: options.advanceRef,
        hash: value.markerHash,
        contractIR,
      });
      if (!advanced.ok) {
        return notOk(advanced.failure);
      }
      advancedRef = { name: advanced.value.name, hash: advanced.value.hash };
    }

    return ok({
      ok: true,
      migrationsApplied: value.migrationsApplied,
      migrationsTotal: value.perSpace.length,
      markerHash: value.markerHash,
      applied: value.applied,
      summary: value.summary,
      perSpace: value.perSpace,
      ...ifDefined('pathDecision', value.pathDecision),
      timings: { total: Date.now() - startTime },
      advancedRef,
    });
  } catch (error) {
    const mapped = mapCaughtMigrationError(error);
    if (mapped) {
      return notOk(mapped);
    }
    return notOk(
      errorUnexpected(error instanceof Error ? error.message : String(error), {
        why: `Unexpected error during migrate: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  } finally {
    await closeQuietly(client);
  }
}

export function createMigrateCommand(): Command {
  const command = new Command('migrate');
  setCommandDescriptions(
    command,
    'Apply planned migrations to advance the database',
    'Walks every contract space (app + extensions) and applies pending\n' +
      'on-disk migrations in canonical order (extensions alphabetically,\n' +
      'then app). Graph-walks the on-disk migration graph for every space.\n' +
      'Use --to to target a specific contract (hash, ref name, migration dir).\n' +
      'Use --show for a read-only preview of the path that would run.',
  );
  setCommandExamples(command, [
    'prisma-next migrate --db $DATABASE_URL',
    'prisma-next migrate --to production --db $DATABASE_URL',
    'prisma-next migrate --to abc123 --db $DATABASE_URL',
    'prisma-next migrate --show --db $DATABASE_URL',
    'prisma-next migrate --show --from @contract --to production',
  ]);
  addGlobalOptions(command)
    .option('--db <url>', 'Database connection string')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option(
      '--to <contract>',
      'Target contract reference (hash, prefix, ref name, migration dir name, <dir>^, or ./path)',
    )
    .option('--advance-ref <name>', 'Advance the named ref to the post-apply marker after success')
    .option('--show', 'Preview the migration path without applying (read-only)')
    .option(
      '--from <contract>',
      'From-state for --show preview (@contract, @db, hash, ref name, or migration dir)',
    )
    .action(async (options: MigrateCommandOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const startTime = Date.now();

      const ui = createTerminalUI(flags);

      if (options.show) {
        // Read-only path: compute the migration plan and print the ordered list.
        // NEVER reaches runMigration() or any write boundary.
        const result = await executeMigrateShowCommand(options, flags, ui);

        const exitCode = handleResult(result, flags, ui, (showResult) => {
          if (flags.json) {
            ui.output(JSON.stringify(showResult, null, 2));
          } else {
            // Print directly to stdout — not via ui.log() which injects Clack's │ gutter.
            ui.output(formatMigrateShowOutput(showResult, flags));
          }
        });

        process.exit(exitCode);
        return;
      }

      const result = await executeMigrateCommand(options, flags, ui, startTime);

      const exitCode = handleResult(result, flags, ui, (migrateResult) => {
        if (flags.json) {
          ui.output(JSON.stringify(migrateResult, null, 2));
        } else if (!flags.quiet) {
          ui.log(formatMigrationApplyCommandOutput(migrateResult, flags));
        }
      });

      process.exit(exitCode);
    });

  return command;
}
