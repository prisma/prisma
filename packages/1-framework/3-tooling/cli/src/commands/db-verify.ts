import { readFile } from 'node:fs/promises';
import { loadConfigForSections, type PrismaNextConfig } from '@internal/config-loader';
import type { Contract } from '@internal/contract/types';
import type { VerifyDatabaseResult } from '@internal/framework-components/control';
import {
  createControlStack,
  VERIFY_CODE_HASH_MISMATCH,
  VERIFY_CODE_MARKER_MISSING,
  VERIFY_CODE_TARGET_MISMATCH,
} from '@internal/framework-components/control';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { isStructuredError } from '@internal/utils/structured-error';
import { Command } from 'commander';
import { relative, resolve } from 'pathe';
import { createControlClient } from '../control-api/client';
import {
  CliStructuredError,
  errorContractValidationFailed,
  errorDatabaseConnectionRequired,
  errorDriverRequired,
  errorFileNotFound,
  errorHashMismatch,
  errorMarkerMissing,
  errorRuntime,
  errorTargetMismatch,
  errorUnexpected,
} from '../utils/cli-errors';
import { type CombinedVerifyResult, combineVerifyResults } from '../utils/combine-verify-results';
import {
  addGlobalOptions,
  closeQuietly,
  maskConnectionUrl,
  resolveContractPath,
  resolveMigrationPaths,
  setCommandDescriptions,
  setCommandExamples,
} from '../utils/command-helpers';
import { formatStyledHeader } from '../utils/formatters/styled';
import {
  type DbVerifyCommandSuccessResult,
  formatSchemaVerifyJson,
  formatSchemaVerifyOutput,
  formatVerifyJson,
  formatVerifyOutput,
} from '../utils/formatters/verify';
import type { CommonCommandOptions } from '../utils/global-flags';
import { type GlobalFlags, parseGlobalFlagsOrExit } from '../utils/global-flags';
import { createProgressAdapter } from '../utils/progress-adapter';
import { handleResult } from '../utils/result-handler';
import { createTerminalUI, type TerminalUI } from '../utils/terminal-ui';

interface DbVerifyOptions extends CommonCommandOptions {
  readonly db?: string;
  readonly config?: string;
  readonly markerOnly?: boolean;
  readonly schemaOnly?: boolean;
  readonly strict?: boolean;
}

type DbVerifyMode = 'full' | 'marker-only' | 'schema-only';

/**
 * Maps a VerifyDatabaseResult failure to a CliStructuredError.
 */
function mapVerifyFailure(verifyResult: VerifyDatabaseResult): CliStructuredError {
  if (!verifyResult.ok && verifyResult.code) {
    if (verifyResult.code === VERIFY_CODE_MARKER_MISSING) {
      return errorMarkerMissing();
    }
    if (verifyResult.code === VERIFY_CODE_HASH_MISMATCH) {
      const storageMatch = verifyResult.marker?.storageHash === verifyResult.contract.storageHash;
      const profileMatch =
        !verifyResult.contract.profileHash ||
        verifyResult.marker?.profileHash === verifyResult.contract.profileHash;

      if (!storageMatch) {
        return errorHashMismatch({
          why: 'Contract storageHash does not match database marker',
          expected: verifyResult.contract.storageHash,
          ...ifDefined('actual', verifyResult.marker?.storageHash),
        });
      }

      return errorHashMismatch({
        why: profileMatch
          ? 'Contract hash does not match database marker'
          : 'Contract profileHash does not match database marker',
        ...ifDefined('expected', verifyResult.contract.profileHash),
        ...ifDefined('actual', verifyResult.marker?.profileHash),
      });
    }
    if (verifyResult.code === VERIFY_CODE_TARGET_MISMATCH) {
      return errorTargetMismatch(
        verifyResult.target.expected,
        verifyResult.target.actual ?? 'unknown',
      );
    }
    // Unknown code - fall through to runtime error
  }
  return errorRuntime('CONTRACT.VERIFY_FAILED', verifyResult.summary, {
    why: 'Verification failed',
    fix: 'Check contract and database state',
  });
}

type DbVerifyFailure = CliStructuredError | CombinedVerifyResult;

