import fs from 'fs'
import { bold, yellow } from 'kleur/colors'
import { packageUp } from 'package-up'

/**
 * Result of version mismatch check
 */
export interface VersionMismatchResult {
  hasMismatch: boolean
  globalVersion: string
  localPackageType: '@prisma/client' | 'prisma'
  localVersion: string
}

/**
 * Options for version mismatch check - using dependency injection for testability
 */
export interface VersionMismatchOptions {
  /** Function to check if prisma is installed globally */
  isGlobalInstall: () => string | false
  /** Function to get installed @prisma/client version */
  getClientVersion: (cwd: string) => Promise<string | null>
  /** Function to get local prisma version from package.json */
  getLocalPrismaVersion: (cwd: string) => Promise<string | null>
  /** Current working directory */
  cwd?: string
}

/**
 * Get the local prisma version from package.json dependencies/devDependencies
 */
export async function getLocalPrismaVersion(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const pkgJsonPath = await packageUp({ cwd })

    if (!pkgJsonPath) {
      return null
    }

    const pkgJsonString = await fs.promises.readFile(pkgJsonPath, 'utf-8')
    const pkgJson = JSON.parse(pkgJsonString)
    const prismaVersion = pkgJson.dependencies?.['prisma'] ?? pkgJson.devDependencies?.['prisma']

    if (!prismaVersion) {
      return null
    }

    return prismaVersion
  } catch {
    return null
  }
}

/**
 * Check for version mismatch between global prisma and local packages
 * Returns null if no mismatch, or VersionMismatchResult if there is a mismatch
 */
export async function checkVersionMismatch(
  globalVersion: string,
  options: VersionMismatchOptions,
): Promise<VersionMismatchResult | null> {
  const { isGlobalInstall, getClientVersion, getLocalPrismaVersion, cwd = process.cwd() } = options

  // Only check if prisma is installed globally
  const globalInstallType = isGlobalInstall()
  if (!globalInstallType) {
    return null
  }

  try {
    const localClientVersion = await getClientVersion(cwd)
    const localPrismaVersion = await getLocalPrismaVersion(cwd)

    // Check @prisma/client version mismatch
    if (localClientVersion && localClientVersion !== globalVersion) {
      return {
        hasMismatch: true,
        globalVersion,
        localPackageType: '@prisma/client',
        localVersion: localClientVersion,
      }
    }

    // Check local prisma version mismatch
    if (localPrismaVersion && localPrismaVersion !== globalVersion) {
      return {
        hasMismatch: true,
        globalVersion,
        localPackageType: 'prisma',
        localVersion: localPrismaVersion,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Format the version mismatch warning message
 */
export function formatVersionMismatchWarning(result: VersionMismatchResult): string {
  return `${yellow(bold('warn'))} Global ${bold(`prisma@${result.globalVersion}`)} and Local ${bold(
    `${result.localPackageType}@${result.localVersion}`,
  )} don't match. This might lead to unexpected behavior. Please make sure they have the same version.`
}
