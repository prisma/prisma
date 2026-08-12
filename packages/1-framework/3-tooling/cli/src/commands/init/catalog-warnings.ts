import { detectPnpmCatalogOverrides, type PnpmCatalogOverride } from './detect-pnpm-catalog';

function formatCatalogWarning(
  workspaceFile: string,
  entries: readonly PnpmCatalogOverride[],
): string {
  const list = entries.map((entry) => `  • ${entry.name}: ${entry.version}`).join('\n');
  return [
    'pnpm workspace catalog overrides detected — pnpm will install these versions instead of `latest`:',
    list,
    `Catalog source: ${workspaceFile}`,
    'To use the published `latest` instead, remove or update the catalog entry, then re-run `pnpm install`.',
  ].join('\n');
}

/**
 * Honour-and-warn: when the surrounding pnpm workspace pins one of the
 * packages `init` installs through its catalog, say so — the catalog version,
 * not the published `latest`, is what ends up in the project. Empty when there
 * is no workspace above the project or its catalog names none of them.
 */
export function buildCatalogWarnings(
  baseDir: string,
  packages: readonly string[],
): readonly string[] {
  const result = detectPnpmCatalogOverrides(baseDir, packages);
  if (result === null || result.entries.length === 0) {
    return [];
  }
  return [formatCatalogWarning(result.workspaceFile, result.entries)];
}