function errorInvalidVerifyMode(options: {
  readonly why: string;
  readonly fix: string;
}): CliStructuredError {
  return new CliStructuredError('CLI.INVALID_VERIFY_MODE', 'Invalid verify mode', {
    why: options.why,
    fix: options.fix,
    docsUrl: 'https://pris.ly/db-verify',
  });
}

function resolveDbVerifyMode(options: DbVerifyOptions): Result<DbVerifyMode, CliStructuredError> {
  if (options.markerOnly && options.schemaOnly) {
    return notOk(
      errorInvalidVerifyMode({
        why: '`--marker-only` and `--schema-only` cannot be used together',
        fix: 'Choose one mode: omit both to check the marker and schema, use `--marker-only` to check only the marker, or use `--schema-only` to check only the live schema.',
      }),
    );
  }

  if (options.markerOnly && options.strict) {
    return notOk(
      errorInvalidVerifyMode({
        why: '`--strict` requires schema verification, but `--marker-only` skips it',
        fix: 'Remove `--strict`, or use `db verify` / `db verify --schema-only` when you want to check the live schema in strict mode.',
      }),
    );
  }

  if (options.schemaOnly) {
    return ok('schema-only');
  }

  if (options.markerOnly) {
    return ok('marker-only');
  }

  return ok('full');
}

function formatDbVerifyModeLabel(mode: DbVerifyMode, strict: boolean): string {
  if (mode === 'marker-only') {
    return 'marker only';
  }

  if (mode === 'schema-only') {
    return `schema only (${strict ? 'strict' : 'tolerant'})`;
  }

  return `full (marker + schema, ${strict ? 'strict' : 'tolerant'})`;
}

function formatDbVerifyInvocation(mode: DbVerifyMode, strict: boolean): string {
  const args = ['db verify'];

  if (mode === 'marker-only') {
    args.push('--marker-only');
  }

  if (mode === 'schema-only') {
    args.push('--schema-only');
  }

  if (strict) {
    args.push('--strict');
  }

  return args.join(' ');
}

function createDbVerifyConnectionRequiredError(options: {
  readonly configPath: string;
  readonly mode: DbVerifyMode;
  readonly strict: boolean;
}): CliStructuredError {
  const invocation = formatDbVerifyInvocation(options.mode, options.strict);
  return errorDatabaseConnectionRequired({
    why: `Database connection is required for ${invocation} (set db.connection in ${options.configPath}, or pass --db <url>)`,
    retryCommand: `prisma-next ${invocation} --db <url>`,
  });
}

function renderVerifyHeader(
  paths: { configPath: string; contractPath: string },
  options: DbVerifyOptions,
  mode: DbVerifyMode,
  flags: GlobalFlags,
  ui: TerminalUI,
): void {
  if (flags.json || flags.quiet) return;

  const description =
    mode === 'schema-only'
      ? 'Check whether the live database schema matches your contract'
      : mode === 'marker-only'
        ? 'Check whether the database marker matches your contract'
        : 'Check whether the database marker and live schema match your contract';

  const details: Array<{ label: string; value: string }> = [
    { label: 'config', value: paths.configPath },
    { label: 'contract', value: paths.contractPath },
    { label: 'mode', value: formatDbVerifyModeLabel(mode, options.strict ?? false) },
  ];
  if (options.db) {
    details.push({ label: 'database', value: maskConnectionUrl(options.db) });
  }

  ui.stderr(
    formatStyledHeader({
      command: 'db verify',
      description,
      url: 'https://pris.ly/db-verify',
      details,
      flags,
    }),
  );
}

async function resolveVerifyPaths(
  options: DbVerifyOptions,
): Promise<Result<VerifyPaths, CliStructuredError>> {
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
  const configPath = options.config
    ? relative(process.cwd(), resolve(options.config))
    : 'prisma-next.config.ts';
  const contractPathAbsolute = resolveContractPath(config);
  const contractPath = relative(process.cwd(), contractPathAbsolute);
  return ok({ config, configPath, contractPathAbsolute, contractPath });
}

interface VerifyPaths {
  readonly config: PrismaNextConfig;
  readonly configPath: string;
  readonly contractPathAbsolute: string;
  readonly contractPath: string;
}

interface VerifySetup extends VerifyPaths {
  readonly contractJson: Contract;
  readonly dbConnection: string;
}

