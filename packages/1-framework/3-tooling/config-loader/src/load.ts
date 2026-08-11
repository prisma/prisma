import { access } from 'node:fs/promises';
import {
  hasCurrentConfigFormatVersion,
  type PrismaNextConfig,
} from '@internal/config/config-types';
import type { ConfigSection } from '@internal/config/config-validation';
import { collectConfigIssues } from '@internal/config/config-validation';
import { getEmittedArtifactPaths } from '@internal/emitter';
import {
  CliStructuredError,
  errorConfigEvaluationFailed,
  errorConfigFileNotFound,
  errorConfigValidation,
  errorConfigVersionMarkerMissing,
} from '@internal/errors/control';
import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { notOk, ok, type Result } from '@internal/utils/result';
import { isStructuredError } from '@internal/utils/structured-error';
import { dirname, join, resolve } from 'pathe';
import { finalizeContractConfig } from './finalize-config';

const CONFIG_FILENAME = 'prisma-next.config.ts';

export type { ConfigSection };

/**
 * A successfully evaluated config plus the structural diagnostics found in it.
 * Diagnostics are tagged with the config section they concern
 * (`meta.section`); sections without diagnostics are safe to read. Callers
 * must guard access through {@link requireConfigSections} — a section with a
 * diagnostic may be missing or malformed despite the `PrismaNextConfig` type.
 */
export interface LoadedConfig {
  readonly config: PrismaNextConfig;
  readonly diagnostics: readonly CliStructuredError[];
}

