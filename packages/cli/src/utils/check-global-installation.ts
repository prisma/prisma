import fs from 'node:fs'
import Module from 'node:module'
import path from 'node:path'

/**
 * Check if the CLI is running from a global installation while a local version exists.
 * Returns true if we should show a warning.
 */
export function shouldWarnAboutGlobalInstallation(cwd: string = process.cwd()): boolean {
  // Check if there's a local prisma installation in node_modules
  const localPrismaPath = getLocalPrismaPath(cwd)
  if (!localPrismaPath) {
    // No local installation found, no need to warn
    return false
  }

  // Check if we're running from the global installation
  // We compare the current CLI's location with the local installation
  const currentCliPath = path.dirname(__dirname)
  const localCliPath = path.dirname(localPrismaPath)

  // If the current CLI path doesn't start with the local CLI path,
  // we're running from a different installation (likely global)
  return !currentCliPath.startsWith(localCliPath)
}

/**
 * Get the path to the local prisma package if it exists
 */
function getLocalPrismaPath(cwd: string): string | null {
  try {
    // Try to resolve the local prisma package
    const resolvedPath = require.resolve('prisma/package.json', {
      paths: (Module as any)._nodeModulePaths(cwd),
    })

    // Make sure it's actually in the local node_modules and not a global installation
    // Resolve symlinks to ensure consistent path comparison across platforms
    const realCwd = fs.realpathSync(cwd)
    const realResolvedPath = fs.realpathSync(resolvedPath)
    const localNodeModules = path.join(realCwd, 'node_modules') + path.sep
    if (realResolvedPath.startsWith(localNodeModules)) {
      return resolvedPath
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
    return pkgJson.version ?? null
  } catch {
    return null
  }
}