async function resolveVerifySetup(
  paths: VerifyPaths,
  options: DbVerifyOptions,
  mode: DbVerifyMode,
): Promise<Result<VerifySetup, CliStructuredError>> {
  const { config, configPath, contractPathAbsolute, contractPath } = paths;

  let contractJsonContent: string;
  try {
    contractJsonContent = await readFile(contractPathAbsolute, 'utf-8');
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'ENOENT') {
      return notOk(
        errorFileNotFound(contractPathAbsolute, {
          why: `Contract file not found at ${contractPathAbsolute}`,
          fix: `Run \`prisma-next contract emit\` to generate ${contractPath}, or update \`config.contract.output\` in ${configPath}`,
        }),
      );
    }
    return notOk(
      errorUnexpected(error instanceof Error ? error.message : String(error), {
        why: `Failed to read contract file: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  }

  // Cross the family `deserializeContract` seam at the read site, just
  // like every other CLI on-disk read (TML-2536). The downstream
  // `dbVerify` op accepts the hydrated `Contract` directly and no
  // longer re-deserializes.
  const stack = createControlStack(config);
  const familyInstance = config.family.create(stack);

  let contractJson: Contract;
  try {
    contractJson = familyInstance.deserializeContract(JSON.parse(contractJsonContent) as unknown);
  } catch (error) {
    if (isStructuredError(error) && error.code === 'CONTRACT.VALIDATION_FAILED') {
      return notOk(
        errorContractValidationFailed(`Contract validation failed: ${error.message}`, {
          where: { path: contractPathAbsolute },
        }),
      );
    }
    return notOk(
      errorContractValidationFailed(
        `Contract JSON is invalid: ${error instanceof Error ? error.message : String(error)}`,
        { where: { path: contractPathAbsolute } },
      ),
    );
  }

  const dbConnection = options.db ?? config.db?.connection;
  if (typeof dbConnection !== 'string' || dbConnection.length === 0) {
    return notOk(
      createDbVerifyConnectionRequiredError({
        configPath,
        mode,
        strict: options.strict ?? false,
      }),
    );
  }

  if (!config.driver) {
    return notOk(
      errorDriverRequired({
        why: `Config.driver is required for ${formatDbVerifyInvocation(mode, options.strict ?? false)}`,
      }),
    );
  }

  return ok({ ...paths, contractJson, dbConnection });
}

function createVerifyClient(setup: VerifySetup) {
  return createControlClient({
    family: setup.config.family,
    target: setup.config.target,
    adapter: setup.config.adapter,
    driver: setup.config.driver!,
    extensions: setup.config.extensions ?? [],
  });
}

function wrapVerifyError(
  error: unknown,
  contractPathAbsolute: string,
  modeLabel: string,
): Result<never, CliStructuredError> {
  if (CliStructuredError.is(error)) {
    return notOk(error);
  }
  if (isStructuredError(error) && error.code === 'CONTRACT.VALIDATION_FAILED') {
    return notOk(
      errorContractValidationFailed(`Contract validation failed: ${error.message}`, {
        where: { path: contractPathAbsolute },
      }),
    );
  }
  return notOk(
    errorUnexpected(error instanceof Error ? error.message : String(error), {
      why: `Unexpected error during ${modeLabel}: ${error instanceof Error ? error.message : String(error)}`,
    }),
  );
}

/**
 * Executes the db verify command and returns a structured Result.
 */
async function executeDbVerifyCommand(
  options: DbVerifyOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
  mode: Extract<DbVerifyMode, 'full' | 'marker-only'>,
): Promise<Result<DbVerifyCommandSuccessResult, DbVerifyFailure>> {
  const startTime = Date.now();
  const pathsResult = await resolveVerifyPaths(options);
  if (!pathsResult.ok) return pathsResult;
  const paths = pathsResult.value;
  renderVerifyHeader(paths, options, mode, flags, ui);

  const setupResult = await resolveVerifySetup(paths, options, mode);
  if (!setupResult.ok) return setupResult;
  const { contractJson, dbConnection, contractPathAbsolute } = setupResult.value;
  const { migrationsDir } = resolveMigrationPaths(
    options.config,
    setupResult.value.config,
    process.cwd(),
  );

  const client = createVerifyClient(setupResult.value);
  const onProgress = createProgressAdapter({ ui, flags });

  try {
    // Single-contract marker verification preserved for the existing
    // marker / target / hash failure surface (`CONTRACT.MARKER_MISSING/CONTRACT.MARKER_MISMATCH/CONTRACT.TARGET_MISMATCH`).
    // The aggregate verifier (run below for the per-space marker /
    // schema checks) does not duplicate this: it concerns itself with
    // marker-vs-on-disk and orphan-marker drift, not the
    // hash-mismatch-against-the-app-contract lane that today's
    // `client.verify` covers.
    const verifyResult = await client.verify({
      contract: contractJson,
      connection: dbConnection,
      onProgress,
    });

    if (!verifyResult.ok) {
      return notOk(mapVerifyFailure(verifyResult));
    }

    // Aggregate verifier (loader → verifier pipeline). Runs the layout
    // precheck, marker-aware per-space verifier, and (full mode only)
    // per-space pre-projected schema verification (closes F23).
    const aggregateResult = await client.dbVerify({
      contract: contractJson,
      migrationsDir,
      strict: options.strict ?? false,
      skipSchema: mode === 'marker-only',
      skipMarker: false,
      onProgress,
    });
    if (!aggregateResult.ok) return notOk(aggregateResult.failure);
    // The legacy shell keeps rendering marker drift as the violation
    // envelope; the orm bin settles it as a finding at exit 4.
    if (aggregateResult.value.markerDrift !== null) {
      return notOk(aggregateResult.value.markerDrift);
    }

    if (mode === 'marker-only') {
      return ok({
        ok: true,
        mode: 'marker-only',
        summary: 'Database marker matches contract',
        contract: verifyResult.contract,
        marker: verifyResult.marker,
        target: verifyResult.target,
        ...ifDefined('missingCodecs', verifyResult.missingCodecs),
        ...ifDefined('codecCoverageSkipped', verifyResult.codecCoverageSkipped),
        warning: 'Schema verification skipped because --marker-only was provided',
        meta: {
          ...(verifyResult.meta ?? {}),
          schemaVerification: 'skipped',
        },
        timings: { total: Date.now() - startTime },
      });
    }

    const combined = combineVerifyResults(
      aggregateResult.value.schemaResults,
      aggregateResult.value.appSpaceId,
      options.strict ?? false,
      aggregateResult.value.unclaimed,
    );
    if (!combined.result.ok) {
      return notOk(combined);
    }

    return ok({
      ok: true,
      mode: 'full',
      summary: 'Database marker and schema match contract',
      contract: verifyResult.contract,
      marker: verifyResult.marker,
      target: verifyResult.target,
      ...ifDefined('missingCodecs', verifyResult.missingCodecs),
      ...ifDefined('codecCoverageSkipped', verifyResult.codecCoverageSkipped),
      schema: {
        summary: combined.result.summary,
        strict: combined.result.meta?.strict ?? false,
        warnings: (combined.result.schema.warnings?.issues ?? []).map((issue) =>
          issue.path.join('/'),
        ),
      },
      unclaimed: combined.unclaimed,
      meta: {
        ...(verifyResult.meta ?? {}),
        schemaVerification: 'performed',
      },
      timings: { total: Date.now() - startTime },
    });
  } catch (error) {
    return wrapVerifyError(error, contractPathAbsolute, 'db verify');
  } finally {
    await closeQuietly(client);
  }
}

async function executeDbSchemaOnlyVerifyCommand(
  options: DbVerifyOptions,
  flags: GlobalFlags,
  ui: TerminalUI,
): Promise<Result<CombinedVerifyResult, CliStructuredError>> {
  const pathsResult = await resolveVerifyPaths(options);
  if (!pathsResult.ok) return pathsResult;
  const paths = pathsResult.value;
  renderVerifyHeader(paths, options, 'schema-only', flags, ui);

  const setupResult = await resolveVerifySetup(paths, options, 'schema-only');
  if (!setupResult.ok) return setupResult;
  const { contractJson, dbConnection, contractPathAbsolute } = setupResult.value;
  const { migrationsDir } = resolveMigrationPaths(
    options.config,
    setupResult.value.config,
    process.cwd(),
  );

  const client = createVerifyClient(setupResult.value);
  const onProgress = createProgressAdapter({ ui, flags });

  try {
    await client.connect(dbConnection);
    const aggregateResult = await client.dbVerify({
      contract: contractJson,
      migrationsDir,
      strict: options.strict ?? false,
      skipSchema: false,
      skipMarker: true,
      onProgress,
    });
    if (!aggregateResult.ok) return notOk(aggregateResult.failure);

    return ok(
      combineVerifyResults(
        aggregateResult.value.schemaResults,
        aggregateResult.value.appSpaceId,
        options.strict ?? false,
        aggregateResult.value.unclaimed,
      ),
    );
  } catch (error) {
    return wrapVerifyError(error, contractPathAbsolute, 'db verify --schema-only');
  } finally {
    await closeQuietly(client);
  }
}

export function createDbVerifyCommand(): Command {
  const command = new Command('verify');
  setCommandDescriptions(
    command,
    'Check whether the database marker and live schema match your contract',
    'Verifies the database marker first, then checks the database schema matches your contract.\n' +
      'Use `--marker-only` for marker-only verification, `--schema-only` to skip marker checks and\n' +
      'inspect only the live schema, and `--strict` to fail if the database includes elements\n' +
      'not present in the contract.',
  );
  setCommandExamples(command, [
    'prisma-next db verify --db $DATABASE_URL',
    'prisma-next db verify --db $DATABASE_URL --strict',
    'prisma-next db verify --db $DATABASE_URL --schema-only',
    'prisma-next db verify --db $DATABASE_URL --schema-only --strict',
    'prisma-next db verify --db $DATABASE_URL --marker-only',
    'prisma-next db verify --db $DATABASE_URL --json',
  ]);
  addGlobalOptions(command)
    .option('--db <url>', 'Database connection string')
    .option('--config <path>', 'Path to prisma-next.config.ts')
    .option('--marker-only', 'Skip schema verification and only check the database marker')
    .option(
      '--schema-only',
      'Skip marker verification and only check whether the live schema satisfies the contract',
    )
    .option(
      '--strict',
      'Strict mode: schema elements not present in the contract are considered an error',
      false,
    )
    .action(async (options: DbVerifyOptions) => {
      const flags = parseGlobalFlagsOrExit(options);
      const ui = createTerminalUI(flags);

      const modeResult = resolveDbVerifyMode(options);
      if (!modeResult.ok) {
        const exitCode = handleResult(modeResult as Result<never, CliStructuredError>, flags, ui);
        process.exit(exitCode);
      }

      const mode = modeResult.value;

      if (mode === 'schema-only') {
        const result = await executeDbSchemaOnlyVerifyCommand(options, flags, ui);
        const exitCode = handleResult(result, flags, ui, (combined) => {
          if (flags.json) {
            ui.output(formatSchemaVerifyJson(combined.result, combined.unclaimed));
          } else {
            // Always show schema-drift failures, even in quiet mode — exiting 1
            // without diagnostics is unhelpful (same policy as the full-mode
            // failure branch below).
            const renderFlags = combined.result.ok ? flags : { ...flags, quiet: false };
            const output = formatSchemaVerifyOutput(
              combined.result,
              renderFlags,
              combined.unclaimed,
            );
            if (output) {
              ui.log(output);
            }
          }
        });

        if (result.ok && !result.value.result.ok) {
          process.exit(1);
        }

        process.exit(exitCode);
      }

      const result = await executeDbVerifyCommand(options, flags, ui, mode);

      if (result.ok) {
        if (flags.json) {
          ui.output(formatVerifyJson(result.value));
        } else {
          const output = formatVerifyOutput(result.value, flags);
          if (output) {
            ui.log(output);
          }
        }
        process.exit(0);
      }

      if (CliStructuredError.is(result.failure)) {
        const exitCode = handleResult(result as Result<never, CliStructuredError>, flags, ui);
        process.exit(exitCode);
      }

      if (flags.json) {
        ui.output(formatSchemaVerifyJson(result.failure.result, result.failure.unclaimed));
      } else {
        // Always show schema-drift failures, even in quiet mode — exiting 1 without
        // diagnostics is unhelpful.
        const output = formatSchemaVerifyOutput(
          result.failure.result,
          { ...flags, quiet: false },
          result.failure.unclaimed,
        );
        if (output) {
          ui.log(output);
        }
      }
      process.exit(1);
    });

  return command;
}