export async function findNearestConfigPathForFile(filePath: string): Promise<string | undefined> {
  let current = dirname(resolve(process.cwd(), filePath));

  while (true) {
    const candidate = join(current, CONFIG_FILENAME);
    if (await fileExists(candidate)) {
      return candidate;
    }
    const parent = dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function collectArtifactCollisionDiagnostics(
  contract: NonNullable<PrismaNextConfig['contract']>,
): CliStructuredError[] {
  const inputs = contract.source.inputs;
  const output = contract.output;
  if (inputs === undefined || output === undefined) {
    return [];
  }

  let emittedArtifactPaths: ReturnType<typeof getEmittedArtifactPaths>;
  try {
    emittedArtifactPaths = getEmittedArtifactPaths(output);
  } catch (error) {
    return [
      errorConfigValidation('contract.output', {
        /* v8 ignore next -- getEmittedArtifactPaths only ever throws an Error */
        why: error instanceof Error ? error.message : String(error),
        section: 'contract',
      }),
    ];
  }

  const emittedPaths = new Set([emittedArtifactPaths.jsonPath, emittedArtifactPaths.dtsPath]);
  if (inputs.some((input) => emittedPaths.has(input))) {
    return [
      errorConfigValidation('contract.source.inputs[]', {
        why: 'Config.contract.source.inputs must not include emitted artifact paths derived from contract.output',
        section: 'contract',
      }),
    ];
  }
  return [];
}

function buildLoadedConfig(rawConfig: Record<string, unknown>, configDir: string): LoadedConfig {
  const issues = collectConfigIssues(rawConfig);
  const diagnostics = issues.map((issue) =>
    errorConfigValidation(issue.field, { why: issue.message, section: issue.section }),
  );

  const config = blindCast<
    PrismaNextConfig,
    'Structure was checked by collectConfigIssues; sections carrying diagnostics are guarded by requireConfigSections'
  >(rawConfig);

  if (config.contract === undefined || issues.some((issue) => issue.section === 'contract')) {
    return { config, diagnostics };
  }

  const contract = finalizeContractConfig(config.contract, configDir);
  diagnostics.push(...collectArtifactCollisionDiagnostics(contract));
  return { config: { ...config, contract }, diagnostics };
}

function toConfigLoadFailure(error: unknown, configPath?: string): CliStructuredError {
  if (CliStructuredError.is(error)) {
    return error;
  }

  const resolvedPath = configPath ? resolve(process.cwd(), configPath) : undefined;

  if (isStructuredError(error)) {
    return new CliStructuredError(error.code, error.message, {
      ...ifDefined('why', error.why),
      ...ifDefined('fix', error.fix),
      ...ifDefined('where', error.where),
      ...ifDefined('meta', error.meta),
      cause: error,
    });
  }

  // A config file that does not exist never reaches here: c12 resolves no
  // config file and returns an empty config, which `loadConfig` maps to
  // CONFIG.FILE_NOT_FOUND. Everything thrown out of c12 came from evaluating
  // a file that does exist — including `Cannot find module` for a package the
  // config imports, and ENOENT for a file the config itself reads.
  if (error instanceof Error) {
    return errorConfigEvaluationFailed(resolvedPath, { why: error.message, cause: error });
  }
  return errorConfigEvaluationFailed(resolvedPath, { why: String(error) });
}

/**
 * Loads and finalizes the Prisma Next config.
 *
 * Failures that prevent evaluation entirely — missing file, module that does
 * not evaluate (`CONFIG.FILE_NOT_FOUND`, `CONFIG.EVALUATION_FAILED`) — are the
 * `Result` failure. Structural problems inside an evaluated config do not
 * fail the load: they are returned as section-tagged diagnostics so commands
 * fail only on the sections they read (via {@link requireConfigSections}).
 */
export async function loadConfig(
  configPath?: string,
  options?: { readonly cwd?: string },
): Promise<Result<LoadedConfig, CliStructuredError>> {
  const cwd = options?.cwd ?? process.cwd();
  const resolvedConfigPath = configPath ? resolve(cwd, configPath) : undefined;
  const configCwd = resolvedConfigPath ? dirname(resolvedConfigPath) : cwd;

  let result: Awaited<ReturnType<typeof import('c12').loadConfig<Record<string, unknown>>>>;
  try {
    const c12 = await import('c12');
    result = await c12.loadConfig<Record<string, unknown>>({
      name: 'prisma-next',
      ...ifDefined('configFile', resolvedConfigPath),
      cwd: configCwd,
    });
  } catch (error) {
    return notOk(toConfigLoadFailure(error, configPath));
  }

  if (resolvedConfigPath && result.configFile !== resolvedConfigPath) {
    return notOk(errorConfigFileNotFound(resolvedConfigPath));
  }

  if (!result.config || Object.keys(result.config).length === 0) {
    /* v8 ignore next -- @preserve */
    const displayPath = result.configFile || resolvedConfigPath || configPath;
    return notOk(errorConfigFileNotFound(displayPath));
  }

  // c12's merge drops non-enumerable properties, so the marker is read from
  // the raw module export in c12's first layer — the requested config file.
  // (`extends` bases and rc files follow it, and their markers must not vouch
  // for a file that does not carry one itself.)
  /* v8 ignore next -- c12 always returns layers for a config it evaluated */
  const [requestedLayer] = result.layers ?? [];
  if (!hasCurrentConfigFormatVersion(requestedLayer?.config)) {
    /* v8 ignore next -- a config that evaluated always carries its resolved path */
    return notOk(errorConfigVersionMarkerMissing(result.configFile ?? resolvedConfigPath));
  }

  /* v8 ignore next -- @preserve */
  const loadedConfigDir = result.configFile ? dirname(result.configFile) : configCwd;
  return ok(buildLoadedConfig(result.config, loadedConfigDir));
}

/**
 * Narrows a {@link LoadedConfig} to the sections a command reads. Fails with
 * the first diagnostic concerning a required section; diagnostics on other
 * sections are ignored so unrelated commands keep working.
 */
export function requireConfigSections(
  loaded: LoadedConfig,
  sections: readonly ConfigSection[],
): Result<PrismaNextConfig, CliStructuredError> {
  const blocking = loaded.diagnostics.find((diagnostic) => {
    const section = diagnostic.meta?.['section'];
    return typeof section !== 'string' || sections.some((required) => required === section);
  });
  return blocking ? notOk(blocking) : ok(loaded.config);
}

/**
 * Convenience composition of {@link loadConfig} and
 * {@link requireConfigSections} for commands that read a fixed set of
 * sections and have no use for diagnostics outside them.
 */
export async function loadConfigForSections(
  configPath: string | undefined,
  sections: readonly ConfigSection[],
): Promise<Result<PrismaNextConfig, CliStructuredError>> {
  const loaded = await loadConfig(configPath);
  if (!loaded.ok) {
    return loaded;
  }
  return requireConfigSections(loaded.value, sections);
}

export async function loadConfigForFile(
  filePath: string,
): Promise<Result<LoadedConfig, CliStructuredError>> {
  const configPath = await findNearestConfigPathForFile(filePath);
  if (configPath === undefined) {
    return notOk(
      errorConfigFileNotFound(join(dirname(resolve(process.cwd(), filePath)), CONFIG_FILENAME)),
    );
  }
  return loadConfig(configPath);
}
