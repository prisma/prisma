import fs from 'node:fs'
import path from 'node:path'

/**
 * Normalize a path for comparison. On Windows, paths are case-insensitive,
 * so we lowercase them for reliable comparison.
 */
function normalizeForComparison(p: string): string {
  return process.platform === 'win32' ? p.toLowerCase() : p
}

/**
 * Check if the CLI is running from a global installation while a local version exists.
 * Returns true if we should show a warning.
 */
export function shouldWarnAboutGlobalInstallation(cwd: string = process.cwd()): boolean {
  try {
    // Check if there's a local prisma installation in node_modules
    const localPrismaPath = getLocalPrismaPath(cwd)
    if (!localPrismaPath) {
      // No local installation found, no need to warn
      return false
    }

    // Check if we're running from the global installation
    // Resolve symlinks to ensure consistent path comparison across platforms
    const currentCliPath = normalizeForComparison(fs.realpathSync(path.dirname(__dirname)))
    const localCliPath = normalizeForComparison(fs.realpathSync(path.dirname(localPrismaPath)))

    // If the current CLI path is not the same as or inside the local CLI path,
    // we're running from a different installation (likely global)
    return !(currentCliPath === localCliPath || currentCliPath.startsWith(localCliPath + path.sep))
  } catch {
    // If anything goes wrong (e.g., permissions, broken symlinks), don't warn
    return false
  }
}

/**
 * Get the path to the local prisma package if it exists
 */
function getLocalPrismaPath(cwd: string): string | null {
  try {
    // Try to resolve the local prisma package
    const resolvedPath = require.resolve('prisma/package.json', {
      paths: [cwd],
    })

    // Make sure it's actually in the local node_modules and not a global installation
    // Resolve symlinks to ensure consistent path comparison across platforms
    const realCwd = fs.realpathSync(cwd)
    const realResolvedPath = fs.realpathSync(resolvedPath)
    const localNodeModules = normalizeForComparison(path.join(realCwd, 'node_modules') + path.sep)
    if (normalizeForComparison(realResolvedPath).startsWith(localNodeModules)) {
      return realResolvedPath
    }

    return null
  } catch {
    return null
  }
}

/**
 * Get the version of the local prisma installation
 */
export async function getLocalPrismaVersion(cwd: string = process.cwd()): Promise<string | null> {
  const localPrismaPath = getLocalPrismaPath(cwd)
  if (!localPrismaPath) {
    return null
  }

  try {
    const pkgJsonString = await fs.promises.readFile(localPrismaPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString)
    return typeof pkgJson?.version === 'string' ? pkgJson.version : null
  } catch {
    return null
  }
}
