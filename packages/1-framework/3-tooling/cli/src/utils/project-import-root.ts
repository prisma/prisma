/**
 * The import root of the project being emitted for, read from its own
 * manifest.
 *
 * Generated files are kept by the application, so every package name in them
 * has to be one the application can resolve — which means one of its direct
 * dependencies (ADR 242). The application already states those in
 * `package.json`, so emission reads them instead of taking a mode from
 * configuration that could disagree with what is installed.
 */

import { readFileSync } from 'node:fs';
import {
  createImportSpecifierResolver,
  type ImportRoot,
  type ImportSpecifierResolver,
  importRootForDependencies,
  internalImportRoot,
} from '@prisma-next/publish-surface/import-roots';
import { dirname, join, resolve } from 'pathe';

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The nearest `package.json` at or above `from`, or `undefined` if there is none. */
function nearestManifest(from: string): Record<string, unknown> | undefined {
  let dir = from;
  while (true) {
    let raw: string;
    try {
      raw = readFileSync(join(dir, 'package.json'), 'utf8');
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
      continue;
    }
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : undefined;
  }
}

function declaredDependencies(manifest: Record<string, unknown>): string[] {
  return DEPENDENCY_FIELDS.flatMap((field) => {
    const value = manifest[field];
    return isRecord(value) ? Object.keys(value) : [];
  });
}

/**
 * The import root for the project that owns `configPath`, or for the working
 * directory when the config was discovered rather than named.
 *
 * A project with no manifest, or one that names no published package, is on
 * the internal root — which emits every specifier exactly as authored, so a
 * project that has not moved to published names is unaffected.
 */
export function projectImportRoot(configPath?: string): ImportRoot {
  const start = configPath === undefined ? resolve('.') : dirname(resolve(configPath));
  const manifest = nearestManifest(start);
  if (manifest === undefined) return internalImportRoot;
  return importRootForDependencies(declaredDependencies(manifest));
}

/** The specifier resolver emission should use for the project owning `configPath`. */
export function createProjectSpecifierResolver(configPath?: string): ImportSpecifierResolver {
  return createImportSpecifierResolver(projectImportRoot(configPath));
}
