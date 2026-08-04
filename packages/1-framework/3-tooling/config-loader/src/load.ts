import { access } from 'node:fs/promises';
import type { PrismaNextConfig } from '@internal/config/config-types';
import { validateConfig } from '@internal/config/config-validation';
import { getEmittedArtifactPaths } from '@internal/emitter';
import {
  CliStructuredError,
  errorConfigFileNotFound,
  errorConfigValidation,
  errorUnexpected,
} from '@internal/errors/control';
import { ifDefined } from '@internal/utils/defined';
import { isStructuredError, structuredError } from '@internal/utils/structured-error';
import { dirname, join, resolve } from 'pathe';
import { finalizeConfig } from './finalize-config';

const CONFIG_FILENAME = 'prisma-next.config.ts';

function throwValidation(field: string, why: string): never {
  throw structuredError('CONFIG.VALIDATION_FAILED', why, { why, meta: { field } });
}

function validateNoOutputsAreInputs(
  inputs: readonly string[] | undefined,
  output: string | undefined,
): void {
  if (inputs === undefined || output === undefined) {
    return;
  }

  let emittedArtifactPaths: ReturnType<typeof getEmittedArtifactPaths>;
  try {
    emittedArtifactPaths = getEmittedArtifactPaths(output);
  } catch (error) {
    throwValidation('contract.output', error instanceof Error ? error.message : String(error));
  }

  const emittedPaths = new Set([emittedArtifactPaths.jsonPath, emittedArtifactPaths.dtsPath]);

  for (const input of inputs) {
    if (emittedPaths.has(input)) {
      throwValidation(
        'contract.source.inputs[]',
        'Config.contract.source.inputs must not include emitted artifact paths derived from contract.output',
      );
    }
  }
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

async function discoverAndFinalizeConfig(configPath?: string): Promise<PrismaNextConfig> {
  const cwd = process.cwd();
  const resolvedConfigPath = configPath ? resolve(cwd, configPath) : undefined;
  const configCwd = resolvedConfigPath ? dirname(resolvedConfigPath) : cwd;

  const c12 = await import('c12');
  const result = await c12.loadConfig<PrismaNextConfig>({
    name: 'prisma-next',
    ...ifDefined('configFile', resolvedConfigPath),
    cwd: configCwd,
  });

  if (resolvedConfigPath && result.configFile !== resolvedConfigPath) {
    throw errorConfigFileNotFound(resolvedConfigPath);
  }

  if (!result.config || Object.keys(result.config).length === 0) {
    /* v8 ignore next -- @preserve */
    const displayPath = result.configFile || resolvedConfigPath || configPath;
    throw errorConfigFileNotFound(displayPath);
  }

  validateConfig(result.config);

  /* v8 ignore next -- @preserve */
  const loadedConfigDir = result.configFile ? dirname(result.configFile) : configCwd;
  const config = finalizeConfig(result.config, loadedConfigDir);
  validateNoOutputsAreInputs(config.contract?.source.inputs, config.contract?.output);
  return config;
}

function hasStringCode(error: Error): error is Error & { readonly code: string } {
  return 'code' in error && typeof error.code === 'string';
}

// Exported for direct unit coverage; not part of the public surface.
export function toStructuredConfigError(error: unknown, configPath?: string): Error {
  if (
    isStructuredError(error) &&
    error.code === 'CONFIG.VALIDATION_FAILED' &&
    !(error instanceof CliStructuredError)
  ) {
    const field = typeof error.meta?.['field'] === 'string' ? error.meta['field'] : 'config';
    return errorConfigValidation(field, {
      why: error.why ?? error.message,
    });
  }

  if (error instanceof Error && hasStringCode(error)) {
    return error;
  }

  if (error instanceof Error) {
    if (
      error.message.includes('not found') ||
      error.message.includes('Cannot find') ||
      error.message.includes('ENOENT')
    ) {
      const displayPath = configPath ? resolve(process.cwd(), configPath) : undefined;
      return errorConfigFileNotFound(displayPath, {
        why: error.message,
      });
    }
    return errorUnexpected(error.message, {
      why: `Failed to load config: ${error.message}`,
    });
  }
  return errorUnexpected(String(error));
}

/**
 * Loads, validates, and finalizes the Prisma Next config, mapping every failure
 * to a structured `@internal/errors/control` error (`CliStructuredError`).
 * This is the sole public entry point: callers that need to degrade gracefully
 * (e.g. the language server) branch on the structured error's stable `.code`.
 */
export async function loadConfig(configPath?: string): Promise<PrismaNextConfig> {
  try {
    return await discoverAndFinalizeConfig(configPath);
  } catch (error) {
    throw toStructuredConfigError(error, configPath);
  }
}

export async function loadConfigForFile(filePath: string): Promise<PrismaNextConfig> {
  const configPath = await findNearestConfigPathForFile(filePath);
  if (configPath === undefined) {
    throw errorConfigFileNotFound(join(dirname(resolve(process.cwd(), filePath)), CONFIG_FILENAME));
  }
  return loadConfig(configPath);
}
